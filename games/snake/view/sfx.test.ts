import { describe, expect, test } from 'bun:test'
import { blipEnvelope, comboSemitones, semitoneRatio, tickAudible, tickGainFactor, tickPitchRatio, type SpeedConfig } from './sfx'

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

// Громкость тика: страховка от «звук есть, а не слышно» (тик уже уходил в 0.0075 на выходе при кнопке 0.125).
// Значения зеркалят config.json → sound.blips (tick, click) и sound.sfx.volume; при правке баланса менять вместе.
describe('громкость тика на выходе', () => {
  const bus = 0.5
  const tick = { wave: 'triangle', gain: 0.26, attackMs: 1, decayMs: 110, minGapMs: 90, speed: { ...speed, fastGain: 0.5 } }
  const click = { wave: 'square', gain: 0.25, attackMs: 2, decayMs: 50 }
  // Форм-фактор RMS/пик несущей: квадрат 1, треугольник 1/√3, синус 1/√2.
  const shape = { square: 1, triangle: 1 / Math.sqrt(3), sine: 1 / Math.SQRT2, sawtooth: 1 / Math.sqrt(3) } as const
  const WINDOW_MS = 100

  function loudness(b: { wave: keyof typeof shape; gain: number; attackMs: number; decayMs: number }, factor: number) {
    const peak = b.gain * factor * bus
    let sum = 0
    let audibleMs = 0
    const dt = 0.1
    for (let t = 0; t < WINDOW_MS; t += dt) {
      const e = blipEnvelope(t, b.attackMs, b.decayMs, b.gain * factor) * bus
      sum += e * e * dt
      if (e >= peak * 0.0316) audibleMs += dt // до −30 дБ от пика
    }
    return { peak, rms: shape[b.wave] * Math.sqrt(sum / WINDOW_MS), audibleMs }
  }
  const at = (ms: number) => loudness(tick as never, tickGainFactor(ms, tick.speed))
  const btn = loudness(click as never, 1)

  // Верхняя граница поднята с 0.6 до 1.2 по прямому решению дизайнера: он послушал тик в игре, под музыкой,
  // и сказал «звук хода можно раза в 2 громче» (gain 0.13 → 0.26). Это решение на слух, а не подгонка под код.
  // Нижняя граница 0.3 остаётся: она ловит настоящую регрессию (тик уже уходил в неслышимое).
  test('на старте тик не тише 0.3 от кнопки и не громче 1.2 от неё (пик и RMS)', () => {
    const t = at(1080)
    expect(t.peak / btn.peak).toBeGreaterThan(0.3)
    expect(t.peak / btn.peak).toBeLessThan(1.2)
    expect(t.rms / btn.rms).toBeGreaterThan(0.3)
    expect(t.rms / btn.rms).toBeLessThan(1.2)
  })
  test('тик остаётся фоновым: не громче половины яблока и трети смерти (пик)', () => {
    const appleGain = 0.6 // config.json → sound.blips.eat.gain
    const deathGain = 0.85 // config.json → sound.blips.death.gain
    expect(at(1080).peak).toBeLessThan(0.5 * appleGain * bus)
    expect(at(1080).peak).toBeLessThan(0.34 * deathGain * bus)
  })
  test('на самом быстром темпе тик не тише 0.25 от стартового (пик и RMS)', () => {
    for (const ms of [540, 360, 180]) {
      expect(at(ms).peak / at(1080).peak).toBeGreaterThanOrEqual(0.25)
      expect(at(ms).rms / at(1080).rms).toBeGreaterThanOrEqual(0.25)
    }
  })
  test('на пределе ускорения тик не тише 0.02 на выходе (уходил в 0.0075 — «не слышно вообще»)', () => {
    expect(at(180).peak).toBeGreaterThanOrEqual(0.02)
    expect(at(180).rms).toBeGreaterThanOrEqual(0.004)
  })
  test('у тика есть тело: слышимая часть (до −30 дБ) не короче 30 мс', () => {
    for (const ms of [1080, 360, 180]) expect(at(ms).audibleMs).toBeGreaterThanOrEqual(30)
  })
  test('громкость на темпе убывает монотонно, без скачков вверх', () => {
    let prev = Infinity
    for (const ms of [1080, 900, 720, 540, 360, 180]) {
      const p = at(ms).peak
      expect(p).toBeLessThanOrEqual(prev)
      prev = p
    }
  })
  test('слышимое тело не налезает на следующий озвученный тик', () => {
    // Ближайшие озвучиваемые тики: шаг 300 мс без пропусков или через один на быстром ходу (2 × 180 = 360).
    const nearest = Math.min(tick.speed.skipBelowStepMs, tick.speed.skipEvery * 180)
    expect(at(180).audibleMs).toBeLessThan(nearest)
    expect(tick.attackMs + tick.decayMs).toBeLessThanOrEqual(nearest)
    expect(tick.minGapMs).toBeGreaterThanOrEqual(90)
  })
})
