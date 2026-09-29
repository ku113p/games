import { describe, expect, test } from 'bun:test'
import { stickDeflection, stickStep, type StickState } from './stick'

const T = { deadZone: 0.2, curve: 1 }

function defl(dx: number, dy: number, r = 40, t = T): StickState {
  const out = { x: 0, y: 0 }
  stickDeflection(dx, dy, r, t, out)
  return out
}

describe('stickDeflection', () => {
  test('в центре и внутри мёртвой зоны — ноль', () => {
    expect(defl(0, 0)).toEqual({ x: 0, y: 0 })
    expect(defl(7, 0)).toEqual({ x: 0, y: 0 }) // 7/40 = 0.175 < 0.2
    expect(defl(0, -8)).toEqual({ x: 0, y: 0 }) // ровно на границе
  })

  test('за мёртвой зоной растёт с нуля, на краю — единица', () => {
    const a = defl(24, 0) // raw 0.6 -> (0.6-0.2)/0.8 = 0.5
    expect(a.x).toBeCloseTo(0.5, 6)
    expect(a.y).toBeCloseTo(0, 6)
    expect(defl(40, 0).x).toBeCloseTo(1, 6)
  })

  test('дальше радиуса зажимается единицей, направление сохраняется', () => {
    const a = defl(-300, 0)
    expect(a.x).toBeCloseTo(-1, 6)
    const d = defl(300, 300)
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 6)
    expect(d.x).toBeCloseTo(d.y, 6)
  })

  test('вниз — плюс по y, вверх — минус', () => {
    expect(defl(0, 30).y).toBeGreaterThan(0)
    expect(defl(0, -30).y).toBeLessThan(0)
  })

  test('кривая > 1 делает середину тише', () => {
    const lin = defl(24, 0, 40, { deadZone: 0.2, curve: 1 }).x
    const cur = defl(24, 0, 40, { deadZone: 0.2, curve: 2 }).x
    expect(cur).toBeLessThan(lin)
    expect(defl(40, 0, 40, { deadZone: 0.2, curve: 2 }).x).toBeCloseTo(1, 6)
  })

  test('нулевой радиус не даёт NaN', () => {
    expect(defl(5, 5, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe('stickStep', () => {
  test('скорость × время', () => {
    expect(stickStep(1, 2, 500)).toBeCloseTo(1, 9)
    expect(stickStep(0.5, 2, 1000)).toBeCloseTo(1, 9)
    expect(stickStep(0, 2, 16)).toBe(0)
    expect(stickStep(-1, 2, 250)).toBeCloseTo(-0.5, 9)
  })
})
