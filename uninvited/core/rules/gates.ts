// Spawn gates (DESIGN 9): alarm drones never pop out of thin air - they come in through hatches in the walls and
// the ceiling. A gate opens (light, glitch), the drone waits behind it for spawnSec, then flies out to the corridor;
// leaving drones fly back into the nearest gate.
import { cellAt } from '../grid'
import type { DroneRole, DroneState, Gate, GameState, Sim } from '../state'
import { dist2, emit } from '../util'
import { gateInArena, lockdownArena } from './arenas'
import { navDistance } from './nav'

/** Opens a gate for at least `sec` (the view shows it; the event fires only when it was closed). */
export function openGate(s: GameState, sim: Sim, index: number, sec: number): void {
  const g = s.gates[index]
  if (!g) return
  if (g.open <= 0) emit(sim, { type: 'gateOpened', index })
  if (sec > g.open) g.open = sec
}

/**
 * The gate to bring a drone in from towards (x, z): among the gates that can reach that spot and are not right next
 * to the player, the `skip`-th nearest by flying distance (so a wave spreads over several gates). Falls back to the
 * reachable gate farthest from the player, then to any gate. -1 when the level has none. Not a hot path.
 */
export function pickGate(s: GameState, sim: Sim, x: number, z: number, skip: number): number {
  const gates = sim.gates
  if (gates.length === 0) return -1
  const p = s.player.pos
  const minD = sim.cfg.alarm.minSpawnDist
  const target = cellAt(sim.grid, x, z)
  const arena = lockdownArena(s, sim) // a lockdown's gates are the ones of its own arena
  // count the candidates first so skip wraps around them
  let candidates = 0
  for (let i = 0; i < gates.length; i++) if (gateOk(sim, gates[i] as Gate, target, p.x, p.z, minD, arena)) candidates++
  if (candidates > 0) {
    const rank = skip % candidates
    let lastD = -1
    let lastI = -1
    let best = -1
    for (let pass = 0; pass <= rank; pass++) {
      best = -1
      let bestD = Infinity
      for (let i = 0; i < gates.length; i++) {
        const g = gates[i] as Gate
        if (!gateOk(sim, g, target, p.x, p.z, minD, arena)) continue
        const d = target >= 0 ? navDistance(sim.nav, g.cell, target) : 0
        // strictly after the previous pick in (distance, index) order
        if (d < lastD || (d === lastD && i <= lastI)) continue
        if (d < bestD || (d === bestD && i < best)) {
          bestD = d
          best = i
        }
      }
      if (best < 0) break
      lastD = bestD
      lastI = best
    }
    if (best >= 0) return best
  }
  // every reachable gate is close to the player: the farthest reachable one, else the farthest of all
  let best = -1
  let bestD = -1
  for (let pass = 0; pass < 2 && best < 0; pass++) {
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i] as Gate
      if (pass === 0 && target >= 0 && navDistance(sim.nav, g.cell, target) < 0) continue
      const d = dist2(g.out.x, g.out.z, p.x, p.z)
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
  }
  return best
}

function gateOk(sim: Sim, g: Gate, target: number, px: number, pz: number, minD: number, arena: number): boolean {
  if (!gateInArena(g, arena)) return false
  if (dist2(g.out.x, g.out.z, px, pz) < minD * minD) return false
  return target < 0 || navDistance(sim.nav, g.cell, target) >= 0
}

/**
 * Brings a drone in through a gate into a free slot; returns its index or -1 when every slot is busy or there is no
 * gate. It waits behind the opening gate (spawnTime), then flies out (gateTime).
 */
