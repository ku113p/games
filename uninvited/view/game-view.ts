// The game view: builds the scene for a level and, every frame, reads the state through queries and reacts to the
// core's events with animation, sound, shake, hit-stop, sparks, glitches and HUD messages (rule 2).
import { Color, PointLight, Vector3 } from 'three'
import cfgAll from '../config.json'
import type { GameEvent } from '../core/events'
import {
  alarmDecayFraction,
  alarmStage,
  charges,
  dashReady,
  heroActionProgress,
  heroAnim,
  heroLineColor,
  hpFraction,
  interactPrompt,
  isCrouched,
  isGrounded,
  isHiddenInNiche,
  isRunning,
  levelGrid,
  maxSuspicion,
  motionSensors,
  playerFacing,
  playerPos,
  playerSpeed,
  redWalls,
  scanActive,
  scanCooldown,
  scanHeat,
  securityStatus,
  soundCameras,
  terminals,
  videoCameras,
  drones,
  waveInfo,
  weaponMode,
  type Rgb,
} from '../core/queries'
import type { GameState, Sim } from '../core/state'
import { Sound } from './audio'
import { createCameraRig, type CameraRig, type RayFn } from './camera'
import { buildCorridors, MAX_CONES, type Corridors } from './corridors'
import { buildDrones, type DroneViews } from './drones'
import { createFx, type Fx } from './fx'
import { createHero, type HeroView } from './hero'
import { createHud, t, type Hud, type HudState } from './hud'
import { createMaterials, palette } from './look'
import { buildProps, type Props } from './props'
import { createRenderer, type Renderer } from './renderer'

const V = cfgAll.view
const J = V.juice
const A = cfgAll.audio

export interface GameView {
  readonly hud: Hud
  readonly sound: Sound
  readonly rig: CameraRig
  readonly renderer: Renderer
  /** Seconds the simulation should stay frozen (hit-stop). main.ts reads and counts it down. */
  hitStop: number
  handle(events: readonly GameEvent[], s: GameState, sim: Sim): void
  update(dt: number, s: GameState, sim: Sim): void
  /** After a load or restart: snap the camera, clear effects. */
  reset(s: GameState, sim: Sim): void
  /** Yaw and pitch from the hero's muzzle to whatever the crosshair points at. */
  aim(s: GameState, out: { yaw: number; pitch: number }): void
}

const heroColor = new Color()
const rgb: Rgb = { r: 1, g: 1, b: 1 }
const WHITE_SCALE = 2.5
const red: Rgb = { r: palette.heroRed.r / WHITE_SCALE, g: palette.heroRed.g / WHITE_SCALE, b: palette.heroRed.b / WHITE_SCALE }
const blue: Rgb = { r: palette.heroBlue.r / WHITE_SCALE, g: palette.heroBlue.g / WHITE_SCALE, b: palette.heroBlue.b / WHITE_SCALE }
const aimPt = new Vector3()
const coneColor = new Color()
const sparkWhite = new Color(2.5, 2.6, 2.8)
const sparkCyan = palette.seam
const sparkRed = palette.security

