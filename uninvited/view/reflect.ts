// The floor reflection (NN1b, toned down after play-testing): a mirrored camera renders what glows (seams, frames,
// lasers, drone eyes, the hero) plus everything solid that can hide it (walls, cover blocks, devices - they write
// depth, so a reflection never shows through what stands between it and the floor), at a reduced resolution, into an
// HDR target with mipmaps and a depth texture. The floor shader reads the depth back to learn how high above the floor
// the reflected point is: the reflection fades and blurs with that height, so it stays short and soft.
// The mirror plane is the floor under the hero; floors at other heights fade the reflection out.
// Same math as three's Reflector (virtual camera + oblique near plane), without its mesh. No allocations per frame.
import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three'

/** Objects on this layer show up in the floor reflection. */
export const REFLECT_LAYER = 1

export interface Mirror {
  readonly texture: Texture
  /** The mirror pass's depth: with `inverse` it gives the world point each reflection texel shows. */
  readonly depth: Texture
  /** World -> reflection texture (projective). */
  readonly matrix: Matrix4
  /** Reflection NDC -> world (the inverse of the virtual camera's view-projection). */
  readonly inverse: Matrix4
  /** 1 / the target's size in texels. */
  readonly texel: Vector2
  /** x = height of the mirror plane, y = 1 when this frame's reflection was rendered (0: camera below the plane). */
  readonly plane: Vector2
  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, planeY: number): void
  setSize(w: number, h: number): void
}

export function createMirror(scale: number, w: number, h: number): Mirror {
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))
  const target = new WebGLRenderTarget(tw, th, {
    type: HalfFloatType,
    samples: 0,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    depthTexture: new DepthTexture(tw, th),
  })
  const virtual = new PerspectiveCamera()
  virtual.layers.set(REFLECT_LAYER)
  virtual.matrixAutoUpdate = true
  const matrix = new Matrix4()
  const inverse = new Matrix4()
  const texel = new Vector2(1 / tw, 1 / th)
  const normal = new Vector3(0, 1, 0)
  const planePos = new Vector3()
  const camPos = new Vector3()
  const rot = new Matrix4()
  const look = new Vector3()
  const view = new Vector3()
  const aim = new Vector3()
  const plane = new Plane()
  const clip = new Vector4()
  const q = new Vector4()
  const mirrorPlane = new Vector2()

  return {
    texture: target.texture,
    depth: target.depthTexture as Texture,
    matrix,
    inverse,
    texel,
    plane: mirrorPlane,
    render(renderer, scene, camera, planeY): void {
      mirrorPlane.x = planeY
      camera.updateMatrixWorld()
      camPos.setFromMatrixPosition(camera.matrixWorld)
      planePos.set(camPos.x, planeY, camPos.z)
      view.subVectors(planePos, camPos)
      if (view.dot(normal) > 0) {
        mirrorPlane.y = 0
        return
      }
      mirrorPlane.y = 1
      view.reflect(normal).negate().add(planePos)
      rot.extractRotation(camera.matrixWorld)
      look.set(0, 0, -1).applyMatrix4(rot).add(camPos)
      aim.subVectors(planePos, look).reflect(normal).negate().add(planePos)
      virtual.position.copy(view)
      virtual.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal)
      virtual.lookAt(aim)
      virtual.near = camera.near
      virtual.far = camera.far
      virtual.updateMatrixWorld()
      virtual.projectionMatrix.copy(camera.projectionMatrix)
      matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      matrix.multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse)
      // oblique near plane: nothing below the mirror shows up in it
      plane.setFromNormalAndCoplanarPoint(normal, planePos).applyMatrix4(virtual.matrixWorldInverse)
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
      const e = virtual.projectionMatrix.elements
      q.set((Math.sign(clip.x) + (e[8] as number)) / (e[0] as number), (Math.sign(clip.y) + (e[9] as number)) / (e[5] as number), -1, (1 + (e[10] as number)) / (e[14] as number))
      clip.multiplyScalar(2 / clip.dot(q))
      e[2] = clip.x
      e[6] = clip.y
      e[10] = clip.z + 1
      e[14] = clip.w
      inverse.multiplyMatrices(virtual.projectionMatrix, virtual.matrixWorldInverse).invert()
      const prev = renderer.getRenderTarget()
      renderer.setRenderTarget(target)
      renderer.state.buffers.depth.setMask(true)
      renderer.clear()
      renderer.render(scene, virtual)
      renderer.setRenderTarget(prev)
    },
    setSize(nw: number, nh: number): void {
      const sw = Math.max(1, Math.round(nw * scale))
      const sh = Math.max(1, Math.round(nh * scale))
      target.setSize(sw, sh)
      texel.set(1 / sw, 1 / sh)
    },
  }
}
