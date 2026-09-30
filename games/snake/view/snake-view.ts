// Snake: the body is an InstancedMesh of neon wireframe cubes (edges only, hollow
// inside; color per instance); the head is a separate wireframe pyramid pointing along the heading (heading = head - neck,
// taken from a walk over the segments via queries). Per-frame update with NO
// allocations: Matrix4/Color/Vector3/callback are created once, pool growth is
// only in handle().
//
// Readability: the body goes bright green -> bright cyan (the tail does not darken), odd
// segments are slightly dimmer. In free mode, segments near the camera shrink
// (fade) so they do not block the view; the camera sets the effect weight (freeAmount).
//
// The snake is drawn cell by cell from the core, step by step. Smoothing is minimal:
// a segment slides in from the cell behind it and settles within the first SLIDE_FRACTION
// of the step, then stays put. This is a softened jump, not gliding (full gliding was
// rejected by the designer). The camera is tied to the movement vector itself, see camera-rig.ts.

import {
  MeshBasicMaterial,
  Mesh,
  Matrix4,
  Color,
  Vector3,
  MathUtils,
  type Scene,
} from 'three'
import type { GameState } from '../core/state'
import { snakeLength, forEachSnakeSegment, elapsedMs, intendedHeading, stepProgress, stepsToCrash, appleOnCourse } from '../core/queries'
import configJson from '../config.json'
import { InstancedPool } from './pool'
import { TailGuides } from './tail-guides'
import type { SnakeSkin } from './cosmetics'
import { beamGeometry, cubeEdgeSegments } from './outline'
import {
  SNAKE_BODY_COLOR,
  SNAKE_TAIL_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_STRIPE_DIM,
  SNAKE_BODY_GLOW_BOOST,
  SNAKE_HEAD_END_LUMINANCE,
  SNAKE_HEAD_END_SEGMENTS,
  SNAKE_HEAD_END_MAX_BOOST,
  SNAKE_HEAD_END_NEAR_LUMINANCE,
  SNAKE_HEAD_END_NEAR_FROM,
  SNAKE_HEAD_END_NEAR_TO,
  HEAD_IDLE_BOOST,
  HEAD_GOAL_COLOR,
  HEAD_GOAL_BOOST,
  HEAD_DANGER_COLOR_FAR,
  HEAD_DANGER_COLOR_NEAR,
} from './palette'
import { bloomLuminanceOf } from './palette-math'

// Styling constants, not balance values.
const SEGMENT_SCALE = 0.86
// Light smoothing of movement: a segment slides in from the neighbor's cell behind it but finishes
// within the first SLIDE_FRACTION of the step and then stays put. Movement remains step-based;
// this is a softened jump, not gliding.
const SLIDE_FRACTION = 0.4
// Thickness of the frame beams (cells). The head has the same shape as the body: it differs by color/brightness.
const SEGMENT_BEAM = 0.1
// Soft head "breathing" (size and brightness), only if there is no prefers-reduced-motion.
// Safety: one breath = one sine cycle, the fastest one is the danger breath, 1000/DANGER_PERIOD_MS = 1000/1100 ≈ 0.9 Hz (idle: 1000/1600 ≈ 0.6 Hz), both < 3 flashes/s,
// no jumps: only a smooth low-amplitude sine. The danger color changes by smooth transition, not by blinking.
const HEAD_PULSE = 0.05
const HEAD_PULSE_PERIOD_MS = 1600
const DANGER_PERIOD_MS = 1100
const DANGER_PULSE = 0.06
export const DANGER_BREATH = 0.08

/** Head signal values (config.headSignal): danger horizon in steps, the color transition time and the size of the head in the goal state. */
export interface HeadSignalConfig {
  dangerHorizon: number
  riseMs: number
  fallMs: number
  /**
   * Size of the head (1 = unchanged) when the apple is on the course. A head lit above the bloom threshold puts out light in proportion to the area it covers,
   * and in the chase view the head is close to the camera: at full size the goal head washed out half the frame. Lit but smaller, it reads as a signal, not as a lamp.
   */
  goalScale: number
}
// Fade of segments near the camera: distances in cells (not from followDistance,
// the camera is up close: the neck at ~1.7 cells from the camera must stay visible, while anything
// closer than ~1 cell collapses).
const FADE_NEAR_CELLS = 0.9
const FADE_FAR_CELLS = 1.5
const FADE_MIN_SCALE = 0.1

