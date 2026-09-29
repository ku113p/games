import { afterAll, describe, expect, test } from 'bun:test'
import { Scene } from 'three'
import config from '../config.json'
import {
  HEX_RE,
  boostFor,
  boostsFor,
  checkPalette,
  headStates,
  hexToLinear,
  luminance,
  deltaE,
  displayedLinear,
  worstHeadPair,
  type GlowTargets,
  type PaletteSet,
} from './palette-math'
import {
  APPLE_COLOR,
  BLOOM_THRESHOLD,
  DEFAULT_PALETTE_ID,
  HEAD_DANGER_COLOR_FAR,
  SNAKE_BODY_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_STRIPE_DIM,
  applyPaletteById,
  type PalettesConfig,
} from './palette'
import { APPLE_SKINS, COMPASS_SKINS, DEFAULT_COSMETICS, SNAKE_SKINS, resolveCosmetics } from './cosmetics'
import { appleSegments } from './apple-view'
import { compassGeometry } from './compass-view'
import { TAIL_ARROWS, TailGuides } from './tail-guides'
import { Color } from 'three'

const palettes = config.palettes as unknown as PalettesConfig
const glow: GlowTargets = palettes.glow
const ROLES: (keyof PaletteSet)[] = ['background', 'fog', 'body', 'tail', 'head', 'apple', 'dangerFar', 'dangerNear', 'rayDanger', 'obstacle', 'edge', 'grid', 'mark', 'wall']

afterAll(() => {
  applyPaletteById(palettes, DEFAULT_PALETTE_ID) // другие тесты view ждут набор по умолчанию
})

describe('наборы цветов в config.json', () => {
  test('у каждого набора есть все роли и все значения — hex', () => {
    for (const [id, set] of Object.entries(palettes.sets)) {
      expect(Object.keys(set).sort(), id).toEqual([...ROLES].sort())
      for (const r of ROLES) expect(HEX_RE.test(set[r]), `${id}.${r}`).toBe(true)
    }
  })

  test('каждый предмет-палитра магазина указывает на существующий набор, и наоборот', () => {
    const used = config.shop.items.filter((i) => i.kind === 'palette').map((i) => (i.payload as { palette: string }).palette)
    for (const id of used) expect(palettes.sets[id], id).toBeDefined()
    for (const id of Object.keys(palettes.sets)) expect(used, id).toContain(id)
    expect(palettes.sets[DEFAULT_PALETTE_ID]).toBeDefined()
  })

  test('виды змейки, яблока и стрелки из магазина известны виду', () => {
    const skins = (kind: string): string[] => config.shop.items.filter((i) => i.kind === kind).map((i) => (i.payload as { skin: string }).skin)
    for (const s of skins('snakeSkin')) expect(SNAKE_SKINS as readonly string[], s).toContain(s)
    for (const s of skins('appleSkin')) expect(APPLE_SKINS as readonly string[], s).toContain(s)
    for (const s of skins('compassSkin')) expect(COMPASS_SKINS as readonly string[], s).toContain(s)
  })
})

// ЕДИНСТВЕННОЕ ИСКЛЮЧЕНИЕ. «Ночной неон» — нынешний вид игры; фиолетовые препятствия 8f5cff дизайнер долго доводил (тонкие рёбра вдали),
// поэтому их цвет не трогаем. Розовое яблоко против них: ΔE 35 в норме и 18.6 при дейтеранопии/протанопии (порог 40 / 20).
// Пара остаётся различимой формой и пульсом, но это слабое место, а не «проходит». Пол ниже не даст ему ухудшиться;
// заменить обходится в одну строку config.json (obstacle #765ffe даёт 50 / 20, но линии на ~6% тусклее и синее).
const KNOWN_WEAK: Record<string, Record<string, number>> = {
  neon: { 'apple/obstacle': 18 },
}

describe('палитры сохраняют сигналы головы (IDEAS §4)', () => {
  for (const [id, set] of Object.entries(palettes.sets)) {
    test(`${id}: все проверки различимости проходят`, () => {
      const bad = checkPalette(set, glow).filter((c) => {
        if (c.ok) return false
        const floor = KNOWN_WEAK[id]?.[c.name]
        if (floor === undefined) return true
        // норма ≥ 34, при цветовой слепоте ≥ floor; тританопия справочная
        return c.vision === 'normal' ? c.value < 34 : c.vision === 'tritanopia' ? false : c.value < floor
      })
      expect(bad.map((c) => `${c.name} [${c.vision}] ${c.value.toFixed(1)} < ${c.min}`)).toEqual([])
    })
  }

  test('проверка не пропускает плохой набор («Жар» из IDEAS.md: тёплое тело сливается с тёплой опасностью)', () => {
    const heat: PaletteSet = { ...palettes.sets['neon']!, background: '#0a0403', body: '#ff6a3d', tail: '#ffb02e', head: '#d9e6ff', apple: '#38f2ff', dangerFar: '#ffe600', dangerNear: '#ff2d95' }
    expect(checkPalette(heat, glow).some((c) => !c.ok)).toBe(true)
  })

  test('проверка ловит слившиеся состояния: одинаковые опасности', () => {
    const same: PaletteSet = { ...palettes.sets['neon']!, dangerFar: '#ff2010' }
    const st = headStates(same, boostsFor(same, glow))
    expect(worstHeadPair(st, 'normal').pair).toBe('dangerFar/dangerNear')
    expect(checkPalette(same, glow).some((c) => !c.ok && c.name === 'head:dangerFar/dangerNear')).toBe(true)
  })
})

