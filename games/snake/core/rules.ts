// core/rules.ts — game rules: creating a game, obstacle generation, apple spawn,
// frame roll, speed curve. Pure TS, no Three.js.

import { cellKey, nextRandom, type Frame, type GameState, type Vec3 } from './state'

export interface Config {
  cube: { sizes: number[]; default: number }
  snake: { startLength: number; growPerApple: number }
  speed: { startStepMs: number; minStepMs: number; stepMsPerApple: number; boostFactor: number; boostFactors?: number[]; minEffectiveStepMs?: number }
  obstacles: { density: number; stickiness: number; clearRadius: number; wallMargin: number }
  camera: {
    rollMs: number
    microPauseMs: number
    glitchMs: number
    distanceFactor: number
    followDistance: number
    followHeight: number
    lateralOffset: number
    lookAheadDistance: number
    lookDownOffset: number
    modeSwitchMs: number
  }
  hints: { latticeAt: 'corners' | 'centers'; latticeStep: number; compassHideDist: number; compassFullDist: number }
  demo: { afterSteps: number }
  loop: { maxFrameMs: number }
  minimap: { windowCells: number; levelWindowCells: number }
  fog: { density: number; defaultOn: boolean }
  input: { doubleTapMs: number; swipeMinPx: number; tiltRadPerPx: number }
}

// The 6 neighbors across cube faces are a geometric constant (not a balance value).
const NEIGHBOR_OFFSETS: readonly Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]

function inBounds(x: number, y: number, z: number, size: number): boolean {
  return x >= 0 && y >= 0 && z >= 0 && x < size && y < size && z < size
}

function buildClearCells(headPos: Vec3, snake: Vec3[], size: number, clearRadius: number): Set<number> {
  const clearCells = new Set<number>()
  for (const seg of snake) {
    clearCells.add(cellKey(seg.x, seg.y, seg.z, size))
  }
  for (let dx = -clearRadius; dx <= clearRadius; dx++) {
    for (let dy = -clearRadius; dy <= clearRadius; dy++) {
      for (let dz = -clearRadius; dz <= clearRadius; dz++) {
        const x = headPos.x + dx
        const y = headPos.y + dy
        const z = headPos.z + dz
        if (!inBounds(x, y, z, size)) continue
        clearCells.add(cellKey(x, y, z, size))
      }
    }
  }
  return clearCells
}

/**
  * Flood fill from clearCells over the 6 neighbors. Any free cell the fill does not reach
  * is filled with an obstacle: a hard requirement of "no dead zones".
  * Allocations are fine here: this is a cold path (once per level generation, not in the frame loop).
 */
export function fillDeadZones(size: number, obstacles: Set<number>, clearCells: Set<number>): void {
  const total = size * size * size
  const visited = new Uint8Array(total)
  const queue: number[] = []

  for (const key of clearCells) {
    if (!obstacles.has(key) && !visited[key]) {
      visited[key] = 1
      queue.push(key)
    }
  }

  let qi = 0
  while (qi < queue.length) {
    const key = queue[qi++]!
    const x = key % size
    const y = Math.floor(key / size) % size
    const z = Math.floor(key / (size * size))
    for (const off of NEIGHBOR_OFFSETS) {
      const nx = x + off.x
      const ny = y + off.y
      const nz = z + off.z
      if (!inBounds(nx, ny, nz, size)) continue
      const nKey = cellKey(nx, ny, nz, size)
      if (visited[nKey] || obstacles.has(nKey)) continue
      visited[nKey] = 1
      queue.push(nKey)
    }
  }

  for (let key = 0; key < total; key++) {
    if (!obstacles.has(key) && !visited[key]) {
      obstacles.add(key)
    }
  }
}

/**
  * Whether an obstacle can appear at all in a cube of this size. The head stands in the middle of the cube with a clear zone around it
  * (clearRadius on every axis), and the outer layer of thickness wallMargin is taken by walls: if the whole allowed area lies
  * inside the clear zone, there will be no obstacles at any density (with the config values clearRadius 4 and wallMargin 1 that is every cube up to 11 cells, including 5³; from 12 on there are obstacles).
 */
