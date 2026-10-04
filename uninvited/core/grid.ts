// The runtime grid built from a LevelDef plan: cell kinds, floor heights (with ramps), block tops, the void, roofs,
// marker cells and groups. Static data - built once per level (cold path), never saved; the game state refers to it
// by indices. hasFloor() is the one place that says where a walker may stand (wardens, worms, the bot): never in a
// block, never over the void.
import type { WorldConfig } from './config'
import type { Cell, LevelDef, Side } from './level'

export const CellKind = {
  Wall: 0,
  Floor: 1,
  Cover: 2,
  Ramp: 3,
  Niche: 4,
  RedWall: 6,
  Exit: 9,
  Start: 10,
  Void: 11,
} as const
export type CellKind = (typeof CellKind)[keyof typeof CellKind]

const CHAR_KIND: Record<string, CellKind> = {
  '#': CellKind.Wall,
  W: CellKind.Wall,
  F: CellKind.Wall,
  X: CellKind.Wall,
  _: CellKind.Void,
  '.': CellKind.Floor,
  '~': CellKind.Cover,
  '^': CellKind.Ramp,
  v: CellKind.Ramp,
  '<': CellKind.Ramp,
  '>': CellKind.Ramp,
  n: CellKind.Niche,
  d: CellKind.Floor,
  D: CellKind.RedWall,
  B: CellKind.RedWall,
  E: CellKind.Exit,
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
  /** Group id per cell for 'D' and 'B' cells (connected groups: portcullises, breakable walls), -1 elsewhere. */
  group: Int16Array
  start: number
  /** The exit cell (E), -1 when the level has none. */
  exit: number
  /** Cells of each connected group of 'D' / 'B' cells (portcullises and breakable walls), in group order. */
  wallGroups: number[][]
  /** Solid boxes standing on the floor: always empty since the pivot (the level format has no cover or hex entities); WP5 removes it. */
  blocks: Block[]
  /**
   * The highest solid surface in each cell: a block's top ('#', 'H'), the low cover's top ('~'), the floor (the
   * higher edge of a ramp), and `bottom` over the void.
   */
  top: Float32Array
  /** 1 for a hex block ('H'), 0 for a clean slab and everything else (the view dresses them differently). */
  hex: Uint8Array
  /** Where the void ends: below it nothing is built or simulated (slabs and platforms reach down to it). */
  bottom: number
  /** The roofs over parts of the open city: the only ceilings. */
  roofs: Roof[]
}

/** A roof: a ceiling over a rectangle of the plan, its underside at y. */
export interface Roof {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
  y: number
}

/** An axis-aligned solid box standing on the floor (a server block). */
export interface Block {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
  /** Floor under it and its top. */
  minY: number
  maxY: number
  /**
   * A hex module: the hexagonal prism inscribed in the box (corners at the box's west and east sides, flat sides at
   * its north and south sides). The box stays its conservative bound for anything that does not care.
   */
  hex?: boolean
}

const SQRT3 = Math.sqrt(3)

