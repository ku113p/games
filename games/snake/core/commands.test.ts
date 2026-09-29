import { describe, expect, test } from 'bun:test'
import { cellKey, type GameState, type ScreenDir, type Vec3 } from './state'
import { createGame, type Config } from './rules'
import { setBoost, startGame, tick, turnAxis, turnInPlane, type GameEvent } from './commands'
import { cameraFrame, isBoostActive, isBoosting, stepProgress } from './queries'
import { config, makeRng, makeState, v } from './test-helpers'

/** Feeds time in small chunks until a step happens; returns a copy of that step's events. */
function stepOnce(s: GameState, cfg: Config = config): GameEvent[] {
  for (let i = 0; i < 1000; i++) {
    const ev = tick(s, cfg, 10)
    if (ev.length > 0) return [...ev]
  }
  throw new Error('no step happened')
}

function cfgWith(patch: Partial<Config>): Config {
  return { ...config, ...patch }
}

/** -v without signed zeros (toEqual distinguishes -0 from 0). */
function neg(a: Vec3): Vec3 {
  return v(0 - a.x, 0 - a.y, 0 - a.z)
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** Invariant: heading always lies in the camera's screen plane (±right or ±up from cameraFrame). */
function expectHeadingInScreenPlane(s: GameState): void {
  const f = cameraFrame(s)
  expect(Math.abs(dot(s.heading, f.right)) + Math.abs(dot(s.heading, f.up))).toBe(1)
  expect(dot(s.heading, f.depth)).toBe(0)
}

function snapshotTurnRelevant(s: GameState) {
  return JSON.stringify({
    h: s.heading,
    f: s.frame,
    p: s.pendingTurn,
    r: s.rolledSinceStep,
    ph: s.phase,
    sn: s.snake,
  })
}

describe('startGame', () => {
  test('ready → running and emits started', () => {
    const s = makeState({ phase: 'ready' })
    const events = startGame(s)
    expect(s.phase).toBe('running')
    expect(events).toEqual([{ type: 'started' }])
  })

  test('on a dead game it does nothing (no resurrection)', () => {
    const s = makeState({ phase: 'dead', score: 7 })
    const events = startGame(s)
    expect(events).toEqual([])
    expect(s.phase).toBe('dead')
    expect(s.score).toBe(7)
  })

  test('on a running game it emits nothing', () => {
    const s = makeState()
    expect(startGame(s)).toEqual([])
    expect(s.phase).toBe('running')
  })
})

describe('event buffer and singleton events', () => {
  test('every command returns the same reused array per game', () => {
    const s = makeState({ phase: 'ready' })
    const a = startGame(s)
    const b = tick(s, config, 100)
    const c = turnInPlane(s, 'up')
    expect(b).toBe(a)
    expect(c).toBe(a)
    const other = makeState()
    expect(tick(other, config, 100)).not.toBe(a)
  })

  test('the moved event is one frozen singleton (no allocation per step)', () => {
    const s = makeState()
    const first = stepOnce(s)[0]!
    const second = stepOnce(s)[0]!
    expect(first).toEqual({ type: 'moved' })
    expect(Object.isFrozen(first)).toBe(true)
    expect(second).toBe(first)
  })
})

describe('turnInPlane: all four headings × all four directions', () => {
  const headings: Array<{ name: string; h: Vec3 }> = [
    { name: '+right', h: v(1, 0, 0) },
    { name: '-right', h: v(-1, 0, 0) },
    { name: '+up', h: v(0, 1, 0) },
    { name: '-up', h: v(0, -1, 0) },
  ]
  const dirs: Record<ScreenDir, Vec3> = {
    right: v(1, 0, 0),
    left: v(-1, 0, 0),
    up: v(0, 1, 0),
    down: v(0, -1, 0),
  }
  for (const { name, h } of headings) {
    for (const dir of ['left', 'right', 'up', 'down'] as ScreenDir[]) {
      const target = dirs[dir]
      const opposite = target.x === -h.x && target.y === -h.y
      test(`heading ${name}, turn ${dir}: ${opposite ? 'ignored (180°)' : 'buffered'}`, () => {
        const s = makeState({
          heading: { ...h },
          snake: [v(10, 10, 10), v(10 - h.x, 10 - h.y, 10), v(10 - 2 * h.x, 10 - 2 * h.y, 10)],
        })
        const events = turnInPlane(s, dir)
        expect(s.heading).toEqual(h) // heading itself does not change until the step
        if (opposite) {
          expect(events).toEqual([])
          expect(s.pendingTurn).toBeNull()
        } else {
          expect(events).toEqual([{ type: 'turned', heading: target }])
          expect(s.pendingTurn).toEqual(target)
          stepOnce(s)
          expect(s.heading).toEqual(target)
          expect(s.snake[0]).toEqual(v(10 + target.x, 10 + target.y, 10))
        }
      })
    }
  }

  test('a perpendicular turn is accepted even after another perpendicular one was queued', () => {
    const s = makeState({ heading: v(0, 1, 0), snake: [v(10, 10, 10), v(10, 9, 10), v(10, 8, 10)] })
    turnInPlane(s, 'right')
    const events = turnInPlane(s, 'left') // -right is not opposite to heading (+up)
    expect(events).toEqual([{ type: 'turned', heading: v(-1, 0, 0) }])
    expect(s.pendingTurn).toEqual(v(-1, 0, 0))
  })

  test('a reversal is judged against the last moved heading, not against the queued turn', () => {
    const s = makeState({ heading: v(1, 0, 0) })
    turnInPlane(s, 'up')
    const events = turnInPlane(s, 'left') // opposite to heading (+right) → discarded
    expect(events).toEqual([])
    expect(s.pendingTurn).toEqual(v(0, 1, 0)) // the previous buffer survived
  })

  test('uses the current (rotated) frame for directions', () => {
    const s = makeState({
      heading: v(0, 0, -1),
      frame: { right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) },
    })
    turnInPlane(s, 'right')
    expect(s.pendingTurn).toEqual(v(1, 0, 0))
    turnInPlane(s, 'up') // +up' = +z, opposite to heading (-z)
    expect(s.pendingTurn).toEqual(v(1, 0, 0))
    turnInPlane(s, 'down') // -up' = -z = heading: allowed
    expect(s.pendingTurn).toEqual(v(0, 0, -1))
  })

  test('does nothing in phases ready and dead', () => {
    for (const phase of ['ready', 'dead'] as const) {
      const s = makeState({ phase })
      const before = snapshotTurnRelevant(s)
      expect(turnInPlane(s, 'up')).toEqual([])
      expect(snapshotTurnRelevant(s)).toBe(before)
    }
  })
})

describe('turnAxis: axis turn for all four headings', () => {
  // Expected frame after a +90° roll around the signed heading, and the heading for into/out.
  const table: Array<{
    name: string
    heading: Vec3
    frame: { right: Vec3; up: Vec3; depth: Vec3 }
    into: Vec3
    out: Vec3
  }> = [
    { name: '+right', heading: v(1, 0, 0), frame: { right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) }, into: v(0, 0, -1), out: v(0, 0, 1) },
    { name: '-right', heading: v(-1, 0, 0), frame: { right: v(1, 0, 0), up: v(0, 0, -1), depth: v(0, 1, 0) }, into: v(0, 0, -1), out: v(0, 0, 1) },
    { name: '+up', heading: v(0, 1, 0), frame: { right: v(0, 0, -1), up: v(0, 1, 0), depth: v(1, 0, 0) }, into: v(0, 0, -1), out: v(0, 0, 1) },
    { name: '-up', heading: v(0, -1, 0), frame: { right: v(0, 0, 1), up: v(0, 1, 0), depth: v(-1, 0, 0) }, into: v(0, 0, -1), out: v(0, 0, 1) },
  ]
  for (const row of table) {
    for (const dir of ['into', 'out'] as const) {
      test(`heading ${row.name}, ${dir}`, () => {
        const s = makeState({ heading: { ...row.heading } })
        const expectedHeading = dir === 'into' ? row.into : row.out
        const events = turnAxis(s, dir)
        expect(events).toEqual([{ type: 'axisTurned', rollAxis: row.heading, direction: dir }])
        // The frame is rolled immediately: the camera and the core agree from the moment of the event.
        expect(s.frame).toEqual(row.frame)
        expect(s.heading).toEqual(row.heading) // heading changes on the next step
        expect(s.pendingTurn).toEqual(expectedHeading)
        // Turn-in-place step: the heading is new, the snake stands still. It moves only on the step after that.
        const flip = stepOnce(s)
        expect(flip).toEqual([{ type: 'turnedInPlace', heading: expectedHeading }])
        expect(s.heading).toEqual(expectedHeading)
        expect(s.frame).toEqual(row.frame)
        expect(s.snake[0]).toEqual(v(10, 10, 10))
        expect(stepOnce(s)).toEqual([{ type: 'moved' }])
        expect(s.snake[0]).toEqual(v(10 + expectedHeading.x, 10 + expectedHeading.y, 10 + expectedHeading.z))
        expectHeadingInScreenPlane(s)
      })
    }
  }

  test('contract: +right into → frame (R,D,-U), heading = screen down; out → screen up', () => {
    const into = makeState()
    turnAxis(into, 'into')
    stepOnce(into)
    expect(into.frame).toEqual({ right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) })
    expect(into.heading).toEqual({ x: 0 - into.frame.up.x, y: 0 - into.frame.up.y, z: 0 - into.frame.up.z })

    const out = makeState()
    turnAxis(out, 'out')
    stepOnce(out)
    expect(out.frame).toEqual(into.frame)
    expect(out.heading).toEqual(out.frame.up)
  })

  test('rolls around the last moved heading even if a plane turn is queued', () => {
    const s = makeState()
    turnInPlane(s, 'up')
    const events = turnAxis(s, 'into')
    expect(events).toEqual([{ type: 'axisTurned', rollAxis: v(1, 0, 0), direction: 'into' }])
    expect(s.pendingTurn).toEqual(v(0, 0, -1))
  })

  test('no signed zeros leak into heading or frame', () => {
    const s = makeState({ heading: v(0, -1, 0) })
    turnAxis(s, 'into')
    stepOnce(s)
    for (const vec of [s.heading, s.frame.right, s.frame.up, s.frame.depth])
      for (const c of [vec.x, vec.y, vec.z]) expect(Object.is(c, -0)).toBe(false)
  })

  test('does nothing in phases ready and dead', () => {
    for (const phase of ['ready', 'dead'] as const) {
      const s = makeState({ phase })
      const before = snapshotTurnRelevant(s)
      expect(turnAxis(s, 'into')).toEqual([])
      expect(turnAxis(s, 'out')).toEqual([])
      expect(snapshotTurnRelevant(s)).toBe(before)
    }
  })
})

