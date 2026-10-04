import { describe, expect, test } from 'bun:test'
import { createRng, nextInt, type Rng } from '../random'
import {
  hackIsDeadEnd,
  hackIsHidden,
  hackIsMarkedWrong,
  hackIsPickable,
  hackIsShownInTarget,
  hackParams,
  hackPick,
  hackTick,
  planHack,
  solveHack,
  startHack,
  type HackConfig,
  type HackEvent,
  type HackSession,
} from './index'

// The core never reads files: a copy of config.json "hack" (the generator clamps any config into a solvable shape,
// see 'any config stays solvable' below, so the real numbers cannot break the guarantee).
const cfg: HackConfig = {
  codes: ['1C', 'BD', '55', 'E9', '7A', 'FF'],
  gridSize: { easy: 5, hard: 7 },
  codeCount: { easy: 5, hard: 5 },
  sequenceLength: { easy: 3, hard: 6 },
  hiddenCount: { easy: 1, hard: 2 },
  timeBaseSec: 15,
  timePerCodeSec: 4,
  timePerHiddenSec: 18,
  mistakePenaltySec: { easy: 5, hard: 7 },
}
const NO_CLOCK = 1e9 // a time bonus big enough that the clock never matters

function rc(s: HackSession, cell: number): [number, number] {
  return [Math.floor(cell / s.size), cell % s.size]
}

function pickCell(s: HackSession, cell: number): readonly HackEvent[] {
  const [r, c] = rc(s, cell)
  return hackPick(s, r, c)
}

function pickableCells(s: HackSession): number[] {
  const out: number[] = []
  for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) if (hackIsPickable(s, r, c)) out.push(r * s.size + c)
  return out
}

/** Plays a full-knowledge solution from scratch; true when it ends solved. */
function playSolution(s: HackSession): boolean {
  const path = solveHack(s)
  if (!path) return false
  for (const cell of path) pickCell(s, cell)
  return s.status === 'solved'
}

/** A wrong cell in the active line, or -1. */
function wrongCell(s: HackSession): number {
  for (const cell of pickableCells(s)) if (s.grid[cell] !== s.target[s.progress]) return cell
  return -1
}

/** Checks the session's invariants that must hold after every command. */
function checkInvariants(s: HackSession): void {
  const n = s.size
  let used = 0
  for (const p of s.pickedAt) if (p >= 0) used++
  expect(used).toBe(s.progress)
  for (let i = 0; i < s.progress; i++) {
    expect(s.pickedAt[s.path[i] as number]).toBe(i)
    expect(s.grid[s.path[i] as number]).toBe(s.target[i] as number)
  }
  for (let i = 0; i < s.target.length; i++) {
    // a mark is never the true code, and marks only ever sit under hidden positions
    expect(hackIsMarkedWrong(s, i, s.target[i] as number)).toBe(false)
    if (!s.hidden[i]) expect(s.wrongMarks[i]).toBe(0)
  }
  if (s.status === 'running') {
    // the cursor never dead-ends: the active line always has a free cell
    expect(pickableCells(s).length).toBeGreaterThan(0)
    expect(s.line >= 0 && s.line < n).toBe(true)
  }
}

