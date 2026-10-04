// Wardens (DESIGN 8): walking sentinel programs - guards, separate from the drones. A warden does its job: it keeps a
// post or walks a round of stops where it stands a while, looks around slowly or checks a rack, with varied pauses.
// It sees in a forward cone that follows its head (shorter and narrower than a camera's) and hears noise. Something
// odd: it stops and turns to it (suspicious, the "?"), then walks over and searches a little, then goes back to its
// round. Spotted: it calls the alarm and fights - closes in for a telegraphed melee strike, or takes a slow aimed arm
// shot from further away. It turns slowly, so you can sneak up behind it. Alarm 1-2 sends it to search the alarm area;
// a terminal can pause it; `controlled` is the hook for May's "take over a sentry".
import { cellAt, cellCenterX, cellCenterZ, cellFloor, cellIndex, floorHeightAt, yawTowards, type Grid } from '../grid'
import type { LevelDef, WardenDef } from '../level'
import { nextFloat } from '../random'
import type { GameState, Sim, Vec3, WardenState } from '../state'
import { angleDiff, clamp, DEG, dist2, emit, turnTowards } from '../util'
import { raiseAlarm } from './alarm'
import { hurtPlayer } from './combat'
import { seeFactor } from './detection'
import { findPath, walkable, type WalkNav } from './walk'

/** A stop of a warden's round in world units. */
export interface WardenRouteStop {
  x: number
  y: number
  z: number
  /** s; Infinity at a post. */
  waitSec: number
  /** Yaw to face while standing here; NaN = any. */
  look: number
}

/** A warden's round, built with the level (static, not saved). */
export interface WardenRoute {
  stops: WardenRouteStop[]
  /** No route: it keeps its post (one stop, forever). */
  post: boolean
  /** The walked loop through the stops (floor points), for network vision. Empty at a post. */
  line: Vec3[]
}

/** The walk a warden follows right now (corner points, x z pairs), and the goal it was planned for. */
export interface WalkPath {
  pts: Float32Array
  n: number
  k: number
  gx: number
  gz: number
}

const ARRIVE = 0.25
const STUCK_SPEED = 0.05

function lookYaw(look: WardenDef['post'] | number | undefined): number {
  if (look === undefined) return NaN
  return typeof look === 'number' ? look * DEG : yawTowards(look)
}

/** The rounds of every warden of a level; throws a readable error when a stop cannot be walked to. Cold path. */
export function buildWardenRoutes(level: LevelDef, g: Grid, walk: WalkNav): WardenRoute[] {
  const out: WardenRoute[] = []
  const pts = new Float32Array(256)
  const at = (c: readonly [number, number]): Vec3 => ({ x: cellCenterX(g, c[0]), y: cellFloor(g, cellIndex(g, c[0], c[1])), z: cellCenterZ(g, c[1]) })
  for (const e of level.entities) {
    if (e.kind !== 'warden') continue
    if (!e.route || e.route.length === 0) {
      const p = at(e.at)
      out.push({ stops: [{ x: p.x, y: p.y, z: p.z, waitSec: Infinity, look: lookYaw(e.post ?? 's') }], post: true, line: [] })
      continue
    }
    const stops = e.route.map((s): WardenRouteStop => {
      const p = at(s.at)
      return { x: p.x, y: p.y, z: p.z, waitSec: s.waitSec ?? 0, look: lookYaw(s.look) }
    })
    const line: Vec3[] = []
    const leg = (a: { x: number; z: number }, b: { x: number; z: number }, what: string): void => {
      const n = findPath(walk, a.x, a.z, b.x, b.z, pts)
      if (n < 0) throw new Error(`level ${level.id}: warden ${e.id} cannot walk ${what}`)
      for (let k = 0; k < n; k++) {
        const x = pts[k * 2] as number
        const z = pts[k * 2 + 1] as number
        line.push({ x, y: floorHeightAt(g, x, z), z })
      }
    }
    const start = at(e.at)
    leg(start, stops[0] as WardenRouteStop, `from its start [${e.at[0]}, ${e.at[1]}] to its first stop`)
    line.length = 0
    const first = stops[0] as WardenRouteStop
    line.push({ x: first.x, y: first.y, z: first.z })
    for (let k = 0; k < stops.length; k++) {
      const a = stops[k] as WardenRouteStop
      const b = stops[(k + 1) % stops.length] as WardenRouteStop
      const r = e.route[(k + 1) % stops.length]
      if (a !== b) leg(a, b, `to its stop [${r?.at[0]}, ${r?.at[1]}]`)
    }
    out.push({ stops, post: false, line })
  }
  return out
}

