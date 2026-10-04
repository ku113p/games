// The tank (owner: WP3 Horde AI): the heavy of DESIGN 5, one slot, one per level near its end. It grabs the hero, hits a
// few times and throws them; weak spots (eyes, belly) take more damage. WP0: the contracts only.
import type { KillInfo, TargetSphere, Vec3 } from '../model/common'
import type { GameState, Sim } from '../state'

/** The tank's hit zones, in the order of the unified target list: eyes, belly, body. */
export const TANK_ZONES = 3

/** Brings the tank in at `at` (it may break a wall first). Contract WP4 -> WP3. Stub. */
export function spawnTank(s: GameState, sim: Sim, at: Vec3): void {
  void s
  void sim
  void at
}

/** One tick of the tank: walk, swipe, grab -> punches -> throw. Stub: WP3. */
export function updateTank(s: GameState, sim: Sim, dt: number): void {
  void s
  void sim
  void dt
}

/** Fills `out` with the sphere of tank zone `zone` (0 eyes, 1 belly, 2 body); false when there is no live tank. Stub: WP3. */
export function tankSphere(s: GameState, sim: Sim, zone: number, out: TargetSphere): boolean {
  void s
  void sim
  void zone
  void out
  return false
}

/** Damage to a tank zone (multiplied by the zone's weak-spot factor); true when it killed the tank. Contract WP2 <-> WP3. Stub. */
export function damageTank(s: GameState, sim: Sim, zone: number, amount: number, byGun: boolean, out: KillInfo): boolean {
  void s
  void sim
  void zone
  void amount
  void byGun
  out.killed = false
  return false
}
