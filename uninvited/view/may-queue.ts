// May's line queue and her beep voice, the logic only (no DOM, no audio, no Three.js, so it is testable).
//  - One line at a time. Higher priority first, first come first served among equals. A line holds long enough to read
//    (baseSec + perWordSec per word) and is never cut by the next one; between two lines there is a short gap.
//  - Lines are "once per level" (in memory, forgotten by resetLevel), "once per save" (kept in the store until the save is
//    cleared) or "always". A line counts as said when it starts to show, so one that waited too long and was dropped can come back.
//  - A line waits only while the game is calm ("play"): not in a hack, a menu, a card. Lines marked `end` belong to the end
//    screens and are shown only there. A line that has waited longer than maxWaitSec is dropped (the moment has passed).
//  - The beep voice: one beep per syllable (a vowel group), spaces and punctuation skipped, a short pause at a comma and a longer one at a
//    full stop, a pitch that jitters and falls a little along each sentence: even and cool.
import cfgAll from '../config.json'

export const MAY_CFG = cfgAll.may

export type OnceScope = 'save' | 'level' | 'always'

export interface MayLine {
  id: string
  text: string
  /** Higher goes first. */
  priority: number
  once: OnceScope
  /** Shown over the end screens instead of in play. */
  end?: boolean
  /** Hold time in seconds instead of the reading-time formula (the meeting beat). */
  holdSec?: number
  /** Gap after this line instead of the default. */
  gapSec?: number
}

export interface QueueStore {
  read(slot: string): string | null
  write(slot: string, data: string): boolean
}

export type QueueMode = 'play' | 'end' | 'blocked'

export interface Current {
  line: MayLine
  elapsed: number
  hold: number
}

export interface MayQueue {
  /** Ask for a line. False when it was said already (by its scope), is queued or on screen. */
  say(line: MayLine): boolean
  /** One step of dt real seconds in the given mode. */
  step(dt: number, mode: QueueMode): void
  /** The line on screen or paused mid-way (null when none). */
  readonly current: Readonly<Current> | null
  /** The current line is on screen right now (its mode holds). */
  readonly visible: boolean
  /** Ids waiting, in the order they will be shown. */
  waiting(): string[]
  /** True while a line whose id starts with `prefix` is current or waiting. */
  has(prefix: string): boolean
  /** Drops the current and waiting lines whose id starts with `prefix`. */
  cancel(prefix: string): void
  /** Drops every waiting line except those whose id starts with `keep` (after a death: the old moment is gone). */
  clearWaiting(keep?: string): void
  /** A new run of the level: forget the once-per-level lines and everything queued. */
  resetLevel(): void
  /** The save is cleared (restart, level won): forget the once-per-save lines too. */
  clearSaved(): void
}

/** Reading time of a line: baseSec + perWordSec per word. */
export function holdSec(text: string, perWordSec: number = MAY_CFG.perWordSec, baseSec: number = MAY_CFG.baseSec): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
  return baseSec + perWordSec * words
}

/** The death line: the first death, then every `every`-th one after it (1, 4, 7 ... for every = 3). */
export function deathLineDue(deaths: number, every: number = MAY_CFG.deathEvery): boolean {
  return deaths >= 1 && (deaths - 1) % Math.max(1, every) === 0
}

const SLOT = 'may.said'

function readSaved(store: QueueStore | null, slot: string): Set<string> {
  const out = new Set<string>()
  const raw = store?.read(slot)
  if (!raw) return out
  try {
    const j = JSON.parse(raw) as unknown
    if (Array.isArray(j)) for (const x of j) if (typeof x === 'string') out.add(x)
  } catch {
    // an unreadable save: start fresh
  }
  return out
}

interface Waiting {
  line: MayLine
  age: number
  order: number
}

