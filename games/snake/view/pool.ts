// Пул инстансов на InstancedMesh с возможностью роста ёмкости.
// ensureCapacity пересоздаёт mesh (дорого) — ТОЛЬКО из холодного пути.
// Пул владеет геометрией и материалом и освобождает их в dispose().

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

  /** Холодный путь: вызывать из handle(), не из render(). */
  ensureCapacity(required: number): void {
    if (required <= this.capacity) return
    const nextCapacity = Math.max(required, this.capacity * 2)
    const next = this.createMesh(nextCapacity)
    this.scene.remove(this._mesh)
    this._mesh.dispose() // буферы инстансов; геометрия/материал общие и живут дальше
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

  /** Вызывать один раз в конце обновления кадра после серии setInstance(). */
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