export class SnakeView {
  private pool: InstancedPool
  private matrix = new Matrix4()
  private color = new Color()
  private denom = 1
  private px = new Float32Array(0)
  private py = new Float32Array(0)
  private pz = new Float32Array(0)
  // Smoothed positions and scale of the frame's segments: needed by the tail guides (the link between neighbors).
  private gx = new Float32Array(0)
  private gy = new Float32Array(0)
  private gz = new Float32Array(0)
  private gk = new Float32Array(0)
  private readonly guides: TailGuides | null

  private headMesh: Mesh
  private headMaterial: MeshBasicMaterial
  private headDir = new Vector3(1, 0, 0)

  // Head signals. The core computes them once per step (state does not change between steps), so the result
  // is cached by key (state, step, heading, apple); per frame only the smooth color transition remains.
  private readonly signalCfg: HeadSignalConfig
  private sigState: GameState | null = null
  private sigStep = -1
  private sigHx = 0
  private sigHy = 0
  private sigHz = 0
  private sigAx = -1
  private sigAy = -1
  private sigAz = -1
  private crashIn = 0
  private goal = false
  private goalAmount = 0
  private dangerAmount = 0
  private nearAmount = 0
  private readonly reducedMotion: MediaQueryList | null =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  private lastElapsed = -1
  private readonly headColor = new Color()
  private readonly tint = new Color()

  /**
   * Unit heading of the head, updated in update(): where the snake is pointing right now, including an already
   * accepted but not yet executed turn (core/queries intendedHeading). The heading is not derived from the body
   * geometry (head minus neck): the body stands still until the step, so the input would only show on the step.
   */
  get direction(): Vector3 {
    return this.headDir
  }

  private headX = 0
  private headY = 0
  private headZ = 0

  // Current frame parameters for the callback.
  private camX = 0
  private camY = 0
  private camZ = 0
  private fadeAmount = 0

  // Callback created once: no closures are created per frame.
  /** Collecting step positions: a segment can be interpolated only when its neighbor behind is known. */
  private readonly collect = (x: number, y: number, z: number, i: number): void => {
    this.px[i] = x
    this.py[i] = y
    this.pz[i] = z
  }

  private ensureBuffers(n: number): void {
    if (this.px.length >= n) return
    const cap = Math.max(n, this.px.length * 2, 8)
    this.px = new Float32Array(cap)
    this.py = new Float32Array(cap)
    this.pz = new Float32Array(cap)
    this.gx = new Float32Array(cap)
    this.gy = new Float32Array(cap)
    this.gz = new Float32Array(cap)
    this.gk = new Float32Array(cap)
  }

