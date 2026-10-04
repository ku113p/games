// Test fixtures: the real config.json with deterministic overrides and tiny levels on the fake world. Used only by
// *.test.ts (each domain WP extends its own fixtures; the shared ones live here).
import cfgJson from '../config.json'
import type { GameConfig } from './config'
import { FakeWorld } from './fake-world'
import { CellKind, cellCenterX, cellCenterZ, type Grid } from './grid'
import type { EntityDef, LevelDef } from './level'
import type { MonsterKind, MonsterState } from './model/monsters'
import { createSim, createState, emptyMonster, type GameState, type Sim } from './state'
import { createIntent, tick, type Intent } from './commands'

/** The real numbers, but with no random spread (shots go where they are aimed, packs move in lockstep). */
export function testConfig(): GameConfig {
  const cfg = structuredClone(cfgJson) as unknown as GameConfig
  cfg.gun.spreadDeg = 0
  cfg.gun.aimSpreadDeg = 0
  for (const k of Object.values(cfg.horde.kinds)) k.speedSpread = 0
  return cfg
}

/** A plain level: the plan as given, flat, with these entities. */
export function testLevel(plan: string[], entities: EntityDef[] = [], heights?: string[]): LevelDef {
  return {
    id: 'test',
    nameKey: 'level.test',
    cell: 2,
    heightStep: 0.5,
    ceiling: 5,
    coverHeight: 1.1,
    nicheHeight: 1.35,
    startFacing: 'n',
    rooms: [],
    route: [],
    stages: [],
    plan,
    ...(heights ? { heights } : {}),
    entities,
  }
}

/** Fake-world boxes for walls, cover and red walls of a grid (flat levels only). */
export function worldFromGrid(g: Grid): FakeWorld {
  const w = new FakeWorld()
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const k = g.kind[r * g.cols + c]
      const x0 = c * g.cell
      const z0 = r * g.cell
      if (k === CellKind.Wall) w.box(x0, -1, z0, x0 + g.cell, g.ceiling, z0 + g.cell)
      if (k === CellKind.Cover) w.box(x0, 0, z0, x0 + g.cell, g.coverHeight, z0 + g.cell)
    }
  }
  for (const b of g.blocks) w.box(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ)
  g.wallGroups.forEach((cells, i) => {
    for (const idx of cells) {
      const c = idx % g.cols
      const r = Math.floor(idx / g.cols)
      w.box(c * g.cell, 0, r * g.cell, (c + 1) * g.cell, g.ceiling, (r + 1) * g.cell, i)
    }
  })
  return w
}

export interface Fixture {
  s: GameState
  sim: Sim
  world: FakeWorld
  intent: Intent
}

/** A ready game on a test level. */
export function setup(plan: string[], entities: EntityDef[] = [], cfg: GameConfig = testConfig(), seed = 1): Fixture {
  const level = testLevel(plan, entities)
  // build the grid once through a throwaway sim to derive the fake world, then the real sim on it
  const probe = createSim(level, cfg, new FakeWorld())
  const world = worldFromGrid(probe.grid)
  const sim = createSim(level, cfg, world)
  const s = createState(sim, seed)
  return { s, sim, world, intent: createIntent() }
}

/** Runs ticks of dt for a duration, collecting every event type seen. */
export function run(f: Fixture, seconds: number, dt = 1 / 60, each?: () => void): string[] {
  const seen: string[] = []
  for (let t = 0; t < seconds; t += dt) {
    f.sim.events.length = 0
    each?.()
    tick(f.s, f.sim, dt, f.intent)
    for (const e of f.sim.events) seen.push(e.type)
  }
  return seen
}

/** Puts the player's feet on a cell centre. */
export function placePlayer(f: Fixture, col: number, row: number, y = 0): void {
  f.s.player.pos.x = cellCenterX(f.sim.grid, col)
  f.s.player.pos.z = cellCenterZ(f.sim.grid, row)
  f.s.player.pos.y = y
  f.s.player.vel.x = 0
  f.s.player.vel.y = 0
  f.s.player.vel.z = 0
}

/** Puts a live monster of `kind` into a free pool slot, hunting, standing at (x, z) (its hit sphere centred at `centerY` when given). */
export function placeMonster(f: Fixture, kind: MonsterKind, x: number, z: number, centerY?: number): MonsterState {
  const k = f.sim.cfg.horde.kinds[kind]
  const slot = f.s.monsters.find((m) => !m.active)
  if (!slot) throw new Error('no free monster slot')
  Object.assign(slot, emptyMonster(), { active: true, alive: true, kind, cls: k.cls, mode: 'hunt', hp: k.hp })
  slot.pos.x = x
  slot.pos.z = z
  slot.pos.y = centerY === undefined ? 0 : centerY - k.height
  return slot
}