describe('roll invariant: the camera is always derived from cameraFrame', () => {
  test('1. turnAxis(into), then turnInPlane before the step, then the step', () => {
    const s = makeState()
    const e1 = turnAxis(s, 'into')
    expect(e1.map((e) => e.type)).toEqual(['axisTurned'])
    const rolled = JSON.parse(JSON.stringify(cameraFrame(s)))
    expect(rolled).toEqual({ right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) })

    const e2 = turnInPlane(s, 'up') // in the rolled frame up' = +z
    expect(e2).toEqual([{ type: 'turned', heading: v(0, 0, 1) }])
    expect(cameraFrame(s)).toEqual(rolled) // the roll is not cancelled

    const ev = stepOnce(s) // turn-in-place step: the snake stands still
    expect(ev.filter((e) => e.type === 'axisTurned').length).toBe(0)
    expect(cameraFrame(s)).toEqual(rolled)
    expect(s.heading).toEqual(v(0, 0, 1))
    expect(s.snake[0]).toEqual(v(10, 10, 10))
    stepOnce(s)
    expect(s.snake[0]).toEqual(v(10, 10, 11))
    expectHeadingInScreenPlane(s)
    // further turns go by the rolled frame
    turnInPlane(s, 'right')
    stepOnce(s)
    expect(s.heading).toEqual(v(1, 0, 0))
  })

  test('1b. turnInPlane, then turnAxis: the roll happens, the buffer is replaced', () => {
    const s = makeState()
    turnInPlane(s, 'down')
    turnAxis(s, 'out')
    stepOnce(s)
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) })
    expect(s.heading).toEqual(v(0, 0, 1))
    expectHeadingInScreenPlane(s)
  })

  test('2. turnAxis(into), then turnAxis(out) before the step, then the step', () => {
    const s = makeState()
    const e1 = [...turnAxis(s, 'into')]
    const e2 = [...turnAxis(s, 'out')]
    const all = [...e1, ...e2]
    // The camera rolls exactly once, and the frame is rolled exactly once.
    expect(all.filter((e) => e.type === 'axisTurned').length).toBe(1)
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) })
    expect(e2).toEqual([{ type: 'turned', heading: v(0, 0, 1) }]) // out = +D_old

    stepOnce(s)
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) })
    expect(s.heading).toEqual(v(0, 0, 1))
    expect(s.snake[0]).toEqual(v(10, 10, 10)) // turn-in-place step
    stepOnce(s)
    expect(s.snake[0]).toEqual(v(10, 10, 11))
    expectHeadingInScreenPlane(s)
  })

  test('2b. out, then into: also a single roll, heading = -D_old', () => {
    const s = makeState()
    turnAxis(s, 'out')
    const e2 = [...turnAxis(s, 'into')]
    expect(e2).toEqual([{ type: 'turned', heading: v(0, 0, -1) }])
    stepOnce(s)
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) })
    expect(s.heading).toEqual(v(0, 0, -1))
    expectHeadingInScreenPlane(s)
  })

  test('2c. a repeated turnAxis also works for heading ±up (a different roll axis)', () => {
    const s = makeState({ heading: v(0, 1, 0) })
    turnAxis(s, 'into')
    const e = [...turnAxis(s, 'out')]
    expect(e).toEqual([{ type: 'turned', heading: v(0, 0, 1) }])
    stepOnce(s)
    expect(s.heading).toEqual(v(0, 0, 1))
    expectHeadingInScreenPlane(s)
  })

  test('3. two turnInPlane in a row before the step: the last one wins, the frame is untouched', () => {
    const s = makeState()
    turnInPlane(s, 'up')
    turnInPlane(s, 'down')
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) })
    stepOnce(s)
    expect(s.heading).toEqual(v(0, -1, 0))
    expect(s.snake[0]).toEqual(v(10, 9, 10))
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) })
    expectHeadingInScreenPlane(s)
  })

  test('4. death on the same step as the scheduled roll', () => {
    // z = 0 and into → heading -z → wall. The roll was already shown to the camera, the world is consistent.
    const s = makeState({ snake: [v(10, 10, 0), v(9, 10, 0), v(8, 10, 0)] })
    const e1 = [...turnAxis(s, 'into')]
    expect(e1.map((e) => e.type)).toEqual(['axisTurned'])
    const rolled = JSON.parse(JSON.stringify(cameraFrame(s)))
    const flip = stepOnce(s) // a turn-in-place step does not kill: nowhere to go
    expect(flip.map((e) => e.type)).toEqual(['turnedInPlace'])
    expect(s.phase).toBe('running')
    const ev = stepOnce(s) // but the first step into the wall kills
    expect(ev).toContainEqual({ type: 'died', cause: 'wall' })
    expect(s.phase).toBe('dead')
    expect(cameraFrame(s)).toEqual(rolled)
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) })
    expectHeadingInScreenPlane(s)
    expect(s.snake[0]).toEqual(v(10, 10, 0)) // the head did not move
    // on a dead game, commands change nothing
    const before = snapshotTurnRelevant(s)
    expect(turnAxis(s, 'out')).toEqual([])
    expect(turnInPlane(s, 'left')).toEqual([])
    expect(snapshotTurnRelevant(s)).toBe(before)
  })

  test('4b. death by an obstacle on the roll step', () => {
    const s = makeState({ obstacles: new Set([cellKey(10, 10, 11, 20)]) })
    turnAxis(s, 'out')
    expect(stepOnce(s).map((e) => e.type)).toEqual(['turnedInPlace'])
    expect(s.phase).toBe('running')
    const ev = stepOnce(s)
    expect(ev).toContainEqual({ type: 'died', cause: 'obstacle' })
    expectHeadingInScreenPlane(s)
  })

  test('after the step the roll flag is cleared: the next turnAxis rolls the frame again', () => {
    const s = makeState()
    turnAxis(s, 'into')
    stepOnce(s)
    const events = turnAxis(s, 'into')
    expect(events.map((e) => e.type)).toEqual(['axisTurned'])
    stepOnce(s)
    expectHeadingInScreenPlane(s)
  })

  test('random command series: heading is always in the cameraFrame plane, axisTurned = exactly a frame change', () => {
    let seed = 12345
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const dirs: ScreenDir[] = ['left', 'right', 'up', 'down']
    for (let game = 0; game < 30; game++) {
      const s = makeState({ size: 60, snake: [v(30, 30, 30), v(29, 30, 30), v(28, 30, 30)], apple: v(0, 0, 0) })
      for (let i = 0; i < 40 && s.phase === 'running'; i++) {
        const cmds = Math.floor(rnd() * 4)
        for (let c = 0; c < cmds; c++) {
          const before = JSON.stringify(s.frame)
          const ev =
            rnd() < 0.5
              ? turnAxis(s, rnd() < 0.5 ? 'into' : 'out')
              : turnInPlane(s, dirs[Math.floor(rnd() * 4)]!)
          const rolled = ev.some((e) => e.type === 'axisTurned')
          expect(JSON.stringify(s.frame) !== before).toBe(rolled)
        }
        stepOnce(s)
        expectHeadingInScreenPlane(s)
      }
    }
  })
})

describe('eating an apple', () => {
  test('grows by growPerApple (not a hardcoded number) and reports score', () => {
    for (const grow of [1, 3]) {
      const cfg = cfgWith({ snake: { startLength: 3, growPerApple: grow } })
      const s = makeState({ apple: v(11, 10, 10) })
      const ev = stepOnce(s, cfg)
      expect(ev.find((e) => e.type === 'ate')).toEqual({ type: 'ate', apple: v(11, 10, 10), score: 1 })
      expect(s.score).toBe(1)
      expect(s.applesEaten).toBe(1)
      expect(s.growth).toBe(grow)
      expect(s.snake.length).toBe(3)
      s.apple.x = 0
      s.apple.y = 0
      s.apple.z = 0 // move the apple out of the way
      for (let i = 0; i < grow + 3; i++) stepOnce(s, cfg)
      expect(s.snake.length).toBe(3 + grow)
      expect(s.snakeCells.size).toBe(3 + grow)
      expect(s.growth).toBe(0)
    }
  })

  test('while growing the tail stays; afterwards the length is constant', () => {
    const cfg = cfgWith({ snake: { startLength: 3, growPerApple: 2 } })
    const s = makeState({ apple: v(11, 10, 10) })
    stepOnce(s, cfg) // eaten (a step without growth: the tail left (8,10,10))
    s.apple.x = 0
    s.apple.y = 0
    s.apple.z = 0
    expect(s.snake[s.snake.length - 1]).toEqual(v(9, 10, 10))
    stepOnce(s, cfg)
    expect(s.snake[s.snake.length - 1]).toEqual(v(9, 10, 10)) // the tail stayed in place
    expect(s.snake.length).toBe(4)
    stepOnce(s, cfg)
    expect(s.snake.length).toBe(5)
    expect(s.snake[s.snake.length - 1]).toEqual(v(9, 10, 10))
    stepOnce(s, cfg)
    expect(s.snake.length).toBe(5)
    expect(s.snake[s.snake.length - 1]).toEqual(v(10, 10, 10))
  })

  test('exactly one apple at a time: one appleSpawned, on a free cell, matches s.apple', () => {
    for (let seed = 0; seed < 30; seed++) {
      const size = 6
      const obstacles = new Set<number>()
      for (let k = 0; k < size ** 3; k++) if (k % 3 === 0 && k !== cellKey(3, 3, 3, size) && k !== cellKey(4, 3, 3, size)) obstacles.add(k)
      const s = makeState({
        size,
        snake: [v(3, 3, 3), v(2, 3, 3)],
        obstacles: new Set([...obstacles].filter((k) => k !== cellKey(2, 3, 3, size))),
        apple: v(4, 3, 3),
        rngState: seed * 31,
      })
      const ev = stepOnce(s)
      const spawned = ev.filter((e) => e.type === 'appleSpawned')
      expect(spawned.length).toBe(1)
      expect(ev.filter((e) => e.type === 'ate').length).toBe(1)
      const a = (spawned[0] as { type: 'appleSpawned'; apple: Vec3 }).apple
      expect(a).toEqual(s.apple)
      const key = cellKey(a.x, a.y, a.z, size)
      expect(s.snakeCells.has(key)).toBe(false)
      expect(s.obstacles.has(key)).toBe(false)
    }
  })

  test('a step without eating spawns no apple and keeps the apple', () => {
    const s = makeState()
    const ev = stepOnce(s)
    expect(ev.map((e) => e.type)).toEqual(['moved'])
    expect(s.apple).toEqual(v(19, 19, 19))
  })
})

describe('speed increases with apples eaten', () => {
  test('emits speedUp and reduces stepMs', () => {
    const s = makeState({ stepMs: 180, apple: v(11, 10, 10) })
    const ev = stepOnce(s)
    expect(ev.find((e) => e.type === 'speedUp')).toEqual({ type: 'speedUp', stepMs: 176 })
    expect(s.stepMs).toBe(176)
  })

  test('no speedUp event when already at minStepMs', () => {
    const s = makeState({ stepMs: config.speed.minStepMs, applesEaten: 100, apple: v(11, 10, 10) })
    const ev = stepOnce(s)
    expect(ev.some((e) => e.type === 'speedUp')).toBe(false)
    expect(s.stepMs).toBe(config.speed.minStepMs)
  })
})

