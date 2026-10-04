import { describe, expect, test } from 'bun:test'
import {
  beginSession, buy, canBuy, catalog, currentSessionMultiplier, earn, equip, equippedItem, findItem, initialState,
  parse, payout, scoreMultiplier, selectedBoostFactor, serialize,
  gameSetup, selectedArenaSize, selectedObstacleMult, selectedPaceScale,
  type Item, type ShopRoot, type ShopState,
} from './index'

// Our own small config: the tests do not depend on how prices are tuned in config.json.
const cfg: ShopRoot = {
  speed: { boostFactor: 2 },
  shop: {
    coinPerApple: 1,
    defaultBoost: 1.5,
    defaultArenaSize: 20,
    maxTemporaryGames: 8,
    defaults: {
      balance: 0,
      owned: ['boost-1.5', 'pal-a', 'apple-a', 'arena-20', 'dens-1', 'pace-1'],
      equipped: { boost: 'boost-1.5', palette: 'pal-a', appleSkin: 'apple-a', arenaSize: 'arena-20', obstacles: 'dens-1', pace: 'pace-1' },
    },
    items: [
      { id: 'boost-1.5', kind: 'boost', price: 0, payload: { factor: 1.5 } },
      { id: 'boost-4', kind: 'boost', price: 100, payload: { factor: 4 } },
      { id: 'perm-1.5', kind: 'scoreMultPermanent', price: 50, payload: { mult: 1.5 } },
      { id: 'perm-1.25', kind: 'scoreMultPermanent', price: 20, payload: { mult: 1.25 } },
      { id: 'temp-2', kind: 'scoreMultTemporary', price: 30, payload: { mult: 2 }, games: 3 },
      { id: 'temp-4', kind: 'scoreMultTemporary', price: 60, payload: { mult: 4 }, games: 2 },
      { id: 'pal-a', kind: 'palette', price: 0, payload: { palette: 'a' } },
      { id: 'pal-b', kind: 'palette', price: 40, payload: { palette: 'b' } },
      { id: 'apple-a', kind: 'appleSkin', price: 0, payload: { skin: 'a' } },
      { id: 'apple-b', kind: 'appleSkin', price: 10, payload: { skin: 'b' } },
      { id: 'arena-20', kind: 'arenaSize', price: 0, payload: { size: 20 } },
      { id: 'arena-50', kind: 'arenaSize', price: 50, payload: { size: 50 } },
      { id: 'dens-1', kind: 'obstacleDensity', price: 0, payload: { density: 1 } },
      { id: 'dens-0', kind: 'obstacleDensity', price: 70, payload: { density: 0 } },
      { id: 'pace-1', kind: 'pace', price: 0, payload: { scale: 1 } },
      { id: 'pace-2', kind: 'pace', price: 20, payload: { scale: 2 } },
      { id: 'soon', kind: 'comingSoon', price: 0, payload: {} },
    ],
  },
}
const it = (id: string): Item => findItem(cfg, id) as Item
const rich = (n = 1000): ShopState => ({ ...initialState(cfg), balance: n })
const snapshot = (s: ShopState): string => JSON.stringify(s)

describe('catalog', () => {
  test('taken from the config, invalid rows are dropped', () => {
    const bad: ShopRoot = {
      ...cfg,
      shop: {
        ...cfg.shop,
        items: [
          { id: 'ok', kind: 'palette', price: 5, payload: {} },
          { id: 'ok', kind: 'palette', price: 1, payload: {} }, // duplicate
          { id: '', kind: 'palette', price: 1 },
          { id: 'x1', kind: 'nonsense', price: 1 },
          { id: 'x2', kind: 'palette', price: -5 },
          { id: 'x3', kind: 'palette', price: Number.NaN },
          { id: 'x4', kind: 'boost', price: 1, payload: { factor: 0.5 } },
          { id: 'x5', kind: 'scoreMultPermanent', price: 1, payload: {} },
          { id: 'x6', kind: 'scoreMultTemporary', price: 1, payload: { mult: 2 } }, // no term
        ],
      },
    }
    expect(catalog(bad).map((i) => i.id)).toEqual(['ok'])
    expect(catalog(cfg).length).toBe(cfg.shop.items.length)
  })
})

