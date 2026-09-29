// Camera, two modes. The pose is ALWAYS derived from the core's truth every frame
// (viewFrame(s), head(s), the mode from game-mode), not from counting events: a missed,
// cancelled or duplicated event repairs itself.
//
// plane: orientation from viewFrame(s); if the frame changed, a transition
//   "current orientation -> target" (micro-pause, then a slerp over config.camera.rollMs).
//   Position = center + depth * distance, looking at the center of the cube.
// free: the camera sits followDistance behind the head (along -heading = +depth),
//   shifted lateralOffset to the right (frame.right), raised by followHeight
//   (frame.up), looking at a point lookAheadDistance ahead of the head along the heading and lookDownOffset below the line of travel (-up).
//   The targets (position, look-at point, up, head) are recomputed from the core's truth every
//   frame; the shown pose follows them with an exponential catch-up (FOLLOW_SMOOTHING_ENABLED,
//   currently on, time constant FOLLOW_SMOOTH_MS), so the camera does not jerk on every step.
//   With the flag off the pose is taken straight from the targets (a rigid lock to the
//   heading vector, no inertia).
// The player's tilt is an add-on on top of this pose (an orbit around the same smoothed head); the
// base is not shifted by it and does not lose the vector.
// Mode change (detected from state, the modeChanged event is not needed): a flight over
//   config.camera.modeSwitchMs from the pose actually shown to the live target
//   pose of the new mode: smootherstep, a sideways arc (swing), a FOV widening,
//   two glitch requests (start and midpoint). If the mode changes in the middle of
//   a flight, a new flight starts from the current pose. Allocation-free per frame.

import { PerspectiveCamera, Vector3, Quaternion, Matrix4, MathUtils } from 'three'
import type { GameState } from '../core/state'
import { viewFrame, cubeSize, head } from '../core/queries'
import type { Config } from '../core/rules'
import { cameraSettings, type CameraSettings } from './camera-config'
import { viewMode, type ViewMode } from './game-mode'

const CAMERA_FOV_DEG = 55
const CAMERA_NEAR = 0.1
const CAMERA_FAR_PADDING = 4 // multiplier of size: margin beyond the far face of the cube
// Quaternions of the same orientation have |dot| close to 1. The threshold is a numeric tolerance, not balance.
const SAME_ORIENTATION_DOT = 1 - 1e-6

// Styling constants for the flight and follow (not balance numbers).
// Smoothing of the free camera following the head. Currently ON: the shown pose lags the
// targets computed from the state (see updateFree). Set it to false for a rigid lock, where
// the pose is taken straight from the state with no inertia.
const FOLLOW_SMOOTHING_ENABLED = true
const FOLLOW_SMOOTH_MS = 130 // time constant of the exponential catch-up (used only while FOLLOW_SMOOTHING_ENABLED)
const FLIGHT_FOV_KICK_DEG = 22 // how many degrees wider the FOV gets at mid-flight
const FLIGHT_SWING_FRAC = 0.35 // sideways arc of the flight, as a fraction of the cube size
const FLIGHT_GLITCH_MID = 0.5 // fraction of the flight at which the second glitch fires

// Player tilt (mouse / two fingers): an add-on on top of the base pose, an orbit
// around the head (in plane mode, around the cube center). Styling constants.
const TILT_MAX = 1 // rad, limit per axis (< 90 degrees: the camera does not flip over)
const TILT_FOLLOW_MS = 90 // smoothing toward the requested tilt
const TILT_EPS = 1e-4
const ZOOM_EPS = 1e-4
const ZOOM_FOLLOW_FALLBACK_MS = 120 // used when config.camera has no zoomFollowMs

/**
 * The camera as the player set it: tilt (rad, +/-TILT_MAX), zoom is a multiplier of the distance from the head
 * (1 is exactly the view configured in config.camera; < 1 closer, > 1 farther). It stays until explicitly reset
 * (resetUserCamera) and does not return by itself. A module-level shared object rather than a View field: main.ts writes it from input,
 * the rig reads it every frame (allocation-free); the rig is recreated for each game, while main resets this object
 * at game start. The zoom limits (config.camera.zoomMin/zoomMax) are clamped by whoever writes.
 */
