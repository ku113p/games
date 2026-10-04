// Where can the player get to on foot? A conservative (generous) model of the real movement on the level grid, for the
// guard that red walls and level structure cannot be bypassed (scripts/levels-reach.test.ts). It stands on everything
// the physics lets you stand on - floors, ramps, slab and parapet tops, low cover, server blocks, hex modules - and
// moves between neighbouring cells by: walking (a step up to the autostep height), a jump up (to the jump height, not
// under a low roof), a drop (any depth), and a jump across a gap of void (a few cells). Closed red walls block their
// whole solid shape (core/barrier.ts) at every height.
import { barrierExtent } from './barrier'
import { CellKind, RampAxis, blockContains, cellIndex, colOf, rowOf, roofAt, type Grid } from './grid'
import { barrierShape } from './state'

export interface ReachLimits {
  /** The highest step walking up takes in its stride, m. */
  autostep: number
  /** The highest ledge a jump gets onto, m (v^2 / 2g of the jump). */
  jump: number
  /** The widest gap of void (in cells) a running jump clears. */
  gapCells: number
  /** Head room of a standing body and of a crouched one, m. */
  body: number
  crouchBody: number
}

export interface MoveNumbers {
  jumpSpeed: number
  gravity: number
  runSpeed: number
}

/** The limits from the movement numbers (config.json "player") and the controller's autostep (config.json "physics"). */
export function reachLimits(p: MoveNumbers, autostep: number, cell: number, body = 1.8, crouchBody = 1.1): ReachLimits {
  const air = (2 * p.jumpSpeed) / p.gravity
  const range = p.runSpeed * air
  return { autostep, jump: (p.jumpSpeed * p.jumpSpeed) / (2 * p.gravity), gapCells: Math.floor(range / cell), body, crouchBody }
}

interface Node {
  cell: number
  /** Height of the standing surface at the cell's west/north and east/south edge (ramps differ, the rest are flat). */
  h0: number
  h1: number
  axis: number
}

export interface Reach {
  /** Per plan cell: can the player stand there (on any surface)? */
  cells: Uint8Array
  /** Highest standable surface per cell, -Infinity where none. */
  top: Float64Array
  /** Every reachable standing surface: its cell and height (at the cell centre). */
  surfaces: { cell: number; h: number }[]
  /** For debugging a leak: the cell each reachable cell was first reached from (-1: the start). */
  from: Int32Array
}

function edgeH(n: Node, dc: number, dr: number): number {
  if (n.axis === RampAxis.X && dc !== 0) return dc > 0 ? n.h1 : n.h0
  if (n.axis === RampAxis.Z && dr !== 0) return dr > 0 ? n.h1 : n.h0
  return (n.h0 + n.h1) / 2
}

/** The standing surfaces of every cell. */
function buildNodes(g: Grid): Node[][] {
  const out: Node[][] = []
  for (let i = 0; i < g.kind.length; i++) {
    const list: Node[] = []
    const k = g.kind[i] as number
    const axis = g.rampAxis[i] as number
    if (k === CellKind.Wall || k === CellKind.Cover) list.push({ cell: i, h0: g.top[i] as number, h1: g.top[i] as number, axis: 0 })
    else if (k !== CellKind.Void) list.push({ cell: i, h0: g.h0[i] as number, h1: g.h1[i] as number, axis })
    if (k !== CellKind.Wall && k !== CellKind.Void) {
      // server blocks and hex modules standing in (or reaching into) the cell
      const x0 = colOf(g, i) * g.cell
      const z0 = rowOf(g, i) * g.cell
      for (const b of g.blocks) {
        if (b.maxX <= x0 || b.minX >= x0 + g.cell || b.maxZ <= z0 || b.minZ >= z0 + g.cell) continue
        if (b.hex) {
          // the prism's true footprint: does it touch this cell?
          let hit = false
          for (let sx = 0; sx <= 4 && !hit; sx++) for (let sz = 0; sz <= 4 && !hit; sz++) hit = blockContains(b, x0 + (sx * g.cell) / 4, z0 + (sz * g.cell) / 4)
          if (!hit) continue
        }
        list.push({ cell: i, h0: b.maxY, h1: b.maxY, axis: 0 })
      }
    }
    out.push(list)
  }
  return out
}

/** The cells a closed red wall group blocks completely (its own and the blocks that continue its line). */
export function wallCells(g: Grid, group: number): number[] {
  const cells = g.wallGroups[group] as number[]
  return barrierExtent(g, barrierShape(g, cells), cells).cells
}

/**
 * The reachable standing surfaces from the start. `open[w]`: red wall group w is open (everything is open when
 * `open` is true, everything closed when false).
 */
