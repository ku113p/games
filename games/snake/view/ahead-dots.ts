// Lattice layer: background markup of space with a sparse lattice of nodes.
//
// It answers "where am I in the volume", NOT "which way am I heading" (the heading is shown by the ray in
// ahead-ray.ts, the neighbouring cells by near-cells.ts; direction-hint.ts assembles the layers).
//
// Step and anchoring come from config.hints (tunable without a rebuild):
//   latticeAt   'corners' - nodes at cell corners (coordinates k - 0.5);
//               'centers' - nodes at cell centers (coordinates k);
//   latticeStep how many cells between nodes on each axis
//               (4 - a lattice of 4x4x4-cell cubes).
//
// The lattice is global: dots stay in place; as the snake moves they only
// fade in near the head and fade out at the window edge. At step 4 it is sparse and must not
// show the corridor - the ray does that.
//
// COST. Only nodes near the head are drawn: a static point buffer
// of fixed size that depends on the clip radius and the step, but NOT on the
// cube size. The vertex shader computes positions from uniforms (head, direction,
// lattice anchor); per frame the CPU touches only uniforms: no new objects, no
// await, no buffer rewrites. Lattice nodes in the cube: (n/step + 1)^3 - at 100^3
// with step 1 that is ~1M, so the window is clipped by radius at any step and mode.
// Window radii (cells): sideways ±LATERAL_CELLS, ahead AHEAD_CELLS, behind
// BEHIND_CELLS; the shader discards nodes outside the cube and outside the window.
//
// "HEDGEHOGS". A node is where the planes of the spatial grid intersect; a single
// dot does not show how they run. So six short stubs come out of each node along
// the world axes (±x, ±y, ±z) - the starts of edges, STUB_CELLS cells long
// (0.25 cell at any lattice step: the stubs show the cell scale). The dot at the node is kept: it marks
// the intersection itself, while the stubs show where the planes go. A stub whose end
// would leave the cube is hidden. Stubs along the screen depth axis in plane mode
// grow from zero together with freeAmount (otherwise perspective would give the depth away).
// Cost: the same static window buffer, 6 segments (12 vertices) per node; the shader
// clips the window by radius with the same code for dots and segments.
//
// FALLOFF. There is no distance curve of its own: nodes and stubs fade in the scene's shared fog (palette.ts,
// fogVisibility - an alpha multiplier). Only the fade at the window edges (edge) remains; it is not depth.
//
// Plane mode: depth is not shown (the first game looks like a flat snake) -
// only the layer of nodes at the head's own depth (within half a lattice step along the view
// depth axis, see nodeAlpha) remains; as the camera flies (freeAmount) the other layers fade in.

import { BufferGeometry, Float32BufferAttribute, LineSegments, Points, ShaderMaterial, Vector3, type Scene } from 'three'
import type { Config } from '../core/rules'
import { DOT_BASE_ALPHA, DOT_BASE_COLOR, FOG_VISIBILITY_GLSL, fogUniforms } from './palette'

// Presentation constants (clip radius and dot look), not balance values.
const LATERAL_CELLS = 8 // radius of the background window across the heading
const BEHIND_CELLS = 4
const AHEAD_CELLS = 18
const DOT_BASE_SIZE = 0.12 // dot diameter in cells
const MIN_PX = 3
const MAX_PX = 9
/** Length of an edge stub in CELLS (a quarter of a cell; independent of the lattice step). */
export const STUB_CELLS = 0.25

