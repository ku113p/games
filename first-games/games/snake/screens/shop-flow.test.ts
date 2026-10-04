import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { catalog, gameSetup, initialState, parse, selectedBoostFactor, serialize, type Item, type ShopRoot, type ShopState } from '../shop'
import { SHOP_SECTIONS, createWallet, grandfatherArena, hasAffordableNew, isItemLocked, isShopUnlocked, itemStatus, itemsOfSection, obstaclesLocked } from './shop-flow'
import { createGame } from '../core/rules'
import { config as helperConfig } from '../core/test-helpers'

const cfg = configJson as unknown as ShopRoot
const items = catalog(cfg)
const byId = (id: string): Item => items.find((i) => i.id === id) as Item
const withBalance = (n: number): ShopState => ({ ...initialState(cfg), balance: n })
const wallet = (n: number) => createWallet(withBalance(n), cfg)

describe('shop entrance', () => {
  test('hidden until the first game is finished and there are no high scores', () => {
    expect(isShopUnlocked({ finishedGame: false, hasRecords: false })).toBe(false)
  })
  test('opens after the first game or if there are already high scores', () => {
    expect(isShopUnlocked({ finishedGame: true, hasRecords: false })).toBe(true)
    expect(isShopUnlocked({ finishedGame: false, hasRecords: true })).toBe(true)
  })
})

describe('game wallet: order begin -> settle', () => {
  test('coins = apples × the multiplier in effect at the start', () => {
    const w = createWallet({ ...withBalance(0), temporary: [{ id: 'score-temp-3', gamesLeft: 2 }] }, cfg)
    w.begin()
    expect(w.runOpen).toBe(true)
    expect(w.settle(5)).toEqual({ gained: 15, mult: 3 })
    expect(w.state.balance).toBe(15)
    expect(w.runOpen).toBe(false)
  })
  test('without begin nothing is credited (rather than a silent ×1)', () => {
    const w = wallet(10)
    expect(w.settle(7)).toBeNull()
    expect(w.state.balance).toBe(10)
  })
  test('a second settle for the same game gives nothing', () => {
    const w = wallet(0)
    w.begin()
    expect(w.settle(4)?.gained).toBe(4)
    expect(w.settle(4)).toBeNull()
    expect(w.state.balance).toBe(4)
  })
  test('the last game of a temporary multiplier pays by it, the next one no longer does', () => {
    const w = createWallet({ ...withBalance(0), temporary: [{ id: 'score-temp-2', gamesLeft: 1 }] }, cfg)
    w.begin()
    expect(w.settle(4)).toEqual({ gained: 8, mult: 2 })
    w.begin()
    expect(w.settle(4)).toEqual({ gained: 4, mult: 1 })
  })
  test('permanent and temporary multipliers multiply', () => {
    const w = createWallet({ ...withBalance(0), owned: [...initialState(cfg).owned, 'score-perm-1.5'], temporary: [{ id: 'score-temp-2', gamesLeft: 3 }] }, cfg)
    w.begin()
    expect(w.settle(10)).toEqual({ gained: 30, mult: 3 })
  })
  test('0 apples: 0 coins, the game is closed', () => {
    const w = wallet(0)
    w.begin()
    expect(w.settle(0)).toEqual({ gained: 0, mult: 1 })
  })
})

