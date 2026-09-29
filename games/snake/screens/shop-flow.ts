// screens/shop-flow.ts — чистые решения витрины и потока вокруг магазина: без DOM, хранилища и времени.
// Предметная часть — shop/ (кошелёк, каталог, покупки, надетое); здесь только то, что решает витрина.

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
  | 'soon' // закрыт вопросиками: не купить, не надеть
  | 'equipped' // надето
  | 'owned' // куплено, не надето
  | 'active' // множитель монет куплен насовсем: надевать нечего, он просто действует
  | 'buyable' // не куплено, денег хватает
  | 'maxed' // временный множитель: срок уже упёрся в потолок, докупить нельзя
  | 'short' // не куплено, денег не хватает

/** Как предмет выглядит на витрине: разные состояния — разные подписи и кнопки. */
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
 * Показывать ли вход в магазин на главном экране. Иконка спрятана, пока игрок не закончил хотя бы одну партию:
 * главный экран остаётся «голым» (одна цель за 3 секунды, AGENTS.md §11), а первая партия идёт с демо-объяснением
 * без лишних кнопок. Кто уже играл раньше (в таблице есть рекорды), магазин видит сразу.
 */
export function isShopUnlocked(flags: { readonly finishedGame: boolean; readonly hasRecords: boolean }): boolean {
  return flags.finishedGame || flags.hasRecords
}

/**
 * Есть ли на что новое хватает денег: тогда на экране проигрыша появляется вторичная кнопка «В магазин».
 * Временные множители (расходники) не считаются: их можно докупать без конца, и кнопка светилась бы вечно.
 * Закрытые «скоро» и уже купленное тоже не считаются.
 */
export function hasAffordableNew(s: ShopState, config: ShopRoot, geometry?: ObstacleGeometry): boolean {
  return catalog(config).some(
    (it) => it.kind !== 'scoreMultTemporary' && itemStatus(s, it, config) === 'buyable' && !isItemLocked(s, it, config, geometry),
  )
}

/** Числа зоны очистки и стенок (config.obstacles), от которых зависит, бывают ли препятствия в кубе данного размера. */
export interface ObstacleGeometry {
  readonly clearRadius: number
  readonly wallMargin: number
}

/**
 * Раздел «Препятствия» бессмысленен, пока надета арена, где препятствий не бывает (5³: зона очистки накрывает весь куб).
 * Выбор плотности при этом НЕ стирается: он хранится и вернётся вместе с большой ареной. Нет геометрии — не заперто.
 */
export function obstaclesLocked(s: ShopState, config: ShopRoot, geometry: ObstacleGeometry | undefined): boolean {
  if (geometry === undefined) return false
  return !arenaHasObstacles(selectedArenaSize(s, config), geometry.clearRadius, geometry.wallMargin)
}

/** Предмет нельзя ни купить, ни надеть прямо сейчас, хотя в остальном доступен: плотность препятствий при арене без препятствий. */
export function isItemLocked(s: ShopState, item: Item, config: ShopRoot, geometry: ObstacleGeometry | undefined): boolean {
  return item.kind === 'obstacleDensity' && obstaclesLocked(s, config, geometry)
}

export interface RunResult {
  /** Монеты за партию (после множителя). */
  readonly gained: number
  /** Множитель монет, действовавший в этой партии. */
  readonly mult: number
}

/**
 * Кошелёк партии. Держит состояние магазина и не даёт забыть порядок shop/: `earn` без `beginSession` начислил бы ×1
 * и никто бы не заметил. Поэтому начислить можно только за партию, которую открыла `begin`, и ровно один раз.
 * Без DOM и хранилища: сохранение делает вызывающий после каждого изменения.
 */
export interface Wallet {
  readonly state: ShopState
  readonly config: ShopRoot
  /** Идёт ли партия, за которую ещё не начислено. */
  readonly runOpen: boolean
  /** Старт партии: замораживает множитель и списывает партию у временных предметов. */
  begin(): void
  /** Конец партии (смерть или выход): яблоки -> монеты. Без открытой партии (или второй раз) — null и ничего не меняется. */
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
  /** Ключ заголовка в словаре: `shop.section.<id>`. */
  readonly id: 'boost' | 'arena' | 'obstacles' | 'pace' | 'mult' | 'palette' | 'snakeSkin' | 'appleSkin' | 'compassSkin' | 'soon'
  readonly kinds: readonly ItemKind[]
}

/** Порядок и состав разделов витрины: сначала то, что меняет партию (ускорение, арена, препятствия, темп), затем монеты, затем внешний вид. Два вида множителя монет живут в одном разделе; «скоро» без слота — последним. */
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

/** Слот, которому принадлежит раздел (у «Скоро» слота нет; у «Множителя монет» слот только для заглушки, надеть в него нечего). */
export const SECTION_SLOT: Readonly<Record<ShopSection['id'], string | null>> = {
  boost: 'boost',
  arena: 'arenaSize',
  obstacles: 'obstacles',
  pace: 'pace',
  mult: 'mult', // у раздела нет надеваемого слота, но «скоро» помечается этим именем
  palette: 'palette',
  snakeSkin: 'snakeSkin',
  appleSkin: 'appleSkin',
  compassSkin: 'compassSkin',
  soon: null,
}

/**
 * Предметы раздела. Закрытый вопросиками предмет стоит в разделе своего слота (payload.slot): там видно,
 * что именно здесь пополнится. Без слота (или с неизвестным) он уходит в последний раздел «Скоро».
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
 * Перенос выбора из старых настроек: у игрока, у которого магазина ещё не было, сохранённый размер арены остаётся
 * выбранным, даже если в магазине он стоит денег (иначе игрок, игравший на 50³, молча вернулся бы на 20³).
 * Размера нет в каталоге или он уже надет — состояние не меняется.
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
