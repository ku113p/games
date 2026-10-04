// What lies beyond the platforms (DESIGN 6, NF6): the deep dark sky with faint distant lights, rivers of flowing data
// light far below in the void (under the level's void cells along their channels, and between the far districts),
// the far districts themselves - monolithic blocks outlined by thin light lines, ledges and light bridges at several
// heights - and the landmark: the glowing core tower with its beam, visible from anywhere. All of it lives in its own
// long haze (the scene fog is for the near city), stays out of the floor mirror, and costs a handful of draw calls:
// the districts and the tower are one instanced mesh. Cold path except update() (moves the sky with the camera).
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  NearestFilter,
  Matrix4,
  Mesh,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Camera,
} from 'three'
import cfgAll from '../config.json'
import { CellKind, type Grid } from '../core/grid'
import type { Landmark } from '../core/queries'
import { hdr, palette } from './look'

const S = cfgAll.view.skyline

const HASH_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vDir = w.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uStar;
uniform vec3 uCityGlow;
uniform float uTime;
varying vec3 vDir;
${HASH_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uHorizon, uZenith, smoothstep(-0.02, 0.5, h));
  c = mix(c, uBelow, smoothstep(0.0, -0.25, h));
  // the glow of the far districts low over the horizon
  c += uCityGlow * exp(-abs(h - 0.01) * 18.0);
  // faint distant lights: sparse points, a few of them twinkling
  vec2 sp = vec2(atan(d.z, d.x), asin(clamp(h, -1.0, 1.0))) * vec2(160.0, 160.0);
  vec2 cell = floor(sp);
  float r = hash12(cell);
  if (r > 0.986 && h > 0.04) {
    vec2 o = vec2(hash12(cell + 3.1), hash12(cell + 7.7)) * 0.6 + 0.2;
    float dd = length(fract(sp) - o);
    float tw = 0.7 + 0.3 * sin(uTime * (0.5 + r * 3.0) + r * 60.0);
    c += uStar * (1.0 - smoothstep(0.0, 0.16, dd)) * (r - 0.986) / 0.014 * tw * smoothstep(0.04, 0.2, h);
  }
  gl_FragColor = vec4(c, 1.0);
}`

const RIVER_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

/** The void's floor far below: black, with data rivers flowing along the channels. */
const RIVER_FRAG = /* glsl */ `
uniform sampler2D uFlow;
uniform vec2 uPlan;
uniform float uLot;
uniform float uTime;
uniform vec3 uRiver;
uniform vec3 uHead;
uniform vec3 uHaze;
uniform float uHazeDensity;
uniform float uSpeed;
varying vec3 vWorld;
${HASH_GLSL}
// light streaks flowing along a channel: a = along it, b = across it (metres)
float streaks(float a, float b, float t) {
  float lane = floor(b / 0.45);
  float h = hash12(vec2(lane, 3.1));
  float len = 5.0 + 12.0 * h;
  float x = fract((a + h * 50.0) / len - t * (0.6 + 1.4 * h) * uSpeed / len * 4.0);
  float pulse = smoothstep(0.0, 0.03, x) * (1.0 - smoothstep(0.03, 0.45, x));
  float across = 1.0 - smoothstep(0.02, 0.08, abs(fract(b / 0.45) - 0.5) * 0.45);
  return pulse * across * step(0.55, h);
}
void main() {
  vec2 p = vWorld.xz;
  float strength = 0.0;
  vec2 dir = vec2(1.0, 0.0);
  float across = 0.0;
  bool inPlan = p.x >= 0.0 && p.y >= 0.0 && p.x <= uPlan.x && p.y <= uPlan.y;
  vec4 f = inPlan ? texture2D(uFlow, p / uPlan) : vec4(1.0, 0.5, 0.0, 1.0);
  if (f.b > 0.5) {
    // a narrow channel of the level's void: a river all along it
    strength = 1.0;
    dir = normalize(f.rg * 2.0 - 1.0 + vec2(1e-4));
    across = dot(p, vec2(-dir.y, dir.x));
  } else if (f.a > 0.5) {
    // wide void and beyond the level: channels between the districts' lots, every fourth row and column of lots
    vec2 lot = floor(p / uLot);
    vec2 inLot = p - (lot + 0.5) * uLot;
    float rowRiver = step(mod(lot.y, 4.0), 0.5) * step(hash12(vec2(floor(lot.y / 4.0), 1.7)), 0.65);
    float colRiver = step(mod(lot.x, 4.0), 0.5) * step(hash12(vec2(floor(lot.x / 4.0), 5.3)), 0.65);
    float wr = rowRiver * (1.0 - smoothstep(uLot * 0.25, uLot * 0.45, abs(inLot.y)));
    float wc = colRiver * (1.0 - smoothstep(uLot * 0.25, uLot * 0.45, abs(inLot.x)));
    if (wr >= wc) {
      strength = wr;
      dir = vec2(1.0, 0.0);
      across = inLot.y + lot.y * 13.0;
    } else {
      strength = wc;
      dir = vec2(0.0, 1.0);
      across = inLot.x + lot.x * 13.0;
    }
  }
  float a = dot(p, dir);
  float s = strength > 0.01 ? streaks(a, across, uTime) : 0.0;
  vec3 c = uRiver * strength * (0.07 + 0.05 * sin(a * 0.15 - uTime * uSpeed * 0.4)) + mix(uRiver, uHead, s * s) * s * strength;
  float dist = length(vWorld - cameraPosition);
  float haze = 1.0 - exp(-dist * uHazeDensity);
  c = mix(c, uHaze, haze * 0.85);
  gl_FragColor = vec4(c, 1.0);
}`

/**
 * The far districts and the landmark: boxes (instanced) outlined by light lines in their own metres - the top rim,
 * some vertical corners, a few tier bands; aSeed picks which; aGlow brightens the landmark's lines.
 */
const FAR_VERT = /* glsl */ `
attribute float aSeed;
attribute float aGlow;
varying vec3 vLocal;
varying vec3 vSize;
varying vec3 vN;
varying vec3 vWorld;
varying float vSeed;
varying float vGlow;
void main() {
  vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLocal = position * vSize;
  vN = normal;
  vSeed = aSeed;
  vGlow = aGlow;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const FAR_FRAG = /* glsl */ `
uniform vec3 uBody;
uniform vec3 uLine;
uniform vec3 uHaze;
uniform float uHazeDensity;
uniform float uLineKeep;
uniform float uMinLine;
uniform float uMistLow;
uniform float uMistHeight;
varying vec3 vLocal;
varying vec3 vSize;
varying vec3 vN;
varying vec3 vWorld;
varying float vSeed;
varying float vGlow;
${HASH_GLSL}
float lineAt(float d, float px, float w) {
  float ww = max(w, px * 1.2);
  return (1.0 - smoothstep(ww, ww + px * 1.5, d)) * min(1.0, w / ww + 0.35);
}
void main() {
  vec3 n = normalize(vN);
  vec3 half_ = vSize * vec3(0.5, 1.0, 0.5);
  float line = 0.0;
  float w = uMinLine * (1.0 + vGlow);
  if (n.y > 0.5) {
    vec2 e = half_.xz - abs(vLocal.xz);
    vec2 px = fwidth(vLocal.xz);
    line = max(lineAt(e.x, px.x, w), lineAt(e.y, px.y, w));
  } else if (n.y > -0.5) {
    float u = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
    float hu = abs(n.x) > 0.5 ? half_.z : half_.x;
    float y = vLocal.y;
    vec2 px = vec2(fwidth(u), fwidth(y)) + 1e-4;
    line = lineAt(vSize.y - y, px.y, w);
    // some corners carry a vertical line all the way down, the landmark's every corner and a few more inside
    float corner = step(0.72, hash12(vec2(vSeed, sign(u) + n.x * 3.0 + n.z * 5.0)));
    line = max(line, lineAt(hu - abs(u), px.x, w) * max(corner, step(0.5, vGlow)));
    // the landmark: two more lines up every face and a glowing core slot down its middle
    if (vGlow > 0.5) {
      line = max(line, lineAt(abs(abs(u) - hu * 0.55), px.x, w) * 0.7);
      line = max(line, lineAt(abs(u), px.x, hu * 0.08) * 1.6);
    }
    // tier bands
    float bands = floor(hash12(vec2(vSeed, 9.1)) * 5.0);
    if (bands > 2.5 && vGlow < 0.5) {
      float step_ = vSize.y / bands;
      float k = abs(fract(y / step_) - 0.5) * step_;
      line = max(line, lineAt(step_ * 0.5 - k, px.y, w) * 0.6);
    }
  }
  // dark bodies, lit a little from the sky at the top
  vec3 body = uBody * (0.6 + 0.6 * smoothstep(0.0, vSize.y, vLocal.y)) * (n.y > 0.5 ? 1.3 : 1.0);
  float dist = length(vWorld - cameraPosition);
  // the long haze, thicker low down: the districts rise out of a mist over the rivers
  float haze = 1.0 - exp(-dist * uHazeDensity);
  haze = max(haze, (1.0 - smoothstep(uMistLow, uMistLow + uMistHeight, vWorld.y)) * smoothstep(40.0, 160.0, dist) * 0.85);
  vec3 lineC = uLine * (1.0 + vGlow) * line;
  vec3 c = mix(body, uHaze, haze) + lineC * (1.0 - haze * uLineKeep);
  gl_FragColor = vec4(c, 1.0);
}`

/** The landmark's beam of light up into the sky. */
const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  float core = pow(abs(dot(normalize(vN), vView)), 2.0);
  float up = (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.0, 0.03, vUv.y);
  float flow = 0.8 + 0.2 * sin(vUv.y * 90.0 - uTime * 6.0);
  gl_FragColor = vec4(uColor * core * up * flow, 1.0);
}`

export interface Skyline {
  root: Group
  /** Once a frame: the time (rivers, the beam, twinkling lights) and the camera (the sky dome stays around it). */
  update(time: number, camera: Camera): void
}

function hash(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return v - Math.floor(v)
}

/**
 * Per plan cell: a = 1 under the void; b = 1 where the void is a narrow channel (a river runs all along it), with rg =
 * the direction it flows (along the longer run of void). Wide void gets the far districts' channels instead.
 */
function flowTexture(g: Grid, narrow: number): DataTexture {
  const data = new Uint8Array(g.cols * g.rows * 4)
  const isVoid = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.kind[r * g.cols + c] === CellKind.Void
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const o = (r * g.cols + c) * 4
      data[o] = 255
      data[o + 1] = 128
      if (!isVoid(c, r)) continue
      data[o + 3] = 255
      let run = 0
      for (let k = c; isVoid(k, r); k--) run++
      for (let k = c + 1; isVoid(k, r); k++) run++
      let col = 0
      for (let k = r; isVoid(c, k); k--) col++
      for (let k = r + 1; isVoid(c, k); k++) col++
      const alongX = run >= col
      data[o] = alongX ? 255 : 128
      data[o + 1] = alongX ? 128 : 255
      data[o + 2] = Math.min(run, col) <= narrow ? 255 : 0
    }
  }
  const tex = new DataTexture(data, g.cols, g.rows, RGBAFormat, UnsignedByteType)
  tex.magFilter = NearestFilter
  tex.minFilter = NearestFilter
  tex.needsUpdate = true
  return tex
}

export function buildSkyline(g: Grid, marks: readonly Landmark[]): Skyline {
  const root = new Group()
  const planW = g.cols * g.cell
  const planD = g.rows * g.cell
  const cx = planW / 2
  const cz = planD / 2
  const haze = hdr(S.haze)
  const riverY = g.bottom + S.riverAbove

  // ---- the sky
  const skyMat = new ShaderMaterial({
    uniforms: {
      uZenith: { value: hdr(S.zenith) },
      uHorizon: { value: hdr(S.horizon) },
      uBelow: { value: hdr(S.below) },
      uStar: { value: hdr(S.star) },
      uCityGlow: { value: hdr(S.cityGlow) },
      uTime: { value: 0 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: BackSide,
    depthWrite: false,
  })
  const sky = new Mesh(new SphereGeometry(S.skyRadius, 32, 16), skyMat)
  // drawn after everything opaque, so only the pixels nothing covers pay for it (the river floor and the districts too)
  sky.renderOrder = 10
  sky.frustumCulled = false
  root.add(sky)

  // ---- the void's floor with its rivers
  const lot = S.lot
  const riverMat = new ShaderMaterial({
    uniforms: {
      uFlow: { value: flowTexture(g, S.narrowChannel) },
      uPlan: { value: new Vector2(planW, planD) },
      uLot: { value: lot },
      uTime: { value: 0 },
      uRiver: { value: palette.seamDim.clone().multiplyScalar(S.riverGlow) },
      uHead: { value: palette.seam.clone().multiplyScalar(S.riverHead) },
      uHaze: { value: haze },
      uHazeDensity: { value: S.hazeDensity },
      uSpeed: { value: S.riverSpeed },
    },
    vertexShader: RIVER_VERT,
    fragmentShader: RIVER_FRAG,
  })
  const river = new Mesh(new PlaneGeometry(S.farRadius * 2.2, S.farRadius * 2.2), riverMat)
  river.rotation.x = -Math.PI / 2
  river.position.set(cx, riverY, cz)
  river.renderOrder = 9
  root.add(river)

  // ---- the far districts: blocks on lots around the level (not on the river rows and columns), with ledges and
  // light bridges at several heights, and the landmark tower in its own plaza
  type Box = { x: number; y: number; z: number; w: number; h: number; d: number; glow: number }
  const boxes: Box[] = []
  const margin = S.clearance
  const nearPlan = (x: number, z: number, pad: number): boolean => x > -pad && z > -pad && x < planW + pad && z < planD + pad
  const riverRow = (k: number): boolean => ((k % 4) + 4) % 4 === 0 && hash(Math.floor(k / 4), 1.7) <= 0.65
  const riverCol = (k: number): boolean => ((k % 4) + 4) % 4 === 0 && hash(Math.floor(k / 4), 5.3) <= 0.65
  const base = riverY - 1
  const n = Math.ceil(S.farRadius / lot)
  const lc = Math.floor(cx / lot)
  const lr = Math.floor(cz / lot)
  for (let r = lr - n; r <= lr + n; r++) {
    for (let c = lc - n; c <= lc + n; c++) {
      const x = (c + 0.5) * lot
      const z = (r + 0.5) * lot
      const d = Math.hypot(x - cx, z - cz)
      if (d > S.farRadius || nearPlan(x, z, margin)) continue
      if (riverRow(r) || riverCol(c)) {
        // a light bridge over the river now and then
        if (hash(c, r) < S.bridgeShare && !(riverRow(r) && riverCol(c))) {
          const y = base + 12 + hash(r, c) * 30
          if (riverRow(r)) boxes.push({ x, y, z, w: 2.2, h: 0.7, d: lot * 1.05, glow: 0.6 })
          else boxes.push({ x, y, z, w: lot * 1.05, h: 0.7, d: 2.2, glow: 0.6 })
        }
        continue
      }
      if (marks.some((m) => Math.hypot(x - m.x, z - m.z) < m.radius * 4)) continue
      const roll = hash(c * 1.3, r * 0.7)
      if (roll < S.emptyShare) continue
      if (roll < S.emptyShare + S.platformShare) {
        // a wide low platform filling the lot, now and then with a small block on it
        const ph = riverY - base + 1 + hash(c + 3, r + 3) * 6
        boxes.push({ x, y: base, z, w: lot * 0.94, h: ph, d: lot * 0.94, glow: 0 })
        if (hash(c + 6, r + 1) < 0.5) boxes.push({ x: x + (hash(c, r + 8) - 0.5) * 4, y: base + ph, z: z + (hash(c + 8, r) - 0.5) * 4, w: lot * 0.3, h: 2 + hash(c + 1, r + 9) * 6, d: lot * 0.4, glow: 0 })
        continue
      }
      const fw = lot * (0.45 + 0.4 * hash(c, r + 3))
      const fd = lot * (0.45 + 0.4 * hash(c + 5, r))
      const tall = S.heightMin + hash(c + 9, r + 2) ** 2 * (S.heightVar + d * S.heightGrow)
      const h = riverY - base + tall
      boxes.push({ x, y: base, z, w: fw, h, d: fd, glow: 0 })
      // a ledge: a thin wide platform part way up
      if (hash(c + 2, r + 7) < S.ledgeShare) {
        const ly = base + h * (0.4 + 0.4 * hash(r, c + 1))
        boxes.push({ x: x + (hash(c, r + 11) - 0.5) * 4, y: ly, z: z + (hash(c + 13, r) - 0.5) * 4, w: fw + 3 + hash(c, r + 4) * 5, h: 1.1, d: fd + 3 + hash(c + 4, r) * 5, glow: 0.3 })
      }
    }
  }
  // the landmark: a stepped core tower
  for (const m of marks) {
    const tiers = S.landmarkTiers
    const total = m.height - m.base
    let y = m.base
    for (let k = 0; k < tiers.length; k++) {
      const t = tiers[k] as number[]
      const h = total * (t[1] ?? 0.2)
      const w = m.radius * 2 * (t[0] ?? 1)
      boxes.push({ x: m.x, y, z: m.z, w, h, d: w, glow: S.landmarkGlow })
      y += h
    }
    // fins at its corners
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      boxes.push({ x: m.x + sx * m.radius * 1.15, y: m.base, z: m.z + sz * m.radius * 1.15, w: 1.2, h: total * 0.86, d: 1.2, glow: S.landmarkGlow })
    }
  }
  const boxGeo = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const farMat = new ShaderMaterial({
    uniforms: {
      uBody: { value: hdr(S.body) },
      uLine: { value: palette.seam.clone().multiplyScalar(S.lineIntensity) },
      uHaze: { value: haze },
      uHazeDensity: { value: S.hazeDensity },
      uLineKeep: { value: S.lineKeep },
      uMinLine: { value: S.lineWidth },
      uMistLow: { value: riverY },
      uMistHeight: { value: S.mistHeight },
    },
    vertexShader: FAR_VERT,
    fragmentShader: FAR_FRAG,
  })
  const far = new InstancedMesh(boxGeo, farMat, boxes.length)
  const seeds = new Float32Array(boxes.length)
  const glows = new Float32Array(boxes.length)
  const m4 = new Matrix4()
  boxes.forEach((b, k) => {
    m4.makeScale(b.w, b.h, b.d).setPosition(b.x, b.y, b.z)
    far.setMatrixAt(k, m4)
    seeds[k] = hash(b.x, b.z) * 100
    glows[k] = b.glow
  })
  boxGeo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1))
  boxGeo.setAttribute('aGlow', new InstancedBufferAttribute(glows, 1))
  far.computeBoundingSphere()
  far.frustumCulled = false
  far.renderOrder = 8
  root.add(far)

  // the beam: the landmark's light rising into the sky
  const beamMat = new ShaderMaterial({
    uniforms: { uColor: { value: palette.seam.clone().multiplyScalar(S.beamIntensity) }, uTime: { value: 0 } },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  for (const m of marks) {
    const len = S.skyRadius * 0.8 - m.base
    const beam = new Mesh(new CylinderGeometry(m.radius * S.beamWidth, m.radius * S.beamWidth, len, 16, 1, true), beamMat)
    beam.position.set(m.x, m.base + len / 2, m.z)
    root.add(beam)
  }

  root.traverse((o) => {
    o.userData['noReflect'] = true
  })
  const tmp = new Vector3()
  return {
    root,
    update(time: number, camera: Camera): void {
      ;(skyMat.uniforms['uTime'] as { value: number }).value = time
      ;(riverMat.uniforms['uTime'] as { value: number }).value = time
      ;(beamMat.uniforms['uTime'] as { value: number }).value = time
      camera.getWorldPosition(tmp)
      sky.position.copy(tmp)
    },
  }
}
