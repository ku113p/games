// Where the security can actually see: for every camera and drone a fan of horizontal rays is cast over the level
// grid on the CPU (walls stop them) and written into one small texture, one row per device. The floor fans and the
// cone volumes read it, so neither leaks through walls. The rays are world-locked: a sweeping camera only needs a
// new fan when it turns past the margin, a drone when it moves. No allocations after the build.
import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from 'three'
import cfgAll from '../config.json'
import { CellKind, type Grid } from '../core/grid'

const K = cfgAll.view.cones
const DEG = Math.PI / 180

/** Rays per fan (texture width) and fans in all (texture height). */
export const FAN_RAYS = K.rays
export const MAX_FANS = 32
/** Fan keys: cameras use their index, drones DRONE_KEY + index. */
export const DRONE_KEY = 8

export interface Fan {
  /** Texture row (v at the texel centre); negative when the device has no row (then nothing is clipped). */
  v: number
  ox: number
  oz: number
  yaw: number
  /** Half the azimuth the rays cover, radians. */
  spread: number
}

export interface Sight {
  readonly texture: DataTexture
  /** The occlusion fan of a device, recast when needed. spread from fanSpread(). */
  fan(key: number, x: number, z: number, yaw: number, spread: number, range: number): Fan
  /** Once a frame after all fan() calls: advances the clock, uploads changed rows. */
  flush(dt: number): void
}

/** Half the azimuth a cone (half-angle a, pitched down p) covers on the floor, plus the turn margin. */
export function fanSpread(halfAngleRad: number, pitchRad: number): number {
  const s = Math.min(1, Math.sin(halfAngleRad) / Math.max(0.05, Math.cos(pitchRad)))
  return Math.asin(s) + K.marginDeg * DEG
}

interface Slot {
  fan: Fan
  range: number
  last: number
  valid: boolean
}

export function createSight(g: Grid): Sight {
  const data = new Uint8Array(FAN_RAYS * MAX_FANS)
  const texture = new DataTexture(data, FAN_RAYS, MAX_FANS, RedFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  const slots: Slot[] = []
  for (let i = 0; i < MAX_FANS; i++) slots.push({ fan: { v: (i + 0.5) / MAX_FANS, ox: 0, oz: 0, yaw: 0, spread: 0 }, range: 1, last: -1, valid: false })
  const none: Fan = { v: -1, ox: 0, oz: 0, yaw: 0, spread: 1 }
  const margin = K.marginDeg * DEG
  const minGap = 1 / Math.max(1, K.updateHz)
  let clock = 0
  let dirty = false

  const blocked = (c: number, r: number): boolean => c < 0 || r < 0 || c >= g.cols || r >= g.rows || g.kind[r * g.cols + c] === CellKind.Wall

  /** Distance along (dx, dz) to the first wall cell (the start cell never blocks), up to range. 2D DDA. */
  function cast(x: number, z: number, dx: number, dz: number, range: number): number {
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
      if (blocked(c, r)) return t
    }
    return range
  }

  function recast(i: number, s: Slot, x: number, z: number, yaw: number, spread: number, range: number): void {
    const f = s.fan
    f.ox = x
    f.oz = z
    f.yaw = yaw
    f.spread = spread
    s.range = range
    s.last = clock
    s.valid = true
    const row = i * FAN_RAYS
    for (let k = 0; k < FAN_RAYS; k++) {
      const a = yaw - spread + (2 * spread * k) / (FAN_RAYS - 1)
      const d = cast(x, z, Math.sin(a), Math.cos(a), range)
      data[row + k] = Math.round((d / range) * 255)
    }
    dirty = true
  }

  return {
    texture,
    fan(key, x, z, yaw, spread, range): Fan {
      if (key < 0 || key >= MAX_FANS) return none
      const s = slots[key] as Slot
      const f = s.fan
      let turn = Math.abs(yaw - f.yaw) % (Math.PI * 2)
      if (turn > Math.PI) turn = Math.PI * 2 - turn
      const moved = Math.abs(x - f.ox) + Math.abs(z - f.oz)
      const must = !s.valid || range !== s.range || spread !== f.spread || moved > K.moveSnap || turn > margin * 0.6
      const may = clock - s.last >= minGap && (moved > 0.01 || turn > margin * 0.25)
      if (must || may) recast(key, s, x, z, yaw, spread, range)
      return f
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

/** GLSL: how far (0..1 of the range) the fan in row v sees at world azimuth az. */
export const SIGHT_GLSL = /* glsl */ `
float sightAt(sampler2D fans, vec4 fan, float v, vec2 d) {
  // fan: origin x, origin z, yaw, spread; d: the point minus the origin (xz)
  float az = atan(d.x, d.y);
  float rel = mod(az - fan.z + 3.14159265, 6.2831853) - 3.14159265;
  float a01 = clamp(rel / (2.0 * fan.w) + 0.5, 0.0, 1.0);
  float u = (a01 * ${(FAN_RAYS - 1).toFixed(1)} + 0.5) / ${FAN_RAYS.toFixed(1)};
  return texture2D(fans, vec2(u, v)).r;
}`
