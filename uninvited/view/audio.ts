// Sound effects (audio/sfx, all made by our own synthesizer code) through one Web Audio context, unlocked by the
// "Click to start" screen. Files are fetched at load and decoded on unlock. A name like "glitch" plays a random
// variant (glitch_v1..v5), never the same one twice in a row.
//
// The mixer: every sound goes through a bus (player / enemy / ui+voice / music / ambience) -> master gain -> a lowpass
// (the low-HP muffle) -> a DynamicsCompressor used as a limiter -> destination. Each sound group has a voice limit (the
// oldest voice is dropped), the frequent ones get a +-5% random pitch, derez plays at most once per 80 ms, and sounds
// with a position are panned by their azimuth relative to the camera (StereoPanner, no HRTF). The drone hum and the
// camera servo are a few loop voices (the nearest sources), each panned. All numbers: config.json audio.mixer.
import cfgAll from '../config.json'
import jump from '../audio/sfx/jump.mp3'
import dash from '../audio/sfx/dash.mp3'
import crouchToggle from '../audio/sfx/crouch_toggle.mp3'
import swordSwingV1 from '../audio/sfx/sword_swing_v1.mp3'
import swordSwingV2 from '../audio/sfx/sword_swing_v2.mp3'
import swordSwingV3 from '../audio/sfx/sword_swing_v3.mp3'
import swordHitV1 from '../audio/sfx/sword_hit_v1.mp3'
import swordHitV2 from '../audio/sfx/sword_hit_v2.mp3'
import swordHitV3 from '../audio/sfx/sword_hit_v3.mp3'
import derez from '../audio/sfx/derez.mp3'
import rifleShotV1 from '../audio/sfx/rifle_shot_v1.mp3'
import rifleShotV2 from '../audio/sfx/rifle_shot_v2.mp3'
import rifleShotV3 from '../audio/sfx/rifle_shot_v3.mp3'
import rifleEmpty from '../audio/sfx/rifle_empty.mp3'
import bulletImpactV1 from '../audio/sfx/bullet_impact_v1.mp3'
import bulletImpactV2 from '../audio/sfx/bullet_impact_v2.mp3'
import bulletImpactV3 from '../audio/sfx/bullet_impact_v3.mp3'
import playerHurtV1 from '../audio/sfx/player_hurt_v1.mp3'
import playerHurtV2 from '../audio/sfx/player_hurt_v2.mp3'
import playerDeath from '../audio/sfx/player_death.mp3'
import droneHumLoop from '../audio/sfx/drone_hum_loop.mp3'
import droneAlert from '../audio/sfx/drone_alert.mp3'
import droneShot from '../audio/sfx/drone_shot.mp3'
import cameraServoLoop from '../audio/sfx/camera_servo_loop.mp3'
import cameraSpotted from '../audio/sfx/camera_spotted.mp3'
import soundCameraPing from '../audio/sfx/sound_camera_ping.mp3'
import motionSensorTrip from '../audio/sfx/motion_sensor_trip.mp3'
import alarm1 from '../audio/sfx/alarm_1.mp3'
import alarm2 from '../audio/sfx/alarm_2.mp3'
import alarm3Loop from '../audio/sfx/alarm_3_loop.mp3'
import waveSpawn from '../audio/sfx/wave_spawn.mp3'
import suspicionRise from '../audio/sfx/suspicion_rise.mp3'
import scanOn from '../audio/sfx/scan_on.mp3'
import scanOff from '../audio/sfx/scan_off.mp3'
import scanOverheat from '../audio/sfx/scan_overheat.mp3'
import cameraPause from '../audio/sfx/camera_pause.mp3'
import firewallDrop from '../audio/sfx/firewall_drop.mp3'
import checkpoint from '../audio/sfx/checkpoint.mp3'
import artifactPickup from '../audio/sfx/artifact_pickup.mp3'
import glitchV1 from '../audio/sfx/glitch_v1.mp3'
import glitchV2 from '../audio/sfx/glitch_v2.mp3'
import glitchV3 from '../audio/sfx/glitch_v3.mp3'
import glitchV4 from '../audio/sfx/glitch_v4.mp3'
import glitchV5 from '../audio/sfx/glitch_v5.mp3'
import uiClick from '../audio/sfx/ui_click.mp3'
import uiConfirm from '../audio/sfx/ui_confirm.mp3'
import uiBack from '../audio/sfx/ui_back.mp3'
import ammoDrop from '../audio/sfx/ammo_drop.mp3'
import jackIn from '../audio/sfx/jack_in.mp3'
import shieldHit from '../audio/sfx/shield_hit.mp3'
import playerHitV1 from '../audio/sfx/player_hit_v1.mp3'
import playerHitV2 from '../audio/sfx/player_hit_v2.mp3'
import playerHitV3 from '../audio/sfx/player_hit_v3.mp3'
import droneHitV1 from '../audio/sfx/drone_hit_v1.mp3'
import droneHitV2 from '../audio/sfx/drone_hit_v2.mp3'
import droneHitV3 from '../audio/sfx/drone_hit_v3.mp3'
import droneKill from '../audio/sfx/drone_kill.mp3'
import wormHitV1 from '../audio/sfx/worm_hit_v1.mp3'
import wormHitV2 from '../audio/sfx/worm_hit_v2.mp3'
import wormHitV3 from '../audio/sfx/worm_hit_v3.mp3'
import wormDeathV1 from '../audio/sfx/worm_death_v1.mp3'
import wormDeathV2 from '../audio/sfx/worm_death_v2.mp3'
import wormDeathV3 from '../audio/sfx/worm_death_v3.mp3'
import wormWindupV1 from '../audio/sfx/worm_windup_v1.mp3'
import wormWindupV2 from '../audio/sfx/worm_windup_v2.mp3'
import wormBiteV1 from '../audio/sfx/worm_bite_v1.mp3'
import wormBiteV2 from '../audio/sfx/worm_bite_v2.mp3'
import footstepWalkV1 from '../audio/sfx/footstep_walk_v1.mp3'
import footstepWalkV2 from '../audio/sfx/footstep_walk_v2.mp3'
import footstepWalkV3 from '../audio/sfx/footstep_walk_v3.mp3'
import footstepWalkV4 from '../audio/sfx/footstep_walk_v4.mp3'
import footstepWalkV5 from '../audio/sfx/footstep_walk_v5.mp3'
import footstepWalkV6 from '../audio/sfx/footstep_walk_v6.mp3'
import footstepSprintV1 from '../audio/sfx/footstep_sprint_v1.mp3'
import footstepSprintV2 from '../audio/sfx/footstep_sprint_v2.mp3'
import footstepSprintV3 from '../audio/sfx/footstep_sprint_v3.mp3'
import footstepSprintV4 from '../audio/sfx/footstep_sprint_v4.mp3'
import footstepSprintV5 from '../audio/sfx/footstep_sprint_v5.mp3'
import footstepSprintV6 from '../audio/sfx/footstep_sprint_v6.mp3'
import footstepSneakV1 from '../audio/sfx/footstep_sneak_v1.mp3'
import footstepSneakV2 from '../audio/sfx/footstep_sneak_v2.mp3'
import footstepSneakV3 from '../audio/sfx/footstep_sneak_v3.mp3'
import footstepSneakV4 from '../audio/sfx/footstep_sneak_v4.mp3'
import footstepSneakV5 from '../audio/sfx/footstep_sneak_v5.mp3'
import landV1 from '../audio/sfx/land_v1.mp3'
import landV2 from '../audio/sfx/land_v2.mp3'
import landV3 from '../audio/sfx/land_v3.mp3'
import landV4 from '../audio/sfx/land_v4.mp3'
import landV5 from '../audio/sfx/land_v5.mp3'
import wardenStepV1 from '../audio/sfx/warden_step_v1.mp3'
import wardenStepV2 from '../audio/sfx/warden_step_v2.mp3'
import wardenStepV3 from '../audio/sfx/warden_step_v3.mp3'
import wardenStepV4 from '../audio/sfx/warden_step_v4.mp3'
import wardenStepV5 from '../audio/sfx/warden_step_v5.mp3'
import gateOpen from '../audio/sfx/gate_open.mp3'
import wormSkitterLoop from '../audio/sfx/worm_skitter_loop.mp3'
import wormSpawn from '../audio/sfx/worm_spawn.mp3'

