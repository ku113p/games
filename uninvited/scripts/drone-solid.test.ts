// Drones never fly into a solid (DESIGN 9 item 13; lives in scripts/ because it reads the real levels and config.json, which core/ may not import): no wall, niche, closed red wall, roof, or block taller than the drone,
// in any mode (patrol, search, investigate, ring, slide, strafe, leave, the gate exit), over many random ticks.
import { describe, expect, test } from 'bun:test'
import { tick } from '../core/commands'
import { blockContains, cellAt, CellKind, roofAt, type Grid } from '../core/grid'
import type { EntityDef, LevelDef } from '../core/level'
import cfgJson from '../config.json'
import type { GameConfig } from '../core/config'
import { l1 } from '../levels/l1'
import { slice } from '../levels/slice'
import { createRng, nextFloat, nextInt } from '../core/random'
import { alertDrone, spawnDrone } from '../core/rules/drones'
import { flyable } from '../core/rules/nav'
import { createSim, createState, type DroneMode, type DroneState } from '../core/state'
import { FakeWorld } from '../core/fake-world'
import { createIntent } from '../core/commands'
import { placePlayer, run, setup, worldFromGrid } from '../core/testing'

/** The test's own definition of "inside a solid" (independent of the movement code). */
function inSolid(g: Grid, wallOpen: Uint8Array, x: number, y: number, z: number): string | null {
  const c = cellAt(g, x, z)
  if (c < 0) return 'outside the plan'
  const k = g.kind[c]
  if (k === CellKind.Wall || k === CellKind.Niche) return 'wall'
  if (k === CellKind.RedWall && wallOpen[g.group[c] as number] !== 1) return 'closed red wall'
  for (const b of g.blocks) if (blockContains(b, x, z) && b.maxY > y) return `block to ${b.maxY}`
  if (y > roofAt(g, x, z)) return 'roof'
  return null
}

const HALL = [
  '################',
  '#..............#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#.S..........A.#',
  '################',
]

describe('drones stay out of solids', () => {
  test('a ring slot behind a tall slab: the drone goes round it, never through', () => {
    const slab: EntityDef = { kind: 'cover', at: [7, 4], size: [3, 6, 14], offset: [0, 0] }
    const drone: EntityDef = { kind: 'drone', id: 'd', patrol: [[2, 4], [2, 4]] }
    const f = setup(HALL, [slab, drone])
    placePlayer(f, 12, 4)
    const d = f.s.drones[0] as DroneState
    d.mode = 'alert'
    d.lastKnown.x = f.s.player.pos.x
    d.lastKnown.z = f.s.player.pos.z
    const wo = f.sim.nav.wallOpen
    let bad: string | null = null
    run(f, 20, 1 / 60, () => {
      f.s.player.hp = 1e9
      const why = inSolid(f.sim.grid, wo, d.pos.x, d.pos.y, d.pos.z)
      if (why && !bad) bad = `${why} at ${d.pos.x.toFixed(2)},${d.pos.y.toFixed(2)},${d.pos.z.toFixed(2)}`
    })
    expect(bad).toBeNull()
  })

  for (const level of [slice, l1] as LevelDef[]) {
    test(`${level.id}: 1000 random ticks in every mode never end inside a solid`, () => {
      const cfg: GameConfig = structuredClone(cfgJson)
      cfg.alarm.minSpawnDist = 0
      const probe = createSim(level, cfg, new FakeWorld())
      const world: FakeWorld = worldFromGrid(probe.grid)
      const sim = createSim(level, cfg, world)
      const s = createState(sim, 7)
      const g = sim.grid
      const intent = createIntent()
      const rng = createRng(99)
      // flyable cells to teleport the player to and to send drones to
      const open: number[] = []
      for (let i = 0; i < g.cols * g.rows; i++) if (flyable(sim.nav, i) && g.kind[i] !== CellKind.Void) open.push(i)
      // a crowd: the level's drones plus gate drones
      for (let k = 0; k < 4 && sim.gates.length > 0; k++) spawnDrone(s, sim, k % 2 === 0 ? 'wave' : 'searcher', k % sim.gates.length)
      const modes: DroneMode[] = ['patrol', 'investigate', 'search', 'alert', 'leave']
      s.player.hp = 1e9
      const failures: string[] = []
      for (let t = 0; t < 1000; t++) {
        if (t % 25 === 0) {
          const c = open[nextInt(rng, 0, open.length - 1)] as number
          s.player.pos.x = ((c % g.cols) + 0.5) * g.cell
          s.player.pos.z = (Math.floor(c / g.cols) + 0.5) * g.cell
          s.player.pos.y = 0
          s.player.vel.x = 0
          s.player.vel.z = 0
          for (const d of s.drones) {
            if (!d.active || !d.alive || d.spawnTime > 0 || d.gateTime > 0) continue
            const tc = open[nextInt(rng, 0, open.length - 1)] as number
            d.target.x = ((tc % g.cols) + 0.5) * g.cell
            d.target.z = (Math.floor(tc / g.cols) + 0.5) * g.cell
            d.mode = modes[nextInt(rng, 0, modes.length - 1)] as DroneMode
            d.wait = 0
            if (d.mode === 'alert') alertDrone(s, sim, s.drones.indexOf(d))
          }
        }
        sim.events.length = 0
        tick(s, sim, 0.05 * (0.4 + nextFloat(rng)), intent)
        s.player.hp = 1e9
        for (let i = 0; i < s.drones.length; i++) {
          const d = s.drones[i] as DroneState
          if (!d.active || d.spawnTime > 0 || d.gateTime > 0) continue
          const why = inSolid(g, sim.nav.wallOpen, d.pos.x, d.pos.y, d.pos.z)
          if (why && failures.length < 5) failures.push(`tick ${t} drone ${i} (${d.mode}): ${why} at ${d.pos.x.toFixed(2)},${d.pos.y.toFixed(2)},${d.pos.z.toFixed(2)}`)
        }
      }
      expect(failures).toEqual([])
    })
  }
})
