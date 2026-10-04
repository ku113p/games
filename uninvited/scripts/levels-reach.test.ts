// The structure guard: for every level, with the player's real movement limits (core/reach.ts) - walking, autostep,
// jumps onto low blocks and parapets, drops, jumps across gaps - the artifact and everything behind a closed red wall
// is out of reach until the wall opens, and everything is reachable once they are all open.
import { describe, expect, test } from 'bun:test'
import cfgJson from '../config.json'
import { barrierExtent } from '../core/barrier'
import type { GameConfig } from '../core/config'
import { buildGrid, CellKind, colOf, rowOf } from '../core/grid'
import { reachable, reachLimits } from '../core/reach'
import { barrierShape } from '../core/state'
import { levels } from '../levels/index'

const cfg: GameConfig = cfgJson
const at = (g: { cols: number }, i: number): string => `[${i % g.cols}, ${Math.floor(i / g.cols)}]`

for (const level of levels) {
  describe(`level ${level.id}: red walls hold`, () => {
    const g = buildGrid(level, cfg.world)
    const lim = reachLimits(cfg.player, cfgJson.physics.autostep, g.cell)
    const openAll = reachable(g, lim, true)
    const closed = reachable(g, lim, false)

    test('everything is reachable when the walls are open', () => {
      expect(openAll.cells[g.artifact]).toBe(1)
      for (const t of g.terminals) expect(openAll.cells[t]).toBe(1)
      for (const c of g.checkpoints) expect(openAll.cells[c]).toBe(1)
    })

    test('no slab, parapet or curb can be stood on (only floors, ramps, low cover and server blocks)', () => {
      const onTop: string[] = []
      for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === CellKind.Wall && openAll.cells[i] === 1) onTop.push(at(g, i))
      expect(onTop).toEqual([])
    })

    test('the artifact is out of reach while every wall is closed', () => {
      expect(closed.cells[g.artifact]).toBe(0)
    })

    for (let w = 0; w < g.wallGroups.length; w++) {
      const first = (g.wallGroups[w] as number[])[0] as number
      test(`red wall ${w} at ${at(g, first)} seals off what is behind it`, () => {
        const open = g.wallGroups.map((_, k) => k !== w)
        const r = reachable(g, lim, open)
        const sealed: string[] = []
        for (let i = 0; i < r.cells.length; i++) if (openAll.cells[i] === 1 && r.cells[i] === 0) sealed.push(at(g, i))
        expect(sealed.length).toBeGreaterThan(0)
      })

      test(`red wall ${w} at ${at(g, first)} is taller than anything that can be stood on beside it`, () => {
        const cells = g.wallGroups[w] as number[]
        const ext = barrierExtent(g, barrierShape(g, cells), cells)
        const standing = reachable(g, lim, g.wallGroups.map((_, k) => k !== w))
        const near = new Set<number>()
        for (const i of ext.cells) for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) near.add((rowOf(g, i) + dr) * g.cols + colOf(g, i) + dc)
        let worst = 0
        for (const s of standing.surfaces) if (near.has(s.cell) && s.h > worst) worst = s.h
        expect(ext.top).toBeGreaterThanOrEqual(worst + lim.jump + 0.8)
      })
    }
  })
}
