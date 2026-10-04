// Security drones: patrol waypoints, see in a cone, build suspicion, then alert -> chase and shoot.
// A decoy in view steals their attention. Hit from behind while unaware = instant takedown.
import RAPIER from '@dimforge/rapier3d-compat'
import {
  CircleGeometry,
  Color,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  EdgesGeometry,
  RingGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import cfg from './config.json'
import type { Patrol } from './level'
import type { Materials } from './materials'

export type DroneState = 'patrol' | 'suspicious' | 'alert' | 'search' | 'dead'

const D = cfg.drone
const HALF_VIEW = ((D.viewDeg / 2) * Math.PI) / 180
const COS_HALF_VIEW = Math.cos(HALF_VIEW)
const BODY = new OctahedronGeometry(0.42)
const BODY_EDGES = new EdgesGeometry(BODY)
const CONE = new CircleGeometry(D.viewDist, 28, Math.PI / 2 - HALF_VIEW, HALF_VIEW * 2)
CONE.rotateX(Math.PI / 2) // arc centred on +Y -> +Z, the drone's forward
const RING = new TorusGeometry(0.62, 0.04, 6, 32)
const SUS = new RingGeometry(0.3, 0.42, 24)

const tmp = new Vector3()
const toTarget = new Vector3()
const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })

export interface SeeTarget {
  pos: Vector3 // eye-height point of the thing to look at
  collider: RAPIER.Collider | null // null = a decoy, LOS checked against anything solid
  sneaking: boolean
}

export class Drone {
  readonly root = new Group()
  readonly pos = new Vector3()
  readonly facing = new Vector3(0, 0, 1)
  state: DroneState = 'patrol'
  hp = D.hp
  suspicion = 0
  private wp = 0
  private alertLeft = 0
  private fireCd = 0
  readonly lastSeen = new Vector3()
  private readonly cone: Mesh
  private readonly coneMat: MeshBasicMaterial
  private readonly sus: Mesh
  private readonly susMat: MeshBasicMaterial
  private readonly ring: Mesh
  private bob = Math.random() * 10

  constructor(
    private readonly patrol: Patrol,
    mats: Materials,
  ) {
    const [x, z] = patrol.points[0]!
    this.pos.set(x, D.hover, z)
    const body = new Mesh(BODY, mats.enemyBody)
    const edges = new LineSegments(BODY_EDGES, mats.edge)
    edges.material = mats.edge
    const eye = new Mesh(new OctahedronGeometry(0.14), mats.enemyGlow)
    eye.position.z = 0.34
    this.ring = new Mesh(RING, mats.enemyGlow)
    this.ring.rotation.x = Math.PI / 2
    this.coneMat = mats.cone.clone()
    this.cone = new Mesh(CONE, this.coneMat)
    this.susMat = new MeshBasicMaterial({ toneMapped: false, transparent: true, depthTest: false })
    this.sus = new Mesh(SUS, this.susMat)
    this.sus.position.y = 0.95
    this.sus.renderOrder = 10
    this.root.add(body, edges, eye, this.ring, this.sus)
  }

  /** The cone lives in world space on the floor, not under the bobbing body. */
  get coneMesh(): Mesh {
    return this.cone
  }

  reset(): void {
    const [x, z] = this.patrol.points[0]!
    this.pos.set(x, D.hover, z)
    this.state = 'patrol'
    this.hp = D.hp
    this.suspicion = 0
    this.wp = 0
    this.root.visible = true
    this.cone.visible = true
  }

  /** Is the drone looking the other way from this point (for takedowns)? */
  isBehind(x: number, z: number): boolean {
    toTarget.set(x - this.pos.x, 0, z - this.pos.z).normalize()
    const limit = Math.cos(((180 - cfg.strike.takedownBehindDeg / 2) * Math.PI) / 180)
    return toTarget.dot(this.facing) < limit
  }

  canSee(world: RAPIER.World, t: SeeTarget): number {
    toTarget.copy(t.pos).sub(this.pos)
    const dist = toTarget.length()
    if (dist > D.viewDist) return 0
    tmp.set(toTarget.x, 0, toTarget.z).normalize()
    if (tmp.dot(this.facing) < COS_HALF_VIEW) return 0
    toTarget.divideScalar(dist)
    ray.origin.x = this.pos.x
    ray.origin.y = this.pos.y
    ray.origin.z = this.pos.z
    ray.dir.x = toTarget.x
    ray.dir.y = toTarget.y
    ray.dir.z = toTarget.z
    const hit = world.castRay(ray, dist, true)
    if (hit && (t.collider === null || hit.collider.handle !== t.collider.handle)) return 0
    return 1 - (dist / D.viewDist) * 0.6
  }