export function arenaHasObstacles(size: number, clearRadius: number, wallMargin: number): boolean {
  const mid = Math.floor(size / 2)
  return wallMargin < mid - clearRadius || size - 1 - wallMargin > mid + clearRadius
}

/** Cell closer than wallMargin to any cube wall (with margin 1, the outer layer). */
export function isInWallMargin(x: number, y: number, z: number, size: number, margin: number): boolean {
  const hi = size - 1 - margin
  return x < margin || y < margin || z < margin || x > hi || y > hi || z > hi
}

/**
  * Cubes and obstacle clusters: random seeds that stick to
  * neighbors with probability stickiness, forming small clusters. clearCells and cells closer than wallMargin to a wall are never taken by an obstacle.
  * After generation comes the fill: unreachable free cells are filled in (no dead zones).
 */
export function generateObstacles(
  size: number,
  density: number,
  stickiness: number,
  clearCells: Set<number>,
  rng: () => number,
  wallMargin = 0,
): Set<number> {
  const total = size * size * size
  const obstacles = new Set<number>()
  const targetCount = Math.floor(total * density)

  function tryAdd(x: number, y: number, z: number): boolean {
    if (!inBounds(x, y, z, size)) return false
    if (isInWallMargin(x, y, z, size, wallMargin)) return false
    const key = cellKey(x, y, z, size)
    if (clearCells.has(key) || obstacles.has(key)) return false
    obstacles.add(key)
    return true
  }

  // Attempts are capped by the number of cube cells: not a balance magic number but a guarantee
  // that the loop terminates (no more attempts than there are cells in the cube).
  const maxAttempts = total
  let attempts = 0
  while (obstacles.size < targetCount && attempts < maxAttempts) {
    attempts++
    const x = Math.floor(rng() * size)
    const y = Math.floor(rng() * size)
    const z = Math.floor(rng() * size)
    if (!tryAdd(x, y, z)) continue
    for (const off of NEIGHBOR_OFFSETS) {
      if (obstacles.size >= targetCount) break
      if (rng() < stickiness) {
        tryAdd(x + off.x, y + off.y, z + off.z)
      }
    }
  }

  fillDeadZones(size, obstacles, clearCells)

  return obstacles
}

/**
  * Places the apple on a random free cell. Mutates s.apple in place (no allocations):
  * a deterministic search, a random start plus a linear ring walk over the cube cells.
 */
export function spawnApple(s: GameState): Vec3 {
  const size = s.size
  const total = size * size * size
  const start = Math.floor(nextRandom(s) * total)

  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total
    const x = idx % size
    const y = Math.floor(idx / size) % size
    const z = Math.floor(idx / (size * size))
    const key = cellKey(x, y, z, size)
    if (!s.snakeCells.has(key) && !s.obstacles.has(key)) {
      s.apple.x = x
      s.apple.y = y
      s.apple.z = z
      return s.apple
    }
  }

  // The cube is completely full (a theoretical edge case): the apple stays where it was.
  return s.apple
}

function rotateVecInPlace(v: Vec3, axis: Vec3): void {
  const isSameAsAxis = v.x === axis.x && v.y === axis.y && v.z === axis.z
  const isOppositeAxis = v.x === -axis.x && v.y === -axis.y && v.z === -axis.z
  if (isSameAsAxis || isOppositeAxis) return
  // v' = axis × v (right-hand rule), v is perpendicular to axis.
  const x = axis.y * v.z - axis.z * v.y
  const y = axis.z * v.x - axis.x * v.z
  const z = axis.x * v.y - axis.y * v.x
  // + 0 normalizes -0 to 0 (the cross product yields signed zeros).
  v.x = x + 0
  v.y = y + 0
  v.z = z + 0
}

/**
  * Rolls the frame by +90° around axis (right-hand rule). A frame vector that coincides
  * with ±axis stays in place; the other two rotate by v' = axis × v. Mutates frame
  * in place, without new objects.
 */