describe('purchase', () => {
  test('with not enough coins it is not bought, the state does not change', () => {
    const s = { ...initialState(cfg), balance: 99 }
    const before = snapshot(s)
    expect(canBuy(s, it('boost-4'), cfg)).toBe(false)
    expect(buy(s, it('boost-4'), cfg)).toBe(s)
    expect(snapshot(s)).toBe(before)
  })

  test('exactly enough: it is bought, the balance drops, totalEarned is untouched', () => {
    const s = { ...rich(100), totalEarned: 500 }
    const n = buy(s, it('boost-4'), cfg)
    expect(n.balance).toBe(0)
    expect(n.totalEarned).toBe(500)
    expect(n.owned).toContain('boost-4')
    expect(s.balance).toBe(100) // the original was not mutated
    expect(s.owned).not.toContain('boost-4')
  })

  test('buying an owned item again is rejected and does not charge coins', () => {
    const once = buy(rich(), it('pal-b'), cfg)
    expect(canBuy(once, it('pal-b'), cfg)).toBe(false)
    const twice = buy(once, it('pal-b'), cfg)
    expect(twice).toBe(once)
    expect(twice.balance).toBe(960)
    expect(twice.owned.filter((id) => id === 'pal-b').length).toBe(1)
  })

  test('what is granted by default is already owned', () => {
    expect(canBuy(rich(), it('boost-1.5'), cfg)).toBe(false)
  })

  test('buying does not equip by itself', () => {
    const n = buy(rich(), it('pal-b'), cfg)
    expect(n.equipped.palette).toBe('pal-a')
  })

  test('a forged copy with a lowered price does not pass: the price comes from the catalog', () => {
    const fake: Item = { ...it('boost-4'), price: 0 }
    const s = { ...initialState(cfg), balance: 5 }
    expect(canBuy(s, fake, cfg)).toBe(false)
    expect(canBuy(rich(), { id: 'ghost', kind: 'palette', price: 0, payload: {} }, cfg)).toBe(false)
  })

  test('the balance never goes negative on any purchase', () => {
    let s = rich(75)
    for (const i of catalog(cfg)) s = buy(s, i, cfg)
    expect(s.balance).toBeGreaterThanOrEqual(0)
  })
})

describe('coming-soon slots', () => {
  test('can be neither bought nor equipped, even with a large balance', () => {
    const s = rich(1e9)
    expect(canBuy(s, it('soon'), cfg)).toBe(false)
    expect(buy(s, it('soon'), cfg)).toBe(s)
    expect(equip(s, it('soon'), cfg)).toBe(s)
  })
  test('one slipped into the save is ignored', () => {
    const p = parse(JSON.stringify({ owned: ['soon'], equipped: { palette: 'soon' } }), cfg)
    expect(p.owned).not.toContain('soon')
  })
})

describe('equipped', () => {
  test('an unowned item is not equipped', () => {
    const s = rich()
    expect(equip(s, it('pal-b'), cfg)).toBe(s)
    expect(s.equipped.palette).toBe('pal-a')
  })
  test('an owned item is equipped into its own slot, the other slots are intact', () => {
    const s = buy(rich(), it('pal-b'), cfg)
    const e = equip(s, it('pal-b'), cfg)
    expect(e.equipped.palette).toBe('pal-b')
    expect(e.equipped.boost).toBe('boost-1.5')
    expect(s.equipped.palette).toBe('pal-a')
    expect(equippedItem(e, cfg, 'palette')?.id).toBe('pal-b')
  })
  test('a coin multiplier has no slot: it is not equipped', () => {
    const s = buy(rich(), it('perm-1.5'), cfg)
    expect(equip(s, it('perm-1.5'), cfg)).toBe(s)
  })
  test('going back to the free one is possible', () => {
    let s = buy(rich(), it('pal-b'), cfg)
    s = equip(equip(s, it('pal-b'), cfg), it('pal-a'), cfg)
    expect(s.equipped.palette).toBe('pal-a')
  })
})

