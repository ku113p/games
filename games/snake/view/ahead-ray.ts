// Direction rays. The main one (along the heading) is a thin dashed line: 3D dashes
// (0.11 x 0.11 x 0.4 cells, step 1.5) from the head center along the heading. The side ones
// (off by default) show where the head would go on a turn: thin rails,
// dimmer than the main one.
//
// The main ray ends at a cube wall, obstacle, the snake's own body or
// the apple. The obstacle is highlighted: an obstacle/body by a solid fill of the face the ray
// hits (the one facing the head), a wall by a fill of its face (the same; a filled
// square, not a frame). An apple under the ray does not change color (the head gives the target signal, SnakeView)
// (see appleTargeted). Side rays do not highlight obstacles: four
// highlights at once would ripple.
//
// Plane mode: side rays only in the screen plane (±right, ±up from viewFrame),
// depth is not shown - the first game must look like a flat snake.
// Free mode: heading = -depth, sides = ±right, ±up (same as the four swipes).
// A reversal is never drawn (the direction along the movement axis is filtered out).
//
// All one InstancedMesh of unit boxes stretched along the world axes
// (rays always run along axes): ~300 instances at most. The pool is created up front,
// per frame only matrices and colors are mutated, no objects are created.

import { BoxGeometry, Color, Matrix4, MeshBasicMaterial, type Scene } from 'three'
import type { GameState } from '../core/state'
import { applePos, viewFrame, cubeSize, elapsedMs, forEachSnakeSegment, gameMode, head, snakeLength } from '../core/queries'
import { InstancedPool } from './pool'
import { RAY_HIT_FILL_BRIGHTNESS, RAY_DANGER_COLOR, RAY_MAIN_BRIGHTNESS, RAY_SIDE_BRIGHTNESS } from './palette'

// Styling constants, not balance values.
const MAIN_CELLS = 18
const SIDE_CELLS = 5
const BODY_SCALE = 0.86 // snake segment size (= SEGMENT_SCALE in snake-view)
const DASH_CROSS = 0.11 // dash cross-section in cells
const DASH_LEN = 0.4 // dash length along the heading
const DASH_STEP = 1.5 // dash step
const DASH_FIRST = 0.75 // center of the first dash from the head center
const MAIN_DASHES = Math.ceil(MAIN_CELLS / DASH_STEP)
const SIDE_CROSS = 0.5 // cross-section of a side ray relative to the segment size
const SIDE_BEAM = 0.025
// Hit face fill: a thin slab. The face of an opaque cube lies at 0.49 from the cell
// center (pushed by polygonOffset), the slab occupies 0.50..0.53 - outside and without
// depth contact, so it does not flicker. At a wall (plane at 0.5) the slab is
// 0.465..0.495 inside the cube. The slab side = the obstacle face side (0.98).
const HIT_FILL_SIZE = 0.98
const HIT_FILL_THICK = 0.03
const HIT_FACE_OFFSET = 0.515 // slab center from the obstacle cell center toward the head
const WALL_INSET = 0.02 // slab center on a wall: 0.5 - 0.02 from the center of the last free cell
const SIDE_RING_STEP = 2
const WAVE_DEPTH = 0.12
const WAVE_PERIOD_MS = 900
const WAVE_PHASE_STEP = 0.5
const SIDE_MAX = 4
const CAPACITY = MAIN_DASHES + 12 + 4 + SIDE_MAX * (4 + Math.ceil(SIDE_CELLS / SIDE_RING_STEP) * 4) + 16

const enum Hit {
  None,
  Wall,
  Obstacle,
  Body,
  Apple,
}

export type SolidTest = (x: number, y: number, z: number) => boolean

export class AheadRay {
  private pool: InstancedPool
  private matrix = new Matrix4()
  private color = new Color()
  private n = 0

  // Snake body: cell key -> segment index. Rebuilt only if
  // the head or the length changed.
  private body = new Map<number, number>()
  private bodyHeadKey = -1
  private bodyLen = -1
  private bodySize = 1
  private readonly collectSegment = (x: number, y: number, z: number, i: number): void => {
    this.body.set(x + this.bodySize * (y + this.bodySize * z), i)
  }

  // Result of the last trace.
  private hitKind: Hit = Hit.None
  private hitX = 0
  private hitY = 0
  private hitZ = 0
  private freeCells = 0

  // Side directions of the current frame (pre-allocated, 4 x 3).
  private readonly sideDirs = new Int8Array(SIDE_MAX * 3)

  /** true if the main ray hits the apple (the apple does not change color; the field is kept for compatibility). */
  appleTargeted = false

  private sides: boolean

