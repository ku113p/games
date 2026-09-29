import { describe, expect, test } from 'bun:test'
import { controlLines, keyListPlacement } from './controls-layout'

const phone = { touch: true, keyboard: false }
const desktop = { touch: false, keyboard: true }
const hybrid = { touch: true, keyboard: true }

describe('controlLines', () => {
  test('swipes: swipe, tap, double tap, then the common controls; no pad lines', () => {
    expect(controlLines('swipes', phone)).toEqual(['swipe', 'tap', 'doubleTap', 'boost', 'stick', 'reset', 'pause'])
  })
  test('taps: pad arrows and axis buttons, then the common controls; no swipe or tap lines', () => {
    expect(controlLines('taps', phone)).toEqual(['arrows', 'axisButtons', 'boost', 'stick', 'reset', 'pause'])
  })
  test('boost, camera reset and pause are in both schemes', () => {
    for (const scheme of ['swipes', 'taps'] as const) {
      const lines = controlLines(scheme, phone)
      for (const id of ['boost', 'reset', 'pause'] as const) expect(lines).toContain(id)
    }
  })
  test('the stick exists only on a touch device (the CSS shows it under any-pointer: coarse)', () => {
    expect(controlLines('swipes', desktop)).not.toContain('stick')
    expect(controlLines('taps', desktop)).not.toContain('stick')
    expect(controlLines('taps', hybrid)).toContain('stick')
  })
  test('no line appears twice', () => {
    for (const scheme of ['swipes', 'taps'] as const) {
      const lines = controlLines(scheme, hybrid)
      expect(new Set(lines).size).toBe(lines.length)
    }
  })
})

describe('keyListPlacement', () => {
  test('phone: none; desktop: first; touch laptop: after the diagram', () => {
    expect(keyListPlacement(phone)).toBe('none')
    expect(keyListPlacement(desktop)).toBe('first')
    expect(keyListPlacement(hybrid)).toBe('last')
  })
})
