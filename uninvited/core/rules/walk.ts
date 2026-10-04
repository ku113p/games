// Walking navigation on the plan grid (wardens; anything else that walks can reuse it): A* over the cells a walker
// fits in, 8 neighbours without corner cutting, no climbing ledges, then string-pulled into a few straight legs.
// Walkers stay on the floor: walls, low cover ('~'), niches, closed red walls and cells a server block fills are out.
// Everything is preallocated at level build; findPath and walkClear never allocate (hot path).
import { CellKind, colOf, hasFloor, rowOf, type Grid } from '../grid'

const DC = [1, -1, 0, 0, 1, 1, -1, -1]
const DR = [0, 0, 1, -1, 1, -1, 1, -1]
const SQRT2 = Math.SQRT2
/** A step between neighbouring cells may change the floor by at most this much (ramps are smooth, ledges are not). */
const MAX_STEP = 0.45
/** Samples per metre when checking a straight leg. */
const CLEAR_STEP = 0.25

export interface WalkNav {
  grid: Grid
  /** Body radius kept clear of walls and server blocks, m. */
  radius: number
  /** 1 = a walker fits in this cell (static part; red walls are checked live through wallOpen). */
  open: Uint8Array
  /** Per red wall group: 1 when open (shared with the drones' nav, so opening a wall updates both). */
  wallOpen: Uint8Array
  // A* scratch
  gCost: Float32Array
  fCost: Float32Array
  from: Int32Array
  seen: Int32Array
  closed: Int32Array
  heap: Int32Array
  stamp: number
  cells: Int32Array
}

/** Floor height at the edge of cell i towards (dc, dr) (one of them 0): ramps report the height at that edge. */
function edgeHeight(g: Grid, i: number, dc: number, dr: number): number {
  const a = g.h0[i] as number
  const b = g.h1[i] as number
  const axis = g.rampAxis[i]
  if (axis === 1 && dc !== 0) return dc > 0 ? b : a
  if (axis === 2 && dr !== 0) return dr > 0 ? b : a
  return (a + b) / 2
}

/** Can a walker step straight from cell i to its 4-neighbour j (dc, dr)? */
function stepOk(nav: WalkNav, i: number, j: number, dc: number, dr: number): boolean {
  if (!walkable(nav, j)) return false
  return Math.abs(edgeHeight(nav.grid, i, dc, dr) - edgeHeight(nav.grid, j, -dc, -dr)) <= MAX_STEP
}

/**
 * Builds the walk grid. `wallOpen` is the per-red-wall open flags to share (the drones' nav keeps them up to date).
 * Cold path.
 */
export function createWalkNav(grid: Grid, radius: number, wallOpen: Uint8Array): WalkNav {
  const n = grid.cols * grid.rows
  const open = new Uint8Array(n)
  const half = grid.cell / 2 - radius
  for (let i = 0; i < n; i++) {
    const k = grid.kind[i]
    if (!hasFloor(grid, i) || k === CellKind.Cover || k === CellKind.Niche) continue
    const cx = (colOf(grid, i) + 0.5) * grid.cell
    const cz = (rowOf(grid, i) + 0.5) * grid.cell
    let free = true
    for (const b of grid.blocks) if (b.maxX > cx - half && b.minX < cx + half && b.maxZ > cz - half && b.minZ < cz + half) free = false
    open[i] = free ? 1 : 0
  }
  return {
    grid,
    radius,
    open,
    wallOpen,
    gCost: new Float32Array(n),
    fCost: new Float32Array(n),
    from: new Int32Array(n),
    seen: new Int32Array(n),
    closed: new Int32Array(n),
    heap: new Int32Array(n * 8 + 8),
    stamp: 0,
    cells: new Int32Array(n),
  }
}

/** Can a walker stand in this cell right now? */
export function walkable(nav: WalkNav, i: number): boolean {
  if (i < 0 || nav.open[i] !== 1) return false
  const g = nav.grid
  if (g.kind[i] === CellKind.RedWall) return nav.wallOpen[g.group[i] as number] === 1
  return true
}

