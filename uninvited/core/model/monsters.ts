// The monsters' domain (owner: WP3 Horde AI): one pool `monsters[]` with a `kind` (swarm, infantry, ranged, flyers),
// the tank (a single slot), projectiles and puddles. The pool is the old worm pool generalized (DESIGN 5).
import type { Vec3 } from './common'

export type MonsterKind = 'rat' | 'spider' | 'beetle' | 'zombie' | 'skeleton' | 'witch' | 'gremlin' | 'bat' | 'ghost'
export type MonsterClass = 'swarm' | 'infantry' | 'ranged' | 'flyer'
export type AttackKind = 'bite' | 'strike' | 'throw'
/** The attack-token pools (config horde.tokens): bite, strike, throw, swoop. */
export type TokenKind = 'bite' | 'strike' | 'throw' | 'swoop'

/**
 * emerge: coming out of its spawn point; hunt: rushing / walking at the player; windup: the attack's telegraph;
 * recover: backing off after an attack; leave: going back to a spawn point; sleep: standing still until woken
 * (the packed corridor of L2).
 */
export type MonsterMode = 'emerge' | 'hunt' | 'windup' | 'recover' | 'leave' | 'sleep'

export interface MonsterState {
  /** A slot in use (the pool is reused; `active` false = free). */
  active: boolean
  alive: boolean
  kind: MonsterKind
  cls: MonsterClass
  mode: MonsterMode
  /** Feet position (flyers: y is their height). */
  pos: Vec3
  yaw: number
  hp: number
  /** Seconds left of the current windup / recovery / emergence. */
  timer: number
  /** > 0 while waiting behind its opening spawn point (cannot act or be hit). */
  spawnTime: number
  /** The spawn point it came from, -1 none. */
  spawnPoint: number
  /** > 0 while stopped by a hit. */
  stagger: number
  /** Knockback velocity, m/s (fades out). */
  pushX: number
  pushZ: number
  /** Going straight at the player (clear line) rather than along the flow field; re-checked every few ticks. */
  direct: boolean
  /** Seconds until the next line check. */
  think: number
  /** Its own speed factor (packs do not move in lockstep). */
  pace: number
  /** Holds an attack token (from the grant until its attack is over); without one it waits on the ring around the player. */
  token: boolean
  /** Seconds since it got the token without starting its attack; the ring place is re-picked every regroupSec. */
  tokenWait: number
  /** Where on the ring it waits: 1 or -1 (which way it circles), and the seconds until it re-picks. */
  ringDir: number
  regroup: number
  /** Which way the shield (skeleton) faces, rad; the body yaw for now. */
  shieldYaw: number
  /** Seconds until the next ranged throw / the next swoop. */
  attackTimer: number
  /** Standing still until woken (mode 'sleep' mirrors it; kept for the wake-up ripple). */
  sleep: boolean
}

export type TankMode = 'idle' | 'breaking' | 'walk' | 'windup' | 'recover' | 'grab' | 'stagger' | 'dead'
export type TankAttack = 'none' | 'swipe' | 'grab'

/** The heavy (as in Left 4 Dead): one per level, near its end (DESIGN 5). */
export interface TankState {
  active: boolean
  alive: boolean
  mode: TankMode
  attack: TankAttack
  pos: Vec3
  yaw: number
  hp: number
  timer: number
  /** Punches left in the current grab, seconds to the next, and the weak-spot damage dealt during it. */
  punchesLeft: number
  punchTimer: number
  grabDamage: number
  grabCooldown: number
  /** Damage taken within the stagger window, and the window's time left. */
  staggerDamage: number
  staggerWindow: number
  repath: number
}

export type ProjectileKind = 'potion' | 'junk'

/** A thrown potion or junk: a ballistic projectile at a predicted position. */
export interface ProjectileState {
  active: boolean
  kind: ProjectileKind
  /** Hit points it takes off the player. */
  damage: number
  pos: Vec3
  vel: Vec3
  life: number
}

/** A potion's acid puddle: damage over time to the player standing in it. */
export interface PuddleState {
  active: boolean
  pos: Vec3
  radius: number
  life: number
}

