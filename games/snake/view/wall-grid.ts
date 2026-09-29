// Grid on the six inner walls of the cube: 6 LineSegments with a SHARED ShaderMaterial,
// created once when the size changes. 20³: a line on every cell boundary;
// 50³ and 100³: a step of 5 cells. Every 5th line is brighter (scale), alpha falls off with
// distance to the camera (depth), lines closer than NEAR_FADE_CELLS dissolve.
// depthWrite: false, the grid is dim and does not compete with the snake.
// In plane mode (freeAmount < 0.5, camera outside) the walls between the camera and the field
// are hidden; in free mode they are never hidden.

import { BufferGeometry, Float32BufferAttribute, LineSegments, ShaderMaterial, type Scene } from 'three'
import {
  VERT,
  FRAG,
  NEAR_FADE_CELLS,
  FALLOFF_PER_SIZE,
  FALLOFF_MIN,
  FALLOFF_MAX,
} from './cube-frame'
import { GRID_COLOR, GRID_MINOR_ALPHA, GRID_MAJOR_ALPHA } from './palette'

// Styling constants, not balance values.
const GRID_SIZE_SMALL_MAX = 20
const GRID_STEP_LARGE = 5
const MAJOR_EVERY = 5
// Far lines are weaker than near ones: brightness fraction at infinite distance.
const GRID_FAR_FLOOR = 0.12

export class WallGrid {
  private scene: Scene
  private walls: LineSegments[] = []
  private material: ShaderMaterial | null = null
  private currentSize = -1

  constructor(scene: Scene) {
    this.scene = scene
  }

  /** Cold path: call from handle('started', s), not from render(). */
  setSize(size: number): void {
    if (size === this.currentSize) return
    this.currentSize = size
    this.disposeAll()
    const step = size <= GRID_SIZE_SMALL_MAX ? 1 : GRID_STEP_LARGE
    const lines = Math.floor(size / step) + 1
    const lo = -0.5
    const hi = size - 0.5
    this.material = new ShaderMaterial({
      uniforms: {
        uColor: { value: GRID_COLOR },
        uMinor: { value: GRID_MINOR_ALPHA },
        uMajor: { value: GRID_MAJOR_ALPHA },
        uFalloff: { value: Math.min(FALLOFF_MAX, Math.max(FALLOFF_MIN, size * FALLOFF_PER_SIZE)) },
        uFloor: { value: GRID_FAR_FLOOR },
        uNearFade: { value: NEAR_FADE_CELLS },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })
    const verts = lines * 2 * 2
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3
      const v = (axis + 2) % 3
      for (let side = 0; side < 2; side++) {
        const pos = new Float32Array(verts * 3)
        const major = new Float32Array(verts)
        const w = side === 0 ? lo : hi
        let o = 0
        let m = 0
        for (let k = 0; k < lines; k++) {
          const c = lo + k * step
          const isMajor = k % MAJOR_EVERY === 0 ? 1 : 0
          // line along v at coordinate u = c
          pos[o + axis] = w; pos[o + u] = c; pos[o + v] = lo; o += 3
          pos[o + axis] = w; pos[o + u] = c; pos[o + v] = hi; o += 3
          // line along u at coordinate v = c
          pos[o + axis] = w; pos[o + u] = lo; pos[o + v] = c; o += 3
          pos[o + axis] = w; pos[o + u] = hi; pos[o + v] = c; o += 3
          major[m++] = isMajor
          major[m++] = isMajor
          major[m++] = isMajor
          major[m++] = isMajor
        }
        const g = new BufferGeometry()
        g.setAttribute('position', new Float32BufferAttribute(pos, 3))
        g.setAttribute('aMajor', new Float32BufferAttribute(major, 1))
        const ls = new LineSegments(g, this.material)
        ls.frustumCulled = false
        this.walls.push(ls)
        this.scene.add(ls)
      }
    }
  }

  /** Frame, allocation-free. Wall index: axis * 2 + side (0 is the lower, 1 the upper). */
  update(camX: number, camY: number, camZ: number, freeAmount: number): void {
    if (this.walls.length === 0) return
    const hi = this.currentSize - 0.5
    const canHide = freeAmount < 0.5
    for (let axis = 0; axis < 3; axis++) {
      const c = axis === 0 ? camX : axis === 1 ? camY : camZ
      this.walls[axis * 2]!.visible = !(canHide && c < -0.5)
      this.walls[axis * 2 + 1]!.visible = !(canHide && c > hi)
    }
  }

  private disposeAll(): void {
    for (const w of this.walls) {
      this.scene.remove(w)
      w.geometry.dispose()
    }
    this.walls.length = 0
    this.material?.dispose()
    this.material = null
  }

  dispose(): void {
    this.disposeAll()
    this.currentSize = -1
  }
}
