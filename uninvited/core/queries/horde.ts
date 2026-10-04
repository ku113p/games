// The monsters' questions (owner: WP3).
import type { MonsterState, TankState } from '../model/monsters'
import { monsterWindupProgress } from '../rules/horde'
import type { GameState, Sim } from '../state'

/** Monster slots (inactive ones have active = false). */
export function monsters(s: GameState): readonly Readonly<MonsterState>[] {
  return s.monsters
}

/** 0..1 how far monster i is into rearing up for its attack (the telegraph); 0 when it is not. */
export function monsterWindup(s: GameState, sim: Sim, i: number): number {
  return monsterWindupProgress(s, sim, i)
}

export function tank(s: GameState): Readonly<TankState> {
  return s.tank
}

/** The projectile pool (potions, junk); inactive ones have active = false. */
export function projectiles(s: GameState): readonly Readonly<GameState['projectiles'][number]>[] {
  return s.projectiles
}

/** The acid puddle pool. */
export function puddles(s: GameState): readonly Readonly<GameState['puddles'][number]>[] {
  return s.puddles
}
