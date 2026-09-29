// Нарастание и спад цвета опасности на голове (config.headSignal) и светочувствительность.
// Предупреждение в LEGAL.md обещает: резкое появление цвета не превращается в мигание. Здесь это обещание проверяется числом.
import { describe, expect, test } from 'bun:test'
import config from '../config.json'

const { riseMs, fallMs, dangerHorizon } = config.headSignal
const floor = config.speed.minEffectiveStepMs

/** Размах (макс - мин, доля полного цвета) при периодическом «опасность on шагов вкл, off шагов выкл». Шаг цвета — как в snake-view. */
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

/** Худший размах среди всех циклов чаще 3 Гц (1..6 шагов «вкл», 1..6 «выкл») на 30 и 60 к/с. */
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

describe('сигнал опасности на голове и светочувствительность', () => {
  test('полный размах (0 -> 1 -> 0) возможен не чаще 3 раз в секунду: нарастание + спад >= 333 мс', () => {
    expect(riseMs + fallMs).toBeGreaterThanOrEqual(1000 / 3)
  })

  test('нарастание укладывается в один ускоренный шаг на полу, а окно опасности (горизонт x пол) вдвое длиннее', () => {
    expect(riseMs).toBeLessThanOrEqual(floor)
    expect(dangerHorizon * floor).toBeGreaterThanOrEqual(2 * riseMs)
  })

  test('нарастание не короче двух кадров на 30 к/с: цвет проявляется, а не выскакивает', () => {
    expect(riseMs).toBeGreaterThanOrEqual(2 * (1000 / 30) * 0.75)
  })

  test('цикл чаще 3 Гц: размах цвета не хуже, чем был до ускорения сигнала (110/320 мс, пол 90 мс) — 0.68', () => {
    const before = worstFastSwing(110, 320, [90, 120, 180])
    expect(before).toBeCloseTo(0.68, 1)
    const now = worstFastSwing(riseMs, fallMs, [floor, 67.5, 75, 90])
    expect(now).toBeLessThanOrEqual(before + 0.005)
  })
})