  private place(i: number, length: number, glide: number): void {
    // Where the segment travels from: the neighbor's cell behind it. The tail has no neighbor, so it stands still.
    const back = i + 1 < length ? i + 1 : i
    const x = this.px[back]! + (this.px[i]! - this.px[back]!) * glide
    const y = this.py[back]! + (this.py[i]! - this.py[back]!) * glide
    const z = this.pz[back]! + (this.pz[i]! - this.pz[back]!) * glide

    this.gx[i] = x
    this.gy[i] = y
    this.gz[i] = z
    this.gk[i] = 1
    if (i === 0) {
      this.headX = x
      this.headY = y
      this.headZ = z
      return
    }
    let k = 1
    const headEnd = i <= SNAKE_HEAD_END_SEGMENTS
    let dist = Infinity
    if (this.fadeAmount > 0 || headEnd) {
      const dx = x - this.camX
      const dy = y - this.camY
      const dz = z - this.camZ
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    }
    if (this.fadeAmount > 0) {
      const f = MathUtils.smoothstep(dist, FADE_NEAR_CELLS, FADE_FAR_CELLS)
      k = MathUtils.lerp(1, MathUtils.lerp(FADE_MIN_SCALE, 1, f), this.fadeAmount)
    }
    this.gk[i] = k;
    // The body is instances 0..length-2 (the head is drawn separately).
    const idx = i - 1
    this.matrix.makeScale(k, k, k).setPosition(x, y, z)
    this.pool.mesh.setMatrixAt(idx, this.matrix)
    this.color.copy(SNAKE_BODY_COLOR)
    if (!headEnd) this.color.lerp(SNAKE_TAIL_COLOR, i / this.denom)
    if (headEnd) {
      // Head end: the pure body hue (palette.test checks it against the head states; the tail ramp would collide with them for color-blind players), pinned to a luminance (bloomLuminanceOf, the same formula as boostFor in palette-math: the one the bloom pass uses): the full glow (above the bloom threshold), lower when near the camera.
      const target = MathUtils.lerp(SNAKE_HEAD_END_NEAR_LUMINANCE, SNAKE_HEAD_END_LUMINANCE, MathUtils.smoothstep(dist, SNAKE_HEAD_END_NEAR_FROM, SNAKE_HEAD_END_NEAR_TO))
      const l = bloomLuminanceOf(this.color.r, this.color.g, this.color.b)
      this.color.multiplyScalar(l > 1e-6 ? Math.min(SNAKE_HEAD_END_MAX_BOOST, target / l) : SNAKE_HEAD_END_MAX_BOOST)
    } else {
      if (i % 2 === 1) this.color.multiplyScalar(SNAKE_STRIPE_DIM)
      this.color.multiplyScalar(SNAKE_BODY_GLOW_BOOST)
    }
    this.pool.mesh.setColorAt(idx, this.color)
  }

  constructor(scene: Scene, signalCfg: HeadSignalConfig = configJson.headSignal, skin: SnakeSkin = 'classic') {
    this.signalCfg = signalCfg
    this.guides = skin === 'tailGuides' ? new TailGuides(scene) : null
    const geometry = beamGeometry(cubeEdgeSegments(SEGMENT_SCALE / 2), SEGMENT_BEAM)
    const material = new MeshBasicMaterial()
    this.pool = new InstancedPool(scene, geometry, material, 8)

    const headGeometry = beamGeometry(cubeEdgeSegments(SEGMENT_SCALE / 2), SEGMENT_BEAM)
    this.headMaterial = new MeshBasicMaterial({
      color: SNAKE_HEAD_COLOR.clone().multiplyScalar(HEAD_IDLE_BOOST),
      // Outside the fog, like the apple: the head is the signal, and its glow targets (config.palettes.glow) are the luminance the bloom pass sees.
      // With fog (density 0.06, head ~4.7 cells from the chase camera) every head state lost about 8% and a goal head calibrated just above the threshold fell under it.
      fog: false,
    })
    this.headMesh = new Mesh(headGeometry, this.headMaterial)
    this.headMesh.frustumCulled = false
    scene.add(this.headMesh)
    this.scene = scene
  }

  private scene: Scene

  /** Cold path: call from handle() on 'started'/'moved'/'ate'. */
  ensureCapacity(s: GameState): void {
    this.pool.ensureCapacity(Math.max(1, snakeLength(s) - 1))
    this.guides?.ensureCapacity(snakeLength(s))
  }

  /**
   * Frame: no new objects.
   * cam* is the camera position; freeAmount 0..1 is how strongly the fade of nearby
   * segments is enabled.
   */
  update(
    s: GameState,
    camX: number,
    camY: number,
    camZ: number,
    freeAmount: number,
  ): void {
    const length = snakeLength(s)
    this.pool.setCount(Math.max(0, length - 1))
    this.denom = Math.max(1, length - 1)
    this.camX = camX
    this.camY = camY
    this.camZ = camZ
    this.fadeAmount = freeAmount
    this.ensureBuffers(length)
    forEachSnakeSegment(s, this.collect)
    const glide = MathUtils.smoothstep(stepProgress(s), 0, SLIDE_FRACTION)
    for (let i = 0; i < length; i++) this.place(i, length, glide)
    this.pool.markDirty()
    this.guides?.update(length, this.gx, this.gy, this.gz, this.gk, SNAKE_BODY_COLOR, SNAKE_TAIL_COLOR, SNAKE_BODY_GLOW_BOOST, this.denom)

    // The head heading comes from the core and changes instantly on input, without smoothing: the snake is step-based.
    const dir = intendedHeading(s)
    this.headDir.set(dir.x, dir.y, dir.z)
    this.updateSignals(s, dir.x, dir.y, dir.z)
    this.headMesh.position.set(this.headX, this.headY, this.headZ)
  }

