// Trace from the head along the heading: how far the path is free and
// what it hits. Same logic as ahead-ray.ts (private there; ahead-ray itself is left alone,
// it is the fallback mode), but without drawing. Allocation-free per frame.
// A body segment counts as an obstacle only if it is still in place when the head arrives
// (the tail moves away in d steps: segments with index >= length - d are free).

import type { GameState } from '../core/state'
import { applePos, cubeSize, forEachSnakeSegment, head, snakeLength } from '../core/queries'

export const enum HitKind {
  None,
  Wall,
  Obstacle,
  Body,
  Apple,
}

export type SolidTest = (x: number, y: number, z: number) => boolean

export class HeadTrace {
  hitKind: HitKind = HitKind.None
  /** How many free cells before the obstacle (or maxCells if there is none). */
  freeCells = 0

  private body = new Map<number, number>()
  private bodyHeadKey = -1
  private bodyLen = -1
  private bodySize = 1
  private readonly collectSegment = (x: number, y: number, z: number, i: number): void => {
    this.body.set(x + this.bodySize * (y + this.bodySize * z), i)
  }

  private refreshBody(s: GameState, size: number, hx: number, hy: number, hz: number): void {
    const len = snakeLength(s)
    const key = hx + size * (hy + size * hz)
    if (key === this.bodyHeadKey && len === this.bodyLen && size === this.bodySize) return
    this.bodyHeadKey = key
    this.bodyLen = len
    this.bodySize = size
    this.body.clear()
    forEachSnakeSegment(s, this.collectSegment)
  }

  run(s: GameState, dx: number, dy: number, dz: number, maxCells: number, isSolid: SolidTest): void {
    const size = cubeSize(s)
    const h = head(s)
    this.refreshBody(s, size, h.x, h.y, h.z)
    const a = applePos(s)
    const len = this.bodyLen
    this.hitKind = HitKind.None
    this.freeCells = maxCells
    for (let d = 1; d <= maxCells; d++) {
      const kind = this.classify(size, a.x, a.y, a.z, len, h.x + dx * d, h.y + dy * d, h.z + dz * d, d, isSolid)
      if (kind !== HitKind.None) {
        this.hitKind = kind
        this.freeCells = d - 1
        return
      }
    }
  }

  /**
   * What is in cell (x,y,z), d steps from the head. Uses the body
   * built by the last run(). For the near layer: d = 1.
   */
  kindAt(s: GameState, x: number, y: number, z: number, d: number, isSolid: SolidTest): HitKind {
    const a = applePos(s)
    return this.classify(cubeSize(s), a.x, a.y, a.z, this.bodyLen, x, y, z, d, isSolid)
  }

  private classify(
    size: number,
    ax: number,
    ay: number,
    az: number,
    len: number,
    x: number,
    y: number,
    z: number,
    d: number,
    isSolid: SolidTest,
  ): HitKind {
    if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) return HitKind.Wall
    if (isSolid(x, y, z)) return HitKind.Obstacle
    if (x === ax && y === ay && z === az) return HitKind.Apple
    const idx = this.body.get(x + size * (y + size * z))
    if (idx !== undefined && idx < len - d) return HitKind.Body
    return HitKind.None
  }
}
