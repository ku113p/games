// Проверка config.json → shop: каталог согласован с ядром и с дизайнерскими решениями.
// Лежит в scripts/, потому что shop/ не имеет права импортировать ничего вне себя (в том числе config.json).
import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { gameSetup, catalog, initialState, parse, selectedBoostFactor, serialize, buy, equip, beginSession, earn, canBuy, type Item } from '../shop'

const items = catalog(configJson)

describe('config.shop', () => {
  test('ни одна строка каталога не отброшена валидацией', () => {
    expect(items.length).toBe(configJson.shop.items.length)
  })

  test('каждый множитель ускорения из магазина известен ядру', () => {
    const core = configJson.speed.boostFactors
    for (const i of items.filter((x) => x.kind === 'boost')) expect(core).toContain(i.payload.factor as number)
    for (const f of core) expect(items.some((i) => i.kind === 'boost' && i.payload.factor === f)).toBe(true)
  })

  test('по умолчанию ускорение ×1.5, оно уже выдано и бесплатно', () => {
    const s = initialState(configJson)
    expect(selectedBoostFactor(s, configJson)).toBe(1.5)
    expect(items.find((i) => i.id === 'boost-1.5')?.price).toBe(0)
  })

  test('выданное по умолчанию покрывает каждый слот и стоит 0', () => {
    const s = initialState(configJson)
    expect(Object.keys(s.equipped).sort()).toEqual(['appleSkin', 'arenaSize', 'boost', 'compassSkin', 'obstacles', 'pace', 'palette', 'snakeSkin'])
    for (const id of s.owned) expect(items.find((i) => i.id === id)?.price).toBe(0)
    expect(s.balance).toBe(0)
  })

  test('в каждом из девяти разделов витрины есть заглушка «скоро», её нельзя купить и надеть', () => {
    const slots = items.filter((i) => i.kind === 'comingSoon').map((i) => i.payload.slot).sort()
    expect(slots).toEqual(['appleSkin', 'arenaSize', 'boost', 'compassSkin', 'mult', 'obstacles', 'pace', 'palette', 'snakeSkin'])
  })

  test('постоянные множители слабее временных', () => {
    const max = (kind: string) => Math.max(...items.filter((i) => i.kind === kind).map((i) => i.payload.mult ?? 1))
    expect(max('scoreMultPermanent')).toBeLessThan(max('scoreMultTemporary'))
  })

  test('временный множитель не окупается на типичной партии (8 яблок): надо играть лучше типичного', () => {
    const typical = 8
    for (const i of items.filter((x) => x.kind === 'scoreMultTemporary')) {
      const extra = typical * configJson.shop.coinPerApple * ((i.payload.mult ?? 1) - 1) * (i.games ?? 0)
      expect(extra).toBeLessThan(i.price)
    }
  })

  test('первая покупка достижима за две-три типичные партии', () => {
    const cheapest = Math.min(...items.filter((i) => i.price > 0 && i.kind !== 'comingSoon').map((i) => i.price))
    expect(cheapest / 8).toBeLessThanOrEqual(3)
  })

  test('сквозной сценарий: играем, копим, покупаем ×2, надеваем, сохраняем, загружаем', () => {
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

describe('config.shop: арена, препятствия, темп', () => {
  const of = (kind: string) => items.filter((i) => i.kind === kind)

  test('размеры арены — из тех, что знает ядро; по умолчанию 20, коэффициент по умолчанию 1', () => {
    for (const i of of('arenaSize')) expect(configJson.cube.sizes).toContain(i.payload.size as number)
    expect(gameSetup(initialState(configJson), configJson)).toMatchObject({ size: 20, obstacleMult: 1, paceScale: 1 })
  })

  test('арена 5³: покупается (не выдана), дороже 50³ и дешевле 100³, по умолчанию по-прежнему 20³', () => {
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

  test('в каталоге есть множители препятствий ×0, ×1/4, ×1/2, ×1, ×2', () => {
    expect(of('obstacleDensity').map((i) => i.payload.density).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 0.25, 0.5, 1, 2])
  })
})