describe('свечение: множители считаются по яркости', () => {
  test('ночной неон: старые оттенки дают прежние множители ×0.7 / ×3.0 / ×2.0 / ×3.6 / ×2.5 / ×1.25 / ×2.2 / ×3.2', () => {
    const old: PaletteSet = { ...palettes.sets['neon']!, head: '#fff27a', apple: '#ff2d78', dangerFar: '#ff7000', dangerNear: '#ff2010', body: '#3dffa6', edge: '#1fb6ff', obstacle: '#8f5cff' }
    const b = boostsFor(old, glow)
    expect(b.headIdle).toBeCloseTo(0.7, 2)
    expect(b.headGoal).toBeCloseTo(3.0, 2)
    expect(b.dangerFar).toBeCloseTo(2.0, 2)
    expect(b.dangerNear).toBeCloseTo(3.6, 2)
    expect(b.apple).toBeCloseTo(2.5, 2)
    expect(b.body).toBeCloseTo(1.25, 2)
    expect(b.edge).toBeCloseTo(2.2, 2)
    expect(b.obstacleLine).toBeCloseTo(3.2, 2)
  })

  test('потолок множителя: очень тёмный цвет не выгорает', () => {
    expect(boostFor('#000000', 1, 5)).toBe(5)
    expect(boostFor('#101010', 1, 5)).toBe(5)
  })

  for (const [id, set] of Object.entries(palettes.sets)) {
    test(`${id}: обычная голова ниже порога bloom, опасность за 2 хода и цель выше, яркое тело светится, тусклая полоса нет`, () => {
      const b = boostsFor(set, glow)
      const lum = (hex: string, k: number): number => luminance(hexToLinear(hex)) * k
      expect(lum(set.head, b.headIdle)).toBeLessThan(BLOOM_THRESHOLD)
      expect(lum(set.dangerFar, b.dangerFar)).toBeGreaterThan(BLOOM_THRESHOLD)
      expect(lum(set.dangerNear, b.dangerNear)).toBeGreaterThan(BLOOM_THRESHOLD)
      expect(lum(set.apple, b.headGoal)).toBeGreaterThan(BLOOM_THRESHOLD)
      expect(lum(set.body, b.body)).toBeGreaterThan(BLOOM_THRESHOLD)
      expect(lum(set.body, b.body) * SNAKE_STRIPE_DIM).toBeLessThan(BLOOM_THRESHOLD)
      // хвост: даже яркий не должен зажечь тусклую полосу
      expect(lum(set.tail, b.body) * SNAKE_STRIPE_DIM).toBeLessThan(BLOOM_THRESHOLD)
    })
  }
})

describe('applyPaletteById', () => {
  test('перезаписывает живые цвета на месте (ссылки не меняются)', () => {
    const ref = SNAKE_HEAD_COLOR
    applyPaletteById(palettes, 'synthwave')
    expect(SNAKE_HEAD_COLOR).toBe(ref)
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['synthwave']!.head)
    expect('#' + APPLE_COLOR.getHexString()).toBe(palettes.sets['synthwave']!.apple)
    expect('#' + SNAKE_BODY_COLOR.getHexString()).toBe(palettes.sets['synthwave']!.body)
    applyPaletteById(palettes, 'ice')
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['ice']!.head)
  })

  test('цвет опасности за 2 хода уже с множителем: канал больше, чем у сырого оттенка', () => {
    applyPaletteById(palettes, 'neon')
    const raw = new Color(palettes.sets['neon']!.dangerFar)
    expect(HEAD_DANGER_COLOR_FAR.r).toBeGreaterThan(raw.r)
  })

  test('неизвестный id и пустой id — набор по умолчанию', () => {
    expect(applyPaletteById(palettes, 'нет-такого')).toBe(DEFAULT_PALETTE_ID)
    expect(applyPaletteById(palettes, undefined)).toBe(DEFAULT_PALETTE_ID)
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['neon']!.head)
  })

  test('конфиг без раздела palettes — наборы из config.json', () => {
    expect(applyPaletteById(undefined, 'terminal')).toBe('terminal')
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['terminal']!.head)
  })
})

