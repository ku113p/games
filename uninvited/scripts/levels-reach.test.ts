// The structure guard: for every level, with the player's real movement limits (core/reach.ts) - walking, autostep,
// jumps onto low furniture, drops - everything behind a closed portcullis is out of reach until it opens, nothing
// is reachable by standing on a wall, the start and the exit are reachable once everything is open, and every medkit
// lies near the retreat route (WP5 extends it).
import { describe, expect, test } from 'bun:test'
import cfgJson from '../config.json'
import { barrierExtent } from '../core/barrier'
import type { GameConfig } from '../core/config'
import { buildGrid, CellKind, colOf, rowOf } from '../core/grid'
import { reachable, reachLimits } from '../core/reach'
import { barrierShape } from '../core/state'
import { levels } from '../levels/index'

const cfg = cfgJson as unknown as GameConfig
const at = (g: { cols: number }, i: number): string => `[${i % g.cols}, ${Math.floor(i / g.cols)}]`

for (const level of levels) {
  describe(`level ${level.id}: portcullises hold`, () => {
    const g = buildGrid(level, cfg.world)
    const lim = reachLimits(cfg.player, cfgJson.physics.autostep, g.cell)
    const openAll = reachable(g, lim, true)
    const closed = reachable(g, lim, false)

    test('everything is reachable when the walls are open', () => {
      expect(openAll.cells[g.start]).toBe(1)
      if (g.exit >= 0) expect(openAll.cells[g.exit]).toBe(1)
    })

    test('every medkit lies within medkit.routeMaxM of the retreat route', () => {
      const route = level.route.map(([c, r]) => [(c + 0.5) * g.cell, (r + 0.5) * g.cell] as const)
      for (const e of level.entities) {
        if (e.kind !== 'medkit') continue
        const x = (e.at[0] + 0.5) * g.cell
        const z = (e.at[1] + 0.5) * g.cell
        let best = Infinity
        for (let i = 0; i + 1 < route.length; i++) {
          const [ax, az] = route[i] as readonly [number, number]
          const [bx, bz] = route[i + 1] as readonly [number, number]
          const l2 = (bx - ax) ** 2 + (bz - az) ** 2
          const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0
          best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))))
        }
        expect(best).toBeLessThanOrEqual(cfg.medkit.routeMaxM)
      }
    })

    test('no slab, parapet or curb can be stood on (only floors, ramps and low furniture)', () => {
      const onTop: string[] = []
      for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === CellKind.Wall && openAll.cells[i] === 1) onTop.push(at(g, i))
      expect(onTop).toEqual([])
    })

    test('the exit is out of reach while every portcullis is closed (levels that have both)', () => {
      if (g.exit >= 0 && g.wallGroups.length > 0) expect(closed.cells[g.exit]).toBe(0)
      else expect(closed.cells.length).toBeGreaterThan(0)
    })

    for (let w = 0; w < g.wallGroups.length; w++) {
      const first = (g.wallGroups[w] as number[])[0] as number
      test(`portcullis ${w} at ${at(g, first)} seals off what is behind it`, () => {
        const open = g.wallGroups.map((_, k) => k !== w)
        const r = reachable(g, lim, open)
        const sealed: string[] = []
        for (let i = 0; i < r.cells.length; i++) if (openAll.cells[i] === 1 && r.cells[i] === 0) sealed.push(at(g, i))
        expect(sealed.length).toBeGreaterThan(0)
      })

      test(`portcullis ${w} at ${at(g, first)} is taller than anything that can be stood on beside it`, () => {
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
