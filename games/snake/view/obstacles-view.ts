// Препятствия — неоновая ВНЕШНЯЯ оболочка: сплошные непрозрачные грани + рёбра
// поверх (три draw call: рёбра, грани, прозрачные грани мешающих кубов). Грань рисуется, только
// если соседняя клетка в её сторону свободна; ребро — только настоящий излом
// контура (см. obstacle-shell.ts), так что слипшаяся группа читается одним
// объёмом, а не стопкой проволочных коробок. Оболочка считается один раз на
// 'started' (холодный путь), в кадре не трогается.
// Инстансинг: по инстансу на грань (aCell + aFace) и на ребро (aCenter + aAxis),
// геометрия одна на всех (квад / отрезок), позиции собирает вершинный шейдер.
// Дальние растворяются в общем тумане сцены (palette.ts: createFog/fogUniforms), чтобы плотный лес
// не сливался в кашу: ближние читаются опасностью, дальние — глубиной. Своей кривой затухания нет.

import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  DataTexture,
  DoubleSide,
  Mesh,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Scene,
} from 'three'
import type { GameState } from '../core/state'
import { cubeSize, forEachObstacle } from '../core/queries'
import { computeShell } from './obstacle-shell'
import {
  OBSTACLE_COLOR,
  OBSTACLE_FACE_BRIGHTNESS,
  OBSTACLE_FACE_NEG_SHADE,
  OBSTACLE_FACE_SHADE_X,
  OBSTACLE_FACE_SHADE_Y,
  OBSTACLE_FACE_SHADE_Z,
  OBSTACLE_GHOST_ALPHA,
  fogUniforms,
} from './palette'

// Габарит клетки-препятствия; чуть меньше 1, чтобы оболочка не совпадала с плоскостью стенки куба.
// Это габарит ПЛОСКОСТЕЙ граней и рёбер-контуров. Щель между соседями закрывают не им,
// а вылет кромок граней к соседу (obstacle-shell.ts): контур и одиночный куб не меняются.
const OBSTACLE_SCALE = 0.98
// Ширина рёбер-контуров (оформительские числа). Минимум в CSS-пикселях: было 1 px линией GL, дизайнер
// жаловался на тонкие и рвущиеся грани. Мировая ширина в клетках — чтобы вблизи ребро было объёмнее.
const OBSTACLE_EDGE_MIN_PX = 2.2
const OBSTACLE_EDGE_WORLD_W = 0.04
// Сдвиг ленты к камере по глубине, в её мировых ширинах: 0 — без сдвига (рёбра выедаются гранями).
const OBSTACLE_EDGE_DEPTH_K = 3
const COMMON = /* glsl */ `
uniform float uHalf;
uniform vec3 uHead;
#include <fog_pars_vertex>
`