/** Fresh wardens at their starts. Cold path. */
export function createWardens(sim: Sim): WardenState[] {
  const g = sim.grid
  const defs = sim.level.entities.filter((e): e is WardenDef => e.kind === 'warden')
  return defs.map((d, i): WardenState => {
    const route = sim.wardenRoutes[i] as WardenRoute
    const x = cellCenterX(g, d.at[0])
    const z = cellCenterZ(g, d.at[1])
    const first = route.stops[0] as WardenRouteStop
    let yaw = route.post ? first.look : Math.atan2(first.x - x, first.z - z)
    if (!route.post && dist2(x, z, first.x, first.z) < 0.01) {
      const second = route.stops[1 % route.stops.length] as WardenRouteStop
      yaw = Number.isNaN(first.look) ? Math.atan2(second.x - x, second.z - z) : first.look
    }
    if (!Number.isFinite(yaw)) yaw = 0
    return {
      id: d.id,
      alive: true,
      hp: sim.cfg.warden.hp,
      pos: { x, y: cellFloor(g, cellIndex(g, d.at[0], d.at[1])), z },
      yaw,
      head: 0,
      headWant: 0,
      speed: 0,
      mode: 'patrol',
      act: 'walk',
      actTime: 0,
      actLen: 0,
      glance: 0,
      stop: 0,
      goal: { x: first.x, y: first.y, z: first.z },
      lastKnown: { x, y: 0, z },
      suspicion: 0,
      sees: false,
      lostTimer: 0,
      wait: 0,
      pausedTime: 0,
      strike: 0,
      recover: 0,
      aim: 0,
      fireCooldown: 0,
      hitTime: 0,
      repath: 0,
      controlled: false,
    }
  })
}

/** Where a warden looks (its cone's yaw): the body plus the head turn. */
export function wardenLook(w: Readonly<WardenState>): number {
  return w.yaw + w.head
}

/** A warden is fighting you. */
export function alertWarden(s: GameState, sim: Sim, i: number): void {
  const w = s.wardens[i]
  if (!w || !w.alive || w.controlled) return
  const p = s.player.pos
  w.lastKnown.x = p.x
  w.lastKnown.y = p.y
  w.lastKnown.z = p.z
  w.lostTimer = 0
  w.suspicion = 1
  w.pausedTime = 0
  if (w.mode === 'alert') return
  w.mode = 'alert'
  w.act = 'walk'
  w.wait = 0
  w.fireCooldown = sim.cfg.warden.shotFirstSec
  emit(sim, { type: 'wardenAlerted', index: i })
  raiseAlarm(s, sim, 'warden', p.x, p.y, p.z)
}

/** The gunblade hit it (combat.ts applies the damage): a flinch, and it knows where you are. */
export function wardenHit(s: GameState, sim: Sim, i: number): void {
  const w = s.wardens[i]
  if (!w || !w.alive) return
  w.hitTime = sim.cfg.warden.hitAnimSec
  alertWarden(s, sim, i)
}

/** Stops and turns to look at lastKnown (the "?" cue). The event only when it was calm before. */
function becomeSuspicious(sim: Sim, w: WardenState, i: number): void {
  const calm = w.mode === 'patrol' || w.mode === 'return' || w.mode === 'search'
  if (w.mode === 'suspicious') return
  w.mode = 'suspicious'
  w.act = 'stand'
  w.wait = sim.cfg.warden.suspiciousSec
  w.speed = 0
  if (calm) emit(sim, { type: 'wardenSuspicious', index: i })
}

