// Мини-карта в углу: второй проход рендера ортографической камерой в scissor-область
// канваса (не DOM). Приглушённая подсказка боковым зрением.
//
// Только в фазе free, в plane скрыта: там игра «обычная змейка».
//
// Две части рядом (решение дизайнера):
//  1. КАРТА «сверху» (подпись XZ): квадрат windowCells x windowCells клеток (config.minimap),
//     X по горизонтали, Z по вертикали, срез на высоте головы (Y). ЖЁСТКО привязана к осям мира:
//     при поворотах змейки не переориентируется. Окно скроллится вслед за головой и упирается
//     в границы арены (см. map-window.ts): у стены окно стоит и метка ходит внутри, в середине
//     большой арены метка в центре, а «мир» проезжает под ней. Арена не больше окна — окно равно арене.
//  2. УРОВНЕМЕР (подпись Y): узкая вертикальная полоса, одна линия. Верх полосы — верх мира,
//     низ — низ, независимо от камеры. Показывает не всю высоту арены, а ОКНО ±levelWindowCells/2 клеток
//     вокруг головы (config.minimap, та же арифметика, что у карты: map-window.ts): один шаг всегда
//     двигает картинку на целую клетку полосы при любом размере арены (на 100³ вся высота дала бы
//     ~1.5 px за шаг). Метка головы (жёлтая черта) в центре окна, мимо неё едут деления (привязаны к
//     миру: мелкие каждую клетку, крупные каждые TICK_MAJOR_EVERY); у стены окно упирается и метка ходит
//     внутри. Пол и потолок арены — яркие линии, но только когда попали в окно. Яблоко — розовый ромб
//     в окне, а вне окна — стрелка вверх/вниз у края. По правому краю полосы тонкий жёлоб во всю
//     высоту арены с двумя точками (я и яблоко): страховка «где я во всей арене». Препятствия и тело
//     на полосу не выносятся.
//
// Рамка карты — край ОКНА, а не стена. Настоящая стена арены рисуется яркой сплошной
// линией по той стороне окна, где оно упёрлось в границу; тихая тонкая рамка — просто
// край обзора, мир за ним продолжается. У полосы пол и потолок — настоящие стены, яркие всегда.
//
// Что рисуется на карте: препятствия — тихие квадратики СТРОГО своего среза (только клетки на
// уровне головы), тело змейки — тем же правилом зелёно-голубым градиентом как в игре,
// голова — самая заметная метка: остриё по ходу в осях карты, а если змейка идёт
// перпендикулярно карте (вдоль оси Y) — вложенные шевроны «из экрана» (вверх: расходятся от центра,
// карта — вид сверху, вверх = к глазу) или «в экран» (вниз: сходятся к центру) с пульсом на каждом такте.
// Яблоко видно всегда:
//  - ромб — яблоко прямо здесь, на уровне головы (в срезе);
//  - пустой ромб-контур с ножкой вверх/вниз — яблоко в окне, но на другом уровне (проекция);
//    длина ножки пропорциональна разнице высот и упирается в максимум/край окна;
//  - треугольник-стрелка у края окна — яблоко вне окна, стрелка указывает, куда идти.
// Наборы клеток пересобираются раз в шаг (смена головы/длины/размера), а не каждый кадр;
// метки полосы двигаются позицией. Состояние читается через core/queries. В кадре объектов не создаётся.

import {
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  type WebGLRenderer,
} from 'three'
import type { GameState } from '../core/state'
import { applePos, viewFrame, cubeSize, forEachObstacle, forEachSnakeSegment, head, snakeLength } from '../core/queries'
import { clampToWindow, isInWindow, isMajorTick, levelFraction, touchesHighWall, touchesLowWall, windowFraction, windowLength, windowStart } from './map-window'
import {
  APPLE_COLOR,
  MINIMAP_APPLE_ALPHA,
  MINIMAP_APPLE_RING_ALPHA,
  MINIMAP_BG_ALPHA,
  MINIMAP_BG_COLOR,
  MINIMAP_BODY_ALPHA,
  MINIMAP_BORDER_ALPHA,
  MINIMAP_BORDER_COLOR,
  MINIMAP_HEAD_ALPHA,
  MINIMAP_LABEL_ALPHA,
  MINIMAP_LEVEL_TICK_ALPHA,
  MINIMAP_LEVEL_TICK_MAJOR_ALPHA,
  MINIMAP_LEVEL_TRACK_ALPHA,
  MINIMAP_TROUGH_ALPHA,
  MINIMAP_OBSTACLE_ALPHA,
  MINIMAP_OBSTACLE_COLOR,
  MINIMAP_WALL_ALPHA,
  MINIMAP_WALL_COLOR,
  SNAKE_BODY_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_TAIL_COLOR,
} from './palette'