describe('selected boost', () => {
  test('defaults to defaultBoost from the config', () => {
    expect(selectedBoostFactor(initialState(cfg), cfg)).toBe(1.5)
  })
  test('after buying and equipping: the bought one', () => {
    const s = equip(buy(rich(), it('boost-4'), cfg), it('boost-4'), cfg)
    expect(selectedBoostFactor(s, cfg)).toBe(4)
  })
  test('equipped but not owned (forged): the default', () => {
    const s: ShopState = { ...initialState(cfg), equipped: { boost: 'boost-4' } }
    expect(selectedBoostFactor(s, cfg)).toBe(1.5)
  })
  test('an invalid defaultBoost: the fallback config.speed.boostFactor', () => {
    const c: ShopRoot = { ...cfg, shop: { ...cfg.shop, defaultBoost: 0 } }
    const s: ShopState = { ...initialState(c), equipped: {} }
    expect(selectedBoostFactor(s, c)).toBe(2)
  })
})

describe('coin multipliers and earning', () => {
  test('without multipliers: apple = coin', () => {
    const s = earn(beginSession(initialState(cfg), cfg), 8, cfg)
    expect(s.balance).toBe(8)
    expect(s.totalEarned).toBe(8)
  })

  test('a permanent multiplier increases coins, not the apple count', () => {
    const s = buy(rich(0 + 50), it('perm-1.5'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(1.5)
    const e = earn(beginSession(s, cfg), 10, cfg)
    expect(e.balance - s.balance).toBe(15)
  })

  test('of the permanent ones the best applies, they do not add up', () => {
    let s = buy(rich(), it('perm-1.25'), cfg)
    s = buy(s, it('perm-1.5'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(1.5)
  })

  test('permanent and temporary apply together: the product', () => {
    let s = buy(rich(), it('perm-1.5'), cfg)
    s = buy(s, it('temp-2'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(3)
    const e = earn(beginSession(s, cfg), 10, cfg)
    expect(e.balance - s.balance).toBe(30)
  })

  test('of the temporary ones the best applies, they do not add up', () => {
    let s = buy(rich(), it('temp-2'), cfg)
    s = buy(s, it('temp-4'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(4)
  })

  test('rounding to the nearest integer', () => {
    expect(payout(cfg, 3, 1.25)).toBe(4) // 3.75
    expect(payout(cfg, 1, 1.25)).toBe(1) // 1.25
    expect(payout(cfg, 2, 1.25)).toBe(3) // 2.5 rounds up
  })

  test('garbage instead of apples earns nothing and does not damage the balance', () => {
    const s = beginSession(rich(10), cfg)
    for (const bad of [-5, Number.NaN, Infinity, -Infinity, undefined as unknown as number, '7' as unknown as number]) {
      expect(earn(s, bad, cfg).balance).toBe(10)
    }
    expect(earn(s, 2.9, cfg).balance).toBe(12) // fractional apples round down
  })

  test('the game multiplier is frozen in beginSession and spent by a single earn', () => {
    let s = buy(rich(0 + 30), it('temp-2'), cfg)
    s = beginSession(s, cfg)
    expect(currentSessionMultiplier(s)).toBe(2)
    const e1 = earn(s, 5, cfg)
    expect(e1.balance).toBe(10)
    expect(earn(e1, 5, cfg).balance).toBe(15) // a second earn without beginSession is already ×1
  })

  test('earn without beginSession does not apply the multiplier', () => {
    const s = buy(rich(30), it('temp-2'), cfg)
    expect(earn(s, 5, cfg).balance - s.balance).toBe(5)
  })

  test('coins per apple come from the config', () => {
    const c: ShopRoot = { ...cfg, shop: { ...cfg.shop, coinPerApple: 3 } }
    expect(earn(beginSession(initialState(c), c), 4, c).balance).toBe(12)
  })
})

describe('term of a temporary item', () => {
  test('applies for exactly the bought number of games, then is removed', () => {
    let s = buy(rich(), it('temp-2'), cfg) // 3 games
    const paid: number[] = []
    for (let game = 1; game <= 4; game++) {
      s = beginSession(s, cfg)
      const before = s.balance
      s = earn(s, 10, cfg)
      paid.push(s.balance - before)
    }
    expect(paid).toEqual([20, 20, 20, 10]) // three games at ×2, the fourth is already ×1
  })

  test('after the last game it is no longer in the list; before it, it still is', () => {
    let s = buy(rich(), it('temp-2'), cfg)
    s = beginSession(s, cfg)
    s = beginSession(s, cfg)
    expect(s.temporary).toEqual([{ id: 'temp-2', gamesLeft: 1 }])
    expect(scoreMultiplier(s, cfg)).toBe(2) // for the next, last one
    s = beginSession(s, cfg) // third game: pays ×2 and is removed
    expect(currentSessionMultiplier(s)).toBe(2)
    expect(s.temporary).toEqual([])
    expect(scoreMultiplier(s, cfg)).toBe(1)
  })

  test('buying again extends it, the cap is not exceeded', () => {
    let s = rich()
    s = buy(s, it('temp-2'), cfg)
    s = buy(s, it('temp-2'), cfg)
    expect(s.temporary).toEqual([{ id: 'temp-2', gamesLeft: 6 }])
    s = buy(s, it('temp-2'), cfg) // 9 → cap 8
    expect(s.temporary).toEqual([{ id: 'temp-2', gamesLeft: 8 }])
    const capped = buy(s, it('temp-2'), cfg) // already at the cap: refused, coins intact
    expect(capped).toBe(s)
  })

  test('beginSession does not mutate the original', () => {
    const s = buy(rich(), it('temp-2'), cfg)
    const before = snapshot(s)
    beginSession(s, cfg)
    expect(snapshot(s)).toBe(before)
  })
})

describe('save', () => {
  test('a round trip gives the same state (except sessionMult)', () => {
    let s = rich(500)
    s = equip(buy(s, it('pal-b'), cfg), it('pal-b'), cfg)
    s = buy(buy(s, it('perm-1.5'), cfg), it('temp-2'), cfg)
    s = earn(beginSession(s, cfg), 12, cfg)
    expect(parse(serialize(s), cfg)).toEqual(s)
  })

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['not JSON', '{oops'],
    ['HTML', '<html>'],
    ['null-JSON', 'null'],
    ['number', '42'],
    ['string', '"balance"'],
    ['array', '[1,2,3]'],
    ['garbage in fields', '{"balance":"lots","owned":5,"equipped":[],"temporary":{}}'],
  ])('%s: the game does not crash, default state, no coins', (_n, raw) => {
    const p = parse(raw as string | null | undefined, cfg)
    expect(p).toEqual(initialState(cfg))
    expect(p.balance).toBe(0)
  })

  test('a negative, NaN and infinite balance do not grant coins and do not go negative', () => {
    expect(parse('{"balance":-100}', cfg).balance).toBe(0)
    expect(parse('{"balance":1e999}', cfg).balance).toBe(0) // JSON: Infinity is not a number
    expect(parse('{"balance":null,"totalEarned":-5}', cfg)).toEqual(initialState(cfg))
    expect(parse('{"balance":12.9}', cfg).balance).toBe(12)
  })

  test('a huge but finite balance (forged) does not crash and does not exceed the safe integer', () => {
    const p = parse('{"balance":1e300}', cfg)
    expect(p.balance).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => buy(p, it('boost-4'), cfg)).not.toThrow()
    expect(() => earn(p, 1e9, cfg)).not.toThrow()
    expect(Number.isSafeInteger(earn(p, 1e9, cfg).balance)).toBe(true)
  })

  test('unknown ids are ignored, known ones stay', () => {
    const p = parse(JSON.stringify({ balance: 5, owned: ['pal-b', 'ghost', 42, null, 'pal-b', '__proto__'], equipped: { palette: 'ghost', appleSkin: 'apple-b' } }), cfg)
    expect(p.owned).toEqual(['boost-1.5', 'pal-a', 'apple-a', 'arena-20', 'dens-1', 'pace-1', 'pal-b'])
    expect(p.equipped.palette).toBe('pal-a') // ghost dropped
    expect(p.equipped.appleSkin).toBe('apple-a') // apple-b is not owned
    expect(p.balance).toBe(5)
  })

  test('an item equipped in the wrong slot or not owned is dropped', () => {
    const p = parse(JSON.stringify({ owned: ['pal-b'], equipped: { palette: 'pal-b', boost: 'pal-b', appleSkin: 'boost-4' } }), cfg)
    expect(p.equipped.palette).toBe('pal-b')
    expect(p.equipped.boost).toBe('boost-1.5')
    expect(p.equipped.appleSkin).toBe('apple-a')
  })

  test('temporary: unknown ones, duplicates, a foreign kind and invalid terms are dropped, the term is cut by the cap', () => {
    const p = parse(
      JSON.stringify({
        temporary: [
          { id: 'temp-2', gamesLeft: 999 },
          { id: 'temp-2', gamesLeft: 1 },
          { id: 'temp-4', gamesLeft: 0 },
          { id: 'ghost', gamesLeft: 3 },
          { id: 'pal-b', gamesLeft: 3 },
          { id: 'perm-1.5', gamesLeft: 3 },
          { id: 'temp-4', gamesLeft: 'x' },
          null,
          7,
        ],
      }),
      cfg,
    )
    expect(p.temporary).toEqual([{ id: 'temp-2', gamesLeft: 8 }])
  })

  test('a temporary multiplier cannot be slipped in via owned, and a permanent one only if known', () => {
    const p = parse(JSON.stringify({ owned: ['temp-4', 'perm-1.5'] }), cfg)
    expect(p.owned).not.toContain('temp-4')
    expect(scoreMultiplier(p, cfg)).toBe(1.5)
  })

  test('sessionMult is not read from the save', () => {
    expect(parse('{"sessionMult":1000}', cfg).sessionMult).toBe(1)
  })

  test('what is granted by default is present even in an empty save', () => {
    const p = parse('{}', cfg)
    expect(p.owned).toEqual(['boost-1.5', 'pal-a', 'apple-a', 'arena-20', 'dens-1', 'pace-1'])
  })
})

describe('arena size, obstacles, pace', () => {
  const set = (s: ShopState, ...ids: string[]) => ids.reduce((acc, id) => equip(buy(acc, it(id), cfg), it(id), cfg), s)

  test('by default: 20, obstacles ×1, pace ×1, coefficient 1', () => {
    const s = initialState(cfg)
    expect(gameSetup(s, cfg)).toEqual({ size: 20, boostFactor: 1.5, obstacleMult: 1, paceScale: 1, scoreMultiplier: 1 })
  })

  test('buying and selecting change the game settings', () => {
    const s = set(rich(), 'arena-50', 'dens-0', 'pace-2')
    expect(selectedArenaSize(s, cfg)).toBe(50)
    expect(selectedObstacleMult(s, cfg)).toBe(0) // ×0 is a legitimate value, not "no selection"
    expect(selectedPaceScale(s, cfg)).toBe(2)
  })

  test('an unowned item is not selected', () => {
    const s = rich()
    expect(equip(s, it('arena-50'), cfg)).toBe(s)
    const forged: ShopState = { ...s, equipped: { ...s.equipped, arenaSize: 'arena-50', obstacles: 'dens-0' } }
    expect(selectedArenaSize(forged, cfg)).toBe(20)
    expect(selectedObstacleMult(forged, cfg)).toBe(1)
  })

  test('an item of another slot does not fit into the slot (in the save)', () => {
    const p = parse(JSON.stringify({ owned: ['arena-50', 'dens-0'], equipped: { arenaSize: 'dens-0', obstacles: 'arena-50' } }), cfg)
    expect(p.equipped.arenaSize).toBe('arena-20')
    expect(p.equipped.obstacles).toBe('dens-1')
  })

  test('coins do not depend on arena, obstacles or pace: apple = coin', () => {
    let s = set(rich(1000), 'arena-50', 'dens-0', 'pace-2')
    s = { ...beginSession(s, cfg), balance: 0 }
    expect(earn(s, 8, cfg).balance).toBe(8)
  })

  test('the coin multiplier does not depend on the arena', () => {
    let s = set(rich(1000), 'arena-50', 'dens-0')
    s = buy(s, it('perm-1.5'), cfg)
    s = { ...beginSession(s, cfg), balance: 0 }
    expect(earn(s, 8, cfg).balance).toBe(12)
  })

  test('invalid values in the catalog are dropped', () => {
    const bad: ShopRoot = {
      ...cfg,
      shop: {
        ...cfg.shop,
        items: [
          { id: 'a', kind: 'arenaSize', price: 1, payload: { size: 0 } },
          { id: 'c', kind: 'obstacleDensity', price: 1, payload: { density: -1 } },
          { id: 'd', kind: 'pace', price: 1, payload: { scale: 0 } },
          { id: 'ok', kind: 'obstacleDensity', price: 1, payload: { density: 0 } },
        ],
      },
    }
    expect(catalog(bad).map((i) => i.id)).toEqual(['ok'])
  })
})
