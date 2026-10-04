// The hero (H10, DESIGN 4 and 14): a hooded long coat over a matte black suit, a few white neon lines (their color
// follows the ending counter), a glowing visor strip, the coat hem breaking into glowing filaments, a holographic wrist
// display and the gunblade (sword <-> rifle). The model is assets/models/hero.glb, built by tools/hero/build.py.
// The interface is small: root (placed by the game view), setLineColor, setMode, update(dt, anim, actionT, speed, time).
//
// Animation: every clip runs as an AnimationAction whose time and weight are set here each frame (no crossFadeTo, no
// events): a full-body base layer (idle / walk-run blend / crouch / jump / dash / hit / death / hack) whose weights fade
// toward the state from core queries, plus an upper-body overlay (slashes, rifle aim and shot) with a large weight, so it
// wins on the arms and spine while the legs keep walking. Afterwards the eight coat bone chains are swung procedurally:
// they hang toward gravity, trail behind when running and are pushed out of the legs (no cloth clipping through the knees).
import {
  AdditiveBlending,
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Color,
  DoubleSide,
  Group,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Material,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import heroUrl from '../assets/models/hero.glb'
import type { HeroAnim } from '../core/queries'
import { palette } from './look'

export interface HeroView {
  readonly root: Group
  setLineColor(c: Color): void
  setMode(mode: 'sword' | 'rifle'): void
  update(dt: number, anim: HeroAnim, actionT: number, speed: number, time: number): void
  /** World position of the gunblade's muzzle; false until the model has loaded. */
  muzzle(out: Vector3): boolean
}

// --- clip tuning (speeds and strides measured from the Quaternius root-motion clips, see tools/hero/README.md)
const WALK_SPEED = 0.98 // m/s of the walk clip
const WALK_STRIDE = 1.3 // m per walk cycle
const RUN_SPEED = 5.36
const RUN_STRIDE = 5.0
const CROUCH_STRIDE = 1.5
const FADE = 10 // 1/s, base layer crossfade
const FADE_FAST = 22 // 1/s, for actions that must read at once (dash, hit, slash)
const OVER = 24 // weight of the upper-body overlay against the base layer's 1
const LAND_SEC = 0.42
const AIM_HOLD_SEC = 0.8 // the rifle stays raised this long after a shot
const UPPER = /^(spine_|neck_|Head|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/
// slash variants: [start, end] of the clip (normalized) played over actionT with an ease-out, so the strike lands early
const SLASH_RANGE: ReadonlyArray<readonly [number, number]> = [
  [0.36, 0.86],
  [0.3, 0.74],
  [0.12, 0.5],
]

// base layer (full body)
const BASE = ['idle', 'idle_rifle', 'walk', 'run', 'crouch_idle', 'crouch_walk', 'jump_start', 'jump_loop', 'jump_land', 'dash', 'hit', 'death', 'hack'] as const
const IDLE = 0
const IDLE_RIFLE = 1
const WALK = 2
const RUN = 3
const C_IDLE = 4
const C_WALK = 5
const J_START = 6
const J_LOOP = 7
const LAND = 8
const DASH = 9
const HIT = 10
const DEATH = 11
const HACK = 12
// overlay (upper body)
const OVERLAY = ['slash_a', 'slash_b', 'slash_c', 'aim', 'shoot'] as const
const AIM = 3
const SHOOT = 4

// --- coat chains: the legs as capsules the coat bones are pushed out of
const THIGH_R = 0.12
const CALF_R = 0.1
const COAT_FOLLOW = 0.3 // how much the chains follow the pelvis instead of hanging as in the bind pose
const COAT_TRAIL = 0.07 // backward pull per m/s of speed
const COAT_SPRING = 14 // 1/s

interface Chain {
  a: Object3D
  b: Object3D
  restA: Quaternion
  restB: Quaternion
  axisA: Vector3 // bone direction in the bone's own space
  axisB: Vector3
  lenA: number
  lenB: number
  bindA: Vector3 // bind-pose direction in the model's space
  bindB: Vector3
  dirA: Vector3 // smoothed wanted world direction
  dirB: Vector3
  init: boolean
}

const smooth = (cur: number, to: number, rate: number, dt: number): number => cur + (to - cur) * Math.min(1, dt * rate)
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 2.2)

// frame temporaries (no allocation in update)
const tA = new Vector3()
const tB = new Vector3()
const tC = new Vector3()
const tD = new Vector3()
const tE = new Vector3()
const qP = new Quaternion()
const qInv = new Quaternion()
const qT = new Quaternion()
const hipL = new Vector3()
const hipR = new Vector3()
const kneeL = new Vector3()
const kneeR = new Vector3()
const ankleL = new Vector3()
const ankleR = new Vector3()
const back = new Vector3()
const sD = new Vector3()
const sE = new Vector3()
const perp = new Vector3()
const probe = new Vector3()
const center = new Vector3()
const out = new Vector3()

function inside(p: Vector3, a: Vector3, b: Vector3, r: number): boolean {
  sD.subVectors(b, a)
  const len2 = sD.lengthSq()
  const t = len2 > 1e-8 ? clamp01(sE.subVectors(p, a).dot(sD) / len2) : 0
  sE.copy(a).addScaledVector(sD, t)
  return p.distanceToSquared(sE) < r * r
}

function blocked(p: Vector3): boolean {
  return inside(p, hipL, kneeL, THIGH_R) || inside(p, hipR, kneeR, THIGH_R) || inside(p, kneeL, ankleL, CALF_R) || inside(p, kneeR, ankleR, CALF_R)
}

/** Swing a coat bone outward (away from the hips) from its wanted direction until it clears the legs and the floor. */
function swing(from: Vector3, want: Vector3, outward: Vector3, len: number, floor: number, res: Vector3): void {
  perp.copy(outward).addScaledVector(want, -outward.dot(want))
  if (perp.lengthSq() < 1e-6) perp.copy(outward)
  perp.normalize()
  for (let i = 0; i <= 24; i++) {
    const a = i * 0.08
    res.copy(want).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a))
    probe.copy(from).addScaledVector(res, len * 0.55)
    if (blocked(probe)) continue
    probe.copy(from).addScaledVector(res, len)
    if (!blocked(probe)) break
  }
  // never through the floor
  probe.copy(from).addScaledVector(res, len)
  if (probe.y < floor) {
    probe.y = floor
    res.subVectors(probe, from).normalize()
  }
}

