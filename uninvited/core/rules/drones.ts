// Patrol drones (DESIGN 8-9): patrol waypoints, see in a cone, grow suspicion, stare, then alert -> chase and shoot,
// lose you -> look around the last known place. Searchers comb the area at alarm 1-2; wave drones always hunt.
import { cellAt, floorHeightAt, solidTopAt, type Grid } from '../grid'
import type { DroneConfig } from '../config'
import type { DroneState, GameState, Sim, Vec3 } from '../state'
import { angleDiff, clamp, DEG, dist2, emit, turnTowards } from '../util'
import { raiseAlarm, randomSearchPoint } from './alarm'
import { fireBolt } from './combat'
import { seeFactor } from './detection'
import { abortGateIn, enterGate, gateStep, nearestGate } from './gates'
import { clearOfTall, flyable, nextCell } from './nav'
import { rangedFree } from './tokens'

export { spawnDrone } from './gates'

export function startInvestigating(s: GameState, sim: Sim, i: number, x: number, z: number): void {
  const d = s.drones[i]
  if (!d || !d.alive || d.mode === 'alert') return
  d.mode = 'investigate'
  d.target.x = x
  d.target.z = z
  d.wait = 0
  emit(sim, { type: 'droneSuspicious', index: i })
}

/** The drone has seen (or been hit by) the player: chase. Raises the alarm when it was not already chasing. */
export function alertDrone(s: GameState, sim: Sim, i: number): void {
  const d = s.drones[i]
  if (!d || !d.alive) return
  d.lastKnown.x = s.player.pos.x
  d.lastKnown.y = s.player.pos.y
  d.lastKnown.z = s.player.pos.z
  d.lostTimer = 0
  d.suspicion = 1
  d.pausedTime = 0
  abortGateIn(sim, d)
  if (d.mode === 'alert') return
  d.mode = 'alert'
  d.fireCooldown = sim.cfg.drone.fireWindupSec
  emit(sim, { type: 'droneAlerted', index: i })
  if (d.role !== 'wave') raiseAlarm(s, sim, 'drone', s.player.pos.x, s.player.pos.y, s.player.pos.z)
}

const LOOK = [0, 0, 0.9, 0, -0.9, 0, 0, 0.9, 0, -0.9]

/**
 * The height a drone flies at over (x, z): its hover height over the floor, or higher where low blocks (hex modules,
 * server blocks, parapets up to `overMax` tall) are below or just ahead of it. Taller ones are not flown over (the
 * nav sends the drone around them). Not hot-path heavy: a few lookups per drone and tick.
 */
export function droneAltitude(g: Grid, cfg: DroneConfig, x: number, z: number): number {
  const floor = floorHeightAt(g, x, z)
  let y = floor + cfg.hover
  for (let k = 0; k < LOOK.length; k += 2) {
    const top = solidTopAt(g, x + (LOOK[k] as number), z + (LOOK[k + 1] as number))
    if (top - floor <= cfg.overMax && top + cfg.clearance > y) y = top + cfg.clearance
  }
  return y
}

/** Flies towards (tx, tz): straight when the way is clear, otherwise along the grid's flow field. Returns the distance left. */
function flyTowards(sim: Sim, d: DroneState, tx: number, tz: number, speed: number, dt: number, settle = true): number {
  const g = sim.grid
  let gx = tx
  let gz = tz
  const total = Math.sqrt(dist2(d.pos.x, d.pos.z, tx, tz))
  if (total < 0.05) return 0
  const ty = droneAltitude(g, sim.cfg.drone, tx, tz)
  if (!sim.world.lineOfSight(d.pos.x, d.pos.y, d.pos.z, tx, ty, tz) || !clearOfTall(sim.nav, d.pos.x, d.pos.z, tx, tz)) {
    const from = cellAt(g, d.pos.x, d.pos.z)
    const to = cellAt(g, tx, tz)
    const next = nextCell(sim.nav, from, to)
    if (next >= 0) {
      gx = ((next % g.cols) + 0.5) * g.cell
      gz = (Math.floor(next / g.cols) + 0.5) * g.cell
    }
  }
  const dx = gx - d.pos.x
  const dz = gz - d.pos.z
  const l = Math.sqrt(dx * dx + dz * dz)
  if (l > 1e-4) {
    const step = Math.min(l, speed * dt)
    d.pos.x += (dx / l) * step
    d.pos.z += (dz / l) * step
    if (settle && !d.sees) d.yaw = turnTowards(d.yaw, Math.atan2(dx, dz), sim.cfg.drone.turnRate * dt)
  }
  if (settle) {
    const wantY = droneAltitude(g, sim.cfg.drone, d.pos.x, d.pos.z)
    d.pos.y += (wantY - d.pos.y) * clamp(dt * 3, 0, 1)
  }
  return total
}

