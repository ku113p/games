// What happened during a command - the view reacts to these (animation, sound, shake, particles, HUD).
// Events are created only when something happens (not every frame), into one reused array per Sim.
import type { HackEvent } from './hack/index'

export type AlarmReason = 'camera' | 'sound' | 'sensor' | 'drone' | 'laser' | 'scan' | 'hack' | 'attack'

/** Something the gunblade can hit. */
export type TargetKind = 'drone' | 'videoCamera' | 'soundCamera' | 'laser'

export type GameEvent =
  | { type: 'jumped' }
  | { type: 'landed'; speed: number }
  | { type: 'dashed' }
  | { type: 'crouchChanged'; crouched: boolean }
  | { type: 'swordSwing'; yaw: number }
  | { type: 'rifleShot'; fromX: number; fromY: number; fromZ: number; toX: number; toY: number; toZ: number; hit: boolean }
  | { type: 'rifleEmpty' }
  | { type: 'modeSwitched'; mode: 'sword' | 'rifle' }
  | { type: 'targetHit'; target: TargetKind; index: number; x: number; y: number; z: number; killed: boolean; byRifle: boolean }
  | { type: 'playerHurt'; amount: number; hp: number }
  | { type: 'playerDied' }
  | { type: 'droneAiming'; index: number }
  | { type: 'droneFired'; index: number }
  | { type: 'boltHit'; x: number; y: number; z: number; player: boolean }
  | { type: 'droneSuspicious'; index: number }
  | { type: 'droneAlerted'; index: number }
  | { type: 'droneSpawned'; index: number; role: 'searcher' | 'wave' | 'checker' }
  | { type: 'droneLeft'; index: number }
  | { type: 'gateOpened'; index: number }
  | { type: 'cameraSpotted'; index: number }
  | { type: 'soundHeard'; index: number }
  | { type: 'sensorTripped'; index: number }
  | { type: 'laserTripped'; index: number }
  | { type: 'checkCalled'; x: number; y: number; z: number }
  | { type: 'noise'; x: number; y: number; z: number; radius: number }
  | { type: 'alarmRaised'; stage: number; reason: AlarmReason }
  | { type: 'alarmLowered'; stage: number }
  | { type: 'waveStarted'; wave: number; count: number }
  | { type: 'waveCleared'; wave: number }
  | { type: 'firewallDropped' }
  | { type: 'wallOpened'; index: number }
  | { type: 'devicePaused'; target: 'laser' | 'drone'; index: number; sec: number }
  | { type: 'scanOn' }
  | { type: 'scanOff' }
  /** @deprecated use scanWarning (emitted together with it) */
  | { type: 'scanOverheating' }
  /** @deprecated use scanTraced (emitted together with it) */
  | { type: 'scanOverheated' }
  /** Network vision crossed scan.warnAt of its limit (once per use). */
  | { type: 'scanWarning' }
  /**
   * Network vision held too long: the security is called to (x, y, z). `drone` is the responding drone (-1 none);
   * `gate` is the spawn gate the responders come out of (-1 when an already present drone answers).
   */
  | { type: 'scanTraced'; x: number; y: number; z: number; gate: number; drone: number }
  | { type: 'hackStarted'; terminal: number }
  | { type: 'hack'; event: HackEvent }
  | { type: 'hackSolved'; terminal: number }
  | { type: 'hackTimedOut'; terminal: number }
  | { type: 'hackCancelled'; terminal: number }
  | { type: 'checkpointReached'; index: number; underAlarm: boolean }
  | { type: 'artifactTaken' }