/** Walks towards (gx, gz) along the planned path; returns the straight distance left, or -1 when it cannot get there. */
function walkTo(sim: Sim, i: number, w: WardenState, gx: number, gz: number, speed: number, turnRate: number, dt: number): number {
  const path = sim.wardenPaths[i] as WalkPath
  const cfg = sim.cfg.warden
  w.repath -= dt
  if (path.gx !== gx || path.gz !== gz || w.repath <= 0 || path.n <= 0 || path.k >= path.n) {
    path.n = findPath(sim.walk, w.pos.x, w.pos.z, gx, gz, path.pts)
    path.k = 0
    path.gx = gx
    path.gz = gz
    w.repath = cfg.repathSec
  }
  if (path.n < 0) {
    w.speed = 0
    return -1
  }
  let tx = path.pts[path.k * 2] as number
  let tz = path.pts[path.k * 2 + 1] as number
  while (path.k < path.n - 1 && dist2(w.pos.x, w.pos.z, tx, tz) < 0.35 * 0.35) {
    path.k++
    tx = path.pts[path.k * 2] as number
    tz = path.pts[path.k * 2 + 1] as number
  }
  const lastX = path.pts[(path.n - 1) * 2] as number
  const lastZ = path.pts[(path.n - 1) * 2 + 1] as number
  const left = Math.sqrt(dist2(w.pos.x, w.pos.z, lastX, lastZ))
  if (path.k === path.n - 1 && left < ARRIVE * 0.5) {
    w.speed = 0
    return left
  }
  const dx = tx - w.pos.x
  const dz = tz - w.pos.z
  const l = Math.sqrt(dx * dx + dz * dz)
  if (l < 1e-4) {
    w.speed = 0
    return left
  }
  const want = Math.atan2(dx, dz)
  w.yaw = turnTowards(w.yaw, want, turnRate * dt)
  // it turns before it walks: a sharp turn slows it to a stop, then it sets off along the new leg
  const align = Math.cos(angleDiff(want, w.yaw))
  const v = speed * clamp((align - 0.35) / 0.65, 0, 1)
  const step = Math.min(v * dt, l)
  if (step > 0) {
    const m = sim.move
    sim.world.moveCharacter(w.pos.x, w.pos.y, w.pos.z, (dx / l) * step, 0, (dz / l) * step, false, dt, m)
    const moved = Math.sqrt(dist2(w.pos.x, w.pos.z, m.x, m.z))
    w.pos.x = m.x
    w.pos.z = m.z
    w.pos.y = floorHeightAt(sim.grid, w.pos.x, w.pos.z)
    w.speed = moved / dt
    if (moved < STUCK_SPEED * step) w.repath = Math.min(w.repath, 0.2) // pushed against something: plan again soon
  } else w.speed = 0
  return left
}

/** Turns the body towards (x, z) on the spot. */
function face(w: WardenState, x: number, z: number, rate: number, dt: number): void {
  if (dist2(w.pos.x, w.pos.z, x, z) < 1e-4) return
  w.yaw = turnTowards(w.yaw, Math.atan2(x - w.pos.x, z - w.pos.z), rate * dt)
}

/** The head looks towards (x, z) as far as its neck allows. */
function headAt(sim: Sim, w: WardenState, x: number, z: number): void {
  const max = sim.cfg.warden.headMaxDeg * DEG
  w.headWant = clamp(angleDiff(Math.atan2(x - w.pos.x, z - w.pos.z), w.yaw), -max, max)
}

/** A slow look around: the head sweeps side to side over the act. */
function sweepHead(sim: Sim, w: WardenState, elapsed: number): void {
  const c = sim.cfg.warden
  w.headWant = c.scanDeg * DEG * Math.sin((elapsed / c.scanPeriodSec) * Math.PI * 2)
}