const FILES: Record<string, string> = {
  jump: jump,
  footstep_walk_v1: footstepWalkV1,
  footstep_walk_v2: footstepWalkV2,
  footstep_walk_v3: footstepWalkV3,
  footstep_walk_v4: footstepWalkV4,
  footstep_walk_v5: footstepWalkV5,
  footstep_walk_v6: footstepWalkV6,
  footstep_sprint_v1: footstepSprintV1,
  footstep_sprint_v2: footstepSprintV2,
  footstep_sprint_v3: footstepSprintV3,
  footstep_sprint_v4: footstepSprintV4,
  footstep_sprint_v5: footstepSprintV5,
  footstep_sprint_v6: footstepSprintV6,
  footstep_sneak_v1: footstepSneakV1,
  footstep_sneak_v2: footstepSneakV2,
  footstep_sneak_v3: footstepSneakV3,
  footstep_sneak_v4: footstepSneakV4,
  footstep_sneak_v5: footstepSneakV5,
  land_v1: landV1,
  land_v2: landV2,
  land_v3: landV3,
  land_v4: landV4,
  land_v5: landV5,
  warden_step_v1: wardenStepV1,
  warden_step_v2: wardenStepV2,
  warden_step_v3: wardenStepV3,
  warden_step_v4: wardenStepV4,
  warden_step_v5: wardenStepV5,
  gate_open: gateOpen,
  dash: dash,
  crouch_toggle: crouchToggle,
  sword_swing_v1: swordSwingV1,
  sword_swing_v2: swordSwingV2,
  sword_swing_v3: swordSwingV3,
  sword_hit_v1: swordHitV1,
  sword_hit_v2: swordHitV2,
  sword_hit_v3: swordHitV3,
  derez: derez,
  rifle_shot_v1: rifleShotV1,
  rifle_shot_v2: rifleShotV2,
  rifle_shot_v3: rifleShotV3,
  rifle_empty: rifleEmpty,
  bullet_impact_v1: bulletImpactV1,
  bullet_impact_v2: bulletImpactV2,
  bullet_impact_v3: bulletImpactV3,
  player_hurt_v1: playerHurtV1,
  player_hurt_v2: playerHurtV2,
  player_death: playerDeath,
  drone_hum_loop: droneHumLoop,
  drone_alert: droneAlert,
  drone_shot: droneShot,
  camera_servo_loop: cameraServoLoop,
  camera_spotted: cameraSpotted,
  sound_camera_ping: soundCameraPing,
  motion_sensor_trip: motionSensorTrip,
  alarm_1: alarm1,
  alarm_2: alarm2,
  alarm_3_loop: alarm3Loop,
  wave_spawn: waveSpawn,
  suspicion_rise: suspicionRise,
  scan_on: scanOn,
  scan_off: scanOff,
  scan_overheat: scanOverheat,
  camera_pause: cameraPause,
  firewall_drop: firewallDrop,
  checkpoint: checkpoint,
  artifact_pickup: artifactPickup,
  glitch_v1: glitchV1,
  glitch_v2: glitchV2,
  glitch_v3: glitchV3,
  glitch_v4: glitchV4,
  glitch_v5: glitchV5,
  ui_click: uiClick,
  ui_confirm: uiConfirm,
  ui_back: uiBack,
  ammo_drop: ammoDrop,
  jack_in: jackIn,
  shield_hit: shieldHit,
  player_hit_v1: playerHitV1,
  player_hit_v2: playerHitV2,
  player_hit_v3: playerHitV3,
  drone_hit_v1: droneHitV1,
  drone_hit_v2: droneHitV2,
  drone_hit_v3: droneHitV3,
  drone_kill: droneKill,
  worm_hit_v1: wormHitV1,
  worm_hit_v2: wormHitV2,
  worm_hit_v3: wormHitV3,
  worm_death_v1: wormDeathV1,
  worm_death_v2: wormDeathV2,
  worm_death_v3: wormDeathV3,
  worm_windup_v1: wormWindupV1,
  worm_windup_v2: wormWindupV2,
  worm_bite_v1: wormBiteV1,
  worm_bite_v2: wormBiteV2,
  worm_skitter_loop: wormSkitterLoop,
  worm_spawn: wormSpawn,
}

