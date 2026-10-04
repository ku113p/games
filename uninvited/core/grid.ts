// The runtime grid built from a LevelDef plan: cell kinds, floor heights (with ramps), marker cells and groups.
// Static data - built once per level (cold path), never saved; the game state refers to it by indices.
import type { Cell, LevelDef, Side } from './level'

export const CellKind = {
  Wall: 0,
  Floor: 1,
  Cover: 2,
  Ramp: 3,
  Niche: 4,
  Laser: 5,
  RedWall: 6,
  Terminal: 7,
  Checkpoint: 8,
  Artifact: 9,
  Start: 10,
} as const
export type CellKind = (typeof CellKind)[keyof typeof CellKind]

const CHAR_KIND: Record<string, CellKind> = {
  '#': CellKind.Wall,
  '.': CellKind.Floor,
  '~': CellKind.Cover,
  '^': CellKind.Ramp,
  v: CellKind.Ramp,
  '<': CellKind.Ramp,
  '>': CellKind.Ramp,
  n: CellKind.Niche,
  '=': CellKind.Laser,
  D: CellKind.RedWall,
  T: CellKind.Terminal,
  C: CellKind.Checkpoint,
  A: CellKind.Artifact,
  S: CellKind.Start,
}

/** 0 = flat, 1 = slopes along x, 2 = slopes along z. */
export const RampAxis = { None: 0, X: 1, Z: 2 } as const
export type RampAxis = (typeof RampAxis)[keyof typeof RampAxis]

export interface Grid {
  cols: number
  rows: number
  cell: number
  ceiling: number
  coverHeight: number
  nicheHeight: number
  kind: Uint8Array
  rampAxis: Uint8Array
  /** Floor height at the low-coordinate edge (west for X ramps, north for Z ramps); flat cells: both equal. */
  h0: Float32Array
  /** Floor height at the high-coordinate edge (east / south). */
  h1: Float32Array
  /** Group id per cell for '=' and 'D' cells (connected groups), -1 elsewhere. */
  group: Int16Array
  start: number
  artifact: number
  checkpoints: number[]
  terminals: number[]
  /** Cells of each connected group of '=' cells, in group order. */
  laserGroups: number[][]
  /** Cells of each connected group of 'D' cells. */
  wallGroups: number[][]
}

export function cellIndex(g: Grid, col: number, row: number): number {
  return row * g.cols + col
}

export function colOf(g: Grid, index: number): number {
  return index % g.cols
}

export function rowOf(g: Grid, index: number): number {
  return Math.floor(index / g.cols)
}

export function cellCenterX(g: Grid, col: number): number {
  return (col + 0.5) * g.cell
}

export function cellCenterZ(g: Grid, row: number): number {
  return (row + 0.5) * g.cell
}

/** Cell index at a world point, or -1 outside the plan. */
export function cellAt(g: Grid, x: number, z: number): number {
  const col = Math.floor(x / g.cell)
  const row = Math.floor(z / g.cell)
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return -1
  return row * g.cols + col
}

export function kindAt(g: Grid, col: number, row: number): CellKind {
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return CellKind.Wall
  return g.kind[row * g.cols + col] as CellKind
}

export function isSolidKind(k: CellKind): boolean {
  return k === CellKind.Wall
}

/** Floor height (top of the walkable floor, not of cover) at a world point. Walls report their neighbours' 0. */
export function floorHeightAt(g: Grid, x: number, z: number): number {
  const i = cellAt(g, x, z)
  if (i < 0) return 0
  const axis = g.rampAxis[i]
  const a = g.h0[i] as number
  if (axis === RampAxis.None) return a
  const b = g.h1[i] as number
  const t = axis === RampAxis.X ? x / g.cell - Math.floor(x / g.cell) : z / g.cell - Math.floor(z / g.cell)
  return a + (b - a) * t
}

/** Mean floor height of a cell (for placing things on it). */
export function cellFloor(g: Grid, index: number): number {
  return ((g.h0[index] as number) + (g.h1[index] as number)) / 2
}

export function sideDx(side: Side): number {
  return side === 'e' ? 1 : side === 'w' ? -1 : 0
}

export function sideDz(side: Side): number {
  return side === 's' ? 1 : side === 'n' ? -1 : 0
}

/** Yaw (0 = +z / south, PI/2 = +x / east) of looking away from a wall side, i.e. out of the wall into the cell. */
export function yawAwayFrom(side: Side): number {
  switch (side) {
    case 'n':
      return 0
    case 's':
      return Math.PI
    case 'e':
      return -Math.PI / 2
    case 'w':
      return Math.PI / 2
  }
}

/** Yaw of looking towards a side. */
export function yawTowards(side: Side): number {
  switch (side) {
    case 's':
      return 0
    case 'n':
      return Math.PI
    case 'e':
      return Math.PI / 2
    case 'w':
      return -Math.PI / 2
  }
}

function flood(g: Grid, start: number, kind: CellKind, groupId: number): number[] {
  const out: number[] = []
  const stack = [start]
  g.group[start] = groupId
  while (stack.length > 0) {
    const i = stack.pop() as number
    out.push(i)
    const c = colOf(g, i)
    const r = rowOf(g, i)
    const n = [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ] as const
    for (const [nc, nr] of n) {
      if (kindAt(g, nc, nr) !== kind) continue
      const j = cellIndex(g, nc, nr)
      if (g.group[j] !== -1) continue
      g.group[j] = groupId
      stack.push(j)
    }
  }
  return out.sort((a, b) => a - b)
}

