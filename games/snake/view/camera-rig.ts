// Camera, two modes. The pose is ALWAYS derived from the core's truth every frame
// (viewFrame(s), head(s), the mode from game-mode), not from counting events: a missed,
// cancelled or duplicated event repairs itself.
//
// plane (the flat opening): orientation from viewFrame(s), which never changes while the game is flat.
//   Position = center + depth * distance, looking at the center of the cube. The framing (planeDistance) fills the screen width with
//   config.camera.plane.visibleCells cells of the head's layer (or the whole layer, if the arena is smaller) through a narrow
//   field of view, so the layer reads as a flat board. The near and far clipping planes are put just in front of and behind that
//   layer (updateClip): everything at another depth is clipped away, i.e. not drawn at all, whatever it is (obstacles, walls, hints).
//   The tilt is not applied in plane mode (a tilted view would cut the layer at the wrong plane).
//   On the mode change the clipping slab opens outward from the layer over the first config.camera.plane.revealShare of the flight.
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
import { cameraSettings, planeCameraDistance, type CameraSettings } from './camera-config'
import { viewMode, type ViewMode } from './game-mode'

const CAMERA_FOV_DEG = 55
const CAMERA_NEAR = 0.1
const CAMERA_FAR_PADDING = 4 // multiplier of size: margin beyond the far face of the cube
// Half thickness of the slab of the plane view, in cells: a hair under half a cell, so the neighbouring layers' faces,
// which lie exactly on the layer boundary, are on the clipped side (a numeric margin, not balance).
const LAYER_HALF = 0.495
const NO_LAYER_LIMIT = 1e6 // layerReach once everything is shown
const PROJ_UNITS = 1000 // the size of the virtual full image for setViewOffset (only the ratios matter)
const CLIP_EPS = 1e-3 // the clipping planes are re-applied to the projection only when they move by more than this

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

export class CameraRig {
  readonly camera: PerspectiveCamera

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

  // Orientation of the plane view (from the frame; constant while the game is flat).
  private planeQ = new Quaternion()
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
  /** How much of the world beyond the head's layer is shown: 0 in the flat opening (only the layer), 1 once the reveal is done. */
  reveal = 0

  /**
   * How far from the head's layer, along the depth axis, things are drawn: LAYER_HALF in the flat opening, widening with the reveal,
   * NO_LAYER_LIMIT in the game. Same number as the half thickness of the clipping slab; the views that cannot be clipped by the camera
   * (the obstacles' custom shaders) apply it per cell.
   */
  layerReach = NO_LAYER_LIMIT

  private fullFar = 1000
  private projFov = NaN
  private projAspect = NaN
  private projRaise = NaN

  constructor(config: Config) {
    this.settings = cameraSettings(config)
    const zc = config.camera as { zoomFollowMs?: number; zoomMax?: number }
    this.zoomFollowMs = zc.zoomFollowMs ?? ZOOM_FOLLOW_FALLBACK_MS
    this.zoomMax = Math.max(1, zc.zoomMax ?? 1)
    this.camera = new PerspectiveCamera(this.mode === 'plane' ? this.settings.planeFovDeg : CAMERA_FOV_DEG, this.aspect, CAMERA_NEAR, 1000)
  }

  resize(width: number, height: number): void {
    this.aspect = width > 0 && height > 0 ? width / height : 1
    this.camera.aspect = this.aspect
    if (this.size > 0) this.updateFar()
    this.camera.updateProjectionMatrix()
  }

  /** Cold path: jump instantly to the pose of the state, discarding transitions. */
  syncImmediate(s: GameState): void {
    this.applySize(s)
    this.resetTurn()
    this.mode = viewMode(s)
    this.endFlightFov()
    this.readTarget(s, this.planeQ)
    if (this.mode === 'free') {
      this.computeFreeTargets(s)
      this.fPos.copy(this.posT)
      this.fAim.copy(this.aimT)
      this.fUp.copy(this.upT)
      this.freeAmount = 1
      this.reveal = 1
      this.placeFree()
    } else {
      this.freeAmount = 0
      this.reveal = 0
      this.placePlane()
    }
    this.applyProjection(s)
  }

  /** Cold path: reset animations (new game). Does not touch the pose. */
  resetTurn(): void {
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
    this.applyProjection(s)
  }