/** Is the point (x, z) clear of walls, closed red walls and server blocks for a body of the nav's radius? */
function pointClear(nav: WalkNav, x: number, z: number): boolean {
  const g = nav.grid
  const r = nav.radius
  for (let k = 0; k < 4; k++) {
    const px = x + (k === 0 ? r : k === 1 ? -r : 0)
    const pz = z + (k === 2 ? r : k === 3 ? -r : 0)
    const c = Math.floor(px / g.cell)
    const rr = Math.floor(pz / g.cell)
    if (c < 0 || rr < 0 || c >= g.cols || rr >= g.rows) return false
    const i = rr * g.cols + c
    const kind = g.kind[i]
    if (!hasFloor(g, i) || kind === CellKind.Cover || kind === CellKind.Niche) return false
    if (kind === CellKind.RedWall && nav.wallOpen[g.group[i] as number] !== 1) return false
  }
  for (const b of g.blocks) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return false
  return true
}

/** Can a walker go in a straight line from (ax, az) to (bx, bz)? No walls, blocks or ledges on the way. */
export function walkClear(nav: WalkNav, ax: number, az: number, bx: number, bz: number): boolean {
  const g = nav.grid
  const dx = bx - ax
  const dz = bz - az
  const len = Math.sqrt(dx * dx + dz * dz)
  const steps = Math.max(1, Math.ceil(len / CLEAR_STEP))
  let prev = cellOf(g, ax, az)
  for (let k = 1; k <= steps; k++) {
    const x = ax + (dx * k) / steps
    const z = az + (dz * k) / steps
    if (!pointClear(nav, x, z)) return false
    const i = cellOf(g, x, z)
    if (i !== prev && prev >= 0) {
      const dc = colOf(g, i) - colOf(g, prev)
      const dr = rowOf(g, i) - rowOf(g, prev)
      if (dc !== 0 && dr !== 0) {
        // a diagonal hop between samples: both ways round must be steppable
        const viaC = prev + dc
        const viaR = prev + dr * g.cols
        if (!(stepOk(nav, prev, viaC, dc, 0) && stepOk(nav, viaC, i, 0, dr)) && !(stepOk(nav, prev, viaR, 0, dr) && stepOk(nav, viaR, i, dc, 0))) return false
      } else if (!stepOk(nav, prev, i, dc, dr)) return false
    }
    prev = i
  }
  return true
}

function cellOf(g: Grid, x: number, z: number): number {
  const c = Math.floor(x / g.cell)
  const r = Math.floor(z / g.cell)
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return -1
  return r * g.cols + c
}

/** The walkable cell nearest to (x, z) within two cells of it (the cell itself first), or -1. */
export function nearestWalkable(nav: WalkNav, x: number, z: number): number {
  const g = nav.grid
  const at = cellOf(g, x, z)
  if (walkable(nav, at)) return at
  const c0 = Math.floor(x / g.cell)
  const r0 = Math.floor(z / g.cell)
  let best = -1
  let bestD = Infinity
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const c = c0 + dc
      const r = r0 + dr
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue
      const i = r * g.cols + c
      if (!walkable(nav, i)) continue
      const ex = (c + 0.5) * g.cell - x
      const ez = (r + 0.5) * g.cell - z
      const d = ex * ex + ez * ez
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
  }
  return best
}

function heapPush(nav: WalkNav, n: number, i: number): number {
  const h = nav.heap
  const f = nav.fCost
  let k = n
  h[k] = i
  while (k > 0) {
    const p = (k - 1) >> 1
    const pi = h[p] as number
    if ((f[pi] as number) <= (f[i] as number)) break
    h[k] = pi
    h[p] = i
    k = p
  }
  return n + 1
}

function heapPop(nav: WalkNav, n: number): number {
  const h = nav.heap
  const f = nav.fCost
  const top = h[0] as number
  const last = h[n - 1] as number
  n--
  let k = 0
  h[0] = last
  for (;;) {
    const l = k * 2 + 1
    if (l >= n) break
    const r = l + 1
    const c = r < n && (f[h[r] as number] as number) < (f[h[l] as number] as number) ? r : l
    if ((f[h[c] as number] as number) >= (f[last] as number)) break
    h[k] = h[c] as number
    h[c] = last
    k = c
  }
  return top
}

/**
 * The walk from (ax, az) to (bx, bz): writes the corner points after the start (x, z pairs) into `out` and returns
 * their count (at least 1: the goal), or -1 when there is no way. A goal inside something solid is moved to the
 * nearest cell a walker fits in. At most out.length / 2 points (a longer walk is cut short; walk it and ask again).
 */
