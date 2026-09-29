// Balance numbers from the REAL config.json (not from test-helpers): the boost ladder and the 5³ arena.
import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { createGame, spawnApple, speedAfterApples, type Config } from '../core/rules'
import { setBoost, startGame } from '../core/commands'
import { boostedStepMs, cellKey, effectiveStepMs } from '../core/state'
import { effectiveBoostFactor } from '../core/queries'
import { config as helperConfig } from '../core/test-helpers'

const cfg = { ...helperConfig, ...configJson, hints: helperConfig.hints, camera: helperConfig.camera } as unknown as Config

const PACES = [1.5, 1, 0.75, 0.5] as const

/** Boosted step at the bottom of the pace curve: what the player actually gets on a sped-up snake. */
function floorStep(pace: number, factor: number): number {
  const s = createGame(cfg, 20, 1, false, factor, { paceScale: pace })
  startGame(s)
  s.stepMs = speedAfterApples(cfg, 10_000, pace)
  setBoost(s, true)
  s.boosting = true
  return effectiveStepMs(s)
}

describe('boost ladder at the bottom of the curve (config.speed.minEffectiveStepMs)', () => {
  const floor = configJson.speed.minEffectiveStepMs

  test('boosted-step floor is 60 ms, the head signal keeps up: the rise is no longer than the floor', () => {
    expect(floor).toBe(60)
    expect(configJson.headSignal.riseMs).toBeLessThanOrEqual(floor)
  })

  test('on Calm, Normal and Fast all ×2…×4 tiers differ', () => {
    for (const pace of [1.5, 1, 0.75]) {
      const steps = [2, 3, 4].map((f) => floorStep(pace, f))
      expect(new Set(steps).size).toBe(steps.length)
    }
  })

  test('on Normal the bottom is: ×2 180, ×3 120, ×4 90 ms', () => {
    expect([2, 3, 4].map((f) => floorStep(1, f))).toEqual([180, 120, 90])
  })

  test('on Fast ×4 is 67.5 ms, still above the floor; on Very fast ×3 and ×4 hit the 60 ms floor', () => {
    expect(floorStep(0.75, 4)).toBe(67.5)
    expect(floorStep(0.5, 3)).toBe(60)
    expect(floorStep(0.5, 4)).toBe(60)
  })

  test('a boosted step is never shorter than the floor nor longer than the normal one', () => {
    for (const pace of PACES)
      for (const f of configJson.speed.boostFactors) {
        const normal = speedAfterApples(cfg, 10_000, pace)
        const b = floorStep(pace, f)
        expect(b).toBeGreaterThanOrEqual(Math.min(floor, normal))
        expect(b).toBeLessThanOrEqual(normal)
      }
  })

  test('the effective factor on Very fast ×4 is ×3, not ×4', () => {
    const s = createGame(cfg, 20, 1, false, 4, { paceScale: 0.5 })
    s.stepMs = speedAfterApples(cfg, 10_000, 0.5)
    expect(effectiveBoostFactor(s)).toBe(3)
    expect(boostedStepMs(s)).toBe(60)
  })
})

describe('arena 5³', () => {
  const MULTS = [0, 0.25, 0.5, 1, 2]

  test('5 is in config.cube.sizes, the default is still 20', () => {
    expect(configJson.cube.sizes).toContain(5)
    expect(configJson.cube.default).toBe(20)
  })

  test('there are no obstacles in 5³ at any density: the clear zone around the head (radius 4) covers the whole cube', () => {
    expect(configJson.obstacles.clearRadius).toBeGreaterThanOrEqual(Math.floor(5 / 2))
    for (const m of MULTS)
      for (let seed = 1; seed <= 100; seed++) expect(createGame(cfg, 5, seed, false, 2, { obstacleMult: m }).obstacles.size).toBe(0)
  })

  test('at the start the snake is not boxed in, the apple is free and not in the snake', () => {
    for (const m of MULTS)
      for (let seed = 1; seed <= 100; seed++) {
        const s = createGame(cfg, 5, seed, false, 2, { obstacleMult: m })
        const h = s.snake[0]!
        expect(h.x).toBe(2)
        expect(s.snakeCells.has(cellKey(s.apple.x, s.apple.y, s.apple.z, 5))).toBe(false)
        expect(s.obstacles.has(cellKey(s.apple.x, s.apple.y, s.apple.z, 5))).toBe(false)
        // to the wall along the heading - two free cells: there is time for the first turn
        expect(5 - 1 - h.x).toBe(2)
      }
  })

  test('the apple finds the last free cell of an almost full cube', () => {
    const s = createGame(cfg, 5, 7, false, 2)
    s.snake = []
    s.snakeCells.clear()
    let last = -1
    for (let i = 0; i < 125; i++) {
      if (i === 77) {
        last = i
        continue
      }
      s.snakeCells.add(i)
    }
    spawnApple(s)
    expect(cellKey(s.apple.x, s.apple.y, s.apple.z, 5)).toBe(last)
  })
})
