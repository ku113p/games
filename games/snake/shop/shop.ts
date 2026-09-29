// shop/shop.ts — catalog, purchases, equipping, earning. All functions are pure: state is not mutated,
// a new one is returned. All numbers come from config.json (shop section), none are in the code.

import type { Item, ItemKind, ItemPayload, ShopRoot, ShopState, Slot, TemporaryEntry } from './types'

/** The item's slot by kind. Coin multipliers and coming-soon slots have no slot. This is catalog structure, not balance. */
const SLOT_OF_KIND: Readonly<Partial<Record<ItemKind, Slot>>> = {
  boost: 'boost',
  palette: 'palette',
  snakeSkin: 'snakeSkin',
  appleSkin: 'appleSkin',
  compassSkin: 'compassSkin',
  arenaSize: 'arenaSize',
  obstacleDensity: 'obstacles',
  pace: 'pace',
}

export const SLOTS: readonly Slot[] = ['boost', 'palette', 'snakeSkin', 'appleSkin', 'compassSkin', 'arenaSize', 'obstacles', 'pace']

const KINDS: ReadonlySet<string> = new Set<ItemKind>([
  'boost',
  'scoreMultPermanent',
  'scoreMultTemporary',
  'palette',
  'snakeSkin',
  'appleSkin',
  'compassSkin',
  'arenaSize',
  'obstacleDensity',
  'pace',
  'comingSoon',
])

export function slotOf(item: Item): Slot | null {
  return SLOT_OF_KIND[item.kind] ?? null
}

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0
}

/** An integer ≥ 0 within the safe integers: anything that is not a number is 0. */
export function toCoins(n: unknown): number {
  if (!isCount(n)) return 0
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n))
}

/** From a raw payload only fields of the expected type are taken: the rest is dropped. */
function normalizePayload(raw: object | undefined): ItemPayload {
  const src = (raw ?? {}) as Record<string, unknown>
  const out: ItemPayload = {}
  if (typeof src['factor'] === 'number') out.factor = src['factor']
  if (typeof src['mult'] === 'number') out.mult = src['mult']
  if (typeof src['palette'] === 'string') out.palette = src['palette']
  if (typeof src['skin'] === 'string') out.skin = src['skin']
  if (typeof src['slot'] === 'string') out.slot = src['slot']
  if (typeof src['size'] === 'number') out.size = src['size']
  if (typeof src['density'] === 'number') out.density = src['density']
  if (typeof src['scale'] === 'number') out.scale = src['scale']
  return out
}

function multOf(item: Item | undefined): number {
  const m = item?.payload.mult
  return m !== undefined && Number.isFinite(m) && m >= 1 ? m : 1
}

const catalogCache = new WeakMap<object, readonly Item[]>()

/**
  * Catalog from config.shop.items. Invalid rows (no id, unknown kind, duplicate id, price not a number
  * or negative, multiplier not a number ≥ 1, temporary without a term) are dropped rather than repaired:
  * a corrupted config must not hand out items for free.
 */
export function catalog(config: ShopRoot): readonly Item[] {
  const cached = catalogCache.get(config)
  if (cached !== undefined) return cached
  const out: Item[] = []
  const seen = new Set<string>()
  for (const raw of config.shop.items) {
    if (typeof raw.id !== 'string' || raw.id === '' || seen.has(raw.id)) continue
    if (!KINDS.has(raw.kind) || !isCount(raw.price)) continue
    const kind = raw.kind as ItemKind
    const payload = normalizePayload(raw.payload)
    if (kind === 'boost' && !(payload.factor !== undefined && payload.factor >= 1 && Number.isFinite(payload.factor))) continue
    if (
      (kind === 'scoreMultPermanent' || kind === 'scoreMultTemporary') &&
      !(payload.mult !== undefined && payload.mult >= 1 && Number.isFinite(payload.mult))
    ) {
      continue
    }
    if (kind === 'arenaSize' && !(payload.size !== undefined && Number.isInteger(payload.size) && payload.size >= 1)) continue
    if (kind === 'obstacleDensity' && !(payload.density !== undefined && Number.isFinite(payload.density) && payload.density >= 0)) continue
    if (kind === 'pace' && !(payload.scale !== undefined && Number.isFinite(payload.scale) && payload.scale > 0)) continue
    if (kind === 'scoreMultTemporary' && !(typeof raw.games === 'number' && Number.isInteger(raw.games) && raw.games >= 1)) continue
    seen.add(raw.id)
    const item: Item = { id: raw.id, kind, price: raw.price, payload }
    if (kind === 'scoreMultTemporary') item.games = raw.games as number
    out.push(item)
  }
  catalogCache.set(config, out)
  return out
}

