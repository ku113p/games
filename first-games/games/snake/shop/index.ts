// shop/index.ts — the public entry point of the shop. The storefront imports only from here.
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
