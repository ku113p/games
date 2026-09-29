// shop/index.ts — публичный вход магазина. Витрина импортирует только отсюда.
export type { Item, ItemKind, ItemPayload, RawItem, ShopConfig, ShopRoot, ShopState, Slot, TemporaryEntry } from './types'
export {
  SLOTS,
  beginSession,
  buy,
  canBuy,
  catalog,
  currentSessionMultiplier,
  gameSetup,
  selectedArenaSize,
  selectedObstacleMult,
  selectedPaceScale,
  earn,
  equip,
  equippedItem,
  findItem,
  gamesLeft,
  initialState,
  isOwned,
  payout,
  scoreMultiplier,
  selectedBoostFactor,
  slotOf,
} from './shop'
export { SHOP_STORAGE_KEY, parse, serialize } from './storage'
