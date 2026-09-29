# Контракт слоёв — games/snake

Три агента пишут слои параллельно. Сигнатуры ниже — закон, менять нельзя.
Проект: games/snake (пути от корня репозитория)
Правила репозитория: AGENTS.md (прочитать целиком)
Дизайн: games/snake/DESIGN.md (прочитать целиком)
Стек: bun 1.4.2, TypeScript strict, three@0.186.1 (API этой версии, не по памяти).

## Система координат и кадр камеры

Клетки — целые координаты 0..N-1 по x/y/z.

`Frame` — ортонормированный целочисленный базис экрана:
- `right` — вправо по экрану
- `up` — вверх по экрану
- `depth` — из экрана на зрителя (depth = right × up)

Камера стоит в центре куба + depth * дистанция, смотрит в центр, её up = frame.up.
`heading` змейки всегда лежит в плоскости экрана: это ±right или ±up.

### Поворот в плоскости
`heading` меняется на ±right или ±up. Frame не меняется. Разворот на 180° запрещён.

### Смена оси (третья ось)
Две команды: `'into'` (вглубь, от зрителя) и `'out'` (на себя).

1. Новый heading: `into` → `-depth`, `out` → `+depth`.
2. Frame доворачивается на **+90° вокруг вектора старого heading** (правило правой руки,
   ось — знаковый вектор heading, а не его абсолютная ось).

Формулы поворота вектора v на +90° вокруг единичного целочисленного axis:
`v' = axis × v` при v ⊥ axis. Для frame: right, up, depth поворачиваются этим правилом,
кроме того из них, который совпадает с ±axis — он остаётся на месте.

Проверка, которая обязана проходить в тестах: heading = +right, frame = (R,U,D).
После `into`: frame = (R, D, -U), heading = -D, то есть новый heading = -up' → на экране вниз.
После `out`: frame = (R, D, -U), heading = +D = +up' → на экране вверх.
Frame после обеих команд одинаковый, различается только heading.

## core/ — чистый TS

Запрещено импортировать three, view/, input/. Без аллокаций в горячем пути
(tick, проверки столкновений): переиспользовать объекты, мутировать на месте.
Рандом — только через seed в состоянии, ядро детерминировано. Время приходит снаружи.

### core/state.ts

```ts
export interface Vec3 { x: number; y: number; z: number }
export interface Frame { right: Vec3; up: Vec3; depth: Vec3 }
export type Phase = 'ready' | 'running' | 'dead'
export type ScreenDir = 'left' | 'right' | 'up' | 'down'
export type AxisDir = 'into' | 'out'
export type DeathCause = 'body' | 'wall' | 'obstacle'

export interface GameState {
  size: number
  snake: Vec3[]              // snake[0] — голова
  snakeCells: Set<number>    // ключи клеток змейки, ключ = cellKey()
  obstacles: Set<number>
  apple: Vec3
  heading: Vec3
  frame: Frame
  pendingTurn: Vec3 | null   // буфер ввода, применяется на следующем шаге
  pendingRoll: 0 | 1         // 1 — на следующем шаге frame довернуть
  pendingRollAxis: Vec3 | null
  growth: number             // сколько клеток ещё дорастить
  phase: Phase
  score: number
  applesEaten: number
  stepMs: number
  sinceStepMs: number
  elapsedMs: number
  demoTurnPending: boolean   // демо-доворот: один раз, после первого яблока
  rngState: number
}

export function cellKey(x: number, y: number, z: number, size: number): number
export function nextRandom(s: GameState): number   // mulberry32, мутирует rngState
```

### core/rules.ts

```ts
import type { GameState, Vec3 } from './state'
export interface Config { /* форма = config.json, типизировать полностью */ }

export function createGame(config: Config, size: number, seed: number, isFirstGameEver: boolean): GameState
export function generateObstacles(size: number, density: number, stickiness: number,
                                  clearCells: Set<number>, rng: () => number): Set<number>
export function spawnApple(s: GameState): Vec3
export function rotateFrame(s: GameState, axis: Vec3): void
export function speedAfterApples(config: Config, apples: number): number
```

`generateObstacles` — кубы и созвездия кубов (слипание задаётся stickiness 0..1).
**Жёсткое требование: никаких мёртвых зон.** После генерации — заливка (flood fill)
от стартовой клетки по 6 соседям; если достижимы не все свободные клетки,
недостижимые засыпаются препятствиями либо генерация повторяется. Тест обязателен.

### core/commands.ts

