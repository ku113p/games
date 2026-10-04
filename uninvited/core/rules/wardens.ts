// Wardens (DESIGN 8): walking sentinel programs - guards, separate from the drones. A warden does its job: it keeps a
// post or walks a round of stops where it stands a while, looks around slowly or checks a rack, with varied pauses.
// It sees in a forward cone that follows its head (shorter and narrower than a camera's) and hears noise. Something
// odd: it stops and turns to it (suspicious, the "?"), then walks over and searches a little, then goes back to its
// round (the round is deterministic: waits are the route's, the head swings 30 deg while walking and 55 at a stop).
// From behind an unaware warden can be taken down (E): silent, non-lethal, it is down for a while. Spotted: it calls
// the alarm and fights - closes in for a telegraphed melee strike, or takes a slow aimed arm shot from further away. It turns slowly, so you can sneak up behind it. Alarm 1-2 sends it to search the alarm area;
// a terminal can pause it; `controlled` is the hook for May's "take over a sentry".
import { cellAt, cellCenterX, cellCenterZ, cellFloor, cellIndex, floorHeightAt, yawTowards, type Grid } from '../grid'
import type { LevelDef, WardenDef } from '../level'
import { nextFloat } from '../random'
import type { GameState, Sim, Vec3, WardenState } from '../state'
import { angleDiff, clamp, DEG, dist2, emit, turnTowards } from '../util'
import { raiseAlarm } from './alarm'
import { inPrimer } from './arenas'
import { setAim } from './movement'
import { openGate } from './gates'
import { meleeFree, meleeTokens, rangedFree } from './tokens'
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
  const own = defs.map((d, i): WardenState => {
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
      hp: d.heavy ? sim.cfg.warden.heavy.hp : sim.cfg.warden.hp,
      heavy: d.heavy ?? false,
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
      pushX: 0,
      pushZ: 0,
      repath: 0,
      controlled: false,
      wave: false,
      spawnTime: 0,
      gate: -1,
      down: 0,
      noticeCool: 0,
      token: 0,
      tokenHold: 0,
      ringDir: 1,
      shots: 0,
    }
  })
  for (let k = 0; k < sim.cfg.alarm.waveWardenSlots; k++) own.push(waveSlot(sim, defs.length + k))
  return own
}

/** A wave warden's slot before it comes out: dead and far below the level (nothing sees or draws it). */
function waveSlot(sim: Sim, i: number): WardenState {
  return {
    id: `wave${i}`,
    alive: false,
    hp: sim.cfg.warden.hp,
    heavy: false,
    pos: { x: 0, y: -1000, z: 0 },
    yaw: 0,
    head: 0,
    headWant: 0,
    speed: 0,
    mode: 'alert',
    act: 'walk',
    actTime: 0,
    actLen: 0,
    glance: 0,
    stop: 0,
    goal: { x: 0, y: 0, z: 0 },
    lastKnown: { x: 0, y: 0, z: 0 },
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
    pushX: 0,
    pushZ: 0,
    repath: 0,
    controlled: false,
    wave: true,
    spawnTime: 0,
    gate: -1,
    down: 0,
    noticeCool: 0,
    token: 0,
    tokenHold: 0,
    ringDir: 1,
    shots: 0,
  }
}

/**
 * Sends a wave warden (a heavy one when `heavy`) out of spawn gate `gateIndex` into a free pool slot; returns the slot
 * or -1. It waits behind the opening gate for drone.spawnSec, then walks out of it and fights.
 */
