// screens/shop-flow.ts — pure decisions of the storefront and the flow around the shop: no DOM, storage or time.
// The item part is shop/ (wallet, catalog, purchases, equipped); here only what the storefront decides.

import { arenaHasObstacles } from '../core/rules'
import {
  beginSession,
  buy,
  canBuy,
  catalog,
  currentSessionMultiplier,
  earn,
  equip,
  isOwned,
  selectedArenaSize,
  slotOf,
  type Item,
  type ItemKind,
  type ShopRoot,
  type ShopState,
} from '../shop'

export type ItemStatus =
  | 'soon' // locked behind "???": cannot be bought or equipped
  | 'equipped' // equipped
  | 'owned' // owned, not equipped
  | 'active' // a coin multiplier bought for good: nothing to equip, it just applies
  | 'buyable' // not owned, enough coins
  | 'maxed' // temporary multiplier: the term has hit the cap, cannot top up
  | 'short' // not owned, not enough coins

/** How an item looks on the storefront: different states get different labels and buttons. */
export function itemStatus(s: ShopState, item: Item, config: ShopRoot): ItemStatus {
  if (item.kind === 'comingSoon') return 'soon'
  if (item.kind === 'scoreMultPermanent' && isOwned(s, item)) return 'active'
  if (item.kind !== 'scoreMultTemporary' && isOwned(s, item)) {
    const slot = slotOf(item)
    return slot !== null && s.equipped[slot] === item.id ? 'equipped' : 'owned'
  }
  if (canBuy(s, item, config)) return 'buyable'
  return item.kind === 'scoreMultTemporary' && s.balance >= item.price ? 'maxed' : 'short'
}

/**
  * Whether to show the shop entrance on the main screen. The icon is hidden until the player has finished at least one game:
  * the main screen stays "bare" (one goal in 3 seconds, AGENTS.md §11), and the first game goes with the demo explainer
  * without extra buttons. Anyone who has played before (there are high scores in the leaderboard) sees the shop right away.
 */
export function isShopUnlocked(flags: { readonly finishedGame: boolean; readonly hasRecords: boolean }): boolean {
  return flags.finishedGame || flags.hasRecords
}

/**
  * Whether there is something new the coins can afford: then the game-over screen shows a secondary "To the shop" button.
  * Temporary multipliers do not count: they can be topped up endlessly, and the button would glow forever.
  * Locked "Soon" items and already owned ones do not count either.
 */
export function hasAffordableNew(s: ShopState, config: ShopRoot, geometry?: ObstacleGeometry): boolean {
  return catalog(config).some(
    (it) => it.kind !== 'scoreMultTemporary' && itemStatus(s, it, config) === 'buyable' && !isItemLocked(s, it, config, geometry),
  )
}

/** The clear zone and wall numbers (config.obstacles) that determine whether a cube of a given size has obstacles. */
export interface ObstacleGeometry {
  readonly clearRadius: number
  readonly wallMargin: number
}

/**
  * The "Obstacles" section is pointless while an arena without obstacles is equipped (5³: the clear zone covers the whole cube).
  * The density choice is NOT erased: it is kept and comes back with a big arena. No geometry means not locked.
 */
export function obstaclesLocked(s: ShopState, config: ShopRoot, geometry: ObstacleGeometry | undefined): boolean {
  if (geometry === undefined) return false
  return !arenaHasObstacles(selectedArenaSize(s, config), geometry.clearRadius, geometry.wallMargin)
}

/** The item can neither be bought nor equipped right now, though otherwise available: obstacle density in an arena without obstacles. */
export function isItemLocked(s: ShopState, item: Item, config: ShopRoot, geometry: ObstacleGeometry | undefined): boolean {
  return item.kind === 'obstacleDensity' && obstaclesLocked(s, config, geometry)
}

export interface RunResult {
  /** Coins for the game (after the multiplier). */
  readonly gained: number
  /** The coin multiplier in effect in this game. */
  readonly mult: number
}

/**
  * The game wallet. Holds the shop state and guards the order of shop/: `earn` without `beginSession` would credit ×1
  * and nobody would notice. So coins can only be credited for a game that `begin` opened, and exactly once.
  * No DOM or storage: the caller saves after every change.
 */
