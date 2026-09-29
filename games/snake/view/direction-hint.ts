// Подсказка направления: независимые слои. Каждый гасится одной константой
// (true — включён, false — выключен и не создаётся/не считается вовсе).
//
//   HINT_LATTICE   решётка узлов (ahead-dots.ts): фоновая разметка пространства,
//                  шаг и привязка — config.hints. Про «где я в объёме».
//   HINT_RAY       луч вперёд (ahead-ray.ts): пунктир штрихов от центра головы, обрыв о стенку /
//                  препятствие / тело, подсветка преграды, цвет яблока под прицелом.
//   HINT_RAY_SIDES боковые тонкие лучи у HINT_RAY (по умолчанию выкл: их
//                  заменил ближний слой).
//   HINT_NEAR      ближний слой (near-cells.ts): точки в центрах клеток по пяти
//                  осевым векторам, две клетки от головы; ближняя заметнее.
//
// «Рельсы» из точек вдоль хода удалены: луч делает ту же работу лучше.

import type { Scene } from 'three'
import type { GameState } from '../core/state'
import type { Config } from '../core/rules'
import { viewFrame, cubeSize, gameMode, head } from '../core/queries'
import { AheadRay } from './ahead-ray'
import { AheadDots } from './ahead-dots'
import { NearCells } from './near-cells'
import { HeadTrace, type SolidTest } from './head-trace'

export const HINT_LATTICE = true
export const HINT_RAY = true
export const HINT_RAY_SIDES = false
export const HINT_NEAR = true

export interface DirectionHint {
  /** true, если луч вперёд упирается в яблоко (яблоко цвет не меняет; поле оставлено для совместимости). */
  appleTargeted: boolean
  update(s: GameState, dx: number, dy: number, dz: number, isSolid: SolidTest, freeAmount: number): void
  /** Высота буфера кадра в пикселях; нужна только точкам. */
  setViewportHeight?(pixels: number): void
  dispose(): void
}

class LayeredHint implements DirectionHint {
  appleTargeted = false
  private ray: AheadRay | null
  private lattice: AheadDots | null
  private near: NearCells | null
  private trace = new HeadTrace()

  constructor(scene: Scene, config: Config) {
    this.ray = HINT_RAY ? new AheadRay(scene, HINT_RAY_SIDES) : null
    this.lattice = HINT_LATTICE ? new AheadDots(scene, config) : null
    this.near = HINT_NEAR ? new NearCells(scene, this.trace) : null
  }

  setViewportHeight(pixels: number): void {
    this.lattice?.setViewportHeight(pixels)
    this.near?.setViewportHeight(pixels)
  }

  /** Кадр: без новых объектов. */
  update(s: GameState, dx: number, dy: number, dz: number, isSolid: SolidTest, freeAmount: number): void {
    const frame = viewFrame(s)
    if (gameMode(s) === 'free') {
      dx = -frame.depth.x
      dy = -frame.depth.y
      dz = -frame.depth.z
    }
    dx = Math.round(dx)
    dy = Math.round(dy)
    dz = Math.round(dz)
    const px = Math.round(frame.depth.x)
    const py = Math.round(frame.depth.y)
    const pz = Math.round(frame.depth.z)
    const h = head(s)

    if (this.ray) {
      this.ray.update(s, dx, dy, dz, isSolid)
      this.appleTargeted = this.ray.appleTargeted
    } else {
      this.appleTargeted = false
    }
    this.lattice?.update(cubeSize(s), h.x, h.y, h.z, dx, dy, dz, px, py, pz, freeAmount)
    if (this.near) {
      this.trace.run(s, dx, dy, dz, 1, isSolid) // карта тела для kindAt
      this.near.update(s, dx, dy, dz, isSolid)
    }
  }

  dispose(): void {
    this.ray?.dispose()
    this.lattice?.dispose()
    this.near?.dispose()
  }
}

export function createDirectionHint(scene: Scene, config: Config): DirectionHint {
  return new LayeredHint(scene, config)
}
