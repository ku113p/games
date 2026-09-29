// screens/screens.ts — "which screen is shown right now". No DOM: the display and storage are passed in from outside (model: legal/flow.ts).
// One source of truth instead of a scatter of classList.add/remove in main.ts.
//
// Model: the legal screen (lies on top of everything) -> the base screen (menu, settings, records, game, game over)
// -> in a game there are two more independent reasons to stand still: pause and the demo turn explainer. The explainer beats pause:
// while it is open the pause screen is not shown, and after it closes the pause (if there was one) reappears by itself.

import { createLegalFlow, type LegalStep, type LegalStorage } from '../legal/flow'

export type BaseScreen = 'menu' | 'settings' | 'records' | 'shop' | 'game' | 'over'

/** Everything that can be visible on screen. `hud` is the score and the game's controls. */
export type ScreenId = 'warning' | 'terms' | 'menu' | 'settings' | 'records' | 'shop' | 'hud' | 'over' | 'pause' | 'demo'

export const ALL_SCREENS: readonly ScreenId[] = ['warning', 'terms', 'menu', 'settings', 'records', 'shop', 'hud', 'over', 'pause', 'demo']

export interface ScreenState {
  /** The legal screen on top of everything; null once passed (or skipped). */
  readonly legal: LegalStep | null
  readonly base: BaseScreen
  /** The game is paused (tab hidden or a button). Only meaningful when base === 'game'. */
  readonly paused: boolean
  /** The demo turn explainer is open. Only meaningful when base === 'game'. */
  readonly demo: boolean
}

/** Which screens are visible in this state. Under the legal screen the base one stays (it is opaque and covers it). */
export function visibleScreens(s: ScreenState): ReadonlySet<ScreenId> {
  const out = new Set<ScreenId>()
  if (s.base === 'game') {
    out.add('hud')
    if (s.demo) out.add('demo')
    else if (s.paused) out.add('pause')
  } else if (s.base === 'over') {
    out.add('over')
  } else {
    out.add(s.base)
  }
  if (s.legal !== null) out.add(s.legal)
  return out
}

/** The screen that catches input right now: legal, otherwise an overlay, otherwise the base one. */
export function topScreen(s: ScreenState): ScreenId {
  if (s.legal !== null) return s.legal
  if (s.base === 'game') return s.demo ? 'demo' : s.paused ? 'pause' : 'hud'
  return s.base === 'over' ? 'over' : s.base
}

/** Game logic stands still: pause or the explainer. (The benchmark freezes logic separately, in main.ts.) */
export function isHeld(s: ScreenState): boolean {
  return s.paused || s.demo
}

export interface Screens {
  readonly state: ScreenState
  /** Show the legal screens, then the menu. */
  start(): void
  /** Debug (?perf=bench, ?perf=freeze): the legal screens are not shown. */
  skipLegal(): void
  /** The legal screen button: accept/got it and move on. */
  confirmLegal(): void
  openSettings(): void
  openRecords(): void
  /** The shop: from the menu or the game-over screen ("To the shop"). Not under the legal screen, in a game or on pause. */
  openShop(): void
  /** From settings, records or the shop, back to the menu. */
  back(): void
  /** A game started (from the menu, "Again", the benchmark): resets pause and the explainer. */
  startGame(): void
  /** The snake died: the game-over screen. Does nothing outside a game. */
  died(): void
  /** To the menu from anywhere (from pause, from game over, from the benchmark). */
  toMenu(): void
  /** true if pause actually turned on (not in a game or already paused: false). */
  pause(): boolean
  resume(): void
  openDemo(): void
  closeDemo(): void
}

/** onChange is called on every state change (not called if nothing changed). */
export function createScreens(storage: LegalStorage, onChange: (s: ScreenState) => void): Screens {
  let st: ScreenState = { legal: null, base: 'menu', paused: false, demo: false }

  const set = (patch: Partial<{ -readonly [K in keyof ScreenState]: ScreenState[K] }>): void => {
    const next = { ...st, ...patch }
    if (next.legal === st.legal && next.base === st.base && next.paused === st.paused && next.demo === st.demo) return
    st = next
    onChange(st)
  }

  const legal = createLegalFlow(storage, (step) => set({ legal: step }))

  return {
    get state() {
      return st
    },
    start() {
      // From the menu, even if someone has already changed it: the legal screens open the menu.
      legal.start()
    },
    skipLegal() {
      legal.skipAll()
    },
    confirmLegal() {
      legal.confirm()
    },
    openSettings() {
      if (st.legal === null && st.base === 'menu') set({ base: 'settings' })
    },
    openRecords() {
      if (st.legal === null && st.base === 'menu') set({ base: 'records' })
    },
    openShop() {
      if (st.legal === null && (st.base === 'menu' || st.base === 'over')) set({ base: 'shop' })
    },
    back() {
      if (st.legal === null && (st.base === 'settings' || st.base === 'records' || st.base === 'shop')) set({ base: 'menu' })
    },
    startGame() {
      set({ base: 'game', paused: false, demo: false })
    },
    died() {
      if (st.base === 'game') set({ base: 'over', paused: false, demo: false })
    },
    toMenu() {
      set({ base: 'menu', paused: false, demo: false })
    },
    pause() {
      if (st.base !== 'game' || st.paused) return false
      set({ paused: true })
      return true
    },
    resume() {
      if (st.paused) set({ paused: false })
    },
    openDemo() {
      if (st.base === 'game') set({ demo: true })
    },
    closeDemo() {
      if (st.demo) set({ demo: false })
    },
  }
}
