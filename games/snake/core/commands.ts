// core/commands.ts — действия игрока меняют состояние и возвращают события.
// Чистый TS, без Three.js. Горячий путь (tick, шаг, проверки столкновений) — без аллокаций:
// события пишутся в один и тот же переиспользуемый на GameState массив.

import { enterFreeFrame, reorientFrameFree, rotateFrame, spawnApple, speedAfterApples, type Config } from './rules'
import { cellKey, effectiveStepMs, nextRandom, type AxisDir, type DeathCause, type Frame, type GameState, type Mode, type ScreenDir, type Vec3 } from './state'

export type GameEvent =
  | { type: 'started' }
  | { type: 'moved' }
  | { type: 'turned'; heading: Vec3 }
  | { type: 'turnedInPlace'; heading: Vec3 }
  | { type: 'axisTurned'; rollAxis: Vec3; direction: AxisDir }
  | { type: 'ate'; apple: Vec3; score: number }
  | { type: 'appleSpawned'; apple: Vec3 }
  | { type: 'speedUp'; stepMs: number }
  | { type: 'boostChanged'; on: boolean }
  | { type: 'demoTurn' }
  | { type: 'modeChanged'; mode: Mode }
  | { type: 'died'; cause: DeathCause }

// События без полезной нагрузки — замороженные синглтоны (без аллокации на каждый шаг).
const STARTED: GameEvent = Object.freeze({ type: 'started' })
const MOVED: GameEvent = Object.freeze({ type: 'moved' })
const BOOST_ON: GameEvent = Object.freeze({ type: 'boostChanged', on: true })
const BOOST_OFF: GameEvent = Object.freeze({ type: 'boostChanged', on: false })
const DEMO_TURN: GameEvent = Object.freeze({ type: 'demoTurn' })
const MODE_FREE: GameEvent = Object.freeze({ type: 'modeChanged', mode: 'free' })

// Каждый GameState получает свой переиспользуемый массив событий (без аллокаций на каждый
// вызов; изолировано между параллельными партиями, например в тестах).
const eventBuffers = new WeakMap<GameState, GameEvent[]>()

function getEventBuffer(s: GameState): GameEvent[] {
  let buf = eventBuffers.get(s)
  if (!buf) {
    buf = []
    eventBuffers.set(s, buf)
  }
  return buf
}

function screenDirToVec(dir: ScreenDir, frame: Frame): Vec3 {
  switch (dir) {
    case 'right':
      return { x: frame.right.x, y: frame.right.y, z: frame.right.z }
    case 'left':
      return { x: signed(-1, frame.right.x), y: signed(-1, frame.right.y), z: signed(-1, frame.right.z) }
    case 'up':
      return { x: frame.up.x, y: frame.up.y, z: frame.up.z }
    case 'down':
      return { x: signed(-1, frame.up.x), y: signed(-1, frame.up.y), z: signed(-1, frame.up.z) }
  }
}

function isOpposite(a: Vec3, b: Vec3): boolean {
  return a.x === -b.x && a.y === -b.y && a.z === -b.z
}

// sign * 0 produces -0 in JS; normalize so heading components never carry a signed zero.
function signed(sign: -1 | 1, value: number): number {
  const result = sign * value
  return result === 0 ? 0 : result
}

/**
 * Направление ведёт голову ровно в вторую клетку тела (шею). После разворота на месте heading
 * уже не совпадает с последним пройденным ходом, поэтому одного isOpposite(heading) мало.
 */
function pointsIntoNeck(s: GameState, dir: Vec3): boolean {
  if (s.snake.length < 2) return false
  const head = s.snake[0]!
  const neck = s.snake[1]!
  return head.x + dir.x === neck.x && head.y + dir.y === neck.y && head.z + dir.z === neck.z
}

export function startGame(s: GameState): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'ready') return buf // из running/dead старт не делает ничего
  s.phase = 'running'
  buf.push(STARTED)
  return buf
}

