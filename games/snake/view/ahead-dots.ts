// Слой «решётка»: фоновая разметка пространства редкой решёткой узлов.
//
// Она про «где я в объёме», а НЕ про направление (направление показывает луч
// ahead-ray.ts, ближние клетки — near-cells.ts; слои собирает direction-hint.ts).
//
// Шаг и привязка — config.hints (правится без пересборки):
//   latticeAt   'corners' — узлы в углах клеток (координаты k - 0.5);
//               'centers' — узлы в центрах клеток (координаты k);
//   latticeStep через сколько клеток ставить узел по каждой оси
//               (4 — решётка из кубов 4x4x4 клеток).
//
// Решётка глобальная: точки стоят на месте, при движении змейки лишь
// проявляются у головы и тают у края окна. При шаге 4 она редкая, коридор она
// показывать не должна — это делает луч.
//
// СТОИМОСТЬ. Рисуются только узлы рядом с головой: статичный буфер точек
// фиксированного размера, зависящего от радиуса отсечения и шага, но НЕ от
// размера куба. Позиции считает вершинный шейдер из униформ (голова, направление,
// якорь решётки); в кадре CPU трогает только униформы: ни новых объектов, ни
// await, ни перезаписи буферов. Узлов решётки в кубе: (n/шаг + 1)^3 — на 100^3
// с шагом 1 это ~1 млн, поэтому окно отсекается по радиусу при любом шаге и режиме.
// Радиусы окна (клетки): поперёк ±LATERAL_CELLS, вперёд AHEAD_CELLS, назад
// BEHIND_CELLS; узлы вне куба и вне окна шейдер отбрасывает.
//
// «ЁЖИКИ». Узел — место, где пересекаются плоскости пространственной сетки; одна
// точка не показывает, как они идут. Поэтому из каждого узла выходят шесть коротких
// обрубков по осям мира (±x, ±y, ±z) — начала рёбер, длиной STUB_CELLS клетки
// (0.25 клетки при любом шаге решётки: обрубки показывают масштаб клетки). Точка в узле оставлена: она отмечает
// само пересечение, а обрубки показывают, куда идут плоскости. Обрубок, конец
// которого вышел бы за куб, скрывается. Обрубки вдоль оси глубины экрана в plane
// растут из нуля вместе с freeAmount (иначе перспектива выдала бы глубину).
// Стоимость: тот же статичный буфер окна, на узел 6 отрезков (12 вершин); окно
// по радиусу отсекает шейдер одним и тем же кодом для точек и отрезков.
//
// ЗАТУХАНИЕ. Яркость узлов и обрубков падает с расстоянием от головы (см. FADE_FULL_CELLS).
//
// Фаза plane: глубина не показывается (первая игра выглядит плоской змейкой) —
// остаётся один слой узлов у камеры; по мере полёта камеры (freeAmount)
// остальные слои проявляются.

import { BufferGeometry, Float32BufferAttribute, LineSegments, Points, ShaderMaterial, Vector3, type Scene } from 'three'
import type { Config } from '../core/rules'
import { DOT_BASE_ALPHA, DOT_BASE_COLOR } from './palette'

// Оформительские константы (радиус отсечения и вид точек), не числа баланса.
const LATERAL_CELLS = 8 // радиус окна фона поперёк хода
const BEHIND_CELLS = 4
const AHEAD_CELLS = 18
const DOT_BASE_SIZE = 0.12 // диаметр точки в клетках
// Затухание по расстоянию ОТ ГОЛОВЫ (не от камеры: камера летает, наклоняется и
// в plane далеко, а голова — то, от чего игрок отсчитывает глубину). Полная яркость
// до FADE_FULL_CELLS, дальше квадратично ((1-t)^2) до нуля к границе окна AHEAD_CELLS:
// чем дальше узел по ходу, тем он тусклее — по яркости читается глубина.
const FADE_FULL_CELLS = 1
const MIN_PX = 3
const MAX_PX = 9
/** Длина обрубка ребра в КЛЕТКАХ (четверть одной клетки; от шага решётки не зависит). */
export const STUB_CELLS = 0.25