export function findPath(nav: WalkNav, ax: number, az: number, bx: number, bz: number, out: Float32Array): number {
  const g = nav.grid
  const start = nearestWalkable(nav, ax, az)
  let goal = cellOf(g, bx, bz)
  let gx = bx
  let gz = bz
  if (!walkable(nav, goal) || !pointClear(nav, bx, bz)) {
    goal = nearestWalkable(nav, bx, bz)
    gx = (colOf(g, goal) + 0.5) * g.cell
    gz = (rowOf(g, goal) + 0.5) * g.cell
  }
  if (start < 0 || goal < 0) return -1
  if (out.length < 2) return -1
  if (start === goal || walkClear(nav, ax, az, gx, gz)) {
    out[0] = gx
    out[1] = gz
    return 1
  }
  // A*
  const stamp = ++nav.stamp
  const gc = nav.gCost
  const fc = nav.fCost
  const goalC = colOf(g, goal)
  const goalR = rowOf(g, goal)
  const h = (i: number): number => {
    const dc = Math.abs(colOf(g, i) - goalC)
    const dr = Math.abs(rowOf(g, i) - goalR)
    return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr)
  }
  nav.seen[start] = stamp
  gc[start] = 0
  fc[start] = h(start)
  nav.from[start] = -1
  let n = heapPush(nav, 0, start)
  let found = false
  while (n > 0) {
    const i = heapPop(nav, n)
    n--
    if (nav.closed[i] === stamp) continue
    nav.closed[i] = stamp
    if (i === goal) {
      found = true
      break
    }
    const c = colOf(g, i)
    const r = rowOf(g, i)
    for (let k = 0; k < 8; k++) {
      const dc = DC[k] as number
      const dr = DR[k] as number
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue
      const j = nr * g.cols + nc
      if (nav.closed[j] === stamp) continue
      let ok: boolean
      if (dc !== 0 && dr !== 0) {
        const a = r * g.cols + nc
        const b = nr * g.cols + c
        ok = stepOk(nav, i, a, dc, 0) && stepOk(nav, a, j, 0, dr) && stepOk(nav, i, b, 0, dr) && stepOk(nav, b, j, dc, 0)
      } else ok = stepOk(nav, i, j, dc, dr)
      if (!ok) continue
      const cost = (gc[i] as number) + (dc !== 0 && dr !== 0 ? SQRT2 : 1)
      if (nav.seen[j] === stamp && cost >= (gc[j] as number)) continue
      nav.seen[j] = stamp
      gc[j] = cost
      fc[j] = cost + h(j)
      nav.from[j] = i
      if (n < nav.heap.length) n = heapPush(nav, n, j)
    }
  }
  if (!found) return -1
  // the cell chain, goal first
  let len = 0
  for (let i = goal; i >= 0 && len < nav.cells.length; i = nav.from[i] as number) nav.cells[len++] = i
  // string pulling: from the current point, jump to the farthest cell centre (then the goal) in a straight clear line
  const max = out.length >> 1
  let count = 0
  let px = ax
  let pz = az
  let k = len - 1 // the start cell
  while (count < max) {
    let next = -1
    let nx = gx
    let nz = gz
    if (walkClear(nav, px, pz, gx, gz)) next = -2
    else {
      for (let m = 0; m < k; m++) {
        const ci = nav.cells[m] as number
        const cx = (colOf(g, ci) + 0.5) * g.cell
        const cz = (rowOf(g, ci) + 0.5) * g.cell
        if (walkClear(nav, px, pz, cx, cz)) {
          next = m
          nx = cx
          nz = cz
          break
        }
      }
      if (next < 0) {
        // nothing in a clean line (squeezed past a corner): take the next cell on the chain anyway
        next = Math.max(0, k - 1)
        const ci = nav.cells[next] as number
        nx = (colOf(g, ci) + 0.5) * g.cell
        nz = (rowOf(g, ci) + 0.5) * g.cell
      }
    }
    out[count * 2] = nx
    out[count * 2 + 1] = nz
    count++
    if (next === -2 || next === 0) {
      if (next === 0 && count < max) {
        out[count * 2] = gx
        out[count * 2 + 1] = gz
        count++
      }
      break
    }
    px = nx
    pz = nz
    k = next
  }
  return count
}
