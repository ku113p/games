// screens/boost-hint.ts - the one-time "hold to boost" prompt. No DOM: storage, time (dt) and display are passed in from outside
// (model: legal/flow.ts). It shows in every game until the player has actually boosted once, then never again.
//
// Lifetime of the prompt inside a game: it waits `showAfterMs`, then is visible for `visibleMs`, then it is done.
// It is done at once (and never comes back) when the player boosts - someone who already understood is not lectured.
// Pause freezes the clock and hides it; resume brings it back with the time that was left. Anything else that ends the
// game view (death, the demo explainer, leaving to the menu) ends it for good.
//
// "Seen" is written only when the player boosts (any game, button or key). Merely being shown the prompt does not retire it:
// someone who missed the bubble (died in three seconds, looked away) gets it again in the next game.
//
// Hot-path safe: advance() is plain arithmetic, no allocation; the callback fires only on the (rare) visibility change.

export const BOOST_HINT_SEEN_KEY = 'snake:boostHintSeen'

export interface BoostHintStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

export interface BoostHintTiming {
  /** Delay from the start of the game to the prompt (ms of running game time). */
  readonly showAfterMs: number
  /** How long the prompt stays on screen (ms of running game time). */
  readonly visibleMs: number
}

export interface BoostHint {
  /** A game started. The prompt waits for its delay unless the player has already boosted once, ever. */
  begin(): void
  /** Game time passed. Call only while `ticking` (running, not paused). */
  advance(dtMs: number): void
  /** The player boosted (button or key), in any game. */
  boosted(): void
  /** Pause on/off: hides the prompt and freezes the clock; the time that is left survives. */
  setHeld(held: boolean): void
  /** The game view is gone (death, demo explainer, menu): the prompt is finished for this game. */
  end(): void
  /** true while the prompt should be on screen. */
  readonly visible: boolean
  /** true while advance() has work to do; main skips the call otherwise. */
  readonly ticking: boolean
}

type Phase = 'idle' | 'waiting' | 'shown' | 'done'

export function createBoostHint(storage: BoostHintStorage, timing: BoostHintTiming, onVisible: (visible: boolean) => void): BoostHint {
  let seen = storage.get(BOOST_HINT_SEEN_KEY) === '1'
  let phase: Phase = 'idle'
  let held = false
  let clock = 0
  let wasVisible = false

  const markBoosted = (): void => {
    if (seen) return
    seen = true
    storage.set(BOOST_HINT_SEEN_KEY, '1')
  }

  // Tell the outside only when the on-screen state really changes.
  const sync = (): void => {
    const now = phase === 'shown' && !held
    if (now === wasVisible) return
    wasVisible = now
    onVisible(now)
  }

  return {
    begin() {
      phase = seen ? 'idle' : 'waiting'
      held = false
      clock = 0
      sync()
    },
    advance(dtMs) {
      if (held) return
      if (phase === 'waiting') {
        clock += dtMs
        if (clock >= timing.showAfterMs) {
          phase = 'shown'
          clock = 0
        }
      } else if (phase === 'shown') {
        clock += dtMs
        if (clock >= timing.visibleMs) phase = 'done'
      }
      sync()
    },
    boosted() {
      markBoosted()
      if (phase === 'waiting' || phase === 'shown') phase = 'done'
      sync()
    },
    setHeld(value) {
      held = value
      sync()
    },
    end() {
      if (phase === 'waiting' || phase === 'shown') phase = 'done'
      held = false
      sync()
    },
    get visible() {
      return wasVisible
    },
    get ticking() {
      return !held && (phase === 'waiting' || phase === 'shown')
    },
  }
}
