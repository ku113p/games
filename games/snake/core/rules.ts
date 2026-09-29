// core/rules.ts — правила игры: создание партии, генерация препятствий, спавн яблока,
// доворот frame, кривая скорости. Чистый TS, без Three.js.

import { cellKey, nextRandom, type Frame, type GameState, type Vec3 } from './state'

export interface Config {
  cube: { sizes: number[]; default: number }
  snake: { startLength: number; growPerApple: number }
  speed: { startStepMs: number; minStepMs: number; stepMsPerApple: number; boostFactor: number }
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
  hints: { latticeAt: 'corners' | 'centers'; latticeStep: number }
  demo: { afterSteps: number }
  loop: { maxFrameMs: number }
  minimap: { windowCells: number }
  fog: { density: number; defaultOn: boolean }
  input: { doubleTapMs: number; swipeMinPx: number; tiltRadPerPx: number }
}

// 6 соседей по граням куба — геометрическая константа (не число баланса).
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
 * Заливка (flood fill) от clearCells по 6 соседям. Любая свободная клетка, не достигнутая
 * заливкой, засыпается препятствием — жёсткое требование «никаких мёртвых зон».
 * Аллокации здесь допустимы: это холодный путь (один раз при генерации уровня, не в кадре).
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

/** Клетка ближе wallMargin к какой-либо стенке куба (при margin 1 — внешний слой). */
export function isInWallMargin(x: number, y: number, z: number, size: number, margin: number): boolean {
  const hi = size - 1 - margin
  return x < margin || y < margin || z < margin || x > hi || y > hi || z > hi
}

/**
 * Кубы и созвездия кубов: случайные затравки, с вероятностью stickiness слипающиеся с
 * соседями в маленькие скопления. clearCells и клетки ближе wallMargin к стенке никогда не занимаются препятствием.
 * После генерации — заливка, недостижимые свободные клетки засыпаются (без мёртвых зон).
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

  // Ограничение попыток числом клеток куба — не магическое число баланса, а гарантия
  // завершения цикла (не больше клеток, чем их есть на кубе).
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
 * Ставит яблоко на случайную свободную клетку. Мутирует s.apple на месте (без аллокаций) —
 * детерминированный поиск: случайный старт + линейный обход клеток куба по кольцу.
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

  // Куб заполнен целиком (теоретический край) — яблоко остаётся на прежнем месте.
  return s.apple
}

function rotateVecInPlace(v: Vec3, axis: Vec3): void {
  const isSameAsAxis = v.x === axis.x && v.y === axis.y && v.z === axis.z
  const isOppositeAxis = v.x === -axis.x && v.y === -axis.y && v.z === -axis.z
  if (isSameAsAxis || isOppositeAxis) return
  // v' = axis × v (правило правой руки), v перпендикулярен axis.
  const x = axis.y * v.z - axis.z * v.y
  const y = axis.z * v.x - axis.x * v.z
  const z = axis.x * v.y - axis.y * v.x
  // + 0 нормализует -0 в 0 (векторное произведение даёт знаковые нули).
  v.x = x + 0
  v.y = y + 0
  v.z = z + 0
}

/**
 * Доворачивает frame на +90° вокруг axis (правило правой руки). Вектор frame, совпадающий
 * с ±axis, остаётся на месте; остальные два поворачиваются по v' = axis × v. Мутирует frame
 * на месте — без новых объектов.
 */
export function rotateFrame(s: GameState, axis: Vec3): void {
  rotateVecInPlace(s.frame.right, axis)
  rotateVecInPlace(s.frame.up, axis)
  rotateVecInPlace(s.frame.depth, axis)
}

/**
 * Фаза 'free': голова поворачивает на newHeading (±right/±up текущего frame, ⟂ heading).
 * Frame целиком (твёрдо, без отражений) доворачивается на +90° вокруг a = heading × newHeading:
 * это переводит старое направление взгляда heading в newHeading, значит depth снова = -heading.
 * right/up при этом меняются минимально: при повороте вбок (yaw) up остаётся на месте,
 * при повороте вверх/вниз (pitch) на месте остаётся right. Крена нет — змейка не переворачивается
 * сама. Вызывать ДО присвоения нового heading. Мутирует на месте, без аллокаций.
 */
// Переиспользуемый вектор оси доворота (горячий путь: шаг в 'free' без аллокаций).
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
 * Демо-переход plane → free: голова сворачивает по третьей оси, sign = -1 ('into': heading = -depth)
 * или +1 ('out': heading = +depth). Frame подгоняется так, чтобы depth = -heading:
 * 'into' — frame не меняется (камера уже смотрит вглубь); 'out' — разворот на 180° вокруг up
 * (right и depth меняют знак, up остаётся). Мутирует heading и frame на месте.
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
 * Прямой старт в фазе 'free' (не первая игра): инвариант фазы depth = -heading, правая тройка
 * (right × up = depth), без -0. up остаётся мировым +y (heading = ±x, значит up ⟂ heading),
 * right = up × depth. Для heading = +x: right = +z, up = +y, depth = -x. Мутирует frame на месте.
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
  // + 0 нормализует -0 (знаковые нули векторного произведения).
  f.right.x = u.y * d.z - u.z * d.y + 0
  f.right.y = u.z * d.x - u.x * d.z + 0
  f.right.z = u.x * d.y - u.y * d.x + 0
}

export function speedAfterApples(config: Config, apples: number): number {
  const raw = config.speed.startStepMs - apples * config.speed.stepMsPerApple
  return Math.max(config.speed.minStepMs, raw)
}

function defaultFrame(): Frame {
  return {
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    depth: { x: 0, y: 0, z: 1 }, // depth = right × up
  }
}

/** Создаёт новую партию: змейка, яблоко, препятствия без мёртвых зон. */
export function createGame(config: Config, size: number, seed: number, isFirstGameEver: boolean): GameState {
  const mid = Math.floor(size / 2)
  const startLength = config.snake.startLength
  const heading: Vec3 = { x: 1, y: 0, z: 0 } // +right
  const frame = defaultFrame()

  const snake: Vec3[] = []
  const snakeCells = new Set<number>()
  for (let i = 0; i < startLength; i++) {
    // Хвост тянется в сторону, противоположную heading, голова — во главе массива.
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
    stepMs: config.speed.startStepMs,
    boostRequested: false,
    boosting: false,
    boostFactor: config.speed.boostFactor,
    sinceStepMs: 0,
    elapsedMs: 0,
    demoTurnPending: isFirstGameEver, // плоский старт и переезд камеры — один раз в жизни игрока; дальше сразу 'free'
    rngState: seed | 0,
  }

  if (!isFirstGameEver) initFreeStartFrame(state)

  const clearCells = buildClearCells(snake[0]!, snake, size, config.obstacles.clearRadius)
  state.obstacles = generateObstacles(size, config.obstacles.density, config.obstacles.stickiness, clearCells, () =>
    nextRandom(state),
    config.obstacles.wallMargin,
  )
  spawnApple(state)

  return state
}
