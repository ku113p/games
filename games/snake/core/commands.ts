// core/commands.ts — player actions change state and return events.
// Pure TS, no Three.js. Hot path (tick, step, collision checks) is allocation-free:
// events are written into the same array that is reused per GameState.

import { enterFreeFrame, reorientFrameFree, rotateFrame, spawnApple, speedAfterApples, type Config } from './rules'
import { boostedStepMs, cellKey, effectiveStepMs, nextRandom, type AxisDir, type DeathCause, type Frame, type GameState, type Mode, type ScreenDir, type Vec3 } from './state'

export type GameEvent =
  | { type: 'started' }
  | { type: 'moved' }
  | { type: 'turned'; heading: Vec3 }
  | { type: 'turnedInPlace'; heading: Vec3 }
  | { type: 'axisTurned'; rollAxis: Vec3; direction: AxisDir }
  | { type: 'ate'; apple: Vec3; score: number }
  | { type: 'appleSpawned'; apple: Vec3 }
  | { type: 'speedUp'; stepMs: number }
  | { type: 'boostChanged'; on: boolean }
  | { type: 'demoTurn' }
  | { type: 'modeChanged'; mode: Mode }
  | { type: 'died'; cause: DeathCause }

// Payload-free events are frozen singletons (no allocation on every step).
const STARTED: GameEvent = Object.freeze({ type: 'started' })
const MOVED: GameEvent = Object.freeze({ type: 'moved' })
const BOOST_ON: GameEvent = Object.freeze({ type: 'boostChanged', on: true })
const BOOST_OFF: GameEvent = Object.freeze({ type: 'boostChanged', on: false })
const DEMO_TURN: GameEvent = Object.freeze({ type: 'demoTurn' })
const MODE_FREE: GameEvent = Object.freeze({ type: 'modeChanged', mode: 'free' })

// Each GameState gets its own reusable events array (no allocation on every
// call; isolated between concurrent games, e.g. in tests).
const eventBuffers = new WeakMap<GameState, GameEvent[]>()

function getEventBuffer(s: GameState): GameEvent[] {
  let buf = eventBuffers.get(s)
  if (!buf) {
    buf = []
    eventBuffers.set(s, buf)
  }
  return buf
}

function screenDirToVec(dir: ScreenDir, frame: Frame): Vec3 {
  switch (dir) {
    case 'right':
      return { x: frame.right.x, y: frame.right.y, z: frame.right.z }
    case 'left':
      return { x: signed(-1, frame.right.x), y: signed(-1, frame.right.y), z: signed(-1, frame.right.z) }
    case 'up':
      return { x: frame.up.x, y: frame.up.y, z: frame.up.z }
    case 'down':
      return { x: signed(-1, frame.up.x), y: signed(-1, frame.up.y), z: signed(-1, frame.up.z) }
  }
}

function isOpposite(a: Vec3, b: Vec3): boolean {
  return a.x === -b.x && a.y === -b.y && a.z === -b.z
}

// sign * 0 produces -0 in JS; normalize so heading components never carry a signed zero.
function signed(sign: -1 | 1, value: number): number {
  const result = sign * value
  return result === 0 ? 0 : result
}

/**
  * The direction leads the head exactly into the second body cell (the neck). After a turn in place, heading
  * no longer matches the last move made, so isOpposite(heading) alone is not enough.
 */
function pointsIntoNeck(s: GameState, dir: Vec3): boolean {
  if (s.snake.length < 2) return false
  const head = s.snake[0]!
  const neck = s.snake[1]!
  return head.x + dir.x === neck.x && head.y + dir.y === neck.y && head.z + dir.z === neck.z
}

export function startGame(s: GameState): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'ready') return buf // from running/dead, start does nothing
  s.phase = 'running'
  buf.push(STARTED)
  return buf
}

/**
  * Boost: changes the REQUESTED state (boostRequested). The active state (boosting, which the step
  * duration depends on) is picked up by tick on a step boundary: pressing and releasing take effect from the start of
  * the next step, and the current one finishes at its own pace. The boostChanged event fires immediately and only when the
  * request actually changes (input calls this often). Does nothing outside running.
  * sinceStepMs is left alone.
 */
export function setBoost(s: GameState, on: boolean): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'running') return buf
  if (s.boostRequested === on) return buf
  s.boostRequested = on
  buf.push(on ? BOOST_ON : BOOST_OFF)
  return buf
}

/**
  * Turn in the screen plane: heading becomes ±right/±up of the current frame. The frame does not
  * change. A 180° reversal (relative to the last move made) is forbidden.
  * Applied on the next step (pendingTurn buffer). Does nothing outside the running phase.
 */
export function turnInPlane(s: GameState, dir: ScreenDir): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'running') return buf

  const newHeading = screenDirToVec(dir, s.frame)
  if (isOpposite(newHeading, s.heading) || pointsIntoNeck(s, newHeading)) {
    return buf // a 180° reversal (and a move into its own neck after a turn in place) is forbidden, so ignore it
  }

  s.pendingTurn = newHeading
  buf.push({ type: 'turned', heading: newHeading })
  return buf
}