// Оформительские константы, не числа баланса. Экранные размеры — в CSS-пикселях.
// Карта + уровнемер вместе: доля ширины экрана, границы и потолок по высоте (верх экрана, портрет:
// нижняя половина занята управлением).
const WIDTH_FRACTION = 0.52
const WIDTH_MIN_PX = 170
const WIDTH_MAX_PX = 380
const HEIGHT_MAX_FRACTION = 0.26
// Верхний левый угол: низ экрана занят тап-зонами, верх по центру — счёт, справа — пауза.
// Отступ сверху с запасом под вырез/статус-бар (канвас не знает safe-area).
const MARGIN_LEFT_PX = 12
const MARGIN_TOP_PX = 48
// Геометрия в клетках карты. Размер клетки на экране выходит из ширины панели.
const GAP = 1.8 // промежуток между картой и полосой
const STRIP_W = 3.2 // ширина полосы-уровнемера
const LEVEL_MARK_H = 0.9 // толщина черты головы на полосе (не зависит от высоты арены)
const TROUGH_ZONE = 0.9 // ширина правой зоны полосы под жёлоб
const TROUGH_W = 0.35 // толщина жёлоба (~2.5 px при типичной панели)
const TROUGH_DOT = 0.9 // диаметр точек «я» и «яблоко» в жёлобе
const TICK_H = 0.16 // толщина деления окна полосы
const TICK_MINOR_W = 0.8 // длина мелкого деления (от левого края полосы)
const TICK_MAJOR_W = 1.6 // длина крупного деления
const TICK_MAJOR_EVERY = 5 // крупное деление каждые столько клеток мира
const LEVEL_ARROW = 1.6 // размер стрелки яблока вне окна полосы
const LEVEL_ARROW_INSET = 1.0 // отступ этой стрелки от края полосы
const LEVEL_APPLE_R = 1.35 // «радиус» ромба яблока на полосе
const WALL_THICK = 0.7 // толщина линии настоящей стены (вне окна, в рамке)
const EDGE_PAD = 0.4 // запас за стеной до края камеры
const MARKER = 1.8 // размер метки головы
const APPLE_R = 1.35 // «радиус» ромба яблока
const RING_INNER = 0.55 // внутренний радиус контура ромба (доля внешнего)
const ARROW = 2.2 // размер стрелки яблока вне окна
// Шевроны головы при ходе вдоль Y: четыре стороны x два вложенных слоя.
const CHEV_ARM = 0.5 // вынос «плеча» галочки
const CHEV_THICK = 0.3 // толщина штриха
const CHEV_R0 = 0.55 // радиус внутреннего слоя
const CHEV_GAP = 0.8 // шаг между слоями
const CHEV_SCALE = 1.4 // общий масштаб шевронов (метка головы должна быть не мельче остриё-треугольника)
const PULSE_MS = 200 // пульс шеврона на каждом такте
const PULSE_GAIN = 0.5 // прибавка масштаба в начале пульса
// Ножка яблока (яблоко в окне, но на другом уровне): единицы карты.
const LEG_PER_CELL = 0.5 // длина ножки на клетку разницы высот
const LEG_MAX = 5 // упор: дальше не растёт
const LEG_THICK = 0.3
const LEG_CAP_W = 1.0 // поперечина на конце ножки
const LEG_EDGE_PAD = 0.2 // запас до края окна
const OBSTACLE_CELL = 0.9 // размер квадратика препятствия/тела в клетках
const LABEL_H = 1.8 // высота буквы подписи оси
const LABEL_W = 1.2
const LABEL_GAP = 0.5
// Ниже этого веса фазы free карта не рисуется вовсе.
const MIN_AMOUNT = 0.02
// Полосы для стен: 4 стороны карты + пол и потолок полосы.
const WALL_BARS = 6

