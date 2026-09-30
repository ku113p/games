import { describe, expect, test } from 'bun:test'
import config from '../config.json'
import { resolveScheme } from './scheme'

describe('resolveScheme: the default control scheme', () => {
  test('config.input.defaultScheme is taps', () => {
    expect(config.input.defaultScheme).toBe('taps')
  })
  test('a player who never chose gets the configured default (taps)', () => {
    expect(resolveScheme(null, config.input.defaultScheme)).toBe('taps')
    expect(resolveScheme(undefined, config.input.defaultScheme)).toBe('taps')
    expect(resolveScheme('', config.input.defaultScheme)).toBe('taps')
    expect(resolveScheme('garbage', config.input.defaultScheme)).toBe('taps')
  })
  test('a stored preference wins, swipes included', () => {
    expect(resolveScheme('swipes', 'taps')).toBe('swipes')
    expect(resolveScheme('taps', 'swipes')).toBe('taps')
  })
  test('the default follows the config, and a broken config value falls back to taps', () => {
    expect(resolveScheme(null, 'swipes')).toBe('swipes')
    expect(resolveScheme(null, 'nonsense')).toBe('taps')
    expect(resolveScheme(null, undefined)).toBe('taps')
  })
})
