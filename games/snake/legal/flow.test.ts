import { describe, expect, test } from 'bun:test'
import { createLegalFlow, isPerfDebugRequested, isSelfStartingPerfMode, legalSteps, needsTerms, TERMS_ACCEPTED_KEY, type LegalStep, type LegalStorage } from './flow'

function memory(initial: Record<string, string> = {}): LegalStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) }
}

function run(storage: LegalStorage, taps: number): Array<LegalStep | null> {
  const shown: Array<LegalStep | null> = []
  const flow = createLegalFlow(storage, (s) => shown.push(s))
  flow.start()
  for (let i = 0; i < taps; i++) flow.confirm()
  return shown
}

describe('legalSteps / needsTerms', () => {
  test('first launch: the warning, then the terms', () => {
    expect(legalSteps(memory())).toEqual(['warning', 'terms'])
  })
  test('repeat launch: only the warning', () => {
    expect(legalSteps(memory({ [TERMS_ACCEPTED_KEY]: '1' }))).toEqual(['warning'])
  })
  test('reset storage: the terms again', () => {
    const s = memory({ [TERMS_ACCEPTED_KEY]: '1' })
    s.data.clear()
    expect(needsTerms(s)).toBe(true)
  })
  test('garbage in the key does not count as consent', () => {
    expect(needsTerms(memory({ [TERMS_ACCEPTED_KEY]: '0' }))).toBe(true)
    expect(needsTerms(memory({ [TERMS_ACCEPTED_KEY]: '' }))).toBe(true)
  })
  test('storage unavailable (get always null): the terms every time, the warning too', () => {
    const broken: LegalStorage = { get: () => null, set: () => {} }
    expect(legalSteps(broken)).toEqual(['warning', 'terms'])
  })
})

describe('createLegalFlow', () => {
  test('first launch: warning -> terms -> null, consent recorded', () => {
    const s = memory()
    expect(run(s, 2)).toEqual(['warning', 'terms', null])
    expect(s.data.get(TERMS_ACCEPTED_KEY)).toBe('1')
  })
  test('consent is written only on "I accept", not on display and not on "Got it"', () => {
    const s = memory()
    run(s, 1)
    expect(s.data.has(TERMS_ACCEPTED_KEY)).toBe(false)
  })
  test('second launch after consent: warning -> null, no terms', () => {
    const s = memory()
    run(s, 2)
    expect(run(s, 1)).toEqual(['warning', null])
  })
  test('the warning shows on every launch, however many times the terms were accepted', () => {
    const s = memory()
    for (let i = 0; i < 3; i++) expect(run(s, 2)[0]).toBe('warning')
  })
  test('a storage reset between launches brings back the terms screen', () => {
    const s = memory()
    run(s, 2)
    s.data.clear()
    expect(run(s, 2)).toEqual(['warning', 'terms', null])
  })
  test('extra presses after the end break nothing', () => {
    const s = memory()
    expect(run(s, 5)).toEqual(['warning', 'terms', null])
  })
  test('skipAll: no screens, consent not recorded: the player will see them on a normal launch', () => {
    const s = memory()
    const shown: Array<LegalStep | null> = []
    const flow = createLegalFlow(s, (step) => shown.push(step))
    flow.skipAll()
    expect(shown).toEqual([null])
    expect(needsTerms(s)).toBe(true)
  })
  test('skipAll before start: a subsequent normal launch shows both screens', () => {
    const s = memory()
    createLegalFlow(s, () => {}).skipAll()
    expect(run(s, 2)).toEqual(['warning', 'terms', null])
  })
})

describe('isPerfDebugRequested', () => {
  test('on: ?perf, ?perf=bench, ?perf=freeze, ?perf=', () => {
    for (const q of ['?perf', '?perf=bench', '?perf=freeze', '?perf=', '?x=1&perf=bench']) expect(isPerfDebugRequested(q)).toBe(true)
  })
  test('off: no parameter, ?perf=0, ?perf=false', () => {
    for (const q of ['', '?', '?x=1', '?perf=0', '?perf=false']) expect(isPerfDebugRequested(q)).toBe(false)
  })
  test('skipping does not write consent and opens the menu', () => {
    const storage = memory()
    const shown: Array<LegalStep | null> = []
    createLegalFlow(storage, (s) => shown.push(s)).skipAll()
    expect(shown).toEqual([null])
    expect(storage.data.size).toBe(0)
    expect(needsTerms(storage)).toBe(true)
  })
})

describe('isSelfStartingPerfMode', () => {
  test('skipping the screens: only bench and freeze', () => {
    for (const q of ['?perf=bench', '?perf=freeze', '?x=1&perf=bench']) expect(isSelfStartingPerfMode(q)).toBe(true)
  })
  test('?perf and ?perf= show the warning: they turn the panel on but do not skip the screens', () => {
    for (const q of ['?perf', '?perf=']) {
      expect(isPerfDebugRequested(q)).toBe(true)
      expect(isSelfStartingPerfMode(q)).toBe(false)
    }
  })
  test('?perf=0, ?perf=false and a plain address turn on neither the panel nor the skip', () => {
    for (const q of ['', '?perf=0', '?perf=false']) {
      expect(isPerfDebugRequested(q)).toBe(false)
      expect(isSelfStartingPerfMode(q)).toBe(false)
    }
  })
})
