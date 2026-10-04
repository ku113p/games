// The alarm (DESIGN 9): violations raise it a stage at a time. Stages 1 and 2 send searcher drones and decay after a
// quiet while; stage 3 never decays - waves come, and after enough cleared waves the firewall (every red wall) drops.
// Breaking something always brings someone to check.
import type { AlarmReason } from '../events'
import { cellAt } from '../grid'
import { nextInt } from '../random'
import type { GameState, Sim, Vec3 } from '../state'
import { dist2, emit } from '../util'
import { flyable, navDistance } from './nav'
import { gateInArena, inPrimer, lockdownArena } from './arenas'
import { openWall } from './terminals'
import { startInvestigating } from './drones'
import { pickGate, spawnDrone } from './gates'
import { findPath } from './walk'
import { liveWaveWardens, spawnWaveWarden } from './wardens'
import { liveWorms, spawnWavePacks, wormsHunting, wormsOnAlarm, wormsOnAlarmLowered } from './worms'

export function raiseAlarm(s: GameState, sim: Sim, reason: AlarmReason, x: number, y: number, z: number): void {
  const a = s.alarm
  const cfg = sim.cfg.alarm
  if (inPrimer(sim, x, z)) return // a primer zone: a safe place to be seen in (the watcher still investigates)
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
  wormsOnAlarm(s, sim, x, z)
}

function spawnSearcher(s: GameState, sim: Sim, role: 'searcher' | 'checker' | 'wave', x: number, z: number, skip = 0): number {
  const g = pickGate(s, sim, x, z, skip)
  if (g < 0) return -1
  return spawnDrone(s, sim, role, g)
}

/**
 * "Kill a camera - someone always comes to check": the nearest free drone, or a new one through a spawn gate.
 * Returns the drone that comes (-1 none).
 */
export function callCheck(s: GameState, sim: Sim, x: number, y: number, z: number): number {
  if (s.alarm.stage >= 3) return -1 // everyone is hunting already
  emit(sim, { type: 'checkCalled', x, y, z })
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i]
    if (!d || !d.active || !d.alive || d.mode === 'alert' || d.pausedTime > 0 || d.spawnTime > 0 || d.gateTime > 0) continue
    const dd = dist2(d.pos.x, d.pos.z, x, z)
    if (dd < bestD) {
      bestD = dd
      best = i
    }
  }
  if (best < 0) best = spawnSearcher(s, sim, 'checker', x, z)
  if (best >= 0) startInvestigating(s, sim, best, x, z)
  return best
}

/** Something is actively wrong right now: the alarm does not cool down meanwhile. */
function violationOngoing(s: GameState): boolean {
  for (const d of s.drones) if (d.active && d.alive && d.mode === 'alert') return true
  for (const c of s.cameras) if (c.alive && c.sees) return true
  for (const w of s.wardens) if (w.alive && w.mode === 'alert' && w.sees) return true
  return wormsHunting(s)
}

function liveWaveDrones(s: GameState): number {
  let n = 0
  for (const d of s.drones) if (d.active && d.alive && d.role === 'wave') n++
  return n
}

const droneGates: number[] = []

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
      wormsOnAlarmLowered(s, sim)
    }
    return
  }
  if (a.stage < 3) return
  // stage 3: waves
  if (a.waveActive) {
    if (liveWaveDrones(s) + liveWorms(s, 'wave') + liveWaveWardens(s) > 0) return
    a.waveActive = false
    a.wavesCleared++
    emit(sim, { type: 'waveCleared', wave: a.wave })
    if (!a.firewallDown && a.wavesCleared >= wavesNeeded(s, sim)) dropFirewall(s, sim)
    a.waveTimer = cfg.waveGapSec
    return
  }
  // the firewall is down: the lockdown is over, no more waves (the way to the file is open)
  if (a.firewallDown) return
  a.waveTimer -= dt
  if (a.waveTimer > 0) return
  // a lockdown has exactly its arena's number of waves, however often the alarm is raised again meanwhile
  if (a.wave >= wavesNeeded(s, sim)) {
    if (a.wavesCleared >= a.wave) dropFirewall(s, sim)
    return
  }
  const wave = cfg.waves[Math.min(a.wave, cfg.waves.length - 1)]
  if (!wave) return
  const p = s.player.pos
  let spawned = 0
  droneGates.length = 0
  for (let k = 0; k < wave.drones; k++) {
    const d = spawnSearcher(s, sim, 'wave', p.x, p.z, k)
    if (d < 0) continue
    spawned++
    droneGates.push(s.drones[d]?.gate ?? -1)
  }
  // the worm packs come from other sides than the drones (DESIGN 9: pressure from several sides)
  const worms = spawnWavePacks(s, sim, wave.packs, droneGates)
  // wardens (and heavy ones) walk out of gates on yet other sides
  let wardens = 0
  for (let k = 0; k < wave.wardens + wave.heavy; k++) {
    const g = pickWardenGate(s, sim, wardenGates)
    if (g < 0) break
    if (spawnWaveWarden(s, sim, g, k >= wave.wardens) < 0) break
    wardenGates.push(g)
    wardens++
  }
  wardenGates.length = 0
  a.wave++
  a.segmentFight = true
  a.waveActive = spawned + worms + wardens > 0
  if (!a.waveActive) a.waveTimer = cfg.waveGapSec
  emit(sim, { type: 'waveStarted', wave: a.wave, count: spawned, worms, wardens })
}