/**
  * Axis turn: 'into' → -depth, 'out' → +depth (depth BEFORE the roll). Invariant: the frame
  * is rolled IMMEDIATELY, at the moment of the command, and the axisTurned event is emitted exactly when
  * the roll actually happened, so the camera (cameraFrame) and the world do not diverge. The new heading
  * takes effect on the NEXT STEP, which is spent entirely on a turn in place (the snake does not
  * move, grow, eat or die, stepCount does not grow; turnedInPlace event);
  * it starts moving in the new direction only on the step after that. Subsequent turnInPlane calls pick a direction in the
  * already rolled frame and do not cancel the roll. A second turnAxis before the step does not rotate the frame again,
  * it only replaces the buffered heading (into/out swap places) and emits turned.
  * Does nothing outside the running phase.
 */
export function turnAxis(s: GameState, dir: AxisDir): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0
  if (s.phase !== 'running') return buf
  if (s.mode === 'free') return buf // in 'free' four swipes cover every direction, so the third axis is not needed
  queueAxisTurn(s, dir, buf)
  return buf
}

function queueAxisTurn(s: GameState, dir: AxisDir, buf: GameEvent[]): void {
  const sign = dir === 'into' ? -1 : 1
  const h = s.heading

  if (s.rolledSinceStep) {
    // The frame is already rolled around h. The former depth = -(h × depth'), and that is what we aim at.
    const d = s.frame.depth
    const ox = -(h.y * d.z - h.z * d.y)
    const oy = -(h.z * d.x - h.x * d.z)
    const oz = -(h.x * d.y - h.y * d.x)
    const newHeading: Vec3 = { x: signed(sign, ox), y: signed(sign, oy), z: signed(sign, oz) }
    s.pendingTurn = newHeading
    buf.push({ type: 'turned', heading: newHeading })
    return
  }

  const axis: Vec3 = { x: h.x, y: h.y, z: h.z }
  const newHeading: Vec3 = {
    x: signed(sign, s.frame.depth.x),
    y: signed(sign, s.frame.depth.y),
    z: signed(sign, s.frame.depth.z),
  }
  rotateFrame(s, axis)
  s.rolledSinceStep = true
  s.pendingTurn = newHeading
  buf.push({ type: 'axisTurned', rollAxis: axis, direction: dir })
}

/** The cell in front of the head at offset (dx,dy,dz) is free: not a wall, not an obstacle, not the body. */
function isFreeAhead(s: GameState, dx: number, dy: number, dz: number): boolean {
  const head = s.snake[0]!
  const nx = head.x + dx
  const ny = head.y + dy
  const nz = head.z + dz
  if (nx < 0 || ny < 0 || nz < 0 || nx >= s.size || ny >= s.size || nz >= s.size) return false
  const key = cellKey(nx, ny, nz, s.size)
  if (s.obstacles.has(key)) return false
  if (s.snakeCells.has(key)) {
    const tail = s.snake[s.snake.length - 1]!
    const isVacatingTail = s.growth === 0 && key === cellKey(tail.x, tail.y, tail.z, s.size)
    if (!isVacatingTail) return false
  }
  return true
}

/**
  * Demo transition plane → free (a separate step, the snake stands still): the direction is random among the free ones (into/out). If none
  * is free, does nothing and the demoTurnPending flag is not spent (retry on the next step).
  * The head turns immediately (heading = ∓depth, the frame is adjusted so that depth = -heading),
  * modeChanged and demoTurn are emitted. Returns true if it fired (tick stops the step
  * loop; main.ts sets the pause).
 */
function tryDemoTurn(s: GameState, buf: GameEvent[]): boolean {
  const d = s.frame.depth
  const intoFree = isFreeAhead(s, -d.x, -d.y, -d.z)
  const outFree = isFreeAhead(s, d.x, d.y, d.z)
  if (!intoFree && !outFree) return false

  let sign: -1 | 1
  if (intoFree && outFree) sign = nextRandom(s) < 0.5 ? -1 : 1
  else sign = intoFree ? -1 : 1

  s.demoTurnPending = false
  s.pendingTurn = null // the plane turn buffer belonged to the old frame
  s.mode = 'free'
  enterFreeFrame(s, sign)
  buf.push({ type: 'turnedInPlace', heading: { x: s.heading.x, y: s.heading.y, z: s.heading.z } })
  buf.push(MODE_FREE)
  buf.push(DEMO_TURN)
  return true
}

/**
  * One step. A turn-in-place step (manual axis turn or demo transition) only changes
  * heading: no movement, growth, eating or collision checks; stepCount does not grow. Otherwise a grid
  * step: apply the buffered turn, move, collisions, eating.
  * Returns true if the demo transition fired (tick breaks the loop; main.ts sets the pause).
 */
