import { describe, expect, test } from 'bun:test'
import { cellKey } from './state'
import { tick, turnAxis, turnInPlane } from './commands'
import {
  appleOnCourse,
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
  stepsToCrash,
  viewFrame,
} from './queries'
import { config, makeState, v } from './test-helpers'

describe('forEachObstacle: decoding cellKey', () => {
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
    tick(s, config, 20) // step, remainder 10
    expect(stepProgress(s)).toBeCloseTo(0.1, 10)
  })
})

describe('intendedHeading / viewFrame: the turn is visible right from input, the body stands still', () => {
  const AXES = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)]
  const DIRS = ['left', 'right', 'up', 'down'] as const
  const cross = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
    v(a.y * b.z - a.z * b.y + 0, a.z * b.x - a.x * b.z + 0, a.x * b.y - a.y * b.x + 0)
  const neg = (a: { x: number; y: number; z: number }) => v(-a.x + 0, -a.y + 0, -a.z + 0)

  /** 24 orientations of the free frame: depth = -heading. */
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

  test('without input: intendedHeading = heading, viewFrame = s.frame itself', () => {
    const s = makeState()
    expect(intendedHeading(s)).toEqual(s.heading)
    expect(viewFrame(s)).toBe(s.frame)
  })

  test('free, all 24 orientations x 4 swipes: until the step the body and state are untouched, yet the view already looks the new way', () => {
    for (const f of frames()) {
      for (const dir of DIRS) {
        const s = freeState(f)
        const bodyBefore = JSON.stringify(s.snake)
        turnInPlane(s, dir)
        const frameBefore = JSON.stringify(s.frame)
        const headingBefore = JSON.stringify(s.heading)
        const want = dir === 'right' ? f.right : dir === 'left' ? neg(f.right) : dir === 'up' ? f.up : neg(f.up)
        // head direction: new, immediately
        expect(intendedHeading(s)).toEqual(want)
        // camera frame: depth = -new heading, right-handed triple, unit vectors without -0
        const vf = viewFrame(s)
        expect(vf.depth).toEqual(neg(want))
        expect(cross(vf.right, vf.up)).toEqual(vf.depth)
        for (const a of [vf.right, vf.up, vf.depth]) for (const c of [a.x, a.y, a.z]) expect(Object.is(c, -0)).toBe(false)
        // the state and body themselves are untouched (the query only reads)
        expect(JSON.stringify(s.snake)).toBe(bodyBefore)
        expect(JSON.stringify(s.frame)).toBe(frameBefore)
        expect(JSON.stringify(s.heading)).toBe(headingBefore)
        // and after the step the core frame matches what was already shown: no second camera jump
        const preview = JSON.stringify(vf)
        s.sinceStepMs = 0
        tick(s, config, s.stepMs)
        expect(JSON.stringify(s.frame)).toBe(preview)
        expect(intendedHeading(s)).toEqual(want)
        expect(s.snake[0]).toEqual(v(20 + want.x, 20 + want.y, 20 + want.z))
      }
    }
  })

  test('two inputs before the step: the view follows the last one, like the core (last wins)', () => {
    const f = frames()[0]!
    const s = freeState(f)
    turnInPlane(s, 'left')
    turnInPlane(s, 'up')
    expect(intendedHeading(s)).toEqual(f.up)
    expect(viewFrame(s).depth).toEqual(neg(f.up))
  })

  test('plane: an in-plane turn changes the head direction immediately, the camera frame does not move', () => {
    const s = makeState() // plane, heading +x, default frame
    const frameBefore = JSON.stringify(s.frame)
    turnInPlane(s, 'up')
    expect(intendedHeading(s)).toEqual(s.pendingTurn!)
    expect(intendedHeading(s)).not.toEqual(s.heading)
    expect(viewFrame(s)).toBe(s.frame)
    expect(JSON.stringify(s.frame)).toBe(frameBefore)
  })

  test('plane: axis turn: the core rolled the frame at the moment of the command, view and direction are current before the step', () => {
    const s = makeState()
    const bodyBefore = JSON.stringify(s.snake)
    turnAxis(s, 'into')
    expect(intendedHeading(s)).toEqual(s.pendingTurn!)
    expect(viewFrame(s)).toBe(s.frame)
    expect(JSON.stringify(s.snake)).toBe(bodyBefore)
  })

  test('repeated calls give the same result and accumulate no state (no allocations: the same object)', () => {
    const s = freeState(frames()[3]!)
    turnInPlane(s, 'right')
    const a = viewFrame(s)
    const snapshot = JSON.stringify(a)
    const b = viewFrame(s)
    expect(b).toBe(a)
    expect(JSON.stringify(b)).toBe(snapshot)
  })
})

