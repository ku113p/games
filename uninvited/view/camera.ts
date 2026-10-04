// Third-person camera: orbits behind the hero over the right shoulder and never goes through the level.
// Collision rays come from outside (main.ts passes the physics adapter's raycast) - the view never imports adapters.
//
// Collision: the shoulder offset is cast from the hero's head (so a wall at your right pulls the camera behind you),
// then the boom is swept backwards as five parallel rays (centre + up/down/left/right at collisionRadius) - a cheap
// sphere cast. The camera snaps in to whatever the sweep allows (it can never sit inside a wall, a niche roof or a
// ramp) and eases back out slowly. A sprint widens the FOV a little and bobs the camera with the stride.
// Aiming (RMB) eases the camera in over ~0.15 s: closer, a narrower FOV, the hero further left of the centre (over the
// right shoulder), a slower mouse; the collision works the same.
import { Vector3, type PerspectiveCamera } from 'three'
import cfgAll from '../config.json'

const C = cfgAll.view.camera
const AIM = C.aim
const J = cfgAll.view.juice
const T = J.trauma
const DEG = Math.PI / 180
const WALK = cfgAll.player.walkSpeed
const RUN = cfgAll.player.runSpeed

/** Distance along a normalized direction to the first static hit, or maxDist. */
export type RayFn = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number) => number

export interface CameraRig {
  yaw: number
  pitch: number
  /** The player's mouse sensitivity multiplier (settings, 0.3-2.0). */
  sensitivity: number
  /** Mouse up looks down (settings). */
  invertY: boolean
  /** Mouse movement in pixels. */
  look(dx: number, dy: number): void
  /** Places the camera; shake is an offset in metres. `aiming` eases the aim framing in or out. */
  update(dt: number, px: number, py: number, pz: number, crouched: boolean, fovWanted: number, shakeX: number, shakeY: number, aiming?: boolean): void
  /** 0..1 how far into the aim framing (eased). */
  readonly aim: number
  /**
   * A hit or a shot: the view tips up by `pitch` rad (and turns by `yaw` rad) and the camera jumps back by `push` m, then settles
   * (view.juice.kickRate). The punch is only a rotation of the picture: aimPoint() reads yaw/pitch, never the camera's own
   * orientation, so it never moves the shot.
   */
  kick(pitch: number, push: number, yaw?: number): void
  /** A short FOV punch in degrees (negative: punch in, positive: out); decays by itself, the aim FOV stays the base. */
  fovKick(deg: number): void
  /** Adds shake trauma (0..1, capped by view.juice.trauma.cap): rotational shake of strength trauma^2 that decays by itself. */
  trauma(amount: number): void
  /** Settings "reduce shake/flash": the punches shrink to view.juice.reducedPunch and the trauma shake is off. */
  reduced: boolean
  /** Where the crosshair points: written into out (a world point up to aimRange away). */
  aimPoint(out: Vector3, pick?: (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) => number): void
  snap(): void
}

/** Smooth 1D noise in -1..1: a few sines at unrelated rates (a cheap stand-in for Perlin noise), one set per axis. */
const NOISE_RATES = [
  [71, 43, 19],
  [59, 31, 23],
  [47, 29, 17],
]
function noise(t: number, axis: number): number {
  const r = NOISE_RATES[axis] as number[]
  return (Math.sin(t * (r[0] as number) + axis * 1.7) * 0.5 + Math.sin(t * (r[1] as number) + axis * 4.1) * 0.3 + Math.sin(t * (r[2] as number) + axis) * 0.2) 
}

