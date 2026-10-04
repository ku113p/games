// Dev only (`?camlog`): a per-frame log of the camera and the hero that catches a sudden turn (a "180 flip") with its cause.
// Every frame it records the rig yaw and pitch, the camera position and its real forward vector, the hero's facing and the boom
// length. A frame where the rig yaw, the camera's forward vector or the hero's facing changes by more than `limitDeg` is a flip:
// it is stored (kind 'camera' when the rig or the view axis turned, 'hero' when only the body did; with the stack of the yaw write, if any, the recent core events and the mode) in `window.__camlog.flips`
// and printed with console.warn. Off by default: main.ts creates nothing without the flag, so it costs nothing.
// Read it from a script: `__camlog.flips`, `__camlog.frames` (the last 600 frames), `__camlog.maxStep` (the biggest per-frame turns seen).
import { Vector3, type PerspectiveCamera } from 'three'
import type { CameraRig } from './camera'

const DEG = 180 / Math.PI

function diff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  else if (d <= -Math.PI) d += Math.PI * 2
  return d
}

export interface CamFrame {
  n: number
  mode: string
  yaw: number
  pitch: number
  cam: [number, number, number]
  fwd: [number, number, number]
  facing: number
  hero: [number, number, number]
  boom: number
  events: string[]
}

export interface CamLog {
  frame(mode: string, facing: number, hero: { x: number; y: number; z: number }, events: readonly { type: string }[]): void
  frames: CamFrame[]
  flips: Array<Record<string, unknown>>
  /** The largest one-frame turn seen so far (deg): the rig yaw, the camera's forward vector, the hero's facing. */
  maxStep: { yaw: number; fwd: number; facing: number }
  limitDeg: number
}

export function createCamLog(rig: CameraRig, camera: PerspectiveCamera, limitDeg = 60): CamLog {
  const frames: CamFrame[] = []
  const flips: Array<Record<string, unknown>> = []
  const maxStep = { yaw: 0, fwd: 0, facing: 0 }
  // the yaw writes of this frame, each with its stack
  let writes: Array<{ from: number; to: number; stack: string }> = []
  const desc = Object.getOwnPropertyDescriptor(rig, 'yaw')
  if (desc?.get && desc.set) {
    const get = desc.get
    const set = desc.set
    Object.defineProperty(rig, 'yaw', {
      configurable: true,
      enumerable: true,
      get: () => get.call(rig) as number,
      set: (v: number) => {
        const from = get.call(rig) as number
        if (Math.abs(diff(v, from)) * DEG > 1) writes.push({ from, to: v, stack: new Error('yaw write').stack ?? '' })
        set.call(rig, v)
      },
    })
  }
  const dir = new Vector3()
  let prev: CamFrame | null = null
  let n = 0
  const log: CamLog = {
    frames,
    flips,
    maxStep,
    limitDeg,
    frame(mode, facing, hero, events) {
      dir.set(0, 0, -1).applyQuaternion(camera.quaternion)
      const fr: CamFrame = {
        n: n++,
        mode,
        yaw: rig.yaw,
        pitch: rig.pitch,
        cam: [camera.position.x, camera.position.y, camera.position.z],
        fwd: [dir.x, dir.y, dir.z],
        facing,
        hero: [hero.x, hero.y, hero.z],
        boom: Math.hypot(camera.position.x - hero.x, camera.position.y - hero.y, camera.position.z - hero.z),
        events: events.map((e) => e.type),
      }
      if (prev) {
        const dYaw = Math.abs(diff(fr.yaw, prev.yaw)) * DEG
        const dFacing = Math.abs(diff(fr.facing, prev.facing)) * DEG
        const dFwd = Math.acos(Math.max(-1, Math.min(1, fr.fwd[0] * prev.fwd[0] + fr.fwd[1] * prev.fwd[1] + fr.fwd[2] * prev.fwd[2]))) * DEG
        maxStep.yaw = Math.max(maxStep.yaw, dYaw)
        maxStep.fwd = Math.max(maxStep.fwd, dFwd)
        maxStep.facing = Math.max(maxStep.facing, dFacing)
        if (dYaw > limitDeg || dFwd > limitDeg || dFacing > limitDeg) {
          const kind = dYaw > limitDeg || dFwd > limitDeg ? 'camera' : 'hero'
          const flip = { kind, dYaw, dFwd, dFacing, prev, now: fr, writes: writes.slice() }
          flips.push(flip)
          console.warn(`[camlog] ${kind} flip: yaw ${dYaw.toFixed(0)} fwd ${dFwd.toFixed(0)} facing ${dFacing.toFixed(0)} deg`, JSON.stringify(flip))
        }
      }
      writes = []
      prev = fr
      frames.push(fr)
      if (frames.length > 600) frames.shift()
    },
  }
  return log
}