  /**
   * An add-on on top of the base pose: an orbit around the pivot about the camera's own axes (tilt) and a scaling of the distance
   * from the pivot (zoom). Both catch up to userCamera exponentially, like the camera pose.
   */
  private applyUserCamera(dtMs: number): void {
    const kTilt = 1 - Math.exp(-dtMs / TILT_FOLLOW_MS)
    // Flat opening: no tilt (the slab that hides the other layers is perpendicular to the view axis). What the player asked for
    // is kept in userCamera and catches up smoothly once the camera has left the plane view.
    const lockTilt = this.mode === 'plane' && !this.flying
    this.tiltYaw += ((lockTilt ? 0 : userCamera.yaw) - this.tiltYaw) * kTilt
    this.tiltPitch += ((lockTilt ? 0 : userCamera.pitch) - this.tiltPitch) * kTilt
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

  private updatePlane(_dtMs: number, s: GameState): void {
    // Truth from the core: the frame is constant while the game is flat, so this is a plain read, not a transition.
    this.readTarget(s, this.planeQ)
    this.freeAmount = 0
    this.reveal = 0
    this.placePlane()
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
    this.camera.quaternion.copy(this.planeQ)
    this.offset.set(0, 0, this.planeDistance()).applyQuaternion(this.planeQ)
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
      this.offset.set(0, 0, this.planeDistance()).applyQuaternion(this.flightToQ)
      this.flightToPos.copy(this.center).add(this.offset)
      this.freeAmount = 1 - e
    }
    // The other layers appear from the flat layer outward over the first share of the flight (the flight to free; going back is not used).
    const revealT = MathUtils.smoothstep(t, 0, Math.max(1e-3, this.settings.planeRevealShare))
    this.reveal = this.flightTo === 'free' ? revealT : 1 - revealT

    this.camera.position.lerpVectors(this.flightFromPos, this.flightToPos, e)
    // Sideways arc: the flight is not a straight line but approaches from the side, so the volume reads.
    const swing = Math.sin(Math.PI * t) * this.size * FLIGHT_SWING_FRAC
    this.tmpV.set(1, 0, 0).applyQuaternion(this.flightToQ)
    this.camera.position.addScaledVector(this.tmpV, swing)
    this.camera.quaternion.slerpQuaternions(this.flightFromQ, this.flightToQ, e)

    // The field of view widens from the narrow flat view to the game's own one, plus the kick at mid-flight.
    this.camera.fov = MathUtils.lerp(this.settings.planeFovDeg, CAMERA_FOV_DEG, this.freeAmount) + FLIGHT_FOV_KICK_DEG * Math.sin(Math.PI * t)

    if (!this.flightMidDone && t >= FLIGHT_GLITCH_MID) {
      this.flightMidDone = true
      this.glitchRequested = true
    }

    if (t >= 1) {
      this.flying = false
      this.mode = this.flightTo
      this.endFlightFov()
      if (this.mode === 'plane') {
        this.planeQ.copy(this.flightToQ)
        this.freeAmount = 0
        this.reveal = 0
        this.placePlane()
      } else {
        this.freeAmount = 1
        this.reveal = 1
        this.placeFree()
      }
    }
  }

  /** The field of view of the mode the camera rests in: narrow in plane, the game's own in free. */
  private endFlightFov(): void {
    this.camera.fov = this.mode === 'plane' ? this.settings.planeFovDeg : CAMERA_FOV_DEG
  }

  private applySize(s: GameState): void {
    this.size = cubeSize(s)
    const c = (this.size - 1) / 2
    this.center.set(c, c, c)
    this.updateFar()
    this.endFlightFov()
    this.applyProjection(s)
  }

  private updateFar(): void {
    this.fullFar = this.size * CAMERA_FAR_PADDING + this.planeDistance() * this.zoomMax // zoom pushes the camera back
  }

  /** Distance from the cube center to the camera in the plane view, see planeCameraDistance. */
  private planeDistance(): number {
    return planeCameraDistance(this.size, this.aspect, this.settings)
  }

  /**
   * Field of view and clipping planes, once per frame, no allocations. Free mode: the whole cube. Plane mode: the near and far planes
   * are the faces of the head's layer, so anything at another depth is clipped away (not drawn, not dimmed). While the mode
   * changes the slab widens with `reveal` (0 - one layer, 1 - the whole cube), measured along the view axis from the layer.
   */
  private applyProjection(s: GameState): void {
    let near = CAMERA_NEAR
    let far = this.fullFar
    this.layerReach = NO_LAYER_LIMIT
    if (this.reveal < 1) {
      const h = head(s)
      const cam = this.camera
      this.tmpV.set(0, 0, -1).applyQuaternion(cam.quaternion) // the view direction
      const toLayer = (h.x - cam.position.x) * this.tmpV.x + (h.y - cam.position.y) * this.tmpV.y + (h.z - cam.position.z) * this.tmpV.z
      const half = LAYER_HALF + this.reveal * this.size
      this.layerReach = half
      near = Math.max(CAMERA_NEAR, toLayer - half)
      far = Math.min(this.fullFar, toLayer + half)
      if (far <= near) far = near + CLIP_EPS
    }
    const cam = this.camera
    // Portrait, flat opening: the board is moved up the screen (an off-axis view, the slab is unaffected); eases out with the flight.
    const raise = this.aspect < 1 ? this.settings.planeRaise * (1 - this.freeAmount) : 0
    if (
      Math.abs(cam.near - near) > CLIP_EPS || Math.abs(cam.far - far) > CLIP_EPS ||
      this.projFov !== cam.fov || this.projAspect !== cam.aspect || Math.abs(this.projRaise - raise) > CLIP_EPS
    ) {
      cam.near = near
      cam.far = far
      this.projFov = cam.fov
      this.projAspect = cam.aspect
      this.projRaise = raise
      if (raise > CLIP_EPS) cam.setViewOffset(PROJ_UNITS * cam.aspect, PROJ_UNITS, 0, raise * PROJ_UNITS, PROJ_UNITS * cam.aspect, PROJ_UNITS)
      else cam.clearViewOffset()
      cam.updateProjectionMatrix()
    }
  }
}
