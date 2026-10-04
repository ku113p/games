// Player actions and the clock: the only way the state changes (rule 1). Every command returns the events it caused
// (the Sim's reused buffer; main.ts clears it once per frame with beginFrame).
import type { GameEvent } from './events'
import { attack as attackRule, fireBuffered, switchMode as switchModeRule, updateBolts } from './rules/combat'
import { updateAlarm } from './rules/alarm'
import { updateCameras, updateHearing, updateLasers, updateSensors } from './rules/devices'
import { updateDrones } from './rules/drones'
import { updateFall } from './rules/fall'
import { updateShards } from './rules/shards'
import { updateWorms } from './rules/worms'
import { startTakedown, updateWardens } from './rules/wardens'
import { updateGates } from './rules/gates'
import { playerFrozen, setAim as setAimRule, updatePlayer, type Intent } from './rules/movement'
import { updateCheckpoints } from './rules/progress'
import { updateScan } from './rules/scan'
import { buyUpgrade as buyUpgradeRule, updateMay, useAbility as useAbilityRule } from './rules/may'
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
  fireBuffered(s, sim, step)
  updateFall(s, sim, step)
  updateScan(s, sim, step, intent.scan)
  updateCameras(s, sim, step)
  updateHearing(s, sim, step)
  updateSensors(s, sim, step)
  updateLasers(s, sim, step)
  updateGates(s, step)
  updateDrones(s, sim, step)
  updateWardens(s, sim, step)
  updateWorms(s, sim, step)
  updateBolts(s, sim, step)
  updateShards(s, sim, step)
  updateAlarm(s, sim, step)
  updateCheckpoints(s, sim)
  updateMay(s, sim, step)
  sim.noiseCount = 0
  return sim.events
}

export function jump(s: GameState, sim: Sim): readonly GameEvent[] {
  if (!playerFrozen(s)) s.player.jumpBuffer = sim.cfg.player.jumpBufferSec
  return sim.events
}

/** A dash towards the world direction (dirX, dirZ) (normalized here; a zero direction dashes where the body faces). */
export function dash(s: GameState, sim: Sim, dirX: number, dirZ: number): readonly GameEvent[] {
  if (playerFrozen(s)) return sim.events
  const p = s.player
  const l = Math.sqrt(dirX * dirX + dirZ * dirZ)
  p.dashX = l > 1e-6 ? dirX / l : Math.sin(p.facing)
  p.dashZ = l > 1e-6 ? dirZ / l : Math.cos(p.facing)
  p.dashBuffer = sim.cfg.player.inputBufferSec
  return sim.events
}

/** Direction keys for moveTap. */
export const TAP_FORWARD = 0
export const TAP_BACK = 1
export const TAP_LEFT = 2
export const TAP_RIGHT = 3

/**
 * A fresh press of a direction key (W/S/A/D = TAP_FORWARD/BACK/LEFT/RIGHT). The same key pressed twice within
 * player.dashTapSec dashes that way, relative to the camera's yaw (DESIGN 12: double tap = dash).
 */
export function moveTap(s: GameState, sim: Sim, dir: number, lookYaw: number): readonly GameEvent[] {
  if (playerFrozen(s)) return sim.events
  const p = s.player
  if (p.tapDir === dir && s.time - p.tapTime <= sim.cfg.player.dashTapSec) {
    p.tapDir = -1
    const f = dir === TAP_FORWARD ? 1 : dir === TAP_BACK ? -1 : 0
    const r = dir === TAP_RIGHT ? 1 : dir === TAP_LEFT ? -1 : 0
    const sy = Math.sin(lookYaw)
    const cy = Math.cos(lookYaw)
    return dash(s, sim, sy * f - cy * r, cy * f + sy * r)
  }
  p.tapDir = dir
  p.tapTime = s.time
  return sim.events
}

/** C: crouch / stand up (a toggle, DESIGN 12). Standing up needs room above. Pressed during a Ctrl crouch, it keeps the crouch. */
export function toggleCrouch(s: GameState, sim: Sim): readonly GameEvent[] {
  if (playerFrozen(s)) return sim.events
  const p = s.player
  if (p.crouchByHold) {
    p.crouchByHold = false
    return sim.events
  }
  if (p.crouched && !sim.world.canStand(p.pos.x, p.pos.y, p.pos.z)) return sim.events
  p.crouched = !p.crouched
  emit(sim, { type: 'crouchChanged', crouched: p.crouched })
  return sim.events
}

/** LMB: one swing or shot when the weapon is ready; call it every frame while the button is held. */
export function attack(s: GameState, sim: Sim, aimYaw: number, aimPitch: number, press = true): readonly GameEvent[] {
  attackRule(s, sim, aimYaw, aimPitch, press)
  return sim.events
}

/** RMB held (call every frame with the button's state): aim - walk, face the aim, the rifle drawn and steadier. */
export function setAim(s: GameState, sim: Sim, on: boolean): readonly GameEvent[] {
  setAimRule(s, sim, on)
  return sim.events
}

/** Q / mouse wheel: sword <-> rifle (not while aiming). */
export function switchMode(s: GameState, sim: Sim): readonly GameEvent[] {
  switchModeRule(s, sim)
  return sim.events
}

/** Key 1 / 2 (slot 0 / 1): May's distraction signal / pause a camera, aimed like the rifle (the aim yaw and pitch). */
export function useAbility(s: GameState, sim: Sim, slot: number, aimYaw: number, aimPitch: number): readonly GameEvent[] {
  useAbilityRule(s, sim, slot, aimYaw, aimPitch)
  return sim.events
}

/** Buys the next rank of one of May's upgrades (the upgrade screen). */
export function buyUpgrade(s: GameState, sim: Sim, id: string): readonly GameEvent[] {
  buyUpgradeRule(s, sim, id)
  return sim.events
}

/** E: take a warden down from behind, or hack the terminal in front of you, or take the artifact. */
export function interact(s: GameState, sim: Sim): readonly GameEvent[] {
  if (!startTakedown(s, sim)) interactRule(s, sim)
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
