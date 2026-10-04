import { describe, expect, test } from 'bun:test'
import { buildGrid, cellAt, CellKind, floorHeightAt, kindAt } from './grid'
import { testLevel } from './testing'

describe('the level plan', () => {
  test('reads cell kinds, markers and groups', () => {
    const g = buildGrid(
      testLevel([
        '#######', //
        '#S.=.A#',
        '#.~=.C#',
        '#.n.D.#',
        '#######',
      ]),
    )
    expect(g.cols).toBe(7)
    expect(g.rows).toBe(5)
    expect(kindAt(g, 0, 0)).toBe(CellKind.Wall)
    expect(kindAt(g, 2, 2)).toBe(CellKind.Cover)
    expect(kindAt(g, 2, 3)).toBe(CellKind.Niche)
    expect(kindAt(g, -1, 2)).toBe(CellKind.Wall) // outside the plan is wall
    expect(g.laserGroups).toHaveLength(1)
    expect(g.laserGroups[0]).toHaveLength(2) // the two '=' cells are one grid
    expect(g.wallGroups).toHaveLength(1)
    expect(g.checkpoints).toHaveLength(1)
    expect(g.start).toBe(1 * 7 + 1)
    expect(g.artifact).toBe(1 * 7 + 5)
  })

  test('heights come from the digit layer; ramps slope between the flat cells at their ends', () => {
    const g = buildGrid(
      testLevel(
        [
          '#######', //
          '#S.>>.#',
          '#....A#',
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
    const g = buildGrid(testLevel(['###', '#S#', '#A#', '###']))
    expect(cellAt(g, 3, 3)).toBe(1 * 3 + 1)
    expect(cellAt(g, -0.5, 3)).toBe(-1)
    expect(cellAt(g, 3, 100)).toBe(-1)
  })

  test('rejects broken plans with a readable message', () => {
    expect(() => buildGrid(testLevel(['###', '#SA#', '###']))).toThrow(/row 1/)
    expect(() => buildGrid(testLevel(['####', '#S?#', '#A.#', '####']))).toThrow(/unknown plan character/)
    expect(() => buildGrid(testLevel(['####', '#S.#', '####']))).toThrow(/no artifact/)
    expect(() => buildGrid(testLevel(['#####', '#S>##', '#A..#', '#####']))).toThrow(/ramp/)
  })
})