```ts
export type GameEvent =
  | { type: 'started' }
  | { type: 'moved' }
  | { type: 'turned'; heading: Vec3 }
  | { type: 'axisTurned'; rollAxis: Vec3; direction: AxisDir }
  | { type: 'ate'; apple: Vec3; score: number }
  | { type: 'appleSpawned'; apple: Vec3 }
  | { type: 'speedUp'; stepMs: number }
  | { type: 'demoTurn' }
  | { type: 'died'; cause: DeathCause }

export function startGame(s: GameState): GameEvent[]
export function turnInPlane(s: GameState, dir: ScreenDir): GameEvent[]
export function turnAxis(s: GameState, dir: AxisDir): GameEvent[]
export function tick(s: GameState, config: Config, dtMs: number): GameEvent[]
```

`tick` копит `sinceStepMs` и делает шаги, пока хватает времени. События возвращаются
в один и тот же переиспользуемый массив (без аллокаций в горячем пути).
Демо-доворот: если `demoTurnPending` и съедено первое яблоко — ядро само делает
`turnAxis(s, 'into')` и добавляет событие `demoTurn`.

### core/queries.ts — только чтение

```ts
export function head(s: GameState): Vec3
export function isAlive(s: GameState): boolean
export function snakeLength(s: GameState): number
export function cameraFrame(s: GameState): Frame
export function score(s: GameState): number
export function forEachObstacle(s: GameState, fn: (x: number, y: number, z: number) => void): void
```

## view/ — three.js, подписан на события

```ts
// view/index.ts
import type { GameState, GameEvent } from '../core/state'
export interface View {
  resize(width: number, height: number): void
  handle(event: GameEvent, s: GameState): void
  render(s: GameState, dtMs: number): void
  dispose(): void
}
export function createView(canvas: HTMLCanvasElement, config: Config, s: GameState): View
```

Читает состояние **только** через `core/queries`. Не вызывает команды.

Вид: неон. Тёмный фон, светящийся каркас куба, змейка градиентом от головы к хвосту,
яблоко пульсирует, препятствия — тусклый неон. Bloom через постпроцессинг.
Змейка, препятствия — `InstancedMesh` (100³ с плотными препятствиями = десятки тысяч кубов).
Никаких новых объектов и `await` в кадре: пулы, переиспользование, мутация на месте.

**Доворот камеры** на событии `axisTurned`: плавный поворот на 90° вокруг `rollAxis`
за `config.camera.rollMs`, перед ним микропауза `config.camera.microPauseMs`,
поверх — глитч `config.camera.glitchMs`. Числа только из config.

## input/ — тач и клавиатура

```ts
// input/index.ts
export type InputScheme = 'swipes' | 'taps'
export interface InputHandlers {
  onTurn(dir: ScreenDir): void
  onAxis(dir: AxisDir): void
}
export function attachInput(el: HTMLElement, scheme: InputScheme,
                            config: Config, h: InputHandlers): () => void  // возвращает detach
```

- `'swipes'` (по умолчанию): свайп — поворот в плоскости; одиночный тап в любом месте — `into`;
  двойной тап — `out`.
- `'taps'`: тап по зоне направления — поворот; тап в центральной зоне — `into`;
  двойной тап в центре — `out`. Размер центральной зоны — `config.input.centerZoneFraction`.
- Клавиатура (ПК, работает в обеих схемах): стрелки/WASD — плоскость, **Q** и **E** — третья ось.
- Тап-зоны ≥ 44 px. Никакого hover. Ввод не должен ломаться при смене ориентации.

## config.json — все числа баланса

```json
{
  "cube": { "sizes": [20, 50, 100], "default": 20 },
  "snake": { "startLength": 3, "growPerApple": 1 },
  "speed": { "startStepMs": 180, "minStepMs": 60, "stepMsPerApple": 4 },
  "obstacles": { "density": 0.02, "stickiness": 0.6, "clearRadius": 4 },
  "camera": { "rollMs": 260, "microPauseMs": 90, "glitchMs": 180, "distanceFactor": 1.6 },
  "demo": { "autoTurnAfterApples": 1 },
  "input": { "doubleTapMs": 240, "swipeMinPx": 24, "centerZoneFraction": 0.28 }
}
```

Магическое число в коде вместо config — ошибка ревью.

## Definition of Done (AGENTS.md, раздел 8)

- `bun test` проходит
- линтер слоёв чист
- нет аллокаций и `await` в кадре
- новые числа — в config.json
- сборка открывается по base path

---

# Дополнение к контракту — раунд починки после ревью

## Новые запросы в core/queries.ts (добавляет агент ядра, использует агент вида)

```ts
export function forEachSnakeSegment(s: GameState, fn: (x: number, y: number, z: number, index: number) => void): void
export function applePos(s: GameState): Readonly<Vec3>
export function cubeSize(s: GameState): number
export function elapsedMs(s: GameState): number
```