describe('death: all six cube faces', () => {
  const size = 20
  const faces: Array<{ name: string; head: Vec3; heading: Vec3; inside: Vec3 }> = [
    { name: '+x', head: v(size - 1, 10, 10), heading: v(1, 0, 0), inside: v(size - 2, 10, 10) },
    { name: '-x', head: v(0, 10, 10), heading: v(-1, 0, 0), inside: v(1, 10, 10) },
    { name: '+y', head: v(10, size - 1, 10), heading: v(0, 1, 0), inside: v(10, size - 2, 10) },
    { name: '-y', head: v(10, 0, 10), heading: v(0, -1, 0), inside: v(10, 1, 10) },
    { name: '+z', head: v(10, 10, size - 1), heading: v(0, 0, 1), inside: v(10, 10, size - 2) },
    { name: '-z', head: v(10, 10, 0), heading: v(0, 0, -1), inside: v(10, 10, 1) },
  ]
  for (const f of faces) {
    test(`wall ${f.name}: dies at the face, lives one cell before`, () => {
      const dead = makeState({ snake: [{ ...f.head }], heading: { ...f.heading } })
      const ev = stepOnce(dead)
      expect(ev).toEqual([{ type: 'died', cause: 'wall' }])
      expect(dead.phase).toBe('dead')
      expect(dead.snake[0]).toEqual(f.head)

      const alive = makeState({ snake: [{ ...f.inside }], heading: { ...f.heading } })
      const ev2 = stepOnce(alive)
      expect(ev2).toEqual([{ type: 'moved' }])
      expect(alive.phase).toBe('running')
      expect(alive.snake[0]).toEqual(f.head)
    })

    test(`obstacle ${f.name}: dies with cause "obstacle"`, () => {
      const c = f.inside
      const s = makeState({
        snake: [{ ...c }],
        heading: { ...f.heading },
        obstacles: new Set([cellKey(c.x + f.heading.x, c.y + f.heading.y, c.z + f.heading.z, size)]),
      })
      expect(stepOnce(s)).toEqual([{ type: 'died', cause: 'obstacle' }])
      expect(s.phase).toBe('dead')
    })
  }

  test('a dead game no longer steps and accumulates no time', () => {
    const s = makeState({ snake: [v(size - 1, 10, 10)] })
    stepOnce(s)
    expect(s.phase).toBe('dead')
    const elapsed = s.elapsedMs
    expect(tick(s, config, 500)).toEqual([])
    expect(s.elapsedMs).toBe(elapsed)
  })

  test('the death check order: obstacle beats nothing else; body kills with "body"', () => {
    const s = makeState({
      snake: [v(10, 10, 10), v(11, 10, 10), v(12, 10, 10), v(13, 10, 10)],
    })
    expect(stepOnce(s)).toEqual([{ type: 'died', cause: 'body' }])
  })
})

describe('moving into the vacating tail cell', () => {
  // A 2×2 square snake: the head (10,10) goes right into the tail cell (11,10).
  const square = () => [v(10, 10, 10), v(10, 11, 10), v(11, 11, 10), v(11, 10, 10)]

  test('without growth the head may enter the cell the tail is leaving', () => {
    const s = makeState({ snake: square(), growth: 0 })
    const ev = stepOnce(s)
    expect(ev).toEqual([{ type: 'moved' }])
    expect(s.phase).toBe('running')
    expect(s.snake.length).toBe(4)
    expect(s.snake[0]).toEqual(v(11, 10, 10))
    expect(s.snakeCells.size).toBe(4)
    expect(s.snakeCells.has(cellKey(11, 10, 10, 20))).toBe(true)
    expect(s.snakeCells.has(cellKey(10, 10, 10, 20))).toBe(true)
  })

  test('while growing the tail stays in place — that is death by body', () => {
    const s = makeState({ snake: square(), growth: 1 })
    expect(stepOnce(s)).toEqual([{ type: 'died', cause: 'body' }])
    expect(s.phase).toBe('dead')
  })

  test('the second-to-last segment is never free', () => {
    const s = makeState({ snake: [v(10, 10, 10), v(10, 11, 10), v(11, 11, 10), v(11, 10, 10), v(11, 9, 10)], growth: 0 })
    // ahead (11,10) is not the tail (the tail is (11,9))
    expect(stepOnce(s)).toEqual([{ type: 'died', cause: 'body' }])
  })
})

describe('tick: time and safeguards', () => {
  test('makes as many steps as time allows and keeps the remainder', () => {
    const s = makeState({ stepMs: 30 })
    const ev = tick(s, config, 100)
    expect(ev.filter((e) => e.type === 'moved').length).toBe(3)
    expect(s.sinceStepMs).toBe(10)
    expect(s.elapsedMs).toBe(100)
    expect(s.stepCount).toBe(3)
    expect(s.snake[0]).toEqual(v(13, 10, 10))
  })

  test('less than a step: no movement, time accumulates', () => {
    const s = makeState({ stepMs: 100 })
    expect(tick(s, config, 60)).toEqual([])
    expect(s.sinceStepMs).toBe(60)
    expect(tick(s, config, 40).length).toBe(1)
    expect(s.sinceStepMs).toBe(0)
  })

  test('dt is capped by loop.maxFrameMs', () => {
    const s = makeState({ stepMs: 10, size: 400, snake: [v(10, 10, 10)] })
    tick(s, config, 1e9)
    expect(s.elapsedMs).toBe(config.loop.maxFrameMs)
    expect(s.stepCount).toBe(10)
    tick(s, config, Infinity)
    expect(s.elapsedMs).toBe(2 * config.loop.maxFrameMs)
    const wide = cfgWith({ loop: { maxFrameMs: 350 } })
    const s2 = makeState({ stepMs: 100 })
    tick(s2, wide, 5000)
    expect(s2.stepCount).toBe(3)
    expect(s2.sinceStepMs).toBe(50)
  })

  test('step count per call is bounded even with a corrupted accumulator', () => {
    const s = makeState({ size: 500, snake: [v(10, 10, 10)], stepMs: 1, sinceStepMs: 1e9, apple: v(0, 0, 0) })
    tick(s, config, 16)
    expect(s.stepCount).toBeLessThanOrEqual(Math.ceil(config.loop.maxFrameMs / 1) + 1)
    expect(s.stepCount).toBeGreaterThan(0)
    expect(s.sinceStepMs).toBeLessThan(s.stepMs)
  })

  test('stepMs <= 0 or NaN never loops forever and does nothing', () => {
    for (const stepMs of [0, -5, NaN]) {
      const s = makeState({ stepMs })
      const ev = tick(s, config, 50)
      expect(ev).toEqual([])
      expect(s.stepCount).toBe(0)
      expect(s.elapsedMs).toBe(0)
      expect(s.sinceStepMs).toBe(0)
      expect(s.snake[0]).toEqual(v(10, 10, 10))
    }
  })

  test('negative, zero and NaN dt are ignored', () => {
    for (const dt of [-50, 0, NaN, -Infinity]) {
      const s = makeState({ sinceStepMs: 20, elapsedMs: 7 })
      expect(tick(s, config, dt)).toEqual([])
      expect(s.sinceStepMs).toBe(20)
      expect(s.elapsedMs).toBe(7)
      expect(Number.isNaN(s.sinceStepMs)).toBe(false)
    }
  })

  test('does not tick in phase ready', () => {
    const s = makeState({ phase: 'ready' })
    expect(tick(s, config, 100)).toEqual([])
    expect(s.elapsedMs).toBe(0)
    expect(s.stepCount).toBe(0)
  })
})

