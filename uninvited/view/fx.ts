// Juice that lives in the scene: streak sparks, the travelling rifle bolt, wall scorches, contact stars, drone bolts, the sword
// trail, flashes, noise rings on the floor. Every pool is allocated up front; spawning and updating never allocate, and nothing
// here adds a light or a texture (the glows are vertex-coloured gradients).
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Camera,
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
  /** Streak sparks thrown along a direction (a unit vector) within a cone of `spread` (0 = a line, 1 = wide). */
  streaks(x: number, y: number, z: number, dx: number, dy: number, dz: number, count: number, speed: number, spread: number, color: Color): void
  /** A bright bolt that travels from a to b in 0.05-0.1 s (hitscan: the damage is already done). */
  tracer(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void
  /** A short glowing scorch on a wall or floor (normal n), fading over view.juice.scorchSec. */
  scorch(x: number, y: number, z: number, nx: number, ny: number, nz: number, color: Color): void
  /** A contact star: a camera-facing, overdriven spike burst in `color` (never white for an enemy: white is the hero's). */
  star(x: number, y: number, z: number, color: Color, size: number, sec?: number): void
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

export function createFx(camera: Camera): Fx {
  const root = new Group()

  // ---- sparks: streaks (line segments from the particle back along its velocity), colour per particle
  const N = F.sparks
  const pos = new Float32Array(N * 6)
  const col = new Float32Array(N * 6)
  const vel = new Float32Array(N * 3)
  const life = new Float32Array(N)
  const base = new Float32Array(N * 3)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const lines = new LineSegments(geo, new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
  lines.frustumCulled = false
  root.add(lines)
  let next = 0
  for (let i = 0; i < N; i++) pos[i * 6 + 1] = pos[i * 6 + 4] = -1000

  function spawnSpark(i: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, color: Color): void {
    const o = i * 3
    const p = i * 6
    pos[p] = pos[p + 3] = x
    pos[p + 1] = pos[p + 4] = y
    pos[p + 2] = pos[p + 5] = z
    vel[o] = vx
    vel[o + 1] = vy
    vel[o + 2] = vz
    life[i] = 0.3 + ((i * 0.7548776) % 1) * 0.4
    base[o] = color.r
    base[o + 1] = color.g
    base[o + 2] = color.b
  }

  // ---- tracers: a bright comet-shaped bolt that flies from the muzzle to the hit point
  const tracerGeo = new CylinderGeometry(1, 0.12, 1, 8, 1, true)
  tracerGeo.translate(0, 0.5, 0)
  {
    // vertex colours: white-hot head (top ring), a dim cyan tail (bottom ring)
    const n = tracerGeo.getAttribute('position').count
    const c = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const top = (tracerGeo.getAttribute('position').getY(i) as number) > 0.5
      c[i * 3] = top ? 1 : 0.1
      c[i * 3 + 1] = top ? 1 : 0.55
      c[i * 3 + 2] = top ? 1 : 0.7
    }
    tracerGeo.setAttribute('color', new BufferAttribute(c, 3))
  }
  interface Tracer {
    mesh: Mesh
    mat: MeshBasicMaterial
    t: number
    life: number
    speed: number
    dist: number
    dir: Vector3
    from: Vector3
  }
  const tracers: Tracer[] = []
  for (let i = 0; i < F.tracers; i++) {
    const mat = new MeshBasicMaterial({ color: palette.heroWhite.clone().multiplyScalar(J.tracerGlow / 2.4), vertexColors: true, toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
    const mesh = new Mesh(tracerGeo, mat)
    mesh.visible = false
    mesh.frustumCulled = false
    root.add(mesh)
    tracers.push({ mesh, mat, t: 0, life: 0, speed: 1, dist: 0, dir: new Vector3(), from: new Vector3() })
  }
  let nextTracer = 0

  // ---- scorches: a soft glowing disc on the surface (a gradient from vertex colours: bright centre, black rim), no texture
  const scorchGeo = new CircleGeometry(1, 20)
  {
    const n = scorchGeo.getAttribute('position').count
    const c = new Float32Array(n * 3)
    c[0] = c[1] = c[2] = 1 // vertex 0 is the centre
    scorchGeo.setAttribute('color', new BufferAttribute(c, 3))
  }
  const scorches: { mesh: Mesh; mat: MeshBasicMaterial; t: number }[] = []
  for (let i = 0; i < F.scorches; i++) {
    const mat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    const mesh = new Mesh(scorchGeo, mat)
    mesh.visible = false
    mesh.frustumCulled = false
    root.add(mesh)
    scorches.push({ mesh, mat, t: 0 })
  }
  let nextScorch = 0
  const Z = new Vector3(0, 0, 1)

  // ---- contact stars: an 8-point spike burst facing the camera (centre bright, tips dark), drawn over the target
  const starGeo = new BufferGeometry()
  {
    const p = new Float32Array(9 * 3)
    const c = new Float32Array(9 * 3)
    c[0] = c[1] = c[2] = 1
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const r = k % 2 === 0 ? 1 : 0.22
      p[(k + 1) * 3] = Math.cos(a) * r
      p[(k + 1) * 3 + 1] = Math.sin(a) * r
    }
    const idx: number[] = []
    for (let k = 0; k < 8; k++) idx.push(0, 1 + k, 1 + ((k + 1) % 8))
    starGeo.setAttribute('position', new BufferAttribute(p, 3))
    starGeo.setAttribute('color', new BufferAttribute(c, 3))
    starGeo.setIndex(idx)
  }
  const stars: { mesh: Mesh; mat: MeshBasicMaterial; t: number; sec: number; size: number; roll: Quaternion }[] = []
  for (let i = 0; i < F.stars; i++) {
    const mat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, depthTest: false, side: DoubleSide })
    const mesh = new Mesh(starGeo, mat)
    mesh.visible = false
    mesh.frustumCulled = false
    mesh.renderOrder = 10
    root.add(mesh)
    stars.push({ mesh, mat, t: 0, sec: 1, size: 1, roll: new Quaternion() })
  }
  let nextStar = 0

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
        // a cheap pseudo-random direction from the index
        const a = (i * 2.399963) % (Math.PI * 2)
        const b = ((i * 0.618034) % 1) * 2 - 1
        const r = Math.sqrt(1 - b * b)
        const sp = speed * (0.35 + ((i * 0.381966) % 1) * 0.65)
        spawnSpark(i, x, y, z, Math.cos(a) * r * sp, (b * 0.7 + up) * sp, Math.sin(a) * r * sp, color)
      }
    },
    streaks(x, y, z, dx, dy, dz, count, speed, spread, color): void {
      // two vectors across the direction, to scatter the cone
      tmpA.set(dx, dy, dz)
      tmpB.crossVectors(tmpA, Math.abs(dy) > 0.9 ? Z : UP).normalize()
      const ux = tmpB.x
      const uy = tmpB.y
      const uz = tmpB.z
      const vx = dy * uz - dz * uy
      const vy = dz * ux - dx * uz
      const vz = dx * uy - dy * ux
      for (let k = 0; k < count; k++) {
        const i = next
        next = (next + 1) % N
        const a = (i * 2.399963) % (Math.PI * 2)
        const rr = Math.sqrt((i * 0.618034) % 1) * spread
        const sp = speed * (0.45 + ((i * 0.381966) % 1) * 0.75)
        const cu = Math.cos(a) * rr
        const cv = Math.sin(a) * rr
        spawnSpark(i, x, y, z, (dx + ux * cu + vx * cv) * sp, (dy + uy * cu + vy * cv) * sp, (dz + uz * cu + vz * cv) * sp, color)
      }
    },
    tracer(ax, ay, az, bx, by, bz): void {
      const t = tracers[nextTracer] as Tracer
      nextTracer = (nextTracer + 1) % tracers.length
      t.from.set(ax, ay, az)
      tmpB.set(bx - ax, by - ay, bz - az)
      const len = tmpB.length()
      if (len < 1e-3) return
      t.dir.copy(tmpB).divideScalar(len)
      t.dist = len
      const travel = Math.min(J.tracerMaxSec, Math.max(J.tracerMinSec, len / J.tracerSpeed))
      t.speed = len / travel
      t.life = (len + J.tracerLen) / t.speed
      t.t = 0
      t.mesh.position.copy(t.from)
      t.mesh.quaternion.setFromUnitVectors(UP, t.dir)
      t.mesh.visible = true
    },
    scorch(x, y, z, nx, ny, nz, color): void {
      const sc = scorches[nextScorch] as { mesh: Mesh; mat: MeshBasicMaterial; t: number }
      nextScorch = (nextScorch + 1) % scorches.length
      sc.mesh.position.set(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03)
      tmpA.set(nx, ny, nz)
      sc.mesh.quaternion.setFromUnitVectors(Z, tmpA)
      sc.mat.color.copy(color).multiplyScalar(J.scorchGlow)
      sc.t = J.scorchSec
      sc.mesh.visible = true
    },
    star(x, y, z, color, size, sec = J.starSec): void {
      const st = stars[nextStar] as (typeof stars)[number]
      nextStar = (nextStar + 1) % stars.length
      st.mesh.position.set(x, y, z)
      st.mat.color.copy(color)
      st.t = sec
      st.sec = sec
      st.size = size
      st.roll.setFromAxisAngle(Z, Math.random() * Math.PI)
      st.mesh.visible = true
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
      // sparks: the head moves, the tail trails behind along the velocity
      const sk = J.streakSec
      for (let i = 0; i < N; i++) {
        const l = life[i] as number
        if (l <= 0) continue
        const nl = l - dt
        life[i] = nl
        const o = i * 3
        const p = i * 6
        if (nl <= 0) {
          pos[p + 1] = pos[p + 4] = -1000
          col[p] = col[p + 1] = col[p + 2] = col[p + 3] = col[p + 4] = col[p + 5] = 0
          continue
        }
        vel[o + 1] = (vel[o + 1] as number) - 9 * dt
        const hx = (pos[p] as number) + (vel[o] as number) * dt
        const hy = (pos[p + 1] as number) + (vel[o + 1] as number) * dt
        const hz = (pos[p + 2] as number) + (vel[o + 2] as number) * dt
        pos[p] = hx
        pos[p + 1] = hy
        pos[p + 2] = hz
        pos[p + 3] = hx - (vel[o] as number) * sk
        pos[p + 4] = hy - (vel[o + 1] as number) * sk
        pos[p + 5] = hz - (vel[o + 2] as number) * sk
        const k = Math.min(1, nl * 3)
        col[p] = (base[o] as number) * k
        col[p + 1] = (base[o + 1] as number) * k
        col[p + 2] = (base[o + 2] as number) * k
        col[p + 3] = (base[o] as number) * k * 0.08
        col[p + 4] = (base[o + 1] as number) * k * 0.08
        col[p + 5] = (base[o + 2] as number) * k * 0.08
      }
      ;(geo.getAttribute('position') as BufferAttribute).needsUpdate = true
      ;(geo.getAttribute('color') as BufferAttribute).needsUpdate = true
      for (const t of tracers) {
        if (!t.mesh.visible) continue
        t.t += dt
        const h = t.speed * t.t
        const tail = Math.max(0, h - J.tracerLen)
        const head = Math.min(h, t.dist)
        if (head - tail < 1e-3 || t.t >= t.life) {
          t.mesh.visible = false
          continue
        }
        t.mesh.position.set(t.from.x + t.dir.x * tail, t.from.y + t.dir.y * tail, t.from.z + t.dir.z * tail)
        t.mesh.scale.set(J.tracerWidth, head - tail, J.tracerWidth)
        t.mat.opacity = Math.min(1, (t.life - t.t) / 0.03)
      }
      for (const sc of scorches) {
        if (sc.t <= 0) continue
        sc.t -= dt
        const k = Math.max(0, sc.t / J.scorchSec) // 1 -> 0
        sc.mesh.scale.setScalar(J.scorchSize * (1.25 - 0.25 * k))
        sc.mat.opacity = k * k
        if (sc.t <= 0) sc.mesh.visible = false
      }
      for (const st of stars) {
        if (st.t <= 0) continue
        st.t -= dt
        const k = Math.max(0, st.t / st.sec) // 1 -> 0
        st.mesh.quaternion.copy(camera.quaternion).multiply(st.roll)
        st.mesh.scale.setScalar(st.size * (0.45 + 0.55 * Math.min(1, (1 - k) * 5)))
        st.mat.opacity = Math.min(1, k * 2)
        if (st.t <= 0) st.mesh.visible = false
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