export function spawnDrone(s: GameState, sim: Sim, role: Exclude<DroneRole, 'patrol'>, gateIndex: number): number {
  const cfg = sim.cfg.drone
  const gate = sim.gates[gateIndex]
  const gs = s.gates[gateIndex]
  if (!gate || !gs) return -1
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i] as DroneState
    if (d.active || d.patrol >= 0) continue
    d.active = true
    d.alive = true
    d.role = role
    d.hp = cfg.hp
    d.pos.x = gate.deep.x
    d.pos.y = gate.deep.y
    d.pos.z = gate.deep.z
    d.yaw = Math.atan2(gate.nx, gate.nz)
    d.mode = role === 'wave' ? 'alert' : 'investigate'
    d.target.x = gate.out.x
    d.target.z = gate.out.z
    d.lastKnown.x = s.player.pos.x
    d.lastKnown.y = s.player.pos.y
    d.lastKnown.z = s.player.pos.z
    d.suspicion = role === 'wave' ? 1 : 0
    d.sees = false
    d.wait = 0
    d.fireCooldown = cfg.fireWindupSec
    d.lostTimer = 0
    d.pausedTime = 0
    d.aim = 0
    d.token = false
    d.tokenHold = 0
    d.ringPhase = 0
    d.gate = gateIndex
    d.gateIn = false
    d.gateTime = 0
    d.spawnTime = cfg.spawnSec + gs.busy
    gs.busy += cfg.gateStaggerSec
    openGate(s, sim, gateIndex, d.spawnTime + cfg.gateExitSec + 0.4)
    emit(sim, { type: 'droneSpawned', index: i, role })
    return i
  }
  return -1
}

export function updateGates(s: GameState, dt: number): void {
  for (const g of s.gates) {
    if (g.open > 0) g.open = Math.max(0, g.open - dt)
    if (g.busy > 0) g.busy = Math.max(0, g.busy - dt)
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Moves a drone along its gate path while it is waiting behind or flying through a gate. Returns true while the
 * gate owns the drone (no perception, no other movement this tick).
 */
export function gateStep(sim: Sim, i: number, d: DroneState, dt: number): boolean {
  const cfg = sim.cfg.drone
  if (d.spawnTime > 0) {
    d.spawnTime -= dt
    if (d.spawnTime <= 0) d.gateTime = cfg.gateExitSec
    return true
  }
  if (d.gateTime <= 0) return false
  const gate = sim.gates[d.gate]
  if (!gate) {
    d.gateTime = 0
    return false
  }
  d.gateTime = Math.max(0, d.gateTime - dt)
  const k = smooth(1 - d.gateTime / cfg.gateExitSec)
  const t = d.gateIn ? 1 - k : k
  d.pos.x = gate.deep.x + (gate.out.x - gate.deep.x) * t
  d.pos.y = gate.deep.y + (gate.out.y - gate.deep.y) * t
  d.pos.z = gate.deep.z + (gate.out.z - gate.deep.z) * t
  if (d.gateTime <= 0 && d.gateIn) {
    d.active = false
    d.gateIn = false
    emit(sim, { type: 'droneLeft', index: i })
  }
  return true
}

/** A leaving drone flies to the nearest gate it can reach, then into it. Returns the gate index or -1. */
export function nearestGate(sim: Sim, x: number, z: number): number {
  const from = cellAt(sim.grid, x, z)
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < sim.gates.length; i++) {
    const g = sim.gates[i] as Gate
    // the grid steps are symmetric: one flow field towards the drone serves every gate
    const nd = from >= 0 ? navDistance(sim.nav, g.cell, from) : 0
    if (nd < 0) continue
    if (nd < bestD) {
      bestD = nd
      best = i
    }
  }
  return best
}

/** Starts the flight into a gate (the drone is at its `out` point). */
export function enterGate(s: GameState, sim: Sim, d: DroneState, gateIndex: number): void {
  const cfg = sim.cfg.drone
  d.gate = gateIndex
  d.gateIn = true
  d.gateTime = cfg.gateExitSec
  d.sees = false
  d.aim = 0
  openGate(s, sim, gateIndex, cfg.gateExitSec + 0.4)
}

/** Hit or alerted while flying into a gate: turn around and come back out. */
export function abortGateIn(sim: Sim, d: DroneState): void {
  if (!d.gateIn || d.gateTime <= 0) return
  d.gateIn = false
  d.gateTime = Math.max(0.01, sim.cfg.drone.gateExitSec - d.gateTime)
}
