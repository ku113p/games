// Яблоко — одиночный неоновый каркас-кубик (только рёбра, середина пустая), пульсирует размером и яркостью (не вращается). Время берётся из
// детерминированного elapsedMs(s) (ядро — источник истины по времени), а не
// из отдельного счётчика внутри view.

import { MeshBasicMaterial, Mesh, MathUtils, type Scene } from 'three'
import type { GameState } from '../core/state'
import { applePos, elapsedMs } from '../core/queries'
import { beamGeometry, circleSegments, cornerOnZ, cubeEdgeSegments, stellaOctangulaSegments } from './outline'
import type { AppleSkin } from './cosmetics'
import { APPLE_COLOR, APPLE_GLOW_BOOST, APPLE_EMISSIVE_PULSE_MIN, APPLE_EMISSIVE_PULSE_MAX } from './palette'

const APPLE_SCALE = 0.72
const APPLE_BEAM = 0.11
const APPLE_SCALE_PULSE = 0.1
// Виды яблока (магазин). Габарит у всех не меньше ромба-куба: яблоко обязано читаться на любой дистанции.
// Шар: три большие окружности, радиус на 15% больше полуразмера куба (диаметр 0.83 клетки, в клетку помещается).
const ORB_RADIUS = (APPLE_SCALE / 2) * 1.15
const ORB_SEGMENTS = 20
// Звезда: два тетраэдра в том же кубе (полуразмер APPLE_SCALE / 2), повёрнутые углом к камере: описанная сфера та же, что у куба.
// Период пульса — оформительская константа (game feel), не число баланса.
const PULSE_PERIOD_MS = 700

/** Отрезки каркаса по виду яблока (diamond — прежний каркас-кубик). */
export function appleSegments(skin: AppleSkin): number[] {
  switch (skin) {
    case 'orb':
      return [...circleSegments(ORB_RADIUS, ORB_SEGMENTS, 0), ...circleSegments(ORB_RADIUS, ORB_SEGMENTS, 1), ...circleSegments(ORB_RADIUS, ORB_SEGMENTS, 2)]
    case 'star':
      return cornerOnZ(stellaOctangulaSegments(APPLE_SCALE / 2))
    default:
      return cubeEdgeSegments(APPLE_SCALE / 2)
  }
}

export class AppleView {
  private scene: Scene
  private mesh: Mesh
  private material: MeshBasicMaterial

  constructor(scene: Scene, skin: AppleSkin = 'diamond') {
    this.scene = scene
    const geometry = beamGeometry(appleSegments(skin), APPLE_BEAM)
    this.material = new MeshBasicMaterial({ color: APPLE_COLOR.clone(), fog: false }) // вне тумана: яблоко видно на любой дистанции
    this.mesh = new Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  /** Кадр: без новых объектов — мутирует позицию/масштаб/цвет существующего меша. */
  /** Цвет яблока не зависит от прицеливания: сигнал «яблоко на курсе» даёт голова (SnakeView). Второй параметр — старый, игнорируется. */
  update(s: GameState, _targeted?: boolean): void {
    const apple = applePos(s)
    this.mesh.position.set(apple.x, apple.y, apple.z)
    const phase = ((elapsedMs(s) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS) * Math.PI * 2
    const wave = 0.5 - 0.5 * Math.cos(phase)
    const intensity = MathUtils.lerp(APPLE_EMISSIVE_PULSE_MIN, APPLE_EMISSIVE_PULSE_MAX, wave)
    this.material.color.copy(APPLE_COLOR).multiplyScalar(intensity * APPLE_GLOW_BOOST)
    const scale = 1 + APPLE_SCALE_PULSE * wave
    this.mesh.scale.setScalar(scale)
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
