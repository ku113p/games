import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { boostKeyLabels, keyLabel, keyRows, padButtons } from './controls-doc'
import { isBoostCode, BOOST_CODES } from './gestures'
import { AXIS_CODES, CAMERA_RESET_CODE, PAUSE_CODE, PLANE_CODES, keyAction } from './keyboard'

describe('keyLabel', () => {
  test('arrows, letters, Shift, Escape, Space', () => {
    expect(keyLabel('ArrowUp')).toBe('↑')
    expect(keyLabel('KeyW')).toBe('W')
    expect(keyLabel('ShiftLeft')).toBe('Shift')
    expect(keyLabel('ShiftRight')).toBe('Shift')
    expect(keyLabel('Escape')).toBe('Esc')
    expect(keyLabel('Space')).toBe('Space')
  })
})

describe('keyRows are read out of the real key maps', () => {
  const rows = keyRows()
  const row = (a: string) => rows.find((r) => r.action === a)!

  test('every key code the input layer accepts is shown, and nothing else', () => {
    const shown = new Set(rows.flatMap((r) => r.groups.flat()))
    const codes = [...Object.keys(PLANE_CODES), ...Object.keys(AXIS_CODES), ...BOOST_CODES, CAMERA_RESET_CODE, PAUSE_CODE]
    for (const c of codes) expect(shown.has(keyLabel(c))).toBe(true)
    expect(shown.size).toBe(new Set(codes.map(keyLabel)).size)
  })

  test('turn: arrows and WASD, each in up-left-down-right order', () => {
    expect(row('turn').groups).toEqual([['↑', '←', '↓', '→'], ['W', 'A', 'S', 'D']])
    for (const c of Object.keys(PLANE_CODES)) expect(keyAction(c)?.plane).not.toBeNull()
  })

  test('Q is into (deeper), E is out (closer)', () => {
    expect(row('into').groups).toEqual([['Q']])
    expect(row('out').groups).toEqual([['E']])
    expect(keyAction('KeyQ')?.axis).toBe('into')
    expect(keyAction('KeyE')?.axis).toBe('out')
  })

  test('boost keys are the ones isBoostCode accepts', () => {
    expect(row('boost').groups).toEqual([['Shift'], ['Space']])
    expect(BOOST_CODES.every(isBoostCode)).toBe(true)
    expect(boostKeyLabels()).toEqual(['Shift', 'Space'])
  })

  test('camera reset is R, pause is Esc', () => {
    expect(row('cameraReset').groups).toEqual([['R']])
    expect(row('pause').groups).toEqual([['Esc']])
  })
})

describe('pad buttons match the markup', () => {
  test('index.html has exactly the data-pad buttons that padCommand knows', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const inMarkup = [...html.matchAll(/data-pad="(\w+)"/g)].map((m) => m[1]).sort()
    expect(inMarkup).toEqual([...padButtons()].sort())
  })
})
