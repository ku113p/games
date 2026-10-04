import { describe, expect, test } from 'bun:test'
import { isLevelScene, nextScene, parseFlow, SCENES, serializeFlow } from './flow'

describe('flow', () => {
  test('the scenes run in order and the ending leads to the title', () => {
    expect(nextScene('l1')).toBe('l2')
    expect(nextScene('l2')).toBe('l3')
    expect(nextScene('l3')).toBe('roof')
    expect(nextScene('roof')).toBe('ending')
    expect(nextScene('ending')).toBe('title')
    expect(SCENES.filter(isLevelScene)).toEqual(['l1', 'l2', 'l3', 'roof'])
  })
  test('a saved scene survives a round trip; garbage does not', () => {
    for (const s of SCENES) expect(parseFlow(serializeFlow(s))).toBe(s)
    expect(parseFlow(null)).toBeNull()
    expect(parseFlow('{')).toBeNull()
    expect(parseFlow('{"version":2,"scene":"nope"}')).toBeNull()
    expect(parseFlow('{"version":9,"scene":"l1"}')).toBeNull()
  })
})