export function rotateFrame(s: GameState, axis: Vec3): void {
  rotateFrameOf(s.frame, axis)
}

/** Same as rotateFrame, but over an arbitrary Frame (for queries that compute the view on a copy). */
export function rotateFrameOf(frame: Frame, axis: Vec3): void {
  rotateVecInPlace(frame.right, axis)
  rotateVecInPlace(frame.up, axis)
  rotateVecInPlace(frame.depth, axis)
}

/**
  * Mode 'free': the head turns to newHeading (±right/±up of the current frame, ⟂ heading).
  * The whole frame (rigidly, no reflections) is rolled by +90° around a = heading × newHeading:
  * this maps the old view direction heading to newHeading, so depth = -heading again.
  * right/up change minimally: on a sideways turn (yaw) up stays in place,
  * on an up/down turn (pitch) right stays in place. No roll: the snake does not flip
  * over by itself. Call BEFORE assigning the new heading. Mutates in place, no allocations.
 */
// Reused roll-axis vector (hot path: a step in 'free' without allocations).
const AXIS_SCRATCH: Vec3 = { x: 0, y: 0, z: 0 }

export function reorientFrameFree(s: GameState, newHeading: Vec3): void {
  const h = s.heading
  const axis = AXIS_SCRATCH
  axis.x = h.y * newHeading.z - h.z * newHeading.y
  axis.y = h.z * newHeading.x - h.x * newHeading.z
  axis.z = h.x * newHeading.y - h.y * newHeading.x
  rotateFrame(s, axis)
}

/**
  * Demo transition plane → free: the head turns along the third axis, sign = -1 ('into': heading = -depth)
  * or +1 ('out': heading = +depth). The frame is adjusted so that depth = -heading:
  * 'into': frame unchanged (the camera already looks into the screen); 'out': a 180° turn around up
  * (right and depth flip sign, up stays). Mutates heading and frame in place.
 */
export function enterFreeFrame(s: GameState, sign: -1 | 1): void {
  const d = s.frame.depth
  const nx = sign * d.x + 0
  const ny = sign * d.y + 0
  const nz = sign * d.z + 0
  if (sign === 1) {
    const r = s.frame.right
    r.x = -r.x + 0
    r.y = -r.y + 0
    r.z = -r.z + 0
    d.x = -d.x + 0
    d.y = -d.y + 0
    d.z = -d.z + 0
  }
  s.heading.x = nx
  s.heading.y = ny
  s.heading.z = nz
}

/**
  * Direct start in mode 'free' (not the first game): the mode invariant depth = -heading, right-handed triple
  * (right × up = depth), no -0. up stays world +y (heading = ±x, so up ⟂ heading),
  * right = up × depth. For heading = +x: right = +z, up = +y, depth = -x. Mutates frame in place.
 */
export function initFreeStartFrame(s: GameState): void {
  const h = s.heading
  const f = s.frame
  f.depth.x = -h.x + 0
  f.depth.y = -h.y + 0
  f.depth.z = -h.z + 0
  f.up.x = 0
  f.up.y = 1
  f.up.z = 0
  const u = f.up
  const d = f.depth
  // + 0 normalizes -0 (signed zeros of the cross product).
  f.right.x = u.y * d.z - u.z * d.y + 0
  f.right.y = u.z * d.x - u.x * d.z + 0
  f.right.z = u.x * d.y - u.y * d.x + 0
}

/** A boost factor is valid if it is a finite number ≥ 1 (×1 means "no boost", which is allowed). */
export function isValidBoostFactor(f: number): boolean {
  return Number.isFinite(f) && f >= 1
}

/**
  * The factors the player picks from before a game (config.speed.boostFactors: ×2, ×3, ×4).
  * Invalid values are dropped; with no list or an empty one, the single boostFactor from config is used.
  * How they are picked and bought is not the core's concern: it receives a ready number in createGame.
 */
export function availableBoostFactors(config: Config): number[] {
  const list = (config.speed.boostFactors ?? []).filter(isValidBoostFactor)
  return list.length > 0 ? list : [isValidBoostFactor(config.speed.boostFactor) ? config.speed.boostFactor : 1]
}

