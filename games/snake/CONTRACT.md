# Layer contract - games/snake

Three agents write the layers in parallel. The signatures below are law and must not be changed.
Project: games/snake (paths from the repository root)
Repository rules: AGENTS.md (read in full)
Design: games/snake/DESIGN.md (read in full)
Stack: bun 1.4.2, TypeScript strict, three@0.186.1 (the API of this version, not from memory).

## Coordinate system and camera frame

Cells are integer coordinates 0..N-1 along x/y/z.

`Frame` is an orthonormal integer basis of the screen:
- `right` - to the right on the screen
- `up` - up on the screen
- `depth` - out of the screen toward the viewer (depth = right × up)

The camera sits at the cube center + depth * distance, looks at the center, its up = frame.up.
The snake's `heading` always lies in the screen plane: it is ±right or ±up.

### Turn in the plane
`heading` changes to ±right or ±up. Frame does not change. A 180-degree reversal is forbidden.

### Axis turn (the third axis)
Two commands: `'into'` (into the screen, away from the viewer) and `'out'` (toward the viewer).

1. New heading: `into` → `-depth`, `out` → `+depth`.
2. Frame rolls by **+90° around the old heading vector** (right-hand rule,
   the axis is the signed heading vector, not its absolute axis).

Formula for rotating a vector v by +90° around a unit integer axis:
`v' = axis × v` when v ⊥ axis. For frame: right, up, depth are rotated by this rule,
except the one of them that coincides with ±axis - it stays in place.

A check that the tests must pass: heading = +right, frame = (R,U,D).
After `into`: frame = (R, D, -U), heading = -D, i.e. the new heading = -up' → down on the screen.
After `out`: frame = (R, D, -U), heading = +D = +up' → up on the screen.
Frame is the same after both commands, only heading differs.

## core/ - pure TS

Importing three, view/, input/ is forbidden. No allocations in the hot path
(tick, collision checks): reuse objects, mutate in place.
Random only through the seed in the state, the core is deterministic. Time comes from outside.

### core/state.ts

```ts
export interface Vec3 { x: number; y: number; z: number }
export interface Frame { right: Vec3; up: Vec3; depth: Vec3 }
export type Phase = 'ready' | 'running' | 'dead'
export type ScreenDir = 'left' | 'right' | 'up' | 'down'
export type AxisDir = 'into' | 'out'
export type DeathCause = 'body' | 'wall' | 'obstacle'

export interface GameState {
  size: number
  snake: Vec3[]              // snake[0] is the head
  snakeCells: Set<number>    // keys of the snake's cells, key = cellKey()
  obstacles: Set<number>
  apple: Vec3
  heading: Vec3
  frame: Frame
  pendingTurn: Vec3 | null   // input buffer, applied on the next step
  pendingRoll: 0 | 1         // 1 = roll the frame on the next step
  pendingRollAxis: Vec3 | null
  growth: number             // how many cells are still to be grown
  phase: Phase
  score: number
  applesEaten: number
  stepMs: number
  sinceStepMs: number
  elapsedMs: number
  demoTurnPending: boolean   // demo turn: once, after the first apple
  rngState: number
}

export function cellKey(x: number, y: number, z: number, size: number): number
export function nextRandom(s: GameState): number   // mulberry32, mutates rngState
```

### core/rules.ts

```ts
import type { GameState, Vec3 } from './state'
export interface Config { /* shape = config.json, type it fully */ }

export function createGame(config: Config, size: number, seed: number, isFirstGameEver: boolean): GameState
export function generateObstacles(size: number, density: number, stickiness: number,
                                  clearCells: Set<number>, rng: () => number): Set<number>
export function spawnApple(s: GameState): Vec3
export function rotateFrame(s: GameState, axis: Vec3): void
export function speedAfterApples(config: Config, apples: number): number
```

`generateObstacles` - cubes and obstacle clusters (stickiness is set by stickiness 0..1).
**Hard requirement: no dead zones.** After generation, a flood fill
from the start cell over the 6 neighbors; if not all free cells are reachable,
the unreachable ones are filled with obstacles or the generation is repeated. A test is mandatory.

### core/commands.ts

