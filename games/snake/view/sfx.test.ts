import { describe, expect, test } from 'bun:test'
import { comboSemitones, semitoneRatio } from './sfx'

const combo = { semitonesPerApple: 1, maxSemitones: 12 }

describe('comboSemitones', () => {
  test('первое яблоко — базовая нота', () => {
    expect(comboSemitones(0, combo)).toBe(0)
  })
  test('каждое следующее выше на шаг', () => {
    expect(comboSemitones(1, combo)).toBe(1)
    expect(comboSemitones(5, combo)).toBe(5)
  })
  test('потолок', () => {
    expect(comboSemitones(12, combo)).toBe(12)
    expect(comboSemitones(500, combo)).toBe(12)
  })
  test('шаг 0 выключает комбо', () => {
    expect(comboSemitones(7, { semitonesPerApple: 0, maxSemitones: 12 })).toBe(0)
  })
})

describe('semitoneRatio', () => {
  test('12 полутонов — октава', () => {
    expect(semitoneRatio(12)).toBeCloseTo(2, 10)
    expect(semitoneRatio(0)).toBe(1)
  })
})
