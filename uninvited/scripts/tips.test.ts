import { expect, test } from 'bun:test'
import { createPrompter, createTips, parseSeen } from '../view/tips'

const cfg = { minSec: 3, maxShows: 2, gapSec: 1 }
const S = (...x: string[]): Set<string> => new Set(x)
const NONE = S()

test('prompter: stays while the situation lasts, no timer', () => {
  const p = createPrompter(cfg, ['a', 'b'])
  expect(p.step(0.1, S('a'), NONE, true)).toBe('a')
  for (let i = 0; i < 600; i++) expect(p.step(0.1, S('a'), NONE, true)).toBe('a') // 60 s
})

test('prompter: leaving the situation hides it, but not before the minimum time', () => {
  const p = createPrompter(cfg, ['a'])
  p.step(0, S('a'), NONE, true)
  expect(p.step(1, NONE, NONE, true)).toBe('a') // 1 s on screen
  expect(p.step(1, NONE, NONE, true)).toBe('a') // 2 s
  expect(p.step(1.5, NONE, NONE, true)).toBeNull() // 3.5 s
})

test('prompter: doing the action retires it for good', () => {
  const p = createPrompter(cfg, ['a'])
  p.step(0, S('a'), NONE, true)
  expect(p.step(3, S('a'), S('a'), true)).toBeNull()
  for (let i = 0; i < 50; i++) expect(p.step(1, S('a'), NONE, true)).toBeNull()
})

test('prompter: one at a time by priority, a gap between, each at most maxShows times', () => {
  const p = createPrompter(cfg, ['a', 'b'])
  expect(p.step(0, S('a', 'b'), NONE, true)).toBe('a')
  expect(p.step(3, S('b'), NONE, true)).toBeNull() // a is gone, the gap runs
  expect(p.step(0.5, S('b'), NONE, true)).toBeNull()
  expect(p.step(0.6, S('b'), NONE, true)).toBe('b')
  // a comes back once more (2nd show), then never again
  expect(p.step(3, S('a'), NONE, true)).toBeNull()
  expect(p.step(1.1, S('a'), NONE, true)).toBe('a')
  expect(p.step(3, NONE, NONE, true)).toBeNull()
  for (let i = 0; i < 20; i++) expect(p.step(1, S('a'), NONE, true)).not.toBe('a')
})

test('prompter: a menu or a card hides it at once and holds new ones', () => {
  const p = createPrompter(cfg, ['a'])
  p.step(0, S('a'), NONE, true)
  expect(p.step(0.1, S('a'), NONE, false)).toBeNull()
  expect(p.step(0.1, S('a'), NONE, false)).toBeNull()
})

test('tips: a card is handed out once, saved, with a pause between cards', () => {
  const saved: Record<string, string> = {}
  const store = { read: (k: string) => saved[k] ?? null, write: (k: string, d: string) => ((saved[k] = d), true) }
  let on = true
  const t = createTips(store, () => on, 10)
  t.request('quiet')
  t.request('quiet')
  expect(t.take()).toBe('quiet')
  expect(t.take()).toBeNull()
  t.request('quiet') // seen: ignored
  t.request('netvision')
  expect(t.take()).toBeNull() // the pause since the last card
  t.tick(10)
  expect(t.take()).toBe('netvision')
  expect(t.seen()).toEqual(['quiet', 'netvision'])
  // a new session reads the saved ids
  expect(parseSeen(saved['tips'] ?? null).has('quiet')).toBe(true)
  const t2 = createTips(store, () => on, 10)
  expect(t2.due('quiet')).toBe(false)
  expect(t2.due('alarm')).toBe(true)
  // skip: the player already did it
  t2.request('aim')
  t2.skip('aim')
  expect(t2.take()).toBeNull()
  expect(t2.due('aim')).toBe(false)
  // claim: right now, once
  expect(t2.claim('hacking')).toBe(true)
  expect(t2.claim('hacking')).toBe(false)
  // tips off: nothing is due, nothing is marked seen
  on = false
  expect(t2.due('alarm')).toBe(false)
  t2.request('alarm')
  expect(t2.take()).toBeNull()
  expect(t2.claim('alarm')).toBe(false)
  on = true
  expect(t2.due('alarm')).toBe(true)
})

test('tips: a broken save is ignored', () => {
  expect(parseSeen('{oops').size).toBe(0)
  expect(parseSeen(JSON.stringify(['quiet', 'nope', 7])).size).toBe(1)
})