// The head (10,10,10) goes right (+x), the body is behind; cube 20.
describe('stepsToCrash: how many steps until a crash', () => {
  const H = 2
  test('a clear path: 0', () => {
    expect(stepsToCrash(makeState(), H)).toBe(0)
  })

  test('wall: adjacent = 1, one cell away = 2, beyond the horizon = 0', () => {
    const at = (x: number) => makeState({ snake: [v(x, 10, 10), v(x - 1, 10, 10), v(x - 2, 10, 10)] })
    expect(stepsToCrash(at(19), H)).toBe(1)
    expect(stepsToCrash(at(18), H)).toBe(2)
    expect(stepsToCrash(at(17), H)).toBe(0)
  })

  test('the horizon is a number from outside: at 3 a crash in three steps is visible', () => {
    const s = makeState({ snake: [v(17, 10, 10), v(16, 10, 10), v(15, 10, 10)] })
    expect(stepsToCrash(s, 3)).toBe(3)
    expect(stepsToCrash(s, 2)).toBe(0)
  })

  test('a wall on each of the six axes', () => {
    for (const [d, head] of [
      [v(-1, 0, 0), v(0, 10, 10)],
      [v(0, 1, 0), v(10, 19, 10)],
      [v(0, -1, 0), v(10, 0, 10)],
      [v(0, 0, 1), v(10, 10, 19)],
      [v(0, 0, -1), v(10, 10, 0)],
    ] as const) {
      const s = makeState({ heading: d, snake: [head, v(head.x - d.x, head.y - d.y, head.z - d.z)] })
      expect(stepsToCrash(s, H)).toBe(1)
    }
  })

  test('obstacle adjacent = 1, one cell away = 2', () => {
    const near = makeState({ obstacles: new Set([cellKey(11, 10, 10, 20)]) })
    const far = makeState({ obstacles: new Set([cellKey(12, 10, 10, 20)]) })
    expect(stepsToCrash(near, H)).toBe(1)
    expect(stepsToCrash(far, H)).toBe(2)
  })

  test('an obstacle off the heading does not count', () => {
    const s = makeState({ obstacles: new Set([cellKey(11, 11, 10, 20)]) })
    expect(stepsToCrash(s, H)).toBe(0)
  })

  test('own body: a loop, the head runs into its own segment', () => {
    // the head (10,10,10) goes +x; the body wraps around and stands at (11,10,10)
    const snake = [v(10, 10, 10), v(10, 11, 10), v(11, 11, 10), v(11, 10, 10), v(12, 10, 10), v(13, 10, 10)]
    const s = makeState({ snake })
    expect(stepsToCrash(s, H)).toBe(1)
  })

  test('a vacating tail does not count as an obstacle (as in the core) until growth is used up', () => {
    // the tail stands ahead of the head, at (11,10,10): by the first step it has not left yet only with growth
    const snake = [v(10, 10, 10), v(10, 11, 10), v(11, 11, 10), v(11, 10, 10)]
    expect(stepsToCrash(makeState({ snake, growth: 0 }), H)).toBe(0)
    expect(stepsToCrash(makeState({ snake, growth: 1 }), H)).toBe(1)
  })

  test('a body segment two cells away will be freed by the time the head arrives: not a crash', () => {
    // the last two segments stand at (11,10,10) and (12,10,10)? no: the tail at (12,10,10), its neighbor at (11,10,10)
    const snake = [v(10, 10, 10), v(10, 11, 10), v(11, 11, 10), v(12, 11, 10), v(12, 10, 10), v(11, 10, 10)]
    // cell (11,10,10) is the tail (last): left by step 1; (12,10,10) is second to last: left by step 2
    expect(stepsToCrash(makeState({ snake }), H)).toBe(0)
    // with growth 1 the tail holds on step 1
    expect(stepsToCrash(makeState({ snake, growth: 1 }), H)).toBe(1)
  })

  test('accounts for a turn that was entered but not yet executed (pendingTurn)', () => {
    const s = makeState({ snake: [v(19, 10, 10), v(18, 10, 10), v(17, 10, 10)], pendingTurn: v(0, 1, 0) })
    expect(stepsToCrash(s, H)).toBe(0)
    s.pendingTurn = null
    expect(stepsToCrash(s, H)).toBe(1)
  })

  test('free mode (heading along depth): wall and obstacle on the third axis', () => {
    const frame = { right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) }
    const wall = makeState({ mode: 'free', frame, heading: v(0, 0, -1), snake: [v(10, 10, 1), v(10, 10, 2), v(10, 10, 3)] })
    expect(stepsToCrash(wall, H)).toBe(2)
    const obs = makeState({ mode: 'free', frame, heading: v(0, 0, -1), snake: [v(10, 10, 8), v(10, 10, 9), v(10, 10, 10)], obstacles: new Set([cellKey(10, 10, 7, 20)]) })
    expect(stepsToCrash(obs, H)).toBe(1)
  })

  test('outside running: 0; the state does not change', () => {
    const s = makeState({ snake: [v(19, 10, 10), v(18, 10, 10), v(17, 10, 10)] })
    const before = JSON.stringify([s.snake, s.pendingTurn, s.stepCount, s.phase])
    expect(stepsToCrash(s, H)).toBe(1)
    expect(JSON.stringify([s.snake, s.pendingTurn, s.stepCount, s.phase])).toBe(before)
    s.phase = 'dead'
    expect(stepsToCrash(s, H)).toBe(0)
    s.phase = 'ready'
    expect(stepsToCrash(s, H)).toBe(0)
  })
})

