// Каркас куба: только двенадцать рёбер, ярким неоном, внутри пусто.
// Рёбра — тонкие параллелепипеды (MeshBasicMaterial, цвет ярче 1 -> выше порога
// bloom -> светятся): линия в 1 px на телефоне не читается, а это теперь
// единственная геометрия, по которой видно пространство.
//
// Проекция головы (по желанию, SHOW_HEAD_PROJECTION): на каждой из шести стенок
// перекрестие и квадрат-«тень» вокруг клетки головы, очень тихо (тише рёбер).
// Выключается одной константой. В фазе plane стенки между камерой и полем
// скрываются вместе с проекцией; в фазе free не скрываются никогда.
// Всё строится один раз (событие 'started'); в кадре только update(), без аллокаций.

import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  LineSegments,
  ShaderMaterial,
  type Scene,
} from 'three'
import {
  CUBE_EDGE_COLOR,
  CUBE_EDGE_THICKNESS_PER_SIZE,
  CUBE_EDGE_THICKNESS_MIN,
  CUBE_EDGE_THICKNESS_MAX,
  MARK_COLOR,
  MARK_LINE_ALPHA,
  MARK_SQUARE_ALPHA,
} from './palette'

// Проекция головы на стенки: включена/выключена одной правкой.
const SHOW_HEAD_PROJECTION = true
// Оформительские константы, не числа баланса.
const MARK_SIZE_SMALL_MAX = 20
// Затухание альфы проекции с расстоянием: exp(-d / L), L = size * k в пределах [min, max].
export const FALLOFF_PER_SIZE = 0.6
export const FALLOFF_MIN = 12
export const FALLOFF_MAX = 40
// Ближе этого расстояния (клеток) линии растворяются, не лезут в глаз.
export const NEAR_FADE_CELLS = 2.5
// Проекция головы: квадрат-тень (полуширина, клеток), зазор от стенки внутрь
// (против z-fighting с сеткой) и доля яркости на любом удалении.
const MARK_HALF_SMALL = 0.5
const MARK_HALF_LARGE = 1.5
const MARK_INSET = 0.03
const MARK_FAR_FLOOR = 0.7

// 2 линии перекрестия + 4 стороны квадрата = 6 отрезков = 12 вершин.
const MARK_VERTS = 12

export const VERT = /* glsl */ `
attribute float aMajor;
varying float vMajor;
varying float vDist;
void main() {
  vMajor = aMajor;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDist = distance(world.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uMinor;
uniform float uMajor;
uniform float uFalloff;
uniform float uFloor;
uniform float uNearFade;
varying float vMajor;
varying float vDist;
void main() {
  float base = mix(uMinor, uMajor, vMajor);
  float depthFade = uFloor + (1.0 - uFloor) * exp(-vDist / uFalloff);
  float nearFade = smoothstep(0.0, uNearFade, vDist);
  gl_FragColor = vec4(uColor, base * depthFade * nearFade);
}
`

export class CubeFrame {
  private scene: Scene
  private edges: Mesh[] = []
  private edgeGeometry: BoxGeometry | null = null
  private edgeMaterial: MeshBasicMaterial | null = null
  private marks: LineSegments[] = []
  private markPos: Float32Array[] = []
  private markMaterial: ShaderMaterial | null = null
  private markHalf = MARK_HALF_SMALL
  private markX = NaN
  private markY = NaN
  private markZ = NaN
  private currentSize = -1

  constructor(scene: Scene) {
    this.scene = scene
  }

  /** Холодный путь: вызывать из handle('started', s), не из render(). */
  setSize(size: number): void {
    if (size === this.currentSize) return
    this.currentSize = size
    this.disposeAll()
    this.buildEdges(size)
    if (SHOW_HEAD_PROJECTION) this.buildMarks(size)
  }

