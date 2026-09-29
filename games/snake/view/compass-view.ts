// Apple compass: a small 3D arrow (cylinder shaft + cone head) right by the head,
// pointed along the REAL world vector from the head to the apple (not the screen projection).
// So it honestly shows "above / below / closer / farther" in 3D: the snake moves along
// three axes, and the vertical is the hardest to read. It turns smoothly ("like a compass",
// not in clicks).
//
// A layer separate from the direction hints (near-cells / ahead-ray): those are flat WHITE
// arrow sprites at the centers of neighboring cells (1 cell from the head); the compass has the apple's color,
// with 3D shading, and fits entirely inside the head cell (the tip does not reach the
// hint markers), so the two are not confused.
//
// Degenerate case: the apple is exactly along the camera's view axis (in front or behind) - the arrow
// points into the camera and turns into a circle. The 3D shape end-on reads on its own (cone shading,
// different size of near and far end), but "toward us or away" is ambiguous, so
// the direction drawn on screen is kept no closer than COMPASS_MIN_ANGLE to the view axis:
// the arrow tilts minimally sideways so its side is visible. The deviation is continuous and
// acts only right at the view axis; from other angles the arrow aims exactly.
//
// Brightness: fades out when the apple is close (it is right in front anyway), fully visible from
// hints.compassFullDist (straight-line distance); hidden in plane mode (the first game must look like an ordinary
// flat snake), fades in smoothly together with freeAmount.
// Always on top of the scene: the arrow's depth is squeezed toward the camera near plane (shader), so
// obstacles do not cover it, and the arrow's own faces still sort correctly against each other.
// Nothing is created per frame: mesh, geometry and temporary vectors are created up front.

import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  MathUtils,
  Mesh,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
  type Camera,
  type Scene,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { GameState } from '../core/state'
import { applePos, head } from '../core/queries'
import { APPLE_COLOR } from './palette'
import type { CompassSkin } from './cosmetics'

// --- Styling constants (the designer tweaks these), not balance values -----------------
/** false: the compass is not created and not computed at all. */
export const COMPASS_ENABLED = true
/** Height of the arrow center above the head center along the camera's "up", cells (was 2.5, now 0.9: right against the head). */
export const COMPASS_HEIGHT = 0.55
/** Full arrow length in cells (was 0.9 flat, now 0.7 3D). */
export const COMPASS_LENGTH = 0.55
/** Radius of the cone head as a fraction of length (was: flat head width 0.7 of length; radius 0.5 of width = 0.35). */
export const COMPASS_HEAD_RADIUS = 0.26
/** Shaft radius as a fraction of length. */
export const COMPASS_SHAFT_RADIUS = 0.1
/** Fraction of length taken by the cone head (the rest is the shaft). */
export const COMPASS_HEAD_FRACTION = 0.5
/** Turn time constant, ms: lower is snappier, higher is lazier, like a heavy compass needle. */
export const COMPASS_TURN_MS = 160
/** Position smoothing near the head, ms (the head jumps by cells, the compass drifts after it). */
export const COMPASS_FOLLOW_MS = 90
/**
 * Brightness window by STRAIGHT-LINE distance to the apple, cells: closer than hide the compass is off (the apple is right by the head anyway),
 * from full it is fully visible, in between it fades smoothly. Lives in config.hints (compassHideDist / compassFullDist, hint balance
 * values, AGENTS.md §4.5). Paths around obstacles and the tail are longer than the straight line, so the window is narrow: we fade only point-blank.
 * The values below are fallbacks while the keys are not in config.json; after the merge the config takes precedence.
 */
export const COMPASS_HIDE_DIST_FALLBACK = 1.5
export const COMPASS_FULL_DIST_FALLBACK = 3

/** Part of Config that the compass reads (the Config type in core/rules.ts is narrow until the keys are added there). */
export interface CompassHints {
  compassHideDist?: number
  compassFullDist?: number
}
/** Maximum opacity and color brightness (linear apple brightness ~1, bloom threshold 0.8). */
export const COMPASS_ALPHA = 0.95
export const COMPASS_BRIGHTNESS = 0.9
/** Minimum angle between the arrow and the camera view axis, degrees; 0 means do not tilt (the arrow degenerates into a circle). */
export const COMPASS_MIN_ANGLE = 35
/** Shading strength: 0 is flat fill, 1 is from black to full color. */
export const COMPASS_SHADING = 0.7

