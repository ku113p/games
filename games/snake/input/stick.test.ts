import { describe, expect, test } from 'bun:test'
import { isStickTap, stickDeflection, stickStep, type StickState } from './stick'

const T = { deadZone: 0.2, curve: 1, tapMaxMs: 250 }

function defl(dx: number, dy: number, r = 40, t = T): StickState {
  const out = { x: 0, y: 0 }
  stickDeflection(dx, dy, r, t, out)
  return out
}

describe('stickDeflection', () => {
  test('at the center and inside the dead zone: zero', () => {
    expect(defl(0, 0)).toEqual({ x: 0, y: 0 })
    expect(defl(7, 0)).toEqual({ x: 0, y: 0 }) // 7/40 = 0.175 < 0.2
    expect(defl(0, -8)).toEqual({ x: 0, y: 0 }) // exactly on the boundary
  })

  test('beyond the dead zone grows from zero, at the edge: one', () => {
    const a = defl(24, 0) // raw 0.6 -> (0.6-0.2)/0.8 = 0.5
    expect(a.x).toBeCloseTo(0.5, 6)
    expect(a.y).toBeCloseTo(0, 6)
    expect(defl(40, 0).x).toBeCloseTo(1, 6)
  })

  test('beyond the radius clamped to one, direction preserved', () => {
    const a = defl(-300, 0)
    expect(a.x).toBeCloseTo(-1, 6)
    const d = defl(300, 300)
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 6)
    expect(d.x).toBeCloseTo(d.y, 6)
  })

  test('down is plus on y, up is minus', () => {
    expect(defl(0, 30).y).toBeGreaterThan(0)
    expect(defl(0, -30).y).toBeLessThan(0)
  })

  test('a curve > 1 makes the middle quieter', () => {
    const lin = defl(24, 0, 40, { deadZone: 0.2, curve: 1, tapMaxMs: 250 }).x
    const cur = defl(24, 0, 40, { deadZone: 0.2, curve: 2, tapMaxMs: 250 }).x
    expect(cur).toBeLessThan(lin)
    expect(defl(40, 0, 40, { deadZone: 0.2, curve: 2, tapMaxMs: 250 }).x).toBeCloseTo(1, 6)
  })

  test('zero radius does not give NaN', () => {
    expect(defl(5, 5, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe('stickStep', () => {
  test('speed × time', () => {
    expect(stickStep(1, 2, 500)).toBeCloseTo(1, 9)
    expect(stickStep(0.5, 2, 1000)).toBeCloseTo(1, 9)
    expect(stickStep(0, 2, 16)).toBe(0)
    expect(stickStep(-1, 2, 250)).toBeCloseTo(-0.5, 9)
  })
})

describe('isStickTap', () => {
  test('short touch without movement: a tap (reset)', () => {
    expect(isStickTap(120, 0, T)).toBe(true)
    expect(isStickTap(120, 0.1, T)).toBe(true) // jitter in the dead zone
    expect(isStickTap(250, 0.2, T)).toBe(true) // exactly at the thresholds
  })
  test('short touch deflecting past the dead zone: not a tap', () => {
    expect(isStickTap(120, 0.5, T)).toBe(false)
    expect(isStickTap(120, 0.21, T)).toBe(false)
  })
  test('deflected and returned to center: still not a tap (the maximum counts)', () => {
    // main passes the maximum over the touch, not the position at release
    expect(isStickTap(150, 0.8, T)).toBe(false)
  })
  test('long hold at the center: not a tap', () => {
    expect(isStickTap(251, 0, T)).toBe(false)
    expect(isStickTap(2000, 0, T)).toBe(false)
  })
  test('garbage duration: not a tap', () => {
    expect(isStickTap(-1, 0, T)).toBe(false)
    expect(isStickTap(Number.NaN, 0, T)).toBe(false)
  })
})
