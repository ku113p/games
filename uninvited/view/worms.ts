// Worms (DESIGN 9): small low-poly glowing programs that skitter along the floor in packs. Glossy black faceted
// segments strung on hot magenta-red light rings, a head with two glowing eyes and a pair of mandibles, thin legs
// that flicker as they run. The body follows the head like a chain, so it trails out of the spawn gates and wiggles
// side to side as it rushes. Before a bite it rears up, opens the mandibles and the rings flare (the telegraph); a
// hit flashes it white, a kill scatters its segments in a burst of sparks.
// Everything is instanced (one draw call per part for all worms) and built once; updating never allocates.
import { BoxGeometry, Color, ConeGeometry, Group, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import cfgAll from '../config.json'
import { gameTime, monsters as worms, monsterWindup as wormWindup } from '../core/queries'
import type { GameState, Sim } from '../core/state'
import { addRim, hdr, type Materials } from './look'

const W = cfgAll.view.worms
const SEG = W.segments
const RINGS = SEG - 1
const LEGS = (SEG - 2) * 2
const HR = W.headRadius

export interface WormViews {
  root: Group
  update(s: GameState, sim: Sim, dt: number): void
  /** A hit that did not kill: flash it. */
  flash(i: number): void
  /** Killed: its segments scatter and burn out; `spark` is called for each segment (for the view's sparks). */
  burst(i: number, spark: (x: number, y: number, z: number) => void): void
}

const glow = hdr(cfgAll.view.colors.worm)
const eyeGlow = hdr(cfgAll.view.colors.wormEye)
const white = new Color(3, 3, 3.2)
const tmpC = new Color()
const dummy = new Object3D()
const fwd = new Vector3()
const UP_Z = new Vector3(0, 0, 1)

export function buildWorms(s: GameState, mats: Materials): WormViews {
  const max = worms(s).length
  const root = new Group()
  const bodyGeo = new IcosahedronGeometry(1, 0)
  const ringGeo = new TorusGeometry(1, 0.2, 4, 10)
  const eyeGeo = new SphereGeometry(1, 6, 4)
  const jawGeo = new ConeGeometry(0.05, 0.34, 4)
  jawGeo.rotateX(Math.PI / 2) // points along +z
  jawGeo.translate(0, 0, 0.17)
  const legGeo = new BoxGeometry(0.018, 0.018, 1)
  legGeo.translate(0, 0, 0.5)
  const ringMat = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  const eyeMat = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  const legMat = new MeshBasicMaterial({ color: glow.clone().multiplyScalar(0.5), toneMapped: false })
  // faceted glossy black with a faint hostile glow from inside, so the bodies read against the dark floor
  const bodyMat = new MeshStandardMaterial({ color: 0x0c0810, metalness: 0.75, roughness: 0.3, flatShading: true, emissive: glow.clone().multiplyScalar(0.05) })
  addRim(bodyMat, 1.6)

  const body = new InstancedMesh(bodyGeo, bodyMat, max * SEG)
  const rings = new InstancedMesh(ringGeo, ringMat, max * RINGS)
  const eyes = new InstancedMesh(eyeGeo, eyeMat, max * 2)
  const jaws = new InstancedMesh(jawGeo, mats.glossBlack, max * 2)
  const legs = new InstancedMesh(legGeo, legMat, max * LEGS)
  for (const m of [body, rings, eyes, jaws, legs]) {
    m.frustumCulled = false
    root.add(m)
  }
  for (let k = 0; k < max * RINGS; k++) rings.setColorAt(k, glow)
  for (let k = 0; k < max * 2; k++) eyes.setColorAt(k, eyeGlow)

  // the chain: segment positions per worm (x, y, z), and per-segment scatter velocities while dying
  const chain = new Float32Array(max * SEG * 3)
  const scatter = new Float32Array(max * SEG * 3)
  const placed = new Uint8Array(max)
  const phase = new Float32Array(max)
  const lastX = new Float32Array(max)
  const lastZ = new Float32Array(max)
  const flashT = new Float32Array(max)
  const dying = new Float32Array(max)
  const dyingYaw = new Float32Array(max)

  const radius = (k: number): number => W.headRadius + (W.tailRadius - W.headRadius) * (k / (SEG - 1))

  function hide(mesh: InstancedMesh, from: number, n: number): void {
    dummy.position.set(0, -1000, 0)
    dummy.scale.setScalar(0)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    for (let k = 0; k < n; k++) mesh.setMatrixAt(from + k, dummy.matrix)
  }

  /** Writes the instances of worm i from its chain (scale 0..1 for the death burn-out). */
  function draw(i: number, yaw: number, windup: number, time: number, scale: number, ringColor: Color): void {
    const o = i * SEG * 3
    for (let k = 0; k < SEG; k++) {
      const x = chain[o + k * 3] as number
      const y = chain[o + k * 3 + 1] as number
      const z = chain[o + k * 3 + 2] as number
      // direction along the body: towards the previous segment (the head looks along its yaw)
      if (k === 0) fwd.set(Math.sin(yaw), windup * 0.9, Math.cos(yaw))
      else fwd.set((chain[o + (k - 1) * 3] as number) - x, (chain[o + (k - 1) * 3 + 1] as number) - y, (chain[o + (k - 1) * 3 + 2] as number) - z)
      if (fwd.lengthSq() < 1e-8) fwd.set(Math.sin(yaw), 0, Math.cos(yaw))
      fwd.normalize()
      const r = radius(k) * scale
      dummy.position.set(x, y + r * 0.8, z)
      dummy.quaternion.setFromUnitVectors(UP_Z, fwd)
      dummy.scale.set(r, r * 0.78, r * 1.25)
      dummy.updateMatrix()
      body.setMatrixAt(i * SEG + k, dummy.matrix)
      if (k > 0) {
        // the light ring between this segment and the one in front
        dummy.position.set(x + fwd.x * r * 0.9, y + r * 0.8 + fwd.y * r * 0.9, z + fwd.z * r * 0.9)
        const rr = r * 0.95
        dummy.scale.set(rr, rr * 0.8, rr)
        dummy.updateMatrix()
        rings.setMatrixAt(i * RINGS + k - 1, dummy.matrix)
        // brighter towards the head, flaring with the windup, a pulse running down the body
        const pulse = 0.75 + 0.35 * Math.sin(time * 9 - k * 0.9 + i)
        tmpC.copy(ringColor).multiplyScalar(pulse * (1 + windup * 1.5) * (1 - k / (SEG + 2)))
        rings.setColorAt(i * RINGS + k - 1, tmpC)
      }
      if (k >= 1 && k <= SEG - 2) {
        // a pair of legs, flickering back and forth as it runs
        const swing = Math.sin(phase[i] as number * 3.1 + k * 1.7) * 0.7
        for (let side = 0; side < 2; side++) {
          const sgn = side === 0 ? 1 : -1
          const a = yaw + sgn * (Math.PI / 2 + swing * sgn)
          dummy.position.set(x, y + r * 0.6, z)
          dummy.rotation.set(0.55, a, 0, 'YXZ')
          dummy.scale.set(scale, scale, r * 2.4)
          dummy.updateMatrix()
          legs.setMatrixAt(i * LEGS + (k - 1) * 2 + side, dummy.matrix)
          dummy.rotation.set(0, 0, 0)
        }
      }
    }
    // the head: eyes and mandibles
    const hx = chain[o] as number
    const hy = (chain[o + 1] as number) + W.headRadius * 0.8 * scale
    const hz = chain[o + 2] as number
    const sy = Math.sin(yaw)
    const cy = Math.cos(yaw)
    const er = 0.05 * scale * (1 + windup * 0.6)
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1
      dummy.position.set(hx + sy * HR * 0.7 * scale + cy * HR * 0.44 * sgn * scale, hy + HR * 0.35 * scale + windup * 0.1, hz + cy * HR * 0.7 * scale - sy * HR * 0.44 * sgn * scale)
      dummy.scale.setScalar(er)
      dummy.updateMatrix()
      eyes.setMatrixAt(i * 2 + side, dummy.matrix)
      // mandibles open wide during the windup and snap shut
      const open = 0.25 + windup * 0.9 + Math.sin(time * 30 + i) * 0.05
      dummy.position.set(hx + sy * HR * 0.76 * scale + cy * HR * 0.3 * sgn * scale, hy - HR * 0.18 * scale + windup * 0.08, hz + cy * HR * 0.76 * scale - sy * HR * 0.3 * sgn * scale)
      dummy.rotation.set(-windup * 0.6, yaw + sgn * open, 0, 'YXZ')
      dummy.scale.setScalar(scale * (1 + windup * 0.3))
      dummy.updateMatrix()
      jaws.setMatrixAt(i * 2 + side, dummy.matrix)
      dummy.rotation.set(0, 0, 0)
    }
  }

  function hideWorm(i: number): void {
    hide(body, i * SEG, SEG)
    hide(rings, i * RINGS, RINGS)
    hide(eyes, i * 2, 2)
    hide(jaws, i * 2, 2)
    hide(legs, i * LEGS, LEGS)
  }

  for (let i = 0; i < max; i++) hideWorm(i)

  return {
    root,
    update(st: GameState, sim: Sim, dt: number): void {
      const time = gameTime(st)
      const ws = worms(st)
      for (let i = 0; i < max; i++) {
        const w = ws[i]
        const o = i * SEG * 3
        if (dying[i] as number > 0) {
          // scattering segments burn out
          dying[i] = (dying[i] as number) - dt
          const k = Math.max(0, (dying[i] as number) / W.deathSec)
          for (let q = 0; q < SEG; q++) {
            const a = o + q * 3
            scatter[a + 1] = (scatter[a + 1] as number) - 9 * dt
            chain[a] = (chain[a] as number) + (scatter[a] as number) * dt
            chain[a + 1] = Math.max(-0.2, (chain[a + 1] as number) + (scatter[a + 1] as number) * dt)
            chain[a + 2] = (chain[a + 2] as number) + (scatter[a + 2] as number) * dt
          }
          if (k <= 0) hideWorm(i)
          else draw(i, dyingYaw[i] as number, 0, time, k, white)
          continue
        }
        if (!w || !w.active || !w.alive || w.spawnTime > 0) {
          if (placed[i]) hideWorm(i)
          placed[i] = 0
          continue
        }
        // the head: the core position plus a side-to-side wiggle that advances with the distance crawled
        const moved = placed[i] ? Math.hypot(w.pos.x - (lastX[i] as number), w.pos.z - (lastZ[i] as number)) : 0
        lastX[i] = w.pos.x
        lastZ[i] = w.pos.z
        phase[i] = (phase[i] as number) + (moved / W.wiggleStride) * Math.PI + dt * 2
        const windup = wormWindup(st, sim, i)
        const wig = Math.sin(phase[i] as number) * W.wiggle * (w.mode === 'windup' ? 0.2 : 1) * Math.min(1, moved / Math.max(dt, 1e-3) / 2 + 0.25)
        const sy = Math.sin(w.yaw)
        const cy = Math.cos(w.yaw)
        const hx = w.pos.x + cy * wig
        const hz = w.pos.z - sy * wig
        // rearing up: the head lifts (and pulls back a little) during the windup
        const hy = w.pos.y + windup * W.rearUp
        if (!placed[i]) {
          // fresh out of a gate: the whole chain starts at the head
          for (let q = 0; q < SEG; q++) {
            chain[o + q * 3] = hx - sy * q * 0.02
            chain[o + q * 3 + 1] = hy
            chain[o + q * 3 + 2] = hz - cy * q * 0.02
          }
          placed[i] = 1
          flashT[i] = 0
        }
        chain[o] = hx
        chain[o + 1] = hy
        chain[o + 2] = hz
        // follow the leader: each segment keeps its spacing behind the one in front
        for (let q = 1; q < SEG; q++) {
          const a = o + q * 3
          const b = a - 3
          let dx = (chain[a] as number) - (chain[b] as number)
          let dy = (chain[a + 1] as number) - (chain[b + 1] as number)
          let dz = (chain[a + 2] as number) - (chain[b + 2] as number)
          const l = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const sp = W.spacing * (q === 1 ? 1.15 : 1)
          if (l > sp && l > 1e-5) {
            dx = (dx / l) * sp
            dy = (dy / l) * sp
            dz = (dz / l) * sp
            chain[a] = (chain[b] as number) + dx
            chain[a + 1] = (chain[b + 1] as number) + dy
            chain[a + 2] = (chain[b + 2] as number) + dz
          }
          // the body settles down onto the floor behind a reared-up head
          if (q > 2) chain[a + 1] = (chain[a + 1] as number) + (w.pos.y - (chain[a + 1] as number)) * Math.min(1, dt * 6)
        }
        flashT[i] = Math.max(0, (flashT[i] as number) - dt)
        tmpC.copy(glow).lerp(white, Math.min(1, (flashT[i] as number) * 10))
        draw(i, w.yaw, windup, time, 1, tmpC)
        dyingYaw[i] = w.yaw
      }
      body.instanceMatrix.needsUpdate = true
      rings.instanceMatrix.needsUpdate = true
      eyes.instanceMatrix.needsUpdate = true
      jaws.instanceMatrix.needsUpdate = true
      legs.instanceMatrix.needsUpdate = true
      if (rings.instanceColor) rings.instanceColor.needsUpdate = true
    },
    flash(i: number): void {
      if (i >= 0 && i < max) flashT[i] = 0.12
    },
    burst(i: number, spark: (x: number, y: number, z: number) => void): void {
      if (i < 0 || i >= max || !placed[i]) return
      placed[i] = 0
      dying[i] = W.deathSec
      const o = i * SEG * 3
      for (let q = 0; q < SEG; q++) {
        const a = o + q * 3
        // a fixed fan of directions per segment (golden angle), thrown up and out
        const ang = (i * 1.3 + q * 2.399963) % (Math.PI * 2)
        const sp = 2.2 + ((q * 0.618034) % 1) * 2.5
        scatter[a] = Math.cos(ang) * sp
        scatter[a + 1] = 2.5 + ((q * 0.381966) % 1) * 2.5
        scatter[a + 2] = Math.sin(ang) * sp
        spark(chain[a] as number, (chain[a + 1] as number) + 0.12, chain[a + 2] as number)
      }
    },
  }
}
