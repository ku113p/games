// Ближний слой подсказки: маркеры в ЦЕНТРАХ клеток, куда змейка может попасть
// следующим шагом, и ещё одна клетка дальше по той же оси. Один маркер на клетку.
// Только по осям, без диагоналей: вперёд и четыре соседа по граням (влево, вправо,
// вниз, вверх относительно хода; в plane это и ось глубины), всего пять векторов.
// Ближняя крупнее и ярче, вторая (две клетки от головы) заметно мельче и тише.
//   можно шагнуть — белая СТРЕЛКА по направлению от головы к клетке (вперёд ярче боковых).
//     Стрелка — плоская, рисуется во фрагментном шейдере внутри point-спрайта, который
//     всегда повёрнут к камере, а угол берётся из экранной проекции направления шага
//     (клетка и клетка + шаг проецируются вершинным шейдером): читается с любого ракурса.
//     Если направление почти вдоль луча зрения (стрелка «смотрит на нас/от нас»),
//     проекция вырождается и стрелка плавно переходит в диск — так выглядит
//     торцом и объёмная стрелка, а угол в этот момент был бы шумом;
//   нельзя (стенка, препятствие, тело) — красно-оранжевый КРЕСТИК; у стенки метка
//   стоит на её грани (клетка за стенкой не существует). Если ближняя клетка закрыта
//   препятствием/телом, вторая тоже крестик (сплошная стена из двух меток), даже если
//   за ней свободно; если вторая уже за стенкой куба — метка на грани. Ближняя стенка:
//   одна метка (вторая висела бы вне куба и намекала, что за стенкой есть место).
// Крестик рисует фрагментный шейдер внутри point-спрайта. Спрайт всегда повёрнут к
// камере, поэтому плоский крест читается с любого ракурса без пересчёта геометрии,
// а объёмный из двух отрезков в перспективе сплющивался бы в палку или точку.
// Считается отдельно для каждой клетки. Яблоко — свободная клетка (окрашивает AppleView).
// 5 клеток x 2 заранее выделены; в кадре мутируются позиции и виды, объектов нет.
// Яркость ниже порога bloom.

import { BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, type Scene } from 'three'
import type { GameState } from '../core/state'
import { cameraFrame, head } from '../core/queries'
import { HeadTrace, HitKind, type SolidTest } from './head-trace'
import { NEAR_FAR_ALPHA, NEAR_FAR_SIZE, NEAR_BLOCKED_BRIGHTNESS, NEAR_FORWARD_BRIGHTNESS, NEAR_SIDE_BRIGHTNESS, RAY_DANGER_COLOR } from './palette'

// Итог put: свободна / закрыта (препятствие, тело) / стенка куба.
const PUT_OPEN = 0
const PUT_BLOCKED = 1
const PUT_WALL = 2
const MAX_CELLS = 10 // 5 направлений x 2 клетки
const DOT_SIZE = 0.42 // размер спрайта ближнего маркера (стрелка/крест) в клетках
const MAX_PX = 60 // потолок размера спрайта в пикселях буфера: вблизи стрелка крупная, но не на пол-экрана
// Крестик мельче 8 px превращается в кляксу: для «нельзя» свой нижний предел размера
// и множитель (крест визуально легче диска той же ширины).
const BLOCKED_MIN_PX = 9
const ARROW_MIN_PX = 10 // стрелка мельче не читается: свободные клетки не ниже этого
const BLOCKED_SIZE_K = 1.3
const CROSS_HALF = 0.86 // половина стороны креста в долях спрайта
const CROSS_WIDTH = 0.2 // полутолщина штриха в долях спрайта

