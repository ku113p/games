// Змейка: тело — InstancedMesh неоновых каркасов-кубиков (только рёбра, середина
// пустая; цвет на инстанс), голова — отдельный каркас-пирамида, повёрнутая по направлению движения (направление = голова - шея,
// берётся из обхода сегментов через queries). Обновление каждый кадр БЕЗ
// аллокаций: Matrix4/Color/Vector3/колбэк создаются один раз, рост пула —
// только в handle().
//
// Читаемость: тело ярко-зелёное -> ярко-голубое (хвост не темнеет), нечётные
// сегменты чуть тусклее. В фазе free сегменты рядом с камерой уменьшаются
// (fade), чтобы не закрывать обзор; вес эффекта задаёт камера (freeAmount).
//
// Змейка рисуется дискретно, по клеткам ядра, такт за тактом: без интерполяции
// и скольжения (решение дизайнера: плавность не нужна). Камера привязана к вектору
// движения сама, см. camera-rig.ts.

import {
  MeshBasicMaterial,
  Mesh,
  Matrix4,
  Color,
  Vector3,
  MathUtils,
  type Scene,
} from 'three'
import type { GameState } from '../core/state'
import { snakeLength, forEachSnakeSegment, elapsedMs } from '../core/queries'
import { InstancedPool } from './pool'
import { beamGeometry, cubeEdgeSegments } from './outline'
import {
  SNAKE_BODY_COLOR,
  SNAKE_TAIL_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_HEAD_BOOST,
  SNAKE_STRIPE_DIM,
} from './palette'

// Оформительские константы, не числа баланса.
const SEGMENT_SCALE = 0.86
// Толщина балок каркаса (клеток). Голова той же формы, что и тело: отличается цветом/яркостью.
const SEGMENT_BEAM = 0.1
const HEAD_PULSE = 0.06
const HEAD_PULSE_PERIOD_MS = 600
// Fade ближних к камере сегментов: расстояния в клетках (не от followDistance,
// камера вплотную: шея ~1.7 клетки от камеры должна остаться видимой, а всё,
// что ближе ~1 клетки, схлопывается).
const FADE_NEAR_CELLS = 0.9
const FADE_FAR_CELLS = 1.5
const FADE_MIN_SCALE = 0.1

export class SnakeView {
  private pool: InstancedPool
  private matrix = new Matrix4()
  private color = new Color()
  private denom = 1

  private headMesh: Mesh
  private headMaterial: MeshBasicMaterial
  private headDir = new Vector3(1, 0, 0)
  private tmpDir = new Vector3()

  /** Единичное направление движения (голова - шея), обновляется в update(). */
  get direction(): Vector3 {
    return this.headDir
  }

  private headX = 0
  private headY = 0
  private headZ = 0
  private neckX = 0
  private neckY = 0
  private neckZ = 0
  private hasNeck = false

  // Параметры текущего кадра для колбэка.
  private camX = 0
  private camY = 0
  private camZ = 0
  private fadeAmount = 0

  // Один раз созданный колбэк: в кадре замыкания не создаются.
  private readonly writeSegment = (x: number, y: number, z: number, i: number): void => {
    if (i === 0) {
      this.headX = x
      this.headY = y
      this.headZ = z
      this.hasNeck = false
      return
    }
    if (i === 1) {
      this.neckX = x
      this.neckY = y
      this.neckZ = z
      this.hasNeck = true
    }
    let k = 1
    if (this.fadeAmount > 0) {
      const dx = x - this.camX
      const dy = y - this.camY
      const dz = z - this.camZ
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const f = MathUtils.smoothstep(dist, FADE_NEAR_CELLS, FADE_FAR_CELLS)
      k = MathUtils.lerp(1, MathUtils.lerp(FADE_MIN_SCALE, 1, f), this.fadeAmount)
    }
    // Тело — инстансы 0..length-2 (голова рисуется отдельно).
    const idx = i - 1
    this.matrix.makeScale(k, k, k).setPosition(x, y, z)
    this.pool.mesh.setMatrixAt(idx, this.matrix)
    this.color.copy(SNAKE_BODY_COLOR).lerp(SNAKE_TAIL_COLOR, i / this.denom)
    if (i % 2 === 1) this.color.multiplyScalar(SNAKE_STRIPE_DIM)
    this.pool.mesh.setColorAt(idx, this.color)
  }

  constructor(scene: Scene) {
    const geometry = beamGeometry(cubeEdgeSegments(SEGMENT_SCALE / 2), SEGMENT_BEAM)
    const material = new MeshBasicMaterial()
    this.pool = new InstancedPool(scene, geometry, material, 8)

    const headGeometry = beamGeometry(cubeEdgeSegments(SEGMENT_SCALE / 2), SEGMENT_BEAM)
    this.headMaterial = new MeshBasicMaterial({
      color: SNAKE_HEAD_COLOR.clone().multiplyScalar(SNAKE_HEAD_BOOST),
    })
    this.headMesh = new Mesh(headGeometry, this.headMaterial)
    this.headMesh.frustumCulled = false
    scene.add(this.headMesh)
    this.scene = scene
  }

  private scene: Scene

  /** Холодный путь: вызывать из handle() при 'started'/'moved'/'ate'. */
  ensureCapacity(s: GameState): void {
    this.pool.ensureCapacity(Math.max(1, snakeLength(s) - 1))
  }

  /**
   * Кадр: без новых объектов.
   * cam* — позиция камеры; freeAmount 0..1 — насколько включён fade ближних
   * сегментов.
   */
  update(
    s: GameState,
    camX: number,
    camY: number,
    camZ: number,
    freeAmount: number,
  ): void {
    const length = snakeLength(s)
    this.pool.setCount(Math.max(0, length - 1))
    this.denom = Math.max(1, length - 1)
    this.camX = camX
    this.camY = camY
    this.camZ = camZ
    this.fadeAmount = freeAmount
    forEachSnakeSegment(s, this.writeSegment)
    this.pool.markDirty()

    // Направление движения (голова - шея); голова той же формы, что тело.
    if (this.hasNeck) {
      this.tmpDir.set(this.headX - this.neckX, this.headY - this.neckY, this.headZ - this.neckZ)
      if (this.tmpDir.lengthSq() > 0.5) this.headDir.copy(this.tmpDir).normalize()
    }
    const phase = ((elapsedMs(s) % HEAD_PULSE_PERIOD_MS) / HEAD_PULSE_PERIOD_MS) * Math.PI * 2
    this.headMesh.scale.setScalar(1 + HEAD_PULSE * Math.sin(phase))
    this.headMesh.position.set(this.headX, this.headY, this.headZ)
  }

  dispose(): void {
    this.pool.dispose()
    this.scene.remove(this.headMesh)
    this.headMesh.geometry.dispose()
    this.headMaterial.dispose()
  }
}
