import { describe, expect, test } from 'bun:test'
import {
  formatDuration,
  insertEntry,
  insertionIndex,
  migrateLegacy,
  parseTable,
  qualifies,
  renameEntry,
  sanitizeName,
  stepSymbol,
  type LeaderboardConfig,
  type ScoreEntry,
} from './leaderboard'

const cfg: LeaderboardConfig = {
  size: 3,
  nameLength: 3,
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  defaultName: 'AAA',
  legacyName: '---',
  minScore: 1,
  repeatDelayMs: 350,
  repeatMs: 110,
}

const e = (score: number, name = 'AAA'): ScoreEntry => ({ score, name, durationMs: 1000, date: 1 })

describe('insertionIndex / qualifies', () => {
  test('пустая таблица: любой положительный счёт — первое место', () => {
    expect(insertionIndex([], 5, cfg)).toBe(0)
    expect(qualifies([], 5, cfg)).toBe(true)
  })
  test('нулевой счёт и NaN не попадают даже в пустую таблицу', () => {
    expect(insertionIndex([], 0, cfg)).toBe(-1)
    expect(insertionIndex([], Number.NaN, cfg)).toBe(-1)
  })
  test('неполная таблица: хуже всех — всё равно попал, в конец', () => {
    expect(insertionIndex([e(10), e(8)], 1, cfg)).toBe(2)
  })
  test('неполная таблица: вставка в середину', () => {
    expect(insertionIndex([e(10), e(4)], 7, cfg)).toBe(1)
  })
  test('полная таблица: лучше третьего — вытесняет его', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 6, cfg)).toBe(2)
  })
  test('полная таблица: лучше всех — первое место', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 11, cfg)).toBe(0)
  })
  test('равный счёт идёт после прежних', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 8, cfg)).toBe(2)
    expect(insertionIndex([e(10)], 10, cfg)).toBe(1)
  })
  test('равный счёт третьему в полной таблице не вытесняет его', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 5, cfg)).toBe(-1)
  })
  test('результат хуже всех в полной таблице — не попал', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 2, cfg)).toBe(-1)
    expect(qualifies([e(10), e(8), e(5)], 2, cfg)).toBe(false)
  })
})

describe('insertEntry', () => {
  test('в пустую', () => {
    const r = insertEntry([], e(3, 'BOB'), cfg)
    expect(r.index).toBe(0)
    expect(r.table.map((x) => x.name)).toEqual(['BOB'])
  })
  test('вытеснение третьего', () => {
    const before = [e(10, 'A1A'), e(8, 'B2B'), e(5, 'C3C')]
    const r = insertEntry(before, e(9, 'NEW'), cfg)
    expect(r.index).toBe(1)
    expect(r.table.map((x) => x.name)).toEqual(['A1A', 'NEW', 'B2B'])
    expect(before).toHaveLength(3) // исходная таблица не изменена
    expect(before[2]?.name).toBe('C3C')
  })
  test('не попал — таблица та же по содержимому', () => {
    const before = [e(10), e(8), e(5)]
    const r = insertEntry(before, e(1), cfg)
    expect(r.index).toBe(-1)
    expect(r.table).toEqual(before)
  })
  test('равный счёт встаёт после прежнего', () => {
    const r = insertEntry([e(10, 'OLD')], e(10, 'NEW'), cfg)
    expect(r.table.map((x) => x.name)).toEqual(['OLD', 'NEW'])
    expect(r.index).toBe(1)
  })
})

describe('renameEntry', () => {
  test('меняет только выбранную', () => {
    const r = renameEntry([e(3, 'AAA'), e(2, 'BBB')], 1, 'ZZ9')
    expect(r.map((x) => x.name)).toEqual(['AAA', 'ZZ9'])
  })
})

describe('stepSymbol', () => {
  test('вперёд и назад', () => {
    expect(stepSymbol(cfg.alphabet, 'A', 1)).toBe('B')
    expect(stepSymbol(cfg.alphabet, 'B', -1)).toBe('A')
  })
  test('завороты: A назад — 9, 9 вперёд — A', () => {
    expect(stepSymbol(cfg.alphabet, 'A', -1)).toBe('9')
    expect(stepSymbol(cfg.alphabet, '9', 1)).toBe('A')
  })
  test('после Z идут цифры', () => {
    expect(stepSymbol(cfg.alphabet, 'Z', 1)).toBe('0')
  })
  test('незнакомый символ — начало алфавита', () => {
    expect(stepSymbol(cfg.alphabet, '?', 1)).toBe('A')
  })
})

describe('sanitizeName', () => {
  test('нижний регистр поднимается', () => {
    expect(sanitizeName('a1z', cfg)).toBe('A1Z')
  })
  test('не та длина, чужие символы и не строка — имя по умолчанию', () => {
    expect(sanitizeName('AB', cfg)).toBe('AAA')
    expect(sanitizeName('ABCD', cfg)).toBe('AAA')
    expect(sanitizeName('Ж-Ж', cfg)).toBe('AAA')
    expect(sanitizeName(42, cfg)).toBe('AAA')
    expect(sanitizeName(null, cfg)).toBe('AAA')
  })
})

describe('parseTable', () => {
  test('нет ключа или не JSON или не массив — null', () => {
    expect(parseTable(null, cfg)).toBeNull()
    expect(parseTable('{oops', cfg)).toBeNull()
    expect(parseTable('{"a":1}', cfg)).toBeNull()
  })
  test('круг: сохранённое читается обратно', () => {
    const t = [e(10, 'AB1'), e(3, 'ZZZ')]
    expect(parseTable(JSON.stringify(t), cfg)).toEqual(t)
  })
  test('сортирует, режет до размера и выбрасывает мусор', () => {
    const raw = JSON.stringify([e(1), { score: 'x' }, e(9), null, e(5), e(7)])
    expect(parseTable(raw, cfg)?.map((x) => x.score)).toEqual([9, 7, 5])
  })
  test('пустой массив — пустая таблица, а не null', () => {
    expect(parseTable('[]', cfg)).toEqual([])
  })
  test('имя переносной записи не портится', () => {
    const raw = JSON.stringify([{ score: 4, name: '---', durationMs: 0, date: 0 }])
    expect(parseTable(raw, cfg)?.[0]?.name).toBe('---')
  })
})

describe('migrateLegacy', () => {
  test('старый рекорд становится одной записью', () => {
    expect(migrateLegacy('17', cfg)).toEqual([{ score: 17, name: '---', durationMs: 0, date: 0 }])
  })
  test('нет рекорда, ноль, мусор — пустая таблица', () => {
    expect(migrateLegacy(null, cfg)).toEqual([])
    expect(migrateLegacy('0', cfg)).toEqual([])
    expect(migrateLegacy('abc', cfg)).toEqual([])
  })
})

describe('formatDuration', () => {
  test('минуты и секунды', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(7000)).toBe('0:07')
    expect(formatDuration(67_400)).toBe('1:07')
    expect(formatDuration(600_000)).toBe('10:00')
  })
  test('мусор — прочерк', () => {
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
  })
})
