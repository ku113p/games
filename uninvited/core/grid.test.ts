import { describe, expect, test } from 'bun:test'
import { buildGrid, cellAt, CellKind, floorHeightAt, kindAt, roofAt } from './grid'
import { testConfig, testLevel } from './testing'

describe('the level plan', () => {
  test('reads cell kinds, markers and groups', () => {
    const g = buildGrid(
      testLevel([
        '#WFX###', //
        '#S.d.E#',
        '#.~.DB#',
        '#######',
      ]),
    )
    expect(g.cols).toBe(7)
    expect(g.rows).toBe(4)
    expect(kindAt(g, 0, 0)).toBe(CellKind.Wall)
    for (const c of [1, 2, 3]) expect(kindAt(g, c, 0)).toBe(CellKind.Wall) // a window, a fireplace and a broken door are walls
    expect(kindAt(g, 3, 1)).toBe(CellKind.Floor) // a doorway is floor
    expect(kindAt(g, 2, 2)).toBe(CellKind.Cover)
    expect(kindAt(g, -1, 2)).toBe(CellKind.Wall) // outside the plan is wall
    expect(g.wallGroups).toHaveLength(1)
    expect(g.wallGroups[0]).toHaveLength(2) // the portcullis and the breakable wall next to it are one group
    expect(g.start).toBe(1 * 7 + 1)
    expect(g.exit).toBe(1 * 7 + 5)
  })

  test('heights come from the digit layer; ramps slope between the flat cells at their ends', () => {
    const g = buildGrid(
      testLevel(
        [
          '#######', //
          '#S.>>.#',
          '#.....#',
          '#######',
        ],
        [],
        [
          '.......', //
          '.00..4.',
          '.......',
          '.......',
        ],
      ),
    )
    // col 5 is 4 * 0.5 = 2 m; the ramp is cols 3-4 from 0 (col 2) up to 2 m (col 5)
    expect(floorHeightAt(g, 5 * 2 + 1, 3)).toBeCloseTo(2)
    expect(floorHeightAt(g, 3 * 2, 3)).toBeCloseTo(0)
    expect(floorHeightAt(g, 4 * 2, 3)).toBeCloseTo(1) // halfway up
    expect(floorHeightAt(g, 5 * 2 - 0.001, 3)).toBeCloseTo(2, 2)
  })

  test('cellAt maps world points to cells and -1 outside', () => {
    const g = buildGrid(testLevel(['###', '#S#', '###']))
    expect(cellAt(g, 3, 3)).toBe(1 * 3 + 1)
    expect(cellAt(g, -0.5, 3)).toBe(-1)
    expect(cellAt(g, 3, 100)).toBe(-1)
  })

  test('blocks are as tall as their tops character; the default is blockTop; tops only on walls', () => {
    const W = testConfig().world
    const level = { ...testLevel(['#####', '#S..#', '#####']), tops: ['2....', '.....', '.....'] }
    const g = buildGrid(level, W)
    expect(g.top[0]).toBeCloseTo(1.1) // '2'
    expect(g.top[4]).toBeCloseTo(W.defaultTop)
    expect(buildGrid({ ...level, blockTop: 5 }, W).top[4]).toBeCloseTo(5)
    expect(() => buildGrid({ ...level, tops: ['.....', '.2...', '.....'] }, W)).toThrow(/not on a block/)
    expect(() => buildGrid({ ...level, tops: ['Q....', '.....', '.....'] }, W)).toThrow(/unknown tops character/)
    expect(() => buildGrid(level)).toThrow(/needs the world config/)
  })

  test('rooms put a ceiling over their rectangle, the open roof has none', () => {
    const level = {
      ...testLevel(['#####', '#S..#', '#...#', '#####']),
      rooms: [
        { id: 'a', from: [1, 1] as const, to: [2, 2] as const, ceiling: 4, kind: 'room' as const },
        { id: 'b', from: [3, 1] as const, to: [3, 2] as const, ceiling: 4, kind: 'roof' as const },
      ],
    }
    const g = buildGrid(level)
    expect(roofAt(g, 3, 3)).toBeCloseTo(4)
    expect(roofAt(g, 7, 3)).toBe(Infinity)
    expect(() => buildGrid({ ...level, rooms: [{ id: 'a', from: [1, 1], to: [2, 2], ceiling: 1.5, kind: 'room' }] })).toThrow(/too low/)
  })

  test('rejects broken plans with a readable message', () => {
    expect(() => buildGrid(testLevel(['###', '#S.#', '###']))).toThrow(/row 1/)
    expect(() => buildGrid(testLevel(['####', '#S?#', '####']))).toThrow(/unknown plan character/)
    expect(() => buildGrid(testLevel(['####', '#..#', '####']))).toThrow(/no start/)
    expect(() => buildGrid(testLevel(['#####', '#S>##', '#...#', '#####']))).toThrow(/ramp/)
  })
})
