import { describe, expect, test } from 'bun:test'
import { BOOST_HINT_SEEN_KEY, createBoostHint } from './boost-hint'

const timing = { showAfterMs: 600, visibleMs: 4000 }

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { data, get: (k: string) => data.get(k) ?? null, set: (k: string, v: string) => void data.set(k, v) }
}

function setup(initial: Record<string, string> = {}) {
  const storage = memory(initial)
  const calls: boolean[] = []
  const hint = createBoostHint(storage, timing, (v) => calls.push(v))
  return { storage, calls, hint }
}

describe('lifetime inside a game', () => {
  test('waits, shows, hides on its own', () => {
    const { hint, calls } = setup()
    hint.begin()
    expect(hint.visible).toBe(false)
    expect(hint.ticking).toBe(true)
    hint.advance(599)
    expect(hint.visible).toBe(false)
    hint.advance(1)
    expect(hint.visible).toBe(true)
    hint.advance(3999)
    expect(hint.visible).toBe(true)
    hint.advance(1)
    expect(hint.visible).toBe(false)
    expect(hint.ticking).toBe(false)
    expect(calls).toEqual([true, false]) // two notifications, not one per frame
  })

  test('being shown does not write the "seen" flag: only boosting does', () => {
    const { hint, storage } = setup()
    hint.begin()
    hint.advance(700)
    expect(hint.visible).toBe(true)
    expect(storage.data.get(BOOST_HINT_SEEN_KEY)).toBeUndefined()
    hint.boosted()
    expect(storage.data.get(BOOST_HINT_SEEN_KEY)).toBe('1')
  })

  test('a long frame does not skip it: the time is summed, one frame past the delay is enough', () => {
    const { hint } = setup()
    hint.begin()
    hint.advance(5000)
    expect(hint.visible).toBe(true)
  })
})

describe('until the player has boosted once', () => {
  test('a first game that ends with no boost: the second game shows the prompt again', () => {
    const { hint, calls } = setup()
    hint.begin()
    hint.advance(700)
    expect(hint.visible).toBe(true)
    hint.advance(4000) // it timed out unnoticed
    hint.end() // died without boosting
    hint.begin() // second game
    expect(hint.ticking).toBe(true)
    hint.advance(599)
    expect(hint.visible).toBe(false)
    hint.advance(1)
    expect(hint.visible).toBe(true)
    expect(calls).toEqual([true, false, true])
  })

  test('the same after a reload: nothing was stored, the prompt comes back', () => {
    const { hint, storage } = setup()
    hint.begin()
    hint.advance(700)
    hint.end()
    const again = createBoostHint(storage, timing, () => {})
    again.begin()
    again.advance(700)
    expect(again.visible).toBe(true)
  })

  test('once the player has boosted, no later game and no reload shows it', () => {
    const { hint, storage } = setup()
    hint.begin()
    hint.advance(1000)
    hint.boosted()
    hint.end()
    hint.begin()
    expect(hint.ticking).toBe(false)
    hint.advance(10_000)
    expect(hint.visible).toBe(false)
    const again = createBoostHint(storage, timing, () => {})
    again.begin()
    expect(again.ticking).toBe(false)
  })

  test('a stored "seen" flag from an earlier version keeps it off', () => {
    const { hint } = setup({ [BOOST_HINT_SEEN_KEY]: '1' })
    hint.begin()
    hint.advance(10_000)
    expect(hint.visible).toBe(false)
  })

  test('dying before it appeared does not burn it: the next game still shows it', () => {
    const { hint } = setup()
    hint.begin()
    hint.advance(200)
    hint.end()
    hint.begin()
    hint.advance(700)
    expect(hint.visible).toBe(true)
  })
})

describe('boosting', () => {
  test('boosting while it is on screen hides it at once and it stays gone', () => {
    const { hint, calls } = setup()
    hint.begin()
    hint.advance(1000)
    expect(hint.visible).toBe(true)
    hint.boosted()
    expect(hint.visible).toBe(false)
    expect(hint.ticking).toBe(false)
    hint.advance(100)
    expect(hint.visible).toBe(false)
    expect(calls).toEqual([true, false])
  })

  test('boosting before it appeared: it never appears, and never comes back later', () => {
    const { hint, calls, storage } = setup()
    hint.begin()
    hint.advance(100)
    hint.boosted()
    hint.advance(5000)
    expect(calls).toEqual([])
    expect(storage.data.get(BOOST_HINT_SEEN_KEY)).toBe('1')
    hint.begin()
    expect(hint.ticking).toBe(false)
  })

  test('boosting when the prompt is not up (after it timed out) also retires it', () => {
    const { hint, storage } = setup()
    hint.begin()
    hint.advance(700)
    hint.advance(4000)
    expect(hint.visible).toBe(false)
    hint.boosted()
    expect(storage.data.get(BOOST_HINT_SEEN_KEY)).toBe('1')
  })
})

describe('pause, demo, death, menu', () => {
  test('pause hides it and freezes the clock; resume brings back what is left', () => {
    const { hint } = setup()
    hint.begin()
    hint.advance(600)
    hint.advance(3000)
    expect(hint.visible).toBe(true)
    hint.setHeld(true)
    expect(hint.visible).toBe(false)
    expect(hint.ticking).toBe(false)
    hint.advance(60_000) // ignored while held
    hint.setHeld(false)
    expect(hint.visible).toBe(true)
    hint.advance(999)
    expect(hint.visible).toBe(true)
    hint.advance(1)
    expect(hint.visible).toBe(false)
  })

  test('pause before it appeared: the delay does not run during pause', () => {
    const { hint } = setup()
    hint.begin()
    hint.advance(500)
    hint.setHeld(true)
    hint.advance(10_000)
    expect(hint.visible).toBe(false)
    hint.setHeld(false)
    hint.advance(99)
    expect(hint.visible).toBe(false)
    hint.advance(1)
    expect(hint.visible).toBe(true)
  })

  test('end (demo explainer, death, menu) hides it for good', () => {
    const { hint } = setup()
    hint.begin()
    hint.advance(1000)
    hint.end()
    expect(hint.visible).toBe(false)
    hint.setHeld(false)
    hint.advance(1000)
    expect(hint.visible).toBe(false)
  })

  test('begin resets a pause left over from the previous game', () => {
    const { hint } = setup()
    hint.begin()
    hint.setHeld(true)
    hint.begin()
    expect(hint.ticking).toBe(true)
  })

  test('nothing is shown before the first begin', () => {
    const { hint } = setup()
    hint.advance(10_000)
    expect(hint.visible).toBe(false)
  })
})
