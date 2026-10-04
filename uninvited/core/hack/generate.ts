// The puzzle generator. Solvable by construction: it walks a valid solution path first (row 0, then the column
// of the last pick, then its row, ...), writes the target codes onto that path, fills the rest of the grid at random
// and only then hides 1-2 positions of the target. Cold path - allocations are fine here.
import { nextInt, type Rng } from '../random'
import type { HackConfig, HackRange } from './types'

export interface HackParams {
  size: number
  codeCount: number
  length: number
  hidden: number
  timeSec: number
  penaltySec: number
}

export interface HackPuzzle {
  size: number
  codes: string[]
  grid: number[]
  target: number[]
  hidden: boolean[]
  solution: number[]
}

export function clampDifficulty(difficulty: number): number {
  if (!(difficulty > 0)) return 0 // also catches NaN
  return difficulty > 1 ? 1 : difficulty
}

function lerp(r: HackRange, d: number): number {
  return r.easy + (r.hard - r.easy) * d
}

/** The puzzle shape for a difficulty (0..1, clamped). */
export function hackParams(difficulty: number, cfg: HackConfig): HackParams {
  const d = clampDifficulty(difficulty)
  const size = Math.max(2, Math.round(lerp(cfg.gridSize, d)))
  const codeCount = Math.max(2, Math.min(cfg.codes.length, Math.round(lerp(cfg.codeCount, d))))
  // length <= size: at most length-1 cells are used when a pick is due, so the active line always has a free cell
  const length = Math.max(1, Math.min(size, Math.round(lerp(cfg.sequenceLength, d))))
  // never the first position, so at most length-1 hidden
  const hidden = Math.max(0, Math.min(length - 1, Math.round(lerp(cfg.hiddenCount, d))))
  return {
    size,
    codeCount,
    length,
    hidden,
    timeSec: Math.max(0, cfg.timeBaseSec + cfg.timePerCodeSec * length + cfg.timePerHiddenSec * hidden),
    penaltySec: Math.max(0, lerp(cfg.mistakePenaltySec, d)),
  }
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i)
    const t = items[i] as T
    items[i] = items[j] as T
    items[j] = t
  }
  return items
}

export function generateHack(rng: Rng, p: HackParams, pool: readonly string[]): HackPuzzle {
  if (pool.length < p.codeCount) throw new Error(`hack: ${p.codeCount} codes wanted, the pool has ${pool.length}`)
  const n = p.size
  const codes = shuffle(rng, pool.slice()).slice(0, p.codeCount)

  // 1. the solution path, following the row/column rule from row 0
  const used = new Array<boolean>(n * n).fill(false)
  const solution: number[] = []
  let lineIsRow = true
  let line = 0
  const free: number[] = []
  for (let i = 0; i < p.length; i++) {
    free.length = 0
    for (let k = 0; k < n; k++) {
      const cell = lineIsRow ? line * n + k : k * n + line
      if (!used[cell]) free.push(cell)
    }
    const cell = free[nextInt(rng, 0, free.length - 1)]
    if (cell === undefined) throw new Error('hack: the solution path dead-ended (length > size?)')
    used[cell] = true
    solution.push(cell)
    line = lineIsRow ? cell % n : Math.floor(cell / n)
    lineIsRow = !lineIsRow
  }

  // 2. the target, written onto the path; 3. the rest of the grid at random
  const target: number[] = []
  const grid = new Array<number>(n * n).fill(0)
  for (let i = 0; i < n * n; i++) grid[i] = nextInt(rng, 0, p.codeCount - 1)
  for (let i = 0; i < p.length; i++) {
    const code = nextInt(rng, 0, p.codeCount - 1)
    target.push(code)
    grid[solution[i] as number] = code
  }

  // 4. hide positions (never the first: row 0 is wide open, a first-position guess would be pure luck)
  const hidden = new Array<boolean>(p.length).fill(false)
  const positions: number[] = []
  for (let i = 1; i < p.length; i++) positions.push(i)
  shuffle(rng, positions)
  for (let i = 0; i < p.hidden; i++) hidden[positions[i] as number] = true

  return { size: n, codes, grid, target, hidden, solution }
}