export function createGameView(canvas: HTMLCanvasElement, uiRoot: HTMLElement, s: GameState, sim: Sim, ray: RayFn): GameView {
  const r = createRenderer(canvas)
  const mats = createMaterials()
  const corridors: Corridors = buildCorridors(levelGrid(sim), mats)
  r.scene.add(corridors.root)
  const props: Props = buildProps(s, sim, mats)
  r.scene.add(props.root)
  const droneViews: DroneViews = buildDrones(s, mats)
  r.scene.add(droneViews.root)
  const hero: HeroView = createHero()
  r.scene.add(hero.root)
  // a soft key light that travels with the hero so the black suit, drones and cover read against the dark
  const keyLight = new PointLight(0x9fdcff, V.heroLight.intensity, V.heroLight.distance, 1.6)
  r.scene.add(keyLight)
  const fx: Fx = createFx()
  r.scene.add(fx.root)
  const hud = createHud(uiRoot, V.hud.toastSec, V.hud.hintSec)
  const sound = new Sound(A.master)
  const rig = createCameraRig(r.camera, ray, playerFacing(s))

  let shake = 0
  let time = 0
  let hurt = 0
  let glitch = 0
  let stride = 0
  let lastX = playerPos(s).x
  let lastZ = playerPos(s).z
  let emptyToastAt = -10
  let lastWallToast = -10
  let hintClock = 0
  const hinted = new Set<string>()
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
  }
  const waves = { wave: 0, cleared: 0, needed: 0, firewallDown: false, active: false }

  function near(x: number, y: number, z: number): number {
    const p = playerPos(s)
    const d = Math.hypot(x - p.x, y - p.y, z - p.z)
    return Math.max(0.12, Math.min(1, 1 - d / A.hearDist))
  }

  function hint(key: string, text: string): void {
    if (hinted.has(key)) return
    hinted.add(key)
    hud.hint(text)
  }

  function hints(st: GameState): void {
    const p = playerPos(st)
    const d2 = (x: number, z: number): number => (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z)
    for (const c of videoCameras(st)) if (c.alive && d2(c.pos.x, c.pos.z) < 15 * 15) hint('camera', t('hint.camera'))
    for (const m of motionSensors(st)) if (d2(m.pos.x, m.pos.z) < 9 * 9) hint('sensor', t('hint.sensor'))
    for (const c of soundCameras(st)) if (c.alive && d2(c.pos.x, c.pos.z) < (cfgAll.soundCamera.radius + 4) ** 2) hint('sound', t('hint.sound'))
    for (const w of redWalls(st)) {
      const mx = w.alongX ? w.coord : (w.min + w.max) / 2
      const mz = w.alongX ? (w.min + w.max) / 2 : w.coord
      if (!w.open && d2(mx, mz) < 8 * 8) hint('redWall', t('hint.redWall'))
    }
    for (const term of terminals(st)) if (!term.done && d2(term.pos.x, term.pos.z) < 4 * 4) hint('terminal', t('hint.terminal'))
  }

  const view: GameView = {
    hud,
    sound,
    rig,
    renderer: r,
    hitStop: 0,
    handle(events, st, sm): void {
      const p = playerPos(st)
      for (const e of events) {
        switch (e.type) {
          case 'jumped':
            sound.play('jump', 0.7)
            break
          case 'landed':
            sound.play('land', 0.7)
            shake = Math.max(shake, J.shakeLand)
            fx.sparks(p.x, p.y + 0.05, p.z, 10, 3, sparkCyan, 0.2)
            break
          case 'dashed':
            sound.play('dash', 0.8)
            shake = Math.max(shake, J.shakeDash)
            fx.sparks(p.x, p.y + 1, p.z, 18, 4, sparkWhite, 0.1)
            break
          case 'crouchChanged':
            sound.play('crouch_toggle', 0.6)
            break
          case 'swordSwing':
            sound.play('sword_swing', 0.8)
            fx.slash(p.x, p.y + 1.15, p.z, e.yaw)
            break
          case 'rifleShot':
            sound.play('rifle_shot', 0.55)
            fx.tracer(e.fromX, e.fromY, e.fromZ, e.toX, e.toY, e.toZ)
            fx.sparks(e.toX, e.toY, e.toZ, e.hit ? 4 : 8, 3, e.hit ? sparkWhite : sparkCyan)
            shake = Math.max(shake, J.shakeShot)
            if (!e.hit) sound.play('bullet_impact', 0.3 * near(e.toX, e.toY, e.toZ))
            break
          case 'rifleEmpty':
            sound.play('rifle_empty', 0.8)
            if (time - emptyToastAt > 3) {
              emptyToastAt = time
              hud.toast(t('toast.empty'))
            }
            break
          case 'modeSwitched':
            sound.play('ammo_drop', 0.6)
            break
          case 'targetHit':
            if (e.killed) {
              sound.play('derez', 0.9 * near(e.x, e.y, e.z))
              sound.play('glitch', 0.6)
              fx.sparks(e.x, e.y, e.z, 90, 9, sparkRed, 0.3)
              fx.sparks(e.x, e.y, e.z, 50, 6, sparkWhite, 0.5)
              view.hitStop = Math.max(view.hitStop, J.killHitStopSec)
              shake = Math.max(shake, J.shakeKill)
              glitch = Math.max(glitch, J.glitchKill)
            } else {
              sound.play(e.byRifle ? 'bullet_impact' : 'sword_hit', 0.85)
              fx.sparks(e.x, e.y, e.z, e.byRifle ? 14 : 28, e.byRifle ? 5 : 7, e.byRifle ? sparkWhite : sparkRed)
              view.hitStop = Math.max(view.hitStop, e.byRifle ? J.hitStopSec * 0.5 : J.hitStopSec)
              shake = Math.max(shake, e.byRifle ? J.shakeShot * 2 : J.shakeHit)
            }
            break
          case 'playerHurt':
            sound.play('player_hurt', 0.9)
            hurt = 1
            shake = Math.max(shake, J.shakeHurt)
            glitch = Math.max(glitch, J.glitchHurt)
            view.hitStop = Math.max(view.hitStop, J.hurtHitStopSec)
            fx.sparks(p.x, p.y + 1.1, p.z, 16, 5, sparkRed)
            break
          case 'playerDied':
            sound.play('player_death', 1)
            glitch = 1.4
            shake = 1
            fx.sparks(p.x, p.y + 1, p.z, 160, 8, sparkWhite, 0.6)
            break
          case 'droneFired': {
            const d = drones(st)[e.index]
            if (d) sound.play('drone_shot', 0.7 * near(d.pos.x, d.pos.y, d.pos.z))
            break
          }
          case 'boltHit':
            if (!e.player) {
              fx.sparks(e.x, e.y, e.z, 6, 3, sparkRed)
              sound.play('bullet_impact', 0.2 * near(e.x, e.y, e.z))
            }
            break
          case 'droneSuspicious': {
            const d = drones(st)[e.index]
            if (d) sound.play('suspicion_rise', 0.55 * near(d.pos.x, d.pos.y, d.pos.z))
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
            fx.noiseRing(e.x, e.y - 1, e.z, e.radius)
            break
          case 'alarmRaised':
            sound.play(e.stage >= 2 ? 'alarm_2' : 'alarm_1', 0.8)
            hud.toast(t(e.stage === 1 ? 'toast.alarm1' : e.stage === 2 ? 'toast.alarm2' : 'toast.alarm3'), 'alarm')
            glitch = Math.max(glitch, J.glitchAlarm)
            break
          case 'alarmLowered':
            hud.toast(t('toast.alarmDown', { stage: e.stage }), 'good')
            break
          case 'waveStarted':
            sound.play('wave_spawn', 0.9)
            hud.toast(t('toast.wave', { wave: e.wave }), 'alarm')
            break
          case 'firewallDropped':
            sound.play('firewall_drop', 1)
            hud.toast(t('toast.firewall'), 'good')
            glitch = Math.max(glitch, J.glitchWall)
            lastWallToast = time
            break
          case 'wallOpened':
            if (time - lastWallToast > 0.5) {
              sound.play('firewall_drop', 0.9)
              hud.toast(t('toast.wallOpen'), 'good')
              glitch = Math.max(glitch, J.glitchWall)
              lastWallToast = time
            }
            break
          case 'devicePaused':
            sound.play('camera_pause', 0.8)
            hud.toast(t('toast.paused', { sec: Math.round(e.sec) }), 'good')
            break
          case 'scanOn':
            sound.play('scan_on', 0.6)
            break
          case 'scanOff':
            sound.play('scan_off', 0.5)
            break
          case 'scanOverheating':
            sound.play('scan_overheat', 0.8)
            hud.toast(t('toast.scanHot'), 'alarm')
            break
          case 'scanOverheated':
            glitch = Math.max(glitch, J.glitchAlarm)
            break
          case 'hackTimedOut':
            hud.toast(t('toast.hackFailed'), 'alarm')
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
    update(dt, st, sm): void {
      time += dt
      const p = playerPos(st)
      const anim = heroAnim(st, sm)
      // the hero
      hero.root.position.set(p.x, p.y, p.z)
      hero.root.rotation.y = playerFacing(st)
      keyLight.position.set(p.x - Math.sin(rig.yaw) * V.heroLight.back, p.y + V.heroLight.height, p.z - Math.cos(rig.yaw) * V.heroLight.back)
      hero.setMode(weaponMode(st))
      heroLineColor(st, sm, red, blue, rgb)
      heroColor.setRGB(rgb.r * WHITE_SCALE, rgb.g * WHITE_SCALE, rgb.b * WHITE_SCALE)
      hero.setLineColor(heroColor)
      hero.update(dt, anim, heroActionProgress(st, sm), playerSpeed(st), time)

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
          if (crouched) sound.play('footstep_sneak', 0.5)
          else sound.play('footstep_run', run ? 0.6 : 0.3)
        }
      }

      // floor fans of every view cone
      let nc = 0
      const vc = cfgAll.videoCamera
      const cp = Math.cos((vc.pitchDeg * Math.PI) / 180)
      const sp = Math.sin((vc.pitchDeg * Math.PI) / 180)
      const camCos = Math.cos((vc.halfAngleDeg * Math.PI) / 180)
      for (const c of videoCameras(st)) {
        if (!c.alive || c.pausedTime > 0) continue
        coneColor.copy(palette.security).lerp(palette.suspicious, c.suspicion < 1 ? Math.min(1, c.suspicion * 1.5) : 0)
        corridors.setCone(nc++, c.pos.x, c.pos.y, c.pos.z, Math.sin(c.yaw) * cp, -sp, Math.cos(c.yaw) * cp, camCos, vc.range, coneColor, 0.9 + c.suspicion)
      }
      const dc = cfgAll.drone
      const dp = Math.cos((dc.pitchDeg * Math.PI) / 180)
      const dsp = Math.sin((dc.pitchDeg * Math.PI) / 180)
      const droneCos = Math.cos((dc.halfAngleDeg * Math.PI) / 180)
      for (const d of drones(st)) {
        if (nc >= MAX_CONES) break
        if (!d.active || !d.alive || d.pausedTime > 0 || d.spawnTime > 0) continue
        coneColor.copy(palette.security).lerp(palette.suspicious, d.mode === 'alert' ? 0 : Math.min(1, d.suspicion * 1.6))
        corridors.setCone(nc++, d.pos.x, d.pos.y, d.pos.z, Math.sin(d.yaw) * dp, -dsp, Math.cos(d.yaw) * dp, droneCos, dc.range, coneColor, d.mode === 'alert' ? 1.6 : 0.8 + d.suspicion)
      }
      corridors.setConeCount(nc)

      props.update(st, sm, dt)
      droneViews.update(st, dt, r.camera)
      fx.update(dt, st)

      // loops by distance to the nearest drone / camera, alarm 3 siren
      let dn = 1e9
      for (const d of drones(st)) if (d.active && d.alive) dn = Math.min(dn, Math.hypot(d.pos.x - p.x, d.pos.z - p.z))
      let cn = 1e9
      for (const c of videoCameras(st)) if (c.alive && c.pausedTime <= 0) cn = Math.min(cn, Math.hypot(c.pos.x - p.x, c.pos.z - p.z))
      sound.loop('drone_hum_loop', A.droneHum * Math.max(0, 1 - dn / A.hearDist))
      sound.loop('camera_servo_loop', A.cameraServo * Math.max(0, 1 - cn / (A.hearDist * 0.7)))
      const stage = alarmStage(st)
      sound.loop('alarm_3_loop', stage >= 3 && st.phase === 'playing' ? A.alarmLoop : 0)

      // the camera
      shake = Math.max(0, shake - dt * J.shakeDecay * Math.max(0.3, shake))
      const sx = (Math.sin(time * 71) + Math.sin(time * 37)) * 0.5 * shake * 0.25
      const sy = (Math.sin(time * 53) + Math.sin(time * 29)) * 0.5 * shake * 0.25
      const fov = anim === 'dash' ? V.dashFov : V.fov
      rig.update(dt, p.x, p.y, p.z, isCrouched(st), fov, sx, sy)

      // post effects
      hurt = Math.max(0, hurt - dt * 2.2)
      glitch = Math.max(0, glitch - dt * J.glitchDecay)
      r.fx.hurt = Math.max(hurt, hpFraction(st, sm) < 0.3 ? 0.25 + 0.1 * Math.sin(time * 6) : 0)
      r.fx.glitch = Math.min(1, glitch)
      r.fx.scan += ((scanActive(st) ? 1 : 0) - r.fx.scan) * Math.min(1, dt * 10)
      r.fx.alarm = stage >= 3 ? 1 : stage * 0.2
      corridors.setAlarm(stage >= 3 ? 1 : stage * 0.25, time)

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
      h.prompt = interactPrompt(st, sm)
      waveInfo(st, sm, waves)
      h.wave = waves.wave
      h.wavesCleared = waves.cleared
      h.wavesNeeded = waves.needed
      h.firewallDown = waves.firewallDown
      h.crouched = isCrouched(st)
      hud.update(h)
      if (time > 1.5) hint('start', t('hint.start'))
      if (h.niche) hint('niche', t('hint.niche'))
      hintClock -= dt
      if (hintClock <= 0 && time > V.hud.hintsAfterSec) {
        hintClock = 0.25
        hints(st)
      }

      r.render(time)
    },
    reset(st, sm): void {
      rig.yaw = playerFacing(st)
      rig.snap()
      props.reset(st)
      lastX = playerPos(st).x
      lastZ = playerPos(st).z
      shake = 0
      hurt = 0
      glitch = 0.6
      void sm
    },
    aim(st, out): void {
      rig.aimPoint(aimPt)
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
