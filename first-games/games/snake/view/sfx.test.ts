import { describe, expect, test } from 'bun:test'
import { blipEnvelope, comboSemitones, semitoneRatio, tickAudible, tickGainFactor, tickPitchRatio, type SpeedConfig } from './sfx'

const combo = { semitonesPerApple: 1, maxSemitones: 12 }

describe('comboSemitones', () => {
  test('first apple - the base note', () => {
    expect(comboSemitones(0, combo)).toBe(0)
  })
  test('each next one is a step higher', () => {
    expect(comboSemitones(1, combo)).toBe(1)
    expect(comboSemitones(5, combo)).toBe(5)
  })
  test('ceiling', () => {
    expect(comboSemitones(12, combo)).toBe(12)
    expect(comboSemitones(500, combo)).toBe(12)
  })
  test('step 0 disables the combo', () => {
    expect(comboSemitones(7, { semitonesPerApple: 0, maxSemitones: 12 })).toBe(0)
  })
})

describe('semitoneRatio', () => {
  test('12 semitones - an octave', () => {
    expect(semitoneRatio(12)).toBeCloseTo(2, 10)
    expect(semitoneRatio(0)).toBe(1)
  })
})

// Values as in config.json -> sound.blips.tick.speed.
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
  test('slow step - full volume, and longer too', () => {
    expect(tickGainFactor(1080, speed)).toBe(1)
    expect(tickGainFactor(5000, speed)).toBe(1)
  })
  test('edge of the fast range - fastGain, and shorter too', () => {
    expect(tickGainFactor(180, speed)).toBeCloseTo(0.15, 10)
    expect(tickGainFactor(50, speed)).toBeCloseTo(0.15, 10)
  })
  test('a fast step is quieter than a slow one, with boost quieter than without', () => {
    const slow = tickGainFactor(1080, speed)
    const fast = tickGainFactor(360, speed) // shortest step without boost
    const boosted = tickGainFactor(180, speed) // shortest step with boost x2
    expect(fast).toBeLessThan(slow)
    expect(boosted).toBeLessThan(fast)
    expect(boosted).toBeLessThan(0.2)
  })
  test('monotonic: the shorter the step, the not louder', () => {
    let prev = Infinity
    for (let ms = 1200; ms >= 100; ms -= 20) {
      const g = tickGainFactor(ms, speed)
      expect(g).toBeLessThanOrEqual(prev)
      prev = g
    }
  })
  test('a degenerate range and NaN do not break the sound', () => {
    expect(tickGainFactor(500, { ...speed, slowStepMs: 180, fastStepMs: 180 })).toBe(1)
    expect(tickGainFactor(Number.NaN, speed)).toBe(1)
  })
  test('fastGain 1 - volume does not depend on pace', () => {
    expect(tickGainFactor(180, { ...speed, fastGain: 1 })).toBe(1)
  })
})

describe('tickAudible', () => {
  test('at slow and medium pace every step is voiced', () => {
    for (let i = 0; i < 6; i++) {
      expect(tickAudible(1080, i, speed)).toBe(true)
      expect(tickAudible(360, i, speed)).toBe(true)
      expect(tickAudible(300, i, speed)).toBe(true) // the boundary is inclusive - not a skip
    }
  })
  test('at fast pace every other one', () => {
    const heard = [0, 1, 2, 3, 4, 5].map((i) => tickAudible(180, i, speed))
    expect(heard).toEqual([true, false, true, false, true, false])
  })
  test('skipEvery 1 or skipBelowStepMs 0 - no skipping', () => {
    expect(tickAudible(180, 1, { ...speed, skipEvery: 1 })).toBe(true)
    expect(tickAudible(180, 1, { ...speed, skipBelowStepMs: 0 })).toBe(true)
  })
})

describe('tickPitchRatio', () => {
  test('deterministic and stays within the spread', () => {
    const lim = Math.pow(2, 70 / 1200)
    for (let i = 0; i < 500; i++) {
      const r = tickPitchRatio(i, 70)
      expect(r).toBe(tickPitchRatio(i, 70))
      expect(r).toBeGreaterThanOrEqual(1 / lim - 1e-12)
      expect(r).toBeLessThanOrEqual(lim + 1e-12)
    }
  })
  test('neighboring steps are not the same note', () => {
    const set = new Set<number>()
    for (let i = 0; i < 20; i++) set.add(tickPitchRatio(i, 70))
    expect(set.size).toBeGreaterThan(15)
  })
  test('jitterCents 0 - exactly one note', () => {
    expect(tickPitchRatio(3, 0)).toBe(1)
  })
})

