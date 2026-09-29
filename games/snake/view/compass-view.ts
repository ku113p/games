// Компас на яблоко: маленькая ОБЪЁМНАЯ стрелка (древко-цилиндр + голова-конус) у самой головы,
// развёрнутая по РЕАЛЬНОМУ мировому вектору от головы к яблоку (не по экранной проекции).
// Поэтому она честно показывает «выше / ниже / ближе / дальше» в объёме: змейка ходит по
// трём осям, и именно вертикаль читается хуже всего. Плавно доворачивается («как компас»,
// не щелчками).
//
// Отдельный слой от подсказок направления (near-cells / ahead-ray): те — плоские БЕЛЫЕ
// спрайты-стрелки в центрах соседних клеток (1 клетка от головы); компас — цвета яблока,
// с объёмной светотенью, и целиком помещается в клетку головы (кончик не дотягивается до
// маркеров подсказок), чтобы одно не путалось с другим.
//
// Вырожденный случай: яблоко строго по взгляду камеры (перед носом или за спиной) — стрелка
// смотрит в камеру и превращается в круг. Объёмная форма с торца читается сама (светотень
// конуса, разный размер ближнего и дальнего конца), но «к нам или от нас» неоднозначно, потому
// направление, нарисованное на экране, не даётся ближе COMPASS_MIN_ANGLE к оси взгляда:
// стрелка минимально заваливается в сторону, чтобы был виден бок. Отклонение непрерывное и
// работает только у самой оси взгляда, в остальных ракурсах стрелка целит точно.
//
// Яркость: гаснет при близком яблоке (оно и так перед носом), полностью видна с
// COMPASS_FULL_DIST; в фазе plane скрыта (первая игра должна выглядеть обычной
// плоской змейкой), плавно проявляется вместе с freeAmount.
// Всегда поверх сцены: глубина стрелки сжата к ближней плоскости камеры (шейдер), поэтому
// препятствия её не закрывают, а грани самой стрелки друг друга сортируют правильно.
// Ничего не создаётся в кадре: меш, геометрия и временные векторы заведены заранее.

import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  MathUtils,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Camera,
  type Scene,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { GameState } from '../core/state'
import { applePos, head } from '../core/queries'
import { APPLE_COLOR } from './palette'

// --- Оформительские константы (крутит дизайнер), не числа баланса -----------------
/** false — компас не создаётся и не считается вовсе. */
export const COMPASS_ENABLED = true
/** Высота центра стрелки над центром головы вдоль «вверх» камеры, клетки (было 2.5, стало 0.9: вплотную к голове). */
export const COMPASS_HEIGHT = 0.55
/** Полная длина стрелки в клетках (было 0.9 плоской, стало 0.7 объёмной). */
export const COMPASS_LENGTH = 0.55
/** Радиус головы-конуса в долях длины (было: ширина плоской головки 0.7 длины; радиус 0.5 ширины = 0.35). */
export const COMPASS_HEAD_RADIUS = 0.26
/** Радиус древка в долях длины. */
export const COMPASS_SHAFT_RADIUS = 0.1
/** Доля длины, занятая головой-конусом (остальное — древко). */
export const COMPASS_HEAD_FRACTION = 0.5
/** Постоянная времени доворота, мс: меньше — резче, больше — ленивее, как тяжёлая стрелка компаса. */
export const COMPASS_TURN_MS = 160
/** Сглаживание положения у головы, мс (голова прыгает по клеткам, компас плывёт следом). */
export const COMPASS_FOLLOW_MS = 90
/** Яблоко ближе — компас погашен; дальше COMPASS_FULL_DIST — виден полностью (клетки). */
export const COMPASS_HIDE_DIST = 3
export const COMPASS_FULL_DIST = 8
/** Максимальная непрозрачность и яркость цвета (линейная яркость яблока ~1, bloom-порог 0.8). */
export const COMPASS_ALPHA = 0.95
export const COMPASS_BRIGHTNESS = 0.9
/** Минимальный угол между стрелкой и осью взгляда камеры, градусы; 0 — не заваливать (стрелка вырождается в круг). */
export const COMPASS_MIN_ANGLE = 35
/** Сила светотени: 0 — плоская заливка, 1 — от чёрного к полному цвету. */
export const COMPASS_SHADING = 0.7

