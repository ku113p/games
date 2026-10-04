// The hero (H10, DESIGN 4 and 14): a hooded long coat over a matte black suit with armor plates, a few white neon lines
// (their color follows the ending counter), a glowing visor strip, the coat hem breaking into glowing filaments, a
// holographic wrist display and the gunblade (sword <-> rifle). The model is assets/models/hero.glb, built by
// tools/hero/build.py. The interface is small: root (placed by the game view), setLineColor, setMode,
// update(dt, anim, actionT, speed, time).
//
// Readability in dark corridors: the suit, plates, coat and hood get a soft fresnel rim (a cool edge light that does not
// depend on the scene's lights), and the collar, the coat's front edges and the hood opening carry a dim trim. Both stay
// below the bloom threshold, so they draw the silhouette without adding glow.
//
// Animation: every clip runs as an AnimationAction whose time and weight are set here each frame (no crossFadeTo, no
// events): a full-body base layer (idle / walk-run-sprint blend / crouch / jump / dash / hit / death / hack) whose weights
// fade toward the state from core queries, plus an upper-body overlay (slashes, rifle aim and shot; the hack's arms over a
// crouch) with a large weight, so it wins on the arms and spine while the legs keep walking. Walk, run and sprint share one phase that advances by
// the real speed over the blend's measured stride, so the planted foot keeps pace with the ground.
// Afterwards the twelve three-bone coat chains are swung procedurally: springs toward gravity (or along the body when
// lying), trailing behind when running, lifted out and back when crouched, pushed out of the legs and kept off the floor.
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
import cfgAll from '../config.json'
import type { HeroAnim } from '../core/queries'
import { palette } from './look'

const AIMC = cfgAll.view.heroAim
const DEG = Math.PI / 180

/** What the camera points at: `on` while the player holds aim (the raised rifle also follows a shot), `target` is the world point
 * under the crosshair (null: none known). While the rifle is raised the upper body turns so the barrel points at it; otherwise
 * the head gently looks that way. */
export interface HeroAim {
  on: boolean
  target: Vector3 | null
}

export interface HeroView {
  readonly root: Group
  setLineColor(c: Color): void
  setMode(mode: 'sword' | 'rifle'): void
  /** `combo` is the sword combo step (0, 1, 2 = finisher) of the swing being played. */
  update(dt: number, anim: HeroAnim, actionT: number, speed: number, time: number, combo?: number, aim?: HeroAim): void
  /** A rifle shot: the upper body kicks back for a moment (additive, on top of the aim; it never changes the aim goal). */
  kick(): void
  /** World position of the gunblade's muzzle (the barrel tip, after the upper-body aim); false until the model has loaded. */
  muzzle(out: Vector3): boolean
  /** World positions of the blade's hilt and tip (for the sword trail); false until the model has loaded. */
  blade(hilt: Vector3, tip: Vector3): boolean
  /** World position of the middle of the wrist display (left forearm), for May's glyph; false until the model has loaded. */
  wrist(out: Vector3): boolean
}

