// core/state.ts — shape of the snake state. Pure TS, no Three.js.
// Signatures are fixed by the layer contract (CONTRACT.md); do not change them.

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Frame {
  right: Vec3
  up: Vec3
  depth: Vec3
}

export type Mode = 'plane' | 'free'
export type Phase = 'ready' | 'running' | 'dead'
export type ScreenDir = 'left' | 'right' | 'up' | 'down'
export type DeathCause = 'body' | 'wall' | 'obstacle'

export interface GameState {
  size: number
  snake: Vec3[] // snake[0] is the head
  snakeCells: Set<number> // snake cell keys, key = cellKey()
  obstacles: Set<number>
  apple: Vec3
  heading: Vec3
  frame: Frame
  pendingTurn: Vec3 | null // input buffer: the new heading, applied on the next step
  mode: Mode // 'plane': flat snake; 'free': camera behind the head (heading = -depth). Switches plane → free once, on the demo turn (the only way out of plane)
  stepCount: number // how many steps (successful moves) were made in the game
  growth: number // how many cells are still to be grown
  phase: Phase
  score: number
  applesEaten: number
  stepMs: number
  boostRequested: boolean // requested boost: the button is held right now (setBoost); does not affect the pace
  boosting: boolean // active boost: a step lasts stepMs / boostFactor; takes boostRequested on a step boundary (tick)
  boostFactor: number // boost factor of the game (chosen before the start, createGame; ≥ 1, ×1 means boost does nothing)
  paceScale: number // scale of the whole pace curve of the game (chosen before the start; 1 = as in config.speed, 1.5 is calmer, 0.5 is twice as fast)
  minBoostedStepMs: number // floor on the duration of a BOOSTED step (config.speed.minEffectiveStepMs; 0 = no floor)
  sinceStepMs: number
  elapsedMs: number
  planeAppleMaxSteps: number // flat opening: the apple is placed at most this many moves from the head, inside the head's layer (config.plane.appleMaxSteps)
  demoTurnPending: boolean // demo turn: once, on step demo.afterSteps of the first game
  rngState: number
}

/** Integer key of a cube cell, used in the snakeCells/obstacles Sets. */
export function cellKey(x: number, y: number, z: number, size: number): number {
  return x + y * size + z * size * size
}

// Increment of mulberry32 (a constant of the PRNG algorithm, not a game balance value).
const MULBERRY32_INCREMENT = 0x6d2b79f5

/**
 * mulberry32: a deterministic PRNG. Mutates s.rngState, returns a number in [0, 1).
 * The only source of randomness in the core; time in tick comes in as a parameter from outside.
 */
export function nextRandom(s: GameState): number {
  s.rngState = (s.rngState + MULBERRY32_INCREMENT) | 0
  let t = s.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Step duration while boosting: stepMs / boostFactor, but not shorter than the minBoostedStepMs floor
 * (otherwise the head signals have no time to show). The floor cuts only the boosted step; the normal pace is untouched.
 */
export function boostedStepMs(s: GameState): number {
  const raw = s.boostFactor > 0 ? s.stepMs / s.boostFactor : s.stepMs
  return raw < s.minBoostedStepMs ? Math.min(s.stepMs, s.minBoostedStepMs) : raw
}

/** Duration of the current step: boostedStepMs while boost is active (boosting, not boostRequested). */
export function effectiveStepMs(s: GameState): number {
  return s.boosting ? boostedStepMs(s) : s.stepMs
}
