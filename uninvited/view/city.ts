// The open data city (DESIGN 6 and 14, concepts NF6 + NF4): the level grid turned into platforms over a dark void.
// Blocks ('#', 'H', low cover '~') are matte monoliths whose top edges carry continuous light lines (and a few tall
// outer corners a vertical one) - clean NF6 slabs, or dressed in NF4's hex modules; platform edges over the void and
// floor steps are outlined; a one-cell walkway over the void is a light bridge (a thin deck). Floors are matte, with a
// faint plate grid, a lit foot line along every slab and circuit-like light paths that data packets run along
// (view/city-life.ts). Roofs (the level's enclosed passages) are slabs overhead with a light strip. The level's hex
// modules are instanced prisms with thin cyan seams; the server blocks keep their beveled faces and status lights.
// The sky, the void's data rivers, the far districts and the landmark tower are in view/skyline.ts.
// Everything static is merged per chunk of the plan, so whole chunks are culled off screen. Cold path: built once.
// Red fans where the security looks (clipped by view/sight.ts); at alarm 3 red waves run out along the lines.
import {
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
import { CellKind, RampAxis, type Block, type Grid } from '../core/grid'
import type { GameState } from '../core/state'
import { GeoBuilder, glowQuad, panel, tube, type Frame3, type P3 } from './geo'
import { addRim, palette, type Materials } from './look'
import type { Mirror } from './reflect'
import { SIGHT_GLSL, type Fan, type Sight } from './sight'

const L = cfgAll.view.corridor
const Y = cfgAll.view.city
const K = cfgAll.view.cones

/** Distance textures: texels per metre, and the distances they encode (metres). */
const DIST_RES = 4
const DIST_MAX = 3
/** Cells per side of a chunk (the unit of merging and culling). */
const CHUNK = 16

/** Red waves running out from the hero along every line at alarm 3: 0..1 at a world point. */
export const ALARM_GLSL = /* glsl */ `
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

/** Hex tiling (pointy-top cells, 1 unit across the flats): xy = position in the cell, zw = the cell's id. */
export const HEX_GLSL = /* glsl */ `
vec4 hexCell(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + 0.5);
}
float hexEdge(vec2 q) {
  q = abs(q);
  return 0.5 - max(dot(q, vec2(0.5, 0.8660254)), q.x);
}`

/**
 * Thin light lines (tubes). Far away a tube would shrink below a pixel and shimmer: the vertex shader keeps it at
 * least uMinPx pixels wide and dims it by as much, so a line keeps its brightness per length at any distance.
 */
const LINE_VERT = /* glsl */ `
uniform float uRadius;
uniform float uMinPx;
uniform float uPxAngle;
varying vec3 vWorld;
varying float vThin;
#include <fog_pars_vertex>
void main() {
  vec4 w0 = modelMatrix * vec4(position, 1.0);
  vec3 nW = normalize(mat3(modelMatrix) * normal);
  vec3 centre = w0.xyz - nW * uRadius;
  float r = max(uRadius, distance(centre, cameraPosition) * uPxAngle * uMinPx);
  vThin = uRadius / r;
  vec4 w = vec4(centre + nW * r, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlarmDim;
uniform float uFogKeep;
varying vec3 vWorld;
varying float vThin;
${ALARM_GLSL}
#include <fog_pars_fragment>
void main() {
  // under alarm the cyan steps back a little so the red waves read
  float k = uAlarm * alarmWave(vWorld);
  vec3 c = mix(uColor * (1.0 - uAlarm * uAlarmDim), uAlarmColor, k) * mix(0.35, 1.0, vThin);
  gl_FragColor = vec4(c, 1.0);
  #ifdef USE_FOG
    // the lines carry further through the haze than the surfaces (the scale reads by them)
    float fogDepth = length(vWorld - cameraPosition) * uFogKeep;
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * fogDepth * fogDepth);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
  #endif
}`

const SOLID_VERT = /* glsl */ `
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

/** Slabs, hex blocks, low cover, platform sides, roofs: matte, the hex dressing on 'H' and '~', panels on the rest. */
const SOLID_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uSeam;
uniform float uSheen;
uniform float uAlbedo;
uniform float uHexSeam;
uniform float uFaceLines;
uniform float uVoidFade;
varying vec4 vE;
varying vec3 vNormalW;
varying vec3 vWorld;
${ALARM_GLSL}
${LIGHT_GLSL}
${HEX_GLSL}
#include <fog_pars_fragment>
void main() {
  // vE: the block's top, 1 = hex dressing, the foot (the floor in front of this face), baked occlusion
  vec3 n = normalize(vNormalW);
  float top = vE.x;
  float foot = vE.z;
  bool side = abs(n.y) < 0.5;
  vec2 uv = side ? vec2(abs(n.x) > 0.5 ? vWorld.z : vWorld.x, vWorld.y) : vWorld.xz;
  vec2 fw = fwidth(uv) + 1e-4;
  float px = max(fw.x, fw.y);
  float tone = 1.0;
  float seam = 0.0;
  float glint = 0.0;
  if (vE.y > 0.0) {
    // NF4: matte black hex modules with thin cyan seams; each a slightly different tone, a few lit from inside
    vec4 h = hexCell(uv / vE.y);
    float e = hexEdge(h.xy) * vE.y;
    float id = hash12(h.zw + floor(top));
    tone = 0.75 + 0.5 * id;
    seam = 1.0 - smoothstep(0.012, 0.012 + px * 1.5, e);
    glint = step(0.97, id) * (0.6 + 0.4 * sin(uTime * 1.3 + id * 40.0)) * 0.12;
  } else {
    // NF6: smooth plates with faint joints, and now and then a thin light line running down a face
    vec2 q = uv / vec2(4.0, 3.0);
    vec2 f = fract(q);
    float joint = min(min(f.x, 1.0 - f.x) * 4.0, min(f.y, 1.0 - f.y) * 3.0);
    tone = 0.85 + 0.3 * hash12(floor(q) + floor(top));
    seam = (1.0 - smoothstep(0.008, 0.008 + px * 1.5, joint)) * 0.35;
    if (side) {
      float lane = floor(uv.x / 6.0);
      float h = hash12(vec2(lane, floor(top * 3.0)));
      float at = (fract(uv.x / 6.0) - (0.2 + 0.6 * h)) * 6.0;
      float from = top - (2.0 + 9.0 * hash12(vec2(lane, 7.0)));
      float on = step(0.72, h) * step(from, uv.y) * step(uv.y, top - 0.3);
      glint = on * (1.0 - smoothstep(0.015, 0.015 + px * 1.5, abs(at))) * uFaceLines;
    }
  }
  // occlusion at the foot, light falling off down the face, and the void swallowing what is below the floors
  float y = vWorld.y - foot;
  float ao = vE.w * (side ? (0.45 + 0.55 * smoothstep(0.0, 0.8, y)) : 1.0);
  float grad = side ? mix(0.75, 1.15, smoothstep(foot, top, vWorld.y)) : 1.1;
  float deep = 1.0 - (1.0 - uVoidFade) * smoothstep(0.0, 18.0, uPlane.x - 1.0 - vWorld.y);
  vec3 c = uBase * tone * grad * ao * deep * (1.0 - 0.5 * seam);
  c += uAlbedo * tone * keyLight(vWorld, n) * ao;
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
  c += uSeam * uSheen * fres * ao * deep;
  c += uSeam * (seam * uHexSeam * step(0.01, vE.y) + glint * 0.6) * deep;
  c += uAlarmColor * uAlarm * 0.04 * alarmWave(vWorld) * exp(-max(y, 0.0) * 0.8);
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

/** The distance texture: r = to the blocks (slabs, low cover), g = to the server blocks / hex modules. */
const DIST_GLSL = /* glsl */ `
uniform sampler2D uDist;
uniform vec2 uSize;
vec2 distAt(vec2 xz) {
  return texture2D(uDist, xz / uSize).rg * ${DIST_MAX.toFixed(1)};
}`

const FLOOR_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uSeam;
uniform float uFoot;
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
  vec2 fw = fwidth(p);
  float px = max(fw.x, fw.y) + 1e-4;
  // big matte plates (4 m), a tone each, thin dark joints
  vec2 pid = floor(p / 4.0);
  vec2 f = fract(p / 4.0) * 4.0;
  float tone = 0.8 + 0.4 * hash12(pid + 17.0);
  float e = min(min(f.x, 4.0 - f.x), min(f.y, 4.0 - f.y));
  float joint = 1.0 - smoothstep(0.01, 0.01 + px * 1.5, e);
  float bevel = (1.0 - smoothstep(0.0, px * 1.5, abs(e - 0.03))) * (1.0 - joint);
  // occlusion: the crease at the slabs, contact shadows at the blocks and under the hero
  float ao = 0.45 + 0.55 * smoothstep(0.1, 1.4, dist.x);
  ao *= 0.3 + 0.7 * smoothstep(0.0, 0.8, dist.y);
  float hd = length(p - uCenter);
  ao *= 1.0 - 0.65 * exp(-hd * hd * 5.0) * (1.0 - smoothstep(0.1, 0.6, abs(vWorld.y - uReflectPlane.x)));
  vec3 c = uBase * tone * ao * (1.0 - 0.5 * joint);
  c += uAlbedo * tone * keyLight(vWorld, vec3(0.0, 1.0, 0.0)) * ao;
  c += uSeam * uPlate * bevel * ao;
  // a lit foot line along every slab (NF6)
  float footLine = 1.0 - smoothstep(0.012, 0.012 + px * 1.2, abs(dist.x - 0.09));
  c += uSeam * uFoot * (footLine + 0.25 * exp(-dist.x * 6.0));
  // the reflection: weak, short and rough - it fades and blurs with the height of the reflected point
  float onPlane = uReflectPlane.y * (1.0 - smoothstep(0.03, 0.12, abs(vWorld.y - uReflectPlane.x)));
  if (onPlane > 0.0 && uReflectAmt > 0.0) {
    vec4 pc = uReflectMatrix * vec4(vWorld, 1.0);
    vec2 ruv = pc.xy / pc.w;
    float dep = texture2D(uReflectDepth, ruv).r;
    if (dep < 0.99999) {
      vec4 wp = uReflectInv * vec4(vec3(ruv, dep) * 2.0 - 1.0, 1.0);
      float h = max(wp.y / wp.w - uReflectPlane.x, 0.0);
      float fade = exp(-h * uReflectShape.x);
      float lod = uReflectShape.y + h * uReflectShape.z;
      vec2 o = uReflectTexel * exp2(lod);
      vec3 r = textureLod(uReflect, ruv + o * vec2(0.5, 1.3), lod).rgb;
      r += textureLod(uReflect, ruv + o * vec2(-0.5, -1.3), lod).rgb;
      r += textureLod(uReflect, ruv + o * vec2(-0.7, 0.6), lod).rgb;
      r += textureLod(uReflect, ruv + o * vec2(0.7, -0.6), lod).rgb;
      vec3 viewDir = normalize(cameraPosition - vWorld);
      float fres = 0.2 + 0.8 * pow(1.0 - max(viewDir.y, 0.0), 4.0);
      c += r * 0.25 * uReflectAmt * fres * fade * onPlane * (1.0 - joint);
    }
  }
  // where the security looks: a red fan on the floor (NN1b), cut off where its line of sight is (view/sight.ts).
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
      vis = seenOnFloor(sightAt(uFans, uConeFan[i], fv, dd), length(dd) / range);
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
  c += uAlarmColor * uAlarm * 0.05 * exp(-dist.x * 3.2) * alarmWave(vWorld);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`

/** The level's hex modules: instanced prisms; aH = (around the rim 0..6 / the cap's radius 0..1, up 0..1, 1 = cap). */
const HEX_VERT = /* glsl */ `
attribute vec3 aH;
varying vec3 vH;
varying vec2 vScale;
varying vec3 vNormalW;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vH = aH;
  vScale = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const HEX_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uSeam;
uniform float uAlbedo;
uniform float uSheen;
varying vec3 vH;
varying vec2 vScale;
varying vec3 vNormalW;
varying vec3 vWorld;
${ALARM_GLSL}
${LIGHT_GLSL}
#include <fog_pars_fragment>
void main() {
  vec3 n = normalize(vNormalW);
  float r = vScale.x;
  float h = vScale.y;
  float line;
  float tone;
  if (vH.z > 0.5) {
    // the cap: a bright rim just inside the edge, a dim inner hexagon
    float d = (1.0 - vH.x) * r * 0.866;
    float px = fwidth(d) + 1e-4;
    line = 1.0 - smoothstep(0.02, 0.02 + px * 1.5, abs(d - 0.04));
    line += 0.3 * (1.0 - smoothstep(0.012, 0.012 + px * 1.5, abs(d - r * 0.3)));
    tone = 1.1;
  } else {
    // the sides: seams up every corner, a rim at the top, faint bands
    float a = fract(vH.x) * r;
    float y = vH.y * h;
    vec2 px = vec2(fwidth(a), fwidth(y)) + 1e-4;
    float corner = 1.0 - smoothstep(0.012, 0.012 + px.x * 1.5, min(a, r - a));
    float rim = 1.0 - smoothstep(0.016, 0.016 + px.y * 1.5, abs(h - 0.035 - y));
    float band = 1.0 - smoothstep(0.008, 0.008 + px.y * 1.5, (0.5 - abs(fract(y / 1.2) - 0.5)) * 1.2);
    line = corner * 0.55 + rim + band * 0.15;
    tone = 0.75 + 0.25 * smoothstep(0.0, h, y);
  }
  vec3 c = uBase * tone;
  c += uAlbedo * keyLight(vWorld, n);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  c += uSeam * uSheen * pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
  float k = uAlarm * alarmWave(vWorld);
  c += mix(uSeam * (1.0 - uAlarm * 0.35), uAlarmColor, k) * line * 0.55;
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`

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

function hash(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return v - Math.floor(v)
}

const DC = [1, 1, 0, -1, -1, -1, 0, 1]
const DR = [0, 1, 1, 1, 0, -1, -1, -1]

/**
 * The light paths on the floors: random walks over a 1 m lattice of plain floor (straight runs, now and then a
 * 45-degree turn), clear of blocks, the void and each other. Deterministic. Each is a polyline in world metres.
 */
export function buildPaths(g: Grid): P3[][] {
  const STEP = 1
  const nc = Math.floor((g.cols * g.cell) / STEP)
  const nr = Math.floor((g.rows * g.cell) / STEP)
  const clearOf = Y.pathClear
  const plainAt = (x: number, z: number): boolean => {
    const c = Math.floor(x / g.cell)
    const r = Math.floor(z / g.cell)
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false
    const i = r * g.cols + c
    const k = g.kind[i]
    return (k === CellKind.Floor || k === CellKind.Start || k === CellKind.Checkpoint || k === CellKind.Terminal) && g.rampAxis[i] === RampAxis.None
  }
  const ok = (a: number, b: number): boolean => {
    if (a < 0 || b < 0 || a >= nc || b >= nr) return false
    const x = (a + 0.5) * STEP
    const z = (b + 0.5) * STEP
    for (let k = 0; k < 9; k++) if (!plainAt(x + ((k % 3) - 1) * clearOf, z + (Math.floor(k / 3) - 1) * clearOf)) return false
    for (const bl of g.blocks) if (x > bl.minX - clearOf && x < bl.maxX + clearOf && z > bl.minZ - clearOf && z < bl.maxZ + clearOf) return false
    return true
  }
  const height = (a: number, b: number): number => g.h0[Math.floor(((b + 0.5) * STEP) / g.cell) * g.cols + Math.floor(((a + 0.5) * STEP) / g.cell)] as number
  const used = new Uint8Array(nc * nr)
  const mark = (a: number, b: number): void => {
    for (let k = 0; k < 9; k++) {
      const aa = a + (k % 3) - 1
      const bb = b + Math.floor(k / 3) - 1
      if (aa >= 0 && bb >= 0 && aa < nc && bb < nr) used[bb * nc + aa] = 1
    }
  }
  const out: P3[][] = []
  let seed = 1
  const rnd = (): number => hash(seed++ * 0.731 + 0.17, seed * 1.37)
  const tries = Math.round((nc * nr) / Y.pathEvery)
  for (let t = 0; t < tries; t++) {
    let a = Math.floor(rnd() * nc)
    let b = Math.floor(rnd() * nr)
    if (!ok(a, b) || used[b * nc + a]) continue
    let dir = Math.floor(rnd() * 4) * 2
    const nodes: [number, number][] = [[a, b]]
    const [lenMin, lenMax] = Y.pathLen as [number, number]
    const len = lenMin + Math.floor(rnd() * (lenMax - lenMin))
    const h = height(a, b)
    for (let s = 0; s < len; s++) {
      if (s > 1 && rnd() < 0.22) dir = (dir + (rnd() < 0.5 ? 1 : 7)) % 8
      const na = a + (DC[dir] as number)
      const nb = b + (DR[dir] as number)
      if (!ok(na, nb) || used[nb * nc + na] || height(na, nb) !== h) break
      a = na
      b = nb
      nodes.push([a, b])
    }
    if (nodes.length < 4) continue
    for (const [aa, bb] of nodes) mark(aa, bb)
    const pts = nodes.map(([aa, bb]) => ({ x: (aa + 0.5) * STEP, y: h + 0.01, z: (bb + 0.5) * STEP }))
    // keep the corners only
    out.push(pts.filter((p, k) => {
      if (k === 0 || k === pts.length - 1) return true
      const q = pts[k - 1] as P3
      const r = pts[k + 1] as P3
      return Math.abs((p.x - q.x) * (r.z - p.z) - (p.z - q.z) * (r.x - p.x)) > 1e-6
    }))
  }
  return out
}

/** r = distance to the nearest block cell, g = to the nearest server block / hex module. */
function distanceTexture(g: Grid): DataTexture {
  const w = Math.ceil(g.cols * g.cell * DIST_RES)
  const h = Math.ceil(g.rows * g.cell * DIST_RES)
  const data = new Uint8Array(w * h * 4)
  const reach = Math.ceil(DIST_MAX / g.cell)
  const solid = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false
    const k = g.kind[r * g.cols + c]
    return k === CellKind.Wall || k === CellKind.Cover
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
          if (!solid(c, r)) continue
          const inset = g.kind[r * g.cols + c] === CellKind.Cover ? Y.coverInset : 0
          dw = Math.min(dw, boxDist(x, z, c * g.cell + inset, r * g.cell + inset, (c + 1) * g.cell - inset, (r + 1) * g.cell - inset))
        }
      }
      let db = DIST_MAX
      for (const b of g.blocks) {
        if (b.maxX < x - DIST_MAX || b.minX > x + DIST_MAX || b.maxZ < z - DIST_MAX || b.minZ > z + DIST_MAX) continue
        db = Math.min(db, boxDist(x, z, b.minX, b.minZ, b.maxX, b.maxZ))
      }
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

/** A hexagonal prism of radius 1 and height 1 standing on y = 0 (corners along x), with the aH attribute. */
function hexPrism(): BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const att: number[] = []
  const corner = (k: number): [number, number] => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]
  for (let k = 0; k < 6; k++) {
    const [ax, az] = corner(k)
    const [bx, bz] = corner(k + 1)
    const nx = (ax + bx) / 2
    const nz = (az + bz) / 2
    const nl = Math.hypot(nx, nz)
    const quad: [number, number, number, number][] = [
      [ax, 0, az, k],
      [bx, 0, bz, k + 0.999],
      [bx, 1, bz, k + 0.999],
      [ax, 1, az, k],
    ]
    for (const idx of [0, 2, 1, 0, 3, 2]) {
      const q = quad[idx] as [number, number, number, number]
      pos.push(q[0], q[1], q[2])
      nor.push(nx / nl, 0, nz / nl)
      att.push(q[3], q[1], 0)
    }
    // the cap: a fan from the centre
    pos.push(0, 1, 0, bx, 1, bz, ax, 1, az)
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0)
    att.push(0, 1, 1, 1, 1, 1, 1, 1, 1)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  geo.setAttribute('aH', new Float32BufferAttribute(att, 3))
  return geo
}

export interface City {
  root: Group
  /** The light paths on the floors (for the data packets that run along them). */
  paths: readonly P3[][]
  /** Once a frame: alarm 0..1 (the red waves along the lines), the time, where the waves start (xz) - the hero. */
  setAlarm(level: number, time: number, cx: number, cz: number): void
  /** Floor fans of the view cones: fill slot i (with the device's sight fan), then set the count. */
  setCone(i: number, px: number, py: number, pz: number, dx: number, dy: number, dz: number, cosHalf: number, range: number, color: Color, strength: number, fan: Fan): void
  setConeCount(n: number): void
  /** The materials whose uniforms (alarm, time, hero) follow setAlarm - for the skyline's shaders too. */
  readonly alarmMaterials: ShaderMaterial[]
}

interface Chunk {
  solid: GeoBuilder
  floor: GeoBuilder
  seams: GeoBuilder
  ribs: GeoBuilder
}

interface Seg {
  ax: number
  az: number
  bx: number
  bz: number
  y: number
}

/** Chains directed segments (end of one = start of the next, same height) into polylines; loops are closed. */
function chain(segs: Seg[]): { pts: P3[]; closed: boolean }[] {
  const key = (x: number, z: number, y: number): string => `${Math.round(x * 100)},${Math.round(z * 100)},${Math.round(y * 100)}`
  const from = new Map<string, Seg[]>()
  const into = new Map<string, number>()
  for (const s of segs) {
    const k = key(s.ax, s.az, s.y)
    const list = from.get(k) ?? []
    list.push(s)
    from.set(k, list)
    const kb = key(s.bx, s.bz, s.y)
    into.set(kb, (into.get(kb) ?? 0) + 1)
  }
  const out: { pts: P3[]; closed: boolean }[] = []
  const take = (k: string): Seg | undefined => {
    const list = from.get(k)
    const s = list?.pop()
    if (s) {
      const kb = key(s.bx, s.bz, s.y)
      into.set(kb, (into.get(kb) ?? 1) - 1)
    }
    return s
  }
  const walk = (first: Seg): void => {
    const pts: P3[] = [{ x: first.ax, y: first.y, z: first.az }]
    const start = key(first.ax, first.az, first.y)
    let s: Seg | undefined = first
    let closed = false
    for (let guard = 0; s && guard < 100000; guard++) {
      pts.push({ x: s.bx, y: s.y, z: s.bz })
      const k = key(s.bx, s.bz, s.y)
      if (k === start) {
        closed = true
        pts.pop()
        break
      }
      s = take(k)
    }
    // drop the points in the middle of straight runs
    const n = pts.length
    const keep: P3[] = []
    for (let i = 0; i < n; i++) {
      const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as P3
      const b = pts[i] as P3
      const c = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as P3
      const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)
      if ((!closed && (i === 0 || i === n - 1)) || Math.abs(cross) > 1e-6) keep.push(b)
    }
    if (keep.length >= 2) out.push({ pts: keep, closed })
  }
  // open chains first (from a start nothing leads into), then the loops
  for (const [k, list] of from) {
    while (list.length > 0 && (into.get(k) ?? 0) === 0) {
      const s = take(k)
      if (s) walk(s)
    }
  }
  for (const [k] of from) {
    for (;;) {
      const s = take(k)
      if (!s) break
      walk(s)
    }
  }
  return out
}

/** Rounds the corners of a polyline a little (radius r), so the light lines read as drawn, not boxed. */
function softCorners(pts: P3[], closed: boolean, r: number): P3[] {
  const n = pts.length
  if (n < 3) return pts
  const out: P3[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[i] as P3
    if (!closed && (i === 0 || i === n - 1)) {
      out.push(p)
      continue
    }
    const a = pts[(i - 1 + n) % n] as P3
    const c = pts[(i + 1) % n] as P3
    const la = Math.hypot(a.x - p.x, a.z - p.z)
    const lc = Math.hypot(c.x - p.x, c.z - p.z)
    const rr = Math.min(r, la / 2, lc / 2)
    const s0 = { x: p.x + ((a.x - p.x) / la) * rr, y: p.y, z: p.z + ((a.z - p.z) / la) * rr }
    const s1 = { x: p.x + ((c.x - p.x) / lc) * rr, y: p.y, z: p.z + ((c.z - p.z) / lc) * rr }
    for (let k = 0; k <= 3; k++) {
      const t = k / 3
      const u = 1 - t
      out.push({ x: u * u * s0.x + 2 * u * t * p.x + t * t * s1.x, y: p.y, z: u * u * s0.z + 2 * u * t * p.z + t * t * s1.z })
    }
  }
  return out
}

export function buildCity(g: Grid, mats: Materials, sight: Sight, mirror: Mirror, _s: GameState): City {
  const root = new Group()
  const chunks = new Map<number, Chunk>()
  const ccols = Math.ceil(g.cols / CHUNK)
  const chunkAt = (x: number, z: number): Chunk => {
    const cx = Math.max(0, Math.min(ccols - 1, Math.floor(x / g.cell / CHUNK)))
    const cz = Math.max(0, Math.floor(z / g.cell / CHUNK))
    const k = cz * ccols + cx
    let ch = chunks.get(k)
    if (!ch) {
      ch = { solid: new GeoBuilder(), floor: new GeoBuilder(), seams: new GeoBuilder(), ribs: new GeoBuilder() }
      chunks.set(k, ch)
    }
    return ch
  }
  const inside = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < g.cols && r < g.rows
  const kind = (c: number, r: number): number => (inside(c, r) ? (g.kind[r * g.cols + c] as number) : CellKind.Void)
  const isSolid = (c: number, r: number): boolean => {
    const k = kind(c, r)
    return k === CellKind.Wall || k === CellKind.Cover
  }
  const isVoid = (c: number, r: number): boolean => kind(c, r) === CellKind.Void
  const hasFloor = (c: number, r: number): boolean => !isSolid(c, r) && !isVoid(c, r)
  /** The top of what stands in a cell (the floor's higher edge for floors, the bottom for the void). */
  const topOf = (c: number, r: number): number => (inside(c, r) ? (g.top[r * g.cols + c] as number) : g.bottom)
  const cornerH = (i: number, east: boolean, south: boolean): number => {
    const ax = g.rampAxis[i]
    if (ax === RampAxis.X) return (east ? g.h1[i] : g.h0[i]) as number
    if (ax === RampAxis.Z) return (south ? g.h1[i] : g.h0[i]) as number
    return g.h0[i] as number
  }
  /** A bridge: a floor cell with the void on two opposite sides. */
  const isBridge = (c: number, r: number): boolean => hasFloor(c, r) && ((isVoid(c - 1, r) && isVoid(c + 1, r)) || (isVoid(c, r - 1) && isVoid(c, r + 1)))
  const bridgeDeck = Y.bridgeDeck

  // a vertical quad on the lattice edge (x0, z0)-(x1, z1) from y0 to y1, facing (nx, nz)
  const wallQuad = (b: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y0a: number, y0b: number, y1a: number, y1b: number, nx: number, nz: number, top: number, hex: number, foot: number): void => {
    const v0 = b.vertex(x0, y0a, z0, nx, 0, nz, top, hex, foot, 0.8)
    const v1 = b.vertex(x1, y0b, z1, nx, 0, nz, top, hex, foot, 0.8)
    const v2 = b.vertex(x1, y1b, z1, nx, 0, nz, top, hex, foot, 1)
    const v3 = b.vertex(x0, y1a, z0, nx, 0, nz, top, hex, foot, 1)
    b.triFacing(v0, v1, v2)
    b.triFacing(v0, v2, v3)
  }

  // ---- blocks: tops and the faces above whatever is next to them; the outline of every top
  const outline: Seg[] = []
  const corners: { x: number; z: number; top: number; low: number }[] = []
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!isSolid(c, r)) continue
      const i = r * g.cols + c
      const cover = g.kind[i] === CellKind.Cover
      const t = g.top[i] as number
      const hex = cover ? Y.coverHexSize : g.hex[i] === 1 ? Y.hexSize : 0
      const e = cover ? Y.coverInset : 0
      const x0 = c * g.cell + e
      const x1 = (c + 1) * g.cell - e
      const z0 = r * g.cell + e
      const z1 = (r + 1) * g.cell - e
      const ch = chunkAt(x0 + 0.1, z0 + 0.1)
      const b = ch.solid
      const foot = g.h0[i] as number
      const a = b.vertex(x0, t, z0, 0, 1, 0, t, hex, t, 1)
      const bb = b.vertex(x1, t, z0, 0, 1, 0, t, hex, t, 1)
      const cc = b.vertex(x0, t, z1, 0, 1, 0, t, hex, t, 1)
      const d = b.vertex(x1, t, z1, 0, 1, 0, t, hex, t, 1)
      b.triFacing(a, cc, bb)
      b.triFacing(bb, cc, d)
      const sides: [number, number, number, number, number, number, number, number][] = [
        // neighbour dc, dr, edge from (x, z) to (x, z) (solid side on the left when walked), normal
        [0, -1, x1, z0, x0, z0, 0, -1],
        [0, 1, x0, z1, x1, z1, 0, 1],
        [-1, 0, x0, z0, x0, z1, -1, 0],
        [1, 0, x1, z1, x1, z0, 1, 0],
      ]
      const low: number[] = []
      for (const [dc, dr, ax, az, bx, bz, nx, nz] of sides) {
        // a low cover box stands free in its cell: all four faces; a block shows a face where its neighbour is lower
        const nTop = cover ? (g.h0[i] as number) : isSolid(c + dc, r + dr) ? topOf(c + dc, r + dr) : isVoid(c + dc, r + dr) ? g.bottom : Math.min(topOf(c + dc, r + dr), g.h0[(r + dr) * g.cols + c + dc] as number)
        low.push(nTop)
        if (nTop >= t - 0.01) continue
        const ft = cover ? foot : isVoid(c + dc, r + dr) ? g.bottom : nTop
        wallQuad(b, ax, az, bx, bz, nTop, nTop, t, t, nx, nz, t, hex, ft)
        outline.push({ ax, az, bx, bz, y: t + 0.006 })
      }
      // tall outer corners get a vertical light line (some of them: NF6 picks the edges that read)
      if (!cover) {
        const pairs: [number, number, number, number][] = [
          [0, 2, x0, z0],
          [0, 3, x1, z0],
          [1, 2, x0, z1],
          [1, 3, x1, z1],
        ]
        for (const [p, q, x, z] of pairs) {
          const lo = Math.max(low[p] as number, low[q] as number)
          if (t - lo >= Y.cornerMinDrop && hash(x, z) < Y.cornerShare) corners.push({ x, z, top: t, low: Math.max(lo, t - Y.cornerMaxLen) })
        }
      }
    }
  }
  for (const { pts, closed } of chain(outline)) {
    const ch = chunkAt((pts[0] as P3).x, (pts[0] as P3).z)
    tube(ch.seams, softCorners(pts, closed, 0.06), Y.edgeRadius, closed, 4)
  }
  for (const k of corners) tube(chunkAt(k.x, k.z).ribs, [{ x: k.x, y: k.top, z: k.z }, { x: k.x, y: k.low, z: k.z }], Y.edgeRadius * 0.8, false, 4)

  // ---- floors, ramps, steps between floors, platform sides over the void, bridges
  const lips: P3[][] = []
  const edges: Seg[] = []
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!hasFloor(c, r)) continue
      const i = r * g.cols + c
      const x0 = c * g.cell
      const x1 = x0 + g.cell
      const z0 = r * g.cell
      const z1 = z0 + g.cell
      const ch = chunkAt(x0 + 0.1, z0 + 0.1)
      const f = ch.floor
      const a = f.vertex(x0, cornerH(i, false, false), z0, 0, 1, 0)
      const b = f.vertex(x1, cornerH(i, true, false), z0, 0, 1, 0)
      const cc = f.vertex(x0, cornerH(i, false, true), z1, 0, 1, 0)
      const d = f.vertex(x1, cornerH(i, true, true), z1, 0, 1, 0)
      f.tri(a, cc, b)
      f.tri(b, cc, d)
      const bridge = isBridge(c, r)
      // the platform's side where the void is next to it: down into the dark, or a thin deck for a bridge
      const sides: [number, number, number, number, number, number, boolean, boolean, boolean, boolean, number, number][] = [
        [0, -1, x1, z0, x0, z0, true, false, false, false, 0, -1],
        [0, 1, x0, z1, x1, z1, false, true, true, true, 0, 1],
        [-1, 0, x0, z0, x0, z1, false, false, false, true, -1, 0],
        [1, 0, x1, z1, x1, z0, true, true, true, false, 1, 0],
      ]
      for (const [dc, dr, ax, az, bx, bz, ea, sa, eb, sb, nx, nz] of sides) {
        if (!isVoid(c + dc, r + dr)) continue
        const ya = cornerH(i, ea, sa)
        const yb = cornerH(i, eb, sb)
        const deep = bridge ? bridgeDeck : Math.max(ya, yb) - g.bottom
        wallQuad(ch.solid, ax, az, bx, bz, ya - deep, yb - deep, ya, yb, nx, nz, Math.max(ya, yb), 0, ya - deep)
        edges.push({ ax, az, bx, bz, y: (ya + yb) / 2 + 0.01 })
      }
      if (bridge) {
        const under = ch.solid
        const y = (g.h0[i] as number) - bridgeDeck
        const u0 = under.vertex(x0, y, z0, 0, -1, 0, y, 0, y, 1)
        const u1 = under.vertex(x1, y, z0, 0, -1, 0, y, 0, y, 1)
        const u2 = under.vertex(x0, y, z1, 0, -1, 0, y, 0, y, 1)
        const u3 = under.vertex(x1, y, z1, 0, -1, 0, y, 0, y, 1)
        under.triFacing(u0, u1, u2)
        under.triFacing(u1, u3, u2)
      }
      // risers to the east and south floor neighbours where the heights differ
      if (hasFloor(c + 1, r)) {
        const j = i + 1
        const myN = cornerH(i, true, false)
        const myS = cornerH(i, true, true)
        const thN = cornerH(j, false, false)
        const thS = cornerH(j, false, true)
        if (Math.abs(myN - thN) > 0.01 || Math.abs(myS - thS) > 0.01) {
          const facing = myN > thN ? 1 : -1
          wallQuad(ch.solid, x1, z0, x1, z1, Math.min(myN, thN), Math.min(myS, thS), Math.max(myN, thN), Math.max(myS, thS), facing, 0, Math.max(myN, thN), 0, Math.min(myN, thN))
          lips.push([
            { x: x1 - facing * 0.02, y: Math.max(myN, thN), z: z0 },
            { x: x1 - facing * 0.02, y: Math.max(myS, thS), z: z1 },
          ])
        }
      }
      if (hasFloor(c, r + 1)) {
        const j = i + g.cols
        const myW = cornerH(i, false, true)
        const myE = cornerH(i, true, true)
        const thW = cornerH(j, false, false)
        const thE = cornerH(j, true, false)
        if (Math.abs(myW - thW) > 0.01 || Math.abs(myE - thE) > 0.01) {
          const facing = myW > thW ? 1 : -1
          wallQuad(ch.solid, x0, z1, x1, z1, Math.min(myW, thW), Math.min(myE, thE), Math.max(myW, thW), Math.max(myE, thE), 0, facing, Math.max(myW, thW), 0, Math.min(myW, thW))
          lips.push([
            { x: x0, y: Math.max(myW, thW), z: z1 - facing * 0.02 },
            { x: x1, y: Math.max(myE, thE), z: z1 - facing * 0.02 },
          ])
        }
      }
    }
  }
  for (const lip of lips) tube(chunkAt((lip[0] as P3).x, (lip[0] as P3).z).seams, lip, Y.edgeRadius * 0.9, false, 4)
  // the platform edges over the void: continuous light lines (brighter on the bridges)
  for (const { pts, closed } of chain(edges)) tube(chunkAt((pts[0] as P3).x, (pts[0] as P3).z).seams, softCorners(pts, closed, 0.06), Y.edgeRadius, closed, 4)

  // ---- the light paths on the floors: thin traces ending in small rings (vias), half sunk into the floor
  const paths = buildPaths(g)
  const pathGeo = new Map<Chunk, GeoBuilder>()
  for (const path of paths) {
    const first = path[0] as P3
    const ch = chunkAt(first.x, first.z)
    let b = pathGeo.get(ch)
    if (!b) {
      b = new GeoBuilder()
      pathGeo.set(ch, b)
    }
    const v = Y.viaRadius
    const trim = (a: P3, to: P3): P3 => {
      const l = Math.hypot(to.x - a.x, to.z - a.z) || 1
      return { x: a.x + ((to.x - a.x) / l) * v, y: a.y, z: a.z + ((to.z - a.z) / l) * v }
    }
    const pts = path.slice()
    pts[0] = trim(path[0] as P3, path[1] as P3)
    pts[pts.length - 1] = trim(path[path.length - 1] as P3, path[path.length - 2] as P3)
    tube(b, softCorners(pts, false, 0.3), Y.pathRadius, false, 4)
    for (const end of [path[0] as P3, path[path.length - 1] as P3]) {
      const ring: P3[] = []
      for (let k = 0; k < 10; k++) ring.push({ x: end.x + Math.cos((k / 10) * Math.PI * 2) * v, y: end.y, z: end.z + Math.sin((k / 10) * Math.PI * 2) * v })
      tube(b, ring, Y.pathRadius, true, 4)
    }
  }

  // ---- roofs: slabs overhead, lit along their open edges, a light strip down the middle underneath
  for (const roof of g.roofs) {
    const ch = chunkAt(roof.minX + 0.1, roof.minZ + 0.1)
    const b = ch.solid
    const y0 = roof.y
    const y1 = roof.y + Y.roofThickness
    const quad = (pts: [number, number, number][], nx: number, ny: number, nz: number): void => {
      const ids = pts.map(([x, y, z]) => b.vertex(x, y, z, nx, ny, nz, y1, 0, y0, 1))
      b.triFacing(ids[0] as number, ids[1] as number, ids[2] as number)
      b.triFacing(ids[0] as number, ids[2] as number, ids[3] as number)
    }
    const { minX: ax, maxX: bx, minZ: az, maxZ: bz } = roof
    quad([[ax, y0, az], [bx, y0, az], [bx, y0, bz], [ax, y0, bz]], 0, -1, 0)
    quad([[ax, y1, az], [ax, y1, bz], [bx, y1, bz], [bx, y1, az]], 0, 1, 0)
    quad([[ax, y0, az], [ax, y1, az], [bx, y1, az], [bx, y0, az]], 0, 0, -1)
    quad([[ax, y0, bz], [bx, y0, bz], [bx, y1, bz], [ax, y1, bz]], 0, 0, 1)
    quad([[ax, y0, az], [ax, y0, bz], [ax, y1, bz], [ax, y1, az]], -1, 0, 0)
    quad([[bx, y0, az], [bx, y1, az], [bx, y1, bz], [bx, y0, bz]], 1, 0, 0)
    const e = 0.04
    tube(ch.seams, [{ x: ax + e, y: y0 - e, z: az + e }, { x: bx - e, y: y0 - e, z: az + e }, { x: bx - e, y: y0 - e, z: bz - e }, { x: ax + e, y: y0 - e, z: bz - e }], Y.edgeRadius, true, 4)
    tube(ch.seams, [{ x: ax, y: y1 + 0.006, z: az }, { x: bx, y: y1 + 0.006, z: az }, { x: bx, y: y1 + 0.006, z: bz }, { x: ax, y: y1 + 0.006, z: bz }], Y.edgeRadius, true, 4)
    const alongX = bx - ax > bz - az
    const mid = alongX ? (az + bz) / 2 : (ax + bx) / 2
    for (const off of [-0.25, 0.25]) {
      const line: P3[] = alongX
        ? [{ x: ax + 0.5, y: y0 - 0.02, z: mid + off }, { x: bx - 0.5, y: y0 - 0.02, z: mid + off }]
        : [{ x: mid + off, y: y0 - 0.02, z: az + 0.5 }, { x: mid + off, y: y0 - 0.02, z: bz - 0.5 }]
      tube(ch.ribs, line, Y.edgeRadius * 0.8, false, 4)
    }
  }

  // ---- the level's server blocks: glossy black monoliths with thin seams and a column of status lights
  const detail = new GeoBuilder()
  const glow = new GeoBuilder()
  const blockLines = new GeoBuilder()
  const capGeos: BufferGeometry[] = []
  const dim = palette.seamDim
  const hexes: Block[] = []
  for (const b of g.blocks) {
    if (b.hex) {
      hexes.push(b)
      continue
    }
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    const hgt = b.maxY - b.minY
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
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
      for (let k = 1; k < 4; k++) panel(detail, f, ox, b.minY + (hgt * k) / 4, oz, halfAlong - 0.1, 0.012, 0.066, 0.006, 0.4)
      if (halfAlong > 0.4) {
        for (let k = 0; k < 6; k++) {
          const hh = hash(cx + k, cz + f.nx * 3 + f.nz * 5)
          if (hh < 0.3) continue
          glowQuad(glow, f, ox + f.ux * (halfAlong - 0.18), b.minY + 0.35 + k * 0.17, oz + f.uz * (halfAlong - 0.18), 0.04, 0.01, 0.068, dim.r * (0.7 + hh), dim.g * (0.7 + hh), dim.b * (0.7 + hh))
        }
      }
    }
    capGeos.push(new RoundedBoxGeometry(w - 0.07, hgt - 0.01, d - 0.07, 1, 0.02).translate(cx, b.minY + hgt / 2, cz))
    capGeos.push(new RoundedBoxGeometry(w - 0.04, 0.08, d - 0.04, 2, 0.03).translate(cx, b.maxY - 0.04, cz))
    const e = 0.07
    tube(blockLines, [
      { x: b.minX + e, y: b.maxY + 0.005, z: b.minZ + e },
      { x: b.maxX - e, y: b.maxY + 0.005, z: b.minZ + e },
      { x: b.maxX - e, y: b.maxY + 0.005, z: b.maxZ - e },
      { x: b.minX + e, y: b.maxY + 0.005, z: b.maxZ - e },
    ], L.ribRadius * 0.8, true)
  }
  if (capGeos.length > 0) {
    const merged = mergeGeometries(capGeos)
    if (merged) root.add(new Mesh(merged, mats.glossBlack))
  }

  // ---- materials
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
  const pxAngle = ((cfgAll.view.fov * Math.PI) / 180 / 720) * 0.5
  const lineMat = (intensity: number, radius: number): ShaderMaterial =>
    new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uColor: { value: palette.seam.clone().multiplyScalar(intensity) },
          uAlarmDim: { value: L.alarmDim },
          uRadius: { value: radius },
          uMinPx: { value: Y.lineMinPx },
          uPxAngle: { value: pxAngle },
          uFogKeep: { value: Y.lineFogKeep },
        },
        alarmUniforms(),
      ]),
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      fog: true,
    })
  const seamMat = lineMat(Y.edgeIntensity, Y.edgeRadius)
  const ribMat = lineMat(Y.cornerIntensity, Y.edgeRadius * 0.8)
  const blockLineMat = lineMat(L.ribIntensity, L.ribRadius * 0.8)
  const pathMat = lineMat(Y.pathIntensity, Y.pathRadius)
  ;(pathMat.uniforms['uColor'] as { value: Color }).value.copy(palette.seamDim).multiplyScalar(Y.pathIntensity)
  const solidMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uBase: { value: new Color(Y.slabColor) },
        uSeam: { value: palette.seam.clone() },
        uSheen: { value: Y.slabSheen },
        uAlbedo: { value: L.wallAlbedo },
        uHexSeam: { value: Y.hexSeam },
        uFaceLines: { value: Y.faceLines },
        uVoidFade: { value: Y.voidFade },
      },
      alarmUniforms(),
      lightUniforms(),
    ]),
    vertexShader: SOLID_VERT,
    fragmentShader: SOLID_FRAG,
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
        uFoot: { value: Y.footLine },
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
  const hexMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { uBase: { value: new Color(Y.hexColor) }, uSeam: { value: palette.seam.clone() }, uAlbedo: { value: L.wallAlbedo }, uSheen: { value: Y.slabSheen } },
      alarmUniforms(),
      lightUniforms(),
    ]),
    vertexShader: HEX_VERT,
    fragmentShader: HEX_FRAG,
    fog: true,
  })
  // textures and the mirror's matrices are shared by reference (UniformsUtils.merge would clone them)
  const share = (m: ShaderMaterial, name: string, v: unknown): void => {
    const u = m.uniforms[name]
    if (u) u.value = v
  }
  share(floorMat, 'uDist', dist)
  share(floorMat, 'uReflect', mirror.texture)
  share(floorMat, 'uReflectDepth', mirror.depth)
  share(floorMat, 'uReflectMatrix', mirror.matrix)
  share(floorMat, 'uReflectInv', mirror.inverse)
  share(floorMat, 'uReflectTexel', mirror.texel)
  share(floorMat, 'uFans', sight.texture)
  share(floorMat, 'uReflectPlane', mirror.plane)
  for (const m of [solidMat, floorMat, hexMat]) share(m, 'uPlane', mirror.plane)

  for (const ch of chunks.values()) {
    if (!ch.solid.empty) root.add(new Mesh(ch.solid.build('aE'), solidMat))
    if (!ch.floor.empty) {
      const m = new Mesh(ch.floor.build(null), floorMat)
      m.userData['noReflect'] = true
      root.add(m)
    }
    if (!ch.seams.empty) root.add(new Mesh(ch.seams.build(null), seamMat))
    if (!ch.ribs.empty) root.add(new Mesh(ch.ribs.build(null), ribMat))
  }
  for (const b of pathGeo.values()) {
    const m = new Mesh(b.build(null), pathMat)
    m.userData['noReflect'] = true
    root.add(m)
  }
  if (!blockLines.empty) root.add(new Mesh(blockLines.build(null), blockLineMat))
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
  // the hex modules: one instanced draw (each instance can move later - sliding modules)
  if (hexes.length > 0) {
    const inst = new InstancedMesh(hexPrism(), hexMat, hexes.length)
    const m = new Matrix4()
    hexes.forEach((b, k) => {
      const r = (b.maxX - b.minX) / 2
      m.makeScale(r, b.maxY - b.minY, r).setPosition((b.minX + b.maxX) / 2, b.minY, (b.minZ + b.maxZ) / 2)
      inst.setMatrixAt(k, m)
    })
    inst.computeBoundingSphere()
    root.add(inst)
  }

  const fu = floorMat.uniforms as Record<string, { value: unknown }>
  const conePos = fu['uConePos']?.value as Vector3[]
  const coneDir = fu['uConeDir']?.value as Vector3[]
  const coneColor = fu['uConeColor']?.value as Vector3[]
  const coneShape = fu['uConeShape']?.value as Vector3[]
  const coneFan = fu['uConeFan']?.value as Vector4[]
  const alarmMaterials = [seamMat, ribMat, blockLineMat, pathMat, solidMat, floorMat, hexMat]
  return {
    root,
    paths,
    alarmMaterials,
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
      for (let k = 0; k < alarmMaterials.length; k++) {
        const m = alarmMaterials[k] as ShaderMaterial
        const u = m.uniforms
        ;(u['uAlarm'] as { value: number }).value = level
        ;(u['uTime'] as { value: number }).value = time
        ;(u['uCenter']?.value as Vector2).set(cx, cz)
      }
    },
  }
}
