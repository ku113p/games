import { describe, expect, test } from 'bun:test'
import { isLevelScene, nextScene, parseFlow, SCENES, serializeFlow } from './flow'

describe('flow', () => {
  test('the scenes run in order and the ending leads to the title', () => {
    expect(nextScene('prologue')).toBe('room1')
    expect(nextScene('room1')).toBe('l1')
    expect(nextScene('l1')).toBe('notes')
    expect(nextScene('notes')).toBe('room2')
    expect(nextScene('l3')).toBe('ending')
    expect(nextScene('ending')).toBe('title')
    expect(SCENES.filter(isLevelScene)).toEqual(['l1'])
  })
  test('a saved scene survives a round trip; garbage does not', () => {
    for (const s of SCENES) expect(parseFlow(serializeFlow(s))).toBe(s)
    expect(parseFlow(null)).toBeNull()
    expect(parseFlow('{')).toBeNull()
    expect(parseFlow('{"version":1,"scene":"nope"}')).toBeNull()
    expect(parseFlow('{"version":9,"scene":"l1"}')).toBeNull()
  })
})