/** The golden-ratio share of a drone slot: a spread of radii and heights over the ring without any coordination. */
function share(i: number, k: number): number {
  return (i * k) % 1
}

/** Alert drones (the ones that share the ring) and each one's place among them, refreshed once per tick. */
let ringCount = 0
const ringRank: number[] = []

function rankRing(s: GameState): void {
  ringCount = 0
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i] as DroneState
    ringRank[i] = d.active && d.alive && d.mode === 'alert' ? ringCount++ : -1
  }
}

/**
 * Where drone `i` wants to be in the standoff: its own place on a ring around (cx, cz). A function of the drone's
 * index, the crowd and its own phase (no feedback from where the drone is, so it never dithers at a wall): the crowd is
 * spread evenly round the ring, each at its own radius, and each turns on slowly (ringPhase: the strafe), faster while it has no sight.
 */
function standoffPoint(sim: Sim, i: number, d: DroneState, cx: number, cz: number, out: Vec3): void {
  const so = sim.cfg.drone.standoff
  const g = sim.grid
  const r = so.ringMin + (so.ringMax - so.ringMin) * share(i + 1, 0.618034)
  const n = Math.max(1, ringCount)
  const slotA = (ringRank[i] ?? 0) * ((Math.PI * 2) / n) + 0.7 + d.ringPhase
  // it goes round the ring to its place (a bounded step along the arc), never straight across the player
  const own = Math.atan2(d.pos.z - cz, d.pos.x - cx)
  const a = own + clamp(angleDiff(slotA, own), -0.6, 0.6)
  const rr = r
  let x = cx + Math.cos(a) * rr
  let z = cz + Math.sin(a) * rr
  // a spot inside a wall: try the neighbours on the ring, then closer in; else stay where it is
  const ok = (px: number, pz: number): boolean => {
    const c = cellAt(g, px, pz)
    return c >= 0 && flyable(sim.nav, c)
  }
  if (!ok(x, z)) {
    // a wall there: the neighbours on the ring, then rings closer in (never closer than clearRadius + 1)
    let found = false
    for (let ring = 0; ring < 3 && !found; ring++) {
      const rad = Math.max(so.clearRadius + 1, rr * (1 - ring * 0.2))
      for (let k = 0; k <= 8 && !found; k++) {
        for (let sgn = -1; sgn <= 1 && !found; sgn += 2) {
          if (k === 0 && sgn === 1) continue
          const aa = a + sgn * k * 0.4
          const px = cx + Math.cos(aa) * rad
          const pz = cz + Math.sin(aa) * rad
          if (ok(px, pz)) {
            x = px
            z = pz
            found = true
          }
        }
      }
    }
    if (!found) {
      // boxed in: with sight of the player it holds; without, it works its way closer (the clear radius slides it out again)
      x = d.sees ? d.pos.x : cx
      z = d.sees ? d.pos.z : cz
    }
  }
  out.x = x
  out.z = z
}

const slot: Vec3 = { x: 0, y: 0, z: 0 }

/** The standoff height of drone `i` above the player's floor: its share of the band, capped by the elevation limit at its distance. */
function standoffHeight(sim: Sim, i: number, horiz: number): number {
  const so = sim.cfg.drone.standoff
  const h = so.heightMin + (so.heightMax - so.heightMin) * share(i + 1, 0.414214)
  return Math.min(h, Math.max(so.heightMin * 0.55, horiz * Math.tan(so.maxElevDeg * DEG)))
}

/** Settles the drone's height towards `wantY` (never below what it needs to clear the blocks under it). */
function settleHeight(sim: Sim, d: DroneState, wantY: number, dt: number): void {
  const need = droneAltitude(sim.grid, sim.cfg.drone, d.pos.x, d.pos.z)
  d.pos.y += (Math.max(need, wantY) - d.pos.y) * clamp(dt * 3, 0, 1)
}

/**
 * The fight movement (DESIGN 9): a ring around where the player is (or was last seen), `ringMin..ringMax` out and a few
 * metres up, never above the player: inside clearRadius it slides straight out.
 */
