// Debug free camera, the pure part: where a drag, a wheel notch or a held key puts the camera. Plain numbers, no three.js, no DOM,
// so it is unit-tested without a browser. The pose is an orbit pose: a target point, the direction the camera sits in around it
// (yaw, elevation) and the distance to it. Orbit turns the direction, dolly changes the distance, fly moves the target
// (and the camera with it). Everything mutates in place: no allocation, so it is safe in the frame loop.

export interface FreeCameraConfig {
  /** Fly speed, cells per second. */
  flySpeed: number
  /** Orbit sensitivity, radians per pixel of mouse drag. */
  orbitRadPerPx: number
  /** One wheel notch (deltaY of 100) multiplies the distance by 1 + wheelStep (closer) or divides by it (farther). */
  wheelStep: number
  /** Distance limits, in cells. */
  minDistance: number
  maxDistance: number
  /** Elevation limit, degrees: keeps the camera off the poles so "up" never flips. */
  pitchLimitDeg: number
  /** Start pose: distance to the cube center as a multiple of the cube size, and the direction. */
  startDistanceFactor: number
  startYawDeg: number
  startPitchDeg: number
  fovDeg: number
  near: number
  /** Far plane as a multiple of the cube size. */
  farFactor: number
}

export interface FreePose {
  tx: number
  ty: number
  tz: number
  yaw: number
  pitch: number
  dist: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** The wheel reports pixels; this is what one "notch" of a mouse wheel is in deltaY. */
export const WHEEL_NOTCH_PX = 100
const DEG = Math.PI / 180

/** ?camera=free turns the mode on. Anything else (absent, ?camera=off, ?camera=) leaves it off. */
export function isFreeCameraRequested(search: string): boolean {
  return new URLSearchParams(search).get('camera') === 'free'
}

export function createFreePose(): FreePose {
  return { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0, dist: 1 }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Frames the whole cube from the start direction. The cube is cells 0..size-1, its center (size-1)/2. */
export function resetPose(p: FreePose, size: number, cfg: FreeCameraConfig): void {
  const c = (size - 1) / 2
  p.tx = c
  p.ty = c
  p.tz = c
  p.yaw = cfg.startYawDeg * DEG
  p.pitch = clamp(cfg.startPitchDeg * DEG, -cfg.pitchLimitDeg * DEG, cfg.pitchLimitDeg * DEG)
  p.dist = clamp(size * cfg.startDistanceFactor, cfg.minDistance, cfg.maxDistance)
}

/** Camera position: the target plus the distance along the (yaw, pitch) direction. Positive pitch - the camera above the target. */
export function cameraPosition(p: FreePose, out: Vec3): void {
  const cp = Math.cos(p.pitch)
  out.x = p.tx + p.dist * Math.sin(p.yaw) * cp
  out.y = p.ty + p.dist * Math.sin(p.pitch)
  out.z = p.tz + p.dist * Math.cos(p.yaw) * cp
}

/** Unit vector the camera looks along (from the camera to the target). */
export function viewDirection(p: FreePose, out: Vec3): void {
  const cp = Math.cos(p.pitch)
  out.x = -Math.sin(p.yaw) * cp
  out.y = -Math.sin(p.pitch)
  out.z = -Math.cos(p.yaw) * cp
}

/** Mouse drag: dragging right swings the camera to the left around the target (the scene follows the hand), dragging down raises the camera. */
export function orbitBy(p: FreePose, dxPx: number, dyPx: number, cfg: FreeCameraConfig): void {
  const lim = cfg.pitchLimitDeg * DEG
  p.yaw -= dxPx * cfg.orbitRadPerPx
  p.pitch = clamp(p.pitch + dyPx * cfg.orbitRadPerPx, -lim, lim)
}

/** Wheel: a positive deltaY (scroll down) moves the camera away, a negative one closer. Exponential, so every notch feels the same. */
export function dollyBy(p: FreePose, wheelDeltaY: number, cfg: FreeCameraConfig): void {
  p.dist = clamp(p.dist * Math.pow(1 + cfg.wheelStep, wheelDeltaY / WHEEL_NOTCH_PX), cfg.minDistance, cfg.maxDistance)
}

/**
 * Keyboard fly. Each axis is -1, 0 or 1: forward (along the view direction, so it also climbs and dives), right (horizontal,
 * to the camera's right), up (world up). Moves the target, and the camera with it. Diagonals are normalized: no faster along a corner.
 */
export function flyBy(p: FreePose, forward: number, right: number, up: number, dtMs: number, cfg: FreeCameraConfig): void {
  if (forward === 0 && right === 0 && up === 0) return
  const len = Math.sqrt(forward * forward + right * right + up * up)
  const step = (cfg.flySpeed * dtMs) / 1000 / len
  const cp = Math.cos(p.pitch)
  // view direction
  const fx = -Math.sin(p.yaw) * cp
  const fy = -Math.sin(p.pitch)
  const fz = -Math.cos(p.yaw) * cp
  // right = forward x worldUp, flattened and normalized: (-fz, 0, fx) / cp = (cos yaw, 0, -sin yaw); cp stays > 0 at the pitch limit
  const rx = Math.cos(p.yaw)
  const rz = -Math.sin(p.yaw)
  p.tx += (fx * forward + rx * right) * step
  p.ty += (fy * forward + up) * step
  p.tz += (fz * forward + rz * right) * step
}

/** Jump the target to a point (the head), keeping direction and distance. */
export function focusOn(p: FreePose, x: number, y: number, z: number): void {
  p.tx = x
  p.ty = y
  p.tz = z
}
