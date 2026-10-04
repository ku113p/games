// The game view: builds the scene for a level and, every frame, reads the state through queries and reacts to the
// core's events with animation, sound, shake, hit-stop, sparks and HUD messages (rule 2).
// WP0 skeleton (owner afterwards: WP1 wires every view module as it lands, each exporting build / update / handle):
// the hero, the camera rig, fx, the swarm view, a placeholder mansion and a stub HUD.
import { Color, PointLight, Vector3 } from 'three'
import cfgAll from '../config.json'
import type { GameEvent } from '../core/events'
import { floorHeightAt } from '../core/grid'
import {
  gunLoaded,
  gunMag,
  gunReserve,
  heroActionProgress,
  heroAnim,
  hpFraction,
  isAiming,
  isGrounded,
  isRunning,
  levelGrid,
  monsters,
  pickTarget,
  playerFacing,
  playerPos,
  reloadProgress,
  spawnPoints,
  strikeReadiness,
  swordCombo,
  playerSpeed,
} from '../core/queries'
import type { GameState, Sim } from '../core/state'
import { Sound } from './audio'
import { createCameraRig, type CameraRig, type RayFn } from './camera'
import { Cues, type CueState } from './cues'
import { createFx, type Fx } from './fx'
import { createHero, type HeroAim, type HeroView } from './hero'
import { createHud, t, type Hud, type HudState } from './hud'
import { createMaterials, palette } from './look'
import { Music } from './music'
import { createPerfOverlay } from './perf'
import { buildPlaceholder, type PlaceholderLevel } from './placeholder-level'
import { createRenderer, type Renderer } from './renderer'
import type { SettingsHandle } from './settings'
import { createPrompter, PROMPT_IDS, type Tips } from './tips'
import { buildWorms, type WormViews } from './worms'

const V = cfgAll.view
const J = V.juice
const T = J.trauma
const A = cfgAll.audio
const H = cfgAll.audio.hits
const DEG = Math.PI / 180

