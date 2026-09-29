// Вид змейки «Направляющие хвоста» (магазин, snakeSkin = tailGuides). Идея дизайнера: видеть, куда идёт хвост.
// В объёме цепочка каркасных кубиков читается плохо: непонятно, как тело соединено и куда свободна клетка за хвостом.
// Поэтому поверх обычных сегментов рисуется:
//   1. ПОЗВОНОЧНИК: тонкая балка между центрами соседних сегментов (сквозь пустые кубики видно путь тела, повороты и подъёмы);
//   2. СТРЕЛКИ НА ХВОСТЕ: на последних TAIL_ARROWS звеньях по конусу, острием в сторону головы. Хвост всегда едет по своему телу,
//      так что стрелки показывают клетки, которые освободятся в ближайшие такты, и направление хода в них.
// Только вид: размер клетки, хитбоксы и скорость не меняются, ядро не знает об этом (читаются позиции, которые SnakeView уже собрал).
// Цвет звеньев — цвет тела, приглушённый (ниже порога bloom: не гало, а тонкая нить). Обновление кадра без аллокаций:
// Matrix4/Quaternion/Vector3/Color заведены заранее, рост пула — только в ensureCapacity() (холодный путь).

import { BoxGeometry, ConeGeometry, Color, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Scene } from 'three'
import { InstancedPool } from './pool'

/** Толщина балки позвоночника, клетки (балка тела 0.1). */
const LINK_BEAM = 0.09
/**
 * Позвоночник светлее тела (доля белого) и приглушён: иначе сливается с рёбрами кубиков того же оттенка.
 * Яркость у самого яркого тела ≈ 0.7, ниже порога bloom (0.75): нить, а не гало.
 */
const LINK_WHITE = 0.55
const LINK_DIM = 0.6
/** Сколько последних звеньев хвоста получают стрелку. */
export const TAIL_ARROWS = 3
const ARROW_RADIUS = 0.17
const ARROW_LENGTH = 0.42
const ARROW_SEGMENTS = 8
/** Стрелки ярче звена: тот же цвет тела/хвоста с множителем. */
const ARROW_BRIGHTNESS = 1.8

const EPS = 1e-6

export class TailGuides {
  private readonly links: InstancedPool
  private readonly arrows: InstancedPool
  private readonly m = new Matrix4()
  private readonly q = new Quaternion()
  private readonly pos = new Vector3()
  private readonly dir = new Vector3()
  private readonly scl = new Vector3()
  private readonly color = new Color()
  private readonly zAxis = new Vector3(0, 0, 1)
  private readonly white = new Color(1, 1, 1)

  constructor(scene: Scene) {
    this.links = new InstancedPool(scene, new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), 8)
    const cone = new ConeGeometry(ARROW_RADIUS, ARROW_LENGTH, ARROW_SEGMENTS, 1)
    cone.rotateX(Math.PI / 2) // ось конуса +Y -> +Z: острие по направлению, как у балки
    this.arrows = new InstancedPool(scene, cone, new MeshBasicMaterial(), TAIL_ARROWS)
  }

  /** Холодный путь: ёмкость под длину змейки (звеньев на одно меньше, чем сегментов). */
  ensureCapacity(length: number): void {
    this.links.ensureCapacity(Math.max(1, length - 1))
  }

  /**
   * Кадр. gx/gy/gz — позиции сегментов (0 — голова) после сглаживания хода, gk — их масштаб (fade у камеры),
   * bodyColor/tailColor — палитра, glow — множитель яркости тела (SNAKE_BODY_GLOW_BOOST).
   */
  update(length: number, gx: Float32Array, gy: Float32Array, gz: Float32Array, gk: Float32Array, bodyColor: Color, tailColor: Color, glow: number, denom: number): void {
    const n = Math.max(0, length - 1)
    this.links.setCount(n)
    const arrowsFrom = Math.max(0, n - TAIL_ARROWS)
    this.arrows.setCount(Math.max(0, n - arrowsFrom))
    for (let i = 0; i < n; i++) {
      // Звено между сегментами i и i + 1, направление хода — от хвоста к голове (от i + 1 к i).
      const ax = gx[i]!
      const ay = gy[i]!
      const az = gz[i]!
      const bx = gx[i + 1]!
      const by = gy[i + 1]!
      const bz = gz[i + 1]!
      this.dir.set(ax - bx, ay - by, az - bz)
      const len = this.dir.length()
      const k = Math.min(gk[i]!, gk[i + 1]!)
      this.color.copy(bodyColor).lerp(tailColor, (i + 1) / denom).multiplyScalar(glow).lerp(this.white, LINK_WHITE)
      if (len < EPS) {
        // Вырожденный случай (сегменты совпали): звено нулевое, скрыть.
        this.m.makeScale(0, 0, 0)
        this.links.mesh.setMatrixAt(i, this.m)
        this.links.mesh.setColorAt(i, this.color)
        continue
      }
      this.dir.divideScalar(len)
      this.q.setFromUnitVectors(this.zAxis, this.dir)
      this.pos.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
      this.scl.set(LINK_BEAM * k, LINK_BEAM * k, len)
      this.m.compose(this.pos, this.q, this.scl)
      this.links.mesh.setMatrixAt(i, this.m)
      this.links.mesh.setColorAt(i, this.color.multiplyScalar(LINK_DIM))
      if (i >= arrowsFrom) {
        this.scl.set(k, k, k)
        this.m.compose(this.pos, this.q, this.scl)
        const j = i - arrowsFrom
        this.arrows.mesh.setMatrixAt(j, this.m)
        this.arrows.mesh.setColorAt(j, this.color.multiplyScalar(ARROW_BRIGHTNESS / LINK_DIM))
      }
    }
    this.links.markDirty()
    this.arrows.markDirty()
  }

  dispose(): void {
    this.links.dispose()
    this.arrows.dispose()
  }
}