const M = cfgAll.audio.mixer

export type LoopName = 'drone_hum_loop' | 'camera_servo_loop' | 'alarm_3_loop' | 'worm_skitter_loop'
/** The loops that have one voice per source (the nearest few), each panned. */
export type PooledLoop = 'drone_hum_loop' | 'camera_servo_loop'
export type BusName = 'player' | 'enemy' | 'ui' | 'music' | 'ambience'

interface Policy {
  bus: BusName
  group?: keyof typeof M.voiceLimit
  jitter?: boolean
  /** Minimum time between two plays of this name, s (the rest are dropped). */
  gap?: number
}

const P = (bus: BusName, group?: Policy['group'], jitter = false, gap?: number): Policy => (gap === undefined ? { bus, group, jitter } : { bus, group, jitter, gap })
const POLICY: Record<string, Policy> = {
  footstep_walk: P('player', 'footstep', true),
  footstep_sprint: P('player', 'footstep', true),
  footstep_sneak: P('player', 'footstep', true),
  warden_step: P('enemy', undefined, true),
  sword_swing: P('player', 'shot', true),
  rifle_shot: P('player', 'shot', true),
  sword_hit: P('player', 'hit', true),
  drone_hit: P('enemy', 'hit', true),
  worm_hit: P('enemy', 'hit', true),
  bullet_impact: P('player', 'hit', true),
  drone_kill: P('enemy', 'kill', true),
  worm_death: P('enemy', 'kill', true),
  derez: P('enemy', 'derez', true, M.derezGapSec),
  glitch: P('enemy', 'glitch', true, M.glitchGapSec),
  player_hit: P('ui'),
  player_hurt: P('ui'),
  player_death: P('ui'),
  alarm_1: P('ui'),
  alarm_2: P('ui'),
  wave_spawn: P('ui'),
  suspicion_rise: P('enemy'),
  checkpoint: P('ui'),
  artifact_pickup: P('ui'),
  jack_in: P('ui'),
  firewall_drop: P('ui'),
  camera_spotted: P('ui'),
  sound_camera_ping: P('enemy'),
  motion_sensor_trip: P('enemy'),
}
const DEFAULT_PLAYER = P('player')
const DEFAULT_ENEMY = P('enemy')
const DEFAULT_UI = P('ui')

