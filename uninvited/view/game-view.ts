// The game view: builds the scene for a level and, every frame, reads the state through queries and reacts to the
// core's events with animation, sound, shake, hit-stop, sparks, glitches and HUD messages (rule 2).
import { AdditiveBlending, Color, DoubleSide, PointLight, Vector3, type Material, type Mesh, type Object3D } from 'three'
import cfgAll from '../config.json'
import type { GameEvent } from '../core/events'
import {
  abilitySlot,
  alarmDecayFraction,
  pauseLengthSec,
  alarmStage,
  charges,
  dashReady,
  heroActionProgress,
  heroAnim,
  heroLineColor,
  hpFraction,
  interactPrompt,
  isCrouched,
  isInCover,
  isGrounded,
  isHiddenInNiche,
  isRunning,
  levelGrid,
  landmarks,
  voidFade,
  maxSuspicion,
  suspicionSources,
  type SuspicionSource,
  motionSensors,
  noiseRadius,
  playerFacing,
  playerPos,
  pickTarget,
  playerSpeed,
  redWalls,
  scanActive,
  scanCooldown,
  scanHeat,
  scanWarnAt,
  scanWarning,
  securityStatus,
  swordCombo,
  soundCameras,
  terminals,
  videoCameras,
  drones,
  wardenLookYaw,
  wardens,
  waveCountdown,
  waveInfo,
  weaponMode,
  isAiming,
  spawnGates,
  worms,
  type Rgb,
} from '../core/queries'
import { floorHeightAt } from '../core/grid'
import type { GameState, Sim } from '../core/state'
import { Sound } from './audio'
import { Cues, type CueState } from './cues'
import { Music } from './music'
import type { SettingsHandle } from './settings'
import { createPrompter, PROMPT_IDS, type CardId, type Tips } from './tips'
import { createCameraRig, type CameraRig, type RayFn } from './camera'
import { buildCity, MAX_CONES, type City } from './city'
import { buildCityLife, type CityLife } from './city-life'
import { buildSkyline, type Skyline } from './skyline'
import { buildDrones, type DroneViews } from './drones'
import { buildWorms, type WormViews } from './worms'
import { createFx, type Fx } from './fx'
import { createHero, setHeroHidden, type HeroAim, type HeroView } from './hero'
import { setConesFade } from './cone'
import { createPerfOverlay } from './perf'
import { createAbilityHud, type AbilityHudState } from './abilities'
import { createMay, type MayView } from './may'
import { createUnseen, type Watcher } from './unseen'
import type { QueueStore } from './may-queue'
import { createHud, MAX_MARKS, t, type CardSpec, type Hud, type HudMark, type HudState, type PromptSpec } from './hud'
import { createMaterials, palette } from './look'
import { buildProps, type Props } from './props'
import { REFLECT_LAYER } from './reflect'
import { createRenderer, type Renderer } from './renderer'
import { buildWardens, WARDEN_KEY, type WardenViews } from './wardens'
import { createExposure, lanesEnabled, type Exposure } from './exposure'
import { inView, setCullView } from './cull'
import { createSight, DRONE_KEY, fanSpread, type Sight } from './sight'
import { createPickups } from './pickups'
import { createSpawnGates } from './spawn-gates'

const V = cfgAll.view
const J = V.juice
const T = J.trauma
const A = cfgAll.audio
const H = cfgAll.audio.hits
const M = cfgAll.audio.mixer

/** The nearest few sources of a loop (its voices): filled by pickNearest, read right after. */
const picked: unknown[] = []
const pickedK: number[] = []
const pickedD: number[] = []

interface Emitter {
  pos: { x: number; z: number }
  alive: boolean
  active?: boolean
  pausedTime?: number
}

/** The M.loopVoices nearest live emitters within `radius` of (px, pz) with their 0..1 loudness; returns how many. No allocations. */
function pickNearest(list: readonly Emitter[], px: number, pz: number, radius: number, needActive: boolean): number {
  let n = 0
  for (const e of list) {
    if (!e.alive || (needActive && !e.active) || (e.pausedTime ?? 0) > 0) continue
    const d = Math.hypot(e.pos.x - px, e.pos.z - pz)
    if (d >= radius) continue
    // insertion into the sorted slots
    let i = n < M.loopVoices ? n : M.loopVoices
    while (i > 0 && (pickedD[i - 1] as number) > d) {
      if (i < M.loopVoices) {
        picked[i] = picked[i - 1]
        pickedD[i] = pickedD[i - 1] as number
        pickedK[i] = pickedK[i - 1] as number
      }
      i--
    }
    if (i < M.loopVoices) {
      picked[i] = e
      pickedD[i] = d
      pickedK[i] = 1 - d / radius
      if (n < M.loopVoices) n++
    }
  }
  return n
}

/**
 * Custom prompts and cards from outside the built-in tips (for example May's lines, DESIGN 10). They go through the same
 * machinery: one prompt at a time, never in a menu, a hack or a card; a card pauses the game like a tutorial card.
 * `speaker: 'may'` adds her name label and accent. The setting "Tutorial tips: off" does not silence them (they are story).
 */
export interface Guide {
  /** Shown (in turn with the other prompts) until `until()` returns true; at most 2 shows, like every prompt. */
  prompt(spec: PromptSpec & { until: () => boolean }): void
  /** Queued: the game pauses on it at the next calm moment (main.ts takes it, never during a hack or at the end screens). */
  card(spec: CardSpec): void
  /** For main.ts: the next queued custom card. */
  takeCard(): CardSpec | null
}

export interface GameView {
  readonly hud: Hud
  /** Custom prompts and cards (May). */
  readonly guide: Guide
  /** May: subtitles, voice, wrist glyph, the meeting (view/may.ts). */
  readonly may: MayView
  readonly sound: Sound
  /** The adaptive music; main.ts sets its flags (menu / paused / hack) and plays its stingers. */
  readonly music: Music
  readonly rig: CameraRig
  readonly renderer: Renderer
  /** The stealth lighting's exposure map (debug and screenshots: the texture, the build cost). */
  readonly exposure: Exposure
  /** Seconds the simulation should stay frozen (hit-stop). main.ts reads and counts it down. */
  hitStop: number
  handle(events: readonly GameEvent[], s: GameState, sim: Sim): void
  /** dt is 0 while paused; rawDt (real seconds) keeps the music's clocks running. */
  update(dt: number, s: GameState, sim: Sim, rawDt?: number): void
  /** After a load or restart: snap the camera, clear effects. */
  reset(s: GameState, sim: Sim): void
  /** Yaw and pitch from the hero's muzzle to whatever the crosshair points at. */
  aim(s: GameState, out: { yaw: number; pitch: number }): void
}

