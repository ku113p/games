// legal/flow.ts — the order of the legal screens and the memory of consent. No DOM: storage and display are passed in from outside.
// Order: the flashing-lights warning (on EVERY open) -> the terms (only while consent is not saved) -> the menu.

export const TERMS_ACCEPTED_KEY = 'snake:termsAccepted'

export type LegalStep = 'warning' | 'terms'

export interface LegalStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

/** The terms are needed while there is no saved consent: first launch, reset storage, unavailable storage. */
export function needsTerms(storage: LegalStorage): boolean {
  return storage.get(TERMS_ACCEPTED_KEY) !== '1'
}

/** The screens to show in this launch, in order. The warning is always there. */
export function legalSteps(storage: LegalStorage): LegalStep[] {
  return needsTerms(storage) ? ['warning', 'terms'] : ['warning']
}

export interface LegalFlow {
  /** Shows the first screen. */
  start(): void
  /** The current screen's button is pressed: accept the terms (if that is what it is) and move on or finish. */
  confirm(): void
  /** Debug mode: the screens are not shown, consent is not recorded, so on a normal launch the player sees them as usual. */
  skipAll(): void
}

/**
  * show(step) shows a screen; show(null) means all are passed, the menu can open.
  * Consent is written at the moment "Accept" is pressed, not on display: close the tab on the terms screen and they show again.
 */
export function createLegalFlow(storage: LegalStorage, show: (step: LegalStep | null) => void): LegalFlow {
  let queue: LegalStep[] = []
  let current: LegalStep | null = null
  const next = (): void => {
    current = queue.shift() ?? null
    show(current)
  }
  return {
    start() {
      queue = legalSteps(storage)
      next()
    },
    confirm() {
      if (current === null) return
      if (current === 'terms') storage.set(TERMS_ACCEPTED_KEY, '1')
      next()
    },
    skipAll() {
      queue = []
      current = null
      show(null)
    },
  }
}

/**
  * Debug is on via the ?perf parameter (?perf=bench, ?perf=freeze); ?perf=0 and ?perf=false turn it off.
  * One condition for both the debug panel and skipping the legal screens: they must not diverge.
 */
export function isPerfDebugRequested(search: string): boolean {
  const p = new URLSearchParams(search).get('perf')
  return p !== null && p !== '0' && p !== 'false'
}

/**
  * The mode starts the measurement itself half a second after load: ?perf=bench and ?perf=freeze. Only then are the legal
  * screens skipped: an opaque screen over the canvas would spoil the numbers. A plain ?perf starts nothing,
  * there the flashing-lights warning shows as usual.
 */
export function isSelfStartingPerfMode(search: string): boolean {
  const p = new URLSearchParams(search).get('perf')
  return p === 'bench' || p === 'freeze'
}
