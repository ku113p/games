import { describe, expect, test } from 'bun:test'
import {
  beginSession, buy, canBuy, catalog, currentSessionMultiplier, earn, equip, equippedItem, findItem, initialState,
  parse, payout, scoreMultiplier, selectedBoostFactor, serialize,
  gameSetup, selectedArenaSize, selectedObstacleMult, selectedPaceScale,
  type Item, type ShopRoot, type ShopState,
} from './index'

// Свой маленький конфиг: тесты не зависят от подбора цен в config.json.
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

describe('каталог', () => {
  test('берётся из конфига, негодные строки отбрасываются', () => {
    const bad: ShopRoot = {
      ...cfg,
      shop: {
        ...cfg.shop,
        items: [
          { id: 'ok', kind: 'palette', price: 5, payload: {} },
          { id: 'ok', kind: 'palette', price: 1, payload: {} }, // дубль
          { id: '', kind: 'palette', price: 1 },
          { id: 'x1', kind: 'nonsense', price: 1 },
          { id: 'x2', kind: 'palette', price: -5 },
          { id: 'x3', kind: 'palette', price: Number.NaN },
          { id: 'x4', kind: 'boost', price: 1, payload: { factor: 0.5 } },
          { id: 'x5', kind: 'scoreMultPermanent', price: 1, payload: {} },
          { id: 'x6', kind: 'scoreMultTemporary', price: 1, payload: { mult: 2 } }, // без срока
        ],
      },
    }
    expect(catalog(bad).map((i) => i.id)).toEqual(['ok'])
    expect(catalog(cfg).length).toBe(cfg.shop.items.length)
  })
})

describe('покупка', () => {
  test('при нехватке денег не покупается, состояние не меняется', () => {
    const s = { ...initialState(cfg), balance: 99 }
    const before = snapshot(s)
    expect(canBuy(s, it('boost-4'), cfg)).toBe(false)
    expect(buy(s, it('boost-4'), cfg)).toBe(s)
    expect(snapshot(s)).toBe(before)
  })

  test('хватает ровно — покупается, баланс падает, totalEarned не трогается', () => {
    const s = { ...rich(100), totalEarned: 500 }
    const n = buy(s, it('boost-4'), cfg)
    expect(n.balance).toBe(0)
    expect(n.totalEarned).toBe(500)
    expect(n.owned).toContain('boost-4')
    expect(s.balance).toBe(100) // исходное не мутировано
    expect(s.owned).not.toContain('boost-4')
  })

  test('повторная покупка купленного отклоняется и не списывает деньги', () => {
    const once = buy(rich(), it('pal-b'), cfg)
    expect(canBuy(once, it('pal-b'), cfg)).toBe(false)
    const twice = buy(once, it('pal-b'), cfg)
    expect(twice).toBe(once)
    expect(twice.balance).toBe(960)
    expect(twice.owned.filter((id) => id === 'pal-b').length).toBe(1)
  })

  test('выданное по умолчанию уже куплено', () => {
    expect(canBuy(rich(), it('boost-1.5'), cfg)).toBe(false)
  })

  test('покупка не надевает само', () => {
    const n = buy(rich(), it('pal-b'), cfg)
    expect(n.equipped.palette).toBe('pal-a')
  })

  test('подсунутая копия с заниженной ценой не проходит: цена берётся из каталога', () => {
    const fake: Item = { ...it('boost-4'), price: 0 }
    const s = { ...initialState(cfg), balance: 5 }
    expect(canBuy(s, fake, cfg)).toBe(false)
    expect(canBuy(rich(), { id: 'ghost', kind: 'palette', price: 0, payload: {} }, cfg)).toBe(false)
  })

  test('баланс не уходит в минус ни при какой покупке', () => {
    let s = rich(75)
    for (const i of catalog(cfg)) s = buy(s, i, cfg)
    expect(s.balance).toBeGreaterThanOrEqual(0)
  })
})

describe('заглушки «скоро»', () => {
  test('нельзя ни купить, ни надеть, даже при большом балансе', () => {
    const s = rich(1e9)
    expect(canBuy(s, it('soon'), cfg)).toBe(false)
    expect(buy(s, it('soon'), cfg)).toBe(s)
    expect(equip(s, it('soon'), cfg)).toBe(s)
  })
  test('подсунутый в сохранение попадает в игнор', () => {
    const p = parse(JSON.stringify({ owned: ['soon'], equipped: { palette: 'soon' } }), cfg)
    expect(p.owned).not.toContain('soon')
  })
})

