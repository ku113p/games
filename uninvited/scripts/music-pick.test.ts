import { expect, test } from 'bun:test'
import { equalPowerCurve, loadGroups, pickVersion, versionGains } from '../view/music-pick'

test('pickVersion: all three decoded, one each', () => {
  const all = [true, true, true]
  expect([0, 1, 2].map((l) => pickVersion(all, l))).toEqual([0, 1, 2])
})

test('pickVersion: missing versions fall back down, then up', () => {
  expect(pickVersion([true, false, false], 2)).toBe(0) // combat -> calm
  expect(pickVersion([true, false, true], 1)).toBe(0) // tension -> calm
  expect(pickVersion([true, true, false], 2)).toBe(1) // combat -> tension
  expect(pickVersion([false, true, false], 0)).toBe(1) // calm missing: the lowest above
  expect(pickVersion([false, false, false], 1)).toBe(-1)
})

test('late arrival: combat shows up while the level is at combat', () => {
  const have = [true, true, false]
  expect(versionGains(have, 2)).toEqual([0, 1, 0]) // holds tension meanwhile, never stuck on calm
  have[2] = true
  expect(versionGains(have, 2)).toEqual([0, 0, 1]) // the next bar-line switch uses it
  expect(versionGains(have, 0)).toEqual([1, 0, 0]) // and stealth does not play combat
})

test('late arrival: only combat decoded first, stealth waits for calm', () => {
  const have = [false, false, true]
  expect(pickVersion(have, 0)).toBe(2)
  have[0] = true
  expect(pickVersion(have, 0)).toBe(0)
  expect(pickVersion(have, 2)).toBe(2)
})

test('equalPowerCurve: crossfade sides keep constant power and the ends match', () => {
  const a = equalPowerCurve(0, 1)
  const b = equalPowerCurve(1, 0)
  expect(a[0]).toBeCloseTo(0)
  expect(a[63]).toBeCloseTo(1)
  for (let i = 0; i < 64; i++) expect((a[i] as number) ** 2 + (b[i] as number) ** 2).toBeCloseTo(1, 5)
})

test('loadGroups: level tracks first, then hack, then the rest', () => {
  expect(loadGroups(['hack', 'menu', 'net_calm', 'sting_win', 'net_combat'])).toEqual([['net_calm', 'net_combat'], ['hack'], ['menu', 'sting_win']])
})
