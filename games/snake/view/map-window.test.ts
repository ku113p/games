import { describe, expect, test } from 'bun:test'
import {
  clampToWindow,
  inWindow,
  isMajorTick,
  isInWindow,
  levelFraction,
  touchesHighWall,
  touchesLowWall,
  windowFraction,
  windowLength,
  windowStart,
} from './map-window'

const W = 20

describe('windowStart / windowLength', () => {
  test('arena smaller than the window: window equals the arena, no scrolling', () => {
    expect(windowLength(12, W)).toBe(12)
    for (let h = 0; h < 12; h++) expect(windowStart(h, 12, W)).toBe(0)
  })

  test('arena exactly 20: window covers the whole arena, no scrolling', () => {
    expect(windowLength(20, W)).toBe(20)
    for (let h = 0; h < 20; h++) expect(windowStart(h, 20, W)).toBe(0)
  })

  test('pressed against the bottom wall: window stays, marker moves', () => {
    for (let h = 0; h <= 10; h++) expect(windowStart(h, 100, W)).toBe(0)
    expect(inWindow(3, 0)).toBe(3)
  })

  test('pressed against the top wall: window stays, marker moves', () => {
    for (let h = 90; h < 100; h++) expect(windowStart(h, 100, W)).toBe(80)
    expect(inWindow(99, 80)).toBe(19)
  })

  test('middle of the arena: marker in the center, window travels with the head', () => {
    for (let h = 11; h < 90; h++) {
      const s = windowStart(h, 100, W)
      expect(s).toBe(h - 10)
      expect(inWindow(h, s)).toBe(10)
    }
  })

  test('window moves 1 cell per head step, in whole cells', () => {
    for (let h = 0; h < 99; h++) {
      const d = windowStart(h + 1, 100, W) - windowStart(h, 100, W)
      expect(d === 0 || d === 1).toBe(true)
    }
  })

  test('marker never leaves the window, window never leaves the arena (all sizes)', () => {
    for (const size of [5, 20, 21, 50, 100]) {
      const len = windowLength(size, W)
      for (let h = 0; h < size; h++) {
        const s = windowStart(h, size, W)
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s + len).toBeLessThanOrEqual(size)
        const m = inWindow(h, s)
        expect(m).toBeGreaterThanOrEqual(0)
        expect(m).toBeLessThanOrEqual(len - 1)
      }
    }
  })

  test('a different window size is taken from the parameter', () => {
    expect(windowStart(50, 100, 10)).toBe(45)
    expect(windowLength(100, 10)).toBe(10)
  })
})

describe('walls and window edges', () => {
  test('arena <= window: both sides are real walls', () => {
    expect(touchesLowWall(0)).toBe(true)
    expect(touchesHighWall(0, 20, 20)).toBe(true)
    expect(touchesHighWall(0, 12, 12)).toBe(true)
  })

  test('at the bottom wall only the bottom side is a wall', () => {
    const s = windowStart(3, 100, W)
    expect(touchesLowWall(s)).toBe(true)
    expect(touchesHighWall(s, W, 100)).toBe(false)
  })

  test('at the top wall only the top side is a wall', () => {
    const s = windowStart(97, 100, W)
    expect(touchesLowWall(s)).toBe(false)
    expect(touchesHighWall(s, W, 100)).toBe(true)
  })

  test('in the middle of the arena both sides are just a window edge', () => {
    const s = windowStart(50, 100, W)
    expect(touchesLowWall(s)).toBe(false)
    expect(touchesHighWall(s, W, 100)).toBe(false)
  })
})

describe('apple relative to the window', () => {
  test('inside the window it stays in place', () => {
    expect(isInWindow(45, 40, 20)).toBe(true)
    expect(clampToWindow(45, 40, 20)).toBe(5)
  })

  test('outside the window it is clamped to the edge in its direction', () => {
    expect(isInWindow(10, 40, 20)).toBe(false)
    expect(clampToWindow(10, 40, 20)).toBe(0)
    expect(isInWindow(70, 40, 20)).toBe(false)
    expect(clampToWindow(70, 40, 20)).toBe(19)
  })

  test('window bounds: the last cell is inside, the next one is outside', () => {
    expect(isInWindow(59, 40, 20)).toBe(true)
    expect(isInWindow(60, 40, 20)).toBe(false)
    expect(isInWindow(39, 40, 20)).toBe(false)
  })
})

describe('levelFraction (level gauge)', () => {
  test('floor and ceiling: first and last cells at the edges, middle in the middle', () => {
    expect(levelFraction(0, 100)).toBeCloseTo(0.005)
    expect(levelFraction(99, 100)).toBeCloseTo(0.995)
    expect(levelFraction(49, 100)).toBeCloseTo(0.495)
    expect(levelFraction(0, 20)).toBeCloseTo(0.025)
  })

  test('independent of the window: grows monotonically over the whole height', () => {
    for (let y = 1; y < 50; y++) expect(levelFraction(y, 50)).toBeGreaterThan(levelFraction(y - 1, 50))
  })
})

describe('level gauge window (windowFraction, isMajorTick)', () => {
  const L = 10
  test('head marker in the center of the window until walls are reached', () => {
    for (let h = 5; h <= 94; h++) {
      const s = windowStart(h, 100, L)
      expect(windowFraction(h, s, L)).toBeCloseTo(0.55, 10)
    }
  })

  test('one step = exactly one window cell regardless of arena size (at a wall the marker moves)', () => {
    for (const size of [20, 50, 100]) {
      for (let h = 0; h < size - 1; h++) {
        const a = windowFraction(h, windowStart(h, size, L), L)
        const b = windowFraction(h + 1, windowStart(h + 1, size, L), L)
        // In the middle the marker stays and the world moves by a cell; at a wall the marker moves by a cell. Always exactly one of them.
        const worldMove = windowStart(h + 1, size, L) - windowStart(h, size, L)
        const markMove = Math.round((b - a) * L)
        expect(Math.abs(worldMove - markMove)).toBe(1)
        expect(worldMove === 1 || markMove === 1).toBe(true)
      }
    }
  })

  test('floor in the window only at the floor, ceiling only at the ceiling', () => {
    expect(touchesLowWall(windowStart(2, 100, L))).toBe(true)
    expect(touchesLowWall(windowStart(50, 100, L))).toBe(false)
    expect(touchesHighWall(windowStart(97, 100, L), L, 100)).toBe(true)
    expect(touchesHighWall(windowStart(50, 100, L), L, 100)).toBe(false)
  })

  test('fraction of a cell outside the window goes beyond 0..1 (apple outside the window)', () => {
    expect(windowFraction(80, 40, L)).toBeGreaterThan(1)
    expect(windowFraction(30, 40, L)).toBeLessThan(0)
  })

  test('major ticks are tied to the world: multiples of N', () => {
    expect(isMajorTick(0, 5)).toBe(true)
    expect(isMajorTick(10, 5)).toBe(true)
    expect(isMajorTick(7, 5)).toBe(false)
  })
})