/** Шевроны головы: 4 стороны x 2 вложенных слоя; outward — вершины смотрят от центра (из экрана), иначе к центру (в экран). Холодный путь. */
function chevronGeometry(outward: boolean): BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const seg = (ax: number, ay: number, bx: number, by: number): void => {
    const dx = bx - ax
    const dy = by - ay
    const l = Math.hypot(dx, dy)
    const nx = (-dy / l) * (CHEV_THICK / 2)
    const ny = (dx / l) * (CHEV_THICK / 2)
    const i = pos.length / 3
    pos.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0)
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  for (let side = 0; side < 4; side++) {
    const ang = (side * Math.PI) / 2
    const ux = Math.cos(ang)
    const uy = Math.sin(ang)
    const vx = -uy
    const vy = ux
    for (let layer = 0; layer < 2; layer++) {
      const r = CHEV_R0 + layer * CHEV_GAP
      // Вершина ближе к центру (в экран) или дальше (из экрана); плечи на другой глубине.
      const tipR = outward ? r + CHEV_ARM : r
      const armR = outward ? r : r + CHEV_ARM
      const tx = ux * tipR
      const ty = uy * tipR
      seg(tx, ty, ux * armR + vx * CHEV_ARM, uy * armR + vy * CHEV_ARM)
      seg(tx, ty, ux * armR - vx * CHEV_ARM, uy * armR - vy * CHEV_ARM)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

interface Layer {
  material: MeshBasicMaterial | LineBasicMaterial
  base: number
}

export class MiniMap {
  private scene = new Scene()
  private camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1)
  private layers: Layer[] = []
  private geometries: BufferGeometry[] = []
  private disposables: { dispose(): void }[] = []

  private bgTop: Mesh
  private bgStrip: Mesh
  private borderTop: LineLoop
  private borderStrip: LineLoop
  private stripTrack: Mesh
  private levelHead: Mesh
  private levelApple: Mesh
  private levelArrow: Mesh
  private troughLine: Mesh
  private troughHead: Mesh
  private troughApple: Mesh
  private tickMinor: InstancedMesh
  private tickMajor: InstancedMesh
  private walls: InstancedMesh
  private labels: LineSegments
  private obstacles: InstancedMesh
  private body: InstancedMesh
  private obstacleCount = 0
  private bodyCount = 0
  private bodyDenom = 1
  private bodyLen = -1
  private obstacleKey = -1
  private obstaclesDirty = true
  private tmpMatrix = new Matrix4()
  private tmpColor = new Color()

  // Метки карты «сверху».
  private headTri: Mesh
  private headDot: Mesh
  private appleHere: Mesh
  private appleRing: Mesh
  private appleArrow: Mesh
  private appleLeg: Mesh
  private appleLegCap: Mesh
  private headChevIn: Mesh
  private headChevOut: Mesh
  private pulseT0 = -1e9

  // Раскладка (холодный путь, setSize).
  private windowCells: number
  private levelWindowCells: number
  private levelLen = 1 // высота окна полосы в клетках мира
  private cellH = 1 // высота клетки на полосе, единиц карты
  private size = -1
  private len = 1 // сторона окна в клетках
  private stripX0 = 0 // левый край полосы по X
  private mainX = 0 // центр основной части полосы (метки окна)
  private troughX = 0 // центр жёлоба
  // Окно текущего шага (начала по осям мира).
  private sx = 0
  private sz = 0
  private hy = 0
  private sy = 0 // начало окна полосы по Y

  private screenW = 1
  private screenH = 1
  private panelW = 0
  private panelH = 0

  constructor(windowCells: number, levelWindowCells: number) {
    this.windowCells = Math.max(1, Math.floor(windowCells))
    this.levelWindowCells = Math.max(2, Math.floor(levelWindowCells))
    const cap = this.windowCells * this.windowCells // срез карты не больше окна
    const quad = new PlaneGeometry(1, 1)
    const tri = new BufferGeometry()
    tri.setAttribute('position', new Float32BufferAttribute([0, 0.6, 0, -0.45, -0.4, 0, 0.45, -0.4, 0], 3))
    const outline = new BufferGeometry()
    outline.setAttribute('position', new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    const diamond = new CircleGeometry(1, 4)
    const ring = new RingGeometry(RING_INNER, 1, 4, 1)
    const dot = new CircleGeometry(0.5, 12)
    const chevIn = chevronGeometry(false)
    const chevOut = chevronGeometry(true)
    this.geometries.push(quad, tri, outline, diamond, ring, dot, chevIn, chevOut)

    this.bgTop = this.mesh(quad, MINIMAP_BG_COLOR, MINIMAP_BG_ALPHA, 0)
    this.bgStrip = this.mesh(quad, MINIMAP_BG_COLOR, MINIMAP_BG_ALPHA, 0)
    this.borderTop = this.loop(outline, MINIMAP_BORDER_COLOR, MINIMAP_BORDER_ALPHA, 1)
    this.borderStrip = this.loop(outline, MINIMAP_BORDER_COLOR, MINIMAP_BORDER_ALPHA, 1)
    this.stripTrack = this.mesh(quad, MINIMAP_BORDER_COLOR, MINIMAP_LEVEL_TRACK_ALPHA, 1)

    this.walls = this.instanced(quad, MINIMAP_WALL_COLOR, MINIMAP_WALL_ALPHA, WALL_BARS, 5)
    this.obstacles = this.instanced(quad, MINIMAP_OBSTACLE_COLOR, MINIMAP_OBSTACLE_ALPHA, cap, 1)
    // Цвет инстансов препятствий — белый (цвет даёт материал); заполняем заранее, один раз.
    for (let i = 0; i < cap; i++) this.obstacles.setColorAt(i, this.tmpColor.setRGB(1, 1, 1))
    this.body = this.instanced(quad, new Color(1, 1, 1), MINIMAP_BODY_ALPHA, cap, 2)
    this.body.setColorAt(0, this.tmpColor.setRGB(1, 1, 1))

    this.appleRing = this.mesh(ring, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 3)
    this.appleHere = this.mesh(diamond, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 3)
    this.appleArrow = this.mesh(tri, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 4)
    this.headDot = this.mesh(dot, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 5)
    this.headTri = this.mesh(tri, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 6)
    this.headChevIn = this.mesh(chevIn, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 6)
    this.headChevOut = this.mesh(chevOut, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 6)
    this.appleLeg = this.mesh(quad, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 3)
    this.appleLegCap = this.mesh(quad, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 3)
    // Метки уровнемера: черта головы и ромб яблока (яблоко выше по порядку, чтобы не пропало под чертой).
    this.levelHead = this.mesh(quad, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 5)
    this.levelApple = this.mesh(diamond, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 6)
    this.levelArrow = this.mesh(tri, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 6)
    // Жёлоб во всю высоту арены и точки в нём; деления окна.
    this.troughLine = this.mesh(quad, MINIMAP_BORDER_COLOR, MINIMAP_TROUGH_ALPHA, 2)
    this.troughHead = this.mesh(dot, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 5)
    this.troughApple = this.mesh(dot, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 6)
    this.tickMinor = this.instanced(quad, MINIMAP_BORDER_COLOR, MINIMAP_LEVEL_TICK_ALPHA, this.levelWindowCells + 1, 2)
    this.tickMajor = this.instanced(quad, MINIMAP_BORDER_COLOR, MINIMAP_LEVEL_TICK_MAJOR_ALPHA, this.levelWindowCells + 1, 2)
    const lm = new LineBasicMaterial({ color: MINIMAP_BORDER_COLOR, transparent: true, opacity: MINIMAP_LABEL_ALPHA, depthTest: false, depthWrite: false })
    this.disposables.push(lm)
    this.layers.push({ material: lm, base: MINIMAP_LABEL_ALPHA })
    this.labels = new LineSegments(new BufferGeometry(), lm)
    this.labels.renderOrder = 1
    this.labels.frustumCulled = false
    this.scene.add(this.labels)
  }

  private mesh(g: BufferGeometry, color: Color, alpha: number, order: number): Mesh {
    const m = new MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false, depthWrite: false })
    this.disposables.push(m)
    this.layers.push({ material: m, base: alpha })
    const mesh = new Mesh(g, m)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return mesh
  }

  private instanced(g: BufferGeometry, color: Color, alpha: number, capacity: number, order: number): InstancedMesh {
    const m = new MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false, depthWrite: false })
    this.disposables.push(m)
    this.layers.push({ material: m, base: alpha })
    const im = new InstancedMesh(g, m, capacity)
    im.count = 0
    im.renderOrder = order
    im.frustumCulled = false
    this.scene.add(im)
    return im
  }

  private loop(g: BufferGeometry, color: Color, alpha: number, order: number): LineLoop {
    const m = new LineBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false, depthWrite: false })
    this.disposables.push(m)
    this.layers.push({ material: m, base: alpha })
    const l = new LineLoop(g, m)
    l.renderOrder = order
    l.frustumCulled = false
    this.scene.add(l)
    return l
  }

  /** Холодный путь: партия началась (набор препятствий мог смениться). */
  invalidate(): void {
    this.obstaclesDirty = true
  }

  // Клетка среза -> позиция в клетках камеры карты: (x, z) при y == hy. Колбэки созданы один раз.
  private putCell(im: InstancedMesh, i: number, px: number, py: number): void {
    this.tmpMatrix.makeScale(OBSTACLE_CELL, OBSTACLE_CELL, 1).setPosition(px, py, 0)
    im.setMatrixAt(i, this.tmpMatrix)
  }

  private readonly writeObstacle = (x: number, y: number, z: number): void => {
    if (y !== this.hy) return
    const len = this.len
    const dx = x - this.sx
    const dz = z - this.sz
    if (dx < 0 || dx >= len || dz < 0 || dz >= len) return
    if (this.obstacleCount < this.obstacles.instanceMatrix.count) {
      this.putCell(this.obstacles, this.obstacleCount++, dx + 0.5, dz + 0.5)
    }
  }

  // Сегмент тела (кроме головы): то же правило среза, что у препятствий.
  private readonly writeBody = (x: number, y: number, z: number, i: number): void => {
    if (i === 0 || y !== this.hy) return
    const len = this.len
    const dx = x - this.sx
    const dz = z - this.sz
    if (dx < 0 || dx >= len || dz < 0 || dz >= len) return
    if (this.bodyCount < this.body.instanceMatrix.count) {
      this.tmpColor.copy(SNAKE_BODY_COLOR).lerp(SNAKE_TAIL_COLOR, i / this.bodyDenom)
      this.body.setColorAt(this.bodyCount, this.tmpColor)
      this.putCell(this.body, this.bodyCount++, dx + 0.5, dz + 0.5)
    }
  }

  /** Полоса настоящей стены: центр и размеры в клетках камеры. */
  private putWall(i: number, cx: number, cy: number, w: number, h: number): number {
    this.tmpMatrix.makeScale(w, h, 1).setPosition(cx, cy, 0)
    this.walls.setMatrixAt(i, this.tmpMatrix)
    return i + 1
  }

  /** Стены карты: полоса только там, где окно упёрлось в границу арены. */
  private putMapWalls(n: number, sH: number, sV: number): number {
    const len = this.len
    const t = WALL_THICK
    if (touchesLowWall(sH)) n = this.putWall(n, -t / 2, len / 2, t, len + 2 * t)
    if (touchesHighWall(sH, len, this.size)) n = this.putWall(n, len + t / 2, len / 2, t, len + 2 * t)
    if (touchesLowWall(sV)) n = this.putWall(n, len / 2, -t / 2, len + 2 * t, t)
    if (touchesHighWall(sV, len, this.size)) n = this.putWall(n, len / 2, len + t / 2, len + 2 * t, t)
    return n
  }

  /** Пересборка слоёв под окно вокруг головы; раз в шаг, не каждый кадр. */
  private refresh(s: GameState, hx: number, hy: number, hz: number): void {
    const size = cubeSize(s)
    this.len = windowLength(size, this.windowCells)
    this.hy = hy
    this.sx = windowStart(hx, size, this.windowCells)
    this.sz = windowStart(hz, size, this.windowCells)
    this.levelLen = windowLength(size, this.levelWindowCells)
    this.sy = windowStart(hy, size, this.levelWindowCells)

    this.obstacleCount = 0
    forEachObstacle(s, this.writeObstacle)
    this.obstacles.count = this.obstacleCount
    this.obstacles.instanceMatrix.needsUpdate = true

    this.bodyCount = 0
    this.bodyLen = snakeLength(s)
    this.bodyDenom = Math.max(1, this.bodyLen - 1)
    forEachSnakeSegment(s, this.writeBody)
    this.body.count = this.bodyCount
    this.body.instanceMatrix.needsUpdate = true
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true

    let n = this.putMapWalls(0, this.sx, this.sz)
    // Пол и потолок уровнемера: настоящие стены, только когда попали в окно полосы.
    const t = WALL_THICK
    const cx = this.stripX0 + STRIP_W / 2
    if (touchesLowWall(this.sy)) n = this.putWall(n, cx, -t / 2, STRIP_W + 2 * t, t)
    if (touchesHighWall(this.sy, this.levelLen, size)) n = this.putWall(n, cx, this.len + t / 2, STRIP_W + 2 * t, t)
    this.walls.count = n
    this.walls.instanceMatrix.needsUpdate = true
    this.putTicks(size)
  }

  /** Деления окна полосы: границы клеток мира внутри окна (стены и края окна рисуют рамка/стены). */
  private putTicks(size: number): void {
    let nm = 0
    let nM = 0
    const ch = this.cellH
    for (let b = this.sy + 1; b < this.sy + this.levelLen; b++) {
      if (b <= 0 || b >= size) continue
      const y = (b - this.sy) * ch
      if (isMajorTick(b, TICK_MAJOR_EVERY)) {
        this.tmpMatrix.makeScale(TICK_MAJOR_W, TICK_H, 1).setPosition(this.stripX0 + TICK_MAJOR_W / 2, y, 0)
        this.tickMajor.setMatrixAt(nM++, this.tmpMatrix)
      } else {
        this.tmpMatrix.makeScale(TICK_MINOR_W, TICK_H, 1).setPosition(this.stripX0 + TICK_MINOR_W / 2, y, 0)
        this.tickMinor.setMatrixAt(nm++, this.tmpMatrix)
      }
    }
    this.tickMinor.count = nm
    this.tickMajor.count = nM
    this.tickMinor.instanceMatrix.needsUpdate = true
    this.tickMajor.instanceMatrix.needsUpdate = true
  }

  /** Метки яблока на карте: здесь / в окне другим уровнем / вне окна. */
  private placeApple(va: number, vb: number, sa: number, sb: number, inSlice: boolean, dy: number): void {
    const len = this.len
    const here = this.appleHere
    const ring = this.appleRing
    const arrow = this.appleArrow
    const inside = isInWindow(va, sa, len) && isInWindow(vb, sb, len)
    const px = clampToWindow(va, sa, len) + 0.5
    const py = clampToWindow(vb, sb, len) + 0.5
    here.visible = inside && inSlice
    ring.visible = inside && !inSlice
    arrow.visible = !inside
    // Ножка: только у контура (яблоко в окне, но на другом уровне). Вверх — яблоко выше.
    const leg = this.appleLeg
    const cap = this.appleLegCap
    let legLen = 0
    let dir = 1
    if (inside && !inSlice) {
      dir = dy > 0 ? 1 : -1
      const y0 = py + dir * APPLE_R
      const room = (dir > 0 ? len - y0 : y0) - LEG_EDGE_PAD
      legLen = Math.min(Math.abs(dy) * LEG_PER_CELL, LEG_MAX, room)
      if (legLen > 0) {
        leg.position.set(px, y0 + (dir * legLen) / 2, 0)
        leg.scale.set(LEG_THICK, legLen, 1)
        cap.position.set(px, y0 + dir * legLen, 0)
        cap.scale.set(LEG_CAP_W, LEG_THICK, 1)
      }
    }
    leg.visible = legLen > 0
    cap.visible = legLen > 0
    if (inside) {
      const target = inSlice ? here : ring
      target.position.set(px, py, 0)
    } else {
      arrow.position.set(px, py, 0)
      // Стрелка смотрит от центра окна к яблоку (направление «куда идти»).
      const c = (len - 1) / 2
      arrow.rotation.z = Math.atan2(-(va - sa - c), vb - sb - c)
    }
  }

  /**
   * Метка головы: остриё по ходу в осях карты; идём вдоль нормали среза (ось Y) — вложенные шевроны:
   * вверх (к глазу над картой) расходятся от центра «из экрана», вниз сходятся «в экран». Пульс — на такте.
   */
  private placeHead(px: number, py: number, hmx: number, hmy: number, vy: number): void {
    const tri = this.headTri
    const dot = this.headDot
    const cin = this.headChevIn
    const cout = this.headChevOut
    const moving = hmx !== 0 || hmy !== 0
    tri.visible = moving
    cout.visible = !moving && vy > 0
    cin.visible = !moving && vy < 0
    dot.visible = !moving && vy === 0
    tri.position.set(px, py, 0)
    dot.position.set(px, py, 0)
    cin.position.set(px, py, 0)
    cout.position.set(px, py, 0)
    if (moving) tri.rotation.z = Math.atan2(-hmx, hmy)
    const k = 1 - (performance.now() - this.pulseT0) / PULSE_MS
    const sc = CHEV_SCALE * (k > 0 ? 1 + PULSE_GAIN * k * k : 1)
    cin.scale.set(sc, sc, 1)
    cout.scale.set(sc, sc, 1)
  }

  /** Холодный путь: размер куба сменился — раскладка карт в клетках. */
  setSize(size: number): void {
    if (size === this.size) return
    this.size = size
    const len = windowLength(size, this.windowCells)
    this.len = len
    this.stripX0 = len + GAP
    this.levelLen = windowLength(size, this.levelWindowCells)
    this.cellH = len / this.levelLen
    const t = WALL_THICK
    const labelY = len + t + 0.5
    this.camera.left = -t - EDGE_PAD
    this.camera.right = this.stripX0 + STRIP_W + t + EDGE_PAD
    this.camera.bottom = -t - EDGE_PAD
    this.camera.top = labelY + LABEL_H + EDGE_PAD
    this.camera.updateProjectionMatrix()

    const cx = this.stripX0 + STRIP_W / 2
    const mainW = STRIP_W - TROUGH_ZONE
    const mx = this.stripX0 + mainW / 2 // центр основной части полосы
    const tx = this.stripX0 + STRIP_W - TROUGH_ZONE / 2 // центр жёлоба
    this.bgTop.position.set(len / 2, len / 2, 0)
    this.bgTop.scale.set(len + 2 * t, len + 2 * t, 1)
    this.bgStrip.position.set(cx, len / 2, 0)
    this.bgStrip.scale.set(STRIP_W + 2 * t, len + 2 * t, 1)
    this.borderTop.position.set(len / 2, len / 2, 0)
    this.borderTop.scale.set(len, len, 1)
    this.borderStrip.position.set(cx, len / 2, 0)
    this.borderStrip.scale.set(STRIP_W, len, 1)
    // Осевая линия полосы: «1 линия — уровень».
    this.stripTrack.position.set(mx, len / 2, 0)
    this.stripTrack.scale.set(LEVEL_MARK_H * 0.25, len, 1)
    this.levelHead.scale.set(mainW, LEVEL_MARK_H, 1)
    this.levelApple.scale.set(LEVEL_APPLE_R, LEVEL_APPLE_R, 1)
    this.levelArrow.scale.set(LEVEL_ARROW, LEVEL_ARROW, 1)
    this.troughLine.position.set(tx, len / 2, 0)
    this.troughLine.scale.set(TROUGH_W, len, 1)
    this.troughHead.scale.set(TROUGH_DOT, TROUGH_DOT, 1)
    this.troughApple.scale.set(TROUGH_DOT, TROUGH_DOT, 1)
    this.mainX = mx
    this.troughX = tx

    this.headTri.scale.set(MARKER, MARKER, 1)
    this.headDot.scale.set(MARKER * 0.8, MARKER * 0.8, 1)
    this.appleHere.scale.set(APPLE_R, APPLE_R, 1)
    this.appleRing.scale.set(APPLE_R, APPLE_R, 1)
    this.appleArrow.scale.set(ARROW, ARROW, 1)
    this.buildLabels(labelY)
    this.obstacleKey = -1
    this.layout()
  }

  // Подписи: «XZ» над картой, «Y» над полосой, отрезками. Холодный путь.
  private labelSegs: number[] = []
  private buildLabels(y0: number): void {
    this.labelSegs.length = 0
    this.pushLetter('X', 0, y0)
    this.pushLetter('Z', LABEL_W + LABEL_GAP, y0)
    this.pushLetter('Y', this.stripX0 + (STRIP_W - LABEL_W) / 2, y0)
    this.labels.geometry.dispose()
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.labelSegs, 3))
    this.labels.geometry = g
  }

  private pushLetter(ch: string, x0: number, y0: number): void {
    const w = LABEL_W
    const h = LABEL_H
    const seg = (ax: number, ay: number, bx: number, by: number): void => {
      this.labelSegs.push(x0 + ax * w, y0 + ay * h, 0, x0 + bx * w, y0 + by * h, 0)
    }
    if (ch === 'X') {
      seg(0, 0, 1, 1)
      seg(0, 1, 1, 0)
    } else if (ch === 'Z') {
      seg(0, 1, 1, 1)
      seg(1, 1, 0, 0)
      seg(0, 0, 1, 0)
    } else {
      seg(0, 1, 0.5, 0.5)
      seg(1, 1, 0.5, 0.5)
      seg(0.5, 0.5, 0.5, 0)
    }
  }

  resize(width: number, height: number): void {
    this.screenW = width
    this.screenH = height
    this.layout()
  }

  private layout(): void {
    if (this.size < 0) return
    const contentW = this.camera.right - this.camera.left
    const contentH = this.camera.top - this.camera.bottom
    let w = Math.min(WIDTH_MAX_PX, Math.max(WIDTH_MIN_PX, this.screenW * WIDTH_FRACTION))
    const maxH = this.screenH * HEIGHT_MAX_FRACTION
    if ((w * contentH) / contentW > maxH) w = (maxH * contentW) / contentH
    this.panelW = w
    this.panelH = (w * contentH) / contentW
  }

  /** Кадр, без аллокаций: рисует карты поверх уже готового кадра на экране. */
  render(renderer: WebGLRenderer, s: GameState, freeAmount: number): void {
    if (freeAmount < MIN_AMOUNT || this.size < 0) return
    const size = cubeSize(s)
    const hd = head(s)
    const ap = applePos(s)
    // viewFrame: стрелка головы на карте должна разворачиваться сразу по вводу,
    // вместе с камерой и подсказками, а не на следующем такте.
    const f = viewFrame(s)

    // Слои: пересборка только при смене головы/размера/партии/длины (то есть раз в шаг).
    const key = hd.x + size * (hd.y + size * hd.z)
    if (this.obstaclesDirty || key !== this.obstacleKey || snakeLength(s) !== this.bodyLen) {
      this.obstaclesDirty = false
      this.obstacleKey = key
      this.pulseT0 = performance.now() // такт: пульс шеврона
      this.refresh(s, hd.x, hd.y, hd.z)
    }

    // Метки в осях мира; ход = -depth (лежит в плоскости кадра), проекция на оси карты.
    const sx = this.sx, sz = this.sz
    this.placeHead(hd.x - sx + 0.5, hd.z - sz + 0.5, -f.depth.x, -f.depth.z, -f.depth.y)
    this.placeApple(ap.x, ap.z, sx, sz, ap.y === hd.y, ap.y - hd.y)
    // Уровнемер: окно вокруг головы (метка в центре, у стены ходит внутри), один шаг = клетка полосы.
    const mx = this.mainX
    const sy = this.sy
    const ll = this.levelLen
    this.levelHead.position.set(mx, windowFraction(hd.y, sy, ll) * this.len, 0)
    const aIn = isInWindow(ap.y, sy, ll)
    this.levelApple.visible = aIn
    this.levelArrow.visible = !aIn
    if (aIn) {
      this.levelApple.position.set(mx, windowFraction(ap.y, sy, ll) * this.len, 0)
    } else {
      const up = ap.y >= sy + ll
      this.levelArrow.position.set(mx, up ? this.len - LEVEL_ARROW_INSET : LEVEL_ARROW_INSET, 0)
      this.levelArrow.rotation.z = up ? 0 : Math.PI
    }
    // Жёлоб: вся высота арены, общая картина (1.5 px за шаг на 100³ — это страховка, не индикатор хода).
    this.troughHead.position.set(this.troughX, levelFraction(hd.y, size) * this.len, 0)
    this.troughApple.position.set(this.troughX, levelFraction(ap.y, size) * this.len, 0)

    // Прозрачность: вес фазы free.
    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i]!
      l.material.opacity = l.base * freeAmount
    }

    const h = this.screenH
    const x = MARGIN_LEFT_PX
    const y = h - MARGIN_TOP_PX - this.panelH
    const prevAutoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setScissorTest(true)
    renderer.setScissor(x, y, this.panelW, this.panelH)
    renderer.setViewport(x, y, this.panelW, this.panelH)
    renderer.render(this.scene, this.camera)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, this.screenW, this.screenH)
    renderer.autoClear = prevAutoClear
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose()
    this.labels.geometry.dispose()
    for (const d of this.disposables) d.dispose()
    this.geometries.length = 0
    this.disposables.length = 0
    this.layers.length = 0
  }
}