export const userCamera = { yaw: 0, pitch: 0, zoom: 1 }

export function resetUserCamera(): void {
  userCamera.yaw = 0
  userCamera.pitch = 0
  userCamera.zoom = 1
}

type Phase = 'idle' | 'pause' | 'rolling'

export class CameraRig {
  readonly camera: PerspectiveCamera

  private cameraConfig: Config['camera']
  private settings: CameraSettings
  private aspect = 1
  private size = -1

  private center = new Vector3()
  private offset = new Vector3()
  private basis = new Matrix4()
  private lookM = new Matrix4()
  private tmpRight = new Vector3()
  private tmpUp = new Vector3()
  private tmpDepth = new Vector3()

  private fromQ = new Quaternion()
  private toQ = new Quaternion()
  private curQ = new Quaternion()
  private nextQ = new Quaternion()

  private phase: Phase = 'idle'
  private pauseElapsed = 0
  private rollElapsed = 0
  private glitchRequested = false

  // The mode the camera "lives" in (or is flying to).
  private mode: ViewMode = 'plane'
  private flying = false
  private flightElapsed = 0
  private flightMidDone = false
  private flightFromPos = new Vector3()
  private flightFromQ = new Quaternion()
  private flightToPos = new Vector3()
  private flightToQ = new Quaternion()

  // Smoothed state of the free camera, and its targets.
  private fPos = new Vector3()
  private fAim = new Vector3()
  /** The head, smoothed by the same catch-up as the pose. The orbit center of the tilt:
   *  the raw head cell jumps instantly while the pose lags behind,
   *  so the camera would rotate around an out-of-sync point and lose the vector. */
  private fHead = new Vector3()
  private headT = new Vector3()
  private fUp = new Vector3(0, 1, 0)
  private posT = new Vector3()
  private aimT = new Vector3()
  private upT = new Vector3()
  private fwdT = new Vector3()
  private tmpV = new Vector3()

  private tiltYaw = 0
  private tiltPitch = 0
  private zoom = 1
  private zoomFollowMs: number
  private zoomMax: number
  private tiltPivot = new Vector3()
  private tiltAxis = new Vector3()
  private tiltQ = new Quaternion()
  private tiltQ2 = new Quaternion()

  /** 0 is plane mode, 1 is fully free (for fading the near segments). */
  freeAmount = 0

  constructor(config: Config) {
    this.cameraConfig = config.camera
    this.settings = cameraSettings(config)
    const zc = config.camera as { zoomFollowMs?: number; zoomMax?: number }
    this.zoomFollowMs = zc.zoomFollowMs ?? ZOOM_FOLLOW_FALLBACK_MS
    this.zoomMax = Math.max(1, zc.zoomMax ?? 1)
    this.camera = new PerspectiveCamera(CAMERA_FOV_DEG, this.aspect, CAMERA_NEAR, 1000)
  }

  resize(width: number, height: number): void {
    this.aspect = width > 0 && height > 0 ? width / height : 1
    this.camera.aspect = this.aspect
    this.camera.updateProjectionMatrix()
  }

  /** Cold path: jump instantly to the pose of the state, discarding transitions. */
  syncImmediate(s: GameState): void {
    this.applySize(s)
    this.resetTurn()
    this.mode = viewMode(s)
    this.readTarget(s, this.toQ)
    this.curQ.copy(this.toQ)
    this.fromQ.copy(this.toQ)
    if (this.mode === 'free') {
      this.computeFreeTargets(s)
      this.fPos.copy(this.posT)
      this.fAim.copy(this.aimT)
      this.fUp.copy(this.upT)
      this.freeAmount = 1
      this.placeFree()
    } else {
      this.freeAmount = 0
      this.placePlane()
    }
  }