export function findItem(config: ShopRoot, id: string): Item | undefined {
  return catalog(config).find((it) => it.id === id)
}

/** A new game without a save: what is granted by default (config.shop.defaults). */
export function initialState(config: ShopRoot): ShopState {
  const d = config.shop.defaults
  const owned: string[] = []
  const equipped: Partial<Record<Slot, string>> = {}
  for (const id of d.owned) {
    const it = findItem(config, id)
    if (it !== undefined && it.kind !== 'comingSoon' && it.kind !== 'scoreMultTemporary' && !owned.includes(id)) owned.push(id)
  }
  for (const slot of SLOTS) {
    const id = d.equipped[slot]
    if (id === undefined) continue
    const it = findItem(config, id)
    if (it !== undefined && slotOf(it) === slot && owned.includes(id)) equipped[slot] = id
  }
  return { balance: toCoins(d.balance), totalEarned: 0, owned, equipped, temporary: [], sessionMult: 1 }
}

export function isOwned(state: ShopState, item: Item): boolean {
  return state.owned.includes(item.id)
}

/** How many games a temporary item has left (0 if not in effect). */
export function gamesLeft(state: ShopState, item: Item): number {
  return state.temporary.find((t) => t.id === item.id)?.gamesLeft ?? 0
}

/**
  * Whether it can be bought. The item is taken from the catalog by id (a forged copy with a different price does not pass).
  * A coming-soon slot: never. An already owned permanent item: no. A temporary multiplier can be bought again
  * (extends the term) until the term reaches config.shop.maxTemporaryGames. Not enough coins: no.
 */
export function canBuy(state: ShopState, item: Item, config: ShopRoot): boolean {
  const it = findItem(config, item.id)
  if (it === undefined || it.kind === 'comingSoon') return false
  if (state.balance < it.price) return false
  if (it.kind === 'scoreMultTemporary') return gamesLeft(state, it) < config.shop.maxTemporaryGames
  return !isOwned(state, it)
}

/**
  * Purchase. Pure: returns a NEW state; if it cannot be bought, the same reference unchanged,
  * the balance is untouched. Equipping is separate (equip). For a temporary multiplier the term is added
  * to the remainder, but not above config.shop.maxTemporaryGames.
 */
export function buy(state: ShopState, item: Item, config: ShopRoot): ShopState {
  if (!canBuy(state, item, config)) return state
  const it = findItem(config, item.id) as Item
  const balance = state.balance - it.price
  if (it.kind === 'scoreMultTemporary') {
    const cap = config.shop.maxTemporaryGames
    const add = it.games ?? 0
    const temporary: TemporaryEntry[] = []
    let found = false
    for (const t of state.temporary) {
      if (t.id === it.id) {
        temporary.push({ id: t.id, gamesLeft: Math.min(cap, t.gamesLeft + add) })
        found = true
      } else {
        temporary.push({ id: t.id, gamesLeft: t.gamesLeft })
      }
    }
    if (!found) temporary.push({ id: it.id, gamesLeft: Math.min(cap, add) })
    return { ...state, balance, owned: [...state.owned], equipped: { ...state.equipped }, temporary }
  }
  return {
    ...state,
    balance,
    owned: [...state.owned, it.id],
    equipped: { ...state.equipped },
    temporary: state.temporary.map((t) => ({ id: t.id, gamesLeft: t.gamesLeft })),
  }
}

/** Equip an owned item. Does not equip an unowned item, a coming-soon slot or an item without a slot: returns the same state. */
export function equip(state: ShopState, item: Item, config: ShopRoot): ShopState {
  const it = findItem(config, item.id)
  const slot = it === undefined ? null : slotOf(it)
  if (it === undefined || slot === null || !isOwned(state, it)) return state
  return {
    ...state,
    owned: [...state.owned],
    equipped: { ...state.equipped, [slot]: it.id },
    temporary: state.temporary.map((t) => ({ id: t.id, gamesLeft: t.gamesLeft })),
  }
}

/** Coin multiplier (scoreMult*) the NEXT game will have: best permanent × best temporary (of the same kind they do not add up). */
export function scoreMultiplier(state: ShopState, config: ShopRoot): number {
  let perm = 1
  let temp = 1
  for (const id of state.owned) {
    const it = findItem(config, id)
    if (it?.kind === 'scoreMultPermanent') perm = Math.max(perm, multOf(it))
  }
  for (const t of state.temporary) {
    const it = findItem(config, t.id)
    if (it?.kind === 'scoreMultTemporary' && t.gamesLeft >= 1) temp = Math.max(temp, multOf(it))
  }
  return perm * temp
}