export interface Wallet {
  readonly state: ShopState
  readonly config: ShopRoot
  /** Whether a game is in progress for which nothing has been credited yet. */
  readonly runOpen: boolean
  /** Game start: freezes the multiplier and spends one game of the temporary items. */
  begin(): void
  /** Game end (death or exit): apples -> coins. Without an open game (or a second time): null and nothing changes. */
  settle(apples: number): RunResult | null
  buy(item: Item): boolean
  equip(item: Item): boolean
}

export function createWallet(initial: ShopState, config: ShopRoot): Wallet {
  let state = initial
  let open = false
  return {
    get state() {
      return state
    },
    config,
    get runOpen() {
      return open
    },
    begin() {
      state = beginSession(state, config)
      open = true
    },
    settle(apples) {
      if (!open) return null
      open = false
      const mult = currentSessionMultiplier(state)
      const before = state.balance
      state = earn(state, apples, config)
      return { gained: Math.max(0, state.balance - before), mult }
    },
    buy(item) {
      const next = buy(state, item, config)
      const changed = next !== state
      state = next
      return changed
    },
    equip(item) {
      const next = equip(state, item, config)
      const changed = next !== state
      state = next
      return changed
    },
  }
}

export interface ShopSection {
  /** Dictionary key of the heading: `shop.section.<id>`. */
  readonly id: 'boost' | 'arena' | 'obstacles' | 'pace' | 'mult' | 'palette' | 'snakeSkin' | 'appleSkin' | 'compassSkin' | 'soon'
  readonly kinds: readonly ItemKind[]
}

/** Order and makeup of the storefront sections: first what changes the game (boost, arena, obstacles, pace), then coins, then looks. The two kinds of coin multiplier live in one section; "Soon" without a slot goes last. */
export const SHOP_SECTIONS: readonly ShopSection[] = [
  { id: 'boost', kinds: ['boost'] },
  { id: 'arena', kinds: ['arenaSize'] },
  { id: 'obstacles', kinds: ['obstacleDensity'] },
  { id: 'pace', kinds: ['pace'] },
  { id: 'mult', kinds: ['scoreMultTemporary', 'scoreMultPermanent'] },
  { id: 'palette', kinds: ['palette'] },
  { id: 'snakeSkin', kinds: ['snakeSkin'] },
  { id: 'appleSkin', kinds: ['appleSkin'] },
  { id: 'compassSkin', kinds: ['compassSkin'] },
  { id: 'soon', kinds: [] },
]

/** The slot a section belongs to ("Soon" has no slot; "Coin multiplier" has a slot only for the locked item, there is nothing to equip into it). */
export const SECTION_SLOT: Readonly<Record<ShopSection['id'], string | null>> = {
  boost: 'boost',
  arena: 'arenaSize',
  obstacles: 'obstacles',
  pace: 'pace',
  mult: 'mult', // the section has no equippable slot, but "Soon" items are marked with this name
  palette: 'palette',
  snakeSkin: 'snakeSkin',
  appleSkin: 'appleSkin',
  compassSkin: 'compassSkin',
  soon: null,
}

/**
  * Section items. A locked "???" item sits in the section of its slot (payload.slot): there it is visible
  * what exactly will be added here. Without a slot (or with an unknown one) it goes to the last "Soon" section.
 */
export function itemsOfSection(items: readonly Item[], section: ShopSection): Item[] {
  const out: Item[] = []
  for (const kind of section.kinds) for (const it of items) if (it.kind === kind) out.push(it)
  const slot = SECTION_SLOT[section.id]
  for (const it of items) {
    if (it.kind !== 'comingSoon') continue
    if (slot !== null ? it.payload.slot === slot : section.id === 'soon' && !isKnownSlot(it.payload.slot)) out.push(it)
  }
  return out
}

function isKnownSlot(slot: string | undefined): boolean {
  return slot !== undefined && Object.values(SECTION_SLOT).includes(slot)
}

/**
  * Carrying over the choice from old settings: for a player who had no shop yet, the saved arena size stays
  * selected even if it costs coins in the shop (otherwise a player who played on 50³ would silently return to 20³).
  * The size is not in the catalog or is already equipped: the state does not change.
 */
export function grandfatherArena(s: ShopState, size: number, config: ShopRoot): ShopState {
  const item = catalog(config).find((it) => it.kind === 'arenaSize' && it.payload.size === size)
  if (item === undefined || s.equipped.arenaSize === item.id) return s
  return {
    ...s,
    owned: s.owned.includes(item.id) ? [...s.owned] : [...s.owned, item.id],
    equipped: { ...s.equipped, arenaSize: item.id },
  }
}