```ts
export type GameEvent =
  | { type: 'started' }
  | { type: 'moved' }
  | { type: 'turned'; heading: Vec3 }
  | { type: 'axisTurned'; rollAxis: Vec3; direction: AxisDir }
  | { type: 'ate'; apple: Vec3; score: number }
  | { type: 'appleSpawned'; apple: Vec3 }
  | { type: 'speedUp'; stepMs: number }
  | { type: 'demoTurn' }
  | { type: 'died'; cause: DeathCause }

export function startGame(s: GameState): GameEvent[]
export function turnInPlane(s: GameState, dir: ScreenDir): GameEvent[]
export function turnAxis(s: GameState, dir: AxisDir): GameEvent[]
export function tick(s: GameState, config: Config, dtMs: number): GameEvent[]
```

`tick` accumulates `sinceStepMs` and makes steps while there is enough time. Events are returned
in the same reusable array (no allocations in the hot path).
Demo turn: if `demoTurnPending` and the first apple has been eaten, the core itself does
`turnAxis(s, 'into')` and adds the `demoTurn` event.

### core/queries.ts - read-only

```ts
export function head(s: GameState): Vec3
export function isAlive(s: GameState): boolean
export function snakeLength(s: GameState): number
export function cameraFrame(s: GameState): Frame
export function score(s: GameState): number
export function forEachObstacle(s: GameState, fn: (x: number, y: number, z: number) => void): void
```

## view/ - three.js, subscribed to events

```ts
// view/index.ts
import type { GameState, GameEvent } from '../core/state'
export interface View {
  resize(width: number, height: number): void
  handle(event: GameEvent, s: GameState): void
  render(s: GameState, dtMs: number): void
  dispose(): void
}
export function createView(canvas: HTMLCanvasElement, config: Config, s: GameState): View
```

Reads state **only** through `core/queries`. Does not call commands.

Look: neon. A dark background, a glowing cube frame, the snake as a gradient from head to tail,
the apple pulses, obstacles are dim neon. Bloom through postprocessing.
The snake and obstacles are `InstancedMesh` (100³ with dense obstacles = tens of thousands of cubes).
No new objects and no `await` in the frame: pools, reuse, in-place mutation.

**Camera roll** on the `axisTurned` event: a smooth 90° turn around `rollAxis`
over `config.camera.rollMs`, preceded by a micro-pause `config.camera.microPauseMs`,
with a glitch `config.camera.glitchMs` on top. Numbers only from config.

## input/ - touch and keyboard

```ts
// input/index.ts
export type InputScheme = 'swipes' | 'taps'
export interface InputHandlers {
  onTurn(dir: ScreenDir): void
  onAxis(dir: AxisDir): void
}
export function attachInput(el: HTMLElement, scheme: InputScheme,
                            config: Config, h: InputHandlers): () => void  // returns detach
```

- `'swipes'` (default): a swipe is a turn in the plane; a single tap anywhere is `into`;
  a double tap is `out`.
- `'taps'`: a tap on a direction zone is a turn; a tap in the center zone is `into`;
  a double tap in the center is `out`. The size of the center zone is `config.input.centerZoneFraction`.
- Keyboard (PC, works in both schemes): arrows/WASD - the plane, **Q** and **E** - the third axis.
- Tap zones ≥ 44 px. No hover. Input must not break on an orientation change.

## config.json - all balance values

```json
{
  "cube": { "sizes": [20, 50, 100], "default": 20 },
  "snake": { "startLength": 3, "growPerApple": 1 },
  "speed": { "startStepMs": 180, "minStepMs": 60, "stepMsPerApple": 4 },
  "obstacles": { "density": 0.02, "stickiness": 0.6, "clearRadius": 4 },
  "camera": { "rollMs": 260, "microPauseMs": 90, "glitchMs": 180, "distanceFactor": 1.6 },
  "demo": { "autoTurnAfterApples": 1 },
  "input": { "doubleTapMs": 240, "swipeMinPx": 24, "centerZoneFraction": 0.28 }
}
```

A magic number in code instead of config is a review error.

## Definition of Done (AGENTS.md, section 8)

- `bun test` passes
- the layer linter is clean
- no allocations and no `await` in the frame
- new numbers are in config.json
- the build opens at the base path

---

# Contract addendum - the fix round after review

## New queries in core/queries.ts (added by the core agent, used by the view agent)