// Рёбра: aCenter — центр отрезка длиной в клетку, aAxis — вдоль какой оси (0/1/2).
// НЕ линии GL (те всегда 1 px и на дальних препятствиях рвутся и мерцают), а экранная лента:
// на инстанс ребра — квад position = (вдоль [-0.5, 0.5], сторона ±1). Концы отрезка переводятся
// в пиксели, лента расширяется на полуширину поперёк и чуть вдоль (стыки в углах закрыты).
// Ширина — не меньше uMinPx (в физических пикселях: OBSTACLE_EDGE_MIN_PX * pixelRatio) и не меньше
// мировой uWorldW, спроецированной на экран: вблизи ребро толще, вдали не тоньше пикселей,
// которые MSAA композера способно сгладить. Отрезок обрезается по ближней плоскости.
const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute float aAxis;
uniform vec2 uRes;
uniform float uMinPx;
uniform float uWorldW;
uniform float uDepthK;
${COMMON}
void main() {
  vec3 dirv = aAxis < 0.5 ? vec3(1.0, 0.0, 0.0) : (aAxis < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  vec3 wa = aCenter - 0.5 * dirv;
  vec3 wb = aCenter + 0.5 * dirv;
  vec4 ca = projectionMatrix * (viewMatrix * vec4(wa, 1.0));
  vec4 cb = projectionMatrix * (viewMatrix * vec4(wb, 1.0));
  const float NEAR_W = 0.05;
  if (ca.w < NEAR_W && cb.w < NEAR_W) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 ca0 = ca;
  if (ca.w < NEAR_W) ca = mix(ca, cb, (NEAR_W - ca.w) / (cb.w - ca.w));
  if (cb.w < NEAR_W) cb = mix(cb, ca0, (NEAR_W - cb.w) / (ca0.w - cb.w));
  vec2 half_ = 0.5 * uRes;
  vec2 sa = ca.xy / ca.w * half_;
  vec2 sb = cb.xy / cb.w * half_;
  vec2 d = sb - sa;
  float dl = length(d);
  d = dl > 1e-4 ? d / dl : vec2(1.0, 0.0);
  vec2 nrm = vec2(-d.y, d.x);
  bool atB = position.x > 0.0;
  vec4 c = atB ? cb : ca;
  vec2 sc = atB ? sb : sa;
  float wpx = max(uMinPx, uWorldW * projectionMatrix[1][1] * half_.y / c.w);
  vec2 sp = sc + d * ((atB ? 0.5 : -0.5) * wpx) + nrm * (position.y * 0.5 * wpx);
  // Ребро лежит на стыке граней, а лента шире линии: её половина оказывается «внутри» куба или за
  // гранью, которая на вогнутом изломе или при скользящем угле ближе к камере по глубине, и depth-тест
  // выедает ленту. polygonOffset считается от наклона полигона граней и ленте по ширине не помогает,
  // поэтому лента сдвигается к камере на вид-пространственную глубину, пропорциональную её ширине
  // в мире (uDepthK ширин): вдали ширина в мире больше, и запас растёт вместе с ней.
  float bias = uDepthK * wpx * c.w / (half_.y * projectionMatrix[1][1]);
  float wv = max(c.w - bias, 0.02);
  float zc = max((c.z + projectionMatrix[2][2] * bias) / wv, -1.0) * c.w;
  gl_Position = vec4(sp / half_ * c.w, zc, c.w);
  vec4 mvPosition = viewMatrix * vec4(atB ? wb : wa, 1.0);
  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
uniform vec3 uColor;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <fog_fragment>
}
`

// Грани: квад на грань. aFace: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z; position = (u, v, 0) в ±1.
// Касательные — циклические оси (a+1, a+2); для отрицательной стороны u зеркалится,
// чтобы обход остался против часовой снаружи (FrontSide отсекает задние грани).
//
// Непрозрачность и «мешающие» кубы. Два меша на одних и тех же инстансах:
//   opaque — сплошные грани с записью глубины (проход непрозрачных);
//   ghost  — те же грани прозрачные, без записи глубины, рисуются ПОСЛЕ непрозрачных
//            (transparent: true, renderOrder выше) — глубина уже готова, порядок
//            между прозрачными не важен, их единицы.
// Степень «призрачности» клетки g (0..1) — из текстуры uGhostTex (один байт на клетку
// оболочки; пишет CPU только для клеток рядом с линией камера-голова) и, пока камера
// ещё не улетела за голову, из «плоской» фазы: клетки ближе к камере, чем слой головы,
// прозрачны на вес (1 - freeAmount). Меш opaque прячет грань при g > 0, ghost — при
// g == 0; на границе альфа ghost = mix(1, GHOST_ALPHA, g) ~ 1, поэтому переход
// без скачка: клетка плавно тает из сплошной.
const FACE_VERT = /* glsl */ `
attribute vec3 aCell;
attribute float aFace;
attribute float aId;
uniform sampler2D uGhostTex;
uniform float uTexW;
uniform vec3 uDepthAxis;
uniform float uFree;
uniform float uGhostPass;   // 0 — непрозрачный проход, 1 — прозрачный
uniform float uGhostAlpha;
uniform vec3 uShade;        // множители яркости по осям x, y, z
uniform float uNegShade;
varying float vShade;
varying float vAlpha;
${COMMON}
// Вылет кромки грани от центра клетки: выпуклая — uHalf, плоская — 0.5, вогнутая — 1 - uHalf.
float reachOf(float st) {
  return st < 0.5 ? uHalf : (st < 1.5 ? 0.5 : 1.0 - uHalf);
}
void main() {
  int id = int(aId + 0.5);
  int w = int(uTexW);
  int row = id / w;
  float g = texelFetch(uGhostTex, ivec2(id - row * w, row), 0).r;
  float front = step(0.5, dot(aCell - uHead, uDepthAxis));
  g = max(g, front * (1.0 - uFree));
  bool isGhost = g > 0.001;
  if (isGhost != (uGhostPass > 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vShade = 0.0;
    vAlpha = 0.0;
    return;
  }
  // aFace = грань + 6 * (четыре состояния кромок по основанию 3), см. obstacle-shell.ts.
  float code = floor((aFace + 0.5) / 6.0);
  float face = aFace - 6.0 * code;
  float a = floor(face * 0.5);
  float s = mod(face, 2.0) < 0.5 ? 1.0 : -1.0;
  vec3 e0 = a < 0.5 ? vec3(1.0, 0.0, 0.0) : (a < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  vec3 e1 = a < 0.5 ? vec3(0.0, 1.0, 0.0) : (a < 1.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0));
  vec3 e2 = a < 0.5 ? vec3(0.0, 0.0, 1.0) : (a < 1.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0));
  // Плоскость грани на uHalf от центра; кромки уходят к соседу (см. reachOf), чтобы
  // соседние кубы смыкались без щели. wu — знак вдоль e1 в мире (для s < 0 зеркален).
  float wu = s * position.x;
  float wv = position.y;
  float r1 = reachOf(wu > 0.0 ? mod(code, 3.0) : mod(floor(code / 3.0), 3.0));
  float r2 = reachOf(wv > 0.0 ? mod(floor(code / 9.0), 3.0) : floor(code / 27.0));
  vec3 world = aCell + uHalf * s * e0 + wu * r1 * e1 + wv * r2 * e2;
  vShade = (a < 0.5 ? uShade.x : (a < 1.5 ? uShade.y : uShade.z)) * (s > 0.0 ? 1.0 : uNegShade);
  vAlpha = mix(1.0, uGhostAlpha, g);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`
const FACE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFaceK;
varying float vShade;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor * (uFaceK * vShade), vAlpha);
  #include <fog_fragment>
}
`

// Оформительские константы «мешающих» кубов (не числа баланса).
const OCCLUDER_RADIUS = 1.0 // клетки, чьи центры ближе радиуса к линии взгляда
const OCCLUDER_START = 1.0 // отступ от головы к камере: сама голова и соседи у неё не тают
const OCCLUDER_STEP = 0.5 // шаг выборки вдоль отрезка камера-голова
const OCCLUDER_REACH = 24 // дальше этого от головы не ищем (в plane работает вес фазы)
const OCCLUDER_MAX_ACTIVE = 2048 // потолок одновременно тающих клеток
const GHOST_FADE_MS = 140 // постоянная времени плавного перехода
const GHOST_TEX_W = 256

export class ObstaclesView {
  private scene: Scene
  private lines: Mesh | null = null
  private readonly res = new Vector2(1, 1)
  private material: ShaderMaterial | null = null
  private opaque: Mesh | null = null
  private ghost: Mesh | null = null
  private faceMaterials: ShaderMaterial[] = []
  private solid = new Set<number>()
  private solidSize = 1

  // Клетки оболочки: номер клетки по ключу, призрачность, отметка кадра, активный список.
  private cellId = new Int32Array(0)
  private ghostLevel = new Float32Array(0)
  private stamp = new Int32Array(0)
  private inActive = new Uint8Array(0)
  private active = new Int32Array(OCCLUDER_MAX_ACTIVE)
  private activeCount = 0
  private frameNo = 0
  private ghostTex: DataTexture | null = null
  private ghostBytes = new Uint8Array(0)
  private readonly uHead = new Vector3()
  private readonly uDepthAxis = new Vector3()
  private readonly frameUniforms = {
    uDepthAxis: { value: this.uDepthAxis },
    uFree: { value: 1 },
  }

  /** Сколько граней и рёбер в оболочке последней сборки (для замеров). */
  shellFaces = 0
  shellEdges = 0
  /** Сколько клеток сейчас тает или прозрачно (для замеров). */
  get ghostCells(): number {
    return this.activeCount
  }

  constructor(scene: Scene) {
    this.scene = scene
  }

  /** Холодный путь: вызывать из handle('started', s), не из render(). */
  rebuild(s: GameState): void {
    this.disposeLines()
    const n = cubeSize(s)
    this.solidSize = n
    this.solid.clear()
    forEachObstacle(s, (x, y, z) => {
      this.solid.add(x + n * (y + n * z))
    })
    const half = OBSTACLE_SCALE / 2
    const shell = computeShell(this.solid, n, half)
    this.shellFaces = shell.faceCount
    this.shellEdges = shell.edgeCount

    const uniforms = {
      ...fogUniforms(),
      uColor: { value: OBSTACLE_COLOR },
      uHead: { value: this.uHead },
      uHalf: { value: half },
    }

    // Контур: инстанс на ребро, база — квад (вдоль отрезка x сторона), позиции собирает вершинный шейдер.
    const geometry = new InstancedBufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([-0.5, -1, 0, 0.5, -1, 0, 0.5, 1, 0, -0.5, -1, 0, 0.5, 1, 0, -0.5, 1, 0], 3),
    )
    const edgeBuf = new InstancedInterleavedBuffer(shell.edges, 4)
    geometry.setAttribute('aCenter', new InterleavedBufferAttribute(edgeBuf, 3, 0))
    geometry.setAttribute('aAxis', new InterleavedBufferAttribute(edgeBuf, 1, 3))
    geometry.instanceCount = shell.edgeCount
    const edgeUniforms = {
      ...uniforms,
      uRes: { value: this.res },
      uMinPx: { value: OBSTACLE_EDGE_MIN_PX },
      uWorldW: { value: OBSTACLE_EDGE_WORLD_W },
      uDepthK: { value: OBSTACLE_EDGE_DEPTH_K },
    }
    this.material = new ShaderMaterial({ uniforms: edgeUniforms, vertexShader: VERT, fragmentShader: FRAG, fog: true, side: DoubleSide })
    const lines = new Mesh(geometry as BufferGeometry, this.material)
    lines.frustumCulled = false
    // Размер буфера кадра (физические px) и pixelRatio — перед отрисовкой, без аллокаций.
    const minPx = edgeUniforms.uMinPx
    lines.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(this.res)
      minPx.value = OBSTACLE_EDGE_MIN_PX * renderer.getPixelRatio()
    }
    this.lines = lines
    this.scene.add(lines)

    // Клетки оболочки: грани одной клетки идут подряд (computeShell), номер клетки —
    // порядковый по первому появлению.
    const nn = n * n * n
    this.cellId = new Int32Array(nn).fill(-1)
    const ids = new Float32Array(shell.faceCount)
    let cells = 0
    for (let i = 0; i < shell.faceCount; i++) {
      const cx = shell.faces[i * 4]!
      const cy = shell.faces[i * 4 + 1]!
      const cz = shell.faces[i * 4 + 2]!
      const key = cx + n * (cy + n * cz)
      let id = this.cellId[key]!
      if (id < 0) {
        id = cells++
        this.cellId[key] = id
      }
      ids[i] = id
    }
    this.ghostLevel = new Float32Array(cells)
    this.stamp = new Int32Array(cells).fill(-1)
    this.inActive = new Uint8Array(cells)
    this.activeCount = 0
    const rows = Math.max(1, Math.ceil(cells / GHOST_TEX_W))
    this.ghostBytes = new Uint8Array(GHOST_TEX_W * rows)
    const tex = new DataTexture(this.ghostBytes, GHOST_TEX_W, rows, RedFormat, UnsignedByteType)
    tex.minFilter = NearestFilter
    tex.magFilter = NearestFilter
    tex.generateMipmaps = false
    tex.needsUpdate = true
    this.ghostTex = tex

    // Грани: инстанс на грань, база — квад из двух треугольников. Геометрия общая
    // для непрозрачного и прозрачного мешей.
    const fillGeometry = new InstancedBufferGeometry()
    fillGeometry.setAttribute(
      'position',
      new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
    )
    const faceBuf = new InstancedInterleavedBuffer(shell.faces, 4)
    fillGeometry.setAttribute('aCell', new InterleavedBufferAttribute(faceBuf, 3, 0))
    fillGeometry.setAttribute('aFace', new InterleavedBufferAttribute(faceBuf, 1, 3))
    fillGeometry.setAttribute('aId', new InstancedBufferAttribute(ids, 1))
    fillGeometry.instanceCount = shell.faceCount
    const shared = {
      ...uniforms,
      uDepthAxis: this.frameUniforms.uDepthAxis,
      uFree: this.frameUniforms.uFree,
      uGhostTex: { value: tex },
      uTexW: { value: GHOST_TEX_W },
      uGhostAlpha: { value: OBSTACLE_GHOST_ALPHA },
      uShade: { value: new Vector3(OBSTACLE_FACE_SHADE_X, OBSTACLE_FACE_SHADE_Y, OBSTACLE_FACE_SHADE_Z) },
      uNegShade: { value: OBSTACLE_FACE_NEG_SHADE },
      uFaceK: { value: OBSTACLE_FACE_BRIGHTNESS },
    }
    // polygonOffset: грани чуть глубже, чтобы рёбра на их границах не мерцали (z-fight).
    const opaqueMat = new ShaderMaterial({
      uniforms: { ...shared, uGhostPass: { value: 0 } },
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    const ghostMat = new ShaderMaterial({
      uniforms: { ...shared, uGhostPass: { value: 1 } },
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      fog: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    this.faceMaterials = [opaqueMat, ghostMat]
    const opaque = new Mesh(fillGeometry as BufferGeometry, opaqueMat)
    opaque.frustumCulled = false
    this.opaque = opaque
    this.scene.add(opaque)
    const ghost = new Mesh(fillGeometry as BufferGeometry, ghostMat)
    ghost.frustumCulled = false
    ghost.renderOrder = 1
    this.ghost = ghost
    this.scene.add(ghost)
  }

  /**
   * Кадр, без аллокаций: какие кубы мешают обзору и насколько они прозрачны.
   * (cx,cy,cz) — камера, (hx,hy,hz) — голова, (px,py,pz) — ось глубины экрана,
   * freeAmount — 0 в plane, 1 в объёме.
   *
   * «Мешает» — геометрически: центр клетки ближе OCCLUDER_RADIUS к отрезку от
   * точки в OCCLUDER_START от головы к камере. Отрезок обходится с шагом
   * OCCLUDER_STEP, у каждой точки проверяются 27 соседних клеток по массиву cellId
   * (O(1)), а не все препятствия. Уровень g тянется к цели экспонентой.
   */
  update(dtMs: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, px: number, py: number, pz: number, freeAmount: number): void {
    if (!this.ghostTex) return
    this.uHead.set(hx, hy, hz)
    this.uDepthAxis.set(px, py, pz)
    this.frameUniforms.uFree.value = freeAmount
    this.frameNo++
    const n = this.solidSize
    const frameNo = this.frameNo

    // Плоская фаза: камера далеко, прозрачность там даёт вес фазы в шейдере.
    if (freeAmount > 0.5) {
      const vx = cx - hx
      const vy = cy - hy
      const vz = cz - hz
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz)
      if (len > OCCLUDER_START) {
        const ux = vx / len
        const uy = vy / len
        const uz = vz / len
        const reach = Math.min(len, OCCLUDER_REACH)
        const r2 = OCCLUDER_RADIUS * OCCLUDER_RADIUS
        for (let t = OCCLUDER_START; t <= reach; t += OCCLUDER_STEP) {
          const x = hx + ux * t
          const y = hy + uy * t
          const z = hz + uz * t
          const ix = Math.round(x)
          const iy = Math.round(y)
          const iz = Math.round(z)
          for (let oz = -1; oz <= 1; oz++) {
            const kz = iz + oz
            if (kz < 0 || kz >= n) continue
            const dz = kz - z
            for (let oy = -1; oy <= 1; oy++) {
              const ky = iy + oy
              if (ky < 0 || ky >= n) continue
              const dy = ky - y
              for (let ox = -1; ox <= 1; ox++) {
                const kx = ix + ox
                if (kx < 0 || kx >= n) continue
                const dx = kx - x
                if (dx * dx + dy * dy + dz * dz > r2) continue
                const id = this.cellId[kx + n * (ky + n * kz)]!
                if (id < 0 || this.stamp[id] === frameNo) continue
                this.stamp[id] = frameNo
                if (this.inActive[id] === 0 && this.activeCount < OCCLUDER_MAX_ACTIVE) {
                  this.inActive[id] = 1
                  this.active[this.activeCount++] = id
                }
              }
            }
          }
        }
      }
    }

    // Плавный переход активных клеток; остывшие выпадают из списка.
    const k = 1 - Math.exp(-dtMs / GHOST_FADE_MS)
    let changed = false
    for (let i = 0; i < this.activeCount; ) {
      const id = this.active[i]!
      const target = this.stamp[id] === frameNo ? 1 : 0
      let g = this.ghostLevel[id]! + (target - this.ghostLevel[id]!) * k
      if (target === 0 && g < 0.004) g = 0
      else if (target === 1 && g > 0.996) g = 1
      this.ghostLevel[id] = g
      const byte = Math.round(g * 255)
      if (this.ghostBytes[id] !== byte) {
        this.ghostBytes[id] = byte
        changed = true
      }
      if (g === 0 && target === 0) {
        this.inActive[id] = 0
        this.active[i] = this.active[--this.activeCount]!
      } else {
        i++
      }
    }
    if (changed) this.ghostTex.needsUpdate = true
  }

  /** Есть ли препятствие в клетке (набор собирается на 'started'). Без аллокаций. */
  isSolid = (x: number, y: number, z: number): boolean =>
    this.solid.has(x + this.solidSize * (y + this.solidSize * z))

  private disposeLines(): void {
    if (this.lines) {
      this.scene.remove(this.lines)
      this.lines.geometry.dispose()
      this.lines = null
    }
    this.material?.dispose()
    this.material = null
    if (this.opaque) {
      this.scene.remove(this.opaque)
      this.opaque.geometry.dispose()
      this.opaque = null
    }
    if (this.ghost) {
      this.scene.remove(this.ghost)
      this.ghost = null
    }
    for (const m of this.faceMaterials) m.dispose()
    this.faceMaterials = []
    this.ghostTex?.dispose()
    this.ghostTex = null
    this.activeCount = 0
  }

  dispose(): void {
    this.disposeLines()
  }
}
