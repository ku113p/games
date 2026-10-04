// The hero - a PLACEHOLDER built from primitives (H10: a hooded long coat, white neon lines, a glowing visor strip,
// a gunblade). The real H10 glb replaces it later behind the same small interface:
//   root (placed by the game view), setLineColor (the ending counter, DESIGN 4), setMode (sword / rifle),
//   update(dt, anim, actionProgress, speed) - the animation state comes from core queries (heroAnim).
import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { HeroAnim } from '../core/queries'
import { palette } from './look'

export interface HeroView {
  readonly root: Group
  setLineColor(c: Color): void
  setMode(mode: 'sword' | 'rifle'): void
  update(dt: number, anim: HeroAnim, actionT: number, speed: number, time: number): void
}

const FILAMENTS = 16
const FIL_SEGS = 4

function limb(len: number, r: number, mat: MeshStandardMaterial): Mesh {
  const m = new Mesh(new CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10), mat)
  m.position.y = -len / 2
  return m
}

function line(len: number, mat: MeshBasicMaterial, x: number, z: number): Mesh {
  const m = new Mesh(new CylinderGeometry(0.009, 0.009, len, 4), mat)
  m.position.set(x, -len / 2, z)
  return m
}

export function createHero(): HeroView {
  const root = new Group()
  const suit = new MeshStandardMaterial({ color: 0x1a2029, metalness: 0.45, roughness: 0.42 })
  const coatMat = new MeshStandardMaterial({ color: 0x12151b, metalness: 0.3, roughness: 0.5, side: DoubleSide })
  const lineMat = new MeshBasicMaterial({ color: palette.heroWhite.clone(), toneMapped: false })
  const visorMat = new MeshBasicMaterial({ color: palette.heroWhite.clone(), toneMapped: false })
  const bladeMat = new MeshBasicMaterial({ color: palette.heroWhite.clone().multiplyScalar(1.2), toneMapped: false })
  const holoMat = new MeshBasicMaterial({ color: palette.terminal.clone().multiplyScalar(0.6), toneMapped: false, transparent: true, opacity: 0.55, side: DoubleSide })
  const filMat = new LineBasicMaterial({ color: palette.heroWhite.clone(), toneMapped: false, transparent: true, opacity: 0.85 })

  // body rig: hips -> spine -> chest -> head / shoulders; hips -> thighs -> shins
  const body = new Group() // lowered when crouching, tilted when dying
  root.add(body)
  const hips = new Group()
  hips.position.y = 0.95
  body.add(hips)
  const spine = new Group()
  hips.add(spine)
  const torso = new Mesh(new CapsuleGeometry(0.17, 0.3, 4, 12), suit)
  torso.scale.set(1.15, 1, 0.75)
  torso.position.y = 0.27
  spine.add(torso)
  const chestLines = new Group()
  chestLines.position.set(0, 0.52, 0)
  chestLines.add(line(0.42, lineMat, 0.07, 0.13), line(0.42, lineMat, -0.07, 0.13))
  spine.add(chestLines)
  const belt = new Mesh(new TorusGeometry(0.17, 0.008, 4, 28), lineMat)
  belt.rotation.x = Math.PI / 2
  belt.scale.set(1.15, 0.75, 1)
  belt.position.y = 0.08
  spine.add(belt)

  // head and hood
  const neck = new Group()
  neck.position.y = 0.62
  spine.add(neck)
  const head = new Mesh(new SphereGeometry(0.12, 16, 12), suit)
  head.position.y = 0.1
  neck.add(head)
  const hood = new Mesh(new SphereGeometry(0.175, 20, 14, Math.PI * 0.18, Math.PI * 1.64), coatMat)
  hood.scale.set(1, 1.18, 1.12)
  hood.position.set(0, 0.12, -0.02)
  neck.add(hood)
  const peak = new Mesh(new CylinderGeometry(0.0, 0.1, 0.2, 10), coatMat)
  peak.rotation.x = -0.9
  peak.position.set(0, 0.25, -0.12)
  neck.add(peak)
  const visor = new Mesh(new RoundedBoxGeometry(0.16, 0.028, 0.03, 1, 0.01), visorMat)
  visor.position.set(0, 0.12, 0.1)
  neck.add(visor)

  // coat: a lathe from the shoulders to the knees, open at the front, pivoting at the shoulders
  const coatPivot = new Group()
  coatPivot.position.y = 0.5
  spine.add(coatPivot)
  const profile: Vector2[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    profile.push(new Vector2(0.2 + t * t * 0.2 + t * 0.04, -t * 1.15))
  }
  const coat = new Mesh(new LatheGeometry(profile.reverse(), 24, 0.42, Math.PI * 2 - 0.84), coatMat)
  coat.scale.set(1.12, 1, 0.82)
  coatPivot.add(coat)
  const collar = new Mesh(new TorusGeometry(0.17, 0.035, 6, 20, Math.PI * 1.5), coatMat)
  collar.rotation.set(Math.PI / 2, 0, Math.PI * 0.75)
  collar.position.y = 0.0
  coatPivot.add(collar)
  // glowing filaments at the hem
  const filPos = new Float32Array(FILAMENTS * FIL_SEGS * 2 * 3)
  const filGeo = new BufferGeometry()
  filGeo.setAttribute('position', new BufferAttribute(filPos, 3))
  const filaments = new LineSegments(filGeo, filMat)
  filaments.frustumCulled = false
  coatPivot.add(filaments)
  const hemY = -1.15
  const hemR = 0.44

  // arms
  const makeArm = (side: number): { shoulder: Group; elbow: Group; hand: Group } => {
    const shoulder = new Group()
    shoulder.position.set(side * 0.24, 0.5, 0)
    spine.add(shoulder)
    const pad = new Mesh(new SphereGeometry(0.085, 12, 10), suit)
    pad.scale.set(1.1, 0.9, 1)
    shoulder.add(pad)
    shoulder.add(limb(0.3, 0.06, suit))
    shoulder.add(line(0.28, lineMat, side * 0.06, 0))
    const elbow = new Group()
    elbow.position.y = -0.3
    shoulder.add(elbow)
    elbow.add(limb(0.28, 0.052, suit))
    elbow.add(line(0.24, lineMat, side * 0.052, 0))
    const hand = new Group()
    hand.position.y = -0.3
    elbow.add(hand)
    const fist = new Mesh(new SphereGeometry(0.05, 10, 8), suit)
    hand.add(fist)
    return { shoulder, elbow, hand }
  }
  const armL = makeArm(-1)
  const armR = makeArm(1)
  // holographic wrist display on the left forearm
  const holo = new Mesh(new PlaneGeometry(0.11, 0.08), holoMat)
  holo.position.set(-0.07, -0.16, 0.03)
  holo.rotation.y = -1.2
  armL.elbow.add(holo)

  // the gunblade in the right hand: a body and a blade of light (rifle mode retracts the blade)
  const gun = new Group()
  gun.rotation.x = Math.PI / 2
  armR.hand.add(gun)
  const gunBody = new Mesh(new RoundedBoxGeometry(0.06, 0.34, 0.11, 2, 0.02), suit)
  gunBody.position.y = 0.06
  gun.add(gunBody)
  const gunLine = new Mesh(new CylinderGeometry(0.006, 0.006, 0.3, 4), lineMat)
  gunLine.position.set(0.032, 0.06, 0)
  gun.add(gunLine)
  const muzzle = new Mesh(new TorusGeometry(0.035, 0.01, 6, 16), bladeMat)
  muzzle.position.y = 0.24
  muzzle.rotation.x = Math.PI / 2
  gun.add(muzzle)
  const blade = new Mesh(new RoundedBoxGeometry(0.02, 0.85, 0.05, 1, 0.008), bladeMat)
  blade.position.y = 0.66
  gun.add(blade)

  // legs
  const makeLeg = (side: number): { thigh: Group; shin: Group } => {
    const thigh = new Group()
    thigh.position.set(side * 0.1, 0, 0)
    hips.add(thigh)
    thigh.add(limb(0.45, 0.075, suit))
    thigh.add(line(0.4, lineMat, side * 0.075, 0))
    const shin = new Group()
    shin.position.y = -0.45
    thigh.add(shin)
    shin.add(limb(0.44, 0.06, suit))
    shin.add(line(0.38, lineMat, side * 0.06, 0.01))
    const boot = new Mesh(new RoundedBoxGeometry(0.11, 0.08, 0.24, 2, 0.03), suit)
    boot.position.set(0, -0.44, 0.04)
    shin.add(boot)
    return { thigh, shin }
  }
  const legL = makeLeg(-1)
  const legR = makeLeg(1)

  let phase = 0
  let mode: 'sword' | 'rifle' = 'sword'
  let bladeOut = 1
  let deathT = 0
  let crouchK = 0
  let lean = 0

  function setFilaments(time: number, speed: number): void {
    let o = 0
    for (let f = 0; f < FILAMENTS; f++) {
      const a = 0.42 + ((Math.PI * 2 - 0.84) * f) / (FILAMENTS - 1)
      const len = 0.22 + ((f * 7) % 5) * 0.06
      let x = Math.sin(a) * hemR * 1.12
      let z = Math.cos(a) * hemR * 0.82
      let y = hemY
      for (let s = 0; s < FIL_SEGS; s++) {
        const t = (s + 1) / FIL_SEGS
        const wob = Math.sin(time * 6 + f * 1.7 + s) * 0.03 * (1 + speed * 0.3)
        const nx = Math.sin(a) * hemR * 1.12 * (1 + t * 0.15) + wob
        const nz = Math.cos(a) * hemR * 0.82 * (1 + t * 0.15) - t * speed * 0.05
        const ny = hemY - len * t
        filPos[o++] = x
        filPos[o++] = y
        filPos[o++] = z
        filPos[o++] = nx
        filPos[o++] = ny
        filPos[o++] = nz
        x = nx
        y = ny
        z = nz
      }
    }
    ;(filGeo.getAttribute('position') as BufferAttribute).needsUpdate = true
  }

  const ease = (cur: number, to: number, k: number): number => cur + (to - cur) * k

  return {
    root,
    setLineColor(c: Color): void {
      lineMat.color.copy(c)
      visorMat.color.copy(c)
      filMat.color.copy(c)
      bladeMat.color.copy(c).multiplyScalar(1.2)
    },
    setMode(m: 'sword' | 'rifle'): void {
      mode = m
    },
    update(dt: number, anim: HeroAnim, actionT: number, speed: number, time: number): void {
      const k = Math.min(1, dt * 12)
      bladeOut = ease(bladeOut, mode === 'sword' ? 1 : 0, Math.min(1, dt * 14))
      blade.scale.y = Math.max(0.001, bladeOut)
      blade.position.y = 0.24 + 0.42 * bladeOut
      muzzle.scale.setScalar(mode === 'rifle' ? 1.4 : 0.8)

      const moving = anim === 'walk' || anim === 'run' || (anim === 'crouch' && speed > 0.2)
      const stride = anim === 'run' ? 1.5 : anim === 'crouch' ? 0.9 : 1.15
      if (moving) phase += (speed * dt) / stride * Math.PI
      const swing = moving ? (anim === 'run' ? 0.75 : anim === 'crouch' ? 0.35 : 0.5) : 0
      const sp = Math.sin(phase)
      const cp = Math.cos(phase)

      // defaults (relaxed stance)
      let thighL = sp * swing
      let thighR = -sp * swing
      let shinL = -Math.max(0, -cp) * swing * 1.2
      let shinR = -Math.max(0, cp) * swing * 1.2
      let armLx = -sp * swing * 0.8
      let armRx = 0.25 + sp * swing * 0.5
      let elbowL = -0.25 - swing * 0.3
      let elbowR = -0.6
      let armRz = 0
      let twist = 0
      let leanTo = anim === 'run' ? 0.22 : anim === 'walk' ? 0.06 : 0
      const crouchTo = anim === 'crouch' ? 1 : 0
      const bob = moving ? Math.abs(sp) * (anim === 'run' ? 0.06 : 0.03) : Math.sin(time * 2) * 0.008

      switch (anim) {
        case 'jump':
          thighL = 0.6
          thighR = -0.2
          shinL = -1.0
          shinR = -0.5
          armLx = -0.6
          armRx = -0.3
          break
        case 'dash':
          leanTo = 0.55
          thighL = 0.7
          thighR = -0.6
          shinL = -0.8
          shinR = -0.2
          armLx = 0.9
          armRx = 0.9
          break
        case 'slash': {
          // a wide sweep from the right side across the front
          const t = actionT
          armRx = -1.3
          armRz = 1.4 - t * 2.8
          twist = 0.6 - t * 1.2
          elbowR = -0.15
          leanTo = 0.15
          break
        }
        case 'shoot':
          armRx = -1.55
          elbowR = -0.05 + actionT * 0.2
          armLx = -1.3
          armRz = -0.1
          elbowL = -0.5
          twist = -0.25
          break
        case 'hack':
          armRx = -1.2
          elbowR = -0.7
          armLx = -1.1
          elbowL = -0.8
          leanTo = 0.1
          break
        case 'hit':
          leanTo = -0.35
          armLx = 0.4
          armRx = 0.6
          break
        default:
          break
      }
      if (anim === 'death') deathT = Math.min(1, deathT + dt * 1.6)
      else deathT = Math.max(0, deathT - dt * 4)

      crouchK = ease(crouchK, crouchTo, Math.min(1, dt * 10))
      lean = ease(lean, leanTo, k)
      body.position.y = -crouchK * 0.42 + bob - deathT * 0.5
      body.rotation.x = -deathT * 1.3
      spine.rotation.x = lean + crouchK * 0.35
      spine.rotation.y = ease(spine.rotation.y, twist, k)
      legL.thigh.rotation.x = ease(legL.thigh.rotation.x, -thighL - crouchK * 1.25, k)
      legR.thigh.rotation.x = ease(legR.thigh.rotation.x, -thighR - crouchK * 0.9, k)
      legL.shin.rotation.x = ease(legL.shin.rotation.x, -shinL + crouchK * 2.0, k)
      legR.shin.rotation.x = ease(legR.shin.rotation.x, -shinR + crouchK * 1.6, k)
      armL.shoulder.rotation.x = ease(armL.shoulder.rotation.x, armLx, k)
      armR.shoulder.rotation.x = ease(armR.shoulder.rotation.x, armRx, k)
      armR.shoulder.rotation.z = ease(armR.shoulder.rotation.z, armRz, anim === 'slash' ? 1 : k)
      armL.shoulder.rotation.z = -0.12
      armL.elbow.rotation.x = ease(armL.elbow.rotation.x, elbowL, k)
      armR.elbow.rotation.x = ease(armR.elbow.rotation.x, elbowR, k)
      // the coat swings back with speed and flaps a little
      coatPivot.rotation.x = ease(coatPivot.rotation.x, -Math.min(0.5, speed * 0.06) - crouchK * 0.25 + Math.sin(time * 5) * 0.02, k)
      coat.scale.y = 1 - crouchK * 0.25
      setFilaments(time, speed)
      visorMat.opacity = 1
    },
  }
}