describe('appleOnCourse: the apple on the current heading', () => {
  test('the apple exactly along the heading, any distance', () => {
    expect(appleOnCourse(makeState({ apple: v(11, 10, 10) }))).toBe(true)
    expect(appleOnCourse(makeState({ apple: v(19, 10, 10) }))).toBe(true)
  })

  test('the apple to the side, behind or off the axis: no', () => {
    expect(appleOnCourse(makeState({ apple: v(15, 11, 10) }))).toBe(false)
    expect(appleOnCourse(makeState({ apple: v(10, 15, 10) }))).toBe(false)
    expect(appleOnCourse(makeState({ apple: v(5, 10, 10), snake: [v(10, 10, 10), v(9, 9, 10), v(8, 9, 10)] }))).toBe(false)
  })

  test('an apple behind an obstacle is NOT on the heading (the snake will not reach it)', () => {
    const s = makeState({ apple: v(15, 10, 10), obstacles: new Set([cellKey(13, 10, 10, 20)]) })
    expect(appleOnCourse(s)).toBe(false)
    s.obstacles.clear()
    expect(appleOnCourse(s)).toBe(true)
  })

  test('an apple behind its own body is not on the heading', () => {
    const snake = [v(10, 10, 10), v(10, 11, 10), v(11, 11, 10), v(12, 11, 10), v(12, 10, 10), v(13, 10, 10), v(14, 10, 10), v(15, 10, 10), v(16, 10, 10)]
    // (12,10,10) is occupied by a segment that will not be freed by step 2 (the tail is far)
    expect(appleOnCourse(makeState({ snake, apple: v(14, 10, 10) }))).toBe(false)
  })

  test('an obstacle AFTER the apple does not interfere', () => {
    const s = makeState({ apple: v(13, 10, 10), obstacles: new Set([cellKey(15, 10, 10, 20)]) })
    expect(appleOnCourse(s)).toBe(true)
  })

  test('accounts for the entered turn', () => {
    const s = makeState({ apple: v(10, 15, 10), pendingTurn: v(0, 1, 0) })
    expect(appleOnCourse(s)).toBe(true)
    s.pendingTurn = null
    expect(appleOnCourse(s)).toBe(false)
  })

  test('an apple on the heading and a crash in two steps at the same time is impossible without an obstacle in front of it; with an obstacle: false', () => {
    const s = makeState({ apple: v(15, 10, 10), obstacles: new Set([cellKey(12, 10, 10, 20)]) })
    expect(stepsToCrash(s, 2)).toBe(2)
    expect(appleOnCourse(s)).toBe(false)
  })

  test('free mode: along the depth axis', () => {
    const frame = { right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) }
    const s = makeState({ mode: 'free', frame, heading: v(0, 0, -1), snake: [v(10, 10, 10), v(10, 10, 11), v(10, 10, 12)], apple: v(10, 10, 4) })
    expect(appleOnCourse(s)).toBe(true)
    s.apple = v(10, 10, 14)
    expect(appleOnCourse(s)).toBe(false)
  })

  test('outside running: false', () => {
    expect(appleOnCourse(makeState({ apple: v(15, 10, 10), phase: 'dead' }))).toBe(false)
  })
})
