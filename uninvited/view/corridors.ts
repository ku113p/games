// Turns the level grid into corridors that read as "living lines, not boxes" (DESIGN 14, NN1b):
// the outline of the walkable area is traced, its corners are rounded, and a rounded wall profile (floor fillet,
// wall, ceiling fillet) is swept along it, with continuous light seams along both fillets. Straight corridors get
// rounded light frames every few metres; height steps get a lit lip. Cold path: built once per level.
// The look (NN1b): glossy black walls with only a thin glow at the seams, a black floor that mirrors the lines
// (view/reflect.ts), red fans where the security looks (clipped by view/sight.ts), and at alarm 3 red waves running
// out along the seams from the hero.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Vector3,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RedFormat,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
  Vector2,
  Vector4,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import cfgAll from '../config.json'
import { CellKind, floorHeightAt, RampAxis, type Grid } from '../core/grid'
import { palette, type Materials } from './look'
import type { Mirror } from './reflect'
import { SIGHT_GLSL, type Fan, type Sight } from './sight'

const L = cfgAll.view.corridor
const K = cfgAll.view.cones

const FLOOR_FILLET = 0.32
const CEIL_FILLET = 0.8
const SEAM_RADIUS = L.seamRadius
const RIB_RADIUS = L.ribRadius
const RIB_EVERY = 3
const STEP = 0.5

/** Red waves running out from the hero along every line at alarm 3: 0..1 at a world point. */
const ALARM_GLSL = /* glsl */ `
uniform vec3 uAlarmColor;
uniform float uAlarm;
uniform float uTime;
uniform vec2 uCenter;
uniform float uWaveLen;
uniform float uWaveSpeed;
float alarmWave(vec3 w) {
  float y = fract((uTime * uWaveSpeed - length(w.xz - uCenter)) / uWaveLen);
  return smoothstep(0.0, 0.03, y) * (1.0 - smoothstep(0.03, 0.55, y));
}`

