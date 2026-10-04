// The hacking mini-game's commands (DESIGN.md section 11). They mutate the session in place and return events.
//
// The rules as built:
// - Pick cells alternately along a row and a column: the first pick is any free cell of row 0, then the column of the
//   last pick, then the row of the last pick, and so on. A cell picked in this attempt cannot be picked again.
// - Every pick is checked against the target at once. The right code fills the next position.
// - A wrong code is a mistake: it costs `penaltySec`, and the attempt resets - every cell is free again and the cursor
//   goes back to row 0. If the position was hidden, the wrong code is marked under it and stays marked.
//   Guessing a hidden position right reveals it for good (it stays shown after later resets).
// - Because a reset restores the whole grid, the generator's solution stays available after any number of mistakes,
//   and because the sequence is never longer than the grid, the active line always has a free cell to pick.
// - The clock runs from the start; when it reaches zero (or a penalty takes it there) the session is timedOut.
import type { Rng } from '../random'
import { generateHack, hackParams } from './generate'
import { hackIsPickable } from './queries'
import type { HackConfig, HackEvent, HackSession } from './types'

const NONE: readonly HackEvent[] = []
const TIMED_OUT: readonly HackEvent[] = [{ type: 'hackTimedOut' }]

/** A new session with a freshly generated puzzle. The clock starts at once. */
export function startHack(rng: Rng, difficulty: number, timeBonusSec: number, cfg: HackConfig): HackSession {
  const p = hackParams(difficulty, cfg)
  const puzzle = generateHack(rng, p, cfg.codes)
  const cells = puzzle.size * puzzle.size
  const timeTotal = p.timeSec + Math.max(0, timeBonusSec || 0)
  return {
    status: 'running',
    difficulty: difficulty > 0 ? Math.min(1, difficulty) : 0,
    size: puzzle.size,
    codes: puzzle.codes,
    grid: puzzle.grid,
    target: puzzle.target,
    hidden: puzzle.hidden,
    revealed: new Array<boolean>(p.length).fill(false),
    wrongMarks: new Array<number>(p.length).fill(0),
    pickedAt: new Array<number>(cells).fill(-1),
    path: new Array<number>(p.length).fill(-1),
    progress: 0,
    lineIsRow: true,
    line: 0,
    timeLeft: timeTotal,
    timeTotal,
    penaltySec: p.penaltySec,
    mistakes: 0,
    rev: 0,
    last: { seq: 0, kind: 'none', row: -1, col: -1, position: -1, revealed: false, marked: false, penaltySec: 0 },
    solution: puzzle.solution,
  }
}

/** Frees every cell and sends the cursor back to row 0. Marks and revealed codes stay. */
function resetAttempt(s: HackSession): void {
  for (let i = 0; i < s.progress; i++) {
    const cell = s.path[i] as number
    s.pickedAt[cell] = -1
    s.path[i] = -1
  }
  s.progress = 0
  s.lineIsRow = true
  s.line = 0
}

/** Pick a cell. A cell outside the active line, an already used one, or a pick after the end does nothing. */
export function hackPick(s: HackSession, row: number, col: number): readonly HackEvent[] {
  if (!hackIsPickable(s, row, col)) return NONE
  const cell = row * s.size + col
  const position = s.progress
  const code = s.grid[cell] as number
  const hiddenNow = s.hidden[position] === true && s.revealed[position] !== true
  const last = s.last
  last.seq++
  last.row = row
  last.col = col
  last.position = position
  last.revealed = false
  last.marked = false
  last.penaltySec = 0
  s.rev++

  if (code === s.target[position]) {
    last.kind = 'correct'
    s.pickedAt[cell] = position
    s.path[position] = cell
    s.progress++
    if (hiddenNow) {
      s.revealed[position] = true
      last.revealed = true
    }
    if (s.lineIsRow) s.line = col
    else s.line = row
    s.lineIsRow = !s.lineIsRow
    const events: HackEvent[] = [{ type: 'hackCorrect', row, col, position, revealed: last.revealed }]
    if (s.progress === s.target.length) {
      s.status = 'solved'
      events.push({ type: 'hackSolved' })
    }
    return events
  }

  last.kind = 'wrong'
  if (hiddenNow) {
    s.wrongMarks[position] = (s.wrongMarks[position] as number) | (1 << code)
    last.marked = true
  }
  const penalty = Math.min(s.penaltySec, s.timeLeft)
  last.penaltySec = penalty
  s.timeLeft -= penalty
  s.mistakes++
  resetAttempt(s)
  const events: HackEvent[] = [
    { type: 'hackWrong', row, col, position, marked: last.marked, penaltySec: penalty },
    { type: 'hackReset' },
  ]
  if (s.timeLeft <= 0) {
    s.timeLeft = 0
    s.status = 'timedOut'
    events.push({ type: 'hackTimedOut' })
  }
  return events
}

/** Runs the clock. Every frame while the mini-game is open; allocation-free (shared, read-only event arrays). */
export function hackTick(s: HackSession, dtSec: number): readonly HackEvent[] {
  if (s.status !== 'running' || !(dtSec > 0)) return NONE
  s.timeLeft -= dtSec
  if (s.timeLeft > 0) return NONE
  s.timeLeft = 0
  s.status = 'timedOut'
  s.rev++
  return TIMED_OUT
}