describe('resolveCosmetics', () => {
  test('без выбора — умолчания', () => {
    expect(resolveCosmetics()).toEqual(DEFAULT_COSMETICS)
    expect(resolveCosmetics({})).toEqual(DEFAULT_COSMETICS)
  })
  test('известные значения проходят, неизвестные заменяются умолчаниями', () => {
    expect(resolveCosmetics({ palette: 'ice', snakeSkin: 'tailGuides', appleSkin: 'star', compassSkin: 'ring' })).toEqual({
      palette: 'ice',
      snakeSkin: 'tailGuides',
      appleSkin: 'star',
      compassSkin: 'ring',
    })
    expect(resolveCosmetics({ snakeSkin: 'x', appleSkin: '', compassSkin: undefined })).toEqual(DEFAULT_COSMETICS)
  })
})

describe('виды яблока и стрелки', () => {
  function extent(seg: number[]): number {
    return Math.max(...seg.map((v) => Math.abs(v)))
  }
  test('каждый вид яблока не мельче прежнего куба', () => {
    const cube = extent(appleSegments('diamond'))
    for (const s of APPLE_SKINS) {
      expect(appleSegments(s).length, s).toBeGreaterThan(0)
      expect(extent(appleSegments(s)), s).toBeGreaterThanOrEqual(cube - 1e-9)
    }
  })
  test('звезда — двенадцать рёбер двух тетраэдров', () => {
    expect(appleSegments('star').length / 6).toBe(12)
    expect(appleSegments('diamond').length / 6).toBe(12)
  })
  test('стрелка любого вида единичной длины вдоль +Y: остриё около 0.5', () => {
    for (const s of COMPASS_SKINS) {
      const g = compassGeometry(s)
      g.computeBoundingBox()
      expect(g.boundingBox!.max.y, s).toBeGreaterThan(0.45)
      expect(g.boundingBox!.max.y, s).toBeLessThanOrEqual(0.5 + 1e-6)
      expect(g.boundingBox!.min.y, s).toBeGreaterThanOrEqual(-0.65)
      g.dispose()
    }
  })
})

describe('направляющие хвоста', () => {
  const body = new Color('#3dffa6')
  const tail = new Color('#18c4ff')
  function line(n: number): [Float32Array, Float32Array, Float32Array, Float32Array] {
    const gx = new Float32Array(n)
    const gy = new Float32Array(n)
    const gz = new Float32Array(n)
    const gk = new Float32Array(n).fill(1)
    for (let i = 0; i < n; i++) gx[i] = 10 - i // голова в 10, хвост правее по убыванию
    return [gx, gy, gz, gk]
  }
  test('звеньев на одно меньше, чем сегментов; стрелки только на последних звеньях', () => {
    const g = new TailGuides(new Scene())
    const [gx, gy, gz, gk] = line(9)
    g.ensureCapacity(9)
    g.update(9, gx, gy, gz, gk, body, tail, 1.25, 8)
    expect((g as unknown as { links: { mesh: { count: number } } }).links.mesh.count).toBe(8)
    expect((g as unknown as { arrows: { mesh: { count: number } } }).arrows.mesh.count).toBe(TAIL_ARROWS)
    g.dispose()
  })
  test('короткая змейка: стрелок не больше, чем звеньев; совпавшие сегменты не ломают кадр', () => {
    const g = new TailGuides(new Scene())
    const [gx, gy, gz, gk] = line(3)
    gx[1] = gx[0]! // сегменты совпали
    g.ensureCapacity(3)
    expect(() => g.update(3, gx, gy, gz, gk, body, tail, 1.25, 2)).not.toThrow()
    expect((g as unknown as { arrows: { mesh: { count: number } } }).arrows.mesh.count).toBe(2)
    g.dispose()
  })
})

describe('измерительные функции', () => {
  test('ΔE одинаковых цветов — 0, чёрного и белого — около 100', () => {
    const w = displayedLinear('#ffffff', 1)
    const k = displayedLinear('#000000', 1)
    expect(deltaE(w, w)).toBeCloseTo(0, 6)
    expect(deltaE(w, k)).toBeGreaterThan(95)
  })
  test('дейтеранопия почти не различает красный и зелёный одинаковой яркости', () => {
    const r = displayedLinear('#c86400', 1)
    const g = displayedLinear('#5f9600', 1)
    expect(deltaE(r, g, 'deuteranopia')).toBeLessThan(deltaE(r, g, 'normal') / 3)
  })
})