Правило 2 AGENTS.md: вид читает состояние ТОЛЬКО через queries. Прямое чтение
`s.snake`, `s.apple`, `s.size`, `s.elapsedMs` из вида — нарушение, убрать.

## Инвариант, который ревью нашло нарушенным

**Ядро никогда не сообщает о довороте, которого не выполнит.**
Ориентация камеры обязана в любой момент выводиться из `cameraFrame(s)`.
Сейчас `turnAxis` эмитит `axisTurned` сразу, а `turnInPlane` потом молча отменяет доворот —
камера уезжает, мир нет. Как чинить — на усмотрение агента ядра, но инвариант обязателен
и обязаны появиться тесты ровно на эти сценарии:

1. `turnAxis('into')`, затем `turnInPlane` до шага, затем шаг.
2. `turnAxis('into')`, затем `turnAxis('out')` до шага, затем шаг.
3. Два `turnInPlane` подряд до шага.
4. Смерть на том же шаге, на котором был запланирован доворот.

## Демо-поворот (новые правила из DESIGN.md)

- Срабатывает **на 5-м ходу** первой игры игрока. Число ходов — в config: `demo.afterSteps`.
- Направление — **случайное из свободных**: если клетка по `into` занята или за стенкой, берётся `out`;
  если обе заняты — демо не срабатывает и не тратится.
- Ядро эмитит `demoTurn`. **Паузу и экран с объяснением делает main.ts**, не ядро.

## Пауза

- `visibilitychange`: игра встаёт на паузу, ядро не тикает. Ядро не трогаем — пауза живёт в main.ts.
- Дополнительно потолок dt в кадре, число в config: `loop.maxFrameMs`.

## Кнопка после смерти

Перезапускает партию с теми же настройками, а не уводит в меню.

---

# Дополнение 2 — две фазы камеры (решение дизайнера после первой игры вживую)

Отзыв с игры: скорость бешеная (исправлено в config), змейку не видно (тёмная на тёмном),
и ожидалось третье лицо с камерой за головой.

Решение: **гибрид**. Игра стартует как плоская змейка, на 5-м ходу камера переезжает
за голову и открывается полное 3D. Переезд камеры и есть твист.

## Режим в состоянии

`GameState.mode: 'plane' | 'free'`. Старт партии — всегда `'plane'`. На демо-ходу
(`demo.afterSteps`) ядро переключает в `'free'` и эмитит событие. Обратно не возвращается.

### Фаза `'plane'` — как сейчас
- `heading` лежит в плоскости экрана (±right или ±up), `depth` на зрителя.
- `turnInPlane` — 4 направления в срезе, `turnAxis` — третья ось.
- Камера сбоку, смотрит в центр куба.

### Фаза `'free'` — новое
- `heading` направлен **от зрителя в глубину**: `depth = -heading`.
- `right` и `up` перпендикулярны heading и задают четыре возможных поворота.
- `turnInPlane(dir)` доворачивает голову: `left → -right`, `right → +right`,
  `up → +up`, `down → -up`. После поворота frame пересчитывается так, чтобы
  `depth` снова равнялся `-heading`, а `up` менялся минимально (без переворотов вверх ногами).
- `turnAxis` в этой фазе — **no-op, пустой массив событий**: свайпы уже дают все направления.
- Разворот на 180° по-прежнему запрещён (в этой фазе он и недостижим свайпом).

## События

```ts
| { type: 'modeChanged'; mode: 'plane' | 'free' }
```

Эмитится один раз, на демо-ходу, вместе с `demoTurn`.

## Вид

- В `'plane'` — камера как сейчас.
- В `'free'` — камера позади головы на `camera.followDistance` клеток вдоль `-heading`,
  приподнята на `camera.followHeight`, смотрит вперёд по ходу, up из frame.
  Плавно догоняет голову, не дёргается на каждом шаге.
- **Переезд между режимами** на `modeChanged`: анимированный полёт камеры за
  `camera.modeSwitchMs`, поверх — глитч. Это ключевой момент игры, он должен читаться.
- Новые числа: `camera.followDistance`, `camera.followHeight`, `camera.modeSwitchMs`.

## Читаемость (баг с первой игры)

Змейку **не видно**: тёмная на тёмном фоне. Обязательно:
- голова заметно ярче тела и отличается по форме или размеру — видно, куда смотрит змейка;
- тело контрастно к фону на всей длине, хвост не сливается;
- в фазе `'free'` ближние к камере сегменты не закрывают обзор.

## Ввод

- В `'free'` тапы по третьей оси не делают ничего. Подсказки и зоны схемы `taps`,
  относящиеся к третьей оси, в этой фазе не показываются.
- Клавиши Q и E в `'free'` тоже no-op.

---

# Дополнение 3 — такт разворота

