// Near hint layer: markers at the CENTERS of the cells the snake can reach
// with the next step, plus one more cell farther along the same axis. One marker per cell.
// Axes only, no diagonals: forward and four face neighbors (left, right,
// down, up relative to the heading; in plane mode this includes the depth axis), five vectors in all.
// The near one is larger and brighter, the second (two cells from the head) is noticeably smaller and quieter.
//   can step: a white ARROW along the direction from the head to the cell (forward brighter than the sides).
//     The arrow is flat, drawn in the fragment shader inside a point sprite that is
//     always turned toward the camera, and its angle comes from the screen projection of the step direction
//     (the cell and cell + step are projected by the vertex shader): readable from any angle.
//     If the direction is almost along the line of sight (the arrow "looks at us / away"),
//     the projection degenerates and the arrow smoothly turns into a disc - that is how a 3D arrow
//     looks end-on too, and the angle at that moment would be noise;
//   cannot (wall, obstacle, body): a red-orange CROSS; at a wall the marker
//   sits on its face (the cell behind the wall does not exist). If the near cell is blocked by an
//   obstacle/body, the second is a cross too (a solid wall of two markers), even if
//   it is free behind; if the second is already beyond the cube wall, the marker is on the face. Near wall:
//   one marker (a second would hang outside the cube and hint that there is room behind the wall).
// The cross is drawn by the fragment shader inside a point sprite. The sprite is always turned toward the
// camera, so a flat cross reads from any angle without recomputing geometry,
// whereas a 3D one made of two segments would flatten into a stick or a dot in perspective.
// Computed separately for each cell. An apple is a free cell.
// 5 cells x 2 are pre-allocated; per frame positions and kinds are mutated, no objects.
// Brightness is below the bloom threshold.
//
// DEPTH. The marker sits at the cell center, and the cell may be an obstacle (that is exactly where the cross
// stands), so a plain depthTest would let the marker's own face eat it. And "no depthTest at all" lied:
// a marker behind a wall was drawn at full brightness over the wall, like a sticker on its face. So two
// passes over the same geometry with the same depth test but in opposite directions:
//   open        - depthTest LessEqual, full brightness;
//   behind wall - depthTest Greater, brightness NEAR_OCCLUDED_ALPHA (the marker reads as "it is behind a wall").
// The marker's depth for the test is pulled toward the camera by NEAR_DEPTH_BIAS cells along the line of sight (screen
// position and size do not change): the marker's own cell and its faces do not cover it,
// only something noticeably closer to the camera does. The passes do not overlap (shared test).

import { BufferAttribute, BufferGeometry, Color, GreaterDepth, LessEqualDepth, Points, ShaderMaterial, type DepthModes, type IUniform, type Scene } from 'three'
import type { GameState } from '../core/state'
import { viewFrame, head } from '../core/queries'
import { HeadTrace, HitKind, type SolidTest } from './head-trace'
import { NEAR_DEPTH_BIAS, NEAR_FAR_ALPHA, NEAR_FAR_SIZE, NEAR_BLOCKED_BRIGHTNESS, NEAR_OCCLUDED_ALPHA, NEAR_FORWARD_BRIGHTNESS, NEAR_SIDE_BRIGHTNESS, RAY_DANGER_COLOR } from './palette'

// Result of put: free / blocked (obstacle, body) / cube wall.
const PUT_OPEN = 0
const PUT_BLOCKED = 1
const PUT_WALL = 2
const MAX_CELLS = 10 // 5 directions x 2 cells
const DOT_SIZE = 0.42 // near marker sprite size (arrow/cross) in cells
const MAX_PX = 60 // cap on sprite size in buffer pixels: up close the arrow is big, but not half the screen
// A cross smaller than 8 px turns into a blob: "cannot" has its own lower size limit
// and multiplier (a cross is visually lighter than a disc of the same width).
const BLOCKED_MIN_PX = 9
const ARROW_MIN_PX = 10 // a smaller arrow is unreadable: free cells stay at or above this
const BLOCKED_SIZE_K = 1.3
const CROSS_HALF = 0.86 // half the side of the cross as a fraction of the sprite
const CROSS_WIDTH = 0.2 // half-thickness of the stroke as a fraction of the sprite