describe('hack: difficulty', () => {
  test('the puzzle grows with difficulty and stays within the rules', () => {
    let prev = hackParams(0, cfg)
    for (let i = 0; i <= 20; i++) {
      const p = hackParams(i / 20, cfg)
      expect(p.size).toBeGreaterThanOrEqual(prev.size)
      expect(p.length).toBeGreaterThanOrEqual(prev.length)
      expect(p.hidden).toBeGreaterThanOrEqual(prev.hidden)
      expect(p.length).toBeLessThanOrEqual(p.size)
      expect(p.hidden).toBeGreaterThanOrEqual(1)
      expect(p.hidden).toBeLessThanOrEqual(2)
      expect(p.hidden).toBeLessThan(p.length)
      expect(p.codeCount).toBeLessThanOrEqual(cfg.codes.length)
      prev = p
    }
  })
  test('any config stays solvable: lengths beyond the grid and too many hidden codes are clamped', () => {
    const wild: HackConfig = {
      ...cfg,
      codes: ['AA', 'BB'],
      gridSize: { easy: 3, hard: 4 },
      codeCount: { easy: 9, hard: 9 },
      sequenceLength: { easy: 8, hard: 12 },
      hiddenCount: { easy: 5, hard: 9 },
    }
    for (let seed = 1; seed <= 500; seed++) {
      const d = (seed % 5) / 4
      const p = hackParams(d, wild)
      expect(p.length).toBeLessThanOrEqual(p.size)
      expect(p.hidden).toBeLessThan(p.length)
      expect(p.codeCount).toBe(2)
      const s = startHack(createRng(seed), d, NO_CLOCK, wild)
      expect(playSolution(s)).toBe(true)
    }
  })
  test('out-of-range difficulty is clamped', () => {
    expect(hackParams(-3, cfg)).toEqual(hackParams(0, cfg))
    expect(hackParams(Number.NaN, cfg)).toEqual(hackParams(0, cfg))
    expect(hackParams(7, cfg)).toEqual(hackParams(1, cfg))
  })
  test('the clock: 45 s at the easiest, 75 s at the hardest (the designer chose the first build\'s clock; May\'s upgrades add time), growing in between', () => {
    expect(hackParams(0, cfg).timeSec).toBe(45)
    expect(hackParams(1, cfg).timeSec).toBe(75)
    let prev = 0
    for (let i = 0; i <= 20; i++) {
      const t = hackParams(i / 20, cfg).timeSec
      expect(t).toBeGreaterThanOrEqual(prev)
      expect(t >= 45 && t <= 75).toBe(true)
      prev = t
    }
  })
  test("May's bonus adds time", () => {
    const a = startHack(createRng(5), 0.5, 0, cfg)
    const b = startHack(createRng(5), 0.5, 12, cfg)
    expect(b.timeTotal).toBe(a.timeTotal + 12)
    expect(b.timeLeft).toBe(b.timeTotal)
  })
  test('the same seed gives the same puzzle', () => {
    const a = startHack(createRng(99), 0.7, 0, cfg)
    const b = startHack(createRng(99), 0.7, 0, cfg)
    expect(b.grid).toEqual(a.grid)
    expect(b.target).toEqual(a.target)
    expect(b.hidden).toEqual(a.hidden)
  })
})