function policyOf(name: string): Policy {
  const known = POLICY[name]
  if (known) return known
  if (name.startsWith('ui_') || name.startsWith('scan_')) return DEFAULT_UI
  if (name.startsWith('drone_') || name.startsWith('worm_') || name.startsWith('warden_') || name.startsWith('gate_') || name.startsWith('camera_')) return DEFAULT_ENEMY
  return DEFAULT_PLAYER
}

interface Voice {
  src: AudioBufferSourceNode
  g: GainNode
}

interface PoolVoice {
  g: GainNode
  pan: StereoPannerNode | null
}

export interface Volumes {
  master: number
  music: number
  sfx: number
}

const dbGain = (db: number): number => Math.pow(10, db / 20)

export class Sound {
  ctx: AudioContext | null = null
  private master: GainNode | null = null
  private lowpass: BiquadFilterNode | null = null
  private readonly buses = new Map<BusName, GainNode>()
  /** The ui/voice bus: the hack overlay and the warden's live sounds play here (so they share the master volume). */
  bus: GainNode | null = null
  private readonly raw = new Map<string, Promise<ArrayBuffer>>()
  private readonly groups = new Map<string, AudioBuffer[]>()
  private readonly lastVariant = new Map<string, number>()
  private readonly loops = new Map<string, GainNode>()
  private readonly pools = new Map<PooledLoop, PoolVoice[]>()
  private readonly voices = new Map<string, Voice[]>()
  private readonly lastPlay = new Map<string, number>()
  private total = 0
  private volumes: Volumes = { master: 1, music: 1, sfx: 1 }
  private hackDuck = 1
  private readyFns: Array<() => void> = []
  /** The listener (camera): position and yaw, set by the game view every frame. */
  private lx = 0
  private lz = 0
  private lyaw = 0
  ready = false

  constructor(private readonly volume: number) {
    for (const [name, url] of Object.entries(FILES)) {
      this.raw.set(
        name,
        fetch(url)
          .then((r) => r.arrayBuffer())
          .catch(() => new ArrayBuffer(0)),
      )
    }
  }

