# Layer contract - games/snake

Three agents write the layers in parallel. The signatures below are law and must not be changed.
The base blocks below (state, rules, commands, queries, view, input, config) show the CURRENT contract as it is in the code;
the addenda after them explain why some parts look the way they do.
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

### The third axis
There is no axis-turn command and no third axis in the controls (removed): classic snake has none, and the flat opening sells that illusion. The only turn along the depth
axis is the **reveal / demo turn** (Addendum 2), which the core makes by itself (it re-frames the camera around the snake, the heading is unchanged) and which switches the game from `'plane'` to `'free'` for good. The frame is therefore constant while the game is flat.

Formula for rotating a vector v by +90° around a unit integer axis (still used by the free-mode frame, `rotateFrame`):
`v' = axis × v` when v ⊥ axis. For frame: right, up, depth are rotated by this rule,
except the one of them that coincides with ±axis - it stays in place.

## core/ - pure TS

Importing three, view/, input/ is forbidden. No allocations in the hot path
(tick, collision checks): reuse objects, mutate in place.
Random only through the seed in the state, the core is deterministic. Time comes from outside.

### core/state.ts

```ts
export interface Vec3 { x: number; y: number; z: number }
export interface Frame { right: Vec3; up: Vec3; depth: Vec3 }
export type Mode = 'plane' | 'free'
export type Phase = 'ready' | 'running' | 'dead'
export type ScreenDir = 'left' | 'right' | 'up' | 'down'
export type DeathCause = 'body' | 'wall' | 'obstacle'

export interface GameState {
  size: number
  snake: Vec3[]              // snake[0] is the head
  snakeCells: Set<number>    // keys of the snake's cells, key = cellKey()
  obstacles: Set<number>
  apple: Vec3
  heading: Vec3
  frame: Frame
  pendingTurn: Vec3 | null   // input buffer: the new heading, applied on the next step
  mode: Mode                 // 'plane' | 'free', see Addendum 2
  stepCount: number          // successful moves made in the game (a turn-in-place step is not one)
  growth: number             // how many cells are still to be grown
  phase: Phase
  score: number
  applesEaten: number
  stepMs: number             // base step duration (with the pace and the speed-up applied)
  boostRequested: boolean    // the boost button is held right now (setBoost)
  boosting: boolean          // boost is active: takes boostRequested on a step boundary (tick)
  boostFactor: number        // boost factor of this game (chosen before the start)
  paceScale: number          // scale of the whole pace curve of this game (1 = as in config.speed)
  minBoostedStepMs: number   // floor on a boosted step (config.speed.minEffectiveStepMs; 0 = no floor)
  sinceStepMs: number
  elapsedMs: number
  demoTurnPending: boolean   // demo turn: once, on step demo.afterSteps of the player's first game
  rngState: number
}

export function cellKey(x: number, y: number, z: number, size: number): number
export function nextRandom(s: GameState): number   // mulberry32, mutates rngState
export function boostedStepMs(s: GameState): number   // stepMs / boostFactor, not below minBoostedStepMs
export function effectiveStepMs(s: GameState): number // boostedStepMs while `boosting`, otherwise stepMs
```

### core/rules.ts