// --- locomotion. Strides (m per cycle of the planted foot) measured on the blended clips (on the Universal Base Characters legs), see tools/hero/README.md.
// walk -> run blend by the run share 0..1 (run phase-shifted by RUN_PHASE: that lines up the two clips' foot contacts)
const WR_STRIDE = [1.36, 1.8, 2.28, 2.76, 3.2, 3.65, 4.08, 4.48, 4.9, 5.27, 5.5] as const
const SPRINT_STRIDE = 6.2 // m per cycle of Sprint_Loop (run -> sprint is close to linear)
const RUN_PHASE = 0.85 // run and sprint clips start this far (cycles) into their loop at walk phase 0
const CROUCH_STRIDE = 1.48
const WALK_SPEED = 1.02 // the walk clip's own speed, m/s
const CADENCE = 1.15 // cycles per second the blend aims for between walk and run (picks the run share by speed)
const SPRINT_FROM = 4.3 // m/s: sprint starts to blend in ...
const SPRINT_FULL = 5.8 // ... and is full from here
// Crossfades are rates (1/s): the weight closes this share of the gap per second (exp-like), so 20/s is ~50 ms to 63 %.
// What the player does must show at once (a combat stance, a dash, a jump, a crouch); only the walk -> run -> sprint
// blend stays soft, because the speed that drives it ramps up by itself.
const FADE = 20 // base layer: idle, crouch, jump loop, hack, landing - a change of stance
const FADE_LOCO = 13 // base layer: walk, run, sprint (they follow the speed)
const FADE_FAST = 42 // for actions that must read at once (dash, hit, jump take-off, slash, shot)
const OVER = 24 // weight of the upper-body overlay against the base layer's 1
const OVER_OUT = 22 // the overlay lets go this fast (at weight 24 against 1 a slow fade keeps the arms in the old pose for 0.4 s)
const LAND_SEC = 0.42
const AIM_HOLD_SEC = 0.8 // the rifle stays raised this long after a shot
const UPPER = /^(spine_|neck_|Head|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/
// the arms only: the crouched hack keeps the crouch's back and head and borrows the hack's hands on the wrist display
const ARMS = /^(clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/
// slash variants: [start, end] of the clip (normalized) played over actionT with an ease-out, so the strike lands early
const SLASH_RANGE: ReadonlyArray<readonly [number, number]> = [
  [0.36, 0.86],
  [0.3, 0.74],
  [0.12, 0.5],
]

// base layer (full body)
const BASE = ['idle', 'idle_rifle', 'walk', 'run', 'sprint', 'crouch_idle', 'crouch_walk', 'jump_start', 'jump_loop', 'jump_land', 'dash', 'hit', 'death', 'hack'] as const
const IDLE = 0
const IDLE_RIFLE = 1
const WALK = 2
const RUN = 3
const SPRINT = 4
const C_IDLE = 5
const C_WALK = 6
const J_START = 7
const J_LOOP = 8
const LAND = 9
const DASH = 10
const HIT = 11
const DEATH = 12
const HACK = 13
// overlay (upper body)
const OVERLAY = ['slash_a', 'slash_b', 'slash_c', 'aim', 'shoot', 'hack'] as const
const AIM = 3
const SHOOT = 4
const HACK_ARMS = 5

// --- look
const RIM_COOL = new Color(0.5, 0.66, 0.82) // the fresnel edge light, mixed a little toward the line color
const RIM_SUIT = 0.1
const RIM_ARMOR = 0.14
const RIM_COAT = 0.15
const RIM_HOOD = 0.22
const TRIM_K = 0.2 // trim brightness against the line color (stays under the bloom threshold)
const LINES_K = 0.85
/** How bright the light lines are while the hero is hidden in cover (1 = lit, view.stealthLight.heroHiddenLines = hidden; the visor stays on). */
let linesK = 1
export function setHeroHidden(k: number): void {
  linesK = 1 - (1 - cfgAll.view.stealthLight.heroHiddenLines) * Math.max(0, Math.min(1, k))
}
const FILAMENT_K = 0.5
const STRIP_GLOW_K = 0.08
const CORE_K = 0.6
// rifle mode: the shoulders turn right (the head keeps looking ahead), so the gun held in front of the chest moves out
// to the right of the head, where the over-the-right-shoulder camera sees it
const AIM_TWIST = -0.32
// camera very close (tight spots pull it in): the hero dithers out so it does not fill the screen; the visor, lines
// and blade stay faintly lit so you still know where you are. Distance from the camera to the hero's body axis.
const CAM_FADE_NEAR = 0.6 // m: mostly gone at or below this ...
const CAM_FADE_FAR = 1.4 // ... fully visible from here
const CAM_FADE_BODY = 0.1 // share of the body's pixels still drawn when closest
const CAM_FADE_LINES = 0.35 // brightness of the glowing parts when closest

// --- coat chains: the legs as capsules the coat bones are pushed out of
const THIGH_R = 0.12
const CALF_R = 0.1
const COAT_FOLLOW = [0.3, 0.12, 0.05] as const // per segment: how much it keeps the bind pose with the pelvis instead of hanging
const COAT_STIFF = [170, 120, 80] as const // spring stiffness per segment (lower segments lag and swing more)
const COAT_ZETA = 0.6 // spring damping ratio (a little overshoot when the hero stops)
const COAT_TRAIL = [0.035, 0.07, 0.09] as const // backward pull per m/s of speed, per segment
const CROUCH_LIFT_OUT = [0.25, 0.55, 0.65] as const // crouched: pull outward ...
const CROUCH_LIFT_BACK = [0.3, 0.7, 0.85] as const // ... and back (the back of the coat drapes behind the heels)
const CROUCH_SHORTEN = 0.68 // crouched: the last segment shrinks to this (the hem lifts instead of pooling)
const DEATH_FOLLOW = 0.92 // lying: the coat lies along the body
const FLOOR_GAP = 0.035

interface Chain {
  bones: Object3D[] // deforming segments, top down
  rest: Quaternion[]
  axis: Vector3[] // segment direction in the segment's own space
  len: number[]
  bind: Vector3[] // bind-pose direction in the model's space
  bindPel: Vector3[] // bind-pose direction in the pelvis' rest space
  dir: Vector3[] // spring state: current world direction ...
  vel: Vector3[] // ... and its velocity
  init: boolean
}

/** Critically damped smoothing (Unity's SmoothDamp): `v` is the velocity, `smoothSec` the time it takes to close most of the gap. */
interface Damped {
  x: number
  v: number
}
function damp(st: Damped, to: number, smoothSec: number, dt: number): void {
  if (dt <= 0) return
  const w = 2 / Math.max(1e-3, smoothSec)
  const x = w * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = st.x - to
  const tmp = (st.v + w * change) * dt
  st.v = (st.v - w * tmp) * e
  st.x = to + (change + tmp) * e
}
const wrapPi = (a: number): number => a - Math.PI * 2 * Math.round(a / (Math.PI * 2))
const clampAbs = (x: number, m: number): number => (x < -m ? -m : x > m ? m : x)

const smooth = (cur: number, to: number, rate: number, dt: number): number => cur + (to - cur) * Math.min(1, dt * rate)
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 2.2)

/** Stride of the walk -> run blend at a run share 0..1 (table lookup). */
function wrStride(k: number): number {
  const x = clamp01(k) * (WR_STRIDE.length - 1)
  const i = Math.min(WR_STRIDE.length - 2, Math.floor(x))
  const a = WR_STRIDE[i] ?? 1.36
  const b = WR_STRIDE[i + 1] ?? a
  return a + (b - a) * (x - i)
}

/** Run share that gives the walk -> run blend a stride of speed / CADENCE (slow speeds stay on the walk). */
function runShare(speed: number): number {
  if (speed <= WALK_SPEED) return 0
  const want = Math.max(WR_STRIDE[0], speed / CADENCE)
  for (let i = 0; i < WR_STRIDE.length - 1; i++) {
    const a = WR_STRIDE[i] ?? 0
    const b = WR_STRIDE[i + 1] ?? 0
    if (want <= b) return (i + (want - a) / (b - a)) / (WR_STRIDE.length - 1)
  }
  return 1
}

// frame temporaries (no allocation in update)
const tA = new Vector3()
const tB = new Vector3()
const tC = new Vector3()
const tD = new Vector3()
const tE = new Vector3()
const tF = new Vector3()
const qP = new Quaternion()
const qPel = new Quaternion()
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
const lineN = new Color()

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

/** Swing a coat bone outward (away from the hips) from its wanted direction until it clears the legs; then keep its end
 * off the floor by turning it up (outward), never by laying it flat along the floor. */
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
  const room = from.y - floor
  if (from.y + res.y * len < floor) {
    // the lowest the end may go: tilt the bone so its drop equals the room left (outward if it has to rise)
    const dy = Math.max(-1, Math.min(0.35, -room / len))
    tF.copy(res).setY(0)
    if (tF.lengthSq() < 1e-6) tF.copy(outward)
    tF.normalize().multiplyScalar(Math.sqrt(Math.max(0, 1 - dy * dy)))
    res.set(tF.x, dy, tF.z)
  }
}