// Tick loudness: a guard against "there is a sound but it is inaudible" (the tick once dropped to 0.0075 at the output with the button at 0.125).
// The values mirror config.json -> sound.blips (tick, click) and sound.sfx.volume; change them together when tuning balance.
describe('tick loudness at the output', () => {
  const bus = 0.5
  const tick = { wave: 'triangle', gain: 0.26, attackMs: 1, decayMs: 110, minGapMs: 90, speed: { ...speed, fastGain: 0.5 } }
  const click = { wave: 'square', gain: 0.25, attackMs: 2, decayMs: 50 }
  // RMS/peak form factor of the carrier: square 1, triangle 1/sqrt(3), sine 1/sqrt(2).
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
      if (e >= peak * 0.0316) audibleMs += dt // down to -30 dB from the peak
    }
    return { peak, rms: shape[b.wave] * Math.sqrt(sum / WINDOW_MS), audibleMs }
  }
  const at = (ms: number) => loudness(tick as never, tickGainFactor(ms, tick.speed))
  const btn = loudness(click as never, 1)

  // The upper bound was raised from 0.6 to 1.2 by a direct designer decision: he listened to the tick in the game, under the music,
  // and said "the step sound could be about 2x louder" (gain 0.13 -> 0.26). This is a by-ear decision, not fitting to the code.
  // The lower bound 0.3 stays: it catches a real regression (the tick once dropped to inaudible).
  test('at start the tick is not quieter than 0.3 of the button and not louder than 1.2 of it (peak and RMS)', () => {
    const t = at(1080)
    expect(t.peak / btn.peak).toBeGreaterThan(0.3)
    expect(t.peak / btn.peak).toBeLessThan(1.2)
    expect(t.rms / btn.rms).toBeGreaterThan(0.3)
    expect(t.rms / btn.rms).toBeLessThan(1.2)
  })
  test('the tick stays in the background: not louder than half the apple and a third of death (peak)', () => {
    const appleGain = 0.6 // config.json → sound.blips.eat.gain
    const deathGain = 0.85 // config.json → sound.blips.death.gain
    expect(at(1080).peak).toBeLessThan(0.5 * appleGain * bus)
    expect(at(1080).peak).toBeLessThan(0.34 * deathGain * bus)
  })
  test('at the fastest pace the tick is not quieter than 0.25 of the starting one (peak and RMS)', () => {
    for (const ms of [540, 360, 180]) {
      expect(at(ms).peak / at(1080).peak).toBeGreaterThanOrEqual(0.25)
      expect(at(ms).rms / at(1080).rms).toBeGreaterThanOrEqual(0.25)
    }
  })
  test('at the boost limit the tick is not quieter than 0.02 at the output (it dropped to 0.0075 - "inaudible at all")', () => {
    expect(at(180).peak).toBeGreaterThanOrEqual(0.02)
    expect(at(180).rms).toBeGreaterThanOrEqual(0.004)
  })
  test('the tick has body: the audible part (down to -30 dB) is not shorter than 30 ms', () => {
    for (const ms of [1080, 360, 180]) expect(at(ms).audibleMs).toBeGreaterThanOrEqual(30)
  })
  test('loudness decreases monotonically with pace, without upward jumps', () => {
    let prev = Infinity
    for (const ms of [1080, 900, 720, 540, 360, 180]) {
      const p = at(ms).peak
      expect(p).toBeLessThanOrEqual(prev)
      prev = p
    }
  })
  test('the audible body does not overlap the next voiced tick', () => {
    // Nearest voiced ticks: a 300 ms step without skipping or every other one at fast pace (2 x 180 = 360).
    const nearest = Math.min(tick.speed.skipBelowStepMs, tick.speed.skipEvery * 180)
    expect(at(180).audibleMs).toBeLessThan(nearest)
    expect(tick.attackMs + tick.decayMs).toBeLessThanOrEqual(nearest)
    expect(tick.minGapMs).toBeGreaterThanOrEqual(90)
  })
})
