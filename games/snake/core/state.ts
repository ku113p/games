// core/state.ts — форма состояния змейки. Чистый TS, без Three.js.
// Сигнатуры фиксированы контрактом слоёв (CONTRACT.md) — не менять.

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
export type AxisDir = 'into' | 'out'
export type DeathCause = 'body' | 'wall' | 'obstacle'

export interface GameState {
  size: number
  snake: Vec3[] // snake[0] — голова
  snakeCells: Set<number> // ключи клеток змейки, ключ = cellKey()
  obstacles: Set<number>
  apple: Vec3
  heading: Vec3
  frame: Frame
  pendingTurn: Vec3 | null // буфер ввода: новый heading, применяется на следующем шаге
  rolledSinceStep: boolean // frame довёрнут turnAxis, следующий такт — разворот на месте (без движения); второй доворот до него запрещён
  mode: Mode // 'plane' — плоская змейка; 'free' — камера за головой (heading = -depth). Один раз plane → free на демо-ходу
  stepCount: number // сколько шагов (успешных ходов) сделано в партии
  growth: number // сколько клеток ещё дорастить
  phase: Phase
  score: number
  applesEaten: number
  stepMs: number
  boostRequested: boolean // запрошенное ускорение: кнопка зажата прямо сейчас (setBoost); на темп не влияет
  boosting: boolean // действующее ускорение: шаг длится stepMs / boostFactor; берёт boostRequested на границе шага (tick)
  boostFactor: number // копия config.speed.boostFactor на партию (setBoost не получает config)
  sinceStepMs: number
  elapsedMs: number
  demoTurnPending: boolean // демо-доворот: один раз, на demo.afterSteps-м ходу первой игры
  rngState: number
}

/** Целочисленный ключ клетки куба — используется в Set'ах snakeCells/obstacles. */
export function cellKey(x: number, y: number, z: number, size: number): number {
  return x + y * size + z * size * size
}

// Множитель приращения mulberry32 (константа алгоритма ГПСЧ, не число баланса игры).
const MULBERRY32_INCREMENT = 0x6d2b79f5

/**
 * mulberry32: детерминированный ГПСЧ. Мутирует s.rngState, возвращает число в [0, 1).
 * Единственный источник случайности в ядре — время в tick приходит параметром снаружи.
 */
export function nextRandom(s: GameState): number {
  s.rngState = (s.rngState + MULBERRY32_INCREMENT) | 0
  let t = s.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Длительность идущего шага: stepMs / boostFactor, пока действует ускорение (boosting, не boostRequested). */
export function effectiveStepMs(s: GameState): number {
  return s.boosting && s.boostFactor > 0 ? s.stepMs / s.boostFactor : s.stepMs
}
