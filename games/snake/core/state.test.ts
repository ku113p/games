import { describe, expect, test } from 'bun:test'
import { cellKey, nextRandom, type GameState } from './state'

function makeMinimalState(rngState: number): GameState {
  return {
    size: 10,
    snake: [],
    snakeCells: new Set(),
    obstacles: new Set(),
    apple: { x: 0, y: 0, z: 0 },
    heading: { x: 1, y: 0, z: 0 },
    frame: {
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      depth: { x: 0, y: 0, z: 1 },
    },
    pendingTurn: null,
    rolledSinceStep: false,
    mode: 'plane',
    stepCount: 0,
    growth: 0,
    phase: 'ready',
    score: 0,
    applesEaten: 0,
    stepMs: 180,
    boostRequested: false,
    boosting: false,
    boostFactor: 2,
    sinceStepMs: 0,
    elapsedMs: 0,
    demoTurnPending: false,
    rngState,
  }
}

describe('cellKey', () => {
  test('roundtrips distinct coordinates to distinct keys within bounds', () => {
    const size = 8
    const seen = new Set<number>()
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const key = cellKey(x, y, z, size)
          expect(seen.has(key)).toBe(false)
          seen.add(key)
        }
      }
    }
    expect(seen.size).toBe(size * size * size)
  })

  test('decodes back to original coordinates', () => {
    const size = 20
    const x = 3
    const y = 17
    const z = 9
    const key = cellKey(x, y, z, size)
    expect(key % size).toBe(x)
    expect(Math.floor(key / size) % size).toBe(y)
    expect(Math.floor(key / (size * size))).toBe(z)
  })
})

describe('nextRandom', () => {
  test('mutates rngState', () => {
    const s = makeMinimalState(42)
    const before = s.rngState
    nextRandom(s)
    expect(s.rngState).not.toBe(before)
  })

  test('returns values in [0, 1)', () => {
    const s = makeMinimalState(1)
    for (let i = 0; i < 1000; i++) {
      const v = nextRandom(s)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  test('is deterministic for the same seed', () => {
    const a = makeMinimalState(12345)
    const b = makeMinimalState(12345)
    const seqA = Array.from({ length: 50 }, () => nextRandom(a))
    const seqB = Array.from({ length: 50 }, () => nextRandom(b))
    expect(seqA).toEqual(seqB)
  })

  test('differs for different seeds', () => {
    const a = makeMinimalState(1)
    const b = makeMinimalState(2)
    const seqA = Array.from({ length: 10 }, () => nextRandom(a))
    const seqB = Array.from({ length: 10 }, () => nextRandom(b))
    expect(seqA).not.toEqual(seqB)
  })
})
