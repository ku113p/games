// Яблоко — одиночный неоновый каркас-кубик (только рёбра, середина пустая), пульсирует размером и яркостью (не вращается). Время берётся из
// детерминированного elapsedMs(s) (ядро — источник истины по времени), а не
// из отдельного счётчика внутри view.

import { MeshBasicMaterial, Mesh, MathUtils, type Scene } from 'three'
import type { GameState } from '../core/state'
import { applePos, elapsedMs } from '../core/queries'
import { beamGeometry, cubeEdgeSegments } from './outline'
import { APPLE_COLOR, APPLE_GLOW_BOOST, APPLE_TARGET_COLOR, APPLE_EMISSIVE_PULSE_MIN, APPLE_EMISSIVE_PULSE_MAX } from './palette'

const APPLE_SCALE = 0.72
const APPLE_BEAM = 0.11
const APPLE_SCALE_PULSE = 0.1
// Период пульса — оформительская константа (game feel), не число баланса.
const PULSE_PERIOD_MS = 700
// Скорость перекраски при наведении луча (доля/мс): ~120 мс на полный переход.
const TARGET_BLEND_PER_MS = 1 / 120

export class AppleView {
  private scene: Scene
  private mesh: Mesh
  private material: MeshBasicMaterial
  private targetAmount = 0
  private lastElapsed = -1
  private lift = 0

  constructor(scene: Scene) {
    this.scene = scene
    const geometry = beamGeometry(cubeEdgeSegments(APPLE_SCALE / 2), APPLE_BEAM)
    this.material = new MeshBasicMaterial({ color: APPLE_COLOR.clone() })
    this.mesh = new Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  /** Прибавка к яркости, когда яблоко лежит в плоскости креста (cross-planes.ts); 0 — нет. */
  setPlaneLift(k: number): void {
    this.lift = k
  }

  /** Кадр: без новых объектов — мутирует позицию/масштаб/цвет существующего меша. */
  /** targeted — основной луч сейчас упирается в яблоко: оно плавно меняет цвет. */
  update(s: GameState, targeted: boolean): void {
    const apple = applePos(s)
    this.mesh.position.set(apple.x, apple.y, apple.z)
    const phase = ((elapsedMs(s) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS) * Math.PI * 2
    const wave = 0.5 - 0.5 * Math.cos(phase)
    const intensity = MathUtils.lerp(APPLE_EMISSIVE_PULSE_MIN, APPLE_EMISSIVE_PULSE_MAX, wave)
    const now = elapsedMs(s)
    const dt = this.lastElapsed < 0 ? 0 : Math.max(0, now - this.lastElapsed)
    this.lastElapsed = now
    const step = dt * TARGET_BLEND_PER_MS
    this.targetAmount = targeted ? Math.min(1, this.targetAmount + step) : Math.max(0, this.targetAmount - step)
    this.material.color.copy(APPLE_COLOR).lerp(APPLE_TARGET_COLOR, this.targetAmount).multiplyScalar(intensity * APPLE_GLOW_BOOST * (1 + this.lift))
    const scale = 1 + APPLE_SCALE_PULSE * wave
    this.mesh.scale.setScalar(scale)
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
