import { describe, expect, test } from 'bun:test'
import {
  accumulateTilt,
  boostSide,
  createBoostHold,
  isBoostCode,
  DEFAULT_TILT_RAD_PER_PX,
  isDoubleTap,
  padCommand,
  parsePadSide,
  shouldFirePad,
  pointerRole,
  swipeDirection,
  TILT_LIMIT_RAD,
  tiltPointersNeeded,
} from './gestures'

describe('swipeDirection', () => {
  test('ниже порога по обеим осям — не свайп', () => {
    expect(swipeDirection(5, -5, 24)).toBeNull()
  })

  test('горизонтальное смещение вправо', () => {
    expect(swipeDirection(40, 5, 24)).toBe('right')
  })

  test('горизонтальное смещение влево', () => {
    expect(swipeDirection(-40, -5, 24)).toBe('left')
  })

  test('вертикальное смещение вниз (экранные координаты: y растёт вниз)', () => {
    expect(swipeDirection(5, 40, 24)).toBe('down')
  })

  test('вертикальное смещение вверх', () => {
    expect(swipeDirection(-5, -40, 24)).toBe('up')
  })

  test('доминирующая ось побеждает при обоих выше порога', () => {
    expect(swipeDirection(30, 60, 24)).toBe('down')
    expect(swipeDirection(60, 30, 24)).toBe('right')
  })

  test('ровно на пороге — уже свайп (нестрогое неравенство)', () => {
    expect(swipeDirection(24, 0, 24)).toBe('right')
    expect(swipeDirection(23, 0, 24)).toBeNull()
  })
})

describe('isDoubleTap', () => {
  test('первый тап (lastTapAt = null) — не двойной', () => {
    expect(isDoubleTap(null, 1000, 240)).toBe(false)
  })

  test('второй тап в пределах окна — двойной', () => {
    expect(isDoubleTap(1000, 1200, 240)).toBe(true)
  })

  test('ровно на границе окна — ещё двойной (нестрогое неравенство)', () => {
    expect(isDoubleTap(1000, 1240, 240)).toBe(true)
  })

  test('за пределами окна — не двойной', () => {
    expect(isDoubleTap(1000, 1241, 240)).toBe(false)
  })
})

describe('accumulateTilt', () => {
  test('копит смещение в радианах', () => {
    expect(accumulateTilt(0, 100, 0.005, 1)).toBeCloseTo(0.5)
    expect(accumulateTilt(0.5, -40, 0.005, 1)).toBeCloseTo(0.3)
  })

  test('зажимается в пределах ±limit', () => {
    expect(accumulateTilt(0.9, 100, 0.005, 1)).toBe(1)
    expect(accumulateTilt(-0.9, -100, 0.005, 1)).toBe(-1)
  })

  test('нулевое смещение не меняет значение', () => {
    expect(accumulateTilt(0.3, 0, 0.005, 1)).toBe(0.3)
  })

  test('предел совпадает с контрактом вида и запасная чувствительность положительна', () => {
    expect(TILT_LIMIT_RAD).toBe(1)
    expect(DEFAULT_TILT_RAD_PER_PX).toBeGreaterThan(0)
  })
})

describe('pointerRole', () => {
  test('первый палец — обычный жест', () => {
    expect(pointerRole('touch', 0, 0)).toBe('gesture')
    expect(pointerRole('pen', 0, 0)).toBe('gesture')
  })

  test('второй палец — наклон (и отменяет жест первого)', () => {
    expect(pointerRole('touch', 0, 1)).toBe('tilt')
    expect(pointerRole('touch', 0, 2)).toBe('tilt')
  })

  test('мышь: левая кнопка — жест, правая и средняя — наклон', () => {
    expect(pointerRole('mouse', 0, 0)).toBe('gesture')
    expect(pointerRole('mouse', 2, 0)).toBe('tilt')
    expect(pointerRole('mouse', 1, 0)).toBe('tilt')
  })

  test('мышь не считается вторым пальцем', () => {
    expect(pointerRole('mouse', 0, 1)).toBe('ignore')
  })
})

describe('tiltPointersNeeded', () => {
  test('мышь — один указатель, пальцы — два', () => {
    expect(tiltPointersNeeded(true)).toBe(1)
    expect(tiltPointersNeeded(false)).toBe(2)
  })
})

