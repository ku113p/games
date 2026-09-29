import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import type { Config } from '../core/rules'
import { cameraSettings, planeCameraDistance } from './camera-config'

const settings = cameraSettings(configJson as unknown as Config)

/** How many cells fit across the short side of the screen at the head's layer, for a camera at planeCameraDistance. */
function cellsAcross(size: number, aspect: number): number {
  const layerShift = Math.floor(size / 2) - (size - 1) / 2
  const toLayer = planeCameraDistance(size, aspect, settings) - layerShift
  return 2 * toLayer * Math.tan((settings.planeFovDeg * Math.PI) / 360) * Math.min(aspect, 1)
}

describe('the flat-opening camera (20 cubed: the only arena the opening runs on)', () => {
  const want = 20 + settings.planeMarginCells

  test('the layer plus its margin fills the screen width on both phone sizes', () => {
    for (const [w, h] of [[390, 844], [360, 640]] as const) expect(cellsAcross(20, w / h)).toBeCloseTo(want, 6)
  })

  test('on a landscape screen it fills the height instead (the short side)', () => {
    expect(cellsAcross(20, 16 / 9)).toBeCloseTo(want, 6)
  })

  test('the board is close to square-on: a narrow field of view, so cells do not lean', () => {
    expect(settings.planeFovDeg).toBeLessThanOrEqual(30)
  })

  test('the camera is outside the cube, so the whole layer is in front of it', () => {
    expect(planeCameraDistance(20, 390 / 844, settings)).toBeGreaterThan(20)
  })

  test('a bigger arena shows a window of the same cell size (a fallback: the opening never runs there)', () => {
    expect(cellsAcross(100, 390 / 844)).toBeCloseTo(want, 6)
    expect(cellsAcross(5, 390 / 844)).toBeCloseTo(5 + settings.planeMarginCells, 6)
  })
})