function standoff(s: GameState, sim: Sim, i: number, d: DroneState, dt: number, holding: boolean): void {
  const cfg = sim.cfg.drone
  const so = cfg.standoff
  const cx = d.lastKnown.x
  const cz = d.lastKnown.z
  const px = s.player.pos.x
  const pz = s.player.pos.z
  const floor = floorHeightAt(sim.grid, px, pz)
  const hp = Math.sqrt(dist2(d.pos.x, d.pos.z, px, pz))
  d.yaw = turnTowards(d.yaw, Math.atan2(px - d.pos.x, pz - d.pos.z), cfg.turnRate * dt)
  if (hp < so.clearRadius) {
    // right over (or near) the player: out, along the line from the player, fast
    let dx = d.pos.x - px
    let dz = d.pos.z - pz
    const l = Math.sqrt(dx * dx + dz * dz)
    if (l < 1e-3) {
      dx = Math.cos(i * 2.4)
      dz = Math.sin(i * 2.4)
    } else {
      dx /= l
      dz /= l
    }
    flyTowards(sim, d, px + dx * (so.clearRadius + 2), pz + dz * (so.clearRadius + 2), so.slideSpeed, dt, false)
    settleHeight(sim, d, floor + standoffHeight(sim, i, hp), dt)
    return
  }
  if (holding) {
    settleHeight(sim, d, floor + standoffHeight(sim, i, hp), dt)
    return
  }
  if (!d.sees && hp > so.ringMin + 1) {
    // no line of sight and still far: come closer first (the flow field takes it round the blocks)
    flyTowards(sim, d, cx, cz, cfg.chaseSpeed, dt, false)
    settleHeight(sim, d, floor + standoffHeight(sim, i, hp), dt)
    return
  }
  const strafe = d.sees ? so.strafeSpeed : so.seekStrafeSpeed
  d.ringPhase += ((i % 2 === 0 ? 1 : -1) * strafe * dt) / ((so.ringMin + so.ringMax) * 0.5)
  standoffPoint(sim, i, d, cx, cz, slot)
  const left = Math.sqrt(dist2(d.pos.x, d.pos.z, slot.x, slot.z))
  flyTowards(sim, d, slot.x, slot.z, left > 3 ? cfg.chaseSpeed : Math.max(so.strafeSpeed * 4, left * 1.5), dt, false)
  settleHeight(sim, d, floor + standoffHeight(sim, i, hp), dt)
}

function lookAround(sim: Sim, d: DroneState, dt: number): void {
  d.yaw = angleDiff(d.yaw + sim.cfg.drone.turnRate * 0.35 * dt, 0)
}