export interface GameView {
  readonly hud: Hud
  readonly sound: Sound
  /** The adaptive music; main.ts sets its flags (menu / paused) and plays its stingers. */
  readonly music: Music
  readonly rig: CameraRig
  readonly renderer: Renderer
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

const aimPt = new Vector3()
const heroAim: HeroAim = { on: false, target: null }
let aimFresh = false // aim() has run at least once, so aimPt is a real point
const muzzlePt = new Vector3()
const hiltPt = new Vector3()
const tipPt = new Vector3()
const trailColor = new Color()
const heroColor = new Color(palette.heroWhite)
const sparkWhite = new Color(2.5, 2.6, 2.8)
const sparkBlood = new Color(2.9, 0.12, 1.25)
const sparkWood = new Color(1.6, 1.1, 0.6)
const starHit = new Color(2.9, 1.2, 1.8)
const impactDir = new Vector3()

export function createGameView(canvas: HTMLCanvasElement, uiRoot: HTMLElement, s: GameState, sim: Sim, ray: RayFn, settings?: SettingsHandle, tips?: Tips): GameView {
  const r = createRenderer(canvas)
  const mats = createMaterials()
  const grid = levelGrid(sim)
  let pickState: GameState = s
  const pickFn = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number => pickTarget(pickState, sim, ox, oy, oz, dx, dy, dz, max)
  const level: PlaceholderLevel = buildPlaceholder(sim, s)
  r.scene.add(level.root)
  const wormViews: WormViews = buildWorms(s, mats)
  r.scene.add(wormViews.root)
  const hero: HeroView = createHero()
  r.scene.add(hero.root)
  // a soft key light that travels with the hero, and a rim light beyond it that draws the silhouette
  const keyLight = new PointLight(0xffe2bd, V.heroLight.intensity, V.heroLight.distance, 1.6)
  r.scene.add(keyLight)
  const rimLight = new PointLight(0x9fb8ff, V.light.heroRim, V.light.heroRimDistance, 1.4)
  r.scene.add(rimLight)
  const fx: Fx = createFx(r.camera)
  r.scene.add(fx.root)
  // a muzzle flash lights the hero's surroundings for a few frames (always in the scene, so the light count never changes)
  const muzzleLight = new PointLight(0x9fdcff, 0, 7, 1.6)
  r.scene.add(muzzleLight)
  const hud = createHud(uiRoot, V.hud.toastSec, settings, tips)
  const perf = createPerfOverlay(uiRoot)
  const sound = new Sound(A.master)
  const music = new Music(sound)
  const cues = new Cues(sound)
  const cueState: CueState = { playing: false, suspicion: 0, spotted: false, alarm: 0, hp: 1, waveIn: -1 }
  const rig = createCameraRig(r.camera, ray, playerFacing(s))
  /** Settings: reduced shake and flash (no hit-stop, camera kick, flashes). */
  let reduceFx = false
  settings?.onChange((v) => {
    sound.setVolumes({ master: v.master, music: v.music, sfx: v.sfx })
    rig.sensitivity = v.sensitivity
    rig.invertY = v.invertY
    reduceFx = v.reduceFx
    rig.reduced = v.reduceFx
    hud.marks.setReduced(v.reduceFx)
    hud.setScale(v.hudScale)
    hud.reduceFlash(v.reduceFx)
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
  const hudState: HudState = { hp: 1, gunLoaded: 0, gunMag: 12, gunReserve: 0, reloading: 0, strike: 1, aim: 0, prompt: 'none' }

  // the prompts: shown while their situation holds, retired when the player does what they ask
  const prompter = createPrompter({ minSec: cfgAll.tips.promptMinSec, maxShows: cfgAll.tips.promptMaxShows, gapSec: cfgAll.tips.promptGapSec }, [...PROMPT_IDS])
  const promptActive = new Set<string>()
  const promptDone = new Set<string>()
  let tipsOn = true
  let hintClock = 0
  settings?.onChange((v) => {
    tipsOn = v.tipsOn
  })

  /** A hit-stop (the sim and the hero freeze), never longer than the cap. */
  function stop(sec: number): void {
    if (!reduceFx && sec > 0) view.hitStop = Math.max(view.hitStop, Math.min(J.hitStopMaxSec, sec))
  }

  /** Camera trauma (rotational shake, view.juice.trauma budgets) and a kick from a hit or a kill. */
  function jolt(trauma: number, pitch: number, push: number): void {
    rig.trauma(trauma)
    rig.kick(pitch, push)
  }

  /** Streak sparks thrown from a monster hit back toward the hero (the way the shot came from). */
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

  let heroYaw = 0
  let heroYawSnap = true
  const view: GameView = {
    hud,
    sound,
    music,
    rig,
    renderer: r,
    hitStop: 0,
    handle(events, st, sm): void {
      const p = playerPos(st)
      // one swing that kills several holds the freeze a little longer
      let kills = 0
      for (const e of events) if (e.type === 'targetHit' && e.killed) kills++
      const killStop = J.killHitStopSec + J.killHitStopStepSec * Math.max(0, kills - 1)
      for (const e of events) {
        switch (e.type) {
          case 'jumped':
            sound.play('jump', 0.7)
            break
          case 'landed':
            sound.play('land', 0.7)
            shake = Math.max(shake, J.shakeLand)
            rig.trauma(T.land)
            fx.sparks(p.x, p.y + 0.05, p.z, 10, 3, sparkWood, 0.2)
            break
          case 'swordSwing':
            sound.play('sword_swing', 0.8, e.combo === 2 ? 0.82 : e.combo === 1 ? 1.08 : 1)
            trailStart = true
            break
          case 'strikeUsed':
            sound.play('sword_swing', 1, 0.6)
            rig.trauma(T.heavy)
            fx.flash(p.x, p.y + 1, p.z, sparkWhite, 2.4, 0.18)
            trailStart = true
            break
          case 'gunShot': {
            promptDone.add('aim').add('charge')
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
              if (dl < cfgAll.gun.range - 0.5) {
                const onFloor = e.toY - floorHeightAt(grid, e.toX, e.toZ) < 0.12
                const hl = Math.hypot(dx, dz)
                const nx = onFloor || hl < 0.05 ? 0 : -dx / hl
                const ny = onFloor || hl < 0.05 ? 1 : 0
                const nz = onFloor || hl < 0.05 ? 0 : -dz / hl
                const dn = dx * nx + dy * ny + dz * nz
                fx.scorch(e.toX, e.toY, e.toZ, nx, ny, nz, sparkWood)
                fx.streaks(e.toX, e.toY, e.toZ, dx - 2 * dn * nx, dy - 2 * dn * ny, dz - 2 * dn * nz, 7, 6, 0.55, sparkWood)
                fx.streaks(e.toX, e.toY, e.toZ, nx, ny, nz, 3, 4, 0.5, sparkWhite)
                fx.flash(e.toX + nx * 0.05, e.toY + ny * 0.05, e.toZ + nz * 0.05, sparkWood, 0.4, 0.08)
              }
              sound.playAt('bullet_impact', e.toX, e.toZ, 0.3 * near(e.toX, e.toY, e.toZ))
            }
            if (hasMuzzle) {
              const rs = reduceFx ? J.reducedFlash : 1
              fx.flash(muzzlePt.x, muzzlePt.y, muzzlePt.z, sparkWhite, J.muzzleFlashSize * rs, J.muzzleFlashSec)
              fx.star(muzzlePt.x, muzzlePt.y, muzzlePt.z, sparkWhite, J.muzzleStarSize * rs, J.muzzleFlashSec * 1.4)
              fx.streaks(muzzlePt.x, muzzlePt.y, muzzlePt.z, dx, dy, dz, 5, 7, 0.4, sparkWood)
              muzzleLight.position.copy(muzzlePt)
              muzzleT = J.muzzleFlashSec
            }
            hero.kick()
            hud.marks.shot()
            rig.kick(J.shotPunchPitchDeg * DEG, J.kickShotPush, (Math.random() < 0.5 ? -1 : 1) * J.shotPunchYawDeg * DEG * (0.4 + 0.6 * Math.random()))
            rig.fovKick(J.fovPunch.shotDeg)
            rig.trauma(T.shot)
            break
          }
          case 'gunEmpty':
            sound.play('rifle_empty', 0.8)
            if (time - emptyToastAt > 3) {
              emptyToastAt = time
              hud.toast(t('toast.empty'))
            }
            break
          case 'gunCharged':
            sound.play('ammo_drop', 0.6, 1.8)
            fx.flash(e.x, e.y, e.z, sparkBlood, 0.5, 0.12)
            if (e.first) promptActive.add('charge')
            break
          case 'reloadStarted':
            promptDone.add('reload')
            sound.play('ammo_drop', 0.5, 0.8)
            break
          case 'reloadDone':
            sound.play('ammo_drop', 0.6)
            break
          case 'medkitTaken':
            sound.play('checkpoint', 0.7)
            break
          case 'targetHit': {
            // the confirmation: one tick on a hit, one pop for every kind of kill, and the contact star
            if (e.killed) {
              sound.play('kill_pop', H.killPop)
              hud.marks.kill()
              fx.star(e.x, e.y, e.z, starHit, J.starSize * 1.5)
              rig.fovKick(J.fovPunch.killDeg)
            } else {
              sound.play('hit_tick', H.hitTick)
              hud.marks.hit()
              fx.star(e.x, e.y, e.z, starHit, J.starSize)
            }
            const nr = near(e.x, e.y, e.z)
            if (e.killed) {
              sound.playAt('worm_death', e.x, e.z, H.wormKill * nr)
              if (e.target === 'monster') wormViews.burst(e.index, (x, y, z) => fx.sparks(x, y, z, 12, 5, sparkBlood, 0.6))
              fx.sparks(e.x, e.y, e.z, 26, 6, sparkBlood, 0.6)
              hitStreaks(e.x, e.y, e.z, 10, 8, sparkBlood)
              if (!reduceFx) fx.flash(e.x, e.y, e.z, sparkBlood, J.killFlashSize * 0.5, J.killFlashSec)
              stop(e.byGun ? J.rifleKillHitStopSec : killStop * 0.8)
              jolt(e.byGun ? T.rifleKill : T.swordKill, J.kickHitPitch, J.kickHitPush)
            } else {
              sound.playAt('worm_hit', e.x, e.z, H.wormHit * nr)
              if (!e.byGun) sound.playAt('sword_hit', e.x, e.z, H.wormHitBlade * nr)
              if (e.target === 'monster') wormViews.flash(e.index)
              fx.sparks(e.x, e.y, e.z, 8, 4, sparkBlood, 0.4)
              hitStreaks(e.x, e.y, e.z, 6, 6, sparkBlood)
              if (!e.byGun) {
                stop(J.hitStopSec)
                jolt(T.swordHit, J.kickHitPitch, J.kickHitPush)
              }
            }
            break
          }
          case 'shieldBlocked':
            hud.marks.block()
            fx.star(e.x, e.y, e.z, sparkWhite, J.starSize * 1.1)
            sound.playAt('shield_hit', e.x, e.z, 0.6 * near(e.x, e.y, e.z))
            break
          case 'playerHurt': {
            // a meaty body hit, heavier when low; a red flash and an arc towards the source
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
            fx.sparks(p.x, p.y + 1.1, p.z, 16, 5, sparkBlood)
            break
          }
          case 'monsterPack': {
            const sp = spawnPoints(sm)[e.point]
            if (sp) sound.playAt('worm_spawn', sp.mouth.x, sp.mouth.z, H.wormSpawn * near(sp.mouth.x, sp.mouth.y, sp.mouth.z))
            break
          }
          case 'monsterWindup': {
            const m = monsters(st)[e.index]
            if (m) sound.playAt('worm_windup', m.pos.x, m.pos.z, H.wormWindup * near(m.pos.x, m.pos.y, m.pos.z))
            break
          }
          case 'monsterAttack': {
            const m = monsters(st)[e.index]
            if (m) sound.playAt('worm_bite', m.pos.x, m.pos.z, H.wormBite * near(m.pos.x, m.pos.y, m.pos.z), e.hit ? 0.9 : 1.15)
            break
          }
          case 'strikeReady':
            sound.play('ammo_drop', 0.4, 2.2)
            break
          case 'playerDied':
            sound.play('player_death', 1)
            glitch = 1.4
            rig.trauma(T.death)
            fx.sparks(p.x, p.y + 1, p.z, 160, 8, sparkWhite, 0.6)
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
      hero.root.position.set(p.x, p.y, p.z)
      // the model turns toward the core facing fast but not in one frame: a shot backwards snaps the core facing by 180 deg,
      // which read as the camera flipping (the aim solver re-measures the barrel every frame, so it stays on target)
      {
        const want = playerFacing(st)
        const d = want - heroYaw - Math.PI * 2 * Math.round((want - heroYaw) / (Math.PI * 2))
        heroYaw = heroYawSnap ? want : heroYaw + d * Math.min(1, dt * V.heroTurnRate)
        heroYawSnap = false
      }
      hero.root.rotation.y = heroYaw
      keyLight.position.set(p.x - Math.sin(rig.yaw) * V.heroLight.back, p.y + V.heroLight.height, p.z - Math.cos(rig.yaw) * V.heroLight.back)
      rimLight.position.set(p.x + Math.sin(rig.yaw) * 1.4, p.y + 2.1, p.z + Math.cos(rig.yaw) * 1.4)
      // there is no weapon switching: the gun is up exactly while RMB aims
      hero.setMode(isAiming(st) ? 'rifle' : 'sword')
      hero.setLineColor(heroColor)
      // the crosshair's world point (from this frame's aim()): the raised gun points at it, the head glances at it
      heroAim.on = isAiming(st)
      heroAim.target = aimFresh ? aimPt : null
      hero.update(fdt, anim, heroActionProgress(st, sm), playerSpeed(st), time, swordCombo(st), heroAim)
      // the sword trail follows the real blade while a swing plays
      if (anim === 'slash' && fdt > 0 && hero.blade(hiltPt, tipPt)) {
        trailColor.copy(sparkWhite).multiplyScalar(0.4)
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
        const run = isRunning(st)
        if (stride >= (run ? V.footstep.runStride : V.footstep.walkStride)) {
          stride = 0
          const CF = A.cues.footstep
          sound.play(run ? 'footstep_sprint' : 'footstep_walk', run ? CF.ceil : CF.floor + (CF.ceil - CF.floor) * 0.4)
        }
      }

      level.update(st)
      wormViews.update(st, sm, dt)
      fx.update(fdt, st)

      // the listener is the camera; the skitter of the horde is one voice, louder with more of them close by
      sound.listen(r.camera.position.x, r.camera.position.z, rig.yaw)
      let wl = 0
      for (const m of monsters(st)) if (m.active && m.alive && m.spawnTime <= 0) wl += Math.max(0, 1 - Math.hypot(m.pos.x - p.x, m.pos.z - p.z) / A.hearDist)
      sound.loop('worm_skitter_loop', A.wormSkitter * Math.min(1, wl * 0.45))

      // the camera
      shake = Math.max(0, shake - fdt * J.shakeDecay * Math.max(0.3, shake))
      const shk = reduceFx ? 0 : shake
      const sx = (Math.sin(time * 71) + Math.sin(time * 37)) * 0.5 * shk * 0.25
      const sy = (Math.sin(time * 53) + Math.sin(time * 29)) * 0.5 * shk * 0.25
      rig.update(dt, p.x, p.y, p.z, false, V.fov, sx, sy, isAiming(st))

      // post effects
      hurt = Math.max(0, hurt - dt * 2.2)
      glitch = Math.max(0, glitch - dt * J.glitchDecay)
      r.fx.hurt = Math.max(reduceFx ? Math.min(hurt, 0.25) : hurt, hpFraction(st, sm) < 0.3 ? 0.25 + (reduceFx ? 0 : 0.1 * Math.sin(time * 6)) : 0)
      r.fx.glitch = reduceFx ? 0 : Math.min(1, glitch)

      // HUD
      const h = hudState
      h.hp = hpFraction(st, sm)
      h.gunLoaded = gunLoaded(st)
      h.gunMag = gunMag(sm)
      h.gunReserve = gunReserve(st)
      h.reloading = reloadProgress(st, sm)
      h.strike = strikeReadiness(st, sm)
      h.aim = rig.aim
      hud.update(h)
      hud.marks.update(dt)

      // prompts: the situations that hold now (checked a few times a second)
      hintClock -= dt
      if (hintClock <= 0) {
        hintClock = 0.25
        promptActive.delete('aim')
        promptActive.delete('reload')
        promptActive.delete('strike')
        if (time > V.hud.hintsAfterSec) {
          if (h.gunLoaded > 0) promptActive.add('aim')
          if (h.gunLoaded === 0 && h.gunReserve > 0) promptActive.add('reload')
          let close = 0
          for (const m of monsters(st)) if (m.active && m.alive && Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < 3.5) close++
          if (close >= 4 && h.strike >= 1) promptActive.add('strike')
        }
      }
      const shown = prompter.step(dt, promptActive, promptDone, tipsOn && dt > 0 && st.phase === 'playing' && !music.flags.menu && !music.flags.paused)
      promptDone.clear()
      hud.hint(shown === null ? null : { id: shown, text: t(`hint.${shown}` as 'hint.aim') })

      // the audio cues and the music follow the state
      const mf = music.flags
      mf.lowHp = h.hp < cfgAll.audio.mixer.lowHp.below && st.phase === 'playing'
      cueState.playing = st.phase === 'playing' && dt > 0 && !mf.menu && !mf.paused
      cueState.hp = h.hp
      cues.update(cueState)
      music.want = 0
      music.update(rawDt)

      r.render(time)
      perf.frame(performance.now() - t0)
    },
    reset(st, sm): void {
      rig.yaw = playerFacing(st)
      heroYawSnap = true
      rig.snap()
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
      const my = p.y + cfgAll.gun.muzzleHeight
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