  constructor(scene: Scene, sides = true) {
    this.sides = sides
    this.pool = new InstancedPool(scene, new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), CAPACITY)
    for (let i = 0; i < CAPACITY; i++) this.pool.mesh.setColorAt(i, this.color.setRGB(0, 0, 0))
  }

  /** Frame: no new objects. dx/dy/dz is the unit movement direction (in plane). */
  update(s: GameState, dx: number, dy: number, dz: number, isSolid: SolidTest): void {
    const size = cubeSize(s)
    const h = head(s)
    this.refreshBody(s, size, h.x, h.y, h.z)

    const frame = viewFrame(s)
    const free = gameMode(s) === 'free'
    if (free) {
      dx = -frame.depth.x
      dy = -frame.depth.y
      dz = -frame.depth.z
    }
    dx = Math.round(dx)
    dy = Math.round(dy)
    dz = Math.round(dz)

    this.n = 0
    const phase = ((elapsedMs(s) % WAVE_PERIOD_MS) / WAVE_PERIOD_MS) * Math.PI * 2

    // Main ray.
    this.trace(s, size, h.x, h.y, h.z, dx, dy, dz, MAIN_CELLS, isSolid)
    this.appleTargeted = this.hitKind === Hit.Apple
    const free0 = this.freeCells
    const hk = this.hitKind
    const hx = this.hitX
    const hy = this.hitY
    const hz = this.hitZ
    // A dash is visible in full only if it fits into the free path (up to the boundary of
    // the last free cell).
    const reach = free0 + 0.5
    for (let i = 0, t = DASH_FIRST; i < MAIN_DASHES && t + DASH_LEN / 2 <= reach; i++, t += DASH_STEP) {
      const k = this.rayBrightness(t, phase)
      this.color.setRGB(k, k, k)
      this.dash(h.x + dx * t, h.y + dy * t, h.z + dz * t, dx, dy, dz)
    }
    if (hk === Hit.Obstacle || hk === Hit.Body) {
      this.setDanger()
      // Only the hit face, filled entirely: a slab in the plane of the face facing the head.
      this.plate(hx - dx * HIT_FACE_OFFSET, hy - dy * HIT_FACE_OFFSET, hz - dz * HIT_FACE_OFFSET, dx, dy)
    } else if (hk === Hit.Wall) {
      this.setDanger()
      const fx = h.x + dx * free0 + dx * (0.5 - WALL_INSET)
      const fy = h.y + dy * free0 + dy * (0.5 - WALL_INSET)
      const fz = h.z + dz * free0 + dz * (0.5 - WALL_INSET)
      this.plate(fx, fy, fz, dx, dy)
    }

    // Side rays.
    const sides = !this.sides ? 0 : this.collectSides(frame.right, frame.up, dx, dy, dz)
    for (let i = 0; i < sides; i++) {
      const sx = this.sideDirs[i * 3]!
      const sy = this.sideDirs[i * 3 + 1]!
      const sz = this.sideDirs[i * 3 + 2]!
      this.trace(s, size, h.x, h.y, h.z, sx, sy, sz, SIDE_CELLS, isSolid)
      const len = this.freeCells
      if (len <= 0) continue
      const k = RAY_SIDE_BRIGHTNESS
      this.color.setRGB(k, k, k)
      const half = (BODY_SCALE * SIDE_CROSS) / 2
      const mid = 0.5 + len / 2
      this.rails(h.x + sx * mid, h.y + sy * mid, h.z + sz * mid, half, SIDE_BEAM, sx, sy, len)
      for (let d = SIDE_RING_STEP; d <= len; d += SIDE_RING_STEP) {
        this.ring(h.x + sx * d, h.y + sy * d, h.z + sz * d, half, SIDE_BEAM, sx, sy)
      }
    }

    this.pool.setCount(this.n)
    this.pool.markDirty()
  }

  /** Dash: a cuboid along the heading centered at (cx,cy,cz). */
  private dash(cx: number, cy: number, cz: number, dx: number, dy: number, dz: number): void {
    const i = this.n
    if (i >= CAPACITY) return
    this.matrix
      .makeScale(dx !== 0 ? DASH_LEN : DASH_CROSS, dy !== 0 ? DASH_LEN : DASH_CROSS, dz !== 0 ? DASH_LEN : DASH_CROSS)
      .setPosition(cx, cy, cz)
    this.pool.mesh.setMatrixAt(i, this.matrix)
    this.pool.mesh.setColorAt(i, this.color)
    this.n = i + 1
  }

  private rayBrightness(d: number, phase: number): number {
    // No distance falloff here: the far end of the ray melts into the scene's shared fog (palette.ts).
    const wave = 1 - WAVE_DEPTH + WAVE_DEPTH * Math.sin(phase - d * WAVE_PHASE_STEP)
    return RAY_MAIN_BRIGHTNESS * wave
  }

  private setDanger(): void {
    this.color.copy(RAY_DANGER_COLOR).multiplyScalar(RAY_HIT_FILL_BRIGHTNESS)
  }

  /**
   * Side directions: ±right, ±up of the frame minus those lying along the movement axis
   * (reversal and "through itself"). In plane mode these are two turns in the plane, in free mode four.
   */
  private collectSides(
    right: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number },
    dx: number,
    dy: number,
    dz: number,
  ): number {
    let n = 0
    for (let a = 0; a < 2; a++) {
      const v = a === 0 ? right : up
      // Along the movement axis (dot != 0) - skip.
      if (Math.abs(v.x * dx + v.y * dy + v.z * dz) > 0.5) continue
      for (let sign = -1; sign <= 1; sign += 2) {
        this.sideDirs[n * 3] = Math.round(v.x) * sign
        this.sideDirs[n * 3 + 1] = Math.round(v.y) * sign
        this.sideDirs[n * 3 + 2] = Math.round(v.z) * sign
        n++
      }
    }
    return n
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

  /**
   * Walks from the head along the direction to an obstacle, at most maxCells cells.
   * A body counts as an obstacle only if by the time the head arrives the segment
   * is still in place (the tail moves away in d steps: segments with index >= length - d are free).
   */
  private trace(
    s: GameState,
    size: number,
    hx: number,
    hy: number,
    hz: number,
    dx: number,
    dy: number,
    dz: number,
    maxCells: number,
    isSolid: SolidTest,
  ): void {
    const a = applePos(s)
    const len = this.bodyLen
    this.hitKind = Hit.None
    this.freeCells = maxCells
    for (let d = 1; d <= maxCells; d++) {
      const x = hx + dx * d
      const y = hy + dy * d
      const z = hz + dz * d
      let kind: Hit = Hit.None
      if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) kind = Hit.Wall
      else if (isSolid(x, y, z)) kind = Hit.Obstacle
      else if (x === a.x && y === a.y && z === a.z) kind = Hit.Apple
      else {
        const idx = this.body.get(x + size * (y + size * z))
        if (idx !== undefined && idx < len - d) kind = Hit.Body
      }
      if (kind !== Hit.None) {
        this.hitKind = kind
        this.hitX = x
        this.hitY = y
        this.hitZ = z
        this.freeCells = d - 1
        return
      }
    }
  }

  /** Beam along axis (0/1/2) of length len and thickness t centered at (cx,cy,cz). */
  private beam(axis: number, cx: number, cy: number, cz: number, len: number, t: number): void {
    const i = this.n
    if (i >= CAPACITY) return
    this.matrix.makeScale(axis === 0 ? len : t, axis === 1 ? len : t, axis === 2 ? len : t).setPosition(cx, cy, cz)
    this.pool.mesh.setMatrixAt(i, this.matrix)
    this.pool.mesh.setColorAt(i, this.color)
    this.n = i + 1
  }

  /** Solid slab HIT_FILL_SIZE x HIT_FILL_SIZE in the plane perpendicular to the movement. */
  private plate(cx: number, cy: number, cz: number, dx: number, dy: number): void {
    const i = this.n
    if (i >= CAPACITY) return
    const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2
    this.matrix
      .makeScale(axis === 0 ? HIT_FILL_THICK : HIT_FILL_SIZE, axis === 1 ? HIT_FILL_THICK : HIT_FILL_SIZE, axis === 2 ? HIT_FILL_THICK : HIT_FILL_SIZE)
      .setPosition(cx, cy, cz)
    this.pool.mesh.setMatrixAt(i, this.matrix)
    this.pool.mesh.setColorAt(i, this.color)
    this.n = i + 1
  }

  /** Four rails along the movement axis of total length len centered at (cx,cy,cz). */
  private rails(cx: number, cy: number, cz: number, half: number, t: number, dx: number, dy: number, len: number): void {
    const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2
    const b = (axis + 1) % 3
    const c = (axis + 2) % 3
    for (let sb = -1; sb <= 1; sb += 2) {
      for (let sc = -1; sc <= 1; sc += 2) {
        this.beamAt(axis, b, c, sb * half, sc * half, cx, cy, cz, len, t)
      }
    }
  }

  /** Square ring in the plane perpendicular to the movement. */
  private ring(cx: number, cy: number, cz: number, half: number, t: number, dx: number, dy: number): void {
    const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2
    const b = (axis + 1) % 3
    const c = (axis + 2) % 3
    const len = 2 * half + t
    for (let s = -1; s <= 1; s += 2) {
      this.beamAt(b, axis, c, 0, s * half, cx, cy, cz, len, t) // along b, offset along c
      this.beamAt(c, axis, b, 0, s * half, cx, cy, cz, len, t) // along c, offset along b
    }
  }

  /** Beam along axis, offset by ob along axis b and by oc along axis c. */
  private beamAt(axis: number, b: number, c: number, ob: number, oc: number, cx: number, cy: number, cz: number, len: number, t: number): void {
    let x = cx
    let y = cy
    let z = cz
    if (b === 0) x += ob
    else if (b === 1) y += ob
    else z += ob
    if (c === 0) x += oc
    else if (c === 1) y += oc
    else z += oc
    this.beam(axis, x, y, z, len, t)
  }

  dispose(): void {
    this.pool.dispose()
  }
}
