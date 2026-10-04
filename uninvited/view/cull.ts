// The view frustum of the last drawn camera, for the things the renderer cannot cull itself: the view cones and their
// floor fans and sight fans (view/cone.ts, view/sight.ts) are only worth their cost where the camera can see them.
// Set once a frame from the camera (the matrices of the previous frame: pad the radius a little); no allocations.
import { Frustum, Matrix4, Sphere, type PerspectiveCamera } from 'three'

const frustum = new Frustum()
const m = new Matrix4()
const ball = new Sphere()
let ready = false

/** Once a frame, before the first inView() call. */
export function setCullView(camera: PerspectiveCamera): void {
  m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(m)
  ready = true
}

/** The padding (m) that covers a camera that moved since the matrices were taken. */
export const CULL_PAD = 3

/** Does the sphere (centre, radius) touch the view? True until the first setCullView(). */
export function inView(x: number, y: number, z: number, radius: number): boolean {
  if (!ready) return true
  ball.center.set(x, y, z)
  ball.radius = radius + CULL_PAD
  return frustum.intersectsSphere(ball)
}
