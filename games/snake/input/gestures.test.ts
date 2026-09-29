import { describe, expect, test } from 'bun:test'
import {
  accumulateTilt,
  boostSide,
  createBoostHold,
  isBoostCode,
  DEFAULT_TILT_RAD_PER_PX,
  PAD_BUTTONS,
  padCommand,
  parsePadSide,
  shouldFirePad,
  pointerRole,
  swipeDirection,
  TILT_LIMIT_RAD,
  tiltPointersNeeded,
  clampZoom,
  pinchZoomFactor,
  twoFingerMode,
  wheelZoomFactor,
  zoomTuning,
} from './gestures'

describe('swipeDirection', () => {
  test('below the threshold on both axes: not a swipe', () => {
    expect(swipeDirection(5, -5, 24)).toBeNull()
  })

  test('horizontal offset to the right', () => {
    expect(swipeDirection(40, 5, 24)).toBe('right')
  })

  test('horizontal offset to the left', () => {
    expect(swipeDirection(-40, -5, 24)).toBe('left')
  })

  test('vertical offset down (screen coordinates: y grows downward)', () => {
    expect(swipeDirection(5, 40, 24)).toBe('down')
  })

  test('vertical offset up', () => {
    expect(swipeDirection(-5, -40, 24)).toBe('up')
  })

  test('the dominant axis wins when both are above the threshold', () => {
    expect(swipeDirection(30, 60, 24)).toBe('down')
    expect(swipeDirection(60, 30, 24)).toBe('right')
  })

  test('exactly at the threshold: already a swipe (non-strict inequality)', () => {
    expect(swipeDirection(24, 0, 24)).toBe('right')
    expect(swipeDirection(23, 0, 24)).toBeNull()
  })
})

describe('accumulateTilt', () => {
  test('accumulates the offset in radians', () => {
    expect(accumulateTilt(0, 100, 0.005, 1)).toBeCloseTo(0.5)
    expect(accumulateTilt(0.5, -40, 0.005, 1)).toBeCloseTo(0.3)
  })

  test('clamped within ±limit', () => {
    expect(accumulateTilt(0.9, 100, 0.005, 1)).toBe(1)
    expect(accumulateTilt(-0.9, -100, 0.005, 1)).toBe(-1)
  })

  test('zero offset does not change the value', () => {
    expect(accumulateTilt(0.3, 0, 0.005, 1)).toBe(0.3)
  })

  test('the limit matches the view contract and the fallback sensitivity is positive', () => {
    expect(TILT_LIMIT_RAD).toBe(1)
    expect(DEFAULT_TILT_RAD_PER_PX).toBeGreaterThan(0)
  })
})

describe('pointerRole', () => {
  test('first finger: a regular gesture', () => {
    expect(pointerRole('touch', 0, 0)).toBe('gesture')
    expect(pointerRole('pen', 0, 0)).toBe('gesture')
  })

  test('second finger: tilt (and cancels the gesture of the first)', () => {
    expect(pointerRole('touch', 0, 1)).toBe('tilt')
    expect(pointerRole('touch', 0, 2)).toBe('tilt')
  })

  test('mouse: left button is a gesture, right and middle are tilt', () => {
    expect(pointerRole('mouse', 0, 0)).toBe('gesture')
    expect(pointerRole('mouse', 2, 0)).toBe('tilt')
    expect(pointerRole('mouse', 1, 0)).toBe('tilt')
  })

  test('a mouse does not count as a second finger', () => {
    expect(pointerRole('mouse', 0, 1)).toBe('ignore')
  })
})

describe('tiltPointersNeeded', () => {
  test('mouse is one pointer, fingers are two', () => {
    expect(tiltPointersNeeded(true)).toBe(1)
    expect(tiltPointersNeeded(false)).toBe(2)
  })
})

describe('padCommand (corner pad)', () => {
  test('the four arrows are turns', () => {
    for (const dir of ['left', 'right', 'up', 'down'] as const) expect(padCommand(dir)).toBe(dir)
  })

  test('there is no third axis: into/out are not pad buttons', () => {
    expect(PAD_BUTTONS).toEqual(['left', 'right', 'up', 'down'])
    expect(padCommand('into')).toBeNull()
    expect(padCommand('out')).toBeNull()
  })

  test('unknown or empty button: null', () => {
    expect(padCommand(undefined)).toBeNull()
    expect(padCommand('center')).toBeNull()
    expect(padCommand('')).toBeNull()
  })
})

describe('parsePadSide', () => {
  test('left is left, everything else is right', () => {
    expect(parsePadSide('left')).toBe('left')
    expect(parsePadSide('right')).toBe('right')
    expect(parsePadSide(null)).toBe('right')
    expect(parsePadSide('мусор')).toBe('right')
  })
})

describe('shouldFirePad', () => {
  test('a new pointer sends the command once', () => {
    expect(shouldFirePad(new Set(), 1)).toBe(true)
  })

  test('an already pressed pointer (hold) does not send again', () => {
    expect(shouldFirePad(new Set([1]), 1)).toBe(false)
  })

  test('second finger on another button: a separate command', () => {
    expect(shouldFirePad(new Set([1]), 2)).toBe(true)
  })
})

