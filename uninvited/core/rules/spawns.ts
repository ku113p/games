// Spawn points (owner: WP4 Director, spawns, bots; from the old spawn gates). DESIGN 1, 5: monsters come from windows,
// doors, fireplaces and cracks in the floor, and the player can always see where from - a point plays a telegraph
// (glass cracks, soot puffs, the floor glows, the fire flares) before monsters come out.
//
// WP0 gives the static shape (`buildSpawnPoints`), the open/telegraph timers and a plain "nearest usable point" pick.
// WP4 adds the typed kind filter, the front scoring, the "several sides" rule and the ambush.
import { cellAt, CellKind, cellCenterX, cellCenterZ, cellFloor, cellIndex, roofAt, sideDx, sideDz, type Grid } from '../grid'
import type { GameConfig } from '../config'
import type { LevelDef, SpawnPointDef } from '../level'
import { vec } from '../model/common'
import type { SpawnPoint, SpawnType } from '../model/director'
import type { MonsterKind } from '../model/monsters'
import type { GameState, Sim } from '../state'
import { dist2, emit } from '../util'
import { navDistance } from './nav'

/** Which monster kinds may come out of which kind of point (DESIGN 5 + PLAN 4.3). Cold data, used by the director. */
export const SPAWN_KINDS: Readonly<Record<SpawnType, readonly MonsterKind[]>> = {
  'window': ['bat', 'zombie'],
  fireplace: ['rat', 'spider', 'gremlin'],
  crack: ['rat', 'spider', 'beetle', 'zombie', 'skeleton'],
  door: ['rat', 'spider', 'beetle', 'zombie', 'skeleton', 'witch', 'gremlin'],
  wall: ['ghost'],
  edge: ['rat', 'spider', 'beetle', 'zombie', 'skeleton', 'witch', 'gremlin'],
}

/** Builds the static spawn points of a level. Cold path. */
export function buildSpawnPoints(grid: Grid, cfg: GameConfig, level: LevelDef): SpawnPoint[] {
  const out: SpawnPoint[] = []
  for (const e of level.entities) {
    if (e.kind !== 'spawn') continue
    out.push(buildPoint(grid, cfg, e))
  }
  return out
}

/**
 * A spawn point in front of plan cell `at`, cut into the wall on its `wall` side, into its floor ('down'), or overhead
 * ('up': an opening in the roof over it, or in the open a portal in the sky). Cold path.
 */
function buildPoint(g: Grid, cfg: GameConfig, def: SpawnPointDef): SpawnPoint {
  const { at, wall } = def
  const i = cellIndex(g, at[0], at[1])
  const k = g.kind[i]
  if (k === undefined || k === CellKind.Wall || k === CellKind.Niche || k === CellKind.Void) throw new Error(`spawn ${def.id} at [${at[0]}, ${at[1]}]: must stand on an open floor cell`)
  const floor = cellFloor(g, i)
  const cx = cellCenterX(g, at[0])
  const cz = cellCenterZ(g, at[1])
  const sp = cfg.spawns
  const base = { id: def.id, type: def.type, ...(def.look ? { look: def.look } : {}), cell: i }
  if (wall === 'down') {
    return { ...base, mouth: vec(cx, floor, cz), deep: vec(cx, floor - sp.gateDepth, cz), out: vec(cx, floor, cz), nx: 0, ny: 1, nz: 0, ceiling: false }
  }
  if (wall === 'up') {
    const roof = roofAt(g, cx, cz)
    const top = Number.isFinite(roof) ? roof : floor + cfg.world.skyGate
    return { ...base, mouth: vec(cx, top, cz), deep: vec(cx, top + sp.gateDepth, cz), out: vec(cx, floor + sp.hover, cz), nx: 0, ny: -1, nz: 0, ceiling: true }
  }
  const sx = sideDx(wall)
  const sz = sideDz(wall)
  const behind = g.kind[cellIndex(g, at[0] + sx, at[1] + sz)]
  if (behind !== CellKind.Wall) throw new Error(`spawn ${def.id} at [${at[0]}, ${at[1]}]: there is no wall on its '${wall}' side`)
  const mx = cx + (sx * g.cell) / 2
  const mz = cz + (sz * g.cell) / 2
  // a window opens high (bats), everything else at the floor
  const mouthY = def.type === 'window' ? floor + Math.min(sp.hover, 2.2) : floor
  return {
    ...base,
    mouth: vec(mx, mouthY, mz),
    deep: vec(mx + sx * sp.gateDepth, mouthY, mz + sz * sp.gateDepth),
    out: vec(mx - sx * sp.gateOut, mouthY, mz - sz * sp.gateOut),
    nx: -sx,
    ny: 0,
    nz: -sz,
    ceiling: false,
  }
}

/** Opens a spawn point for at least `sec` (the view shows it; the event fires only when it was closed). */
export function openSpawnPoint(s: GameState, sim: Sim, index: number, sec: number): void {
  const p = s.spawnPoints[index]
  if (!p) return
  if (p.open <= 0) emit(sim, { type: 'spawnOpened', point: index })
  if (sec > p.open) p.open = sec
}

/** Starts the telegraph of a point (WP4: the director calls it a moment before a pack comes out). */
export function telegraphSpawnPoint(s: GameState, sim: Sim, index: number): void {
  const p = s.spawnPoints[index]
  if (!p || p.telegraph > 0) return
  p.telegraph = sim.cfg.spawns.telegraphSec
  emit(sim, { type: 'spawnTelegraph', point: index })
}

/**
 * The enabled spawn point to send a pack from: the `skip`-th nearest by walking distance to the player among those that
 * can reach the player and are not right next to them (so a wave spreads over several points). -1 when there is none.
 * WP4 replaces it with the front scoring of PLAN 4.3. Not a hot path.
 */
export function pickSpawnPoint(s: GameState, sim: Sim, skip: number): number {
  const p = s.player.pos
  const minD = sim.cfg.spawns.minPlayerDist
  const target = cellAt(sim.grid, p.x, p.z)
  const cand: { i: number; d: number }[] = []
  for (let i = 0; i < sim.spawns.length; i++) {
    const sp = sim.spawns[i]
    const st = s.spawnPoints[i]
    if (!sp || !st || !st.enabled) continue
    if (dist2(sp.out.x, sp.out.z, p.x, p.z) < minD * minD) continue
    const d = target >= 0 ? navDistance(sim.crawl, sp.cell, target) : 0
    if (d < 0) continue
    cand.push({ i, d })
  }
  if (cand.length === 0) return -1
  cand.sort((a, b) => a.d - b.d || a.i - b.i)
  return (cand[skip % cand.length] as { i: number }).i
}

/** Ticks the points' timers (open, busy, telegraph, time since use). Hot path: no allocations. */
export function updateSpawnPoints(s: GameState, dt: number): void {
  for (const p of s.spawnPoints) {
    if (p.open > 0) p.open = Math.max(0, p.open - dt)
    if (p.busy > 0) p.busy = Math.max(0, p.busy - dt)
    if (p.telegraph > 0) p.telegraph = Math.max(0, p.telegraph - dt)
    p.sinceUsed += dt
  }
}
