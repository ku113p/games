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
import { snakeLength, forEachSnakeSegment, elapsedMs, intendedHeading, stepProgress, stepsToCrash, appleOnCourse } from '../core/queries'
import configJson from '../config.json'
import { InstancedPool } from './pool'
import { beamGeometry, cubeEdgeSegments } from './outline'
import {
  SNAKE_BODY_COLOR,
  SNAKE_TAIL_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_STRIPE_DIM,
  SNAKE_BODY_GLOW_BOOST,
  HEAD_IDLE_BOOST,
  HEAD_GOAL_COLOR,
  HEAD_GOAL_BOOST,
  HEAD_DANGER_COLOR_FAR,
  HEAD_DANGER_COLOR_NEAR,
} from './palette'

// Оформительские константы, не числа баланса.
const SEGMENT_SCALE = 0.86
// Лёгкая плавность хода: сегмент подъезжает из клетки соседа за спиной, но успевает
// за первые SLIDE_FRACTION шага и дальше стоит. Движение остаётся тактовым —
// это не скольжение, а смягчённый перескок.
const SLIDE_FRACTION = 0.4
// Толщина балок каркаса (клеток). Голова той же формы, что и тело: отличается цветом/яркостью.
const SEGMENT_BEAM = 0.1
// Мягкое «дыхание» головы (размер и яркость), только если нет prefers-reduced-motion.
// Безопасность: одно дыхание = один цикл синуса, максимальная частота 1000/1100 ≈ 0.9 Гц (< 3 вспышек/с),
// без скачков: только гладкая синусоида малой амплитуды. Цвет опасности меняется плавным переходом, не миганием.
const HEAD_PULSE = 0.05
const HEAD_PULSE_PERIOD_MS = 1600
const DANGER_PERIOD_MS = 1100
const DANGER_PULSE = 0.06
const DANGER_BREATH = 0.08

