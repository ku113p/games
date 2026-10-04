import { describe, expect, test } from 'bun:test'
import { createRng, nextFloat, nextInt } from './random'

describe('seeded random', () => {
  test('the same seed gives the same sequence', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 100; i++) expect(nextFloat(a)).toBe(nextFloat(b))
  })
  test('floats stay in [0, 1) and ints in their range', () => {
    const r = createRng(7)
    for (let i = 0; i < 10000; i++) {
      const f = nextFloat(r)
      expect(f >= 0 && f < 1).toBe(true)
      const n = nextInt(r, -2, 3)
      expect(n >= -2 && n <= 3).toBe(true)
    }
  })
})