describe('demo turn: on step demo.afterSteps of the first game, direction chosen among the free ones', () => {
  function demoState(overrides: Partial<GameState> = {}): GameState {
    return makeState({ demoTurnPending: true, apple: v(0, 0, 0), size: 30, snake: [v(10, 10, 10), v(9, 10, 10), v(8, 10, 10)], ...overrides })
  }
  function typesOf(evs: GameEvent[]): string[] {
    return evs.map((e) => e.type)
  }

  test('does not fire before step 5, fires exactly at step 5, and switches mode', () => {
    const s = demoState()
    for (let i = 1; i <= 4; i++) {
      const ev = stepOnce(s)
      expect(typesOf(ev)).toEqual(['moved'])
      expect(s.demoTurnPending).toBe(true)
      expect(s.mode).toBe('plane')
    }
    expect(typesOf(stepOnce(s))).toEqual(['moved']) // the 5th step is an ordinary step
    expect(s.stepCount).toBe(5)
    expect(s.mode).toBe('plane')
    expect(s.demoTurnPending).toBe(true)
    const ev = stepOnce(s) // the next step is a separate turn-in-place step
    expect(s.stepCount).toBe(5) // a turn-in-place step does not count as a step
    expect(typesOf(ev)).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
    expect(ev[1]).toEqual({ type: 'modeChanged', mode: 'free' })
    expect(s.demoTurnPending).toBe(false)
    expect(s.mode).toBe('free')
    expect(s.snake[0]).toEqual(v(15, 10, 10)) // the snake stands still
    expect(s.snake.length).toBe(3)
  })

  test('demo turn: heading = ∓old depth right away, depth = -heading, no pendingTurn, no axisTurned', () => {
    // seed-independent: check both branches (into: frame unchanged; out: right/depth flip sign, up stays)
    const seen = new Set<number>()
    for (let seed = 0; seed < 40; seed++) {
      const s = demoState({ rngState: seed * 977 })
      const evAll: GameEvent[] = []
      for (let i = 0; i < 6; i++) evAll.push(...stepOnce(s))
      expect(evAll.some((e) => e.type === 'axisTurned')).toBe(false)
      expect(s.pendingTurn).toBeNull()
      expect(s.rolledSinceStep).toBe(false)
      expect(s.heading.z === 1 || s.heading.z === -1).toBe(true)
      expect(s.heading.x).toBe(0)
      expect(s.heading.y).toBe(0)
      expect(s.frame.depth).toEqual(neg(s.heading))
      expect(s.frame.up).toEqual(v(0, 1, 0))
      if (s.heading.z === -1) expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) })
      else expect(s.frame).toEqual({ right: v(-1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, -1) })
      seen.add(s.heading.z)
      // and the next step follows the new heading
      stepOnce(s)
      expect(s.snake[0]).toEqual(v(15, 10, 10 + s.heading.z))
    }
    expect([...seen].sort()).toEqual([-1, 1])
  })

  test('when both sides are free the branch follows the seeded rng exactly: first draw < 0.5 -> into, else out', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rngState = seed * 977
      const s = demoState({ rngState })
      for (let i = 0; i < 6; i++) stepOnce(s)
      expect(s.heading.z).toBe(makeRng(rngState)() < 0.5 ? -1 : 1)
    }
  })

  test('demo turn works from every screen orientation and in-plane heading, both branches (forced by obstacles)', () => {
    const AX = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)]
    const crossV = (a: Vec3, b: Vec3) => v(a.y * b.z - a.z * b.y + 0, a.z * b.x - a.x * b.z + 0, a.x * b.y - a.y * b.x + 0)
    let cases = 0
    for (const up of AX) {
      for (const right of AX) {
        if (dot(up, right) !== 0) continue
        const depth = crossV(right, up)
        for (const h of [right, neg(right), up, neg(up)]) {
          for (const into of [true, false]) {
            const size = 40
            const c = 20
            const snake = [v(c, c, c), v(c - h.x, c - h.y, c - h.z), v(c - 2 * h.x, c - 2 * h.y, c - 2 * h.z)]
            // after the step the head is at c+h; block the opposite side along depth
            const blocked = into ? depth : neg(depth)
            const obs = cellKey(c + h.x + blocked.x, c + h.y + blocked.y, c + h.z + blocked.z, size)
            const s = makeState({
              size,
              snake,
              heading: { ...h },
              frame: { right: { ...right }, up: { ...up }, depth: { ...depth } },
              demoTurnPending: true,
              apple: v(0, 0, 0),
              obstacles: new Set([obs]),
            })
            const cfg1 = cfgWith({ demo: { afterSteps: 1 } })
            expect(stepOnce(s, cfg1).map((e) => e.type)).toEqual(['moved'])
            const ev = stepOnce(s, cfg1)
            expect(ev.map((e) => e.type)).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
            expect(s.snake[0]).toEqual(v(c + h.x, c + h.y, c + h.z)) // on the turn-in-place step the snake stands still
            const want = into ? neg(depth) : depth
            expect(s.heading).toEqual(want)
            expect(s.frame.depth).toEqual(neg(want))
            expect(s.frame.up).toEqual(up)
            expect(s.frame.right).toEqual(into ? right : neg(right))
            expect(crossV(s.frame.right, s.frame.up)).toEqual(s.frame.depth)
            for (const a of [s.frame.right, s.frame.up, s.frame.depth, s.heading]) {
              for (const k of [a.x, a.y, a.z]) expect(Object.is(k, -0)).toBe(false)
            }
            cases++
          }
        }
      }
    }
    expect(cases).toBe(24 * 4 * 2) // 24 orientations × 4 headings in the plane × 2 branches
  })

  test('demo turn from a vertical heading (moving up on screen) keeps up, depth = -heading', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = demoState({ rngState: seed * 31, heading: v(0, 1, 0), snake: [v(10, 10, 10), v(10, 9, 10), v(10, 8, 10)] })
      for (let i = 0; i < 6; i++) stepOnce(s)
      expect(s.mode).toBe('free')
      expect(s.frame.depth).toEqual(neg(s.heading))
      expect(s.frame.up).toEqual(v(0, 1, 0))
      expect(s.frame.right.y).toBe(0)
    }
  })

  test('direction is random among free: both into and out occur across seeds', () => {
    const seen = new Set<number>()
    for (let seed = 0; seed < 40; seed++) {
      const s = demoState({ rngState: seed * 977 })
      for (let i = 0; i < 6; i++) stepOnce(s)
      seen.add(s.heading.z)
    }
    expect([...seen].sort()).toEqual([-1, 1])
  })

  test('deterministic for the same seed', () => {
    const a = demoState({ rngState: 99 })
    const b = demoState({ rngState: 99 })
    for (let i = 0; i < 5; i++) {
      stepOnce(a)
      stepOnce(b)
    }
    expect(a.heading).toEqual(b.heading)
    expect(a.frame).toEqual(b.frame)
  })

  test('obstacle on the "out" side: always goes "into"; obstacle on "into" side: always "out"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const a = demoState({ rngState: seed * 13, obstacles: new Set([cellKey(15, 10, 11, 30)]) })
      for (let i = 0; i < 6; i++) stepOnce(a)
      expect(a.heading).toEqual(v(0, 0, -1))
      const b = demoState({ rngState: seed * 13, obstacles: new Set([cellKey(15, 10, 9, 30)]) })
      for (let i = 0; i < 6; i++) stepOnce(b)
      expect(b.heading).toEqual(v(0, 0, 1))
    }
  })

  test('wall on one side: never turns into the wall', () => {
    for (let seed = 0; seed < 20; seed++) {
      const top = demoState({ rngState: seed * 17, snake: [v(10, 10, 29), v(9, 10, 29), v(8, 10, 29)] })
      for (let i = 0; i < 6; i++) stepOnce(top)
      expect(top.heading).toEqual(v(0, 0, -1))
      const bottom = demoState({ rngState: seed * 17, snake: [v(10, 10, 0), v(9, 10, 0), v(8, 10, 0)] })
      for (let i = 0; i < 6; i++) stepOnce(bottom)
      expect(bottom.heading).toEqual(v(0, 0, 1))
    }
  })

  test('own body on one side: never turns into itself', () => {
    const cfg1 = cfgWith({ demo: { afterSteps: 1 } })
    // head (10,10,10) → (11,10,10); above the future head (z+1) is the body (11,10,11)
    for (let seed = 0; seed < 20; seed++) {
      const s = makeState({
        size: 30,
        demoTurnPending: true,
        apple: v(0, 0, 0),
        rngState: seed * 19,
        snake: [v(10, 10, 10), v(10, 10, 11), v(11, 10, 11), v(11, 11, 11), v(12, 11, 11)],
      })
      stepOnce(s, cfg1)
      stepOnce(s, cfg1) // turn-in-place step
      expect(s.heading).toEqual(v(0, 0, -1))
    }
  })

  test('a cell the tail is just leaving counts as free; while growing it does not', () => {
    const cfg1 = cfgWith({ demo: { afterSteps: 1 } })
    // after the step the tail stands at (11,10,11), above the new head; below, (11,10,9) is an obstacle
    const mk = (growth: number) =>
      makeState({
        size: 30,
        demoTurnPending: true,
        apple: v(0, 0, 0),
        growth,
        snake: [v(10, 10, 10), v(10, 10, 11), v(11, 10, 11), v(12, 10, 11)],
        obstacles: new Set([cellKey(11, 10, 9, 30)]),
      })
    const free = mk(0)
    stepOnce(free, cfg1)
    stepOnce(free, cfg1)
    expect(free.heading).toEqual(v(0, 0, 1))
    expect(free.demoTurnPending).toBe(false)
    const growing = mk(1)
    stepOnce(growing, cfg1)
    const ev = stepOnce(growing, cfg1)
    expect(ev.some((e) => e.type === 'demoTurn')).toBe(false)
    expect(growing.demoTurnPending).toBe(true)
  })

  test('both sides blocked: demo does not fire and the flag is not spent; it retries on later steps', () => {
    // On step 5 the head is at (15,10,10): obstacles both above and below. On step 6 the head (16,10,10) is free.
    const s = demoState({ obstacles: new Set([cellKey(15, 10, 11, 30), cellKey(15, 10, 9, 30)]) })
    for (let i = 0; i < 5; i++) {
      const ev = stepOnce(s)
      expect(ev.some((e) => e.type === 'demoTurn' || e.type === 'modeChanged')).toBe(false)
    }
    expect(s.demoTurnPending).toBe(true)
    expect(s.pendingTurn).toBeNull()
    expect(s.mode).toBe('plane')
    expect(s.heading).toEqual(v(1, 0, 0))
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) })
    // Step 6: both sides are still occupied, so the demo does not fire, the snake just moves.
    expect(typesOf(stepOnce(s))).toEqual(['moved'])
    expect(s.demoTurnPending).toBe(true)
    // Step 7: the head is at (16,10,10), free: a separate turn-in-place step.
    expect(typesOf(stepOnce(s))).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
    expect(s.demoTurnPending).toBe(false)
  })

  test('fires exactly once — later apples and steps never trigger it again', () => {
    const s = demoState({ size: 60, snake: [v(10, 30, 30), v(9, 30, 30), v(8, 30, 30)] })
    let total = 0
    for (let i = 0; i < 40 && s.phase === 'running'; i++) {
      if (i === 8) {
        // put the apple under the head: the second eaten apple
        const h = s.snake[0]!
        s.apple.x = h.x + s.heading.x
        s.apple.y = h.y + s.heading.y
        s.apple.z = h.z + s.heading.z
      }
      const ev = stepOnce(s)
      total += ev.filter((e) => e.type === 'demoTurn').length
      if (i === 5) {
        // after the demo, turn to the free side ourselves so as not to hit anything
        turnInPlane(s, 'right')
      }
    }
    expect(total).toBe(1)
    expect(s.applesEaten).toBeGreaterThanOrEqual(1) // the second apple was really eaten
  })

  test('never fires when the game is not the first', () => {
    const s = demoState({ demoTurnPending: false })
    for (let i = 0; i < 12; i++) {
      const ev = stepOnce(s)
      expect(ev.some((e) => e.type === 'demoTurn')).toBe(false)
    }
  })

  test('does not fire on the step where the snake dies', () => {
    const s = demoState({ snake: [v(14, 10, 10), v(13, 10, 10), v(12, 10, 10)], size: 15, obstacles: new Set() })
    // step 1..: x=15 is a wall on the very first step, we will not live to step 5
    stepOnce(s)
    expect(s.phase).toBe('dead')
    expect(s.demoTurnPending).toBe(true)
  })

  test('the step loop stops after the demo turn so main can pause (no extra steps, no banked time)', () => {
    const cfg = cfgWith({ demo: { afterSteps: 1 }, loop: { maxFrameMs: 350 } })
    const s = makeState({ size: 30, demoTurnPending: true, apple: v(0, 0, 0), stepMs: 100 })
    const ev = tick(s, cfg, 350)
    expect(ev.filter((e) => e.type === 'moved').length).toBe(1)
    expect(ev.some((e) => e.type === 'demoTurn')).toBe(true)
    expect(s.sinceStepMs).toBe(0)
  })

  test('createGame(first game ever): plane start, the demo fires exactly at step afterSteps with modeChanged + demoTurn', () => {
    const cfg = cfgWith({ obstacles: { density: 0, stickiness: 0, clearRadius: 4, wallMargin: 1 } })
    const s = createGame(cfg, 20, 5, true)
    expect(s.mode).toBe('plane')
    s.apple.x = 0
    s.apple.y = 0
    s.apple.z = 0
    startGame(s)
    let fired = -1
    let changes = 0
    for (let i = 1; i <= 8; i++) {
      const ev = stepOnce(s, cfg)
      changes += ev.filter((e) => e.type === 'modeChanged').length
      if (ev.some((e) => e.type === 'demoTurn')) fired = s.stepCount
    }
    expect(fired).toBe(cfg.demo.afterSteps)
    expect(changes).toBe(1)
    expect(s.mode).toBe('free')
    expect(s.demoTurnPending).toBe(false)
  })

  test('createGame(not first game): free from the start, no modeChanged/demoTurn ever, invariant holds through play', () => {
    const cfg = cfgWith({ obstacles: { density: 0, stickiness: 0, clearRadius: 4, wallMargin: 1 } })
    const dirs: ScreenDir[] = ['left', 'right', 'up', 'down']
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame(cfg, 30, seed, false)
      expect(s.mode).toBe('free')
      s.apple.x = 0
      s.apple.y = 0
      s.apple.z = 0
      const startEv = startGame(s)
      expect(startEv.some((e) => e.type === 'modeChanged' || e.type === 'demoTurn')).toBe(false)
      const rng = makeRng(seed)
      for (let i = 0; i < 40 && s.phase === 'running'; i++) {
        if (i % 2 === 0) {
          const tev = turnInPlane(s, dirs[Math.floor(rng() * 4)]!)
          expect(tev.some((e) => e.type === 'modeChanged' || e.type === 'demoTurn' || e.type === 'axisTurned')).toBe(false)
        }
        const ev = stepOnce(s, cfg)
        expect(ev.some((e) => e.type === 'modeChanged' || e.type === 'demoTurn')).toBe(false)
        expect(s.mode).toBe('free')
        expect(s.demoTurnPending).toBe(false)
        const { heading: h, frame: f } = s
        expect(f.depth).toEqual(v(-h.x + 0, -h.y + 0, -h.z + 0))
        for (const vec of [h, f.right, f.up, f.depth]) {
          expect(Object.is(vec.x, -0) || Object.is(vec.y, -0) || Object.is(vec.z, -0)).toBe(false)
        }
      }
    }
  })

  test('createGame(not first game): the demo does not fire at step afterSteps, even with the free ahead on both sides', () => {
    const cfg = cfgWith({ obstacles: { density: 0, stickiness: 0, clearRadius: 4, wallMargin: 1 } })
    const s = createGame(cfg, 30, 5, false)
    s.apple.x = 0
    s.apple.y = 0
    s.apple.z = 0
    startGame(s)
    for (let i = 0; i < cfg.demo.afterSteps + 3; i++) {
      expect(stepOnce(s, cfg).some((e) => e.type === 'demoTurn')).toBe(false)
    }
    expect(s.stepCount).toBe(cfg.demo.afterSteps + 3)
  })

  test('createGame(not first game): first swipe uses the free start basis (right = +z, up = +y) and keeps depth = -heading', () => {
    const cfg = cfgWith({ obstacles: { density: 0, stickiness: 0, clearRadius: 4, wallMargin: 1 } })
    const cases: [ScreenDir, Vec3][] = [
      ['right', v(0, 0, 1)],
      ['left', v(0, 0, -1)],
      ['up', v(0, 1, 0)],
      ['down', v(0, -1, 0)],
    ]
    for (const [dir, expected] of cases) {
      const s = createGame(cfg, 30, 2, false)
      s.apple.x = 0
      s.apple.y = 0
      s.apple.z = 0
      startGame(s)
      turnInPlane(s, dir)
      stepOnce(s, cfg)
      expect(s.heading).toEqual(expected)
      expect(s.frame.depth).toEqual(v(-expected.x + 0, -expected.y + 0, -expected.z + 0))
    }
  })

  test('createGame(not first game): a turnAxis at the start is a no-op', () => {
    const s = createGame(config, 20, 5, false)
    startGame(s)
    expect(turnAxis(s, 'into')).toEqual([])
    expect(turnAxis(s, 'out')).toEqual([])
    expect(s.heading).toEqual(v(1, 0, 0))
  })
})