```ts
import type { GameState, Vec3 } from './state'
export interface Config { /* shape = config.json, type it fully */ }
export interface GameOptions { obstacleMult?: number; paceScale?: number }   // chosen in the shop before the start

export function createGame(config: Config, size: number, seed: number, isFirstGameEver: boolean,
                           boostFactor?: number,       // default: config.speed.boostFactor
                           options?: GameOptions): GameState
export function generateObstacles(size: number, density: number, stickiness: number,
                                  clearCells: Set<number>, rng: () => number,
                                  wallMargin?: number): Set<number>   // default 0
export function fillDeadZones(size: number, obstacles: Set<number>, clearCells: Set<number>): void
export function arenaHasObstacles(size: number, clearRadius: number, wallMargin: number): boolean
export function isInWallMargin(x: number, y: number, z: number, size: number, margin: number): boolean
export function spawnApple(s: GameState): Vec3
export function rotateFrame(s: GameState, axis: Vec3): void
export function rotateFrameOf(frame: Frame, axis: Vec3): void          // the same over an arbitrary Frame
export function reorientFrameFree(s: GameState, newHeading: Vec3): void // 'free' mode: frame follows a turn
export function enterFreeFrame(s: GameState): void                      // reveal plane -> free: depth = -heading, heading untouched
export function initFreeStartFrame(s: GameState): void                 // start directly in 'free'
export function speedAfterApples(config: Config, apples: number, paceScale?: number): number  // paceScale default 1
export function isValidBoostFactor(f: number): boolean
export function availableBoostFactors(config: Config): number[]
export function sanitizePaceScale(scale: number): number
export function sanitizeObstacleMult(mult: number): number
```

`generateObstacles` - cubes and obstacle clusters (stickiness is set by stickiness 0..1).
`density` is the fraction of cube cells; `createGame` passes `config.obstacles.density * options.obstacleMult`.
Cells in `clearCells` and cells closer than `wallMargin` to a cube wall never hold an obstacle.
**Hard requirement: no dead zones.** After generation, `fillDeadZones` does a flood fill
from `clearCells` over the 6 neighbors; the free cells it does not reach are filled with obstacles
(the generation is not repeated). A test is mandatory.
`arenaHasObstacles` tells whether a cube of this size can hold any obstacle at all (false for cubes up to 11 cells with the current config).

### core/commands.ts

```ts
export type GameEvent =
  | { type: 'started' }
  | { type: 'moved' }
  | { type: 'turned'; heading: Vec3 }
  | { type: 'ate'; apple: Vec3; score: number }
  | { type: 'appleSpawned'; apple: Vec3 }
  | { type: 'speedUp'; stepMs: number }
  | { type: 'boostChanged'; on: boolean }
  | { type: 'demoTurn' }
  | { type: 'modeChanged'; mode: Mode }
  | { type: 'died'; cause: DeathCause }

export function startGame(s: GameState): GameEvent[]
export function setBoost(s: GameState, on: boolean): GameEvent[]
export function turnInPlane(s: GameState, dir: ScreenDir): GameEvent[]
export function tick(s: GameState, config: Config, dtMs: number): GameEvent[]
```

`tick` caps `dtMs` at `config.loop.maxFrameMs`, accumulates `sinceStepMs` and makes steps while there is enough time.
Events are returned in the same reusable array (no allocations in the hot path).
Demo turn (the reveal): if `demoTurnPending` and `stepCount >= config.demo.afterSteps`, the core itself makes the plane to free
transition (a stand-still step, see Addendum 3): `heading` is NOT changed, the frame is turned around the snake so that `depth = -heading`
(`enterFreeFrame`), and it adds `modeChanged` and `demoTurn`, in that order. It always fires (nothing is random, nothing can block it). `boostChanged` is emitted by `setBoost` only (see Addendum 4).

### core/queries.ts - read-only

```ts
export function head(s: GameState): Vec3
export function isAlive(s: GameState): boolean
export function snakeLength(s: GameState): number
export function cameraFrame(s: GameState): Frame
export function viewFrame(s: GameState): Frame                 // cameraFrame with the buffered turn applied, Addendum 4
export function score(s: GameState): number
export function forEachObstacle(s: GameState, fn: (x: number, y: number, z: number) => void): void
export function forEachSnakeSegment(s: GameState, fn: (x: number, y: number, z: number, index: number) => void): void
export function applePos(s: GameState): Readonly<Vec3>
export function cubeSize(s: GameState): number
export function elapsedMs(s: GameState): number
export function gameMode(s: GameState): Mode
export function stepProgress(s: GameState): number             // 0..1 within the running step
export function intendedHeading(s: GameState): Readonly<Vec3>  // pendingTurn ?? heading
export function isBoosting(s: GameState): boolean              // REQUESTED boost
export function isBoostActive(s: GameState): boolean           // ACTIVE boost
export function getBoostFactor(s: GameState): number
export function effectiveBoostFactor(s: GameState): number     // how many times shorter a boosted step really is (floor applied)
export function stepsToCrash(s: GameState, horizon: number): number  // 0 = no crash within horizon
export function appleOnCourse(s: GameState): boolean
```