// screen-door transparency: drops a share (1 - uFade) of the pixels in a fine noise pattern (no sorting, keeps depth)
const DITHER = `
  if (uFade < 0.999) {
    float dn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (dn >= uFade) discard;
  }`

/** Dither a material out by the shared fade (opaque body parts). */
function addDither(m: Material, fade: { value: number }): void {
  m.onBeforeCompile = (sh): void => {
    sh.uniforms['uFade'] = fade
    sh.fragmentShader = 'uniform float uFade;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + DITHER)
  }
}

/** Dim a glowing material by the shared line fade (it stays visible, just fainter). */
function addDim(m: Material, fade: { value: number }): void {
  m.onBeforeCompile = (sh): void => {
    sh.uniforms['uFadeLines'] = fade
    sh.fragmentShader = 'uniform float uFadeLines;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb *= uFadeLines;')
  }
}

/** A cool fresnel edge light on a standard material (emissive, so it reads without any light behind the hero), plus
 * the close-camera dither. */
function addRim(m: MeshStandardMaterial, rim: { value: Color }, fade: { value: number }, glow?: { value: Color }): void {
  m.onBeforeCompile = (sh): void => {
    sh.uniforms['uRim'] = rim
    sh.uniforms['uFade'] = fade
    let vs = sh.vertexShader
    let fs = 'uniform vec3 uRim;\nuniform float uFade;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + DITHER)
    let extra = `
  float rimF = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
  totalEmissiveRadiance += uRim * (rimF * rimF * rimF);`
    if (glow) {
      // the coat's strips glow toward their tips (per-vertex "_glow" from the build)
      sh.uniforms['uGlow'] = glow
      vs = 'attribute float _glow;\nvarying float vGlow;\n' + vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = _glow;')
      fs = 'uniform vec3 uGlow;\nvarying float vGlow;\n' + fs
      extra += '\n  totalEmissiveRadiance += uGlow * (vGlow * vGlow);'
    }
    sh.vertexShader = vs
    sh.fragmentShader = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + extra)
  }
}

