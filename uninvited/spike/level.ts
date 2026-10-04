// Spike sector: a walled patch of network with cover blocks, a jump course, a node that drops the firewall,
// and the server behind it. Static geometry gets a Rapier collider and an AABB (the AABBs are for cheap bolt hits).
import RAPIER from '@dimforge/rapier3d-compat'
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { Materials } from './materials'

export interface Patrol {
  points: [number, number][]
}

const BOX = new BoxGeometry(1, 1, 1)
const BOX_EDGES = new EdgesGeometry(BOX)

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Level {
  readonly root = new Group()
  /** min x, min y, min z, max x, max y, max z per block - for bolts and decoys. */
  readonly aabbs: number[] = []
  readonly start = new Vector3(0, 0.2, -24)
  readonly nodePos = new Vector3(19, 0, 2)
  readonly serverPos = new Vector3(0, 0, 24)
  readonly firewallZ = 12
  readonly patrols: Patrol[] = [
    { points: [[-7, -11], [8, -11], [8, 1], [-7, 1]] },
    { points: [[14, -3], [25, -3], [25, 7], [14, 7]] },
    { points: [[-25, 8.5], [25, 8.5]] },
    { points: [[-9, 18], [9, 18], [9, 22], [-9, 22]] },
  ]
  nodeCore!: Mesh
  nodeRing!: Mesh
  nodeProgress!: Mesh
  serverBeam!: Mesh
  towerRings: Mesh[] = []
  private firewallMesh!: Mesh
  private firewallCollider: RAPIER.Collider | null = null

  constructor(
    private readonly world: RAPIER.World,
    private readonly mats: Materials,
  ) {
    this.buildFloor()
    this.buildBounds()
    this.buildCover()
    this.buildJumpCourse()
    this.buildFirewall()
    this.buildNode()
    this.buildServer()
    this.buildSkyline()
    this.buildTower()
  }

  block(x: number, z: number, w: number, d: number, h: number, y0 = 0, alt = false): void {
    const m = new Mesh(BOX, this.mats.wallBody)
    m.scale.set(w, h, d)
    m.position.set(x, y0 + h / 2, z)
    const e = new LineSegments(BOX_EDGES, alt ? this.mats.edgeAlt : this.mats.edge)
    e.scale.copy(m.scale)
    e.position.copy(m.position)
    this.root.add(m, e)
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y0 + h / 2, z))
    this.aabbs.push(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2)
  }

  /** True if the point is inside any static block. */
  solidAt(x: number, y: number, z: number): boolean {
    const a = this.aabbs
    for (let i = 0; i < a.length; i += 6) {
      if (x > a[i]! && y > a[i + 1]! && z > a[i + 2]! && x < a[i + 3]! && y < a[i + 4]! && z < a[i + 5]!) return true
    }
    return false
  }

  openFirewall(): void {
    if (this.firewallCollider) this.world.removeCollider(this.firewallCollider, false)
    this.firewallCollider = null
  }

  closeFirewall(): void {
    if (!this.firewallCollider) {
      this.firewallCollider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(30, 3, 0.25).setTranslation(0, 3, this.firewallZ),
      )
    }
    this.setFirewallOpen(0)
  }

  setFirewallOpen(k: number): void {
    this.mats.firewall.uniforms['uOpen']!.value = k
    this.firewallMesh.visible = k < 1
  }

  private buildFloor(): void {
    const floor = new Mesh(new PlaneGeometry(200, 200), this.mats.grid)
    floor.rotation.x = -Math.PI / 2
    this.root.add(floor)
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0))
  }

  private buildBounds(): void {
    this.block(0, -30.5, 62, 1, 2)
    this.block(0, 30.5, 62, 1, 2)
    this.block(-30.5, 0, 1, 60, 2)
    this.block(30.5, 0, 1, 60, 2)
  }

  private buildCover(): void {
    // Start area
    this.block(-5, -18, 3, 1, 1.1)
    this.block(5, -17, 1, 4, 1.6, 0, true)
    // Middle: tall data blocks to break line of sight
    this.block(11, -7, 4, 4, 3.2)
    this.block(-10, -5, 5, 3, 3.2, 0, true)
    this.block(1.5, -4, 2, 5, 2.4)
    this.block(-4, 5, 8, 1, 2.6)
    this.block(10.5, 5, 1, 6, 2.6, 0, true)
    this.block(22, -12, 3, 3, 3.4)
    this.block(-22, 0, 3, 8, 3.4, 0, true)
    // Around the node: low cover you can sneak behind
    this.block(15.5, 0, 1, 3, 1.1)
    this.block(22.5, 4.5, 3, 1, 1.1)
    // Behind the firewall
    this.block(-6, 20, 2, 2, 2.2, 0, true)
    this.block(6, 20, 2, 2, 2.2, 0, true)
  }

  private buildJumpCourse(): void {
    this.block(-15, -22, 2, 2, 0.6)
    this.block(-17.5, -20, 2, 2, 1.3)
    this.block(-20.5, -18, 2.5, 2.5, 2.0, 0, true)
    // A gap, then a long ledge with a view over the sector
    this.block(-24, -12, 3, 7, 2.6)
  }

  private buildFirewall(): void {
    const geo = new PlaneGeometry(60, 5, 1, 1)
    this.firewallMesh = new Mesh(geo, this.mats.firewall)
    this.firewallMesh.position.set(0, 2.5, this.firewallZ)
    this.root.add(this.firewallMesh)
    this.closeFirewall()
  }

  private buildNode(): void {
    const p = this.nodePos
    this.block(p.x, p.z, 1.2, 1.2, 0.9)
    this.nodeCore = new Mesh(new OctahedronGeometry(0.45), this.mats.accent)
    this.nodeCore.position.set(p.x, 1.7, p.z)
    this.nodeRing = new Mesh(new RingGeometry(1.7, 1.8, 48), this.mats.accentSoft)
    this.nodeRing.rotation.x = -Math.PI / 2
    this.nodeRing.position.set(p.x, 0.02, p.z)
    this.nodeProgress = new Mesh(new RingGeometry(1.85, 2.15, 48, 1, 0, Math.PI * 2), this.mats.accent)
    this.nodeProgress.rotation.x = -Math.PI / 2
    this.nodeProgress.position.set(p.x, 0.03, p.z)
    this.nodeProgress.scale.setScalar(0.0001)
    this.root.add(this.nodeCore, this.nodeRing, this.nodeProgress)
  }

  private buildServer(): void {
    const p = this.serverPos
    const body = new Mesh(BOX, this.mats.wallBody)
    body.scale.set(3, 6, 3)
    body.position.set(p.x, 3, p.z)
    const e = new LineSegments(BOX_EDGES, this.mats.accentLine)
    e.scale.copy(body.scale)
    e.position.copy(body.position)
    this.serverBeam = new Mesh(new CylinderGeometry(0.25, 0.25, 60, 12, 1, true), this.mats.accentSoft)
    this.serverBeam.position.set(p.x, 30, p.z)
    this.root.add(body, e, this.serverBeam)
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.5, 3, 1.5).setTranslation(p.x, 3, p.z))
    this.aabbs.push(p.x - 1.5, 0, p.z - 1.5, p.x + 1.5, 6, p.z + 1.5)
  }

  private buildSkyline(): void {
    const rand = mulberry32(7)
    const posA: number[] = []
    const posB: number[] = []
    const edge = BOX_EDGES.getAttribute('position')
    const bodies: Matrix4[] = []
    const m = new Matrix4()
    for (let i = 0; i < 140; i++) {
      const ang = rand() * Math.PI * 2
      const dist = 48 + rand() * 70
      const x = Math.cos(ang) * dist
      const z = Math.sin(ang) * dist
      const w = 3 + rand() * 7
      const d = 3 + rand() * 7
      const h = 6 + rand() * rand() * 70
      const target = rand() < 0.35 ? posB : posA
      for (let k = 0; k < edge.count; k++) {
        target.push(x + edge.getX(k) * w, edge.getY(k) * h + h / 2, z + edge.getZ(k) * d)
      }
      // Horizontal "floor" stripes on taller buildings read as windows from far away
      for (let y = 4; y < h; y += 3 + rand() * 4) {
        if (rand() < 0.5) continue
        target.push(x - w / 2, y, z + d / 2, x + w / 2, y, z + d / 2)
        target.push(x - w / 2, y, z - d / 2, x + w / 2, y, z - d / 2)
      }
      bodies.push(m.clone().makeScale(w * 0.99, h, d * 0.99).setPosition(x, h / 2, z))
    }
    const ga = new BufferGeometry()
    ga.setAttribute('position', new Float32BufferAttribute(posA, 3))
    const gb = new BufferGeometry()
    gb.setAttribute('position', new Float32BufferAttribute(posB, 3))
    const inst = new InstancedMesh(BOX, this.mats.wallBody, bodies.length)
    bodies.forEach((b, i) => inst.setMatrixAt(i, b))
    this.root.add(new LineSegments(ga, this.mats.skyline), new LineSegments(gb, this.mats.skylineAlt), inst)
  }

  private buildTower(): void {
    const g = new Group()
    g.position.set(0, 0, 150)
    const shaft = new LineSegments(BOX_EDGES, this.mats.towerLine)
    shaft.scale.set(10, 160, 10)
    shaft.position.y = 80
    const core = new Mesh(BOX, this.mats.wallBody)
    core.scale.set(9.8, 160, 9.8)
    core.position.y = 80
    g.add(shaft, core)
    for (let i = 0; i < 3; i++) {
      const r = new Mesh(new TorusGeometry(16 - i * 3, 0.35, 8, 64), this.mats.tower)
      r.rotation.x = Math.PI / 2
      r.position.y = 70 + i * 22
      this.towerRings.push(r)
      g.add(r)
    }
    this.root.add(g)
  }
}