// Shared part: uniforms and node clipping. Returns the node alpha (0 - hidden).
const COMMON = /* glsl */ `
${FOG_VISIBILITY_GLSL}
uniform vec3 uHead;
uniform vec3 uDir;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uDepth;
uniform vec3 uAnchor;
uniform float uFreeAmt;
uniform float uSize;
uniform float uPxScale;
uniform float uMaxPx;
uniform float uSpacing;
uniform float uLo;
uniform float uCenters;
uniform float uLatR;
uniform float uBehind;
uniform float uAhead;
uniform float uBaseSize;
uniform float uMinPx;
uniform float uBaseAlpha;
uniform float uStub;
uniform vec3 uBaseColor;
varying vec3 vColor;
varying float vAlpha;

void hide() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  vAlpha = 0.0;
  vColor = vec3(0.0);
}

bool inCube(vec3 w) {
  float hi = uSize + uLo - 1.0 + 0.02;
  float lo = uLo - 0.01;
  return !(w.x < lo || w.y < lo || w.z < lo || w.x > hi || w.y > hi || w.z > hi);
}

// Node (ia, ib, if) - integer indices from the anchor along (A, B, dir): world position.
vec3 nodeWorld(vec3 idx) {
  return uAnchor + (idx.x * uA + idx.y * uB + idx.z * uDir) * uSpacing;
}

// Node alpha: window around the head, depth layer in plane mode, edge fade. 0 - hidden.
float nodeAlpha(vec3 world, float viewLen) {
  vec3 off = world - uHead;
  float f = dot(off, uDir);
  float lat = max(abs(dot(off, uA)), abs(dot(off, uB)));
  if (lat > uLatR || f < -uBehind || f > uAhead) return 0.0;
  // At centers: the head and the cells behind it along the axis are occupied by the snake, no dots there.
  if (uCenters > 0.5 && lat < 0.25 && f < 0.25) return 0.0;
  float dd = dot(off, uDepth);
  float hs = 0.5 * uSpacing;
  float layer = mix(step(-hs + 0.001, dd) * step(dd, hs + 0.001), 1.0, uFreeAmt);
  float edge = (1.0 - smoothstep(uLatR - 2.0, uLatR, lat))
    * smoothstep(-uBehind, -uBehind + 2.0, f)
    * (1.0 - smoothstep(uAhead - 4.0, uAhead, f));
  float nearFade = smoothstep(0.8, 2.2, viewLen);
  return uBaseAlpha * edge * layer * nearFade;
}
`

const VERT = /* glsl */ `
${COMMON}
void main() {
  vec3 world = nodeWorld(position);
  if (!inCube(world)) { hide(); return; }
  vec4 mv = viewMatrix * vec4(world, 1.0);
  float a = nodeAlpha(world, length(mv.xyz)) * fogVisibility(-mv.z);
  if (a <= 0.0) { hide(); return; }
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;
  gl_PointSize = clamp(uBaseSize * uPxScale * projectionMatrix[1][1] / max(clip.w, 0.001), uMinPx, uMaxPx);
  vAlpha = a;
  vColor = uBaseColor;
}
`

// Stubs: aStub = (axis 0..5 -> +x,-x,+y,-y,+z,-z; end 0 - node, 1 - tip).
const VERT_STUB = /* glsl */ `
${COMMON}
attribute vec2 aStub;
void main() {
  vec3 world = nodeWorld(position);
  int ax = int(aStub.x + 0.5);
  vec3 axis = vec3(float(ax == 0) - float(ax == 1), float(ax == 2) - float(ax == 3), float(ax == 4) - float(ax == 5));
  // Along the screen depth the stub grows from zero together with freeAmount.
  float len = uStub * mix(1.0 - abs(dot(axis, uDepth)), 1.0, uFreeAmt);
  vec3 tip = world + axis * len;
  if (!inCube(world) || !inCube(tip) || len < 0.001) { hide(); return; }
  vec3 w = aStub.y > 0.5 ? tip : world;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vec4 mvNode = viewMatrix * vec4(world, 1.0);
  float a = nodeAlpha(world, length(mvNode.xyz)) * fogVisibility(-mvNode.z);
  if (a <= 0.0) { hide(); return; }
  gl_Position = projectionMatrix * mv;
  vAlpha = a;
  vColor = uBaseColor;
}
`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = 1.0 - smoothstep(0.55, 1.0, d);
  if (vAlpha * soft < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha * soft);
}
`

const FRAG_STUB = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`

export class AheadDots {
  private scene: Scene
  private lattice: Points
  private stubs: LineSegments
  private material: ShaderMaterial
  private stubMaterial: ShaderMaterial
  private spacing: number
  private centers: boolean

  private readonly uHead = new Vector3()
  private readonly uDir = new Vector3()
  private readonly uA = new Vector3()
  private readonly uB = new Vector3()
  private readonly uDepth = new Vector3()
  private readonly uAnchor = new Vector3()