const heroColor = new Color()
let hiddenK = 0
const rgb: Rgb = { r: 1, g: 1, b: 1 }
const WHITE_SCALE = 2.5
const red: Rgb = { r: palette.heroRed.r / WHITE_SCALE, g: palette.heroRed.g / WHITE_SCALE, b: palette.heroRed.b / WHITE_SCALE }
const blue: Rgb = { r: palette.heroBlue.r / WHITE_SCALE, g: palette.heroBlue.g / WHITE_SCALE, b: palette.heroBlue.b / WHITE_SCALE }
const aimPt = new Vector3()
const heroAim: HeroAim = { on: false, target: null }
let aimFresh = false // aim() has run at least once, so aimPt is a real point
const muzzlePt = new Vector3()
const hiltPt = new Vector3()
const tipPt = new Vector3()
const trailColor = new Color()
const coneColor = new Color()
const sparkWhite = new Color(2.5, 2.6, 2.8)
const sparkCyan = palette.seam
const sparkRed = palette.security
const sparkWorm = new Color(...cfgAll.view.colors.worm)
/** Enemy contact colours (overdriven, never white: white is the hero's) and the shield's. */
const starRed = new Color(sparkRed.r * 1.3, sparkRed.g * 2.5, sparkRed.b * 2.5)
const starWorm = new Color(sparkWorm.r * 1.2, sparkWorm.g * 2.5, sparkWorm.b * 1.4)
const sparkShield = new Color(0.5, 1.3, 3.2)
const impactDir = new Vector3()
const DEG = Math.PI / 180
const CAM_SPREAD = fanSpread(cfgAll.videoCamera.halfAngleDeg * DEG, cfgAll.videoCamera.pitchDeg * DEG)
const DRONE_SPREAD = fanSpread(cfgAll.drone.halfAngleDeg * DEG, cfgAll.drone.pitchDeg * DEG)
const WARDEN_SPREAD = fanSpread(cfgAll.warden.halfAngleDeg * DEG, cfgAll.warden.pitchDeg * DEG)

/** What glows and every solid body that can hide it shows up in the floor mirror (so a reflection never shows
 * through a block or a wall); tiny bits and flat floor decals stay out of it - they would only cost draw calls
 * there. Cold path. */
function markReflective(root: Object3D): void {
  root.traverse((o) => {
    if (o.userData['noReflect'] === true) return
    const mesh = o as Mesh
    // tiny bits (emitter dots, eye cores) are not worth a draw call in a blurred reflection
    const geo = mesh.geometry
    if (geo) {
      if (!geo.boundingSphere) geo.computeBoundingSphere()
      if ((geo.boundingSphere?.radius ?? 1) * o.scale.x < 0.12) return
    }
    o.layers.enable(REFLECT_LAYER)
  })
}

