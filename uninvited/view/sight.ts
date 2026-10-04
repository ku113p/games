// Where the security can actually see: for every camera and drone a fan of rays is cast over the level on the CPU and
// written into one small texture, one row per device. The floor fans and the cone volumes read it, so neither leaks
// through walls or past cover. The rays are world-locked: a sweeping camera only needs a new fan when it turns past the
// margin, a drone when it moves. No allocations after the build.
//
// Each ray stores four distances (0..1 of the range, RGBA):
//   R  end of the near visible stretch      G, B  start and end of the far visible stretch      A  the first wall
// "Visible" follows the detection rule (core/rules/detection.ts): the device's eye has a clear line to a crouched
// head standing on that spot, over the floor steps, the low cover, the slabs and hex blocks lower than the eye (they
// cast shadows; you can stand on them), the server blocks and hex modules, under the niche roofs and the level's roofs,
// and not through a closed red wall. So the floor fan is cut exactly where crouching hides you (behind a block, past a
// step); the volume (A) only stops at blocks taller than the eye. The void neither hides nor shows anything. A ray seldom has more than one shadow; when it does, the narrowest gaps are
// filled in (the fan shows a little more than the device sees, never less).
import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from 'three'
import cfgAll from '../config.json'
import { blockContains, CellKind, floorHeightAt, roofAt, type Block, type Grid } from '../core/grid'

const K = cfgAll.view.cones
const DEG = Math.PI / 180
const CROUCH_EYE = cfgAll.player.crouchEyeHeight

/** Rays per fan (texture width) and fans in all (texture height). */
export const FAN_RAYS = K.rays
export const MAX_FANS = 32
/** Fan keys: cameras use their index, drones DRONE_KEY + index. */
export const DRONE_KEY = 8
/** Visible stretches kept per ray while marching (the texture keeps two). */
const MAX_SEGS = 8
/** How far the low cover's collider is inset from its cell's sides (adapters/physics-rapier.ts builds it so). */
const COVER_INSET = 0.05

export interface Fan {
  /** Texture row (v at the texel centre); negative when the device has no row (then nothing is clipped). */
  v: number
  ox: number
  oz: number
  yaw: number
  /** Half the azimuth the rays cover, radians. */
  spread: number
}

/** A red wall as the sight needs it (the redWalls query's items fit). */
export interface SightWall {
  readonly alongX: boolean
  readonly coord: number
  readonly open: boolean
}

export interface Sight {
  readonly texture: DataTexture
  /** The occlusion fan of a device at eye (x, y, z), recast when needed. spread from fanSpread(). */
  fan(key: number, x: number, y: number, z: number, yaw: number, spread: number, range: number): Fan
  /** Once a frame before the fan() calls: the red walls (closed ones block); a wall opening or closing recasts all fans. */
  setWalls(walls: readonly SightWall[]): void
  /** Once a frame after all fan() calls: advances the clock, uploads changed rows. */
  flush(dt: number): void
}

/** No fan: nothing is clipped (for the short look beams). */
export const NO_FAN: Readonly<Fan> = { v: -1, ox: 0, oz: 0, yaw: 0, spread: 1 }

/** Half the azimuth a cone (half-angle a, pitched down p) covers on the floor, plus the turn margin. */
export function fanSpread(halfAngleRad: number, pitchRad: number): number {
  const s = Math.min(1, Math.sin(halfAngleRad) / Math.max(0.05, Math.cos(pitchRad)))
  return Math.asin(s) + K.marginDeg * DEG
}

interface Slot {
  fan: Fan
  oy: number
  range: number
  last: number
  valid: boolean
}