export function createHero(): HeroView {
  const root = new Group()
  const lineColor = palette.heroWhite.clone()
  const glowColor = { value: new Color() }
  const timeU = { value: 0 }

  // materials (the glb's materials are replaced by name)
  const suit = new MeshStandardMaterial({ color: 0x0d1015, roughness: 0.5, metalness: 0.45 })
  const joints = new MeshStandardMaterial({ color: 0x15181d, roughness: 0.32, metalness: 0.7 })
  const coat = new MeshStandardMaterial({ color: 0x12151b, roughness: 0.55, metalness: 0.3, side: DoubleSide })
  const hood = new MeshStandardMaterial({ color: 0x12151b, roughness: 0.55, metalness: 0.3, side: DoubleSide })
  const gun = new MeshStandardMaterial({ color: 0x16181c, roughness: 0.3, metalness: 0.8 })
  const lines = new MeshBasicMaterial({ color: lineColor, toneMapped: false, side: DoubleSide })
  const visor = new MeshBasicMaterial({ color: lineColor.clone(), toneMapped: false, side: DoubleSide })
  const blade = new MeshBasicMaterial({ color: lineColor.clone(), toneMapped: false, side: DoubleSide })
  const holo = new MeshBasicMaterial({
    color: palette.terminal.clone().multiplyScalar(0.55),
    toneMapped: false,
    transparent: true,
    opacity: 0.45,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  const filaments = new MeshBasicMaterial({
    color: lineColor.clone(),
    toneMapped: false,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  // the coat's strips glow toward their tips (per-vertex "_glow" from the build)
  coat.onBeforeCompile = (sh): void => {
    sh.uniforms['uGlow'] = glowColor
    sh.vertexShader = 'attribute float _glow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = _glow;')
    sh.fragmentShader =
      'uniform vec3 uGlow;\nvarying float vGlow;\n' +
      sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uGlow * (vGlow * vGlow);')
  }
  // filaments: fade from the root to the tip and sway a little (more toward the tip)
  filaments.onBeforeCompile = (sh): void => {
    sh.uniforms['uTime'] = timeU
    sh.vertexShader =
      'attribute float _glow;\nvarying float vGlow;\nuniform float uTime;\n' +
      sh.vertexShader.replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
  vGlow = _glow;
  float sway = 1.0 - _glow;
  transformed.x += sin(uTime * 3.1 + position.y * 11.0 + position.x * 23.0) * 0.016 * sway;
  transformed.z += sin(uTime * 2.4 + position.y * 7.0 + position.z * 19.0) * 0.016 * sway;`,
      )
    sh.fragmentShader =
      'varying float vGlow;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb *= vGlow * vGlow * (0.35 + 0.65 * smoothstep(1.0, 0.75, vGlow));')
  }

  const byName: Record<string, Material> = {
    Suit: suit,
    SuitJoints: joints,
    Coat: coat,
    Gun: gun,
    NeonLines: lines,
    Visor: visor,
    Blade: blade,
    Holo: holo,
    Filaments: filaments,
  }

  // filled when the glb arrives
  let ready = false
  let mixer: AnimationMixer | null = null
  const base: AnimationAction[] = []
  const over: AnimationAction[] = []
  const baseW = new Float32Array(BASE.length)
  const baseT = new Float32Array(BASE.length)
  const loopT = new Float32Array(BASE.length)
  const overW = new Float32Array(OVERLAY.length)
  const overT = new Float32Array(OVERLAY.length)
  const overTime = new Float32Array(OVERLAY.length)
  const chains: Chain[] = []
  let thighL: Object3D | null = null
  let thighR: Object3D | null = null
  let calfL: Object3D | null = null
  let calfR: Object3D | null = null
  let footL: Object3D | null = null
  let footR: Object3D | null = null
  let pelvis: Object3D | null = null
  let gunRoot: Object3D | null = null
  let bladeMesh: Object3D | null = null
  let muzzleNode: Object3D | null = null
  let bladeAxis: 'x' | 'y' | 'z' = 'y'
  let barrelSign = 1
  const swordPos = new Vector3()
  const swordQuat = new Quaternion()
  const swordScale = new Vector3(1, 1, 1)
  const riflePos = new Vector3()
  const rifleQuat = new Quaternion()
  const barrel = new Vector3()

  // animation state
  let mode: 'sword' | 'rifle' = 'sword'
  let gunK = 0 // 0 sword grip .. 1 rifle grip
  let bladeOut = 1
  let prevAnim: HeroAnim = 'idle'
  let prevActionT = 0
  let legs: 'stand' | 'crouch' | 'air' = 'stand'
  let airTime = 0
  let landT = -1
  let locoPhase = 0
  let crouchPhase = 0
  let slashVariant = 0
  let lastSlash = -10
  let lastShot = -10
  let deathT = 0

  new GLTFLoader().load(
    heroUrl,
    (gltf) => {
      const model = gltf.scene
      model.traverse((o) => {
        o.layers.mask = root.layers.mask // the game view marks the root for the floor reflection before we load
        const m = o as Mesh
        if (!m.isMesh) return
        m.frustumCulled = false
        const old = m.material as Material
        const isHood = m.name.startsWith('Hood') || (m.parent !== null && m.parent.name.startsWith('Hood'))
        m.material = isHood && old.name === 'Coat' ? hood : (byName[old.name] ?? suit)
        old.dispose()
      })
      root.add(model)

      const bone = (n: string): Object3D => {
        const o = model.getObjectByName(n)
        if (!o) throw new Error(`hero.glb: no ${n}`)
        return o
      }
      thighL = bone('thigh_l')
      thighR = bone('thigh_r')
      calfL = bone('calf_l')
      calfR = bone('calf_r')
      footL = bone('foot_l')
      footR = bone('foot_r')
      pelvis = bone('pelvis')
      model.updateMatrixWorld(true)
      for (const side of ['l', 'r']) {
        for (let k = 1; k <= 4; k++) {
          const a = bone(`coat_${side}${k}_a`)
          const b = bone(`coat_${side}${k}_b`)
          const c = bone(`coat_${side}${k}_c`)
          const pa = model.worldToLocal(a.getWorldPosition(new Vector3()))
          const pb = model.worldToLocal(b.getWorldPosition(new Vector3()))
          const pc = model.worldToLocal(c.getWorldPosition(new Vector3()))
          chains.push({
            a,
            b,
            restA: a.quaternion.clone(),
            restB: b.quaternion.clone(),
            axisA: b.position.clone().normalize(),
            axisB: c.position.clone().normalize(),
            lenA: b.position.length(),
            lenB: c.position.length(),
            bindA: pb.clone().sub(pa).normalize(),
            bindB: pc.clone().sub(pb).normalize(),
            dirA: new Vector3(),
            dirB: new Vector3(),
            init: false,
          })
        }
      }
      gunRoot = bone('Gunblade')
      bladeMesh = bone('Blade')
      muzzleNode = bone('Muzzle')
      const rifle = bone('RifleHold')
      swordPos.copy(gunRoot.position)
      swordQuat.copy(gunRoot.quaternion)
      swordScale.copy(gunRoot.scale)
      riflePos.copy(rifle.position)
      rifleQuat.copy(rifle.quaternion)
      // the blade's long axis (the barrel direction) in the gun's space
      const bm = bladeMesh as Mesh
      bm.geometry.computeBoundingBox()
      const bb = bm.geometry.boundingBox
      if (bb) {
        const sx = bb.max.x - bb.min.x
        const sy = bb.max.y - bb.min.y
        const sz = bb.max.z - bb.min.z
        bladeAxis = sx > sy && sx > sz ? 'x' : sy > sz ? 'y' : 'z'
        barrelSign = bb.max[bladeAxis] + bb.min[bladeAxis] >= 0 ? 1 : -1
      }

      // clips: drop the coat bones (driven here), scale and constant position tracks; split the overlay to the upper body
      const clips = new Map<string, AnimationClip>()
      for (const c of gltf.animations) {
        c.tracks = c.tracks.filter((t) => !t.name.startsWith('coat_') && !t.name.endsWith('.scale') && (!t.name.endsWith('.position') || t.name.startsWith('pelvis')))
        clips.set(c.name, c)
      }
      const mx = new AnimationMixer(model)
      const make = (name: string, upper: boolean): AnimationAction => {
        const src = clips.get(name)
        if (!src) throw new Error(`hero.glb: no clip ${name}`)
        const clip = upper ? new AnimationClip(`${name}_upper`, src.duration, src.tracks.filter((t) => UPPER.test(t.name))) : src
        const a = mx.clipAction(clip)
        a.setLoop(LoopRepeat, Infinity)
        a.timeScale = 0 // times are set by hand every frame
        a.setEffectiveWeight(0)
        a.play()
        return a
      }
      for (const n of BASE) base.push(make(n, false))
      for (const n of OVERLAY) over.push(make(n, true))
      baseW[IDLE] = 1
      mixer = mx
      ready = true
    },
    undefined,
    (err) => {
      console.error('hero.glb failed to load', err)
    },
  )

  function setBaseTargets(anim: HeroAnim, speed: number, sword: boolean): void {
    baseT.fill(0)
    switch (anim) {
      case 'death':
        baseT[DEATH] = 1
        return
      case 'hit':
        baseT[HIT] = 1
        return
      case 'dash':
        baseT[DASH] = 1
        return
      case 'hack':
        baseT[HACK] = 1
        return
      default:
        break
    }
    if (legs === 'air') {
      if (airTime < 0.3) baseT[J_START] = 1
      else baseT[J_LOOP] = 1
      return
    }
    if (legs === 'crouch') {
      const k = clamp01(speed / 0.6)
      baseT[C_WALK] = k
      baseT[C_IDLE] = 1 - k
    } else {
      const idleK = 1 - clamp01((speed - 0.1) / 0.5)
      const m = clamp01((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED))
      baseT[sword ? IDLE : IDLE_RIFLE] = idleK
      baseT[WALK] = (1 - m) * (1 - idleK)
      baseT[RUN] = m * (1 - idleK)
    }
    if (landT >= 0) {
      const k = 0.75 * (1 - landT / LAND_SEC)
      for (let i = 0; i < baseT.length; i++) baseT[i] = (baseT[i] ?? 0) * (1 - k)
      baseT[LAND] = k
    }
  }

  function solveCoat(dt: number, speed: number): void {
    if (!thighL || !thighR || !calfL || !calfR || !footL || !footR || !pelvis) return
    thighL.getWorldPosition(hipL)
    thighR.getWorldPosition(hipR)
    calfL.getWorldPosition(kneeL)
    calfR.getWorldPosition(kneeR)
    footL.getWorldPosition(ankleL)
    footR.getWorldPosition(ankleR)
    // the thigh capsules start a little below the hip joint (the coat's hip ring sits right next to it)
    hipL.lerp(kneeL, 0.2)
    hipR.lerp(kneeR, 0.2)
    pelvis.getWorldPosition(center)
    const floor = root.position.y + 0.03
    const yaw = root.rotation.y
    back.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    const k = Math.min(1, dt * COAT_SPRING)
    const trail = Math.min(0.7, speed * COAT_TRAIL)
    for (let i = 0; i < chains.length; i++) {
      const c = chains[i]
      const parent = c?.a.parent
      if (!c || !parent) continue
      parent.getWorldQuaternion(qP)
      c.a.getWorldPosition(tA)
      out.subVectors(tA, center).setY(0).normalize() // outward from the hips
      // bone a: hangs mostly as in the bind pose (gravity), a little with the pelvis, trails behind when running
      tB.copy(c.bindA).applyQuaternion(root.quaternion).multiplyScalar(1 - COAT_FOLLOW)
      tC.copy(c.axisA).applyQuaternion(c.restA).applyQuaternion(qP)
      tB.addScaledVector(tC, COAT_FOLLOW).addScaledVector(back, trail * 0.5).normalize()
      if (!c.init) c.dirA.copy(tB)
      else c.dirA.lerp(tB, k).normalize()
      swing(tA, c.dirA, out, c.lenA, floor, tD)
      qInv.copy(qP).invert()
      tE.copy(tD).applyQuaternion(qInv) // wanted direction in the parent's space
      tC.copy(c.axisA).applyQuaternion(c.restA)
      qT.setFromUnitVectors(tC, tE)
      c.a.quaternion.copy(qT).multiply(c.restA)
      // bone b: from the knee to the hem
      qP.multiply(c.a.quaternion)
      tA.addScaledVector(tD, c.lenA)
      tB.copy(c.bindB).applyQuaternion(root.quaternion).addScaledVector(back, trail).normalize()
      if (!c.init) c.dirB.copy(tB)
      else c.dirB.lerp(tB, k * 0.7).normalize()
      swing(tA, c.dirB, out, c.lenB, floor, tD)
      qInv.copy(qP).invert()
      tE.copy(tD).applyQuaternion(qInv)
      tC.copy(c.axisB).applyQuaternion(c.restB)
      qT.setFromUnitVectors(tC, tE)
      c.b.quaternion.copy(qT).multiply(c.restB)
      c.init = true
    }
  }

  function updateGun(dt: number, anim: HeroAnim, actionT: number): void {
    if (!gunRoot || !bladeMesh) return
    gunK = smooth(gunK, mode === 'rifle' ? 1 : 0, 12, dt)
    bladeOut = smooth(bladeOut, mode === 'sword' ? 1 : 0, 14, dt)
    gunRoot.position.lerpVectors(swordPos, riflePos, gunK)
    gunRoot.quaternion.slerpQuaternions(swordQuat, rifleQuat, gunK)
    gunRoot.scale.copy(swordScale)
    if (anim === 'shoot') {
      // the kick: back along the barrel
      barrel.set(0, 0, 0)
      barrel[bladeAxis] = barrelSign
      barrel.applyQuaternion(gunRoot.quaternion).multiplyScalar(-0.035 * (1 - actionT) * swordScale.x)
      gunRoot.position.add(barrel)
    }
    bladeMesh.scale[bladeAxis] = Math.max(0.001, bladeOut)
    bladeMesh.visible = bladeOut > 0.02
  }

  return {
    root,
    setLineColor(c: Color): void {
      lineColor.copy(c)
      visor.color.copy(c).multiplyScalar(1.15)
      blade.color.copy(c).multiplyScalar(1.25)
      filaments.color.copy(c).multiplyScalar(0.85)
      glowColor.value.copy(c).multiplyScalar(0.16)
    },
    setMode(m: 'sword' | 'rifle'): void {
      mode = m
    },
    muzzle(out: Vector3): boolean {
      if (!muzzleNode) return false
      muzzleNode.getWorldPosition(out)
      return true
    },
    update(dt: number, anim: HeroAnim, actionT: number, speed: number, time: number): void {
      timeU.value = time
      if (!ready || !mixer) return
      const sword = mode === 'sword'

      // what the legs do (slash and shoot keep the legs of the state before them)
      if (anim === 'crouch') legs = 'crouch'
      else if (anim === 'jump') legs = 'air'
      else if (anim === 'idle' || anim === 'walk' || anim === 'run' || anim === 'hack' || anim === 'death' || anim === 'hit') legs = 'stand'
      if (legs === 'air') airTime += dt
      else {
        if (airTime > 0.35 && anim !== 'dash') landT = 0
        airTime = 0
      }
      if (landT >= 0) {
        landT += dt
        if (landT > LAND_SEC || legs === 'crouch') landT = -1
      }
      if (anim === 'slash' && (prevAnim !== 'slash' || actionT < prevActionT - 0.2)) {
        slashVariant = time - lastSlash < 1.1 ? (slashVariant + 1) % SLASH_RANGE.length : 0
        lastSlash = time
      }
      if (anim === 'shoot') lastShot = time
      if (anim === 'death') deathT = prevAnim === 'death' ? deathT + dt : 0

      // base layer
      setBaseTargets(anim, speed, sword)
      let sum = 0
      for (let i = 0; i < BASE.length; i++) {
        const t = baseT[i] ?? 0
        const fast = i === DASH || i === HIT || i === DEATH
        const w = smooth(baseW[i] ?? 0, t, fast && t > 0 ? FADE_FAST : FADE, dt)
        baseW[i] = w
        sum += w
      }
      if (sum < 1e-4) {
        baseW[IDLE] = 1
        sum = 1
      }
      // phases and times
      if (legs === 'crouch') crouchPhase = (crouchPhase + (dt * Math.max(0.3, speed)) / CROUCH_STRIDE) % 1
      else {
        const m = clamp01((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED))
        locoPhase = (locoPhase + (dt * Math.max(0.5, speed)) / (WALK_STRIDE + (RUN_STRIDE - WALK_STRIDE) * m)) % 1
      }
      for (let i = 0; i < BASE.length; i++) {
        const a = base[i]
        if (!a) continue
        const dur = a.getClip().duration
        let t: number
        switch (i) {
          case WALK:
          case RUN:
            t = locoPhase * dur
            break
          case C_WALK:
            t = crouchPhase * dur
            break
          case J_START:
            t = (0.1 + 0.4 * clamp01(airTime / 0.3)) * dur
            break
          case LAND:
            t = (0.04 + 0.5 * clamp01(landT / LAND_SEC)) * dur
            break
          case DASH:
            t = (0.2 + 0.42 * actionT) * dur
            break
          case HIT:
            t = 0.95 * actionT * dur
            break
          case DEATH:
            t = Math.min(deathT, dur * 0.999)
            break
          default:
            t = ((loopT[i] ?? 0) + dt) % dur
            loopT[i] = t
        }
        a.time = t
        a.setEffectiveWeight((baseW[i] ?? 0) / sum)
      }

      // overlay: slashes and the raised rifle
      overT.fill(0)
      const fullBody = anim === 'dash' || anim === 'hit' || anim === 'death' || anim === 'hack'
      if (anim === 'slash') {
        overT[slashVariant] = 1
        const r = SLASH_RANGE[slashVariant]
        const clip = over[slashVariant]
        if (r && clip) overTime[slashVariant] = (r[0] + (r[1] - r[0]) * easeOut(actionT)) * clip.getClip().duration
      } else if (!sword && !fullBody && (anim === 'shoot' || time - lastShot < AIM_HOLD_SEC)) {
        if (anim === 'shoot') {
          overT[SHOOT] = 1
          const clip = over[SHOOT]
          if (clip) overTime[SHOOT] = 0.3 * actionT * clip.getClip().duration
        } else overT[AIM] = 1
      }
      for (let i = 0; i < OVERLAY.length; i++) {
        const t = overT[i] ?? 0
        const w = smooth(overW[i] ?? 0, t, t > 0 ? FADE_FAST : 8, dt)
        overW[i] = w
        const a = over[i]
        if (!a) continue
        a.time = overTime[i] ?? 0
        a.setEffectiveWeight(w * OVER)
      }

      mixer.update(dt)
      root.updateMatrixWorld(true)
      solveCoat(dt, anim === 'death' ? 0 : speed)
      updateGun(dt, anim, actionT)
      holo.opacity = anim === 'hack' ? 0.75 + 0.2 * Math.sin(time * 37) * Math.sin(time * 11) : 0.4
      prevAnim = anim
      prevActionT = actionT
    },
  }
}
