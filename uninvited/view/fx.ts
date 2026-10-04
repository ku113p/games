// Juice that lives in the scene: sparks, rifle tracers, drone bolts, the sword's slash arc, noise rings on the floor.
// Every pool is allocated up front; spawning and updating never allocate.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import cfgAll from '../config.json'
import type { GameState } from '../core/state'
import { bolts } from '../core/queries'
import { palette } from './look'

const F = cfgAll.view.fx

export interface Fx {
  root: Group
  sparks(x: number, y: number, z: number, count: number, speed: number, color: Color, up?: number): void
  tracer(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void
  slash(x: number, y: number, z: number, yaw: number): void
  noiseRing(x: number, y: number, z: number, radius: number): void
  update(dt: number, s: GameState): void
}

const UP = new Vector3(0, 1, 0)
const tmpA = new Vector3()
const tmpB = new Vector3()

export function createFx(): Fx {
  const root = new Group()

  // ---- sparks: a points cloud with per-particle color
  const N = F.sparks
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const vel = new Float32Array(N * 3)
  const life = new Float32Array(N)
  const base = new Float32Array(N * 3)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const points = new Points(geo, new PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
  points.frustumCulled = false
  root.add(points)
  let next = 0
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -1000

  // ---- tracers: stretched glowing cylinders
  const tracerGeo = new CylinderGeometry(0.025, 0.025, 1, 6, 1, true)
  tracerGeo.translate(0, 0.5, 0)
  const tracers: { mesh: Mesh; mat: MeshBasicMaterial; t: number }[] = []
  for (let i = 0; i < F.tracers; i++) {
    const mat = new MeshBasicMaterial({ color: palette.heroWhite.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
    const mesh = new Mesh(tracerGeo, mat)
    mesh.visible = false
    root.add(mesh)
    tracers.push({ mesh, mat, t: 0 })
  }
  let nextTracer = 0

  // ---- drone bolts: follow the state's bolt pool
  const boltGeo = new SphereGeometry(0.09, 8, 6)
  boltGeo.scale(1, 1, 3.2)
  const boltMat = new MeshBasicMaterial({ color: palette.security.clone().multiplyScalar(1.4), toneMapped: false })
  const boltMeshes: Mesh[] = []

  // ---- slash arcs: a half ring of light in front of the hero
  const slashGeo = new RingGeometry(1.2, 2.5, 32, 1, -Math.PI / 2, Math.PI)
  slashGeo.rotateX(-Math.PI / 2)
  const slashes: { mesh: Mesh; mat: MeshBasicMaterial; t: number }[] = []
  for (let i = 0; i < 3; i++) {
    const mat = new MeshBasicMaterial({ color: palette.heroWhite.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const mesh = new Mesh(slashGeo, mat)
    mesh.visible = false
    root.add(mesh)
    slashes.push({ mesh, mat, t: 0 })
  }
  let nextSlash = 0

  // ---- noise rings: show how far a sound carries (teaches the stealth)
  const ringGeo = new RingGeometry(0.94, 1, 64)
  ringGeo.rotateX(-Math.PI / 2)
  const rings: { mesh: Mesh; mat: MeshBasicMaterial; t: number; r: number }[] = []
  for (let i = 0; i < F.noiseRings; i++) {
    const mat = new MeshBasicMaterial({ color: palette.sound.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const mesh = new Mesh(ringGeo, mat)
    mesh.visible = false
    root.add(mesh)
    rings.push({ mesh, mat, t: 0, r: 1 })
  }
  let nextRing = 0

  return {
    root,
    sparks(x, y, z, count, speed, color, up = 0.4): void {
      for (let k = 0; k < count; k++) {
        const i = next
        next = (next + 1) % N
        const o = i * 3
        pos[o] = x
        pos[o + 1] = y
        pos[o + 2] = z
        // a cheap pseudo-random direction from the index (no Math.random in the hot path needed, but fine either way)
        const a = (i * 2.399963) % (Math.PI * 2)
        const b = ((i * 0.618034) % 1) * 2 - 1
        const r = Math.sqrt(1 - b * b)
        const sp = speed * (0.35 + ((i * 0.381966) % 1) * 0.65)
        vel[o] = Math.cos(a) * r * sp
        vel[o + 1] = (b * 0.7 + up) * sp
        vel[o + 2] = Math.sin(a) * r * sp
        life[i] = 0.35 + ((i * 0.7548776) % 1) * 0.45
        base[o] = color.r
        base[o + 1] = color.g
        base[o + 2] = color.b
      }
    },
    tracer(ax, ay, az, bx, by, bz): void {
      const t = tracers[nextTracer] as { mesh: Mesh; mat: MeshBasicMaterial; t: number }
      nextTracer = (nextTracer + 1) % tracers.length
      tmpA.set(ax, ay, az)
      tmpB.set(bx - ax, by - ay, bz - az)
      const len = tmpB.length()
      if (len < 1e-3) return
      t.mesh.position.copy(tmpA)
      t.mesh.quaternion.setFromUnitVectors(UP, tmpB.divideScalar(len))
      t.mesh.scale.set(1, len, 1)
      t.mesh.visible = true
      t.t = F.tracerSec
    },
    slash(x, y, z, yaw): void {
      const s = slashes[nextSlash] as { mesh: Mesh; mat: MeshBasicMaterial; t: number }
      nextSlash = (nextSlash + 1) % slashes.length
      s.mesh.position.set(x, y, z)
      s.mesh.rotation.set(0, yaw, 0.12)
      s.mesh.visible = true
      s.t = F.slashSec
    },
    noiseRing(x, y, z, radius): void {
      const r = rings[nextRing] as { mesh: Mesh; mat: MeshBasicMaterial; t: number; r: number }
      nextRing = (nextRing + 1) % rings.length
      r.mesh.position.set(x, y + 0.05, z)
      r.r = radius
      r.t = F.noiseRingSec
      r.mesh.visible = true
    },
    update(dt, s): void {
      // sparks
      for (let i = 0; i < N; i++) {
        const l = life[i] as number
        if (l <= 0) continue
        const nl = l - dt
        life[i] = nl
        const o = i * 3
        if (nl <= 0) {
          pos[o + 1] = -1000
          col[o] = col[o + 1] = col[o + 2] = 0
          continue
        }
        vel[o + 1] = (vel[o + 1] as number) - 9 * dt
        pos[o] = (pos[o] as number) + (vel[o] as number) * dt
        pos[o + 1] = (pos[o + 1] as number) + (vel[o + 1] as number) * dt
        pos[o + 2] = (pos[o + 2] as number) + (vel[o + 2] as number) * dt
        const k = Math.min(1, nl * 3)
        col[o] = (base[o] as number) * k
        col[o + 1] = (base[o + 1] as number) * k
        col[o + 2] = (base[o + 2] as number) * k
      }
      ;(geo.getAttribute('position') as BufferAttribute).needsUpdate = true
      ;(geo.getAttribute('color') as BufferAttribute).needsUpdate = true
      for (const t of tracers) {
        if (t.t <= 0) continue
        t.t -= dt
        t.mat.opacity = Math.max(0, t.t / F.tracerSec)
        if (t.t <= 0) t.mesh.visible = false
      }
      for (const sl of slashes) {
        if (sl.t <= 0) continue
        sl.t -= dt
        const k = Math.max(0, sl.t / F.slashSec)
        sl.mat.opacity = k
        sl.mesh.scale.setScalar(0.85 + (1 - k) * 0.3)
        if (sl.t <= 0) sl.mesh.visible = false
      }
      for (const r of rings) {
        if (r.t <= 0) continue
        r.t -= dt
        const k = 1 - Math.max(0, r.t / F.noiseRingSec)
        r.mesh.scale.setScalar(Math.max(0.01, r.r * (0.2 + 0.8 * k)))
        r.mat.opacity = (1 - k) * 0.35
        if (r.t <= 0) r.mesh.visible = false
      }
      // bolts
      const bs = bolts(s)
      while (boltMeshes.length < bs.length) {
        const m = new Mesh(boltGeo, boltMat)
        m.visible = false
        root.add(m)
        boltMeshes.push(m)
      }
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i]
        const m = boltMeshes[i] as Mesh
        if (!b || !b.active) {
          m.visible = false
          continue
        }
        m.visible = true
        m.position.set(b.pos.x, b.pos.y, b.pos.z)
        tmpA.set(b.pos.x + b.vel.x, b.pos.y + b.vel.y, b.pos.z + b.vel.z)
        m.lookAt(tmpA)
      }
    },
  }
}
