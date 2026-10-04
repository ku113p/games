import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { bottomEdgePx, fullscreenReservePx, isFullscreen } from './fullscreen'

const cfg = configJson.layout

describe('isFullscreen', () => {
  const none = { fullscreenElement: null, webkitFullscreenElement: undefined, displayModeFullscreen: false }
  test('no signal - not fullscreen', () => expect(isFullscreen(none)).toBe(false))
  test('own element', () => expect(isFullscreen({ ...none, fullscreenElement: {} })).toBe(true))
  test('webkit element (old iOS Safari)', () => expect(isFullscreen({ ...none, webkitFullscreenElement: {} })).toBe(true))
  test('display-mode media query (itch iframe)', () => expect(isFullscreen({ ...none, displayModeFullscreen: true })).toBe(true))
})

describe('fullscreenReservePx', () => {
  test('config value is positive', () => expect(cfg.fullscreenBottomReservePx).toBeGreaterThan(0))
  test('fullscreen: the configured value', () => expect(fullscreenReservePx(true, cfg)).toBe(cfg.fullscreenBottomReservePx))
  test('not fullscreen: zero', () => expect(fullscreenReservePx(false, cfg)).toBe(0))
  test('bad config values give zero', () => {
    expect(fullscreenReservePx(true, { fullscreenBottomReservePx: -5 })).toBe(0)
    expect(fullscreenReservePx(true, { fullscreenBottomReservePx: NaN })).toBe(0)
  })
})

describe('bottomEdgePx', () => {
  const r = cfg.fullscreenBottomReservePx
  test('not fullscreen: unchanged', () => {
    expect(bottomEdgePx(12, 0, fullscreenReservePx(false, cfg))).toBe(12)
    expect(bottomEdgePx(12, 34, fullscreenReservePx(false, cfg))).toBe(34)
  })
  test('fullscreen without inset: edge + reserve', () => expect(bottomEdgePx(12, 0, fullscreenReservePx(true, cfg))).toBe(12 + r))
  test('fullscreen with inset: stacks on the inset, not replaces it', () => expect(bottomEdgePx(12, 34, fullscreenReservePx(true, cfg))).toBe(34 + r))
})