export function createHero(): HeroView {
  const root = new Group()
  const lineColor = palette.heroWhite.clone()
  const glowColor = { value: new Color() }
  const timeU = { value: 0 }
  const rimSuit = { value: new Color() }
  const rimArmor = { value: new Color() }
  const rimCoat = { value: new Color() }
  const rimHood = { value: new Color() }
  const fadeU = { value: 1 } // body pixels drawn, 0..1
  const fadeLinesU = { value: 1 } // glow brightness, 0..1

  // materials (the glb's materials are replaced by name)
  const suit = new MeshStandardMaterial({ color: 0x0d1015, roughness: 0.5, metalness: 0.45 })
  const joints = new MeshStandardMaterial({ color: 0x171b21, roughness: 0.34, metalness: 0.65 })
  const armor = new MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.26, metalness: 0.75 })
  const coat = new MeshStandardMaterial({ color: 0x12151b, roughness: 0.55, metalness: 0.3, side: DoubleSide })
  const hood = new MeshStandardMaterial({ color: 0x14171d, roughness: 0.5, metalness: 0.3, side: DoubleSide })
  const gun = new MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.28, metalness: 0.8 })
  const lines = new MeshBasicMaterial({ color: lineColor, toneMapped: false, side: DoubleSide })
  const trim = new MeshBasicMaterial({ color: lineColor.clone(), toneMapped: false, side: DoubleSide })
  const core = new MeshBasicMaterial({ color: lineColor.clone(), toneMapped: false })
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
  addRim(suit, rimSuit, fadeU)
  addRim(joints, rimSuit, fadeU)
  addRim(armor, rimArmor, fadeU)
  addRim(coat, rimCoat, fadeU, glowColor)
  addRim(hood, rimHood, fadeU)
  addDither(gun, fadeU)
  for (const m of [lines, trim, core, visor, blade, holo]) addDim(m, fadeLinesU)
  // filaments: fade from the root to the tip and sway a little (more toward the tip)
  filaments.onBeforeCompile = (sh): void => {
    sh.uniforms['uTime'] = timeU
    sh.uniforms['uFadeLines'] = fadeLinesU
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
      'varying float vGlow;\nuniform float uFadeLines;\n' +
      sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb *= vGlow * vGlow * (0.35 + 0.65 * smoothstep(1.0, 0.75, vGlow)) * uFadeLines;')
  }

  // the close-camera fade, set right before each draw from the camera of that pass (the floor mirror pass has its own)
  const onDraw: Object3D['onBeforeRender'] = (_r, _s, cam): void => {
    const c = cam.matrixWorld.elements
    const h = root.matrixWorld.elements
    const cx = c[12] ?? 0
    const cy = c[13] ?? 0
    const cz = c[14] ?? 0
    const hy = h[13] ?? 0
    const dx = cx - (h[12] ?? 0)
    const dz = cz - (h[14] ?? 0)
    const y = cy < hy + 0.4 ? hy + 0.4 : cy > hy + 1.7 ? hy + 1.7 : cy // nearest point on the body's axis
    const d = Math.sqrt(dx * dx + dz * dz + (cy - y) * (cy - y))
    const t = clamp01((d - CAM_FADE_NEAR) / (CAM_FADE_FAR - CAM_FADE_NEAR))
    const k = t * t * (3 - 2 * t)
    fadeU.value = CAM_FADE_BODY + (1 - CAM_FADE_BODY) * k
    fadeLinesU.value = CAM_FADE_LINES + (1 - CAM_FADE_LINES) * k
  }

  const byName: Record<string, Material> = {
    Suit: suit,
    SuitJoints: joints,
    Armor: armor,
    Coat: coat,
    Gun: gun,
    NeonLines: lines,
    Trim: trim,
    Core: core,
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
  let spine: Object3D | null = null
  let spine1: Object3D | null = null
  let spine3: Object3D | null = null
  let neck: Object3D | null = null
  let gunRoot: Object3D | null = null
  let bladeMesh: Object3D | null = null
  let muzzleNode: Object3D | null = null
  let wristA: Object3D | null = null
  let wristB: Object3D | null = null
  let bladeAxis: 'x' | 'y' | 'z' = 'y'
  let barrelSign = 1
  const swordPos = new Vector3()
  const swordQuat = new Quaternion()
  const swordScale = new Vector3(1, 1, 1)
  const riflePos = new Vector3()
  const rifleQuat = new Quaternion()
  const rifleScale = new Vector3(1, 1, 1)
  const barrel = new Vector3()

  // animation state
  let mode: 'sword' | 'rifle' = 'sword'
  let gunK = 0 // 0 sword grip .. 1 rifle grip
  let bladeOut = 1
  let prevAnim: HeroAnim = 'idle'
  let legs: 'stand' | 'crouch' | 'air' = 'stand'
  let airTime = 0
  let landT = -1
  let locoPhase = 0
  let crouchPhase = 0
  let slashVariant = 0
  let lastShot = -10
  let deathT = 0
  let crouchK = 0 // smoothed 0..1, drives the coat lift
  let deathK = 0
  let shotGlow = 0
  let aimK = 0 // smoothed 0..1, the rifle-mode shoulder turn
  // the upper-body aim: the extra turn (rad) of the spine chain, smoothed; its goal is the turn the barrel was still missing
  const aimYaw: Damped = { x: 0, v: 0 }
  const aimPitch: Damped = { x: 0, v: 0 }
  const baseQ = [new Quaternion(), new Quaternion(), new Quaternion(), new Quaternion()]
  const additiveBones: (Object3D | null)[] = [null, null, null, null]
  let baseHas = false
  let recoil = 0 // 0..1: the shot's upper-body kick, decays by view.heroAim.recoilRate
  let aimGoalYaw = 0
  let aimGoalPitch = 0
  let aimHeading = 0 // yaw of the direction from the muzzle to the target (the axis of the pitch turn)
  const lookYaw: Damped = { x: 0, v: 0 } // the head's gentle look at the camera direction (rifle lowered)
  const lookPitch: Damped = { x: 0, v: 0 }
  const UP = new Vector3(0, 1, 0)
  const pitchAxis = new Vector3()
  const dirBarrel = new Vector3()
  const dirWant = new Vector3()

  new GLTFLoader().load(
    heroUrl,
    (gltf) => {
      const model = gltf.scene
      model.traverse((o) => {
        o.layers.mask = root.layers.mask // the game view marks the root for the floor reflection before we load
        const m = o as Mesh
        if (!m.isMesh) return
        m.frustumCulled = false
        m.onBeforeRender = onDraw
        const isHood = m.name.startsWith('Hood') || (m.parent !== null && m.parent.name.startsWith('Hood'))
        const swap = (old: Material): Material => (isHood && old.name === 'Coat' ? hood : (byName[old.name] ?? suit))
        if (Array.isArray(m.material)) {
          const olds = m.material
          m.material = olds.map(swap)
          for (const x of olds) x.dispose()
        } else {
          const old = m.material
          m.material = swap(old)
          old.dispose()
        }
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
      spine = bone('spine_02')
      spine1 = bone('spine_01')
      spine3 = bone('spine_03')
      neck = bone('neck_01')
      additiveBones[0] = spine1
      additiveBones[1] = spine
      additiveBones[2] = spine3
      additiveBones[3] = neck
      baseHas = false
      model.updateMatrixWorld(true)
      const pelInv = pelvis.getWorldQuaternion(new Quaternion()).premultiply(model.getWorldQuaternion(new Quaternion()).invert()).invert()
      // coat chains: coat_<side><k>_a, _b, _c ... ; the last bone of a chain is a non-deforming leaf
      for (const side of ['l', 'r']) {
        for (let k = 1; model.getObjectByName(`coat_${side}${k}_a`); k++) {
          const nodes: Object3D[] = []
          for (const seg of 'abcdefgh') {
            const o = model.getObjectByName(`coat_${side}${k}_${seg}`)
            if (!o) break
            nodes.push(o)
          }
          const bones = nodes.slice(0, -1)
          const pos = nodes.map((o) => model.worldToLocal(o.getWorldPosition(new Vector3())))
          chains.push({
            bones,
            rest: bones.map((b) => b.quaternion.clone()),
            axis: bones.map((_, i) => (nodes[i + 1] as Object3D).position.clone().normalize()),
            len: bones.map((_, i) => (nodes[i + 1] as Object3D).position.length()),
            bind: bones.map((_, i) => (pos[i + 1] as Vector3).clone().sub(pos[i] as Vector3).normalize()),
            bindPel: bones.map((_, i) => (pos[i + 1] as Vector3).clone().sub(pos[i] as Vector3).normalize().applyQuaternion(pelInv)),
            dir: bones.map(() => new Vector3()),
            vel: bones.map(() => new Vector3()),
            init: false,
          })
        }
      }
      gunRoot = bone('Gunblade')
      bladeMesh = bone('Blade')
      muzzleNode = bone('Muzzle')
      wristA = bone('lowerarm_l')
      wristB = bone('hand_l')
      const rifle = bone('RifleHold')
      swordPos.copy(gunRoot.position)
      swordQuat.copy(gunRoot.quaternion)
      swordScale.copy(gunRoot.scale)
      riflePos.copy(rifle.position)
      rifleQuat.copy(rifle.quaternion)
      rifleScale.copy(rifle.scale)
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
      const make = (name: string, part: RegExp | null): AnimationAction => {
        const src = clips.get(name)
        if (!src) throw new Error(`hero.glb: no clip ${name}`)
        const clip = part ? new AnimationClip(`${name}_upper`, src.duration, src.tracks.filter((t) => part.test(t.name))) : src
        const a = mx.clipAction(clip)
        a.setLoop(LoopRepeat, Infinity)
        a.timeScale = 0 // times are set by hand every frame
        a.setEffectiveWeight(0)
        a.play()
        return a
      }
      for (const n of BASE) base.push(make(n, null))
      for (const n of OVERLAY) over.push(make(n, n === 'hack' ? ARMS : UPPER))
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
      const run = runShare(speed)
      const spr = clamp01((speed - SPRINT_FROM) / (SPRINT_FULL - SPRINT_FROM))
      baseT[sword ? IDLE : IDLE_RIFLE] = idleK
      baseT[WALK] = (1 - run) * (1 - spr) * (1 - idleK)
      baseT[RUN] = run * (1 - spr) * (1 - idleK)
      baseT[SPRINT] = spr * (1 - idleK)
    }
    if (landT >= 0) {
      const k = 0.75 * (1 - landT / LAND_SEC)
      for (let i = 0; i < baseT.length; i++) baseT[i] = (baseT[i] ?? 0) * (1 - k)
      baseT[LAND] = k
    }
  }

  /** The stride (m per cycle) of the walk / run / sprint mix as it is weighted right now. */
  function locoStride(): number {
    const w = baseW[WALK] ?? 0
    const r = baseW[RUN] ?? 0
    const s = baseW[SPRINT] ?? 0
    const tot = w + r + s
    if (tot < 1e-4) return WR_STRIDE[0]
    const wr = w + r > 1e-4 ? wrStride(r / (w + r)) : wrStride(1)
    const q = s / tot
    return wr + (SPRINT_STRIDE - wr) * q
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
    pelvis.getWorldQuaternion(qPel)
    const floor = root.position.y + FLOOR_GAP
    const yaw = root.rotation.y
    back.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    // springs: sub-steps keep them stable on long frames
    const steps = dt > 0.034 ? 2 : 1
    const h = dt / steps
    for (let i = 0; i < chains.length; i++) {
      const c = chains[i]
      const first = c?.bones[0]
      const parent = first?.parent
      if (!c || !first || !parent) continue
      parent.getWorldQuaternion(qP)
      first.getWorldPosition(tA)
      out.subVectors(tA, center).setY(0)
      if (out.lengthSq() < 1e-8) out.copy(back)
      out.normalize() // outward from the hips
      const backness = clamp01(0.5 + 0.5 * out.dot(back)) // 1 at the back of the coat, 0 at the front
      for (let k = 0; k < c.bones.length; k++) {
        const b = c.bones[k]
        const kk = Math.min(k, 2)
        if (!b) continue
        // wanted direction: hang (bind pose in the model's space) or keep the pose with the pelvis
        const follow = (COAT_FOLLOW[kk] ?? 0) + (DEATH_FOLLOW - (COAT_FOLLOW[kk] ?? 0)) * deathK
        tB.copy(c.bind[k] as Vector3).applyQuaternion(root.quaternion).multiplyScalar(1 - follow)
        tC.copy(c.bindPel[k] as Vector3).applyQuaternion(qPel)
        tB.addScaledVector(tC, follow)
        tB.addScaledVector(back, Math.min(0.7, speed * (COAT_TRAIL[kk] ?? 0)) * (1 - deathK))
        tB.addScaledVector(out, crouchK * (CROUCH_LIFT_OUT[kk] ?? 0))
        tB.addScaledVector(back, crouchK * (CROUCH_LIFT_BACK[kk] ?? 0) * backness)
        tB.normalize()
        const d = c.dir[k] as Vector3
        const v = c.vel[k] as Vector3
        if (!c.init) {
          d.copy(tB)
          v.set(0, 0, 0)
        } else {
          const ks = COAT_STIFF[kk] ?? 100
          const kd = 2 * COAT_ZETA * Math.sqrt(ks)
          for (let s = 0; s < steps; s++) {
            tC.subVectors(tB, d).multiplyScalar(ks).addScaledVector(v, -kd)
            v.addScaledVector(tC, h)
            d.addScaledVector(v, h).normalize()
          }
        }
        // the last segment shortens when crouched (the hem lifts instead of pooling on the floor)
        const scale = k === c.bones.length - 1 ? 1 + (CROUCH_SHORTEN - 1) * crouchK : 1
        b.scale.setScalar(scale)
        const len = (c.len[k] ?? 0.2) * scale
        swing(tA, d, out, len, floor, tD)
        qInv.copy(qP).invert()
        tE.copy(tD).applyQuaternion(qInv) // wanted direction in the parent's space
        tC.copy(c.axis[k] as Vector3).applyQuaternion(c.rest[k] as Quaternion)
        qT.setFromUnitVectors(tC, tE)
        b.quaternion.copy(qT).multiply(c.rest[k] as Quaternion)
        qP.multiply(b.quaternion)
        tA.addScaledVector(tD, len)
      }
      c.init = true
    }
  }

  /** Turn a bone about the world's up axis (on top of what the clips set). */
  function twist(b: Object3D, angle: number): void {
    const p = b.parent
    if (!p) return
    p.getWorldQuaternion(qP)
    tA.set(0, 1, 0).applyQuaternion(qInv.copy(qP).invert())
    qT.setFromAxisAngle(tA, angle)
    b.quaternion.premultiply(qT)
  }

  /** Turn a bone about a world axis (on top of what the clips set). */
  function rotateWorld(b: Object3D, axis: Vector3, angle: number): void {
    const p = b.parent
    if (!p || Math.abs(angle) < 1e-5) return
    p.getWorldQuaternion(qP)
    tA.copy(axis).applyQuaternion(qInv.copy(qP).invert())
    qT.setFromAxisAngle(tA, angle)
    b.quaternion.premultiply(qT)
  }

  /** Raises the barrel to the target: the spine chain (and a small share of the neck) turns by the smoothed yaw and pitch the
   * clips' pose still lacks; after turning, the barrel is measured again and the miss is added to the goal (so the shoulder
   * offset, the recoil and the bones' own bends all cancel out). Lowered: the turn eases back to 0 and the head looks at the target. */
  function aimSolve(dt: number, raised: boolean, target: Vector3 | null, look: boolean): void {
    if (!spine1 || !spine || !spine3 || !neck || !muzzleNode || !gunRoot) return
    const chain = [spine1, spine, spine3, neck]
    const on = raised && target !== null
    damp(aimYaw, on ? aimGoalYaw : 0, AIMC.smoothSec, dt)
    damp(aimPitch, on ? aimGoalPitch : 0, AIMC.smoothSec, dt)
    const lk = AIMC.look
    let headYaw = 0
    let headPitch = 0
    if (look && !on && target) {
      neck.getWorldPosition(tA)
      tB.subVectors(target, tA)
      const hd = Math.hypot(tB.x, tB.z)
      if (hd > AIMC.minReach) {
        headYaw = clampAbs(wrapPi(Math.atan2(tB.x, tB.z) - root.rotation.y), lk.yawMaxDeg * DEG) * lk.share
        headPitch = clampAbs(Math.atan2(tB.y, hd), lk.pitchMaxDeg * DEG) * lk.share
      }
    }
    damp(lookYaw, headYaw, lk.smoothSec, dt)
    damp(lookPitch, headPitch, lk.smoothSec, dt)
    const heading = on ? aimHeading : root.rotation.y + lookYaw.x
    pitchAxis.set(Math.cos(heading), 0, -Math.sin(heading))
    for (let i = 0; i < chain.length; i++) {
      const b = chain[i] as Object3D
      const ys = aimYaw.x * (AIMC.yawShare[i] ?? 0) + (i === 3 ? lookYaw.x : 0)
      const ps = aimPitch.x * (AIMC.pitchShare[i] ?? 0) + (i === 3 ? lookPitch.x : 0)
      rotateWorld(b, UP, ys)
      rotateWorld(b, pitchAxis, -ps)
    }
    if (!on || !target) return
    // what is still missing: the barrel (hilt -> muzzle) against the line from the muzzle to the target
    root.updateMatrixWorld(true)
    muzzleNode.getWorldPosition(tA)
    gunRoot.getWorldPosition(tB)
    dirBarrel.subVectors(tA, tB)
    dirWant.subVectors(target, tA)
    if (dirBarrel.lengthSq() < 1e-8 || dirWant.length() < AIMC.minReach) return
    dirBarrel.normalize()
    dirWant.normalize()
    aimHeading = Math.atan2(dirWant.x, dirWant.z)
    const dy = wrapPi(aimHeading - Math.atan2(dirBarrel.x, dirBarrel.z))
    const dp = Math.asin(clampAbs(dirWant.y, 1)) - Math.asin(clampAbs(dirBarrel.y, 1))
    aimGoalYaw = clampAbs(aimYaw.x + dy, AIMC.yawMaxDeg * DEG)
    aimGoalPitch = clampAbs(aimPitch.x + dp, AIMC.pitchMaxDeg * DEG)
  }

  /** The shot's recoil: the spine chain pitches back by a decaying extra turn, applied after the aim was solved (so the solver does
   * not cancel it) and rebuilt from the clips next frame (so it never accumulates). */
  function aimUpper(dt: number, raised: boolean, target: Vector3 | null, look: boolean): void {
    aimSolve(dt, raised, target, look)
    recoil *= Math.exp(-dt * AIMC.recoilRate)
    if (recoil < 1e-3 || !spine1 || !spine || !spine3 || !neck) return
    const chain = [spine1, spine, spine3, neck]
    for (let i = 0; i < chain.length; i++) rotateWorld(chain[i] as Object3D, pitchAxis, -recoil * AIMC.recoilDeg * DEG * (AIMC.pitchShare[i] ?? 0))
  }

  function updateGun(dt: number, anim: HeroAnim, actionT: number): void {
    if (!gunRoot || !bladeMesh) return
    gunK = smooth(gunK, mode === 'rifle' ? 1 : 0, 24, dt)
    bladeOut = smooth(bladeOut, mode === 'sword' ? 1 : 0, 26, dt)
    gunRoot.position.lerpVectors(swordPos, riflePos, gunK)
    gunRoot.quaternion.slerpQuaternions(swordQuat, rifleQuat, gunK)
    gunRoot.scale.lerpVectors(swordScale, rifleScale, gunK)
    if (anim === 'shoot') {
      // the kick: back along the barrel
      barrel.set(0, 0, 0)
      barrel[bladeAxis] = barrelSign
      barrel.applyQuaternion(gunRoot.quaternion).multiplyScalar(-AIMC.gunKick * (1 - actionT) * gunRoot.scale.x)
      gunRoot.position.add(barrel)
      shotGlow = 1
    } else shotGlow = smooth(shotGlow, 0, 10, dt)
    bladeMesh.scale[bladeAxis] = Math.max(0.001, bladeOut)
    bladeMesh.visible = bladeOut > 0.02
    // the core: steady in sword mode, brighter in rifle mode and flaring on a shot
    core.color.copy(lineColor).multiplyScalar(CORE_K * (0.75 + 0.35 * gunK + 0.6 * shotGlow))
  }

  return {
    root,
    setLineColor(c: Color): void {
      lineColor.copy(c).multiplyScalar(linesK)
      lines.color.copy(c).multiplyScalar(LINES_K * linesK)
      trim.color.copy(c).multiplyScalar(TRIM_K * linesK)
      visor.color.copy(c).multiplyScalar(1.05)
      blade.color.copy(c).multiplyScalar(1.15)
      filaments.color.copy(c).multiplyScalar(FILAMENT_K * linesK)
      glowColor.value.copy(c).multiplyScalar(STRIP_GLOW_K * linesK)
      // the rim light: cool, a little of the line color (so it shifts with the ending counter)
      const m = Math.max(c.r, c.g, c.b, 1e-3)
      lineN.setRGB(c.r / m, c.g / m, c.b / m)
      rimSuit.value.copy(RIM_COOL).lerp(lineN, 0.3).multiplyScalar(RIM_SUIT)
      rimArmor.value.copy(RIM_COOL).lerp(lineN, 0.3).multiplyScalar(RIM_ARMOR)
      rimCoat.value.copy(RIM_COOL).lerp(lineN, 0.3).multiplyScalar(RIM_COAT)
      rimHood.value.copy(RIM_COOL).lerp(lineN, 0.3).multiplyScalar(RIM_HOOD)
    },
    setMode(m: 'sword' | 'rifle'): void {
      mode = m
    },
    kick(): void {
      recoil = 1
    },
    muzzle(out: Vector3): boolean {
      if (!muzzleNode) return false
      muzzleNode.getWorldPosition(out)
      return true
    },
    wrist(out: Vector3): boolean {
      if (!wristA || !wristB) return false
      wristA.getWorldPosition(out)
      wristB.getWorldPosition(barrel)
      out.lerp(barrel, 0.5)
      return true
    },
    blade(hilt: Vector3, tip: Vector3): boolean {
      if (!muzzleNode || !gunRoot) return false
      muzzleNode.getWorldPosition(tip)
      gunRoot.getWorldPosition(hilt)
      return true
    },
    update(dt: number, anim: HeroAnim, actionT: number, speed: number, time: number, combo = 0, aim?: HeroAim): void {
      timeU.value = time
      if (!ready || !mixer) return
      const sword = mode === 'sword'

      // what the legs do (slash and shoot keep the legs of the state before them)
      if (anim === 'crouch' || anim === 'hackCrouched') legs = 'crouch'
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
      // the clip of the swing is the core's combo step (a swing that lands in the frame the last one ended still flips it)
      if (anim === 'slash') slashVariant = combo % SLASH_RANGE.length
      if (anim === 'shoot') lastShot = time
      if (anim === 'death') deathT = prevAnim === 'death' ? deathT + dt : 0
      crouchK = smooth(crouchK, legs === 'crouch' && anim !== 'death' ? 1 : 0, 12, dt)
      deathK = smooth(deathK, anim === 'death' ? clamp01((deathT - 0.35) / 0.6) : 0, 6, dt)

      // base layer
      setBaseTargets(anim, speed, sword)
      let sum = 0
      for (let i = 0; i < BASE.length; i++) {
        const t = baseT[i] ?? 0
        const fast = i === DASH || i === HIT || i === DEATH || i === J_START
        const rate = fast && t > 0 ? FADE_FAST : i === WALK || i === RUN || i === SPRINT ? FADE_LOCO : FADE
        const w = smooth(baseW[i] ?? 0, t, rate, dt)
        baseW[i] = w
        sum += w
      }
      if (sum < 1e-4) {
        baseW[IDLE] = 1
        sum = 1
      }
      // phases: advance by the real speed over the current blend's stride, so the planted foot keeps pace
      if (legs === 'crouch') crouchPhase = (crouchPhase + (dt * Math.max(0.3, speed)) / CROUCH_STRIDE) % 1
      else locoPhase = (locoPhase + (dt * Math.max(0.5, speed)) / locoStride()) % 1
      for (let i = 0; i < BASE.length; i++) {
        const a = base[i]
        if (!a) continue
        const dur = a.getClip().duration
        let t: number
        switch (i) {
          case WALK:
            t = locoPhase * dur
            break
          case RUN:
          case SPRINT:
            t = ((locoPhase + RUN_PHASE) % 1) * dur
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
      const fullBody = anim === 'dash' || anim === 'hit' || anim === 'death' || anim === 'hack' || anim === 'hackCrouched'
      if (anim === 'hackCrouched') {
        // hacking from a crouch: crouched legs and back (base layer), the hack's hands on top
        overT[HACK_ARMS] = 1
        const clip = over[HACK_ARMS]
        if (clip) overTime[HACK_ARMS] = ((overTime[HACK_ARMS] ?? 0) + dt) % clip.getClip().duration
      } else if (anim === 'slash') {
        overT[slashVariant] = 1
        const r = SLASH_RANGE[slashVariant]
        const clip = over[slashVariant]
        if (r && clip) overTime[slashVariant] = (r[0] + (r[1] - r[0]) * easeOut(actionT)) * clip.getClip().duration
      } else if (!sword && !fullBody && (anim === 'shoot' || time - lastShot < AIM_HOLD_SEC || aim?.on === true)) {
        if (anim === 'shoot') {
          overT[SHOOT] = 1
          const clip = over[SHOOT]
          if (clip) overTime[SHOOT] = 0.3 * actionT * clip.getClip().duration
        } else overT[AIM] = 1
      }
      for (let i = 0; i < OVERLAY.length; i++) {
        const t = overT[i] ?? 0
        const w = smooth(overW[i] ?? 0, t, t > 0 ? FADE_FAST : OVER_OUT, dt)
        overW[i] = w
        const a = over[i]
        if (!a) continue
        a.time = overTime[i] ?? 0
        a.setEffectiveWeight(w * OVER)
      }

      // the clip does not rewrite a bone whose track value did not change (a paused frame, hit-stop, a constant idle track), so the
      // additive turns below would pile up on last frame's result: put the clean clip pose back first, snapshot it after the mixer
      for (let i = 0; i < 4; i++) {
        const b = additiveBones[i]
        if (b && baseHas) b.quaternion.copy(baseQ[i] as Quaternion)
      }
      mixer.update(dt)
      for (let i = 0; i < 4; i++) {
        const b = additiveBones[i]
        if (b) (baseQ[i] as Quaternion).copy(b.quaternion)
      }
      baseHas = true
      aimK = smooth(aimK, !sword && !fullBody ? 1 : 0, 16, dt)
      if (aimK > 1e-3 && spine && neck) {
        twist(spine, AIM_TWIST * aimK)
        twist(neck, -AIM_TWIST * aimK)
      }
      updateGun(dt, anim, actionT)
      const raised = (overT[AIM] ?? 0) > 0 || (overT[SHOOT] ?? 0) > 0
      aimUpper(dt, raised, aim?.target ?? null, !fullBody)
      root.updateMatrixWorld(true)
      solveCoat(dt, anim === 'death' ? 0 : speed)
      holo.opacity = anim === 'hack' || anim === 'hackCrouched' ? 0.75 + 0.2 * Math.sin(time * 37) * Math.sin(time * 11) : 0.4
      prevAnim = anim
    },
  }
}
