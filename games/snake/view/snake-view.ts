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
// Змейка рисуется по клеткам ядра, такт за тактом. Плавность — только лёгкая:
// сегмент подъезжает из клетки позади и встаёт на место за первые SLIDE_FRACTION
// шага, дальше стоит. Это смягчённый перескок, а не скольжение (полное скольжение
// дизайнер отверг). Камера привязана к вектору движения сама, см. camera-rig.ts.

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
import { snakeLength, forEachSnakeSegment, elapsedMs, stepProgress } from '../core/queries'
import { InstancedPool } from './pool'
import { beamGeometry, cubeEdgeSegments } from './outline'
import {
  SNAKE_BODY_COLOR,
  SNAKE_TAIL_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_HEAD_BOOST,
  SNAKE_STRIPE_DIM,
  SNAKE_BODY_GLOW_BOOST,
} from './palette'

// Оформительские константы, не числа баланса.
const SEGMENT_SCALE = 0.86
// Лёгкая плавность хода: сегмент подъезжает из клетки соседа за спиной, но успевает
// за первые SLIDE_FRACTION шага и дальше стоит. Движение остаётся тактовым —
// это не скольжение, а смягчённый перескок.
const SLIDE_FRACTION = 0.4
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
  private px = new Float32Array(0)
  private py = new Float32Array(0)
  private pz = new Float32Array(0)

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
  /** Сбор позиций такта: интерполировать сегмент можно, только зная соседа за ним. */
  private readonly collect = (x: number, y: number, z: number, i: number): void => {
    this.px[i] = x
    this.py[i] = y
    this.pz[i] = z
  }

  private ensureBuffers(n: number): void {
    if (this.px.length >= n) return
    const cap = Math.max(n, this.px.length * 2, 8)
    this.px = new Float32Array(cap)
    this.py = new Float32Array(cap)
    this.pz = new Float32Array(cap)
  }

  private place(i: number, length: number, glide: number): void {
    // Откуда едет сегмент: из клетки соседа за спиной. У хвоста соседа нет — он стоит.
    const back = i + 1 < length ? i + 1 : i
    const x = this.px[back]! + (this.px[i]! - this.px[back]!) * glide
    const y = this.py[back]! + (this.py[i]! - this.py[back]!) * glide
    const z = this.pz[back]! + (this.pz[i]! - this.pz[back]!) * glide

    if (i === 0) {
      this.headX = x
      this.headY = y
      this.headZ = z
      this.hasNeck = length > 1
      return
    }
    if (i === 1) {
      this.neckX = x
      this.neckY = y
      this.neckZ = z
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
    this.color.multiplyScalar(SNAKE_BODY_GLOW_BOOST)
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
    this.ensureBuffers(length)
    forEachSnakeSegment(s, this.collect)
    const glide = MathUtils.smoothstep(stepProgress(s), 0, SLIDE_FRACTION)
    for (let i = 0; i < length; i++) this.place(i, length, glide)
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
