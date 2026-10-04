// Where a drone's drawn light may reach: the look beam, the view volume, the scanning fan under it and the aim beam
// are clipped by what stands in the way, so no light shows through a wall, a slab, a parapet, a rail wall or a closed red wall.
//
// This is the same question detection asks (can the eye see past this?), asked of the whole picture instead of one head:
//  - a wall, slab or block blocks the drawn light when its top reaches `lightLevel` = min(eye - 0.2, floor under the
//    drone + RAIL_BLOCK). The step to the floor + 1 m is what makes the low parapets and rail walls (1.1 m and up) stop the
//    light, as they hide a crouched head in detection; the block under a drone that floats over it never blocks its own light.
//  - the aim beam is an exact line to the player's chest: it stops where that line meets something (it never starts
//    one - detection has already said the drone sees the player when it is drawn).
//  - the glowing rails along platform edges over the void are drawn lines without a body (no collider, no sight
//    blocking): the light is left to cross them.
// 64 distances round the drone (CLIP_N sectors, one DDA walk each), recast every frame it moves; no allocations.
import { Vector2 } from 'three'
import { blockContains, CellKind, floorHeightAt, type Block, type Grid } from '../core/grid'

export const CLIP_N = 64
/** A wall or block this much above the floor under the drone stops the drawn light (rails, parapets and up). */
const RAIL_BLOCK = 1.0

/** The uniforms one drone's clip shares between its materials. */
export interface ClipUniforms {
  table: { value: Float32Array }
  origin: { value: Vector2 }
  on: { value: number }
}

export function createClipUniforms(): ClipUniforms {
  return { table: { value: new Float32Array(CLIP_N).fill(99) }, origin: { value: new Vector2() }, on: { value: 0 } }
}

/** GLSL: `uClip`, `uClipO`, `uClipOn` and clipVis(world xz): 0 where the light is cut, 1 where it passes. */
export const CLIP_GLSL = /* glsl */ `
uniform float uClip[${CLIP_N}];
uniform vec2 uClipO;
uniform float uClipOn;
float clipVis(vec2 w) {
  if (uClipOn < 0.5) return 1.0;
  vec2 d = w - uClipO;
  float f = (atan(d.x, d.y) / 6.2831853 + 0.5) * ${CLIP_N.toFixed(1)};
  float i0 = floor(f);
  int a = int(mod(i0, ${CLIP_N.toFixed(1)}));
  int b = int(mod(i0 + 1.0, ${CLIP_N.toFixed(1)}));
  float reach = min(uClip[a], uClip[b]);
  return 1.0 - smoothstep(reach - 0.06, reach + 0.04, length(d));
}`

export interface LightClip {
  /** Fills `into` with the reach (m, up to `range`) at CLIP_N azimuths from a drone at (x, y, z). */
  fill(into: Float32Array, x: number, y: number, z: number, range: number): void
  /** Distance along (dx, dz) (unit) up to `max` before the straight line to height `endY` (at `max`) meets something solid; `max` when free. */
  line(x: number, y: number, z: number, dx: number, dz: number, max: number, endY: number): number
  /** Once a frame: the red walls (closed ones block). */
  setWalls(walls: readonly { readonly open: boolean }[]): void
}

export function createLightClip(g: Grid): LightClip {
  let walls: readonly { readonly open: boolean }[] = []
  const near: Block[] = []

  /** `top(s)`: the height a blocker must reach at distance s: a constant `level`, or the line from y to endY. */
  function walk(x: number, y: number, z: number, dx: number, dz: number, max: number, level: number, endY: number): number {
    const line = level === Infinity
    const lvl = (s: number): number => (line ? y + ((endY - y) * s) / max : level)
    let best = max
    // blocks (server blocks, hex modules): their boxes, in the ray's way
    for (let i = 0; i < near.length; i++) {
      const b = near[i] as Block
      let t0 = 0
      let t1 = best
      if (Math.abs(dx) < 1e-9) {
        if (x < b.minX || x > b.maxX) continue
      } else {
        const a = (b.minX - x) / dx
        const c = (b.maxX - x) / dx
        t0 = Math.max(t0, Math.min(a, c))
        t1 = Math.min(t1, Math.max(a, c))
      }
      if (Math.abs(dz) < 1e-9) {
        if (z < b.minZ || z > b.maxZ) continue
      } else {
        const a = (b.minZ - z) / dz
        const c = (b.maxZ - z) / dz
        t0 = Math.max(t0, Math.min(a, c))
        t1 = Math.min(t1, Math.max(a, c))
      }
      if (t0 > t1 || t0 <= 0.05) continue // behind it, or the drone's own spot (flying over it)
      if (b.maxY < lvl(t0)) continue // the light passes over it
      if (b.hex && !blockContains(b, x + dx * (t0 + 0.05), z + dz * (t0 + 0.05)) && !blockContains(b, x + dx * (t0 + (t1 - t0) / 2), z + dz * (t0 + (t1 - t0) / 2))) continue
      if (t0 < best) best = t0
    }
    // cells: walls and slabs, closed red walls (2D DDA)
    const cs = g.cell
    let c = Math.floor(x / cs)
    let r = Math.floor(z / cs)
    const sc = dx > 0 ? 1 : -1
    const sr = dz > 0 ? 1 : -1
    const ax = Math.abs(dx)
    const az = Math.abs(dz)
    const tdx = ax > 1e-9 ? cs / ax : Infinity
    const tdz = az > 1e-9 ? cs / az : Infinity
    let tx = ax > 1e-9 ? (dx > 0 ? (c + 1) * cs - x : x - c * cs) / ax : Infinity
    let tz = az > 1e-9 ? (dz > 0 ? (r + 1) * cs - z : z - r * cs) / az : Infinity
    for (let guard = 0; guard < 128; guard++) {
      let t: number
      if (tx < tz) {
        t = tx
        tx += tdx
        c += sc
      } else {
        t = tz
        tz += tdz
        r += sr
      }
      if (t >= best) return best
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return Math.min(best, t)
      const i = r * g.cols + c
      const k = g.kind[i]
      if (k === CellKind.Wall) {
        if ((g.top[i] as number) >= lvl(t)) return Math.min(best, t)
      } else if (k === CellKind.RedWall) {
        const w = walls[g.group[i] as number]
        if (w && !w.open) return Math.min(best, t)
      } else if (k === CellKind.Niche) return Math.min(best, t)
    }
    return best
  }

  function gather(x: number, z: number, reach: number): void {
    near.length = 0
    for (const b of g.blocks) {
      if (b.maxX < x - reach || b.minX > x + reach || b.maxZ < z - reach || b.minZ > z + reach) continue
      near.push(b)
    }
  }

  return {
    fill(into, x, y, z, range): void {
      gather(x, z, range)
      // the surface under the drone sets the level (a drone over a slab is above it, so it never blocks the light)
      let under = floorHeightAt(g, x, z)
      for (const b of near) if (blockContains(b, x, z) && b.maxY > under) under = b.maxY
      const level = Math.min(y - 0.2, under + RAIL_BLOCK)
      for (let k = 0; k < CLIP_N; k++) {
        const a = ((k / CLIP_N) - 0.5) * Math.PI * 2
        into[k] = walk(x, y, z, Math.sin(a), Math.cos(a), range, level, 0)
      }
    },
    line(x, y, z, dx, dz, max, endY): number {
      gather(x, z, max)
      return walk(x, y, z, dx, dz, max, Infinity, endY)
    },
    setWalls(next): void {
      walls = next
    },
  }
}
