import { describe, expect, test } from 'bun:test'
import { cellKey } from './state'
import { tick, turnAxis, turnInPlane } from './commands'
import {
  applePos,
  cameraFrame,
  cubeSize,
  elapsedMs,
  forEachObstacle,
  forEachSnakeSegment,
  gameMode,
  head,
  intendedHeading,
  isAlive,
  score,
  snakeLength,
  stepProgress,
  viewFrame,
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

describe('intendedHeading / viewFrame — поворот виден сразу по вводу, тело стоит', () => {
  const AXES = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)]
  const DIRS = ['left', 'right', 'up', 'down'] as const
  const cross = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
    v(a.y * b.z - a.z * b.y + 0, a.z * b.x - a.x * b.z + 0, a.x * b.y - a.y * b.x + 0)
  const neg = (a: { x: number; y: number; z: number }) => v(-a.x + 0, -a.y + 0, -a.z + 0)

  /** 24 ориентации кадра free: depth = -heading. */
  function frames() {
    const out: { heading: ReturnType<typeof v>; right: ReturnType<typeof v>; up: ReturnType<typeof v> }[] = []
    for (const up of AXES)
      for (const right of AXES) {
        if (up.x * right.x + up.y * right.y + up.z * right.z !== 0) continue
        out.push({ heading: neg(cross(right, up)), right, up })
      }
    return out
  }
  function freeState(f: { heading: ReturnType<typeof v>; right: ReturnType<typeof v>; up: ReturnType<typeof v> }) {
    const h = f.heading
    return makeState({
      size: 40,
      snake: [v(20, 20, 20), v(20 - h.x, 20 - h.y, 20 - h.z), v(20 - 2 * h.x, 20 - 2 * h.y, 20 - 2 * h.z)],
      apple: v(0, 0, 0),
      mode: 'free',
      heading: { ...h },
      frame: { right: { ...f.right }, up: { ...f.up }, depth: cross(f.right, f.up) },
    })
  }

  test('без ввода: intendedHeading = heading, viewFrame = сам s.frame', () => {
    const s = makeState()
    expect(intendedHeading(s)).toEqual(s.heading)
    expect(viewFrame(s)).toBe(s.frame)
  })

  test('free, все 24 ориентации x 4 свайпа: до такта тело и state не тронуты, а вид уже смотрит в новую сторону', () => {
    for (const f of frames()) {
      for (const dir of DIRS) {
        const s = freeState(f)
        const bodyBefore = JSON.stringify(s.snake)
        turnInPlane(s, dir)
        const frameBefore = JSON.stringify(s.frame)
        const headingBefore = JSON.stringify(s.heading)
        const want = dir === 'right' ? f.right : dir === 'left' ? neg(f.right) : dir === 'up' ? f.up : neg(f.up)
        // направление головы — новое, сразу
        expect(intendedHeading(s)).toEqual(want)
        // кадр камеры: depth = -новый heading, правая тройка, unit-векторы без -0
        const vf = viewFrame(s)
        expect(vf.depth).toEqual(neg(want))
        expect(cross(vf.right, vf.up)).toEqual(vf.depth)
        for (const a of [vf.right, vf.up, vf.depth]) for (const c of [a.x, a.y, a.z]) expect(Object.is(c, -0)).toBe(false)
        // само состояние и тело — нетронуты (запрос только читает)
        expect(JSON.stringify(s.snake)).toBe(bodyBefore)
        expect(JSON.stringify(s.frame)).toBe(frameBefore)
        expect(JSON.stringify(s.heading)).toBe(headingBefore)
        // и после такта кадр ядра совпадает с тем, что уже показывали: повторного скачка камеры нет
        const preview = JSON.stringify(vf)
        s.sinceStepMs = 0
        tick(s, config, s.stepMs)
        expect(JSON.stringify(s.frame)).toBe(preview)
        expect(intendedHeading(s)).toEqual(want)
        expect(s.snake[0]).toEqual(v(20 + want.x, 20 + want.y, 20 + want.z))
      }
    }
  })

  test('два ввода до такта: вид следует последнему, как и ядро (последний выигрывает)', () => {
    const f = frames()[0]!
    const s = freeState(f)
    turnInPlane(s, 'left')
    turnInPlane(s, 'up')
    expect(intendedHeading(s)).toEqual(f.up)
    expect(viewFrame(s).depth).toEqual(neg(f.up))
  })

  test('plane: поворот в плоскости меняет направление головы сразу, кадр камеры не двигается', () => {
    const s = makeState() // plane, heading +x, frame по умолчанию
    const frameBefore = JSON.stringify(s.frame)
    turnInPlane(s, 'up')
    expect(intendedHeading(s)).toEqual(s.pendingTurn!)
    expect(intendedHeading(s)).not.toEqual(s.heading)
    expect(viewFrame(s)).toBe(s.frame)
    expect(JSON.stringify(s.frame)).toBe(frameBefore)
  })

  test('plane: смена оси — кадр ядро довернуло в момент команды, вид и направление актуальны до такта', () => {
    const s = makeState()
    const bodyBefore = JSON.stringify(s.snake)
    turnAxis(s, 'into')
    expect(intendedHeading(s)).toEqual(s.pendingTurn!)
    expect(viewFrame(s)).toBe(s.frame)
    expect(JSON.stringify(s.snake)).toBe(bodyBefore)
  })

  test('повторные вызовы дают тот же результат и не копят состояние (без аллокаций: тот же объект)', () => {
    const s = freeState(frames()[3]!)
    turnInPlane(s, 'right')
    const a = viewFrame(s)
    const snapshot = JSON.stringify(a)
    const b = viewFrame(s)
    expect(b).toBe(a)
    expect(JSON.stringify(b)).toBe(snapshot)
  })
})