describe('надетое', () => {
  test('некупленное не надевается', () => {
    const s = rich()
    expect(equip(s, it('pal-b'), cfg)).toBe(s)
    expect(s.equipped.palette).toBe('pal-a')
  })
  test('купленное надевается в свой слот, остальные слоты целы', () => {
    const s = buy(rich(), it('pal-b'), cfg)
    const e = equip(s, it('pal-b'), cfg)
    expect(e.equipped.palette).toBe('pal-b')
    expect(e.equipped.boost).toBe('boost-1.5')
    expect(s.equipped.palette).toBe('pal-a')
    expect(equippedItem(e, cfg, 'palette')?.id).toBe('pal-b')
  })
  test('множитель очков слота не имеет: не надевается', () => {
    const s = buy(rich(), it('perm-1.5'), cfg)
    expect(equip(s, it('perm-1.5'), cfg)).toBe(s)
  })
  test('вернуться на бесплатное можно', () => {
    let s = buy(rich(), it('pal-b'), cfg)
    s = equip(equip(s, it('pal-b'), cfg), it('pal-a'), cfg)
    expect(s.equipped.palette).toBe('pal-a')
  })
})

describe('выбранное ускорение', () => {
  test('по умолчанию defaultBoost из конфига', () => {
    expect(selectedBoostFactor(initialState(cfg), cfg)).toBe(1.5)
  })
  test('после покупки и надевания — купленное', () => {
    const s = equip(buy(rich(), it('boost-4'), cfg), it('boost-4'), cfg)
    expect(selectedBoostFactor(s, cfg)).toBe(4)
  })
  test('надетое, но не купленное (подделка) — по умолчанию', () => {
    const s: ShopState = { ...initialState(cfg), equipped: { boost: 'boost-4' } }
    expect(selectedBoostFactor(s, cfg)).toBe(1.5)
  })
  test('негодный defaultBoost — запасной config.speed.boostFactor', () => {
    const c: ShopRoot = { ...cfg, shop: { ...cfg.shop, defaultBoost: 0 } }
    const s: ShopState = { ...initialState(c), equipped: {} }
    expect(selectedBoostFactor(s, c)).toBe(2)
  })
})

