// Juice: sparks, enemy bolts, the strike arc, dash afterimages, the decoy hologram, shake and hit-stop.
// Everything is pooled up front; update() does not allocate.
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  type Object3D,
  Quaternion,
  RingGeometry,
  type Scene,
  SphereGeometry,
  Vector3,
} from 'three'
import cfg from './config.json'
import type { Hero } from './hero'
import type { Materials } from './materials'

const tmpM = new Matrix4()
const tmpQ = new Quaternion()
const tmpS = new Vector3()
const tmpP = new Vector3()
const ZERO_SCALE = new Vector3(0, 0, 0)

export class Sparks {
  readonly mesh: InstancedMesh
  private readonly n = cfg.fx.particles
  private readonly pos = new Float32Array(this.n * 3)
  private readonly vel = new Float32Array(this.n * 3)
  private readonly life = new Float32Array(this.n)
  private readonly maxLife = new Float32Array(this.n)
  private next = 0

  constructor(mats: Materials) {
    this.mesh = new InstancedMesh(new BoxGeometry(0.07, 0.07, 0.07), mats.spark, this.n)
    this.mesh.frustumCulled = false
    tmpM.compose(tmpP.set(0, -100, 0), tmpQ.identity(), ZERO_SCALE)
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, tmpM)
  }

  burst(x: number, y: number, z: number, count: number, speed: number, up = 0.5, lifeS = 0.6): void {
    for (let k = 0; k < count; k++) {
      const i = this.next
      this.next = (this.next + 1) % this.n
      this.pos[i * 3] = x
      this.pos[i * 3 + 1] = y
      this.pos[i * 3 + 2] = z
      const a = Math.random() * Math.PI * 2
      const b = Math.random() * 2 - 1 + up
      const s = speed * (0.35 + Math.random() * 0.65)
      this.vel[i * 3] = Math.cos(a) * s
      this.vel[i * 3 + 1] = b * s
      this.vel[i * 3 + 2] = Math.sin(a) * s
      this.life[i] = this.maxLife[i] = lifeS * (0.5 + Math.random() * 0.5)
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i]! <= 0) continue
      this.life[i]! -= dt
      const j = i * 3
      this.vel[j + 1]! -= 14 * dt
      this.vel[j]! *= 1 - 2.5 * dt
      this.vel[j + 2]! *= 1 - 2.5 * dt
      this.pos[j]! += this.vel[j]! * dt
      this.pos[j + 1] = Math.max(0.03, this.pos[j + 1]! + this.vel[j + 1]! * dt)
      this.pos[j + 2]! += this.vel[j + 2]! * dt
      const k = Math.max(0, this.life[i]! / this.maxLife[i]!)
      tmpS.setScalar(k <= 0 ? 0 : 0.4 + k)
      tmpM.compose(tmpP.set(this.pos[j]!, this.pos[j + 1]!, this.pos[j + 2]!), tmpQ.identity(), tmpS)
      this.mesh.setMatrixAt(i, tmpM)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

export interface Bolt {
  mesh: Mesh
  vel: Vector3
  life: number
}

export class Bolts {
  readonly items: Bolt[] = []
  private next = 0

  constructor(scene: Scene, mats: Materials) {
    const geo = new CylinderGeometry(0.06, 0.06, 0.9, 6)
    geo.rotateX(Math.PI / 2)
    for (let i = 0; i < cfg.fx.bolts; i++) {
      const mesh = new Mesh(geo, mats.bolt)
      mesh.visible = false
      scene.add(mesh)
      this.items.push({ mesh, vel: new Vector3(), life: 0 })
    }
  }

  fire(from: Vector3, dir: Vector3): void {
    const b = this.items[this.next]!
    this.next = (this.next + 1) % this.items.length
    b.mesh.position.copy(from)
    b.vel.copy(dir).multiplyScalar(cfg.drone.boltSpeed)
    b.mesh.lookAt(tmpP.copy(from).add(dir))
    b.life = cfg.drone.boltLifeMs / 1000
    b.mesh.visible = true
  }

  kill(b: Bolt): void {
    b.life = 0
    b.mesh.visible = false
  }

