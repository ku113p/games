import { expect, test } from 'bun:test'
import { createSettings, defaultSettings, parseSettings } from '../view/settings'

test('settings: garbage and out-of-range values fall back to safe ones', () => {
  expect(parseSettings(null)).toEqual(defaultSettings())
  expect(parseSettings('{not json')).toEqual(defaultSettings())
  const s = parseSettings(JSON.stringify({ master: 5, music: -1, sfx: 'x', sensitivity: 99, invertY: 1, reduceFx: true, hudScale: 130 }))
  expect(s.master).toBe(1)
  expect(s.music).toBe(0)
  expect(s.sfx).toBe(defaultSettings().sfx)
  expect(s.sensitivity).toBe(2)
  expect(s.invertY).toBe(false)
  expect(s.reduceFx).toBe(true)
  expect(s.hudScale).toBe(100)
})

test('settings: changes are saved and notified; a refusing store is fine', () => {
  const saved: Record<string, string> = {}
  const h = createSettings({ read: (k) => saved[k] ?? null, write: (k, d) => ((saved[k] = d), true) })
  let seen = 0
  h.onChange(() => seen++)
  h.set('sensitivity', 1.5)
  expect(seen).toBe(2)
  expect(parseSettings(saved['settings'] ?? null).sensitivity).toBe(1.5)
  const none = createSettings({ read: () => null, write: () => false })
  none.set('invertY', true)
  expect(none.values.invertY).toBe(true)
})