  /** Cold path: reset animations (new game). Does not touch the pose. */
  resetTurn(): void {
    this.phase = 'idle'
    this.pauseElapsed = 0
    this.rollElapsed = 0
    this.glitchRequested = false
    this.flying = false
    this.flightElapsed = 0
    this.endFlightFov()
  }

  /** true once, when a glitch should be started (start of a roll, start and midpoint of a flight). */
  consumeGlitchRequest(): boolean {
    const value = this.glitchRequested
    this.glitchRequested = false
    return value
  }

  /** Set the camera tilt (rad, +/-1). Holds until reset (userCamera). Kept for compatibility with View. */
  setTilt(yaw: number, pitch: number): void {
    userCamera.yaw = MathUtils.clamp(yaw, -TILT_MAX, TILT_MAX)
    userCamera.pitch = MathUtils.clamp(pitch, -TILT_MAX, TILT_MAX)
  }

  /** Per frame: no allocations. */
  update(dtMs: number, s: GameState): void {
    if (cubeSize(s) !== this.size) this.applySize(s)

    const mode = viewMode(s)
    if (this.flying ? mode !== this.flightTo : mode !== this.mode) {
      this.startFlight(mode)
    }

    if (this.flying) {
      this.updateFlight(dtMs, s)
    } else if (this.mode === 'free') {
      this.updateFree(dtMs, s)
    } else {
      this.updatePlane(dtMs, s)
    }
    this.applyUserCamera(dtMs)
  }

  /**
   * An add-on on top of the base pose: an orbit around the pivot about the camera's own axes (tilt) and a scaling of the distance
   * from the pivot (zoom). Both catch up to userCamera exponentially, like the camera pose.
   */
  private applyUserCamera(dtMs: number): void {
    const kTilt = 1 - Math.exp(-dtMs / TILT_FOLLOW_MS)
    this.tiltYaw += (userCamera.yaw - this.tiltYaw) * kTilt
    this.tiltPitch += (userCamera.pitch - this.tiltPitch) * kTilt
    const kZoom = 1 - Math.exp(-dtMs / Math.max(1, this.zoomFollowMs))
    this.zoom += (userCamera.zoom - this.zoom) * kZoom
    const tilted = Math.abs(this.tiltYaw) >= TILT_EPS || Math.abs(this.tiltPitch) >= TILT_EPS
    const zoomed = Math.abs(this.zoom - 1) >= ZOOM_EPS
    if (!tilted && !zoomed) return

    // The orbit center comes from the same smoothed source as the camera pose.
    this.tiltPivot.copy(this.fHead).lerp(this.center, 1 - this.freeAmount)
    this.tmpV.copy(this.camera.position).sub(this.tiltPivot)
    if (tilted) {
      const cq = this.camera.quaternion
      this.tiltAxis.set(0, 1, 0).applyQuaternion(cq)
      this.tiltQ.setFromAxisAngle(this.tiltAxis, this.tiltYaw)
      this.tiltAxis.set(1, 0, 0).applyQuaternion(cq)
      this.tiltQ2.setFromAxisAngle(this.tiltAxis, this.tiltPitch)
      this.tiltQ.multiply(this.tiltQ2)
      this.tmpV.applyQuaternion(this.tiltQ)
      cq.premultiply(this.tiltQ)
    }
    // Zoom multiplies the base distance (rather than replacing it): 1 is exactly the view set in the config.
    if (zoomed) this.tmpV.multiplyScalar(this.zoom)
    this.camera.position.copy(this.tiltPivot).add(this.tmpV)
  }

  // ---- plane ----