describe('buying and equipping are different actions', () => {
  test('bought does not mean equipped; the equipped item goes into createGame via selectedBoostFactor', () => {
    const b3 = byId('boost-3')
    const w = wallet(b3.price)
    expect(itemStatus(w.state, b3, cfg)).toBe('buyable')
    expect(w.buy(b3)).toBe(true)
    expect(itemStatus(w.state, b3, cfg)).toBe('owned')
    expect(selectedBoostFactor(w.state, cfg)).toBe(1.5)
    expect(w.equip(b3)).toBe(true)
    expect(itemStatus(w.state, b3, cfg)).toBe('equipped')
    expect(selectedBoostFactor(w.state, cfg)).toBe(3)
    expect(w.state.balance).toBe(0)
  })
  test('not enough coins: the purchase is refused and changes nothing', () => {
    const b4 = byId('boost-4')
    const w = wallet(b4.price - 1)
    expect(itemStatus(w.state, b4, cfg)).toBe('short')
    expect(w.buy(b4)).toBe(false)
    expect(w.state.balance).toBe(b4.price - 1)
  })
  test('an unowned item is not equipped', () => {
    const w = wallet(0)
    expect(w.equip(byId('boost-4'))).toBe(false)
  })
  test('a permanent multiplier: "active", nothing to equip', () => {
    const p = byId('score-perm-1.25')
    const w = wallet(p.price)
    w.buy(p)
    expect(itemStatus(w.state, p, cfg)).toBe('active')
    expect(w.equip(p)).toBe(false)
  })
  test('a temporary one can be topped up (stays "buyable") while there are enough coins', () => {
    const t2 = byId('score-temp-2')
    const w = wallet(t2.price * 2)
    w.buy(t2)
    expect(itemStatus(w.state, t2, cfg)).toBe('buyable')
    w.buy(t2)
    expect(w.state.temporary).toEqual([{ id: 'score-temp-2', gamesLeft: (t2.games ?? 0) * 2 }])
  })
  test('term at the cap: cannot top up, status "maxed"', () => {
    const t2 = byId('score-temp-2')
    const s: ShopState = { ...withBalance(t2.price), temporary: [{ id: t2.id, gamesLeft: cfg.shop.maxTemporaryGames }] }
    expect(itemStatus(s, t2, cfg)).toBe('maxed')
  })
})

describe('arena, obstacles, pace', () => {
  test('coins do not depend on difficulty: one apple is one coin at any settings', () => {
    for (const id of ['arena-100', 'density-0', 'pace-0.5']) {
      const it = byId(id)
      const w = wallet(it.price)
      w.buy(it)
      w.equip(it)
      w.begin()
      expect(w.settle(10)).toEqual({ gained: 10, mult: 1 })
    }
  })
  test('obstacles and pace reach the setup only after buying and equipping', () => {
    const d0 = byId('density-0')
    const p5 = byId('pace-0.5')
    const w = wallet(d0.price + p5.price)
    expect(gameSetup(w.state, cfg)).toMatchObject({ obstacleMult: 1, paceScale: 1 })
    w.buy(d0)
    w.buy(p5)
    expect(gameSetup(w.state, cfg)).toMatchObject({ obstacleMult: 1, paceScale: 1 })
    w.equip(d0)
    w.equip(p5)
    expect(gameSetup(w.state, cfg)).toMatchObject({ obstacleMult: 0, paceScale: 0.5 })
  })
  test('arena 50 is bought separately and reaches the setup only after equipping', () => {
    const a = byId('arena-50')
    const w = wallet(a.price)
    expect(gameSetup(w.state, cfg).size).toBe(20)
    w.buy(a)
    expect(gameSetup(w.state, cfg).size).toBe(20)
    w.equip(a)
    expect(gameSetup(w.state, cfg).size).toBe(50)
  })
  test('carrying over the old size choice: the saved size is equipped and owned, nothing extra is granted', () => {
    const s = grandfatherArena(initialState(cfg), 100, cfg)
    expect(gameSetup(s, cfg).size).toBe(100)
    expect(s.owned).toContain('arena-100')
    expect(s.balance).toBe(0)
    expect(s.owned).not.toContain('arena-50')
  })
  test('carry-over: the default, an unknown and an already equipped size change nothing', () => {
    const s0 = initialState(cfg)
    expect(grandfatherArena(s0, 20, cfg)).toBe(s0)
    expect(grandfatherArena(s0, 33, cfg)).toBe(s0)
    expect(grandfatherArena(s0, Number.NaN, cfg)).toBe(s0)
  })
  test('sections: arena, obstacles and pace exist, each with its own items', () => {
    for (const id of ['arena', 'obstacles', 'pace'] as const) {
      const sec = SHOP_SECTIONS.find((x) => x.id === id)
      expect(sec).toBeDefined()
      expect(itemsOfSection(items, sec as (typeof SHOP_SECTIONS)[number]).length).toBeGreaterThanOrEqual(4 - (id === 'arena' ? 1 : 0))
    }
  })
})