/** Числа сигналов головы (config.headSignal): горизонт опасности в ходах и время перехода цвета. */
export interface HeadSignalConfig {
  dangerHorizon: number
  riseMs: number
  fallMs: number
}
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

  // Сигналы головы. Ядро считает их раз в такт (между тактами состояние не меняется), поэтому результат
  // кэшируется по ключу (состояние, шаг, курс, яблоко); в кадре остаётся только плавный переход цвета.
  private readonly signalCfg: HeadSignalConfig
  private sigState: GameState | null = null
  private sigStep = -1
  private sigHx = 0
  private sigHy = 0
  private sigHz = 0
  private sigAx = -1
  private sigAy = -1
  private sigAz = -1
  private sigRolled = false
  private crashIn = 0
  private goal = false
  private goalAmount = 0
  private dangerAmount = 0
  private nearAmount = 0
  private readonly reducedMotion: MediaQueryList | null =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  private lastElapsed = -1
  private readonly headColor = new Color()
  private readonly tint = new Color()

  /**
   * Единичное направление головы, обновляется в update(): то, куда змейка повёрнута сейчас, включая уже
   * введённый, но ещё не исполненный поворот (core/queries intendedHeading). Из геометрии тела
   * (голова минус шея) направление не выводится: тело до такта стоит, и ввод был бы виден только на шаге.
   */
  get direction(): Vector3 {
    return this.headDir
  }

  private headX = 0
  private headY = 0
  private headZ = 0

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
      return
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

  constructor(scene: Scene, signalCfg: HeadSignalConfig = configJson.headSignal) {
    this.signalCfg = signalCfg
    const geometry = beamGeometry(cubeEdgeSegments(SEGMENT_SCALE / 2), SEGMENT_BEAM)
    const material = new MeshBasicMaterial()
    this.pool = new InstancedPool(scene, geometry, material, 8)

    const headGeometry = beamGeometry(cubeEdgeSegments(SEGMENT_SCALE / 2), SEGMENT_BEAM)
    this.headMaterial = new MeshBasicMaterial({
      color: SNAKE_HEAD_COLOR.clone().multiplyScalar(HEAD_IDLE_BOOST),
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

    // Направление головы берётся из ядра и меняется мгновенно по вводу, без сглаживания: змейка тактовая.
    const dir = intendedHeading(s)
    this.headDir.set(dir.x, dir.y, dir.z)
    this.updateSignals(s, dir.x, dir.y, dir.z)
    this.headMesh.position.set(this.headX, this.headY, this.headZ)
  }

  /**
   * Цвет и пульс головы. Опасность (удар через 1..dangerHorizon ходов) ПЕРЕБИВАЕТ цель (яблоко на курсе).
   * Запросы ядра пересчитываются только когда изменился такт, курс (ввод) или яблоко; переход цвета
   * сглажен (быстро загорается, медленнее гаснет), поэтому на высокой скорости голова не мигает на каждом такте.
   */
  private updateSignals(s: GameState, dx: number, dy: number, dz: number): void {
    const a = s.apple
    if (
      s !== this.sigState || s.stepCount !== this.sigStep || dx !== this.sigHx || dy !== this.sigHy || dz !== this.sigHz ||
      a.x !== this.sigAx || a.y !== this.sigAy || a.z !== this.sigAz || s.rolledSinceStep !== this.sigRolled
    ) {
      this.sigState = s
      this.sigStep = s.stepCount
      this.sigHx = dx
      this.sigHy = dy
      this.sigHz = dz
      this.sigAx = a.x
      this.sigAy = a.y
      this.sigAz = a.z
      this.sigRolled = s.rolledSinceStep
      const horizon = this.signalCfg.dangerHorizon
      this.crashIn = stepsToCrash(s, horizon)
      this.goal = this.crashIn === 0 && appleOnCourse(s)
    }

    const now = elapsedMs(s)
    const dt = this.lastElapsed < 0 ? 0 : Math.max(0, now - this.lastElapsed)
    this.lastElapsed = now
    const rise = dt / Math.max(1, this.signalCfg.riseMs)
    const fall = dt / Math.max(1, this.signalCfg.fallMs)
    const danger = this.crashIn > 0
    this.dangerAmount = danger ? Math.min(1, this.dangerAmount + rise) : Math.max(0, this.dangerAmount - fall)
    const goalTarget = this.goal && !danger
    this.goalAmount = goalTarget ? Math.min(1, this.goalAmount + rise) : Math.max(0, this.goalAmount - fall)
    // Оттенок опасности: за 2 хода оранжевый, за 1 ход красный (плавный переход между ними).
    this.nearAmount = this.crashIn === 1 ? Math.min(1, this.nearAmount + rise) : Math.max(0, this.nearAmount - fall)

    // Дыхание: гладкая синусоида, при prefers-reduced-motion нет вовсе.
    const calm = this.reducedMotion !== null && this.reducedMotion.matches
    const idleWave = calm ? 0 : Math.sin(((now % HEAD_PULSE_PERIOD_MS) / HEAD_PULSE_PERIOD_MS) * Math.PI * 2)
    const dangerWave = calm ? 0 : Math.sin(((now % DANGER_PERIOD_MS) / DANGER_PERIOD_MS) * Math.PI * 2)
    const pulse = MathUtils.lerp(HEAD_PULSE * idleWave, DANGER_PULSE * dangerWave, this.dangerAmount)
    this.headMesh.scale.setScalar(1 + pulse)

    const c = this.headColor.copy(SNAKE_HEAD_COLOR).multiplyScalar(HEAD_IDLE_BOOST)
    if (this.goalAmount > 0) {
      c.lerp(this.tint.copy(HEAD_GOAL_COLOR).multiplyScalar(HEAD_GOAL_BOOST), this.goalAmount)
    }
    if (this.dangerAmount > 0) {
      this.tint.copy(HEAD_DANGER_COLOR_FAR).lerp(HEAD_DANGER_COLOR_NEAR, this.nearAmount).multiplyScalar(1 + DANGER_BREATH * dangerWave)
      c.lerp(this.tint, this.dangerAmount)
    }
    this.headMaterial.color.copy(c)
  }

  dispose(): void {
    this.pool.dispose()
    this.scene.remove(this.headMesh)
    this.headMesh.geometry.dispose()
    this.headMaterial.dispose()
  }
}
