// Drone meshes (art/generated/EM1-drone-lens.jpg): a ~60 cm glossy black lens orb with panel seams, a bezel and one big
// layered red iris (a shader: pupil, fibres, a bright limbus; it dilates while the drone is suspicious and narrows when it
// locks on), two thin light rings orbiting it on tilted axes, a wide faint scanning fan of light under it that sweeps
// (always visible but subtle; the real view cone stays in network vision), a short look beam out of the lens and a
// suspicion arc above it. It bobs when idle and leans into its motion; a hit flashes a crack on the shell and jolts the
// rings, a kill throws the rings off in a burst. Before every shot a drone holds still and aims (the telegraph): a thin
// red beam reaches from the lens to the hero, narrowing and brightening as the aim completes, the pupil contracts and
// flares. One mesh set per state slot (pooled, no allocations per frame; shared geometry, one merged shell).
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type Camera,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import cfgAll from '../config.json'
import type { GameState, Sim } from '../core/state'
import { droneAim, drones, gameTime, playerPos } from '../core/queries'
import { createCone, type ViewCone } from './cone'
import { addRim, palette, type Materials } from './look'
import { DRONE_KEY, fanSpread, NO_FAN, type Sight } from './sight'

const D = cfgAll.drone
const LOOK = cfgAll.view.cones.lookBeam
const DEG = Math.PI / 180
const SPREAD = fanSpread(D.halfAngleDeg * DEG, D.pitchDeg * DEG)

interface DroneView {
  root: Group
  /** Yaws with the drone; the cones hang on it. */
  body: Group
  /** Leans into the motion; the orb, iris and rings hang on it. */
  lean: Group
  /** Where the lens sits (the aim beam starts here). */
  eye: Object3D
  irisMat: ShaderMaterial
  ringMat: MeshBasicMaterial
  seamMat: MeshBasicMaterial
  haloMat: SpriteMaterial
  crackMat: MeshBasicMaterial
  crack: Mesh
  ringA: Group
  ringB: Group
  beadA: Mesh
  beadB: Mesh
  fan: Mesh
  fanMat: ShaderMaterial
  beam: Mesh
  beamMat: ShaderMaterial
  cone: ViewCone
  /** The short look beam out of the lens: always on (the cone shows only in network vision). */
  look: ViewCone
  sus: Mesh
  susMat: MeshBasicMaterial
  bob: number
  lastSusSeg: number
  pupil: number
  lastX: number
  lastZ: number
  lastY: number
  px: number
  pz: number
  pitch: number
  roll: number
  wasAlive: boolean
  lastHp: number
  hitT: number
}

/** A burst: the rings of a killed drone flying off (pooled). */
interface Burst {
  rings: Mesh[]
  flash: Mesh
  mats: MeshBasicMaterial[]
  vel: Vector3[]
  spin: Vector3[]
  t: number
}

const SUS_SEGMENTS = 24
const tmp = new Color()
const AIM = cfgAll.view.droneAim
const UP = new Vector3(0, 1, 0)
const eyeW = new Vector3()
const toHero = new Vector3()
const invQ = new Quaternion()

const E = cfgAll.view.enemyLook
const R = 0.3 // the orb's radius (a ~60 cm lens)
const CAP = 0.62 // the iris cap's angular radius, rad
const CAP_R = R * 1.004 * Math.sin(CAP)
const RING_A = 0.43
const RING_B = 0.39
const BURSTS = 4
const BURST_SEC = 0.9
const FAN_LEN_MIN = 1.5
const FAN_HALF = 0.5 // tan of the fan's half angle