Отзыв дизайнера: «змейку наверно при флипе не надо двигать — пусть смена направления
происходит до движения».

**Смена оси — отдельный такт.** Змейка сначала разворачивается на месте, и только
следующим тактом едет в новую сторону. Это касается и ручного `turnAxis` в фазе `plane`,
и демо-перехода. Обычных поворотов в плоскости (`turnInPlane`) не касается — они
по-прежнему совмещаются с шагом, как в классической змейке.

На такте разворота змейка не двигается, не растёт, не ест, столкновения не проверяются,
`stepCount` не растёт (это не ход). Такт тратит ровно один `stepMs`.

## Новое событие

```ts
| { type: 'turnedInPlace'; heading: Vec3 }
```

В демо приходит первым, перед `modeChanged` и `demoTurn`.

## Известное ограничение

Доворот `frame` остаётся в момент команды, а не в такт разворота — иначе `cameraFrame`
разошёлся бы с последующими свайпами. Поэтому камера начинает крутиться по `axisTurned`
(в момент тапа), а голова поворачивается на `turnedInPlace`, до одного `stepMs` позже.
Если это будет заметно, лечится на стороне вида, ядро менять не нужно.

## Побочная находка

После разворота на месте `heading` больше не совпадает с последним пройденным ходом,
и обычной проверки «разворот на 180°» перестало хватать: свайп назад попадал в шею и убивал.
Добавлена проверка `pointsIntoNeck` — такой свайп игнорируется.

---

# Дополнение 4 — ускорение и отступ препятствий от стен

**Ускорение.** `setBoost(s, on): GameEvent[]` (core/commands.ts). Пока действует ускорение, шаг длится
`stepMs / boostFactor` (`config.speed.boostFactor`, сейчас 2); разгон по яблокам работает поверх, событие
`speedUp` по-прежнему несёт базовый `stepMs`. **Нажатие и отпускание вступают в силу со следующего хода:**
текущий шаг доигрывается в том темпе, в котором начался (длительность задним числом не меняется).
Два поля `GameState`: `boostRequested` (запрошено, его меняет `setBoost`) и `boosting` (действует, от него
зависит `effectiveStepMs`). `tick` копирует `boosting = boostRequested` сразу после каждого такта (шаг, такт
разворота на месте, демо-такт) — это и есть граница шага; длительность шага берётся заново на каждой итерации
цикла, так что внутри одного длинного кадра первый шаг идёт по старому темпу, остальные — по новому.
Событие `{ type: 'boostChanged'; on }` эмитится сразу и только при реальной смене **запроса** (`tick` его не
эмитит); вне фазы `running` `setBoost` ничего не делает. `boostFactor` — копия config на партию (`setBoost` config
не получает). Новая партия: `boostRequested = false`, `boosting = false`. Ускоряется всё, что считается тактом,
включая такт разворота на месте. `elapsedMs` — реальное время; потолок шагов за кадр считается по ускоренному
шагу, если ускорение запрошено. Запросы: `isBoosting(s)` — **запрошенное** (подсветка кнопки без задержки, в
такт с `boostChanged`); `isBoostActive(s)` — **действующее** (идёт ли текущий шаг в ускоренном темпе, для
эффектов темпа); `stepProgress(s)` = `sinceStepMs` / длительность идущего шага (по `boosting`), поэтому при
нажатии/отпускании посреди шага не прыгает — интерполяция головы во view гладкая; на границе шага прогресс
естественно обнуляется. Ввод: держит кнопку → `setBoost(true)`, отпускает → `setBoost(false)`.

**Отступ от стен.** `config.obstacles.wallMargin` (сейчас 1): клетки, отстоящие от любой стенки куба меньше чем на
это число, препятствиями быть не могут (при 1 — внешний слой). `generateObstacles` принимает его необязательным
шестым аргументом (по умолчанию 0). Заливка мёртвых зон работает как раньше и покрыта тестами на плотных вариантах.


## Вид сразу по вводу (queries)

Поворот, введённый игроком, виден на экране ДО такта: тело стоит, но голова, камера и подсказки уже смотрят в новую сторону.
- `intendedHeading(s): Readonly<Vec3>` — `pendingTurn ?? heading`. Из него берёт направление голова (`SnakeView.direction`).
- `viewFrame(s): Frame` — `cameraFrame` с уже применённым буферным поворотом (только в `'free'`: доворот на +90° вокруг
  `heading × pendingTurn`, как сделает такт). Общий переиспользуемый объект, не хранить и не менять. Камера, луч и подсказки
  читают кадр отсюда. Правила ядра по-прежнему работают с `s.frame`/`s.heading`; на такте кадр ядра равен тому, что показывал `viewFrame`.
