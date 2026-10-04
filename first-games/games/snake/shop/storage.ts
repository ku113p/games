// shop/storage.ts — the string for localStorage (key snake:shop) and parsing it back.
// The storefront touches localStorage itself: only pure serialize/parse without the DOM live here.
//
// parse trusts nothing: garbage, foreign JSON, unknown ids, duplicates, foreign slots, negative and
// non-numeric amounts. Corrupted data is replaced by the default rather than a guess: garbage never
// grants coins or hands out items. A forged but plausible balance is not checked (the game is local).

import { findItem, initialState, slotOf, SLOTS, toCoins } from './shop'
import type { ShopRoot, ShopState, Slot, TemporaryEntry } from './types'

export const SHOP_STORAGE_KEY = 'snake:shop'

/** Version of the string format. Not balance: a format change so that old saves can be recognized. */
const FORMAT_VERSION = 1

export function serialize(state: ShopState): string {
  return JSON.stringify({
    v: FORMAT_VERSION,
    balance: state.balance,
    totalEarned: state.totalEarned,
    owned: state.owned,
    equipped: state.equipped,
    temporary: state.temporary,
  })
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
  * Parsing a save. null, empty, broken JSON and non-objects yield the default state.
  * Never throws.
 */
export function parse(raw: string | null | undefined, config: ShopRoot): ShopState {
  const fresh = initialState(config)
  if (typeof raw !== 'string' || raw === '') return fresh
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return fresh
  }
  if (!isRecord(data)) return fresh

  // Numbers: only finite ≥ 0, otherwise 0 (for the balance, the starting one). There is no negative balance.
  const hasBalance = typeof data['balance'] === 'number' && Number.isFinite(data['balance'])
  const balance = hasBalance ? toCoins(data['balance']) : fresh.balance
  const totalEarned = Math.max(toCoins(data['totalEarned']), 0)

  // Owned: only known permanent items; the defaults are always owned.
  const owned = [...fresh.owned]
  if (Array.isArray(data['owned'])) {
    for (const id of data['owned']) {
      if (typeof id !== 'string' || owned.includes(id)) continue
      const it = findItem(config, id)
      if (it === undefined || it.kind === 'comingSoon' || it.kind === 'scoreMultTemporary') continue
      owned.push(id)
    }
  }

  // Equipped: the item must be owned and fit the slot, otherwise the slot takes its default.
  const equipped: Partial<Record<Slot, string>> = { ...fresh.equipped }
  if (isRecord(data['equipped'])) {
    for (const slot of SLOTS) {
      const id = data['equipped'][slot]
      if (typeof id !== 'string' || !owned.includes(id)) continue
      const it = findItem(config, id)
      if (it !== undefined && slotOf(it) === slot) equipped[slot] = id
    }
  }

  // Temporary: only known temporary multipliers, the term is an integer in [1, maxTemporaryGames], no duplicates.
  const temporary: TemporaryEntry[] = []
  if (Array.isArray(data['temporary'])) {
    for (const t of data['temporary']) {
      if (!isRecord(t) || typeof t['id'] !== 'string') continue
      if (temporary.some((x) => x.id === t['id'])) continue
      const it = findItem(config, t['id'])
      if (it === undefined || it.kind !== 'scoreMultTemporary') continue
      if (typeof t['gamesLeft'] !== 'number' || !Number.isFinite(t['gamesLeft'])) continue
      const left = Math.min(config.shop.maxTemporaryGames, Math.floor(t['gamesLeft']))
      if (left >= 1) temporary.push({ id: t['id'], gamesLeft: left })
    }
  }

  return { balance, totalEarned, owned, equipped, temporary, sessionMult: 1 }
}
