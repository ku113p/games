// Patrol drones (DESIGN 8-9): patrol waypoints, see in a cone, grow suspicion, stare, then alert -> chase and shoot,
// lose you -> look around the last known place. Searchers comb the area at alarm 1-2; wave drones always hunt.
import { cellAt, floorHeightAt } from '../grid'
import type { DroneRole, DroneState, GameState, Sim } from '../state'
import { angleDiff, clamp, DEG, dist2, emit, turnTowards } from '../util'
import { raiseAlarm, randomSearchPoint } from './alarm'
import { fireBolt } from './combat'
import { seeFactor } from './detection'
import { nextCell } from './nav'

/** Brings a drone into a free slot at a spawn point; returns its index or -1 when every slot is busy. */
export function spawnDrone(s: GameState, sim: Sim, role: Exclude<DroneRole, 'patrol'>, x: number, floorY: number, z: number): number {
  const cfg = sim.cfg.drone
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i] as DroneState
    if (d.active || d.patrol >= 0) continue
    d.active = true
    d.alive = true
    d.role = role
    d.hp = cfg.hp
    d.pos.x = x
    d.pos.y = floorY + cfg.hover
    d.pos.z = z
    d.mode = role === 'wave' ? 'alert' : 'investigate'
    d.target.x = x
    d.target.z = z
    d.lastKnown.x = s.player.pos.x
    d.lastKnown.y = s.player.pos.y
    d.lastKnown.z = s.player.pos.z
    d.suspicion = role === 'wave' ? 1 : 0
    d.sees = false
    d.wait = 0
    d.fireCooldown = cfg.fireIntervalSec
    d.lostTimer = 0
    d.pausedTime = 0
    d.spawnTime = cfg.spawnSec
    emit(sim, { type: 'droneSpawned', index: i, role })
    return i
  }
  return -1
}

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
  if (d.mode === 'alert') return
  d.mode = 'alert'
  d.fireCooldown = sim.cfg.drone.fireWindupSec
  emit(sim, { type: 'droneAlerted', index: i })
  if (d.role !== 'wave') raiseAlarm(s, sim, 'drone', s.player.pos.x, s.player.pos.y, s.player.pos.z)
}

/** Flies towards (tx, tz): straight when the way is clear, otherwise along the grid's flow field. Returns the distance left. */
function flyTowards(sim: Sim, d: DroneState, tx: number, tz: number, speed: number, dt: number): number {
  const g = sim.grid
  const hover = sim.cfg.drone.hover
  let gx = tx
  let gz = tz
  const total = Math.sqrt(dist2(d.pos.x, d.pos.z, tx, tz))
  if (total < 0.05) return 0
  const ty = floorHeightAt(g, tx, tz) + hover
  if (!sim.world.lineOfSight(d.pos.x, d.pos.y, d.pos.z, tx, ty, tz)) {
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
    if (!d.sees) d.yaw = turnTowards(d.yaw, Math.atan2(dx, dz), sim.cfg.drone.turnRate * dt)
  }
  const wantY = floorHeightAt(g, d.pos.x, d.pos.z) + hover
  d.pos.y += (wantY - d.pos.y) * clamp(dt * 3, 0, 1)
  return total
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
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i] as DroneState
    if (!d.active || !d.alive) continue
    if (d.spawnTime > 0) {
      d.spawnTime -= dt
      continue
    }
    d.fireCooldown -= dt
    if (d.pausedTime > 0) {
      d.pausedTime -= dt
      d.sees = false
      d.suspicion = Math.max(0, d.suspicion - det.decay * dt)
      continue
    }

    // perception
    const f = seeFactor(s, sim, d.pos.x, d.pos.y, d.pos.z, Math.sin(d.yaw) * cp, -sp, Math.cos(d.yaw) * cp, cosHalf, cfg.range)
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
        const dd = Math.sqrt(dist2(d.pos.x, d.pos.z, d.lastKnown.x, d.lastKnown.z))
        if (!(d.sees && dd < cfg.keepDist)) flyTowards(sim, d, d.lastKnown.x, d.lastKnown.z, cfg.chaseSpeed, dt)
        if (d.sees && d.fireCooldown <= 0 && s.phase === 'playing') {
          d.fireCooldown = cfg.fireIntervalSec
          fireBolt(s, sim, d, i)
        }
        break
      }
      case 'leave': {
        let best = sim.spawns[0]
        let bestD = Infinity
        for (const sp2 of sim.spawns) {
          const dd = dist2(sp2.x, sp2.z, d.pos.x, d.pos.z)
          if (dd < bestD) {
            bestD = dd
            best = sp2
          }
        }
        if (!best || flyTowards(sim, d, best.x, best.z, cfg.searchSpeed, dt) < 0.6) {
          d.active = false
          emit(sim, { type: 'droneLeft', index: i })
        }
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
    if (!d.active || !d.alive || d.spawnTime > 0 || d.pausedTime > 0 || d.mode === 'alert' || d.mode === 'leave') continue
    if (dist2(d.pos.x, d.pos.z, x, z) > r * r) continue
    if (d.mode !== 'investigate') emit(sim, { type: 'droneSuspicious', index: i })
    d.mode = 'investigate'
    d.target.x = x
    d.target.z = z
    d.wait = 0
  }
}
