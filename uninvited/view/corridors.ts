// Turns the level grid into corridors that read as "living lines, not boxes" (DESIGN 14, NN1b):
// the outline of the walkable area is traced, its corners are rounded, and a rounded wall profile (floor fillet,
// wall with two recessed panel channels, ceiling fillet) is swept along it, with continuous light seams along both
// fillets. Straight corridors get beveled portal frames with a light line every few metres; height steps get a lit
// lip; long walls get props (vents, server faces, access panels, data conduits with light rails - no cables, the
// world is wireless); the level's server blocks are glossy monoliths with thin seams. Cold path: built once.
// Form and depth (second look pass): walls, floor and ceiling have their own values (a darker plated floor, slightly
// lifted walls fading toward a dark ceiling), soft occlusion in the creases and under blocks, the seams' light
// falling on the surfaces next to them, a soft key light around the hero, and a short, rough floor reflection
// (view/reflect.ts). Red fans where the security looks (clipped by view/sight.ts); at alarm 3 red waves run out
// along the seams from the hero.
import {
  BufferGeometry,
  Color,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import cfgAll from '../config.json'
import { CellKind, floorHeightAt, RampAxis, type Grid } from '../core/grid'
import { soundCameras, terminals, videoCameras, motionSensors } from '../core/queries'
import type { GameState } from '../core/state'
import { GeoBuilder, glowQuad, panel, tube, type Frame3, type P3 } from './geo'
import { addRim, palette, type Materials } from './look'
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
/** Heights above the floor of the two recessed channels that split the walls into panel bands. */
const CHANNELS = [1.1, 2.7]
const CH_HALF = 0.05
const CH_DEPTH = 0.035
/** Wall panels: the vertical groove spacing along the wall, metres. */
const PANEL = 1.6
/** Distance texture: texels per metre, and the distances it encodes (metres). */
const DIST_RES = 4
const DIST_MAX = 3

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

/** A soft key light that travels with the hero (between the hero and the camera, above head height), plus hashes. */
const LIGHT_GLSL = /* glsl */ `
uniform vec3 uKeyColor;
uniform float uKeyRange;
uniform vec2 uPlane;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 keyLight(vec3 w, vec3 n) {
  vec3 kp = vec3(mix(uCenter.x, cameraPosition.x, 0.35), uPlane.x + 2.5, mix(uCenter.y, cameraPosition.z, 0.35));
  vec3 l = kp - w;
  float d = length(l);
  l /= max(d, 1e-4);
  float att = (1.0 - smoothstep(uKeyRange * 0.35, uKeyRange, d)) / (1.0 + d * d * 0.12);
  return uKeyColor * max(dot(n, l), 0.0) * att;
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
attribute vec4 aE;
varying vec4 vE;
varying vec3 vNormalW;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vE = aE;
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
uniform float uAlbedo;
varying vec4 vE;
varying vec3 vNormalW;
varying vec3 vWorld;
${ALARM_GLSL}
${LIGHT_GLSL}
#include <fog_pars_fragment>
void main() {
  // vE: height above the floor, depth below the ceiling, distance along the wall, baked occlusion
  float y = vE.x;
  float down = vE.y;
  vec3 n = normalize(vNormalW);
  // panels: vertical grooves along the flat part, a slightly different tone per panel and band
  float onFlat = step(${(FLOOR_FILLET + 0.02).toFixed(2)}, y) * step(${(CEIL_FILLET + 0.02).toFixed(2)}, down);
  float band = y < ${CHANNELS[0]?.toFixed(2)} ? 0.0 : (y < ${CHANNELS[1]?.toFixed(2)} ? 1.0 : 2.0);
  float pid = floor(vE.z / ${PANEL.toFixed(2)});
  float tone = 0.8 + 0.4 * hash12(vec2(pid, band * 7.0 + 3.0));
  float gd = abs(fract(vE.z / ${PANEL.toFixed(2)} + 0.5) - 0.5) * ${PANEL.toFixed(2)};
  float gw = fwidth(vE.z) + 1e-4;
  float groove = onFlat * (1.0 - smoothstep(0.01, 0.01 + gw * 1.5, gd));
  float lip = onFlat * (1.0 - smoothstep(0.0, gw * 1.5, abs(gd - 0.022))) * (1.0 - groove);
  // light falls off toward the ceiling; the creases at the floor and ceiling and the grooves are occluded
  float grad = mix(1.25, 0.4, smoothstep(0.3, 4.2, y));
  float ao = vE.w * (0.35 + 0.65 * smoothstep(0.0, 0.5, y)) * (0.45 + 0.55 * smoothstep(0.0, 1.0, down)) * (1.0 - 0.7 * groove);
  vec3 c = uBase * tone * grad * ao;
  c += uAlbedo * tone * keyLight(vWorld, n) * ao;
  // the seams' own light on the wall next to them, and a cold sheen at grazing angles
  float spill = exp(-abs(y - 0.12) * 4.5) + 0.6 * exp(-abs(down - 0.26) * 5.0);
  c += uSeam * uSpill * spill * (0.4 + 0.6 * vE.w);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
  c += uSeam * uSheen * fres * ao * tone;
  c += uSeam * uSheen * 0.6 * lip;
  c += uAlarmColor * uAlarm * uAlarmWall * alarmWave(vWorld) * spill;
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`

const FLAT_VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

/** Shared by the floor and the ceiling: the distance texture (r = to the walls, g = to the server blocks). */
const DIST_GLSL = /* glsl */ `
uniform sampler2D uDist;
uniform vec2 uSize;
vec2 distAt(vec2 xz) {
  return texture2D(uDist, xz / uSize).rg * ${DIST_MAX.toFixed(1)};
}`

const FLOOR_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uSeam;
uniform float uNear;
uniform float uAlbedo;
uniform float uPlate;
uniform sampler2D uReflect;
uniform sampler2D uReflectDepth;
uniform mat4 uReflectMatrix;
uniform mat4 uReflectInv;
uniform vec2 uReflectPlane;
uniform vec2 uReflectTexel;
uniform float uReflectAmt;
uniform vec3 uReflectShape;
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
${LIGHT_GLSL}
${DIST_GLSL}
${SIGHT_GLSL}
#include <fog_pars_fragment>
void main() {
  vec2 p = vWorld.xz;
  vec2 dist = distAt(p);
  // plating: 1 m plates, some split in two, a tone and a roughness each, dark seams between them, a few treads
  vec2 pid = floor(p);
  vec2 f = fract(p);
  float h0 = hash12(pid);
  float tone = 0.75 + 0.5 * hash12(pid + 17.0);
  float rough = 0.45 + 0.55 * hash12(pid + 31.0);
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  if (h0 > 0.62) e = min(e, abs((h0 > 0.81 ? f.x : f.y) - 0.5));
  vec2 fw = fwidth(p);
  float px = max(fw.x, fw.y) + 1e-4;
  float seam = 1.0 - smoothstep(0.012, 0.012 + px * 1.5, e);
  float bevel = (1.0 - smoothstep(0.0, px * 1.5, abs(e - 0.024))) * (1.0 - seam);
  float tread = 0.0;
  if (h0 < 0.12) tread = (1.0 - smoothstep(0.0, px * 2.0, abs(fract((f.x + f.y) * 9.0) - 0.5) * 0.11 - 0.015)) * (1.0 - smoothstep(0.02, 0.06, px));
  // occlusion: the crease at the walls, contact shadows at the server blocks and under the hero
  float ao = 0.4 + 0.6 * smoothstep(0.3, 1.6, dist.x);
  ao *= 0.25 + 0.75 * smoothstep(0.0, 0.9, dist.y);
  float hd = length(p - uCenter);
  ao *= 1.0 - 0.65 * exp(-hd * hd * 5.0) * (1.0 - smoothstep(0.1, 0.6, abs(vWorld.y - uReflectPlane.x)));
  vec3 c = uBase * tone * ao * (1.0 - 0.6 * seam) * (1.0 - 0.3 * tread);
  c += uAlbedo * tone * keyLight(vWorld, vec3(0.0, 1.0, 0.0)) * ao * (1.0 - 0.8 * seam);
  c += uSeam * uPlate * bevel * ao;
  // the bottom seams' light falling on the floor next to the walls
  c += uSeam * uNear * exp(-max(dist.x - 0.3, 0.0) * 3.2);
  // the reflection: short and rough - it fades and blurs with the height of the reflected point above the floor
  float onPlane = uReflectPlane.y * (1.0 - smoothstep(0.03, 0.12, abs(vWorld.y - uReflectPlane.x)));
  if (onPlane > 0.0) {
    vec4 pc = uReflectMatrix * vec4(vWorld, 1.0);
    vec2 ruv = pc.xy / pc.w;
    float dep = texture2D(uReflectDepth, ruv).r;
    if (dep < 0.99999) {
      vec4 wp = uReflectInv * vec4(vec3(ruv, dep) * 2.0 - 1.0, 1.0);
      float h = max(wp.y / wp.w - uReflectPlane.x, 0.0);
      float fade = exp(-h * uReflectShape.x);
      float lod = uReflectShape.y + h * uReflectShape.z + (1.0 - rough) * 1.2;
      vec2 o = uReflectTexel * exp2(lod);
      vec3 r = textureLod(uReflect, ruv + o * vec2(0.5, 1.3), lod).rgb;
      r += textureLod(uReflect, ruv + o * vec2(-0.5, -1.3), lod).rgb;
      r += textureLod(uReflect, ruv + o * vec2(-0.7, 0.6), lod).rgb;
      r += textureLod(uReflect, ruv + o * vec2(0.7, -0.6), lod).rgb;
      vec3 viewDir = normalize(cameraPosition - vWorld);
      float fres = 0.2 + 0.8 * pow(1.0 - max(viewDir.y, 0.0), 4.0);
      c += r * 0.25 * uReflectAmt * fres * fade * rough * onPlane * (1.0 - seam) * (1.0 - 0.6 * tread);
    }
  }
  // where the security looks: a red fan on the floor (NN1b), cut off where a wall is in the way. Its lines (rays,
  // rim, travelling rings) keep a constant width in metres, antialiased by the pixel footprint.
  float fpx = length(fwidth(vWorld.xz)) * 0.7 + 1e-4;
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
    vec2 hh = normalize(uConeDir[i].xz + vec2(1e-4));
    vec2 q = d.xz / max(hl, 1e-4);
    float ang = atan(hh.x * q.y - hh.y * q.x, dot(hh, q));
    float fa = ang * uFanLines.y;
    float rays = 1.0 - smoothstep(lw, lw + fpx, abs(fract(fa) - 0.5) / uFanLines.y * hl);
    float rimM = (cs - cosHalf) / sqrt(max(1.0 - cosHalf * cosHalf, 1e-4)) * l;
    float rim = 1.0 - smoothstep(lw * 1.5, lw * 1.5 + fpx, rimM);
    float rp = fract((l - uTime * uFanLines.w) / uFanLines.z) * uFanLines.z;
    float rings = 1.0 - smoothstep(lw, lw + fpx, min(rp, uFanLines.z - rp));
    float inside = smoothstep(0.0, fpx, rimM);
    c += uConeColor[i] * vis * fade * (inside * (uFanLook.x + uFanLook.y * rays + uFanLook.w * rings) + uFanLook.z * rim);
  }
  c += uAlarmColor * uAlarm * uNear * 4.0 * exp(-max(dist.x - 0.3, 0.0) * 3.2) * alarmWave(vWorld);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`

const CEIL_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uSeam;
uniform float uSpill;
uniform float uAlbedo;
varying vec3 vWorld;
${ALARM_GLSL}
${LIGHT_GLSL}
${DIST_GLSL}
#include <fog_pars_fragment>
void main() {
  vec2 p = vWorld.xz;
  float dw = distAt(p).x;
  // 2 x 1 m ceiling tiles with dark joints, darker than the walls; the top seams light the ceiling's edges
  vec2 f = fract(p * vec2(0.5, 1.0));
  vec2 fw = fwidth(p) + 1e-4;
  vec2 ed = min(f, 1.0 - f) / vec2(0.5, 1.0);
  float joint = 1.0 - smoothstep(0.015, 0.015 + max(fw.x, fw.y) * 1.5, min(ed.x, ed.y));
  float tone = 0.7 + 0.6 * hash12(floor(p * vec2(0.5, 1.0)));
  float ao = 0.4 + 0.6 * smoothstep(0.8, 2.0, dw);
  vec3 c = uBase * tone * ao * (1.0 - 0.7 * joint);
  c += uAlbedo * keyLight(vWorld, vec3(0.0, -1.0, 0.0)) * ao * 0.6;
  c += uSeam * uSpill * exp(-max(dw - 0.8, 0.0) * 2.5);
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

/**
 * The wall cross-section, bottom to top: u = distance into the corridor (negative = into the wall), v = height above
 * the floor (or below the ceiling when top), the normal, baked occlusion, and brk = start a new strip here (a hard
 * edge: the same point again with another normal).
 */
interface ProfilePt {
  u: number
  v: number
  top: boolean
  nu: number
  nv: number
  ao: number
  brk: boolean
}

function wallProfile(): ProfilePt[] {
  const p: ProfilePt[] = []
  const pt = (u: number, v: number, top: boolean, nu: number, nv: number, ao = 1, brk = false): void => {
    p.push({ u, v, top, nu, nv, ao, brk })
  }
  const A = 5
  for (let i = 0; i <= A; i++) {
    const th = (i / A) * (Math.PI / 2)
    pt(FLOOR_FILLET - FLOOR_FILLET * Math.sin(th), FLOOR_FILLET - FLOOR_FILLET * Math.cos(th), false, Math.sin(th), Math.cos(th))
  }
  // recessed channels: a lower bevel facing up, the channel floor, an upper bevel facing down
  const r = Math.SQRT1_2
  for (const y of CHANNELS) {
    const a = y - CH_HALF
    const b = y + CH_HALF
    const e = CH_DEPTH
    pt(0, a, false, 1, 0)
    pt(0, a, false, r, r, 1, true)
    pt(-e, a + e, false, r, r, 0.75)
    pt(-e, a + e, false, 1, 0, 0.45, true)
    pt(-e, b - e, false, 1, 0, 0.45)
    pt(-e, b - e, false, r, -r, 0.55, true)
    pt(0, b, false, r, -r, 0.8)
    pt(0, b, false, 1, 0, 1, true)
  }
  for (let i = 0; i <= A; i++) {
    const ph = (i / A) * (Math.PI / 2)
    // measured down from the ceiling
    pt(CEIL_FILLET - CEIL_FILLET * Math.cos(ph), CEIL_FILLET - CEIL_FILLET * Math.sin(ph), true, Math.cos(ph), -Math.sin(ph))
  }
  return p
}

export const MAX_CONES = 10

function coneArr<T>(make: () => T): T[] {
  const out: T[] = []
  for (let i = 0; i < MAX_CONES; i++) out.push(make())
  return out
}

/** Distance (metres) from (x, z) to the box [x0, x1] x [z0, z1]. */
function boxDist(x: number, z: number, x0: number, z0: number, x1: number, z1: number): number {
  const dx = Math.max(x0 - x, 0, x - x1)
  const dz = Math.max(z0 - z, 0, z - z1)
  return Math.hypot(dx, dz)
}

/** r = distance to the nearest wall cell, g = to the nearest server block or low cover, both / DIST_MAX. */
function distanceTexture(g: Grid): DataTexture {
  const w = Math.ceil(g.cols * g.cell * DIST_RES)
  const h = Math.ceil(g.rows * g.cell * DIST_RES)
  const data = new Uint8Array(w * h * 4)
  const reach = Math.ceil(DIST_MAX / g.cell)
  const boxes: number[][] = []
  for (const b of g.blocks ?? []) boxes.push([b.minX, b.minZ, b.maxX, b.maxZ])
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] !== CellKind.Cover) continue
    const c = i % g.cols
    const r = Math.floor(i / g.cols)
    boxes.push([c * g.cell + 0.06, r * g.cell + 0.06, (c + 1) * g.cell - 0.06, (r + 1) * g.cell - 0.06])
  }
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const x = (tx + 0.5) / DIST_RES
      const z = (ty + 0.5) / DIST_RES
      const c0 = Math.floor(x / g.cell)
      const r0 = Math.floor(z / g.cell)
      let dw = DIST_MAX
      for (let r = r0 - reach; r <= r0 + reach; r++) {
        for (let c = c0 - reach; c <= c0 + reach; c++) {
          const wall = c < 0 || r < 0 || c >= g.cols || r >= g.rows || g.kind[r * g.cols + c] === CellKind.Wall
          if (wall) dw = Math.min(dw, boxDist(x, z, c * g.cell, r * g.cell, (c + 1) * g.cell, (r + 1) * g.cell))
        }
      }
      let db = DIST_MAX
      for (const b of boxes) db = Math.min(db, boxDist(x, z, b[0] as number, b[1] as number, b[2] as number, b[3] as number))
      const o = (ty * w + tx) * 4
      data[o] = Math.round((dw / DIST_MAX) * 255)
      data[o + 1] = Math.round((db / DIST_MAX) * 255)
      data[o + 2] = 0
      data[o + 3] = 255
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType)
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

export interface Corridors {
  root: Group
  /** Once a frame: alarm 0..1 (the red waves along the lines), the time, where the waves start (xz) - the hero. */
  setAlarm(level: number, time: number, cx: number, cz: number): void
  /** Floor fans of the view cones: fill slot i (with the device's sight fan), then set the count. */
  setCone(i: number, px: number, py: number, pz: number, dx: number, dy: number, dz: number, cosHalf: number, range: number, color: Color, strength: number, fan: Fan): void
  setConeCount(n: number): void
}

interface KeepOut {
  x: number
  z: number
  r: number
}

export function buildCorridors(g: Grid, mats: Materials, sight: Sight, mirror: Mirror, s: GameState): Corridors {
  const root = new Group()
  const C = g.ceiling
  const walls = new GeoBuilder()
  const seams = new GeoBuilder()
  const ribs = new GeoBuilder()
  /** Dark dressing (frames, props, block bodies): extra = vertex color (baked occlusion). */
  const detail = new GeoBuilder()
  /** Small glowing bits on the dressing (status lights, slits, rails): extra = color. */
  const glow = new GeoBuilder()
  const profile = wallProfile()
  const P = profile.length
  const kind = (c: number, r: number): number => (c < 0 || r < 0 || c >= g.cols || r >= g.rows ? CellKind.Wall : (g.kind[r * g.cols + c] as number))
  const walk = (c: number, r: number): boolean => kind(c, r) !== CellKind.Wall

  const lattice: Pt[][] = []
  for (const raw of traceLoops(g)) {
    const simple = simplify(raw)
    lattice.push(simple)
    const loop = roundAndResample(simple, 0.9)
    const n = loop.length
    const bottomSeam: P3[] = []
    const topSeam: P3[] = []
    const ring0 = walls.pos.length / 3
    let arc = 0
    // one ring more than points: the last repeats the first with the full arc length, so the panel pattern
    // does not jump where the loop closes
    for (let i = 0; i <= n; i++) {
      const p = loop[i % n] as Pt
      const a = loop[(i - 1 + n) % n] as Pt
      const c = loop[(i + 1) % n] as Pt
      if (i > 0) arc += Math.hypot(p.x - a.x, p.z - a.z)
      let tx = c.x - a.x
      let tz = c.z - a.z
      const tl = Math.hypot(tx, tz) || 1
      tx /= tl
      tz /= tl
      // inward normal (dz, -dx) by the tracing direction
      const nx = tz
      const nz = -tx
      const h = floorHeightAt(g, p.x + nx * 0.3, p.z + nz * 0.3)
      const top = C - CEIL_FILLET - 0.05
      for (const q of profile) {
        const y = q.top ? C - q.v : Math.min(h + q.v, top)
        walls.vertex(p.x + nx * q.u, y, p.z + nz * q.u, nx * q.nu, q.nv, nz * q.nu, y - h, C - y, arc, q.ao)
      }
      if (i === n) continue
      const s45 = Math.SQRT1_2
      const bu = FLOOR_FILLET * (1 - s45) + 0.03
      const bv = FLOOR_FILLET * (1 - s45) + 0.03
      bottomSeam.push({ x: p.x + nx * bu, y: h + bv, z: p.z + nz * bu })
      const tu = CEIL_FILLET * (1 - s45) + 0.03
      topSeam.push({ x: p.x + nx * tu, y: C - CEIL_FILLET * (1 - s45) - 0.03, z: p.z + nz * tu })
    }
    for (let i = 0; i < n; i++) {
      const a = ring0 + i * P
      const b = ring0 + (i + 1) * P
      for (let k = 0; k < P - 1; k++) {
        if ((profile[k + 1] as ProfilePt).brk) continue
        walls.tri(a + k, a + k + 1, b + k)
        walls.tri(a + k + 1, b + k + 1, b + k)
      }
    }
    tube(seams, bottomSeam, SEAM_RADIUS, true)
    tube(seams, topSeam, SEAM_RADIUS * 1.2, true)
  }

  // floor, ramps and step risers
  const floor = new GeoBuilder()
  const lips: P3[][] = []
  const cornerH = (i: number, east: boolean, south: boolean): number => {
    const ax = g.rampAxis[i]
    if (ax === RampAxis.X) return (east ? g.h1[i] : g.h0[i]) as number
    if (ax === RampAxis.Z) return (south ? g.h1[i] : g.h0[i]) as number
    return g.h0[i] as number
  }
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
          const v0 = walls.vertex(x1, loN, z0, facing, 0, 0, 0, C - loN, z0, 0.7)
          const v1 = walls.vertex(x1, hiN, z0, facing, 0, 0, hiN - loN, C - hiN, z0, 1)
          const v2 = walls.vertex(x1, loS, z1, facing, 0, 0, 0, C - loS, z1, 0.7)
          const v3 = walls.vertex(x1, hiS, z1, facing, 0, 0, hiS - loS, C - hiS, z1, 1)
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
          const v0 = walls.vertex(x0, loW, z1, 0, 0, facing, 0, C - loW, x0, 0.7)
          const v1 = walls.vertex(x0, hiW, z1, 0, 0, facing, hiW - loW, C - hiW, x0, 1)
          const v2 = walls.vertex(x1, loE, z1, 0, 0, facing, 0, C - loE, x1, 0.7)
          const v3 = walls.vertex(x1, hiE, z1, 0, 0, facing, hiE - loE, C - hiE, x1, 1)
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

  // beveled portal frames across straight corridors (NN1b), a light line set into each
  const frame = (alongX: boolean, at: number, from: number, to: number, h: number): void => {
    // the cross-section loop on the surface: (s across the corridor, y), with the inward normal
    const sec: { s: number; y: number; ns: number; ny: number }[] = []
    const A = 5
    const rf = FLOOR_FILLET
    const rc = CEIL_FILLET
    const a = from
    const b = to
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      sec.push({ s: a + rf - rf * Math.sin(t), y: h + rf - rf * Math.cos(t), ns: Math.sin(t), ny: Math.cos(t) })
    }
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      sec.push({ s: a + rc - rc * Math.cos(t), y: C - rc + rc * Math.sin(t), ns: Math.cos(t), ny: -Math.sin(t) })
    }
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      sec.push({ s: b - rc + rc * Math.sin(t), y: C - rc + rc * Math.cos(t), ns: -Math.sin(t), ny: -Math.cos(t) })
    }
    for (let i = 0; i <= A; i++) {
      const t = (i / A) * (Math.PI / 2)
      sec.push({ s: b - rf + rf * Math.cos(t), y: h + rf - rf * Math.sin(t), ns: -Math.cos(t), ny: Math.sin(t) })
    }
    const m = sec.length
    const W = 0.17
    const BV = 0.035
    // depth out of the surface: proud on the walls and ceiling, almost flush where it crosses the floor
    const depth = (ny: number): number => 0.07 - 0.058 * Math.max(0, Math.min(1, (ny - 0.7) / 0.3))
    const world = (sv: number, y: number, along: number): P3 => (alongX ? { x: at + along, y, z: sv } : { x: sv, y, z: at + along })
    // cross-section of the band: (along, out as a share of the depth, out pulled back by the bevel) per point,
    // and the five faces between them with their (along, out) normals
    const shape: [number, number, number][] = [
      [-W, 0, 0],
      [-W, 1, -BV],
      [-W + BV, 1, 0],
      [W - BV, 1, 0],
      [W, 1, -BV],
      [W, 0, 0],
    ]
    const r2 = Math.SQRT1_2
    const faceN: [number, number][] = [
      [-1, 0],
      [-r2, r2],
      [0, 1],
      [r2, r2],
      [1, 0],
    ]
    const shades = [0.55, 0.85, 1, 0.85, 0.55]
    for (let f = 0; f < faceN.length; f++) {
      const base = detail.pos.length / 3
      const [fa, fo] = faceN[f] as [number, number]
      const sh = shades[f] as number
      for (let i = 0; i < m; i++) {
        const q = sec[i] as { s: number; y: number; ns: number; ny: number }
        const d = depth(q.ny)
        for (const k of [f, f + 1]) {
          const [al, share, pull] = shape[k] as [number, number, number]
          const out = share * d + pull * share
          const p = world(q.s + q.ns * out, q.y + q.ny * out, al)
          const nx = alongX ? fa : q.ns * fo
          const nz = alongX ? q.ns * fo : fa
          detail.vertex(p.x, p.y, p.z, nx, q.ny * fo, nz, sh, sh, sh)
        }
      }
      for (let i = 0; i < m; i++) {
        const i0 = base + i * 2
        const i1 = base + ((i + 1) % m) * 2
        detail.triFacing(i0, i1, i0 + 1)
        detail.triFacing(i0 + 1, i1, i1 + 1)
      }
    }
    const line: P3[] = []
    for (const q of sec) {
      const d = depth(q.ny) + RIB_RADIUS * 0.3
      line.push(world(q.s + q.ns * d, q.y + q.ny * d, 0))
    }
    tube(ribs, line, RIB_RADIUS, true)
  }
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

  // wall dressing along straight runs, kept clear of devices
  const keep: KeepOut[] = []
  for (const t of terminals(s)) keep.push({ x: t.pos.x, z: t.pos.z, r: 1.8 })
  for (const c of videoCameras(s)) keep.push({ x: c.pos.x, z: c.pos.z, r: 1.4 })
  for (const c of soundCameras(s)) keep.push({ x: c.pos.x, z: c.pos.z, r: 1.4 })
  for (const m of motionSensors(s)) keep.push({ x: m.pos.x, z: m.pos.z, r: 1.2 })
  const clear = (x: number, z: number, r: number): boolean => {
    for (const k of keep) if (Math.hypot(x - k.x, z - k.z) < k.r + r) return false
    return true
  }
  const plain = (k: number): boolean => k === CellKind.Floor || k === CellKind.Start || k === CellKind.Checkpoint || k === CellKind.Cover
  const hash = (a: number, b: number): number => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return v - Math.floor(v)
  }
  const dim = palette.seamDim
  for (const loop of lattice) {
    const n = loop.length
    for (let i = 0; i < n; i++) {
      const A0 = loop[i] as Pt
      const B0 = loop[(i + 1) % n] as Pt
      const len = Math.hypot(B0.x - A0.x, B0.z - A0.z)
      const spans = Math.round(len / g.cell)
      if (spans < 3) continue
      const tx = (B0.x - A0.x) / len
      const tz = (B0.z - A0.z) / len
      const f: Frame3 = { nx: tz, nz: -tx, ux: -tx, uz: -tz }
      // the cell next to each span
      const runs: boolean[] = []
      const hs: number[] = []
      for (let k = 0; k < spans; k++) {
        const cx = A0.x + tx * (k + 0.5) * g.cell + f.nx * g.cell * 0.5
        const cz = A0.z + tz * (k + 0.5) * g.cell + f.nz * g.cell * 0.5
        const cc = Math.floor(cx / g.cell)
        const cr = Math.floor(cz / g.cell)
        const kk = kind(cc, cr)
        const ok = plain(kk) && g.rampAxis[cr * g.cols + cc] === RampAxis.None
        runs.push(ok)
        hs.push(ok ? (g.h0[cr * g.cols + cc] as number) : 0)
      }
      // props, one per inner span at most
      for (let k = 1; k < spans - 1; k++) {
        if (!runs[k]) continue
        const h = hs[k] as number
        const x = A0.x + tx * (k + 0.5) * g.cell
        const z = A0.z + tz * (k + 0.5) * g.cell
        if (!clear(x, z, 0.8)) continue
        const pick = hash(x, z)
        if (pick < 0.3) continue
        if (pick < 0.55) {
          // a vent: a frame of four bars and slats, low on the wall
          const y = h + 0.66
          panel(detail, f, x, y - 0.2, z, 0.62, 0.035, 0.06, 0.02, 0.9)
          panel(detail, f, x, y + 0.2, z, 0.62, 0.035, 0.06, 0.02, 1)
          panel(detail, f, x - 0.59, y, z, 0.035, 0.24, 0.06, 0.02, 0.9)
          panel(detail, f, x + 0.59, y, z, 0.035, 0.24, 0.06, 0.02, 0.9)
          for (let sl = 0; sl < 5; sl++) panel(detail, f, x, y - 0.13 + sl * 0.065, z, 0.55, 0.014, 0.04, 0.012, 0.7)
          panel(detail, f, x, y, z, 0.58, 0.18, 0.008, 0.004, 0.12)
        } else if (pick < 0.8) {
          // a server face: a tall beveled slab with rows of dim status slits and a seam down one edge
          const y0 = h + 0.42
          const y1 = h + 2.95
          const ym = (y0 + y1) / 2
          panel(detail, f, x, ym, z, 0.62, (y1 - y0) / 2, 0.14, 0.035, 1)
          for (let row = 0; row < 9; row++) {
            const yy = y0 + 0.35 + row * 0.24
            panel(detail, f, x, yy, z, 0.5, 0.075, 0.15, 0.012, 0.7)
            for (let col = 0; col < 2; col++) {
              const hh = hash(x + row * 3.1, z + col * 7.7)
              if (hh < 0.35) continue
              const amber = hh > 0.93
              const k2 = 0.25 + 0.35 * hh
              glowQuad(glow, f, x - 0.36 + col * 0.18, yy, z, 0.05, 0.008, 0.226, amber ? 1.4 * k2 : dim.r * k2 * 1.6, amber ? 0.7 * k2 : dim.g * k2 * 1.6, amber ? 0.1 * k2 : dim.b * k2 * 1.6)
            }
          }
          glowQuad(glow, f, x + 0.55, ym, z, 0.008, (y1 - y0) / 2 - 0.12, 0.177, dim.r * 0.9, dim.g * 0.9, dim.b * 0.9)
        } else {
          // an access panel with a single status light
          panel(detail, f, x, h + 1.75, z, 0.7, 0.62, 0.035, 0.02, 1)
          panel(detail, f, x, h + 1.75, z, 0.55, 0.47, 0.045, 0.015, 0.8)
          glowQuad(glow, f, x + 0.42, h + 2.2, z, 0.025, 0.025, 0.05, dim.r * 1.2, dim.g * 1.2, dim.b * 1.2)
        }
      }
      // a data conduit high along long flat runs, with a light rail on its underside, broken around devices
      if (spans >= 4) {
        let k = 1
        while (k < spans - 1) {
          if (!runs[k] || (hs[k] as number) > 0.3) {
            k++
            continue
          }
          const h = hs[k] as number
          const k0 = k
          while (k < spans - 1 && runs[k] && hs[k] === h && clear(A0.x + tx * (k + 0.5) * g.cell, A0.z + tz * (k + 0.5) * g.cell, 0.2)) k++
          const k1 = k
          if (k1 - k0 >= 2) {
            const sa = (k0 + 0.05) * g.cell
            const sb = (k1 - 0.05) * g.cell
            const mid = (sa + sb) / 2
            const x = A0.x + tx * mid
            const z = A0.z + tz * mid
            const y = h + 3.95
            panel(detail, f, x, y, z, (sb - sa) / 2, 0.12, 0.17, 0.035, 1)
            panel(detail, f, x, y + 0.04, z, (sb - sa) / 2 - 0.02, 0.025, 0.18, 0.01, 0.7)
            glowQuad(glow, { ux: f.ux, uz: f.uz, nx: f.nx, nz: f.nz }, x, y - 0.122, z, (sb - sa) / 2 - 0.1, 0.006, 0.12, dim.r * 1.1, dim.g * 1.1, dim.b * 1.1)
          }
          if (k === k0) k++
        }
      }
    }
  }

  // the level's server blocks (cover): glossy black monoliths with thin cyan seams and a column of status lights
  const blockLines = new GeoBuilder()
  const capGeos: BufferGeometry[] = []
  for (const b of g.blocks ?? []) {
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    const hgt = b.maxY - b.minY
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    // the body as four chamfered faces around a core box (built from panels on each side)
    const sides: Frame3[] = [
      { nx: 0, nz: 1, ux: 1, uz: 0 },
      { nx: 0, nz: -1, ux: -1, uz: 0 },
      { nx: 1, nz: 0, ux: 0, uz: -1 },
      { nx: -1, nz: 0, ux: 0, uz: 1 },
    ]
    for (const f of sides) {
      const halfAlong = f.nx === 0 ? w / 2 : d / 2
      const halfOut = f.nx === 0 ? d / 2 : w / 2
      const ox = cx + f.nx * (halfOut - 0.06)
      const oz = cz + f.nz * (halfOut - 0.06)
      panel(detail, f, ox, b.minY + hgt / 2, oz, halfAlong - 0.03, hgt / 2 - 0.02, 0.06, 0.04, 1)
      // panel grooves on the faces, a status column on the wide faces
      for (let k = 1; k < 4; k++) panel(detail, f, ox, b.minY + (hgt * k) / 4, oz, halfAlong - 0.1, 0.012, 0.066, 0.006, 0.4)
      if (halfAlong > 0.4) {
        for (let k = 0; k < 6; k++) {
          const hh = hash(cx + k, cz + f.nx * 3 + f.nz * 5)
          if (hh < 0.3) continue
          glowQuad(glow, f, ox + f.ux * (halfAlong - 0.18), b.minY + 0.35 + k * 0.17, oz + f.uz * (halfAlong - 0.18), 0.04, 0.01, 0.068, dim.r * (0.7 + hh), dim.g * (0.7 + hh), dim.b * (0.7 + hh))
        }
      }
    }
    // a solid core behind the faces, the top: a cap, and light seams along its upper edge and at the base
    capGeos.push(new RoundedBoxGeometry(w - 0.07, hgt - 0.01, d - 0.07, 1, 0.02).translate(cx, b.minY + hgt / 2, cz))
    const cap = new RoundedBoxGeometry(w - 0.04, 0.08, d - 0.04, 2, 0.03)
    cap.translate(cx, b.maxY - 0.04, cz)
    capGeos.push(cap)
    const e = 0.03
    const ring = (y: number, inset: number): P3[] => [
      { x: b.minX + inset, y, z: b.minZ + inset },
      { x: b.maxX - inset, y, z: b.minZ + inset },
      { x: b.maxX - inset, y, z: b.maxZ - inset },
      { x: b.minX + inset, y, z: b.maxZ - inset },
    ]
    tube(blockLines, ring(b.maxY + 0.005, e + 0.04), RIB_RADIUS * 0.8, true)
  }

  // low cover blocks: rounded slabs with a lit top edge (merged into one mesh)
  const coverGeos: BufferGeometry[] = []
  const coverGeo = new RoundedBoxGeometry(g.cell - 0.12, g.coverHeight, g.cell - 0.12, 4, 0.42)
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c
      if (g.kind[i] !== CellKind.Cover) continue
      const h = g.h0[i] as number
      const x = (c + 0.5) * g.cell
      const z = (r + 0.5) * g.cell
      coverGeos.push(coverGeo.clone().translate(x, h + g.coverHeight / 2, z))
      const e = g.cell / 2 - 0.5
      const y = h + g.coverHeight + 0.005
      tube(ribs, [
        { x: x - e, y, z: z - e },
        { x: x + e, y, z: z - e },
        { x: x + e, y, z: z + e },
        { x: x - e, y, z: z + e },
      ], 0.016, true)
    }
  }
  const solids = [...coverGeos, ...capGeos]
  if (solids.length > 0) {
    const merged = mergeGeometries(solids)
    if (merged) root.add(new Mesh(merged, mats.glossBlack))
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
  const lightUniforms = (): Record<string, { value: unknown }> => ({
    uKeyColor: { value: new Color(L.keyColor[0] ?? 0, L.keyColor[1] ?? 0, L.keyColor[2] ?? 0) },
    uKeyRange: { value: L.keyRange },
    uPlane: { value: null },
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
        uAlbedo: { value: L.wallAlbedo },
      },
      alarmUniforms(),
      lightUniforms(),
    ]),
    vertexShader: WALL_VERT,
    fragmentShader: WALL_FRAG,
    fog: true,
  })
  const dist = distanceTexture(g)
  const floorMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uDist: { value: null },
        uSize: { value: new Vector2(Math.ceil(g.cols * g.cell * DIST_RES) / DIST_RES, Math.ceil(g.rows * g.cell * DIST_RES) / DIST_RES) },
        uBase: { value: new Color().copy(palette.floor) },
        uSeam: { value: palette.seam.clone() },
        uNear: { value: L.floorNear },
        uAlbedo: { value: L.floorAlbedo },
        uPlate: { value: L.floorPlate },
        uReflect: { value: null },
        uReflectDepth: { value: null },
        uReflectMatrix: { value: null },
        uReflectInv: { value: null },
        uReflectPlane: { value: null },
        uReflectTexel: { value: null },
        uReflectAmt: { value: L.reflect },
        uReflectShape: { value: new Vector3(L.reflectFade, L.reflectLod[0] ?? 1, L.reflectLod[1] ?? 1) },
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
      lightUniforms(),
    ]),
    defines: { MAX_CONES },
    vertexShader: FLAT_VERT,
    fragmentShader: FLOOR_FRAG,
    fog: true,
  })
  const ceilMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uDist: { value: null },
        uSize: { value: (floorMat.uniforms['uSize']?.value as Vector2).clone() },
        uBase: { value: new Color(L.ceilColor) },
        uSeam: { value: palette.seam.clone() },
        uSpill: { value: L.ceilSpill },
        uAlbedo: { value: L.wallAlbedo },
      },
      alarmUniforms(),
      lightUniforms(),
    ]),
    vertexShader: FLAT_VERT,
    fragmentShader: CEIL_FRAG,
    fog: true,
  })
  // textures and the mirror's matrices are shared by reference (UniformsUtils.merge would clone them)
  const share = (m: ShaderMaterial, name: string, v: unknown): void => {
    const u = m.uniforms[name]
    if (u) u.value = v
  }
  share(floorMat, 'uDist', dist)
  share(ceilMat, 'uDist', dist)
  share(floorMat, 'uReflect', mirror.texture)
  share(floorMat, 'uReflectDepth', mirror.depth)
  share(floorMat, 'uReflectMatrix', mirror.matrix)
  share(floorMat, 'uReflectInv', mirror.inverse)
  share(floorMat, 'uReflectTexel', mirror.texel)
  share(floorMat, 'uFans', sight.texture)
  share(floorMat, 'uReflectPlane', mirror.plane)
  for (const m of [wallMat, floorMat, ceilMat]) share(m, 'uPlane', mirror.plane)

  root.add(new Mesh(walls.build('aE'), wallMat))
  const floorMesh = new Mesh(floor.build(null), floorMat)
  floorMesh.userData['noReflect'] = true
  root.add(floorMesh)
  root.add(new Mesh(seams.build(null), seamMat))
  root.add(new Mesh(ribs.build(null), ribMat))
  if (!blockLines.empty) root.add(new Mesh(blockLines.build(null), seamMat))
  if (!detail.empty) {
    const detailMat = new MeshStandardMaterial({ color: L.detailColor, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.0, vertexColors: true })
    addRim(detailMat)
    root.add(new Mesh(detail.build('color'), detailMat))
  }
  if (!glow.empty) {
    const glowMesh = new Mesh(glow.build('color'), new MeshBasicMaterial({ vertexColors: true, toneMapped: false }))
    glowMesh.userData['noReflect'] = true
    root.add(glowMesh)
  }

  // the ceiling
  const ceil = new Mesh(new PlaneGeometry(g.cols * g.cell, g.rows * g.cell), ceilMat)
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
  const alarmMats = [seamMat, ribMat, wallMat, floorMat, ceilMat]
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
