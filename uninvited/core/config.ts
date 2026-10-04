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
  /** A jump, dash or attack pressed up to this long before it is allowed (cooldown, hit-stop, a switch) still happens, s. */
  inputBufferSec: number
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
  /** The wait after swing 1 and 2 of the combo, s. */
  cooldownSec: number
  reachUp: number
  reachDown: number
  /** How long swings 1 and 2 play, s. */
  animSec: number
  /** A swing started within this long after the last one continues the combo (1 -> 2 -> 3 finisher), s. */
  comboWindowSec: number
  /** The third swing: a wider, longer sweep with the same damage. */
  finisher: { cooldownSec: number; animSec: number; arcDeg: number; range: number }
}

export interface RifleConfig {
  damage: number
  intervalSec: number
  spreadDeg: number
  /** The spread while aiming (RMB): tighter. */
  aimSpreadDeg: number
  range: number
  charges: number
  aimAssistDeg: number
  muzzleHeight: number
  animSec: number
}

export interface CombatConfig {
  switchSec: number
  /** Aiming with the sword out draws the rifle for the aim (and back on release) this fast, s. */
  aimDrawSec: number
  sword: SwordConfig
  rifle: RifleConfig
  hitRadius: { drone: number; camera: number; laser: number; worm: number }
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
  /** A drone rises over a block up to this tall above its floor (hex modules, server blocks, parapets), m; taller ones it flies around. */
  overMax: number
  /** The gap it keeps over what it flies across, m. */
  clearance: number
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
  /** The combat standoff (DESIGN 9): a fighting drone keeps a ring around the player, never above them. */
  standoff: {
    /** The ring's horizontal radii (each drone gets its own share), m. */
    ringMin: number
    ringMax: number
    /** Height over the player's floor (a share per drone), m; capped so the elevation angle stays under maxElevDeg. */
    heightMin: number
    heightMax: number
    maxElevDeg: number
    /** Closer than this horizontally a drone slides out at once, m, at slideSpeed m/s. */
    clearRadius: number
    slideSpeed: number
    /** Ring strafe, rad/s (the direction alternates per drone). */
    strafeSpeed: number
    /** Without a line of sight to the player a drone closes to the ring and circles at this speed (m/s arc) until it sees them. */
    seekStrafeSpeed: number
    /** A fighting drone sees the player out to this range, m (the ring is wider than the patrol cone's range). */
    alertRange: number
  }
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

/** The warden: a walking sentinel program (a guard on a post or a patrol route, separate from the drones). */
export interface WardenConfig {
  hp: number
  /** Rifle hits do this much of their damage times this (armor tuned so ~8 shots or 3 sword hits take it down). */
  rifleFactor: number
  /** Body radius (walking, bumping, being hit), m. */
  radius: number
  eyeHeight: number
  chestHeight: number
  hitRadius: number
  /** The vision cone: shorter and narrower than a camera's, it follows the head. */
  range: number
  halfAngleDeg: number
  pitchDeg: number
  /** Closer than this, within closeHalfAngleDeg of where it looks, it notices you whatever your stance (under the cone). */
  closeDist: number
  closeHalfAngleDeg: number
  patrolSpeed: number
  investigateSpeed: number
  searchSpeed: number
  alertSpeed: number
  /** The run of a pursuing warden while the player is further than pursuit.runFarDist, m/s (below the player's sprint). */
  runSpeed: number
  /** Alarm 2+ pursuit: wardens within radius of the known player position run to it. */
  /** A warden closes in for the melee only while its next shot is further than closeInCooldownSec away (it shoots, steps in, shoots again). */
  pursuit: { radius: number; runFarDist: number; closeInCooldownSec: number }
  /** Body turn rates, rad/s (slow: you can sneak up behind it). */
  turnRate: number
  alertTurnRate: number
  headTurnRate: number
  /** How far the head turns from the body, degrees. */
  headMaxDeg: number
  /** At a post: each idle act (standing, a slow look around) lasts [min, max] s. */
  postActSec: number[]
  /** A stop's waitSec varies by +- this share (small: the rounds are meant to be learned). */
  waitVary: number
  /** A slow look around: head sweep amplitude (degrees) and one sweep's period, s. */
  scanDeg: number
  scanPeriodSec: number
  /** The head sweep while it walks its round (the cone swings this far to each side, degrees) and its period, s. */
  walkScanDeg: number
  walkScanPeriodSec: number
  /** The non-lethal takedown from behind (E, DESIGN 8). */
  takedown: {
    /** Horizontal reach, m, and the rear arc (total width, degrees, centred right behind its body). */
    reach: number
    arcDeg: number
    /** The action: the hero is locked this long, s. */
    sec: number
    /** The warden stays down this long counted from the start of the action, s, then reboots (lights flicker for the last rebootSec). */
    downSec: number
    rebootSec: number
    /** Other wardens that see a downed warden (within range, in the cone) become suspicious; each one only again after this long, s. */
    noticeCooldownSec: number
    /** From this alarm stage on a downed warden reboots at once (the alarm wakes it). */
    wakeAlarmStage: number
  }
  /** While standing still now and then it glances aside this far, degrees. */
  glanceDeg: number
  /** Suspicious: it stops and turns to the cue for this long before walking over to check. */
  suspiciousSec: number
  /** At the cue it searches around this long, then goes back to its route. */
  investigateLookSec: number
  /** Alarm search: looks around this long at each search point. */
  searchLookSec: number
  /** In a fight, without seeing you for this long it goes to check where it last saw you. */
  loseSec: number
  /** Suspicion grows this much faster while it already investigates or searches. */
  keen: number
  /** It hears noise within (noise radius x this). */
  hearFactor: number
  /** Melee: starts a strike within strikeRange, lands it (after the telegraph) within strikeReach and the arc. */
  strikeRange: number
  strikeReach: number
  strikeArcDeg: number
  strikeWindupSec: number
  strikeRecoverSec: number
  strikeDamage: number
  /** In a fight it walks up to this distance and holds there (shooting), m. */
  holdDist: number
  /** Within this distance it fights in melee (closes in and strikes), further out it shoots, m. */
  meleeDist: number
  /** The arm shot: only from this far, a long aim (the telegraph), then a bolt. */
  shotMinDist: number
  shotAimSec: number
  shotIntervalSec: number
  shotFirstSec: number
  boltSpeed: number
  boltDamage: number
  /** The heavy warden: tougher, slower, with a shield in front that stops rifle bolts (the sword and flanking get through). */
  heavy: { hp: number; speedFactor: number; shieldHalfDeg: number; strikeDamageFactor: number }
  /** The flinch after a hit, s. */
  hitAnimSec: number
  /** A sword or rifle hit pushes it back at this speed, m/s (fades out in about 0.15 s). */
  knockback: number
  /** Bumped into: suspicion jumps to this. */
  bumpSuspicion: number
  /** Re-plan the walk this often, s. */
  repathSec: number
}

/** One wave of alarm 3 (DESIGN 9): worm packs from different gates plus drones and wardens out of the gates. */
export interface WaveConfig {
  /** The size of each worm pack; every pack comes out of its own gate, on another side of the player when it can. */
  packs: number[]
  /** Spotter drones. */
  drones: number
  /** Wardens (the main fighters), and heavy wardens (with a frontal shield) on top of them. */
  wardens: number
  heavy: number
}

/**
 * Attack tokens (DESIGN 9): only so many attacks of a kind run at once; the rest hold a ring around the player and wait
 * for a token, which comes back after the attack's recovery.
 */
export interface TokenConfig {
  /** Worm bites (windup + bite + recovery) at once. */
  bite: number
  /** Warden melee strikes at once. */
  melee: number
  /** Ranged shots (warden and drone aims) at once. */
  ranged: number
  /** Waiting enemies hold this far from the player [min, max], m. */
  ringMin: number
  ringMax: number
  /** A waiting enemy re-picks its place on the ring this often, s. */
  regroupSec: number
  /** A worm that got a bite token but did not start the bite within this long gives it back, s. */
  biteWaitSec: number
  /** A shot token is kept this long after the shot, s. */
  rangedHoldSec: number
}

/** Signal shards (DESIGN 9): killed enemies drop them, picking them up heals. */
export interface ShardConfig {
  lifeSec: number
  /** A shard within this distance of the player flies to it, m. */
  magnetDist: number
  magnetSpeed: number
  /** Taken when this close, m. */
  pickupDist: number
  /** Hit points per shard, and per big shard (a sword finisher that cut down several). */
  heal: number
  bigHeal: number
  /** Rifle charges per shard / big shard (drones are a rifle job: killing feeds the rifle). */
  charges: number
  bigCharges: number
  /** Shards dropped by a killed worm / drone / warden / heavy warden. */
  wormDrops: number
  droneDrops: number
  wardenDrops: number
  heavyDrops: number
  /** A sword finisher that kills at least this many at once drops a big shard. */
  finisherKills: number
  /** Slots (the oldest is reused when they run out). */
  max: number
}

export interface AlarmConfig {
  /** Seconds without new violations before stage 1 / 2 drops by one; index = stage. */
  decaySec: number[]
  /** Searcher drones sent in when the alarm reaches stage 1 / 2; index = stage. */
  searchers: number[]
  /** How far from the alarm point searchers look, m; index = stage. */
  searchRadius: number[]
  /** The waves of alarm 3 (index = wave number from 0; the last one repeats until the firewall drops). */
  waves: WaveConfig[]
  /** Warden slots kept ready for wave wardens (they walk out of the spawn gates); heavy ones included. */
  waveWardenSlots: number
  waveFirstDelaySec: number
  waveGapSec: number
  /** Stage 3: after this many cleared waves the firewall (every red wall) drops. */
  firewallAfterWaves: number
  /** A pack of this many worms joins the search when the alarm reaches stage 1 / 2 (0 = none); index = stage. */
  searchPacks: number[]
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
  /** Red checkpoints (a wave fight happened in their segment) that make the ending sad (DESIGN 4: 4 of 9). */
  sadAt: number
  totalCheckpoints: number
}

/** Worms (DESIGN 9): small fast melee programs that come in packs and rush along the floor. */
export interface WormConfig {
  hp: number
  /** Body radius for the sword, the rifle and the crowd (they keep apart), m. */
  radius: number
  /** Rush speed, m/s (each worm is a little faster or slower: +- speedSpread). */
  speed: number
  speedSpread: number
  /** Searching worms crawl this fast, m/s. */
  searchSpeed: number
  /** How fast a worm turns, rad/s. */
  turnRate: number
  /** Worm slots (the most alive at once). */
  max: number
  /** Within this distance a worm stops and rears up to bite (the telegraph), m. */
  biteRange: number
  /** The bite lands when the player is still this close when the windup ends, m. */
  biteReach: number
  windupSec: number
  /** After a bite (hit or miss) it backs off for this long, s. */
  recoverSec: number
  biteDamage: number
  /** A hit that does not kill stops it for this long (and cancels its windup), s. */
  staggerSec: number
  /** ...and pushes it back this fast, m/s (fades out). */
  knockback: number
  /** Waiting behind the opening gate, s. */
  spawnSec: number
  /** Crawling out of the gate down to the floor, s. */
  emergeSec: number
  /** Worms of one pack come out of their gate this far apart, s. */
  gateStaggerSec: number
  /** A worm goes straight at the player within this distance when nothing is in the way; further, the grid's flow field, m. */
  directDist: number
  /** Within this distance wave worms fan out: each closes in up to flankDeg to its own side (a pack surrounds you), m. */
  flankDist: number
  flankDeg: number
  /** Searching worms sense a standing / crouched player this close with a clear line, m. */
  senseDist: number
  senseCrouchDist: number
  /** A hunting searcher that lost the player goes back to searching after this long, s. */
  loseSec: number
  /** Worms crawl up and down floor steps up to this high (ledges, steps between platforms), m. */
  climb: number
}

/** The open city's shape (DESIGN 6): block heights, the void and falling into it. */
export interface WorldConfig {
  /** Block heights by `tops` plan character (core/level.ts), metres above the block's foot. */
  tops: Record<string, number>
  /** A block's height when the level gives none (LevelDef.blockTop overrides it), metres. */
  defaultTop: number
  /** How far the void goes below the lowest floor (where slabs and platforms end), metres. */
  voidDepth: number
  /** A spawn portal in the open sky opens this high above its floor cell, metres. */
  skyGate: number
  fall: {
    /** Dropping this far below the last safe ground over the void counts as falling in, metres. */
    depth: number
    /** The screen fades out for this long, the player is put back, and it fades in again as long, s. */
    fadeSec: number
    /** Hit points lost for falling in. */
    damage: number
    /** Ground counts as safe only this far (metres) or more from the void, so you are never put back on the edge. */
    safeMargin: number
  }
}

/** One purchasable upgrade of May's tree (DESIGN 10): the points each rank costs, in order. */
export interface UpgradeConfig {
  /** costs[r] buys rank r + 1; the length is the number of ranks. */
  costs: number[]
  /** An upgrade that must be owned first (rank >= 1). */
  requires?: string
}

/** May's progression (DESIGN 10 "as built"): points, the tree, and the numbers of every upgrade. */
export interface ProgressionConfig {
  /** Points May earns at every checkpoint passed. */
  pointsPerCheckpoint: number
  /** The tree by id: distract, pause, pauseTime, cooldown, shield, charges, hackTime. */
  items: Record<string, UpgradeConfig>
  /** Distraction signal (key 1): a noise ping at the aimed point (or the nearest surface) within `range`. */
  distract: { range: number; noiseRadius: number; cooldownSec: number }
  /** Pause a camera (key 2): aim at a camera or drone within `range`; paused for baseSec + rank of pauseTime x pauseTimeSec. */
  pause: { range: number; aimDeg: number; baseSec: number; pauseTimeSec: number; cooldownSec: number }
  /** Both cooldowns are multiplied by cooldownFactor[rank of "cooldown"]. */
  cooldownFactor: number[]
  /** Shield: absorbs one hit, then comes back after rechargeSec[rank - 1] seconds without being hurt (and at a checkpoint). */
  shield: { rechargeSec: number[] }
  /** Rifle charges added to the maximum (and given at once) per rank. */
  chargesPerRank: number
  /** Hacking time added per rank, s. */
  hackTimeSec: number
}

export interface GameConfig {
  sim: { maxDt: number; maxEvents: number }
  world: WorldConfig
  player: PlayerConfig
  noise: NoiseConfig
  combat: CombatConfig
  detection: DetectionConfig
  videoCamera: VideoCameraConfig
  soundCamera: SoundCameraConfig
  motionSensor: MotionSensorConfig
  laser: LaserConfig
  drone: DroneConfig
  worm: WormConfig
  warden: WardenConfig
  alarm: AlarmConfig
  tokens: TokenConfig
  shards: ShardConfig
  scan: ScanConfig
  terminal: TerminalConfig
  checkpoint: { radius: number }
  artifact: { radius: number }
  ending: EndingConfig
  hack: HackConfig
  progression: ProgressionConfig
}