export function spawnWaveWarden(s: GameState, sim: Sim, gateIndex: number, heavy: boolean): number {
  const gate = sim.gates[gateIndex]
  if (!gate) return -1
  for (let i = 0; i < s.wardens.length; i++) {
    const w = s.wardens[i] as WardenState
    if (!w.wave || w.alive || w.spawnTime > 0) continue
    w.heavy = heavy
    w.hp = heavy ? sim.cfg.warden.heavy.hp : sim.cfg.warden.hp
    w.gate = gateIndex
    w.spawnTime = sim.cfg.drone.spawnSec + (s.gates[gateIndex]?.busy ?? 0)
    const gs = s.gates[gateIndex]
    if (gs) gs.busy += sim.cfg.drone.gateStaggerSec
    openGate(s, sim, gateIndex, w.spawnTime + 0.8)
    return i
  }
  return -1
}

/** The gate has opened: the wave warden steps out onto the floor in front of it, already fighting. */
function appearWaveWarden(s: GameState, sim: Sim, i: number): void {
  const w = s.wardens[i] as WardenState
  const gate = sim.gates[w.gate]
  if (!gate) return
  const p = s.player.pos
  w.alive = true
  w.pos.x = gate.out.x
  w.pos.z = gate.out.z
  w.pos.y = floorHeightAt(sim.grid, gate.out.x, gate.out.z)
  w.yaw = Math.atan2(p.x - w.pos.x, p.z - w.pos.z)
  w.head = 0
  w.headWant = 0
  w.mode = 'alert'
  w.act = 'walk'
  w.suspicion = 1
  w.lostTimer = 0
  w.lastKnown.x = p.x
  w.lastKnown.y = p.y
  w.lastKnown.z = p.z
  w.fireCooldown = sim.cfg.warden.shotFirstSec
  w.hitTime = 0
  w.strike = 0
  w.recover = 0
  w.aim = 0
  w.token = 0
  w.tokenHold = 0
  w.pushX = 0
  w.pushZ = 0
  w.repath = 0
  w.speed = 0
  const path = sim.wardenPaths[i]
  if (path) path.n = 0
  w.ringDir = i % 2 === 0 ? 1 : -1
  w.shots = 0
  emit(sim, { type: 'wardenSpawned', index: i, gate: w.gate, heavy: w.heavy })
}

/** Wave wardens still alive or coming out of a gate. */
export function liveWaveWardens(s: GameState): number {
  let n = 0
  for (const w of s.wardens) if (w.wave && (w.alive || w.spawnTime > 0)) n++
  return n
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
  w.shots = 0
  w.fireCooldown = sim.cfg.warden.shotFirstSec
  emit(sim, { type: 'wardenAlerted', index: i })
  raiseAlarm(s, sim, 'warden', p.x, p.y, p.z)
}

/** The gunblade hit it (combat.ts applies the damage): a flinch, and it knows where you are. */
export function wardenHit(s: GameState, sim: Sim, i: number): void {
  const w = s.wardens[i]
  if (!w || !w.alive) return
  w.hitTime = sim.cfg.warden.hitAnimSec
  w.down = 0 // a hit wakes a downed warden: it is awake, hurt and knows where you are
  // knocked back, away from the player (a heavy hit moves it)
  const p = s.player.pos
  const dx = w.pos.x - p.x
  const dz = w.pos.z - p.z
  const l = Math.sqrt(dx * dx + dz * dz) || 1
  w.pushX = (dx / l) * sim.cfg.warden.knockback
  w.pushZ = (dz / l) * sim.cfg.warden.knockback
  alertWarden(s, sim, i)
}