function startAct(s: GameState, sim: Sim, w: WardenState, act: WardenState['act'], len: number): void {
  w.act = act
  w.actLen = len
  w.actTime = len
  w.glance = (nextFloat(s.rng) * 2 - 1) * sim.cfg.warden.glanceDeg * DEG
  w.speed = 0
}

function range(s: GameState, r: readonly number[]): number {
  const a = r[0] ?? 1
  const b = r[1] ?? a
  return a + (b - a) * nextFloat(s.rng)
}

/** Reached its stop: stand a while (varied), or now and then pause on the way, or walk on. */
function arrive(s: GameState, sim: Sim, w: WardenState, route: WardenRoute): void {
  const c = sim.cfg.warden
  const st = route.stops[w.stop] as WardenRouteStop
  if (route.post || route.stops.length === 1) {
    startAct(s, sim, w, nextFloat(s.rng) < 0.5 ? 'scan' : 'stand', range(s, c.postActSec))
    return
  }
  if (st.waitSec > 0) {
    const len = st.waitSec * (1 + c.waitVary * (nextFloat(s.rng) * 2 - 1))
    const r = nextFloat(s.rng)
    startAct(s, sim, w, Number.isNaN(st.look) ? (r < 0.45 ? 'scan' : 'stand') : r < 0.65 ? 'check' : 'stand', len)
    return
  }
  if (nextFloat(s.rng) < c.pauseChance) {
    startAct(s, sim, w, nextFloat(s.rng) < 0.5 ? 'scan' : 'stand', range(s, c.pauseSec))
    return
  }
  w.stop = (w.stop + 1) % route.stops.length
  w.act = 'walk'
}

/** A walkable spot near the alarm point for an alarm search; falls back to the point itself. */
function searchPoint(s: GameState, sim: Sim, w: WardenState): void {
  const a = s.alarm
  const g = sim.grid
  const r = Math.min(sim.cfg.alarm.searchRadius[a.stage] ?? 10, 16)
  for (let tries = 0; tries < 10; tries++) {
    const x = a.center.x + (nextFloat(s.rng) * 2 - 1) * r
    const z = a.center.z + (nextFloat(s.rng) * 2 - 1) * r
    const c = cellAt(g, x, z)
    if (!walkable(sim.walk, c)) continue
    w.goal.x = ((c % g.cols) + 0.5) * g.cell
    w.goal.z = (Math.floor(c / g.cols) + 0.5) * g.cell
    return
  }
  w.goal.x = a.center.x
  w.goal.z = a.center.z
}

function fireArmBolt(s: GameState, sim: Sim, w: WardenState, i: number): void {
  let b = null
  for (const x of s.bolts) {
    if (!x.active) {
      b = x
      break
    }
  }
  if (!b) return
  const c = sim.cfg.warden
  const p = s.player
  const ox = w.pos.x + Math.sin(w.yaw) * 0.6
  const oy = w.pos.y + c.chestHeight
  const oz = w.pos.z + Math.cos(w.yaw) * 0.6
  const tx = p.pos.x - ox
  const ty = p.pos.y + sim.cfg.player.chestHeight - oy
  const tz = p.pos.z - oz
  const l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1
  b.active = true
  b.life = sim.cfg.drone.boltLifeSec
  b.pos.x = ox
  b.pos.y = oy
  b.pos.z = oz
  b.vel.x = (tx / l) * c.boltSpeed
  b.vel.y = (ty / l) * c.boltSpeed
  b.vel.z = (tz / l) * c.boltSpeed
  emit(sim, { type: 'wardenFired', index: i })
}