const LINE_VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlarmDim;
varying vec3 vWorld;
${ALARM_GLSL}
#include <fog_pars_fragment>
void main() {
  // under alarm the cyan steps back a little so the red waves read
  float k = uAlarm * alarmWave(vWorld);
  gl_FragColor = vec4(mix(uColor * (1.0 - uAlarm * uAlarmDim), uAlarmColor, k), 1.0);
  #include <fog_fragment>
}`

const WALL_VERT = /* glsl */ `
attribute vec2 aH;
varying vec2 vH;
varying vec3 vNormalW;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vH = aH;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const WALL_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uSeam;
uniform float uSpill;
uniform float uSheen;
uniform float uAlarmWall;
varying vec2 vH;
varying vec3 vNormalW;
varying vec3 vWorld;
${ALARM_GLSL}
#include <fog_pars_fragment>
void main() {
  // glossy black: a thin glow right at the seams, a faint cold sheen at grazing angles, darkness in between
  float bottom = exp(-vH.x * 9.0);
  float top = exp(-vH.y * 6.0);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(viewDir, normalize(vNormalW)), 0.0), 5.0);
  vec3 c = uBase;
  c += uSeam * uSpill * (bottom + 0.5 * top);
  c += uSeam * uSheen * fres;
  c += uAlarmColor * uAlarm * uAlarmWall * alarmWave(vWorld) * (bottom + top);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`

const FLOOR_VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const FLOOR_FRAG = /* glsl */ `
uniform sampler2D uWalls;
uniform vec2 uSize;
uniform vec3 uBase;
uniform vec3 uSeam;
uniform float uCell;
uniform float uNear;
uniform float uGrid;
uniform sampler2D uReflect;
uniform mat4 uReflectMatrix;
uniform vec2 uReflectPlane;
uniform float uReflectAmt;
uniform float uReflectBlur;
uniform sampler2D uFans;
uniform int uConeCount;
uniform vec3 uConePos[MAX_CONES];
uniform vec3 uConeDir[MAX_CONES];
uniform vec3 uConeColor[MAX_CONES];
uniform vec3 uConeShape[MAX_CONES];
uniform vec4 uConeFan[MAX_CONES];
uniform vec4 uFanLook;
uniform vec4 uFanLines;
varying vec3 vWorld;
${ALARM_GLSL}
${SIGHT_GLSL}
#include <fog_pars_fragment>
float gridLine(vec2 p, float width) {
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  return 1.0 - min(min(g.x, g.y) / width, 1.0);
}
void main() {
  vec2 uv = vWorld.xz / uSize;
  float wall = texture2D(uWalls, uv).r;
  float near = smoothstep(0.3, 0.46, wall);
  vec3 c = uBase;
  c += uSeam * near * uNear;
  c += uSeam * gridLine(vWorld.xz / uCell, 0.9) * uGrid * (1.0 - near);
  // the glossy floor mirrors the lines: a streaky blur along the screen's vertical, stronger at grazing angles
  float onPlane = uReflectPlane.y * (1.0 - smoothstep(0.03, 0.12, abs(vWorld.y - uReflectPlane.x)));
  if (onPlane > 0.0) {
    vec4 pc = uReflectMatrix * vec4(vWorld, 1.0);
    vec2 ruv = pc.xy / pc.w;
    vec2 o = vec2(0.0, uReflectBlur);
    vec3 r = texture2D(uReflect, ruv).rgb * 0.3;
    r += (texture2D(uReflect, ruv + o).rgb + texture2D(uReflect, ruv - o).rgb) * 0.2;
    r += (texture2D(uReflect, ruv + o * 2.5).rgb + texture2D(uReflect, ruv - o * 2.5).rgb) * 0.15;
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = 0.25 + 0.75 * pow(1.0 - max(viewDir.y, 0.0), 4.0);
    c += r * uReflectAmt * fres * onPlane;
  }
  // where the security looks: a red fan on the floor (NN1b), cut off where a wall is in the way. Its lines (rays,
  // rim, travelling rings) keep a constant width in metres, antialiased by the pixel footprint.
  float px = length(fwidth(vWorld.xz)) * 0.7 + 1e-4;
  float lw = uFanLines.x;
  for (int i = 0; i < MAX_CONES; i++) {
    if (i >= uConeCount) break;
    vec3 d = vWorld - uConePos[i];
    float l = length(d);
    float cosHalf = uConeShape[i].x;
    float range = uConeShape[i].y;
    if (l > range) continue;
    float cs = dot(d / l, uConeDir[i]);
    if (cs < cosHalf) continue;
    float vis = 1.0;
    float fv = uConeShape[i].z;
    if (fv >= 0.0) {
      vec2 dd = vWorld.xz - uConeFan[i].xy;
      float seen = sightAt(uFans, uConeFan[i], fv, dd);
      vis = 1.0 - smoothstep(seen - 0.012, seen + 0.004, length(dd) / range);
      if (vis <= 0.0) continue;
    }
    float hl = length(d.xz);
    float fade = pow(1.0 - l / range, 0.6);
    vec2 h = normalize(uConeDir[i].xz + vec2(1e-4));
    vec2 q = d.xz / max(hl, 1e-4);
    float ang = atan(h.x * q.y - h.y * q.x, dot(h, q));
    float f = ang * uFanLines.y;
    float rays = 1.0 - smoothstep(lw, lw + px, abs(fract(f) - 0.5) / uFanLines.y * hl);
    float rimM = (cs - cosHalf) / sqrt(max(1.0 - cosHalf * cosHalf, 1e-4)) * l;
    float rim = 1.0 - smoothstep(lw * 1.5, lw * 1.5 + px, rimM);
    float rp = fract((l - uTime * uFanLines.w) / uFanLines.z) * uFanLines.z;
    float rings = 1.0 - smoothstep(lw, lw + px, min(rp, uFanLines.z - rp));
    float inside = smoothstep(0.0, px, rimM);
    c += uConeColor[i] * vis * fade * (inside * (uFanLook.x + uFanLook.y * rays + uFanLook.w * rings) + uFanLook.z * rim);
  }
  c += uAlarmColor * uAlarm * near * uNear * 4.0 * alarmWave(vWorld);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`

interface Pt {
  x: number
  z: number
}

/** Traces the outline of the walkable area: closed loops of lattice points, walkable side on the inside normal. */
function traceLoops(g: Grid): Pt[][] {
  const walk = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.kind[r * g.cols + c] !== CellKind.Wall
  // edges keyed by their start vertex
  const W = g.cols + 1
  const out = new Map<number, number[]>()
  const add = (ax: number, az: number, bx: number, bz: number): void => {
    const a = az * W + ax
    const list = out.get(a) ?? []
    list.push(bz * W + bx)
    out.set(a, list)
  }
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!walk(c, r)) continue
      if (!walk(c, r - 1)) add(c + 1, r, c, r)
      if (!walk(c, r + 1)) add(c, r + 1, c + 1, r + 1)
      if (!walk(c - 1, r)) add(c, r, c, r + 1)
      if (!walk(c + 1, r)) add(c + 1, r + 1, c + 1, r)
    }
  }
  const loops: Pt[][] = []
  for (const [start] of out) {
    while ((out.get(start)?.length ?? 0) > 0) {
      const loop: Pt[] = []
      let v = start
      for (let guard = 0; guard < 100000; guard++) {
        loop.push({ x: (v % W) * g.cell, z: Math.floor(v / W) * g.cell })
        const list = out.get(v)
        const next = list?.pop()
        if (next === undefined) break
        v = next
        if (v === start) break
      }
      if (loop.length >= 4) loops.push(loop)
    }
  }
  return loops
}

/** Drops points that sit on a straight line. */
function simplify(loop: Pt[]): Pt[] {
  const n = loop.length
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 1 + n) % n] as Pt
    const b = loop[i] as Pt
    const c = loop[(i + 1) % n] as Pt
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)
    if (Math.abs(cross) > 1e-6) out.push(b)
  }
  return out
}

/** Rounds every corner (quadratic curve inside radius r) and resamples straight runs to about STEP metres. */
function roundAndResample(loop: Pt[], radius: number): Pt[] {
  const n = loop.length
  const out: Pt[] = []
  const corners: { a: Pt; b: Pt; c: Pt }[] = []
  for (let i = 0; i < n; i++) {
    const p0 = loop[(i - 1 + n) % n] as Pt
    const p = loop[i] as Pt
    const p1 = loop[(i + 1) % n] as Pt
    const l0 = Math.hypot(p.x - p0.x, p.z - p0.z)
    const l1 = Math.hypot(p1.x - p.x, p1.z - p.z)
    const r = Math.min(radius, l0 / 2 - 0.01, l1 / 2 - 0.01)
    const a = { x: p.x + ((p0.x - p.x) / l0) * r, z: p.z + ((p0.z - p.z) / l0) * r }
    const c = { x: p.x + ((p1.x - p.x) / l1) * r, z: p.z + ((p1.z - p.z) / l1) * r }
    corners.push({ a, b: p, c })
  }
  const SEG = 6
  for (let i = 0; i < n; i++) {
    const k = corners[i] as { a: Pt; b: Pt; c: Pt }
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG
      const u = 1 - t
      out.push({ x: u * u * k.a.x + 2 * u * t * k.b.x + t * t * k.c.x, z: u * u * k.a.z + 2 * u * t * k.b.z + t * t * k.c.z })
    }
    const next = corners[(i + 1) % n] as { a: Pt; b: Pt; c: Pt }
    const len = Math.hypot(next.a.x - k.c.x, next.a.z - k.c.z)
    const steps = Math.floor(len / STEP)
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      out.push({ x: k.c.x + (next.a.x - k.c.x) * t, z: k.c.z + (next.a.z - k.c.z) * t })
    }
  }
  return out
}

/** The wall cross-section: (u = distance into the corridor, v = height above the floor, or below the ceiling when top). */
interface ProfilePt {
  u: number
  v: number
  top: boolean
  nu: number
  nv: number
}

function wallProfile(): ProfilePt[] {
  const p: ProfilePt[] = []
  const A = 5
  for (let i = 0; i <= A; i++) {
    const th = (i / A) * (Math.PI / 2)
    p.push({ u: FLOOR_FILLET - FLOOR_FILLET * Math.sin(th), v: FLOOR_FILLET - FLOOR_FILLET * Math.cos(th), top: false, nu: Math.sin(th), nv: Math.cos(th) })
  }
  for (let i = 0; i <= A; i++) {
    const ph = (i / A) * (Math.PI / 2)
    // measured down from the ceiling
    p.push({ u: CEIL_FILLET - CEIL_FILLET * Math.cos(ph), v: CEIL_FILLET - CEIL_FILLET * Math.sin(ph), top: true, nu: Math.cos(ph), nv: -Math.sin(ph) })
  }
  return p
}

class GeoBuilder {
  pos: number[] = []
  nor: number[] = []
  extra: number[] = []
  idx: number[] = []
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, e0 = 0, e1 = 0): number {
    this.pos.push(x, y, z)
    this.nor.push(nx, ny, nz)
    this.extra.push(e0, e1)
    return this.pos.length / 3 - 1
  }
  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c)
  }
  build(withExtra: boolean): BufferGeometry {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3))
    if (withExtra) geo.setAttribute('aH', new BufferAttribute(new Float32Array(this.extra), 2))
    geo.setIndex(this.idx)
    geo.computeBoundingSphere()
    return geo
  }
}

/** A thin tube along a polyline (closed or open), appended to a builder. */
function tube(b: GeoBuilder, pts: readonly { x: number; y: number; z: number }[], radius: number, closed: boolean): void {
  const n = pts.length
  if (n < 2) return
  const SIDES = 5
  const base = b.pos.length / 3
  for (let i = 0; i < n; i++) {
    const p = pts[i] as { x: number; y: number; z: number }
    const pa = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as { x: number; y: number; z: number }
    const pb = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as { x: number; y: number; z: number }
    let tx = pb.x - pa.x
    let ty = pb.y - pa.y
    let tz = pb.z - pa.z
    const tl = Math.hypot(tx, ty, tz) || 1
    tx /= tl
    ty /= tl
    tz /= tl
    // a side vector: perpendicular to the tangent and as horizontal as possible
    let sx = -tz
    let sy = 0
    let sz = tx
    let sl = Math.hypot(sx, sz)
    if (sl < 1e-3) {
      sx = 1
      sz = 0
      sl = 1
    }
    sx /= sl
    sz /= sl
    // up = tangent x side
    const ux = ty * sz - tz * sy
    const uy = tz * sx - tx * sz
    const uz = tx * sy - ty * sx
    for (let k = 0; k < SIDES; k++) {
      const a = (k / SIDES) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const nx = sx * ca + ux * sa
      const ny = sy * ca + uy * sa
      const nz = sz * ca + uz * sa
      b.vertex(p.x + nx * radius, p.y + ny * radius, p.z + nz * radius, nx, ny, nz)
    }
  }
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const i0 = base + i * SIDES
    const i1 = base + ((i + 1) % n) * SIDES
    for (let k = 0; k < SIDES; k++) {
      const k1 = (k + 1) % SIDES
      b.tri(i0 + k, i1 + k, i0 + k1)
      b.tri(i0 + k1, i1 + k, i1 + k1)
    }
  }
}

export const MAX_CONES = 10

function coneArr<T>(make: () => T): T[] {
  const out: T[] = []
  for (let i = 0; i < MAX_CONES; i++) out.push(make())
  return out
}

export interface Corridors {
  root: Group
  /** Once a frame: alarm 0..1 (the red waves along the lines), the time, where the waves start (xz). */
  setAlarm(level: number, time: number, cx: number, cz: number): void
  /** Floor fans of the view cones: fill slot i (with the device's sight fan), then set the count. */
  setCone(i: number, px: number, py: number, pz: number, dx: number, dy: number, dz: number, cosHalf: number, range: number, color: Color, strength: number, fan: Fan): void
  setConeCount(n: number): void
}

export function buildCorridors(g: Grid, mats: Materials, sight: Sight, mirror: Mirror): Corridors {
  const root = new Group()
  const C = g.ceiling
  const walls = new GeoBuilder()
  const seams = new GeoBuilder()
  const ribs = new GeoBuilder()
  const profile = wallProfile()
  const P = profile.length

  for (const raw of traceLoops(g)) {
    const loop = roundAndResample(simplify(raw), 0.9)
    const n = loop.length
    const bottomSeam: { x: number; y: number; z: number }[] = []
    const topSeam: { x: number; y: number; z: number }[] = []
    const ring0 = walls.pos.length / 3
    for (let i = 0; i < n; i++) {
      const p = loop[i] as Pt
      const a = loop[(i - 1 + n) % n] as Pt
      const c = loop[(i + 1) % n] as Pt
      let tx = c.x - a.x
      let tz = c.z - a.z
      const tl = Math.hypot(tx, tz) || 1
      tx /= tl
      tz /= tl
      // inward normal (dz, -dx) by the tracing direction
      const nx = tz
      const nz = -tx
      const h = floorHeightAt(g, p.x + nx * 0.3, p.z + nz * 0.3)
      for (const q of profile) {
        const y = q.top ? C - q.v : h + q.v
        const wnx = nx * q.nu
        const wnz = nz * q.nu
        walls.vertex(p.x + nx * q.u, y, p.z + nz * q.u, wnx, q.nv, wnz, y - h, C - y)
      }
      const s45 = Math.SQRT1_2
      const bu = FLOOR_FILLET * (1 - s45) + 0.03
      const bv = FLOOR_FILLET * (1 - s45) + 0.03
      bottomSeam.push({ x: p.x + nx * bu, y: h + bv, z: p.z + nz * bu })
      const tu = CEIL_FILLET * (1 - s45) + 0.03
      topSeam.push({ x: p.x + nx * tu, y: C - CEIL_FILLET * (1 - s45) - 0.03, z: p.z + nz * tu })
    }
    for (let i = 0; i < n; i++) {
      const a = ring0 + i * P
      const b = ring0 + ((i + 1) % n) * P
      for (let k = 0; k < P - 1; k++) {
        walls.tri(a + k, a + k + 1, b + k)
        walls.tri(a + k + 1, b + k + 1, b + k)
      }
    }
    tube(seams, bottomSeam, SEAM_RADIUS, true)
    tube(seams, topSeam, SEAM_RADIUS * 1.2, true)
  }

  // floor, ramps and step risers
  const floor = new GeoBuilder()
  const lips: { x: number; y: number; z: number }[][] = []
  const cornerH = (i: number, east: boolean, south: boolean): number => {
    const ax = g.rampAxis[i]
    if (ax === RampAxis.X) return (east ? g.h1[i] : g.h0[i]) as number
    if (ax === RampAxis.Z) return (south ? g.h1[i] : g.h0[i]) as number
    return g.h0[i] as number
  }
  const walk = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.kind[r * g.cols + c] !== CellKind.Wall
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!walk(c, r)) continue
      const i = r * g.cols + c
      const x0 = c * g.cell
      const x1 = x0 + g.cell
      const z0 = r * g.cell
      const z1 = z0 + g.cell
      const a = floor.vertex(x0, cornerH(i, false, false), z0, 0, 1, 0)
      const b = floor.vertex(x1, cornerH(i, true, false), z0, 0, 1, 0)
      const cc = floor.vertex(x0, cornerH(i, false, true), z1, 0, 1, 0)
      const d = floor.vertex(x1, cornerH(i, true, true), z1, 0, 1, 0)
      floor.tri(a, cc, b)
      floor.tri(b, cc, d)
      // risers to the east and south neighbours where the heights differ
      if (walk(c + 1, r)) {
        const j = i + 1
        const myN = cornerH(i, true, false)
        const myS = cornerH(i, true, true)
        const thN = cornerH(j, false, false)
        const thS = cornerH(j, false, true)
        if (Math.abs(myN - thN) > 0.01 || Math.abs(myS - thS) > 0.01) {
          const hiN = Math.max(myN, thN)
          const hiS = Math.max(myS, thS)
          const loN = Math.min(myN, thN)
          const loS = Math.min(myS, thS)
          const facing = myN > thN ? 1 : -1
          const v0 = walls.vertex(x1, loN, z0, facing, 0, 0, 0, C - loN)
          const v1 = walls.vertex(x1, hiN, z0, facing, 0, 0, hiN - loN, C - hiN)
          const v2 = walls.vertex(x1, loS, z1, facing, 0, 0, 0, C - loS)
          const v3 = walls.vertex(x1, hiS, z1, facing, 0, 0, hiS - loS, C - hiS)
          if (facing > 0) {
            walls.tri(v0, v2, v1)
            walls.tri(v1, v2, v3)
          } else {
            walls.tri(v0, v1, v2)
            walls.tri(v1, v3, v2)
          }
          lips.push([
            { x: x1 + facing * -0.02, y: hiN, z: z0 },
            { x: x1 + facing * -0.02, y: hiS, z: z1 },
          ])
        }
      }
      if (walk(c, r + 1)) {
        const j = i + g.cols
        const myW = cornerH(i, false, true)
        const myE = cornerH(i, true, true)
        const thW = cornerH(j, false, false)
        const thE = cornerH(j, true, false)
        if (Math.abs(myW - thW) > 0.01 || Math.abs(myE - thE) > 0.01) {
          const hiW = Math.max(myW, thW)
          const hiE = Math.max(myE, thE)
          const loW = Math.min(myW, thW)
          const loE = Math.min(myE, thE)
          const facing = myW > thW ? 1 : -1
          const v0 = walls.vertex(x0, loW, z1, 0, 0, facing, 0, C - loW)
          const v1 = walls.vertex(x0, hiW, z1, 0, 0, facing, hiW - loW, C - hiW)
          const v2 = walls.vertex(x1, loE, z1, 0, 0, facing, 0, C - loE)
          const v3 = walls.vertex(x1, hiE, z1, 0, 0, facing, hiE - loE, C - hiE)
          if (facing > 0) {
            walls.tri(v0, v1, v2)
            walls.tri(v1, v3, v2)
          } else {
            walls.tri(v0, v2, v1)
            walls.tri(v1, v2, v3)
          }
          lips.push([
            { x: x0, y: hiW, z: z1 + facing * -0.02 },
            { x: x1, y: hiE, z: z1 + facing * -0.02 },
          ])
        }
      }
    }
  }
  for (const lip of lips) tube(seams, lip, SEAM_RADIUS * 0.9, false)

  // rounded light frames across straight corridors (NN1b portals)
  const frame = (alongX: boolean, at: number, from: number, to: number, h: number): void => {
    const pts: { x: number; y: number; z: number }[] = []
    const inset = 0.04
    const a = from + inset
    const b = to - inset
    const add = (s: number, y: number): void => {
      pts.push(alongX ? { x: at, y, z: s } : { x: s, y, z: at })
    }
    const A = 5
    const rf = FLOOR_FILLET
    const rc = CEIL_FILLET
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      add(a + rf - rf * Math.sin(t), h + rf - rf * Math.cos(t) + inset)
    }
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      add(a + rc - rc * Math.cos(t), C - rc + rc * Math.sin(t) - inset)
    }
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      add(b - rc + rc * Math.sin(t), C - rc + rc * Math.cos(t) - inset)
    }
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      add(b - rf + rf * Math.cos(t), h + rf - rf * Math.sin(t) + inset)
    }
    tube(ribs, pts, RIB_RADIUS, true)
  }
  const kind = (c: number, r: number): number => (c < 0 || r < 0 || c >= g.cols || r >= g.rows ? CellKind.Wall : (g.kind[r * g.cols + c] as number))
  const special = (k: number): boolean => k === CellKind.Laser || k === CellKind.RedWall || k === CellKind.Niche
  // corridors running north-south: a frame on the north edge of cell rows where the span is the same as the row above
  for (let r = 1; r < g.rows; r++) {
    if (r % RIB_EVERY !== 0) continue
    let c = 0
    while (c < g.cols) {
      if (kind(c, r) === CellKind.Wall || kind(c - 1, r) !== CellKind.Wall) {
        c++
        continue
      }
      const c0 = c
      while (kind(c, r) !== CellKind.Wall) c++
      const c1 = c - 1
      let same = c1 - c0 < 3
      for (let k = c0 - 1; k <= c1 + 1 && same; k++) {
        const inside = k >= c0 && k <= c1
        if ((kind(k, r - 1) !== CellKind.Wall) !== inside) same = false
        if (inside && (special(kind(k, r)) || special(kind(k, r - 1)))) same = false
      }
      if (same) frame(false, r * g.cell, c0 * g.cell, (c1 + 1) * g.cell, floorHeightAt(g, (c0 + 0.5) * g.cell, r * g.cell))
    }
  }
  // corridors running east-west
  for (let c = 1; c < g.cols; c++) {
    if (c % RIB_EVERY !== 0) continue
    let r = 0
    while (r < g.rows) {
      if (kind(c, r) === CellKind.Wall || kind(c, r - 1) !== CellKind.Wall) {
        r++
        continue
      }
      const r0 = r
      while (kind(c, r) !== CellKind.Wall) r++
      const r1 = r - 1
      let same = r1 - r0 < 3
      for (let k = r0 - 1; k <= r1 + 1 && same; k++) {
        const inside = k >= r0 && k <= r1
        if ((kind(c - 1, k) !== CellKind.Wall) !== inside) same = false
        if (inside && (special(kind(c, k)) || special(kind(c - 1, k)))) same = false
      }
      if (same) frame(true, c * g.cell, r0 * g.cell, (r1 + 1) * g.cell, floorHeightAt(g, c * g.cell, (r0 + 0.5) * g.cell))
    }
  }

  // low cover blocks: rounded slabs with a lit top edge; niche roofs
  const coverGeo = new RoundedBoxGeometry(g.cell - 0.12, g.coverHeight, g.cell - 0.12, 4, 0.42)
  const roofGeo = new RoundedBoxGeometry(g.cell, 0.3, g.cell, 3, 0.14)
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c
      const h = g.h0[i] as number
      const x = (c + 0.5) * g.cell
      const z = (r + 0.5) * g.cell
      if (g.kind[i] === CellKind.Cover) {
        const m = new Mesh(coverGeo, mats.glossBlack)
        m.position.set(x, h + g.coverHeight / 2, z)
        root.add(m)
        const e = g.cell / 2 - 0.5
        const y = h + g.coverHeight + 0.005
        const pts = [
          { x: x - e, y, z: z - e },
          { x: x + e, y, z: z - e },
          { x: x + e, y, z: z + e },
          { x: x - e, y, z: z + e },
        ]
        tube(ribs, pts, 0.02, true)
      }
      if (g.kind[i] === CellKind.Niche) {
        const m = new Mesh(roofGeo, mats.glossBlack)
        m.position.set(x, h + g.nicheHeight + 0.15, z)
        root.add(m)
      }
    }
  }
  // materials
  const alarmUniforms = (): Record<string, { value: unknown }> => ({
    uAlarmColor: { value: palette.security.clone() },
    uAlarm: { value: 0 },
    uTime: { value: 0 },
    uCenter: { value: new Vector2() },
    uWaveLen: { value: L.alarmWaveLen },
    uWaveSpeed: { value: L.alarmWaveSpeed },
  })
  const lineMat = (intensity: number): ShaderMaterial =>
    new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uColor: { value: palette.seam.clone().multiplyScalar(intensity) }, uAlarmDim: { value: L.alarmDim } }, alarmUniforms()]),
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      fog: true,
    })
  const seamMat = lineMat(L.seamIntensity)
  const ribMat = lineMat(L.ribIntensity)
  const wallMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uBase: { value: new Color().copy(palette.wall) },
        uSeam: { value: palette.seam.clone() },
        uSpill: { value: L.wallSpill },
        uSheen: { value: L.wallSheen },
        uAlarmWall: { value: L.alarmWall },
      },
      alarmUniforms(),
    ]),
    vertexShader: WALL_VERT,
    fragmentShader: WALL_FRAG,
    fog: true,
  })
  const wallTex = new Uint8Array(g.cols * g.rows)
  for (let i = 0; i < wallTex.length; i++) wallTex[i] = g.kind[i] === CellKind.Wall ? 255 : 0
  const tex = new DataTexture(wallTex, g.cols, g.rows, RedFormat, UnsignedByteType)
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.needsUpdate = true
  const floorMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uWalls: { value: null },
        uSize: { value: new Vector2(g.cols * g.cell, g.rows * g.cell) },
        uBase: { value: new Color().copy(palette.floor) },
        uSeam: { value: palette.seam.clone() },
        uCell: { value: g.cell },
        uNear: { value: L.floorNear },
        uGrid: { value: L.floorGrid },
        uReflect: { value: null },
        uReflectMatrix: { value: null },
        uReflectPlane: { value: null },
        uReflectAmt: { value: L.reflect },
        uReflectBlur: { value: L.reflectBlur },
        uFans: { value: null },
        uConeCount: { value: 0 },
        uConePos: { value: coneArr(() => new Vector3()) },
        uConeDir: { value: coneArr(() => new Vector3()) },
        uConeColor: { value: coneArr(() => new Vector3()) },
        uConeShape: { value: coneArr(() => new Vector3()) },
        uConeFan: { value: coneArr(() => new Vector4()) },
        uFanLook: { value: new Vector4(K.floorFill, K.floorRays, K.floorRim, K.floorRings) },
        uFanLines: { value: new Vector4(K.lineWidth, K.raysPerRadian, K.ringGap, K.ringSpeed) },
      },
      alarmUniforms(),
    ]),
    defines: { MAX_CONES },
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    fog: true,
  })
  // textures and the mirror matrix are shared by reference (UniformsUtils.merge would clone them)
  ;(floorMat.uniforms['uWalls'] as { value: unknown }).value = tex
  ;(floorMat.uniforms['uReflect'] as { value: unknown }).value = mirror.texture
  ;(floorMat.uniforms['uReflectMatrix'] as { value: unknown }).value = mirror.matrix
  ;(floorMat.uniforms['uFans'] as { value: unknown }).value = sight.texture
  ;(floorMat.uniforms['uReflectPlane'] as { value: unknown }).value = mirror.plane

  root.add(new Mesh(walls.build(true), wallMat))
  const floorMesh = new Mesh(floor.build(false), floorMat)
  floorMesh.userData['noReflect'] = true
  root.add(floorMesh)
  root.add(new Mesh(seams.build(false), seamMat))
  root.add(new Mesh(ribs.build(false), ribMat))

  // the ceiling
  const ceil = new Mesh(new PlaneGeometry(g.cols * g.cell, g.rows * g.cell), new MeshBasicMaterial({ color: 0x010306 }))
  ceil.rotation.x = Math.PI / 2
  ceil.position.set((g.cols * g.cell) / 2, C, (g.rows * g.cell) / 2)
  ceil.userData['noReflect'] = true
  root.add(ceil)

  const fu = floorMat.uniforms as Record<string, { value: unknown }>
  const conePos = fu['uConePos']?.value as Vector3[]
  const coneDir = fu['uConeDir']?.value as Vector3[]
  const coneColor = fu['uConeColor']?.value as Vector3[]
  const coneShape = fu['uConeShape']?.value as Vector3[]
  const coneFan = fu['uConeFan']?.value as Vector4[]
  const alarmMats = [seamMat, ribMat, wallMat, floorMat]
  return {
    root,
    setCone(i, px, py, pz, dx, dy, dz, cosHalf, range, color, strength, fan): void {
      if (i >= MAX_CONES) return
      ;(conePos[i] as Vector3).set(px, py, pz)
      ;(coneDir[i] as Vector3).set(dx, dy, dz)
      ;(coneColor[i] as Vector3).set(color.r * strength, color.g * strength, color.b * strength)
      ;(coneShape[i] as Vector3).set(cosHalf, range, fan.v)
      ;(coneFan[i] as Vector4).set(fan.ox, fan.oz, fan.yaw, fan.spread)
    },
    setConeCount(n: number): void {
      ;(fu['uConeCount'] as { value: number }).value = Math.min(MAX_CONES, n)
    },
    setAlarm(level: number, time: number, cx: number, cz: number): void {
      for (let k = 0; k < alarmMats.length; k++) {
        const m = alarmMats[k] as ShaderMaterial
        ;(m.uniforms['uAlarm'] as { value: number }).value = level
        ;(m.uniforms['uTime'] as { value: number }).value = time
        ;(m.uniforms['uCenter']?.value as Vector2).set(cx, cz)
      }
    },
  }
}