/** The knockback glides it away and fades out (moveCharacter keeps it out of walls). */
function applyPush(sim: Sim, w: WardenState, dt: number): void {
  const m = sim.move
  sim.world.moveCharacter(w.pos.x, w.pos.y, w.pos.z, w.pushX * dt, 0, w.pushZ * dt, false, dt, m)
  w.pos.x = m.x
  w.pos.z = m.z
  w.pos.y = floorHeightAt(sim.grid, w.pos.x, w.pos.z)
  const k = Math.max(0, 1 - dt * 8)
  w.pushX *= k
  w.pushZ *= k
  if (Math.abs(w.pushX) + Math.abs(w.pushZ) < 0.05) w.pushX = w.pushZ = 0
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
  if (w.heavy) speed *= cfg.heavy.speedFactor
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

/** The head swing of a warden on its round: walking it looks about 30 deg to each side (a stop sweeps wider). */
function walkSweep(sim: Sim, time: number, i: number): number {
  const c = sim.cfg.warden
  return c.walkScanDeg * DEG * Math.sin((time / c.walkScanPeriodSec) * Math.PI * 2 + i * 1.7)
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

/**
 * Reached its stop: stand the stop's waitSec (a post: stand or look around, varied). The round is deterministic: no
 * random pauses on the way, a stop without a wait is walked straight through; only the length of a wait varies a little
 * (waitVary), so the level's timing (a window of N seconds) holds from loop to loop.
 */
function arrive(s: GameState, sim: Sim, w: WardenState, route: WardenRoute): void {
  const c = sim.cfg.warden
  const st = route.stops[w.stop] as WardenRouteStop
  if (route.post || route.stops.length === 1) {
    startAct(s, sim, w, nextFloat(s.rng) < 0.5 ? 'scan' : 'stand', range(s, c.postActSec))
    return
  }
  if (st.waitSec > 0) {
    const len = st.waitSec * (1 + c.waitVary * (nextFloat(s.rng) * 2 - 1))
    // a stop that faces somewhere checks what is there; one without a facing looks around
    startAct(s, sim, w, Number.isNaN(st.look) ? 'scan' : 'check', len)
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
  b.damage = c.boltDamage
  b.pos.x = ox
  b.pos.y = oy
  b.pos.z = oz
  b.vel.x = (tx / l) * c.boltSpeed
  b.vel.y = (ty / l) * c.boltSpeed
  b.vel.z = (tz / l) * c.boltSpeed
  w.shots++
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

/** A warden that sees a downed warden (within its cone and range, line of sight clear) turns to check the spot. */
function noticeDowned(s: GameState, sim: Sim, w: WardenState, i: number, look: number): void {
  const c = sim.cfg.warden
  const ex = w.pos.x
  const ey = w.pos.y + c.eyeHeight
  const ez = w.pos.z
  for (let j = 0; j < s.wardens.length; j++) {
    const o = s.wardens[j] as WardenState
    if (j === i || !o.alive || o.down <= 0) continue
    const dx = o.pos.x - ex
    const dz = o.pos.z - ez
    if (dx * dx + dz * dz > c.range * c.range || Math.abs(o.pos.y - w.pos.y) > 2) continue
    if (Math.abs(angleDiff(Math.atan2(dx, dz), look)) > c.halfAngleDeg * DEG) continue
    if (!sim.world.lineOfSight(ex, ey, ez, o.pos.x, o.pos.y + c.chestHeight, o.pos.z)) continue
    w.lastKnown.x = o.pos.x
    w.lastKnown.y = o.pos.y
    w.lastKnown.z = o.pos.z
    w.noticeCool = c.takedown.noticeCooldownSec
    becomeSuspicious(sim, w, i)
    return
  }
}

/** Can the player take warden i down right now: unaware, behind it, close, and not a heavy. */
export function canTakedown(s: GameState, sim: Sim, i: number): boolean {
  const w = s.wardens[i]
  const p = s.player
  if (!w || !w.alive || w.heavy || w.wave || w.controlled || w.down > 0 || w.mode === 'alert') return false
  if (s.phase !== 'playing' || s.hack !== null || p.takedownTime > 0 || p.dashTime > 0) return false
  const t = sim.cfg.warden.takedown
  const dx = p.pos.x - w.pos.x
  const dz = p.pos.z - w.pos.z
  const d2 = dx * dx + dz * dz
  if (d2 > t.reach * t.reach || Math.abs(p.pos.y - w.pos.y) > 1.5) return false
  // behind it: the player lies inside the arc around the direction opposite to its body's facing
  if (d2 > 1e-4 && Math.abs(angleDiff(Math.atan2(dx, dz), w.yaw + Math.PI)) > (t.arcDeg / 2) * DEG) return false
  const c = sim.cfg.warden
  return sim.world.lineOfSight(p.pos.x, p.pos.y + sim.cfg.player.chestHeight, p.pos.z, w.pos.x, w.pos.y + c.chestHeight, w.pos.z)
}

/** The warden E would take down (the nearest one that allows it), or -1. */
export function takedownTarget(s: GameState, sim: Sim): number {
  let best = -1
  let bd = Infinity
  for (let i = 0; i < s.wardens.length; i++) {
    if (!canTakedown(s, sim, i)) continue
    const w = s.wardens[i] as WardenState
    const d = dist2(s.player.pos.x, s.player.pos.z, w.pos.x, w.pos.z)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

/**
 * E from behind (DESIGN 8, non-lethal takedown): the hero is locked for takedown.sec, the warden powers down and stays
 * down for takedown.downSec (counted from now), then reboots and walks its round, unaware. No noise, no kill, no alarm.
 * Returns true when it started.
 */
export function startTakedown(s: GameState, sim: Sim): boolean {
  const i = takedownTarget(s, sim)
  if (i < 0) return false
  const w = s.wardens[i] as WardenState
  const p = s.player
  const t = sim.cfg.warden.takedown
  setAim(s, sim, false)
  p.takedownTime = t.sec
  p.takedownTarget = i
  p.facing = Math.atan2(w.pos.x - p.pos.x, w.pos.z - p.pos.z)
  w.down = t.downSec
  w.suspicion = 0
  w.sees = false
  w.speed = 0
  w.strike = 0
  w.aim = 0
  w.token = 0
  w.pushX = 0
  w.pushZ = 0
  s.run.takedowns++
  emit(sim, { type: 'wardenDowned', index: i })
  return true
}

/**
 * Shared alarm knowledge (DESIGN 9): at alarm 2+ anyone who sees the player (a fighting warden or drone) tells the others,
 * the alarm's centre follows the player. Returns true while that knowledge is fresh (somebody sees now, or the alarm
 * was just raised: its centre is where it happened).
 */
function shareKnowledge(s: GameState): boolean {
  const a = s.alarm
  if (a.stage < 2 || s.phase !== 'playing') return false
  let seen = false
  for (const w of s.wardens) if (w.alive && w.down <= 0 && w.mode === 'alert' && w.sees) seen = true
  if (!seen) for (const d of s.drones) if (d.active && d.alive && d.mode === 'alert' && d.sees) seen = true
  if (seen) {
    a.center.x = s.player.pos.x
    a.center.y = s.player.pos.y
    a.center.z = s.player.pos.z
  }
  return seen || a.cooldown > 0
}

/** The alert warden nearest to the player that may close in for the melee (only while a melee token is free), or -1. */
function meleeCandidate(s: GameState, sim: Sim): number {
  if (meleeTokens(s) >= sim.cfg.tokens.melee) return -1
  const p = s.player.pos
  let best = -1
  let bd = Infinity
  for (let i = 0; i < s.wardens.length; i++) {
    const w = s.wardens[i] as WardenState
    if (!w.alive || w.mode !== 'alert' || w.down > 0 || w.controlled || w.pausedTime > 0 || w.token === 2) continue
    const d = dist2(w.pos.x, w.pos.z, p.x, p.z)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

export function updateWardens(s: GameState, sim: Sim, dt: number): void {
  const c = sim.cfg.warden
  const det = sim.cfg.detection
  const known = shareKnowledge(s)
  const pr = c.pursuit.radius
  const cand = meleeCandidate(s, sim)
  const cosHalf = Math.cos(c.halfAngleDeg * DEG)
  const cp = Math.cos(c.pitchDeg * DEG)
  const sp = Math.sin(c.pitchDeg * DEG)
  const p = s.player.pos
  for (let i = 0; i < s.wardens.length; i++) {
    const w = s.wardens[i] as WardenState
    if (w.wave && !w.alive && w.spawnTime > 0) {
      w.spawnTime -= dt
      if (w.spawnTime <= 0) appearWaveWarden(s, sim, i)
      continue
    }
    if (!w.alive) continue
    const route = sim.wardenRoutes[i] as WardenRoute
    w.hitTime -= dt
    w.fireCooldown -= dt
    w.noticeCool -= dt
    if (w.token === 2 && w.aim <= 0) {
      w.tokenHold -= dt
      if (w.tokenHold <= 0) w.token = 0
    }
    if ((w.pushX || w.pushZ) && dt > 0) applyPush(sim, w, dt)
    if (w.down > 0) {
      // taken down: powered off (no sight, no hearing); it reboots by itself and resumes its round, unaware
      w.down -= dt
      if (s.alarm.stage >= c.takedown.wakeAlarmStage && w.down > c.takedown.rebootSec) w.down = c.takedown.rebootSec
      w.sees = false
      w.suspicion = 0
      w.strike = 0
      w.aim = 0
      w.recover = 0
      w.token = 0
      w.speed = 0
      w.headWant = 0
      w.head = turnTowards(w.head, 0, c.headTurnRate * dt)
      if (w.down <= 0) {
        w.down = 0
        w.mode = 'return'
        w.act = 'walk'
        w.wait = 0
        w.lastKnown.x = w.pos.x
        w.lastKnown.z = w.pos.z
        emit(sim, { type: 'wardenRebooted', index: i })
      }
      continue
    }
    if (w.pausedTime > 0 || w.controlled) {
      // paused by a terminal, or taken over: it stands, sees and hears nothing
      if (w.pausedTime > 0) w.pausedTime -= dt
      w.sees = false
      w.suspicion = Math.max(0, w.suspicion - det.decay * dt)
      w.strike = 0
      w.aim = 0
      w.token = 0
      w.speed = 0
      continue
    }
    bump(s, sim, w, i, dt)
    if (w.wave && s.phase === 'playing') {
      // wave wardens always know where you are (DESIGN 9: nowhere to hide)
      w.mode = 'alert'
      w.lostTimer = 0
      w.suspicion = 1
      w.lastKnown.x = p.x
      w.lastKnown.y = p.y
      w.lastKnown.z = p.z
    }

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

    // a downed warden in view (or one being taken down) makes it suspicious: somebody was here
    if (w.noticeCool <= 0 && (w.mode === 'patrol' || w.mode === 'return')) noticeDowned(s, sim, w, i, look)

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
    const ac = s.alarm.center
    const inPursuit = known && !w.controlled && dist2(w.pos.x, w.pos.z, ac.x, ac.z) <= pr * pr
    if (inPursuit && w.mode !== 'alert' && !inPrimer(sim, w.pos.x, w.pos.z)) {
      // alarm 2+ with a known position: it does not stroll, it runs there (no new alarm: the alarm is what called it)
      w.mode = 'alert'
      w.act = 'walk'
      w.wait = 0
      w.suspicion = 1
      w.lostTimer = 0
      w.shots = 0
      w.fireCooldown = c.shotFirstSec
      w.lastKnown.x = ac.x
      w.lastKnown.y = ac.y
      w.lastKnown.z = ac.z
      emit(sim, { type: 'wardenAlerted', index: i })
    } else if (inPursuit && w.mode === 'alert' && !w.sees) {
      // somebody else sees the player: the position is shared, so it does not give up while the others keep sight
      w.lastKnown.x = ac.x
      w.lastKnown.y = ac.y
      w.lastKnown.z = ac.z
      w.lostTimer = 0
    }
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
          w.headWant = walkSweep(sim, s.time, i)
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
        w.headWant = walkSweep(sim, s.time, i)
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
            const hit = s.phase === 'playing' && reach <= c.strikeReach && inArc && Math.abs(p.y - w.pos.y) < 1.6 && hurtPlayer(s, sim, c.strikeDamage * (w.heavy ? c.heavy.strikeDamageFactor : 1), w.pos.x, w.pos.z)
            emit(sim, { type: 'wardenStruck', index: i, hit })
          }
          break
        }
        if (w.recover > 0) {
          w.recover -= dt
          w.speed = 0
          if (w.recover <= 0 && w.token === 1) w.token = 0 // the melee token comes back after the recovery
          break
        }
        if (w.aim > 0) {
          if (!w.sees || s.phase !== 'playing') {
            w.aim = 0
            w.token = 0
            w.fireCooldown = Math.max(w.fireCooldown, c.shotAimSec * 0.5)
          } else {
            w.speed = 0
            w.yaw = turnTowards(w.yaw, toP, c.turnRate * dt)
            w.aim -= dt
            if (w.aim <= 0) {
              w.aim = 0
              w.tokenHold = sim.cfg.tokens.rangedHoldSec
              w.fireCooldown = c.shotIntervalSec
              fireArmBolt(s, sim, w, i)
            }
            break
          }
        }
        const tx = w.sees ? p.x : w.lastKnown.x
        const tz = w.sees ? p.z : w.lastKnown.z
        const d = Math.sqrt(dist2(w.pos.x, w.pos.z, tx, tz))
        const playing = s.phase === 'playing'
        // close (about 3 m): the melee fight, one warden at a time (the melee token); the others hold off and shoot
        const closeIn = cand === i && playing && ((w.shots > 0 && w.fireCooldown > c.pursuit.closeInCooldownSec) || d < c.shotMinDist)
        const run = d > c.pursuit.runFarDist || !w.sees ? c.runSpeed : c.alertSpeed
        const inMelee = w.sees && playing && d < c.meleeDist
        if (inMelee && w.token === 2 && w.aim <= 0) w.token = 0
        if (inMelee && w.token === 0 && meleeFree(s, sim)) w.token = 1
        if (!inMelee && w.token === 1 && d > c.meleeDist + 1) w.token = 0
        if (inMelee && w.token === 1) {
          if (d < c.strikeRange && Math.abs(angleDiff(toP, w.yaw)) < 0.6) {
            w.strike = c.strikeWindupSec
            w.speed = 0
            emit(sim, { type: 'wardenStrike', index: i })
            break
          }
          if (w.hitTime > 0 || d < c.strikeRange * 0.8) {
            w.speed = 0
            face(w, tx, tz, c.alertTurnRate, dt)
          } else if (walkTo(sim, i, w, tx, tz, c.alertSpeed, c.alertTurnRate, dt) < 0) face(w, tx, tz, c.alertTurnRate, dt)
          break
        }
        if (inMelee) {
          // no melee token: back off to the ring and shoot from there
          const k = d > 1e-3 ? 2.5 / d : 0
          if (walkTo(sim, i, w, w.pos.x + (w.pos.x - tx) * k, w.pos.z + (w.pos.z - tz) * k, c.alertSpeed * 0.8, c.alertTurnRate, dt) < 0) face(w, tx, tz, c.alertTurnRate, dt)
          break
        }
        if (w.sees && playing && d >= c.shotMinDist && w.fireCooldown <= 0 && w.hitTime <= 0 && w.token === 0 && rangedFree(s, sim)) {
          w.token = 2
          w.aim = c.shotAimSec
          w.speed = 0
          emit(sim, { type: 'wardenAiming', index: i })
          break
        }
        if (w.hitTime > 0 || (w.sees && d <= c.holdDist && !closeIn)) {
          w.speed = 0
          face(w, tx, tz, c.alertTurnRate, dt)
        } else if (walkTo(sim, i, w, tx, tz, run, c.alertTurnRate, dt) < 0) face(w, tx, tz, c.alertTurnRate, dt)
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
