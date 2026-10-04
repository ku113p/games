// Procedural "suit of light" runner: boxes with glowing edges and a stripe down each limb.
// Placeholder for a rigged model (Quaternius CC0 / Mixamo) - enough to judge camera, scale and motion.
import { BoxGeometry, EdgesGeometry, Group, LineSegments, Mesh, type Material, type Object3D } from 'three'
import type { Materials } from './materials'

const BOX = new BoxGeometry(1, 1, 1)
const EDGES = new EdgesGeometry(BOX)

interface Part {
  pivot: Group
  len: number
}

export class Hero {
  readonly root = new Group()
  readonly body = new Group()
  private readonly hips = new Group()
  private readonly torso: Part
  private readonly head: Group
  private readonly armL: Part
  private readonly armR: Part
  private readonly legL: Part
  private readonly legR: Part
  private phase = 0
  private lean = 0
  private crouch = 0

  constructor(private readonly mats: Materials) {
    this.root.add(this.body)
    this.body.add(this.hips)
    this.hips.position.y = 0.92
    this.torso = this.limb(this.hips, 0, 0, 0, 0.46, 0.62, 0.26, false)
    this.head = new Group()
    this.head.position.y = 0.78
    this.torso.pivot.add(this.head)
    this.boxPart(this.head, 0, 0.14, 0, 0.24, 0.28, 0.26)
    const visor = new Mesh(BOX, mats.heroGlow)
    visor.scale.set(0.2, 0.05, 0.02)
    visor.position.set(0, 0.17, 0.135)
    this.head.add(visor)
    this.armL = this.limb(this.torso.pivot, 0.31, 0.58, 0, 0.13, 0.66, 0.13, true)
    this.armR = this.limb(this.torso.pivot, -0.31, 0.58, 0, 0.13, 0.66, 0.13, true)
    this.legL = this.limb(this.hips, 0.13, 0, 0, 0.16, 0.9, 0.16, true)
    this.legR = this.limb(this.hips, -0.13, 0, 0, 0.16, 0.9, 0.16, true)
    // Chest emblem
    const core = new Mesh(BOX, mats.heroGlow)
    core.scale.set(0.1, 0.1, 0.02)
    core.position.set(0, 0.42, 0.135)
    core.rotation.z = Math.PI / 4
    this.torso.pivot.add(core)
  }

  /** Box hanging down from a pivot (limbs) or standing up from it (torso). */
  private limb(parent: Group, x: number, y: number, z: number, w: number, h: number, d: number, down: boolean): Part {
    const pivot = new Group()
    pivot.position.set(x, y, z)
    parent.add(pivot)
    const cy = down ? -h / 2 : h / 2
    this.boxPart(pivot, 0, cy, 0, w, h, d)
    const stripe = new Mesh(BOX, this.mats.heroGlow)
    stripe.scale.set(0.025, h * 0.86, 0.025)
    stripe.position.set(0, cy, d / 2 + 0.005)
    pivot.add(stripe)
    return { pivot, len: h }
  }

  private boxPart(parent: Group, x: number, y: number, z: number, w: number, h: number, d: number): void {
    const m = new Mesh(BOX, this.mats.heroBody)
    m.scale.set(w, h, d)
    m.position.set(x, y, z)
    const e = new LineSegments(EDGES, this.mats.heroLine)
    e.scale.copy(m.scale)
    e.position.copy(m.position)
    parent.add(m, e)
  }

  /**
   * speed01: 0 idle .. 1 full run. strike01: 1 at the start of a strike, falls to 0.
   */
  animate(dt: number, speed01: number, grounded: boolean, sneaking: boolean, dashing: boolean, strike01: number, vy: number): void {
    const stride = sneaking ? 7 : 11
    this.phase += dt * stride * (0.25 + speed01)
    const s = Math.sin(this.phase)
    const swing = (sneaking ? 0.45 : 0.95) * speed01
    const targetCrouch = sneaking ? 1 : 0
    this.crouch += (targetCrouch - this.crouch) * Math.min(1, dt * 12)
    const targetLean = dashing ? 0.75 : speed01 * (sneaking ? 0.35 : 0.28)
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 10)

    if (grounded) {
      this.legL.pivot.rotation.x = s * swing - this.crouch * 0.6
      this.legR.pivot.rotation.x = -s * swing - this.crouch * 0.6
      this.armL.pivot.rotation.x = -s * swing * 0.9
      this.armR.pivot.rotation.x = s * swing * 0.9
      this.hips.position.y = 0.92 - this.crouch * 0.28 + Math.abs(Math.cos(this.phase)) * 0.06 * speed01
    } else {
      // Airborne: tuck legs, arms out; going up vs. falling
      const up = vy > 0 ? 1 : 0
      this.legL.pivot.rotation.x = -0.9 + up * 0.3
      this.legR.pivot.rotation.x = 0.4 - up * 0.2
      this.armL.pivot.rotation.x = -1.1
      this.armR.pivot.rotation.x = -0.6
      this.hips.position.y = 0.92
    }
    this.armL.pivot.rotation.z = 0.12 + (grounded ? 0 : 0.5)
    this.armR.pivot.rotation.z = -0.12 - (grounded ? 0 : 0.5)
    if (dashing) {
      this.armL.pivot.rotation.x = 1.2
      this.armR.pivot.rotation.x = 1.2
    }
    if (strike01 > 0) {
      // Right arm slashes across from the left shoulder
      const t = 1 - strike01
      this.armR.pivot.rotation.x = -1.6
      this.armR.pivot.rotation.z = -1.4 + t * 2.6
      this.torso.pivot.rotation.y = 0.6 - t * 1.2
    } else {
      this.torso.pivot.rotation.y *= 0.8
    }
    this.body.rotation.x = this.lean
    this.torso.pivot.rotation.x = this.crouch * 0.35
  }

  /** A frozen copy of the hero in another material - used for dash afterimages. Nodes parallel poseNodes(). */
  cloneGhost(material: Material): { group: Group; nodes: Object3D[] } {
    const group = this.root.clone(true)
    const nodes: Object3D[] = []
    group.traverse((o) => {
      nodes.push(o)
      if (o instanceof Mesh) o.material = material
      else if (o instanceof LineSegments) o.visible = false
    })
    return { group, nodes }
  }

  private nodes: Object3D[] | null = null

  copyPoseTo(ghostNodes: Object3D[]): void {
    if (!this.nodes) {
      const list: Object3D[] = []
      this.root.traverse((o) => list.push(o))
      this.nodes = list
    }
    const src = this.nodes
    for (let i = 0; i < src.length; i++) {
      ghostNodes[i]!.position.copy(src[i]!.position)
      ghostNodes[i]!.quaternion.copy(src[i]!.quaternion)
    }
  }
}
