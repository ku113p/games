// Direction hint: independent layers. Each is switched off by one constant
// (true: on, false: off and not created/computed at all).
//
//   HINT_LATTICE   lattice of nodes (ahead-dots.ts): background markup of space,
//                  step and anchoring are in config.hints. About "where am I in 3D".
//   HINT_RAY       ray ahead (ahead-ray.ts): dashed line from the head center, cut off at a wall /
//                  obstacle / body, highlight of the obstacle, apple color under the sights.
//   HINT_RAY_SIDES thin side rays of HINT_RAY (off by default: the near layer
//                  replaced them).
//   HINT_NEAR      near layer (near-cells.ts): dots at cell centers along the five
//                  axis vectors, two cells from the head; the nearer one is more visible.
//
// The "rails" of dots along the heading were removed: the ray does the same job better.

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
  /** true if the ray ahead hits the apple (the apple does not change color; the field is kept for compatibility). */
  appleTargeted: boolean
  update(s: GameState, dx: number, dy: number, dz: number, isSolid: SolidTest, freeAmount: number): void
  /** Frame buffer height in pixels; only the dots need it. */
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

  /** Frame: no new objects. */
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
      this.trace.run(s, dx, dy, dz, 1, isSolid) // body map for kindAt
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
