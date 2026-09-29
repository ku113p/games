// Snake skin "Tail guides" (shop, snakeSkin = tailGuides). Designer's idea: see where the tail is going.
// In 3D a chain of wireframe cubes reads poorly: it is unclear how the body is connected and which cell behind the tail is free.
// So on top of the regular segments we draw:
//   1. SPINE: a thin beam between the centers of adjacent segments (through the empty cubes you see the body's path, turns and climbs);
//   2. TAIL ARROWS: on the last TAIL_ARROWS links, a cone with its tip toward the head. The tail always follows its own body,
//      so the arrows show the cells that will be vacated in the next steps, and the direction of travel through them.
// View only: cell size, hitboxes and speed do not change, the core knows nothing about this (it reads positions that SnakeView has already assembled).
// Link color is the body color, dimmed (below the bloom threshold: a thin thread, not a halo). Per-frame update is allocation-free:
// Matrix4/Quaternion/Vector3/Color are created up front, the pool grows only in ensureCapacity() (cold path).

import { BoxGeometry, ConeGeometry, Color, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Scene } from 'three'
import { InstancedPool } from './pool'

/** Spine beam thickness, in cells (the body beam is 0.1). */
const LINK_BEAM = 0.09
/**
 * The spine is lighter than the body (white fraction) and dimmed: otherwise it merges with the cube edges of the same hue.
 * The brightest body has brightness ~0.7, below the bloom threshold (0.75): a thread, not a halo.
 */
const LINK_WHITE = 0.55
const LINK_DIM = 0.6
/** How many of the last tail links get an arrow. */
export const TAIL_ARROWS = 3
const ARROW_RADIUS = 0.17
const ARROW_LENGTH = 0.42
const ARROW_SEGMENTS = 8
/** Arrows are brighter than the link: same body/tail color with a multiplier. */
const ARROW_BRIGHTNESS = 1.8

const EPS = 1e-6

export class TailGuides {
  private readonly links: InstancedPool
  private readonly arrows: InstancedPool
  private readonly m = new Matrix4()
  private readonly q = new Quaternion()
  private readonly pos = new Vector3()
  private readonly dir = new Vector3()
  private readonly scl = new Vector3()
  private readonly color = new Color()
  private readonly zAxis = new Vector3(0, 0, 1)
  private readonly white = new Color(1, 1, 1)

  constructor(scene: Scene) {
    this.links = new InstancedPool(scene, new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), 8)
    const cone = new ConeGeometry(ARROW_RADIUS, ARROW_LENGTH, ARROW_SEGMENTS, 1)
    cone.rotateX(Math.PI / 2) // cone axis +Y -> +Z: tip points along the direction, like the beam
    this.arrows = new InstancedPool(scene, cone, new MeshBasicMaterial(), TAIL_ARROWS)
  }

  /** Cold path: capacity for the snake length (one fewer link than segments). */
  ensureCapacity(length: number): void {
    this.links.ensureCapacity(Math.max(1, length - 1))
  }

  /**
   * Frame. gx/gy/gz are segment positions (0 is the head) after step smoothing, gk their scale (fade near the camera),
   * bodyColor/tailColor are the palette, glow is the body brightness multiplier (SNAKE_BODY_GLOW_BOOST).
   */
  update(length: number, gx: Float32Array, gy: Float32Array, gz: Float32Array, gk: Float32Array, bodyColor: Color, tailColor: Color, glow: number, denom: number): void {
    const n = Math.max(0, length - 1)
    this.links.setCount(n)
    const arrowsFrom = Math.max(0, n - TAIL_ARROWS)
    this.arrows.setCount(Math.max(0, n - arrowsFrom))
    for (let i = 0; i < n; i++) {
      // Link between segments i and i + 1; direction of travel is from tail to head (from i + 1 to i).
      const ax = gx[i]!
      const ay = gy[i]!
      const az = gz[i]!
      const bx = gx[i + 1]!
      const by = gy[i + 1]!
      const bz = gz[i + 1]!
      this.dir.set(ax - bx, ay - by, az - bz)
      const len = this.dir.length()
      const k = Math.min(gk[i]!, gk[i + 1]!)
      this.color.copy(bodyColor).lerp(tailColor, (i + 1) / denom).multiplyScalar(glow).lerp(this.white, LINK_WHITE)
      if (len < EPS) {
        // Degenerate case (segments coincide): the link has zero length, hide it.
        this.m.makeScale(0, 0, 0)
        this.links.mesh.setMatrixAt(i, this.m)
        this.links.mesh.setColorAt(i, this.color)
        continue
      }
      this.dir.divideScalar(len)
      this.q.setFromUnitVectors(this.zAxis, this.dir)
      this.pos.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
      this.scl.set(LINK_BEAM * k, LINK_BEAM * k, len)
      this.m.compose(this.pos, this.q, this.scl)
      this.links.mesh.setMatrixAt(i, this.m)
      this.links.mesh.setColorAt(i, this.color.multiplyScalar(LINK_DIM))
      if (i >= arrowsFrom) {
        this.scl.set(k, k, k)
        this.m.compose(this.pos, this.q, this.scl)
        const j = i - arrowsFrom
        this.arrows.mesh.setMatrixAt(j, this.m)
        this.arrows.mesh.setColorAt(j, this.color.multiplyScalar(ARROW_BRIGHTNESS / LINK_DIM))
      }
    }
    this.links.markDirty()
    this.arrows.markDirty()
  }

  dispose(): void {
    this.links.dispose()
    this.arrows.dispose()
  }
}
