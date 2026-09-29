import { describe, expect, test } from 'bun:test'
import { createGame, speedAfterApples } from './rules'
import { startGame, tick } from './commands'
import { config, makeState } from './test-helpers'

const cfg = { ...config, obstacles: { ...config.obstacles, density: 0.02 } }
const count = (s: { obstacles: Set<number> }) => s.obstacles.size

describe('game obstacle multiplier', () => {
  test('×0: no obstacles at all', () => {
    expect(count(createGame(cfg, 20, 7, false, 2, { obstacleMult: 0 }))).toBe(0)
  })

  test('count grows with the multiplier: ×1/4 < ×1/2 < ×1 < ×2', () => {
    const n = (m: number) => count(createGame(cfg, 50, 7, false, 2, { obstacleMult: m }))
    const [a, b, c, d] = [n(0.25), n(0.5), n(1), n(2)]
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
    expect(c).toBeLessThan(d)
  })

  test('without options, exactly like ×1 and like before', () => {
    const base = createGame(cfg, 20, 3, false)
    const one = createGame(cfg, 20, 3, false, 2, { obstacleMult: 1 })
    expect([...base.obstacles].sort()).toEqual([...one.obstacles].sort())
  })

  test('determinism: same seed and multiplier give the same arena', () => {
    const a = createGame(cfg, 20, 11, false, 2, { obstacleMult: 2 })
    const b = createGame(cfg, 20, 11, false, 2, { obstacleMult: 2 })
    expect([...a.obstacles]).toEqual([...b.obstacles])
    expect(a.apple).toEqual(b.apple)
  })

  test('no dead zones at ×2 either', () => {
    const s = createGame(cfg, 20, 5, false, 2, { obstacleMult: 2 })
    expect(s.obstacles.size).toBeGreaterThan(0)
  })

  test.each([Number.NaN, -1, Infinity])('invalid multiplier %p behaves as ×1', (bad) => {
    const base = createGame(cfg, 20, 3, false)
    const s = createGame(cfg, 20, 3, false, 2, { obstacleMult: bad })
    expect(count(s)).toBe(count(base))
  })
})

describe('game pace scale', () => {
  test('scales the initial step and the whole curve', () => {
    for (const k of [0.5, 1, 1.5]) {
      const s = createGame(cfg, 20, 1, false, 2, { paceScale: k })
      expect(s.stepMs).toBeCloseTo(cfg.speed.startStepMs * k, 9)
      expect(speedAfterApples(cfg, 1000, k)).toBeCloseTo(cfg.speed.minStepMs * k, 9)
    }
  })

  test('the apple at which the minimum is reached does not depend on the scale', () => {
    const at = (k: number) => {
      let n = 0
      while (speedAfterApples(cfg, n, k) > speedAfterApples(cfg, 1e6, k)) n++
      return n
    }
    expect(at(0.5)).toBe(at(1))
    expect(at(1.5)).toBe(at(1))
  })

  test('in game: an eaten apple sets the scaled step', () => {
    const s = makeState({ paceScale: 2, stepMs: 360, heading: { x: 1, y: 0, z: 0 }, apple: { x: 11, y: 10, z: 10 }, boostRequested: false })
    s.sinceStepMs = 0
    s.sinceStepMs = 355
    tick(s, cfg, 10)
    expect(s.applesEaten).toBe(1)
    expect(s.stepMs).toBe(speedAfterApples(cfg, 1, 2))
  })

  test.each([Number.NaN, 0, -2, Infinity])('invalid scale %p behaves as ×1', (bad) => {
    expect(createGame(cfg, 20, 1, false, 2, { paceScale: bad }).stepMs).toBe(cfg.speed.startStepMs)
  })

  test('startGame does not break with a scale', () => {
    const s = createGame(cfg, 20, 1, false, 2, { paceScale: 0.5 })
    expect(() => startGame(s)).not.toThrow()
  })
})
