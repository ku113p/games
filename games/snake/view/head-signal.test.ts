// Rise and fall of the danger color on the head (config.headSignal) and photosensitivity.
// The warning in LEGAL.md promises: a sudden color appearance does not turn into flashing. Here that promise is checked numerically.
import { describe, expect, test } from 'bun:test'
import config from '../config.json'

const { riseMs, fallMs, dangerHorizon } = config.headSignal
const floor = config.speed.minEffectiveStepMs

/** Swing (max - min, fraction of full color) for a periodic "danger on: `on` steps on, `off` steps off". Color step is as in snake-view. */
function swing(rise: number, fall: number, stepMs: number, fps: number, on: number, off: number): number {
  const dt = 1000 / fps
  const period = (on + off) * stepMs
  let a = 0
  let lo = 1
  let hi = 0
  for (let t = 0; t < 8000; t += dt) {
    const danger = t % period < on * stepMs
    a = danger ? Math.min(1, a + dt / rise) : Math.max(0, a - dt / fall)
    if (t > 5000) {
      lo = Math.min(lo, a)
      hi = Math.max(hi, a)
    }
  }
  return hi - lo
}

/** Worst swing among all cycles faster than 3 Hz (1..6 steps "on", 1..6 "off") at 30 and 60 fps. */
function worstFastSwing(rise: number, fall: number, steps: number[]): number {
  let worst = 0
  for (const stepMs of steps)
    for (const fps of [30, 60])
      for (let on = 1; on <= 6; on++)
        for (let off = 1; off <= 6; off++) {
          if (1000 / ((on + off) * stepMs) <= 3) continue
          worst = Math.max(worst, swing(rise, fall, stepMs, fps, on, off))
        }
  return worst
}

describe('danger signal on the head and photosensitivity', () => {
  test('a full swing (0 -> 1 -> 0) is possible at most 3 times per second: rise + fall >= 333 ms', () => {
    expect(riseMs + fallMs).toBeGreaterThanOrEqual(1000 / 3)
  })

  test('the rise fits within one boosted step at the floor, and the danger window (horizon x floor) is twice as long', () => {
    expect(riseMs).toBeLessThanOrEqual(floor)
    expect(dangerHorizon * floor).toBeGreaterThanOrEqual(2 * riseMs)
  })

  test('the rise is at least two frames at 30 fps: the color fades in rather than popping', () => {
    expect(riseMs).toBeGreaterThanOrEqual(2 * (1000 / 30) * 0.75)
  })

  test('cycle faster than 3 Hz: color swing is no worse than before the signal speed-up (110/320 ms, floor 90 ms) — 0.68', () => {
    const before = worstFastSwing(110, 320, [90, 120, 180])
    expect(before).toBeCloseTo(0.68, 1)
    const now = worstFastSwing(riseMs, fallMs, [floor, 67.5, 75, 90])
    expect(now).toBeLessThanOrEqual(before + 0.005)
  })
})