/**
 * Ускорение: меняет ЗАПРОШЕННОЕ состояние (boostRequested). Действующее (boosting, от него зависит
 * длительность шага) подхватит tick на границе шага: нажатие и отпускание вступают с начала
 * следующего хода, идущий доигрывается в своём темпе. Событие boostChanged — сразу и только при
 * реальной смене запроса (ввод дёргает вызов часто). Вне running — ничего не делает.
 * sinceStepMs не трогаем.
 */
export function setBoost(s: GameState, on: boolean): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'running') return buf
  if (s.boostRequested === on) return buf
  s.boostRequested = on
  buf.push(on ? BOOST_ON : BOOST_OFF)
  return buf
}

/**
 * Поворот в плоскости экрана: heading меняется на ±right/±up текущего frame. Frame не
 * меняется. Разворот на 180° (относительно последнего сделанного хода) запрещён.
 * Применяется на следующем шаге (буфер pendingTurn). Вне фазы running — ничего не делает.
 */
export function turnInPlane(s: GameState, dir: ScreenDir): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'running') return buf

  const newHeading = screenDirToVec(dir, s.frame)
  if (isOpposite(newHeading, s.heading) || pointsIntoNeck(s, newHeading)) {
    return buf // разворот на 180° (и ход в собственную шею после разворота на месте) запрещён — игнорируем
  }

  s.pendingTurn = newHeading
  buf.push({ type: 'turned', heading: newHeading })
  return buf
}

/**
 * Смена оси: 'into' → -depth, 'out' → +depth (depth ДО доворота). Инвариант: frame
 * доворачивается СРАЗУ, в момент команды, и событие axisTurned эмитится ровно тогда, когда
 * доворот реально случился — камера (cameraFrame) и мир не расходятся. Новый heading
 * применится на СЛЕДУЮЩЕМ ТАКТЕ, который целиком уходит на разворот на месте (змейка не
 * двигается, не растёт, не ест, не умирает, stepCount не растёт; событие turnedInPlace);
 * ехать в новую сторону она начнёт только тактом после. Последующие turnInPlane выбирают направление уже в
 * довёрнутом frame и доворот не отменяют. Второй turnAxis до шага frame не крутит ещё раз,
 * а лишь заменяет буферизованный heading (into/out поменялись местами) и эмитит turned.
 * Вне фазы running — ничего не делает.
 */
export function turnAxis(s: GameState, dir: AxisDir): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'running') return buf
  if (s.mode === 'free') return buf // в 'free' четыре свайпа покрывают все направления, третья ось не нужна
  queueAxisTurn(s, dir, buf)
  return buf
}

function queueAxisTurn(s: GameState, dir: AxisDir, buf: GameEvent[]): void {
  const sign = dir === 'into' ? -1 : 1
  const h = s.heading

  if (s.rolledSinceStep) {
    // Frame уже довёрнут вокруг h. Прежний depth = -(h × depth'), в него и целимся.
    const d = s.frame.depth
    const ox = -(h.y * d.z - h.z * d.y)
    const oy = -(h.z * d.x - h.x * d.z)
    const oz = -(h.x * d.y - h.y * d.x)
    const newHeading: Vec3 = { x: signed(sign, ox), y: signed(sign, oy), z: signed(sign, oz) }
    s.pendingTurn = newHeading
    buf.push({ type: 'turned', heading: newHeading })
    return
  }

  const axis: Vec3 = { x: h.x, y: h.y, z: h.z }
  const newHeading: Vec3 = {
    x: signed(sign, s.frame.depth.x),
    y: signed(sign, s.frame.depth.y),
    z: signed(sign, s.frame.depth.z),
  }
  rotateFrame(s, axis)
  s.rolledSinceStep = true
  s.pendingTurn = newHeading
  buf.push({ type: 'axisTurned', rollAxis: axis, direction: dir })
}