/** Is the point (x, z) inside the block's footprint (exactly, for hex modules)? */
export function blockContains(b: Block, x: number, z: number): boolean {
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false
  if (!b.hex) return true
  const r = (b.maxX - b.minX) / 2
  const dx = Math.abs(x - (b.minX + b.maxX) / 2)
  const dz = Math.abs(z - (b.minZ + b.maxZ) / 2)
  return SQRT3 * dx + dz <= SQRT3 * r
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

/**
 * Can a walker stand in this cell (the static part: red walls and blocks inside it are the walker's own business)?
 * Not a block, not the void, not outside the plan. The single source of truth for every walker.
 */
export function hasFloor(g: Grid, index: number): boolean {
  if (index < 0 || index >= g.kind.length) return false
  const k = g.kind[index]
  return k !== CellKind.Wall && k !== CellKind.Void
}

/**
 * The floor's height change stepping from cell i to its 4-neighbour j (the heights at their shared edge; ramps are
 * smooth, ledges are not). For walkers' step limits (worms: config worm.climb; wardens: a small step).
 */
export function stepHeight(g: Grid, i: number, j: number): number {
  const dc = colOf(g, j) - colOf(g, i)
  const dr = rowOf(g, j) - rowOf(g, i)
  return Math.abs(edgeFloor(g, i, dc, dr) - edgeFloor(g, j, -dc, -dr))
}

/** Floor height of cell i at its edge towards (dc, dr) (one of them 0). */
function edgeFloor(g: Grid, i: number, dc: number, dr: number): number {
  const a = g.h0[i] as number
  const b = g.h1[i] as number
  const axis = g.rampAxis[i]
  if (axis === RampAxis.X && dc !== 0) return dc > 0 ? b : a
  if (axis === RampAxis.Z && dr !== 0) return dr > 0 ? b : a
  return (a + b) / 2
}

/**
 * How far down the face of a block must reach on its side towards the floor neighbour at (dc, dr): the lowest the
 * floor gets along their shared edge. A ramp slopes along that edge, so the face has to follow its low end or a wedge
 * of void shows between the ramp and the wall's flat bottom.
 */
export function footBeside(g: Grid, neighbour: number): number {
  const lo = Math.min(g.h0[neighbour] as number, g.h1[neighbour] as number)
  return g.kind[neighbour] === CellKind.Ramp ? lo : Math.min(g.top[neighbour] as number, g.h0[neighbour] as number)
}

/** Is the point over the void (no floor - or outside the plan, which is the void too)? */
export function isVoidAt(g: Grid, x: number, z: number): boolean {
  const i = cellAt(g, x, z)
  return i < 0 || g.kind[i] === CellKind.Void
}

/**
 * The top of whatever is solid at a point: the floor, the low cover, a block, a server block or hex module (whichever
 * is highest), `bottom` over the void. For lines of sight over the city (view/sight.ts).
 */
export function solidTopAt(g: Grid, x: number, z: number): number {
  const i = cellAt(g, x, z)
  if (i < 0) return g.bottom
  const k = g.kind[i]
  let top = k === CellKind.Wall || k === CellKind.Void || k === CellKind.Cover ? (g.top[i] as number) : floorHeightAt(g, x, z)
  for (const b of g.blocks) if (b.maxY > top && blockContains(b, x, z)) top = b.maxY
  return top
}

/** The underside of the roof over a point, or Infinity under the open sky. */
export function roofAt(g: Grid, x: number, z: number): number {
  let y = Infinity
  for (const r of g.roofs) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && r.y < y) y = r.y
  return y
}

/**
 * Floor height (top of the walkable floor, not of cover) at a world point. Blocks report the height of their foot,
 * the void its nominal height from the heights plan (there is no floor there - see hasFloor / isVoidAt).
 */
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

/**
 * Builds the grid. `world` (config.json "world") maps the tops plan to metres; without it blocks are `ceiling` tall
 * and a tops plan is an error. Throws with a readable message on a malformed plan (cold path, level authoring errors).
 */