describe('hack: the generator', () => {
  test('10 000 seeds across difficulties: well formed and solvable', () => {
    for (let seed = 1; seed <= 10000; seed++) {
      const d = (seed % 11) / 10
      const s = startHack(createRng(seed), d, 0, cfg)
      const p = hackParams(d, cfg)
      expect(s.size).toBe(p.size)
      expect(s.target.length).toBe(p.length)
      expect(s.hidden.filter(Boolean).length).toBe(p.hidden)
      expect(s.hidden[0]).toBe(false)
      expect(new Set(s.codes).size).toBe(p.codeCount)
      for (const code of s.grid) expect(code >= 0 && code < p.codeCount).toBe(true)
      // the generator's own path is valid ...
      const sol = s.solution
      expect(new Set(sol).size).toBe(p.length)
      expect(Math.floor((sol[0] as number) / s.size)).toBe(0)
      for (let i = 0; i < sol.length; i++) {
        expect(s.grid[sol[i] as number]).toBe(s.target[i] as number)
        if (i > 0) {
          const [r0, c0] = rc(s, sol[i - 1] as number)
          const [r1, c1] = rc(s, sol[i] as number)
          // odd steps move along the column of the previous pick, even steps along its row
          if (i % 2 === 1) expect(c1).toBe(c0)
          else expect(r1).toBe(r0)
        }
      }
      // a "??" never hides a code shown at a visible position of the same target
      for (let i = 0; i < s.target.length; i++) {
        if (!s.hidden[i]) continue
        for (let j = 0; j < s.target.length; j++) if (!s.hidden[j]) expect(s.target[i]).not.toBe(s.target[j] as number)
      }
      // ... and the independent solver agrees it is solvable, and so does a player who has to guess
      expect(solveHack(s)).not.toBeNull()
      expect(planHack(s)).not.toBeNull()
    }
  })

  test('the "??" rule: a hidden code is never a visible code nor another hidden one, also when the visible ones use every code', () => {
    // the real config (5 codes, at most 4 visible) and a tight one where the visible positions could cover every code
    const tight: HackConfig = {
      ...cfg,
      codes: ['AA', 'BB', 'CC'],
      gridSize: { easy: 6, hard: 7 },
      codeCount: { easy: 3, hard: 3 },
      sequenceLength: { easy: 6, hard: 7 },
      hiddenCount: { easy: 1, hard: 2 },
    }
    let notFull = 0
    for (const c of [cfg, tight]) {
      for (let seed = 1; seed <= 10000; seed++) {
        const d = (seed % 11) / 10
        const s = startHack(createRng(seed), d, 0, c)
        let shown = 0
        for (let i = 0; i < s.target.length; i++) if (!s.hidden[i]) shown |= 1 << (s.target[i] as number)
        for (let i = 0; i < s.target.length; i++) {
          const code = s.target[i] as number
          expect(hackIsShownInTarget(s, code)).toBe(!s.hidden[i])
        }
        // the designer: hidden positions differ from each other too (if one "??" was 55, the next is not 55)
        const hiddenCodes = s.target.filter((_, i) => s.hidden[i])
        expect(new Set(hiddenCodes).size).toBe(hiddenCodes.length)
        if (c === tight && shown !== (1 << s.codes.length) - 1) notFull++
        expect(solveHack(s)).not.toBeNull()
        expect(planHack(s)).not.toBeNull()
      }
    }
    expect(notFull).toBe(10000) // the tight config always leaves at least one code free for the hidden slots
  })

  test('still solvable after random sequences of mistakes (2 000 seeds)', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const d = (seed % 11) / 10
      const s = startHack(createRng(seed), d, NO_CLOCK, cfg)
      const chaos: Rng = createRng(seed * 31 + 7)
      const steps = nextInt(chaos, 1, 40)
      for (let k = 0; k < steps && s.status === 'running'; k++) {
        const cells = pickableCells(s)
        // mostly random picks; sometimes a deliberate wrong one to force a reset
        const wrong = wrongCell(s)
        const cell = wrong >= 0 && nextInt(chaos, 0, 3) === 0 ? wrong : (cells[nextInt(chaos, 0, cells.length - 1)] as number)
        pickCell(s, cell)
        checkInvariants(s)
      }
      if (s.status === 'solved') continue
      // force a reset (if the attempt is mid-way), then the full solution must still go through
      if (s.progress > 0) {
        let guard = 0
        while (s.progress > 0 && s.status === 'running' && guard++ < 50) {
          const w = wrongCell(s)
          if (w >= 0) pickCell(s, w)
          else pickCell(s, pickableCells(s)[0] as number) // every free cell is right: go on
        }
      }
      if ((s.status as string) === 'solved') continue
      expect(s.status).toBe('running')
      expect(s.progress).toBe(0)
      expect(playSolution(s)).toBe(true)
    }
  })

  test('a guessing player always finishes (no clock), with a bounded number of mistakes', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const d = (seed % 11) / 10
      const s = startHack(createRng(seed), d, NO_CLOCK, cfg)
      const bot = createRng(seed + 1)
      let guard = 0
      while (s.status === 'running' && guard++ < 100) {
        const plan = planHack(s, bot)
        expect(plan).not.toBeNull()
        for (const cell of plan as number[]) {
          const ev = pickCell(s, cell)
          checkInvariants(s)
          if (ev.some((e) => e.type === 'hackWrong') || s.status !== 'running') break
        }
      }
      expect(s.status).toBe('solved')
      // it plans every visible code right, so it can only miss hidden codes, each code at most once per position -
      // and never a code shown in the target, so per hidden position at most (codes not shown - 1) misses
      let notShown = 0
      for (let code = 0; code < s.codes.length; code++) if (!hackIsShownInTarget(s, code)) notShown++
      const hidden = s.hidden.filter(Boolean).length
      expect(s.mistakes).toBeLessThanOrEqual(hidden * (notShown - 1))
    }
  })
})

