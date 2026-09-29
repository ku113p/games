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
  test('первый запуск: предупреждение, затем условия', () => {
    expect(legalSteps(memory())).toEqual(['warning', 'terms'])
  })
  test('повторный запуск: только предупреждение', () => {
    expect(legalSteps(memory({ [TERMS_ACCEPTED_KEY]: '1' }))).toEqual(['warning'])
  })
  test('сброшенное хранилище: условия снова', () => {
    const s = memory({ [TERMS_ACCEPTED_KEY]: '1' })
    s.data.clear()
    expect(needsTerms(s)).toBe(true)
  })
  test('мусор в ключе не считается согласием', () => {
    expect(needsTerms(memory({ [TERMS_ACCEPTED_KEY]: '0' }))).toBe(true)
    expect(needsTerms(memory({ [TERMS_ACCEPTED_KEY]: '' }))).toBe(true)
  })
  test('хранилище недоступно (get всегда null): условия каждый раз, предупреждение тоже', () => {
    const broken: LegalStorage = { get: () => null, set: () => {} }
    expect(legalSteps(broken)).toEqual(['warning', 'terms'])
  })
})

describe('createLegalFlow', () => {
  test('первый запуск: warning -> terms -> null, согласие записано', () => {
    const s = memory()
    expect(run(s, 2)).toEqual(['warning', 'terms', null])
    expect(s.data.get(TERMS_ACCEPTED_KEY)).toBe('1')
  })
  test('согласие пишется только по «Принимаю», не при показе и не по «Понятно»', () => {
    const s = memory()
    run(s, 1)
    expect(s.data.has(TERMS_ACCEPTED_KEY)).toBe(false)
  })
  test('второй запуск после согласия: warning -> null, условий нет', () => {
    const s = memory()
    run(s, 2)
    expect(run(s, 1)).toEqual(['warning', null])
  })
  test('предупреждение показывается при каждом запуске, сколько бы раз ни принимали условия', () => {
    const s = memory()
    for (let i = 0; i < 3; i++) expect(run(s, 2)[0]).toBe('warning')
  })
  test('сброс хранилища между запусками возвращает экран условий', () => {
    const s = memory()
    run(s, 2)
    s.data.clear()
    expect(run(s, 2)).toEqual(['warning', 'terms', null])
  })
  test('лишние нажатия после конца ничего не ломают', () => {
    const s = memory()
    expect(run(s, 5)).toEqual(['warning', 'terms', null])
  })
  test('skipAll: экранов нет, согласие не записано — игрок увидит их при обычном запуске', () => {
    const s = memory()
    const shown: Array<LegalStep | null> = []
    const flow = createLegalFlow(s, (step) => shown.push(step))
    flow.skipAll()
    expect(shown).toEqual([null])
    expect(needsTerms(s)).toBe(true)
  })
  test('skipAll до start: последующий обычный запуск показывает оба экрана', () => {
    const s = memory()
    createLegalFlow(s, () => {}).skipAll()
    expect(run(s, 2)).toEqual(['warning', 'terms', null])
  })
})

describe('isPerfDebugRequested', () => {
  test('включено: ?perf, ?perf=bench, ?perf=freeze, ?perf=', () => {
    for (const q of ['?perf', '?perf=bench', '?perf=freeze', '?perf=', '?x=1&perf=bench']) expect(isPerfDebugRequested(q)).toBe(true)
  })
  test('выключено: нет параметра, ?perf=0, ?perf=false', () => {
    for (const q of ['', '?', '?x=1', '?perf=0', '?perf=false']) expect(isPerfDebugRequested(q)).toBe(false)
  })
  test('пропуск не пишет согласие и открывает меню', () => {
    const storage = memory()
    const shown: Array<LegalStep | null> = []
    createLegalFlow(storage, (s) => shown.push(s)).skipAll()
    expect(shown).toEqual([null])
    expect(storage.data.size).toBe(0)
    expect(needsTerms(storage)).toBe(true)
  })
})

describe('isSelfStartingPerfMode', () => {
  test('пропуск экранов: только bench и freeze', () => {
    for (const q of ['?perf=bench', '?perf=freeze', '?x=1&perf=bench']) expect(isSelfStartingPerfMode(q)).toBe(true)
  })
  test('?perf и ?perf= показывают предупреждение: включают панель, но не пропускают экраны', () => {
    for (const q of ['?perf', '?perf=']) {
      expect(isPerfDebugRequested(q)).toBe(true)
      expect(isSelfStartingPerfMode(q)).toBe(false)
    }
  })
  test('?perf=0, ?perf=false и обычный адрес не включают ни панель, ни пропуск', () => {
    for (const q of ['', '?perf=0', '?perf=false']) {
      expect(isPerfDebugRequested(q)).toBe(false)
      expect(isSelfStartingPerfMode(q)).toBe(false)
    }
  })
})
