// Juice that lives in the scene: sparks, rifle tracers, drone bolts, the sword trail, flashes, noise rings on the floor.
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
const J = cfgAll.view.juice

export interface Fx {
  root: Group
  sparks(x: number, y: number, z: number, count: number, speed: number, color: Color, up?: number): void
  tracer(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void
  /** One sample of the sword trail: the blade's hilt and tip this frame. `start` begins a new stroke (no ribbon back to the last sample). */
  trail(hx: number, hy: number, hz: number, tx: number, ty: number, tz: number, start: boolean, color: Color): void
  /** A bright flash that swells and fades: muzzle flashes, kill bursts. */
  flash(x: number, y: number, z: number, color: Color, size: number, sec: number): void
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

  // ---- the sword trail: a ribbon between the hilt's and the tip's path, newest sample first, fading with age
  const K = F.trailPoints
  const tPos = new Float32Array(K * 6)
  const tCol = new Float32Array(K * 6)
  const tIdx = new Uint16Array((K - 1) * 6)
  const tAge = new Float32Array(K).fill(1e9)
  const tCut = new Uint8Array(K).fill(1)
  const tTint = new Float32Array(K * 3)
  const trailGeo = new BufferGeometry()
  trailGeo.setAttribute('position', new BufferAttribute(tPos, 3))
  trailGeo.setAttribute('color', new BufferAttribute(tCol, 3))
  trailGeo.setIndex(new BufferAttribute(tIdx, 1))
  const trailMesh = new Mesh(trailGeo, new MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
  trailMesh.frustumCulled = false
  trailMesh.visible = false
  root.add(trailMesh)

  // ---- flashes: additive spheres that swell and fade
  const flashGeo = new SphereGeometry(1, 10, 8)
  const flashes: { mesh: Mesh; mat: MeshBasicMaterial; t: number; sec: number; size: number }[] = []
  for (let i = 0; i < F.flashes; i++) {
    const mat = new MeshBasicMaterial({ color: new Color(1, 1, 1), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
    const mesh = new Mesh(flashGeo, mat)
    mesh.visible = false
    root.add(mesh)
    flashes.push({ mesh, mat, t: 0, sec: 1, size: 1 })
  }
  let nextFlash = 0

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
      t.mesh.scale.set(J.tracerWidth / 0.025, len, J.tracerWidth / 0.025)
      t.mat.color.copy(palette.heroWhite).multiplyScalar(J.tracerGlow / 2.4)
      t.mesh.visible = true
      t.t = F.tracerSec
    },
    trail(hx, hy, hz, tx, ty, tz, start, color): void {
      // shift everything one sample older, then write the new one at the front
      tAge.copyWithin(1, 0, K - 1)
      tCut.copyWithin(1, 0, K - 1)
      tTint.copyWithin(3, 0, (K - 1) * 3)
      tPos.copyWithin(6, 0, (K - 1) * 6)
      tAge[0] = 0
      tCut[0] = start ? 1 : 0
      tTint[0] = color.r
      tTint[1] = color.g
      tTint[2] = color.b
      tPos[0] = hx
      tPos[1] = hy
      tPos[2] = hz
      tPos[3] = tx
      tPos[4] = ty
      tPos[5] = tz
    },
    flash(x, y, z, color, size, sec): void {
      const f = flashes[nextFlash] as { mesh: Mesh; mat: MeshBasicMaterial; t: number; sec: number; size: number }
      nextFlash = (nextFlash + 1) % flashes.length
      f.mesh.position.set(x, y, z)
      f.mat.color.copy(color)
      f.t = sec
      f.sec = sec
      f.size = size
      f.mesh.visible = true
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
      for (const f of flashes) {
        if (f.t <= 0) continue
        f.t -= dt
        const k = Math.max(0, f.t / f.sec) // 1 -> 0
        f.mesh.scale.setScalar(f.size * (0.35 + 0.65 * (1 - k * k)))
        f.mat.opacity = 0.7 * k * k
        if (f.t <= 0) f.mesh.visible = false
      }
      // the trail: each sample's ribbon fades with its age
      let quads = 0
      for (let i = 0; i < K; i++) tAge[i] = (tAge[i] as number) + dt
      for (let i = 0; i < K; i++) {
        const a = tAge[i] as number
        const k = Math.max(0, 1 - a / J.trailSec)
        const o = i * 6
        const g = J.trailGlow * k * k
        tCol[o] = (tTint[i * 3] as number) * g * 0.25 // the hilt side stays dim
        tCol[o + 1] = (tTint[i * 3 + 1] as number) * g * 0.25
        tCol[o + 2] = (tTint[i * 3 + 2] as number) * g * 0.25
        tCol[o + 3] = (tTint[i * 3] as number) * g
        tCol[o + 4] = (tTint[i * 3 + 1] as number) * g
        tCol[o + 5] = (tTint[i * 3 + 2] as number) * g
      }
      for (let i = 0; i < K - 1; i++) {
        if (tCut[i] === 1 || (tAge[i + 1] as number) >= J.trailSec || (tAge[i] as number) >= J.trailSec) continue
        const o = quads * 6
        tIdx[o] = i * 2
        tIdx[o + 1] = i * 2 + 1
        tIdx[o + 2] = (i + 1) * 2
        tIdx[o + 3] = i * 2 + 1
        tIdx[o + 4] = (i + 1) * 2 + 1
        tIdx[o + 5] = (i + 1) * 2
        quads++
      }
      trailGeo.setDrawRange(0, quads * 6)
      trailMesh.visible = quads > 0
      if (quads > 0) {
        ;(trailGeo.getAttribute('position') as BufferAttribute).needsUpdate = true
        ;(trailGeo.getAttribute('color') as BufferAttribute).needsUpdate = true
        ;(trailGeo.index as BufferAttribute).needsUpdate = true
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