describe('determinism', () => {
  test('same seed and same input sequence produce identical states', () => {
    const seed = 777
    const a = createGame(config, 20, seed, true)
    const b = createGame(config, 20, seed, true)
    startGame(a)
    startGame(b)

    for (let i = 0; i < 40; i++) {
      if (i === 5) {
        turnInPlane(a, 'up')
        turnInPlane(b, 'up')
      }
      if (i === 15) {
        turnAxis(a, 'into')
        turnAxis(b, 'into')
      }
      stepOnce(a)
      stepOnce(b)
      if (a.phase === 'dead' || b.phase === 'dead') break
    }

    expect(a.snake).toEqual(b.snake)
    expect(a.heading).toEqual(b.heading)
    expect(a.frame).toEqual(b.frame)
    expect(a.apple).toEqual(b.apple)
    expect(Array.from(a.obstacles).sort()).toEqual(Array.from(b.obstacles).sort())
    expect(a.score).toBe(b.score)
    expect(a.rngState).toBe(b.rngState)
    expect(a.phase).toBe(b.phase)
    expect(a.stepCount).toBe(b.stepCount)
  })
})

describe("free mode — camera behind the head: heading = -depth, four swipes cover all 3D", () => {
  const DIRS: ScreenDir[] = ['left', 'right', 'up', 'down']
  const AXES: Vec3[] = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)]

  function cross(a: Vec3, b: Vec3): Vec3 {
    return v(a.y * b.z - a.z * b.y + 0, a.z * b.x - a.x * b.z + 0, a.x * b.y - a.y * b.x + 0)
  }

  /** All 24 frame orientations; heading = -depth. In total 6 headings × 4 variants of up. */
  function allFrames(): { heading: Vec3; right: Vec3; up: Vec3; depth: Vec3 }[] {
    const out: { heading: Vec3; right: Vec3; up: Vec3; depth: Vec3 }[] = []
    for (const up of AXES) {
      for (const right of AXES) {
        if (dot(up, right) !== 0) continue
        const depth = cross(right, up)
        out.push({ heading: neg(depth), right, up, depth })
      }
    }
    return out
  }

  /** Free mode in the middle of a big cube, the snake trails back along -heading. */
  function freeState(f: { heading: Vec3; right: Vec3; up: Vec3; depth: Vec3 }, overrides: Partial<GameState> = {}): GameState {
    const size = 40
    const head = v(20, 20, 20)
    const snake = [head, v(20 - f.heading.x, 20 - f.heading.y, 20 - f.heading.z), v(20 - 2 * f.heading.x, 20 - 2 * f.heading.y, 20 - 2 * f.heading.z)]
    return makeState({
      size,
      snake,
      apple: v(0, 0, 0),
      mode: 'free',
      heading: { ...f.heading },
      frame: { right: { ...f.right }, up: { ...f.up }, depth: { ...f.depth } },
      ...overrides,
    })
  }

  function expectFreeInvariant(s: GameState): void {
    const f = s.frame
    expect(f.depth).toEqual(neg(s.heading))
    expect(cross(f.right, f.up)).toEqual(f.depth) // right-handed triple: depth = right × up
    expect(dot(f.right, f.up)).toBe(0)
    for (const a of [f.right, f.up, f.depth]) {
      expect(Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z)).toBe(1)
      for (const c of [a.x, a.y, a.z]) expect(Object.is(c, -0)).toBe(false)
    }
    for (const c of [s.heading.x, s.heading.y, s.heading.z]) expect(Object.is(c, -0)).toBe(false)
  }

  function expected(dir: ScreenDir, f: { right: Vec3; up: Vec3 }): Vec3 {
    if (dir === 'right') return f.right
    if (dir === 'left') return neg(f.right)
    if (dir === 'up') return f.up
    return neg(f.up)
  }

  test('sanity: the generator gives 24 distinct right-handed frames covering all six headings', () => {
    const fr = allFrames()
    expect(fr.length).toBe(24)
    expect(new Set(fr.map((f) => JSON.stringify(f))).size).toBe(24)
    expect(new Set(fr.map((f) => JSON.stringify(f.heading))).size).toBe(6)
  })

  test('all 4 turns from all 24 orientations: heading = ±right/±up, depth = -heading, frame stays right-handed', () => {
    for (const f of allFrames()) {
      for (const dir of DIRS) {
        const s = freeState(f)
        const want = expected(dir, f)
        const ev = turnInPlane(s, dir)
        expect(ev).toEqual([{ type: 'turned', heading: want }])
        stepOnce(s)
        expect(s.heading).toEqual(want)
        expectFreeInvariant(s)
        // and the head really went along the new heading
        expect(s.snake[0]).toEqual(v(20 + want.x, 20 + want.y, 20 + want.z))
      }
    }
  })

  test('yaw (left/right) keeps up untouched; pitch (up/down) keeps right untouched — no roll', () => {
    for (const f of allFrames()) {
      for (const dir of ['left', 'right'] as const) {
        const s = freeState(f)
        turnInPlane(s, dir)
        stepOnce(s)
        expect(s.frame.up).toEqual(f.up)
      }
      for (const dir of ['up', 'down'] as const) {
        const s = freeState(f)
        turnInPlane(s, dir)
        stepOnce(s)
        expect(s.frame.right).toEqual(f.right)
      }
    }
  })

  test('explicit table from the base frame (heading = into the screen)', () => {
    const base = { heading: v(0, 0, -1), right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) }
    const table: Record<ScreenDir, { right: Vec3; up: Vec3; depth: Vec3; heading: Vec3 }> = {
      right: { heading: v(1, 0, 0), right: v(0, 0, 1), up: v(0, 1, 0), depth: v(-1, 0, 0) },
      left: { heading: v(-1, 0, 0), right: v(0, 0, -1), up: v(0, 1, 0), depth: v(1, 0, 0) },
      up: { heading: v(0, 1, 0), right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) },
      down: { heading: v(0, -1, 0), right: v(1, 0, 0), up: v(0, 0, -1), depth: v(0, 1, 0) },
    }
    for (const dir of DIRS) {
      const s = freeState(base)
      turnInPlane(s, dir)
      stepOnce(s)
      const t = table[dir]
      expect(s.heading).toEqual(t.heading)
      expect(s.frame).toEqual({ right: t.right, up: t.up, depth: t.depth })
    }
  })

  test('before the step nothing moves: heading and frame stay, pendingTurn holds the target, no axisTurned', () => {
    for (const f of allFrames()) {
      const s = freeState(f)
      const ev = turnInPlane(s, 'right')
      expect(ev.some((e) => e.type === 'axisTurned')).toBe(false)
      expect(s.pendingTurn).toEqual(f.right)
      expect(s.heading).toEqual(f.heading)
      expect(cameraFrame(s)).toEqual({ right: f.right, up: f.up, depth: f.depth })
      expect(s.rolledSinceStep).toBe(false)
    }
  })

  test('two turns before a step: the last one wins and is relative to the committed frame (no self-reversal)', () => {
    for (const f of allFrames()) {
      for (const first of DIRS) {
        for (const second of DIRS) {
          const s = freeState(f)
          turnInPlane(s, first)
          turnInPlane(s, second)
          stepOnce(s)
          expect(s.heading).toEqual(expected(second, f))
          expect(dot(s.heading, f.heading)).toBe(0) // never a reversal and never "straight"
          expectFreeInvariant(s)
          expect(s.phase).toBe('running') // did not run into the neck
        }
      }
    }
  })

  test('a step without a turn keeps heading and frame', () => {
    for (const f of allFrames()) {
      const s = freeState(f)
      stepOnce(s)
      stepOnce(s)
      expect(s.heading).toEqual(f.heading)
      expect(s.frame).toEqual({ right: f.right, up: f.up, depth: f.depth })
    }
  })

  test('four yaws or four pitches in a row return to the original frame; up never self-flips under yaw', () => {
    for (const f of allFrames()) {
      for (const dir of DIRS) {
        const s = freeState(f)
        for (let i = 0; i < 4; i++) {
          turnInPlane(s, dir)
          stepOnce(s)
          expectFreeInvariant(s)
          if (dir === 'left' || dir === 'right') expect(s.frame.up).toEqual(f.up)
        }
        expect(s.heading).toEqual(f.heading)
        expect(s.frame).toEqual({ right: f.right, up: f.up, depth: f.depth })
      }
    }
  })

  test('left then right (across steps) returns to the original heading and frame', () => {
    for (const f of allFrames()) {
      for (const [a, b] of [['left', 'right'], ['right', 'left'], ['up', 'down'], ['down', 'up']] as const) {
        const s = freeState(f)
        turnInPlane(s, a)
        stepOnce(s)
        turnInPlane(s, b)
        stepOnce(s)
        expect(s.heading).toEqual(f.heading)
        expect(s.frame).toEqual({ right: f.right, up: f.up, depth: f.depth })
      }
    }
  })

  test('long random walk of swipes keeps every invariant (deterministic rng)', () => {
    const s = freeState(allFrames()[0]!, { size: 200, snake: [v(100, 100, 100), v(100, 100, 101), v(100, 100, 102)] })
    let seed = 12345
    for (let i = 0; i < 300; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) | 0
      const dir = DIRS[(seed >>> 16) & 3]!
      const before = { right: { ...s.frame.right }, up: { ...s.frame.up }, heading: { ...s.heading } }
      turnInPlane(s, dir)
      stepOnce(s)
      expect(s.phase).toBe('running')
      expectFreeInvariant(s)
      expect(s.heading).toEqual(expected(dir, before))
      if (dir === 'left' || dir === 'right') expect(s.frame.up).toEqual(before.up)
      else expect(s.frame.right).toEqual(before.right)
    }
  })

  test('turnAxis in free is a no-op: empty events, state untouched (both directions, before and after a buffered turn)', () => {
    for (const f of allFrames()) {
      for (const dir of ['into', 'out'] as const) {
        const s = freeState(f)
        const before = snapshotTurnRelevant(s)
        expect(turnAxis(s, dir)).toEqual([])
        expect(snapshotTurnRelevant(s)).toBe(before)
        expect(s.rolledSinceStep).toBe(false)
        turnInPlane(s, 'left')
        const buffered = snapshotTurnRelevant(s)
        expect(turnAxis(s, dir)).toEqual([])
        expect(snapshotTurnRelevant(s)).toBe(buffered)
        stepOnce(s)
        expect(s.heading).toEqual(neg(f.right))
      }
    }
  })

  test('turnInPlane in free outside the running phase does nothing', () => {
    const f = allFrames()[0]!
    const ready = freeState(f, { phase: 'ready' })
    expect(turnInPlane(ready, 'left')).toEqual([])
    expect(ready.pendingTurn).toBeNull()
    const dead = freeState(f, { phase: 'dead' })
    expect(turnInPlane(dead, 'left')).toEqual([])
    expect(dead.pendingTurn).toBeNull()
  })

  test('death on the step of a turn: frame is still consistent with heading (depth = -heading)', () => {
    const f = { heading: v(0, 0, -1), right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) }
    // the snake is at the right wall, turning right → wall
    const s = freeState(f, { size: 21, snake: [v(20, 10, 10), v(20, 10, 11), v(20, 10, 12)] })
    turnInPlane(s, 'right')
    const ev = stepOnce(s)
    expect(ev.some((e) => e.type === 'died')).toBe(true)
    expectFreeInvariant(s)
  })

  test('free mode never emits axisTurned/modeChanged/demoTurn during ordinary play', () => {
    const f = allFrames()[3]!
    const s = freeState(f, { demoTurnPending: false })
    for (const dir of DIRS) {
      const evs = [...turnInPlane(s, dir), ...stepOnce(s)]
      expect(evs.some((e) => e.type === 'axisTurned' || e.type === 'modeChanged' || e.type === 'demoTurn')).toBe(false)
    }
  })

  test('plane mode is untouched by the free-frame logic: a buffered turn does not rotate the frame', () => {
    const s = makeState({ apple: v(0, 0, 0) })
    turnInPlane(s, 'up')
    stepOnce(s)
    expect(s.mode).toBe('plane')
    expect(s.heading).toEqual(v(0, 1, 0))
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) })
  })

  test('modeChanged is emitted exactly once per game: demo at step 5, later steps and turns never repeat it', () => {
    const cfg = cfgWith({ obstacles: { density: 0, stickiness: 0, clearRadius: 4, wallMargin: 1 } })
    const s = createGame(cfg, 30, 8, true)
    s.apple.x = 0
    s.apple.y = 0
    s.apple.z = 0
    startGame(s)
    let changes = 0
    let plane = 0
    for (let i = 0; i < 12; i++) {
      const ev = stepOnce(s, cfg)
      changes += ev.filter((e) => e.type === 'modeChanged').length
      if (s.mode === 'plane') plane++
      if (i > 5 && s.phase === 'running') turnInPlane(s, i % 2 ? 'left' : 'right')
    }
    expect(changes).toBe(1)
    expect(plane).toBe(5) // steps 1..5 are plane, the turn-in-place step (6th) is free
    expect(s.mode).toBe('free')
  })

  test('full flow: demo switches to free, the very next swipe uses free semantics (right = new frame right)', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = makeState({ size: 30, demoTurnPending: true, apple: v(0, 0, 0), rngState: seed * 7 })
      for (let i = 0; i < 6; i++) stepOnce(s)
      expect(s.mode).toBe('free')
      const f = { right: { ...s.frame.right }, up: { ...s.frame.up }, heading: { ...s.heading } }
      // The neck lies along -x; a swipe into it is ignored (after a turn in place heading != the last move).
      const rightIsNeck = f.right.x === -1
      expect(turnInPlane(s, 'right').length).toBe(rightIsNeck ? 0 : 1)
      if (rightIsNeck) {
        turnInPlane(s, 'left')
        stepOnce(s)
        expect(s.heading).toEqual(neg(f.right))
      } else {
        stepOnce(s)
        expect(s.heading).toEqual(f.right)
      }
      expectFreeInvariant(s)
    }
  })
})