/** Bumped into: it is pushed aside (it has no collider of its own) and feels you. */
function bump(s: GameState, sim: Sim, w: WardenState, i: number, dt: number): void {
  const p = s.player.pos
  const min = sim.cfg.warden.radius + sim.cfg.player.radius
  const dx = w.pos.x - p.x
  const dz = w.pos.z - p.z
  const d2 = dx * dx + dz * dz
  if (d2 >= min * min || Math.abs(p.y - w.pos.y) > 1.5 || s.phase !== 'playing') return
  const d = Math.sqrt(d2)
  const nx = d > 1e-4 ? dx / d : -Math.sin(w.yaw)
  const nz = d > 1e-4 ? dz / d : -Math.cos(w.yaw)
  const push = min - d
  const m = sim.move
  sim.world.moveCharacter(w.pos.x, w.pos.y, w.pos.z, nx * push, 0, nz * push, false, dt, m)
  w.pos.x = m.x
  w.pos.z = m.z
  w.pos.y = floorHeightAt(sim.grid, w.pos.x, w.pos.z)
  if (w.mode === 'alert' || w.pausedTime > 0) return
  w.suspicion = Math.max(w.suspicion, sim.cfg.warden.bumpSuspicion)
  w.lastKnown.x = p.x
  w.lastKnown.z = p.z
  if (w.mode === 'suspicious') w.wait = Math.max(w.wait, sim.cfg.warden.suspiciousSec * 0.5)
  else becomeSuspicious(sim, w, i)
}

