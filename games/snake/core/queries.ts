// core/queries.ts — только чтение состояния. Чистый TS, без Three.js.
// Вызывается из view/ каждый кадр (рендер и препятствия через InstancedMesh) — без аллокаций.

import { effectiveStepMs, type GameState, type Mode, type Vec3, type Frame } from './state'

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

/** Обходит препятствия без аллокаций — декодирует cellKey обратно в координаты. */
export function forEachObstacle(s: GameState, fn: (x: number, y: number, z: number) => void): void {
  const size = s.size
  for (const key of s.obstacles) {
    const x = key % size
    const y = Math.floor(key / size) % size
    const z = Math.floor(key / (size * size))
    fn(x, y, z)
  }
}

/** Обходит сегменты змейки от головы (index 0) к хвосту, без аллокаций. */
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

/** Позиция яблока (только чтение, без копии). */
export function applePos(s: GameState): Readonly<Vec3> {
  return s.apple
}

export function cubeSize(s: GameState): number {
  return s.size
}

export function elapsedMs(s: GameState): number {
  return s.elapsedMs
}

/** Фаза камеры: 'plane' (плоская змейка) или 'free' (камера за головой). */
export function gameMode(s: GameState): Mode {
  return s.mode
}

/**
 * Прогресс до следующего шага, 0..1 (sinceStepMs / длительность идущего шага) — для интерполяции
 * головы в виде. Считается по действующему темпу, поэтому нажатие/отпускание посреди шага его не двигает.
 */
export function stepProgress(s: GameState): number {
  const stepMs = effectiveStepMs(s)
  if (!(stepMs > 0)) return 0
  const p = s.sinceStepMs / stepMs
  return p < 0 ? 0 : p > 1 ? 1 : p
}

/**
 * Зажата ли кнопка ускорения (ЗАПРОШЕННОЕ состояние). Меняется мгновенно вместе с событием
 * boostChanged — для подсветки кнопки без задержки. Темп меняется позже, см. isBoostActive.
 */
export function isBoosting(s: GameState): boolean {
  return s.boostRequested
}

/** Идёт ли текущий шаг в ускоренном темпе (ДЕЙСТВУЮЩЕЕ состояние; переключается на границе шага). */
export function isBoostActive(s: GameState): boolean {
  return s.boosting
}
