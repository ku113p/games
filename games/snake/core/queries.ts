// core/queries.ts — только чтение состояния. Чистый TS, без Three.js.
// Вызывается из view/ каждый кадр (рендер и препятствия через InstancedMesh) — без аллокаций.

import { rotateFrameOf } from './rules'
import { cellKey, effectiveStepMs, type GameState, type Mode, type Vec3, type Frame } from './state'

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

/**
 * Куда змейка повёрнута ПРЯМО СЕЙЧАС в глазах игрока: направление, которое она возьмёт на ближайшем такте
 * (буфер pendingTurn: свайп, кнопка пульта, ось), а если ввода нет — текущий heading. Только чтение,
 * без копии. Голова, луч и подсказки берут направление отсюда, а не из геометрии тела: тело до такта
 * не двигается, и по разнице «голова минус шея» ввод был бы виден только на следующем шаге.
 * Правила ядра (столкновения, шаг) этим запросом не пользуются — там истина s.heading.
 */
export function intendedHeading(s: GameState): Readonly<Vec3> {
  return s.pendingTurn ?? s.heading
}

// Переиспользуемый кадр под viewFrame: запрос вызывается каждый кадр, без аллокаций.
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
 * Кадр камеры в глазах игрока: cameraFrame плюс уже введённый, но ещё не исполненный поворот.
 * В 'free' камера смотрит вдоль heading (depth = -heading), поэтому поворот (свайп) доворачивает кадр
 * на то же +90° вокруг heading × pendingTurn, что сделает такт (rules.reorientFrameFree) — но сразу,
 * не дожидаясь шага. На такте кадр ядра станет ровно этим же, повторного скачка нет.
 * В 'plane' камера от heading не зависит, а доворот оси (turnAxis) ядро делает в момент команды —
 * там кадр и так актуален. Возвращает общий переиспользуемый объект (не хранить между кадрами, не менять);
 * без ввода в очереди — сам s.frame.
 */
export function viewFrame(s: GameState): Frame {
  const pending = s.pendingTurn
  if (s.mode !== 'free' || pending === null) return s.frame
  const h = s.heading
  VIEW_AXIS.x = h.y * pending.z - h.z * pending.y
  VIEW_AXIS.y = h.z * pending.x - h.x * pending.z
  VIEW_AXIS.z = h.x * pending.y - h.y * pending.x
  // Поворот «прямо» или на 180° оси не задаёт (ввод такое не пропускает); кадр остаётся как есть.
  if (VIEW_AXIS.x === 0 && VIEW_AXIS.y === 0 && VIEW_AXIS.z === 0) return s.frame
  copyVec(VIEW_FRAME.right, s.frame.right)
  copyVec(VIEW_FRAME.up, s.frame.up)
  copyVec(VIEW_FRAME.depth, s.frame.depth)
  rotateFrameOf(VIEW_FRAME, VIEW_AXIS)
  return VIEW_FRAME
}

/**
 * Занята ли клетка (x,y,z) в момент, когда голова входит в неё на j-м ходу (j >= 1) по прямой:
 * стена куба, препятствие или тело. Хвост освобождается по ходу: к j-му входу из тела ушли
 * последние max(0, j - growth) сегментов (ядро пускает и в вот-вот уходящую клетку хвоста, если
 * growth исчерпан, см. commands.isFreeAhead). Ядро при этом не трогается: только чтение, без аллокаций.
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
 * Через сколько ходов змейка врежется (в стену, препятствие или своё тело), если не повернёт:
 * идёт по intendedHeading (учитывает введённый, но ещё не исполненный поворот). 1 — следующий же ход
 * смертелен, 2 — через один, и так до horizon включительно. 0 — в пределах horizon ничего нет.
 * horizon приходит снаружи (config.headSignal.dangerHorizon). Вне фазы running всегда 0.
 * Не мутирует состояние, без аллокаций; стоит O(horizon).
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
 * Идёт ли змейка прямо на яблоко: яблоко лежит на луче из головы по intendedHeading, и до него по
 * пути нет стены, препятствия и тела (иначе змейка до него не дойдёт и «на верном пути» было бы ложью:
 * яблоко за препятствием НЕ на курсе). Дальность не ограничена, кроме размера куба.
 * Вне фазы running — false. Не мутирует состояние, без аллокаций; O(size).
 */
export function appleOnCourse(s: GameState): boolean {
  if (s.phase !== 'running') return false
  const h = s.snake[0]!
  const a = s.apple
  const d = intendedHeading(s)
  const dx = a.x - h.x
  const dy = a.y - h.y
  const dz = a.z - h.z
  // Яблоко на оси движения: две другие координаты совпадают, вдоль оси — впереди (не позади и не в голове).
  const along = dx * d.x + dy * d.y + dz * d.z
  if (along < 1) return false
  if (dx - d.x * along !== 0 || dy - d.y * along !== 0 || dz - d.z * along !== 0) return false
  for (let j = 1; j < along; j++) {
    if (isBlockedAtStep(s, h.x + d.x * j, h.y + d.y * j, h.z + d.z * j, j)) return false
  }
  return true
}
