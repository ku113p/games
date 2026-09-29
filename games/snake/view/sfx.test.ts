import { describe, expect, test } from 'bun:test'
import { comboSemitones, semitoneRatio, tickAudible, tickGainFactor, tickPitchRatio, type SpeedConfig } from './sfx'

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

// Значения как в config.json → sound.blips.tick.speed.
const speed: SpeedConfig = {
  slowStepMs: 1080,
  fastStepMs: 180,
  fastGain: 0.15,
  skipBelowStepMs: 300,
  skipEvery: 2,
  jitterCents: 70,
  minGapMs: 60,
}

describe('tickGainFactor', () => {
  test('медленный шаг — полная громкость, и дольше тоже', () => {
    expect(tickGainFactor(1080, speed)).toBe(1)
    expect(tickGainFactor(5000, speed)).toBe(1)
  })
  test('край быстрого диапазона — fastGain, и короче тоже', () => {
    expect(tickGainFactor(180, speed)).toBeCloseTo(0.15, 10)
    expect(tickGainFactor(50, speed)).toBeCloseTo(0.15, 10)
  })
  test('быстрый шаг тише медленного, с ускорением тише, чем без', () => {
    const slow = tickGainFactor(1080, speed)
    const fast = tickGainFactor(360, speed) // минимальный шаг без ускорения
    const boosted = tickGainFactor(180, speed) // минимальный шаг с ускорением ×2
    expect(fast).toBeLessThan(slow)
    expect(boosted).toBeLessThan(fast)
    expect(boosted).toBeLessThan(0.2)
  })
  test('монотонно: чем короче шаг, тем не громче', () => {
    let prev = Infinity
    for (let ms = 1200; ms >= 100; ms -= 20) {
      const g = tickGainFactor(ms, speed)
      expect(g).toBeLessThanOrEqual(prev)
      prev = g
    }
  })
  test('вырожденный диапазон и NaN не ломают звук', () => {
    expect(tickGainFactor(500, { ...speed, slowStepMs: 180, fastStepMs: 180 })).toBe(1)
    expect(tickGainFactor(Number.NaN, speed)).toBe(1)
  })
  test('fastGain 1 — громкость от темпа не зависит', () => {
    expect(tickGainFactor(180, { ...speed, fastGain: 1 })).toBe(1)
  })
})

describe('tickAudible', () => {
  test('на медленном и среднем ходу звучит каждый шаг', () => {
    for (let i = 0; i < 6; i++) {
      expect(tickAudible(1080, i, speed)).toBe(true)
      expect(tickAudible(360, i, speed)).toBe(true)
      expect(tickAudible(300, i, speed)).toBe(true) // граница включительно — не пропуск
    }
  })
  test('на быстром через один', () => {
    const heard = [0, 1, 2, 3, 4, 5].map((i) => tickAudible(180, i, speed))
    expect(heard).toEqual([true, false, true, false, true, false])
  })
  test('skipEvery 1 или skipBelowStepMs 0 — пропусков нет', () => {
    expect(tickAudible(180, 1, { ...speed, skipEvery: 1 })).toBe(true)
    expect(tickAudible(180, 1, { ...speed, skipBelowStepMs: 0 })).toBe(true)
  })
})

describe('tickPitchRatio', () => {
  test('детерминирован и укладывается в разброс', () => {
    const lim = Math.pow(2, 70 / 1200)
    for (let i = 0; i < 500; i++) {
      const r = tickPitchRatio(i, 70)
      expect(r).toBe(tickPitchRatio(i, 70))
      expect(r).toBeGreaterThanOrEqual(1 / lim - 1e-12)
      expect(r).toBeLessThanOrEqual(lim + 1e-12)
    }
  })
  test('соседние шаги — не одна нота', () => {
    const set = new Set<number>()
    for (let i = 0; i < 20; i++) set.add(tickPitchRatio(i, 70))
    expect(set.size).toBeGreaterThan(15)
  })
  test('jitterCents 0 — ровно одна нота', () => {
    expect(tickPitchRatio(3, 0)).toBe(1)
  })
})