// Во сколько раз сжимается диапазон глубины стрелки у ближней плоскости (техническое число).
const DEPTH_SQUASH = 0.02
const CONE_SEGMENTS = 20

const VERTEX = /* glsl */ `
varying vec3 vN;
uniform float uSquash;
void main() {
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Глубина к ближней плоскости: поверх сцены, но грани стрелки различимы между собой.
  gl_Position.z = -gl_Position.w + (gl_Position.z + gl_Position.w) * uSquash;
}
`
const FRAGMENT = /* glsl */ `
varying vec3 vN;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uShading;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // Свет из-за левого плеча камеры сверху + ободок на краях (отделяет форму от фона).
  float l = clamp(dot(n, normalize(vec3(-0.5, 0.7, 0.5))), 0.0, 1.0);
  float shade = mix(1.0, 0.16 + 0.9 * l, uShading);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0) * 0.25 * uShading;
  gl_FragColor = vec4(uColor * (shade + rim), uOpacity);
}
`

export class CompassView {
  private scene: Scene
  private mesh: Mesh
  private material: ShaderMaterial
  private readonly opacityU = { value: 0 } // uniform прозрачности (правится на месте)
  private readonly dir = new Vector3(1, 0, 0) // сглаженное направление (единичное)
  private readonly target = new Vector3()
  private readonly pos = new Vector3()
  private readonly up = new Vector3()
  private readonly fwd = new Vector3()
  private readonly perp = new Vector3()
  private readonly draw = new Vector3() // рисуемое направление (после отклонения от оси взгляда)
  private readonly axisY = new Vector3(0, 1, 0)
  private readonly quat = new Quaternion()
  private readonly minCos = Math.cos(MathUtils.degToRad(COMPASS_MIN_ANGLE))
  private readonly minSin = Math.sin(MathUtils.degToRad(COMPASS_MIN_ANGLE))
  private ready = false

  constructor(scene: Scene) {
    this.scene = scene
    // Стрелка вдоль +Y единичной длины, центр в начале: древко снизу, конус сверху.
    const headLen = COMPASS_HEAD_FRACTION
    const shaftLen = 1 - headLen
    const cone = new ConeGeometry(COMPASS_HEAD_RADIUS, headLen, CONE_SEGMENTS, 1)
    cone.translate(0, 0.5 - headLen / 2, 0)
    const shaft = new CylinderGeometry(COMPASS_SHAFT_RADIUS, COMPASS_SHAFT_RADIUS, shaftLen, CONE_SEGMENTS, 1)
    shaft.translate(0, -0.5 + shaftLen / 2, 0)
    const g: BufferGeometry = mergeGeometries([cone, shaft], false)
    cone.dispose()
    shaft.dispose()
    this.material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color().copy(APPLE_COLOR).multiplyScalar(COMPASS_BRIGHTNESS) },
        uOpacity: this.opacityU,
        uShading: { value: COMPASS_SHADING },
        uSquash: { value: DEPTH_SQUASH },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: true, // тест против сжатой глубины самой стрелки; сцену она всё равно перекрывает
      depthWrite: true,
    })
    this.mesh = new Mesh(g, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 10
    this.mesh.visible = false
    this.mesh.scale.setScalar(COMPASS_LENGTH)
    this.scene.add(this.mesh)
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
    this.fwd.set(-e[8]!, -e[9]!, -e[10]!) // куда смотрит камера

    // Точка у головы: голова + вверх камеры (плавно следует за клеточными прыжками головы).
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

    // Отклонение от оси взгляда: рисуемое направление не ближе COMPASS_MIN_ANGLE к ней.
    this.draw.copy(this.dir)
    const c = this.dir.dot(this.fwd)
    if (Math.abs(c) > this.minCos) {
      this.perp.copy(this.dir).addScaledVector(this.fwd, -c)
      if (this.perp.lengthSq() < 1e-6) this.perp.copy(this.up)
      this.perp.normalize()
      const sgn = c > 0 ? 1 : -1
      this.draw.copy(this.fwd).multiplyScalar(sgn * this.minCos).addScaledVector(this.perp, this.minSin)
    }

    this.quat.setFromUnitVectors(this.axisY, this.draw)
    this.mesh.quaternion.copy(this.quat)
    this.mesh.position.copy(this.pos)
    this.opacityU.value = alpha
    this.mesh.visible = true
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
