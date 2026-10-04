// Third-person camera: orbits behind the hero over the right shoulder, pulled in when a wall is in the way.
// Collision rays come from outside (main.ts passes the physics adapter's raycast) - the view never imports adapters.
import { Vector3, type PerspectiveCamera } from 'three'
import cfgAll from '../config.json'

const C = cfgAll.view.camera

/** Distance along a normalized direction to the first static hit, or maxDist. */
export type RayFn = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number) => number

export interface CameraRig {
  yaw: number
  pitch: number
  /** Mouse movement in pixels. */
  look(dx: number, dy: number): void
  /** Places the camera; shake is an offset in metres. */
  update(dt: number, px: number, py: number, pz: number, crouched: boolean, fovWanted: number, shakeX: number, shakeY: number): void
  /** Where the crosshair points: written into out (a world point up to aimRange away). */
  aimPoint(out: Vector3): void
  snap(): void
}

export function createCameraRig(camera: PerspectiveCamera, ray: RayFn, startYaw: number): CameraRig {
  let yaw = startYaw
  let pitch = C.startPitch
  const pivot = new Vector3()
  const want = new Vector3()
  const back = new Vector3()
  let height = C.pivotHeight
  let dist = C.distance
  let snapNext = true

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
    look(dx: number, dy: number): void {
      yaw -= dx * C.sensitivity
      pitch = Math.min(C.maxPitch, Math.max(C.minPitch, pitch + dy * C.sensitivity))
    },
    update(dt, px, py, pz, crouched, fovWanted, shakeX, shakeY): void {
      const k = snapNext ? 1 : Math.min(1, dt * C.followLerp)
      snapNext = false
      height += ((crouched ? C.crouchPivotHeight : C.pivotHeight) - height) * Math.min(1, dt * 8)
      const wantDist = crouched ? C.crouchDistance : C.distance
      // pivot: above the feet, over the right shoulder
      const rx = -Math.cos(yaw)
      const rz = Math.sin(yaw)
      const tx = px + rx * C.shoulder
      const ty = py + height
      const tz = pz + rz * C.shoulder
      pivot.x += (tx - pivot.x) * k
      pivot.y += (ty - pivot.y) * k
      pivot.z += (tz - pivot.z) * k
      if (k === 1) pivot.set(tx, ty, tz)
      // orbit direction: behind (opposite the look) and up by the pitch
      const cp = Math.cos(pitch)
      back.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
      const hit = ray(pivot.x, pivot.y, pivot.z, back.x, back.y, back.z, wantDist + C.collisionPad)
      const allowed = Math.max(C.minDistance, hit - C.collisionPad)
      // pull in at once, ease back out
      dist = allowed < dist ? allowed : dist + (Math.min(wantDist, allowed) - dist) * Math.min(1, dt * 4)
      want.copy(pivot).addScaledVector(back, dist)
      camera.position.set(want.x + shakeX, want.y + shakeY, want.z)
      camera.lookAt(pivot.x - back.x * 6, pivot.y - back.y * 6, pivot.z - back.z * 6)
      if (Math.abs(camera.fov - fovWanted) > 0.05) {
        camera.fov += (fovWanted - camera.fov) * Math.min(1, dt * 10)
        camera.updateProjectionMatrix()
      }
    },
    aimPoint(out: Vector3): void {
      camera.getWorldDirection(back)
      const d = ray(camera.position.x, camera.position.y, camera.position.z, back.x, back.y, back.z, C.aimRange)
      out.copy(camera.position).addScaledVector(back, d)
    },
    snap(): void {
      snapNext = true
    },
  }
  return rig
}
