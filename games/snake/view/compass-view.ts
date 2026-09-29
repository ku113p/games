// Компас на яблоко: плоская стрелка над головой, всегда лицом к камере (billboard),
// которая плавно доворачивается в сторону яблока в 3D. Отдельный слой от подсказок
// направления (near-cells / ahead-ray): те показывают, куда змейка пойдёт при повороте,
// и живут в клетках вокруг головы; компас висит ВЫШЕ них, крупнее и цвета яблока,
// чтобы связь «стрелка -> яблоко» читалась мгновенно и с ними не путалась.
//
// Направление стрелки на экране = от точки компаса к экранной точке яблока (с
// перспективой). Яблоко за спиной камеры: стрелка целит по плоскому направлению
// в плоскости камеры. Глубина (ближе/дальше по взгляду) стрелкой не передаётся:
// это компас по сторонам, а не дальномер. Стрелка не сокращается: всегда плоская
// и лицом к камере, потому не вырождается в линию.
//
// Яркость: гаснет при близком яблоке (оно и так перед носом), полностью видна с
// COMPASS_FULL_DIST; в фазе plane скрыта (первая игра должна выглядеть обычной
// плоской змейкой), плавно проявляется вместе с freeAmount.
// Ничего не создаётся в кадре: меш, геометрия и временные векторы заведены заранее.

import { BufferGeometry, DoubleSide, Float32BufferAttribute, MathUtils, Matrix4, Mesh, MeshBasicMaterial, Vector3, type Camera, type Scene } from 'three'
import type { GameState } from '../core/state'
import { applePos, head } from '../core/queries'
import { APPLE_COLOR } from './palette'

// --- Оформительские константы (крутит дизайнер), не числа баланса -----------------
/** false — компас не создаётся и не считается вовсе. */
export const COMPASS_ENABLED = true
/** Высота над головой в клетках вдоль «вверх» камеры (слой стрелок у головы — ~2 клетки). */
export const COMPASS_HEIGHT = 2.5
/** Длина стрелки в клетках (ширина головки ~0.7 от длины). */
export const COMPASS_LENGTH = 0.9
/** Постоянная времени доворота, мс: меньше — резче, больше — ленивее, как тяжёлая стрелка компаса. */
export const COMPASS_TURN_MS = 160
/** Сглаживание положения над головой, мс (голова прыгает по клеткам, компас плывёт следом). */
export const COMPASS_FOLLOW_MS = 90
/** Яблоко ближе — компас погашен; дальше COMPASS_FULL_DIST — виден полностью (клетки). */
export const COMPASS_HIDE_DIST = 3
export const COMPASS_FULL_DIST = 8
/** Максимальная непрозрачность и яркость цвета (линейная яркость яблока ~1, bloom-порог 0.8). */
export const COMPASS_ALPHA = 0.9
export const COMPASS_BRIGHTNESS = 0.9

// Глубина (в клетках от камеры), с которой яблоко считается перед камерой: ближе — стрелка
// целит по плоскому направлению, между ними плавный переход (без скачка при пролёте мимо).
const PERSPECTIVE_MIN_DEPTH = 0.5
const PERSPECTIVE_FULL_DEPTH = 3

const SHAFT_HALF = 0.11
const HEAD_HALF = 0.4
const HEAD_BASE = 0.1 // x основания головки; кончик в x = 0.5, хвост в x = -0.5

export class CompassView {
  private scene: Scene
  private mesh: Mesh
  private material: MeshBasicMaterial
  private readonly dir = new Vector3(1, 0, 0) // сглаженное направление (единичное)
  private readonly target = new Vector3()
  private readonly pos = new Vector3()
  private readonly up = new Vector3()
  private readonly back = new Vector3()
  private readonly a = new Vector3()
  private readonly b = new Vector3()
  private readonly basis = new Matrix4()
  private ready = false