describe('множители очков и начисление', () => {
  test('без множителей: яблоко = монета', () => {
    const s = earn(beginSession(initialState(cfg), cfg), 8, cfg)
    expect(s.balance).toBe(8)
    expect(s.totalEarned).toBe(8)
  })

  test('постоянный множитель увеличивает монеты, не число яблок', () => {
    const s = buy(rich(0 + 50), it('perm-1.5'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(1.5)
    const e = earn(beginSession(s, cfg), 10, cfg)
    expect(e.balance - s.balance).toBe(15)
  })

  test('из постоянных действует лучший, они не складываются', () => {
    let s = buy(rich(), it('perm-1.25'), cfg)
    s = buy(s, it('perm-1.5'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(1.5)
  })

  test('постоянный и временный действуют вместе: произведение', () => {
    let s = buy(rich(), it('perm-1.5'), cfg)
    s = buy(s, it('temp-2'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(3)
    const e = earn(beginSession(s, cfg), 10, cfg)
    expect(e.balance - s.balance).toBe(30)
  })

  test('из временных действует лучший, они не складываются', () => {
    let s = buy(rich(), it('temp-2'), cfg)
    s = buy(s, it('temp-4'), cfg)
    expect(scoreMultiplier(s, cfg)).toBe(4)
  })

  test('округление к ближайшему целому', () => {
    expect(payout(cfg, 3, 1.25)).toBe(4) // 3.75
    expect(payout(cfg, 1, 1.25)).toBe(1) // 1.25
    expect(payout(cfg, 2, 1.25)).toBe(3) // 2.5 вверх
  })

  test('мусор вместо яблок ничего не начисляет и баланс не портит', () => {
    const s = beginSession(rich(10), cfg)
    for (const bad of [-5, Number.NaN, Infinity, -Infinity, undefined as unknown as number, '7' as unknown as number]) {
      expect(earn(s, bad, cfg).balance).toBe(10)
    }
    expect(earn(s, 2.9, cfg).balance).toBe(12) // дробные яблоки — вниз
  })

  test('множитель партии замораживается в beginSession и тратится одним earn', () => {
    let s = buy(rich(0 + 30), it('temp-2'), cfg)
    s = beginSession(s, cfg)
    expect(currentSessionMultiplier(s)).toBe(2)
    const e1 = earn(s, 5, cfg)
    expect(e1.balance).toBe(10)
    expect(earn(e1, 5, cfg).balance).toBe(15) // второй earn без beginSession — уже ×1
  })

  test('earn без beginSession множитель не применяет', () => {
    const s = buy(rich(30), it('temp-2'), cfg)
    expect(earn(s, 5, cfg).balance - s.balance).toBe(5)
  })

  test('монеты за яблоко — из конфига', () => {
    const c: ShopRoot = { ...cfg, shop: { ...cfg.shop, coinPerApple: 3 } }
    expect(earn(beginSession(initialState(c), c), 4, c).balance).toBe(12)
  })
})

describe('срок временного предмета', () => {
  test('действует ровно на купленное число партий, потом снимается', () => {
    let s = buy(rich(), it('temp-2'), cfg) // 3 партии
    const paid: number[] = []
    for (let game = 1; game <= 4; game++) {
      s = beginSession(s, cfg)
      const before = s.balance
      s = earn(s, 10, cfg)
      paid.push(s.balance - before)
    }
    expect(paid).toEqual([20, 20, 20, 10]) // три партии ×2, четвёртая уже ×1
  })

  test('после последней партии в списке уже нет; перед ней ещё есть', () => {
    let s = buy(rich(), it('temp-2'), cfg)
    s = beginSession(s, cfg)
    s = beginSession(s, cfg)
    expect(s.temporary).toEqual([{ id: 'temp-2', gamesLeft: 1 }])
    expect(scoreMultiplier(s, cfg)).toBe(2) // для следующей, последней
    s = beginSession(s, cfg) // третья партия: платит ×2 и снимается
    expect(currentSessionMultiplier(s)).toBe(2)
    expect(s.temporary).toEqual([])
    expect(scoreMultiplier(s, cfg)).toBe(1)
  })

  test('повторная покупка продлевает, потолок не превышается', () => {
    let s = rich()
    s = buy(s, it('temp-2'), cfg)
    s = buy(s, it('temp-2'), cfg)
    expect(s.temporary).toEqual([{ id: 'temp-2', gamesLeft: 6 }])
    s = buy(s, it('temp-2'), cfg) // 9 → потолок 8
    expect(s.temporary).toEqual([{ id: 'temp-2', gamesLeft: 8 }])
    const capped = buy(s, it('temp-2'), cfg) // уже на потолке: отказ, деньги целы
    expect(capped).toBe(s)
  })

  test('beginSession не мутирует исходное', () => {
    const s = buy(rich(), it('temp-2'), cfg)
    const before = snapshot(s)
    beginSession(s, cfg)
    expect(snapshot(s)).toBe(before)
  })
})

describe('сохранение', () => {
  test('круговой проход даёт то же состояние (кроме sessionMult)', () => {
    let s = rich(500)
    s = equip(buy(s, it('pal-b'), cfg), it('pal-b'), cfg)
    s = buy(buy(s, it('perm-1.5'), cfg), it('temp-2'), cfg)
    s = earn(beginSession(s, cfg), 12, cfg)
    expect(parse(serialize(s), cfg)).toEqual(s)
  })

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['пусто', ''],
    ['не JSON', '{oops'],
    ['HTML', '<html>'],
    ['null-JSON', 'null'],
    ['число', '42'],
    ['строка', '"balance"'],
    ['массив', '[1,2,3]'],
    ['мусор в полях', '{"balance":"lots","owned":5,"equipped":[],"temporary":{}}'],
  ])('%s: игра не падает, состояние по умолчанию, денег нет', (_n, raw) => {
    const p = parse(raw as string | null | undefined, cfg)
    expect(p).toEqual(initialState(cfg))
    expect(p.balance).toBe(0)
  })

  test('отрицательный, NaN и бесконечный баланс не дарят денег и не уходят в минус', () => {
    expect(parse('{"balance":-100}', cfg).balance).toBe(0)
    expect(parse('{"balance":1e999}', cfg).balance).toBe(0) // JSON: Infinity не число
    expect(parse('{"balance":null,"totalEarned":-5}', cfg)).toEqual(initialState(cfg))
    expect(parse('{"balance":12.9}', cfg).balance).toBe(12)
  })

  test('огромный, но конечный баланс (подделка) не роняет и не выходит за безопасное целое', () => {
    const p = parse('{"balance":1e300}', cfg)
    expect(p.balance).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => buy(p, it('boost-4'), cfg)).not.toThrow()
    expect(() => earn(p, 1e9, cfg)).not.toThrow()
    expect(Number.isSafeInteger(earn(p, 1e9, cfg).balance)).toBe(true)
  })

  test('неизвестные id игнорируются, известные остаются', () => {
    const p = parse(JSON.stringify({ balance: 5, owned: ['pal-b', 'ghost', 42, null, 'pal-b', '__proto__'], equipped: { palette: 'ghost', appleSkin: 'apple-b' } }), cfg)
    expect(p.owned).toEqual(['boost-1.5', 'pal-a', 'apple-a', 'arena-20', 'dens-1', 'pace-1', 'pal-b'])
    expect(p.equipped.palette).toBe('pal-a') // ghost отброшен
    expect(p.equipped.appleSkin).toBe('apple-a') // apple-b не куплен
    expect(p.balance).toBe(5)
  })

  test('надетое не в свой слот или не купленное отбрасывается', () => {
    const p = parse(JSON.stringify({ owned: ['pal-b'], equipped: { palette: 'pal-b', boost: 'pal-b', appleSkin: 'boost-4' } }), cfg)
    expect(p.equipped.palette).toBe('pal-b')
    expect(p.equipped.boost).toBe('boost-1.5')
    expect(p.equipped.appleSkin).toBe('apple-a')
  })

  test('временные: неизвестные, дубли, чужой вид и негодные сроки отбрасываются, срок режется потолком', () => {
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

  test('временный множитель нельзя подложить через owned, постоянный тоже только известный', () => {
    const p = parse(JSON.stringify({ owned: ['temp-4', 'perm-1.5'] }), cfg)
    expect(p.owned).not.toContain('temp-4')
    expect(scoreMultiplier(p, cfg)).toBe(1.5)
  })

  test('sessionMult из сохранения не читается', () => {
    expect(parse('{"sessionMult":1000}', cfg).sessionMult).toBe(1)
  })

  test('выданное по умолчанию есть даже в пустом сохранении', () => {
    const p = parse('{}', cfg)
    expect(p.owned).toEqual(['boost-1.5', 'pal-a', 'apple-a', 'arena-20', 'dens-1', 'pace-1'])
  })
})

describe('размер арены, препятствия, темп', () => {
  const set = (s: ShopState, ...ids: string[]) => ids.reduce((acc, id) => equip(buy(acc, it(id), cfg), it(id), cfg), s)

  test('по умолчанию: 20, препятствия ×1, темп ×1, коэффициент 1', () => {
    const s = initialState(cfg)
    expect(gameSetup(s, cfg)).toEqual({ size: 20, boostFactor: 1.5, obstacleMult: 1, paceScale: 1, scoreMultiplier: 1 })
  })

  test('покупка и выбор меняют настройки партии', () => {
    const s = set(rich(), 'arena-50', 'dens-0', 'pace-2')
    expect(selectedArenaSize(s, cfg)).toBe(50)
    expect(selectedObstacleMult(s, cfg)).toBe(0) // ×0 — законное значение, не «нет выбора»
    expect(selectedPaceScale(s, cfg)).toBe(2)
  })

  test('некупленное не выбирается', () => {
    const s = rich()
    expect(equip(s, it('arena-50'), cfg)).toBe(s)
    const forged: ShopState = { ...s, equipped: { ...s.equipped, arenaSize: 'arena-50', obstacles: 'dens-0' } }
    expect(selectedArenaSize(forged, cfg)).toBe(20)
    expect(selectedObstacleMult(forged, cfg)).toBe(1)
  })

  test('предмет чужого слота в слот не встаёт (в сохранении)', () => {
    const p = parse(JSON.stringify({ owned: ['arena-50', 'dens-0'], equipped: { arenaSize: 'dens-0', obstacles: 'arena-50' } }), cfg)
    expect(p.equipped.arenaSize).toBe('arena-20')
    expect(p.equipped.obstacles).toBe('dens-1')
  })

  test('монеты от арены, препятствий и темпа не зависят: яблоко = монета', () => {
    let s = set(rich(1000), 'arena-50', 'dens-0', 'pace-2')
    s = { ...beginSession(s, cfg), balance: 0 }
    expect(earn(s, 8, cfg).balance).toBe(8)
  })

  test('множитель очков от арены не зависит', () => {
    let s = set(rich(1000), 'arena-50', 'dens-0')
    s = buy(s, it('perm-1.5'), cfg)
    s = { ...beginSession(s, cfg), balance: 0 }
    expect(earn(s, 8, cfg).balance).toBe(12)
  })

  test('негодные значения в каталоге отбрасываются', () => {
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