const IRIS_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uPupil;
uniform float uGlow;
uniform float uFlash;
varying vec3 vP;
void main() {
  vec2 p = vP.xy / ${CAP_R.toFixed(4)};
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float pr = uPupil;
  float pupil = 1.0 - smoothstep(pr * 0.8, pr, r);
  // fibres running out of the pupil, slowly twisting; a bright limbus near the rim; a hot ring around the pupil
  float fib = 0.5 + 0.5 * sin(a * 34.0 + sin(a * 6.0 + uTime * 0.4) * 1.6);
  fib *= 0.65 + 0.35 * sin(a * 77.0 + r * 9.0);
  float hot = smoothstep(pr * 1.7, pr, r) * (1.0 - pupil);
  float limbus = smoothstep(0.55, 0.88, r) * (1.0 - smoothstep(0.9, 0.97, r));
  vec3 col = uColor * (0.1 + 0.42 * fib * (1.0 - r * 0.4) + 0.55 * hot + 0.45 * limbus);
  col *= 1.0 - pupil;
  // a dark ring where the iris meets the bezel and the glass glint
  col *= 1.0 - smoothstep(0.9, 1.0, r) * 0.8;
  vec2 g = p - vec2(-0.3, 0.34);
  col += vec3(1.0, 0.85, 0.75) * smoothstep(0.17, 0.0, length(g)) * 0.7 * (1.0 - uFlash);
  col += vec3(1.0, 0.9, 0.8) * uFlash * (0.4 + 0.6 * (1.0 - r));
  gl_FragColor = vec4(col * uGlow, 1.0);
}`

const FAN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uStrength;
uniform float uPhase;
varying vec2 vUv;
varying float vAng;
void main() {
  // vUv.y: 0 at the base, 1 at the tip. Faint, fading toward the floor, with a brighter beam sweeping around the rim.
  float down = 1.0 - vUv.y;
  float sweep = pow(0.5 + 0.5 * cos(vAng - uTime * 1.3 - uPhase), 6.0);
  float a = (0.25 + 0.75 * sweep) * pow(vUv.y, 1.4) * (1.0 - smoothstep(0.7, 1.0, down) * 0.0);
  a *= 0.5 + 0.5 * smoothstep(0.0, 0.25, vUv.y);
  gl_FragColor = vec4(uColor * a * uStrength, 1.0);
}`

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAim;
uniform float uTime;
uniform float uLen;
varying vec2 vUv;
void main() {
  // a thin line that fills in from the eye, a bright pulse racing down it near the end of the aim
  float s = vUv.y * uLen;
  float reach = smoothstep(0.0, 0.25, uAim);
  float pulse = smoothstep(0.85, 1.0, fract(s / 3.0 - uTime * 3.0)) * uAim;
  float a = reach * (0.25 + 0.75 * uAim * uAim + pulse) * (1.0 - 0.5 * vUv.y);
  gl_FragColor = vec4(uColor * a, 1.0);
}`

export interface DroneViews {
  root: Group
  update(s: GameState, dt: number, camera: Camera): void
}

/** The orb with its bezel, fins, back panel and seams as one merged geometry per material (shared by every drone). */
function buildShellGeometry(): { shell: BufferGeometry; seams: BufferGeometry } {
  const parts: BufferGeometry[] = []
  const sphere = new SphereGeometry(R, 40, 28)
  parts.push(sphere)
  // the lens bezel: a thick ring around the iris cap, and a sunken collar inside it
  const capZ = R * Math.cos(CAP)
  const bezel = new TorusGeometry(R * Math.sin(CAP) * 1.02, 0.017, 10, 48)
  bezel.translate(0, 0, capZ - 0.004)
  parts.push(bezel)
  const collar = new TorusGeometry(R * Math.sin(CAP) * 1.13, 0.02, 10, 48)
  collar.translate(0, 0, capZ - 0.03)
  parts.push(collar)
  // three small fins around the rear equator and the emitter nozzle underneath
  for (const a of [Math.PI * 0.62, -Math.PI * 0.62, Math.PI]) {
    const fin = new BoxGeometry(0.06, 0.08, 0.012)
    fin.translate(R + 0.004, 0, 0)
    fin.rotateY(a)
    parts.push(fin)
  }
  const nozzle = new CylinderGeometry(0.05, 0.028, 0.05, 14)
  nozzle.translate(0, -R - 0.012, 0)
  parts.push(nozzle)
  const shell = mergeGeometries(parts.map((g) => g.toNonIndexed()), false)
  parts.forEach((g) => g.dispose())

  const lines: BufferGeometry[] = []
  // panel seams: a ring around the lens, a meridian over the top, and a lit back panel
  const sRing = new TorusGeometry(R * Math.sin(0.98), 0.0032 * E.droneSeam, 6, 64)
  sRing.translate(0, 0, R * Math.cos(0.98))
  lines.push(sRing)
  // a seam around the back half of the equator, and a second one round the back (the lit back panel sits between them)
  const sEq = new TorusGeometry(R * 1.003, 0.0028 * E.droneSeam, 6, 40, Math.PI)
  sEq.rotateX(-Math.PI / 2)
  lines.push(sEq)
  const sUp = new TorusGeometry(R * 1.003, 0.0028 * E.droneSeam, 6, 40, Math.PI * 0.8)
  sUp.rotateY(Math.PI / 2)
  sUp.rotateZ(Math.PI * 0.6)
  lines.push(sUp)
  for (const y of [0.075, -0.075]) {
    const bar = new BoxGeometry(0.106, 0.006, 0.006)
    bar.translate(0, y, -R * 1.002)
    lines.push(bar)
  }
  for (const x of [0.05, -0.05]) {
    const bar = new BoxGeometry(0.006, 0.156, 0.006)
    bar.translate(x, 0, -R * 1.002)
    lines.push(bar)
  }
  const seams = mergeGeometries(lines.map((g) => g.toNonIndexed()), false)
  lines.forEach((g) => g.dispose())
  return { shell, seams }
}

/** A radial falloff for the halo sprite. */
function makeHaloTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d') as CanvasRenderingContext2D
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

/** A zig-zag crack across the shell's front-upper side, as a thin ribbon on the sphere. */
function buildCrackGeometry(): BufferGeometry {
  const pts: [number, number][] = [[-0.9, 0.35], [-0.6, 0.55], [-0.45, 0.4], [-0.15, 0.75], [0.1, 0.62], [0.35, 0.95], [0.65, 0.85], [0.9, 1.05]]
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const [az, el] = pts[i] as [number, number]
    // azimuth around the lens axis (z), elevation from the equator up
    const ca = Math.cos(el)
    const px = Math.sin(az) * ca * R * 1.006
    const py = Math.sin(el) * R * 1.006
    const pz = Math.cos(az) * ca * R * 1.006
    const w = 0.006 * (1 - Math.abs(i - 3.5) / 5)
    pos.push(px - w, py, pz, px + w, py, pz)
    if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

export function buildDrones(s: GameState, _mats: Materials, sight: Sight, sim: Sim): DroneViews {
  const root = new Group()
  const beamGeo = new CylinderGeometry(1, 1, 1, 6, 1, true)
  beamGeo.translate(0, 0.5, 0)
  const { shell: shellGeo, seams: seamGeo } = buildShellGeometry()
  const crackGeo = buildCrackGeometry()
  // the iris: a spherical cap on the lens, its pole turned to +z
  const capGeo = new SphereGeometry(R * 1.004, 36, 10, 0, Math.PI * 2, 0, CAP)
  capGeo.rotateX(Math.PI / 2)
  const ringGeoA = new TorusGeometry(RING_A, 0.0075 * E.droneRingThick, 6, 72)
  const ringGeoB = new TorusGeometry(RING_B, 0.0065 * E.droneRingThick, 6, 72)
  const beadGeo = new SphereGeometry(0.03, 8, 6)
  const dotGeo = new SphereGeometry(0.022, 8, 6)
  // the scanning fan: an open cone, tip up (at the drone), base down; scaled to the height each frame
  const fanGeo = new ConeGeometry(1, 1, 36, 1, true)
  fanGeo.translate(0, -0.5, 0)
  {
    // the cone's vUv.y runs 0 at the base -> 1 at the tip (three's cone: v = 1 at the apex); add the angle as an attribute
    const posA = fanGeo.getAttribute('position')
    const ang = new Float32Array(posA.count)
    for (let i = 0; i < posA.count; i++) ang[i] = Math.atan2(posA.getZ(i), posA.getX(i))
    fanGeo.setAttribute('aAng', new Float32BufferAttribute(ang, 1))
  }
  // suspicion arcs: one geometry per filled fraction, so changing it never allocates
  const arcs: RingGeometry[] = []
  for (let i = 0; i <= SUS_SEGMENTS; i++) arcs.push(new RingGeometry(0.2, 0.27, 24, 1, Math.PI / 2, Math.max(0.0001, (i / SUS_SEGMENTS) * Math.PI * 2)))

  // the shell: the shared glossy black plus a red-tinted fresnel rim, so the orb keeps its outline against dark slabs and sky
  const shellMat = new MeshStandardMaterial({ color: 0x080b10, metalness: 0.85, roughness: 0.26, envMapIntensity: 1.2 })
  addRim(shellMat, E.droneRimStrength, E.droneRim, E.rimPower)
  const haloTex = makeHaloTexture()
  const views: DroneView[] = drones(s).map((_, i) => {
    const g = new Group()
    const body = new Group()
    const lean = new Group()
    const ringMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false })
    const seamMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false })
    const crackMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const irisMat = new ShaderMaterial({
      uniforms: { uColor: { value: palette.security.clone() }, uTime: { value: 0 }, uPupil: { value: 0.3 }, uGlow: { value: 1 }, uFlash: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: IRIS_FRAG,
    })
    const shell = new Mesh(shellGeo, shellMat)
    const seams = new Mesh(seamGeo, seamMat)
    const iris = new Mesh(capGeo, irisMat)
    const crack = new Mesh(crackGeo, crackMat)
    crack.visible = false
    crack.rotation.y = i * 2.1
    const dot = new Mesh(dotGeo, ringMat)
    dot.position.y = -R - 0.04
    // two thin rings orbiting on tilted axes, each with a bright bead
    const ringA = new Group()
    ringA.rotation.set(0.45, 0, 0.3)
    const ringAIn = new Group()
    ringAIn.add(new Mesh(ringGeoA, ringMat))
    ringAIn.rotation.x = Math.PI / 2
    const beadA = new Mesh(beadGeo, ringMat)
    beadA.position.set(RING_A, 0, 0)
    const spinA = new Group()
    spinA.add(ringAIn, beadA)
    ringA.add(spinA)
    const ringB = new Group()
    ringB.rotation.set(-0.5, 0, -1.0)
    const ringBIn = new Group()
    ringBIn.add(new Mesh(ringGeoB, ringMat))
    ringBIn.rotation.x = Math.PI / 2
    const beadB = new Mesh(beadGeo, ringMat)
    beadB.position.set(RING_B, 0, 0)
    const spinB = new Group()
    spinB.add(ringBIn, beadB)
    ringB.add(spinB)
    ringA.userData['spin'] = spinA
    ringB.userData['spin'] = spinB
    // a soft red halo behind the orb (additive, always facing the camera): readable from the side and the back, at range
    const haloMat = new SpriteMaterial({ map: haloTex, color: palette.security.clone(), transparent: true, opacity: E.droneHaloOpacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
    const halo = new Sprite(haloMat)
    halo.scale.setScalar(E.droneHalo)
    halo.userData['noReflect'] = true
    const eye = new Object3D()
    eye.position.z = R
    body.add(halo)
    lean.add(shell, seams, iris, crack, dot, ringA, ringB, eye)
    body.add(lean)
    const cone = createCone(D.range, D.halfAngleDeg * DEG, sight.texture)
    cone.mesh.rotation.x = D.pitchDeg * DEG
    cone.mesh.position.z = R
    body.add(cone.mesh)
    const look = createCone(LOOK.length, LOOK.halfAngleDeg * DEG, sight.texture, { scanOnly: false, nearFade: LOOK.nearFade })
    look.mesh.rotation.x = D.pitchDeg * DEG
    look.mesh.position.z = R
    body.add(look.mesh)
    const susMat = new MeshBasicMaterial({ color: palette.suspicious.clone(), toneMapped: false, transparent: true, depthTest: false, side: DoubleSide })
    const beamMat = new ShaderMaterial({
      uniforms: { uColor: { value: palette.security.clone() }, uAim: { value: 0 }, uTime: { value: 0 }, uLen: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const beam = new Mesh(beamGeo, beamMat)
    beam.visible = false
    beam.frustumCulled = false
    beam.userData['noReflect'] = true
    beam.renderOrder = 8
    const fanMat = new ShaderMaterial({
      uniforms: { uColor: { value: palette.security.clone() }, uTime: { value: 0 }, uStrength: { value: 0.1 }, uPhase: { value: i * 1.9 } },
      vertexShader: 'attribute float aAng; varying vec2 vUv; varying float vAng; void main(){ vUv = uv; vAng = aAng; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: FAN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    const fan = new Mesh(fanGeo, fanMat)
    fan.frustumCulled = false
    fan.renderOrder = 5
    fan.userData['noReflect'] = true
    fan.position.y = -0.12
    const sus = new Mesh(arcs[0], susMat)
    sus.position.y = 0.75
    sus.renderOrder = 20
    sus.userData['noReflect'] = true
    g.add(body, sus, beam, fan)
    g.visible = false
    root.add(g)
    return {
      root: g, body, lean, eye, haloMat, irisMat, ringMat, seamMat, crackMat, crack, ringA, ringB, beadA, beadB, fan, fanMat, beam, beamMat, cone, look, sus, susMat,
      bob: i * 1.7, lastSusSeg: 0, pupil: 0.3, lastX: 0, lastY: 0, lastZ: 0, px: 0, pz: 0, pitch: 0, roll: 0, wasAlive: false, lastHp: 0, hitT: 0,
    }
  })

  // bursts: the rings of a killed drone fly off
  const bursts: Burst[] = []
  const burstRingGeo = new TorusGeometry(0.42, 0.012, 6, 48)
  const flashGeo = new SphereGeometry(0.3, 14, 10)
  for (let i = 0; i < BURSTS; i++) {
    const mk = (): MeshBasicMaterial => new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const mats3 = [mk(), mk(), mk()]
    const rings = [new Mesh(burstRingGeo, mats3[0]), new Mesh(burstRingGeo, mats3[1])]
    const flash = new Mesh(flashGeo, mats3[2])
    for (const m of [...rings, flash]) {
      m.visible = false
      m.frustumCulled = false
      m.userData['noReflect'] = true
      root.add(m)
    }
    bursts.push({ rings, flash, mats: mats3, vel: [new Vector3(), new Vector3()], spin: [new Vector3(), new Vector3()], t: 99 })
  }
  let nextBurst = 0
  function startBurst(x: number, y: number, z: number, color: Color, seed: number): void {
    const b = bursts[nextBurst % BURSTS] as Burst
    nextBurst++
    b.t = 0
    for (let k = 0; k < 2; k++) {
      const r = b.rings[k] as Mesh
      r.position.set(x, y, z)
      r.rotation.set(0.5 + k * 1.2 + seed, seed * 2, k * 1.5)
      r.scale.setScalar(1)
      r.visible = true
      const a = seed * 3.7 + k * Math.PI
      ;(b.vel[k] as Vector3).set(Math.cos(a) * 2.2, 1.4 + k * 0.8, Math.sin(a) * 2.2)
      ;(b.spin[k] as Vector3).set(3 + k * 2, 4 - k * 3, 2)
    }
    b.flash.position.set(x, y, z)
    b.flash.visible = true
    for (const m of b.mats) m.color.copy(color)
  }

  return {
    root,
    update(st: GameState, dt: number, camera: Camera): void {
      const time = gameTime(st)
      const ds = drones(st)
      // the bursts
      for (const b of bursts) {
        if (b.t > BURST_SEC) continue
        b.t += dt
        const k = Math.min(1, b.t / BURST_SEC)
        const live = k < 1
        for (let j = 0; j < 2; j++) {
          const r = b.rings[j] as Mesh
          const vel = b.vel[j] as Vector3
          const sp = b.spin[j] as Vector3
          r.position.addScaledVector(vel, dt)
          vel.y -= 5 * dt
          r.rotation.x += sp.x * dt
          r.rotation.y += sp.y * dt
          r.rotation.z += sp.z * dt
          r.scale.setScalar(1 + k * 0.5)
          r.visible = live
        }
        b.flash.visible = k < 0.25
        b.flash.scale.setScalar(0.5 + k * 3.5)
        const fade = (1 - k) * (1 - k)
        for (let j = 0; j < 2; j++) (b.mats[j] as MeshBasicMaterial).color.copy(palette.security).multiplyScalar(2.2 * fade)
        ;(b.mats[2] as MeshBasicMaterial).color.copy(palette.security).lerp(palette.heroWhite, 0.6).multiplyScalar(1.5 * Math.max(0, 1 - k * 4))
      }
      for (let i = 0; i < views.length; i++) {
        const v = views[i] as DroneView
        const d = ds[i]
        if (d && v.wasAlive && !d.alive) startBurst(v.lastX, v.lastY, v.lastZ, palette.security, i)
        if (!d || !d.active || !d.alive) {
          v.wasAlive = false
          v.root.visible = false
          continue
        }
        if (!v.wasAlive) {
          v.lastX = d.pos.x
          v.lastY = d.pos.y
          v.lastZ = d.pos.z
          v.lastHp = d.hp
          v.px = d.pos.x
          v.pz = d.pos.z
          v.pitch = 0
          v.roll = 0
        }
        v.wasAlive = true
        if (d.hp < v.lastHp) v.hitT = 1
        v.lastHp = d.hp
        v.hitT = Math.max(0, v.hitT - dt * 3.5)
        v.root.visible = true
        v.bob += dt
        const bobY = Math.sin(v.bob * 2.1) * 0.07
        v.root.position.set(d.pos.x, d.pos.y + bobY, d.pos.z)
        v.lastX = d.pos.x
        v.lastY = d.pos.y + bobY
        v.lastZ = d.pos.z
        v.body.rotation.y = d.yaw
        // lean into the motion: nose down when moving ahead, a roll into the sideways drift; idle sway
        const vx = dt > 0 ? (d.pos.x - v.px) / dt : 0
        const vz = dt > 0 ? (d.pos.z - v.pz) / dt : 0
        v.px = d.pos.x
        v.pz = d.pos.z
        const sy = Math.sin(d.yaw)
        const cy = Math.cos(d.yaw)
        const ahead = vx * sy + vz * cy
        const side = vx * cy - vz * sy
        v.pitch += (Math.max(-0.3, Math.min(0.3, ahead * 0.1)) - v.pitch) * Math.min(1, dt * 4)
        v.roll += (Math.max(-0.3, Math.min(0.3, -side * 0.1)) - v.roll) * Math.min(1, dt * 4)
        v.lean.rotation.x = v.pitch + Math.sin(v.bob * 1.1) * 0.025
        v.lean.rotation.z = v.roll + Math.sin(v.bob * 1.3) * 0.03
        const spawning = d.spawnTime > 0
        // materializing: flicker in
        v.body.visible = !spawning || Math.sin(time * 60) > (d.spawnTime / D.spawnSec) * 1.6 - 0.8
        v.body.scale.setScalar(spawning ? 1 + d.spawnTime * 0.6 : 1)
        const paused = d.pausedTime > 0
        const alert = d.mode === 'alert'
        const aim = droneAim(st, sim, i)
        const aiming = aim > 0
        if (paused) tmp.copy(palette.paused)
        else if (alert) tmp.copy(palette.security)
        else tmp.copy(palette.security).lerp(palette.suspicious, Math.min(1, d.suspicion * 1.6))
        // the iris: the pupil dilates with suspicion, narrows to a pin when it locks on, flares at the shot
        const wantPupil = paused ? 0.34 : aiming ? 0.2 - 0.07 * aim : alert ? 0.17 : 0.36 + 0.2 * Math.min(1, d.suspicion * 1.4)
        v.pupil += (wantPupil - v.pupil) * Math.min(1, dt * (aiming ? 12 : 5))
        const iu = v.irisMat.uniforms as Record<string, { value: number | Color }>
        ;(iu['uColor'] as { value: Color }).value.copy(tmp)
        ;(iu['uTime'] as { value: number }).value = time
        ;(iu['uPupil'] as { value: number }).value = v.pupil
        ;(iu['uFlash'] as { value: number }).value = Math.max(v.hitT * v.hitT, aiming && aim > 0.8 ? 0.5 + Math.sin(time * 50) * 0.3 : 0)
        ;(iu['uGlow'] as { value: number }).value = (aiming ? 1 + aim * 1.4 : LOOK.lensGlow * 0.6) * (paused ? 0.5 : alert ? 1.15 + 0.15 * Math.sin(time * 12) : 1)
        // the rings: slow orbits at different angles, fast when alert; a hit jolts them; they tighten while aiming
        const spinRate = alert ? 3.2 : 0.55 + d.suspicion * 1.2
        const sa = v.ringA.userData['spin'] as Object3D
        const sb = v.ringB.userData['spin'] as Object3D
        sa.rotation.y += dt * spinRate
        sb.rotation.y -= dt * spinRate * 0.8
        v.ringA.rotation.y += dt * 0.35 * (paused ? 0.2 : 1)
        v.ringB.rotation.y -= dt * 0.28 * (paused ? 0.2 : 1)
        const jolt = v.hitT * Math.sin(time * 70) * 0.08
        v.ringA.scale.setScalar((aiming ? 1 - aim * 0.18 : 1) + jolt)
        v.ringB.scale.setScalar((aiming ? 1 - aim * 0.12 : 1) - jolt)
        v.ringMat.color.copy(paused ? palette.paused : palette.security).multiplyScalar(E.droneRing * (alert ? 0.95 + 0.45 * Math.sin(time * 12) : 0.75) + v.hitT * 2 + (aiming ? aim : 0))
        v.haloMat.color.copy(tmp).multiplyScalar(paused ? 0.5 : alert ? 1.3 : 1)
        v.seamMat.color.copy(tmp).multiplyScalar(0.8 + (aiming ? aim * 0.5 : 0))
        // the crack flash on a hit
        v.crack.visible = v.hitT > 0.02
        v.crackMat.color.copy(palette.heroWhite).lerp(tmp, 1 - v.hitT).multiplyScalar(2.5 * v.hitT)
        // the aim beam: from the lens to the hero's chest, narrowing and brightening with the aim
        v.beam.visible = aiming && !paused
        if (v.beam.visible) {
          v.root.updateMatrixWorld()
          v.eye.getWorldPosition(eyeW)
          const p = playerPos(st)
          toHero.set(p.x - eyeW.x, p.y + AIM.chest - eyeW.y, p.z - eyeW.z)
          const len = toHero.length()
          if (len > 0.1) {
            // the beam lives in the drone group: place it in that group's space
            v.root.getWorldQuaternion(invQ).invert()
            v.beam.position.copy(eyeW)
            v.root.worldToLocal(v.beam.position)
            toHero.multiplyScalar(1 / len)
            v.beam.quaternion.setFromUnitVectors(UP, toHero).premultiply(invQ)
            const r = AIM.wide + (AIM.thin - AIM.wide) * aim
            v.beam.scale.set(r, len, r)
            const bu = v.beamMat.uniforms as Record<string, { value: number }>
            ;(bu['uAim'] as { value: number }).value = aim
            ;(bu['uTime'] as { value: number }).value = time
            ;(bu['uLen'] as { value: number }).value = len
          } else v.beam.visible = false
        }
        // the scanning fan under it: faint, sweeping, as long as the drone is high
        const fanH = Math.max(FAN_LEN_MIN, d.pos.y)
        v.fan.visible = !spawning
        v.fan.scale.set(fanH * FAN_HALF, fanH, fanH * FAN_HALF)
        const fu = v.fanMat.uniforms as Record<string, { value: number | Color }>
        ;(fu['uColor'] as { value: Color }).value.copy(tmp)
        ;(fu['uTime'] as { value: number }).value = time
        ;(fu['uStrength'] as { value: number }).value = (paused ? 0.02 : alert ? 0.12 : 0.05 + d.suspicion * 0.06) * (aiming ? 1.5 : 1)
        v.cone.mesh.visible = !paused && !spawning
        v.look.mesh.visible = !spawning
        v.look.set(tmp, (paused ? LOOK.pausedStrength : LOOK.strength) * (alert ? 1.6 : 1 + d.suspicion), time, NO_FAN)
        v.cone.set(tmp, alert ? 1.6 : 0.7 + d.suspicion * 1.2, time, sight.fan(DRONE_KEY + i, d.pos.x, d.pos.y, d.pos.z, d.yaw, SPREAD, D.range))
        // suspicion arc above it, facing the camera
        const showSus = !alert && !paused && d.suspicion > 0.02
        v.sus.visible = showSus
        if (showSus) {
          const seg = Math.min(SUS_SEGMENTS, Math.ceil(d.suspicion * SUS_SEGMENTS))
          if (seg !== v.lastSusSeg) {
            v.sus.geometry = arcs[seg] as RingGeometry
            v.lastSusSeg = seg
          }
          v.susMat.color.copy(palette.suspicious).lerp(palette.security, d.suspicion)
          v.sus.quaternion.copy(camera.quaternion)
        }
      }
    },
  }
}