  constructor(scene: Scene) {
    this.scene = scene
    const g = new BufferGeometry()
    // Стрелка в плоскости XY, кончик в +x: хвост-планка и треугольная головка.
    // prettier-ignore
    const v = [
      -0.5, -SHAFT_HALF, 0,  HEAD_BASE, -SHAFT_HALF, 0,  HEAD_BASE, SHAFT_HALF, 0,
      -0.5, -SHAFT_HALF, 0,  HEAD_BASE, SHAFT_HALF, 0,  -0.5, SHAFT_HALF, 0,
      HEAD_BASE, -HEAD_HALF, 0,  0.5, 0, 0,  HEAD_BASE, HEAD_HALF, 0,
    ]
    g.setAttribute('position', new Float32BufferAttribute(v, 3))
    this.material = new MeshBasicMaterial({
      color: APPLE_COLOR.clone(),
      transparent: true,
      opacity: 0,
      depthTest: false, // всегда поверх препятствий: это интерфейс, а не предмет сцены
      depthWrite: false,
      side: DoubleSide,
    })
    this.mesh = new Mesh(g, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 10
    this.mesh.visible = false
    this.scene.add(this.mesh)
    this.material.color.copy(APPLE_COLOR).multiplyScalar(COMPASS_BRIGHTNESS)
  }

  /** Партия началась заново: стрелка встаёт сразу на место, без доворота с прошлой позиции. */
  reset(): void {
    this.ready = false
  }

  /** Кадр: без новых объектов. */
  update(s: GameState, camera: Camera, dtMs: number, freeAmount: number): void {
    const h = head(s)
    const ap = applePos(s)
    this.target.set(ap.x - h.x, ap.y - h.y, ap.z - h.z)
    const dist = this.target.length()
    const alpha =
      COMPASS_ALPHA * MathUtils.smoothstep(dist, COMPASS_HIDE_DIST, COMPASS_FULL_DIST) * MathUtils.smoothstep(freeAmount, 0, 1)
    if (alpha <= 0.003 || dist < 1e-6) {
      this.mesh.visible = false
      this.ready = false
      return
    }
    this.target.divideScalar(dist)

    camera.updateMatrixWorld()
    const e = camera.matrixWorld.elements
    this.up.set(e[4]!, e[5]!, e[6]!)
    this.back.set(e[8]!, e[9]!, e[10]!)

    // Точка над головой: голова + вверх камеры.
    const px = h.x + this.up.x * COMPASS_HEIGHT
    const py = h.y + this.up.y * COMPASS_HEIGHT
    const pz = h.z + this.up.z * COMPASS_HEIGHT
    const kPos = this.ready ? 1 - Math.exp(-dtMs / COMPASS_FOLLOW_MS) : 1
    this.pos.x += (px - this.pos.x) * kPos
    this.pos.y += (py - this.pos.y) * kPos
    this.pos.z += (pz - this.pos.z) * kPos

    // Доворот к цели; при почти противоположном направлении lerp проходит через ноль —
    // тогда берём цель как есть.
    const kDir = this.ready ? 1 - Math.exp(-dtMs / COMPASS_TURN_MS) : 1
    this.dir.lerp(this.target, kDir)
    if (this.dir.lengthSq() < 0.01) this.dir.copy(this.target)
    this.dir.normalize()
    this.ready = true

    // Куда стрелка смотрит НА ЭКРАНЕ: от точки компаса к экранной точке яблока (с учётом
    // перспективы, иначе далёкое яблоко «сползает» и стрелка целит мимо). Сглаженная цель
    // — голова + dir * dist. Координаты камеры: x — вправо, y — вверх, z — вглубь.
    const cam = camera.position
    this.a.set(h.x + this.dir.x * dist - cam.x, h.y + this.dir.y * dist - cam.y, h.z + this.dir.z * dist - cam.z)
    this.b.set(this.pos.x - cam.x, this.pos.y - cam.y, this.pos.z - cam.z)
    const ax = this.a.x * e[0]! + this.a.y * e[1]! + this.a.z * e[2]!
    const ay = this.a.x * e[4]! + this.a.y * e[5]! + this.a.z * e[6]!
    const az = -(this.a.x * e[8]! + this.a.y * e[9]! + this.a.z * e[10]!)
    const bx = this.b.x * e[0]! + this.b.y * e[1]! + this.b.z * e[2]!
    const by = this.b.x * e[4]! + this.b.y * e[5]! + this.b.z * e[6]!
    const bz = -(this.b.x * e[8]! + this.b.y * e[9]! + this.b.z * e[10]!)
    // Плоское направление (без перспективы) — для яблока за плоскостью камеры и рядом с ней.
    let ox = ax - bx
    let oy = ay - by
    const ol = Math.hypot(ox, oy) || 1
    ox /= ol
    oy /= ol
    let sx = ox
    let sy = oy
    if (az > PERSPECTIVE_MIN_DEPTH && bz > PERSPECTIVE_MIN_DEPTH) {
      let px = ax / az - bx / bz
      let py = ay / az - by / bz
      const pl = Math.hypot(px, py)
      if (pl > 1e-6) {
        px /= pl
        py /= pl
        const t = MathUtils.smoothstep(az, PERSPECTIVE_MIN_DEPTH, PERSPECTIVE_FULL_DEPTH)
        sx = ox + (px - ox) * t
        sy = oy + (py - oy) * t
      }
    }
    if (Math.hypot(sx, sy) < 1e-6) {
      sx = 1
      sy = 0
    }
    // Ось стрелки в мире: right * sx + up * sy (лежит в плоскости камеры).
    this.a.set(e[0]! * sx + e[4]! * sy, e[1]! * sx + e[5]! * sy, e[2]! * sx + e[6]! * sy).normalize()
    this.b.crossVectors(this.back, this.a)
    this.basis.makeBasis(this.a, this.b, this.back)
    this.mesh.quaternion.setFromRotationMatrix(this.basis)
    this.mesh.position.copy(this.pos)
    this.mesh.scale.set(COMPASS_LENGTH, COMPASS_LENGTH, 1)
    this.material.opacity = alpha
    this.mesh.visible = true
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
