// The solid shape of a closed red wall (shared by the physics adapter and the reachability guard). The visible wall is a
// thin plane through the middle of its 'D' cells; the solid one is bigger so that nothing lets you round or over it:
//  - it runs on through the blocks, low cover and void that continue its line (a parapet beside the wall is no way round,
//    nor is a jump across the void beside a bridge);
//  - it is tall: above the highest low surface near it (a dais, a parapet, a server block) plus a jump and a body.
import { CellKind, cellIndex, kindAt, type Grid } from './grid'
import type { BarrierShape } from './state'

export interface BarrierExtent {
  alongX: boolean
  coord: number
  /** The plane's extent along its line, metres (the visible wall's cells and the blocks that continue them). */
  min: number
  max: number
  /** Where the solid part starts and ends vertically. */
  bottom: number
  top: number
  /** The plan cells the line covers: the wall's own cells and the cells it was extended over. */
  cells: number[]
}

/** How far above the highest low surface near a wall its solid part ends (m): a jump, a body and some margin. */
export const BARRIER_CLEARANCE = 3.2
/** Cells around the wall whose surfaces count (only those not above the ceiling: towers and tall slabs are not stood on). */
const NEAR_CELLS = 2

export function barrierExtent(g: Grid, b: BarrierShape, cells: readonly number[]): BarrierExtent {
  const cell = g.cell
  const lineOf = (i: number): number => (b.alongX ? Math.floor(i / g.cols) : i % g.cols)
  const across = (i: number): number => (b.alongX ? i % g.cols : Math.floor(i / g.cols))
  const at = (line: number, ac: number): number => (b.alongX ? cellIndex(g, ac, line) : cellIndex(g, line, ac))
  const kind = (line: number, ac: number): number => (b.alongX ? kindAt(g, ac, line) : kindAt(g, line, ac))
  const ac0 = across(cells[0] as number)
  let lo = Infinity
  let hi = -Infinity
  for (const i of cells) {
    lo = Math.min(lo, lineOf(i))
    hi = Math.max(hi, lineOf(i))
  }
  const covered = new Set<number>(cells)
  const solid = (k: number): boolean => k === CellKind.Wall || k === CellKind.Cover || k === CellKind.Void
  while (solid(kind(lo - 1, ac0)) && lo > 0) lo--
  while (solid(kind(hi + 1, ac0)) && hi < (b.alongX ? g.rows : g.cols) - 1) hi++
  for (let l = lo; l <= hi; l++) covered.add(at(l, ac0))
  // the highest low surface in the neighbourhood sets how tall the solid part must be
  let near = 0
  let bottom = b.floor
  const lines = b.alongX ? g.rows : g.cols
  const acs = b.alongX ? g.cols : g.rows
  for (let l = Math.max(0, lo - NEAR_CELLS); l <= Math.min(lines - 1, hi + NEAR_CELLS); l++) {
    for (let a = Math.max(0, ac0 - NEAR_CELLS); a <= Math.min(acs - 1, ac0 + NEAR_CELLS); a++) {
      const i = at(l, a)
      if (g.kind[i] === CellKind.Void) continue
      const t = g.top[i] as number
      if (t <= g.ceiling) near = Math.max(near, t)
      bottom = Math.min(bottom, g.h0[i] as number)
    }
  }
  for (const blk of g.blocks) if (blk.maxY <= g.ceiling) near = Math.max(near, blk.maxY)
  return { alongX: b.alongX, coord: b.coord, min: lo * cell, max: (hi + 1) * cell, bottom: bottom - 1, top: Math.max(g.ceiling, near + BARRIER_CLEARANCE), cells: [...covered] }
}
