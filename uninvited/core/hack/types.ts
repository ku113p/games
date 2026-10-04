// The hacking mini-game (DESIGN.md section 11): the data. Pure, serializable (plain arrays and numbers),
// so a session can live inside the game state and be saved with it.

/** A balance range: the value at difficulty 0 ("easy") and at difficulty 1 ("hard"), linearly in between. */
export interface HackRange {
  easy: number
  hard: number
}

/** Mirrors config.json "hack" (the view's own numbers live under "hack.view" and are not read by the core). */
export interface HackConfig {
  /** The pool of two-character hex codes; a puzzle uses `codeCount` of them. */
  codes: readonly string[]
  /** The grid is size x size. */
  gridSize: HackRange
  /** How many different codes appear in one puzzle. */
  codeCount: HackRange
  /** Length of the target sequence (never more than the grid size, so the cursor can never dead-end). */
  sequenceLength: HackRange
  /** How many positions of the target are hidden ("??"); never the first one. */
  hiddenCount: HackRange
  /** The clock before May's bonus: timeBaseSec + timePerCodeSec * length + timePerHiddenSec * hidden. */
  timeBaseSec: number
  timePerCodeSec: number
  timePerHiddenSec: number
  /** What one mistake costs. */
  mistakePenaltySec: HackRange
}

export type HackStatus = 'running' | 'solved' | 'timedOut'

/** What the last pick did - kept in the session so the view can react without an event bus. */
export interface HackAction {
  /** Bumped on every accepted pick. */
  seq: number
  kind: 'none' | 'correct' | 'wrong'
  row: number
  col: number
  /** The position of the target the pick was for. */
  position: number
  /** correct: the pick guessed a hidden position, which is revealed from now on. */
  revealed: boolean
  /** wrong: the code is now marked under its (hidden) position. */
  marked: boolean
  /** wrong: the time it cost. */
  penaltySec: number
}

export interface HackSession {
  status: HackStatus
  /** The difficulty it was generated with, clamped to 0..1. */
  difficulty: number
  /** The grid is size x size. */
  size: number
  /** The code labels of this puzzle; everything else refers to codes by their index here. */
  codes: string[]
  /** size*size code indices, row-major. */
  grid: number[]
  /** The code index wanted at each position. */
  target: number[]
  /** Per position: it was hidden ("??") when the puzzle started. */
  hidden: boolean[]
  /** Per position: a hidden code the player has guessed right; it stays shown after resets. */
  revealed: boolean[]
  /** Per position: a bitmask of code indices known to be wrong there (marked by mistakes). */
  wrongMarks: number[]
  /** size*size: the position a cell was picked for in the current attempt, -1 when free. */
  pickedAt: number[]
  /** The cell index picked for each position of the current attempt; only [0, progress) is meaningful. */
  path: number[]
  /** How many positions of the target are entered in the current attempt. */
  progress: number
  /** The active line: a row (true) or a column (false), and its index. */
  lineIsRow: boolean
  line: number
  timeLeft: number
  timeTotal: number
  penaltySec: number
  mistakes: number
  /** Bumped on every change except the clock - the view re-renders the grid only when it moves. */
  rev: number
  last: HackAction
  /** The generator's own solution (cell index per position). Never shown; for tests and debugging. */
  solution: number[]
}

export type HackEvent =
  | { type: 'hackCorrect'; row: number; col: number; position: number; revealed: boolean }
  | { type: 'hackWrong'; row: number; col: number; position: number; marked: boolean; penaltySec: number }
  | { type: 'hackReset' }
  | { type: 'hackSolved' }
  | { type: 'hackTimedOut' }
