// Общие помощники для тестов ядра (не тест-файл, bun test его не запускает).
import { cellKey, type Frame, type GameState, type Vec3 } from './state'
import type { Config } from './rules'

export const config: Config = {
  cube: { sizes: [20, 50, 100], default: 20 },
  snake: { startLength: 3, growPerApple: 1 },
  speed: { startStepMs: 180, minStepMs: 60, stepMsPerApple: 4, boostFactor: 2 },
  obstacles: { density: 0.02, stickiness: 0.6, clearRadius: 4, wallMargin: 1 },
  camera: { rollMs: 260, microPauseMs: 90, glitchMs: 180, distanceFactor: 1.6, followDistance: 4.5, followHeight: 2.5, lateralOffset: 0.7, lookAheadDistance: 10, lookDownOffset: 1.5, modeSwitchMs: 1400 },
  hints: { latticeAt: 'corners', latticeStep: 1, compassHideDist: 1.5, compassFullDist: 3 },
  demo: { afterSteps: 5 },
  loop: { maxFrameMs: 100 },
  minimap: { windowCells: 20, levelWindowCells: 10 },
  fog: { density: 0.05, defaultOn: true },
  input: { doubleTapMs: 240, swipeMinPx: 24, tiltRadPerPx: 0.005 },
}

export const V = {
  R: { x: 1, y: 0, z: 0 },
  L: { x: -1, y: 0, z: 0 },
  U: { x: 0, y: 1, z: 0 },
  D: { x: 0, y: -1, z: 0 },
  B: { x: 0, y: 0, z: 1 }, // к зрителю (depth в базовом frame)
  F: { x: 0, y: 0, z: -1 }, // от зрителя
} as const

export function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

export function baseFrame(): Frame {
  return { right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) }
}

/** Змейка из клеток head → tail. */
export function makeState(overrides: Partial<GameState> = {}): GameState {
  const size = overrides.size ?? 20
  const snake = overrides.snake ?? [v(10, 10, 10), v(9, 10, 10), v(8, 10, 10)]
  const base: GameState = {
    size,
    snake,
    snakeCells: new Set(snake.map((c) => cellKey(c.x, c.y, c.z, size))),
    obstacles: new Set(),
    apple: v(19, 19, 19),
    heading: v(1, 0, 0),
    frame: baseFrame(),
    pendingTurn: null,
    rolledSinceStep: false,
    stepCount: 0,
    mode: 'plane',
    growth: 0,
    phase: 'running',
    score: 0,
    applesEaten: 0,
    stepMs: 100,
    boostRequested: false,
    boosting: false,
    boostFactor: 2,
    minBoostedStepMs: 0,
    paceScale: 1,
    sinceStepMs: 0,
    elapsedMs: 0,
    demoTurnPending: false,
    rngState: 1,
  }
  return { ...base, ...overrides }
}

/** Независимый от продакшена mulberry32 для передачи в generateObstacles. */
export function makeRng(seed: number): () => number {
  let st = seed | 0
  return () => {
    st = (st + 0x6d2b79f5) | 0
    let t = st
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Сколько свободных клеток достижимо заливкой от стартов; и сколько свободных всего. */
export function reachability(
  size: number,
  starts: Iterable<number>,
  obstacles: Set<number>,
): { reachable: number; free: number } {
  const total = size * size * size
  const seen = new Uint8Array(total)
  const queue: number[] = []
  for (const k of starts) {
    if (!obstacles.has(k) && !seen[k]) {
      seen[k] = 1
      queue.push(k)
    }
  }
  const dirs = [1, -1, 0, 0, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, 0, 0, 1, -1]
  for (let qi = 0; qi < queue.length; qi++) {
    const key = queue[qi]!
    const x = key % size
    const y = Math.floor(key / size) % size
    const z = Math.floor(key / (size * size))
    for (let d = 0; d < 6; d++) {
      const nx = x + dirs[d]!
      const ny = y + dirs[d + 6]!
      const nz = z + dirs[d + 12]!
      if (nx < 0 || ny < 0 || nz < 0 || nx >= size || ny >= size || nz >= size) continue
      const nk = cellKey(nx, ny, nz, size)
      if (seen[nk] || obstacles.has(nk)) continue
      seen[nk] = 1
      queue.push(nk)
    }
  }
  return { reachable: queue.length, free: total - obstacles.size }
}