export function createGameView(canvas: HTMLCanvasElement, uiRoot: HTMLElement, s: GameState, sim: Sim, ray: RayFn, settings?: SettingsHandle, tips?: Tips, store?: QueueStore): GameView {
  const r = createRenderer(canvas)
  const mats = createMaterials()
  const grid = levelGrid(sim)
  let pickState: GameState = s
  const pickFn = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number => pickTarget(pickState, sim, ox, oy, oz, dx, dy, dz, max)
  const sight: Sight = createSight(grid)
  const exposure: Exposure = createExposure(grid, sight, s, sim)
  const city: City = buildCity(grid, mats, sight, r.mirror, s, exposure)
  r.scene.add(city.root)
  const skyline: Skyline = buildSkyline(grid, landmarks(sim))
  r.scene.add(skyline.root)
  const life: CityLife = buildCityLife(city.paths)
  r.scene.add(life.root)
  const props: Props = buildProps(s, sim, mats, sight)
  r.scene.add(props.root)
  const droneViews: DroneViews = buildDrones(s, mats, sight, sim)
  r.scene.add(droneViews.root)
  const wormViews: WormViews = buildWorms(s, mats)
  r.scene.add(wormViews.root)
  const hero: HeroView = createHero()
  r.scene.add(hero.root)
  markReflective(city.root)
  markReflective(props.root)
  markReflective(droneViews.root)
  markReflective(wormViews.root)
  markReflective(hero.root)
  // a soft key light that travels with the hero so the black suit, drones and cover read against the dark
  const keyLight = new PointLight(0x9fdcff, V.heroLight.intensity, V.heroLight.distance, 1.6)
  r.scene.add(keyLight)
  // and a cold rim light beyond the hero (seen from the camera) that draws the suit's and the coat's silhouette
  const rimLight = new PointLight(0x7fe8ff, V.light.heroRim, V.light.heroRimDistance, 1.4)
  r.scene.add(rimLight)
  const fx: Fx = createFx(r.camera)
  r.scene.add(fx.root)
  // a muzzle flash lights the hero's surroundings for a few frames (always in the scene, so the light count never changes)
  const muzzleLight = new PointLight(0x9fdcff, 0, 7, 1.6)
  r.scene.add(muzzleLight)
  // the mirror pass must see the same lights as the main pass: a different light set makes three re-resolve (and re-hash, with
  // allocations) the program of every lit material, twice a frame
  r.scene.traverse((o) => {
    if ((o as { isLight?: boolean }).isLight) o.layers.enable(REFLECT_LAYER)
  })
  const hud = createHud(uiRoot, V.hud.toastSec, settings, tips)
  const perf = createPerfOverlay(uiRoot)
  // May's two actives (keys 1-2): slots with cooldown rings, hidden until bought
  const abilities = createAbilityHud(uiRoot)
  const abil: AbilityHudState = { slots: [{ unlocked: false, cooldown: 0, cooldownLength: 1 }, { unlocked: false, cooldown: 0, cooldownLength: 1 }], pauseSec: 0 }
  const sound = new Sound(A.master)
  const music = new Music(sound)
  const cues = new Cues(sound)
  const may: MayView = createMay(uiRoot, r.scene, hero, sound, store ?? null, settings, Math.random, hud.stack)
  const unseen = createUnseen()
  const watchers: Watcher[] = []
  const cueState: CueState = { playing: false, suspicion: 0, spotted: false, alarm: 0, hp: 1, waveIn: -1 }
  /** Settings: reduced shake and flash (no hit-stop, camera kick, flashes). */
  let reduceFx = false
  const wardenViews: WardenViews = buildWardens(s, sim, sight, sound)
  r.scene.add(wardenViews.root)
  markReflective(wardenViews.root)
  const gates = createSpawnGates(r.scene, s, sim, mats, sound)
  const pickups = createPickups(r.scene, s)
  const rig = createCameraRig(r.camera, ray, playerFacing(s))
  settings?.onChange((v) => {
    sound.setVolumes({ master: v.master, music: v.music, sfx: v.sfx })
    rig.sensitivity = v.sensitivity
    rig.invertY = v.invertY
    reduceFx = v.reduceFx
    rig.reduced = v.reduceFx
    hud.marks.setReduced(v.reduceFx)
    hud.setScale(v.hudScale)
    hud.reduceFlash(v.reduceFx)
    may.setScale(v.hudScale)
    abilities.setScale(v.hudScale)
    may.setReduced(v.reduceFx)
  })

  let shake = 0
  let muzzleT = 0
  let trailStart = true
  let time = 0
  let hurt = 0
  let glitch = 0
  let stride = 0
  let lastX = playerPos(s).x
  let lastZ = playerPos(s).z
  let emptyToastAt = -10
  let lastWallToast = -10
  let hintClock = 0
  const hudState: HudState = {
    hp: 1,
    dash: 1,
    mode: 'sword',
    charges: 0,
    alarm: 0,
    alarmDecay: 0,
    status: 'hidden',
    niche: false,
    suspicion: 0,
    scanActive: false,
    scanHeat: 0,
    scanCooldown: 0,
    prompt: 'none',
    wave: 0,
    wavesCleared: 0,
    wavesNeeded: 0,
    firewallDown: false,
    crouched: false,
    marks: Array.from({ length: MAX_MARKS }, (): HudMark => ({ angle: 0, level: 0, spotted: false })),
    markCount: 0,
  }
  const sources = Array.from({ length: MAX_MARKS }, (): SuspicionSource => ({ x: 0, y: 0, z: 0, level: 0, spotted: false }))
  let scanFade = 0 // network vision faded in, 0..1: the view ranges show only in it
  const waves = { wave: 0, cleared: 0, needed: 0, firewallDown: false, active: false }

  /** Sneaking (crouched) or reduced flash: no hit-stop and no flashes - the stealth side stays calm. Set once per frame in handle(). */
  let calm = false
  /** Crouched: no camera punch, FOV punch or trauma (the muzzle flash, bolt, impacts and markers still show). */
  let sneak = false

  /** A hit-stop (the sim and the hero freeze): not while sneaking, never longer than the cap. */
  function stop(sec: number): void {
    if (!calm && sec > 0) view.hitStop = Math.max(view.hitStop, Math.min(J.hitStopMaxSec, sec))
  }

  /** Camera trauma (rotational shake, view.juice.trauma budgets) and a kick from a hit or a kill (not while sneaking). */
  function jolt(trauma: number, pitch: number, push: number): void {
    if (sneak) return
    rig.trauma(trauma)
    rig.kick(pitch, push)
  }

  /** Streak sparks thrown from an enemy hit back toward the hero (the way the shot came from). */
  function hitStreaks(x: number, y: number, z: number, n: number, speed: number, color: Color): void {
    const p = playerPos(s)
    impactDir.set(p.x - x, p.y + 1.2 - y, p.z - z)
    if (impactDir.lengthSq() < 1e-4) impactDir.set(0, 1, 0)
    impactDir.normalize()
    fx.streaks(x, y, z, impactDir.x, impactDir.y, impactDir.z, n, speed, 0.8, color)
  }

  function near(x: number, y: number, z: number): number {
    const p = playerPos(s)
    const d = Math.hypot(x - p.x, y - p.y, z - p.z)
    return Math.max(0.12, Math.min(1, 1 - d / A.hearDist))
  }

  const TC = cfgAll.tips
  const order: string[] = [...PROMPT_IDS]
  const prompter = createPrompter({ minSec: TC.promptMinSec, maxShows: TC.promptMaxShows, gapSec: TC.promptGapSec }, order)
  const customPrompts = new Map<string, PromptSpec & { until: () => boolean }>()
  const customCards: CardSpec[] = []
  const guide: Guide = {
    prompt(spec): void {
      if (!customPrompts.has(spec.id)) order.unshift(spec.id)
      customPrompts.set(spec.id, spec)
    },
    card(spec): void {
      customCards.push(spec)
    },
    takeCard: () => customCards.shift() ?? null,
  }
  /** Prompts whose situation holds now / whose action the player just did (events, since the last update). */
  const promptActive = new Set<string>()
  const promptDone = new Set<string>()
  let tipsOn = true
  settings?.onChange((v) => {
    tipsOn = v.tipsOn
  })

  function card(id: CardId): void {
    tips?.request(id)
  }

  /** Tips from what happens: cards for first meetings, and the actions that retire a prompt. */
  function tipEvent(e: GameEvent): void {
    switch (e.type) {
      case 'scanOn':
        promptDone.add('camera').add('sensor').add('sound')
        tips?.skip('netvision')
        break
      case 'wardenDowned':
        promptDone.add('warden')
        break
      case 'hackStarted':
        promptDone.add('terminal')
        break
      case 'wallOpened':
        promptDone.add('redWall')
        break
      case 'crouchChanged':
        if (e.crouched) promptDone.add('cover')
        break
      case 'rifleShot':
        promptDone.add('aim')
        tips?.skip('aim')
        break
      case 'dashed':
        promptDone.add('dash')
        break
      case 'alarmRaised':
        if (e.stage >= 3) card('alarm')
        break
      case 'droneAlerted':
      case 'droneAiming':
        card('aim')
        break
    }
  }

  /** The prompts whose situation holds now (distances from the old proximity hints). */
  function situations(st: GameState, sm: Sim, h: HudState): void {
    promptActive.clear()
    const p = playerPos(st)
    const d2 = (x: number, z: number): number => (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z)
    for (const c of videoCameras(st)) if (c.alive && d2(c.pos.x, c.pos.z) < 15 * 15) promptActive.add('camera')
    for (const m of motionSensors(st)) if (d2(m.pos.x, m.pos.z) < 9 * 9) promptActive.add('sensor')
    for (const c of soundCameras(st)) if (c.alive && d2(c.pos.x, c.pos.z) < (cfgAll.soundCamera.radius + 4) ** 2) promptActive.add('sound')
    if (promptActive.size > 0) {
      if (promptActive.has('camera') || promptActive.has('sensor') || promptActive.has('sound')) card('netvision')
    }
    for (const w of redWalls(st)) {
      const mx = w.alongX ? w.coord : (w.min + w.max) / 2
      const mz = w.alongX ? (w.min + w.max) / 2 : w.coord
      if (!w.open && d2(mx, mz) < 8 * 8) promptActive.add('redWall')
    }
    // the interact prompt itself covers a terminal within reach
    if (h.prompt === 'none') for (const term of terminals(st)) if (!term.done && d2(term.pos.x, term.pos.z) < 4 * 4) promptActive.add('terminal')
    for (const w of wardens(st)) if (w.alive && d2(w.pos.x, w.pos.z) < 14 * 14) promptActive.add('warden')
    if (h.suspicion > 0.1 && !h.crouched && h.status !== 'detected') promptActive.add('cover')
    if (h.status === 'detected' && h.charges > 0 && h.aim === 0) promptActive.add('aim')
    if (waves.active) promptActive.add('dash')
    void sm
  }

  /**
   * Shader and upload prewarm (once, cold path): three compiles a material's program and uploads a mesh's buffers and textures on
   * the first frame it is drawn, which stalled the game for 0.2-2 s each time a new area, effect or enemy first showed up. This
   * draws one frame with every hidden object shown (lights are left alone: their number must never change, or every program
   * recompiles), so all of it happens before play. DESIGN-neutral: nothing is seen (the frame is drawn before the next present).
   */
  /**
   * three draws a transparent double-sided material in two passes (back faces, then front) and, to do it, bumps the material's
   * version twice per object per render: every frame, every such object re-derives its program parameters and cache key (strings,
   * arrays: ~0.8 MB of garbage per frame in a fight, so a GC every second) and costs two draw calls. Additive and depth-less
   * glows (cones, rings, tracers, flashes, beams) look the same drawn in one pass.
   */
  function singlePass(o: Object3D): void {
    const m = (o as Mesh).material as Material | Material[] | undefined
    if (!m) return
    for (const x of Array.isArray(m) ? m : [m]) if (x.transparent && x.side === DoubleSide && (x.blending === AdditiveBlending || !x.depthWrite)) x.forceSinglePass = true
  }
  let warmLeft = location.search.includes('nowarm') ? 0 : 900 // ?nowarm: the old behaviour, for the benchmark's before/after
  function prewarm(): void {
    const undo: [Object3D, boolean, boolean][] = []
    r.scene.traverse((o) => {
      if ((o as { isLight?: boolean }).isLight) return
      singlePass(o)
      if (!o.visible || o.frustumCulled) undo.push([o, o.visible, o.frustumCulled])
      o.visible = true
      o.frustumCulled = false
    })
    r.render(time)
    for (const [o, v, f] of undo) {
      o.visible = v
      o.frustumCulled = f
    }
  }

  let heroYaw = 0
  let heroYawSnap = true
  const view: GameView = {
    hud,
    guide,
    may,
    sound,
    music,
    rig,
    renderer: r,
    exposure,
    hitStop: 0,
    handle(events, st, sm): void {
      const p = playerPos(st)
      may.handle(events, st)
      let hackSolvedNow = false
      sneak = isCrouched(st)
      calm = sneak || reduceFx
      // one swing that kills several holds the freeze a little longer
      let kills = 0
      for (const e of events) if (e.type === 'targetHit' && e.killed) kills++
      const killStop = J.killHitStopSec + J.killHitStopStepSec * Math.max(0, kills - 1)
      for (const e of events) {
        tipEvent(e)
        if (e.type.startsWith('warden') || e.type === 'shieldBlocked' || (e.type === 'targetHit' && e.target === 'warden')) wardenViews.event(e, st)
        switch (e.type) {
          case 'jumped':
            sound.play('jump', 0.7)
            break
          case 'fellIntoVoid':
            sound.play('glitch', 0.6)
            glitch = Math.max(glitch, J.glitchHurt)
            break
          case 'voidReturned':
            rig.snap() // back on safe ground, still in the dark: no camera swoop across the void
            glitch = Math.max(glitch, J.glitchKill)
            break
          case 'landed':
            sound.play('land', 0.7)
            shake = Math.max(shake, J.shakeLand)
            rig.trauma(T.land)
            fx.sparks(p.x, p.y + 0.05, p.z, 10, 3, sparkCyan, 0.2)
            break
          case 'dashed':
            sound.play('dash', 0.8)
            rig.trauma(T.dash)
            fx.sparks(p.x, p.y + 1, p.z, 18, 4, sparkWhite, 0.1)
            break
          case 'crouchChanged':
            sound.play('crouch_toggle', 0.6)
            break
          case 'swordSwing':
            sound.play('sword_swing', 0.8, e.combo === 2 ? 0.82 : e.combo === 1 ? 1.08 : 1)
            trailStart = true
            break
          case 'rifleShot': {
            sound.play('rifle_shot', H.rifle)
            // from the gun's muzzle when the model has one (the core's origin is only a point near the chest)
            const hasMuzzle = hero.muzzle(muzzlePt)
            if (!hasMuzzle) muzzlePt.set(e.fromX, e.fromY, e.fromZ)
            fx.tracer(muzzlePt.x, muzzlePt.y, muzzlePt.z, e.toX, e.toY, e.toZ)
            let dx = e.toX - muzzlePt.x
            let dy = e.toY - muzzlePt.y
            let dz = e.toZ - muzzlePt.z
            const dl = Math.hypot(dx, dy, dz) || 1
            dx /= dl
            dy /= dl
            dz /= dl
            if (!e.hit) {
              // a wall (or the floor) was hit: a glowing scorch and streaks along the reflection. The surface normal is guessed:
              // up near the floor, else the horizontal opposite of the shot.
              if (dl < cfgAll.combat.rifle.range - 0.5) {
                const onFloor = e.toY - floorHeightAt(grid, e.toX, e.toZ) < 0.12
                const hl = Math.hypot(dx, dz)
                const nx = onFloor || hl < 0.05 ? 0 : -dx / hl
                const ny = onFloor || hl < 0.05 ? 1 : 0
                const nz = onFloor || hl < 0.05 ? 0 : -dz / hl
                const dn = dx * nx + dy * ny + dz * nz
                fx.scorch(e.toX, e.toY, e.toZ, nx, ny, nz, sparkCyan)
                fx.streaks(e.toX, e.toY, e.toZ, dx - 2 * dn * nx, dy - 2 * dn * ny, dz - 2 * dn * nz, 7, 6, 0.55, sparkCyan)
                fx.streaks(e.toX, e.toY, e.toZ, nx, ny, nz, 3, 4, 0.5, sparkWhite)
                fx.flash(e.toX + nx * 0.05, e.toY + ny * 0.05, e.toZ + nz * 0.05, sparkCyan, 0.4, 0.08)
              }
              sound.playAt('bullet_impact', e.toX, e.toZ, 0.3 * near(e.toX, e.toY, e.toZ))
            }
            // the muzzle flash always shows (crouched too); only the camera punch follows the stealth calm
            if (hasMuzzle) {
              const rs = reduceFx ? J.reducedFlash : 1
              fx.flash(muzzlePt.x, muzzlePt.y, muzzlePt.z, sparkWhite, J.muzzleFlashSize * rs, J.muzzleFlashSec)
              fx.star(muzzlePt.x, muzzlePt.y, muzzlePt.z, sparkWhite, J.muzzleStarSize * rs, J.muzzleFlashSec * 1.4)
              fx.streaks(muzzlePt.x, muzzlePt.y, muzzlePt.z, dx, dy, dz, 5, 7, 0.4, sparkCyan)
              muzzleLight.position.copy(muzzlePt)
              muzzleT = J.muzzleFlashSec
            }
            hero.kick()
            hud.marks.shot()
            if (!sneak) {
              rig.kick((J.shotPunchPitchDeg * DEG), J.kickShotPush, (Math.random() < 0.5 ? -1 : 1) * J.shotPunchYawDeg * DEG * (0.4 + 0.6 * Math.random()))
              rig.fovKick(J.fovPunch.shotDeg)
              rig.trauma(T.shot)
            }
            break
          }
          case 'rifleEmpty':
            sound.play('rifle_empty', 0.8)
            if (time - emptyToastAt > 3) {
              emptyToastAt = time
              hud.toast(t('toast.empty'))
            }
            break
          case 'shardTaken':
            sound.play('ammo_drop', e.big ? 0.7 : 0.4, e.big ? 1.6 : 2.2)
            break
          case 'modeSwitched':
            sound.play('ammo_drop', 0.6)
            break
          case 'targetHit': {
            const col = e.target === 'worm' ? starWorm : starRed
            const spark = e.target === 'worm' ? sparkWorm : sparkRed
            // the confirmation: one tick on a hit, one pop for every kind of kill, and the contact star in the enemy's own colour
            if (e.killed) {
              sound.play('kill_pop', H.killPop)
              hud.marks.kill()
              fx.star(e.x, e.y, e.z, col, J.starSize * 1.5)
              if (!sneak) rig.fovKick(J.fovPunch.killDeg)
            } else {
              sound.play('hit_tick', H.hitTick)
              hud.marks.hit()
              fx.star(e.x, e.y, e.z, col, J.starSize)
            }
            if (e.target === 'worm') {
              // worms: a wet crunch; a kill scatters the body in magenta sparks (several die at once to one swing)
              const nr = near(e.x, e.y, e.z)
              if (e.killed) {
                sound.playAt('worm_death', e.x, e.z, H.wormKill * nr)
                wormViews.burst(e.index, (x, y, z) => fx.sparks(x, y, z, 12, 5, sparkWorm, 0.6))
                fx.sparks(e.x, e.y, e.z, 26, 6, sparkWorm, 0.6)
                hitStreaks(e.x, e.y, e.z, 10, 8, sparkWorm)
                if (!calm) fx.flash(e.x, e.y, e.z, sparkWorm, J.killFlashSize * 0.5, J.killFlashSec)
                stop(e.byRifle ? J.rifleKillHitStopSec : killStop * 0.8)
                jolt(e.byRifle ? T.rifleKill : T.swordKill, J.kickHitPitch, J.kickHitPush)
              } else {
                sound.playAt('worm_hit', e.x, e.z, H.wormHit * nr)
                if (!e.byRifle) sound.playAt('sword_hit', e.x, e.z, H.wormHitBlade * nr)
                wormViews.flash(e.index)
                fx.sparks(e.x, e.y, e.z, 8, 4, sparkWorm, 0.4)
                hitStreaks(e.x, e.y, e.z, 6, 6, sparkWorm)
                if (!e.byRifle) {
                  stop(J.hitStopSec)
                  jolt(T.swordHit, J.kickHitPitch, J.kickHitPush)
                }
              }
              break
            }
            if (e.target === 'drone') {
              // drones: a metal clang on every hit, a heavy crunching blast on a kill
              const nr = near(e.x, e.y, e.z)
              if (e.killed) {
                sound.playAt('drone_kill', e.x, e.z, H.droneKill * nr)
                sound.playAt('derez', e.x, e.z, H.droneKillDerez * nr)
              } else {
                sound.playAt('drone_hit', e.x, e.z, H.droneHit * nr)
                if (!e.byRifle) sound.playAt('sword_hit', e.x, e.z, H.droneHitBlade * nr)
              }
            }
            if (e.killed) {
              if (e.target !== 'drone') sound.playAt('derez', e.x, e.z, 0.9 * near(e.x, e.y, e.z))
              sound.play('glitch', 0.6)
              fx.sparks(e.x, e.y, e.z, 90, 9, sparkRed, 0.3)
              fx.sparks(e.x, e.y, e.z, 50, 6, spark, 0.5)
              hitStreaks(e.x, e.y, e.z, 14, 10, spark)
              if (!calm) fx.flash(e.x, e.y, e.z, e.target === 'drone' || e.target === 'warden' ? sparkRed : sparkCyan, J.killFlashSize, J.killFlashSec)
              stop(e.byRifle ? J.rifleKillHitStopSec : killStop)
              // the big kill glitch stays for wardens; the small kills get a lighter one
              const big = e.target === 'warden'
              jolt(big ? T.heavy : e.byRifle ? T.rifleKill : T.swordKill, J.kickKillPitch, J.kickKillPush)
              glitch = Math.max(glitch, big ? J.glitchKill : J.glitchKillSmall)
            } else {
              if (e.target !== 'drone') sound.playAt(e.byRifle ? 'bullet_impact' : 'sword_hit', e.x, e.z, 0.85)
              else if (e.byRifle) sound.play('bullet_impact', 0.5)
              fx.sparks(e.x, e.y, e.z, e.byRifle ? 6 : 20, e.byRifle ? 5 : 7, spark)
              hitStreaks(e.x, e.y, e.z, e.byRifle ? 8 : 12, e.byRifle ? 7 : 9, spark)
              if (!e.byRifle) {
                stop(J.hitStopSec)
                if (!calm) fx.flash(e.x, e.y, e.z, spark, J.killFlashSize * 0.3, J.killFlashSec * 0.5)
                jolt(T.swordHit, J.kickHitPitch, J.kickHitPush)
              }
            }
            break
          }
          case 'shieldBlocked':
            // a bolt stopped by the heavy's shield: a block marker, a blue contact star and a deflect thunk
            hud.marks.block()
            fx.star(e.x, e.y, e.z, sparkShield, J.starSize * 1.1)
            sound.playAt('shield_hit', e.x, e.z, 0.6 * near(e.x, e.y, e.z))
            break
          case 'playerHurt': {
            // a meaty body hit on top of the signal buzz, heavier when low; a red flash and an arc towards the source
            sound.play('player_hit', H.playerHit)
            sound.play('player_hurt', H.playerHurt)
            if (e.hp < cfgAll.player.maxHp * 0.3) sound.play('land', H.playerHitLowHp, 0.6)
            const fdx = e.fromX - p.x
            const fdz = e.fromZ - p.z
            // clockwise from straight ahead on screen: the camera looks along rig.yaw (forward = (sin, cos))
            const ang = fdx * fdx + fdz * fdz > 0.01 ? -Math.atan2(Math.sin(Math.atan2(fdx, fdz) - rig.yaw), Math.cos(Math.atan2(fdx, fdz) - rig.yaw)) : 0
            hud.hit(fdx * fdx + fdz * fdz > 0.01 ? ang : Math.PI, Math.min(1, e.amount / 15))
            hurt = 1
            rig.trauma(T.hurt)
            rig.kick(J.kickHurtPitch, J.kickHurtPush)
            glitch = Math.max(glitch, J.glitchHurt)
            if (!reduceFx) view.hitStop = Math.max(view.hitStop, Math.min(J.hitStopMaxSec, J.hurtHitStopSec))
            fx.sparks(p.x, p.y + 1.1, p.z, 16, 5, sparkRed)
            break
          }
          case 'wormPack': {
            const g = spawnGates(sm)[e.gate]
            if (g) sound.playAt('worm_spawn', g.mouth.x, g.mouth.z, H.wormSpawn * near(g.mouth.x, g.mouth.y, g.mouth.z))
            break
          }
          case 'wormWindup': {
            const w = worms(st)[e.index]
            if (w) sound.playAt('worm_windup', w.pos.x, w.pos.z, H.wormWindup * near(w.pos.x, w.pos.y, w.pos.z))
            break
          }
          case 'wormBite': {
            const w = worms(st)[e.index]
            if (w) sound.playAt('worm_bite', w.pos.x, w.pos.z, H.wormBite * near(w.pos.x, w.pos.y, w.pos.z), e.hit ? 0.9 : 1.15)
            break
          }
          case 'wormSensed': {
            const w = worms(st)[e.index]
            if (w) sound.playAt('worm_windup', w.pos.x, w.pos.z, H.wormWindup * 0.6 * near(w.pos.x, w.pos.y, w.pos.z), 1.4)
            break
          }
          case 'playerDied':
            sound.play('player_death', 1)
            glitch = 1.4
            rig.trauma(T.death)
            fx.sparks(p.x, p.y + 1, p.z, 160, 8, sparkWhite, 0.6)
            break
          case 'droneFired': {
            const d = drones(st)[e.index]
            if (d) sound.playAt('drone_shot', d.pos.x, d.pos.z, 0.7 * near(d.pos.x, d.pos.y, d.pos.z))
            break
          }
          case 'boltHit':
            if (!e.player) {
              fx.sparks(e.x, e.y, e.z, 6, 3, sparkRed)
              sound.playAt('bullet_impact', e.x, e.z, 0.2 * near(e.x, e.y, e.z))
            }
            break
          case 'droneSuspicious': {
            const d = drones(st)[e.index]
            if (d) sound.playAt('suspicion_rise', d.pos.x, d.pos.z, 0.55 * near(d.pos.x, d.pos.y, d.pos.z))
            break
          }
          case 'droneAiming': {
            // the telegraph: a short rising charge before the shot
            const d = drones(st)[e.index]
            if (d) sound.playAt('suspicion_rise', d.pos.x, d.pos.z, 0.75 * near(d.pos.x, d.pos.y, d.pos.z), 0.7)
            break
          }
          case 'droneAlerted':
            sound.play('drone_alert', 0.9)
            break
          case 'droneSpawned': {
            const d = drones(st)[e.index]
            if (d) fx.sparks(d.pos.x, d.pos.y, d.pos.z, 30, 4, sparkRed, 0.2)
            if (e.role !== 'wave') sound.play('glitch', 0.4)
            break
          }
          case 'cameraSpotted':
            sound.play('camera_spotted', 0.9)
            break
          case 'soundHeard':
            sound.play('sound_camera_ping', 0.8)
            sound.play('camera_spotted', 0.7)
            break
          case 'sensorTripped':
            sound.play('motion_sensor_trip', 1)
            break
          case 'laserTripped':
            sound.play('shield_hit', 0.8)
            glitch = Math.max(glitch, J.glitchHurt)
            break
          case 'checkCalled':
            hud.toast(t('toast.check'))
            break
          case 'noise':
            // how far a noise carries is a range: shown only in network vision
            if (scanActive(st)) fx.noiseRing(e.x, e.y - 1, e.z, e.radius)
            break
          case 'alarmRaised':
            sound.play(e.stage >= 2 ? 'alarm_2' : 'alarm_1', 0.8)
            hud.toast(t(e.stage === 1 ? 'toast.alarm1' : e.stage === 2 ? 'toast.alarm2' : 'toast.alarm3'), 'alarm')
            glitch = Math.max(glitch, J.glitchAlarm)
            break
          case 'alarmLowered':
            hud.toast(t('toast.alarmDown', { stage: e.stage }), 'good')
            break
          case 'waveCleared':
            cues.waveCleared()
            break
          case 'waveStarted':
            sound.play('wave_spawn', 0.9)
            hud.toast(t('toast.wave', { wave: e.wave }), 'alarm')
            break
          case 'firewallDropped':
            sound.play('firewall_drop', 1)
            hud.toast(t('toast.firewall'), 'good')
            glitch = Math.max(glitch, J.glitchWall)
            rig.trauma(T.firewall)
            lastWallToast = time
            break
          case 'wallOpened':
            if (time - lastWallToast > 0.5) {
              sound.play('firewall_drop', 0.9)
              // a solved hack says what it opened itself (main.ts, after the hack overlay closes)
              if (!hackSolvedNow) hud.toast(t('toast.wallOpen'), 'good')
              glitch = Math.max(glitch, J.glitchWall)
              lastWallToast = time
            }
            break
          case 'abilityUsed':
            if (e.slot === 0) {
              fx.noiseRing(e.x, floorHeightAt(grid, e.x, e.z), e.z, cfgAll.progression.distract.noiseRadius)
              sound.play('decoy_spawn', 0.8)
            }
            abilities.used(e.slot)
            break
          case 'abilityFailed':
            sound.play('ui_back', 0.6)
            abilities.deny(e.slot)
            hud.toast(t(e.reason === 'cooldown' ? 'toast.recharging' : 'toast.noTarget'))
            break
          case 'mayPoints':
            hud.toast(t(e.gained === 1 ? 'toast.points' : 'toast.pointsMany', { n: e.gained }), 'good')
            break
          case 'shieldAbsorbed':
            sound.play('shield_hit', 0.9)
            hud.toast(t('toast.shield'), 'good')
            glitch = Math.max(glitch, J.glitchHurt)
            break
          case 'devicePaused':
            sound.play('camera_pause', 0.8)
            if (!hackSolvedNow) hud.toast(t('toast.paused', { sec: Math.round(e.sec) }), 'good')
            break
          case 'scanOn':
            sound.play('scan_on', 0.6)
            break
          case 'scanOff':
            sound.play('scan_off', 0.5)
            break
          case 'scanWarning':
            // the trace meter pulses red with "TRACE RISK" (HUD); the sound says it without looking
            sound.play('scan_overheat', 0.8)
            break
          case 'scanTraced':
            hud.traced()
            sound.play('alarm_1', 0.7)
            glitch = Math.max(glitch, J.glitchAlarm)
            break
          case 'hackSolved':
            hackSolvedNow = true // the hack's outcome toast comes from main.ts once the overlay has closed
            break
          case 'checkpointReached':
            sound.play('checkpoint', 0.9)
            hud.toast(t(e.underAlarm ? 'toast.checkpointAlarm' : 'toast.checkpoint'), e.underAlarm ? 'alarm' : 'good')
            props.flashCheckpoint(e.index)
            break
          case 'artifactTaken':
            sound.play('artifact_pickup', 1)
            glitch = 0.8
            break
          default:
            break
        }
      }
      void sm
    },
    update(dt, st, sm, rawDt = dt): void {
      const t0 = performance.now()
      time += dt
      // hit-stop: the hero, the sparks and the shake hold still too (the camera and the mouse do not)
      const fdt = this.hitStop > 0 ? 0 : dt
      const p = playerPos(st)
      const anim = heroAnim(st, sm)
      // the hero
      hero.root.position.set(p.x, p.y, p.z)
      // the model turns toward the core facing fast but not in one frame: a shot or a dash backwards snaps the core facing by
      // 180 deg, which read as the camera flipping (the aim solver re-measures the barrel every frame, so it stays on target)
      {
        const want = playerFacing(st)
        const d = want - heroYaw - Math.PI * 2 * Math.round((want - heroYaw) / (Math.PI * 2))
        heroYaw = heroYawSnap ? want : heroYaw + d * Math.min(1, dt * V.heroTurnRate)
        heroYawSnap = false
      }
      hero.root.rotation.y = heroYaw
      keyLight.position.set(p.x - Math.sin(rig.yaw) * V.heroLight.back, p.y + V.heroLight.height, p.z - Math.cos(rig.yaw) * V.heroLight.back)
      rimLight.position.set(p.x + Math.sin(rig.yaw) * 1.4, p.y + 2.1, p.z + Math.cos(rig.yaw) * 1.4)
      hero.setMode(weaponMode(st))
      heroLineColor(st, sm, red, blue, rgb)
      heroColor.setRGB(rgb.r * WHITE_SCALE, rgb.g * WHITE_SCALE, rgb.b * WHITE_SCALE)
      // hidden: unseen and crouched in cover, the light lines dim (Mark of the Ninja); back to full when a watcher notices
      hiddenK += (((lanesEnabled && securityStatus(st) === 'hidden' && isCrouched(st) && isInCover(st, sm)) ? 1 : 0) - hiddenK) * Math.min(1, V.stealthLight.heroFadeRate * dt)
      setHeroHidden(hiddenK)
      hero.setLineColor(heroColor)
      // the crosshair's world point (from this frame's aim(), see below): the raised rifle points at it, the head glances at it
      heroAim.on = isAiming(st)
      heroAim.target = aimFresh ? aimPt : null
      hero.update(fdt, anim, heroActionProgress(st, sm), playerSpeed(st), time, swordCombo(st), heroAim)
      // the sword trail follows the real blade while a swing plays (not while sneaking)
      if (anim === 'slash' && !isCrouched(st) && fdt > 0 && hero.blade(hiltPt, tipPt)) {
        trailColor.setRGB(rgb.r, rgb.g, rgb.b)
        hiltPt.lerp(tipPt, J.trailInner) // only the outer part of the blade draws the ribbon
        fx.trail(hiltPt.x, hiltPt.y, hiltPt.z, tipPt.x, tipPt.y, tipPt.z, trailStart, trailColor)
        trailStart = false
      }
      if (muzzleT > 0) {
        muzzleT -= fdt
        muzzleLight.intensity = J.muzzleLight * (reduceFx ? J.reducedFlash : 1) * Math.max(0, muzzleT / J.muzzleFlashSec)
      } else muzzleLight.intensity = 0

      // footsteps from the distance walked
      const moved = Math.hypot(p.x - lastX, p.z - lastZ)
      lastX = p.x
      lastZ = p.z
      if (isGrounded(st) && moved < 1) {
        stride += moved
        const crouched = isCrouched(st)
        const run = isRunning(st)
        const len = crouched ? V.footstep.crouchStride : run ? V.footstep.runStride : V.footstep.walkStride
        if (stride >= len) {
          stride = 0
          // the loudness is the noise radius the guards hear: crouching and walking are quiet, a sprint is loud
          const CF = A.cues.footstep
          const loud = Math.min(1, noiseRadius(st) / cfgAll.noise.run)
          if (crouched) sound.play('footstep_sneak', CF.crouch + (CF.ceil - CF.crouch) * 0.5 * loud)
          else sound.play(run ? 'footstep_sprint' : 'footstep_walk', CF.floor + (CF.ceil - CF.floor) * Math.max(loud, run ? 1 : 0))
        }
      }

      // floor fans of every view cone - only in network vision, like the cone volumes
      scanFade += ((scanActive(st) ? 1 : 0) - scanFade) * Math.min(1, dt * V.cones.scanFadeRate)
      if (scanFade < 0.01) scanFade = 0
      setConesFade(scanFade)
      setCullView(r.camera)
      sight.setWalls(redWalls(st))
      exposure.update(st, sm, dt)
      let nc = 0
      const vc = cfgAll.videoCamera
      const cp = Math.cos((vc.pitchDeg * Math.PI) / 180)
      const sp = Math.sin((vc.pitchDeg * Math.PI) / 180)
      const camCos = Math.cos((vc.halfAngleDeg * Math.PI) / 180)
      const cams = videoCameras(st)
      for (let i = 0; i < cams.length; i++) {
        const c = cams[i]
        if (scanFade <= 0 || !c || !c.alive || c.pausedTime > 0 || nc >= MAX_CONES || !inView(c.pos.x, c.pos.y, c.pos.z, vc.range)) continue
        coneColor.copy(palette.security).lerp(palette.suspicious, c.suspicion < 1 ? Math.min(1, c.suspicion * 1.5) : 0)
        const fan = sight.fan(i, c.pos.x, c.pos.y, c.pos.z, c.yaw, CAM_SPREAD, vc.range)
        city.setCone(nc++, c.pos.x, c.pos.y, c.pos.z, Math.sin(c.yaw) * cp, -sp, Math.cos(c.yaw) * cp, camCos, vc.range, coneColor, (0.9 + c.suspicion) * scanFade, fan)
      }
      const dc = cfgAll.drone
      const dp = Math.cos((dc.pitchDeg * Math.PI) / 180)
      const dsp = Math.sin((dc.pitchDeg * Math.PI) / 180)
      const droneCos = Math.cos((dc.halfAngleDeg * Math.PI) / 180)
      const ds = drones(st)
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i]
        if (nc >= MAX_CONES || scanFade <= 0) break
        if (!d || !d.active || !d.alive || d.pausedTime > 0 || d.spawnTime > 0 || !inView(d.pos.x, d.pos.y, d.pos.z, dc.range)) continue
        coneColor.copy(palette.security).lerp(palette.suspicious, d.mode === 'alert' ? 0 : Math.min(1, d.suspicion * 1.6))
        const fan = sight.fan(DRONE_KEY + i, d.pos.x, d.pos.y, d.pos.z, d.yaw, DRONE_SPREAD, dc.range)
        city.setCone(nc++, d.pos.x, d.pos.y, d.pos.z, Math.sin(d.yaw) * dp, -dsp, Math.cos(d.yaw) * dp, droneCos, dc.range, coneColor, (d.mode === 'alert' ? 1.6 : 0.8 + d.suspicion) * scanFade, fan)
      }
      const wc = cfgAll.warden
      const wp = Math.cos(wc.pitchDeg * DEG)
      const wsp = Math.sin(wc.pitchDeg * DEG)
      const wardenCos = Math.cos(wc.halfAngleDeg * DEG)
      const ws = wardens(st)
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i]
        if (nc >= MAX_CONES || scanFade <= 0) break
        if (!w || !w.alive || w.pausedTime > 0 || w.controlled || !inView(w.pos.x, w.pos.y, w.pos.z, wc.range)) continue
        const look = wardenLookYaw(st, i)
        const ey = w.pos.y + wc.eyeHeight
        coneColor.copy(palette.security).lerp(palette.suspicious, w.mode === 'alert' ? 0 : Math.min(1, w.suspicion * 1.6))
        const fan = sight.fan(WARDEN_KEY + i, w.pos.x, ey, w.pos.z, look, WARDEN_SPREAD, wc.range)
        city.setCone(nc++, w.pos.x, ey, w.pos.z, Math.sin(look) * wp, -wsp, Math.cos(look) * wp, wardenCos, wc.range, coneColor, (w.mode === 'alert' ? 1.6 : 0.8 + w.suspicion) * scanFade, fan)
      }
      city.setConeCount(nc)

      props.update(st, sm, dt)
      gates.update(dt, st, sm)
      pickups.update(st)
      droneViews.update(st, dt, r.camera)
      wormViews.update(st, sm, dt)
      wardenViews.update(st, sm, dt, scanFade)
      sight.flush(dt)
      fx.update(fdt, st)

      // the listener is the camera; the hum of the 3 nearest drones and the servo of the 3 nearest cameras are one voice each, panned
      sound.listen(r.camera.position.x, r.camera.position.z, rig.yaw)
      let cnt = pickNearest(drones(st), p.x, p.z, A.hearDist * M.loopRadius, true)
      for (let i = 0; i < M.loopVoices; i++) {
        const d = picked[i] as { pos: { x: number; z: number } } | undefined
        if (i < cnt && d) sound.loopAt('drone_hum_loop', i, A.droneHum * pickedK[i]!, d.pos.x, d.pos.z)
        else sound.loopAt('drone_hum_loop', i, 0, 0, 0)
      }
      cnt = pickNearest(videoCameras(st), p.x, p.z, A.hearDist * M.cameraLoopRadius, false)
      for (let i = 0; i < M.loopVoices; i++) {
        const c = picked[i] as { pos: { x: number; z: number } } | undefined
        if (i < cnt && c) sound.loopAt('camera_servo_loop', i, A.cameraServo * pickedK[i]!, c.pos.x, c.pos.z)
        else sound.loopAt('camera_servo_loop', i, 0, 0, 0)
      }
      const stage = alarmStage(st)
      sound.loop('alarm_3_loop', stage >= 3 && st.phase === 'playing' ? A.alarmLoop : 0)
      // the skitter of the worms: louder with more of them close by
      let wl = 0
      for (const w of worms(st)) if (w.active && w.alive && w.spawnTime <= 0) wl += Math.max(0, 1 - Math.hypot(w.pos.x - p.x, w.pos.z - p.z) / A.hearDist)
      sound.loop('worm_skitter_loop', A.wormSkitter * Math.min(1, wl * 0.45))

      // the camera
      shake = Math.max(0, shake - fdt * J.shakeDecay * Math.max(0.3, shake))
      const shk = reduceFx ? 0 : shake
      const sx = (Math.sin(time * 71) + Math.sin(time * 37)) * 0.5 * shk * 0.25
      const sy = (Math.sin(time * 53) + Math.sin(time * 29)) * 0.5 * shk * 0.25
      const fov = anim === 'dash' ? V.dashFov : V.fov
      rig.update(dt, p.x, p.y, p.z, isCrouched(st), fov, sx, sy, isAiming(st))

      // post effects
      hurt = Math.max(0, hurt - dt * 2.2)
      glitch = Math.max(0, glitch - dt * J.glitchDecay)
      r.fx.hurt = Math.max(reduceFx ? Math.min(hurt, 0.25) : hurt, hpFraction(st, sm) < 0.3 ? 0.25 + (reduceFx ? 0 : 0.1 * Math.sin(time * 6)) : 0)
      r.fx.glitch = reduceFx ? 0 : Math.min(1, glitch)
      r.fx.scan += ((scanActive(st) ? 1 : 0) - r.fx.scan) * Math.min(1, dt * 10)
      r.fx.alarm = stage >= 3 ? 1 : 0
      city.setAlarm(stage >= 3 ? 1 : stage * V.corridor.alarmLow, time, p.x, p.z)
      r.fx.reflectY = floorHeightAt(grid, p.x, p.z)
      r.fx.fade = voidFade(st, sm)
      skyline.update(time, r.camera)
      life.update(dt, r.camera)

      // HUD
      const h = hudState
      h.hp = hpFraction(st, sm)
      h.dash = dashReady(st, sm)
      h.mode = weaponMode(st)
      h.charges = charges(st)
      h.alarm = stage
      h.alarmDecay = alarmDecayFraction(st, sm)
      h.status = securityStatus(st)
      h.niche = isHiddenInNiche(st, sm)
      h.suspicion = maxSuspicion(st)
      h.scanActive = scanActive(st)
      h.scanHeat = scanHeat(st, sm)
      h.scanCooldown = scanCooldown(st, sm)
      h.scanWarnAt = scanWarnAt(sm)
      h.scanWarning = scanWarning(st)
      h.prompt = interactPrompt(st, sm)
      waveInfo(st, sm, waves)
      h.wave = waves.wave
      h.wavesCleared = waves.cleared
      h.wavesNeeded = waves.needed
      h.firewallDown = waves.firewallDown
      h.crouched = isCrouched(st)
      h.aim = rig.aim
      // the suspicion marks: each watcher noticing you, turned toward it on screen (clockwise from straight ahead)
      h.markCount = suspicionSources(st, sources)
      const fx0 = Math.sin(rig.yaw)
      const fz0 = Math.cos(rig.yaw)
      for (let i = 0; i < h.markCount; i++) {
        const src = sources[i] as SuspicionSource
        const m = h.marks[i] as HudMark
        const dx = src.x - p.x
        const dz = src.z - p.z
        // right of the view is (-cos yaw, sin yaw)
        m.angle = Math.atan2(-fz0 * dx + fx0 * dz, fx0 * dx + fz0 * dz)
        m.level = src.level
        m.spotted = src.spotted
      }
      hud.update(h)
      abilitySlot(st, sm, 0, abil.slots[0])
      abilitySlot(st, sm, 1, abil.slots[1])
      abil.pauseSec = pauseLengthSec(st, sm)
      abilities.update(abil)
      hud.marks.update(dt)
      // stealth feedback: a warden passed close by and did not notice the player
      {
        const ws = wardens(st)
        watchers.length = ws.length
        for (let i = 0; i < ws.length; i++) {
          const w = ws[i] as (typeof ws)[number]
          const slot = (watchers[i] ??= { x: 0, z: 0, yaw: 0 })
          slot.x = w.alive ? w.pos.x : 1e9
          slot.z = w.pos.z
          slot.yaw = wardenLookYaw(st, i)
        }
        if (unseen.step(dt, h.status === 'hidden' && h.suspicion < 0.05 && st.phase === 'playing', p.x, p.z, watchers)) {
          hud.unseen(V.hud.unseenSec)
          may.unseen()
        }
      }
      // tips: a card for the first minutes of play, the prompts after a short calm start
      hintClock -= dt
      if (hintClock <= 0) {
        hintClock = 0.25
        if (time > V.hud.hintsAfterSec) situations(st, sm, h)
        else promptActive.clear()
        for (const c of customPrompts.values()) {
          if (c.until()) promptDone.add(c.id)
          else promptActive.add(c.id)
        }
      }
      const mfl = music.flags
      const shown = prompter.step(dt, promptActive, promptDone, (tipsOn || customPrompts.size > 0) && dt > 0 && st.phase === 'playing' && !mfl.hack && !mfl.menu && !mfl.paused)
      promptDone.clear()
      const custom = shown === null ? undefined : customPrompts.get(shown)
      hud.hint(shown === null ? null : (custom ?? { id: shown, text: t(`hint.${shown}` as 'hint.camera') }))

      // the audio cues and the music follow the state
      const mf = music.flags
      mf.lowHp = h.hp < M.lowHp.below && st.phase === 'playing'
      sound.setHackDuck(mf.hack)
      cueState.playing = st.phase === 'playing' && dt > 0 && !mf.hack && !mf.menu && !mf.paused
      cueState.suspicion = h.suspicion
      cueState.spotted = h.status === 'detected'
      cueState.alarm = stage
      cueState.hp = h.hp
      cueState.waveIn = waveCountdown(st)
      cues.update(cueState)
      music.want = stage >= 3 || waves.active ? 2 : stage >= 1 || h.status !== 'hidden' || h.suspicion > 0.15 ? 1 : 0
      may.update(rawDt, st, rig.yaw)
      mf.dialogue = may.speaking()
      music.update(rawDt)

      if (warmLeft > 0 && (wardenViews.warm() || --warmLeft === 0)) {
        warmLeft = 0
        prewarm()
      }
      r.render(time)
      perf.frame(performance.now() - t0)
    },
    reset(st, sm): void {
      rig.yaw = playerFacing(st)
      heroYawSnap = true
      rig.snap()
      props.reset(st)
      may.reset()
      unseen.reset()
      lastX = playerPos(st).x
      lastZ = playerPos(st).z
      shake = 0
      hurt = 0
      glitch = 0.6
      void sm
    },
    aim(st, out): void {
      pickState = st
      rig.aimPoint(aimPt, pickFn)
      aimFresh = true
      const p = playerPos(st)
      const mx = p.x
      const my = p.y + cfgAll.combat.rifle.muzzleHeight
      const mz = p.z
      const dx = aimPt.x - mx
      const dy = aimPt.y - my
      const dz = aimPt.z - mz
      out.yaw = Math.atan2(dx, dz)
      out.pitch = Math.atan2(dy, Math.hypot(dx, dz))
      // very close to a wall the point can end up behind the hero: then use the camera's yaw
      const fwd = Math.sin(rig.yaw) * dx + Math.cos(rig.yaw) * dz
      if (fwd < 0.5) {
        out.yaw = rig.yaw
        out.pitch = 0
      }
    },
  }
  return view
}
