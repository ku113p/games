import { describe, expect, test } from 'bun:test'
import { blockContains, buildGrid, CellKind, hasFloor, isVoidAt, kindAt, roofAt, solidTopAt } from './grid'
import { voidFade } from './queries'
import { crawlable } from './rules/nav'
import { placePlayer, run, setup, testConfig, testLevel } from './testing'

const W = testConfig().world

describe('the open city', () => {
  test('blocks are as tall as their tops character; the default is blockTop; tops only on blocks', () => {
    const level = {
      ...testLevel(['#####', '#S.A#', '#H__#', '#####']),
      tops: ['.....', '2....', '.9...', '.....'],
    }
    const g = buildGrid(level, W)
    expect(g.top[1 * 5]).toBeCloseTo(1.1) // '2' on the west slab
    expect(g.top[2 * 5 + 1]).toBeCloseTo(11) // '9' on the hex block
    expect(g.hex[2 * 5 + 1]).toBe(1)
    expect(g.top[0]).toBeCloseTo(W.defaultTop)
    expect(buildGrid({ ...level, blockTop: 5 }, W).top[0]).toBeCloseTo(5)
    expect(() => buildGrid({ ...level, tops: ['.....', '.2...', '.....', '.....'] }, W)).toThrow(/not on a block/)
    expect(() => buildGrid({ ...level, tops: ['.....', 'Q....', '.....', '.....'] }, W)).toThrow(/unknown tops character/)
    expect(() => buildGrid(level)).toThrow(/needs the world config/)
  })

  test('the void has no floor: walkers never stand there, sight lines drop into it', () => {
    const g = buildGrid(testLevel(['#####', '#S.A#', '#_._#', '#####']), W)
    expect(kindAt(g, 1, 2)).toBe(CellKind.Void)
    expect(hasFloor(g, 2 * 5 + 1)).toBe(false)
    expect(hasFloor(g, 2 * 5 + 2)).toBe(true) // the bridge cell
    expect(hasFloor(g, 0)).toBe(false) // a slab
    expect(crawlable(g, 2 * 5 + 1)).toBe(false) // worms follow the same rule
    expect(crawlable(g, 2 * 5 + 2)).toBe(true)
    expect(isVoidAt(g, 3, 5)).toBe(true)
    expect(isVoidAt(g, -1, 5)).toBe(true) // outside the plan
    expect(solidTopAt(g, 3, 5)).toBeCloseTo(-W.voidDepth)
    expect(solidTopAt(g, 5, 5)).toBeCloseTo(0)
  })

  test('roofs only where the level puts them; hex modules are exact prisms', () => {
    const level = {
      ...testLevel(['#####', '#S.A#', '#...#', '#####'], [{ kind: 'hex', at: [2, 2], radius: 0.8, height: 1.2 }]),
      roofs: [{ from: [1, 1] as const, to: [2, 1] as const, height: 4 }],
    }
    const g = buildGrid(level, W)
    expect(roofAt(g, 3, 3)).toBeCloseTo(4)
    expect(roofAt(g, 7, 3)).toBe(Infinity)
    const hex = g.blocks[0]
    expect(hex?.hex).toBe(true)
    if (!hex) return
    expect(blockContains(hex, 5 + 0.75, 5)).toBe(true) // towards a corner
    expect(blockContains(hex, 5 + 0.6, 5 + 0.6)).toBe(false) // inside the box, outside the hexagon
    expect(solidTopAt(g, 5, 5)).toBeCloseTo(1.2)
    expect(() => buildGrid({ ...level, roofs: [{ from: [1, 1], to: [2, 1], height: 1.5 }] }, W)).toThrow(/too low/)
  })
})

describe('falling into the void', () => {
  test('drop off the edge: the screen fades out, you are back on safe ground with a penalty, it fades in', () => {
    const f = setup(['#######', '#S...A#', '#.....#', '#_____#', '#######'])
    placePlayer(f, 2, 1)
    run(f, 0.2)
    const safe = { ...f.s.player.safe }
    expect(safe.x).toBeCloseTo(5)
    // no floor under the void row: the fake world loses its floor when the player is over it
    const hp = f.s.player.hp
    f.world.floorY = -1000
    placePlayer(f, 3, 3)
    const seen = run(f, 0.9)
    expect(seen).toContain('fellIntoVoid')
    expect(voidFade(f.s, f.sim)).toBeGreaterThan(0)
    f.world.floorY = 0
    const after = run(f, 1)
    expect(after).toContain('voidReturned')
    expect(f.s.player.hp).toBe(hp - f.sim.cfg.world.fall.damage)
    expect(f.s.player.pos.x).toBeCloseTo(safe.x)
    expect(f.s.player.pos.z).toBeCloseTo(safe.z)
    run(f, 1)
    expect(voidFade(f.s, f.sim)).toBe(0)
  })

  test('the edge of a platform is not safe ground', () => {
    const f = setup(['#######', '#S...A#', '#.....#', '#_____#', '#######'])
    placePlayer(f, 2, 2)
    f.s.player.pos.z = 2 * 2 + 1.9 // 0.1 m from the void
    run(f, 0.1)
    expect(f.s.player.safe.z).not.toBeCloseTo(5.9)
  })
})