```ts
export function forEachSnakeSegment(s: GameState, fn: (x: number, y: number, z: number, index: number) => void): void
export function applePos(s: GameState): Readonly<Vec3>
export function cubeSize(s: GameState): number
export function elapsedMs(s: GameState): number
```

AGENTS.md rule 2: the view reads state ONLY through queries. Reading
`s.snake`, `s.apple`, `s.size`, `s.elapsedMs` directly from the view is a violation, remove it.

## The invariant that the review found violated

**The core never reports a roll that it will not perform.**
The camera orientation must at any moment be derivable from `cameraFrame(s)`.
Right now `turnAxis` emits `axisTurned` immediately, and `turnInPlane` later silently cancels the roll -
the camera moves away, the world does not. How to fix it is up to the core agent, but the invariant is mandatory
and tests for exactly these scenarios must appear:

1. `turnAxis('into')`, then `turnInPlane` before the step, then the step.
2. `turnAxis('into')`, then `turnAxis('out')` before the step, then the step.
3. Two `turnInPlane` in a row before the step.
4. Death on the same step on which the roll was scheduled.

## Demo turn (new rules from DESIGN.md)

- Fires **on step 5** of the player's first game. The number of steps is in config: `demo.afterSteps`.
- The direction is **random among the free ones**: if the cell along `into` is occupied or beyond the wall, `out` is taken;
  if both are occupied, the demo does not fire and is not used up.
- The core emits `demoTurn`. **The pause and the explainer screen are done by main.ts**, not the core.

## Pause

- `visibilitychange`: the game pauses, the core does not tick. We do not touch the core - the pause lives in main.ts.
- Additionally a cap on dt per frame, the number is in config: `loop.maxFrameMs`.

## The button after death

Restarts the game with the same settings, and does not lead to the menu.

---

# Addendum 2 - two camera modes (the designer's decision after the first game played live)

Feedback from the game: the speed is frantic (fixed in config), the snake cannot be seen (dark on dark),
and a third-person view with the camera behind the head was expected.

Decision: a **hybrid**. The game starts as a flat snake, on step 5 the camera moves
behind the head and full 3D opens up. The camera transition is the twist.

## Mode in the state

`GameState.mode: 'plane' | 'free'`. The start of a game is always `'plane'`. On the demo turn
(`demo.afterSteps`) the core switches to `'free'` and emits an event. It never goes back.

### Mode `'plane'` - as now
- `heading` lies in the screen plane (±right or ±up), `depth` toward the viewer.
- `turnInPlane` - 4 directions in the slice, `turnAxis` - the third axis.
- The camera is at the side, looks at the cube center.

### Mode `'free'` - new
- `heading` points **away from the viewer, into the depth**: `depth = -heading`.
- `right` and `up` are perpendicular to heading and give the four possible turns.
- `turnInPlane(dir)` turns the head: `left → -right`, `right → +right`,
  `up → +up`, `down → -up`. After the turn, frame is recomputed so that
  `depth` again equals `-heading`, and `up` changes minimally (no upside-down flips).
- `turnAxis` in this mode is a **no-op, an empty events array**: swipes already give all directions.
- A 180-degree reversal is still forbidden (in this mode it is unreachable by swipe anyway).

## Events

```ts
| { type: 'modeChanged'; mode: 'plane' | 'free' }
```

Emitted once, on the demo turn, together with `demoTurn`.

## View

- In `'plane'` - the camera as now.
- In `'free'` - the camera is behind the head by `camera.followDistance` cells along `-heading`,
  raised by `camera.followHeight`, looks forward along the heading, up from frame.
  It catches up with the head smoothly, does not jerk on every step.
- **The transition between modes** on `modeChanged`: an animated camera flight over
  `camera.modeSwitchMs`, with a glitch on top. This is the key moment of the game, it must read clearly.
- New numbers: `camera.followDistance`, `camera.followHeight`, `camera.modeSwitchMs`.

## Readability (a bug from the first game)

The snake **cannot be seen**: dark on a dark background. Required:
- the head is noticeably brighter than the body and differs in shape or size - you can see where the snake is looking;
- the body contrasts with the background along its whole length, the tail does not blend in;
- in mode `'free'` the segments closest to the camera do not block the view.

## Input

- In `'free'` taps on the third axis do nothing. The hints and zones of the `taps` scheme
  that relate to the third axis are not shown in this mode.
