// Player guidance, the logic only (no DOM, no Three.js, so it is testable): two tiers.
//  1. Contextual prompts: a short non-blocking line ("{E} hack the terminal"). The Prompter shows one at a time; a prompt
//     stays while its situation lasts (no timer), goes away when the player does what it asks (never shown again) or leaves
//     the situation, but not before it has been on screen for a minimum time; each is shown at most a couple of times.
//  2. Tutorial cards: the game pauses for the first meeting with a core mechanic. The Tips object remembers the seen ids
//     (a saved list), queues requests and hands them out one at a time with a pause between cards.
import cfgAll from '../config.json'

export const TIPS_CFG = cfgAll.tips

/** Highest priority first. */
export const PROMPT_IDS = ['terminal', 'redWall', 'camera', 'sensor', 'sound', 'warden', 'cover', 'aim', 'dash'] as const
export type PromptId = (typeof PROMPT_IDS)[number]

export const CARD_IDS = ['quiet', 'netvision', 'hacking', 'alarm', 'aim'] as const
export type CardId = (typeof CARD_IDS)[number]

export interface PrompterConfig {
  /** A prompt stays on screen at least this long (seconds). */
  minSec: number
  /** Each prompt is shown at most this many times. */
  maxShows: number
  /** Pause between one prompt going away and the next one appearing (seconds). */
  gapSec: number
}

export interface Prompter {
  /**
   * One step of dt seconds. `active`: the prompts whose situation holds now. `done`: the prompts whose action the player
   * just did (retired for good). `allowed`: false hides the current prompt at once and holds new ones (menus, hacks, cards).
   * Returns the prompt to show, or null.
   */
  step(dt: number, active: ReadonlySet<string>, done: ReadonlySet<string>, allowed: boolean): string | null
  /** The prompt on screen now (null when none). */
  readonly current: string | null
}

export function createPrompter(cfg: PrompterConfig, order: readonly string[] = PROMPT_IDS): Prompter {
  const shows = new Map<string, number>()
  const retired = new Set<string>()
  let current: string | null = null
  let onScreen = 0
  let gap = 0
  return {
    get current(): string | null {
      return current
    },
    step(dt, active, done, allowed): string | null {
      for (const id of done) retired.add(id)
      if (current !== null) {
        onScreen += dt
        const gone = retired.has(current) || !active.has(current)
        if (!allowed || (gone && onScreen >= cfg.minSec)) {
          current = null
          gap = cfg.gapSec
          return null
        }
      }
      if (current === null) {
        gap -= dt
        if (!allowed || gap > 0) return null
        for (const id of order) {
          if (!active.has(id) || retired.has(id)) continue
          const n = shows.get(id) ?? 0
          if (n >= cfg.maxShows) continue
          shows.set(id, n + 1)
          current = id
          onScreen = 0
          break
        }
      }
      return current
    },
  }
}

/** The settings store the seen cards are saved in (the same one as the settings). */
export interface TipsStore {
  read(slot: string): string | null
  write(slot: string, data: string): boolean
}

export interface Tips {
  /** Card ids the player has met, in the order of CARD_IDS (the Tips list). */
  seen(): CardId[]
  /** Not seen yet, and tips are on. */
  due(id: CardId): boolean
  /** Ask for a card (ignored when seen, queued already, or tips are off). It is handed out by take(). */
  request(id: CardId): void
  /** The next requested card, if the pause since the last one is over: marks it seen and saves. */
  take(): CardId | null
  /** Time passes (call with the unpaused frame time). */
  tick(dt: number): void
  /** The player already did what the card teaches: drop it from the queue and count it as seen (no pause for it, no gap). */
  skip(id: CardId): void
  /** Ask and take now (the caller knows the moment is right): true when the card is to be shown. */
  claim(id: CardId): boolean
}

const SLOT = 'tips'

export function parseSeen(raw: string | null): Set<CardId> {
  const out = new Set<CardId>()
  if (!raw) return out
  try {
    const j = JSON.parse(raw) as unknown
    if (Array.isArray(j)) for (const x of j) if ((CARD_IDS as readonly unknown[]).includes(x)) out.add(x as CardId)
  } catch {
    // an unreadable save: start fresh
  }
  return out
}

export function createTips(store: TipsStore, enabled: () => boolean, gapSec: number = TIPS_CFG.cardGapSec): Tips {
  const seen = parseSeen(store.read(SLOT))
  const queue: CardId[] = []
  let sinceLast = gapSec
  const mark = (id: CardId): void => {
    seen.add(id)
    store.write(SLOT, JSON.stringify(CARD_IDS.filter((c) => seen.has(c))))
    sinceLast = 0
  }
  const due = (id: CardId): boolean => enabled() && !seen.has(id)
  return {
    seen: () => CARD_IDS.filter((c) => seen.has(c)),
    due,
    request(id): void {
      if (due(id) && !queue.includes(id)) queue.push(id)
    },
    take(): CardId | null {
      if (!enabled()) {
        queue.length = 0
        return null
      }
      while (queue.length > 0) {
        const id = queue[0] as CardId
        if (seen.has(id)) {
          queue.shift()
          continue
        }
        if (sinceLast < gapSec) return null
        queue.shift()
        mark(id)
        return id
      }
      return null
    },
    tick(dt): void {
      sinceLast += dt
    },
    skip(id): void {
      const k = queue.indexOf(id)
      if (k >= 0) queue.splice(k, 1)
      if (due(id)) {
        seen.add(id)
        store.write(SLOT, JSON.stringify(CARD_IDS.filter((c) => seen.has(c))))
      }
    },
    claim(id): boolean {
      if (!due(id)) return false
      const k = queue.indexOf(id)
      if (k >= 0) queue.splice(k, 1)
      mark(id)
      return true
    },
  }
}
