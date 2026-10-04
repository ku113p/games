// Player actions and the clock: the only way the state changes (rule 1). Every command returns the events it caused
// (the Sim's reused buffer; main.ts clears it once per frame with beginFrame). Owner: WP1 Spine.
import type { GameEvent } from './events'
import { attack as attackRule, circularStrike as strikeRule, fireBuffered, reload as reloadRule, updateGun } from './rules/combat'
import { updateDirector } from './rules/director'
import { updateFlyers } from './rules/flyers'
import { updateHorde, updateProjectiles } from './rules/horde'
import { playerFrozen, setAim as setAimRule, updatePlayer, type Intent } from './rules/movement'
import { updateSpawnPoints } from './rules/spawns'
import { updateStages } from './rules/stages'
import { updateTank } from './rules/tank'
import type { GameState, Sim } from './state'

export type { Intent } from './rules/movement'
export { createIntent } from './rules/movement'

/** Starts a new frame: forgets last frame's events. */
export function beginFrame(sim: Sim): void {
  sim.events.length = 0
}

/**
 * Advances the world by dt seconds with the continuous input of this frame. The tick order is part of the contract:
 * player -> gun (reload, buffered fire) -> stages (triggers, crank, medkits, onboarding, hold-out, exit) -> director ->
 * spawn points -> horde -> flyers -> tank -> projectiles.
 */
export function tick(s: GameState, sim: Sim, dt: number, intent: Intent): readonly GameEvent[] {
  if (s.phase !== 'playing' || dt <= 0) return sim.events
  const step = Math.min(dt, sim.cfg.sim.maxDt)
  s.time += step
  s.run.timeSec += step
  updatePlayer(s, sim, step, intent)
  updateGun(s, sim, step)
  fireBuffered(s, sim, step)
  updateStages(s, sim, step)
  updateDirector(s, sim, step)
  updateSpawnPoints(s, step)
  updateHorde(s, sim, step)
  updateFlyers(s, sim, step)
  updateTank(s, sim, step)
  updateProjectiles(s, sim, step)
  return sim.events
}

export function jump(s: GameState, sim: Sim): readonly GameEvent[] {
  if (!playerFrozen(s)) s.player.jumpBuffer = sim.cfg.player.jumpBufferSec
  return sim.events
}

/** LMB: one swing (or, while aiming, one shot) when the weapon is ready; call it every frame while the button is held. */
export function attack(s: GameState, sim: Sim, aimYaw: number, aimPitch: number, press = true): readonly GameEvent[] {
  attackRule(s, sim, aimYaw, aimPitch, press)
  return sim.events
}

/** RMB held (call every frame with the button's state): aim - walk, face the aim, the gun drawn and steadier. */
export function setAim(s: GameState, sim: Sim, on: boolean): readonly GameEvent[] {
  setAimRule(s, sim, on)
  return sim.events
}

/** R: reload the gun from the reserve. */
export function reload(s: GameState, sim: Sim): readonly GameEvent[] {
  reloadRule(s, sim)
  return sim.events
}

/** Q: the circular sword strike (long cooldown; works in the air). */
export function circularStrike(s: GameState, sim: Sim): readonly GameEvent[] {
  strikeRule(s, sim)
  return sim.events
}

/**
 * E, called every frame with the key's state: hold to turn a crank, press to read the letter. Stub: WP1 (stages.ts).
 */
export function interact(s: GameState, sim: Sim, held: boolean): readonly GameEvent[] {
  void s
  void held
  return sim.events
}
