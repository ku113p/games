// Wardens (core/rules/wardens.ts): walking sentinel programs. Two models built by tools/warden/build.py:
// assets/models/warden.glb - EW1, the slender sentinel (a narrow helmet with one vertical visor slit, an energy halberd
// whose blade tip fires the bolts), and warden-heavy.glb - EW2, the enforcer for waves (a horizontal visor band, a hex
// energy shield on the left forearm, a short energy blade). A warden state's `heavy` picks the model; each slot builds the
// rig it needs on demand (two per frame at most).
//
// The look is EW3g, the particle swarm (view/swarm.ts, DESIGN 8): the skinned body is drawn as glowing dots by one shader
// (the armor shells, coat plates and seam lines of the build are dropped at load), a bright solid visor shows the facing,
// and ONE Points draw for all wardens carries the shed particles. `view.wardenLook: "holo"` is the fallback of the same
// shader (scanlines and glitch slices, a projector disc on the floor). The states: hit = the dots scatter and re-form,
// takedown = the swarm pours into a low glowing heap and re-forms on reboot, death = it dissolves into particles, spawn =
// it assembles from particles.
//
// Reading a warden without network vision: the visor and a short look beam show where it looks (the head turns on top
// of the clips, so the visor follows the cone), the lines go amber and a "?" floats over it while it checks something,
// a red "!" and a bark when it spots you; the strike and the shot are telegraphed (the blade charges, a thin beam from
// the blade tip for the shot). A rifle bolt stopped by the heavy's shield flashes the hex plane. In network vision: its
// view cone (through walls, cut where it cannot see) and its round on the floor.
//
// Animation: every clip is an AnimationAction whose time and weight are set here each frame (like view/hero.ts): the
// state from wardenAnim picks the targets, weights fade toward them; walking, searching and running share one phase
// that advances by the real speed over the blend's stride (measured on the clips by the build), so the feet keep pace
// with the floor; footsteps fire on the foot contacts. Hot path: no allocations after the model has loaded.
import {
  AdditiveBlending,
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  RingGeometry,
  DoubleSide,
  Group,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Quaternion,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import wardenUrl from '../assets/models/warden.glb'
import heavyUrl from '../assets/models/warden-heavy.glb'
import cfgAll from '../config.json'
import type { GameEvent } from '../core/events'
import { floorHeightAt } from '../core/grid'
import { gameTime, levelGrid, playerPos, wardenActionProgress, wardenAnim, wardenLookYaw, wardenRoutes, wardens, type WardenAnim } from '../core/queries'
import type { GameState, Sim } from '../core/state'
import type { Sound } from './audio'
import { createCone, type ViewCone } from './cone'
import { inView } from './cull'
import { palette } from './look'
import { fanSpread, NO_FAN, type Sight } from './sight'
import { createParticles, createSwarmMaterial, HOLO, swarmUniforms, type Particles } from './swarm'
import { wardenBark, wardenCharge, wardenPowerDown, wardenQuery, wardenServo, wardenStep, wardenSwing } from './warden-sound'

const W = cfgAll.warden
const LOOK = cfgAll.view.cones.lookBeam
const E = cfgAll.view.enemyLook
const N = cfgAll.view.netVision
const SW = cfgAll.view.swarm
const HEAR = cfgAll.audio.hearDist
const DEG = Math.PI / 180
const SPREAD = fanSpread(W.halfAngleDeg * DEG, W.pitchDeg * DEG)
/** Sight fan rows for wardens (view/sight.ts: cameras from 0, drones from DRONE_KEY = 8, up to MAX_FANS = 32). */
export const WARDEN_KEY = 24
const MAX_WARDENS = 10
/** The models are ~1.87 m; the sentinel is shown at ~2.1 m, the enforcer at ~2.2 m. */
const SCALE = 1.13
const SCALE_HEAVY = 1.19

// clips (names in the glb) - base layer, full body
const CLIPS = ['idle', 'post', 'walk', 'search_walk', 'run', 'scan', 'check', 'alert', 'strike', 'shoot', 'hit', 'death'] as const
const IDLE = 0
const POST = 1
const WALK = 2
const SEARCH = 3
const RUN = 4
const SCAN = 5
const CHECK = 6
const ALERT = 7
const STRIKE = 8
const SHOOT = 9
const HIT = 10
const DEATH = 11
// strides of the planted foot, m per cycle at the clip's own speed (printed by tools/warden/build.py), times the scale
const WALK_STRIDE = 1.362
const SEARCH_STRIDE = 1.36
const RUN_STRIDE = 5.77
const RUN_PHASE = 0.85 // the jog's foot contacts line up with the walks' this far into its loop
const RUN_FROM = 1.6 // m/s: the jog starts to blend in ...
const RUN_FULL = 4.2 // ... and would be full here (alert speed 3.3 is a fast stride, mostly jog)
const STRIKE_HIT = 0.5 // share of the slash clip where the blow lands (windup before, follow-through after)
const SHOT_FIRE = 0.45 // share of the two-handed aim clip where the halberd is level
const SHOT_TAIL = 0.6 // s of follow-through after a shot
/** A downed warden holds the death clip's early pose (a slump to its knees), this far into the clip, then pours down. */
const DOWN_POSE = 0.3
const FADE = 7
const FADE_FAST = 20
// brighter light lines (the halberd shaft) and visor
const LINES_CALM = 0.7 * E.wardenLines
// the lantern: a warm light from the visor that lights the floor and walls around it (it reads from far away)
const LANTERN = 2.2
const LANTERN_RANGE = 4.5
const VISOR_K = E.wardenVisor
const MARK_Y = 2.55
const ALERT_MARK_SEC = 2

/** Meshes of the build that the swarm look does not use: the armor shells and plates, the coat, the seam lines. */
const DROP = new Set(['Armor', 'ArmorLines', 'Coat', 'CoatLines', 'Collar', 'SuitLines', 'HalberdLights', 'ShieldPosts'])
/** Where the shed particles come from (a bone listed twice is picked twice as often: the head and torso shed most). */
const EMIT_BONES = ['Head', 'Head', 'spine_03', 'spine_03', 'spine_01', 'pelvis', 'upperarm_l', 'upperarm_r', 'hand_l', 'hand_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r']

const smooth = (cur: number, to: number, rate: number, dt: number): number => cur + (to - cur) * Math.min(1, dt * rate)
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

const ROUTE_VERT = /* glsl */ `
attribute float aS;
attribute float aSide;
attribute float aW;
varying float vS;
varying float vSide;
varying float vW;
void main() {
  vS = aS;
  vSide = aSide;
  vW = aW;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const ROUTE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uFade;
uniform float uOn[${MAX_WARDENS}];
varying float vS;
varying float vSide;
varying float vW;
void main() {
  int i = int(vW + 0.5);
  float on = 0.0;
  for (int k = 0; k < ${MAX_WARDENS}; k++) if (k == i) on = uOn[k];
  if (on <= 0.0) discard;
  // footprints: pairs of short dashes stepping along the round, a faint spine between
  float q = fract(vS / 0.7 - uTime * 0.5);
  float side = step(0.0, vSide) * step(q, 0.5) + step(vSide, 0.0) * step(0.5, q);
  float dash = side * smoothstep(0.0, 0.05, fract(q * 2.0)) * (1.0 - smoothstep(0.3, 0.38, fract(q * 2.0)));
  float spine = (1.0 - smoothstep(0.05, 0.15, abs(vSide))) * 0.3;
  float edge = 1.0 - smoothstep(0.8, 1.0, abs(vSide));
  gl_FragColor = vec4(uColor * (dash * step(0.25, abs(vSide)) + spine) * edge * uFade * on, 1.0);
}`

interface WardenView {
  /** Debug: seconds the warden has been alive with no drawn body (a console warning after 0.5 s), and whether it was reported. */
  noBodyT: number
  warned: boolean
  root: Group
  model: Object3D | null
  mixer: AnimationMixer | null
  actions: AnimationAction[]
  /** The rigs built so far: [sentinel, heavy]. The active one is mirrored in model / mixer / actions / head / neck / muzzle. */
  rigs: (Rig | null)[]
  cur: number
  scale: number
  blade: MeshBasicMaterial
  /** The swarm materials: the body (and helmet), the heavy's shield plane and its hex outline. */
  body: ShaderMaterial
  shieldFill: ShaderMaterial
  shieldLines: ShaderMaterial
  /** Holo fallback only: the projector disc on the floor. */
  disc: Mesh | null
  shieldT: number
  /** Swarm state timers: hit scatter and flash (1 -> 0), assemble (1 -> 0), the swirl's smoothed alert, last frame's dead flag. */
  scatterT: number
  flashT: number
  asmT: number
  swirlK: number
  wasDead: boolean
  /** True while this slot's particles are alive (so a far or idle warden costs nothing). */
  pLive: boolean
  spawnT: number
  weight: Float32Array
  target: Float32Array
  loopT: Float32Array
  head: Object3D | null
  neck: Object3D | null
  /** The halberd's tip / the blade's tip: where the shot telegraph starts. */
  muzzle: Object3D | null
  weapon: Object3D[]
  lines: MeshBasicMaterial
  visor: MeshBasicMaterial
  eyes: Group
  lantern: PointLight
  aura: SpriteMaterial
  cone: ViewCone
  look: ViewCone
  mark: Sprite
  markMat: SpriteMaterial
  beam: Mesh
  beamMat: MeshBasicMaterial
  phase: number
  deathT: number
  shotT: number
  alertT: number
  servoCd: number
  lastHead: number
  lastYaw: number
  prev: WardenAnim
}

interface Rig {
  model: Object3D
  mixer: AnimationMixer
  actions: AnimationAction[]
  head: Object3D | null
  neck: Object3D | null
  muzzle: Object3D | null
  /** Bones the shed particles are emitted from. */
  bones: Object3D[]
  /** The weapon's parts (they vanish when the swarm pours down or dissolves). */
  weapon: Object3D[]
}

export interface WardenViews {
  root: Group
  /** The core's events for the wardens (sounds, the "!" mark, shot timing). */
  event(e: GameEvent, s: GameState): void
  /** scanFade: how far network vision has faded in (0..1) - the cones and rounds show only in it. */
  update(s: GameState, sim: Sim, dt: number, scanFade: number): void
  /** Perf prewarm: builds both rigs (sentinel, heavy) of the first slot once their models are loaded, so the first warden of a
   * wave does not compile its shaders and upload its meshes mid-fight. True when done (or nothing to build). */
  warm(): boolean
}

/** A "?" or "!" drawn once into a small canvas. */
function markTexture(ch: string, color: Color): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  if (g) {
    const css = `rgb(${Math.round(Math.min(1, color.r / 3) * 255)}, ${Math.round(Math.min(1, color.g / 3) * 255)}, ${Math.round(Math.min(1, color.b / 3) * 255)})`
    g.font = 'bold 54px monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = css
    g.shadowBlur = 12
    g.fillStyle = css
    g.fillText(ch, 32, 34)
    g.shadowBlur = 0
    g.fillStyle = '#ffffff'
    g.globalAlpha = 0.55
    g.fillText(ch, 32, 34)
  }
  return new CanvasTexture(c)
}

