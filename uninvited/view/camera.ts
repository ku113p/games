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
  /** A hit or a shot: the camera jumps back by `push` m and tips up by `pitch` rad, then settles (view.juice.kickRate). */
  kick(pitch: number, push: number): void
  /** Where the crosshair points: written into out (a world point up to aimRange away). */
  aimPoint(out: Vector3): void
  snap(): void
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
  let userSens = 1
  let invertY = false

  /** How far the boom can reach from the pivot along `back` before the swept sphere touches something. */
  function sweep(max: number): number {
    let best = ray(pivot.x, pivot.y, pivot.z, back.x, back.y, back.z, max)
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
      if (d < best) best = d
    }
    return best
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
      const cp = Math.cos(pitch)
      back.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
      up.crossVectors(back, side).normalize()
      const hit = sweep(wantDist + C.collisionPad)
      const allowed = Math.max(C.minDistance, hit - C.collisionPad)
      // snap in at once (never inside a wall), ease back out slowly - but an aim zoom out in free space follows the
      // aim easing (the boom was at its full length, nothing pulled it in)
      const free = dist >= lastWant - 0.02
      if (allowed < dist || snapping) dist = Math.min(allowed, wantDist)
      else if (free && aimMoving) dist = Math.min(wantDist, allowed)
      else dist += (Math.min(wantDist, allowed) - dist) * Math.min(1, dt * C.easeOutRate)
      lastWant = wantDist

      // the stride bob while sprinting
      const bobY = Math.abs(Math.sin(bobPhase)) * C.bobHeight * sprint * 2 - C.bobHeight * sprint
      const bobS = Math.sin(bobPhase) * C.bobSide * sprint
      want.copy(pivot).addScaledVector(back, dist + kickPush)
      const ox = side.x * bobS + shakeX
      const oy = bobY + shakeY
      const oz = side.z * bobS
      camera.position.set(want.x + ox, want.y + oy, want.z + oz)
      look.set(pivot.x - back.x * 6 + ox, pivot.y - back.y * 6 + oy + kickPitch * 6, pivot.z - back.z * 6 + oz)
      camera.lookAt(look)
      const fov = fovWanted + C.sprintFov * sprint + (AIM.fov - fovWanted) * aimK
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov += (fov - camera.fov) * Math.min(1, dt * (aimMoving ? 40 : 10))
        camera.updateProjectionMatrix()
      }
    },
    kick(pitchKick: number, push: number): void {
      kickPitch = Math.max(kickPitch, pitchKick)
      kickPush = Math.max(kickPush, push)
    },
    aimPoint(out: Vector3): void {
      // along the look of this frame (the mouse was applied before the camera moves), from where the camera stands
      const cp = Math.cos(pitch)
      look.set(Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp)
      const d = ray(camera.position.x, camera.position.y, camera.position.z, look.x, look.y, look.z, C.aimRange)
      out.copy(camera.position).addScaledVector(look, d)
    },
    snap(): void {
      snapNext = true
    },
  }
  return rig
}
