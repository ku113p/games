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
  test('арена меньше окна: окно равно арене, скролла нет', () => {
    expect(windowLength(12, W)).toBe(12)
    for (let h = 0; h < 12; h++) expect(windowStart(h, 12, W)).toBe(0)
  })

  test('арена ровно 20: окно на всю арену, скролла нет', () => {
    expect(windowLength(20, W)).toBe(20)
    for (let h = 0; h < 20; h++) expect(windowStart(h, 20, W)).toBe(0)
  })

  test('прижатие к нижней стене: окно стоит, метка ходит', () => {
    for (let h = 0; h <= 10; h++) expect(windowStart(h, 100, W)).toBe(0)
    expect(inWindow(3, 0)).toBe(3)
  })

  test('прижатие к верхней стене: окно стоит, метка ходит', () => {
    for (let h = 90; h < 100; h++) expect(windowStart(h, 100, W)).toBe(80)
    expect(inWindow(99, 80)).toBe(19)
  })

  test('середина арены: метка в центре, окно едет вместе с головой', () => {
    for (let h = 11; h < 90; h++) {
      const s = windowStart(h, 100, W)
      expect(s).toBe(h - 10)
      expect(inWindow(h, s)).toBe(10)
    }
  })

  test('окно на 1 клетку за 1 шаг головы, целыми клетками', () => {
    for (let h = 0; h < 99; h++) {
      const d = windowStart(h + 1, 100, W) - windowStart(h, 100, W)
      expect(d === 0 || d === 1).toBe(true)
    }
  })

  test('метка никогда не выходит за окно, окно — за арену (все размеры)', () => {
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

  test('другой размер окна берётся из параметра', () => {
    expect(windowStart(50, 100, 10)).toBe(45)
    expect(windowLength(100, 10)).toBe(10)
  })
})

describe('стены и края окна', () => {
  test('арена ≤ окна: обе стороны — настоящие стены', () => {
    expect(touchesLowWall(0)).toBe(true)
    expect(touchesHighWall(0, 20, 20)).toBe(true)
    expect(touchesHighWall(0, 12, 12)).toBe(true)
  })

  test('у нижней стены только нижняя сторона — стена', () => {
    const s = windowStart(3, 100, W)
    expect(touchesLowWall(s)).toBe(true)
    expect(touchesHighWall(s, W, 100)).toBe(false)
  })

  test('у верхней стены только верхняя сторона — стена', () => {
    const s = windowStart(97, 100, W)
    expect(touchesLowWall(s)).toBe(false)
    expect(touchesHighWall(s, W, 100)).toBe(true)
  })

  test('в середине арены обе стороны — просто край окна', () => {
    const s = windowStart(50, 100, W)
    expect(touchesLowWall(s)).toBe(false)
    expect(touchesHighWall(s, W, 100)).toBe(false)
  })
})

describe('яблоко относительно окна', () => {
  test('внутри окна остаётся на своём месте', () => {
    expect(isInWindow(45, 40, 20)).toBe(true)
    expect(clampToWindow(45, 40, 20)).toBe(5)
  })

  test('вне окна прижимается к краю в своём направлении', () => {
    expect(isInWindow(10, 40, 20)).toBe(false)
    expect(clampToWindow(10, 40, 20)).toBe(0)
    expect(isInWindow(70, 40, 20)).toBe(false)
    expect(clampToWindow(70, 40, 20)).toBe(19)
  })

  test('границы окна: последняя клетка внутри, следующая снаружи', () => {
    expect(isInWindow(59, 40, 20)).toBe(true)
    expect(isInWindow(60, 40, 20)).toBe(false)
    expect(isInWindow(39, 40, 20)).toBe(false)
  })
})

describe('levelFraction (уровнемер)', () => {
  test('пол и потолок: первая и последняя клетки у краёв, середина посередине', () => {
    expect(levelFraction(0, 100)).toBeCloseTo(0.005)
    expect(levelFraction(99, 100)).toBeCloseTo(0.995)
    expect(levelFraction(49, 100)).toBeCloseTo(0.495)
    expect(levelFraction(0, 20)).toBeCloseTo(0.025)
  })

  test('не зависит от окна: монотонно растёт по всей высоте', () => {
    for (let y = 1; y < 50; y++) expect(levelFraction(y, 50)).toBeGreaterThan(levelFraction(y - 1, 50))
  })
})

describe('окно полосы-уровнемера (windowFraction, isMajorTick)', () => {
  const L = 10
  test('метка головы в центре окна, пока не упёрлись в стены', () => {
    for (let h = 5; h <= 94; h++) {
      const s = windowStart(h, 100, L)
      expect(windowFraction(h, s, L)).toBeCloseTo(0.55, 10)
    }
  })

  test('один шаг = ровно одна клетка окна независимо от размера арены (у стены метка ходит)', () => {
    for (const size of [20, 50, 100]) {
      for (let h = 0; h < size - 1; h++) {
        const a = windowFraction(h, windowStart(h, size, L), L)
        const b = windowFraction(h + 1, windowStart(h + 1, size, L), L)
        // В середине метка стоит, а мир едет на клетку; у стены метка едет на клетку. Кто-то один всегда.
        const worldMove = windowStart(h + 1, size, L) - windowStart(h, size, L)
        const markMove = Math.round((b - a) * L)
        expect(Math.abs(worldMove - markMove)).toBe(1)
        expect(worldMove === 1 || markMove === 1).toBe(true)
      }
    }
  })

  test('пол в окне только у пола, потолок только у потолка', () => {
    expect(touchesLowWall(windowStart(2, 100, L))).toBe(true)
    expect(touchesLowWall(windowStart(50, 100, L))).toBe(false)
    expect(touchesHighWall(windowStart(97, 100, L), L, 100)).toBe(true)
    expect(touchesHighWall(windowStart(50, 100, L), L, 100)).toBe(false)
  })

  test('фракция клетки вне окна выходит за 0..1 (яблоко вне окна)', () => {
    expect(windowFraction(80, 40, L)).toBeGreaterThan(1)
    expect(windowFraction(30, 40, L)).toBeLessThan(0)
  })

  test('крупные деления привязаны к миру: кратны N', () => {
    expect(isMajorTick(0, 5)).toBe(true)
    expect(isMajorTick(10, 5)).toBe(true)
    expect(isMajorTick(7, 5)).toBe(false)
  })
})