// frame temporaries
const tmp = new Color()
const bodyC = new Color()
const tA = new Vector3()
const tB = new Vector3()
const qP = new Quaternion()
const qT = new Quaternion()
const UP = new Vector3(0, 1, 0)

/** Turns a bone about the world's up axis (on top of what the clips set). */
function twist(b: Object3D, angle: number): void {
  const p = b.parent
  if (!p || angle === 0) return
  p.getWorldQuaternion(qP)
  tA.set(0, 1, 0).applyQuaternion(qP.invert())
  qT.setFromAxisAngle(tA, angle)
  b.quaternion.premultiply(qT)
}

export function buildWardens(s: GameState, sim: Sim, sight: Sight, sound: Sound): WardenViews {
  const root = new Group()
  const list = wardens(s)
  const base = palette.security.clone().lerp(palette.sound, 0.3) // hostile red-orange
  const question = markTexture('?', palette.suspicious)
  const auraTex = ((): CanvasTexture => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d') as CanvasRenderingContext2D
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,0.8)')
    gr.addColorStop(0.45, 'rgba(255,255,255,0.25)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = gr
    x.fillRect(0, 0, 64, 64)
    return new CanvasTexture(c)
  })()
  const bang = markTexture('!', palette.security)
  const beamGeo = new CylinderGeometry(1, 1, 1, 6, 1, true)
  beamGeo.translate(0, 0.5, 0)
  const discGeo = new RingGeometry(0.45, 0.9, 40)
  // the shed particles of all wardens: one Points draw
  const particles: Particles = createParticles(MAX_WARDENS)
  particles.setViewHeight(Math.round(innerHeight * Math.min(devicePixelRatio || 1, cfgAll.view.pixelRatioMax)))
  root.add(particles.points)

  const views: WardenView[] = list.slice(0, MAX_WARDENS).map((w): WardenView => {
    const g = new Group()
    const eyes = new Group()
    eyes.position.y = W.eyeHeight
    const cone = createCone(W.range, W.halfAngleDeg * DEG, sight.texture)
    cone.mesh.rotation.x = W.pitchDeg * DEG
    const look = createCone(LOOK.length, LOOK.halfAngleDeg * DEG, sight.texture, { scanOnly: false, nearFade: LOOK.nearFade })
    look.mesh.rotation.x = W.pitchDeg * DEG
    look.mesh.position.z = 0.16
    look.mesh.userData['noReflect'] = true
    const lantern = new PointLight(0xff5a1e, LANTERN, LANTERN_RANGE, 1.8)
    lantern.position.set(0, 0.05, 0.35)
    eyes.add(cone.mesh, look.mesh, lantern)
    const markMat = new SpriteMaterial({ map: question, transparent: true, depthWrite: false, toneMapped: false })
    const mark = new Sprite(markMat)
    mark.scale.setScalar(0.5)
    mark.position.y = MARK_Y
    mark.visible = false
    mark.renderOrder = 20
    mark.userData['noReflect'] = true
    const beamMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
    const beam = new Mesh(beamGeo, beamMat)
    beam.visible = false
    beam.frustumCulled = false
    beam.userData['noReflect'] = true
    beam.renderOrder = 8
    // a soft glow around the body: the silhouette reads at range even where the thin lines alias away
    const aura = new SpriteMaterial({ map: auraTex, color: base.clone(), transparent: true, opacity: E.wardenAuraOpacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
    const auraSprite = new Sprite(aura)
    auraSprite.scale.set(E.wardenAuraW, E.wardenAuraH, 1)
    auraSprite.position.y = 1.15
    auraSprite.userData['noReflect'] = true
    g.add(eyes, mark, auraSprite)
    root.add(g, beam) // the beam lives in world space
    g.position.set(w.pos.x, w.pos.y, w.pos.z)
    g.rotation.y = w.yaw
    const blade = new MeshBasicMaterial({ color: base.clone(), toneMapped: false, side: DoubleSide })
    const body = createSwarmMaterial({ cell: SW.cell, cover: SW.cover, dens: SW.dens[0] as number, limb: SW.dens[1] as number })
    const shieldFill = createSwarmMaterial({ cell: SW.shieldCell, cover: SW.shieldCover, dens: 0.9, limb: 0.9 })
    const shieldLines = createSwarmMaterial({ cell: SW.shieldCell, cover: 0.55, dens: 1, limb: 1 })
    let disc: Mesh | null = null
    if (HOLO) {
      disc = new Mesh(discGeo, new MeshBasicMaterial({ color: base.clone(), toneMapped: false, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
      disc.rotation.x = -Math.PI / 2
      disc.position.y = 0.04
      disc.userData['noReflect'] = true
      g.add(disc)
    }
    return {
      root: g,
      noBodyT: 0,
      warned: false,
      model: null,
      mixer: null,
      actions: [],
      rigs: [null, null],
      cur: -1,
      scale: SCALE,
      blade,
      body,
      shieldFill,
      shieldLines,
      disc,
      shieldT: 0,
      scatterT: 0,
      flashT: 0,
      asmT: 0,
      swirlK: 0,
      wasDead: false,
      pLive: false,
      spawnT: 0,
      weight: new Float32Array(CLIPS.length),
      target: new Float32Array(CLIPS.length),
      loopT: new Float32Array(CLIPS.length),
      head: null,
      neck: null,
      muzzle: null,
      weapon: [],
      lines: new MeshBasicMaterial({ color: base.clone(), toneMapped: false, side: DoubleSide }),
      visor: new MeshBasicMaterial({ color: base.clone(), toneMapped: false, side: DoubleSide }),
      eyes,
      lantern,
      aura,
      cone,
      look,
      mark,
      markMat,
      beam,
      beamMat,
      phase: 0,
      deathT: 0,
      shotT: 99,
      alertT: 0,
      servoCd: 0,
      lastHead: 0,
      lastYaw: w.yaw,
      prev: 'idle',
    }
  })

  // the rounds in network vision: one ribbon geometry for all wardens
  const routes = wardenRoutes(sim)
  const grid = levelGrid(sim)
  const pos: number[] = []
  const aS: number[] = []
  const aSide: number[] = []
  const aW: number[] = []
  const idx: number[] = []
  const half = N.routeWidth / 2
  for (let k = 0; k < routes.length && k < MAX_WARDENS; k++) {
    const r = routes[k]
    if (!r || r.length < 2) continue
    let arc = 0
    for (let m = 0; m + 1 < r.length; m++) {
      const a = r[m] as { x: number; z: number }
      const b = r[m + 1] as { x: number; z: number }
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      if (len < 0.05) continue
      const tx = (b.x - a.x) / len
      const tz = (b.z - a.z) / len
      const steps = Math.max(1, Math.ceil(len / 0.5))
      for (let st = 0; st < steps; st++) {
        const b0 = pos.length / 3
        for (const t of [st / steps, (st + 1) / steps]) {
          const x = a.x + (b.x - a.x) * t
          const z = a.z + (b.z - a.z) * t
          const y = floorHeightAt(grid, x, z) + 0.05
          for (const side of [-1, 1]) {
            pos.push(x - tz * half * side, y, z + tx * half * side)
            aS.push(arc + len * t)
            aSide.push(side)
            aW.push(k)
          }
        }
        idx.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3)
      }
      arc += len
    }
  }
  const routeOn: number[] = []
  for (let k = 0; k < MAX_WARDENS; k++) routeOn.push(0)
  const routeMat = new ShaderMaterial({
    uniforms: { uColor: { value: base.clone().multiplyScalar(N.routeStrength) }, uTime: { value: 0 }, uFade: { value: 0 }, uOn: { value: routeOn } },
    vertexShader: ROUTE_VERT,
    fragmentShader: ROUTE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  const routeGeo = new BufferGeometry()
  routeGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  routeGeo.setAttribute('aS', new BufferAttribute(new Float32Array(aS), 1))
  routeGeo.setAttribute('aSide', new BufferAttribute(new Float32Array(aSide), 1))
  routeGeo.setAttribute('aW', new BufferAttribute(new Float32Array(aW), 1))
  routeGeo.setIndex(idx)
  const routeMesh = new Mesh(routeGeo, routeMat)
  routeMesh.visible = false
  routeMesh.renderOrder = 6
  routeMesh.userData['noReflect'] = true
  root.add(routeMesh)

  // the models: loaded once, cloned per warden slot on demand
  const gltfs: (GLTF | null)[] = [null, null]
  const clipSets: Map<string, AnimationClip>[] = [new Map(), new Map()]
  ;[wardenUrl, heavyUrl].forEach((url, k) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        for (const c of gltf.animations) {
          c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale') && (!t.name.endsWith('.position') || t.name.startsWith('pelvis')))
          clipSets[k]?.set(c.name, c)
        }
        gltfs[k] = gltf
      },
      undefined,
      (err) => {
        console.error(`${url} failed to load`, err)
      },
    )
  })

  /** Builds the rig of one variant for one warden slot. */
  function buildRig(v: WardenView, k: number): Rig | null {
    const gltf = gltfs[k]
    const clips = clipSets[k]
    if (!gltf || !clips) return null
    const model = cloneSkinned(gltf.scene)
    // the build's armor look is dropped here: the suit body and the helmet become the swarm, the weapons become light shapes
    const drop: Object3D[] = []
    const weapon: Object3D[] = []
    model.traverse((o) => {
      o.layers.mask = v.root.layers.mask // the game view marks the root for the floor reflection before we load
      const m = o as Mesh
      if (!m.isMesh) return
      m.frustumCulled = false
      if (DROP.has(m.name)) {
        drop.push(m)
        return
      }
      switch (m.name) {
        case 'Body':
        case 'Helmet':
          m.material = v.body
          break
        case 'ShieldFill':
          m.material = v.shieldFill
          m.renderOrder = 7
          break
        case 'ShieldLines':
          m.material = v.shieldLines
          m.renderOrder = 7
          break
        case 'HalberdBlade':
        case 'BladeEnergy':
          m.material = v.blade
          weapon.push(m)
          break
        case 'Visor':
          m.material = v.visor
          break
        default:
          m.material = v.lines // the halberd's shaft and spine, the blade hilt: thin rods of light
          weapon.push(m)
      }
    })
    for (const o of drop) o.removeFromParent()
    model.scale.setScalar(k === 1 ? SCALE_HEAVY : SCALE)
    model.visible = false
    v.root.add(model)
    const mx = new AnimationMixer(model)
    const actions: AnimationAction[] = []
    for (const name of CLIPS) {
      const clip = clips.get(name)
      if (!clip) throw new Error(`warden model ${k}: no clip ${name}`)
      const a = mx.clipAction(clip)
      a.setLoop(LoopRepeat, Infinity)
      a.timeScale = 0 // times are set by hand every frame
      a.setEffectiveWeight(0)
      a.play()
      actions.push(a)
    }
    const bones: Object3D[] = []
    for (const n of EMIT_BONES) {
      const b = model.getObjectByName(n)
      if (b) bones.push(b)
    }
    return { model, mixer: mx, actions, head: model.getObjectByName('Head') ?? null, neck: model.getObjectByName('neck_01') ?? null, muzzle: model.getObjectByName('Muzzle') ?? null, bones, weapon }
  }

  let built = 0 // rigs built this frame; update() resets it (it once never reset: the third rig ever never got built, so most wardens had no body)
  /** Makes the rig for the variant the warden state wants the active one (at most two builds per frame). */
  function ensureRig(v: WardenView, heavy: boolean): void {
    const k = heavy ? 1 : 0
    if (v.cur === k) return
    let rig = v.rigs[k] ?? null
    if (!rig) {
      if (built >= 2) return
      rig = buildRig(v, k)
      if (!rig) return
      built++
      v.rigs[k] = rig
    }
    const old = v.rigs[1 - k]
    if (old) old.model.visible = false
    rig.model.visible = true
    v.cur = k
    v.scale = k === 1 ? SCALE_HEAVY : SCALE
    v.model = rig.model
    v.mixer = rig.mixer
    v.actions = rig.actions
    v.head = rig.head
    v.neck = rig.neck
    v.muzzle = rig.muzzle
    v.weapon = rig.weapon
    const pi = views.indexOf(v)
    if (pi >= 0) (particles.state[pi] as { bones: Object3D[] }).bones = rig.bones
    const u = swarmUniforms(v.body)
    u.uCell.value = k === 1 ? SW.heavyCell : SW.cell
    u.uCover.value = k === 1 ? SW.heavyCover : SW.cover
    u.uInflate.value = k === 1 ? SW.heavyInflate : 0
    v.weight[IDLE] = 1
  }

  function volumeAt(x: number, z: number, st: GameState): number {
    const p = playerPos(st)
    return Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / HEAR)
  }

  function targets(v: WardenView, anim: WardenAnim, act: string, speed: number): void {
    const t = v.target
    t.fill(0)
    switch (anim) {
      case 'death':
        t[DEATH] = 1
        return
      case 'hit':
        t[HIT] = 1
        return
      case 'strike':
      case 'recover':
        t[STRIKE] = 1
        return
      case 'aim':
        t[SHOOT] = 1
        return
      case 'scan':
        t[SCAN] = 1
        return
      case 'check':
        t[CHECK] = 1
        return
      case 'suspicious':
        t[ALERT] = 0.45
        t[IDLE] = 0.55
        return
      case 'alert':
        if (v.shotT < SHOT_TAIL) t[SHOOT] = 1
        else t[ALERT] = 1
        return
      case 'paused':
        t[IDLE] = 1
        return
      case 'down':
        t[DEATH] = 1
        return
      case 'idle':
        t[act === 'stand' ? POST : IDLE] = 1
        return
      default: {
        // walk / search / run: one phase-synced blend
        const walkClip = anim === 'walk' ? WALK : SEARCH
        const k = anim === 'run' ? clamp01((speed - RUN_FROM) / (RUN_FULL - RUN_FROM)) : 0
        const still = 1 - clamp01(speed / 0.5)
        t[walkClip] = (1 - k) * (1 - still)
        t[RUN] = k * (1 - still)
        t[anim === 'run' ? ALERT : IDLE] = still
      }
    }
  }

  return {
    root,
    warm(): boolean {
      const v = views[0]
      if (!v) return true
      for (const k of [0, 1]) {
        if (v.rigs[k]) continue
        if (!gltfs[k]) return false
        const rig = buildRig(v, k)
        if (rig) v.rigs[k] = rig // hidden until ensureRig picks it; the prewarm render shows it once
      }
      return true
    },
    event(e, st): void {
      if (!('index' in e) || typeof e.index !== 'number') return
      const w = wardens(st)[e.index]
      const v = views[e.index]
      if (!w || !v) return
      const vol = volumeAt(w.pos.x, w.pos.z, st)
      switch (e.type) {
        case 'wardenSuspicious':
          wardenQuery(sound, 0.55 * Math.max(0.3, vol), w.pos.x, w.pos.z)
          break
        case 'wardenAlerted':
          wardenBark(sound, 0.9 * Math.max(0.4, vol), w.pos.x, w.pos.z)
          v.alertT = ALERT_MARK_SEC
          break
        case 'wardenStrike':
          wardenCharge(sound, 0.6 * vol, W.strikeWindupSec, w.pos.x, w.pos.z)
          break
        case 'wardenStruck':
          wardenSwing(sound, 0.8 * vol, w.pos.x, w.pos.z)
          break
        case 'wardenAiming':
          sound.play('suspicion_rise', 0.7 * vol, 0.55)
          break
        case 'wardenFired':
          sound.play('drone_shot', 0.8 * vol, 0.75)
          v.shotT = 0
          break
        case 'targetHit':
          // the swarm scatters and re-forms with a flash; a burst of particles flies off the hit
          if (e.target !== 'warden') break
          v.scatterT = 1
          v.flashT = 1
          particles.burst(e.index, e.killed ? 0 : SW.burstHit, e.x, e.y, e.z, 2.4, 0.7)
          break
        case 'wardenSpawned':
          // it walks out of a spawn gate: it assembles from particles, its lights flare and fade, a glitch sting
          v.spawnT = 1
          v.asmT = 1
          particles.scatterAround(e.index, w.pos.x, w.pos.y, w.pos.z, 1.8)
          sound.playAt('glitch', w.pos.x, w.pos.z, 0.5 * Math.max(0.4, vol))
          break
        case 'shieldBlocked':
          // a rifle bolt stopped by the heavy's shield: the hex plane flares, a deflect ping
          v.shieldT = 1
          sound.playAt('bullet_impact', w.pos.x, w.pos.z, 0.7 * Math.max(0.5, vol), 1.7)
          break
        case 'wardenDowned':
          // powering down: the swarm loses cohesion and pours into a heap; a falling glitch, no bark, no alarm
          wardenPowerDown(sound, 0.6 * Math.max(0.3, vol), w.pos.x, w.pos.z)
          break
        case 'wardenRebooted':
          sound.playAt('glitch', w.pos.x, w.pos.z, 0.35 * Math.max(0.3, vol))
          break
        case 'wardenGaveUp':
          wardenServo(sound, 0.3 * vol, 0.3, w.pos.x, w.pos.z)
          break
        default:
          break
      }
    },
    update(st, sm, dt, scanFade): void {
      const time = gameTime(st)
      const ws = wardens(st)
      const p = playerPos(st)
      built = 0
      let anyP = false
      for (let i = 0; i < views.length; i++) {
        const v = views[i] as WardenView
        const w = ws[i]
        if (!w) continue
        const anim = wardenAnim(st, i)
        const prog = wardenActionProgress(st, sm, i)
        const lookYaw = wardenLookYaw(st, i)
        v.root.position.set(w.pos.x, w.pos.y, w.pos.z)
        v.root.rotation.y = w.yaw
        v.shotT += dt
        v.alertT = Math.max(0, v.alertT - dt)
        const dead = !w.alive
        if (w.alive || w.pos.y > -500) ensureRig(v, w.heavy)
        // a dead warden's body dissolves into particles and is then hidden; a respawned one shows again
        if (v.model) v.model.visible = !dead || v.deathT < SW.dissolveSec + 0.1
        v.spawnT = Math.max(0, v.spawnT - dt * 1.2)
        v.shieldT = Math.max(0, v.shieldT - dt * 3)
        // no body yet (the model is still loading, or the build budget of this frame is spent): none of its lights show either
        // (the lantern light stays on the scene while the body is only hidden after its dissolve: a changing light count recompiles every lit program)
        const body = v.model !== null
        v.eyes.visible = body
        v.aura.visible = body
        if (body) v.noBodyT = 0
        else if (!dead) {
          v.noBodyT += dt
          if (v.noBodyT > 0.5 && !v.warned) {
            v.warned = true
            console.warn(`warden ${i}: alive for ${v.noBodyT.toFixed(1)} s without a drawn body (models loaded: ${gltfs.map((g) => !!g).join('/')})`)
          }
        }
        const down = anim === 'down'
        const paused = anim === 'paused'
        // a downed warden: the lights go out as it powers down and flicker back on as it reboots
        const lights = down ? (1 - prog) * (w.down < W.takedown.rebootSec && Math.sin(time * 50) < 0 ? 0.25 : 1) : 1
        const alert = w.mode === 'alert' && !dead
        const checking = !dead && !paused && !down && (w.mode === 'suspicious' || w.mode === 'investigate')

        // colors: calm red-orange, amber while it checks something, bright pulsing red in a fight, blue when paused
        const reboot = down && w.down < W.takedown.rebootSec
        if (dead) tmp.setRGB(0, 0, 0)
        else if (paused) tmp.copy(palette.paused).multiplyScalar(0.5)
        else if (alert) tmp.copy(palette.security).multiplyScalar(0.85 + 0.35 * Math.sin(time * 10))
        else if (checking) tmp.copy(base).lerp(palette.suspicious, 0.6).multiplyScalar(0.75 + 0.2 * Math.sin(time * 6))
        else tmp.copy(base).multiplyScalar(LINES_CALM + Math.min(0.4, w.suspicion))
        // the swarm keeps glowing dimly in its heap; the eye and the lights go out
        const bodyK = down ? (0.3 + 0.7 * (1 - prog)) * (reboot && Math.sin(time * 50) < 0 ? 0.5 : 1) : 1
        if (dead) bodyC.copy(base).multiplyScalar(SW.gain * 1.6 * (1 - clamp01(v.deathT / SW.dissolveSec) * 0.5))
        else bodyC.copy(tmp).multiplyScalar(bodyK * SW.gain)
        tmp.multiplyScalar(lights)
        v.lines.color.copy(tmp)
        const charge = anim === 'strike' || anim === 'aim' ? prog : 0
        const flare = 1 + v.spawnT * 3 * (0.6 + 0.4 * Math.sin(time * 40))
        v.lines.color.multiplyScalar(flare)
        v.visor.color.copy(tmp).multiplyScalar(dead ? 0 : VISOR_K * (1 + charge * 1.5) * flare)
        // the blade: dim in a calm round, flares when it charges (the strike windup, the shot's aim) and at the shot
        v.blade.color.copy(tmp).multiplyScalar(dead ? 0 : (1 - (down ? prog : 0)) * E.wardenBlade * (0.9 + charge * 2.2 + (v.shotT < 0.15 ? 3 : 0)) * flare)
        // the swarm: uniforms of the body and the heavy's shield (the hex of dots flares when it stops a bolt)
        v.scatterT = Math.max(0, v.scatterT - dt / SW.scatterSec)
        v.flashT = Math.max(0, v.flashT - dt / SW.flashSec)
        v.asmT = Math.max(0, v.asmT - dt / SW.assembleSec)
        v.swirlK = smooth(v.swirlK, alert ? 1 : 0, 4, dt)
        const dissolve = dead ? clamp01(v.deathT / SW.dissolveSec) : v.asmT
        const scatter = Math.max(SW.scatterAmount * Math.sin(Math.PI * Math.pow(1 - v.scatterT, 0.45)) * (v.scatterT > 0 ? 1 : 0), dissolve * 0.9)
        const pourK = down ? prog : 0
        const armed = !dead && pourK < 0.6
        for (const o of v.weapon) o.visible = armed
        for (const mat of [v.body, v.shieldFill, v.shieldLines]) {
          const u = swarmUniforms(mat)
          u.uTime.value = time
          u.uDissolve.value = dissolve
          u.uScatter.value = scatter
          u.uFlash.value = v.flashT
          u.uAlert.value = alert ? 1 : 0
          u.uPour.value = pourK
        }
        swarmUniforms(v.body).uColor.value.copy(bodyC)
        swarmUniforms(v.shieldFill).uColor.value.copy(bodyC).multiplyScalar((SW.shieldGain / SW.gain) * (1 + v.shieldT * 3))
        swarmUniforms(v.shieldFill).uCover.value = SW.shieldCover + v.shieldT * 0.35
        swarmUniforms(v.shieldLines).uColor.value.copy(bodyC).multiplyScalar((SW.shieldLineGain / SW.gain) * (1 + v.shieldT * 2))
        if (v.disc) {
          v.disc.visible = body && !dead && !down
          ;(v.disc.material as MeshBasicMaterial).color.copy(bodyC).multiplyScalar(0.5)
        }
        const m = Math.max(tmp.r, tmp.g, tmp.b, 1e-3)
        v.aura.color.copy(tmp).multiplyScalar(dead ? 0 : 1 - 0.7 * pourK)
        v.lantern.color.setRGB(tmp.r / m, tmp.g / m, tmp.b / m)
        v.lantern.intensity = dead ? 0 : lights * LANTERN * (paused ? 0.4 : alert ? 1.4 : 1) * (1 + charge)

        // the look: a short beam always, the full cone only in network vision
        v.eyes.rotation.y = w.head
        v.look.mesh.visible = !dead && !down
        if (!dead && !down) v.look.set(tmp, (paused ? LOOK.pausedStrength : LOOK.strength) * (alert ? 1.6 : 1), time, NO_FAN)
        v.cone.mesh.visible = !dead && !paused && !down && scanFade > 0 && inView(w.pos.x, w.pos.y, w.pos.z, W.range)
        if (v.cone.mesh.visible) {
          const fan = sight.fan(WARDEN_KEY + i, w.pos.x, w.pos.y + W.eyeHeight, w.pos.z, lookYaw, SPREAD, W.range)
          v.cone.set(tmp, alert ? 1.6 : 0.8 + w.suspicion, time, fan)
        }

        // the mark over its head
        const showBang = v.alertT > 0
        v.mark.visible = body && !dead && (showBang || checking)
        if (v.mark.visible) {
          v.markMat.map = showBang ? bang : question
          v.markMat.opacity = showBang ? 1 : 0.75 + 0.25 * Math.sin(time * 5)
          v.mark.position.y = MARK_Y + Math.sin(time * 3) * 0.05
        }

        // the shot's telegraph: a thin beam from the blade tip to the hero, narrowing as the aim completes
        v.beam.visible = body && anim === 'aim' && v.muzzle !== null
        if (v.beam.visible && v.muzzle) {
          v.muzzle.getWorldPosition(tA)
          tB.set(p.x - tA.x, p.y + cfgAll.player.chestHeight - tA.y, p.z - tA.z)
          const len = tB.length()
          if (len > 0.1) {
            v.beam.position.copy(tA)
            v.beam.quaternion.setFromUnitVectors(UP, tB.multiplyScalar(1 / len))
            const r = 0.04 - 0.03 * prog
            v.beam.scale.set(r, len, r)
            v.beamMat.color.copy(palette.security).multiplyScalar(0.3 + prog * 1.2 + (prog > 0.8 ? Math.sin(time * 50) * 0.4 : 0))
          } else v.beam.visible = false
        }

        // sounds: the servos when it turns
        v.servoCd -= dt
        const turn = Math.abs(w.head - v.lastHead) + Math.abs(Math.atan2(Math.sin(w.yaw - v.lastYaw), Math.cos(w.yaw - v.lastYaw)))
        if (!dead && !paused && !down && dt > 0 && turn / dt > 0.6 && w.speed < 0.3 && v.servoCd <= 0) {
          wardenServo(sound, 0.22 * volumeAt(w.pos.x, w.pos.z, st), 0.35, w.pos.x, w.pos.z)
          v.servoCd = 0.9
        }
        v.lastHead = w.head
        v.lastYaw = w.yaw

        // the shed particles (one Points draw for all wardens)
        const ps = particles.state[i]
        if (ps) {
          const near = (w.pos.x - p.x) * (w.pos.x - p.x) + (w.pos.z - p.z) * (w.pos.z - p.z) < SW.cullDist * SW.cullDist
          if (dead && !v.wasDead && near) particles.burst(i, SW.burstDeath, w.pos.x, w.pos.y + 1, w.pos.z, 2.6, 1.3)
          ps.active = body && !dead && near && !paused
          ps.x = w.pos.x
          ps.y = w.pos.y
          ps.z = w.pos.z
          ps.speed = w.speed
          ps.alert = v.swirlK
          ps.pour = down && !reboot ? prog : 0
          ps.gather = reboot ? 1 : v.asmT
          ps.r = bodyC.r
          ps.g = bodyC.g
          ps.b = bodyC.b
          if (ps.active || v.pLive) v.pLive = particles.step(i, dt, time)
          anyP = anyP || v.pLive
        }
        v.wasDead = dead

        // animation
        const mx = v.mixer
        if (!mx) continue
        targets(v, anim, w.act, w.speed)
        let sum = 0
        for (let k = 0; k < CLIPS.length; k++) {
          const t = v.target[k] ?? 0
          const fast = k === STRIKE || k === HIT || k === DEATH || k === SHOOT
          const wt = smooth(v.weight[k] ?? 0, t, fast && t > 0 ? FADE_FAST : FADE, dt)
          v.weight[k] = wt
          sum += wt
        }
        if (sum < 1e-4) {
          v.weight[IDLE] = 1
          sum = 1
        }
        // the shared walk phase: advance by the real speed over the stride of the current mix; steps on the contacts
        const ww = (v.weight[WALK] ?? 0) + (v.weight[SEARCH] ?? 0)
        const wr = v.weight[RUN] ?? 0
        const walkStride = ((v.weight[WALK] ?? 0) >= (v.weight[SEARCH] ?? 0) ? WALK_STRIDE : SEARCH_STRIDE) * v.scale
        const stride = ww + wr > 1e-4 ? walkStride + (RUN_STRIDE * v.scale - walkStride) * (wr / (ww + wr)) : walkStride
        const before = v.phase
        if (w.speed > 0.05) v.phase = (v.phase + (dt * w.speed) / stride) % 1
        if (w.speed > 0.2 && !dead && ((before < 0.5 && v.phase >= 0.5) || v.phase < before)) wardenStep(sound, 0.5 * volumeAt(w.pos.x, w.pos.z, st), w.speed > 2.2, w.pos.x, w.pos.z)
        if (anim === 'death') v.deathT += dt
        else v.deathT = 0
        for (let k = 0; k < CLIPS.length; k++) {
          const a = v.actions[k]
          if (!a) continue
          const dur = a.getClip().duration
          let t: number
          switch (k) {
            case WALK:
            case SEARCH:
              t = v.phase * dur
              break
            case RUN:
              t = ((v.phase + RUN_PHASE) % 1) * dur
              break
            case STRIKE:
              t = (anim === 'recover' ? STRIKE_HIT + (1 - STRIKE_HIT) * prog : anim === 'strike' ? STRIKE_HIT * prog : 1) * dur * 0.999
              break
            case SHOOT:
              t = (anim === 'aim' ? SHOT_FIRE * prog : Math.min(1, SHOT_FIRE + (1 - SHOT_FIRE) * (v.shotT / SHOT_TAIL))) * dur * 0.999
              break
            case HIT:
              t = 0.95 * prog * dur
              break
            case DEATH:
              t = anim === 'down' ? DOWN_POSE * prog * dur : Math.min(v.deathT, dur * 0.999)
              break
            default:
              t = paused ? (v.loopT[k] ?? 0) : ((v.loopT[k] ?? 0) + dt) % dur
              v.loopT[k] = t
          }
          a.time = t
          a.setEffectiveWeight((v.weight[k] ?? 0) / sum)
        }
        mx.update(dt)
        // the head looks where the core says (the cone follows it): most of it in the head, some in the neck
        if (!dead && !down && v.head && v.neck) {
          twist(v.neck, w.head * 0.35)
          twist(v.head, w.head * 0.65)
        }
        v.prev = anim
      }

      particles.commit(anyP)

      // the rounds in network vision
      routeMesh.visible = scanFade > 0
      if (routeMesh.visible) {
        for (let k = 0; k < MAX_WARDENS; k++) {
          const w = ws[k]
          routeOn[k] = w && w.alive ? (w.mode === 'patrol' ? 1 : 0.35) : 0
        }
        ;(routeMat.uniforms['uFade'] as { value: number }).value = scanFade
        ;(routeMat.uniforms['uTime'] as { value: number }).value = time
      }
    },
  }
}