// By how much the arrow's depth range is squeezed at the near plane (technical number).
const DEPTH_SQUASH = 0.02
const CONE_SEGMENTS = 20

// Arrow skins (shop). All in unit length along +Y centered at zero, like the main one: same height, same turn and same brightness.
// Chevron: three nested cones in a row (▲▲▲): round in cross-section, so they read as "forward" from any angle.
const CHEVRON_COUNT = 3
const CHEVRON_RADIUS = 0.27
const CHEVRON_LENGTH = 0.34 // height of one cone
const CHEVRON_STEP = 0.29 // shift of the tip from cone to cone, backward
// Ring: a cone tip and an encircling ring at its base (the ring is perpendicular to the direction).
const RING_RADIUS = 0.3
const RING_TUBE = 0.06
const RING_Y = -0.2
const RING_CONE_RADIUS = 0.2
const RING_CONE_LEN = 0.6

/** Arrow geometry by skin: default is shaft and cone. Cold path. */
export function compassGeometry(skin: CompassSkin): BufferGeometry {
  const parts: BufferGeometry[] = []
  if (skin === 'chevron') {
    for (let k = 0; k < CHEVRON_COUNT; k++) {
      const c = new ConeGeometry(CHEVRON_RADIUS, CHEVRON_LENGTH, CONE_SEGMENTS, 1)
      c.translate(0, 0.5 - CHEVRON_LENGTH / 2 - k * CHEVRON_STEP, 0)
      parts.push(c)
    }
  } else if (skin === 'ring') {
    const cone = new ConeGeometry(RING_CONE_RADIUS, RING_CONE_LEN, CONE_SEGMENTS, 1)
    cone.translate(0, 0.5 - RING_CONE_LEN / 2, 0)
    const ring = new TorusGeometry(RING_RADIUS, RING_TUBE, 10, 28)
    ring.rotateX(Math.PI / 2) // ring axis is Y (the direction)
    ring.translate(0, RING_Y, 0)
    parts.push(cone, ring)
  } else {
    const headLen = COMPASS_HEAD_FRACTION
    const shaftLen = 1 - headLen
    const cone = new ConeGeometry(COMPASS_HEAD_RADIUS, headLen, CONE_SEGMENTS, 1)
    cone.translate(0, 0.5 - headLen / 2, 0)
    const shaft = new CylinderGeometry(COMPASS_SHAFT_RADIUS, COMPASS_SHAFT_RADIUS, shaftLen, CONE_SEGMENTS, 1)
    shaft.translate(0, -0.5 + shaftLen / 2, 0)
    parts.push(cone, shaft)
  }
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  return merged
}

const VERTEX = /* glsl */ `
varying vec3 vN;
uniform float uSquash;
void main() {
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Depth toward the near plane: on top of the scene, but the arrow's faces stay distinguishable from each other.
  gl_Position.z = -gl_Position.w + (gl_Position.z + gl_Position.w) * uSquash;
}
`
const FRAGMENT = /* glsl */ `
varying vec3 vN;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uShading;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // Light from behind the camera's left shoulder, from above + a rim on the edges (separates the shape from the background).
  float l = clamp(dot(n, normalize(vec3(-0.5, 0.7, 0.5))), 0.0, 1.0);
  float shade = mix(1.0, 0.16 + 0.9 * l, uShading);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0) * 0.25 * uShading;
  gl_FragColor = vec4(uColor * (shade + rim), uOpacity);
}
`

/** Compass opacity: window by distance to the apple (straight line) x 3D enablement (0 in plane, 1 in free, in between the camera flight). */
export function compassAlpha(dist: number, hideDist: number, fullDist: number, freeAmount: number): number {
  return COMPASS_ALPHA * MathUtils.smoothstep(dist, hideDist, fullDist) * MathUtils.smoothstep(freeAmount, 0, 1)
}

