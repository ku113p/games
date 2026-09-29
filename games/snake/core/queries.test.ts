import { describe, expect, test } from 'bun:test'
import { cellKey } from './state'
import { tick } from './commands'
import {
  applePos,
  cameraFrame,
  cubeSize,
  elapsedMs,
  forEachObstacle,
  forEachSnakeSegment,
  gameMode,
  head,
  isAlive,
  score,
  snakeLength,
  stepProgress,
} from './queries'
import { config, makeState, v } from './test-helpers'

describe('forEachObstacle — декодирование cellKey', () => {
  for (const size of [7, 20, 50, 100]) {
    test(`decodes every obstacle back to its coordinates (size ${size})`, () => {
      const cells = [v(1, 2, 3), v(size - 1, 0, 5), v(0, 0, 0), v(size - 1, size - 1, size - 1), v(0, size - 1, 4), v(3, 0, size - 1)]
      const s = makeState({ size, obstacles: new Set(cells.map((c) => cellKey(c.x, c.y, c.z, size))) })
      const got: string[] = []
      forEachObstacle(s, (x, y, z) => got.push(`${x},${y},${z}`))
      expect(got.sort()).toEqual(cells.map((c) => `${c.x},${c.y},${c.z}`).sort())
    })
  }

  test('empty obstacle set never calls back', () => {
    let calls = 0
    forEachObstacle(makeState(), () => calls++)
    expect(calls).toBe(0)
  })
})

describe('forEachSnakeSegment', () => {
  test('visits head to tail with sequential indices and exact coordinates', () => {
    const s = makeState({ snake: [v(5, 6, 7), v(4, 6, 7), v(3, 6, 7), v(3, 5, 7)] })
    const got: number[][] = []
    forEachSnakeSegment(s, (x, y, z, i) => got.push([x, y, z, i]))
    expect(got).toEqual([
      [5, 6, 7, 0],
      [4, 6, 7, 1],
      [3, 6, 7, 2],
      [3, 5, 7, 3],
    ])
  })

  test('follows the snake after movement', () => {
    const s = makeState()
    tick(s, config, 100)
    const got: number[][] = []
    forEachSnakeSegment(s, (x, y, z, i) => got.push([x, y, z, i]))
    expect(got[0]).toEqual([11, 10, 10, 0])
    expect(got.length).toBe(3)
  })
})

describe('scalar queries', () => {
  test('applePos returns the apple coordinates', () => {
    const s = makeState({ apple: v(3, 4, 5) })
    expect(applePos(s)).toEqual(v(3, 4, 5))
  })

  test('applePos tracks a respawned apple', () => {
    const s = makeState({ apple: v(11, 10, 10) })
    tick(s, config, 100)
    const p = applePos(s)
    expect(p).not.toEqual(v(11, 10, 10))
    expect(p).toEqual(s.apple)
  })

  test('cubeSize', () => {
    expect(cubeSize(makeState({ size: 50 }))).toBe(50)
  })

  test('elapsedMs accumulates only clamped running time', () => {
    const s = makeState()
    expect(elapsedMs(s)).toBe(0)
    tick(s, config, 40)
    tick(s, config, 30)
    expect(elapsedMs(s)).toBe(70)
    tick(s, config, 100000)
    expect(elapsedMs(s)).toBe(70 + config.loop.maxFrameMs)
  })

  test('head, snakeLength, score, cameraFrame, isAlive', () => {
    const s = makeState({ score: 4 })
    expect(head(s)).toBe(s.snake[0]!)
    expect(head(s)).toEqual(v(10, 10, 10))
    expect(snakeLength(s)).toBe(3)
    expect(score(s)).toBe(4)
    expect(cameraFrame(s)).toBe(s.frame)
    expect(isAlive(s)).toBe(true)
    expect(isAlive(makeState({ phase: 'ready' }))).toBe(true)
    expect(isAlive(makeState({ phase: 'dead' }))).toBe(false)
  })
})

describe('gameMode', () => {
  test('reads the phase of the camera from the state', () => {
    expect(gameMode(makeState())).toBe('plane')
    expect(gameMode(makeState({ mode: 'free' }))).toBe('free')
  })
})

describe('stepProgress — sinceStepMs / stepMs, clamped to 0..1', () => {
  test('fraction of the step elapsed', () => {
    expect(stepProgress(makeState({ stepMs: 200, sinceStepMs: 0 }))).toBe(0)
    expect(stepProgress(makeState({ stepMs: 200, sinceStepMs: 50 }))).toBe(0.25)
    expect(stepProgress(makeState({ stepMs: 200, sinceStepMs: 199 }))).toBeCloseTo(0.995, 10)
  })

  test('clamped into [0, 1]', () => {
    expect(stepProgress(makeState({ stepMs: 100, sinceStepMs: 100 }))).toBe(1)
    expect(stepProgress(makeState({ stepMs: 100, sinceStepMs: 250 }))).toBe(1)
    expect(stepProgress(makeState({ stepMs: 100, sinceStepMs: -30 }))).toBe(0)
  })

  test('stepMs <= 0 or NaN gives 0 (no division by zero)', () => {
    expect(stepProgress(makeState({ stepMs: 0, sinceStepMs: 50 }))).toBe(0)
    expect(stepProgress(makeState({ stepMs: -10, sinceStepMs: 50 }))).toBe(0)
    expect(stepProgress(makeState({ stepMs: NaN, sinceStepMs: 50 }))).toBe(0)
  })

  test('follows tick(): grows between steps and wraps to ~0 after a step', () => {
    const s = makeState({ stepMs: 100, apple: v(0, 0, 0) })
    tick(s, config, 30)
    expect(stepProgress(s)).toBeCloseTo(0.3, 10)
    tick(s, config, 60)
    expect(stepProgress(s)).toBeCloseTo(0.9, 10)
    tick(s, config, 20) // шаг, остаток 10
    expect(stepProgress(s)).toBeCloseTo(0.1, 10)
  })
})
