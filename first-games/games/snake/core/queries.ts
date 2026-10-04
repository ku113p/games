// core/queries.ts — read-only access to state. Pure TS, no Three.js.
// Called from view/ every frame (rendering and obstacles via InstancedMesh), so no allocations.

import { rotateFrameOf } from './rules'
import { boostedStepMs, cellKey, effectiveStepMs, type GameState, type Mode, type Vec3, type Frame } from './state'

export function head(s: GameState): Vec3 {
  return s.snake[0]!
}

export function isAlive(s: GameState): boolean {
  return s.phase !== 'dead'
}

export function snakeLength(s: GameState): number {
  return s.snake.length
}

export function cameraFrame(s: GameState): Frame {
  return s.frame
}

export function score(s: GameState): number {
  return s.score
}

/** Walks the obstacles without allocating: decodes each cellKey back into coordinates. */
export function forEachObstacle(s: GameState, fn: (x: number, y: number, z: number) => void): void {
  const size = s.size
  for (const key of s.obstacles) {
    const x = key % size
    const y = Math.floor(key / size) % size
    const z = Math.floor(key / (size * size))
    fn(x, y, z)
  }
}

/** Walks the snake segments from head (index 0) to tail, without allocating. */
export function forEachSnakeSegment(
  s: GameState,
  fn: (x: number, y: number, z: number, index: number) => void,
): void {
  const snake = s.snake
  for (let i = 0; i < snake.length; i++) {
    const seg = snake[i]!
    fn(seg.x, seg.y, seg.z, i)
  }
}

/** Apple position (read-only, no copy). */
export function applePos(s: GameState): Readonly<Vec3> {
  return s.apple
}

export function cubeSize(s: GameState): number {
  return s.size
}

export function elapsedMs(s: GameState): number {
  return s.elapsedMs
}

/** Camera mode: 'plane' (flat snake) or 'free' (camera behind the head). */
export function gameMode(s: GameState): Mode {
  return s.mode
}

/**
 * Progress to the next step, 0..1 (sinceStepMs / duration of the current step), used by the view to
 * interpolate the head. Uses the active pace, so pressing/releasing boost mid-step does not move it.
 */
export function stepProgress(s: GameState): number {
  const stepMs = effectiveStepMs(s)
  if (!(stepMs > 0)) return 0
  const p = s.sinceStepMs / stepMs
  return p < 0 ? 0 : p > 1 ? 1 : p
}

/**
 * Whether the boost button is held (the REQUESTED state). Changes instantly together with the
 * boostChanged event, so the button highlight has no delay. The pace changes later, see isBoostActive.
 */
export function isBoosting(s: GameState): boolean {
  return s.boostRequested
}

/** Whether the current step runs at the boosted pace (the ACTIVE state; switches on a step boundary). */
export function isBoostActive(s: GameState): boolean {
  return s.boosting
}

/**
 * Where the snake is pointing RIGHT NOW as the player sees it: the direction it will take on the next step
 * (pendingTurn buffer: swipe, pad button, axis), or the current heading if nothing is queued. Read-only,
 * no copy. The head, ray and hints take their direction from here rather than from body geometry: the body
 * does not move until the step, so "head minus neck" would show the input only one step late.
 * Core rules (collisions, stepping) do not use this query; there the truth is s.heading.
 */
export function intendedHeading(s: GameState): Readonly<Vec3> {
  return s.pendingTurn ?? s.heading
}

// Reused frame for viewFrame: the query is called every frame, so no allocations.
const VIEW_FRAME: Frame = {
  right: { x: 0, y: 0, z: 0 },
  up: { x: 0, y: 0, z: 0 },
  depth: { x: 0, y: 0, z: 0 },
}
const VIEW_AXIS: Vec3 = { x: 0, y: 0, z: 0 }

function copyVec(to: Vec3, from: Vec3): void {
  to.x = from.x
  to.y = from.y
  to.z = from.z
}

/**
 * Camera frame as the player sees it: cameraFrame plus a turn that was entered but not yet executed.
 * In 'free' the camera looks along heading (depth = -heading), so a turn (swipe) rolls the frame
 * by the same +90° around heading × pendingTurn that the step will do (rules.reorientFrameFree), but right away,
 * without waiting for the step. On the step the core frame becomes exactly this one, so there is no second jump.
 * In 'plane' the camera does not depend on heading and the frame never changes (it only changes on the demo turn,
 * which sets it at once). Returns a shared reused object (do not keep it between frames or mutate it);
 * with nothing queued, returns s.frame itself.
 */