// Общая часть: униформы и отсечение узла. Возвращает альфу узла (0 — скрыт).
const COMMON = /* glsl */ `
uniform vec3 uHead;
uniform vec3 uDir;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uDepth;
uniform vec3 uAnchor;
uniform float uFreeAmt;
uniform float uSize;
uniform float uPxScale;
uniform float uMaxPx;
uniform float uSpacing;
uniform float uLo;
uniform float uCenters;
uniform float uLatR;
uniform float uBehind;
uniform float uAhead;
uniform float uBaseSize;
uniform float uMinPx;
uniform float uBaseAlpha;
uniform float uStub;
uniform float uFadeFull;
uniform vec3 uBaseColor;
varying vec3 vColor;
varying float vAlpha;

void hide() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  vAlpha = 0.0;
  vColor = vec3(0.0);
}

bool inCube(vec3 w) {
  float hi = uSize + uLo - 1.0 + 0.02;
  float lo = uLo - 0.01;
  return !(w.x < lo || w.y < lo || w.z < lo || w.x > hi || w.y > hi || w.z > hi);
}

// Узел (ia, ib, if) — целые индексы от якоря вдоль (A, B, dir): мировая позиция.
vec3 nodeWorld(vec3 idx) {
  return uAnchor + (idx.x * uA + idx.y * uB + idx.z * uDir) * uSpacing;
}

// Альфа узла: окно вокруг головы, слой глубины в plane, таяние краёв. 0 — скрыт.
float nodeAlpha(vec3 world, float viewLen) {
  vec3 off = world - uHead;
  float f = dot(off, uDir);
  float lat = max(abs(dot(off, uA)), abs(dot(off, uB)));
  if (lat > uLatR || f < -uBehind || f > uAhead) return 0.0;
  // В центрах: голова и клетки позади неё по оси заняты змейкой, точек там нет.
  if (uCenters > 0.5 && lat < 0.25 && f < 0.25) return 0.0;
  float dd = dot(off, uDepth);
  float hs = 0.5 * uSpacing;
  float layer = mix(step(-hs + 0.001, dd) * step(dd, hs + 0.001), 1.0, uFreeAmt);
  float edge = (1.0 - smoothstep(uLatR - 2.0, uLatR, lat))
    * smoothstep(-uBehind, -uBehind + 2.0, f)
    * (1.0 - smoothstep(uAhead - 4.0, uAhead, f));
  float nearFade = smoothstep(0.8, 2.2, viewLen);
  // Затухание с расстоянием от головы: у головы полная яркость, к краю окна ноль.
  // Квадратичная кривая: заметно тускнеет уже на 4-6 клетках (глубина читается
  // с одного взгляда), к границе окна сходит к нулю с нулевым наклоном, без обрыва.
  float distT = clamp((length(off) - uFadeFull) / (uAhead - uFadeFull), 0.0, 1.0);
  float distFade = (1.0 - distT) * (1.0 - distT);
  return uBaseAlpha * edge * layer * nearFade * distFade;
}
`

const VERT = /* glsl */ `
${COMMON}
void main() {
  vec3 world = nodeWorld(position);
  if (!inCube(world)) { hide(); return; }
  vec4 mv = viewMatrix * vec4(world, 1.0);
  float a = nodeAlpha(world, length(mv.xyz));
  if (a <= 0.0) { hide(); return; }
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;
  gl_PointSize = clamp(uBaseSize * uPxScale * projectionMatrix[1][1] / max(clip.w, 0.001), uMinPx, uMaxPx);
  vAlpha = a;
  vColor = uBaseColor;
}
`

// Обрубки: aStub = (ось 0..5 -> +x,-x,+y,-y,+z,-z; конец 0 — узел, 1 — кончик).
const VERT_STUB = /* glsl */ `
${COMMON}
attribute vec2 aStub;
void main() {
  vec3 world = nodeWorld(position);
  int ax = int(aStub.x + 0.5);
  vec3 axis = vec3(float(ax == 0) - float(ax == 1), float(ax == 2) - float(ax == 3), float(ax == 4) - float(ax == 5));
  // Вдоль глубины экрана обрубок растёт из нуля вместе с freeAmount.
  float len = uStub * mix(1.0 - abs(dot(axis, uDepth)), 1.0, uFreeAmt);
  vec3 tip = world + axis * len;
  if (!inCube(world) || !inCube(tip) || len < 0.001) { hide(); return; }
  vec3 w = aStub.y > 0.5 ? tip : world;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  float a = nodeAlpha(world, length((viewMatrix * vec4(world, 1.0)).xyz));
  if (a <= 0.0) { hide(); return; }
  gl_Position = projectionMatrix * mv;
  vAlpha = a;
  vColor = uBaseColor;
}
`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = 1.0 - smoothstep(0.55, 1.0, d);
  if (vAlpha * soft < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha * soft);
}
`

const FRAG_STUB = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`

export class AheadDots {
  private scene: Scene
  private lattice: Points
  private stubs: LineSegments
  private material: ShaderMaterial
  private stubMaterial: ShaderMaterial
  private spacing: number
  private centers: boolean

  private readonly uHead = new Vector3()
  private readonly uDir = new Vector3()
  private readonly uA = new Vector3()
  private readonly uB = new Vector3()
  private readonly uDepth = new Vector3()
  private readonly uAnchor = new Vector3()

