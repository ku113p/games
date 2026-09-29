import { describe, expect, test } from 'bun:test'
import { availableBoostFactors, createGame, isValidBoostFactor, type Config } from './rules'
import { setBoost, startGame, tick } from './commands'
import { effectiveStepMs } from './state'
import { effectiveBoostFactor, getBoostFactor } from './queries'
import { config } from './test-helpers'

// Тестовый конфиг: startStepMs 180 (helpers), boostFactor 2. Список ×2/×3/×4/×8 дублирует будущий
// config.speed.boostFactors — файл конфига в этой задаче не правится.
const cfg = { ...config, speed: { ...config.speed, boostFactors: [2, 3, 4, 8] } }

/** Партия с множителем f; зажать ускорение, дойти до границы шага — дальше шаг идёт в темпе множителя. */
function boosted(f: number | undefined) {
  const s = f === undefined ? createGame(cfg, 20, 1, false) : createGame(cfg, 20, 1, false, f)
  startGame(s)
  setBoost(s, true)
  for (let i = 0; i < 4; i++) tick(s, cfg, 50) // 200 мс > 180: первый шаг сделан, ускорение действует
  return s
}

describe('множитель ускорения партии', () => {
  test('по умолчанию — config.speed.boostFactor', () => {
    const s = boosted(undefined)
    expect(getBoostFactor(s)).toBe(2)
    expect(effectiveStepMs(s)).toBe(s.stepMs / 2)
  })

  test.each([1, 2, 3, 4, 8])('×%i: длительность шага = stepMs / множитель', (f) => {
    const s = boosted(f)
    expect(getBoostFactor(s)).toBe(f)
    expect(effectiveStepMs(s)).toBeCloseTo(s.stepMs / f, 9)
  })

  test('до границы шага темп прежний, ускорение не действует', () => {
    const s = createGame(cfg, 20, 1, false, 8)
    startGame(s)
    setBoost(s, true)
    expect(effectiveStepMs(s)).toBe(s.stepMs)
  })

  test('шагов за то же время ровно во столько раз больше, во сколько множитель', () => {
    const count = (f: number) => {
      const s = createGame(cfg, 100, 1, false, f)
      startGame(s)
      setBoost(s, true)
      tick(s, cfg, 10) // маленький кадр, чтобы ничто не упёрлось в потолок
      s.boosting = true // условие сравнения: ускорение уже действует с первого шага
      s.sinceStepMs = 0
      const before = s.stepCount
      for (let i = 0; i < 24; i++) tick(s, cfg, 15) // 360 мс
      return s.stepCount - before
    }
    expect(count(2)).toBe(4)
    expect(count(4)).toBe(8)
    expect(count(8)).toBe(16)
  })

  test('×1 валиден: ускорение включается, но темп не меняется', () => {
    const s = boosted(1)
    expect(effectiveStepMs(s)).toBe(s.stepMs)
  })

  test('негодный множитель (NaN, 0, отрицательный, <1, Infinity) становится ×1 и не ломает цикл', () => {
    for (const bad of [Number.NaN, 0, -3, 0.5, Infinity]) {
      const s = boosted(bad)
      expect(getBoostFactor(s)).toBe(1)
      expect(effectiveStepMs(s)).toBe(s.stepMs)
      expect(s.phase).toBe('running')
    }
  })

  test('детерминизм: та же партия с ×8 даёт тот же результат', () => {
    const run = () => {
      const s = createGame(cfg, 20, 9, false, 8)
      startGame(s)
      setBoost(s, true)
      for (let i = 0; i < 80; i++) tick(s, cfg, 16)
      return JSON.stringify({ h: s.snake, p: s.phase, st: s.stepCount })
    }
    expect(run()).toBe(run())
  })

  test('потолок шагов за кадр учитывает ×8: длинный кадр не даёт бесконечный цикл', () => {
    const s = createGame(cfg, 100, 1, false, 8)
    startGame(s)
    setBoost(s, true)
    tick(s, cfg, 200)
    const before = s.stepCount
    tick(s, cfg, 100000)
    expect(s.stepCount - before).toBeLessThanOrEqual(Math.ceil(cfg.loop.maxFrameMs / (s.stepMs / 8)) + 1)
  })
})

describe('список множителей из конфига', () => {
  test('берётся из speed.boostFactors как есть', () => {
    expect(availableBoostFactors(cfg)).toEqual([2, 3, 4, 8])
  })
  test('нет списка — единственный boostFactor; негодные отбрасываются', () => {
    expect(availableBoostFactors(config)).toEqual([2])
    const dirty = { ...config, speed: { ...config.speed, boostFactors: [0, 3, Number.NaN, 0.5, 8] } }
    expect(availableBoostFactors(dirty)).toEqual([3, 8])
    const empty = { ...config, speed: { ...config.speed, boostFactors: [] } }
    expect(availableBoostFactors(empty)).toEqual([2])
  })
  test('isValidBoostFactor', () => {
    expect(isValidBoostFactor(1)).toBe(true)
    expect(isValidBoostFactor(8)).toBe(true)
    expect(isValidBoostFactor(0.99)).toBe(false)
    expect(isValidBoostFactor(Number.NaN)).toBe(false)
  })
})

describe('пол на длительность ускоренного шага (config.speed.minEffectiveStepMs)', () => {
  const floored = { ...cfg, speed: { ...cfg.speed, minEffectiveStepMs: 90 } }
  const at = (f: number, stepMs: number, c: Config = floored) => {
    const s = createGame(c, 20, 1, false, f)
    startGame(s)
    s.stepMs = stepMs
    setBoost(s, true)
    s.boosting = true
    return s
  }

  test('выше пола ничего не меняется: 360 мс ×4 = 90 мс', () => {
    expect(effectiveStepMs(at(4, 360))).toBe(90)
    expect(effectiveStepMs(at(3, 360))).toBe(120)
  })

  test('×8 на 360 мс упирается в пол: 90 мс, как ×4; эффективный множитель 4', () => {
    const s8 = at(8, 360)
    expect(effectiveStepMs(s8)).toBe(90)
    expect(effectiveStepMs(s8)).toBe(effectiveStepMs(at(4, 360)))
    expect(effectiveBoostFactor(s8)).toBe(4)
    expect(getBoostFactor(s8)).toBe(8)
  })

  test('на медленном старте ×8 ещё отличается от ×4', () => {
    expect(effectiveStepMs(at(8, 1080))).toBe(135)
    expect(effectiveStepMs(at(4, 1080))).toBe(270)
    expect(effectiveBoostFactor(at(8, 1080))).toBe(8)
  })

  test('без ускорения пол не действует, ускорение не делает шаг длиннее обычного', () => {
    const s = createGame(floored, 20, 1, false, 8)
    startGame(s)
    s.stepMs = 60 // базовый темп ниже пола
    expect(effectiveStepMs(s)).toBe(60)
    s.boosting = true
    expect(effectiveStepMs(s)).toBe(60)
  })

  test('нет пола в конфиге — прежнее поведение', () => {
    expect(effectiveStepMs(at(8, 360, cfg))).toBe(45)
  })

  test('в игре: за те же 900 мс на ×8 шагов ровно столько же, сколько на ×4', () => {
    const run = (f: number) => {
      const s = createGame(floored, 100, 1, false, f)
      startGame(s)
      s.stepMs = 360
      setBoost(s, true)
      s.boosting = true
      s.sinceStepMs = 0
      const before = s.stepCount
      for (let i = 0; i < 60; i++) tick(s, floored, 15)
      return s.stepCount - before
    }
    expect(run(8)).toBe(run(4))
  })
})