  update(dt: number, time: number, world: RAPIER.World, player: SeeTarget, decoy: SeeTarget | null, onFire: (from: Vector3, dir: Vector3) => void): DroneState | null {
    if (this.state === 'dead') return null
    let changed: DroneState | null = null
    const seeDecoy = decoy ? this.canSee(world, decoy) : 0
    const seePlayer = this.canSee(world, player)
    const target = seeDecoy > 0 ? decoy! : player
    const see = seeDecoy > 0 ? seeDecoy : seePlayer

    if (see > 0) {
      const rate = D.suspicionRate * see * (target === player && player.sneaking ? D.sneakFactor : 1)
      this.suspicion = Math.min(1, this.suspicion + rate * dt * (this.state === 'alert' ? 4 : 1))
      this.lastSeen.copy(target.pos)
    } else if (this.state !== 'alert') {
      this.suspicion = Math.max(0, this.suspicion - D.suspicionDecay * dt)
    }

    const prev = this.state
    if (this.suspicion >= 1 && see > 0) {
      this.state = 'alert'
      this.alertLeft = D.alertMs / 1000
    } else if (this.state === 'alert') {
      this.alertLeft -= dt
      if (this.alertLeft <= 0) {
        this.state = 'search'
        this.suspicion = 0.6
      }
    } else if (this.suspicion > 0.05) {
      this.state = this.state === 'search' ? 'search' : 'suspicious'
    } else {
      this.state = 'patrol'
    }
    if (prev !== this.state) changed = this.state

    // Movement
    let speed = D.patrolSpeed
    let goalX: number
    let goalZ: number
    let hold = false
    if (this.state === 'alert' || this.state === 'search' || this.state === 'suspicious') {
      goalX = this.lastSeen.x
      goalZ = this.lastSeen.z
      speed = this.state === 'alert' ? D.chaseSpeed : D.patrolSpeed * 0.8
      const dx = goalX - this.pos.x
      const dz = goalZ - this.pos.z
      const d = Math.hypot(dx, dz)
      if (this.state === 'alert' && d < D.keepDist && see > 0) hold = true
      if (this.state === 'suspicious') hold = see > 0 // freeze and stare while making up its mind
      if (this.state === 'search' && d < 1) this.state = 'patrol'
    } else {
      const [px, pz] = this.patrol.points[this.wp]!
      goalX = px
      goalZ = pz
      if (Math.hypot(px - this.pos.x, pz - this.pos.z) < 0.4) this.wp = (this.wp + 1) % this.patrol.points.length
    }
    tmp.set(goalX - this.pos.x, 0, goalZ - this.pos.z)
    const len = tmp.length()
    if (len > 0.001) {
      tmp.divideScalar(len)
      // Turn the facing towards the goal (or the target while holding)
      const k = Math.min(1, D.turnRate * dt)
      this.facing.lerp(tmp, k).normalize()
      if (!hold) {
        const step = Math.min(len, speed * dt)
        const nx = this.pos.x + tmp.x * step
        const nz = this.pos.z + tmp.z * step
        this.pos.x = nx
        this.pos.z = nz
      }
    }
    this.bob += dt
    this.pos.y = D.hover + Math.sin(this.bob * 2.2) * 0.12

    // Shooting
    this.fireCd -= dt
    if (this.state === 'alert' && see > 0 && this.fireCd <= 0) {
      this.fireCd = D.fireMs / 1000
      tmp.copy(target.pos).sub(this.pos).normalize()
      onFire(this.pos, tmp)
    }

    // Visuals
    this.root.position.copy(this.pos)
    this.root.rotation.y = Math.atan2(this.facing.x, this.facing.z)
    this.ring.rotation.z = time * (this.state === 'alert' ? 9 : 2)
    this.cone.position.set(this.pos.x, 0.04, this.pos.z)
    this.cone.rotation.y = this.root.rotation.y
    const c: Color = this.coneMat.color
    if (this.state === 'alert') c.setRGB(3, 0.25, 0.15)
    else if (this.suspicion > 0.05) c.setRGB(2.4, 1.6, 0.2)
    else c.setRGB(0.9, 1.4, 1.8)
    this.coneMat.opacity = this.state === 'alert' ? 0.22 + 0.08 * Math.sin(time * 20) : 0.14 + this.suspicion * 0.12
    this.sus.visible = this.suspicion > 0.02
    this.sus.scale.setScalar(0.4 + this.suspicion * 0.8)
    this.susMat.color.copy(c)
    this.susMat.opacity = 0.5 + this.suspicion * 0.5
    this.sus.quaternion.identity()
    return changed
  }

  damage(amount: number): boolean {
    this.hp -= amount
    if (this.hp <= 0) {
      this.state = 'dead'
      this.root.visible = false
      this.cone.visible = false
      return true
    }
    // Getting hit always blows your cover
    this.suspicion = 1
    this.state = 'alert'
    this.alertLeft = D.alertMs / 1000
    return false
  }

  alertTo(p: Vector3): void {
    if (this.state === 'dead') return
    this.lastSeen.copy(p)
    if (this.state !== 'alert') {
      this.state = 'search'
      this.suspicion = Math.max(this.suspicion, 0.6)
    }
  }
}