describe('"Soon"', () => {
  const soon = items.filter((i) => i.kind === 'comingSoon')
  test('the catalog has locked items, they can be neither bought nor equipped', () => {
    expect(soon.length).toBeGreaterThanOrEqual(SHOP_SECTIONS.length - 1)
    const w = wallet(1_000_000)
    for (const it of soon) {
      expect(itemStatus(w.state, it, cfg)).toBe('soon')
      expect(w.buy(it)).toBe(false)
      expect(w.equip(it)).toBe(false)
    }
    expect(w.state.balance).toBe(1_000_000)
  })
  test('a locked item sits in the section of its slot, not in a separate pile', () => {
    const snake = SHOP_SECTIONS.find((s) => s.id === 'snakeSkin') as (typeof SHOP_SECTIONS)[number]
    expect(itemsOfSection(items, snake).some((i) => i.id === 'snake-soon')).toBe(true)
    const tail = SHOP_SECTIONS.find((s) => s.id === 'soon') as (typeof SHOP_SECTIONS)[number]
    expect(itemsOfSection(items, tail)).toEqual([])
  })
  test('every storefront section (except the trailing "Soon") has its own coming-soon slot', () => {
    for (const sec of SHOP_SECTIONS) {
      if (sec.id === 'soon') continue
      expect(itemsOfSection(items, sec).some((i) => i.kind === 'comingSoon')).toBe(true)
    }
  })
  test('a "Soon" item with no known slot goes to the last section', () => {
    const orphan: Item = { id: 'x-soon', kind: 'comingSoon', price: 0, payload: {} }
    const tail = SHOP_SECTIONS[SHOP_SECTIONS.length - 1] as (typeof SHOP_SECTIONS)[number]
    expect(itemsOfSection([...items, orphan], tail).map((i) => i.id)).toEqual(['x-soon'])
  })
})

describe('storefront', () => {
  test('every catalog item is visible in exactly one section', () => {
    const seen = SHOP_SECTIONS.flatMap((sec) => itemsOfSection(items, sec).map((i) => i.id))
    expect(seen.sort()).toEqual(items.map((i) => i.id).sort())
  })
  test('every item named by id has its name in all dictionaries (cosmetics, pace, "No obstacles")', async () => {
    const { LANGUAGES } = await import('../i18n/dictionaries')
    for (const it of items) {
      if (!['palette', 'snakeSkin', 'appleSkin', 'compassSkin', 'pace'].includes(it.kind) && it.id !== 'density-0' && it.id !== 'arena-5') continue
      for (const lang of LANGUAGES) expect(`shop.item.${it.id}` in lang.dict).toBe(true)
    }
  })
})

describe('the "To the shop" button on the game-over screen', () => {
  test('without coins it is absent', () => {
    expect(hasAffordableNew(withBalance(0), cfg)).toBe(false)
  })
  test('enough for a new permanent item: present', () => {
    const cheapest = Math.min(...items.filter((i) => i.price > 0 && i.kind !== 'scoreMultTemporary').map((i) => i.price))
    expect(hasAffordableNew(withBalance(cheapest), cfg)).toBe(true)
    expect(hasAffordableNew(withBalance(cheapest - 1), cfg)).toBe(false)
  })
  test('only temporary items are affordable: no button', () => {
    const cheapestNonTemp = Math.min(...items.filter((i) => i.price > 0 && i.kind !== 'scoreMultTemporary').map((i) => i.price))
    const cheapestTemp = Math.min(...items.filter((i) => i.kind === 'scoreMultTemporary').map((i) => i.price))
    if (cheapestTemp < cheapestNonTemp) expect(hasAffordableNew(withBalance(cheapestTemp), cfg)).toBe(false)
  })
})

