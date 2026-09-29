// shop/types.ts — типы магазина. Чистый TS: ни DOM, ни Three.js, ни view/input/screens.
// Деньги и косметика живут вне core/ (AGENTS.md, раздел 4): ядро о них не знает.

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

/** Слот «надето»: по одному предмету на слот. У множителей очков и заглушек слота нет. */
export type Slot = 'boost' | 'palette' | 'snakeSkin' | 'appleSkin' | 'compassSkin' | 'arenaSize' | 'obstacles' | 'pace'

/** Поля payload. Какие нужны — зависит от вида: boost {factor}, scoreMult* {mult}, косметика {palette | skin}. */
export interface ItemPayload {
  factor?: number
  mult?: number
  palette?: string
  skin?: string
  slot?: string
  /** arenaSize: ребро куба (должно быть в config.cube.sizes). */
  size?: number
  /** obstacleDensity: множитель к config.obstacles.density (0 — без препятствий). */
  density?: number
  /** pace: масштаб кривой темпа (1 — как в config.speed, больше — спокойнее). */
  scale?: number
}

/** Предмет каталога. payload по видам: boost {factor}, scoreMult* {mult}, косметика {palette|skin}. */
export interface Item {
  id: string
  kind: ItemKind
  price: number
  payload: Readonly<ItemPayload>
  /** Срок в партиях: только у scoreMultTemporary. */
  games?: number
}

export interface TemporaryEntry {
  id: string
  /** Сколько партий ещё НЕ НАЧАТО. Партия, у которой множитель ещё действует, уже вычтена в beginSession. */
  gamesLeft: number
}

export interface ShopState {
  /** Монеты, которые можно потратить. Всегда целое ≥ 0. */
  balance: number
  /** Всего заработано, не убывает при покупках. */
  totalEarned: number
  /** id купленного и выданного по умолчанию. Заглушки и временные множители сюда не попадают. */
  owned: string[]
  /** Надето по слотам. */
  equipped: Partial<Record<Slot, string>>
  /** Действующие временные множители. */
  temporary: TemporaryEntry[]
  /**
   * Множитель текущей партии: замораживается в beginSession и сгорает в earn. Не сохраняется.
   * Нужен, чтобы временный множитель, чья последняя партия только что началась, всё равно
   * заплатил за неё (в temporary он к этому моменту уже снят).
   */
  sessionMult: number
}

/** Строка предмета в config.json (kind и payload не проверены типом: валидация при catalog()). */
export interface RawItem {
  id: string
  kind: string
  price: number
  payload?: object
  games?: number
}

export interface ShopConfig {
  /** Монет за одно яблоко (до множителей). */
  coinPerApple: number
  /** Множитель ускорения без покупок и запасной, когда надетое негодно. */
  defaultBoost: number
  /** Размер арены без покупок и запасной, когда надетое негодно. */
  defaultArenaSize: number
  /** Потолок суммарного срока одного временного множителя (партий): повторная покупка продлевает, но не бесконечно. */
  maxTemporaryGames: number
  defaults: {
    balance: number
    owned: readonly string[]
    equipped: Readonly<Partial<Record<Slot, string>>>
  }
  items: readonly RawItem[]
}

/** Всё, что нужно магазину от config.json целиком: раздел shop и запасной множитель ускорения. */
export interface ShopRoot {
  shop: ShopConfig
  speed: { boostFactor: number }
}