## view/ - three.js, subscribed to events

```ts
// view/index.ts
import type { GameState, GameEvent } from '../core/state'
export interface View {
  resize(width: number, height: number): void
  handle(event: GameEvent, s: GameState): void
  render(s: GameState, dtMs: number): void
  setCameraTilt(yaw: number, pitch: number): void   // tilt from the player, rad, within +-1
  setFogOn(on: boolean): void
  applyPerf(width: number, height: number): void    // debug (perf panel), cold path
  readPerf(out: PerfSnapshot): void                 // debug, no allocations
  gpuInfo(): GpuInfo                                // debug, cold path
  dispose(): void
}
export function createView(canvas: HTMLCanvasElement, config: Config, s: GameState,
                           cosmetics?: CosmeticsInput): View
```

Reads state **only** through `core/queries`. Does not call commands.

Look: neon. A dark background, a glowing cube frame, the snake as a gradient from head to tail,
the apple pulses, obstacles are dim neon. Bloom through postprocessing.
The snake and obstacles are `InstancedMesh` (100³ with dense obstacles = tens of thousands of cubes).
No new objects and no `await` in the frame: pools, reuse, in-place mutation.

**The flat opening** (`'plane'`, the player's first game): the camera is far from the cube and looks through a narrow lens, the head's layer (20×20) fills the screen width
(`camera.plane`, sized by `planeCameraDistance` in `view/camera-config.ts`). Everything at another depth is **not drawn**: the camera's near and far clipping planes sit on the faces of the head's layer and
the obstacles' shaders drop cells outside the layer (`layerReach`); the flat board (`view/plane-board.ts`) is the only field. The tilt is off while flat. On the mode change the layers appear outward from
the head's layer over `camera.plane.revealShare` of the flight (`CameraRig.reveal`), with a glitch `config.camera.glitchMs` on top. Numbers only from config.

## input/ - touch and keyboard

```ts
// input/index.ts
export type InputScheme = 'swipes' | 'taps'
export interface InputHandlers {
  onTurn(dir: ScreenDir): void
  onBoost?(on: boolean): void                         // held / released, always in pairs
  onCameraTiltBy?(dYaw: number, dPitch: number): void // increment, rad
  onCameraZoomBy?(factor: number): void               // increment: > 1 farther, < 1 closer
  onCameraReset?(): void
  onPause?(): void                                    // Escape
}
export function attachInput(el: HTMLElement, scheme: InputScheme,
                            config: Config, h: InputHandlers): () => void  // returns detach
```

- `'swipes'`: a swipe is a turn; a tap does nothing. A swipe is at least `config.input.swipeMinPx`.
- `'taps'` (default, `config.input.defaultScheme`, resolved by `input/scheme.ts`: a stored choice wins, an unknown value falls back to `'taps'`): the canvas only tilts the camera. Turns come from the corner pad
  (`input/pad.ts`, `attachPad(root, handlers)`, separate DOM buttons over the canvas): four arrow buttons.
- Keyboard (PC, works in both schemes): arrows/WASD - turn,
  Shift/Space (hold) - boost, R - camera reset, Escape - pause.
- Tap zones ≥ 44 px. No hover. Input must not break on an orientation change.
- Debug only: `?camera=free` swaps the chase camera for a free one (`view/free-camera.ts`; keys I/K/J/L/U/O fly, F focus on the head, C reset, H hide the HUD; mouse drag orbits, wheel dollies). It is never created without the parameter and a player never meets it.

## config.json - all balance values

```json
{
  "cube": { "sizes": [5, 20, 50, 100], "default": 20 },
  "snake": { "startLength": 3, "growPerApple": 1 },
  "speed": { "startStepMs": 1080, "minStepMs": 360, "stepMsPerApple": 24,
             "boostFactor": 1.5, "boostFactors": [1.5, 2, 3, 4], "minEffectiveStepMs": 60 },
  "obstacles": { "density": 0.03, "stickiness": 0.6, "clearRadius": 4, "wallMargin": 1 },
  "camera": { "glitchMs": 180,
              "followDistance": 6, "followHeight": 3.6, "lateralOffset": 1.05, "lookAheadDistance": 10,
              "lookDownOffset": 1.5, "modeSwitchMs": 1400, "zoomMin": 0.5, "zoomMax": 2,
              "zoomWheelPerPx": 0.0012, "zoomPinchGain": 1, "zoomFollowMs": 120,
              "plane": { "visibleCells": 20, "marginCells": 1, "fovDeg": 20, "raise": 0.1, "revealShare": 0.45 } },
  "hints": { "latticeAt": "corners", "latticeStep": 4, "compassHideDist": 1.5, "compassFullDist": 3 },
  "headSignal": { "dangerHorizon": 2, "riseMs": 50, "fallMs": 400, "goalScale": 0.88 },
  "demo": { "afterSteps": 5 },
  "plane": { "appleMaxSteps": 4 },
  "loop": { "maxFrameMs": 100 },
  "minimap": { "windowCells": 20, "levelWindowCells": 10 },
  "fog": { "density": 0.06, "defaultOn": true },
  "input": { "defaultScheme": "taps", "swipeMinPx": 24, "tiltRadPerPx": 0.005, "twoFingerLockPx": 10,
             "stick": { "sizeVmin": 24, "sizeMinPx": 88, "sizeMaxPx": 112, "deadZone": 0.2,
                        "curve": 1.5, "maxRadPerSec": 1.2, "tapMaxMs": 250 } }
}
```

`config.json` also holds the sections `quality`, `leaderboard`, `sound`, `palettes` and `shop`; they are not repeated here.
Analytics settings live in `analytics/config.json`.

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

`forEachSnakeSegment`, `applePos`, `cubeSize`, `elapsedMs`. Their signatures are in the core/queries.ts block above.

AGENTS.md rule 2: the view reads state ONLY through queries. Reading
`s.snake`, `s.apple`, `s.size`, `s.elapsedMs` directly from the view is a violation, remove it.

## The invariant that the review found violated

**The core never reports a roll that it will not perform.**
The camera orientation must at any moment be derivable from `cameraFrame(s)`.
The review found that an axis-turn command emitted its event immediately while a later turn silently canceled the roll -
the camera moved away, the world did not. The axis-turn command is gone (there is no third axis in the controls), so the only frame changes left are
the demo turn (sets the frame at once) and the free-mode reorientation on a step (`viewFrame` predicts it for the queued turn).
The invariant is still mandatory and tests for these scenarios exist:

1. Two `turnInPlane` in a row before the step.
2. A queued turn in free mode: `viewFrame` equals the frame the step will produce.
3. The reveal: heading unchanged, `depth = -heading`, the axis of the old screen plane perpendicular to the heading is kept, a queued turn survives (unless it was "straight on").
4. Death on the step of a turn.

## Demo turn (new rules from DESIGN.md)

- Fires **on step 5** of the player's first game. The number of steps is in config: `demo.afterSteps`.
- **The snake keeps its heading** (the designer: the reveal is a change of viewpoint, not of course). Nothing is random and nothing can
  block it, so it always fires. Earlier versions turned the snake into a random free side along the depth axis, which really changed the heading.
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

`GameState.mode: 'plane' | 'free'`. The first game of the player starts as `'plane'`; every later game starts
right away as `'free'` (`createGame` with `isFirstGameEver = false`). On the demo turn
(`demo.afterSteps`) the core switches to `'free'` and emits an event. It never goes back.

### Mode `'plane'` - as now
- `heading` lies in the screen plane (±right or ±up), `depth` toward the viewer.
- `turnInPlane` - 4 directions in the slice. The frame does not change; the only way out of this mode is the demo turn.
- The apple is in the head's layer, reachable without leaving it, at most `plane.appleMaxSteps` moves from the head (`spawnApplePlane` in `core/rules.ts`). A flat-opening rule, not a general one.
- `createGame` runs the first game ever on `config.cube.default` (20) whatever size is passed (`arenaSizeFor`).
- The camera is at the side, looks at the cube center.

### Mode `'free'` - new
- `heading` points **away from the viewer, into the depth**: `depth = -heading`.
- `right` and `up` are perpendicular to heading and give the four possible turns.
- `turnInPlane(dir)` turns the head: `left → -right`, `right → +right`,
  `up → +up`, `down → -up`. After the turn, frame is recomputed so that
  `depth` again equals `-heading`, and `up` changes minimally (no upside-down flips).
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

- There is no third-axis input in either mode (no taps, no double tap, no pad buttons, no Q/E).

---

# Addendum 3 - the stand-still step (was: the turn-in-place step)

The designer's feedback: "probably the snake shouldn't move during the flip - let the change of direction
happen before the movement." (Superseded in part: the direction no longer changes at all, see "Demo turn" above; the stand-still step stayed.)

**The reveal is a separate step.** The snake stands still while the frame is re-cut around it, and only
on the next step moves on, in the same direction. Ordinary turns in the plane (`turnInPlane`) are not affected - they
still coincide with a step, as in the classic snake.

On the stand-still step the snake does not move, does not grow, does not eat, collisions are not checked,
`stepCount` does not grow (it is not a move). The step takes exactly one `stepMs`.

## Event

`turnedInPlace` no longer exists: the heading does not turn, so there is nothing to report. The reveal emits `modeChanged`, `demoTurn`.

## Side finding

(From the time the demo turned the snake:) `heading` did not match the last step taken,
and the ordinary "180-degree reversal" check stopped being enough: a swipe backward hit the neck and killed.
The `pointsIntoNeck` check was added - such a swipe is ignored. It stays as a safety net.

---

# Addendum 4 - boost and the obstacle margin from the walls

**Boost.** `setBoost(s, on): GameEvent[]` (core/commands.ts). While boost is active, a step lasts
`stepMs / boostFactor`, but not shorter than the floor `config.speed.minEffectiveStepMs` (currently 60 ms, `boostedStepMs` in core/state.ts).
The factor is chosen before the start and passed to `createGame` (by default `config.speed.boostFactor`, currently 1.5;
the factors on offer are the list `config.speed.boostFactors`, currently 1.5, 2, 3, 4). The speed-up per apple works on top, and the `speedUp` event
still carries the base `stepMs`. **Pressing and releasing take effect from the next step:**
the current step is finished at the pace at which it began (the duration is not changed retroactively).
Two `GameState` fields: `boostRequested` (requested, changed by `setBoost`) and `boosting` (active, `effectiveStepMs`
depends on it). `tick` copies `boosting = boostRequested` right after each step slot (a step, a turn-in-place
step, a demo step) - that is the step boundary; the step duration is taken anew on each iteration
of the loop, so inside one long frame the first step goes at the old pace, the rest at the new one.
The event `{ type: 'boostChanged'; on }` is emitted immediately and only on a real change of the **request** (`tick` does not
emit it); outside the `running` phase `setBoost` does nothing. `boostFactor` is a field of the game state, set once in `createGame` (`setBoost` does not
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
