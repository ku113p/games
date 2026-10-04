// The alarm (DESIGN 9): violations raise it a stage at a time. Stages 1 and 2 send searcher drones and decay after a
// quiet while; stage 3 never decays - waves come, and after enough cleared waves the firewall (every red wall) drops.
// Breaking something always brings someone to check.
import type { AlarmReason } from '../events'
import { cellAt } from '../grid'
import { nextInt } from '../random'
import type { GameState, Sim, Vec3 } from '../state'
import { dist2, emit } from '../util'
import { flyable, navDistance } from './nav'
import { openWall } from './terminals'
import { spawnDrone, startInvestigating } from './drones'

export function raiseAlarm(s: GameState, sim: Sim, reason: AlarmReason, x: number, y: number, z: number): void {
  const a = s.alarm
  const cfg = sim.cfg.alarm
  s.run.alarmsRaised++
  a.center.x = x
  a.center.y = y
  a.center.z = z
  if (a.stage >= 3 || a.cooldown > 0) return
  a.cooldown = cfg.raiseCooldownSec
  a.stage++
  a.decay = cfg.decaySec[a.stage] ?? 0
  emit(sim, { type: 'alarmRaised', stage: a.stage, reason })
  if (a.stage < 3) {
    // searchers: top up to the number this stage wants
    const want = cfg.searchers[a.stage] ?? 0
    let have = 0
    for (const d of s.drones) if (d.active && d.alive && d.role === 'searcher') have++
    for (let k = have; k < want; k++) spawnSearcher(s, sim, 'searcher', x, z)
    for (let i = 0; i < s.drones.length; i++) {
      const d = s.drones[i]
      if (d && d.active && d.alive && d.role === 'searcher' && d.mode !== 'alert') startInvestigating(s, sim, i, x, z)
    }
  } else {
    // stage 3: everyone hunts; waves start soon
    for (const d of s.drones) {
      if (!d.active || !d.alive) continue
      if (d.role === 'searcher' || d.role === 'checker') d.role = 'wave'
    }
    a.waveTimer = cfg.waveFirstDelaySec
    a.waveActive = false
  }
}

/** Spawn point to bring a drone in from: the nearest one to (x, z) that is not too close to the player. */
function pickSpawn(s: GameState, sim: Sim, x: number, z: number, skip: number): Vec3 | null {
  const p = s.player.pos
  const minD = sim.cfg.alarm.minSpawnDist
  let best: Vec3 | null = null
  let bestD = Infinity
  let rank = 0
  // the `skip`-th best, so a wave spreads over several spawn points
  for (let pass = 0; pass <= skip; pass++) {
    best = null
    bestD = Infinity
    for (const sp of sim.spawns) {
      const dp = dist2(sp.x, sp.z, p.x, p.z)
      if (dp < minD * minD) continue
      const d = dist2(sp.x, sp.z, x, z)
      if (d < bestD && (pass === 0 || d > rank)) {
        bestD = d
        best = sp
      }
    }
    if (best === null) break
    rank = bestD
  }
  if (best === null) {
    // every spawn is close to the player: take the farthest
    for (const sp of sim.spawns) {
      const d = dist2(sp.x, sp.z, p.x, p.z)
      if (best === null || d > bestD) {
        best = sp
        bestD = d
      }
    }
  }
  return best
}

function spawnSearcher(s: GameState, sim: Sim, role: 'searcher' | 'checker' | 'wave', x: number, z: number, skip = 0): number {
  const sp = pickSpawn(s, sim, x, z, skip)
  if (!sp) return -1
  return spawnDrone(s, sim, role, sp.x, sp.y, sp.z)
}

/** "Kill a camera - someone always comes to check": the nearest free drone, or a new one from a spawn point. */
export function callCheck(s: GameState, sim: Sim, x: number, y: number, z: number): void {
  if (s.alarm.stage >= 3) return // everyone is hunting already
  emit(sim, { type: 'checkCalled', x, y, z })
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i]
    if (!d || !d.active || !d.alive || d.mode === 'alert' || d.pausedTime > 0 || d.spawnTime > 0) continue
    const dd = dist2(d.pos.x, d.pos.z, x, z)
    if (dd < bestD) {
      bestD = dd
      best = i
    }
  }
  if (best < 0) best = spawnSearcher(s, sim, 'checker', x, z)
  if (best >= 0) startInvestigating(s, sim, best, x, z)
}

