// shop/types.ts — shop types. Pure TS: no DOM, no Three.js, no view/input/screens.
// Coins and cosmetics live outside core/ (AGENTS.md, section 4): the core knows nothing about them.

export type ItemKind =
  | 'boost'
  | 'scoreMultPermanent'
  | 'scoreMultTemporary'
  | 'palette'
  | 'snakeSkin'
  | 'appleSkin'
  | 'compassSkin'
  | 'arenaSize'
  | 'obstacleDensity'
  | 'pace'
  | 'comingSoon'

/** The equip slot: one item per slot. Coin multipliers and coming-soon slots have no slot. */
export type Slot = 'boost' | 'palette' | 'snakeSkin' | 'appleSkin' | 'compassSkin' | 'arenaSize' | 'obstacles' | 'pace'

/** Payload fields. Which are needed depends on the kind: boost {factor}, scoreMult* {mult}, cosmetics {palette | skin}. */
export interface ItemPayload {
  factor?: number
  mult?: number
  palette?: string
  skin?: string
  slot?: string
  /** arenaSize: cube edge (must be in config.cube.sizes). */
  size?: number
  /** obstacleDensity: multiplier on config.obstacles.density (0 = no obstacles). */
  density?: number
  /** pace: scale of the pace curve (1 = as in config.speed, larger = calmer). */
  scale?: number
}

/** A catalog item. payload by kind: boost {factor}, scoreMult* {mult}, cosmetics {palette|skin}. */
export interface Item {
  id: string
  kind: ItemKind
  price: number
  payload: Readonly<ItemPayload>
  /** Term in games: only on scoreMultTemporary. */
  games?: number
}

export interface TemporaryEntry {
  id: string
  /** How many games are NOT YET STARTED. A game whose multiplier is still active has already been subtracted in beginSession. */
  gamesLeft: number
}

export interface ShopState {
  /** Coins that can be spent. Always an integer ≥ 0. */
  balance: number
  /** Total earned, does not decrease on purchases. */
  totalEarned: number
  /** ids of owned items and of those granted by default. Coming-soon slots and temporary multipliers are not included. */
  owned: string[]
  /** Equipped per slot. */
  equipped: Partial<Record<Slot, string>>
  /** Temporary multipliers in effect. */
  temporary: TemporaryEntry[]
  /**
      * Multiplier of the current game: frozen in beginSession and burned in earn. Not saved.
      * Needed so that a temporary multiplier whose last game has just started still
      * pays for it (by then it has already been removed from temporary).
   */
  sessionMult: number
}

/** An item row in config.json (kind and payload are not type-checked: validation happens in catalog()). */
export interface RawItem {
  id: string
  kind: string
  price: number
  payload?: object
  games?: number
}

export interface ShopConfig {
  /** Coins per apple (before multipliers). */
  coinPerApple: number
  /** Boost factor without purchases, and the fallback when the equipped one is invalid. */
  defaultBoost: number
  /** Arena size without purchases, and the fallback when the equipped one is invalid. */
  defaultArenaSize: number
  /** Cap on the total term of one temporary multiplier (games): buying again extends it, but not indefinitely. */
  maxTemporaryGames: number
  defaults: {
    balance: number
    owned: readonly string[]
    equipped: Readonly<Partial<Record<Slot, string>>>
  }
  items: readonly RawItem[]
}

/** Everything the shop needs from config.json as a whole: the shop section and the fallback boost factor. */
export interface ShopRoot {
  shop: ShopConfig
  speed: { boostFactor: number }
}