const VERT = /* glsl */ `
attribute float aKind;   // 0 вперёд, 1 сбоку, 2 нельзя, -1 не рисовать
attribute float aFar;    // 1 — вторая клетка от головы
attribute vec3 aDir;     // единичный шаг от головы к клетке (мировые оси)
uniform float uPxScale;
uniform float uSize;
uniform float uMaxPx;
uniform float uFarSize;
uniform float uFarAlpha;
uniform float uArrowMinPx;
uniform float uBlockedMinPx;
uniform float uBlockedSizeK;
uniform vec3 uForwardColor;
uniform vec3 uSideColor;
uniform vec3 uBlockedColor;
varying vec3 vColor;
varying float vAlpha;
varying float vBlocked;
varying vec2 vDir;
varying float vArrow;
void main() {
  if (aKind < -0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vColor = vec3(0.0);
    return;
  }
  vec4 mv = viewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;
  // Экранное направление шага: проекция клетки и клетки + пол-шага по aDir.
  vec4 clip2 = projectionMatrix * (mv + viewMatrix * vec4(aDir * 0.5, 0.0));
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vec2 sd = (clip2.xy / max(clip2.w, 0.001) - clip.xy / max(clip.w, 0.001)) * vec2(aspect, 1.0);
  float sdLen = length(sd);
  // Отношение к «боковому» полушагу (там проекция полная): 1 — вбок, 0 — торцом.
  float side = sdLen / max(0.5 * projectionMatrix[1][1] / max(clip.w, 0.001), 1e-5);
  vDir = sdLen > 1e-6 ? sd / sdLen : vec2(0.0, 1.0);
  vArrow = smoothstep(0.12, 0.35, side);
  float farK = aFar > 0.5 ? uFarSize : 1.0;
  float blocked = aKind > 1.5 ? 1.0 : 0.0;
  vBlocked = blocked;
  float sz = uSize * farK * mix(1.0, uBlockedSizeK, blocked) * uPxScale * projectionMatrix[1][1] / max(clip.w, 0.001);
  gl_PointSize = clamp(sz, mix(uArrowMinPx, uBlockedMinPx, blocked), uMaxPx);
  float nearFade = smoothstep(0.5, 1.5, length(mv.xyz));
  vColor = aKind > 1.5 ? uBlockedColor : (aKind > 0.5 ? uSideColor : uForwardColor);
  vAlpha = nearFade * (aFar > 0.5 ? uFarAlpha : 1.0);
}
`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vBlocked;
varying vec2 vDir;
varying float vArrow;
uniform float uCrossHalf;
uniform float uCrossWidth;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float shape;
  if (vBlocked > 0.5) {
    // Крест: расстояние до диагоналей, обрезка квадратом.
    float d = min(abs(p.x - p.y), abs(p.x + p.y)) * 0.70710678;
    float box = max(abs(p.x), abs(p.y));
    shape = (1.0 - smoothstep(uCrossWidth * 0.6, uCrossWidth, d)) * (1.0 - smoothstep(uCrossHalf - 0.1, uCrossHalf, box));
  } else {
    // Свободная клетка: стрелка вдоль vDir (в спрайте y вниз, переводим в y вверх),
    // торцом — диск.
    vec2 q = vec2(p.x, -p.y);
    float u = dot(q, vDir) + 0.1;
    float v = dot(q, vec2(-vDir.y, vDir.x));
    float shaft = max(abs(v) - 0.17, abs(u + 0.25) - 0.55);
    float tip = max(abs(v) - (0.95 - u) * 0.85, 0.05 - u);
    float dArrow = min(shaft, tip);
    float arrow = 1.0 - smoothstep(0.0, 0.1, dArrow);
    float disc = 1.0 - smoothstep(0.6, 1.0, length(p));
    shape = mix(disc, arrow, vArrow);
  }
  float a = shape * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`

export class NearCells {
  private scene: Scene
  private points: Points
  private material: ShaderMaterial
  private pos: BufferAttribute
  private kind: BufferAttribute
  private far: BufferAttribute
  private dir: BufferAttribute
  private trace: HeadTrace
  private n = 0

  constructor(scene: Scene, trace: HeadTrace) {
    this.scene = scene
    this.trace = trace
    const geometry = new BufferGeometry()
    this.pos = new BufferAttribute(new Float32Array(MAX_CELLS * 3), 3)
    this.kind = new BufferAttribute(new Float32Array(MAX_CELLS).fill(-1), 1)
    this.far = new BufferAttribute(new Float32Array(MAX_CELLS), 1)
    this.dir = new BufferAttribute(new Float32Array(MAX_CELLS * 3), 3)
    geometry.setAttribute('position', this.pos)
    geometry.setAttribute('aKind', this.kind)
    geometry.setAttribute('aFar', this.far)
    geometry.setAttribute('aDir', this.dir)
    const c = (k: number): Color => new Color(k, k, k)
    this.material = new ShaderMaterial({
      uniforms: {
        uPxScale: { value: 400 },
        uSize: { value: DOT_SIZE },
        uMaxPx: { value: MAX_PX },
        uFarSize: { value: NEAR_FAR_SIZE },
        uFarAlpha: { value: NEAR_FAR_ALPHA },
        uArrowMinPx: { value: ARROW_MIN_PX },
        uBlockedMinPx: { value: BLOCKED_MIN_PX },
        uBlockedSizeK: { value: BLOCKED_SIZE_K },
        uCrossHalf: { value: CROSS_HALF },
        uCrossWidth: { value: CROSS_WIDTH },
        uForwardColor: { value: c(NEAR_FORWARD_BRIGHTNESS) },
        uSideColor: { value: c(NEAR_SIDE_BRIGHTNESS) },
        uBlockedColor: { value: RAY_DANGER_COLOR.clone().multiplyScalar(NEAR_BLOCKED_BRIGHTNESS) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      // Метка стоит в центре клетки; клетка-препятствие непрозрачна, и метка внутри
      // неё пропала бы. Подсказка рисуется поверх (метки — единицы, у головы).
      depthTest: false,
    })
    this.points = new Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 2
    this.scene.add(this.points)
  }

  setViewportHeight(pixels: number): void {
    this.material.uniforms['uPxScale']!.value = pixels * 0.5
  }

  /**
   * Кадр. trace.run() к этому моменту уже вызван для того же состояния.
   * (dx,dy,dz) — единичное направление хода. Пять векторов: ход и четыре
   * перпендикулярных (±right, ±up, ±depth без тех, что лежат вдоль хода).
   */
  update(s: GameState, dx: number, dy: number, dz: number, isSolid: SolidTest): void {
    const h = head(s)
    const frame = cameraFrame(s)
    this.n = 0
    this.putPair(s, h.x, h.y, h.z, dx, dy, dz, 0, isSolid)
    for (let a = 0; a < 3; a++) {
      const v = a === 0 ? frame.right : a === 1 ? frame.up : frame.depth
      const vx = Math.round(v.x)
      const vy = Math.round(v.y)
      const vz = Math.round(v.z)
      // Вдоль оси движения (вперёд уже есть, назад запрещён) — пропуск.
      if (Math.abs(vx * dx + vy * dy + vz * dz) > 0) continue
      this.putPair(s, h.x, h.y, h.z, vx, vy, vz, 1, isSolid)
      this.putPair(s, h.x, h.y, h.z, -vx, -vy, -vz, 1, isSolid)
    }
    for (let i = this.n; i < MAX_CELLS; i++) this.kind.setX(i, -1)
    this.kind.needsUpdate = true
    this.pos.needsUpdate = true
    this.far.needsUpdate = true
    this.dir.needsUpdate = true
  }

  /** Ближняя клетка и, если в неё можно шагнуть, вторая за ней (та же ось). */
  private putPair(s: GameState, hx: number, hy: number, hz: number, dx: number, dy: number, dz: number, role: number, isSolid: SolidTest): void {
    const near = this.put(s, hx, hy, hz, dx, dy, dz, 1, role, isSolid, false)
    // Ближняя стенка куба: за ней клетки нет, вторая метка повисла бы вне куба.
    if (near === PUT_WALL) return
    // Ближняя закрыта: вторая тоже крестик, что бы за ней ни было (сплошная стена из двух меток).
    this.put(s, hx, hy, hz, dx, dy, dz, 2, role, isSolid, near === PUT_BLOCKED)
  }

  private put(s: GameState, hx: number, hy: number, hz: number, dx: number, dy: number, dz: number, dist: number, role: number, isSolid: SolidTest, forceBlocked: boolean): number {
    if (this.n >= MAX_CELLS) return PUT_WALL
    const k = this.trace.kindAt(s, hx + dx * dist, hy + dy * dist, hz + dz * dist, dist, isSolid)
    const wall = k === HitKind.Wall
    const kind = forceBlocked || wall || k === HitKind.Obstacle || k === HitKind.Body ? 2 : role
    // Центр клетки; для стенки — центр её грани (на полклетки ближе).
    const off = wall ? dist - 0.5 : dist
    const i = this.n
    this.pos.setXYZ(i, hx + dx * off, hy + dy * off, hz + dz * off)
    this.kind.setX(i, kind)
    this.far.setX(i, dist > 1 ? 1 : 0)
    this.dir.setXYZ(i, dx, dy, dz)
    this.n++
    return wall ? PUT_WALL : kind === 2 ? PUT_BLOCKED : PUT_OPEN
  }

  dispose(): void {
    this.scene.remove(this.points)
    this.points.geometry.dispose()
    this.material.dispose()
  }
}