  /** Call from a click: creates the context and the mixer, decodes every file once, starts the loops silent. */
  async unlock(): Promise<void> {
    if (this.ctx) return
    let ctx: AudioContext
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
    this.ctx = ctx
    this.master = ctx.createGain()
    this.lowpass = ctx.createBiquadFilter()
    this.lowpass.type = 'lowpass'
    this.lowpass.frequency.value = 22000
    this.lowpass.Q.value = 0.5
    const lim = ctx.createDynamicsCompressor()
    lim.threshold.value = M.limiter.thresholdDb
    lim.knee.value = M.limiter.kneeDb
    lim.ratio.value = M.limiter.ratio
    lim.attack.value = M.limiter.attackSec
    lim.release.value = M.limiter.releaseSec
    this.master.connect(this.lowpass).connect(lim).connect(ctx.destination)
    for (const name of ['player', 'enemy', 'ui', 'music', 'ambience'] as const) {
      const g = ctx.createGain()
      g.connect(this.master)
      this.buses.set(name, g)
    }
    this.bus = this.buses.get('ui') ?? null
    this.applyGains()
    await ctx.resume().catch(() => undefined)
    await Promise.all(
      [...this.raw].map(async ([name, bytes]) => {
        try {
          const data = await bytes
          if (data.byteLength === 0) return
          const buf = await ctx.decodeAudioData(data)
          const group = name.replace(/_v\d+$/, '')
          const list = this.groups.get(group) ?? []
          list.push(buf)
          this.groups.set(group, list)
        } catch {
          // a broken file stays silent
        }
      }),
    )
    for (const name of ['alarm_3_loop', 'worm_skitter_loop'] as const) this.startLoop(name)
    for (const name of ['drone_hum_loop', 'camera_servo_loop'] as const) this.startPool(name)
    this.ready = true
    for (const fn of this.readyFns) fn()
    this.readyFns = []
  }

  /** Runs fn once the mixer exists (now, if it already does). */
  onReady(fn: () => void): void {
    if (this.ctx && this.master) fn()
    else this.readyFns.push(fn)
  }

  /** A mixer bus (null before unlock). */
  busNode(name: BusName): GainNode | null {
    return this.buses.get(name) ?? null
  }

  /** The destination for the enemies' live-synthesized sounds. */
  get enemyBus(): GainNode | null {
    return this.buses.get('enemy') ?? null
  }

  private applyGains(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    this.master.gain.setTargetAtTime(this.volume * this.volumes.master, now, 0.03)
    const sfx = this.volumes.sfx
    const world = sfx * this.hackDuck
    for (const [name, g] of this.buses) {
      const v = name === 'music' ? this.volumes.music : name === 'ui' ? sfx : world
      g.gain.setTargetAtTime(M.bus[name] * v, now, 0.05)
    }
  }

  /** Master / music / SFX volume, 0..1 each (the settings menu). */
  setVolumes(v: Volumes): void {
    this.volumes = { ...v }
    this.applyGains()
  }

  /** The hack overlay is open: the world (player, enemies, ambience) steps back so the hack sounds read. */
  setHackDuck(on: boolean): void {
    const k = on ? dbGain(M.hackDuckDb) : 1
    if (k === this.hackDuck) return
    this.hackDuck = k
    this.applyGains()
  }

  /** Low HP: 0 = clear, 1 = the master lowpass fully closed (a muffled "ears ringing" sound). Call every frame, it is smoothed. */
  setMuffle(k: number): void {
    const ctx = this.ctx
    if (!ctx || !this.lowpass) return
    const c = Math.max(0, Math.min(1, k))
    const hz = 22000 * Math.pow(M.lowHp.muffleHz / 22000, c)
    this.lowpass.frequency.setTargetAtTime(hz, ctx.currentTime, M.lowHp.muffleSec)
  }

  /** Where the listener is (the camera): sounds with a position are panned relative to its yaw. */
  listen(x: number, z: number, yaw: number): void {
    this.lx = x
    this.lz = z
    this.lyaw = yaw
  }