  constructor(scene: Scene, config: Config) {
    this.scene = scene
    this.spacing = Math.max(1, Math.round(config.hints.latticeStep))
    this.centers = config.hints.latticeAt === 'centers'
    const centers = this.centers
    const N = this.spacing

    // Node indices from the anchor. Ranges in nodes with +1 margin for the anchor shift.
    const latN = Math.ceil(LATERAL_CELLS / N) + 1
    const behindN = Math.ceil(BEHIND_CELLS / N) + 1
    const aheadN = Math.ceil(AHEAD_CELLS / N) + 1
    const side = 2 * latN + 1
    const depthCount = behindN + aheadN + 1
    const nodes = side * side * depthCount
    const pos = new Float32Array(nodes * 3)
    const stubPos = new Float32Array(nodes * 12 * 3)
    const stubAttr = new Float32Array(nodes * 12 * 2)
    let o = 0
    let so = 0
    let sa = 0
    for (let a = -latN; a <= latN; a++) {
      for (let b = -latN; b <= latN; b++) {
        for (let k = -behindN; k <= aheadN; k++) {
          pos[o++] = a
          pos[o++] = b
          pos[o++] = k
          for (let ax = 0; ax < 6; ax++) {
            for (let end = 0; end < 2; end++) {
              stubPos[so++] = a
              stubPos[so++] = b
              stubPos[so++] = k
              stubAttr[sa++] = ax
              stubAttr[sa++] = end
            }
          }
        }
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const uniforms = {
        uHead: { value: this.uHead },
        uDir: { value: this.uDir },
        uA: { value: this.uA },
        uB: { value: this.uB },
        uDepth: { value: this.uDepth },
        uAnchor: { value: this.uAnchor },
        uFreeAmt: { value: 0 },
        uSize: { value: 1 },
        uPxScale: { value: 400 },
        uMaxPx: { value: MAX_PX },
        uSpacing: { value: N },
        uLo: { value: centers ? 0 : -0.5 },
        uCenters: { value: centers ? 1 : 0 },
        uLatR: { value: LATERAL_CELLS },
        uBehind: { value: BEHIND_CELLS },
        uAhead: { value: AHEAD_CELLS },
        uBaseSize: { value: DOT_BASE_SIZE },
        uMinPx: { value: MIN_PX },
        uBaseAlpha: { value: DOT_BASE_ALPHA },
        uBaseColor: { value: DOT_BASE_COLOR },
        uStub: { value: STUB_CELLS },
        ...fogUniforms(),
    }
    this.material = new ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
      transparent: true,
      depthWrite: false,
    })
    this.lattice = new Points(g, this.material)
    this.lattice.frustumCulled = false
    this.scene.add(this.lattice)

    const sg = new BufferGeometry()
    sg.setAttribute('position', new Float32BufferAttribute(stubPos, 3))
    sg.setAttribute('aStub', new Float32BufferAttribute(stubAttr, 2))
    // The same uniforms (by reference): update() touches them once for both layers.
    this.stubMaterial = new ShaderMaterial({
      uniforms,
      vertexShader: VERT_STUB,
      fragmentShader: FRAG_STUB,
      fog: true,
      transparent: true,
      depthWrite: false,
    })
    this.stubs = new LineSegments(sg, this.stubMaterial)
    this.stubs.frustumCulled = false
    this.scene.add(this.stubs)
  }

  /** Frame buffer height in pixels (for dot size). Cold path: init and resize. */
  setViewportHeight(pixels: number): void {
    this.material.uniforms['uPxScale']!.value = pixels * 0.5
  }

  /**
   * Frame: no new objects, only uniforms. (dx,dy,dz) is the unit
   * heading, (px,py,pz) is the screen depth axis, (hx,hy,hz) is the head.
   */
  update(
    size: number,
    hx: number,
    hy: number,
    hz: number,
    dx: number,
    dy: number,
    dz: number,
    px: number,
    py: number,
    pz: number,
    freeAmount: number,
  ): void {
    const N = this.spacing
    this.uHead.set(hx, hy, hz)
    this.uDir.set(dx, dy, dz)
    // Anchor: the lattice node (cell corner k*N - 0.5 or center k*N) closest to the head.
    const sh = this.centers ? 0 : 0.5
    this.uAnchor.set(
      Math.round((hx + sh) / N) * N - sh,
      Math.round((hy + sh) / N) * N - sh,
      Math.round((hz + sh) / N) * N - sh,
    )
    // Two axes across the heading (any orthogonal unit vectors).
    const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2
    this.uA.set(0, 0, 0)
    this.uB.set(0, 0, 0)
    if (axis === 0) {
      this.uA.y = 1
      this.uB.z = 1
    } else if (axis === 1) {
      this.uA.z = 1
      this.uB.x = 1
    } else {
      this.uA.x = 1
      this.uB.y = 1
    }
    this.uDepth.set(px, py, pz)
    const u = this.material.uniforms
    u['uFreeAmt']!.value = freeAmount
    u['uSize']!.value = size
  }

  dispose(): void {
    this.scene.remove(this.lattice)
    this.lattice.geometry.dispose()
    this.material.dispose()
    this.scene.remove(this.stubs)
    this.stubs.geometry.dispose()
    this.stubMaterial.dispose()
  }
}
