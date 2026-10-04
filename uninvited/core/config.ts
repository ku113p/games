// The shape of the core's numbers in config.json. main.ts passes the parsed file in; the core never reads files.
// Every balance number lives in config.json (rule 5); the types live next to their domain (core/model/*) and this
// file only composes them. Every top-level section has one owner (PLAN 5.2).
import type { DirectorConfig, SpawnsConfig } from './model/director'
import type { HordeConfig, TankConfig } from './model/monsters'
import type { GunConfig, PlayerConfig, StrikeConfig, SwordConfig } from './model/player'
import type { CrankConfig, MedkitConfig, OnboardingConfig, StageConfig } from './model/stage'

export type { DirectorConfig, SpawnsConfig, HordeConfig, TankConfig, GunConfig, PlayerConfig, StrikeConfig, SwordConfig, CrankConfig, MedkitConfig, OnboardingConfig, StageConfig }

/** The mansion's shape (owner WP5): block heights, the void (only beyond the roof's parapet) and the sky gate height. */
export interface WorldConfig {
  /** Block heights by `tops` plan character (core/level.ts), metres above the block's foot. */
  tops: Record<string, number>
  /** A block's height when the level gives none (LevelDef.blockTop overrides it), metres. */
  defaultTop: number
  /** How far the void goes below the lowest floor, metres. */
  voidDepth: number
  /** An opening overhead is this high above its floor cell when the level has no roof there, metres. */
  skyGate: number
}

export interface GameConfig {
  /** WP1. */
  sim: { maxDt: number; maxEvents: number }
  stage: StageConfig
  onboarding: OnboardingConfig
  medkit: MedkitConfig
  crank: CrankConfig
  /** WP2. */
  player: PlayerConfig
  gun: GunConfig
  sword: SwordConfig
  strike: StrikeConfig
  /** WP3. */
  horde: HordeConfig
  tank: TankConfig
  /** WP4. */
  director: DirectorConfig
  spawns: SpawnsConfig
  /** WP5. */
  world: WorldConfig
}