- The Q and E keys in `'free'` are also a no-op.

---

# Addendum 3 - the turn-in-place step

The designer's feedback: "probably the snake shouldn't move during the flip - let the change of direction
happen before the movement."

**An axis turn is a separate step.** The snake first turns in place, and only
on the next step moves in the new direction. This applies both to a manual `turnAxis` in mode `plane`
and to the demo transition. Ordinary turns in the plane (`turnInPlane`) are not affected - they
still coincide with a step, as in the classic snake.

On the turn-in-place step the snake does not move, does not grow, does not eat, collisions are not checked,
`stepCount` does not grow (it is not a move). The step takes exactly one `stepMs`.

## New event

```ts
| { type: 'turnedInPlace'; heading: Vec3 }
```

In the demo it comes first, before `modeChanged` and `demoTurn`.

## Known limitation

The `frame` roll stays at the moment of the command, not at the turn-in-place step - otherwise `cameraFrame`
would diverge from subsequent swipes. So the camera starts rotating on `axisTurned`
(at the moment of the tap), and the head turns on `turnedInPlace`, up to one `stepMs` later.
If this becomes noticeable, it is fixed on the view side, the core does not need to change.

## Side finding

After a turn in place `heading` no longer matches the last step taken,
and the ordinary "180-degree reversal" check stopped being enough: a swipe backward hit the neck and killed.
The `pointsIntoNeck` check was added - such a swipe is ignored.

---

# Addendum 4 - boost and the obstacle margin from the walls

**Boost.** `setBoost(s, on): GameEvent[]` (core/commands.ts). While boost is active, a step lasts
`stepMs / boostFactor` (`config.speed.boostFactor`, currently 2); the speed-up per apple works on top, and the `speedUp` event
still carries the base `stepMs`. **Pressing and releasing take effect from the next step:**
the current step is finished at the pace at which it began (the duration is not changed retroactively).
Two `GameState` fields: `boostRequested` (requested, changed by `setBoost`) and `boosting` (active, `effectiveStepMs`
depends on it). `tick` copies `boosting = boostRequested` right after each step slot (a step, a turn-in-place
step, a demo step) - that is the step boundary; the step duration is taken anew on each iteration
of the loop, so inside one long frame the first step goes at the old pace, the rest at the new one.
The event `{ type: 'boostChanged'; on }` is emitted immediately and only on a real change of the **request** (`tick` does not
emit it); outside the `running` phase `setBoost` does nothing. `boostFactor` is a copy of config per game (`setBoost` does not
receive config). New game: `boostRequested = false`, `boosting = false`. Everything counted as a step slot is boosted,
including the turn-in-place step. `elapsedMs` is real time; the cap on steps per frame is computed from the boosted
step if boost is requested. Queries: `isBoosting(s)` - **requested** (button highlight without delay, in
sync with `boostChanged`); `isBoostActive(s)` - **active** (whether the current step is going at the boosted pace, for
pace effects); `stepProgress(s)` = `sinceStepMs` / the duration of the running step (by `boosting`), so on
press/release in the middle of a step it does not jump - the head interpolation in the view is smooth; at the step boundary the progress
naturally resets to zero. Input: holding the button → `setBoost(true)`, releasing → `setBoost(false)`.

**Wall margin.** `config.obstacles.wallMargin` (currently 1): cells that are less than this number away from any cube wall
cannot hold obstacles (at 1 - the outer layer). `generateObstacles` takes it as an optional
sixth argument (default 0). The dead-zone flood fill works as before and is covered by tests on dense variants.


## Immediate view on input (queries)

A turn entered by the player is visible on the screen BEFORE the step: the body stands still, but the head, the camera and the hints already look in the new direction.
- `intendedHeading(s): Readonly<Vec3>` - `pendingTurn ?? heading`. The head takes its direction from it (`SnakeView.direction`).
- `viewFrame(s): Frame` - `cameraFrame` with the buffered turn already applied (only in `'free'`: a +90° roll around
  `heading × pendingTurn`, as the step will do it). A shared reusable object, do not store or change it. The camera, the ray and the hints
  read the frame from here. The core rules still work with `s.frame`/`s.heading`; on the step the core's frame equals what `viewFrame` showed.