export function reachable(g: Grid, lim: ReachLimits, open: boolean | readonly boolean[]): Reach {
  const nodes = buildNodes(g)
  const blocked = new Uint8Array(g.kind.length)
  for (let w = 0; w < g.wallGroups.length; w++) {
    const isOpen = typeof open === 'boolean' ? open : open[w] === true
    if (isOpen) continue
    for (const i of wallCells(g, w)) blocked[i] = 1
  }
  const roofOver = (i: number): number => roofAt(g, (colOf(g, i) + 0.5) * g.cell, (rowOf(g, i) + 0.5) * g.cell)
  const roof = new Float64Array(g.kind.length)
  for (let i = 0; i < roof.length; i++) roof[i] = roofOver(i)
  const standable = (n: Node, h: number): boolean => (roof[n.cell] as number) - h >= lim.crouchBody
  const seen = new Set<Node>()
  const parent = new Map<Node, Node>()
  const stack: Node[] = []
  const startNode = (nodes[g.start] as Node[])[0] as Node
  seen.add(startNode)
  stack.push(startNode)

  const tryMove = (from: Node, to: Node, fromH: number, toH: number, gap: number): void => {
    if (seen.has(to) || blocked[to.cell] || !standable(to, toH)) return
    const up = toH - fromH
    if (up > 0) {
      // a step up in the stride (not across a gap), else a jump: not under a low roof
      const stride = gap === 0 && up <= lim.autostep
      if (!stride) {
        const reach = gap === 0 ? lim.jump : gap === 1 ? lim.jump : Math.min(lim.jump, 0.3)
        if (up > reach) return
        if ((roof[from.cell] as number) - fromH < lim.body + up || (roof[to.cell] as number) - fromH < lim.body + up) return
      }
    }
    seen.add(to)
    parent.set(to, from)
    stack.push(to)
  }

  while (stack.length > 0) {
    const n = stack.pop() as Node
    const c = colOf(g, n.cell)
    const r = rowOf(g, n.cell)
    // other surfaces in the same cell (a block standing on the floor, the floor beside it)
    for (const m of nodes[n.cell] as Node[]) if (m !== n) tryMove(n, m, edgeH(n, 0, 0), edgeH(m, 0, 0), 0)
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const fh = edgeH(n, dc, dr)
      // walking (and jumping up) to the next cell
      const nc = c + dc
      const nr = r + dr
      if (nc >= 0 && nr >= 0 && nc < g.cols && nr < g.rows) {
        for (const m of nodes[cellIndex(g, nc, nr)] as Node[]) tryMove(n, m, fh, edgeH(m, -dc, -dr), 0)
      }
      // a jump across a gap: the cells between are void (or low enough to fly over), the far side is a surface
      for (let k = 1; k <= lim.gapCells; k++) {
        const mid = cellIndex(g, c + dc * k, r + dr * k)
        const fc = c + dc * (k + 1)
        const fr = r + dr * (k + 1)
        if (c + dc * k < 0 || r + dr * k < 0 || c + dc * k >= g.cols || r + dr * k >= g.rows) break
        if (blocked[mid]) break
        if (g.kind[mid] !== CellKind.Void && (g.top[mid] as number) > fh + lim.jump * 0.5) break
        if (fc < 0 || fr < 0 || fc >= g.cols || fr >= g.rows) break
        for (const m of nodes[cellIndex(g, fc, fr)] as Node[]) tryMove(n, m, fh, edgeH(m, -dc, -dr), k)
      }
    }
    // a jump across the void on the diagonal (cells in between: void or low), a little shorter than the straight one
    for (const [dc, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const fh = edgeH(n, 0, 0)
      for (let k = 1; k <= Math.floor(lim.gapCells / 1.4); k++) {
        const mc = c + dc * k
        const mr = r + dr * k
        const fc = c + dc * (k + 1)
        const fr = r + dr * (k + 1)
        if (mc < 0 || mr < 0 || mc >= g.cols || mr >= g.rows || fc < 0 || fr < 0 || fc >= g.cols || fr >= g.rows) break
        const mid = cellIndex(g, mc, mr)
        if (blocked[mid]) break
        if (g.kind[mid] !== CellKind.Void && (g.top[mid] as number) > fh + lim.jump * 0.5) break
        for (const m of nodes[cellIndex(g, fc, fr)] as Node[]) tryMove(n, m, fh, edgeH(m, 0, 0), k)
      }
    }
  }
  const cells = new Uint8Array(g.kind.length)
  const top = new Float64Array(g.kind.length).fill(-Infinity)
  const surfaces: { cell: number; h: number }[] = []
  for (const n of seen) {
    cells[n.cell] = 1
    const h = Math.max(n.h0, n.h1)
    top[n.cell] = Math.max(top[n.cell] as number, h)
    surfaces.push({ cell: n.cell, h })
  }
  const fromCell = new Int32Array(g.kind.length).fill(-1)
  for (const [to, from] of parent) if (fromCell[to.cell] === -1 && to.cell !== from.cell) fromCell[to.cell] = from.cell
  return { cells, top, surfaces, from: fromCell }
}