describe('save', () => {
  test('survives a round trip; garbage gives the default state', () => {
    const w = wallet(500)
    w.buy(byId('boost-2'))
    w.equip(byId('boost-2'))
    expect(parse(serialize(w.state), cfg)).toEqual(w.state)
    expect(parse('{{{', cfg)).toEqual(initialState(cfg))
    expect(parse(null, cfg)).toEqual(initialState(cfg))
  })
})

describe('arena 5³ and the "Obstacles" section', () => {
  const geo = configJson.obstacles
  const rich = (): ShopState => ({ ...withBalance(10_000) })
  const setup = (ids: string[]) => {
    const w = createWallet(rich(), cfg)
    for (const id of ids) {
      w.buy(byId(id))
      w.equip(byId(id))
    }
    return w
  }

  test('on 20³ the section is not locked, on 5³ it is', () => {
    expect(obstaclesLocked(withBalance(0), cfg, geo)).toBe(false)
    expect(obstaclesLocked(setup(['arena-5']).state, cfg, geo)).toBe(true)
    expect(obstaclesLocked(setup(['arena-50']).state, cfg, geo)).toBe(false)
  })

  test('no geometry: not locked (the old behavior)', () => {
    expect(obstaclesLocked(setup(['arena-5']).state, cfg, undefined)).toBe(false)
  })

  test('on 5³ density is locked, the rest is not; because of that the shop entrance does not glow', () => {
    const base = initialState(cfg)
    const state: ShopState = { ...base, balance: 300, owned: [...base.owned, 'arena-5'], equipped: { ...base.equipped, arenaSize: 'arena-5' } }
    expect(itemStatus(state, byId('density-0'), cfg)).toBe('buyable')
    expect(isItemLocked(state, byId('density-0'), cfg, geo)).toBe(true)
    expect(isItemLocked(state, byId('boost-2'), cfg, geo)).toBe(false)
    // 60 coins cover ×¼ and the boosts; leave only the densities: there must be no highlight
    const denseOnly: ShopState = { ...state, balance: 40, owned: [...state.owned, 'boost-2', 'apple-orb', 'apple-star', 'compass-chevron', 'pace-1.5', 'score-perm-1.25'].filter((id, i, a) => a.indexOf(id) === i) }
    expect(hasAffordableNew(denseOnly, cfg)).toBe(true) // without geometry, ×½ density for 40 would count as a purchase
    expect(hasAffordableNew(denseOnly, cfg, geo)).toBe(false)
  })

  test('the reverse case: ×2 equipped, 5³ bought and equipped: the ×2 choice is kept, the game runs without obstacles; back on 20³ the ×2 is in place', () => {
    const w = setup(['density-2'])
    expect(gameSetup(w.state, cfg).obstacleMult).toBe(2)
    w.buy(byId('arena-5'))
    w.equip(byId('arena-5'))
    expect(obstaclesLocked(w.state, cfg, geo)).toBe(true)
    const on5 = gameSetup(w.state, cfg)
    expect(on5.size).toBe(5)
    expect(on5.obstacleMult).toBe(2) // the choice was not erased
    const g5 = createGame({ ...helperConfig, obstacles: geo } as never, on5.size, 3, false, 2, { obstacleMult: on5.obstacleMult })
    expect(g5.obstacles.size).toBe(0) // but there are no obstacles in the game
    // through the save and back
    const reloaded = parse(serialize(w.state), cfg)
    expect(gameSetup(reloaded, cfg).obstacleMult).toBe(2)
    w.equip(byId('arena-20'))
    expect(obstaclesLocked(w.state, cfg, geo)).toBe(false)
    expect(gameSetup(w.state, cfg)).toMatchObject({ size: 20, obstacleMult: 2 })
  })
})