  clear(): void {
    for (const b of this.items) this.kill(b)
  }
}

export class Afterimages {
  private readonly ghosts: { group: Group; nodes: Object3D[]; life: number }[] = []
  private next = 0

  constructor(scene: Scene, private readonly hero: Hero, private readonly mats: Materials) {
    for (let i = 0; i < cfg.fx.afterimages; i++) {
      const g = hero.cloneGhost(mats.heroGhost)
      g.group.visible = false
      scene.add(g.group)
      this.ghosts.push({ ...g, life: 0 })
    }
  }

  spawn(): void {
    const g = this.ghosts[this.next]!
    this.next = (this.next + 1) % this.ghosts.length
    this.hero.copyPoseTo(g.nodes)
    g.group.visible = true
    g.life = cfg.fx.afterimageMs / 1000
  }

  update(dt: number): void {
    let maxK = 0
    for (const g of this.ghosts) {
      if (g.life <= 0) continue
      g.life -= dt
      if (g.life <= 0) g.group.visible = false
      maxK = Math.max(maxK, g.life / (cfg.fx.afterimageMs / 1000))
    }
    // One shared material: fade all ghosts together (cheap, and they die within a quarter second anyway)
    this.mats.heroGhost.opacity = 0.3 * maxK
  }
}

export class SlashArc {
  readonly mesh: Mesh
  private t = 0

  constructor(mats: Materials) {
    const half = ((cfg.strike.arcDeg / 2) * Math.PI) / 180
    const geo = new RingGeometry(cfg.strike.range * 0.82, cfg.strike.range, 24, 1, Math.PI / 2 - half, half * 2)
    geo.rotateX(Math.PI / 2) // arc centred on +Y -> +Z (forward)
    geo.rotateZ(0.35) // a tilted swipe reads better than a flat floor fan
    this.mesh = new Mesh(geo, mats.slash)
    this.mesh.visible = false
  }

  show(x: number, y: number, z: number, yaw: number): void {
    this.mesh.position.set(x, y, z)
    this.mesh.rotation.y = yaw
    this.mesh.visible = true
    this.t = 0.14
  }

  update(dt: number, mats: Materials): void {
    if (this.t <= 0) return
    this.t -= dt
    mats.slash.opacity = Math.max(0, this.t / 0.14)
    if (this.t <= 0) this.mesh.visible = false
  }
}

export class Decoy {
  readonly root = new Group()
  readonly pos = new Vector3()
  life = 0

  constructor(mats: Materials) {
    const body = new Mesh(new CylinderGeometry(0.3, 0.3, 1.7, 10, 1, true), mats.decoy)
    body.position.y = 0.85
    const head = new Mesh(new SphereGeometry(0.18, 10, 8), mats.decoy)
    head.position.y = 1.9
    const ring = new Mesh(new RingGeometry(0.9, 1.0, 32), mats.decoy)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    this.root.add(body, head, ring)
    this.root.visible = false
  }

  get active(): boolean {
    return this.life > 0
  }

  place(p: Vector3): void {
    this.pos.copy(p)
    this.root.position.copy(p)
    this.life = cfg.decoy.lifeMs / 1000
    this.root.visible = true
  }

  update(dt: number, time: number): void {
    if (this.life <= 0) return
    this.life -= dt
    // Glitchy flicker so it reads as a hologram, not a second player
    this.root.visible = this.life > 0 && Math.sin(time * 40) > -0.6
    this.root.rotation.y += dt * 2
  }
}

/** Screen shake (trauma model) + hit-stop timer. */
export class Impact {
  trauma = 0
  stop = 0
  readonly offset = new Vector3()

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  hitStop(ms: number): void {
    this.stop = Math.max(this.stop, ms / 1000)
  }

  update(dt: number, time: number): void {
    this.trauma = Math.max(0, this.trauma - cfg.camera.shakeDecay * dt * 0.15)
    const k = this.trauma * this.trauma * 0.35
    this.offset.set(Math.sin(time * 61) * k, Math.sin(time * 53 + 1) * k, Math.sin(time * 47 + 2) * k)
  }
}
