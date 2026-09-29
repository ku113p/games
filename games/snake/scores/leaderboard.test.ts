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
  test('empty table: any positive score takes first place', () => {
    expect(insertionIndex([], 5, cfg)).toBe(0)
    expect(qualifies([], 5, cfg)).toBe(true)
  })
  test('a zero score and NaN do not make even an empty table', () => {
    expect(insertionIndex([], 0, cfg)).toBe(-1)
    expect(insertionIndex([], Number.NaN, cfg)).toBe(-1)
  })
  test('incomplete table: worse than all still makes it, at the end', () => {
    expect(insertionIndex([e(10), e(8)], 1, cfg)).toBe(2)
  })
  test('incomplete table: insertion in the middle', () => {
    expect(insertionIndex([e(10), e(4)], 7, cfg)).toBe(1)
  })
  test('full table: better than third displaces it', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 6, cfg)).toBe(2)
  })
  test('full table: better than all takes first place', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 11, cfg)).toBe(0)
  })
  test('an equal score goes after the earlier ones', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 8, cfg)).toBe(2)
    expect(insertionIndex([e(10)], 10, cfg)).toBe(1)
  })
  test('an equal score to third in a full table does not displace it', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 5, cfg)).toBe(-1)
  })
  test('a result worse than all in a full table does not make it', () => {
    expect(insertionIndex([e(10), e(8), e(5)], 2, cfg)).toBe(-1)
    expect(qualifies([e(10), e(8), e(5)], 2, cfg)).toBe(false)
  })
})

describe('insertEntry', () => {
  test('into an empty one', () => {
    const r = insertEntry([], e(3, 'BOB'), cfg)
    expect(r.index).toBe(0)
    expect(r.table.map((x) => x.name)).toEqual(['BOB'])
  })
  test('displacing the third', () => {
    const before = [e(10, 'A1A'), e(8, 'B2B'), e(5, 'C3C')]
    const r = insertEntry(before, e(9, 'NEW'), cfg)
    expect(r.index).toBe(1)
    expect(r.table.map((x) => x.name)).toEqual(['A1A', 'NEW', 'B2B'])
    expect(before).toHaveLength(3) // the original table is unchanged
    expect(before[2]?.name).toBe('C3C')
  })
  test('did not make it: the table is the same in content', () => {
    const before = [e(10), e(8), e(5)]
    const r = insertEntry(before, e(1), cfg)
    expect(r.index).toBe(-1)
    expect(r.table).toEqual(before)
  })
  test('an equal score goes after the earlier one', () => {
    const r = insertEntry([e(10, 'OLD')], e(10, 'NEW'), cfg)
    expect(r.table.map((x) => x.name)).toEqual(['OLD', 'NEW'])
    expect(r.index).toBe(1)
  })
})

describe('renameEntry', () => {
  test('changes only the chosen one', () => {
    const r = renameEntry([e(3, 'AAA'), e(2, 'BBB')], 1, 'ZZ9')
    expect(r.map((x) => x.name)).toEqual(['AAA', 'ZZ9'])
  })
})

describe('stepSymbol', () => {
  test('forward and back', () => {
    expect(stepSymbol(cfg.alphabet, 'A', 1)).toBe('B')
    expect(stepSymbol(cfg.alphabet, 'B', -1)).toBe('A')
  })
  test('wrap-arounds: A back is 9, 9 forward is A', () => {
    expect(stepSymbol(cfg.alphabet, 'A', -1)).toBe('9')
    expect(stepSymbol(cfg.alphabet, '9', 1)).toBe('A')
  })
  test('after Z come the digits', () => {
    expect(stepSymbol(cfg.alphabet, 'Z', 1)).toBe('0')
  })
  test('an unknown symbol: the start of the alphabet', () => {
    expect(stepSymbol(cfg.alphabet, '?', 1)).toBe('A')
  })
})

describe('sanitizeName', () => {
  test('lowercase is uppercased', () => {
    expect(sanitizeName('a1z', cfg)).toBe('A1Z')
  })
  test('wrong length, foreign symbols and not a string: the default name', () => {
    expect(sanitizeName('AB', cfg)).toBe('AAA')
    expect(sanitizeName('ABCD', cfg)).toBe('AAA')
    expect(sanitizeName('Ж-Ж', cfg)).toBe('AAA')
    expect(sanitizeName(42, cfg)).toBe('AAA')
    expect(sanitizeName(null, cfg)).toBe('AAA')
  })
})

describe('parseTable', () => {
  test('no key or not JSON or not an array: null', () => {
    expect(parseTable(null, cfg)).toBeNull()
    expect(parseTable('{oops', cfg)).toBeNull()
    expect(parseTable('{"a":1}', cfg)).toBeNull()
  })
  test('round trip: what was saved is read back', () => {
    const t = [e(10, 'AB1'), e(3, 'ZZZ')]
    expect(parseTable(JSON.stringify(t), cfg)).toEqual(t)
  })
  test('sorts, cuts to size and drops garbage', () => {
    const raw = JSON.stringify([e(1), { score: 'x' }, e(9), null, e(5), e(7)])
    expect(parseTable(raw, cfg)?.map((x) => x.score)).toEqual([9, 7, 5])
  })
  test('an empty array: an empty table, not null', () => {
    expect(parseTable('[]', cfg)).toEqual([])
  })
  test('the name of a carried-over entry is not spoiled', () => {
    const raw = JSON.stringify([{ score: 4, name: '---', durationMs: 0, date: 0 }])
    expect(parseTable(raw, cfg)?.[0]?.name).toBe('---')
  })
})

describe('migrateLegacy', () => {
  test('the old high score becomes a single entry', () => {
    expect(migrateLegacy('17', cfg)).toEqual([{ score: 17, name: '---', durationMs: 0, date: 0 }])
  })
  test('no high score, zero, garbage: an empty table', () => {
    expect(migrateLegacy(null, cfg)).toEqual([])
    expect(migrateLegacy('0', cfg)).toEqual([])
    expect(migrateLegacy('abc', cfg)).toEqual([])
  })
})

describe('formatDuration', () => {
  test('minutes and seconds', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(7000)).toBe('0:07')
    expect(formatDuration(67_400)).toBe('1:07')
    expect(formatDuration(600_000)).toBe('10:00')
  })
  test('garbage: a dash', () => {
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
  })
})
