// Check config.json -> shop: the catalog is consistent with the core and with the designer's decisions.
// Lives in scripts/ because shop/ may not import anything outside itself (including config.json).
import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { createGame, type Config } from '../core/rules'
import { gameSetup, catalog, initialState, parse, selectedBoostFactor, serialize, buy, equip, beginSession, earn, canBuy, type Item } from '../shop'

const items = catalog(configJson)

describe('config.shop', () => {
  test('no catalog row is dropped by validation', () => {
    expect(items.length).toBe(configJson.shop.items.length)
  })

  test('every boost factor from the shop is known to the core', () => {
    const core = configJson.speed.boostFactors
    for (const i of items.filter((x) => x.kind === 'boost')) expect(core).toContain(i.payload.factor as number)
    for (const f of core) expect(items.some((i) => i.kind === 'boost' && i.payload.factor === f)).toBe(true)
  })

  test('the default boost is ×1.5, already granted and free', () => {
    const s = initialState(configJson)
    expect(selectedBoostFactor(s, configJson)).toBe(1.5)
    expect(items.find((i) => i.id === 'boost-1.5')?.price).toBe(0)
  })

  test('the default grant covers every slot and costs 0', () => {
    const s = initialState(configJson)
    expect(Object.keys(s.equipped).sort()).toEqual(['appleSkin', 'arenaSize', 'boost', 'compassSkin', 'obstacles', 'pace', 'palette', 'snakeSkin'])
    for (const id of s.owned) expect(items.find((i) => i.id === id)?.price).toBe(0)
    expect(s.balance).toBe(0)
  })

  test('each of the nine shop sections has a coming-soon slot, which cannot be bought or equipped', () => {
    const slots = items.filter((i) => i.kind === 'comingSoon').map((i) => i.payload.slot).sort()
    expect(slots).toEqual(['appleSkin', 'arenaSize', 'boost', 'compassSkin', 'mult', 'obstacles', 'pace', 'palette', 'snakeSkin'])
  })

  test('permanent multipliers are weaker than temporary ones', () => {
    const max = (kind: string) => Math.max(...items.filter((i) => i.kind === kind).map((i) => i.payload.mult ?? 1))
    expect(max('scoreMultPermanent')).toBeLessThan(max('scoreMultTemporary'))
  })

  test('a temporary multiplier does not pay off on a typical game (8 apples): you have to play better than typical', () => {
    const typical = 8
    for (const i of items.filter((x) => x.kind === 'scoreMultTemporary')) {
      const extra = typical * configJson.shop.coinPerApple * ((i.payload.mult ?? 1) - 1) * (i.games ?? 0)
      expect(extra).toBeLessThan(i.price)
    }
  })

  test('the first purchase is reachable in two or three typical games', () => {
    const cheapest = Math.min(...items.filter((i) => i.price > 0 && i.kind !== 'comingSoon').map((i) => i.price))
    expect(cheapest / 8).toBeLessThanOrEqual(3)
  })

  test('end-to-end scenario: play, save up, buy ×2, equip, save, load', () => {
    let s = initialState(configJson)
    for (let g = 0; g < 5; g++) s = earn(beginSession(s, configJson), 8, configJson)
    expect(s.balance).toBe(40)
    const boost2 = items.find((i) => i.id === 'boost-2') as Item
    expect(canBuy(s, boost2, configJson)).toBe(true)
    s = equip(buy(s, boost2, configJson), boost2, configJson)
    expect(s.balance).toBe(0)
    const loaded = parse(serialize(s), configJson)
    expect(selectedBoostFactor(loaded, configJson)).toBe(2)
  })
})