  constructor(scene: Scene, config: Config) {
    this.scene = scene
    this.spacing = Math.max(1, Math.round(config.hints.latticeStep))
    this.centers = config.hints.latticeAt === 'centers'
    const centers = this.centers
    const N = this.spacing

    // Индексы узлов от якоря. Диапазоны в узлах с запасом +1 на сдвиг якоря.
    const latN = Math.ceil(LATERAL_CELLS / N) + 1
    const behindN = Math.ceil(BEHIND_CELLS / N) + 1
    const aheadN = Math.ceil(AHEAD_CELLS / N) + 1
    const side = 2 * latN + 1
    const depthCount = behindN + aheadN + 1
    const nodes = side * side * depthCount
    const pos = new Float32Array(nodes * 3)
    const stubPos = new Float32Array(nodes * 12 * 3)
    const stubAttr = new Float32Array(nodes * 12 * 2)
    let o = 0
    let so = 0
    let sa = 0
    for (let a = -latN; a <= latN; a++) {
      for (let b = -latN; b <= latN; b++) {
        for (let k = -behindN; k <= aheadN; k++) {
          pos[o++] = a
          pos[o++] = b
          pos[o++] = k
          for (let ax = 0; ax < 6; ax++) {
            for (let end = 0; end < 2; end++) {
              stubPos[so++] = a
              stubPos[so++] = b
              stubPos[so++] = k
              stubAttr[sa++] = ax
              stubAttr[sa++] = end
            }
          }
        }
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const uniforms = {
        uHead: { value: this.uHead },
        uDir: { value: this.uDir },
        uA: { value: this.uA },
        uB: { value: this.uB },
        uDepth: { value: this.uDepth },
        uAnchor: { value: this.uAnchor },
        uFreeAmt: { value: 0 },
        uSize: { value: 1 },
        uPxScale: { value: 400 },
        uMaxPx: { value: MAX_PX },
        uSpacing: { value: N },
        uLo: { value: centers ? 0 : -0.5 },
        uCenters: { value: centers ? 1 : 0 },
        uLatR: { value: LATERAL_CELLS },
        uBehind: { value: BEHIND_CELLS },
        uAhead: { value: AHEAD_CELLS },
        uBaseSize: { value: DOT_BASE_SIZE },
        uMinPx: { value: MIN_PX },
        uBaseAlpha: { value: DOT_BASE_ALPHA },
        uBaseColor: { value: DOT_BASE_COLOR },
        uStub: { value: STUB_CELLS },
        uFadeFull: { value: FADE_FULL_CELLS },
    }
    this.material = new ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })
    this.lattice = new Points(g, this.material)
    this.lattice.frustumCulled = false
    this.scene.add(this.lattice)

    const sg = new BufferGeometry()
    sg.setAttribute('position', new Float32BufferAttribute(stubPos, 3))
    sg.setAttribute('aStub', new Float32BufferAttribute(stubAttr, 2))
    // Те же униформы (по ссылке): update() трогает их один раз на оба слоя.
    this.stubMaterial = new ShaderMaterial({
      uniforms,
      vertexShader: VERT_STUB,
      fragmentShader: FRAG_STUB,
      transparent: true,
      depthWrite: false,
    })
    this.stubs = new LineSegments(sg, this.stubMaterial)
    this.stubs.frustumCulled = false
    this.scene.add(this.stubs)
  }

  /** Высота буфера кадра в пикселях (для размера точек). Холодный путь: init и resize. */
  setViewportHeight(pixels: number): void {
    this.material.uniforms['uPxScale']!.value = pixels * 0.5
  }

  /**
   * Кадр: без новых объектов, только униформы. (dx,dy,dz) — единичное
   * направление хода, (px,py,pz) — ось глубины экрана, (hx,hy,hz) — голова.
   */
  update(
    size: number,
    hx: number,
    hy: number,
    hz: number,
    dx: number,
    dy: number,
    dz: number,
    px: number,
    py: number,
    pz: number,
    freeAmount: number,
  ): void {
    const N = this.spacing
    this.uHead.set(hx, hy, hz)
    this.uDir.set(dx, dy, dz)
    // Якорь: узел решётки (угол клетки k*N - 0.5 или центр k*N), ближайший к голове.
    const sh = this.centers ? 0 : 0.5
    this.uAnchor.set(
      Math.round((hx + sh) / N) * N - sh,
      Math.round((hy + sh) / N) * N - sh,
      Math.round((hz + sh) / N) * N - sh,
    )
    // Две оси поперёк движения (любые ортогональные единичные).
    const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2
    this.uA.set(0, 0, 0)
    this.uB.set(0, 0, 0)
    if (axis === 0) {
      this.uA.y = 1
      this.uB.z = 1
    } else if (axis === 1) {
      this.uA.z = 1
      this.uB.x = 1
    } else {
      this.uA.x = 1
      this.uB.y = 1
    }
    this.uDepth.set(px, py, pz)
    const u = this.material.uniforms
    u['uFreeAmt']!.value = freeAmount
    u['uSize']!.value = size
  }

  dispose(): void {
    this.scene.remove(this.lattice)
    this.lattice.geometry.dispose()
    this.material.dispose()
    this.scene.remove(this.stubs)
    this.stubs.geometry.dispose()
    this.stubMaterial.dispose()
  }
}