const VERT = /* glsl */ `
attribute float aKind;   // 0 forward, 1 sideways, 2 cannot, -1 do not draw
attribute float aFar;    // 1 is the second cell from the head
attribute vec3 aDir;     // unit step from the head to the cell (world axes)
uniform float uPxScale;
uniform float uSize;
uniform float uMaxPx;
uniform float uFarSize;
uniform float uFarAlpha;
uniform float uArrowMinPx;
uniform float uBlockedMinPx;
uniform float uBlockedSizeK;
uniform float uDepthBias;
uniform float uPassAlpha;
uniform vec3 uForwardColor;
uniform vec3 uSideColor;
uniform vec3 uBlockedColor;
varying vec3 vColor;
varying float vAlpha;
varying float vBlocked;
varying vec2 vDir;
varying float vArrow;
void main() {
  if (aKind < -0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vColor = vec3(0.0);
    return;
  }
  vec4 mv = viewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  // Depth for the test: a point on the line of sight closer to the camera by uDepthBias (xy/w same as clip).
  float mvLen = max(length(mv.xyz), 1e-4);
  gl_Position = projectionMatrix * vec4(mv.xyz * (max(mvLen - uDepthBias, 0.05) / mvLen), 1.0);
  // Screen direction of the step: projection of the cell and of the cell + half a step along aDir.
  vec4 clip2 = projectionMatrix * (mv + viewMatrix * vec4(aDir * 0.5, 0.0));
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vec2 sd = (clip2.xy / max(clip2.w, 0.001) - clip.xy / max(clip.w, 0.001)) * vec2(aspect, 1.0);
  float sdLen = length(sd);
  // Relation to the "sideways" half-step (there the projection is full): 1 is sideways, 0 is end-on.
  float side = sdLen / max(0.5 * projectionMatrix[1][1] / max(clip.w, 0.001), 1e-5);
  vDir = sdLen > 1e-6 ? sd / sdLen : vec2(0.0, 1.0);
  vArrow = smoothstep(0.12, 0.35, side);
  float farK = aFar > 0.5 ? uFarSize : 1.0;
  float blocked = aKind > 1.5 ? 1.0 : 0.0;
  vBlocked = blocked;
  float sz = uSize * farK * mix(1.0, uBlockedSizeK, blocked) * uPxScale * projectionMatrix[1][1] / max(clip.w, 0.001);
  gl_PointSize = clamp(sz, mix(uArrowMinPx, uBlockedMinPx, blocked), uMaxPx);
  float nearFade = smoothstep(0.5, 1.5, length(mv.xyz));
  vColor = aKind > 1.5 ? uBlockedColor : (aKind > 0.5 ? uSideColor : uForwardColor);
  vAlpha = nearFade * (aFar > 0.5 ? uFarAlpha : 1.0) * uPassAlpha;
}
`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vBlocked;
varying vec2 vDir;
varying float vArrow;
uniform float uCrossHalf;
uniform float uCrossWidth;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float shape;
  if (vBlocked > 0.5) {
    // Cross: distance to the diagonals, clipped by a square.
    float d = min(abs(p.x - p.y), abs(p.x + p.y)) * 0.70710678;
    float box = max(abs(p.x), abs(p.y));
    shape = (1.0 - smoothstep(uCrossWidth * 0.6, uCrossWidth, d)) * (1.0 - smoothstep(uCrossHalf - 0.1, uCrossHalf, box));
  } else {
    // Free cell: an arrow along vDir (in the sprite y is down, convert to y up),
    // end-on it is a disc.
    vec2 q = vec2(p.x, -p.y);
    float u = dot(q, vDir) + 0.1;
    float v = dot(q, vec2(-vDir.y, vDir.x));
    float shaft = max(abs(v) - 0.17, abs(u + 0.25) - 0.55);
    float tip = max(abs(v) - (0.95 - u) * 0.85, 0.05 - u);
    float dArrow = min(shaft, tip);
    float arrow = 1.0 - smoothstep(0.0, 0.1, dArrow);
    float disc = 1.0 - smoothstep(0.6, 1.0, length(p));
    shape = mix(disc, arrow, vArrow);
  }
  float a = shape * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`

export class NearCells {
  private scene: Scene
  private points: Points
  private hidden: Points
  private material: ShaderMaterial
  private hiddenMaterial: ShaderMaterial
  private pos: BufferAttribute
  private kind: BufferAttribute
  private far: BufferAttribute
  private dir: BufferAttribute
  private trace: HeadTrace
  private n = 0

  constructor(scene: Scene, trace: HeadTrace) {
    this.scene = scene
    this.trace = trace
    const geometry = new BufferGeometry()
    this.pos = new BufferAttribute(new Float32Array(MAX_CELLS * 3), 3)
    this.kind = new BufferAttribute(new Float32Array(MAX_CELLS).fill(-1), 1)
    this.far = new BufferAttribute(new Float32Array(MAX_CELLS), 1)
    this.dir = new BufferAttribute(new Float32Array(MAX_CELLS * 3), 3)
    geometry.setAttribute('position', this.pos)
    geometry.setAttribute('aKind', this.kind)
    geometry.setAttribute('aFar', this.far)
    geometry.setAttribute('aDir', this.dir)
    const c = (k: number): Color => new Color(k, k, k)
    // Shared uniforms of the two passes (by reference); only uPassAlpha is separate for each.
    const shared: Record<string, IUniform> = {
      uPxScale: { value: 400 },
      uSize: { value: DOT_SIZE },
      uMaxPx: { value: MAX_PX },
      uFarSize: { value: NEAR_FAR_SIZE },
      uFarAlpha: { value: NEAR_FAR_ALPHA },
      uArrowMinPx: { value: ARROW_MIN_PX },
      uBlockedMinPx: { value: BLOCKED_MIN_PX },
      uBlockedSizeK: { value: BLOCKED_SIZE_K },
      uDepthBias: { value: NEAR_DEPTH_BIAS },
      uCrossHalf: { value: CROSS_HALF },
      uCrossWidth: { value: CROSS_WIDTH },
      uForwardColor: { value: c(NEAR_FORWARD_BRIGHTNESS) },
      uSideColor: { value: c(NEAR_SIDE_BRIGHTNESS) },
      uBlockedColor: { value: RAY_DANGER_COLOR.clone().multiplyScalar(NEAR_BLOCKED_BRIGHTNESS) },
    }
    const make = (passAlpha: number, depthFunc: DepthModes): ShaderMaterial =>
      new ShaderMaterial({
        uniforms: { ...shared, uPassAlpha: { value: passAlpha } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        depthFunc,
      })
    this.material = make(1, LessEqualDepth)
    this.hiddenMaterial = make(NEAR_OCCLUDED_ALPHA, GreaterDepth)
    this.points = new Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 2
    this.hidden = new Points(geometry, this.hiddenMaterial)
    this.hidden.frustumCulled = false
    this.hidden.renderOrder = 2
    this.scene.add(this.points, this.hidden)
  }

  setViewportHeight(pixels: number): void {
    this.material.uniforms['uPxScale']!.value = pixels * 0.5 // uniform is shared with the "behind wall" pass
  }

  /**
   * Frame. trace.run() has already been called for the same state by now.
   * (dx,dy,dz) is the unit heading. Five vectors: the heading and four
   * perpendicular ones (±right, ±up, ±depth minus those lying along the heading).
   */
  update(s: GameState, dx: number, dy: number, dz: number, isSolid: SolidTest): void {
    const h = head(s)
    const frame = viewFrame(s)
    this.n = 0
    this.putPair(s, h.x, h.y, h.z, dx, dy, dz, 0, isSolid)
    for (let a = 0; a < 3; a++) {
      const v = a === 0 ? frame.right : a === 1 ? frame.up : frame.depth
      const vx = Math.round(v.x)
      const vy = Math.round(v.y)
      const vz = Math.round(v.z)
      // Along the movement axis (forward already exists, backward is forbidden) - skip.
      if (Math.abs(vx * dx + vy * dy + vz * dz) > 0) continue
      this.putPair(s, h.x, h.y, h.z, vx, vy, vz, 1, isSolid)
      this.putPair(s, h.x, h.y, h.z, -vx, -vy, -vz, 1, isSolid)
    }
    for (let i = this.n; i < MAX_CELLS; i++) this.kind.setX(i, -1)
    this.kind.needsUpdate = true
    this.pos.needsUpdate = true
    this.far.needsUpdate = true
    this.dir.needsUpdate = true
  }

  /** Near cell and, if it can be stepped into, the second one behind it (same axis). */
  private putPair(s: GameState, hx: number, hy: number, hz: number, dx: number, dy: number, dz: number, role: number, isSolid: SolidTest): void {
    const near = this.put(s, hx, hy, hz, dx, dy, dz, 1, role, isSolid, false)
    // Near cube wall: there is no cell behind it, a second marker would hang outside the cube.
    if (near === PUT_WALL) return
    // Near one blocked: the second is a cross too, whatever is behind it (a solid wall of two markers).
    this.put(s, hx, hy, hz, dx, dy, dz, 2, role, isSolid, near === PUT_BLOCKED)
  }

  private put(s: GameState, hx: number, hy: number, hz: number, dx: number, dy: number, dz: number, dist: number, role: number, isSolid: SolidTest, forceBlocked: boolean): number {
    if (this.n >= MAX_CELLS) return PUT_WALL
    const k = this.trace.kindAt(s, hx + dx * dist, hy + dy * dist, hz + dz * dist, dist, isSolid)
    const wall = k === HitKind.Wall
    const kind = forceBlocked || wall || k === HitKind.Obstacle || k === HitKind.Body ? 2 : role
    // Cell center; for a wall, the center of its face (half a cell closer).
    const off = wall ? dist - 0.5 : dist
    const i = this.n
    this.pos.setXYZ(i, hx + dx * off, hy + dy * off, hz + dz * off)
    this.kind.setX(i, kind)
    this.far.setX(i, dist > 1 ? 1 : 0)
    this.dir.setXYZ(i, dx, dy, dz)
    this.n++
    return wall ? PUT_WALL : kind === 2 ? PUT_BLOCKED : PUT_OPEN
  }

  dispose(): void {
    this.scene.remove(this.points, this.hidden)
    this.points.geometry.dispose()
    this.material.dispose()
    this.hiddenMaterial.dispose()
  }
}
