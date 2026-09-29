// shop/shop.ts — каталог, покупки, надетое, начисление. Все функции чистые: состояние не мутируется,
// возвращается новое. Все числа — из config.json (раздел shop), в коде их нет.

import type { Item, ItemKind, ItemPayload, ShopRoot, ShopState, Slot, TemporaryEntry } from './types'

/** Слот предмета по виду. У множителей очков и заглушек слота нет. Это устройство каталога, не баланс. */
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

/** Целое ≥ 0 в пределах безопасных целых: всё, что не число, — 0. */
export function toCoins(n: unknown): number {
  if (!isCount(n)) return 0
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n))
}

/** Из сырого payload берутся только поля с ожидаемым типом: остальное отбрасывается. */
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
 * Каталог из config.shop.items. Негодные строки (нет id, неизвестный вид, дубль id, цена не число
 * или отрицательная, множитель не число ≥ 1, временный без срока) отбрасываются, а не чинятся:
 * испорченный конфиг не должен выдавать предметы даром.
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

/** Новая игра без сохранения: то, что выдано по умолчанию (config.shop.defaults). */
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

/** Сколько партий осталось у временного предмета (0, если не действует). */
export function gamesLeft(state: ShopState, item: Item): number {
  return state.temporary.find((t) => t.id === item.id)?.gamesLeft ?? 0
}

/**
 * Можно ли купить. Предмет берётся из каталога по id (подсунутая копия с другой ценой не проходит).
 * Заглушку — никогда. Уже купленное постоянное — нет. Временный множитель можно купить снова
 * (продлевает срок), пока срок не упёрся в config.shop.maxTemporaryGames. Денег не хватает — нет.
 */
export function canBuy(state: ShopState, item: Item, config: ShopRoot): boolean {
  const it = findItem(config, item.id)
  if (it === undefined || it.kind === 'comingSoon') return false
  if (state.balance < it.price) return false
  if (it.kind === 'scoreMultTemporary') return gamesLeft(state, it) < config.shop.maxTemporaryGames
  return !isOwned(state, it)
}

/**
 * Покупка. Чистая: возвращает НОВОЕ состояние; если купить нельзя — ту же ссылку без изменений,
 * баланс не трогается. Надевание — отдельно (equip). Для временного множителя срок прибавляется
 * к остатку, но не выше config.shop.maxTemporaryGames.
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

/** Надеть купленное. Некупленное, заглушку и предмет без слота не надевает: возвращает то же состояние. */
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

/** Множитель очков, каким будет СЛЕДУЮЩАЯ партия: лучший постоянный × лучший временный (одного вида не суммируются). */
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

/** Монеты за партию при заданном множителе (округление к ближайшему целому). */
export function payout(config: ShopRoot, applesEaten: number, mult: number): number {
  if (!isCount(applesEaten)) return 0
  const m = Number.isFinite(mult) && mult >= 1 ? mult : 1
  return toCoins(Math.round(Math.floor(applesEaten) * config.shop.coinPerApple * m))
}

/**
 * Начисление после партии: яблоки × coinPerApple × множитель, замороженный в beginSession.
 * Множитель сбрасывается: второй earn без нового beginSession множитель не повторит.
 * Результат партии в таблице рекордов от кошелька не зависит и здесь не участвует.
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
 * Старт партии: замораживает множитель этой партии, списывает одну партию у временных и снимает
 * истёкшие. Множитель, у которого осталась одна партия, платит за неё и пропадает сразу после старта:
 * ровно после последней партии.
 */
export function beginSession(state: ShopState, config: ShopRoot): ShopState {
  const sessionMult = scoreMultiplier(state, config)
  const temporary: TemporaryEntry[] = []
  for (const t of state.temporary) {
    if (t.gamesLeft > 1) temporary.push({ id: t.id, gamesLeft: t.gamesLeft - 1 })
  }
  return { ...state, owned: [...state.owned], equipped: { ...state.equipped }, temporary, sessionMult }
}

/** Множитель партии, которая идёт сейчас (после beginSession и до earn); вне партии — 1. */
export function currentSessionMultiplier(state: ShopState): number {
  return state.sessionMult
}

/**
 * Выбранное ускорение для createGame. Надетое, если оно куплено и годно; иначе config.shop.defaultBoost;
 * если и он негоден — config.speed.boostFactor.
 */
export function selectedBoostFactor(state: ShopState, config: ShopRoot): number {
  const id = state.equipped.boost
  const it = id === undefined ? undefined : findItem(config, id)
  if (it?.kind === 'boost' && it.payload.factor !== undefined && state.owned.includes(it.id)) return it.payload.factor
  const d = config.shop.defaultBoost
  return Number.isFinite(d) && d >= 1 ? d : config.speed.boostFactor
}

/** Предмет, надетый в слоте (или undefined). Для косметики: витрина читает payload. */
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

/** Выбранный размер арены (ребро куба). Нет надетого или негодно — config.shop.defaultArenaSize. */
export function selectedArenaSize(state: ShopState, config: ShopRoot): number {
  return equippedPayload(state, config, 'arenaSize', 'arenaSize')?.size ?? config.shop.defaultArenaSize
}

/** Выбранный множитель препятствий для createGame (options.obstacleMult). По умолчанию 1. */
export function selectedObstacleMult(state: ShopState, config: ShopRoot): number {
  return equippedPayload(state, config, 'obstacles', 'obstacleDensity')?.density ?? 1
}

/** Выбранный масштаб темпа для createGame (options.paceScale). По умолчанию 1. */
export function selectedPaceScale(state: ShopState, config: ShopRoot): number {
  return equippedPayload(state, config, 'pace', 'pace')?.scale ?? 1
}

/** Всё, что нужно для новой партии: createGame(config, size, seed, first, boostFactor, { obstacleMult, paceScale }). */
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
