// The director and the spawn points (owner: WP4 Director, spawns, bots). DESIGN 2: the pacing is a continuous flow -
// build-up -> peak -> relief (like the Left 4 Dead director); typed spawn points show where monsters come from.
import type { Vec3 } from './common'
import type { MonsterClass, MonsterKind } from './monsters'

export type DirectorPhase = 'idle' | 'buildup' | 'peak' | 'relax'

export interface DirectorState {
  /** 0..1: how hard the player is pressed right now. */
  intensity: number
  phase: DirectorPhase
  phaseTime: number
  /** Seconds until the next pack, and the unspent spawn budget. */
  spawnTimer: number
  budget: number
  /** The active profile id (config director.profiles) or '' while idle. */
  profile: string
  /** > 0 while a phase was forced from outside (stage start, crank, tank entrance): seconds left. */
  forcedTime: number
  forcedPhase: DirectorPhase
  /** Seconds since the player last took damage. */
  calmTime: number
  /** The player's progress along level.route, in route units (monotonic max), for the "front". */
  progress: number
  /** Roof hold-out: elapsed fraction 0..1 (hidden from the HUD), -1 when the stage is not a hold-out. */
  holdOut: number
  /** Peaks started since the stage began (the bot and tests read it). */
  peaks: number
}

export type SpawnType = 'window' | 'fireplace' | 'crack' | 'door' | 'wall' | 'edge'
export type SpawnLook = 'fire' | 'web' | 'roots' | 'rubble'

/** The runtime state of one spawn point (the static shape is `SpawnPoint` in Sim). */
export interface SpawnPointState {
  /** Enabled by the active stage. */
  enabled: boolean
  /** > 0 while it plays the telegraph (glass cracks, soot puffs, the floor glows), s left. */
  telegraph: number
  /** Stays open for this long, s (0 = closed). */
  open: number
  /** The next monster queued at it waits this long more, s. */
  busy: number
  /** Seconds since a pack last came out of it (for the "several sides" scoring). */
  sinceUsed: number
}

/** A spawn point's static shape (built from the level's `spawn` entities): monsters wait at `deep`, come out through `mouth` to `out`. */
export interface SpawnPoint {
  id: string
  type: SpawnType
  look?: SpawnLook
  mouth: Vec3
  deep: Vec3
  out: Vec3
  /** Outward normal (into the room). */
  nx: number
  ny: number
  nz: number
  /** True for an opening overhead. */
  ceiling: boolean
  /** The plan cell in front of it. */
  cell: number
}

export interface DirectorProfile {
  /** Packs per minute at the start of a build-up and at its end. */
  rate0: number
  rate1: number
  /** Weights per kind. */
  mix: Partial<Record<MonsterKind, number>>
  /** Pack sizes [min, max] per class. */
  pack: Partial<Record<MonsterClass, readonly [number, number]>>
}

export interface DirectorConfig {
  decayPerSec: number
  noDamageSec: number
  k: { damage: number; near: number; lowHp: number }
  nearDist: number
  buildSec: number
  peakAt: number
  peakSec: number
  relaxTo: number
  relaxMinSec: number
  caps: Record<MonsterClass, number>
  tankMode: { rateFactor: number; flyers: boolean }
  front: { minDist: number; maxDist: number; navMax: number; aheadMin: number; recentSec: number; recentPenalty: number }
  profiles: Record<string, DirectorProfile>
}

export interface SpawnsConfig {
  /** The open sequence before monsters come out: the player can always see where they come from, s. */
  telegraphSec: number
  openSec: number
  /** A spawn mouth's height for flyers, the depth monsters wait behind the surface, how far they come out, m. */
  hover: number
  gateDepth: number
  gateOut: number
  minPlayerDist: number
  staggerSec: number
}

export type DirectorEvent =
  | { type: 'spawnTelegraph'; point: number }
  | { type: 'spawnOpened'; point: number }
  | { type: 'directorPhase'; phase: DirectorPhase }