export function buildGrid(def: LevelDef, world?: WorldConfig): Grid {
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
    exit: -1,
    wallGroups: [],
    blocks: [],
    top: new Float32Array(n),
    hex: new Uint8Array(n),
    bottom: 0,
    roofs: [],
  }
  if (def.tops && !world) throw new Error(`level ${def.id}: a tops plan needs the world config (config.json "world")`)
  const blockTop = def.blockTop ?? world?.defaultTop ?? def.ceiling
  if (!(blockTop > 0)) throw new Error(`level ${def.id}: blockTop must be positive`)
  for (let r = 0; r < rows; r++) {
    const line = def.plan[r] as string
    if (line.length !== cols) throw new Error(`level ${def.id}: plan row ${r} has ${line.length} cells, expected ${cols}`)
    const hline = def.heights?.[r]
    if (def.heights && (hline === undefined || hline.length !== cols)) throw new Error(`level ${def.id}: heights row ${r} does not match the plan`)
    const tline = def.tops?.[r]
    if (def.tops && (tline === undefined || tline.length !== cols)) throw new Error(`level ${def.id}: tops row ${r} does not match the plan`)
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
      const tc = tline?.[c] ?? '.'
      if (tc !== '.' && k !== CellKind.Wall) throw new Error(`level ${def.id}: tops '${tc}' at [${c}, ${r}] is not on a block ('#' or 'H')`)
      let tall = blockTop
      if (tc !== '.') {
        const m = world?.tops[tc]
        if (m === undefined) throw new Error(`level ${def.id}: unknown tops character "${tc}" at [${c}, ${r}] (known: ${Object.keys(world?.tops ?? {}).join(' ')})`)
        tall = m
      }
      g.top[i] = k === CellKind.Wall ? h + tall : k === CellKind.Cover ? h + def.coverHeight : h
      if (k === CellKind.Start) g.start = i
      if (k === CellKind.Exit) g.exit = i
    }
  }
  if (g.start < 0) throw new Error(`level ${def.id}: no start (S)`)
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
    if (before === CellKind.Wall || after === CellKind.Wall || before === CellKind.Void || after === CellKind.Void)
      throw new Error(`level ${def.id}: ramp at [${c}, ${r}] must have floor at both ends`)
    const hStart = g.h0[cellIndex(g, pc, pr)] as number
    const hEnd = g.h0[cellIndex(g, ac, ar)] as number
    for (let k = 0; k < len; k++) {
      const j = cellIndex(g, c + dc * k, r + dr * k)
      g.h0[j] = hStart + ((hEnd - hStart) * k) / len
      g.h1[j] = hStart + ((hEnd - hStart) * (k + 1)) / len
      g.top[j] = Math.max(g.h0[j] as number, g.h1[j] as number)
    }
  }
  // the void reaches voidDepth below the lowest floor; its cells' top is that bottom
  let lowest = Infinity
  for (let i = 0; i < n; i++) if (g.kind[i] !== CellKind.Void && g.kind[i] !== CellKind.Wall) lowest = Math.min(lowest, g.h0[i] as number, g.h1[i] as number)
  g.bottom = (Number.isFinite(lowest) ? lowest : 0) - (world?.voidDepth ?? def.ceiling)
  for (let i = 0; i < n; i++) if (g.kind[i] === CellKind.Void) g.top[i] = g.bottom
  for (const roof of def.roofs ?? []) g.roofs.push(roofOf(g, def, roof.from, roof.to, roof.height ?? def.ceiling))
  // every room except the open roof has a ceiling over its rectangle
  for (const room of def.rooms) {
    if (room.kind === 'roof') continue
    g.roofs.push(roofOf(g, def, room.from, room.to, (g.h0[cellIndex(g, room.from[0], room.from[1])] as number) + room.ceiling))
  }
  for (let i = 0; i < n; i++) {
    if (g.group[i] !== -1) continue
    if (g.kind[i] === CellKind.RedWall) g.wallGroups.push(flood(g, i, CellKind.RedWall, g.wallGroups.length))
  }
  return g
}

function roofOf(g: Grid, def: LevelDef, from: Cell, to: Cell, y: number): Roof {
  const c0 = Math.min(from[0], to[0])
  const c1 = Math.max(from[0], to[0])
  const r0 = Math.min(from[1], to[1])
  const r1 = Math.max(from[1], to[1])
  if (c0 < 0 || r0 < 0 || c1 >= g.cols || r1 >= g.rows) throw new Error(`level ${def.id}: roof [${from[0]}, ${from[1]}]-[${to[0]}, ${to[1]}] reaches outside the plan`)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = cellIndex(g, c, r)
      if (g.kind[i] !== CellKind.Wall && g.kind[i] !== CellKind.Void && (g.top[i] as number) + 2 > y)
        throw new Error(`level ${def.id}: roof [${from[0]}, ${from[1]}]-[${to[0]}, ${to[1]}] at ${y} m is too low over the floor at [${c}, ${r}]`)
    }
  }
  return { minX: c0 * g.cell, minZ: r0 * g.cell, maxX: (c1 + 1) * g.cell, maxZ: (r1 + 1) * g.cell, y }
}

/** The group index of the portcullis ('D' / 'B') group that contains a plan cell; throws if the cell is not one. */
export function groupAt(g: Grid, at: Cell, what: string): number {
  const i = cellIndex(g, at[0], at[1])
  if (g.kind[i] !== CellKind.RedWall) throw new Error(`${what}: cell [${at[0]}, ${at[1]}] is not a 'D' or 'B' cell`)
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