describe('boost: boostSide / isBoostCode', () => {
  test('boost button is opposite the pad', () => {
    expect(boostSide('right')).toBe('left')
    expect(boostSide('left')).toBe('right')
  })

  test('boost keys by e.code: Shift and Space, but not arrows/WASD/Q/E', () => {
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

  test('hold: turned on, release: turned off, exactly once each', () => {
    const { log, hold } = make()
    hold.press('ptr:1')
    hold.press('ptr:1')
    expect(hold.isOn()).toBe(true)
    hold.release('ptr:1')
    hold.release('ptr:1')
    expect(hold.isOn()).toBe(false)
    expect(log).toEqual([true, false])
  })

  test('two sources: turns off only when both are released', () => {
    const { log, hold } = make()
    hold.press('btn')
    hold.press('kbd')
    hold.release('btn')
    expect(hold.isOn()).toBe(true)
    hold.release('kbd')
    expect(log).toEqual([true, false])
  })

  test('releaseAll turns off a stuck boost and is safe to repeat', () => {
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

  test('releasing a foreign source breaks nothing', () => {
    const { log, hold } = make()
    hold.press('a')
    hold.release('zzz')
    expect(hold.isOn()).toBe(true)
    expect(log).toEqual([true])
  })

  test('after releaseAll a new press turns boost on again', () => {
    const { log, hold } = make()
    hold.press('a')
    hold.releaseAll()
    hold.press('a')
    expect(log).toEqual([true, false, true])
  })
})

describe('camera zoom: wheel and pinch', () => {
  test('wheel: down is farther (>1), up is closer (<1), zero is unchanged', () => {
    expect(wheelZoomFactor(100, 0, 0.0012)).toBeGreaterThan(1)
    expect(wheelZoomFactor(-100, 0, 0.0012)).toBeLessThan(1)
    expect(wheelZoomFactor(0, 0, 0.0012)).toBe(1)
  })

  test('wheel: logarithmic, a step down and the same step up cancel out', () => {
    expect(wheelZoomFactor(100, 0, 0.0012) * wheelZoomFactor(-100, 0, 0.0012)).toBeCloseTo(1, 12)
  })

  test('wheel: lines and pages are converted to pixels (deltaMode 1 and 2)', () => {
    expect(wheelZoomFactor(3, 1, 0.001)).toBeCloseTo(Math.exp(3 * 16 * 0.001), 12)
    expect(wheelZoomFactor(1, 2, 0.001)).toBeCloseTo(Math.exp(400 * 0.001), 12)
  })

  test('pinch: spreading fingers is closer, pinching in is farther, twice as wide is twice as close (gain 1)', () => {
    expect(pinchZoomFactor(100, 200, 1)).toBeCloseTo(0.5, 12)
    expect(pinchZoomFactor(200, 100, 1)).toBeCloseTo(2, 12)
    expect(pinchZoomFactor(100, 100, 1)).toBe(1)
  })

  test('pinch: gain amplifies or damps; zero distances are safe', () => {
    expect(pinchZoomFactor(100, 200, 2)).toBeCloseTo(0.25, 12)
    expect(pinchZoomFactor(0, 50, 1)).toBe(1)
    expect(pinchZoomFactor(50, 0, 1)).toBe(1)
  })

  test('clampZoom clamps to the config limits', () => {
    expect(clampZoom(0.1, 0.5, 2)).toBe(0.5)
    expect(clampZoom(9, 0.5, 2)).toBe(2)
    expect(clampZoom(1.3, 0.5, 2)).toBe(1.3)
  })

  test('zoomTuning reads numbers from the config and falls back without them', () => {
    const t = zoomTuning({ camera: { zoomWheelPerPx: 0.5, zoomPinchGain: 2 }, input: { twoFingerLockPx: 7 } })
    expect(t).toEqual({ wheelPerPx: 0.5, pinchGain: 2, lockPx: 7 })
    const d = zoomTuning({ camera: {}, input: {} })
    expect(d.wheelPerPx).toBeGreaterThan(0)
    expect(d.pinchGain).toBeGreaterThan(0)
    expect(d.lockPx).toBeGreaterThan(0)
  })
})

describe('twoFingerMode: two fingers - tilt or zoom', () => {
  const LOCK = 10
  test('nothing accumulated yet: wait', () => {
    expect(twoFingerMode(0, 0, LOCK)).toBe('pending')
    expect(twoFingerMode(9, 3, LOCK)).toBe('pending')
  })
  test('fingers moved together (center shifted, spread did not): tilt', () => {
    expect(twoFingerMode(30, 2, LOCK)).toBe('tilt')
  })
  test('pinch (spread changed, center almost still): zoom', () => {
    expect(twoFingerMode(2, 30, LOCK)).toBe('zoom')
  })
  test('a pinch with a jittery center and a tilt with a jittery spread are not confused', () => {
    expect(twoFingerMode(8, 25, LOCK)).toBe('zoom')
    expect(twoFingerMode(25, 8, LOCK)).toBe('tilt')
  })
  test('only one finger moved: center shift and spread are equal, so it is ambiguous; wait for the second finger', () => {
    expect(twoFingerMode(12, 12, LOCK)).toBe('pending')
    expect(twoFingerMode(12, 13, LOCK)).toBe('pending')
  })
})
