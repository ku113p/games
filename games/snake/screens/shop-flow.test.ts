import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { catalog, gameSetup, initialState, parse, selectedBoostFactor, serialize, type Item, type ShopRoot, type ShopState } from '../shop'
import { SHOP_SECTIONS, createWallet, grandfatherArena, hasAffordableNew, isShopUnlocked, itemStatus, itemsOfSection } from './shop-flow'

const cfg = configJson as unknown as ShopRoot
const items = catalog(cfg)
const byId = (id: string): Item => items.find((i) => i.id === id) as Item
const withBalance = (n: number): ShopState => ({ ...initialState(cfg), balance: n })
const wallet = (n: number) => createWallet(withBalance(n), cfg)

describe('вход в магазин', () => {
  test('спрятан, пока не закончена первая партия и нет рекордов', () => {
    expect(isShopUnlocked({ finishedGame: false, hasRecords: false })).toBe(false)
  })
  test('открывается после первой партии или если рекорды уже есть', () => {
    expect(isShopUnlocked({ finishedGame: true, hasRecords: false })).toBe(true)
    expect(isShopUnlocked({ finishedGame: false, hasRecords: true })).toBe(true)
  })
})

describe('кошелёк партии: порядок begin -> settle', () => {
  test('монеты = яблоки × множитель, действовавший на старте', () => {
    const w = createWallet({ ...withBalance(0), temporary: [{ id: 'score-temp-3', gamesLeft: 2 }] }, cfg)
    w.begin()
    expect(w.runOpen).toBe(true)
    expect(w.settle(5)).toEqual({ gained: 15, mult: 3 })
    expect(w.state.balance).toBe(15)
    expect(w.runOpen).toBe(false)
  })
  test('без begin ничего не начисляется (а не молчаливое ×1)', () => {
    const w = wallet(10)
    expect(w.settle(7)).toBeNull()
    expect(w.state.balance).toBe(10)
  })
  test('второй settle за ту же партию ничего не даёт', () => {
    const w = wallet(0)
    w.begin()
    expect(w.settle(4)?.gained).toBe(4)
    expect(w.settle(4)).toBeNull()
    expect(w.state.balance).toBe(4)
  })
  test('последняя партия временного множителя платит по нему, следующая — уже нет', () => {
    const w = createWallet({ ...withBalance(0), temporary: [{ id: 'score-temp-2', gamesLeft: 1 }] }, cfg)
    w.begin()
    expect(w.settle(4)).toEqual({ gained: 8, mult: 2 })
    w.begin()
    expect(w.settle(4)).toEqual({ gained: 4, mult: 1 })
  })
  test('постоянный и временный множители перемножаются', () => {
    const w = createWallet({ ...withBalance(0), owned: [...initialState(cfg).owned, 'score-perm-1.5'], temporary: [{ id: 'score-temp-2', gamesLeft: 3 }] }, cfg)
    w.begin()
    expect(w.settle(10)).toEqual({ gained: 30, mult: 3 })
  })
  test('0 яблок — 0 монет, партия закрыта', () => {
    const w = wallet(0)
    w.begin()
    expect(w.settle(0)).toEqual({ gained: 0, mult: 1 })
  })
})

