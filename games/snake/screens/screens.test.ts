import { describe, expect, test } from 'bun:test'
import { TERMS_ACCEPTED_KEY, type LegalStorage } from '../legal/flow'
import { createScreens, isHeld, topScreen, visibleScreens, type ScreenId, type ScreenState } from './screens'

function memory(initial: Record<string, string> = {}): LegalStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) }
}

const accepted = { [TERMS_ACCEPTED_KEY]: '1' }

/** The screens visible now, sorted (order in a Set does not matter). */
function seen(s: ScreenState): ScreenId[] {
  return [...visibleScreens(s)].sort()
}

function fresh(initial: Record<string, string> = accepted) {
  const storage = memory(initial)
  const changes: ScreenState[] = []
  const screens = createScreens(storage, (s) => changes.push(s))
  return { storage, changes, screens }
}

describe('legal screens in the overall flow', () => {
  test('first launch: the warning on top of the menu, then the terms, then a clean menu', () => {
    const { screens, storage } = fresh({})
    screens.start()
    expect(seen(screens.state)).toEqual(['menu', 'warning'])
    expect(topScreen(screens.state)).toBe('warning')
    screens.confirmLegal()
    expect(seen(screens.state)).toEqual(['menu', 'terms'])
    expect(storage.data.get(TERMS_ACCEPTED_KEY)).toBeUndefined() // consent is written on press, not on display
    screens.confirmLegal()
    expect(seen(screens.state)).toEqual(['menu'])
    expect(storage.data.get(TERMS_ACCEPTED_KEY)).toBe('1')
  })

  test('repeat launch: only the warning', () => {
    const { screens } = fresh()
    screens.start()
    expect(seen(screens.state)).toEqual(['menu', 'warning'])
    screens.confirmLegal()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('perf modes: the screens are skipped, consent is not recorded', () => {
    const { screens, storage } = fresh({})
    screens.skipLegal()
    expect(seen(screens.state)).toEqual(['menu'])
    expect(storage.data.size).toBe(0)
  })

  test('under the legal screen settings and records cannot be opened', () => {
    const { screens } = fresh()
    screens.start()
    screens.openSettings()
    screens.openRecords()
    expect(screens.state.base).toBe('menu')
    screens.confirmLegal()
    screens.openSettings()
    expect(screens.state.base).toBe('settings')
  })

  test('confirm before start does not crash and shows nothing', () => {
    const { screens } = fresh()
    screens.confirmLegal() // an extra press before start: no crash
    expect(screens.state.legal).toBeNull()
  })
})

describe('menu, settings, records', () => {
  test('menu -> settings -> back', () => {
    const { screens } = fresh()
    screens.openSettings()
    expect(seen(screens.state)).toEqual(['settings'])
    screens.back()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('menu -> records -> back', () => {
    const { screens } = fresh()
    screens.openRecords()
    expect(seen(screens.state)).toEqual(['records'])
    screens.back()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('from settings you cannot get to records directly, from the menu back leads nowhere', () => {
    const { screens } = fresh()
    screens.openSettings()
    screens.openRecords()
    expect(screens.state.base).toBe('settings')
    screens.back()
    screens.back()
    expect(screens.state.base).toBe('menu')
  })

  test('reopening gives no extra notifications', () => {
    const { screens, changes } = fresh()
    screens.openSettings()
    screens.openSettings()
    screens.back()
    screens.back()
    expect(changes.length).toBe(2)
  })
})

describe('shop', () => {
  test('menu -> shop -> back', () => {
    const { screens } = fresh()
    screens.openShop()
    expect(seen(screens.state)).toEqual(['shop'])
    expect(topScreen(screens.state)).toBe('shop')
    screens.back()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('from the shop "play" starts a game right away, there is no going back to the shop from a game', () => {
    const { screens } = fresh()
    screens.openShop()
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
    screens.back() // Escape in a game must not bring back the shop
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('from the game-over screen to the shop and from there to a new game', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.died()
    screens.openShop()
    expect(seen(screens.state)).toEqual(['shop'])
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('from settings and records the shop does not open directly', () => {
    const { screens } = fresh()
    screens.openSettings()
    screens.openShop()
    expect(screens.state.base).toBe('settings')
    screens.back()
    screens.openRecords()
    screens.openShop()
    expect(screens.state.base).toBe('records')
  })

  test('in a game, on pause and on the demo the shop is unavailable', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.openShop()
    expect(screens.state.base).toBe('game')
    screens.pause()
    screens.openShop()
    expect(screens.state.base).toBe('game')
    screens.resume()
    screens.openDemo()
    screens.openShop()
    expect(screens.state.base).toBe('game')
  })

  test('under the legal screen the shop does not open, after it it does', () => {
    const { screens } = fresh()
    screens.start()
    screens.openShop()
    expect(screens.state.base).toBe('menu')
    expect(seen(screens.state)).toEqual(['menu', 'warning'])
    screens.confirmLegal()
    screens.openShop()
    expect(seen(screens.state)).toEqual(['shop'])
  })

  test('exit to the menu from anywhere closes the shop; reopening makes no noise', () => {
    const { screens, changes } = fresh()
    screens.openShop()
    screens.openShop()
    expect(changes.length).toBe(1)
    screens.toMenu()
    expect(screens.state.base).toBe('menu')
  })
})

describe('game', () => {
  test('start: only the hud is visible; death: only the game-over screen; in the menu: the menu', () => {
    const { screens } = fresh()
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
    screens.died()
    expect(seen(screens.state)).toEqual(['over'])
    screens.startGame() // "Again"
    expect(seen(screens.state)).toEqual(['hud'])
    screens.died()
    screens.toMenu()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('pause: the hud stays, the pause screen on top; resume: back', () => {
    const { screens } = fresh()
    screens.startGame()
    expect(screens.pause()).toBe(true)
    expect(seen(screens.state)).toEqual(['hud', 'pause'])
    expect(isHeld(screens.state)).toBe(true)
    expect(screens.pause()).toBe(false) // a repeated pause does not count
    screens.resume()
    expect(seen(screens.state)).toEqual(['hud'])
    expect(isHeld(screens.state)).toBe(false)
  })

  test('leaving pause to the menu resets the pause', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.pause()
    screens.toMenu()
    expect(screens.state).toEqual({ legal: null, base: 'menu', paused: false, demo: false })
  })

  test('pause outside a game is impossible', () => {
    const { screens } = fresh()
    expect(screens.pause()).toBe(false)
    screens.openSettings()
    expect(screens.pause()).toBe(false)
    screens.back()
    screens.startGame()
    screens.died()
    expect(screens.pause()).toBe(false)
    expect(screens.state.paused).toBe(false)
  })

  test('the demo beats pause: the pause under it is not visible and reappears after it closes', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.openDemo()
    expect(seen(screens.state)).toEqual(['demo', 'hud'])
    expect(screens.pause()).toBe(true)
    expect(seen(screens.state)).toEqual(['demo', 'hud'])
    expect(topScreen(screens.state)).toBe('demo')
    screens.closeDemo()
    expect(seen(screens.state)).toEqual(['hud', 'pause'])
    expect(isHeld(screens.state)).toBe(true)
  })

  test('demo without pause: after it closes the game runs', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.openDemo()
    expect(isHeld(screens.state)).toBe(true)
    screens.closeDemo()
    expect(isHeld(screens.state)).toBe(false)
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('death clears pause and the demo; the demo does not open outside a game', () => {
    const { screens } = fresh()
    screens.openDemo()
    expect(screens.state.demo).toBe(false)
    screens.startGame()
    screens.openDemo()
    screens.pause()
    screens.died()
    expect(screens.state).toEqual({ legal: null, base: 'over', paused: false, demo: false })
  })

  test('a new game does not inherit pause', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.pause()
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('died outside a game is ignored', () => {
    const { screens, changes } = fresh()
    screens.died()
    expect(changes.length).toBe(0)
    expect(screens.state.base).toBe('menu')
  })
})

describe('controls screen', () => {
  test('menu -> controls -> back', () => {
    const { screens } = fresh()
    screens.openControls()
    expect(seen(screens.state)).toEqual(['controls'])
    expect(topScreen(screens.state)).toBe('controls')
    screens.back()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('from settings, records and the shop the controls do not open directly', () => {
    const { screens } = fresh()
    screens.openSettings()
    screens.openControls()
    expect(screens.state.base).toBe('settings')
    screens.back()
    screens.openRecords()
    screens.openControls()
    expect(screens.state.base).toBe('records')
    screens.back()
    screens.openShop()
    screens.openControls()
    expect(screens.state.base).toBe('shop')
  })

  test('from the controls, settings, records and the shop do not open directly either', () => {
    const { screens } = fresh()
    screens.openControls()
    screens.openSettings()
    screens.openRecords()
    screens.openShop()
    expect(screens.state.base).toBe('controls')
  })

  test('in a game, on pause, on the demo and on game over the controls are unavailable', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.openControls()
    expect(screens.state.base).toBe('game')
    screens.pause()
    screens.openControls()
    expect(screens.state.base).toBe('game')
    screens.resume()
    screens.openDemo()
    screens.openControls()
    expect(screens.state.base).toBe('game')
    screens.closeDemo()
    screens.died()
    screens.openControls()
    expect(screens.state.base).toBe('over')
  })

  test('under the legal screen the controls do not open, after it they do; back does nothing under it', () => {
    const { screens } = fresh()
    screens.start()
    screens.openControls()
    expect(screens.state.base).toBe('menu')
    screens.confirmLegal()
    screens.openControls()
    expect(seen(screens.state)).toEqual(['controls'])
  })

  test('a game started from the controls (never offered, but must be safe) hides them; exit to the menu closes them', () => {
    const { screens } = fresh()
    screens.openControls()
    screens.toMenu()
    expect(screens.state.base).toBe('menu')
    screens.openControls()
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('reopening makes no noise; back from the game does not bring the controls back', () => {
    const { screens, changes } = fresh()
    screens.openControls()
    screens.openControls()
    expect(changes.length).toBe(1)
    screens.startGame()
    screens.back()
    expect(seen(screens.state)).toEqual(['hud'])
  })
})

describe('topScreen', () => {
  test('priority: legal > demo > pause > base', () => {
    expect(topScreen({ legal: 'terms', base: 'menu', paused: false, demo: false })).toBe('terms')
    expect(topScreen({ legal: null, base: 'game', paused: true, demo: true })).toBe('demo')
    expect(topScreen({ legal: null, base: 'game', paused: true, demo: false })).toBe('pause')
    expect(topScreen({ legal: null, base: 'game', paused: false, demo: false })).toBe('hud')
    expect(topScreen({ legal: null, base: 'over', paused: false, demo: false })).toBe('over')
    expect(topScreen({ legal: null, base: 'records', paused: false, demo: false })).toBe('records')
    expect(topScreen({ legal: null, base: 'shop', paused: false, demo: false })).toBe('shop')
    expect(topScreen({ legal: null, base: 'controls', paused: false, demo: false })).toBe('controls')
    expect(topScreen({ legal: 'warning', base: 'shop', paused: false, demo: false })).toBe('warning')
  })
})