describe('hack: picking', () => {
  test('the first pick is in row 0, then the column, then the row, ...', () => {
    const s = startHack(createRng(3), 0.5, 0, cfg)
    const sol = s.solution
    // nothing outside row 0 is pickable at the start
    for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) expect(hackIsPickable(s, r, c)).toBe(r === 0)
    const before = s.rev
    expect(hackPick(s, 1, 0)).toEqual([])
    expect(hackPick(s, -1, 0)).toEqual([])
    expect(hackPick(s, 0, s.size)).toEqual([])
    expect(s.rev).toBe(before)
    const [r0, c0] = rc(s, sol[0] as number)
    expect(hackPick(s, r0, c0)[0]).toMatchObject({ type: 'hackCorrect', row: r0, col: c0, position: 0 })
    // now only the free cells of column c0
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) expect(hackIsPickable(s, r, c)).toBe(c === c0 && !(r === r0 && c === c0))
    // a used cell cannot be picked again
    expect(hackPick(s, r0, c0)).toEqual([])
    const [r1, c1] = rc(s, sol[1] as number)
    const ev = hackPick(s, r1, c1)
    if (s.hidden[1]) expect(ev[0]).toMatchObject({ type: 'hackCorrect', revealed: true })
    else expect(ev[0]).toMatchObject({ type: 'hackCorrect', revealed: false })
    // now the row of that pick
    for (let c = 0; c < s.size; c++) expect(hackIsPickable(s, r1, c)).toBe(c !== c1)
  })

  test('a mistake costs time, resets the attempt and marks the code under a hidden position', () => {
    // find a puzzle whose position 1 is hidden and whose column after the first solution pick has a wrong code
    for (let seed = 1; seed < 500; seed++) {
      const s = startHack(createRng(seed), 0, 0, cfg)
      if (!s.hidden[1]) continue
      pickCell(s, s.solution[0] as number)
      const w = wrongCell(s)
      if (w < 0) continue
      const time = s.timeLeft
      const code = s.grid[w] as number
      const ev = pickCell(s, w)
      expect(ev.map((e) => e.type)).toEqual(['hackWrong', 'hackReset'])
      expect(ev[0]).toMatchObject({ type: 'hackWrong', position: 1, marked: true, penaltySec: s.penaltySec })
      expect(s.timeLeft).toBeCloseTo(time - s.penaltySec, 9)
      expect(s.mistakes).toBe(1)
      expect(s.progress).toBe(0)
      expect(s.lineIsRow).toBe(true)
      expect(s.line).toBe(0)
      expect(s.pickedAt.every((p) => p === -1)).toBe(true)
      expect(hackIsMarkedWrong(s, 1, code)).toBe(true)
      expect(s.last).toMatchObject({ kind: 'wrong', position: 1, marked: true })
      // the mark survives a correct run up to it, and guessing right reveals the position for good
      expect(hackIsHidden(s, 1)).toBe(true)
      pickCell(s, s.solution[0] as number)
      expect(pickCell(s, s.solution[1] as number)[0]).toMatchObject({ type: 'hackCorrect', revealed: true })
      expect(hackIsHidden(s, 1)).toBe(false)
      const w2 = wrongCell(s)
      if (w2 >= 0) {
        pickCell(s, w2)
        expect(s.progress).toBe(0)
        expect(hackIsHidden(s, 1)).toBe(false) // revealed stays revealed after a reset
        expect(hackIsMarkedWrong(s, 1, code)).toBe(true)
      }
      return
    }
    throw new Error('no suitable seed found')
  })

  test('a mistake on a visible position marks nothing', () => {
    for (let seed = 1; seed < 500; seed++) {
      const s = startHack(createRng(seed), 0, 0, cfg)
      const w = wrongCell(s) // position 0 is never hidden
      if (w < 0) continue
      const ev = pickCell(s, w)
      expect(ev[0]).toMatchObject({ type: 'hackWrong', position: 0, marked: false })
      expect(s.wrongMarks.every((m) => m === 0)).toBe(true)
      return
    }
    throw new Error('no suitable seed found')
  })

  test('the dead-end hint: only for a visible position with no matching free cell', () => {
    let seen = 0
    for (let seed = 1; seed < 3000 && seen < 50; seed++) {
      const s = startHack(createRng(seed), 1, NO_CLOCK, cfg)
      const chaos = createRng(seed)
      for (let k = 0; k < 6 && s.status === 'running'; k++) {
        const pos = s.progress
        const dead = hackIsDeadEnd(s)
        if (hackIsHidden(s, pos)) expect(dead).toBe(false)
        else expect(dead).toBe(!pickableCells(s).some((cell) => s.grid[cell] === s.target[pos]))
        if (dead) seen++
        const cells = pickableCells(s).filter((cell) => s.grid[cell] === s.target[pos] || hackIsHidden(s, pos))
        if (cells.length === 0) break
        pickCell(s, cells[nextInt(chaos, 0, cells.length - 1)] as number)
      }
    }
    expect(seen).toBeGreaterThan(0)
  })
})