describe('turn-in-place step: an axis turn is a separate step, the snake stands still', () => {
  const types = (evs: GameEvent[]) => evs.map((e) => e.type)

  test('a turn-in-place step does not move, grow or eat and does not count as a step; the next step moves in the new direction', () => {
    // the apple is straight along the new heading (into = -z) and there is still growth in reserve
    const s = makeState({ apple: v(10, 10, 9), growth: 2 })
    const bodyBefore = JSON.stringify(s.snake)
    turnAxis(s, 'into')
    const flip = tick(s, config, s.stepMs)
    expect(types(flip)).toEqual(['turnedInPlace'])
    expect(JSON.stringify(s.snake)).toBe(bodyBefore)
    expect(s.snakeCells.size).toBe(3)
    expect(s.growth).toBe(2) // growth untouched
    expect(s.score).toBe(0)
    expect(s.applesEaten).toBe(0)
    expect(s.stepCount).toBe(0)
    expect(s.heading).toEqual(v(0, 0, -1))
    expect(s.pendingTurn).toBeNull()
    expect(s.rolledSinceStep).toBe(false)
    expect(s.phase).toBe('running')
    // next step: it already goes in the new direction, eats the apple, grows
    const go = tick(s, config, s.stepMs)
    expect(types(go)).toEqual(['moved', 'ate', 'speedUp', 'appleSpawned'])
    expect(s.snake[0]).toEqual(v(10, 10, 9))
    expect(s.snake.length).toBe(4)
    expect(s.stepCount).toBe(1)
  })

  test('time flows as usual: elapsedMs accumulates, a turn-in-place step spends exactly one stepMs', () => {
    const s = makeState()
    turnAxis(s, 'out')
    tick(s, config, 100)
    expect(s.elapsedMs).toBe(100)
    expect(s.sinceStepMs).toBe(0)
    // one tick call for two steps: the turn in place and then a step right away
    const s2 = makeState({ stepMs: 50 })
    turnAxis(s2, 'out')
    const ev = tick(s2, config, 100)
    expect(types(ev)).toEqual(['turnedInPlace', 'moved'])
    expect(s2.snake[0]).toEqual(v(10, 10, 11))
    expect(s2.stepCount).toBe(1)
  })

  test('near a wall the turn in place does not kill even though a step forward would; only the following step kills into the wall', () => {
    const mk = () => makeState({ snake: [v(19, 10, 10), v(18, 10, 10), v(17, 10, 10)] })
    const control = mk()
    expect(types(stepOnce(control))).toContain('died') // a step forward runs into the wall
    const s = mk()
    turnAxis(s, 'into')
    expect(types(stepOnce(s))).toEqual(['turnedInPlace'])
    expect(s.phase).toBe('running')
    expect(types(stepOnce(s))).toEqual(['moved']) // moved deeper along the wall
    expect(s.snake[0]).toEqual(v(19, 10, 9))
    // and if the new heading also points into the wall, it is the step that dies, not the turn in place
    const w = makeState({ snake: [v(19, 10, 0), v(18, 10, 0), v(17, 10, 0)] })
    turnAxis(w, 'into')
    expect(types(stepOnce(w))).toEqual(['turnedInPlace'])
    expect(w.phase).toBe('running')
    expect(stepOnce(w)).toContainEqual({ type: 'died', cause: 'wall' })
  })

  test('an obstacle and body in the path of the new heading do not kill the turn in place', () => {
    const obs = makeState({ obstacles: new Set([cellKey(10, 10, 9, 20), cellKey(11, 10, 10, 20)]) })
    turnAxis(obs, 'into')
    expect(types(stepOnce(obs))).toEqual(['turnedInPlace'])
    expect(obs.phase).toBe('running')
    expect(stepOnce(obs)).toContainEqual({ type: 'died', cause: 'obstacle' })
    const body = makeState({ snake: [v(10, 10, 10), v(10, 10, 11), v(11, 10, 11), v(11, 10, 10), v(11, 10, 9), v(10, 10, 9)] })
    turnAxis(body, 'into') // heading +x, into = -z, cell (10,10,9) is occupied by the tail body
    expect(types(stepOnce(body))).toEqual(['turnedInPlace'])
    expect(body.phase).toBe('running')
  })

  test('two turnAxis before the step make one turn-in-place step; two axis turns in a row make two steps in place', () => {
    const s = makeState()
    turnAxis(s, 'into')
    turnAxis(s, 'out')
    expect(types(stepOnce(s))).toEqual(['turnedInPlace'])
    expect(s.heading).toEqual(v(0, 0, 1))
    expect(types(stepOnce(s))).toEqual(['moved'])
    const t = makeState()
    turnAxis(t, 'into')
    stepOnce(t)
    expect(types(turnAxis(t, 'into'))).toEqual(['axisTurned'])
    expect(types(stepOnce(t))).toEqual(['turnedInPlace'])
    expect(t.snake[0]).toEqual(v(10, 10, 10))
    expect(t.stepCount).toBe(0)
    expectHeadingInScreenPlane(t)
  })

  test('turnedInPlace carries the new heading and is not emitted for ordinary in-plane turns', () => {
    const s = makeState({ apple: v(0, 0, 0) })
    turnInPlane(s, 'up')
    expect(types(stepOnce(s))).toEqual(['moved']) // an in-plane turn is combined with the step
    expect(s.snake[0]).toEqual(v(10, 11, 10))
    turnAxis(s, 'out')
    expect(stepOnce(s)).toEqual([{ type: 'turnedInPlace', heading: s.heading }])
  })

  test('after a turn in place, a swipe into the neck is ignored (heading no longer matches the last move)', () => {
    const s = makeState() // heading +x, neck on the left
    turnAxis(s, 'into')
    stepOnce(s) // heading -z; frame: right=+x, up=+z; the neck at -x = left
    expect(turnInPlane(s, 'left')).toEqual([])
    expect(s.pendingTurn).toBeNull()
    expect(turnInPlane(s, 'up')).toEqual([]) // opposite to heading (-z)
    expect(turnInPlane(s, 'right')).toEqual([{ type: 'turned', heading: v(1, 0, 0) }])
    stepOnce(s)
    expect(s.snake[0]).toEqual(v(11, 10, 10))
  })

  test('the demo transition is also a separate step: the snake stands still, does not grow or eat; the next step moves in the new direction', () => {
    const cfg = cfgWith({ demo: { afterSteps: 2 } })
    // the apple is in the path of the old heading, in the cell of the next step, and there is growth in reserve
    const s = makeState({ size: 30, demoTurnPending: true, apple: v(13, 10, 10), growth: 0 })
    stepOnce(s, cfg)
    stepOnce(s, cfg)
    expect(s.stepCount).toBe(2)
    s.growth = 3
    const bodyBefore = JSON.stringify(s.snake)
    const ev = stepOnce(s, cfg)
    expect(types(ev)).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
    expect(ev[0]).toEqual({ type: 'turnedInPlace', heading: s.heading })
    expect(JSON.stringify(s.snake)).toBe(bodyBefore)
    expect(s.growth).toBe(3)
    expect(s.score).toBe(0)
    expect(s.stepCount).toBe(2)
    expect(s.mode).toBe('free')
    expect(s.heading.z === 1 || s.heading.z === -1).toBe(true)
    const go = stepOnce(s, cfg)
    expect(types(go)).toEqual(['moved'])
    expect(s.snake[0]).toEqual(v(12, 10, 10 + s.heading.z))
    expect(s.snake.length).toBe(4)
  })

  test('the demo transition at a wall does not kill: the turn saves it, a step forward would have killed', () => {
    const cfg = cfgWith({ demo: { afterSteps: 1 } })
    const mk = () => makeState({ size: 20, demoTurnPending: true, apple: v(0, 0, 0), snake: [v(17, 10, 10), v(16, 10, 10), v(15, 10, 10)] })
    const s = mk()
    expect(types(stepOnce(s, cfg))).toEqual(['moved'])
    expect(s.snake[0]).toEqual(v(18, 10, 10))
    expect(types(stepOnce(s, cfg))).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
    expect(s.phase).toBe('running')
    expect(types(stepOnce(s, cfg))).toEqual(['moved']) // moved along z, not into the x wall
    const end = makeState({ size: 20, demoTurnPending: true, apple: v(0, 0, 0), snake: [v(18, 10, 10), v(17, 10, 10), v(16, 10, 10)] })
    stepOnce(end, cfg) // the head is right at the wall (19)
    expect(end.snake[0]).toEqual(v(19, 10, 10))
    expect(types(stepOnce(end, cfg))).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
    expect(end.phase).toBe('running')
  })

  test('the demo fires after afterSteps STEPS: manual turns in place do not shift it or bring it closer', () => {
    const cfg = cfgWith({ demo: { afterSteps: 3 } })
    const s = makeState({ size: 60, snake: [v(30, 30, 30), v(29, 30, 30), v(28, 30, 30)], demoTurnPending: true, apple: v(0, 0, 0) })
    turnAxis(s, 'into')
    expect(types(stepOnce(s, cfg))).toEqual(['turnedInPlace'])
    expect(s.stepCount).toBe(0)
    expect(s.demoTurnPending).toBe(true)
    for (let i = 0; i < 3; i++) expect(types(stepOnce(s, cfg))).toEqual(['moved'])
    expect(s.stepCount).toBe(3)
    expect(s.mode).toBe('plane')
    expect(types(stepOnce(s, cfg))).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
    expect(s.stepCount).toBe(3)
  })

  test('a manual turn in place that falls on the demo deadline runs first, the demo on the next step', () => {
    const cfg = cfgWith({ demo: { afterSteps: 1 } })
    const s = makeState({ size: 30, demoTurnPending: true, apple: v(0, 0, 0) })
    stepOnce(s, cfg) // 1st step, the demo is now "ripe"
    turnAxis(s, 'into')
    const first = stepOnce(s, cfg)
    expect(types(first)).toEqual(['turnedInPlace']) // manual step, the mode is still plane
    expect(s.mode).toBe('plane')
    expect(s.heading).toEqual(v(0, 0, -1))
    const second = stepOnce(s, cfg)
    expect(types(second)).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
    expect(s.mode).toBe('free')
    expect(s.frame.depth).toEqual(neg(s.heading))
    expect(s.snake[0]).toEqual(v(11, 10, 10))
  })

  test('the demo resets the plane turn buffer (it belonged to the old frame)', () => {
    const cfg = cfgWith({ demo: { afterSteps: 1 } })
    const s = makeState({ size: 30, demoTurnPending: true, apple: v(0, 0, 0) })
    stepOnce(s, cfg)
    turnInPlane(s, 'up')
    expect(s.pendingTurn).toEqual(v(0, 1, 0))
    stepOnce(s, cfg)
    expect(s.pendingTurn).toBeNull()
    expect(s.frame.depth).toEqual(neg(s.heading))
    stepOnce(s, cfg)
    expect(s.snake[0]!.y).toBe(10) // moved along z, not up
  })

  test('after the demo a swipe into the neck is ignored', () => {
    const cfg = cfgWith({ demo: { afterSteps: 1 } })
    for (let seed = 0; seed < 10; seed++) {
      const s = makeState({ size: 30, demoTurnPending: true, apple: v(0, 0, 0), rngState: seed * 977 })
      stepOnce(s, cfg)
      stepOnce(s, cfg)
      const neck = neg(v(1, 0, 0)) // the body trails along -x
      const dir: ScreenDir = s.frame.right.x === -1 ? 'right' : 'left'
      expect(turnInPlane(s, dir)).toEqual([])
      expect(s.pendingTurn).toBeNull()
      expect(neck.x).toBe(-1)
    }
  })

  test('a turn in place is not emitted in free mode on ordinary swipes', () => {
    const s = createGame(cfgWith({ obstacles: { density: 0, stickiness: 0, clearRadius: 4, wallMargin: 1 } }), 30, 3, false)
    s.apple.x = s.apple.y = s.apple.z = 0
    startGame(s)
    turnInPlane(s, 'up')
    expect(types(stepOnce(s))).toEqual(['moved'])
  })
})

