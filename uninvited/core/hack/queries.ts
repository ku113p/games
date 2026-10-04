// Read-only questions to a hack session, for the view and the game. Allocation-free: the view calls them every frame.
import type { HackSession } from './types'

/** The target length. */
export function hackLength(s: HackSession): number {
  return s.target.length
}

/** The code label of a grid cell. */
export function hackCellCode(s: HackSession, row: number, col: number): string {
  return s.codes[s.grid[row * s.size + col] as number] as string
}

/** The code index of a grid cell (to compare with marks). */
export function hackCellCodeIndex(s: HackSession, row: number, col: number): number {
  return s.grid[row * s.size + col] as number
}

/** The position a cell was picked for in the current attempt, or -1 when it is free. */
export function hackCellPickedAt(s: HackSession, row: number, col: number): number {
  return s.pickedAt[row * s.size + col] as number
}

/** Is the cell on the active line (row or column), used or not. */
export function hackIsOnActiveLine(s: HackSession, row: number, col: number): boolean {
  return s.lineIsRow ? row === s.line : col === s.line
}

/** Can this cell be picked right now: running, inside the grid, on the active line and free. */
export function hackIsPickable(s: HackSession, row: number, col: number): boolean {
  if (s.status !== 'running') return false
  if (!(row >= 0 && row < s.size && col >= 0 && col < s.size)) return false
  if (Math.floor(row) !== row || Math.floor(col) !== col) return false
  if (!hackIsOnActiveLine(s, row, col)) return false
  return s.pickedAt[row * s.size + col] === -1
}

/** Is the position hidden right now ("??": hidden at the start and not guessed yet). */
export function hackIsHidden(s: HackSession, position: number): boolean {
  return s.hidden[position] === true && s.revealed[position] !== true
}

/** Was the position hidden at the start (so the view can keep it styled as a guessed slot). */
export function hackWasHidden(s: HackSession, position: number): boolean {
  return s.hidden[position] === true
}

/** The label of a target position as the player sees it: the code, or "??" while hidden. */
export function hackSlotLabel(s: HackSession, position: number, hiddenLabel: string): string {
  if (hackIsHidden(s, position)) return hiddenLabel
  return s.codes[s.target[position] as number] as string
}

/**
 * Is the code index shown at a visible position of the target (one that was never hidden). The generator never puts
 * such a code under a "??", so a player who knows the rule can rule it out for every hidden slot.
 */
export function hackIsShownInTarget(s: HackSession, code: number): boolean {
  for (let i = 0; i < s.target.length; i++) if (s.hidden[i] !== true && s.target[i] === code) return true
  return false
}

/** Is the code index marked as wrong under this position. */
export function hackIsMarkedWrong(s: HackSession, position: number, code: number): boolean {
  return (((s.wrongMarks[position] as number) >> code) & 1) === 1
}

/** How many codes are marked wrong under this position. */
export function hackMarkCount(s: HackSession, position: number): number {
  let m = s.wrongMarks[position] as number
  let count = 0
  while (m) {
    count += m & 1
    m >>>= 1
  }
  return count
}

/** The position the next pick is for (equals the length when solved). */
export function hackPosition(s: HackSession): number {
  return s.progress
}

/** The code label entered at a position in the current attempt, or "" when not entered yet. */
export function hackEnteredLabel(s: HackSession, position: number): string {
  if (position >= s.progress) return ''
  return s.codes[s.grid[s.path[position] as number] as number] as string
}

export function hackTimeLeft(s: HackSession): number {
  return s.timeLeft
}

/** 1 = full clock, 0 = out of time. */
export function hackTimeFraction(s: HackSession): number {
  return s.timeTotal > 0 ? s.timeLeft / s.timeTotal : 0
}

/**
 * A visible position is due and no free cell of the active line has its code: every pick is now a mistake.
 * Never true for a hidden position - that would tell the player the hidden code is not in the line.
 */
export function hackIsDeadEnd(s: HackSession): boolean {
  if (s.status !== 'running') return false
  const position = s.progress
  if (hackIsHidden(s, position)) return false
  const want = s.target[position]
  const n = s.size
  for (let k = 0; k < n; k++) {
    const cell = s.lineIsRow ? s.line * n + k : k * n + s.line
    if (s.pickedAt[cell] === -1 && s.grid[cell] === want) return false
  }
  return true
}