/** Клетка перед головой со смещением (dx,dy,dz) свободна: не стена, не препятствие, не тело. */
function isFreeAhead(s: GameState, dx: number, dy: number, dz: number): boolean {
  const head = s.snake[0]!
  const nx = head.x + dx
  const ny = head.y + dy
  const nz = head.z + dz
  if (nx < 0 || ny < 0 || nz < 0 || nx >= s.size || ny >= s.size || nz >= s.size) return false
  const key = cellKey(nx, ny, nz, s.size)
  if (s.obstacles.has(key)) return false
  if (s.snakeCells.has(key)) {
    const tail = s.snake[s.snake.length - 1]!
    const isVacatingTail = s.growth === 0 && key === cellKey(tail.x, tail.y, tail.z, s.size)
    if (!isVacatingTail) return false
  }
  return true
}

/**
 * Демо-переход plane → free (отдельный такт, змейка стоит): направление случайное среди свободных (into/out). Если свободных
 * нет — ничего не делает, флаг demoTurnPending не тратится (повторная попытка на следующем шаге).
 * Голова сворачивает сразу (heading = ∓depth, frame подгоняется так, чтобы depth = -heading),
 * эмитятся modeChanged и demoTurn. Возвращает true, если сработал (tick останавливает цикл
 * шагов — паузу ставит main.ts).
 */
function tryDemoTurn(s: GameState, buf: GameEvent[]): boolean {
  const d = s.frame.depth
  const intoFree = isFreeAhead(s, -d.x, -d.y, -d.z)
  const outFree = isFreeAhead(s, d.x, d.y, d.z)
  if (!intoFree && !outFree) return false

  let sign: -1 | 1
  if (intoFree && outFree) sign = nextRandom(s) < 0.5 ? -1 : 1
  else sign = intoFree ? -1 : 1

  s.demoTurnPending = false
  s.pendingTurn = null // буфер плоскостного поворота относился к старому frame
  s.mode = 'free'
  enterFreeFrame(s, sign)
  buf.push({ type: 'turnedInPlace', heading: { x: s.heading.x, y: s.heading.y, z: s.heading.z } })
  buf.push(MODE_FREE)
  buf.push(DEMO_TURN)
  return true
}

/**
 * Один такт. Такт разворота на месте (ручная смена оси или демо-переход) только меняет
 * heading: без движения, роста, еды и проверки столкновений; stepCount не растёт. Иначе — шаг
 * по сетке: применение буферизованного поворота, движение, столкновения, еда.
 * Возвращает true, если сработал демо-переход (tick прерывает цикл — паузу ставит main.ts).
 */