export function viewFrame(s: GameState): Frame {
  const pending = s.pendingTurn
  if (s.mode !== 'free' || pending === null) return s.frame
  const h = s.heading
  VIEW_AXIS.x = h.y * pending.z - h.z * pending.y
  VIEW_AXIS.y = h.z * pending.x - h.x * pending.z
  VIEW_AXIS.z = h.x * pending.y - h.y * pending.x
  // A "straight" or 180° turn defines no axis (input never lets one through); the frame stays as is.
  if (VIEW_AXIS.x === 0 && VIEW_AXIS.y === 0 && VIEW_AXIS.z === 0) return s.frame
  copyVec(VIEW_FRAME.right, s.frame.right)
  copyVec(VIEW_FRAME.up, s.frame.up)
  copyVec(VIEW_FRAME.depth, s.frame.depth)
  rotateFrameOf(VIEW_FRAME, VIEW_AXIS)
  return VIEW_FRAME
}

/**
 * Whether cell (x,y,z) is occupied at the moment the head enters it on step j (j >= 1) going straight:
 * cube wall, obstacle or body. The tail vacates along the way: by the j-th entry the last
 * max(0, j - growth) segments have left the body (the core also allows entering the cell the tail is about to leave, if
 * growth is used up, see commands.isFreeAhead). The core is left untouched: read-only, no allocations.
 */
function isBlockedAtStep(s: GameState, x: number, y: number, z: number, j: number): boolean {
  const size = s.size
  if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) return true
  const key = cellKey(x, y, z, size)
  if (s.obstacles.has(key)) return true
  if (!s.snakeCells.has(key)) return false
  const snake = s.snake
  const gone = Math.min(j - s.growth, snake.length - 1)
  for (let i = snake.length - 1; i > snake.length - 1 - gone; i--) {
    const seg = snake[i]!
    if (seg.x === x && seg.y === y && seg.z === z) return false
  }
  return true
}

/**
 * How many steps until the snake crashes (into a wall, obstacle or its own body) if it does not turn:
 * follows intendedHeading (accounts for a turn that was entered but not yet executed). 1 means the very next step
 * is fatal, 2 means one step later, and so on up to and including horizon. 0 means nothing within horizon.
 * horizon comes from outside (config.headSignal.dangerHorizon). Always 0 outside the running phase.
 * Does not mutate state, no allocations; costs O(horizon).
 */
export function stepsToCrash(s: GameState, horizon: number): number {
  if (s.phase !== 'running') return 0
  const h = s.snake[0]!
  const d = intendedHeading(s)
  for (let j = 1; j <= horizon; j++) {
    if (isBlockedAtStep(s, h.x + d.x * j, h.y + d.y * j, h.z + d.z * j, j)) return j
  }
  return 0
}

/**
 * Whether the snake is heading straight at the apple: the apple lies on the ray from the head along intendedHeading, and
 * the path to it has no wall, obstacle or body (otherwise the snake would never reach it and "on the right track" would be a lie:
 * an apple behind an obstacle is NOT on the heading). Range is unlimited except by the cube size.
 * False outside the running phase. Does not mutate state, no allocations; O(size).
 */
export function appleOnCourse(s: GameState): boolean {
  if (s.phase !== 'running') return false
  const h = s.snake[0]!
  const a = s.apple
  const d = intendedHeading(s)
  const dx = a.x - h.x
  const dy = a.y - h.y
  const dz = a.z - h.z
  // Apple on the movement axis: the other two coordinates match, and along the axis it is ahead (not behind and not at the head).
  const along = dx * d.x + dy * d.y + dz * d.z
  if (along < 1) return false
  if (dx - d.x * along !== 0 || dy - d.y * along !== 0 || dz - d.z * along !== 0) return false
  for (let j = 1; j < along; j++) {
    if (isBlockedAtStep(s, h.x + d.x * j, h.y + d.y * j, h.z + d.z * j, j)) return false
  }
  return true
}

/** Boost factor of this game (chosen before the start): for the button label and the selection screen. */
export function getBoostFactor(s: GameState): number {
  return s.boostFactor
}

/**
 * How many times shorter a boosted step actually is than a normal one, given the floor (config.speed.minEffectiveStepMs).
 * Equals getBoostFactor while the floor does not interfere; smaller when boost hits the floor. For a label like "×4 → ×3.0".
 */
export function effectiveBoostFactor(s: GameState): number {
  const b = boostedStepMs(s)
  return b > 0 ? s.stepMs / b : s.boostFactor
}