/** Something is actively wrong right now: the alarm does not cool down meanwhile. */
function violationOngoing(s: GameState): boolean {
  for (const d of s.drones) if (d.active && d.alive && d.mode === 'alert') return true
  for (const c of s.cameras) if (c.alive && c.sees) return true
  return false
}

function liveWaveDrones(s: GameState): number {
  let n = 0
  for (const d of s.drones) if (d.active && d.alive && d.role === 'wave') n++
  return n
}

export function updateAlarm(s: GameState, sim: Sim, dt: number): void {
  const a = s.alarm
  const cfg = sim.cfg.alarm
  if (a.cooldown > 0) a.cooldown -= dt
  if (a.stage === 1 || a.stage === 2) {
    if (!violationOngoing(s)) a.decay -= dt
    if (a.decay <= 0) {
      a.stage--
      a.decay = cfg.decaySec[a.stage] ?? 0
      emit(sim, { type: 'alarmLowered', stage: a.stage })
      // searchers beyond what the stage wants go home
      let keep = cfg.searchers[a.stage] ?? 0
      for (const d of s.drones) {
        if (!d.active || !d.alive || d.role !== 'searcher') continue
        if (keep > 0) {
          keep--
          continue
        }
        d.mode = 'leave'
      }
    }
    return
  }
  if (a.stage < 3) return
  // stage 3: waves
  if (a.waveActive) {
    if (liveWaveDrones(s) > 0) return
    a.waveActive = false
    a.wavesCleared++
    emit(sim, { type: 'waveCleared', wave: a.wave })
    if (!a.firewallDown && a.wavesCleared >= cfg.firewallAfterWaves) dropFirewall(s, sim)
    a.waveTimer = cfg.waveGapSec
    return
  }
  a.waveTimer -= dt
  if (a.waveTimer > 0) return
  const size = cfg.waveSizes[Math.min(a.wave, cfg.waveSizes.length - 1)] ?? 1
  const room = Math.max(0, cfg.maxWaveDrones - liveWaveDrones(s))
  const n = Math.min(size, room)
  const p = s.player.pos
  let spawned = 0
  for (let k = 0; k < n; k++) if (spawnSearcher(s, sim, 'wave', p.x, p.z, k % Math.max(1, sim.spawns.length)) >= 0) spawned++
  a.wave++
  a.waveActive = spawned > 0
  if (!a.waveActive) a.waveTimer = cfg.waveGapSec
  emit(sim, { type: 'waveStarted', wave: a.wave, count: spawned })
}

export function dropFirewall(s: GameState, sim: Sim): void {
  s.alarm.firewallDown = true
  emit(sim, { type: 'firewallDropped' })
  for (let i = 0; i < s.walls.length; i++) openWall(s, sim, i)
}

/** A random flyable point near (x, z) within the radius, for searchers; falls back to (x, z). */
export function randomSearchPoint(s: GameState, sim: Sim, x: number, z: number, radius: number, out: Vec3): void {
  const g = sim.grid
  const from = cellAt(g, x, z)
  for (let tries = 0; tries < 10; tries++) {
    const cx = x + (nextInt(s.rng, -1000, 1000) / 1000) * radius
    const cz = z + (nextInt(s.rng, -1000, 1000) / 1000) * radius
    const c = cellAt(g, cx, cz)
    if (c < 0 || !flyable(sim.nav, c)) continue
    if (from >= 0 && navDistance(sim.nav, from, c) < 0) continue
    out.x = (Math.floor(cx / g.cell) + 0.5) * g.cell
    out.z = (Math.floor(cz / g.cell) + 0.5) * g.cell
    return
  }
  out.x = x
  out.z = z
}
