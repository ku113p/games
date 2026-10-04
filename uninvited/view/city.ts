// The open data city (DESIGN 6 and 14, concepts NF6 + NF4, the matte NN1 look): the level grid turned into platforms
// over a dark void. Slabs ('#') are matte monoliths in three tones with form: a chamfer round every free top edge with
// a lit crease, a sloped plinth where a floor meets them, bays and tiers of inset panels, vertical light seams, a few
// lit data windows high up, a stepped crown on some tall ones. Hex survives only as real geometry: 'H' cells are a
// terraced base with a honeycomb of prism columns of varied heights, and some low cover is a plate with a small cluster
// of columns (one instanced draw); the other low cover ('~') is a clean bevelled block with an inset light seam.
// Platform edges over the void get a curb, a lit lip and a low glowing rail with posts; a one-cell walkway is a light
// bridge (a thin deck); a narrow void slit between walkable cells is drawn as a recessed lit duct grating. Floors are
// matte with a faint plate grid and a lit foot line along every slab; the light guides on them run along the streets
// from the start through the checkpoints to the artifact, with spurs to the terminals (view/city-kit.ts), and data
// packets run along them (view/city-life.ts). Roofs (the level's enclosed passages) are slabs overhead with a light strip.
// The sky, the void's data rivers, the far city and the landmark tower are in view/skyline.ts.
// Everything static is merged per chunk of the plan, so whole chunks are culled off screen. Cold path: built once.
// Red fans where the security looks (clipped by view/sight.ts); at alarm 3 red waves run out along the lines.
import {
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
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
import { CellKind, footBeside, RampAxis, type Block, type Grid } from '../core/grid'
import type { GameState } from '../core/state'
import { GeoBuilder, glowQuad, panel, tube, type Frame3, type P3 } from './geo'
import { addRim, palette, type Materials } from './look'
import type { Mirror } from './reflect'
import { lanesEnabled, type Exposure } from './exposure'
import { SIGHT_GLSL, type Fan, type Sight } from './sight'
import { buildGuides, hash, hexLattice, offsetLine, type HexCol } from './city-kit'

const L = cfgAll.view.corridor
const Y = cfgAll.view.city
const K = cfgAll.view.cones
const SL = cfgAll.view.stealthLight

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

/**
 * Slabs, blocks, low cover, platform sides, roofs: matte, in three tones, with form. vE = (the block's top, the
 * tone 0..2 + a seed (3 = low cover), the foot, a code: 0.8-1 = a wall's occlusion, 2-3 = a chamfer, 4-5 = a skirt).
 * Faces carry bays (grooves, a lit seam now and then), tiers of inset panels and a few lit data windows high up.
 */
const SOLID_FRAG = /* glsl */ `
uniform vec3 uTone[3];
uniform vec3 uSeam;
uniform vec3 uWarm;
uniform float uSheen;
uniform float uAlbedo;
uniform float uVoidFade;
uniform vec2 uBay;
uniform float uTier;
uniform vec4 uWin;
uniform float uSeamGlow;
uniform vec4 uCover;
uniform vec2 uSkirt;
varying vec4 vE;
varying vec3 vNormalW;
varying vec3 vWorld;
${ALARM_GLSL}
${LIGHT_GLSL}
#include <fog_pars_fragment>
float lineW(float d, float px, float w) {
  return 1.0 - smoothstep(w, w + px * 1.5, d);
}
void main() {
  vec3 n = normalize(vNormalW);
  float top = vE.x;
  float foot = vE.z;
  float code = vE.w;
  float vid = floor(vE.y + 0.001);
  float seed = (vE.y - vid) / 0.9;
  bool cover = vid > 2.5;
  vec3 albedo = vid < 0.5 ? uTone[0] : (vid < 1.5 ? uTone[1] : uTone[2]);
  albedo *= 0.85 + 0.3 * seed;
  bool chamfer = code > 1.5 && code < 3.5;
  bool skirt = code > 3.5;
  bool side = abs(n.y) < 0.5 && !chamfer;
  float shade = 1.0;
  float ao = side && !skirt ? code : 1.0;
  vec3 emis = vec3(0.0);
  float y = vWorld.y - foot;
  if (chamfer) {
    shade = 1.55;
    emis += uSeam * 0.012;
  } else if (skirt) {
    // the foot of a slab: a sloped plinth with a faint light along its top
    shade = 0.8;
    float p = code - 4.0;
    emis += uSeam * 0.5 * smoothstep(0.82, 0.95, p) * (1.0 - smoothstep(0.95, 1.0, p));
    ao = 0.7 + 0.3 * p;
  } else if (side) {
    float alongX = abs(n.x) > 0.5 ? 1.0 : 0.0;
    float u = alongX > 0.5 ? vWorld.z : vWorld.x;
    vec2 fw = vec2(fwidth(u), fwidth(vWorld.y)) + 1e-4;
    float px = max(fw.x, fw.y);
    float height = top - foot;
    float bw = mix(uBay.x, uBay.y, seed);
    float bu = u / bw + seed * 13.0;
    float bay = floor(bu);
    float bf = fract(bu);
    float gd = min(bf, 1.0 - bf) * bw;
    float bh = hash12(vec2(bay, floor(seed * 50.0) + alongX * 7.0));
    shade *= 0.88 + 0.22 * bh;
    // tiers from the top down: the panels are inset, with a lit lip under each joint
    float ty = (top - vWorld.y) / uTier;
    float tier = floor(ty);
    float band = fract(ty) * uTier;
    float td = min(band, uTier - band);
    float groove = max(lineW(gd, px, 0.02), lineW(td, px, 0.014));
    float inner = smoothstep(0.1, 0.1 + px * 1.5, gd) * smoothstep(0.1, 0.1 + px * 1.5, td);
    shade *= mix(1.0, 0.8, inner) * (1.0 - 0.5 * groove);
    shade += 0.3 * (1.0 - smoothstep(0.0, 0.07 + px, band)) * smoothstep(0.0, 0.5, top - vWorld.y);
    // vertical light seams on some of the bay joints
    float joint = floor(bu + 0.5);
    float jd = abs(bu - joint) * bw;
    float on = step(1.0 - uWin.z, hash12(vec2(joint, seed * 77.0 + alongX * 3.0)));
    float span = smoothstep(0.7, 1.5, y) * (1.0 - smoothstep(0.4, 1.1, top - vWorld.y));
    emis += uSeam * uSeamGlow * lineW(jd, px, 0.016) * on * span * step(3.0, height);
    // lit data windows: thin strips high up, a few rows in a bay
    if (height > 3.5 && y > 2.0) {
      float wh = hash12(vec2(bay + 3.7, seed * 31.3 + alongX * 5.0));
      float rows = 1.0 + floor(hash12(vec2(bay, seed * 9.1)) * 3.0);
      float r = (top - 1.0 - vWorld.y) / 0.55;
      float ri = floor(r);
      float rowOn = step(ri, rows - 1.0) * step(0.0, ri) * step(0.2, hash12(vec2(bay + ri * 5.0, seed * 17.0)));
      float across = 1.0 - smoothstep(bw * 0.26, bw * 0.26 + px * 1.5, abs(bf - 0.5) * bw);
      float strip = lineW(abs(fract(r) - 0.5) * 0.55, px, 0.016);
      vec3 wc = mix(uSeam, uWarm, step(1.0 - uWin.w, hash12(vec2(bay, seed * 5.3))));
      emis += wc * uWin.x * step(1.0 - uWin.y, wh) * rowOn * across * strip;
    }
  } else {
    // tops: big plates, and on the low cover a lit seam inset from the edge and a faint glow inside it
    vec2 q = vWorld.xz / 4.0;
    vec2 f = fract(q);
    vec2 fpx = fwidth(vWorld.xz) + 1e-4;
    float px = max(fpx.x, fpx.y);
    float joint = min(min(f.x, 1.0 - f.x) * 4.0, min(f.y, 1.0 - f.y) * 4.0);
    shade = 1.12 * (0.9 + 0.2 * hash12(floor(q) + floor(top)));
    shade *= 1.0 - 0.35 * lineW(joint, px, 0.01) * (cover ? 0.0 : 1.0);
    if (cover) {
      vec2 cp = vWorld.xz - floor(vWorld.xz / uCover.x) * uCover.x;
      float ed = min(min(cp.x, uCover.x - cp.x), min(cp.y, uCover.x - cp.y));
      emis += uSeam * uCover.z * lineW(abs(ed - uCover.y), px, 0.012);
      emis += uSeam * uCover.w * smoothstep(uCover.y, uCover.y + 0.45, ed);
    }
  }
  float grad = side ? mix(0.75, 1.15, smoothstep(foot, top, vWorld.y)) : 1.0;
  float deep = 1.0 - (1.0 - uVoidFade) * smoothstep(0.0, 18.0, uPlane.x - 1.0 - vWorld.y);
  vec3 c = albedo * shade * grad * ao * deep;
  c += uAlbedo * albedo * 6.0 * keyLight(vWorld, n) * ao;
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
  c += uSeam * uSheen * fres * ao * deep;
  c += emis * deep;
  c += uSeam * 0.035 * smoothstep(6.0, 22.0, uPlane.x - vWorld.y) * deep;
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
vec3 distAt(vec2 xz) {
  return texture2D(uDist, xz / uSize).rgb * ${DIST_MAX.toFixed(1)};
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
uniform sampler2D uExposure;
uniform vec2 uExpSize;
uniform vec4 uLane;
uniform vec4 uLaneRange;
uniform vec2 uLaneMore;
uniform vec3 uLaneColor;
uniform vec3 uFootColor;
varying vec3 vWorld;
${ALARM_GLSL}
${LIGHT_GLSL}
${DIST_GLSL}
${SIGHT_GLSL}
#include <fog_pars_fragment>
void main() {
  vec2 p = vWorld.xz;
  vec3 dist = distAt(p);
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
  // the stealth lighting (view/exposure.ts): watched floor is lit cool with a faint cell grid, blind spots are dark, and the
  // chains of cover that offer a way through carry a thin footlight at their base. uLane = (on, cell, grid, dim).
  if (uLane.x > 0.5) {
    vec2 ex = texture2D(uExposure, p / uExpSize).rg;
    float lit = smoothstep(uLaneRange.x, uLaneRange.y, ex.r);
    lit = lit * (1.0 + uLaneMore.x * (1.0 - lit)); // lifts the low end: a spot watched only now and then still reads lit
    c *= mix(uLane.w, 1.0, lit);
    if (lit > 0.01) {
      vec2 gf = fract(p / uLane.y + 0.5) - 0.5;
      float gd = min(abs(gf.x), abs(gf.y)) * uLane.y;
      float gridLine = 1.0 - smoothstep(0.012, 0.012 + px * 1.3, gd);
      c += uLaneColor * lit * ao * (uLaneRange.z + uLane.z * gridLine);
    }
    if (ex.g > 0.01) {
      float cover = 1.0 - smoothstep(uLaneRange.w, uLaneRange.w + px * 1.3, abs(dist.z - 0.09));
      c += uFootColor * ex.g * (cover + uLaneMore.y * (1.0 - smoothstep(0.0, 0.3, dist.z)));
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

/**
 * The level's hex modules: instanced hexagonal prisms with a bevelled top. aH = (around the rim 0..6 / the cap's
 * radius 0..1, 0 base | 1 top rim | 2 inner top, 0 side | 1 chamfer | 2 cap); the bevel is in metres (uBevel).
 */
const HEX_VERT = /* glsl */ `
attribute vec3 aH;
uniform float uBevel;
varying vec3 vH;
varying vec2 vScale;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vTint;
varying float vId;
#include <fog_pars_vertex>
void main() {
  float r = length(instanceMatrix[0].xyz);
  float h = length(instanceMatrix[1].xyz);
  float bev = min(uBevel, 0.4 * h);
  vec3 p = position;
  if (aH.y > 1.5) {
    p.xz *= 1.0 - bev / (0.8660254 * r);
    p.y = 1.0;
  } else if (aH.y > 0.5) {
    p.y = 1.0 - bev / h;
  }
  vH = aH;
  vScale = vec2(r, h);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vTint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #endif
  vId = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const HEX_FRAG = /* glsl */ `
uniform vec3 uSeam;
uniform float uAlbedo;
uniform float uSheen;
uniform float uBevel;
uniform float uAccent;
uniform float uSeamGlow;
varying vec3 vH;
varying vec2 vScale;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vTint;
varying float vId;
${ALARM_GLSL}
${LIGHT_GLSL}
#include <fog_pars_fragment>
void main() {
  vec3 n = normalize(vNormalW);
  float r = vScale.x;
  float h = vScale.y;
  float accent = step(1.0 - uAccent, vId);
  float line = 0.0;
  float shade = 1.0;
  if (vH.z > 1.5) {
    // the cap: a lit rim just inside the bevel, a dim inner hexagon
    float d = (1.0 - vH.x) * (r * 0.8660254 - min(uBevel, 0.4 * h));
    float px = fwidth(d) + 1e-4;
    line = 1.0 - smoothstep(0.014, 0.014 + px * 1.5, abs(d - 0.035));
    line += 0.35 * (1.0 - smoothstep(0.01, 0.01 + px * 1.5, abs(d - r * 0.3)));
    shade = 1.15;
  } else if (vH.z > 0.5) {
    shade = 1.7;
  } else {
    float a = fract(vH.x) * r;
    float y = vH.y * h;
    vec2 px = vec2(fwidth(a), fwidth(y)) + 1e-4;
    float corner = 1.0 - smoothstep(0.01, 0.01 + px.x * 1.5, min(a, r - a));
    line = corner * 0.25 + accent * (1.0 - smoothstep(0.012, 0.012 + px.y * 1.5, abs(h - uBevel - 0.12 - y)));
    shade = 0.7 + 0.35 * smoothstep(0.0, h, y);
  }
  vec3 c = vTint * shade;
  c += uAlbedo * 6.0 * vTint * keyLight(vWorld, n);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  c += uSeam * uSheen * pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
  float k = uAlarm * alarmWave(vWorld);
  c += mix(uSeam * (1.0 - uAlarm * 0.35), uAlarmColor, k) * line * uSeamGlow * (0.3 + 0.9 * accent);
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
      let dcov = DIST_MAX
      for (let r = r0 - reach; r <= r0 + reach; r++) {
        for (let c = c0 - reach; c <= c0 + reach; c++) {
          if (!solid(c, r)) continue
          const inset = g.kind[r * g.cols + c] === CellKind.Cover ? Y.coverInset : 0
          const d = boxDist(x, z, c * g.cell + inset, r * g.cell + inset, (c + 1) * g.cell - inset, (r + 1) * g.cell - inset)
          dw = Math.min(dw, d)
          if (g.kind[r * g.cols + c] === CellKind.Cover) dcov = Math.min(dcov, d)
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
      data[o + 2] = Math.round((Math.min(dcov, db) / DIST_MAX) * 255) // the foot of the cover (low cover and blocks)
      data[o + 3] = 255
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType)
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

/** A hexagonal prism of radius 1 and height 1 standing on y = 0 (corners along x), with the aH attribute (see HEX_VERT). */
function hexPrism(): BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const att: number[] = []
  const corner = (k: number): [number, number] => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]
  const R = Math.SQRT1_2
  for (let k = 0; k < 6; k++) {
    const [ax, az] = corner(k)
    const [bx, bz] = corner(k + 1)
    const nx = (ax + bx) / 2
    const nz = (az + bz) / 2
    const nl = Math.hypot(nx, nz)
    const ux = nx / nl
    const uz = nz / nl
    // the side: from the base to the bevel's foot (y = 1 - bevel, moved in the vertex shader)
    const quad: [number, number, number, number, number][] = [
      [ax, 0, az, k, 0],
      [bx, 0, bz, k + 0.999, 0],
      [bx, 1, bz, k + 0.999, 1],
      [ax, 1, az, k, 1],
    ]
    for (const idx of [0, 2, 1, 0, 3, 2]) {
      const q = quad[idx] as [number, number, number, number, number]
      pos.push(q[0], q[1], q[2])
      nor.push(ux, 0, uz)
      att.push(q[3], q[4], 0)
    }
    // the bevel: from the rim to the cap's inner ring
    const bev: [number, number, number, number, number][] = [
      [ax, 1, az, k, 1],
      [bx, 1, bz, k + 0.999, 1],
      [bx, 1, bz, k + 0.999, 2],
      [ax, 1, az, k, 2],
    ]
    for (const idx of [0, 2, 1, 0, 3, 2]) {
      const q = bev[idx] as [number, number, number, number, number]
      pos.push(q[0], q[1], q[2])
      nor.push(ux * R, R, uz * R)
      att.push(q[3], q[4], 1)
    }
    // the cap: a fan from the centre
    pos.push(0, 1, 0, bx, 1, bz, ax, 1, az)
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0)
    att.push(0, 2, 2, 1, 2, 2, 1, 2, 2)
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
  rails: GeoBuilder
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

export function buildCity(g: Grid, mats: Materials, sight: Sight, mirror: Mirror, _s: GameState, exposure?: Exposure): City {
  const root = new Group()
  const chunks = new Map<number, Chunk>()
  const ccols = Math.ceil(g.cols / CHUNK)
  const chunkAt = (x: number, z: number): Chunk => {
    const cx = Math.max(0, Math.min(ccols - 1, Math.floor(x / g.cell / CHUNK)))
    const cz = Math.max(0, Math.floor(z / g.cell / CHUNK))
    const k = cz * ccols + cx
    let ch = chunks.get(k)
    if (!ch) {
      ch = { solid: new GeoBuilder(), floor: new GeoBuilder(), seams: new GeoBuilder(), ribs: new GeoBuilder(), rails: new GeoBuilder() }
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

  // ---- narrow void slits between walkable cells: drawn as a recessed lit channel grating (still void for the game)
  const gridVoid = (c: number, r: number): boolean => inside(c, r) && isVoid(c, r)
  /** The width (cells) of the void run through (c, r) along one axis, Infinity if it reaches the edge of the plan. */
  const runWidth = (c: number, r: number, dc: number, dr: number): number => {
    let w = 1
    for (const s of [1, -1]) {
      let k = 1
      while (gridVoid(c + dc * s * k, r + dr * s * k) && k <= 6) k++
      if (k > 6 || !inside(c + dc * s * k, r + dr * s * k)) return Infinity
      w += k - 1
    }
    return w
  }
  const slitAlongX = new Map<number, boolean>() // cell -> the slit runs along x (narrow in z)
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!isVoid(c, r) || !inside(c, r)) continue
      const wx = runWidth(c, r, 1, 0)
      const wz = runWidth(c, r, 0, 1)
      if (Math.min(wx, wz) <= Y.slitMax) slitAlongX.set(r * g.cols + c, wz <= wx)
    }
  }
  const slitY = new Map<number, number>()
  {
    const seen = new Set<number>()
    for (const start of slitAlongX.keys()) {
      if (seen.has(start)) continue
      const comp: number[] = []
      const stack = [start]
      seen.add(start)
      let low = Infinity
      while (stack.length > 0) {
        const i = stack.pop() as number
        comp.push(i)
        const c = i % g.cols
        const r = Math.floor(i / g.cols)
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const j = (r + dr) * g.cols + c + dc
          if (!inside(c + dc, r + dr)) continue
          if (slitAlongX.has(j)) {
            if (!seen.has(j)) {
              seen.add(j)
              stack.push(j)
            }
          } else if (hasFloor(c + dc, r + dr)) low = Math.min(low, cornerH(j, false, false), cornerH(j, true, true))
        }
      }
      if (Number.isFinite(low)) for (const i of comp) slitY.set(i, low - Y.slitDepth)
    }
  }
  /** What is at the bottom of the void next to a cell: the grating of a slit, else the far floor. */
  const voidFloor = (c: number, r: number): number => slitY.get(r * g.cols + c) ?? g.bottom

  // a vertical quad on the lattice edge (x0, z0)-(x1, z1) from y0 to y1, facing (nx, nz); e = the shader's (top, tone, foot, code)
  const wallQuad = (b: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y0a: number, y0b: number, y1a: number, y1b: number, nx: number, nz: number, top: number, tone: number, foot: number): void => {
    const v0 = b.vertex(x0, y0a, z0, nx, 0, nz, top, tone, foot, 0.8)
    const v1 = b.vertex(x1, y0b, z1, nx, 0, nz, top, tone, foot, 0.8)
    const v2 = b.vertex(x1, y1b, z1, nx, 0, nz, top, tone, foot, 1)
    const v3 = b.vertex(x0, y1a, z0, nx, 0, nz, top, tone, foot, 1)
    b.triFacing(v0, v1, v2)
    b.triFacing(v0, v2, v3)
  }

  // ---- islands: connected slab cells of one height (and kind) share a tone, a seed, a crown and the hex dressing
  const island = new Int32Array(g.cols * g.rows).fill(-1)
  const islands: { tone: number; seed: number; cells: number[]; hex: boolean; top: number; crown: number }[] = []
  for (let i0 = 0; i0 < island.length; i0++) {
    const c0 = i0 % g.cols
    const r0 = Math.floor(i0 / g.cols)
    if (island[i0] !== -1 || kind(c0, r0) !== CellKind.Wall) continue
    const id = islands.length
    const top = g.top[i0] as number
    const hexed = g.hex[i0] === 1
    const cells: number[] = []
    const stack = [i0]
    island[i0] = id
    while (stack.length > 0) {
      const i = stack.pop() as number
      cells.push(i)
      const c = i % g.cols
      const r = Math.floor(i / g.cols)
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const j = (r + dr) * g.cols + c + dc
        if (!inside(c + dc, r + dr) || island[j] !== -1 || kind(c + dc, r + dr) !== CellKind.Wall) continue
        if (Math.abs((g.top[j] as number) - top) > 0.01 || (g.hex[j] === 1) !== hexed) continue
        island[j] = id
        stack.push(j)
      }
    }
    const tone = Math.floor(hash(c0 * 0.37 + 1.1, r0 * 0.53 + 2.3) * 3)
    const seed = hash(c0 * 1.7 + 5.5, r0 * 2.9 + 0.7)
    const crown = !hexed && top >= Y.crownMin && hash(c0 + 9.1, r0 * 1.3 + 4.4) < Y.crownShare ? 1 : 0
    islands.push({ tone, seed, cells, hex: hexed, top, crown })
  }

  // ---- blocks: bevelled slabs (a chamfer round every free top edge, a plinth where a floor meets them, a stepped
  // crown on some tall ones), low cover as clean bevelled blocks, hex clusters as real prisms
  const outline: Seg[] = []
  const corners: { x: number; z: number; top: number; low: number }[] = []
  const hexCols: { x: number; z: number; r: number; y: number; h: number; tint: number }[] = []
  const NR = Math.SQRT1_2
  const ADJ_A = [3, 2, 0, 1]
  const ADJ_B = [2, 3, 1, 0]
  /** One box: the top inset on its free sides, with a chamfer, the wall below it and an optional skirt. Sides: N, S, W, E. */
  const bevelBox = (ch: Chunk, x0: number, z0: number, x1: number, z1: number, t: number, ex: boolean[], lows: number[], feet: number[], skirts: boolean[], c: number, tone: number, line: boolean): void => {
    const b = ch.solid
    const ins = ex.map((e) => (e ? c : 0))
    const a = b.vertex(x0 + (ins[2] as number), t, z0 + (ins[0] as number), 0, 1, 0, t, tone, t, 1)
    const bb = b.vertex(x1 - (ins[3] as number), t, z0 + (ins[0] as number), 0, 1, 0, t, tone, t, 1)
    const cc = b.vertex(x0 + (ins[2] as number), t, z1 - (ins[1] as number), 0, 1, 0, t, tone, t, 1)
    const d = b.vertex(x1 - (ins[3] as number), t, z1 - (ins[1] as number), 0, 1, 0, t, tone, t, 1)
    b.triFacing(a, cc, bb)
    b.triFacing(bb, cc, d)
    const edges: [number, number, number, number, number, number][] = [
      [x1, z0, x0, z0, 0, -1],
      [x0, z1, x1, z1, 0, 1],
      [x0, z0, x0, z1, -1, 0],
      [x1, z1, x1, z0, 1, 0],
    ]
    for (let k = 0; k < 4; k++) {
      if (!ex[k]) continue
      const [ax, az, bx, bz, nx, nz] = edges[k] as [number, number, number, number, number, number]
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 1e-3) continue
      const ux = (bx - ax) / len
      const uz = (bz - az) / len
      const ia = ex[ADJ_A[k] as number] ? c : 0
      const ib = ex[ADJ_B[k] as number] ? c : 0
      const low = lows[k] as number
      const foot = feet[k] as number
      const sk = skirts[k] ? Y.skirt[0] ?? 0 : 0
      const out = Y.skirt[1] ?? 0
      if (t - c > low + sk) wallQuad(b, ax, az, bx, bz, low + sk, low + sk, t - c, t - c, nx, nz, t, tone, foot)
      // the chamfer
      const aix = ax - nx * c + ux * ia
      const aiz = az - nz * c + uz * ia
      const bix = bx - nx * c - ux * ib
      const biz = bz - nz * c - uz * ib
      const q0 = b.vertex(ax, t - c, az, nx * NR, NR, nz * NR, t, tone, t, 2)
      const q1 = b.vertex(bx, t - c, bz, nx * NR, NR, nz * NR, t, tone, t, 2)
      const q2 = b.vertex(bix, t, biz, nx * NR, NR, nz * NR, t, tone, t, 3)
      const q3 = b.vertex(aix, t, aiz, nx * NR, NR, nz * NR, t, tone, t, 3)
      b.triFacing(q0, q1, q2)
      b.triFacing(q0, q2, q3)
      // close the chamfer's open ends where the neighbour side is not free (a notch would show)
      if (ia === 0) {
        const f0 = b.vertex(ax, t - c, az, ux, 0, uz, t, tone, t, 2)
        const f1 = b.vertex(ax, t, az, ux, 0, uz, t, tone, t, 3)
        const f2 = b.vertex(aix, t, aiz, ux, 0, uz, t, tone, t, 3)
        b.triFacing(f0, f1, f2)
      }
      if (ib === 0) {
        const f0 = b.vertex(bx, t - c, bz, -ux, 0, -uz, t, tone, t, 2)
        const f1 = b.vertex(bx, t, bz, -ux, 0, -uz, t, tone, t, 3)
        const f2 = b.vertex(bix, t, biz, -ux, 0, -uz, t, tone, t, 3)
        b.triFacing(f0, f1, f2)
      }
      if (sk > 0) {
        const sl = Math.hypot(sk, out)
        const s0 = b.vertex(ax, low + sk, az, (nx * sk) / sl, out / sl, (nz * sk) / sl, t, tone, low, 5)
        const s1 = b.vertex(bx, low + sk, bz, (nx * sk) / sl, out / sl, (nz * sk) / sl, t, tone, low, 5)
        const s2 = b.vertex(bx + nx * out, low, bz + nz * out, (nx * sk) / sl, out / sl, (nz * sk) / sl, t, tone, low, 4)
        const s3 = b.vertex(ax + nx * out, low, az + nz * out, (nx * sk) / sl, out / sl, (nz * sk) / sl, t, tone, low, 4)
        b.triFacing(s0, s1, s2)
        b.triFacing(s0, s2, s3)
      }
      if (line) outline.push({ ax: aix, az: aiz, bx: bix, bz: biz, y: t + 0.006 })
    }
  }

  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!isSolid(c, r)) continue
      const i = r * g.cols + c
      const cover = g.kind[i] === CellKind.Cover
      const t = g.top[i] as number
      const foot = g.h0[i] as number
      const nb: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      if (cover) {
        const e = Y.coverInset
        const x0 = c * g.cell + e
        const x1 = (c + 1) * g.cell - e
        const z0 = r * g.cell + e
        const z1 = (r + 1) * g.cell - e
        const ch = chunkAt(x0 + 0.1, z0 + 0.1)
        const seed = hash(c * 1.9 + 0.3, r * 2.3 + 1.1) * 0.9
        const cols = hash(c + 3.3, r * 0.7 + 8.1) < Y.coverHexShare
          ? hexLattice(Y.coverHexRadius, Y.hexGap, x0, x1, z0, z1, (x, z) => x > x0 + 0.1 && x < x1 - 0.1 && z > z0 + 0.1 && z < z1 - 0.1)
          : []
        const all = [true, true, true, true]
        if (cols.length > 0) {
          // a low plate with a cluster of hex columns standing on it
          const plate = foot + Y.coverPlate
          bevelBox(ch, x0, z0, x1, z1, plate, all, [foot, foot, foot, foot], [foot, foot, foot, foot], [false, false, false, false], Y.coverChamfer * 0.6, 3 + seed, false)
          let best = 0
          cols.forEach((h, k) => {
            if (Math.hypot(h.x - (x0 + x1) / 2, h.z - (z0 + z1) / 2) < Math.hypot((cols[best] as HexCol).x - (x0 + x1) / 2, (cols[best] as HexCol).z - (z0 + z1) / 2)) best = k
          })
          cols.forEach((h, k) => {
            const pick = k === best ? 1 : ([0.45, 0.7, 0.85, 1][Math.floor(hash(h.x * 3.1, h.z * 1.7) * 4)] as number)
            hexCols.push({ x: h.x, z: h.z, r: h.r, y: plate - 0.05, h: (t - plate) * pick + 0.05, tint: Math.floor(hash(h.x, h.z) * 3) })
          })
        } else {
          bevelBox(ch, x0, z0, x1, z1, t, all, [foot, foot, foot, foot], [foot, foot, foot, foot], [false, false, false, false], Y.coverChamfer, 3 + seed, false)
        }
        continue
      }
      const isl = islands[island[i] as number] as (typeof islands)[number]
      const tone = isl.tone + isl.seed * 0.9
      const x0 = c * g.cell
      const x1 = x0 + g.cell
      const z0 = r * g.cell
      const z1 = z0 + g.cell
      const ch = chunkAt(x0 + 0.1, z0 + 0.1)
      const tb = isl.hex ? t - Math.min(Y.hexRise, 0.45 * (t - foot)) : t
      const lows: number[] = []
      const feet: number[] = []
      const ex: boolean[] = []
      const skirts: boolean[] = []
      for (const [dc, dr] of nb) {
        const nTop = isSolid(c + dc, r + dr) ? topOf(c + dc, r + dr) : isVoid(c + dc, r + dr) ? voidFloor(c + dc, r + dr) : footBeside(g, (r + dr) * g.cols + c + dc)
        lows.push(nTop)
        ex.push(nTop < tb - 0.01)
        feet.push(nTop)
        skirts.push(hasFloor(c + dc, r + dr) && kind(c + dc, r + dr) !== CellKind.Ramp)
      }
      bevelBox(ch, x0, z0, x1, z1, tb, ex, lows, feet, skirts, Y.chamfer, tone, true)
      if (isl.crown > 0) {
        // a setback crown: a smaller step on top, flush where the slab goes on
        const ci = Y.crownInset
        const ch2 = Y.crownHeight as number[]
        const hh = (ch2[0] as number) + hash(c * 0.7 + isl.seed * 9, r * 1.1) * ((ch2[1] as number) - (ch2[0] as number))
        const sx0 = x0 + (ex[2] ? ci : 0)
        const sx1 = x1 - (ex[3] ? ci : 0)
        const sz0 = z0 + (ex[0] ? ci : 0)
        const sz1 = z1 - (ex[1] ? ci : 0)
        bevelBox(ch, sx0, sz0, sx1, sz1, t + hh, ex, [t, t, t, t], [t, t, t, t], [false, false, false, false], Y.chamfer * 0.7, tone, true)
      }
      // tall outer corners get a vertical light line (some of them: NF6 picks the edges that read)
      const cp: [number, number, number, number][] = [
        [0, 2, x0, z0],
        [0, 3, x1, z0],
        [1, 2, x0, z1],
        [1, 3, x1, z1],
      ]
      for (const [p, q, x, z] of cp) {
        if (!ex[p] || !ex[q]) continue
        const lo = Math.max(lows[p] as number, lows[q] as number)
        if (tb - lo >= Y.cornerMinDrop && hash(x, z) < Y.cornerShare) corners.push({ x, z, top: tb, low: Math.max(lo, tb - Y.cornerMaxLen) })
      }
    }
  }
  // the hex clusters on hex islands: a honeycomb of prisms of varied heights rising out of the terraced base
  for (const isl of islands) {
    if (!isl.hex) continue
    const first = isl.cells[0] as number
    const foot = g.h0[first] as number
    const tb = isl.top - Math.min(Y.hexRise, 0.45 * (isl.top - foot))
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const i of isl.cells) {
      minX = Math.min(minX, (i % g.cols) * g.cell)
      maxX = Math.max(maxX, ((i % g.cols) + 1) * g.cell)
      minZ = Math.min(minZ, Math.floor(i / g.cols) * g.cell)
      maxZ = Math.max(maxZ, (Math.floor(i / g.cols) + 1) * g.cell)
    }
    const cols = hexLattice(Y.hexRadius, Y.hexGap, minX, maxX, minZ, maxZ, (x, z) => {
      const cc = Math.floor(x / g.cell)
      const rr = Math.floor(z / g.cell)
      return inside(cc, rr) && island[rr * g.cols + cc] === (island[first] as number)
    })
    cols.forEach((h) => {
      const pick = ([0.3, 0.55, 0.8, 1, 1][Math.floor(hash(h.x * 2.3, h.z * 1.9) * 5)] as number)
      const hh = Math.max(0.3, Math.round(((isl.top - tb) * pick) / 0.25) * 0.25)
      hexCols.push({ x: h.x, z: h.z, r: h.r, y: tb - 0.05, h: hh + 0.05, tint: Math.floor(hash(h.x, h.z + 4) * 3) })
    })
  }
  for (const { pts, closed } of chain(outline)) {
    const ch = chunkAt((pts[0] as P3).x, (pts[0] as P3).z)
    tube(ch.seams, softCorners(pts, closed, 0.06), Y.edgeRadius, closed, 4)
  }
  for (const k of corners) tube(chunkAt(k.x, k.z).ribs, [{ x: k.x, y: k.top, z: k.z }, { x: k.x, y: k.low, z: k.z }], Y.edgeRadius * 0.8, false, 4)

  // ---- floors, ramps, steps between floors, platform sides over the void (a curb, a lit lip and a low rail), bridges
  const lips: P3[][] = []
  const curbEdges: Seg[] = []
  const plainEdges: Seg[] = []
  const glow = new GeoBuilder()
  const [curbW, curbH] = Y.curb as [number, number]
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
      const tone = Math.floor(hash(Math.floor(c / 4) + 0.5, Math.floor(r / 4) + 0.5) * 3) + 0.4
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
        const slit = slitY.has((r + dr) * g.cols + c + dc)
        const y0 = bridge ? Math.min(ya, yb) - bridgeDeck : voidFloor(c + dc, r + dr)
        const curb = !bridge && !slit
        const lift = curb ? curbH : 0
        wallQuad(ch.solid, ax, az, bx, bz, y0, y0, ya + lift, yb + lift, nx, nz, Math.max(ya, yb) + lift, tone, y0)
        if (curb) {
          // the curb: a low raised lip along the edge, its inner face and top lit by the seam line
          const ix = -nx * curbW
          const iz = -nz * curbW
          const t0 = ch.solid.vertex(ax, ya + curbH, az, 0, 1, 0, ya + curbH, tone, ya, 1)
          const t1 = ch.solid.vertex(bx, yb + curbH, bz, 0, 1, 0, yb + curbH, tone, yb, 1)
          const t2 = ch.solid.vertex(bx + ix, yb + curbH, bz + iz, 0, 1, 0, yb + curbH, tone, yb, 1)
          const t3 = ch.solid.vertex(ax + ix, ya + curbH, az + iz, 0, 1, 0, ya + curbH, tone, ya, 1)
          ch.solid.triFacing(t0, t1, t2)
          ch.solid.triFacing(t0, t2, t3)
          const n0 = ch.solid.vertex(ax + ix, ya + curbH, az + iz, -nx, 0, -nz, ya + curbH, tone, ya, 1)
          const n1 = ch.solid.vertex(bx + ix, yb + curbH, bz + iz, -nx, 0, -nz, yb + curbH, tone, yb, 1)
          const n2 = ch.solid.vertex(bx + ix, yb, bz + iz, -nx, 0, -nz, yb + curbH, tone, yb, 0.9)
          const n3 = ch.solid.vertex(ax + ix, ya, az + iz, -nx, 0, -nz, ya + curbH, tone, ya, 0.9)
          ch.solid.triFacing(n0, n1, n2)
          ch.solid.triFacing(n0, n2, n3)
          curbEdges.push({ ax, az, bx, bz, y: (ya + yb) / 2 + curbH + 0.006 })
        } else {
          plainEdges.push({ ax, az, bx, bz, y: (ya + yb) / 2 + 0.01 })
        }
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
          wallQuad(ch.solid, x1, z0, x1, z1, Math.min(myN, thN), Math.min(myS, thS), Math.max(myN, thN), Math.max(myS, thS), facing, 0, Math.max(myN, thN), tone, Math.min(myN, thN))
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
          wallQuad(ch.solid, x0, z1, x1, z1, Math.min(myW, thW), Math.min(myE, thE), Math.max(myW, thW), Math.max(myE, thE), 0, facing, Math.max(myW, thW), tone, Math.min(myW, thW))
          lips.push([
            { x: x0, y: Math.max(myW, thW), z: z1 - facing * 0.02 },
            { x: x1, y: Math.max(myE, thE), z: z1 - facing * 0.02 },
          ])
        }
      }
    }
  }
  for (const lip of lips) tube(chunkAt((lip[0] as P3).x, (lip[0] as P3).z).seams, lip, Y.edgeRadius * 0.9, false, 4)
  // the platform edges over the void: continuous light lines (brighter on the bridges), a low glowing rail along the curbs
  for (const { pts, closed } of chain(plainEdges)) tube(chunkAt((pts[0] as P3).x, (pts[0] as P3).z).seams, softCorners(pts, closed, 0.06), Y.edgeRadius, closed, 4)
  for (const { pts, closed } of chain(curbEdges)) {
    const ch = chunkAt((pts[0] as P3).x, (pts[0] as P3).z)
    tube(ch.seams, softCorners(offsetLine(pts, closed, curbW / 2), closed, 0.06), Y.edgeRadius, closed, 4)
    const rail = offsetLine(pts, closed, Y.railInset).map((p) => ({ x: p.x, y: p.y - 0.006 + Y.railHeight, z: p.z }))
    tube(ch.rails, softCorners(rail, closed, 0.12), Y.railRadius, closed, 4)
    // posts along it
    const n = rail.length
    let walked = 0
    let nextPost = Y.railPostEvery / 2
    for (let k = 0; k < (closed ? n : n - 1); k++) {
      const p = rail[k] as P3
      const q = rail[(k + 1) % n] as P3
      const len = Math.hypot(q.x - p.x, q.z - p.z)
      while (len > 1e-4 && nextPost <= walked + len) {
        const s = (nextPost - walked) / len
        const px = p.x + (q.x - p.x) * s
        const pz = p.z + (q.z - p.z) * s
        const py = p.y + (q.y - p.y) * s
        tube(ch.rails, [{ x: px, y: py - Y.railHeight, z: pz }, { x: px, y: py, z: pz }], Y.railRadius * 1.3, false, 4)
        nextPost += Y.railPostEvery
      }
      walked += len
    }
  }
  // the slits: a recessed grating with a lit duct down its middle and thin bars across
  const [gr, gg, gb] = [palette.seamDim.r * Y.slitGlow, palette.seamDim.g * Y.slitGlow, palette.seamDim.b * Y.slitGlow]
  for (const [i, alongX] of slitAlongX) {
    const y = slitY.get(i)
    if (y === undefined) continue
    const c = i % g.cols
    const r = Math.floor(i / g.cols)
    const x0 = c * g.cell
    const z0 = r * g.cell
    const quad = (xa: number, za: number, xb: number, zb: number, yy: number, cr: number, cg: number, cb: number): void => {
      glow.quad(
        glow.vertex(xa, yy, za, 0, 1, 0, cr, cg, cb),
        glow.vertex(xa, yy, zb, 0, 1, 0, cr, cg, cb),
        glow.vertex(xb, yy, zb, 0, 1, 0, cr, cg, cb),
        glow.vertex(xb, yy, za, 0, 1, 0, cr, cg, cb),
      )
    }
    quad(x0, z0, x0 + g.cell, z0 + g.cell, y, 0.004, 0.01, 0.014)
    const bars = Math.round(g.cell / Y.slitBarEvery)
    for (let k = 0; k < bars; k++) {
      const o = (k + 0.5) * Y.slitBarEvery
      if (alongX) quad(x0 + o - 0.025, z0, x0 + o + 0.025, z0 + g.cell, y + 0.004, gr * 0.5, gg * 0.5, gb * 0.5)
      else quad(x0, z0 + o - 0.025, x0 + g.cell, z0 + o + 0.025, y + 0.004, gr * 0.5, gg * 0.5, gb * 0.5)
    }
    // the duct: a brighter strip along the slit
    if (alongX) quad(x0, z0 + g.cell / 2 - 0.07, x0 + g.cell, z0 + g.cell / 2 + 0.07, y + 0.008, gr, gg, gb)
    else quad(x0 + g.cell / 2 - 0.07, z0, x0 + g.cell / 2 + 0.07, z0 + g.cell, y + 0.008, gr, gg, gb)
  }

  // ---- the light guides on the floors: the street to the goal through the checkpoints, and a spur to every terminal
  const guides = buildGuides(g)
  const paths: P3[][] = [...guides.main, ...guides.spurs]
  const guideGeo = new Map<Chunk, { main: GeoBuilder; spur: GeoBuilder }>()
  const guideAt = (x: number, z: number): { main: GeoBuilder; spur: GeoBuilder } => {
    const ch = chunkAt(x, z)
    let b = guideGeo.get(ch)
    if (!b) {
      b = { main: new GeoBuilder(), spur: new GeoBuilder() }
      guideGeo.set(ch, b)
    }
    return b
  }
  const lay = (route: P3[], main: boolean): void => {
    const pts = softCorners(route, false, Y.routeCorner)
    // pieces of at most routeSplit metres, each in the chunk it starts in (so far stretches are culled)
    let piece: P3[] = []
    let len = 0
    let nextChevron = Y.routeChevronEvery / 2
    let walked = 0
    const flush = (): void => {
      if (piece.length >= 2) {
        const p0 = piece[0] as P3
        tube(main ? guideAt(p0.x, p0.z).main : guideAt(p0.x, p0.z).spur, piece, Y.routeRadius, false, 4)
      }
    }
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k] as P3
      if (k > 0) {
        const q = pts[k - 1] as P3
        const l = Math.hypot(p.x - q.x, p.z - q.z)
        len += l
        // chevrons along the main street, pointing the way
        if (main && l > 1e-4) {
          const dx = (p.x - q.x) / l
          const dz = (p.z - q.z) / l
          while (nextChevron <= walked + l) {
            const s = nextChevron - walked
            const cx = q.x + dx * s
            const cz = q.z + dz * s
            const cy = q.y + ((p.y - q.y) * s) / l
            const w = 0.24
            const back = 0.2
            tube(guideAt(cx, cz).main, [
              { x: cx - dx * back - dz * w, y: cy, z: cz - dz * back + dx * w },
              { x: cx + dx * 0.1, y: cy, z: cz + dz * 0.1 },
              { x: cx - dx * back + dz * w, y: cy, z: cz - dz * back - dx * w },
            ], Y.routeRadius * 0.9, false, 4)
            nextChevron += Y.routeChevronEvery
          }
        }
        walked += l
      }
      piece.push(p)
      if (len >= Y.routeSplit && k < pts.length - 1) {
        flush()
        piece = [p]
        len = 0
      }
    }
    flush()
  }
  for (const route of guides.main) lay(route, true)
  for (const route of guides.spurs) lay(route, false)

  // ---- roofs: slabs overhead, lit along their open edges, a light strip down the middle underneath
  for (const roof of g.roofs) {
    const ch = chunkAt(roof.minX + 0.1, roof.minZ + 0.1)
    const b = ch.solid
    const y0 = roof.y
    const y1 = roof.y + Y.roofThickness
    const quad = (pts: [number, number, number][], nx: number, ny: number, nz: number): void => {
      const ids = pts.map(([x, y, z]) => b.vertex(x, y, z, nx, ny, nz, y1, 0.2, y0, 1))
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
  const railMat = lineMat(Y.railIntensity, Y.railRadius)
  const blockLineMat = lineMat(L.ribIntensity, L.ribRadius * 0.8)
  const pathMat = lineMat(Y.routeIntensity, Y.routeRadius)
  const spurMat = lineMat(Y.spurIntensity, Y.routeRadius)
  ;(pathMat.uniforms['uColor'] as { value: Color }).value.copy(palette.seamDim).multiplyScalar(Y.routeIntensity)
  ;(spurMat.uniforms['uColor'] as { value: Color }).value.copy(palette.seamDim).multiplyScalar(Y.spurIntensity)
  const solidMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTone: { value: (Y.slabTones as string[]).map((h) => new Color(h)) },
        uSeam: { value: palette.seam.clone() },
        uWarm: { value: new Color(Y.warmColor[0] ?? 1, Y.warmColor[1] ?? 1, Y.warmColor[2] ?? 1) },
        uSheen: { value: Y.slabSheen },
        uAlbedo: { value: L.wallAlbedo },
        uVoidFade: { value: Y.voidFade },
        uBay: { value: new Vector2(Y.bay[0], Y.bay[1]) },
        uTier: { value: Y.tier },
        uWin: { value: new Vector4(Y.windowGlow, Y.windowShare, Y.seamShare, Y.windowWarm) },
        uSeamGlow: { value: Y.seamGlow },
        uCover: { value: new Vector4(g.cell, Y.coverInset + Y.coverChamfer + Y.coverSeam, Y.coverGlow, Y.coverTop) },
        uSkirt: { value: new Vector2(Y.skirt[0], Y.skirt[1]) },
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
        uExposure: { value: null },
        uExpSize: { value: new Vector2(1, 1) },
        uLane: { value: new Vector4(0, g.cell, SL.litGrid, SL.darkDim) },
        uLaneRange: { value: new Vector4(SL.litFrom, SL.litTo, SL.litFill, SL.footLineWidth) },
        uLaneMore: { value: new Vector2(SL.litLift, SL.footGlow) },
        uLaneColor: { value: new Vector3(SL.litColor[0], SL.litColor[1], SL.litColor[2]) },
        uFootColor: { value: palette.seamDim.clone().multiplyScalar(SL.footlight) },
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
      { uSeam: { value: palette.seam.clone() }, uAlbedo: { value: L.wallAlbedo }, uSheen: { value: Y.slabSheen }, uBevel: { value: Y.hexBevel }, uAccent: { value: Y.hexAccent }, uSeamGlow: { value: Y.hexSeam } },
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
  if (exposure && lanesEnabled) {
    share(floorMat, 'uExposure', exposure.texture)
    ;(floorMat.uniforms['uExpSize']?.value as Vector2).set(exposure.width, exposure.depth)
    ;(floorMat.uniforms['uLane']?.value as Vector4).x = 1
  }
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
    if (!ch.rails.empty) root.add(new Mesh(ch.rails.build(null), railMat))
  }
  for (const b of guideGeo.values()) {
    for (const [geo, mat] of [[b.main, pathMat], [b.spur, spurMat]] as const) {
      if (geo.empty) continue
      const m = new Mesh(geo.build(null), mat)
      m.userData['noReflect'] = true
      root.add(m)
    }
  }
  if (!blockLines.empty) root.add(new Mesh(blockLines.build(null), blockLineMat))
  if (!detail.empty) {
    const detailMat = new MeshStandardMaterial({ color: L.detailColor, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.0, vertexColors: true })
    addRim(detailMat)
    root.add(new Mesh(detail.build('color'), detailMat))
  }
  if (!glow.empty) {
    const glowMesh = new Mesh(glow.build('color'), new MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: DoubleSide }))
    glowMesh.userData['noReflect'] = true
    root.add(glowMesh)
  }
  // the hex prisms (the clusters on hex islands and low cover, and the level's hex modules): one instanced draw
  const hexTones = (Y.hexTones as string[]).map((h) => new Color(h))
  const modules: { x: number; z: number; r: number; y: number; h: number; tint: number }[] = hexCols.slice()
  for (const b of hexes) modules.push({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, r: (b.maxX - b.minX) / 2, y: b.minY, h: b.maxY - b.minY, tint: Math.floor(hash(b.minX, b.minZ) * 3) })
  if (modules.length > 0) {
    const inst = new InstancedMesh(hexPrism(), hexMat, modules.length)
    const m = new Matrix4()
    const tint = new Color()
    modules.forEach((h, k) => {
      m.makeScale(h.r, h.h, h.r).setPosition(h.x, h.y, h.z)
      inst.setMatrixAt(k, m)
      tint.copy(hexTones[h.tint % hexTones.length] as Color).multiplyScalar(0.85 + 0.3 * hash(h.x * 1.3, h.z * 0.9))
      inst.setColorAt(k, tint)
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
  const alarmMaterials = [seamMat, ribMat, railMat, blockLineMat, pathMat, spurMat, solidMat, floorMat, hexMat]
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