/** A pace scale is valid if it is a finite number > 0; otherwise 1 (as in config). */
export function sanitizePaceScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/** An obstacle count multiplier is valid if it is a finite number ≥ 0 (0 means an arena without obstacles); otherwise 1. */
export function sanitizeObstacleMult(mult: number): number {
  return Number.isFinite(mult) && mult >= 0 ? mult : 1
}

/**
  * Step duration after `apples` apples eaten. paceScale stretches (>1) or compresses (<1) the whole curve as a unit:
  * the initial step, the minimum and the slope (stepMsPerApple), so the shape of the curve and the apple at which
  * the minimum is reached do not change.
 */
export function speedAfterApples(config: Config, apples: number, paceScale = 1): number {
  const raw = config.speed.startStepMs - apples * config.speed.stepMsPerApple
  return Math.max(config.speed.minStepMs, raw) * paceScale
}

/** Game parameters chosen before the start (the shop). All optional: without them a game plays as before. */
export interface GameOptions {
  /** Multiplier on config.obstacles.density: 0 = no obstacles, 0.5 = half as many, 2 = twice as many. */
  obstacleMult?: number
  /** Pace curve scale, see speedAfterApples. */
  paceScale?: number
}

function defaultFrame(): Frame {
  return {
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    depth: { x: 0, y: 0, z: 1 }, // depth = right × up
  }
}

/** Creates a new game: snake, apple, obstacles without dead zones. */
/**
  * boostFactor: the boost factor of THIS game (chosen before the start; defaults to config.speed.boostFactor).
  * An invalid value (NaN, < 1) becomes ×1: boost simply does nothing.
 */
export function createGame(
  config: Config,
  size: number,
  seed: number,
  isFirstGameEver: boolean,
  boostFactor: number = config.speed.boostFactor,
  options: GameOptions = {},
): GameState {
  const paceScale = sanitizePaceScale(options.paceScale ?? 1)
  const obstacleMult = sanitizeObstacleMult(options.obstacleMult ?? 1)
  const mid = Math.floor(size / 2)
  const startLength = config.snake.startLength
  const heading: Vec3 = { x: 1, y: 0, z: 0 } // +right
  const frame = defaultFrame()

  const snake: Vec3[] = []
  const snakeCells = new Set<number>()
  for (let i = 0; i < startLength; i++) {
    // The tail extends opposite to heading, the head leads the array.
    const seg: Vec3 = { x: mid - i, y: mid, z: mid }
    snake.push(seg)
    snakeCells.add(cellKey(seg.x, seg.y, seg.z, size))
  }

  const state: GameState = {
    size,
    snake,
    snakeCells,
    obstacles: new Set<number>(),
    apple: { x: 0, y: 0, z: 0 },
    heading,
    frame,
    pendingTurn: null,
    rolledSinceStep: false,
    mode: isFirstGameEver ? 'plane' : 'free',
    stepCount: 0,
    growth: 0,
    phase: 'ready',
    score: 0,
    applesEaten: 0,
    stepMs: speedAfterApples(config, 0, paceScale),
    paceScale,
    boostRequested: false,
    boosting: false,
    boostFactor: isValidBoostFactor(boostFactor) ? boostFactor : 1,
    minBoostedStepMs: config.speed.minEffectiveStepMs !== undefined && config.speed.minEffectiveStepMs > 0 ? config.speed.minEffectiveStepMs : 0,
    sinceStepMs: 0,
    elapsedMs: 0,
    demoTurnPending: isFirstGameEver, // plane start and camera transition happen once in the player's life; after that, straight to 'free'
    rngState: seed | 0,
  }

  if (!isFirstGameEver) initFreeStartFrame(state)

  const clearCells = buildClearCells(snake[0]!, snake, size, config.obstacles.clearRadius)
  state.obstacles = generateObstacles(size, config.obstacles.density * obstacleMult, config.obstacles.stickiness, clearCells, () =>
    nextRandom(state),
    config.obstacles.wallMargin,
  )
  spawnApple(state)

  return state
}