export function createCameraRig(camera: PerspectiveCamera, ray: RayFn, startYaw: number): CameraRig {
  let yaw = startYaw
  let pitch = C.startPitch
  const head = new Vector3()
  const pivot = new Vector3()
  const want = new Vector3()
  const back = new Vector3()
  const side = new Vector3()
  const up = new Vector3()
  const look = new Vector3()
  let height = C.pivotHeight
  let dist = C.distance
  let shoulder = C.shoulder
  let snapNext = true
  let lastX = 0
  let lastZ = 0
  let sprint = 0
  let bobPhase = 0
  /** Linear 0..1 towards the aim framing, and its smoothstep. */
  let aimT = 0
  let aimK = 0
  /** The boom length the last frame wanted (to tell a collision pull-in from an aim zoom). */
  let lastWant = C.distance
  /** The kick: pitch (rad) and push (m), both eased back to 0. */
  let kickPitch = 0
  let kickPush = 0
  let kickYaw = 0
  /** The FOV punches (deg): in (<= 0) and out (>= 0), and the smoothed base FOV. */
  let fovIn = 0
  let fovOut = 0
  let fovBase = 0
  let traumaV = 0
  let reduced = false
  let shakeTime = 0
  let obstructT = 0
  let userSens = 1
  let invertY = false

  /** How far the boom can reach from the pivot along `back` before the swept sphere touches something. */
  const sweepD = [0, 0, 0, 0, 0]
  function sweep(max: number): number {
    sweepD[0] = ray(pivot.x, pivot.y, pivot.z, back.x, back.y, back.z, max)
    const r = C.collisionRadius
    for (let k = 0; k < 4; k++) {
      const ox = k < 2 ? side.x : up.x
      const oy = k < 2 ? side.y : up.y
      const oz = k < 2 ? side.z : up.z
      const sgn = (k & 1) === 0 ? 1 : -1
      // offset the ray sideways, but not into a wall right next to the pivot
      const room = ray(pivot.x, pivot.y, pivot.z, ox * sgn, oy * sgn, oz * sgn, r + 0.05)
      const o = Math.max(0, Math.min(r, room - 0.05))
      const d = ray(pivot.x + ox * sgn * o, pivot.y + oy * sgn * o, pivot.z + oz * sgn * o, back.x, back.y, back.z, max)
      sweepD[k + 1] = d
    }
    // the second-shortest of the five: an obstacle that only one ray touches (a rail, a thin column, the graze of a wall the boom
    // runs along) does not pull the camera in; a wall or a corner blocks at least two
    let m1 = Infinity
    let m2 = Infinity
    for (let k = 0; k < 5; k++) {
      const d = sweepD[k] as number
      if (d < m1) {
        m2 = m1
        m1 = d
      } else if (d < m2) m2 = d
    }
    return m2
  }

  const rig: CameraRig = {
    get yaw() {
      return yaw
    },
    set yaw(v: number) {
      yaw = v
    },
    get pitch() {
      return pitch
    },
    set pitch(v: number) {
      pitch = v
    },
    get aim() {
      return aimK
    },
    get sensitivity() {
      return userSens
    },
    set sensitivity(v: number) {
      userSens = v
    },
    get reduced() {
      return reduced
    },
    set reduced(v: boolean) {
      reduced = v
    },
    get invertY() {
      return invertY
    },
    set invertY(v: boolean) {
      invertY = v
    },
    look(dx: number, dy: number): void {
      const sens = C.sensitivity * userSens * (1 + (AIM.sensitivity - 1) * aimK)
      yaw -= dx * sens
      pitch = Math.min(C.maxPitch, Math.max(C.minPitch, pitch + dy * sens * (invertY ? -1 : 1)))
    },
    update(dt, px, py, pz, crouched, fovWanted, shakeX, shakeY, aiming = false): void {
      const snapping = snapNext
      snapNext = false
      const k = snapping ? 1 : Math.min(1, dt * C.followLerp)
      const ky = snapping ? 1 : Math.min(1, dt * C.followLerpY)
      aimT = Math.max(0, Math.min(1, aimT + (aiming ? 1 : -1) * (dt / AIM.easeSec)))
      aimK = aimT * aimT * (3 - 2 * aimT)
      const aimMoving = aimT > 0 && aimT < 1
      height += ((crouched ? C.crouchPivotHeight : C.pivotHeight) - AIM.pivotDrop * aimK - height) * (snapping ? 1 : Math.min(1, dt * 10))
      const baseDist = crouched ? C.crouchDistance : C.distance
      const aimDist = crouched ? AIM.crouchDistance : AIM.distance
      const wantDist = baseDist + (aimDist - baseDist) * aimK
      const wantShoulder = C.shoulder + (AIM.shoulder - C.shoulder) * aimK

      // the sprint feel: speed from the hero's own movement (teleports and pauses ignored)
      const moved = Math.hypot(px - lastX, pz - lastZ)
      lastX = px
      lastZ = pz
      const speed = !snapping && dt > 0 && moved < 1 ? moved / dt : 0
      const sprintWant = Math.max(0, Math.min(1, (speed - WALK - 0.4) / Math.max(0.1, RUN - WALK - 0.8)))
      sprint += (sprintWant - sprint) * Math.min(1, dt * C.sprintFovRate)
      if (moved < 1) bobPhase += (moved / C.bobStride) * Math.PI

      // the head: follows the hero (a little softer vertically, for steps and landings)
      head.x += (px - head.x) * k
      head.z += (pz - head.z) * k
      head.y += (py + height - head.y) * ky
      if (snapping) head.set(px, py + height, pz)

      // the shoulder offset, cast from the head so it never pokes into a wall at your right
      side.set(-Math.cos(yaw), 0, Math.sin(yaw))
      const roomRight = ray(head.x, head.y, head.z, side.x, 0, side.z, wantShoulder + C.collisionRadius)
      const shoulderMax = Math.max(0, Math.min(wantShoulder, roomRight - C.collisionRadius))
      // pulled in by a wall: at once; the aim easing out: follows it; otherwise eases back out slowly
      const shoulderFree = shoulder >= Math.min(C.shoulder, AIM.shoulder) - 0.01 && roomRight - C.collisionRadius >= wantShoulder
      shoulder = shoulderMax < shoulder || snapping || (aimMoving && shoulderFree) ? shoulderMax : shoulder + (shoulderMax - shoulder) * Math.min(1, dt * C.easeOutRate)
      pivot.set(head.x + side.x * shoulder, head.y, head.z + side.z * shoulder)

      // the boom: behind (opposite the look) and up by the pitch, swept against the level
      const kr = Math.exp(-dt * J.kickRate)
      kickPitch *= kr
      kickPush *= kr
      kickYaw *= kr
      fovIn *= Math.exp(-dt * J.fovPunch.inRate)
      fovOut *= Math.exp(-dt * J.fovPunch.outRate)
      traumaV = Math.max(0, traumaV - dt * T.decay)
      // the boom is decoupled from the look: the look pitch goes up to minPitch, the boom's own elevation stops where the camera
      // would sink below floorClearance over the floor under the hero, and past that the boom also shortens (the camera slides
      // closer and lower along the floor) while only the look keeps rotating up
      const rise = Math.max(0, pivot.y - py)
      const boomMin = -Math.asin(Math.max(0, Math.min(0.95, (rise - C.floorClearance) / wantDist)))
      const boomPitch = Math.max(pitch, boomMin)
      const extra = Math.max(0, boomPitch - pitch)
      const closeK = Math.min(1, extra / C.lookUpCloseRange)
      const boomWant = wantDist * (1 - C.lookUpCloseness * closeK * closeK * (3 - 2 * closeK))
      const cp = Math.cos(boomPitch)
      back.set(-Math.sin(yaw) * cp, Math.sin(boomPitch), -Math.cos(yaw) * cp)
      up.crossVectors(back, side).normalize()
      const hit = sweep(boomWant + C.collisionPad)
      const allowed = Math.max(C.minDistance, hit - C.collisionPad)
      // snap in at once (never inside a wall), ease back out slowly - but an aim zoom out in free space follows the
      // aim easing (the boom was at its full length, nothing pulled it in)
      const free = dist >= lastWant - 0.02
      const target = Math.min(boomWant, allowed)
      if (allowed < boomWant - 0.02) obstructT = C.releaseHoldSec
      else obstructT = Math.max(0, obstructT - dt)
      if (snapping) dist = target
      else if (target < dist) {
        // pulled in fast but not in one frame (a few frames), never farther than the slack past the allowed length
        dist = Math.max(target, Math.min(dist + (target - dist) * Math.min(1, dt * C.pullInRate), target + C.pullInSlack))
      } else if (free && aimMoving) dist = target
      else if (obstructT <= 0) dist += (target - dist) * Math.min(1, dt * C.easeOutRate)
      // else: just passed an obstacle - hold the short boom a moment before easing out (no pop in, drift out, pop in)
      lastWant = boomWant

      // the stride bob while sprinting
      const bobY = Math.abs(Math.sin(bobPhase)) * C.bobHeight * sprint * 2 - C.bobHeight * sprint
      const bobS = Math.sin(bobPhase) * C.bobSide * sprint
      want.copy(pivot).addScaledVector(back, dist + kickPush)
      const ox = side.x * bobS + shakeX
      const oy = bobY + shakeY
      const oz = side.z * bobS
      camera.position.set(want.x + ox, want.y + oy, want.z + oz)
      // the view axis follows the full look pitch (it equals the boom's direction until the boom is clamped)
      const lp = Math.cos(pitch)
      look.set(camera.position.x + Math.sin(yaw) * lp * 6, camera.position.y - Math.sin(pitch) * 6, camera.position.z + Math.cos(yaw) * lp * 6)
      camera.lookAt(look)
      // the rotational feel (view only): the shot punch and the trauma shake turn the picture, never the aim
      const shk = reduced ? 0 : traumaV * traumaV
      if (kickPitch !== 0 || kickYaw !== 0 || shk > 1e-6) {
        const t = shakeTime
        camera.rotateX(kickPitch + shk * T.pitchDeg * DEG * noise(t, 0))
        camera.rotateY(kickYaw + shk * T.yawDeg * DEG * noise(t, 1))
        if (shk > 1e-6) camera.rotateZ(shk * T.rollDeg * DEG * noise(t, 2))
      }
      shakeTime += dt
      // the FOV: the base eases (aim, sprint, dash; capped), the punches are added at once
      const base = Math.min(C.fovMax, fovWanted + C.sprintFov * sprint) + (AIM.fov - Math.min(C.fovMax, fovWanted + C.sprintFov * sprint)) * aimK
      fovBase = fovBase === 0 || snapping ? base : fovBase + (base - fovBase) * Math.min(1, dt * (aimMoving ? 40 : 10))
      const fov = fovBase + fovIn + fovOut
      if (Math.abs(camera.fov - fov) > 0.02) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    },
    kick(pitchKick: number, push: number, yaw = 0): void {
      const k = reduced ? J.reducedPunch : 1
      kickPitch = Math.max(kickPitch, pitchKick * k)
      kickPush = Math.max(kickPush, push * k)
      if (Math.abs(yaw) * k > Math.abs(kickYaw)) kickYaw = yaw * k
    },
    fovKick(deg: number): void {
      const k = reduced ? J.reducedPunch : 1
      if (deg < 0) fovIn = Math.max(J.fovPunch.shotMaxDeg, fovIn + deg * k)
      else fovOut = Math.max(fovOut, deg * k)
    },
    trauma(amount: number): void {
      if (!reduced) traumaV = Math.min(T.cap, traumaV + amount)
    },
    aimPoint(out: Vector3, pick?: (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) => number): void {
      // along the look of this frame (the mouse was applied before the camera moves), from where the camera stands
      const cp = Math.cos(pitch)
      look.set(Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp)
      let d = ray(camera.position.x, camera.position.y, camera.position.z, look.x, look.y, look.z, C.aimRange)
      // a target under the crosshair in front of the wall: aim at it, not at the wall behind (the muzzle is off the camera's line)
      const t = pick ? pick(camera.position.x, camera.position.y, camera.position.z, look.x, look.y, look.z, d) : -1
      if (t >= 0) d = t
      out.copy(camera.position).addScaledVector(look, d)
    },
    snap(): void {
      snapNext = true
    },
  }
  return rig
}
