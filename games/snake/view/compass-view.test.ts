import { describe, expect, test } from 'bun:test'
import { COMPASS_ALPHA, COMPASS_FULL_DIST_FALLBACK, COMPASS_HIDE_DIST_FALLBACK, compassAlpha } from './compass-view'

const H = COMPASS_HIDE_DIST_FALLBACK
const F = COMPASS_FULL_DIST_FALLBACK

describe('compassAlpha', () => {
  test('point-blank (below hide) the arrow is hidden', () => {
    expect(compassAlpha(0.5, H, F, 1)).toBe(0)
    expect(compassAlpha(H, H, F, 1)).toBe(0)
  })
  test('at full and beyond: full brightness, does not fade with distance', () => {
    expect(compassAlpha(F, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
    expect(compassAlpha(6, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
    expect(compassAlpha(60, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
  })
  test('between hide and full it grows monotonically', () => {
    let prev = 0
    for (let d = H; d <= F; d += 0.1) {
      const a = compassAlpha(d, H, F, 1)
      expect(a).toBeGreaterThanOrEqual(prev)
      prev = a
    }
  })
  test('window narrower than the old 3..8: already full brightness at 4 cells', () => {
    expect(compassAlpha(4, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
  })
  test('in plane (freeAmount 0) hidden at any distance; in free the multiplier is 1', () => {
    expect(compassAlpha(20, H, F, 0)).toBe(0)
    expect(compassAlpha(20, H, F, 1)).toBeCloseTo(COMPASS_ALPHA, 6)
  })
})