  private updatePlane(dtMs: number, s: GameState): void {
    // Truth from the core.
    this.readTarget(s, this.nextQ)
    if (Math.abs(this.nextQ.dot(this.toQ)) < SAME_ORIENTATION_DOT) {
      this.toQ.copy(this.nextQ)
      this.fromQ.copy(this.curQ)
      this.rollElapsed = 0
      this.pauseElapsed = 0
      if (this.phase === 'rolling') {
        // Already rolling: do not stall with a micro-pause, keep going toward the new target.
        this.beginRolling()
      } else {
        this.phase = 'pause'
      }
    }

    if (this.phase === 'pause') {
      this.pauseElapsed += dtMs
      if (this.pauseElapsed >= this.cameraConfig.microPauseMs) {
        this.rollElapsed = this.pauseElapsed - this.cameraConfig.microPauseMs
        this.beginRolling()
      }
    } else if (this.phase === 'rolling') {
      this.rollElapsed += dtMs
    }

    if (this.phase === 'rolling') {
      const t = Math.min(this.rollElapsed / this.cameraConfig.rollMs, 1)
      if (t >= 1) {
        this.curQ.copy(this.toQ)
        this.phase = 'idle'
      } else {
        this.curQ.slerpQuaternions(this.fromQ, this.toQ, MathUtils.smootherstep(t, 0, 1))
      }
    } else if (this.phase === 'idle') {
      this.curQ.copy(this.toQ)
    }
    this.freeAmount = 0
    this.placePlane()
  }

  private beginRolling(): void {
    if (this.phase !== 'rolling') this.glitchRequested = true
    this.phase = 'rolling'
  }

  private readTarget(s: GameState, out: Quaternion): void {
    const f = viewFrame(s)
    this.tmpRight.set(f.right.x, f.right.y, f.right.z)
    this.tmpUp.set(f.up.x, f.up.y, f.up.z)
    this.tmpDepth.set(f.depth.x, f.depth.y, f.depth.z)
    this.basis.makeBasis(this.tmpRight, this.tmpUp, this.tmpDepth)
    out.setFromRotationMatrix(this.basis)
  }

  private placePlane(): void {
    this.camera.quaternion.copy(this.curQ)
    this.offset.set(0, 0, this.distanceFor(this.size)).applyQuaternion(this.curQ)
    this.camera.position.copy(this.center).add(this.offset)
  }

  // ---- free ----

  /** Targets of the free camera from the truth: the head, and the frame's depth (= -heading) and up. */
  private computeFreeTargets(s: GameState): void {
    const f = viewFrame(s)
    const h = head(s)
    this.fwdT.set(-f.depth.x, -f.depth.y, -f.depth.z)
    this.upT.set(f.up.x, f.up.y, f.up.z)
    this.tmpRight.set(f.right.x, f.right.y, f.right.z)
    // The camera sits slightly to the right of the line of travel and looks at a point far ahead on the snake's
    // line: the view axis and the heading vector converge, so the wall ahead reads through
    // perspective rather than "suddenly hitting you".
    this.posT
      .set(h.x, h.y, h.z)
      .addScaledVector(this.fwdT, -this.settings.followDistance)
      .addScaledVector(this.tmpRight, this.settings.lateralOffset)
      .addScaledVector(this.upT, this.settings.followHeight)
    this.aimT.set(h.x, h.y, h.z).addScaledVector(this.fwdT, this.settings.lookAheadDistance)
      .addScaledVector(this.upT, -this.settings.lookDownOffset)
    this.headT.set(h.x, h.y, h.z)
  }

  private updateFree(dtMs: number, s: GameState): void {
    this.computeFreeTargets(s)
    if (FOLLOW_SMOOTHING_ENABLED) {
      const k = 1 - Math.exp(-dtMs / FOLLOW_SMOOTH_MS)
      this.fPos.lerp(this.posT, k)
      this.fAim.lerp(this.aimT, k)
      this.fUp.lerp(this.upT, k).normalize()
      this.fHead.lerp(this.headT, k)
    } else {
      this.fPos.copy(this.posT)
      this.fAim.copy(this.aimT)
      this.fUp.copy(this.upT)
      this.fHead.copy(this.headT)
    }
    this.freeAmount = 1
    this.placeFree()
  }

