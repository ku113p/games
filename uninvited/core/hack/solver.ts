// A solver for hack puzzles: a depth-first search along the row/column rule. Used by the tests (every generated
// puzzle is solvable, also after mistakes) and by the balance bot. Cold path.
import { nextInt, type Rng } from '../random'
import type { HackSession } from './types'

interface Search {
  s: HackSession
  used: boolean[]
  path: number[]
  /** true: search with the player's knowledge (a hidden position accepts any code not marked wrong). */
  guess: boolean
  rng: Rng | null
}

function accepts(q: Search, position: number, code: number): boolean {
  const s = q.s
  if (q.guess && s.hidden[position] === true && s.revealed[position] !== true) {
    return (((s.wrongMarks[position] as number) >> code) & 1) === 0
  }
  return code === s.target[position]
}

function dfs(q: Search, position: number, lineIsRow: boolean, line: number): boolean {
  const s = q.s
  if (position === s.target.length) return true
  const n = s.size
  const start = q.rng ? nextInt(q.rng, 0, n - 1) : 0
  for (let j = 0; j < n; j++) {
    const k = (start + j) % n
    const cell = lineIsRow ? line * n + k : k * n + line
    if (q.used[cell] || !accepts(q, position, s.grid[cell] as number)) continue
    q.used[cell] = true
    q.path[position] = cell
    const row = Math.floor(cell / n)
    const col = cell % n
    if (dfs(q, position + 1, !lineIsRow, lineIsRow ? col : row)) return true
    q.used[cell] = false
  }
  return false
}

function search(s: HackSession, fromScratch: boolean, guess: boolean, rng: Rng | null): number[] | null {
  const used = new Array<boolean>(s.size * s.size).fill(false)
  const path = new Array<number>(s.target.length).fill(-1)
  let position = 0
  let lineIsRow = true
  let line = 0
  if (!fromScratch) {
    position = s.progress
    lineIsRow = s.lineIsRow
    line = s.line
    for (let i = 0; i < s.progress; i++) {
      const cell = s.path[i] as number
      used[cell] = true
      path[i] = cell
    }
  }
  const q: Search = { s, used, path, guess, rng }
  return dfs(q, position, lineIsRow, line) ? path : null
}

/**
 * Full knowledge (the real hidden codes): the cells (indices, one per position) that spell the whole target.
 * fromScratch = false continues the current attempt instead (its entered cells stay, the rest is searched).
 * null when there is no way.
 */
export function solveHack(s: HackSession, fromScratch = true): number[] | null {
  return search(s, fromScratch, false, null)
}

/**
 * The player's knowledge: a path from scratch where every visible position matches and every hidden one holds a
 * code that is not marked wrong. With an rng the choice among the possible paths is random.
 */
export function planHack(s: HackSession, rng: Rng | null = null): number[] | null {
  return search(s, true, true, rng)
}