describe('config.shop: arena, obstacles, pace', () => {
  const of = (kind: string) => items.filter((i) => i.kind === kind)

  test('arena sizes are among those the core knows; the default is 20, the default factor is 1', () => {
    for (const i of of('arenaSize')) expect(configJson.cube.sizes).toContain(i.payload.size as number)
    expect(gameSetup(initialState(configJson), configJson)).toMatchObject({ size: 20, obstacleMult: 1, paceScale: 1 })
  })

  test('arena 5³: purchasable (not granted), costs more than 50³ and less than 100³, the default is still 20³', () => {
    const a5 = items.find((i) => i.id === 'arena-5') as Item
    const price = (id: string) => (items.find((i) => i.id === id) as Item).price
    expect(a5.kind).toBe('arenaSize')
    expect(a5.payload.size).toBe(5)
    expect(a5.price).toBeGreaterThan(price('arena-50'))
    expect(a5.price).toBeLessThan(price('arena-100'))
    const s = initialState(configJson)
    expect(s.owned).not.toContain('arena-5')
    expect(gameSetup(s, configJson).size).toBe(20)
    const rich = equip(buy({ ...s, balance: a5.price }, a5, configJson), a5, configJson)
    expect(gameSetup(rich, configJson).size).toBe(5)
  })

  test('the catalog has obstacle multipliers ×0, ×1/4, ×1/2, ×1, ×2', () => {
    expect(of('obstacleDensity').map((i) => i.payload.density).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 0.25, 0.5, 1, 2])
  })
})

describe('save with the ×8 boost removed', () => {
  const legacy = JSON.stringify({
    v: 1,
    balance: 40,
    totalEarned: 900,
    owned: ['boost-1.5', 'boost-4', 'boost-8', 'arena-20', 'density-1', 'pace-1', 'palette-neon', 'palette-contrast', 'snake-classic', 'apple-diamond', 'compass-default'],
    equipped: { boost: 'boost-8', arenaSize: 'arena-20', obstacles: 'density-1', pace: 'pace-1', palette: 'palette-neon' },
    temporary: [],
  })

  test('boost-8 is not in the catalog: the row parses without error, the unknown item is dropped, coins and the rest are intact', () => {
    expect(items.some((i) => i.id === 'boost-8')).toBe(false)
    const p = parse(legacy, configJson)
    expect(p.owned).not.toContain('boost-8')
    expect(p.owned).toContain('boost-4')
    expect(p.balance).toBe(40)
    expect(p.totalEarned).toBe(900)
    expect(p.equipped.boost).toBe('boost-1.5')
  })

  test('a game for such a player is set up with a valid boost', () => {
    const f = gameSetup(parse(legacy, configJson), configJson).boostFactor
    expect(configJson.speed.boostFactors).toContain(f)
  })
})

describe('the first game is always on the default arena (designer decision: "whatever is bought or equipped")', () => {
  const coreConfig = configJson as unknown as Config

  // The case that would otherwise break: a wallet where 50³ is bought AND equipped, and the first-game flag is still set
  // (partly cleared browser data, an edited save, a future gift item). The shop hands the core 50; the core must still play 20.
  const rich = { ...initialState(configJson), balance: 1000 }
  const bought = buy(rich, items.find((i) => i.id === 'arena-50')!, configJson)
  const wallet = equip(bought, items.find((i) => i.id === 'arena-50')!, configJson)

  test('the wallet really has 50³ equipped', () => {
    expect(gameSetup(wallet, configJson).size).toBe(50)
  })

  test('first game ever: 20³ regardless, and it is the flat opening', () => {
    const size = gameSetup(wallet, configJson).size
    const first = createGame(coreConfig, size, 7, true)
    expect(first.size).toBe(configJson.cube.default)
    expect(first.size).toBe(20)
    expect(first.mode).toBe('plane')
  })

  test('the second game respects the equipped arena: 50³ was not taken away', () => {
    const size = gameSetup(wallet, configJson).size
    const second = createGame(coreConfig, size, 7, false)
    expect(second.size).toBe(50)
    expect(second.mode).toBe('free')
  })

  test('the default arena in the core config is the shop default arena (one 20, not two)', () => {
    expect(configJson.cube.default).toBe(configJson.shop.defaultArenaSize)
  })
})