  /**
   * Head color and pulse. Danger (a crash within 1..dangerHorizon steps) OVERRIDES the goal (apple straight ahead).
   * Core queries are recomputed only when the step, heading (input) or apple changed; the color transition
   * is smoothed (lights up fast, fades slower), so at high speed the head does not blink on every step.
   */
  private updateSignals(s: GameState, dx: number, dy: number, dz: number): void {
    const a = s.apple
    if (
      s !== this.sigState || s.stepCount !== this.sigStep || dx !== this.sigHx || dy !== this.sigHy || dz !== this.sigHz ||
      a.x !== this.sigAx || a.y !== this.sigAy || a.z !== this.sigAz
    ) {
      this.sigState = s
      this.sigStep = s.stepCount
      this.sigHx = dx
      this.sigHy = dy
      this.sigHz = dz
      this.sigAx = a.x
      this.sigAy = a.y
      this.sigAz = a.z
      const horizon = this.signalCfg.dangerHorizon
      this.crashIn = stepsToCrash(s, horizon)
      this.goal = this.crashIn === 0 && appleOnCourse(s)
    }

    const now = elapsedMs(s)
    const dt = this.lastElapsed < 0 ? 0 : Math.max(0, now - this.lastElapsed)
    this.lastElapsed = now
    const rise = dt / Math.max(1, this.signalCfg.riseMs)
    const fall = dt / Math.max(1, this.signalCfg.fallMs)
    const danger = this.crashIn > 0
    this.dangerAmount = danger ? Math.min(1, this.dangerAmount + rise) : Math.max(0, this.dangerAmount - fall)
    const goalTarget = this.goal && !danger
    this.goalAmount = goalTarget ? Math.min(1, this.goalAmount + rise) : Math.max(0, this.goalAmount - fall)
    // Danger hue: orange at 2 steps, red at 1 step (smooth transition between them).
    this.nearAmount = this.crashIn === 1 ? Math.min(1, this.nearAmount + rise) : Math.max(0, this.nearAmount - fall)

    // Breathing: a smooth sine, absent altogether under prefers-reduced-motion.
    const calm = this.reducedMotion !== null && this.reducedMotion.matches
    const idleWave = calm ? 0 : Math.sin(((now % HEAD_PULSE_PERIOD_MS) / HEAD_PULSE_PERIOD_MS) * Math.PI * 2)
    const dangerWave = calm ? 0 : Math.sin(((now % DANGER_PERIOD_MS) / DANGER_PERIOD_MS) * Math.PI * 2)
    const pulse = MathUtils.lerp(HEAD_PULSE * idleWave, DANGER_PULSE * dangerWave, this.dangerAmount)
    this.headMesh.scale.setScalar((1 + pulse) * MathUtils.lerp(1, this.signalCfg.goalScale, this.goalAmount))

    const c = this.headColor.copy(SNAKE_HEAD_COLOR).multiplyScalar(HEAD_IDLE_BOOST)
    if (this.goalAmount > 0) {
      c.lerp(this.tint.copy(HEAD_GOAL_COLOR).multiplyScalar(HEAD_GOAL_BOOST), this.goalAmount)
    }
    if (this.dangerAmount > 0) {
      this.tint.copy(HEAD_DANGER_COLOR_FAR).lerp(HEAD_DANGER_COLOR_NEAR, this.nearAmount).multiplyScalar(1 + DANGER_BREATH * dangerWave)
      c.lerp(this.tint, this.dangerAmount)
    }
    this.headMaterial.color.copy(c)
  }

  dispose(): void {
    this.pool.dispose()
    this.guides?.dispose()
    this.scene.remove(this.headMesh)
    this.headMesh.geometry.dispose()
    this.headMaterial.dispose()
  }
}