  /** Двенадцать рёбер: по четыре вдоль каждой оси, внешняя рамка от -0.5 до size - 0.5. */
  private buildEdges(size: number): void {
    const t = Math.min(
      CUBE_EDGE_THICKNESS_MAX,
      Math.max(CUBE_EDGE_THICKNESS_MIN, size * CUBE_EDGE_THICKNESS_PER_SIZE),
    )
    const len = size + t
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshBasicMaterial({ color: CUBE_EDGE_COLOR })
    this.edgeGeometry = geometry
    this.edgeMaterial = material
    const lo = -0.5
    const hi = size - 0.5
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3
      const v = (axis + 2) % 3
      for (let iu = 0; iu < 2; iu++) {
        for (let iv = 0; iv < 2; iv++) {
          const m = new Mesh(geometry, material)
          const sc = [t, t, t]
          sc[axis] = len
          m.scale.set(sc[0]!, sc[1]!, sc[2]!)
          const pos = [0, 0, 0]
          pos[axis] = (size - 1) / 2
          pos[u] = iu === 0 ? lo : hi
          pos[v] = iv === 0 ? lo : hi
          m.position.set(pos[0]!, pos[1]!, pos[2]!)
          m.frustumCulled = false
          this.edges.push(m)
          this.scene.add(m)
        }
      }
    }
  }

  /** Холодный путь: заранее создаёт шесть проекций головы (индекс как у стенок). */
  private buildMarks(size: number): void {
    this.markHalf = size <= MARK_SIZE_SMALL_MAX ? MARK_HALF_SMALL : MARK_HALF_LARGE
    const mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: MARK_COLOR },
        uMinor: { value: MARK_LINE_ALPHA },
        uMajor: { value: MARK_SQUARE_ALPHA },
        uFalloff: { value: Math.min(FALLOFF_MAX, Math.max(FALLOFF_MIN, size * FALLOFF_PER_SIZE)) },
        uFloor: { value: MARK_FAR_FLOOR },
        uNearFade: { value: NEAR_FADE_CELLS },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })
    this.markMaterial = mat
    // aMajor: 0 — линии перекрестия, 1 — квадрат.
    const kind = new Float32Array(MARK_VERTS)
    for (let i = 4; i < MARK_VERTS; i++) kind[i] = 1
    for (let i = 0; i < 6; i++) {
      const arr = new Float32Array(MARK_VERTS * 3)
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(arr, 3))
      g.setAttribute('aMajor', new Float32BufferAttribute(kind, 1))
      const ls = new LineSegments(g, mat)
      ls.frustumCulled = false
      ls.renderOrder = 1
      this.marks.push(ls)
      this.markPos.push(arr)
      this.scene.add(ls)
    }
    this.markX = NaN
  }

  /** Перекладывает вершины проекции на стенку (axis, side) под клетку (hu, hv). */
  private writeMark(idx: number, axis: number, side: number, hu: number, hv: number): void {
    const arr = this.markPos[idx]!
    const u = (axis + 1) % 3
    const v = (axis + 2) % 3
    const lo = -0.5
    const hi = this.currentSize - 0.5
    const w = side === 0 ? lo + MARK_INSET : hi - MARK_INSET
    const r = this.markHalf
    // Отрезки (u0,v0,u1,v1): перекрестие, затем квадрат.
    let o = 0
    for (let seg = 0; seg < 6; seg++) {
      let u0: number, v0: number, u1: number, v1: number
      switch (seg) {
        case 0: u0 = lo; v0 = hv; u1 = hi; v1 = hv; break
        case 1: u0 = hu; v0 = lo; u1 = hu; v1 = hi; break
        case 2: u0 = hu - r; v0 = hv - r; u1 = hu + r; v1 = hv - r; break
        case 3: u0 = hu + r; v0 = hv - r; u1 = hu + r; v1 = hv + r; break
        case 4: u0 = hu + r; v0 = hv + r; u1 = hu - r; v1 = hv + r; break
        default: u0 = hu - r; v0 = hv + r; u1 = hu - r; v1 = hv - r; break
      }
      for (let e = 0; e < 2; e++) {
        arr[o + axis] = w
        arr[o + u] = e === 0 ? u0 : u1
        arr[o + v] = e === 0 ? v0 : v1
        o += 3
      }
    }
    const attr = this.marks[idx]!.geometry.getAttribute('position')
    attr.needsUpdate = true
  }

  /**
   * Кадр, без аллокаций. Фаза plane (freeAmount < 0.5): камера снаружи куба —
   * стенки между ней и полем скрыты, чтобы не рисоваться поверх змейки.
   * Фаза free: не скрывается ничего. hx/hy/hz — клетка головы (из queries.head).
   */
  update(
    camX: number,
    camY: number,
    camZ: number,
    freeAmount: number,
    hx: number,
    hy: number,
    hz: number,
  ): void {
    if (this.edges.length === 0 || !SHOW_HEAD_PROJECTION) return
    const hi = this.currentSize - 0.5
    const canHide = freeAmount < 0.5
    for (let axis = 0; axis < 3; axis++) {
      const c = axis === 0 ? camX : axis === 1 ? camY : camZ
      const showLo = !(canHide && c < -0.5)
      const showHi = !(canHide && c > hi)
      this.marks[axis * 2]!.visible = showLo
      this.marks[axis * 2 + 1]!.visible = showHi
    }
    if (hx !== this.markX || hy !== this.markY || hz !== this.markZ) {
      this.markX = hx
      this.markY = hy
      this.markZ = hz
      for (let axis = 0; axis < 3; axis++) {
        const u = axis === 0 ? hy : axis === 1 ? hz : hx
        const v = axis === 0 ? hz : axis === 1 ? hx : hy
        this.writeMark(axis * 2, axis, 0, u, v)
        this.writeMark(axis * 2 + 1, axis, 1, u, v)
      }
    }
  }

  private disposeAll(): void {
    for (const e of this.edges) this.scene.remove(e)
    this.edges.length = 0
    this.edgeGeometry?.dispose()
    this.edgeGeometry = null
    this.edgeMaterial?.dispose()
    this.edgeMaterial = null
    for (const m of this.marks) {
      this.scene.remove(m)
      m.geometry.dispose()
    }
    this.marks.length = 0
    this.markPos.length = 0
    this.markMaterial?.dispose()
    this.markMaterial = null
  }

  dispose(): void {
    this.disposeAll()
    this.currentSize = -1
  }
}
