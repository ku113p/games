import { describe, expect, test } from 'bun:test'
import { COMPASS_ALPHA, COMPASS_FULL_DIST_FALLBACK, COMPASS_HIDE_DIST_FALLBACK, compassAlpha } from './compass-view'

const H = COMPASS_HIDE_DIST_FALLBACK
const F = COMPASS_FULL_DIST_FALLBACK

describe('compassAlpha', () => {
  test('вплотную (до hide) стрелка скрыта', () => {
    expect(compassAlpha(0.5, H, F, 1)).toBe(0)
    expect(compassAlpha(H, H, F, 1)).toBe(0)
  })
  test('с full и дальше — полная яркость, не тускнеет с расстоянием', () => {
    expect(compassAlpha(F, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
    expect(compassAlpha(6, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
    expect(compassAlpha(60, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
  })
  test('между hide и full растёт монотонно', () => {
    let prev = 0
    for (let d = H; d <= F; d += 0.1) {
      const a = compassAlpha(d, H, F, 1)
      expect(a).toBeGreaterThanOrEqual(prev)
      prev = a
    }
  })
  test('окно уже прежнего 3..8: на 4 клетках уже полная яркость', () => {
    expect(compassAlpha(4, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
  })
  test('в plane (freeAmount 0) скрыта при любом расстоянии; в free множитель равен 1', () => {
    expect(compassAlpha(20, H, F, 0)).toBe(0)
    expect(compassAlpha(20, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
  })
})