export function createSight(g: Grid): Sight {
  const data = new Uint8Array(FAN_RAYS * MAX_FANS * 4)
  const texture = new DataTexture(data, FAN_RAYS, MAX_FANS, RGBAFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  const slots: Slot[] = []
  for (let i = 0; i < MAX_FANS; i++) slots.push({ fan: { v: (i + 0.5) / MAX_FANS, ox: 0, oz: 0, yaw: 0, spread: 0 }, oy: 0, range: 1, last: -1, valid: false })
  const margin = K.marginDeg * DEG
  const minGap = 1 / Math.max(1, K.updateHz)
  const step = K.sightStep
  let clock = 0
  let dirty = false
  let walls: readonly SightWall[] = []
  const wallOpen: boolean[] = []
  // per-recast scratch: the server blocks within reach, the visible stretches of one ray, per-ray shadow flags
  const near: Block[] = []
  const segs = new Float32Array(MAX_SEGS * 2)
  const shadowed = new Uint8Array(FAN_RAYS)

  /** A closed red wall in cell i whose plane the ray from (x, z) crosses at a distance in [t0, t1]: that distance, else -1. */
  function redWallHit(i: number, x: number, z: number, dx: number, dz: number, t0: number, t1: number): number {
    const w = walls[g.group[i] as number]
    if (!w || w.open) return -1
    const o = w.alongX ? x : z
    const d = w.alongX ? dx : dz
    if (Math.abs(d) < 1e-9) return -1
    const t = (w.coord - o) / d
    return t >= t0 && t <= t1 ? t : -1
  }

  /**
   * Distance along (dx, dz) to the first block at least as tall as the eye (y) or closed red wall (the start cell
   * never blocks), up to range. 2D DDA.
   */
  function cast(x: number, y: number, z: number, dx: number, dz: number, range: number): number {
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
    for (let guard = 0; guard < 256; guard++) {
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
      if (t >= range) return range
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return t
      const i = r * g.cols + c
      const k = g.kind[i]
      if (k === CellKind.Wall && (g.top[i] as number) >= y) return t
      if (k === CellKind.RedWall) {
        const hit = redWallHit(i, x, z, dx, dz, t, Math.min(tx, tz))
        if (hit >= 0) return Math.min(hit, range)
      }
    }
    return range
  }

  /**
   * Marches one ray (eye at height y) up to the wall distance and fills `segs` with the stretches where a crouched head
   * is in the line of sight. Line of sight to a target at distance s: its downward slope (y - target) / s must stay
   * below every earlier obstacle top's slope (y - top) / s' and above every earlier niche roof's. Returns the count.
   */
  function march(x: number, y: number, z: number, dx: number, dz: number, wall: number): number {
    let n = 0
    let minBelow = Infinity
    let maxAbove = -Infinity
    let open = -1
    for (let s = step * 0.5; s < wall; s += step) {
      const px = x + dx * s
      const pz = z + dz * s
      const c = Math.floor(px / g.cell)
      const r = Math.floor(pz / g.cell)
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) break
      const i = r * g.cols + c
      const k = g.kind[i]
      if (k === CellKind.Void) continue // nothing stands there and nothing hides anything
      if (k === CellKind.Wall && (g.top[i] as number) >= y) continue // the device's own mounting edge
      // a block lower than the eye is ground you can stand on: its top is the floor there
      const floor = k === CellKind.Wall ? (g.top[i] as number) : floorHeightAt(g, px, pz)
      let top = floor
      if (k === CellKind.Cover) {
        // the low cover's box is inset a little from its cell (adapters/physics-rapier.ts)
        const fx = px - c * g.cell
        const fz = pz - r * g.cell
        if (fx > COVER_INSET && fx < g.cell - COVER_INSET && fz > COVER_INSET && fz < g.cell - COVER_INSET) top += g.coverHeight
      }
      for (let b = 0; b < near.length; b++) {
        const bl = near[b] as Block
        if (bl.maxY > top && blockContains(bl, px, pz)) top = bl.maxY
      }
      const slope = (y - top - CROUCH_EYE) / s
      const seen = slope < minBelow && slope > maxAbove
      if (seen && open < 0) open = s - step * 0.5
      else if (!seen && open >= 0) {
        if (n < MAX_SEGS) {
          segs[n * 2] = open
          segs[n * 2 + 1] = s - step * 0.5
          n++
        } else segs[n * 2 - 1] = s - step * 0.5 // out of room: stretch the last one (shows more, never less)
        open = -1
      }
      const below = (y - top) / s
      if (below < minBelow) minBelow = below
      if (k === CellKind.Niche) {
        const above = (y - ((g.h0[i] as number) + g.nicheHeight)) / s
        if (above > maxAbove) maxAbove = above
      }
      if (g.roofs.length > 0) {
        const roof = roofAt(g, px, pz)
        if (roof < Infinity) {
          const above = (y - roof) / s
          if (above > maxAbove) maxAbove = above
        }
      }
    }
    if (open >= 0) {
      if (n < MAX_SEGS) {
        segs[n * 2] = open
        segs[n * 2 + 1] = wall
        n++
      } else segs[n * 2 - 1] = wall
    }
    // keep two: fill in the narrowest gap until two stretches are left
    while (n > 2) {
      let best = 1
      let gap = Infinity
      for (let j = 1; j < n; j++) {
        const gj = (segs[j * 2] as number) - (segs[j * 2 - 1] as number)
        if (gj < gap) {
          gap = gj
          best = j
        }
      }
      segs[best * 2 - 1] = segs[best * 2 + 1] as number
      for (let j = best; j < n - 1; j++) {
        segs[j * 2] = segs[j * 2 + 2] as number
        segs[j * 2 + 1] = segs[j * 2 + 3] as number
      }
      n--
    }
    return n
  }

  const byte = (d: number, range: number): number => Math.max(0, Math.min(255, Math.round((d / range) * 255)))

  function recast(i: number, s: Slot, x: number, y: number, z: number, yaw: number, spread: number, range: number): void {
    const f = s.fan
    f.ox = x
    f.oz = z
    f.yaw = yaw
    f.spread = spread
    s.oy = y
    s.range = range
    s.last = clock
    s.valid = true
    near.length = 0
    const reach = range + 2
    for (const b of g.blocks) {
      if (b.maxX < x - reach || b.minX > x + reach || b.maxZ < z - reach || b.minZ > z + reach) continue
      near.push(b)
    }
    const row = i * FAN_RAYS * 4
    for (let k = 0; k < FAN_RAYS; k++) {
      const a = yaw - spread + (2 * spread * k) / (FAN_RAYS - 1)
      const dx = Math.sin(a)
      const dz = Math.cos(a)
      const wall = cast(x, y, z, dx, dz, range)
      const n = march(x, y, z, dx, dz, wall)
      const o = row + k * 4
      // the near stretch always starts at the device (the cone itself cuts the floor right under it)
      const nearEnd = n > 0 ? (segs[1] as number) : 0
      const farStart = n > 1 ? (segs[2] as number) : nearEnd
      const farEnd = n > 1 ? (segs[3] as number) : nearEnd
      data[o] = byte(nearEnd, range)
      data[o + 1] = byte(farStart, range)
      data[o + 2] = byte(farEnd, range)
      data[o + 3] = byte(wall, range)
      shadowed[k] = n > 1 ? 1 : 0
    }
    // a ray without a shadow next to one with a shadow: put its (empty) shadow where the neighbour's is, so the
    // linear filter tapers the shadow off between the rays instead of smearing it out to the far end
    for (let k = 0; k < FAN_RAYS; k++) {
      if (shadowed[k]) continue
      const nb = k > 0 && shadowed[k - 1] ? k - 1 : k < FAN_RAYS - 1 && shadowed[k + 1] ? k + 1 : -1
      if (nb < 0) continue
      const o = row + k * 4
      const q = row + nb * 4
      const mid = Math.round(((data[q] as number) + (data[q + 1] as number)) / 2)
      if (mid >= (data[o] as number)) continue // the neighbour's shadow lies beyond this ray's reach
      data[o + 2] = data[o] as number
      data[o] = mid
      data[o + 1] = mid
    }
    dirty = true
  }

  return {
    texture,
    fan(key, x, y, z, yaw, spread, range): Fan {
      if (key < 0 || key >= MAX_FANS) return NO_FAN
      const s = slots[key] as Slot
      const f = s.fan
      let turn = Math.abs(yaw - f.yaw) % (Math.PI * 2)
      if (turn > Math.PI) turn = Math.PI * 2 - turn
      const moved = Math.abs(x - f.ox) + Math.abs(z - f.oz) + Math.abs(y - s.oy)
      const must = !s.valid || range !== s.range || spread !== f.spread || moved > K.moveSnap || turn > margin * 0.6
      const may = clock - s.last >= minGap && (moved > 0.01 || turn > margin * 0.25)
      if (must || may) recast(key, s, x, y, z, yaw, spread, range)
      return f
    },
    setWalls(next): void {
      walls = next
      let changed = false
      for (let i = 0; i < next.length; i++) {
        const o = (next[i] as SightWall).open
        if (wallOpen[i] !== o) {
          wallOpen[i] = o
          changed = true
        }
      }
      if (changed) for (const s of slots) s.valid = false
    },
    flush(dt: number): void {
      clock += dt
      if (dirty) {
        texture.needsUpdate = true
        dirty = false
      }
    },
  }
}

/**
 * GLSL. sightAt: the ray texel of the fan in row v at the point d (the point minus the origin, xz) - see the RGBA
 * layout above. seenOnFloor: how much (0..1) a floor point at t (0..1 of the range) is in sight.
 */
export const SIGHT_GLSL = /* glsl */ `
vec4 sightAt(sampler2D fans, vec4 fan, float v, vec2 d) {
  // fan: origin x, origin z, yaw, spread
  float az = atan(d.x, d.y);
  float rel = mod(az - fan.z + 3.14159265, 6.2831853) - 3.14159265;
  float a01 = clamp(rel / (2.0 * fan.w) + 0.5, 0.0, 1.0);
  float u = (a01 * ${(FAN_RAYS - 1).toFixed(1)} + 0.5) / ${FAN_RAYS.toFixed(1)};
  return texture2D(fans, vec2(u, v));
}
float seenOnFloor(vec4 s, float t) {
  float nearPart = 1.0 - smoothstep(s.r - 0.012, s.r + 0.004, t);
  float farPart = smoothstep(s.g - 0.004, s.g + 0.012, t) * (1.0 - smoothstep(s.b - 0.012, s.b + 0.004, t));
  return max(nearPart, farPart);
}`
