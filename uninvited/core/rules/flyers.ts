// Flyers (owner: WP3 Horde AI): bats and ghosts live in the same pool as the ground monsters (`cls === 'flyer'`).
// DESIGN 5: bats fly in through windows, bite and fly off; they are fast, the gun is hard to aim at them, and the sword
// cuts them when the hero jumps up to them. Ghosts come through walls and are gun only.
// WP0: a stub - the pool slots of class 'flyer' are skipped by `updateHorde` and stay where they were put.
import type { MonsterState } from '../model/monsters'
import type { GameState, Sim } from '../state'

/** One tick of every flyer: the swoop (bats) and the drift through walls (ghosts). Stub: WP3. */
export function updateFlyers(s: GameState, sim: Sim, dt: number): void {
  void s
  void sim
  void dt
}

/** True when the sword cannot hit this monster (ghosts: gun only; bats can be cut by a jumping hero). Contract WP2 <-> WP3. */
export function swordImmune(sim: Sim, m: MonsterState): boolean {
  return sim.cfg.horde.kinds[m.kind].swordImmune === true
}

/** True when a gun bolt from (fromX, fromZ) is stopped by this monster's shield (a skeleton, from the front). Contract WP2 <-> WP3. */
export function shieldBlocks(sim: Sim, m: MonsterState, fromX: number, fromZ: number): boolean {
  const half = sim.cfg.horde.kinds[m.kind].shieldHalfDeg
  if (half === undefined) return false
  const toward = Math.atan2(fromX - m.pos.x, fromZ - m.pos.z)
  let d = (toward - m.shieldYaw) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  else if (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d) <= (half * Math.PI) / 180
}