describe('покупка и надевание — разные действия', () => {
  test('купил не значит надел; надетое уходит в createGame через selectedBoostFactor', () => {
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
  test('не хватает денег: покупка отказывает и ничего не меняет', () => {
    const b8 = byId('boost-8')
    const w = wallet(b8.price - 1)
    expect(itemStatus(w.state, b8, cfg)).toBe('short')
    expect(w.buy(b8)).toBe(false)
    expect(w.state.balance).toBe(b8.price - 1)
  })
  test('некупленное не надевается', () => {
    const w = wallet(0)
    expect(w.equip(byId('boost-8'))).toBe(false)
  })
  test('постоянный множитель — «действует», надевать нечего', () => {
    const p = byId('score-perm-1.25')
    const w = wallet(p.price)
    w.buy(p)
    expect(itemStatus(w.state, p, cfg)).toBe('active')
    expect(w.equip(p)).toBe(false)
  })
  test('временный можно докупать (остаётся «buyable»), пока хватает денег', () => {
    const t2 = byId('score-temp-2')
    const w = wallet(t2.price * 2)
    w.buy(t2)
    expect(itemStatus(w.state, t2, cfg)).toBe('buyable')
    w.buy(t2)
    expect(w.state.temporary).toEqual([{ id: 'score-temp-2', gamesLeft: (t2.games ?? 0) * 2 }])
  })
  test('срок у потолка: докупить нельзя, статус «maxed»', () => {
    const t2 = byId('score-temp-2')
    const s: ShopState = { ...withBalance(t2.price), temporary: [{ id: t2.id, gamesLeft: cfg.shop.maxTemporaryGames }] }
    expect(itemStatus(s, t2, cfg)).toBe('maxed')
  })
})

describe('арена, препятствия, темп', () => {
  test('монеты от сложности не зависят: одно яблоко — одна монета на любых настройках', () => {
    for (const id of ['arena-100', 'density-0', 'pace-0.5']) {
      const it = byId(id)
      const w = wallet(it.price)
      w.buy(it)
      w.equip(it)
      w.begin()
      expect(w.settle(10)).toEqual({ gained: 10, mult: 1 })
    }
  })
  test('препятствия и темп попадают в setup только после покупки и надевания', () => {
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
  test('арена 50 покупается отдельно и попадает в setup только после надевания', () => {
    const a = byId('arena-50')
    const w = wallet(a.price)
    expect(gameSetup(w.state, cfg).size).toBe(20)
    w.buy(a)
    expect(gameSetup(w.state, cfg).size).toBe(20)
    w.equip(a)
    expect(gameSetup(w.state, cfg).size).toBe(50)
  })
  test('перенос старого выбора размера: сохранённый размер надет и куплен, лишнего не выдаётся', () => {
    const s = grandfatherArena(initialState(cfg), 100, cfg)
    expect(gameSetup(s, cfg).size).toBe(100)
    expect(s.owned).toContain('arena-100')
    expect(s.balance).toBe(0)
    expect(s.owned).not.toContain('arena-50')
  })
  test('перенос: размер по умолчанию, неизвестный и уже надетый размеры ничего не меняют', () => {
    const s0 = initialState(cfg)
    expect(grandfatherArena(s0, 20, cfg)).toBe(s0)
    expect(grandfatherArena(s0, 33, cfg)).toBe(s0)
    expect(grandfatherArena(s0, Number.NaN, cfg)).toBe(s0)
  })
  test('разделы: арена, препятствия и темп есть, каждый со своими предметами', () => {
    for (const id of ['arena', 'obstacles', 'pace'] as const) {
      const sec = SHOP_SECTIONS.find((x) => x.id === id)
      expect(sec).toBeDefined()
      expect(itemsOfSection(items, sec as (typeof SHOP_SECTIONS)[number]).length).toBeGreaterThanOrEqual(4 - (id === 'arena' ? 1 : 0))
    }
  })
})

describe('«скоро»', () => {
  const soon = items.filter((i) => i.kind === 'comingSoon')
  test('в каталоге есть закрытые предметы, их нельзя ни купить, ни надеть', () => {
    expect(soon.length).toBeGreaterThanOrEqual(2)
    const w = wallet(1_000_000)
    for (const it of soon) {
      expect(itemStatus(w.state, it, cfg)).toBe('soon')
      expect(w.buy(it)).toBe(false)
      expect(w.equip(it)).toBe(false)
    }
    expect(w.state.balance).toBe(1_000_000)
  })
  test('закрытый предмет стоит в разделе своего слота, а не в отдельной куче', () => {
    const snake = SHOP_SECTIONS.find((s) => s.id === 'snakeSkin') as (typeof SHOP_SECTIONS)[number]
    expect(itemsOfSection(items, snake).some((i) => i.id === 'snake-soon')).toBe(true)
    const tail = SHOP_SECTIONS.find((s) => s.id === 'soon') as (typeof SHOP_SECTIONS)[number]
    expect(itemsOfSection(items, tail)).toEqual([])
  })
  test('«скоро» без известного слота уходит в последний раздел', () => {
    const orphan: Item = { id: 'x-soon', kind: 'comingSoon', price: 0, payload: {} }
    const tail = SHOP_SECTIONS[SHOP_SECTIONS.length - 1] as (typeof SHOP_SECTIONS)[number]
    expect(itemsOfSection([...items, orphan], tail).map((i) => i.id)).toEqual(['x-soon'])
  })
})

describe('витрина', () => {
  test('каждый предмет каталога виден ровно в одном разделе', () => {
    const seen = SHOP_SECTIONS.flatMap((sec) => itemsOfSection(items, sec).map((i) => i.id))
    expect(seen.sort()).toEqual(items.map((i) => i.id).sort())
  })
  test('каждый предмет с названием по id имеет его во всех словарях (косметика, темп, «без препятствий»)', async () => {
    const { LANGUAGES } = await import('../i18n/dictionaries')
    for (const it of items) {
      if (!['palette', 'snakeSkin', 'appleSkin', 'compassSkin', 'pace'].includes(it.kind) && it.id !== 'density-0') continue
      for (const lang of LANGUAGES) expect(`shop.item.${it.id}` in lang.dict).toBe(true)
    }
  })
})

describe('кнопка «В магазин» на экране проигрыша', () => {
  test('без денег её нет', () => {
    expect(hasAffordableNew(withBalance(0), cfg)).toBe(false)
  })
  test('хватает на новое постоянное — есть', () => {
    const cheapest = Math.min(...items.filter((i) => i.price > 0 && i.kind !== 'scoreMultTemporary').map((i) => i.price))
    expect(hasAffordableNew(withBalance(cheapest), cfg)).toBe(true)
    expect(hasAffordableNew(withBalance(cheapest - 1), cfg)).toBe(false)
  })
  test('только расходники по карману — кнопки нет', () => {
    const cheapestNonTemp = Math.min(...items.filter((i) => i.price > 0 && i.kind !== 'scoreMultTemporary').map((i) => i.price))
    const cheapestTemp = Math.min(...items.filter((i) => i.kind === 'scoreMultTemporary').map((i) => i.price))
    if (cheapestTemp < cheapestNonTemp) expect(hasAffordableNew(withBalance(cheapestTemp), cfg)).toBe(false)
  })
})

describe('сохранение', () => {
  test('переживает круг; мусор даёт состояние по умолчанию', () => {
    const w = wallet(500)
    w.buy(byId('boost-2'))
    w.equip(byId('boost-2'))
    expect(parse(serialize(w.state), cfg)).toEqual(w.state)
    expect(parse('{{{', cfg)).toEqual(initialState(cfg))
    expect(parse(null, cfg)).toEqual(initialState(cfg))
  })
})