describe('padCommand (пульт в углу)', () => {
  test('четыре стрелки — повороты, независимо от третьей оси', () => {
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      expect(padCommand(dir, true)).toEqual({ kind: 'turn', dir })
      expect(padCommand(dir, false)).toEqual({ kind: 'turn', dir })
    }
  })

  test('into/out — третья ось, пока она включена (фаза plane)', () => {
    expect(padCommand('into', true)).toEqual({ kind: 'axis', dir: 'into' })
    expect(padCommand('out', true)).toEqual({ kind: 'axis', dir: 'out' })
  })

  test('в фазе free третья ось выключена — команды нет', () => {
    expect(padCommand('into', false)).toBeNull()
    expect(padCommand('out', false)).toBeNull()
  })

  test('неизвестная или пустая кнопка — null', () => {
    expect(padCommand(undefined, true)).toBeNull()
    expect(padCommand('center', true)).toBeNull()
    expect(padCommand('', true)).toBeNull()
  })
})

describe('parsePadSide', () => {
  test('left — слева, всё остальное — справа', () => {
    expect(parsePadSide('left')).toBe('left')
    expect(parsePadSide('right')).toBe('right')
    expect(parsePadSide(null)).toBe('right')
    expect(parsePadSide('мусор')).toBe('right')
  })
})

describe('shouldFirePad', () => {
  test('новый указатель шлёт команду один раз', () => {
    expect(shouldFirePad(new Set(), 1)).toBe(true)
  })

  test('уже прижатый указатель (удержание) повторно не шлёт', () => {
    expect(shouldFirePad(new Set([1]), 1)).toBe(false)
  })

  test('второй палец на другой кнопке — отдельная команда', () => {
    expect(shouldFirePad(new Set([1]), 2)).toBe(true)
  })
})

describe('ускорение: boostSide / isBoostCode', () => {
  test('кнопка ускорения — напротив пульта', () => {
    expect(boostSide('right')).toBe('left')
    expect(boostSide('left')).toBe('right')
  })

  test('клавиши ускорения по e.code: Shift и Space, но не стрелки/WASD/Q/E', () => {
    expect(isBoostCode('ShiftLeft')).toBe(true)
    expect(isBoostCode('ShiftRight')).toBe(true)
    expect(isBoostCode('Space')).toBe(true)
    for (const c of ['ArrowUp', 'KeyW', 'KeyQ', 'KeyE', 'Shift', 'ц']) expect(isBoostCode(c)).toBe(false)
  })
})

describe('createBoostHold', () => {
  function make() {
    const log: boolean[] = []
    return { log, hold: createBoostHold((on) => log.push(on)) }
  }

  test('зажал — включилось, отпустил — выключилось, ровно по одному разу', () => {
    const { log, hold } = make()
    hold.press('ptr:1')
    hold.press('ptr:1')
    expect(hold.isOn()).toBe(true)
    hold.release('ptr:1')
    hold.release('ptr:1')
    expect(hold.isOn()).toBe(false)
    expect(log).toEqual([true, false])
  })

  test('два источника: выключается только когда отпущены оба', () => {
    const { log, hold } = make()
    hold.press('btn')
    hold.press('kbd')
    hold.release('btn')
    expect(hold.isOn()).toBe(true)
    hold.release('kbd')
    expect(log).toEqual([true, false])
  })

  test('releaseAll выключает залипшее и безопасен повторно', () => {
    const { log, hold } = make()
    hold.releaseAll()
    expect(log).toEqual([])
    hold.press('a')
    hold.press('b')
    hold.releaseAll()
    hold.releaseAll()
    expect(hold.isOn()).toBe(false)
    expect(log).toEqual([true, false])
  })

  test('release чужого источника ничего не ломает', () => {
    const { log, hold } = make()
    hold.press('a')
    hold.release('zzz')
    expect(hold.isOn()).toBe(true)
    expect(log).toEqual([true])
  })

  test('после releaseAll новое нажатие снова включает', () => {
    const { log, hold } = make()
    hold.press('a')
    hold.releaseAll()
    hold.press('a')
    expect(log).toEqual([true, false, true])
  })
})