export function updateWardens(s: GameState, sim: Sim, dt: number): void {
  const c = sim.cfg.warden
  const det = sim.cfg.detection
  const cosHalf = Math.cos(c.halfAngleDeg * DEG)
  const cp = Math.cos(c.pitchDeg * DEG)
  const sp = Math.sin(c.pitchDeg * DEG)
  const p = s.player.pos
  for (let i = 0; i < s.wardens.length; i++) {
    const w = s.wardens[i] as WardenState
    if (!w.alive) continue
    const route = sim.wardenRoutes[i] as WardenRoute
    w.hitTime -= dt
    w.fireCooldown -= dt
    if (w.pausedTime > 0 || w.controlled) {
      // paused by a terminal, or taken over: it stands, sees and hears nothing
      if (w.pausedTime > 0) w.pausedTime -= dt
      w.sees = false
      w.suspicion = Math.max(0, w.suspicion - det.decay * dt)
      w.strike = 0
      w.aim = 0
      w.speed = 0
      continue
    }
    bump(s, sim, w, i, dt)

    // perception: the cone looks along body + head
    const look = w.yaw + w.head
    let f = seeFactor(s, sim, w.pos.x, w.pos.y + c.eyeHeight, w.pos.z, Math.sin(look) * cp, -sp, Math.cos(look) * cp, cosHalf, c.range)
    // right in front of it (under the cone's lower edge, crouched or not) it notices you anyway
    if (f === 0 && s.phase === 'playing' && dist2(w.pos.x, w.pos.z, p.x, p.z) < c.closeDist * c.closeDist && Math.abs(p.y - w.pos.y) < 1.5) {
      if (Math.abs(angleDiff(Math.atan2(p.x - w.pos.x, p.z - w.pos.z), look)) < c.closeHalfAngleDeg * DEG) f = 1
    }
    w.sees = f > 0
    if (w.sees) {
      w.lastKnown.x = p.x
      w.lastKnown.y = p.y
      w.lastKnown.z = p.z
    }
    if (w.mode !== 'alert') {
      if (w.sees) {
        const keen = w.mode === 'patrol' || w.mode === 'return' ? 1 : c.keen
        w.suspicion = Math.min(1, w.suspicion + det.rate * f * keen * (s.alarm.stage >= 3 ? c.keen : 1) * dt)
        if (w.suspicion >= 1) alertWarden(s, sim, i)
        else becomeSuspicious(sim, w, i)
      } else w.suspicion = Math.max(0, w.suspicion - det.decay * 0.5 * dt)
    }

    // hearing
    for (let n = 0; n < sim.noiseCount; n++) {
      const z = sim.noises[n]
      if (!z) continue
      const r = z.radius * c.hearFactor
      if (dist2(w.pos.x, w.pos.z, z.x, z.z) > r * r) continue
      if (w.mode === 'alert') {
        if (!w.sees) {
          w.lastKnown.x = z.x
          w.lastKnown.z = z.z
        }
        continue
      }
      w.lastKnown.x = z.x
      w.lastKnown.z = z.z
      if (w.mode === 'investigate') {
        w.goal.x = z.x
        w.goal.z = z.z
        w.wait = 0
      } else if (w.mode === 'suspicious') w.wait = Math.max(w.wait, c.suspiciousSec * 0.5)
      else becomeSuspicious(sim, w, i)
    }

    // the alarm: search its area at any stage, back to the round when it is over
    const stage = s.alarm.stage
    if (stage > 0 && (w.mode === 'patrol' || w.mode === 'return')) {
      const r = sim.cfg.alarm.searchRadius[stage] ?? 0
      if (dist2(w.pos.x, w.pos.z, s.alarm.center.x, s.alarm.center.z) <= r * r) {
        w.mode = 'search'
        w.act = 'walk'
        w.wait = 0
        searchPoint(s, sim, w)
      }
    } else if (stage === 0 && w.mode === 'search') {
      w.mode = 'return'
      w.act = 'walk'
    }

    switch (w.mode) {
      case 'patrol': {
        const st = route.stops[w.stop] as WardenRouteStop
        if (w.act === 'walk') {
          w.headWant = 0
          const left = walkTo(sim, i, w, st.x, st.z, c.patrolSpeed, c.turnRate, dt)
          if (left < ARRIVE) arrive(s, sim, w, route)
          break
        }
        w.speed = 0
        w.actTime -= dt
        const elapsed = w.actLen - w.actTime
        if (!Number.isNaN(st.look)) w.yaw = turnTowards(w.yaw, st.look, c.turnRate * 0.6 * dt)
        if (w.act === 'scan') sweepHead(sim, w, elapsed)
        else if (w.act === 'stand') {
          const t = w.actLen > 0 ? elapsed / w.actLen : 0
          w.headWant = t > 0.3 && t < 0.7 ? w.glance : 0
        } else w.headWant = 0
        if (w.actTime <= 0) {
          if (route.post || route.stops.length === 1) arrive(s, sim, w, route)
          else {
            w.stop = (w.stop + 1) % route.stops.length
            w.act = 'walk'
          }
        }
        break
      }
      case 'suspicious': {
        w.speed = 0
        face(w, w.lastKnown.x, w.lastKnown.z, c.turnRate, dt)
        headAt(sim, w, w.lastKnown.x, w.lastKnown.z)
        if (w.sees) w.wait = Math.max(w.wait, 0.4) // keeps staring while it makes up its mind
        w.wait -= dt
        if (w.wait <= 0) {
          w.mode = 'investigate'
          w.act = 'walk'
          w.goal.x = w.lastKnown.x
          w.goal.z = w.lastKnown.z
          w.wait = 0
        }
        break
      }
      case 'investigate':
      case 'search': {
        if (w.wait > 0) {
          // looking around where it went to check
          w.act = 'scan'
          w.speed = 0
          w.wait -= dt
          sweepHead(sim, w, w.actLen - w.wait)
          w.yaw += c.turnRate * 0.25 * dt
          if (w.wait <= 0) {
            if (w.mode === 'search' && s.alarm.stage > 0) searchPoint(s, sim, w)
            else {
              w.mode = 'return'
              w.act = 'walk'
              emit(sim, { type: 'wardenGaveUp', index: i })
            }
          }
          break
        }
        w.act = 'walk'
        w.headWant = 0
        const left = walkTo(sim, i, w, w.goal.x, w.goal.z, w.mode === 'search' ? c.searchSpeed : c.investigateSpeed, c.turnRate, dt)
        if (left < 0.6) {
          w.wait = w.mode === 'search' ? c.searchLookSec : c.investigateLookSec
          w.actLen = w.wait
        }
        break
      }
      case 'return': {
        w.headWant = 0
        const st = route.stops[w.stop] as WardenRouteStop
        const left = walkTo(sim, i, w, st.x, st.z, c.patrolSpeed, c.turnRate, dt)
        if (left < ARRIVE) {
          w.mode = 'patrol'
          arrive(s, sim, w, route)
        }
        break
      }
      case 'alert': {
        if (w.sees) w.lostTimer = 0
        else w.lostTimer += dt
        if (w.lostTimer > c.loseSec && w.strike <= 0) {
          w.mode = 'investigate'
          w.act = 'walk'
          w.goal.x = w.lastKnown.x
          w.goal.z = w.lastKnown.z
          w.wait = 0
          w.aim = 0
          w.recover = 0
          w.suspicion = 0.5
          break
        }
        const toP = Math.atan2(p.x - w.pos.x, p.z - w.pos.z)
        if (w.sees) headAt(sim, w, p.x, p.z)
        else w.headWant = 0
        if (w.strike > 0) {
          // the telegraph: the arm is up, it tracks you slowly; then the blow lands where you are now
          w.speed = 0
          w.yaw = turnTowards(w.yaw, toP, c.turnRate * dt)
          w.strike -= dt
          if (w.strike <= 0) {
            w.strike = 0
            w.recover = c.strikeRecoverSec
            const reach = Math.sqrt(dist2(w.pos.x, w.pos.z, p.x, p.z))
            const inArc = Math.abs(angleDiff(toP, w.yaw)) <= (c.strikeArcDeg / 2) * DEG
            const hit = s.phase === 'playing' && reach <= c.strikeReach && inArc && Math.abs(p.y - w.pos.y) < 1.6 && hurtPlayer(s, sim, c.strikeDamage, w.pos.x, w.pos.z)
            emit(sim, { type: 'wardenStruck', index: i, hit })
          }
          break
        }
        if (w.recover > 0) {
          w.recover -= dt
          w.speed = 0
          break
        }
        if (w.aim > 0) {
          if (!w.sees || s.phase !== 'playing') {
            w.aim = 0
            w.fireCooldown = Math.max(w.fireCooldown, c.shotAimSec * 0.5)
          } else {
            w.speed = 0
            w.yaw = turnTowards(w.yaw, toP, c.turnRate * dt)
            w.aim -= dt
            if (w.aim <= 0) {
              w.aim = 0
              w.fireCooldown = c.shotIntervalSec
              fireArmBolt(s, sim, w, i)
            }
            break
          }
        }
        const tx = w.sees ? p.x : w.lastKnown.x
        const tz = w.sees ? p.z : w.lastKnown.z
        const d = Math.sqrt(dist2(w.pos.x, w.pos.z, tx, tz))
        if (w.sees && s.phase === 'playing' && d < c.strikeRange && Math.abs(angleDiff(toP, w.yaw)) < 0.6) {
          w.strike = c.strikeWindupSec
          w.speed = 0
          emit(sim, { type: 'wardenStrike', index: i })
          break
        }
        if (w.sees && s.phase === 'playing' && d >= c.shotMinDist && w.fireCooldown <= 0 && w.hitTime <= 0) {
          w.aim = c.shotAimSec
          w.speed = 0
          emit(sim, { type: 'wardenAiming', index: i })
          break
        }
        if (w.hitTime > 0 || d < c.strikeRange * 0.8) {
          w.speed = 0
          face(w, tx, tz, c.alertTurnRate, dt)
        } else if (walkTo(sim, i, w, tx, tz, c.alertSpeed, c.alertTurnRate, dt) < 0) face(w, tx, tz, c.alertTurnRate, dt)
        break
      }
    }

    w.head = turnTowards(w.head, w.headWant, c.headTurnRate * (w.mode === 'alert' ? 2.5 : 1) * dt)
    w.yaw = angleDiff(w.yaw, 0)
  }
  // network-vision links follow their wardens
  for (const l of s.links) {
    if (l.kind !== 'warden') continue
    const w = s.wardens[l.index]
    if (!w) continue
    l.to.x = w.pos.x
    l.to.y = w.pos.y + c.eyeHeight
    l.to.z = w.pos.z
  }
}