export class CompassView {
  private scene: Scene
  private mesh: Mesh
  private material: ShaderMaterial
  private readonly opacityU = { value: 0 } // opacity uniform (mutated in place)
  private readonly dir = new Vector3(1, 0, 0) // smoothed direction (unit)
  private readonly target = new Vector3()
  private readonly pos = new Vector3()
  private readonly up = new Vector3()
  private readonly fwd = new Vector3()
  private readonly perp = new Vector3()
  private readonly draw = new Vector3() // direction being drawn (after deflection from the view axis)
  private readonly axisY = new Vector3(0, 1, 0)
  private readonly quat = new Quaternion()
  private readonly minCos = Math.cos(MathUtils.degToRad(COMPASS_MIN_ANGLE))
  private readonly minSin = Math.sin(MathUtils.degToRad(COMPASS_MIN_ANGLE))
  private ready = false
  private readonly hideDist: number
  private readonly fullDist: number

  constructor(scene: Scene, hints?: CompassHints, skin: CompassSkin = 'default') {
    this.scene = scene
    this.hideDist = hints?.compassHideDist ?? COMPASS_HIDE_DIST_FALLBACK
    this.fullDist = hints?.compassFullDist ?? COMPASS_FULL_DIST_FALLBACK
    // Arrow along +Y of unit length, centered at the origin: for default the shaft is at the bottom, the cone on top.
    const g: BufferGeometry = compassGeometry(skin)
    this.material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color().copy(APPLE_COLOR).multiplyScalar(COMPASS_BRIGHTNESS) },
        uOpacity: this.opacityU,
        uShading: { value: COMPASS_SHADING },
        uSquash: { value: DEPTH_SQUASH },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: true, // test against the squeezed depth of the arrow itself; it still overdraws the scene
      depthWrite: true,
    })
    this.mesh = new Mesh(g, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 10
    this.mesh.visible = false
    this.mesh.scale.setScalar(COMPASS_LENGTH)
    this.scene.add(this.mesh)
  }

  /** The game started over: the arrow snaps into place at once, no turning from the previous position. */
  reset(): void {
    this.ready = false
  }

  /** Frame: no new objects. */
  update(s: GameState, camera: Camera, dtMs: number, freeAmount: number): void {
    const h = head(s)
    const ap = applePos(s)
    this.target.set(ap.x - h.x, ap.y - h.y, ap.z - h.z)
    const dist = this.target.length()
    const alpha = compassAlpha(dist, this.hideDist, this.fullDist, freeAmount)
    if (alpha <= 0.003 || dist < 1e-6) {
      this.mesh.visible = false
      this.ready = false
      return
    }
    this.target.divideScalar(dist)

    camera.updateMatrixWorld()
    const e = camera.matrixWorld.elements
    this.up.set(e[4]!, e[5]!, e[6]!)
    this.fwd.set(-e[8]!, -e[9]!, -e[10]!) // where the camera is looking

    // Point by the head: head + camera up (follows the head's cell jumps smoothly).
    const px = h.x + this.up.x * COMPASS_HEIGHT
    const py = h.y + this.up.y * COMPASS_HEIGHT
    const pz = h.z + this.up.z * COMPASS_HEIGHT
    const kPos = this.ready ? 1 - Math.exp(-dtMs / COMPASS_FOLLOW_MS) : 1
    this.pos.x += (px - this.pos.x) * kPos
    this.pos.y += (py - this.pos.y) * kPos
    this.pos.z += (pz - this.pos.z) * kPos

    // Turn toward the target; for a nearly opposite direction lerp passes through zero -
    // then take the target as is.
    const kDir = this.ready ? 1 - Math.exp(-dtMs / COMPASS_TURN_MS) : 1
    this.dir.lerp(this.target, kDir)
    if (this.dir.lengthSq() < 0.01) this.dir.copy(this.target)
    this.dir.normalize()
    this.ready = true

    // Deviation from the view axis: the drawn direction is no closer than COMPASS_MIN_ANGLE to it.
    this.draw.copy(this.dir)
    const c = this.dir.dot(this.fwd)
    if (Math.abs(c) > this.minCos) {
      this.perp.copy(this.dir).addScaledVector(this.fwd, -c)
      if (this.perp.lengthSq() < 1e-6) this.perp.copy(this.up)
      this.perp.normalize()
      const sgn = c > 0 ? 1 : -1
      this.draw.copy(this.fwd).multiplyScalar(sgn * this.minCos).addScaledVector(this.perp, this.minSin)
    }

    this.quat.setFromUnitVectors(this.axisY, this.draw)
    this.mesh.quaternion.copy(this.quat)
    this.mesh.position.copy(this.pos)
    this.opacityU.value = alpha
    this.mesh.visible = true
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