  /** -1 (left) .. 1 (right) of a world point seen from the camera. */
  panOf(x: number, z: number): number {
    const dx = x - this.lx
    const dz = z - this.lz
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) return 0
    // the camera's right is (-cos yaw, sin yaw)
    const right = (-Math.cos(this.lyaw) * dx + Math.sin(this.lyaw) * dz) / d
    return right * M.pan.width * Math.min(1, d / M.pan.minDist)
  }

  private startLoop(name: LoopName): void {
    const ctx = this.ctx
    const buf = this.groups.get(name)?.[0]
    if (!ctx || !buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(g).connect(this.buses.get(name === 'alarm_3_loop' ? 'ambience' : 'enemy') as GainNode)
    src.start()
    this.loops.set(name, g)
  }

  private startPool(name: PooledLoop): void {
    const ctx = this.ctx
    const buf = this.groups.get(name)?.[0]
    if (!ctx || !buf) return
    const list: PoolVoice[] = []
    for (let i = 0; i < M.loopVoices; i++) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const g = ctx.createGain()
      g.gain.value = 0
      const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null
      if (pan) src.connect(g).connect(pan).connect(this.buses.get('enemy') as GainNode)
      else src.connect(g).connect(this.buses.get('enemy') as GainNode)
      // each voice starts at another place of the loop: the same file twice would phase and comb
      src.start(0, (buf.duration * (i + 0.37)) / (M.loopVoices + 1))
      list.push({ g, pan })
    }
    this.pools.set(name, list)
  }

  /** Sets a loop's volume, smoothed (call every frame; no allocations). */
  loop(name: LoopName, vol: number): void {
    const g = this.loops.get(name)
    const ctx = this.ctx
    if (!g || !ctx) return
    g.gain.setTargetAtTime(vol, ctx.currentTime, M.loopFadeSec)
  }

  /** One voice of a pooled loop (slot 0..loopVoices-1): its volume and the world position it sounds from (panned). */
  loopAt(name: PooledLoop, slot: number, vol: number, x: number, z: number): void {
    const v = this.pools.get(name)?.[slot]
    const ctx = this.ctx
    if (!v || !ctx) return
    v.g.gain.setTargetAtTime(vol, ctx.currentTime, M.loopFadeSec)
    if (v.pan && vol > 0.001) v.pan.pan.setTargetAtTime(this.panOf(x, z), ctx.currentTime, 0.08)
  }

  /** Plays a one-shot; a group name picks a variant at random (never the same twice in a row). */
  play(name: string, vol = 1, rate = 1): void {
    this.start(name, vol, rate, null, 0)
  }

  /** Like play(), from a world position: panned by its azimuth relative to the camera. */
  playAt(name: string, x: number, z: number, vol = 1, rate = 1): void {
    this.start(name, vol, rate, x, z)
  }

  private start(name: string, vol: number, rate: number, x: number | null, z: number): void {
    const ctx = this.ctx
    const list = this.groups.get(name)
    if (!ctx || !list || list.length === 0 || vol <= 0.001) return
    const pol = policyOf(name)
    const now = ctx.currentTime
    if (pol.gap !== undefined) {
      const last = this.lastPlay.get(name) ?? -10
      if (now - last < pol.gap) return
      this.lastPlay.set(name, now)
    }
    // random variant, not the one just played
    let idx = 0
    if (list.length > 1) {
      const prev = this.lastVariant.get(name) ?? -1
      idx = Math.floor(Math.random() * (list.length - 1))
      if (idx >= prev && prev >= 0) idx++
      this.lastVariant.set(name, idx)
    }
    const src = ctx.createBufferSource()
    src.buffer = list[idx] as AudioBuffer
    src.playbackRate.value = pol.jitter ? rate * (1 + (Math.random() * 2 - 1) * M.pitchJitter) : rate
    const g = ctx.createGain()
    g.gain.value = vol
    const bus = this.buses.get(pol.bus) as GainNode
    if (x !== null && typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner()
      pan.pan.value = this.panOf(x, z)
      src.connect(g).connect(pan).connect(bus)
    } else src.connect(g).connect(bus)
    // the voice limit: past it, the oldest of the group fades out
    const key = pol.group ?? name
    const limit = pol.group ? M.voiceLimit[pol.group] : M.voiceLimit.default
    let vs = this.voices.get(key)
    if (!vs) {
      vs = []
      this.voices.set(key, vs)
    }
    const voice: Voice = { src, g }
    vs.push(voice)
    this.total++
    while (vs.length > limit || (this.total > M.voiceLimit.total && vs.length > 1)) this.drop(vs, now)
    src.onended = () => {
      const i = vs.indexOf(voice)
      if (i >= 0) {
        vs.splice(i, 1)
        this.total--
      }
    }
    src.start()
  }

  private drop(vs: Voice[], now: number): void {
    const old = vs.shift()
    if (!old) return
    this.total--
    old.src.onended = null
    try {
      old.g.gain.cancelScheduledValues(now)
      old.g.gain.setTargetAtTime(0, now, M.dropFadeSec / 3)
      old.src.stop(now + M.dropFadeSec * 2)
    } catch {
      // already stopped
    }
  }

  suspend(on: boolean): void {
    if (!this.ctx) return
    if (on) void this.ctx.suspend().catch(() => undefined)
    else void this.ctx.resume().catch(() => undefined)
  }
}