  private placeFree(): void {
    this.camera.position.copy(this.fPos)
    this.lookM.lookAt(this.fPos, this.fAim, this.fUp)
    this.camera.quaternion.setFromRotationMatrix(this.lookM)
  }

  // ---- transition between modes ----

  private flightTo: ViewMode = 'plane'

  private startFlight(target: ViewMode): void {
    this.flightFromPos.copy(this.camera.position)
    this.flightFromQ.copy(this.camera.quaternion)
    this.flightTo = target
    this.flying = true
    this.flightElapsed = 0
    this.flightMidDone = false
    this.phase = 'idle'
    this.glitchRequested = true
  }

  private updateFlight(dtMs: number, s: GameState): void {
    this.flightElapsed += dtMs
    const t = Math.min(this.flightElapsed / Math.max(1, this.settings.modeSwitchMs), 1)
    const e = MathUtils.smootherstep(t, 0, 1)

    // Live target of the new mode: if the head moves during the flight, the camera still arrives where it should.
    if (this.flightTo === 'free') {
      this.computeFreeTargets(s)
      this.fPos.copy(this.posT)
      this.fAim.copy(this.aimT)
      this.fUp.copy(this.upT)
      this.flightToPos.copy(this.posT)
      this.lookM.lookAt(this.posT, this.aimT, this.upT)
      this.flightToQ.setFromRotationMatrix(this.lookM)
      this.freeAmount = e
    } else {
      this.readTarget(s, this.flightToQ)
      this.offset.set(0, 0, this.distanceFor(this.size)).applyQuaternion(this.flightToQ)
      this.flightToPos.copy(this.center).add(this.offset)
      this.freeAmount = 1 - e
    }

    this.camera.position.lerpVectors(this.flightFromPos, this.flightToPos, e)
    // Sideways arc: the flight is not a straight line but approaches from the side, so the volume reads.
    const swing = Math.sin(Math.PI * t) * this.size * FLIGHT_SWING_FRAC
    this.tmpV.set(1, 0, 0).applyQuaternion(this.flightToQ)
    this.camera.position.addScaledVector(this.tmpV, swing)
    this.camera.quaternion.slerpQuaternions(this.flightFromQ, this.flightToQ, e)

    this.camera.fov = CAMERA_FOV_DEG + FLIGHT_FOV_KICK_DEG * Math.sin(Math.PI * t)
    this.camera.updateProjectionMatrix()

    if (!this.flightMidDone && t >= FLIGHT_GLITCH_MID) {
      this.flightMidDone = true
      this.glitchRequested = true
    }

    if (t >= 1) {
      this.flying = false
      this.mode = this.flightTo
      this.endFlightFov()
      if (this.mode === 'plane') {
        this.toQ.copy(this.flightToQ)
        this.curQ.copy(this.flightToQ)
        this.fromQ.copy(this.flightToQ)
        this.freeAmount = 0
        this.placePlane()
      } else {
        this.freeAmount = 1
        this.placeFree()
      }
    }
  }

  private endFlightFov(): void {
    if (this.camera.fov !== CAMERA_FOV_DEG) {
      this.camera.fov = CAMERA_FOV_DEG
      this.camera.updateProjectionMatrix()
    }
  }

  private applySize(s: GameState): void {
    this.size = cubeSize(s)
    const c = (this.size - 1) / 2
    this.center.set(c, c, c)
    this.camera.far = this.size * CAMERA_FAR_PADDING + this.distanceFor(this.size) * this.zoomMax // zoom pushes the camera back
    this.camera.near = CAMERA_NEAR
    this.camera.updateProjectionMatrix()
  }

  private distanceFor(size: number): number {
    // In portrait (aspect < 1) we move the camera back so the cube is not cropped
    // horizontally; distanceFactor is the only number from the config.
    return (size * this.cameraConfig.distanceFactor) / Math.min(this.aspect, 1)
  }
}
