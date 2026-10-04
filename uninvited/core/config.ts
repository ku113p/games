// The shape of the core's numbers in config.json. main.ts passes the parsed file in; the core never reads files.
// Every balance number lives in config.json (rule 5); this file only names them.
import type { HackConfig } from './hack/index'

export interface PlayerConfig {
  walkSpeed: number
  runSpeed: number
  crouchSpeed: number
  /** m/s^2 towards the wished speed on the ground (inertia: lower = heavier). */
  groundAccel: number
  /** m/s^2 when there is no input on the ground. */
  groundDecel: number
  airAccel: number
  /** How fast the body turns towards where it moves, 1/s. */
  turnRate: number
  jumpSpeed: number
  gravity: number
  maxFall: number
  coyoteSec: number
  jumpBufferSec: number
  dashSpeed: number
  dashSec: number
  dashCooldownSec: number
  /** Two presses of the same direction key within this time make a dash (DESIGN 12). */
  dashTapSec: number
  dashInvulnerable: boolean
  maxHp: number
  hurtInvulnSec: number
  /** Where watchers look at: the head, standing and crouched (metres above the feet). */
  eyeHeight: number
  crouchEyeHeight: number
  chestHeight: number
  /** Body radius for bolts and lasers. */
  radius: number
  /** Landing faster than this (m/s down) makes a landing noise. */
  landNoiseSpeed: number
  /** Shown as "hit" in the animation state for this long. */
  hitAnimSec: number
}

/** Noise radii in metres (DESIGN 8: running, jumping, fighting). Sound cameras and drones hear inside them. */
export interface NoiseConfig {
  run: number
  jump: number
  land: number
  dash: number
  sword: number
  rifle: number
  hit: number
  kill: number
  laser: number
  /** How often a running player "emits" a running noise, s. */
  runEverySec: number
  /** The player's noise ring fades from the run radius to silence in this long, s. */
  fadeSec: number
}

export interface SwordConfig {
  damage: number
  range: number
  arcDeg: number
  cooldownSec: number
  reachUp: number
  reachDown: number
  animSec: number
}

export interface RifleConfig {
  damage: number
  intervalSec: number
  spreadDeg: number
  range: number
  charges: number
  aimAssistDeg: number
  muzzleHeight: number
  animSec: number
}

export interface CombatConfig {
  switchSec: number
  sword: SwordConfig
  rifle: RifleConfig
  hitRadius: { drone: number; camera: number; laser: number }
}

export interface DetectionConfig {
  /** Suspicion per second at point blank (a full bar is 1). */
  rate: number
  decay: number
  crouchFactor: number
  runFactor: number
  /** At the edge of the range the rate is scaled down to this. */
  farFactor: number
}

export interface VideoCameraConfig {
  range: number
  halfAngleDeg: number
  pitchDeg: number
  mountHeight: number
  sweepPeriodSec: number
  /** Pause at each end of the sweep, as a share of the period. */
  holdShare: number
  hp: number
  /** After a camera spots the player it does not raise the alarm again for this long. */
  respotSec: number
}

export interface SoundCameraConfig {
  radius: number
  mountHeight: number
  hp: number
  respotSec: number
  /** Suspicion added per metre of noise radius that reaches it (a loud noise close by fills it at once). */
  hearGain: number
  decay: number
  pingSec: number
}

export interface MotionSensorConfig {
  radius: number
  rearmSec: number
  /** The sensor's dot is noticeable when you are this close with a clear line to it, m. */
  noticeDist: number
}

export interface LaserConfig {
  damage: number
  hp: number
  tripCooldownSec: number
  height: number
}

export interface DroneConfig {
  hp: number
  hover: number
  radius: number
  patrolSpeed: number
  searchSpeed: number
  chaseSpeed: number
  turnRate: number
  range: number
  halfAngleDeg: number
  pitchDeg: number
  waypointPauseSec: number
  lookAroundSec: number
  keepDist: number
  loseSec: number
  /** Between the end of one shot and the start of the next aim, s. */
  fireIntervalSec: number
  /** After spotting the player, before the first aim, s. */
  fireWindupSec: number
  /** The shot telegraph: the drone holds still and locks on for this long before every shot; losing sight cancels it. */
  aimSec: number
  boltSpeed: number
  boltDamage: number
  boltLifeSec: number
  /** Drones hear noise within (noise radius x this). */
  hearFactor: number
  /** Extra drone slots for alarm searchers and waves. */
  maxExtra: number
  /** A spawn gate opens for this long (glitch, light) before its drone comes out. */
  spawnSec: number
  /** The flight out of (or into) a gate, s. */
  gateExitSec: number
  /** How deep behind the gate's surface a drone waits, m. */
  gateDepth: number
  /** A wall gate lets its drone out this far in front of the wall, m. */
  gateOut: number
  /** Drones queued at the same gate come out this far apart, s. */
  gateStaggerSec: number
}

export interface AlarmConfig {
  /** Seconds without new violations before stage 1 / 2 drops by one; index = stage. */
  decaySec: number[]
  /** Searcher drones sent in when the alarm reaches stage 1 / 2; index = stage. */
  searchers: number[]
  /** How far from the alarm point searchers look, m; index = stage. */
  searchRadius: number[]
  waveSizes: number[]
  waveFirstDelaySec: number
  waveGapSec: number
  /** Stage 3: after this many cleared waves the firewall (every red wall) drops. */
  firewallAfterWaves: number
  maxWaveDrones: number
  minSpawnDist: number
  /** One incident raises one stage: further violations within this time only move the search. */
  raiseCooldownSec: number
}

export interface ScanConfig {
  /** The warning comes at this share of maxSec (0..1). */
  warnAt: number
  maxSec: number
  cooldownSec: number
  overheatCooldownSec: number
}

export interface TerminalConfig {
  interactRadius: number
  pauseSec: number
  /** May's bonus time for the hacking mini-game (none in the slice). */
  timeBonusSec: number
}

export interface EndingConfig {
  /** Checkpoints passed under alarm 3 that make the ending sad (DESIGN 4: 4 of 9). */
  sadAt: number
  totalCheckpoints: number
}

export interface GameConfig {
  sim: { maxDt: number; maxEvents: number }
  player: PlayerConfig
  noise: NoiseConfig
  combat: CombatConfig
  detection: DetectionConfig
  videoCamera: VideoCameraConfig
  soundCamera: SoundCameraConfig
  motionSensor: MotionSensorConfig
  laser: LaserConfig
  drone: DroneConfig
  alarm: AlarmConfig
  scan: ScanConfig
  terminal: TerminalConfig
  checkpoint: { radius: number }
  artifact: { radius: number }
  ending: EndingConfig
  hack: HackConfig
}
