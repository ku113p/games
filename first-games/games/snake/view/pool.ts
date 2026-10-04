// Instance pool on InstancedMesh with the ability to grow capacity.
// ensureCapacity recreates the mesh (expensive), so ONLY from the cold path.
// The pool owns the geometry and material and releases them in dispose().

import { InstancedMesh, type BufferGeometry, type Material, type Matrix4, type Color, type Scene } from 'three'

export class InstancedPool {
  private scene: Scene
  private geometry: BufferGeometry
  private material: Material
  private _mesh: InstancedMesh

  constructor(scene: Scene, geometry: BufferGeometry, material: Material, initialCapacity: number) {
    this.scene = scene
    this.geometry = geometry
    this.material = material
    this._mesh = this.createMesh(Math.max(1, initialCapacity))
    this.scene.add(this._mesh)
  }

  get mesh(): InstancedMesh {
    return this._mesh
  }

  get capacity(): number {
    return this._mesh.instanceMatrix.count
  }

  /** Cold path: call from handle(), not from render(). */
  ensureCapacity(required: number): void {
    if (required <= this.capacity) return
    const nextCapacity = Math.max(required, this.capacity * 2)
    const next = this.createMesh(nextCapacity)
    this.scene.remove(this._mesh)
    this._mesh.dispose() // instance buffers; geometry/material are shared and live on
    this._mesh = next
    this.scene.add(this._mesh)
  }

  setCount(count: number): void {
    this._mesh.count = count
  }

  setInstance(index: number, matrix: Matrix4, color: Color): void {
    this._mesh.setMatrixAt(index, matrix)
    this._mesh.setColorAt(index, color)
  }

  /** Call once at the end of the frame update after a series of setInstance(). */
  markDirty(): void {
    this._mesh.instanceMatrix.needsUpdate = true
    if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true
  }

  dispose(): void {
    this.scene.remove(this._mesh)
    this._mesh.dispose()
    this.geometry.dispose()
    this.material.dispose()
  }

  private createMesh(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity)
    mesh.count = 0
    mesh.frustumCulled = false
    return mesh
  }
}
