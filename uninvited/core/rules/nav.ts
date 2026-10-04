// Navigation on the plan grid: BFS flow fields towards a target cell, cached in a few preallocated slots.
// Drones fly over floor, cover, ramps and lasers; walls, niches and closed red walls stop them. A ground nav (the
// worms') additionally needs a floor to crawl on (crawlable); it shares the drones' red-wall flags.
import { CellKind, colOf, hasFloor, rowOf, stepHeight, type Grid } from '../grid'

const SLOTS = 12
const UNREACHED = 32767

export interface Nav {
  grid: Grid
  /** Per red wall group: 1 when open. */
  wallOpen: Uint8Array
  fields: Int16Array[]
  keys: Int32Array
  used: Int32Array
  clock: number
  queue: Int32Array
  /** On the ground (worms): only crawlable cells. */
  ground: boolean
  /** Navs that share this one's red-wall flags (their caches go stale with it). */
  linked: Nav[]
  /** A ground nav only crosses floor steps up to this high, m. */
  climb: number
}

/** `shareWalls`: a nav whose red-wall flags this one follows (a ground nav next to the drones' one). */
export function createNav(grid: Grid, ground = false, shareWalls?: Nav, climb = Infinity): Nav {
  const n = grid.cols * grid.rows
  const fields: Int16Array[] = []
  for (let i = 0; i < SLOTS; i++) fields.push(new Int16Array(n))
  const nav: Nav = {
    grid,
    wallOpen: shareWalls ? shareWalls.wallOpen : new Uint8Array(Math.max(1, grid.wallGroups.length)),
    fields,
    keys: new Int32Array(SLOTS).fill(-1),
    used: new Int32Array(SLOTS),
    clock: 0,
    queue: new Int32Array(n),
    ground,
    linked: [],
    climb,
  }
  if (shareWalls) shareWalls.linked.push(nav)
  return nav
}

/**
 * Has this cell a floor a worm can crawl on (static part)? The one place that says so for the worms - it follows the
 * level's own walkability (core/grid.ts hasFloor: no blocks, no void), and no niches.
 */
export function crawlable(g: Grid, index: number): boolean {
  return hasFloor(g, index) && g.kind[index] !== CellKind.Niche
}

/** Can this nav move from cell i to its neighbour j: j is open, and on the ground the step between them is climbable. */
function passable(nav: Nav, i: number, j: number): boolean {
  if (!flyable(nav, j)) return false
  return !nav.ground || nav.climb === Infinity || stepHeight(nav.grid, i, j) <= nav.climb
}

/** Can a drone be in this cell? */
export function flyable(nav: Nav, index: number): boolean {
  const g = nav.grid
  const k = g.kind[index]
  if (k === CellKind.Wall || k === CellKind.Niche) return false
  if (nav.ground && !crawlable(g, index)) return false
  if (k === CellKind.RedWall) return nav.wallOpen[g.group[index] as number] === 1
  return true
}

export function setNavWallOpen(nav: Nav, group: number, open: boolean): void {
  if ((nav.wallOpen[group] === 1) === open) return
  nav.wallOpen[group] = open ? 1 : 0
  nav.keys.fill(-1) // every cached field may be stale now
  for (const l of nav.linked) l.keys.fill(-1)
}

const DC = [1, -1, 0, 0, 1, 1, -1, -1]
const DR = [0, 0, 1, -1, 1, -1, 1, -1]

function field(nav: Nav, target: number): Int16Array {
  for (let s = 0; s < SLOTS; s++) {
    if (nav.keys[s] === target) {
      nav.used[s] = ++nav.clock
      return nav.fields[s] as Int16Array
    }
  }
  let slot = 0
  for (let s = 1; s < SLOTS; s++) if ((nav.used[s] as number) < (nav.used[slot] as number)) slot = s
  const f = nav.fields[slot] as Int16Array
  nav.keys[slot] = target
  nav.used[slot] = ++nav.clock
  f.fill(UNREACHED)
  const g = nav.grid
  const q = nav.queue
  let head = 0
  let tail = 0
  f[target] = 0
  q[tail++] = target
  while (head < tail) {
    const i = q[head++] as number
    const c = colOf(g, i)
    const r = rowOf(g, i)
    const d = (f[i] as number) + 1
    for (let k = 0; k < 4; k++) {
      const nc = c + (DC[k] as number)
      const nr = r + (DR[k] as number)
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue
      const j = nr * g.cols + nc
      if ((f[j] as number) <= d || !passable(nav, i, j)) continue
      f[j] = d
      q[tail++] = j
    }
  }
  return f
}

/** The next cell to fly to from `from` towards `to`, or -1 when unreachable (or already there). No corner cutting. */
export function nextCell(nav: Nav, from: number, to: number): number {
  if (from === to || from < 0 || to < 0 || !flyable(nav, to)) return -1
  const f = field(nav, to)
  const g = nav.grid
  const c = colOf(g, from)
  const r = rowOf(g, from)
  let best = -1
  let bestD = f[from] as number
  if (bestD >= UNREACHED) bestD = UNREACHED // off the field (e.g. pushed into a niche edge): any reachable neighbour helps
  for (let k = 0; k < 8; k++) {
    const dc = DC[k] as number
    const dr = DR[k] as number
    const nc = c + dc
    const nr = r + dr
    if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue
    const j = nr * g.cols + nc
    if (dc !== 0 && dr !== 0) {
      const a = r * g.cols + nc
      const b = nr * g.cols + c
      if (!flyable(nav, j) || !((passable(nav, from, a) && passable(nav, a, j)) || (passable(nav, from, b) && passable(nav, b, j)))) continue
      if (!flyable(nav, a) || !flyable(nav, b)) continue
    } else if (!passable(nav, from, j)) continue
    const d = (f[j] as number) + (dc !== 0 && dr !== 0 ? 0.5 : 0)
    if (d < bestD) {
      bestD = d
      best = j
    }
  }
  return best
}

/** Steps on the flow field between two cells, or -1 when unreachable. */
export function navDistance(nav: Nav, from: number, to: number): number {
  if (from < 0 || to < 0 || !flyable(nav, to)) return -1
  const d = field(nav, to)[from] as number
  return d >= UNREACHED ? -1 : d
}