const wardenGates: number[] = []
const pathScratch = new Float32Array(256)

/**
 * A gate a wave warden walks out of: not next to the player, with a walk to the player, preferring gates on other
 * sides than the ones already used this wave. -1 when none. Not a hot path.
 */
function pickWardenGate(s: GameState, sim: Sim, used: readonly number[]): number {
  const p = s.player.pos
  const minD = sim.cfg.alarm.minSpawnDist
  const arena = lockdownArena(s, sim)
  const cost: number[] = []
  for (let i = 0; i < sim.gates.length; i++) {
    const g = sim.gates[i]
    const d = g ? Math.sqrt(dist2(g.out.x, g.out.z, p.x, p.z)) : -1
    if (!g || d < minD || !gateInArena(g, arena)) {
      cost.push(Infinity)
      continue
    }
    let c = d + (used.includes(i) ? 40 : 0)
    const bearing = Math.atan2(g.out.x - p.x, g.out.z - p.z)
    for (const u of used) {
      const ug = sim.gates[u]
      if (ug && Math.abs(Math.atan2(Math.sin(Math.atan2(ug.out.x - p.x, ug.out.z - p.z) - bearing), Math.cos(Math.atan2(ug.out.x - p.x, ug.out.z - p.z) - bearing))) < 1.2) {
        c += 10
        break
      }
    }
    cost.push(c)
  }
  for (let tries = 0; tries < sim.gates.length; tries++) {
    let best = -1
    for (let i = 0; i < cost.length; i++) if ((cost[i] as number) < (best < 0 ? Infinity : (cost[best] as number))) best = i
    if (best < 0) return -1
    const g = sim.gates[best]
    if (g && findPath(sim.walk, g.out.x, g.out.z, p.x, p.z, pathScratch) > 0) return best
    cost[best] = Infinity
  }
  return -1
}

/** Waves a lockdown needs before its firewall drops. */
export function wavesNeeded(s: GameState, sim: Sim): number {
  const a = sim.arenas[lockdownArena(s, sim)]
  return a && a.waves > 0 ? a.waves : sim.cfg.alarm.firewallAfterWaves
}

/** The firewall drops: it opens the red walls of the arena the lockdown is fought in (every wall if the level has no arenas). */
export function dropFirewall(s: GameState, sim: Sim): void {
  s.alarm.firewallDown = true
  emit(sim, { type: 'firewallDropped' })
  const arena = sim.arenas[lockdownArena(s, sim)]
  if (!arena) {
    for (let i = 0; i < s.walls.length; i++) openWall(s, sim, i)
    return
  }
  for (const w of arena.walls) openWall(s, sim, w)
}

/**
 * A checkpoint ends a finished lockdown: the alarm goes back to 0 and the waves start over, so the next arena is a fresh
 * choice. A lockdown still being fought (the firewall is up) goes on.
 */
export function endLockdown(s: GameState, sim: Sim): void {
  const a = s.alarm
  if (a.stage < 3 || !a.firewallDown) return
  a.stage = 0
  a.decay = 0
  a.cooldown = 0
  a.wave = 0
  a.wavesCleared = 0
  a.waveActive = false
  a.waveTimer = 0
  a.firewallDown = false
  emit(sim, { type: 'alarmLowered', stage: 0 })
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
