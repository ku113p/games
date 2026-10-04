// Arenas (DESIGN 9): the lockdown is local. Which arena the player is in decides whose spawn gates send the waves and
// whose red walls the firewall opens. A level without arenas has one implicit arena (every gate, every wall).
import type { GameState, Gate, Sim } from '../state'

/** The arena the player stands in, else the nearest one (a passage). -1 when the level has no arenas. */
export function lockdownArena(s: GameState, sim: Sim): number {
  const p = s.player.pos
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < sim.arenas.length; i++) {
    const r = sim.arenas[i]
    if (!r) continue
    const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1)
    const dz = Math.max(r.z0 - p.z, 0, p.z - r.z1)
    const d = dx * dx + dz * dz
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Does this gate belong to the arena (always true without arenas or for arena -1)? */
export function gateInArena(g: Gate, arena: number): boolean {
  return arena < 0 || g.arena === arena
}

/** Is (x, z) inside a primer zone (no alarm stage is raised there)? */
export function inPrimer(sim: Sim, x: number, z: number): boolean {
  for (const r of sim.primers) if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return true
  return false
}
