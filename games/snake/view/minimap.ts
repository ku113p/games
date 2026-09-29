// Мини-карта в углу: второй проход рендера ортографической камерой в
// scissor-область канваса (не DOM). Приглушённая подсказка боковым зрением.
//
// Что показывает (только в фазе free, в plane скрыта: там игра «обычная змейка»):
//  - квадрат — вид сверху, привязанный к МИРУ, а не к камере. Плоскость карты —
//    перпендикулярна мировой оси, ближайшей к frame.up (рыскание оставляет up на
//    месте, значит карта при поворотах влево/вправо не двигается; тангаж меняет up
//    и карта переезжает на новую плоскость). Оси карты по порядку x,y,z без нормали:
//    нормаль y -> (x вправо, z вверх); нормаль x -> (y, z); нормаль z -> (x, y).
//    Знак up не важен (оси всегда положительные). При смене плоскости карта
//    проявляется заново за FADE_MS, а не мигает;
//  - голова (треугольник, остриё по ходу змейки в осях карты) и яблоко (ромб);
//  - препятствия — тихие квадратики-клетки ФОНОМ, СТРОГО своя плоскость: только
//    клетки на одной высоте с головой (вдоль «вверх» экрана), остальные уровни
//    отброшены. Так видно, куда нельзя двигаться на своём уровне. Тело змейки — тем же
//    правилом (сегменты своей плоскости), но зелёно-голубым градиентом как в игре,
//    ярче препятствий и тише головы; голова остаётся самой заметной меткой. Набор
//    пересобирается только когда сменились голова, камера, размер или длина (раз в
//    шаг), а не каждый кадр; один InstancedMesh, один draw call;
//  - справа полоска — вертикальный срез: высота (вверх = вверх на экране) по
//    вертикали, положение вдоль хода по горизонтали. Срез — плоскость up x ход
//    через голову: клетки с тем же «вправо», что у головы, и смещением вдоль хода
//    в окне STRIP_BEHIND назад .. STRIP_AHEAD вперёд. Он отвечает на вопрос «что
//    надо мной и подо мной» (колонка над головой ярче). Полоска остаётся
//    относительной по ходу (вертикаль = up, стабильна при рыскании; горизонталь =
//    «назад..вперёд» — по смыслу срез вдоль хода, ему нужен именно ход), а не только «где я по
//    высоте»; на нём метки головы и яблока (яблоко — тик высоты на всю ширину) и сегменты
//    тела в окне (иначе полоска показывала бы свободной клетку, где лежит собственное тело).
// Состояние читается через core/queries. В кадре объектов не создаётся.

import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Color,
  InstancedMesh,
  Matrix4,
  type WebGLRenderer,
} from 'three'
import type { GameState } from '../core/state'
import { applePos, cameraFrame, cubeSize, forEachObstacle, forEachSnakeSegment, head, snakeLength } from '../core/queries'
import {
  APPLE_COLOR,
  MINIMAP_APPLE_ALPHA,
  MINIMAP_BG_ALPHA,
  MINIMAP_BG_COLOR,
  MINIMAP_BODY_ALPHA,
  MINIMAP_BORDER_ALPHA,
  MINIMAP_BORDER_COLOR,
  MINIMAP_HEAD_ALPHA,
  MINIMAP_OBSTACLE_ALPHA,
  MINIMAP_OBSTACLE_COLOR,
  SNAKE_BODY_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_TAIL_COLOR,
} from './palette'