describe('hack: the clock', () => {
  test('time runs out -> timedOut, once', () => {
    const s = startHack(createRng(11), 0.3, 0, cfg)
    const total = s.timeTotal
    expect(hackTick(s, total / 2)).toEqual([])
    expect(s.timeLeft).toBeCloseTo(total / 2, 9)
    expect(hackTick(s, total)).toEqual([{ type: 'hackTimedOut' }])
    expect(s.status).toBe('timedOut')
    expect(s.timeLeft).toBe(0)
    expect(hackTick(s, 1)).toEqual([])
    expect(pickCell(s, s.solution[0] as number)).toEqual([])
  })
  test('a penalty that empties the clock times out at once', () => {
    for (let seed = 1; seed < 500; seed++) {
      const s = startHack(createRng(seed), 0, 0, cfg)
      const w = wrongCell(s)
      if (w < 0) continue
      hackTick(s, s.timeTotal - s.penaltySec / 2)
      const ev = pickCell(s, w)
      expect(ev.map((e) => e.type)).toEqual(['hackWrong', 'hackReset', 'hackTimedOut'])
      expect(s.status).toBe('timedOut')
      expect(s.timeLeft).toBe(0)
      return
    }
    throw new Error('no suitable seed found')
  })
  test('hackTick does not allocate: the same arrays every frame', () => {
    const s = startHack(createRng(12), 0.3, 0, cfg)
    expect(hackTick(s, 0.016)).toBe(hackTick(s, 0.016))
    expect(hackTick(s, 0)).toBe(hackTick(s, Number.NaN))
  })
})

describe('hack: solved', () => {
  test('building the whole sequence solves it and stops the clock', () => {
    const s = startHack(createRng(21), 1, 0, cfg)
    const path = solveHack(s) as number[]
    const types: string[] = []
    for (const cell of path) for (const e of pickCell(s, cell)) types.push(e.type)
    expect(types.at(-1)).toBe('hackSolved')
    expect(types.filter((t) => t === 'hackCorrect').length).toBe(s.target.length)
    expect(s.status).toBe('solved')
    const left = s.timeLeft
    expect(hackTick(s, 100)).toEqual([])
    expect(s.timeLeft).toBe(left)
    for (let i = 0; i < s.target.length; i++) expect(hackIsHidden(s, i)).toBe(false)
  })
})
