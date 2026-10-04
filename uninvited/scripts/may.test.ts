import { expect, test } from 'bun:test'
import type { GameEvent } from '../core/events'
import { createMayQueue, deathLineDue, holdSec, MAY_CFG, voiceBeeps, type MayLine, type QueueStore } from '../view/may-queue'
import { createMayTriggers, mayText } from '../view/may-triggers'

const L = (id: string, priority = 10, once: MayLine['once'] = 'level', extra: Partial<MayLine> = {}): MayLine => ({ id, text: `line ${id} has five words`, priority, once, ...extra })
const memory = (): QueueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, read: (k) => data.get(k) ?? null, write: (k, v) => (data.set(k, v), true) }
}
/** Steps until the queue shows a line (or gives up). */
function until(q: ReturnType<typeof createMayQueue>, mode: 'play' | 'end' = 'play'): string | null {
  for (let i = 0; i < 4000 && !q.visible; i++) q.step(0.05, mode)
  return q.current?.line.id ?? null
}
/** Plays the current line out and returns its id. */
function finish(q: ReturnType<typeof createMayQueue>, mode: 'play' | 'end' = 'play'): string | null {
  const id = until(q, mode)
  for (let i = 0; i < 4000 && q.current; i++) q.step(0.05, mode)
  return id
}

test('hold time: 0.35 s per word + 1.2 s', () => {
  expect(holdSec('one two three four')).toBeCloseTo(MAY_CFG.baseSec + 4 * MAY_CFG.perWordSec, 6)
  expect(holdSec('Oh. A visitor. Nobody invites me in either.')).toBeCloseTo(1.2 + 8 * 0.35, 6)
})

test('queue: one at a time, by priority, then first come first served; a line is never cut', () => {
  const q = createMayQueue()
  q.say(L('a', 10))
  q.say(L('b', 50))
  q.say(L('c', 10))
  q.say(L('d', 50))
  expect(q.waiting()).toEqual(['b', 'd', 'a', 'c'])
  q.step(0.01, 'play')
  expect(q.current?.line.id).toBe('b')
  q.say(L('e', 99)) // a more urgent line waits for the one on screen
  q.step(1, 'play')
  expect(q.current?.line.id).toBe('b')
  const order = ['b']
  finish(q) // b plays out
  for (let id = finish(q); id; id = finish(q)) order.push(id)
  expect(order).toEqual(['b', 'e', 'd', 'a', 'c'])
})

test('queue: a gap between two lines', () => {
  const q = createMayQueue()
  q.say(L('a'))
  q.say(L('b'))
  finish(q)
  q.step(0.1, 'play')
  expect(q.current).toBeNull() // the gap
  q.step(MAY_CFG.gapSec, 'play')
  expect(q.current?.line.id).toBe('b')
})

test('queue: waits while blocked (hack, menu, card) and the clock stands still', () => {
  const q = createMayQueue()
  q.say(L('a'))
  for (let i = 0; i < 1000; i++) q.step(0.1, 'blocked')
  expect(q.current).toBeNull()
  expect(q.waiting()).toEqual(['a']) // not dropped as stale: blocked time does not age it
  q.step(0.1, 'play')
  expect(q.current?.line.id).toBe('a')
  const e = q.current?.elapsed ?? 0
  for (let i = 0; i < 100; i++) q.step(0.1, 'blocked')
  expect(q.current?.elapsed).toBe(e)
  expect(q.visible).toBe(false)
})

test('queue: a line that waited too long in play is dropped, and can come back', () => {
  const q = createMayQueue()
  q.say(L('long', 90, 'level', { holdSec: 100 }))
  q.say(L('stale'))
  q.step(0.1, 'play')
  for (let i = 0; i < Math.ceil((MAY_CFG.maxWaitSec + 1) / 0.5); i++) q.step(0.5, 'play')
  expect(q.waiting()).toEqual([])
  expect(q.say(L('stale'))).toBe(true) // never shown, so it is not counted as said
})

test('queue: once per level; resetLevel brings them back', () => {
  const q = createMayQueue()
  expect(q.say(L('x'))).toBe(true)
  expect(q.say(L('x'))).toBe(false) // already queued
  finish(q)
  expect(q.say(L('x'))).toBe(false)
  q.resetLevel()
  expect(q.say(L('x'))).toBe(true)
})

test('queue: "always" lines repeat', () => {
  const q = createMayQueue()
  q.say(L('r', 10, 'always'))
  finish(q)
  expect(q.say(L('r', 10, 'always'))).toBe(true)
})

test('queue: once per save survives a new queue (a reload) and is cleared with the save, not by resetLevel', () => {
  const store = memory()
  const q1 = createMayQueue(store)
  q1.say(L('s', 10, 'save'))
  finish(q1)
  const q2 = createMayQueue(store)
  expect(q2.say(L('s', 10, 'save'))).toBe(false)
  q2.resetLevel()
  expect(q2.say(L('s', 10, 'save'))).toBe(false)
  q2.clearSaved()
  expect(createMayQueue(store).say(L('s', 10, 'save'))).toBe(true)
})

test('queue: end lines show only on the end screens, normal lines never there', () => {
  const q = createMayQueue()
  q.say(L('n', 10, 'level'))
  q.say(L('e', 5, 'level', { end: true }))
  for (let i = 0; i < 20; i++) q.step(0.1, 'end')
  expect(q.current?.line.id).toBe('e')
  finish(q, 'end')
  q.step(0.1, 'end')
  expect(q.current).toBeNull()
  q.step(MAY_CFG.gapSec, 'play')
  expect(q.current?.line.id).toBe('n')
})