// Оформительские константы, не числа баланса. Размеры экранные, в CSS-пикселях.
const WIDTH_FRACTION = 0.22
const WIDTH_MIN_PX = 84
const WIDTH_MAX_PX = 200
const HEIGHT_MAX_FRACTION = 0.3
// Верхний левый угол: низ экрана занят тап-зонами, верх по центру — счёт.
// Отступ сверху с запасом под вырез/статус-бар (канвас не знает safe-area).
const MARGIN_LEFT_PX = 12
const MARGIN_TOP_PX = 48
// Геометрия карты в долях размера куба.
const PAD = 0.06
const GAP = 0.05
const STRIP_W = 0.07
const MARKER = 0.06 // размер метки; не меньше MARKER_MIN клеток
const MARKER_MIN = 1.4
const TICK_H = 0.03
const TICK_H_MIN = 0.6
// Препятствия карты: только уровень головы. Потолок инстансов — защита буфера на
// плотных кубах 100³, лишние молча отбрасываются.
const OBSTACLE_CELL = 0.9 // размер квадратика в клетках
const OBSTACLE_CAPACITY = 16384
// Вертикальный срез: окно вдоль хода (клетки) и яркость по смещению вдоль хода.
// Ширина полоски не меньше окна, иначе клетки не различить.
const STRIP_BEHIND = 1
const STRIP_AHEAD = 4
const STRIP_BRIGHTNESS = [1, 0.7, 0.5, 0.35, 0.25]
const STRIP_CAPACITY = 2048
// Тело змейки на карте и полоске: потолок инстансов, лишние сегменты молча отбрасываются.
const BODY_CAPACITY = 4096
const BODY_STRIP_CAPACITY = 1024
// Ниже этого веса фазы free карта не рисуется вовсе.
const MIN_AMOUNT = 0.02
// Проявление карты после смены плоскости (мс, стеночные часы: чисто оформление).
const FADE_MS = 220

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

  private bg: Mesh
  private border: LineLoop
  private stripBorder: LineLoop
  private headMark: Mesh
  private appleMark: Mesh
  private obstacles: InstancedMesh
  private obstacleMatrix = new Matrix4()
  private obstacleColor = new Color()
  private obstacleCount = 0
  private strip: InstancedMesh
  private stripCount = 0
  private bodyMap: InstancedMesh
  private bodyStrip: InstancedMesh
  private bodyMapCount = 0
  private bodyStripCount = 0
  private bodyDenom = 1
  private bodyLen = -1
  private bodyColor = new Color()
  private stripCenterX = 0
  private obstacleKey = -1
  private axisA = 0 // мировая ось карты «вправо»
  private axisB = 2 // мировая ось карты «вверх»
  private planeNormal = -1
  private fadeStart = 0
  private obstaclesDirty = true
  private headTick: Mesh
  private appleTick: Mesh

  private size = -1
  private screenW = 1
  private screenH = 1
  private panelW = 0
  private panelH = 0

  constructor() {
    const quad = new PlaneGeometry(1, 1)
    this.geometries.push(quad)
    const tri = new BufferGeometry()
    tri.setAttribute('position', new Float32BufferAttribute([0, 0.6, 0, -0.45, -0.4, 0, 0.45, -0.4, 0], 3))
    this.geometries.push(tri)
    const outline = new BufferGeometry()
    outline.setAttribute('position', new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    this.geometries.push(outline)

    this.bg = this.mesh(quad, MINIMAP_BG_COLOR, MINIMAP_BG_ALPHA, 0)
    this.border = this.loop(outline, MINIMAP_BORDER_COLOR, MINIMAP_BORDER_ALPHA, 1)
    this.stripBorder = this.loop(outline, MINIMAP_BORDER_COLOR, MINIMAP_BORDER_ALPHA, 1)
    {
      const m = new MeshBasicMaterial({
        color: MINIMAP_OBSTACLE_COLOR,
        transparent: true,
        opacity: MINIMAP_OBSTACLE_ALPHA,
        depthTest: false,
        depthWrite: false,
      })
      this.disposables.push(m)
      this.layers.push({ material: m, base: MINIMAP_OBSTACLE_ALPHA })
      this.obstacles = new InstancedMesh(quad, m, OBSTACLE_CAPACITY)
      this.obstacles.count = 0
      this.obstacles.renderOrder = 1
      this.obstacles.frustumCulled = false
      // Цвета инстансов создаём заранее (иначе буфер появится в кадре).
      this.obstacles.setColorAt(0, this.obstacleColor.setRGB(1, 1, 1))
      this.scene.add(this.obstacles)
      this.strip = new InstancedMesh(quad, m, STRIP_CAPACITY)
      this.strip.count = 0
      this.strip.renderOrder = 1
      this.strip.frustumCulled = false
      this.strip.setColorAt(0, this.obstacleColor.setRGB(1, 1, 1))
      this.scene.add(this.strip)
    }
    {
      // Тело: один материал на карту и полоску, цвет градиента — на инстанс.
      const m = new MeshBasicMaterial({
        transparent: true,
        opacity: MINIMAP_BODY_ALPHA,
        depthTest: false,
        depthWrite: false,
      })
      this.disposables.push(m)
      this.layers.push({ material: m, base: MINIMAP_BODY_ALPHA })
      this.bodyMap = new InstancedMesh(quad, m, BODY_CAPACITY)
      this.bodyStrip = new InstancedMesh(quad, m, BODY_STRIP_CAPACITY)
      for (const im of [this.bodyMap, this.bodyStrip]) {
        im.count = 0
        im.renderOrder = 2
        im.frustumCulled = false
        im.setColorAt(0, this.bodyColor.setRGB(1, 1, 1))
        this.scene.add(im)
      }
    }
    this.headTick = this.mesh(quad, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 2)
    this.appleTick = this.mesh(quad, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 2)
    this.appleMark = this.mesh(quad, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 3)
    this.appleMark.rotation.z = Math.PI / 4
    this.headMark = this.mesh(tri, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 4)
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

  // Колбэк создан один раз; параметры кадра лежат в полях.
  private frameHx = 0
  private frameHy = 0
  private frameHz = 0
  private fr = new Float32Array(9)
  private readonly writeObstacle = (x: number, y: number, z: number): void => {
    const fr = this.fr
    const dx = x - this.frameHx
    const dy = y - this.frameHy
    const dz = z - this.frameHz
    // Высота относительно головы (вдоль «вверх» экрана).
    const lvl = dx * fr[3]! + dy * fr[4]! + dz * fr[5]!
    if (Math.abs(lvl) < 0.5) {
      // Своя плоскость: позиция на карте — относительно центра куба, как у головы и яблока.
      if (this.obstacleCount >= OBSTACLE_CAPACITY) return
      const mx = (this.axisA === 0 ? x : this.axisA === 1 ? y : z) - this.mapCenter
      const my = (this.axisB === 0 ? x : this.axisB === 1 ? y : z) - this.mapCenter
      const i = this.obstacleCount++
      this.obstacleMatrix.makeScale(OBSTACLE_CELL, OBSTACLE_CELL, 1).setPosition(mx, my, 0)
      this.obstacles.setMatrixAt(i, this.obstacleMatrix)
      this.obstacles.setColorAt(i, this.obstacleColor.setRGB(1, 1, 1))
      return
    }
    // Вертикальный срез: тот же «вправо», что у головы; смещение вдоль хода в окне.
    if (Math.abs(dx * fr[0]! + dy * fr[1]! + dz * fr[2]!) >= 0.5) return
    const fwd = -(dx * fr[6]! + dy * fr[7]! + dz * fr[8]!) // вдоль хода (= -depth)
    if (fwd < -STRIP_BEHIND - 0.5 || fwd > STRIP_AHEAD + 0.5) return
    if (this.stripCount >= STRIP_CAPACITY) return
    const qx = x - this.mapCenter
    const qy = y - this.mapCenter
    const qz = z - this.mapCenter
    const i = this.stripCount++
    // По горизонтали: клетка окна (голова — в колонке 0), слева направо — назад .. вперёд.
    const col = Math.round(fwd)
    const px = this.stripCenterX + (col - (STRIP_AHEAD - STRIP_BEHIND) / 2)
    this.obstacleMatrix.makeScale(OBSTACLE_CELL, OBSTACLE_CELL, 1).setPosition(px, qx * fr[3]! + qy * fr[4]! + qz * fr[5]!, 0)
    this.strip.setMatrixAt(i, this.obstacleMatrix)
    const k = STRIP_BRIGHTNESS[Math.abs(col)] ?? 0
    this.strip.setColorAt(i, this.obstacleColor.setRGB(k, k, k))
  }
  private mapCenter = 0

  // Сегмент тела (кроме головы): те же правила, что у препятствий.
  private readonly writeBody = (x: number, y: number, z: number, i: number): void => {
    if (i === 0) return
    const fr = this.fr
    const dx = x - this.frameHx
    const dy = y - this.frameHy
    const dz = z - this.frameHz
    const lvl = dx * fr[3]! + dy * fr[4]! + dz * fr[5]!
    this.bodyColor.copy(SNAKE_BODY_COLOR).lerp(SNAKE_TAIL_COLOR, i / this.bodyDenom)
    if (Math.abs(lvl) < 0.5) {
      if (this.bodyMapCount >= BODY_CAPACITY) return
      const mx = (this.axisA === 0 ? x : this.axisA === 1 ? y : z) - this.mapCenter
      const my = (this.axisB === 0 ? x : this.axisB === 1 ? y : z) - this.mapCenter
      const k = this.bodyMapCount++
      this.obstacleMatrix.makeScale(OBSTACLE_CELL, OBSTACLE_CELL, 1).setPosition(mx, my, 0)
      this.bodyMap.setMatrixAt(k, this.obstacleMatrix)
      this.bodyMap.setColorAt(k, this.bodyColor)
      return
    }
    if (Math.abs(dx * fr[0]! + dy * fr[1]! + dz * fr[2]!) >= 0.5) return
    const fwd = -(dx * fr[6]! + dy * fr[7]! + dz * fr[8]!)
    if (fwd < -STRIP_BEHIND - 0.5 || fwd > STRIP_AHEAD + 0.5) return
    if (this.bodyStripCount >= BODY_STRIP_CAPACITY) return
    const qx = x - this.mapCenter
    const qy = y - this.mapCenter
    const qz = z - this.mapCenter
    const k = this.bodyStripCount++
    const col = Math.round(fwd)
    const px = this.stripCenterX + (col - (STRIP_AHEAD - STRIP_BEHIND) / 2)
    this.obstacleMatrix.makeScale(OBSTACLE_CELL, OBSTACLE_CELL, 1).setPosition(px, qx * fr[3]! + qy * fr[4]! + qz * fr[5]!, 0)
    this.bodyStrip.setMatrixAt(k, this.obstacleMatrix)
    this.bodyStrip.setColorAt(k, this.bodyColor.multiplyScalar(STRIP_BRIGHTNESS[Math.abs(col)] ?? 0))
  }

  /** Ось карты по frame.up: без аллокаций. Смена плоскости запускает проявление. */
  private updatePlane(f: ReturnType<typeof cameraFrame>): void {
    const ax = Math.abs(f.up.x), ay = Math.abs(f.up.y), az = Math.abs(f.up.z)
    const n = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
    if (n === this.planeNormal) return
    if (this.planeNormal >= 0) this.fadeStart = performance.now()
    this.planeNormal = n
    this.axisA = n === 0 ? 1 : 0
    this.axisB = n === 2 ? 1 : 2
  }

  /** Пересборка слоя препятствий вокруг головы; вызывается только при смене головы/камеры. */
  private refreshObstacles(s: GameState, hx: number, hy: number, hz: number, f: ReturnType<typeof cameraFrame>): void {
    const fr = this.fr
    fr[0] = f.right.x; fr[1] = f.right.y; fr[2] = f.right.z
    fr[3] = f.up.x; fr[4] = f.up.y; fr[5] = f.up.z
    fr[6] = f.depth.x; fr[7] = f.depth.y; fr[8] = f.depth.z
    this.updatePlane(f)
    this.frameHx = hx
    this.frameHy = hy
    this.frameHz = hz
    this.mapCenter = (cubeSize(s) - 1) / 2
    this.obstacleCount = 0
    this.stripCount = 0
    forEachObstacle(s, this.writeObstacle)
    this.obstacles.count = this.obstacleCount
    this.obstacles.instanceMatrix.needsUpdate = true
    if (this.obstacles.instanceColor) this.obstacles.instanceColor.needsUpdate = true
    this.strip.count = this.stripCount
    this.strip.instanceMatrix.needsUpdate = true
    if (this.strip.instanceColor) this.strip.instanceColor.needsUpdate = true

    this.bodyMapCount = 0
    this.bodyStripCount = 0
    this.bodyLen = snakeLength(s)
    this.bodyDenom = Math.max(1, this.bodyLen - 1)
    forEachSnakeSegment(s, this.writeBody)
    this.bodyMap.count = this.bodyMapCount
    this.bodyMap.instanceMatrix.needsUpdate = true
    if (this.bodyMap.instanceColor) this.bodyMap.instanceColor.needsUpdate = true
    this.bodyStrip.count = this.bodyStripCount
    this.bodyStrip.instanceMatrix.needsUpdate = true
    if (this.bodyStrip.instanceColor) this.bodyStrip.instanceColor.needsUpdate = true
  }

  /** Холодный путь: размер куба сменился — раскладка карты в клетках. */
  setSize(size: number): void {
    if (size === this.size) return
    this.size = size
    const h = size / 2
    const pad = size * PAD
    const gap = size * GAP
    const sw = Math.max(size * STRIP_W, STRIP_BEHIND + STRIP_AHEAD + 1)
    const xMin = -h - pad
    const xMax = h + gap + sw + pad
    const yMin = -h - pad
    const yMax = h + pad
    this.camera.left = xMin
    this.camera.right = xMax
    this.camera.bottom = yMin
    this.camera.top = yMax
    this.camera.updateProjectionMatrix()
    this.bg.position.set((xMin + xMax) / 2, 0, 0)
    this.bg.scale.set(xMax - xMin, yMax - yMin, 1)
    this.border.scale.set(size, size, 1)
    this.stripBorder.position.set(h + gap + sw / 2, 0, 0)
    this.stripBorder.scale.set(sw, size, 1)
    const m = Math.max(MARKER_MIN, size * MARKER)
    this.headMark.scale.set(m, m, 1)
    this.appleMark.scale.set(m * 0.75, m * 0.75, 1)
    const tick = Math.max(TICK_H_MIN, size * TICK_H)
    this.headTick.scale.set(1, tick, 1) // метка головы — одна клетка окна, чтобы не закрывать срез
    this.appleTick.scale.set(sw, tick, 1)
    this.stripCenterX = h + gap + sw / 2
    this.appleTick.position.x = this.stripCenterX
    // Колонка головы (смещение 0) в окне: левый край + STRIP_BEHIND + 0.5.
    this.headTick.position.x = this.stripCenterX - sw / 2 + STRIP_BEHIND + 0.5
    this.obstacleKey = -1
    this.layout()
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

  /** Кадр, без аллокаций: рисует карту поверх уже готового кадра на экране. */
  render(renderer: WebGLRenderer, s: GameState, freeAmount: number): void {
    if (freeAmount < MIN_AMOUNT || this.size < 0) return
    const size = cubeSize(s)
    const c = (size - 1) / 2
    const f = cameraFrame(s)
    const hd = head(s)
    const ap = applePos(s)

    // Слой препятствий: пересборка только при смене головы/камеры/размера/партии.
    const key =
      hd.x + size * (hd.y + size * hd.z) +
      size * size * size * (
        (f.right.x + 1) + 3 * (f.right.y + 1) + 9 * (f.right.z + 1) +
        27 * ((f.up.x + 1) + 3 * (f.up.y + 1) + 9 * (f.up.z + 1)))
    if (this.obstaclesDirty || key !== this.obstacleKey || snakeLength(s) !== this.bodyLen) {
      this.obstaclesDirty = false
      this.obstacleKey = key
      this.refreshObstacles(s, hd.x, hd.y, hd.z, f)
    }

    // Голова: q = p - центр; карта: x = q·right, y = q·forward (= -q·depth), полоска: q·up.
    const hx = hd.x - c, hy = hd.y - c, hz = hd.z - c
    const ax = ap.x - c, ay = ap.y - c, az = ap.z - c
    const A = this.axisA, B = this.axisB
    this.headMark.position.set(A === 0 ? hx : A === 1 ? hy : hz, B === 1 ? hy : hz, 0)
    this.appleMark.position.set(A === 0 ? ax : A === 1 ? ay : az, B === 1 ? ay : az, 0)
    // Остриё головы по ходу: heading = -depth, проекция на оси карты (heading лежит в плоскости).
    const dv = f.depth
    const hmx = -(A === 0 ? dv.x : A === 1 ? dv.y : dv.z)
    const hmy = -(B === 1 ? dv.y : dv.z)
    this.headMark.rotation.z = Math.atan2(-hmx, hmy)
    this.headTick.position.y = hx * f.up.x + hy * f.up.y + hz * f.up.z
    this.appleTick.position.y = ax * f.up.x + ay * f.up.y + az * f.up.z

    // Прозрачность: вес фазы free * проявление после смены плоскости.
    let fade = (performance.now() - this.fadeStart) / FADE_MS
    fade = fade >= 1 ? 1 : fade * fade * (3 - 2 * fade)
    const k = freeAmount * fade
    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i]!
      l.material.opacity = l.base * k
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
    for (const d of this.disposables) d.dispose()
    this.geometries.length = 0
    this.disposables.length = 0
    this.layers.length = 0
  }
}