function step(s: GameState, config: Config, buf: GameEvent[]): boolean {
  if (s.rolledSinceStep) {
    // The frame was already rolled by the turnAxis command; this step applies the new heading, standing still.
    if (s.pendingTurn) {
      s.heading.x = s.pendingTurn.x
      s.heading.y = s.pendingTurn.y
      s.heading.z = s.pendingTurn.z
      s.pendingTurn = null
    }
    s.rolledSinceStep = false
    buf.push({ type: 'turnedInPlace', heading: { x: s.heading.x, y: s.heading.y, z: s.heading.z } })
    return false
  }
  if (s.demoTurnPending && s.stepCount >= config.demo.afterSteps && tryDemoTurn(s, buf)) {
    return true // demo transition is a separate turn-in-place step: the snake did not move
  }

  if (s.pendingTurn) {
    if (s.mode === 'free') reorientFrameFree(s, s.pendingTurn)
    s.heading.x = s.pendingTurn.x
    s.heading.y = s.pendingTurn.y
    s.heading.z = s.pendingTurn.z
    s.pendingTurn = null
  }

  const head = s.snake[0]!
  const nx = head.x + s.heading.x
  const ny = head.y + s.heading.y
  const nz = head.z + s.heading.z

  if (nx < 0 || ny < 0 || nz < 0 || nx >= s.size || ny >= s.size || nz >= s.size) {
    s.phase = 'dead'
    buf.push({ type: 'died', cause: 'wall' })
    return false
  }

  const key = cellKey(nx, ny, nz, s.size)

  if (s.obstacles.has(key)) {
    s.phase = 'dead'
    buf.push({ type: 'died', cause: 'obstacle' })
    return false
  }

  const willGrow = s.growth > 0
  const tail = s.snake[s.snake.length - 1]!
  const tailKey = cellKey(tail.x, tail.y, tail.z, s.size)
  const movingIntoVacatingTail = key === tailKey && !willGrow

  if (s.snakeCells.has(key) && !movingIntoVacatingTail) {
    s.phase = 'dead'
    buf.push({ type: 'died', cause: 'body' })
    return false
  }

  if (willGrow) {
    // Growth is a rare event (once per apple); one new Vec3 is unavoidable: the length grows.
    const newHead: Vec3 = { x: nx, y: ny, z: nz }
    s.snake.unshift(newHead)
    s.snakeCells.add(key)
    s.growth -= 1
  } else {
    // Normal step: the tail is reused as the new head, with no new objects.
    const reused = s.snake.pop()!
    s.snakeCells.delete(tailKey)
    reused.x = nx
    reused.y = ny
    reused.z = nz
    s.snake.unshift(reused)
    s.snakeCells.add(key)
  }

  s.stepCount += 1
  buf.push(MOVED)

  if (nx === s.apple.x && ny === s.apple.y && nz === s.apple.z) {
    s.growth += config.snake.growPerApple
    s.applesEaten += 1
    s.score += 1

    buf.push({ type: 'ate', apple: { x: nx, y: ny, z: nz }, score: s.score })

    const newStepMs = speedAfterApples(config, s.applesEaten, s.paceScale)
    if (newStepMs !== s.stepMs) {
      s.stepMs = newStepMs
      buf.push({ type: 'speedUp', stepMs: newStepMs })
    }

    spawnApple(s)
    buf.push({ type: 'appleSpawned', apple: { x: s.apple.x, y: s.apple.y, z: s.apple.z } })
  }

  return false
}

/**
  * Accumulates sinceStepMs and makes steps while there is enough time. Time comes in as a parameter (dtMs);
  * the core knows nothing about real clocks. dt is capped by config.loop.maxFrameMs; NaN, negative and
  * zero dt are ignored; stepMs <= 0 does not loop. Events are written into the same
  * reused array.
 */
export function tick(s: GameState, config: Config, dtMs: number): GameEvent[] {
  const buf = getEventBuffer(s)
  buf.length = 0

  if (s.phase !== 'running') return buf
  const dt = Math.min(dtMs, config.loop.maxFrameMs)
  if (!(dt > 0)) return buf // negative, zero, NaN
  if (!(effectiveStepMs(s) > 0)) return buf // guard against an infinite loop

  s.elapsedMs += dt
  s.sinceStepMs += dt

  // Cap on steps per call: even with a corrupted sinceStepMs the loop is finite.
  // The requested boost kicks in on a step boundary within this call: the cap is based on the boosted step.
  const ceilingMs = s.boostRequested && s.boostFactor > 1 ? boostedStepMs(s) : effectiveStepMs(s)
  const maxSteps = Math.ceil(config.loop.maxFrameMs / ceilingMs) + 1
  let steps = 0
  // Step duration is re-read on every iteration: it is not changed retroactively before the boundary.
  while (steps < maxSteps && s.phase === 'running') {
    const stepMs = effectiveStepMs(s)
    if (!(stepMs > 0) || s.sinceStepMs < stepMs) break
    s.sinceStepMs -= stepMs
    steps++
    const paused = step(s, config, buf)
    s.boosting = s.boostRequested // step boundary: the requested boost becomes active
    if (paused) break // demo turn: main sets the pause, no extra steps
  }
  const restMs = effectiveStepMs(s)
  if (restMs > 0 && s.sinceStepMs >= restMs) s.sinceStepMs = 0 // reset the remainder after the cap or the demo pause

  return buf
}
