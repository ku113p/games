import { describe, expect, test } from 'bun:test'
import { CROSS_STRENGTH, CROSS_LIFT_APPLE, CROSS_LIFT_OBSTACLE, inCrossPlane } from './cross-planes'

describe('крест: что лежит в плоскости', () => {
  test('клетка на высоте головы (та же Y) — в горизонтальной плите', () => {
    expect(inCrossPlane(5, 1, 5, 9)).toBe(true)
  })
  test('клетка на том же Z — в вертикальной плите', () => {
    expect(inCrossPlane(1, 9, 5, 9)).toBe(true)
  })
  test('клетка со сдвигом по обеим осям — вне креста', () => {
    expect(inCrossPlane(6, 8, 5, 9)).toBe(false)
  })
  test('подсветка сдержанная: доли, а не многократный подъём', () => {
    expect(CROSS_STRENGTH).toBeGreaterThanOrEqual(0)
    expect(CROSS_LIFT_OBSTACLE).toBeLessThanOrEqual(0.5)
    expect(CROSS_LIFT_APPLE).toBeLessThanOrEqual(0.25)
  })
})
