// The hero's questions (owner: WP2).
import { pickTarget } from '../rules/combat'
import type { GameState, Sim } from '../state'

export { pickTarget }

/** The hero's animation state, for the hero view (WP2 adds reload, strike, grabbed, thrown, down, getUp). */
export type HeroAnim = 'idle' | 'walk' | 'run' | 'jump' | 'slash' | 'shoot' | 'hit' | 'death'

export function heroAnim(s: GameState, sim: Sim): HeroAnim {
  const p = s.player
  if (s.phase === 'dead') return 'death'
  // an attack shows through a flinch (the player acts at once; the hurt has its own flash and shake)
  if (p.slashTime > 0 || s.strike.animTime > 0) return 'slash'
  if (p.shootTime > 0) return 'shoot'
  if (p.hitTime > 0) return 'hit'
  if (!p.grounded) return 'jump'
  if (p.speed > sim.cfg.player.walkSpeed + 0.4) return 'run'
  if (p.speed > 0.3) return 'walk'
  return 'idle'
}

/** 0..1 how far into the current action animation (slash, shoot, hit), for the view's blending. */
export function heroActionProgress(s: GameState, sim: Sim): number {
  const p = s.player
  if (p.slashTime > 0) return 1 - p.slashTime / p.slashLen
  if (s.strike.animTime > 0) return 1 - s.strike.animTime / sim.cfg.strike.animSec
  if (p.shootTime > 0) return 1 - p.shootTime / sim.cfg.gun.animSec
  if (p.hitTime > 0) return 1 - p.hitTime / sim.cfg.player.hitAnimSec
  return 0
}

/** The sword combo step of the current swing: 0, 1, or 2 for the wide finisher. */
export function swordCombo(s: GameState): number {
  return s.player.combo
}

export function playerPos(s: GameState): Readonly<{ x: number; y: number; z: number }> {
  return s.player.pos
}

export function playerFacing(s: GameState): number {
  return s.player.facing
}

export function playerSpeed(s: GameState): number {
  return s.player.speed
}

export function isGrounded(s: GameState): boolean {
  return s.player.grounded
}

export function isRunning(s: GameState): boolean {
  return s.player.running
}

/** RMB held: aiming (the camera eases in, the gun is drawn, the spread tightens). */
export function isAiming(s: GameState): boolean {
  return s.player.aiming
}

export function hpFraction(s: GameState, sim: Sim): number {
  return s.player.hp / sim.cfg.player.maxHp
}

export function hp(s: GameState): number {
  return s.player.hp
}

export function phase(s: GameState): GameState['phase'] {
  return s.phase
}

/** Rounds in the cylinder, the cylinder's size, the reserve, and the reload progress 0..1 (0 when not reloading). */
export function gunLoaded(s: GameState): number {
  return s.gun.loaded
}

export function gunMag(sim: Sim): number {
  return sim.cfg.gun.magSize
}

export function gunReserve(s: GameState): number {
  return s.gun.reserve
}

export function reloadProgress(s: GameState, sim: Sim): number {
  return s.gun.reloadTime > 0 ? 1 - s.gun.reloadTime / sim.cfg.gun.reloadSec : 0
}

/** 0..1 how ready the circular strike is (1 = ready). */
export function strikeReadiness(s: GameState, sim: Sim): number {
  return 1 - s.strike.cooldown / sim.cfg.strike.cooldownSec
}
