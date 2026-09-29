// Числа баланса из НАСТОЯЩЕГО config.json (а не из test-helpers): лестница ускорений и арена 5³.
import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { createGame, spawnApple, speedAfterApples, type Config } from '../core/rules'
import { setBoost, startGame } from '../core/commands'
import { boostedStepMs, cellKey, effectiveStepMs } from '../core/state'
import { effectiveBoostFactor } from '../core/queries'
import { config as helperConfig } from '../core/test-helpers'

const cfg = { ...helperConfig, ...configJson, hints: helperConfig.hints, camera: helperConfig.camera } as unknown as Config

const PACES = [1.5, 1, 0.75, 0.5] as const

/** Ускоренный шаг на дне кривой темпа: то, что игрок реально получит на разогнавшейся змейке. */
function floorStep(pace: number, factor: number): number {
  const s = createGame(cfg, 20, 1, false, factor, { paceScale: pace })
  startGame(s)
  s.stepMs = speedAfterApples(cfg, 10_000, pace)
  setBoost(s, true)
  s.boosting = true
  return effectiveStepMs(s)
}

describe('лестница ускорений на дне кривой (config.speed.minEffectiveStepMs)', () => {
  const floor = configJson.speed.minEffectiveStepMs

  test('пол ускоренного шага — 60 мс, сигнал головы успевает: нарастание не длиннее пола', () => {
    expect(floor).toBe(60)
    expect(configJson.headSignal.riseMs).toBeLessThanOrEqual(floor)
  })

  test('на «Спокойном», «Обычном» и «Быстром» все ступени ×2…×4 различаются', () => {
    for (const pace of [1.5, 1, 0.75]) {
      const steps = [2, 3, 4].map((f) => floorStep(pace, f))
      expect(new Set(steps).size).toBe(steps.length)
    }
  })

  test('на «Обычном» дно: ×2 180, ×3 120, ×4 90 мс', () => {
    expect([2, 3, 4].map((f) => floorStep(1, f))).toEqual([180, 120, 90])
  })

  test('на «Быстром» ×4 — 67.5 мс, ещё выше пола; на «Очень быстром» ×3 и ×4 упираются в пол 60 мс', () => {
    expect(floorStep(0.75, 4)).toBe(67.5)
    expect(floorStep(0.5, 3)).toBe(60)
    expect(floorStep(0.5, 4)).toBe(60)
  })

  test('ускоренный шаг никогда не короче пола и не длиннее обычного', () => {
    for (const pace of PACES)
      for (const f of configJson.speed.boostFactors) {
        const normal = speedAfterApples(cfg, 10_000, pace)
        const b = floorStep(pace, f)
        expect(b).toBeGreaterThanOrEqual(Math.min(floor, normal))
        expect(b).toBeLessThanOrEqual(normal)
      }
  })

  test('эффективный множитель на «Очень быстром» ×4 — ×3, не ×4', () => {
    const s = createGame(cfg, 20, 1, false, 4, { paceScale: 0.5 })
    s.stepMs = speedAfterApples(cfg, 10_000, 0.5)
    expect(effectiveBoostFactor(s)).toBe(3)
    expect(boostedStepMs(s)).toBe(60)
  })
})

describe('арена 5³', () => {
  const MULTS = [0, 0.25, 0.5, 1, 2]

  test('5 есть в config.cube.sizes, по умолчанию по-прежнему 20', () => {
    expect(configJson.cube.sizes).toContain(5)
    expect(configJson.cube.default).toBe(20)
  })

  test('препятствий в 5³ нет ни при какой плотности: зона очистки вокруг головы (радиус 4) накрывает весь куб', () => {
    expect(configJson.obstacles.clearRadius).toBeGreaterThanOrEqual(Math.floor(5 / 2))
    for (const m of MULTS)
      for (let seed = 1; seed <= 100; seed++) expect(createGame(cfg, 5, seed, false, 2, { obstacleMult: m }).obstacles.size).toBe(0)
  })

  test('на старте змейка не заперта, яблоко свободно и не в змейке', () => {
    for (const m of MULTS)
      for (let seed = 1; seed <= 100; seed++) {
        const s = createGame(cfg, 5, seed, false, 2, { obstacleMult: m })
        const h = s.snake[0]!
        expect(h.x).toBe(2)
        expect(s.snakeCells.has(cellKey(s.apple.x, s.apple.y, s.apple.z, 5))).toBe(false)
        expect(s.obstacles.has(cellKey(s.apple.x, s.apple.y, s.apple.z, 5))).toBe(false)
        // до стены по курсу — две свободные клетки: есть время на первый поворот
        expect(5 - 1 - h.x).toBe(2)
      }
  })

  test('яблоко находит последнюю свободную клетку почти полного куба', () => {
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
