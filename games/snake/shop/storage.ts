// shop/storage.ts — строка для localStorage (ключ snake:shop) и разбор обратно.
// Сам localStorage трогает витрина: здесь только чистые serialize/parse без DOM.
//
// parse не доверяет ничему: мусор, чужой JSON, неизвестные id, дубли, чужие слоты, отрицательные и
// нечисловые суммы. Испорченное заменяется значением по умолчанию, а не догадкой: мусор никогда не
// дарит денег и не выдаёт предметов. Подделанный, но правдоподобный баланс не проверяется (игра локальная).

import { findItem, initialState, slotOf, SLOTS, toCoins } from './shop'
import type { ShopRoot, ShopState, Slot, TemporaryEntry } from './types'

export const SHOP_STORAGE_KEY = 'snake:shop'

/** Версия формата строки. Не баланс: смена формата, чтобы старые сохранения можно было опознать. */
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
 * Разбор сохранения. null, пусто, битый JSON и не-объект дают состояние по умолчанию.
 * Никогда не бросает.
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

  // Числа: только конечные ≥ 0, иначе 0 (для баланса — стартовый). Отрицательного баланса не бывает.
  const hasBalance = typeof data['balance'] === 'number' && Number.isFinite(data['balance'])
  const balance = hasBalance ? toCoins(data['balance']) : fresh.balance
  const totalEarned = Math.max(toCoins(data['totalEarned']), 0)

  // Купленное: только известные постоянные предметы; выданное по умолчанию есть всегда.
  const owned = [...fresh.owned]
  if (Array.isArray(data['owned'])) {
    for (const id of data['owned']) {
      if (typeof id !== 'string' || owned.includes(id)) continue
      const it = findItem(config, id)
      if (it === undefined || it.kind === 'comingSoon' || it.kind === 'scoreMultTemporary') continue
      owned.push(id)
    }
  }

  // Надетое: предмет должен быть куплен и подходить слоту, иначе слот берёт значение по умолчанию.
  const equipped: Partial<Record<Slot, string>> = { ...fresh.equipped }
  if (isRecord(data['equipped'])) {
    for (const slot of SLOTS) {
      const id = data['equipped'][slot]
      if (typeof id !== 'string' || !owned.includes(id)) continue
      const it = findItem(config, id)
      if (it !== undefined && slotOf(it) === slot) equipped[slot] = id
    }
  }

  // Временные: только известные временные множители, срок целый в [1, maxTemporaryGames], без дублей.
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