/** The per-kind table (config horde.kinds.<kind>). */
export interface KindConfig {
  cls: MonsterClass
  hp: number
  speed: number
  speedSpread: number
  /** Body radius for the crowd, m; the hit sphere is centred `height` above the feet with radius `hitRadius`. */
  radius: number
  height: number
  hitRadius: number
  /** Steps it can climb, m (swarm 1.6, infantry 0.4). */
  climb: number
  attack: AttackKind
  /** Starts the attack within `range`, lands it within `reach`, m. */
  range: number
  reach: number
  windupSec: number
  recoverSec: number
  damage: number
  knockback: number
  staggerSec: number
  token: TokenKind
  /** Spider: the leap distance, m. */
  leapDist?: number
  /** Skeleton: the shield blocks gun bolts within this half angle of its front. */
  shieldHalfDeg?: number
  /** Ranged: seconds between throws, the distance band it keeps, the distance at which it backs off, the flight time. */
  throwIntervalSec?: number
  keepMin?: number
  keepMax?: number
  retreatDist?: number
  flightSec?: number
  /** Ghosts: gun only (a bat can be cut by a jumping hero - DESIGN 5, 2026-10-05). */
  swordImmune?: boolean
  ringMin?: number
  ringMax?: number
  /** Ghosts: ignore all collision; spawn inside walls this far from the player. */
  throughWalls?: boolean
  spawnMin?: number
  spawnMax?: number
  fadeSec?: number
}

export interface HordeConfig {
  /** The pool size (the most alive at once). */
  max: number
  turnRate: number
  /** Waiting behind the opening spawn point, s. */
  spawnSec: number
  /** Coming out of the spawn point down to the floor, s. */
  emergeSec: number
  /** Monsters of one pack come out this far apart, s. */
  gateStaggerSec: number
  /** Goes straight at the player within this distance when nothing is in the way; further, the flow field, m. */
  directDist: number
  /** Within this distance a pack fans out: each closes in up to flankDeg to its own side, m. */
  flankDist: number
  flankDeg: number
  separation: { radiusScale: number; playerPushClasses: MonsterClass[] }
  tokens: {
    bite: number
    strike: number
    throw: number
    swoop: number
    /** Waiting monsters hold this far from the player [min, max], m. */
    ringMin: number
    ringMax: number
    regroupSec: number
    /** A monster that got a token but did not start the attack within this long gives it back, s. */
    biteWaitSec: number
  }
  sleepers: { wakeDist: number; rippleDist: number; rippleSec: number }
  kinds: Record<MonsterKind, KindConfig>
  flyers: { overMax: number; clearance: number; gateExitSec: number; swoopSec: number }
  projectile: { max: number; gravity: number; speed: number; lifeSec: number; radius: number }
  puddle: { max: number; radius: number; sec: number; dps: number }
}

export interface TankConfig {
  hp: number
  speed: number
  turnRate: number
  radius: number
  height: number
  repathSec: number
  breakWallSec: number
  swipe: { windupSec: number; arcDeg: number; range: number; damage: number; knockback: number }
  grab: { windupSec: number; lungeM: number; catchRange: number; punches: number; punchGapSec: number; punchDamage: number; throwSpeed: number; cooldownSec: number; breakDamage: number }
  /** Damage within staggerWindowSec that staggers it (cancels a grab windup). */
  staggerDamage: number
  staggerWindowSec: number
  zones: {
    eyes: { radius: number; height: number; mult: number }
    belly: { radius: number; height: number; mult: number }
    body: { radius: number; height: number; mult: number }
    /** The sword's belly multiplier when the hero is in front of the tank. */
    swordBellyMult: number
  }
}

export type HordeEvent =
  /** A pack of `count` monsters of `kind` is coming out of spawn point `point`. */
  | { type: 'monsterPack'; point: number; count: number; kind: MonsterKind }
  /** A monster rears up for its attack (the telegraph). */
  | { type: 'monsterWindup'; index: number }
  /** An attack landed or missed: `hit` when it caught the player. */
  | { type: 'monsterAttack'; index: number; hit: boolean }
  | { type: 'monsterLeft'; index: number }
  | { type: 'monsterWoke'; index: number }
  | { type: 'projectileThrown'; index: number; kind: ProjectileKind }
  | { type: 'projectileHit'; index: number; x: number; y: number; z: number; player: boolean }
  | { type: 'puddleSpawned'; index: number }
  | { type: 'puddleExpired'; index: number }
  | { type: 'tankSpawned' }
  | { type: 'tankBreaksIn'; group: number }
  | { type: 'tankWindup'; attack: 'swipe' | 'grab' }
  | { type: 'tankGrab' }
  | { type: 'tankPunch' }
  | { type: 'tankThrow' }
  | { type: 'tankStagger' }
  | { type: 'tankDied' }