/** Coins for a game at a given multiplier (rounded to the nearest integer). */
export function payout(config: ShopRoot, applesEaten: number, mult: number): number {
  if (!isCount(applesEaten)) return 0
  const m = Number.isFinite(mult) && mult >= 1 ? mult : 1
  return toCoins(Math.round(Math.floor(applesEaten) * config.shop.coinPerApple * m))
}

/**
  * Earning after a game: apples × coinPerApple × the multiplier frozen in beginSession.
  * The multiplier is reset: a second earn without a new beginSession does not repeat it.
  * The game result in the leaderboard does not depend on the wallet and does not take part here.
 */
export function earn(state: ShopState, applesEaten: number, config: ShopRoot): ShopState {
  const coins = payout(config, applesEaten, state.sessionMult)
  return {
    ...state,
    balance: toCoins(state.balance + coins),
    totalEarned: toCoins(state.totalEarned + coins),
    owned: [...state.owned],
    equipped: { ...state.equipped },
    temporary: state.temporary.map((t) => ({ id: t.id, gamesLeft: t.gamesLeft })),
    sessionMult: 1,
  }
}

/**
  * Game start: freezes this game's multiplier, spends one game of the temporary items and removes
  * the expired ones. A multiplier with one game left pays for it and disappears right after the start:
  * exactly after the last game.
 */
export function beginSession(state: ShopState, config: ShopRoot): ShopState {
  const sessionMult = scoreMultiplier(state, config)
  const temporary: TemporaryEntry[] = []
  for (const t of state.temporary) {
    if (t.gamesLeft > 1) temporary.push({ id: t.id, gamesLeft: t.gamesLeft - 1 })
  }
  return { ...state, owned: [...state.owned], equipped: { ...state.equipped }, temporary, sessionMult }
}

/** Multiplier of the game in progress (after beginSession and before earn); outside a game, 1. */
export function currentSessionMultiplier(state: ShopState): number {
  return state.sessionMult
}

/**
  * The selected boost for createGame. The equipped one if it is owned and valid; otherwise config.shop.defaultBoost;
  * if that is invalid too, config.speed.boostFactor.
 */
export function selectedBoostFactor(state: ShopState, config: ShopRoot): number {
  const id = state.equipped.boost
  const it = id === undefined ? undefined : findItem(config, id)
  if (it?.kind === 'boost' && it.payload.factor !== undefined && state.owned.includes(it.id)) return it.payload.factor
  const d = config.shop.defaultBoost
  return Number.isFinite(d) && d >= 1 ? d : config.speed.boostFactor
}

/** The item equipped in a slot (or undefined). For cosmetics: the storefront reads the payload. */
export function equippedItem(state: ShopState, config: ShopRoot, slot: Slot): Item | undefined {
  const id = state.equipped[slot]
  if (id === undefined || !state.owned.includes(id)) return undefined
  const it = findItem(config, id)
  return it !== undefined && slotOf(it) === slot ? it : undefined
}

function equippedPayload(state: ShopState, config: ShopRoot, slot: Slot, kind: ItemKind): ItemPayload | undefined {
  const it = equippedItem(state, config, slot)
  return it?.kind === kind ? it.payload : undefined
}

/** Selected arena size (cube edge). Nothing equipped or invalid: config.shop.defaultArenaSize. */
export function selectedArenaSize(state: ShopState, config: ShopRoot): number {
  return equippedPayload(state, config, 'arenaSize', 'arenaSize')?.size ?? config.shop.defaultArenaSize
}

/** Selected obstacle multiplier for createGame (options.obstacleMult). Defaults to 1. */
export function selectedObstacleMult(state: ShopState, config: ShopRoot): number {
  return equippedPayload(state, config, 'obstacles', 'obstacleDensity')?.density ?? 1
}

/** Selected pace scale for createGame (options.paceScale). Defaults to 1. */
export function selectedPaceScale(state: ShopState, config: ShopRoot): number {
  return equippedPayload(state, config, 'pace', 'pace')?.scale ?? 1
}

/** Everything needed for a new game: createGame(config, size, seed, first, boostFactor, { obstacleMult, paceScale }). */
export function gameSetup(
  state: ShopState,
  config: ShopRoot,
): { size: number; boostFactor: number; obstacleMult: number; paceScale: number; scoreMultiplier: number } {
  return {
    size: selectedArenaSize(state, config),
    boostFactor: selectedBoostFactor(state, config),
    obstacleMult: selectedObstacleMult(state, config),
    paceScale: selectedPaceScale(state, config),
    scoreMultiplier: scoreMultiplier(state, config),
  }
}