export function createMayQueue(store: QueueStore | null = null, cfg: typeof MAY_CFG = MAY_CFG, slot: string = SLOT): MayQueue {
  const seenLevel = new Set<string>()
  const seenSave = readSaved(store, slot)
  let list: Waiting[] = []
  let cur: Current | null = null
  let gap = 0
  let seq = 0
  let shown = false
  const persist = (): void => {
    store?.write(slot, JSON.stringify([...seenSave]))
  }
  const fits = (l: MayLine, mode: QueueMode): boolean => (mode === 'end' ? l.end === true : mode === 'play' ? l.end !== true : false)
  return {
    get current(): Readonly<Current> | null {
      return cur
    },
    get visible(): boolean {
      return shown
    },
    say(line): boolean {
      if (cur?.line.id === line.id || list.some((w) => w.line.id === line.id)) return false
      if (line.once === 'level' && seenLevel.has(line.id)) return false
      if (line.once === 'save' && seenSave.has(line.id)) return false
      list.push({ line, age: 0, order: seq++ })
      return true
    },
    step(dt, mode): void {
      shown = false
      if (mode === 'blocked') return
      if (mode === 'play') {
        for (const w of list) w.age += dt
        list = list.filter((w) => w.age <= cfg.maxWaitSec)
      }
      if (cur) {
        if (fits(cur.line, mode)) {
          shown = true
          cur.elapsed += dt
          if (cur.elapsed >= cur.hold) {
            gap = cur.line.gapSec ?? cfg.gapSec
            cur = null
            shown = false
          }
        }
        return
      }
      gap -= dt
      if (gap > 0) return
      let best: Waiting | null = null
      for (const w of list) {
        if (!fits(w.line, mode)) continue
        if (!best || w.line.priority > best.line.priority || (w.line.priority === best.line.priority && w.order < best.order)) best = w
      }
      if (!best) return
      list = list.filter((w) => w !== best)
      const l = best.line
      if (l.once === 'level') seenLevel.add(l.id)
      else if (l.once === 'save') {
        seenSave.add(l.id)
        persist()
      }
      cur = { line: l, elapsed: 0, hold: l.holdSec ?? holdSec(l.text, cfg.perWordSec, cfg.baseSec) }
      shown = true
    },
    waiting: () => [...list].sort((a, b) => b.line.priority - a.line.priority || a.order - b.order).map((w) => w.line.id),
    has: (prefix) => (cur?.line.id.startsWith(prefix) ?? false) || list.some((w) => w.line.id.startsWith(prefix)),
    cancel(prefix): void {
      list = list.filter((w) => !w.line.id.startsWith(prefix))
      if (cur?.line.id.startsWith(prefix)) {
        cur = null
        shown = false
        gap = 0
      }
    },
    clearWaiting(keep): void {
      list = keep === undefined ? [] : list.filter((w) => w.line.id.startsWith(keep))
    },
    resetLevel(): void {
      seenLevel.clear()
      list = []
      cur = null
      shown = false
      gap = 0
    },
    clearSaved(): void {
      seenSave.clear()
      persist()
    },
  }
}

// --- the beep voice ---

export interface Beep {
  /** Seconds from the start of the line. */
  at: number
  /** Playback rate (pitch). */
  rate: number
}

type VoiceCfg = typeof MAY_CFG.voice

/** One beep per syllable with its time and pitch; `duration` is when the last one has ended. */
export function voiceBeeps(text: string, v: VoiceCfg = MAY_CFG.voice, rand: () => number = Math.random): { beeps: Beep[]; duration: number } {
  const beeps: Beep[] = []
  let t = 0
  let sentence = 0
  let prevVowel = false
  const fall = (): void => {
    const n = beeps.length - sentence
    for (let k = 0; k < n; k++) (beeps[sentence + k] as Beep).rate *= 1 - v.stopDrop * ((k + 1) / n)
    sentence = beeps.length
  }
  for (const ch of text) {
    if (ch === "'" || ch === '’') continue // "I'm" is one syllable
    const vowel = /[aeiouyAEIOUY]/.test(ch)
    if (vowel && !prevVowel) {
      beeps.push({ at: t, rate: v.pitch * (1 + (rand() * 2 - 1) * v.pitchJitter) })
      t += v.syllableSec
    }
    prevVowel = vowel
    if (ch === ',' || ch === ';' || ch === ':' || ch === '-') t += v.commaPauseSec
    else if (ch === '.' || ch === '!' || ch === '?') {
      t += v.stopPauseSec
      fall()
    }
  }
  fall()
  return { beeps, duration: t }
}