export function updateDrones(s: GameState, sim: Sim, dt: number): void {
  const cfg = sim.cfg.drone
  const det = sim.cfg.detection
  const cosHalf = Math.cos(cfg.halfAngleDeg * DEG)
  const pitch = cfg.pitchDeg * DEG
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const p = s.player.pos
  rankRing(s)
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i] as DroneState
    if (!d.active || !d.alive) continue
    if (gateStep(sim, i, d, dt)) continue
    d.fireCooldown -= dt
    if (d.token && d.aim <= 0) {
      d.tokenHold -= dt
      if (d.tokenHold <= 0) d.token = false
    }
    if (d.pausedTime > 0) {
      d.pausedTime -= dt
      d.sees = false
      d.suspicion = Math.max(0, d.suspicion - det.decay * dt)
      continue
    }

    // perception
    const f = seeFactor(s, sim, d.pos.x, d.pos.y, d.pos.z, Math.sin(d.yaw) * cp, -sp, Math.cos(d.yaw) * cp, cosHalf, d.mode === 'alert' ? cfg.standoff.alertRange : cfg.range)
    d.sees = f > 0
    if (d.role === 'wave' && s.phase === 'playing') {
      // waves always know where you are (DESIGN 9: nowhere to hide)
      d.lastKnown.x = p.x
      d.lastKnown.y = p.y
      d.lastKnown.z = p.z
      d.mode = 'alert'
    }
    if (d.mode === 'alert') {
      if (d.sees) {
        d.lastKnown.x = p.x
        d.lastKnown.y = p.y
        d.lastKnown.z = p.z
        d.lostTimer = 0
      } else if (d.role !== 'wave') {
        d.lostTimer += dt
        if (d.lostTimer > cfg.loseSec) {
          d.mode = 'investigate'
          d.target.x = d.lastKnown.x
          d.target.z = d.lastKnown.z
          d.wait = 0
          d.suspicion = 0.5
        }
      }
    } else if (d.sees) {
      const before = d.suspicion
      const keen = d.mode === 'investigate' || d.mode === 'search' ? 1.6 : 1
      d.suspicion = Math.min(1, d.suspicion + det.rate * f * keen * dt)
      if (before === 0) emit(sim, { type: 'droneSuspicious', index: i })
      if (d.suspicion >= 1) alertDrone(s, sim, i)
    } else {
      d.suspicion = Math.max(0, d.suspicion - det.decay * dt)
    }

    // the player's chest, for facing and shooting
    if (d.sees) d.yaw = turnTowards(d.yaw, Math.atan2(p.x - d.pos.x, p.z - d.pos.z), cfg.turnRate * dt)

    switch (d.mode) {
      case 'patrol': {
        if (d.sees) break // stares while making up its mind
        const route = sim.patrols[d.patrol]
        if (!route) {
          d.mode = 'search'
          break
        }
        if (d.wait > 0) {
          d.wait -= dt
          lookAround(sim, d, dt)
          break
        }
        const w = route[d.wp % route.length]
        if (!w) break
        const left = flyTowards(sim, d, w.x, w.z, cfg.patrolSpeed, dt)
        if (left < 0.3) {
          d.wp = (d.wp + 1) % route.length
          d.wait = cfg.waypointPauseSec
        }
        break
      }
      case 'investigate': {
        if (d.sees) break
        if (d.wait > 0) {
          d.wait -= dt
          lookAround(sim, d, dt)
          if (d.wait <= 0) {
            if (d.role === 'checker') d.mode = 'leave'
            else if (d.role === 'searcher') d.mode = s.alarm.stage > 0 ? 'search' : 'leave'
            else d.mode = 'patrol'
            if (d.mode === 'search') randomSearchPoint(s, sim, s.alarm.center.x, s.alarm.center.z, sim.cfg.alarm.searchRadius[s.alarm.stage] ?? 10, d.target)
          }
          break
        }
        const left = flyTowards(sim, d, d.target.x, d.target.z, cfg.searchSpeed, dt)
        if (left < 0.6) d.wait = cfg.lookAroundSec
        break
      }
      case 'search': {
        if (d.sees) break
        if (d.wait > 0) {
          d.wait -= dt
          lookAround(sim, d, dt)
          if (d.wait <= 0) randomSearchPoint(s, sim, s.alarm.center.x, s.alarm.center.z, sim.cfg.alarm.searchRadius[s.alarm.stage] ?? 10, d.target)
          break
        }
        const left = flyTowards(sim, d, d.target.x, d.target.z, cfg.searchSpeed, dt)
        if (left < 0.6) d.wait = cfg.lookAroundSec * 0.6
        break
      }
      case 'alert': {
        // the shot telegraph: hold still and lock on for aimSec; losing sight cancels it
        if (d.aim > 0) {
          if (!d.sees || s.phase !== 'playing') {
            d.aim = 0
            d.token = false
            d.fireCooldown = Math.max(d.fireCooldown, cfg.aimSec * 0.5)
          } else {
            d.aim -= dt
            if (dist2(d.pos.x, d.pos.z, p.x, p.z) < cfg.standoff.clearRadius * cfg.standoff.clearRadius) standoff(s, sim, i, d, dt, true)
            if (d.aim <= 0) {
              d.aim = 0
              d.tokenHold = sim.cfg.tokens.rangedHoldSec
              d.fireCooldown = cfg.fireIntervalSec
              fireBolt(s, sim, d, i)
            }
            break
          }
        }
        standoff(s, sim, i, d, dt, false)
        if (d.sees && d.fireCooldown <= 0 && s.phase === 'playing' && rangedFree(s, sim) && dist2(d.pos.x, d.pos.z, p.x, p.z) >= cfg.standoff.clearRadius * cfg.standoff.clearRadius) {
          d.token = true
          d.aim = cfg.aimSec
          emit(sim, { type: 'droneAiming', index: i })
        }
        break
      }
      case 'leave': {
        const g = nearestGate(sim, d.pos.x, d.pos.z)
        const gate = sim.gates[g]
        if (!gate) {
          d.active = false
          emit(sim, { type: 'droneLeft', index: i })
          break
        }
        if (flyTowards(sim, d, gate.out.x, gate.out.z, cfg.searchSpeed, dt) < 0.4) enterGate(s, sim, d, g)
        break
      }
    }
  }
}

/** Every drone that hears a noise (within its radius x hearFactor) and is not chasing comes to look. */
export function dronesHear(s: GameState, sim: Sim, x: number, z: number, radius: number): void {
  const r = radius * sim.cfg.drone.hearFactor
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i] as DroneState
    if (!d.active || !d.alive || d.spawnTime > 0 || d.gateTime > 0 || d.pausedTime > 0 || d.mode === 'alert' || d.mode === 'leave') continue
    if (dist2(d.pos.x, d.pos.z, x, z) > r * r) continue
    if (d.mode !== 'investigate') emit(sim, { type: 'droneSuspicious', index: i })
    d.mode = 'investigate'
    d.target.x = x
    d.target.z = z
    d.wait = 0
  }
}
