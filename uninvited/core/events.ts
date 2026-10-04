// What happened during a command - the view reacts to these (animation, sound, shake, particles, HUD).
// Events are created only when something happens (not every frame), into one reused array per Sim.
import type { HackEvent } from './hack/index'

export type AlarmReason = 'camera' | 'sound' | 'sensor' | 'drone' | 'laser' | 'scan' | 'hack' | 'attack' | 'warden'

/** Something the gunblade can hit. */
export type TargetKind = 'drone' | 'videoCamera' | 'soundCamera' | 'laser' | 'worm' | 'warden'

export type GameEvent =
  | { type: 'jumped' }
  | { type: 'landed'; speed: number }
  | { type: 'dashed' }
  | { type: 'crouchChanged'; crouched: boolean }
  | { type: 'swordSwing'; yaw: number; /** 0, 1 = the first two swings, 2 = the wide finisher. */ combo: number }
  | { type: 'rifleShot'; fromX: number; fromY: number; fromZ: number; toX: number; toY: number; toZ: number; hit: boolean }
  | { type: 'rifleEmpty' }
  | { type: 'modeSwitched'; mode: 'sword' | 'rifle' }
  | { type: 'targetHit'; target: TargetKind; index: number; x: number; y: number; z: number; killed: boolean; byRifle: boolean }
  /** (fromX, fromZ): where the hurt came from (the player's own position when it has no direction, like a laser). */
  | { type: 'playerHurt'; amount: number; hp: number; fromX: number; fromZ: number }
  | { type: 'playerDied' }
  /** The player dropped into the void: the screen fades out (player.fallTime). */
  | { type: 'fellIntoVoid' }
  /** ...and is back on the last safe ground, `damage` hit points lighter (it fades in again). */
  | { type: 'voidReturned'; damage: number }
  | { type: 'droneAiming'; index: number }
  | { type: 'droneFired'; index: number }
  | { type: 'boltHit'; x: number; y: number; z: number; player: boolean }
  | { type: 'droneSuspicious'; index: number }
  | { type: 'droneAlerted'; index: number }
  | { type: 'droneSpawned'; index: number; role: 'searcher' | 'wave' | 'checker' }
  | { type: 'droneLeft'; index: number }
  | { type: 'gateOpened'; index: number }
  /** A pack of `count` worms is coming out of spawn gate `gate`. */
  | { type: 'wormPack'; gate: number; count: number; role: 'wave' | 'searcher' }
  /** A worm rears up to bite (the telegraph). */
  | { type: 'wormWindup'; index: number }
  /** A worm's bite snapped shut: `hit` when it caught the player. */
  | { type: 'wormBite'; index: number; hit: boolean }
  /** A searching worm sensed the player and rushes. */
  | { type: 'wormSensed'; index: number }
  | { type: 'wormLeft'; index: number }
  /** A warden noticed something (it stops and turns to look: the "?" cue). */
  | { type: 'wardenSuspicious'; index: number }
  /** A warden spotted the player: it fights and calls the alarm. */
  | { type: 'wardenAlerted'; index: number }
  /** A warden lost the player (or checked a cue) and goes back to its round. */
  | { type: 'wardenGaveUp'; index: number }
  /** The player took a warden down from behind (non-lethal, silent): it powers off and stays down for a while. */
  | { type: 'wardenDowned'; index: number }
  /** A downed warden reboots and goes back to its round, unaware. */
  | { type: 'wardenRebooted'; index: number }
  /** A warden raises its arm for a melee strike (the telegraph); `wardenStruck` when it lands (`hit`: it caught you). */
  | { type: 'wardenStrike'; index: number }
  | { type: 'wardenStruck'; index: number; hit: boolean }
  /** A warden takes aim with its arm (the slow shot's telegraph), then fires a bolt. */
  | { type: 'wardenAiming'; index: number }
  | { type: 'wardenFired'; index: number }
  | { type: 'cameraSpotted'; index: number }
  | { type: 'soundHeard'; index: number }
  | { type: 'sensorTripped'; index: number }
  | { type: 'laserTripped'; index: number }
  | { type: 'checkCalled'; x: number; y: number; z: number }
  | { type: 'noise'; x: number; y: number; z: number; radius: number }
  | { type: 'alarmRaised'; stage: number; reason: AlarmReason }
  | { type: 'alarmLowered'; stage: number }
  | { type: 'waveStarted'; wave: number; count: number; worms: number; wardens: number }
  | { type: 'waveCleared'; wave: number }
  | { type: 'firewallDropped' }
  | { type: 'wallOpened'; index: number }
  | { type: 'devicePaused'; target: 'laser' | 'drone' | 'warden' | 'camera'; index: number; sec: number }
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
  /** A killed enemy dropped a signal shard (slot `index`); the view shows it from the state. */
  | { type: 'shardDropped'; index: number; x: number; y: number; z: number; big: boolean }
  /** The player took a shard (hp after the heal). */
  | { type: 'shardTaken'; x: number; y: number; z: number; big: boolean; hp: number }
  /** A rifle bolt hit a heavy warden's shield (from the front). */
  | { type: 'shieldBlocked'; index: number; x: number; y: number; z: number }
  /** A wave warden comes out of spawn gate `gate`. */
  | { type: 'wardenSpawned'; index: number; gate: number; heavy: boolean }
  | { type: 'artifactTaken' }
  /** Johnny met May (a terminal with `meetsMay` was solved for the first time): the view plays the meeting. */
  | { type: 'mayMet' }
  /** A checkpoint paid May's points: `gained` now, `total` unspent. */
  | { type: 'mayPoints'; gained: number; total: number }
  | { type: 'upgradeBought'; id: string; rank: number }
  /** An active (slot 0 = key 1 distraction, 1 = key 2 pause a camera) was used; (x, y, z) is the ping or the paused device. */
  | { type: 'abilityUsed'; slot: number; x: number; y: number; z: number }
  | { type: 'abilityFailed'; slot: number; reason: 'cooldown' | 'noTarget' }
  /** The shield took a hit whole. */
  | { type: 'shieldAbsorbed' }