/** Builds the grid. Throws with a readable message on a malformed plan (cold path, level authoring errors). */
export function buildGrid(def: LevelDef): Grid {
  const rows = def.plan.length
  const cols = def.plan[0]?.length ?? 0
  if (rows === 0 || cols === 0) throw new Error(`level ${def.id}: empty plan`)
  const n = rows * cols
  const g: Grid = {
    cols,
    rows,
    cell: def.cell,
    ceiling: def.ceiling,
    coverHeight: def.coverHeight,
    nicheHeight: def.nicheHeight,
    kind: new Uint8Array(n),
    rampAxis: new Uint8Array(n),
    h0: new Float32Array(n),
    h1: new Float32Array(n),
    group: new Int16Array(n).fill(-1),
    start: -1,
    artifact: -1,
    checkpoints: [],
    terminals: [],
    laserGroups: [],
    wallGroups: [],
  }
  for (let r = 0; r < rows; r++) {
    const line = def.plan[r] as string
    if (line.length !== cols) throw new Error(`level ${def.id}: plan row ${r} has ${line.length} cells, expected ${cols}`)
    const hline = def.heights?.[r]
    if (def.heights && (hline === undefined || hline.length !== cols)) throw new Error(`level ${def.id}: heights row ${r} does not match the plan`)
    for (let c = 0; c < cols; c++) {
      const ch = line[c] as string
      const k = CHAR_KIND[ch]
      if (k === undefined) throw new Error(`level ${def.id}: unknown plan character "${ch}" at [${c}, ${r}]`)
      const i = r * cols + c
      g.kind[i] = k
      if (ch === '<' || ch === '>') g.rampAxis[i] = RampAxis.X
      if (ch === '^' || ch === 'v') g.rampAxis[i] = RampAxis.Z
      const hc = hline?.[c] ?? '0'
      const h = hc >= '0' && hc <= '9' ? Number(hc) * def.heightStep : 0
      g.h0[i] = h
      g.h1[i] = h
      if (k === CellKind.Start) g.start = i
      if (k === CellKind.Artifact) g.artifact = i
      if (k === CellKind.Checkpoint) g.checkpoints.push(i)
      if (k === CellKind.Terminal) g.terminals.push(i)
    }
  }
  if (g.start < 0) throw new Error(`level ${def.id}: no start (S)`)
  if (g.artifact < 0) throw new Error(`level ${def.id}: no artifact (A)`)
  // Ramp runs: slope linearly between the flat cells at both ends.
  for (let i = 0; i < n; i++) {
    const axis = g.rampAxis[i] as RampAxis
    if (axis === RampAxis.None) continue
    const c = colOf(g, i)
    const r = rowOf(g, i)
    const dc = axis === RampAxis.X ? 1 : 0
    const dr = axis === RampAxis.Z ? 1 : 0
    // only process from the first cell of a run
    const pc = c - dc
    const pr = r - dr
    if (kindAt(g, pc, pr) === CellKind.Ramp && g.rampAxis[cellIndex(g, pc, pr)] === axis) continue
    let len = 0
    while (kindAt(g, c + dc * len, r + dr * len) === CellKind.Ramp && g.rampAxis[cellIndex(g, c + dc * len, r + dr * len)] === axis) len++
    const before = kindAt(g, pc, pr)
    const ac = c + dc * len
    const ar = r + dr * len
    const after = kindAt(g, ac, ar)
    if (before === CellKind.Wall || after === CellKind.Wall) throw new Error(`level ${def.id}: ramp at [${c}, ${r}] must have floor at both ends`)
    const hStart = g.h0[cellIndex(g, pc, pr)] as number
    const hEnd = g.h0[cellIndex(g, ac, ar)] as number
    for (let k = 0; k < len; k++) {
      const j = cellIndex(g, c + dc * k, r + dr * k)
      g.h0[j] = hStart + ((hEnd - hStart) * k) / len
      g.h1[j] = hStart + ((hEnd - hStart) * (k + 1)) / len
    }
  }
  for (let i = 0; i < n; i++) {
    if (g.group[i] !== -1) continue
    if (g.kind[i] === CellKind.Laser) g.laserGroups.push(flood(g, i, CellKind.Laser, g.laserGroups.length))
  }
  for (let i = 0; i < n; i++) {
    if (g.group[i] !== -1) continue
    if (g.kind[i] === CellKind.RedWall) g.wallGroups.push(flood(g, i, CellKind.RedWall, g.wallGroups.length))
  }
  return g
}

/** The group index of the '=' or 'D' group that contains a plan cell; throws if the cell is not one. */
export function groupAt(g: Grid, at: Cell, kind: typeof CellKind.Laser | typeof CellKind.RedWall, what: string): number {
  const i = cellIndex(g, at[0], at[1])
  if (g.kind[i] !== kind) throw new Error(`${what}: cell [${at[0]}, ${at[1]}] is not a ${kind === CellKind.Laser ? "'='" : "'D'"} cell`)
  return g.group[i] as number
}

/** The wall side next to a floor cell (for terminals): the first of n/e/s/w that is a wall. */
export function wallSideOf(g: Grid, index: number): Side {
  const c = colOf(g, index)
  const r = rowOf(g, index)
  if (kindAt(g, c, r - 1) === CellKind.Wall) return 'n'
  if (kindAt(g, c + 1, r) === CellKind.Wall) return 'e'
  if (kindAt(g, c, r + 1) === CellKind.Wall) return 's'
  return 'w'
}
