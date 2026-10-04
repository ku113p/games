// Sound effects (audio/sfx, all made by our own synthesizer code) through one Web Audio context, unlocked by the
// "Click to start" screen. Files are fetched at load and decoded on unlock. A name like "glitch" plays a random
// variant (glitch_v1..v5). Loops (drone hum, camera servo, alarm 3) run all the time and are faded by the game view.
import footstepRunV1 from '../audio/sfx/footstep_run_v1.mp3'
import footstepRunV2 from '../audio/sfx/footstep_run_v2.mp3'
import footstepRunV3 from '../audio/sfx/footstep_run_v3.mp3'
import footstepRunV4 from '../audio/sfx/footstep_run_v4.mp3'
import footstepSneakV1 from '../audio/sfx/footstep_sneak_v1.mp3'
import footstepSneakV2 from '../audio/sfx/footstep_sneak_v2.mp3'
import footstepSneakV3 from '../audio/sfx/footstep_sneak_v3.mp3'
import jump from '../audio/sfx/jump.mp3'
import land from '../audio/sfx/land.mp3'
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
import wormSkitterLoop from '../audio/sfx/worm_skitter_loop.mp3'
import wormSpawn from '../audio/sfx/worm_spawn.mp3'

const FILES: Record<string, string> = {
  footstep_run_v1: footstepRunV1,
  footstep_run_v2: footstepRunV2,
  footstep_run_v3: footstepRunV3,
  footstep_run_v4: footstepRunV4,
  footstep_sneak_v1: footstepSneakV1,
  footstep_sneak_v2: footstepSneakV2,
  footstep_sneak_v3: footstepSneakV3,
  jump: jump,
  land: land,
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

export type LoopName = 'drone_hum_loop' | 'camera_servo_loop' | 'alarm_3_loop' | 'worm_skitter_loop'

export class Sound {
  ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** Where the hack overlay plays (so it shares the master volume). */
  bus: GainNode | null = null
  private readonly raw = new Map<string, Promise<ArrayBuffer>>()
  private readonly groups = new Map<string, AudioBuffer[]>()
  private readonly loops = new Map<string, GainNode>()
  private variant = 0
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

  /** Call from a click: creates the context, decodes every file once, starts the loops silent. */
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
    this.master.gain.value = this.volume
    this.master.connect(ctx.destination)
    this.bus = ctx.createGain()
    this.bus.connect(this.master)
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
    for (const name of ['drone_hum_loop', 'camera_servo_loop', 'alarm_3_loop', 'worm_skitter_loop'] as const) this.startLoop(name)
    this.ready = true
  }

  private startLoop(name: LoopName): void {
    const ctx = this.ctx
    const buf = this.groups.get(name)?.[0]
    if (!ctx || !buf || !this.master) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(g).connect(this.master)
    src.start()
    this.loops.set(name, g)
  }

  /** Sets a loop's volume, smoothed (call every frame; no allocations). */
  loop(name: LoopName, vol: number): void {
    const g = this.loops.get(name)
    const ctx = this.ctx
    if (!g || !ctx) return
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.12)
  }

  /** Plays a one-shot; a group name picks a variant in turn. */
  play(name: string, vol = 1, rate = 1): void {
    const ctx = this.ctx
    const list = this.groups.get(name)
    if (!ctx || !list || !this.master || list.length === 0 || vol <= 0.001) return
    this.variant = (this.variant + 1) % 997
    const buf = list[this.variant % list.length] as AudioBuffer
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(g).connect(this.master)
    src.start()
  }

  suspend(on: boolean): void {
    if (!this.ctx) return
    if (on) void this.ctx.suspend().catch(() => undefined)
    else void this.ctx.resume().catch(() => undefined)
  }
}