describe('setBoost: boost', () => {
  const boostCfg = config // boostFactor 2, stepMs in makeState = 100 → boosted step 50 ms

  /** Boost is already active (held from the start of the step): requested and active. */
  function holdBoost(s: GameState): void {
    setBoost(s, true)
    s.boosting = true
  }

  function stepsIn(s: GameState, totalMs: number, dt: number): number {
    const before = s.stepCount
    for (let t = 0; t < totalMs; t += dt) tick(s, boostCfg, dt)
    return s.stepCount - before
  }

  test('emits boostChanged only on a real change', () => {
    const s = makeState()
    expect(setBoost(s, false)).toEqual([])
    expect([...setBoost(s, true)]).toEqual([{ type: 'boostChanged', on: true }])
    expect(isBoosting(s)).toBe(true)
    expect(setBoost(s, true)).toEqual([])
    expect(setBoost(s, true)).toEqual([])
    expect([...setBoost(s, false)]).toEqual([{ type: 'boostChanged', on: false }])
    expect(isBoosting(s)).toBe(false)
    expect(setBoost(s, false)).toEqual([])
  })

  test('step is twice as short while boosted', () => {
    const s = makeState()
    holdBoost(s)
    expect(tick(s, boostCfg, 49).length).toBe(0)
    expect(s.stepCount).toBe(0)
    expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0)
    expect(s.stepCount).toBe(1)
    expect(s.snake[0]).toEqual(v(11, 10, 10))
  })

  test('same wall time gives twice the steps', () => {
    const mk = () => makeState({ size: 100, snake: [v(10, 50, 50), v(9, 50, 50), v(8, 50, 50)] })
    const a = mk()
    const b = mk()
    holdBoost(b)
    expect(stepsIn(a, 800, 10)).toBe(8)
    expect(stepsIn(b, 800, 10)).toBe(16)
  })

  test('boostFactor comes from the game (state), not a fixed 2', () => {
    const s = makeState({ boostFactor: 4 })
    holdBoost(s)
    expect(tick(s, boostCfg, 24).length).toBe(0)
    expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0)
  })

  test('releasing restores the normal pace from the next step', () => {
    const s = makeState()
    holdBoost(s)
    stepOnce(s)
    setBoost(s, false)
    s.sinceStepMs = 0
    // the current step finishes still boosted (50), then the normal one (100)
    expect(tick(s, boostCfg, 49).length).toBe(0)
    expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0)
    expect(s.boosting).toBe(false)
    expect(tick(s, boostCfg, 99).length).toBe(0)
    expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0)
  })

  test('does nothing outside running, returns empty', () => {
    for (const phase of ['ready', 'dead'] as const) {
      const s = makeState({ phase })
      expect(setBoost(s, true)).toEqual([])
      expect(s.boostRequested).toBe(false)
      expect(s.boosting).toBe(false)
    }
    const s = makeState({ phase: 'dead', boosting: true, boostRequested: true })
    expect(setBoost(s, false)).toEqual([])
    expect(s.boostRequested).toBe(true)
    expect(s.boosting).toBe(true)
  })

  test('boost stays on across a start: works right after startGame', () => {
    const s = makeState({ phase: 'ready' })
    expect(setBoost(s, true)).toEqual([])
    startGame(s)
    expect([...setBoost(s, true)]).toEqual([{ type: 'boostChanged', on: true }])
  })

  test('stacks with apple speed-up: stepMs/factor after eating', () => {
    const s = makeState({ apple: v(11, 10, 10) })
    const cfg = cfgWith({ speed: { startStepMs: 100, minStepMs: 20, stepMsPerApple: 20, boostFactor: 2 } })
    setBoost(s, true)
    const ev = stepOnce(s, cfg)
    expect(ev.some((e) => e.type === 'speedUp' && e.stepMs === 80)).toBe(true)
    expect(s.stepMs).toBe(80)
    s.sinceStepMs = 0
    expect(tick(s, cfg, 39).length).toBe(0)
    expect(tick(s, cfg, 1).length).toBeGreaterThan(0)
  })

  test('speedUp reports the base stepMs, not the boosted one', () => {
    const s = makeState({ apple: v(11, 10, 10), stepMs: 100 })
    const cfg = cfgWith({ speed: { startStepMs: 100, minStepMs: 20, stepMsPerApple: 20, boostFactor: 2 } })
    setBoost(s, true)
    const ev = stepOnce(s, cfg)
    const up = ev.find((e) => e.type === 'speedUp')
    expect(up).toEqual({ type: 'speedUp', stepMs: 80 })
  })

  test('elapsedMs is real time, unaffected by boost', () => {
    const s = makeState()
    setBoost(s, true)
    tick(s, boostCfg, 30)
    tick(s, boostCfg, 30)
    expect(s.elapsedMs).toBe(60)
  })

  test('toggling keeps sinceStepMs progress', () => {
    const s = makeState()
    tick(s, boostCfg, 30)
    setBoost(s, true)
    expect(s.sinceStepMs).toBe(30)
    setBoost(s, false)
    expect(s.sinceStepMs).toBe(30)
  })

  test('turn-in-place tick is boosted too: costs one boosted step', () => {
    const s = makeState()
    turnAxis(s, 'into')
    holdBoost(s)
    expect(tick(s, boostCfg, 49).length).toBe(0)
    const ev = [...tick(s, boostCfg, 1)]
    expect(ev.map((e) => e.type)).toEqual(['turnedInPlace'])
    expect(s.stepCount).toBe(0)
    expect(s.snake[0]).toEqual(v(10, 10, 10)) // did not move
  })

  test('demo turn happens on a boosted tick as well', () => {
    const s = makeState({ demoTurnPending: true, stepCount: 5 })
    holdBoost(s)
    const ev = [...tick(s, boostCfg, 50)]
    expect(ev.map((e) => e.type)).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
  })

  test('frame cap: a full maxFrameMs frame gives exactly maxFrameMs / boostedStep steps', () => {
    const s = makeState({ stepMs: 10, size: 100, snake: [v(0, 50, 50)] })
    holdBoost(s) // step 5 ms, frame 100 ms → 20 steps
    tick(s, boostCfg, 1e9)
    expect(s.elapsedMs).toBe(100)
    expect(s.stepCount).toBe(20)
  })

  test('frame cap is enforced against corrupted sinceStepMs while boosted', () => {
    const s = makeState({ stepMs: 10, size: 100, snake: [v(0, 50, 50)] })
    holdBoost(s)
    s.sinceStepMs = 1e9
    tick(s, boostCfg, 1)
    expect(s.stepCount).toBe(Math.ceil(100 / 5) + 1) // cap based on the boosted step
    expect(s.sinceStepMs).toBe(0)
  })

  test('leftover above the boosted step (but below the base step) is dropped after the cap', () => {
    const s = makeState({ stepMs: 10, size: 100, snake: [v(0, 50, 50)] })
    holdBoost(s)
    s.sinceStepMs = 21 * 5 + 7 - 1
    tick(s, boostCfg, 1) // 113 ms: 21 steps by the cap, remainder 8 >= 5
    expect(s.stepCount).toBe(21)
    expect(s.sinceStepMs).toBe(0)
  })

  test('invalid dt and stepMs guards still hold with boost', () => {
    const s = makeState()
    setBoost(s, true)
    expect(tick(s, boostCfg, NaN)).toEqual([])
    expect(tick(s, boostCfg, -5)).toEqual([])
    expect(tick(s, boostCfg, 0)).toEqual([])
    expect(s.elapsedMs).toBe(0)
    s.stepMs = 0
    expect(tick(s, boostCfg, 50)).toEqual([])
    const z = makeState({ boostFactor: 0 }) // an invalid factor does not divide by zero
    setBoost(z, true)
    expect(tick(z, boostCfg, 50).length).toBe(0)
    expect(tick(z, boostCfg, 50).length).toBeGreaterThan(0)
  })

  test('stepProgress follows the boosted step that is actually running', () => {
    const s = makeState()
    holdBoost(s)
    tick(s, boostCfg, 25)
    expect(stepProgress(s)).toBeCloseTo(0.5) // 25 / 50
  })

  test('boost is serializable state (JSON round-trip keeps it)', () => {
    const s = makeState()
    setBoost(s, true)
    const copy = JSON.parse(JSON.stringify({ r: s.boostRequested, b: s.boosting, f: s.boostFactor }))
    expect(copy).toEqual({ r: true, b: false, f: 2 })
  })

  test('a new game after death starts without boost', () => {
    const old = makeState()
    setBoost(old, true)
    const fresh = createGame(config, 20, 1, false)
    expect(fresh.boosting).toBe(false)
    expect(fresh.boostRequested).toBe(false)
    expect(isBoosting(fresh)).toBe(false)
    expect(isBoostActive(fresh)).toBe(false)
    startGame(fresh)
    expect(tick(fresh, config, 99).length).toBe(0)
  })

  test('determinism: same inputs with boost give same result', () => {
    const run = () => {
      const s = createGame(config, 20, 9, false)
      startGame(s)
      setBoost(s, true)
      for (let i = 0; i < 60; i++) tick(s, config, 16)
      return JSON.stringify({ h: s.snake, p: s.phase, st: s.stepCount })
    }
    expect(run()).toBe(run())
  })
  describe('requested and active boost: takes effect from the next step', () => {
    const mk = () => makeState({ size: 100, snake: [v(10, 50, 50), v(9, 50, 50), v(8, 50, 50)] })

    test('press mid-step does not change the running step length', () => {
      const s = mk()
      tick(s, boostCfg, 30)
      setBoost(s, true)
      expect(s.boosting).toBe(false)
      // the step began normal (100 ms): at 50 ms, where a boosted step would already have fired, there is no step
      expect(tick(s, boostCfg, 60).length).toBe(0) // 90 ms
      expect(s.stepCount).toBe(0)
      expect(tick(s, boostCfg, 10).length).toBeGreaterThan(0) // exactly 100
      expect(s.stepCount).toBe(1)
    })

    test('the next step is already boosted (and takes effect exactly at the boundary)', () => {
      const s = mk()
      tick(s, boostCfg, 30)
      setBoost(s, true)
      tick(s, boostCfg, 70) // step 1 is done, remainder 0
      expect(s.boosting).toBe(true)
      expect(s.sinceStepMs).toBe(0)
      expect(tick(s, boostCfg, 49).length).toBe(0)
      expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0) // step 2 in 50 ms
      expect(s.stepCount).toBe(2)
    })

    test('press inside a long frame: first step slow, the rest of the frame boosted', () => {
      const s = mk()
      setBoost(s, true)
      tick(s, boostCfg, 100) // one frame: a 100 ms step (normal)
      expect(s.stepCount).toBe(1)
      tick(s, boostCfg, 100) // now two of 50
      expect(s.stepCount).toBe(3)
    })

    test('release mid-step is symmetric: current boosted step finishes, next is normal', () => {
      const s = mk()
      holdBoost(s)
      tick(s, boostCfg, 20)
      setBoost(s, false)
      expect(s.boosting).toBe(true)
      expect(tick(s, boostCfg, 29).length).toBe(0) // 49 of 50
      expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0)
      expect(s.boosting).toBe(false)
      expect(tick(s, boostCfg, 99).length).toBe(0)
      expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0)
      expect(s.stepCount).toBe(2)
    })

    test('press then release inside one step changes nothing', () => {
      const s = mk()
      tick(s, boostCfg, 10)
      setBoost(s, true)
      setBoost(s, false)
      tick(s, boostCfg, 90)
      expect(s.stepCount).toBe(1)
      expect(s.boosting).toBe(false)
      expect(tick(s, boostCfg, 99).length).toBe(0)
    })

    test('boostChanged is emitted immediately and only on request change, tick does not repeat it', () => {
      const s = mk()
      tick(s, boostCfg, 30)
      expect([...setBoost(s, true)]).toEqual([{ type: 'boostChanged', on: true }])
      expect(setBoost(s, true)).toEqual([])
      const ev = [...tick(s, boostCfg, 70)] // step boundary, the active state turned on
      expect(ev.some((e) => e.type === 'boostChanged')).toBe(false)
      expect([...setBoost(s, false)]).toEqual([{ type: 'boostChanged', on: false }])
      expect(setBoost(s, false)).toEqual([])
      const ev2 = [...tick(s, boostCfg, 50)]
      expect(ev2.some((e) => e.type === 'boostChanged')).toBe(false)
    })

    test('isBoosting follows the request at once; isBoostActive follows the running step', () => {
      const s = mk()
      tick(s, boostCfg, 30)
      setBoost(s, true)
      expect(isBoosting(s)).toBe(true)
      expect(isBoostActive(s)).toBe(false)
      tick(s, boostCfg, 70)
      expect(isBoosting(s)).toBe(true)
      expect(isBoostActive(s)).toBe(true)
      tick(s, boostCfg, 10)
      setBoost(s, false)
      expect(isBoosting(s)).toBe(false)
      expect(isBoostActive(s)).toBe(true)
      tick(s, boostCfg, 40)
      expect(isBoostActive(s)).toBe(false)
    })

    test('stepProgress does not jump on press or release', () => {
      const s = mk()
      tick(s, boostCfg, 30)
      const before = stepProgress(s)
      setBoost(s, true)
      expect(stepProgress(s)).toBe(before)
      expect(before).toBeCloseTo(0.3)
      tick(s, boostCfg, 20)
      expect(stepProgress(s)).toBeCloseTo(0.5) // 50 / 100, same as without boost
      tick(s, boostCfg, 50) // boundary; new step 50 ms, remainder 0
      expect(stepProgress(s)).toBe(0)
      tick(s, boostCfg, 20)
      const mid = stepProgress(s)
      expect(mid).toBeCloseTo(0.4) // 20 / 50
      setBoost(s, false)
      expect(stepProgress(s)).toBe(mid)
    })

    test('stepProgress is monotone through the whole press/step boundary', () => {
      const s = mk()
      let prevSteps = 0
      let prev = 0
      for (let i = 0; i < 60; i++) {
        if (i === 3) setBoost(s, true)
        if (i === 30) setBoost(s, false)
        tick(s, boostCfg, 7)
        const p = stepProgress(s)
        if (s.stepCount === prevSteps) expect(p).toBeGreaterThanOrEqual(prev)
        prevSteps = s.stepCount
        prev = p
      }
    })

    test('turn-in-place tick: press during it applies to the next tick, not this one', () => {
      const s = mk()
      turnAxis(s, 'into')
      tick(s, boostCfg, 30)
      setBoost(s, true)
      expect(tick(s, boostCfg, 60).length).toBe(0) // the turn-in-place step is still normal (100)
      expect([...tick(s, boostCfg, 10)].map((e) => e.type)).toEqual(['turnedInPlace'])
      expect(s.boosting).toBe(true) // turn-in-place step boundary
      expect(tick(s, boostCfg, 49).length).toBe(0) // the next step is already 50 ms
      expect(tick(s, boostCfg, 1).length).toBeGreaterThan(0)
    })

    test('turn-in-place tick: release during it — the tick stays boosted, the next is normal', () => {
      const s = mk()
      holdBoost(s)
      turnAxis(s, 'into')
      tick(s, boostCfg, 20)
      setBoost(s, false)
      expect([...tick(s, boostCfg, 30)].map((e) => e.type)).toEqual(['turnedInPlace'])
      expect(s.boosting).toBe(false)
    })

    test('demo-turn tick also applies the pending request at its boundary', () => {
      const s = makeState({ demoTurnPending: true, stepCount: 5 })
      tick(s, boostCfg, 10)
      setBoost(s, true)
      expect([...tick(s, boostCfg, 90)].map((e) => e.type)).toEqual(['turnedInPlace', 'modeChanged', 'demoTurn'])
      expect(s.boosting).toBe(true)
    })

    test('speed-up from an apple and the boost switch at one boundary compose', () => {
      const s = makeState({ apple: v(11, 10, 10) })
      const cfg = cfgWith({ speed: { startStepMs: 100, minStepMs: 20, stepMsPerApple: 20, boostFactor: 2 } })
      tick(s, cfg, 10)
      setBoost(s, true)
      tick(s, cfg, 90) // ate, stepMs 80, active boost turned on
      expect(s.stepMs).toBe(80)
      expect(s.boosting).toBe(true)
      expect(tick(s, cfg, 39).length).toBe(0)
      expect(tick(s, cfg, 1).length).toBeGreaterThan(0)
    })

    test('a request that dies with the game never leaks into the next one', () => {
      const old = mk()
      tick(old, boostCfg, 10)
      setBoost(old, true)
      const fresh = createGame(config, 20, 1, false)
      expect(fresh.boostRequested).toBe(false)
      expect(fresh.boosting).toBe(false)
      startGame(fresh)
      tick(fresh, config, config.speed.startStepMs)
      expect(fresh.boosting).toBe(false)
    })

    test('frame cap counts the boosted steps that follow the switch inside one frame', () => {
      const s = makeState({ stepMs: 10, size: 100, snake: [v(0, 50, 50)] })
      setBoost(s, true)
      tick(s, boostCfg, 1e9) // frame 100 ms: one normal step of 10 ms, then 18 boosted ones of 5 ms
      expect(s.elapsedMs).toBe(100)
      expect(s.stepCount).toBe(19)
      expect(s.sinceStepMs).toBe(0)
    })
  })
})
