// The exposure map: how often each floor spot is watched, as one small data texture the floor material reads (DESIGN 8, 14:
// the lit/dark stealth language). Cones and ranges still show only in network vision; this is the city's lighting, so
// watched floor is lit cool and blind spots and lanes behind cover are dark, whatever the level layout.
//
// How it is computed (all derived from the level and the live state, nothing is authored):
//  - every watcher is a layer: a camera over its sweep (sampled across the period, holds weigh in), a patrol drone over
//    its route loop, a warden over its round (walking glances and the stops' scans) or at its post. A layer is a list of
//    weighted poses; each pose casts the same sight fan the floor cones use (view/sight.ts probe, which follows the
//    detection rule: a crouched head, steps, cover, slabs, roofs, closed red walls) and every floor texel inside the
//    device's real cone and the fan's visible stretches scores the pose's weight. Layer = score / total weight = the
//    share of its time the device sees that spot.
//  - the map is 1 - product(1 - layer * gain). A paused, destroyed, downed, hacked or red-walled-off device fades its
//    layer out (gain), a red wall opening or closing recomputes every layer, one layer per frame within a time budget.
//  - texture: R = exposure, G = the footlight mask (dark floor within reach of a cover element that has another one
//    within linkGap, so isolated decorative cover gets none and chains read as a lane). Solid texels copy their
//    neighbours' exposure so the linear filter does not dim the floor along walls.
// Cost: the heavy part (a few hundred fan casts) runs once at level load; after that a frame does a loop over the
// devices and, on a change, a few thousand texel updates. No allocation after the build.
import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from 'three'
import cfgAll from '../config.json'
import { CellKind, floorHeightAt, type Grid } from '../core/grid'
import { dronePatrolRoutes, drones, redWalls, sweepYaw, videoCameras, wardenRoutes, wardens, wardenStops } from '../core/queries'
import type { GameState, Sim } from '../core/state'
import { FAN_RAYS, fanSpread, type Sight } from './sight'

const S = cfgAll.view.stealthLight
const DEG = Math.PI / 180
const TAU = Math.PI * 2
const CROUCH_EYE = cfgAll.player.crouchEyeHeight
const RES = S.texelsPerMeter

/** The switch: config view.stealthLight.enabled, and the ?nolanes URL flag for a quick A/B. */
export const lanesEnabled: boolean = S.enabled && !(typeof location !== 'undefined' && location.search.includes('nolanes'))

export interface Exposure {
  readonly texture: DataTexture
  /** World size of the texture, m (the floor shader's uv = xz / size). */
  readonly width: number
  readonly depth: number
  /** Once a frame, after sight.setWalls(): follows the devices' states and the red walls. Cheap unless something changed. */
  update(s: GameState, sim: Sim, dt: number): void
  /** Debug: how many fan casts a full rebuild costs and the last build's time, ms. */
  readonly stats: { poses: number; layers: number; buildMs: number }
}

interface Cone {
  cosHalf: number
  cp: number
  sp: number
  /** Half the azimuth of the fan's rays (the cone's footprint, without the update margin). */
  spread: number
  range: number
}

interface Layer {
  cone: Cone
  /** x, y (eye), z, yaw, weight per pose. */
  poses: number[]
  total: number
  /** Texel box [tx0, tx1) x [tz0, tz1). */
  tx0: number
  tx1: number
  tz0: number
  tz1: number
  /** Poses scored so far in the running recompute, and the score. */
  next: number
  acc: Float32Array
  /** The finished share 0..1. */
  f: Float32Array
  gain: number
  on: (s: GameState) => boolean
}

function coneOf(halfAngleDeg: number, pitchDeg: number, range: number): Cone {
  return {
    cosHalf: Math.cos(halfAngleDeg * DEG),
    cp: Math.cos(pitchDeg * DEG),
    sp: Math.sin(pitchDeg * DEG),
    spread: fanSpread(halfAngleDeg * DEG, pitchDeg * DEG) - cfgAll.view.cones.marginDeg * DEG,
    range,
  }
}

function boxGap(a: Box, b: Box): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1)
  const dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1)
  return Math.hypot(dx, dz)
}

