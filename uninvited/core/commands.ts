// Player actions and the clock: the only way the state changes (rule 1). Every command returns the events it caused
// (the Sim's reused buffer; main.ts clears it once per frame with beginFrame).
import type { GameEvent } from './events'
import { attack as attackRule, switchMode as switchModeRule, updateBolts } from './rules/combat'
import { updateAlarm } from './rules/alarm'
import { updateCameras, updateHearing, updateLasers, updateSensors } from './rules/devices'
import { updateDrones } from './rules/drones'
import { playerFrozen, updatePlayer, type Intent } from './rules/movement'
import { updateCheckpoints } from './rules/progress'
import { updateScan } from './rules/scan'
import { cancelHack as cancelHackRule, hackPick as hackPickRule, interact as interactRule, updateHack } from './rules/terminals'
import type { GameState, Sim } from './state'
import { emit } from './util'

export type { Intent } from './rules/movement'
export { createIntent } from './rules/movement'

/** Starts a new frame: forgets last frame's events. */
export function beginFrame(sim: Sim): void {
  sim.events.length = 0
}

/** Advances the world by dt seconds with the continuous input of this frame. */
export function tick(s: GameState, sim: Sim, dt: number, intent: Intent): readonly GameEvent[] {
  if (s.phase !== 'playing' || dt <= 0) {
    sim.noiseCount = 0
    return sim.events
  }
  const step = Math.min(dt, sim.cfg.sim.maxDt)
  s.time += step
  s.run.timeSec += step
  updateHack(s, sim, step)
  updatePlayer(s, sim, step, intent)
  updateScan(s, sim, step, intent.scan)
  updateCameras(s, sim, step)
  updateHearing(s, sim, step)
  updateSensors(s, sim, step)
  updateLasers(s, sim, step)
  updateDrones(s, sim, step)
  updateBolts(s, sim, step)
  updateAlarm(s, sim, step)
  updateCheckpoints(s, sim)
  sim.noiseCount = 0
  return sim.events
}

export function jump(s: GameState, sim: Sim): readonly GameEvent[] {
  if (!playerFrozen(s)) s.player.jumpBuffer = sim.cfg.player.jumpBufferSec
  return sim.events
}

export function dash(s: GameState, sim: Sim): readonly GameEvent[] {
  if (!playerFrozen(s)) s.player.dashBuffer = sim.cfg.player.jumpBufferSec
  return sim.events
}

/** C: crouch / stand up (a toggle, DESIGN 12). Standing up needs room above. */
export function toggleCrouch(s: GameState, sim: Sim): readonly GameEvent[] {
  if (playerFrozen(s)) return sim.events
  const p = s.player
  if (p.crouched && !sim.world.canStand(p.pos.x, p.pos.y, p.pos.z)) return sim.events
  p.crouched = !p.crouched
  emit(sim, { type: 'crouchChanged', crouched: p.crouched })
  return sim.events
}

/** LMB: one swing or shot when the weapon is ready; call it every frame while the button is held. */
export function attack(s: GameState, sim: Sim, aimYaw: number, aimPitch: number): readonly GameEvent[] {
  attackRule(s, sim, aimYaw, aimPitch)
  return sim.events
}

/** Q / mouse wheel: sword <-> rifle. */
export function switchMode(s: GameState, sim: Sim): readonly GameEvent[] {
  switchModeRule(s, sim)
  return sim.events
}

/** E: hack the terminal in front of you, or take the artifact. */
export function interact(s: GameState, sim: Sim): readonly GameEvent[] {
  interactRule(s, sim)
  return sim.events
}

export function hackPick(s: GameState, sim: Sim, row: number, col: number): readonly GameEvent[] {
  hackPickRule(s, sim, row, col)
  return sim.events
}

export function cancelHack(s: GameState, sim: Sim): readonly GameEvent[] {
  cancelHackRule(s, sim)
  return sim.events
}