test('queue: cancel and clearWaiting', () => {
  const q = createMayQueue()
  q.say(L('meet1', 100))
  q.say(L('meet2', 100))
  q.say(L('death', 60, 'always'))
  q.say(L('other', 10))
  q.step(0.1, 'play')
  q.cancel('meet')
  expect(q.has('meet')).toBe(false)
  expect(q.waiting()).toEqual(['death', 'other'])
  q.clearWaiting('death')
  expect(q.waiting()).toEqual(['death'])
})

test('death line: the first death, then at most every third', () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => deathLineDue(n))).toEqual([1, 4, 7, 10])
  expect(deathLineDue(0)).toBe(false)
})

test('voice: one beep per syllable, spaces and punctuation skipped, pauses at commas and stops', () => {
  const v = MAY_CFG.voice
  const same = () => 0.5
  expect(voiceBeeps('Hello', v, same).beeps.length).toBe(2)
  expect(voiceBeeps("I'm May", v, same).beeps.length).toBe(2) // an apostrophe does not split a syllable; "ay" is one
  const one = voiceBeeps('ba', v, same)
  expect(one.beeps.length).toBe(1)
  expect(voiceBeeps('...  ,,', v, same).beeps.length).toBe(0)
  const noPause = voiceBeeps('ba ba', v, same)
  const comma = voiceBeeps('ba, ba', v, same)
  const stop = voiceBeeps('ba. ba', v, same)
  expect((comma.beeps[1]?.at ?? 0) - (noPause.beeps[1]?.at ?? 0)).toBeCloseTo(v.commaPauseSec, 6)
  expect((stop.beeps[1]?.at ?? 0) - (noPause.beeps[1]?.at ?? 0)).toBeCloseTo(v.stopPauseSec, 6)
  // an even cadence: equal gaps between beeps inside a phrase
  const b = voiceBeeps('banana banana', v, same).beeps
  for (let i = 1; i < b.length; i++) expect((b[i]?.at ?? 0) - (b[i - 1]?.at ?? 0)).toBeCloseTo(v.syllableSec, 6)
  // the pitch jitters inside the configured band and falls along a sentence
  const r = voiceBeeps('banana banana banana.', v, Math.random).beeps
  for (const x of r) {
    expect(x.rate).toBeLessThanOrEqual(v.pitch * (1 + v.pitchJitter) + 1e-9)
    expect(x.rate).toBeGreaterThan(v.pitch * (1 - v.pitchJitter) * (1 - v.stopDrop) - 1e-9)
  }
  const flat = voiceBeeps('banana banana banana.', v, same).beeps
  expect((flat[flat.length - 1]?.rate ?? 0) < (flat[0]?.rate ?? 0)).toBe(true)
})

test('every May line is at most 12 words and has text', () => {
  for (const k of ['meet1', 'meet2', 'meet3', 'welcome', 'camera', 'netvision', 'warden', 'alarm1', 'alarm3', 'firewall', 'cpCalm', 'cpRed', 'death', 'notes', 'end'] as const) {
    const text = mayText(k)
    expect(text.length).toBeGreaterThan(0)
    expect(text.trim().split(/\s+/).length).toBeLessThanOrEqual(12)
  }
})

test('triggers: events become lines; the death line is throttled; a hack that opens a wall says welcome', () => {
  const said: MayLine[] = []
  const t = createMayTriggers((l) => said.push(l))
  const ids = (): string[] => said.splice(0).map((l) => l.id)
  t.events([{ type: 'scanOn' }])
  expect(ids()).toEqual(['netvision'])
  t.events([{ type: 'alarmRaised', stage: 1, reason: 'camera' }])
  expect(ids()).toEqual(['alarm1'])
  t.events([{ type: 'alarmRaised', stage: 2, reason: 'camera' }])
  expect(ids()).toEqual([])
  t.events([{ type: 'alarmRaised', stage: 3, reason: 'camera' }])
  expect(ids()).toEqual(['alarm3'])
  t.events([{ type: 'firewallDropped' }, { type: 'wallOpened', index: 0 }])
  expect(ids()).toEqual(['firewall']) // the firewall is not a hack: no "welcome"
  t.events([{ type: 'hackSolved', terminal: 0 }, { type: 'wallOpened', index: 0 }])
  expect(ids()).toEqual(['welcome'])
  t.events([{ type: 'hackSolved', terminal: 1 }]) // a hack that opens no wall
  expect(ids()).toEqual([])
  t.events([{ type: 'checkpointReached', index: 0, underAlarm: false }])
  expect(ids()).toEqual(['cpCalm'])
  t.events([{ type: 'checkpointReached', index: 1, underAlarm: true }])
  expect(ids()).toEqual(['cpRed'])
  const died: GameEvent = { type: 'playerDied' }
  const got: number[] = []
  for (let n = 1; n <= 7; n++) {
    t.events([died])
    if (ids().length > 0) got.push(n)
  }
  expect(got).toEqual([1, 4, 7])
  t.reset()
  t.events([died])
  expect(ids()).toEqual(['death'])
  t.events([{ type: 'artifactTaken' }])
  const end = said.splice(0)
  expect(end.map((l) => l.id)).toEqual(['notes', 'end'])
  expect(end[1]?.end).toBe(true)
})