function step(s: GameState, config: Config, buf: GameEvent[]): boolean {
  if (s.rolledSinceStep) {
    // frame уже довёрнут командой turnAxis — этот такт применяет новый heading, стоя на месте.
    if (s.pendingTurn) {
      s.heading.x = s.pendingTurn.x
      s.heading.y = s.pendingTurn.y
      s.heading.z = s.pendingTurn.z
      s.pendingTurn = null
    }
    s.rolledSinceStep = false
    buf.push({ type: 'turnedInPlace', heading: { x: s.heading.x, y: s.heading.y, z: s.heading.z } })
    return false
  }
  if (s.demoTurnPending && s.stepCount >= config.demo.afterSteps && tryDemoTurn(s, buf)) {
    return true // демо-переход — отдельный такт разворота: змейка не двигалась
  }

  if (s.pendingTurn) {
    if (s.mode === 'free') reorientFrameFree(s, s.pendingTurn)
    s.heading.x = s.pendingTurn.x
    s.heading.y = s.pendingTurn.y
    s.heading.z = s.pendingTurn.z
    s.pendingTurn = null
  }

  const head = s.snake[0]!
  const nx = head.x + s.heading.x
  const ny = head.y + s.heading.y
  const nz = head.z + s.heading.z

  if (nx < 0 || ny < 0 || nz < 0 || nx >= s.size || ny >= s.size || nz >= s.size) {
    s.phase = 'dead'
    buf.push({ type: 'died', cause: 'wall' })
    return false
  }

  const key = cellKey(nx, ny, nz, s.size)

  if (s.obstacles.has(key)) {
    s.phase = 'dead'
    buf.push({ type: 'died', cause: 'obstacle' })
    return false
  }

  const willGrow = s.growth > 0
  const tail = s.snake[s.snake.length - 1]!
  const tailKey = cellKey(tail.x, tail.y, tail.z, s.size)
  const movingIntoVacatingTail = key === tailKey && !willGrow

  if (s.snakeCells.has(key) && !movingIntoVacatingTail) {
    s.phase = 'dead'
    buf.push({ type: 'died', cause: 'body' })
    return false
  }

  if (willGrow) {
    // Рост — редкое событие (раз в яблоко), один новый Vec3 неизбежен: длина растёт.
    const newHead: Vec3 = { x: nx, y: ny, z: nz }
    s.snake.unshift(newHead)
    s.snakeCells.add(key)
    s.growth -= 1
  } else {
    // Обычный шаг: хвост переиспользуется как новая голова — без новых объектов.
    const reused = s.snake.pop()!
    s.snakeCells.delete(tailKey)
    reused.x = nx
    reused.y = ny
    reused.z = nz
    s.snake.unshift(reused)
    s.snakeCells.add(key)
  }

  s.stepCount += 1
  buf.push(MOVED)

  if (nx === s.apple.x && ny === s.apple.y && nz === s.apple.z) {
    s.growth += config.snake.growPerApple
    s.applesEaten += 1
    s.score += 1

    buf.push({ type: 'ate', apple: { x: nx, y: ny, z: nz }, score: s.score })

    const newStepMs = speedAfterApples(config, s.applesEaten)
    if (newStepMs !== s.stepMs) {
      s.stepMs = newStepMs
      buf.push({ type: 'speedUp', stepMs: newStepMs })
    }

    spawnApple(s)
    buf.push({ type: 'appleSpawned', apple: { x: s.apple.x, y: s.apple.y, z: s.apple.z } })
  }

  return false
}

/**
 * Копит sinceStepMs и делает шаги, пока хватает времени. Время приходит параметром (dtMs) —
 * ядро не знает о реальных часах. dt ограничен config.loop.maxFrameMs; NaN, отрицательный и
 * нулевой dt игнорируются; stepMs <= 0 не зацикливает. События пишутся в один и тот же
 * переиспользуемый массив.
 */
export function tick(s: GameState, config: Config, dtMs: number): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0

  if (s.phase !== 'running') return buf
  const dt = Math.min(dtMs, config.loop.maxFrameMs)
  if (!(dt > 0)) return buf // отрицательный, ноль, NaN
  if (!(effectiveStepMs(s) > 0)) return buf // защита от бесконечного цикла

  s.elapsedMs += dt
  s.sinceStepMs += dt

  // Потолок шагов за вызов: даже при испорченном sinceStepMs цикл конечен.
  // Запрошенное ускорение включится на границе шага внутри этого вызова: потолок — по ускоренному шагу.
  const ceilingMs = s.boostRequested && s.boostFactor > 1 ? s.stepMs / s.boostFactor : effectiveStepMs(s)
  const maxSteps = Math.ceil(config.loop.maxFrameMs / ceilingMs) + 1
  let steps = 0
  // Длительность шага берётся заново на каждой итерации: до границы она не меняется задним числом.
  while (steps < maxSteps && s.phase === 'running') {
    const stepMs = effectiveStepMs(s)
    if (!(stepMs > 0) || s.sinceStepMs < stepMs) break
    s.sinceStepMs -= stepMs
    steps++
    const paused = step(s, config, buf)
    s.boosting = s.boostRequested // граница шага: запрошенное ускорение становится действующим
    if (paused) break // демо-доворот: main ставит паузу, лишние шаги не делаем
  }
  const restMs = effectiveStepMs(s)
  if (restMs > 0 && s.sinceStepMs >= restMs) s.sinceStepMs = 0 // сброс остатка после потолка или паузы демо

  return buf
}
