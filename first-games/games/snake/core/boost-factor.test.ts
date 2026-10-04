import { describe, expect, test } from 'bun:test'
import { availableBoostFactors, createGame, isValidBoostFactor, type Config } from './rules'
import { setBoost, startGame, tick } from './commands'
import { effectiveStepMs } from './state'
import { effectiveBoostFactor, getBoostFactor } from './queries'
import { config } from './test-helpers'

// Test config: startStepMs 180 (helpers), boostFactor 2. The ×2/×3/×4 list mirrors config.speed.boostFactors.
const cfg = { ...config, speed: { ...config.speed, boostFactors: [2, 3, 4] } }

/** A game with factor f; hold boost, reach the step boundary; from then on the step runs at the factor's pace. */
function boosted(f: number | undefined) {
  const s = f === undefined ? createGame(cfg, 20, 1, false) : createGame(cfg, 20, 1, false, f)
  startGame(s)
  setBoost(s, true)
  for (let i = 0; i < 4; i++) tick(s, cfg, 50) // 200 ms > 180: the first step is done, boost is active
  return s
}

describe('game boost factor', () => {
  test('defaults to config.speed.boostFactor', () => {
    const s = boosted(undefined)
    expect(getBoostFactor(s)).toBe(2)
    expect(effectiveStepMs(s)).toBe(s.stepMs / 2)
  })

  test.each([1, 2, 3, 4])('×%i: step duration = stepMs / factor', (f) => {
    const s = boosted(f)
    expect(getBoostFactor(s)).toBe(f)
    expect(effectiveStepMs(s)).toBeCloseTo(s.stepMs / f, 9)
  })

  test('before the step boundary the pace is unchanged, boost is not active', () => {
    const s = createGame(cfg, 20, 1, false, 4)
    startGame(s)
    setBoost(s, true)
    expect(effectiveStepMs(s)).toBe(s.stepMs)
  })

  test('in the same time there are exactly as many times more steps as the factor', () => {
    const count = (f: number) => {
      const s = createGame(cfg, 100, 1, false, f)
      startGame(s)
      setBoost(s, true)
      tick(s, cfg, 10) // small frame so that nothing hits the cap
      s.boosting = true // comparison condition: boost is already active from the first step
      s.sinceStepMs = 0
      const before = s.stepCount
      for (let i = 0; i < 24; i++) tick(s, cfg, 15) // 360 ms
      return s.stepCount - before
    }
    expect(count(2)).toBe(4)
    expect(count(4)).toBe(8)
  })

  test('×1 is valid: boost turns on but the pace does not change', () => {
    const s = boosted(1)
    expect(effectiveStepMs(s)).toBe(s.stepMs)
  })

  test('an invalid factor (NaN, 0, negative, <1, Infinity) becomes ×1 and does not break the loop', () => {
    for (const bad of [Number.NaN, 0, -3, 0.5, Infinity]) {
      const s = boosted(bad)
      expect(getBoostFactor(s)).toBe(1)
      expect(effectiveStepMs(s)).toBe(s.stepMs)
      expect(s.phase).toBe('running')
    }
  })

  test('determinism: the same game with ×4 gives the same result', () => {
    const run = () => {
      const s = createGame(cfg, 20, 9, false, 4)
      startGame(s)
      setBoost(s, true)
      for (let i = 0; i < 80; i++) tick(s, cfg, 16)
      return JSON.stringify({ h: s.snake, p: s.phase, st: s.stepCount })
    }
    expect(run()).toBe(run())
  })

  test('the per-frame step cap accounts for ×4: a long frame does not cause an infinite loop', () => {
    const s = createGame(cfg, 100, 1, false, 4)
    startGame(s)
    setBoost(s, true)
    tick(s, cfg, 200)
    const before = s.stepCount
    tick(s, cfg, 100000)
    expect(s.stepCount - before).toBeLessThanOrEqual(Math.ceil(cfg.loop.maxFrameMs / (s.stepMs / 4)) + 1)
  })
})

describe('factor list from config', () => {
  test('taken from speed.boostFactors as is', () => {
    expect(availableBoostFactors(cfg)).toEqual([2, 3, 4])
  })
  test('no list: the single boostFactor; invalid values are dropped', () => {
    expect(availableBoostFactors(config)).toEqual([2])
    const dirty = { ...config, speed: { ...config.speed, boostFactors: [0, 3, Number.NaN, 0.5, 4] } }
    expect(availableBoostFactors(dirty)).toEqual([3, 4])
    const empty = { ...config, speed: { ...config.speed, boostFactors: [] } }
    expect(availableBoostFactors(empty)).toEqual([2])
  })
  test('isValidBoostFactor', () => {
    expect(isValidBoostFactor(1)).toBe(true)
    expect(isValidBoostFactor(4)).toBe(true)
    expect(isValidBoostFactor(0.99)).toBe(false)
    expect(isValidBoostFactor(Number.NaN)).toBe(false)
  })
})

describe('floor on the boosted step duration (config.speed.minEffectiveStepMs)', () => {
  const floored = { ...cfg, speed: { ...cfg.speed, minEffectiveStepMs: 90 } }
  const at = (f: number, stepMs: number, c: Config = floored) => {
    const s = createGame(c, 20, 1, false, f)
    startGame(s)
    s.stepMs = stepMs
    setBoost(s, true)
    s.boosting = true
    return s
  }

  test('above the floor nothing changes: 360 ms ×4 = 90 ms', () => {
    expect(effectiveStepMs(at(4, 360))).toBe(90)
    expect(effectiveStepMs(at(3, 360))).toBe(120)
  })

  test('×4 on 240 ms hits the floor: 90 ms, same as ×3; effective factor 240/90', () => {
    const s4 = at(4, 240)
    expect(effectiveStepMs(s4)).toBe(90)
    expect(effectiveStepMs(s4)).toBe(effectiveStepMs(at(3, 240)))
    expect(effectiveBoostFactor(s4)).toBeCloseTo(240 / 90, 9)
    expect(getBoostFactor(s4)).toBe(4)
  })

  test('on a slow start the floor does not interfere: ×4 on 1080 ms gives 270, effective factor 4', () => {
    expect(effectiveStepMs(at(4, 1080))).toBe(270)
    expect(effectiveBoostFactor(at(4, 1080))).toBe(4)
  })

  test('without boost the floor does not apply, boost never makes a step longer than normal', () => {
    const s = createGame(floored, 20, 1, false, 4)
    startGame(s)
    s.stepMs = 60 // base pace is below the floor
    expect(effectiveStepMs(s)).toBe(60)
    s.boosting = true
    expect(effectiveStepMs(s)).toBe(60)
  })

  test('no floor in config: the old behavior', () => {
    expect(effectiveStepMs(at(4, 180, cfg))).toBe(45)
  })

  test('in game: in the same time ×4 makes exactly as many steps as ×3 when both hit the floor', () => {
    const run = (f: number) => {
      const s = createGame(floored, 100, 1, false, f)
      startGame(s)
      s.stepMs = 240
      setBoost(s, true)
      s.boosting = true
      s.sinceStepMs = 0
      const before = s.stepCount
      for (let i = 0; i < 60; i++) tick(s, floored, 15)
      return s.stepCount - before
    }
    expect(run(4)).toBe(run(3))
  })
})
