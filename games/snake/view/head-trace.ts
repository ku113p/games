// Трассировка от головы по направлению движения: до какой клетки свободно и
// во что упрёмся. Та же логика, что в ahead-ray.ts (там она приватная, сам
// ahead-ray не трогаем — он режим отката), но без рисования. Кадр без аллокаций.
// Тело считается преградой, только если к приходу головы сегмент ещё на месте
// (хвост за d шагов уедет: сегменты с индексом >= length - d свободны).

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
  /** Сколько свободных клеток до преграды (или maxCells, если преграды нет). */
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
   * Что в клетке (x,y,z), до которой голове d шагов. Использует тело,
   * собранное последним run(). Для ближнего слоя: d = 1.
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