interface Box {
  x0: number
  z0: number
  x1: number
  z1: number
}

const wrapPi = (a: number): number => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI

export function createExposure(g: Grid, sight: Sight, s: GameState, sim: Sim): Exposure {
  const TW = Math.ceil(g.cols * g.cell * RES)
  const TH = Math.ceil(g.rows * g.cell * RES)
  const data = new Uint8Array(TW * TH * 4)
  const texture = new DataTexture(data, TW, TH, RGBAFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  const stats = { poses: 0, layers: 0, buildMs: 0 }
  const out: Exposure = {
    texture,
    width: TW / RES,
    depth: TH / RES,
    update: () => {},
    stats,
  }
  if (!lanesEnabled) return out

  // ---- static per-texel data
  const solid = new Uint8Array(TW * TH) // 1: not floor (slab, low cover, void): never scored
  const floorY = new Float32Array(TW * TH)
  for (let tz = 0; tz < TH; tz++) {
    for (let tx = 0; tx < TW; tx++) {
      const x = (tx + 0.5) / RES
      const z = (tz + 0.5) / RES
      const c = Math.floor(x / g.cell)
      const r = Math.floor(z / g.cell)
      const i = tz * TW + tx
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) {
        solid[i] = 1
        continue
      }
      const k = g.kind[r * g.cols + c]
      if (k === CellKind.Wall || k === CellKind.Void || k === CellKind.Cover) solid[i] = 1
      floorY[i] = floorHeightAt(g, x, z)
    }
  }

  // ---- the cover chains (static): elements are the low cover cells and the server blocks / hex modules
  const elems: Box[] = []
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) if (g.kind[r * g.cols + c] === CellKind.Cover) elems.push({ x0: c * g.cell, z0: r * g.cell, x1: (c + 1) * g.cell, z1: (r + 1) * g.cell })
  }
  for (const b of g.blocks) elems.push({ x0: b.minX, z0: b.minZ, x1: b.maxX, z1: b.maxZ })
  const chain = new Uint8Array(TW * TH)
  for (let a = 0; a < elems.length; a++) {
    const ea = elems[a] as Box
    let linked = false
    for (let b = 0; b < elems.length && !linked; b++) if (b !== a && boxGap(ea, elems[b] as Box) <= S.linkGap) linked = true
    if (!linked) continue
    const x0 = Math.max(0, Math.floor((ea.x0 - S.footReach) * RES))
    const x1 = Math.min(TW - 1, Math.ceil((ea.x1 + S.footReach) * RES))
    const z0 = Math.max(0, Math.floor((ea.z0 - S.footReach) * RES))
    const z1 = Math.min(TH - 1, Math.ceil((ea.z1 + S.footReach) * RES))
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) chain[tz * TW + tx] = 1
  }

  // ---- layers: one per watcher
  const layers: Layer[] = []
  const probe = new Uint8Array(FAN_RAYS * 4)

  function addLayer(cone: Cone, poses: number[], on: (st: GameState) => boolean): void {
    if (poses.length === 0) return
    let total = 0
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (let k = 0; k < poses.length; k += 5) {
      total += poses[k + 4] as number
      minX = Math.min(minX, poses[k] as number)
      maxX = Math.max(maxX, poses[k] as number)
      minZ = Math.min(minZ, poses[k + 2] as number)
      maxZ = Math.max(maxZ, poses[k + 2] as number)
    }
    const tx0 = Math.max(0, Math.floor((minX - cone.range) * RES))
    const tx1 = Math.min(TW, Math.ceil((maxX + cone.range) * RES) + 1)
    const tz0 = Math.max(0, Math.floor((minZ - cone.range) * RES))
    const tz1 = Math.min(TH, Math.ceil((maxZ + cone.range) * RES) + 1)
    const n = Math.max(1, (tx1 - tx0) * (tz1 - tz0))
    layers.push({ cone, poses, total, tx0, tx1, tz0, tz1, next: 0, acc: new Float32Array(n), f: new Float32Array(n), gain: 0, on })
  }

  /** Scores one pose of a layer into its acc. */
  function score(L: Layer, k: number): void {
    const p = L.poses
    const ox = p[k] as number
    const oy = p[k + 1] as number
    const oz = p[k + 2] as number
    const yaw = p[k + 3] as number
    const w = p[k + 4] as number
    const c = L.cone
    sight.probe(probe, ox, oy, oz, yaw, c.spread, c.range)
    const fx = Math.sin(yaw) * c.cp
    const fy = -c.sp
    const fz = Math.cos(yaw) * c.cp
    const bw = L.tx1 - L.tx0
    const tx0 = Math.max(L.tx0, Math.floor((ox - c.range) * RES))
    const tx1 = Math.min(L.tx1 - 1, Math.floor((ox + c.range) * RES))
    const tz0 = Math.max(L.tz0, Math.floor((oz - c.range) * RES))
    const tz1 = Math.min(L.tz1 - 1, Math.floor((oz + c.range) * RES))
    const r2 = c.range * c.range
    for (let tz = tz0; tz <= tz1; tz++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = tz * TW + tx
        if (solid[i]) continue
        const dx = (tx + 0.5) / RES - ox
        const dz = (tz + 0.5) / RES - oz
        const hl2 = dx * dx + dz * dz
        if (hl2 > r2) continue
        const dy = (floorY[i] as number) + CROUCH_EYE - oy
        const d3 = Math.sqrt(hl2 + dy * dy)
        if (d3 > c.range || d3 < 1e-3) continue
        if ((dx * fx + dy * fy + dz * fz) / d3 < c.cosHalf) continue
        const rel = wrapPi(Math.atan2(dx, dz) - yaw)
        if (rel > c.spread || rel < -c.spread) continue
        const o = Math.round((rel / (2 * c.spread) + 0.5) * (FAN_RAYS - 1)) * 4
        const t = Math.sqrt(hl2) / c.range
        let seen = t <= (probe[o] as number) / 255 + 0.01
        if (!seen) {
          const f0 = (probe[o + 1] as number) / 255
          const f1 = (probe[o + 2] as number) / 255
          seen = f1 > f0 && t >= f0 - 0.004 && t <= f1 + 0.004
        }
        if (seen) {
          const j = (tz - L.tz0) * bw + (tx - L.tx0)
          L.acc[j] = (L.acc[j] as number) + w
        }
      }
    }
  }

  function finish(L: Layer): void {
    const inv = 1 / Math.max(1e-6, L.total)
    for (let i = 0; i < L.acc.length; i++) L.f[i] = Math.min(1, (L.acc[i] as number) * inv)
  }

  // cameras: the sweep sampled across its period
  const cvc = cfgAll.videoCamera
  const camCone = coneOf(cvc.halfAngleDeg, cvc.pitchDeg, cvc.range)
  videoCameras(s).forEach((c, i) => {
    const poses: number[] = []
    for (let k = 0; k < S.cameraPoses; k++) {
      const time = ((k + 0.5) / S.cameraPoses) * c.period
      poses.push(c.pos.x, c.pos.y, c.pos.z, sweepYaw(c.baseYaw, c.sweepA, c.sweepB, c.period, c.phase, cvc.holdShare, time), 1)
    }
    addLayer(camCone, poses, (st) => {
      const v = videoCameras(st)[i]
      return !!v && v.alive && v.pausedTime <= 0
    })
  })

  /** Samples along a closed polyline, about `spacing` apart, capped at maxN: x, z, heading, and the point's y via `y`. */
  function along(pts: readonly { x: number; z: number }[], maxN: number, each: (x: number, z: number, heading: number, k: number) => void): number {
    const n = pts.length
    let len = 0
    for (let k = 0; k < n; k++) {
      const a = pts[k] as { x: number; z: number }
      const b = pts[(k + 1) % n] as { x: number; z: number }
      len += Math.hypot(b.x - a.x, b.z - a.z)
    }
    const spacing = Math.max(S.poseSpacing, len / maxN)
    let d = 0
    let count = 0
    for (let k = 0; k < n; k++) {
      const a = pts[k] as { x: number; z: number }
      const b = pts[(k + 1) % n] as { x: number; z: number }
      const l = Math.hypot(b.x - a.x, b.z - a.z)
      if (l < 1e-4) continue
      const heading = Math.atan2(b.x - a.x, b.z - a.z)
      for (; d < l; d += spacing) each(a.x + ((b.x - a.x) * d) / l, a.z + ((b.z - a.z) * d) / l, heading, count++)
      d -= l
    }
    return spacing
  }

  // drones: the patrol loop at hover height; the waypoints weigh in for the pause
  const dc = cfgAll.drone
  const droneCone = coneOf(dc.halfAngleDeg, dc.pitchDeg, dc.range)
  dronePatrolRoutes(s).forEach((route, i) => {
    if (route.length < 2) return
    const poses: number[] = []
    const y = (route[0] as { y: number }).y
    const spacing = along(route, S.maxPoses, (x, z, h) => poses.push(x, y, z, h, 1))
    const wpW = (dc.waypointPauseSec * dc.patrolSpeed) / spacing
    for (let k = 0; k < route.length; k++) {
      const a = route[k] as { x: number; y: number; z: number }
      const b = route[(k + 1) % route.length] as { x: number; z: number }
      poses.push(a.x, a.y, a.z, Math.atan2(b.x - a.x, b.z - a.z), wpW)
    }
    addLayer(droneCone, poses, (st) => {
      const d = drones(st)[i]
      return !!d && d.active && d.alive && d.role === 'patrol' && d.pausedTime <= 0
    })
  })

  // wardens: the round with the walking glances, the stops with their scans, or the post
  const wc = cfgAll.warden
  const wardenCone = coneOf(wc.halfAngleDeg, wc.pitchDeg, wc.range)
  const stops = wardenStops(sim)
  const lines = wardenRoutes(sim)
  stops.forEach((st, i) => {
    const line = lines[i] ?? []
    const poses: number[] = []
    const look = (x: number, y: number, z: number, yaw: number, w: number, spread: number): void => {
      const a = spread * DEG
      poses.push(x, y + wc.eyeHeight, z, yaw - a, w * 0.25, x, y + wc.eyeHeight, z, yaw, w * 0.5, x, y + wc.eyeHeight, z, yaw + a, w * 0.25)
    }
    if (line.length >= 2) {
      const spacing = along(line, Math.floor(S.maxPoses / 3), (x, z, h) => look(x, floorHeightAt(g, x, z), z, h, 1, wc.walkScanDeg))
      for (const stop of st) {
        if (!(stop.waitSec > 0) || !Number.isFinite(stop.look)) continue
        look(stop.x, stop.y, stop.z, stop.look, (stop.waitSec * wc.patrolSpeed) / spacing, wc.scanDeg)
      }
    } else {
      const stop = st[0]
      if (!stop || !Number.isFinite(stop.look)) return
      look(stop.x, stop.y, stop.z, stop.look, 1, wc.scanDeg)
    }
    addLayer(wardenCone, poses, (state) => {
      const w = wardens(state)[i]
      return !!w && !w.wave && w.alive && w.pausedTime <= 0 && !w.controlled && w.down <= 0
    })
  })

  // ---- build, combine, update
  const prod = new Float32Array(TW * TH)
  const wallOpen: boolean[] = []
  const queue: Layer[] = []
  let dirty = false
  let rx0 = 0
  let rx1 = 0
  let rz0 = 0
  let rz1 = 0
  const touch = (x0: number, x1: number, z0: number, z1: number): void => {
    if (!dirty) {
      rx0 = x0
      rx1 = x1
      rz0 = z0
      rz1 = z1
      dirty = true
      return
    }
    rx0 = Math.min(rx0, x0)
    rx1 = Math.max(rx1, x1)
    rz0 = Math.min(rz0, z0)
    rz1 = Math.max(rz1, z1)
  }

  /** Rewrites the texture over the dirty box (and one texel round it) from the layers. */
  function combine(): void {
    const x0 = Math.max(0, rx0 - 1)
    const x1 = Math.min(TW, rx1 + 1)
    const z0 = Math.max(0, rz0 - 1)
    const z1 = Math.min(TH, rz1 + 1)
    for (let tz = z0; tz < z1; tz++) for (let tx = x0; tx < x1; tx++) prod[tz * TW + tx] = 1
    for (const L of layers) {
      if (L.gain <= 0) continue
      const ax0 = Math.max(x0, L.tx0)
      const ax1 = Math.min(x1, L.tx1)
      const az0 = Math.max(z0, L.tz0)
      const az1 = Math.min(z1, L.tz1)
      const bw = L.tx1 - L.tx0
      for (let tz = az0; tz < az1; tz++) {
        for (let tx = ax0; tx < ax1; tx++) {
          const f = (L.f[(tz - L.tz0) * bw + (tx - L.tx0)] as number) * L.gain
          if (f > 0) prod[tz * TW + tx] = (prod[tz * TW + tx] as number) * (1 - f)
        }
      }
    }
    for (let tz = z0; tz < z1; tz++) {
      for (let tx = x0; tx < x1; tx++) {
        const i = tz * TW + tx
        let e = 1 - (prod[i] as number)
        if (solid[i]) {
          // a solid texel (the slab's foot) takes its brightest floor neighbour, so the filter keeps the floor lit up to the wall
          e = 0
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = tx + dx
              const nz = tz + dz
              if (nx < 0 || nz < 0 || nx >= TW || nz >= TH) continue
              const j = nz * TW + nx
              if (!solid[j]) e = Math.max(e, 1 - (prod[j] as number))
            }
          }
        }
        const o = i * 4
        data[o] = Math.round(Math.min(1, e) * 255)
        // the footlights: only where the floor is dark, fading in as the exposure falls below safeBelow
        const dark = 1 - Math.min(1, Math.max(0, (e - S.safeBelow) / S.safeBelow))
        data[o + 1] = solid[i] ? 0 : Math.round((chain[i] as number) * dark * 255)
        data[o + 3] = 255
      }
    }
    texture.needsUpdate = true
    dirty = false
  }

  function restart(L: Layer): void {
    L.next = 0
    L.acc.fill(0)
    if (!queue.includes(L)) queue.push(L)
  }

  /** Scores poses of the queued layers until the budget (ms) is spent; true while work is left. */
  function work(budgetMs: number): boolean {
    const end = performance.now() + budgetMs
    while (queue.length > 0) {
      const L = queue[0] as Layer
      while (L.next < L.poses.length) {
        score(L, L.next)
        L.next += 5
        stats.poses++
        if (performance.now() > end) return true
      }
      finish(L)
      queue.shift()
      touch(L.tx0, L.tx1, L.tz0, L.tz1)
    }
    return false
  }

  function walls(st: GameState): boolean {
    const w = redWalls(st)
    let changed = false
    for (let i = 0; i < w.length; i++) {
      const o = (w[i] as { open: boolean }).open
      if (wallOpen[i] !== o) {
        wallOpen[i] = o
        changed = true
      }
    }
    return changed
  }

  // the first build: everything now (cold path)
  const t0 = performance.now()
  sight.setWalls(redWalls(s))
  walls(s)
  for (const L of layers) {
    restart(L)
    L.gain = L.on(s) ? 1 : 0
  }
  work(Infinity)
  touch(0, TW, 0, TH)
  combine()
  stats.layers = layers.length
  stats.buildMs = performance.now() - t0

  out.update = (st, _sim, dt): void => {
    if (walls(st) && wallOpen.length > 0) {
      sight.setWalls(redWalls(st))
      for (const L of layers) restart(L)
    }
    const step = dt / Math.max(0.05, S.fadeSec)
    for (const L of layers) {
      const target = L.on(st) ? 1 : 0
      if (L.gain === target) continue
      L.gain = target > L.gain ? Math.min(target, L.gain + step) : Math.max(target, L.gain - step)
      touch(L.tx0, L.tx1, L.tz0, L.tz1)
    }
    if (queue.length > 0) work(S.budgetMs)
    if (dirty) combine()
  }
  return out
}
