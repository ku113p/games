# Uninvited

Entry for the GameDev.tv Halloween Jam 2026. Bun + TypeScript + Three.js + Rapier, PC browser, keyboard and mouse.
The design is in `DESIGN.md`, the jam plan in `PLAN.md`, the rules for agents in `AGENTS.md`.

## Run

```sh
bun install
bun run play        # production-like server: http://localhost:3330/ (does not rebuild - restart after a change)
bun run dev         # Bun dev server with rebuilds: http://localhost:3331/
bun run check       # typecheck + layer linter + core tests
bun run build       # static build with relative paths -> dist/uninvited/
bun run test:hack   # the hacking mini-game on its own: http://localhost:3327/
```

`?nolock` in the URL skips the pointer lock (handy for automated screenshots). `window.__game` exposes a few debug
hooks (`state`, `sim`, `place(col, row, yaw, pitch)`, `hold(key, on)`, `press(key)`).

## Controls

| Key | Action |
| --- | --- |
| WASD | move |
| Mouse | look (click the page to lock the pointer) |
| Shift (hold) | sprint (loud) |
| double tap W/A/S/D | dash that way (a short invulnerability) |
| Space | jump |
| C | crouch / stand (toggle) |
| Ctrl (hold) | crouch while held |
| LMB | attack (sword swing or rifle fire) |
| Q / wheel | sword <-> rifle |
| E | hack a terminal / take the artifact |
| Tab (hold) | network vision - terminal links, drone routes, camera cones through walls, sensor zones, your noise ring; an overheat meter warns before it calls the security |
| Esc | pause |

During a hack: arrows + Enter (or click a lit code), Esc to abort.

## The slice level (`levels/slice.ts`)

One corridor run from the start to the artifact, three checkpoints. Two ways through:

- **Quiet:** walk, crouch behind the low cover past the first camera, wait for the drone's back, crouch behind the server
  blocks at the terminal next to the laser grid and hack it (the laser and the drone pause), keep out of the sound
  camera's ring (walk, never sprint), avoid the second camera's sweep, hide behind the blocks at the second terminal and
  hack it (it opens the red wall and pauses the hall drone), walk up the ramp to the artifact.
- **Loud:** break the cameras, cut down the drones, run through. Each incident raises the alarm a stage; at stage 3 drone
  waves come, and after three cleared waves the firewall drops and the red wall opens.

Checkpoints passed under alarm 3 count towards the sad ending (the hero's lines shift to red); calm ones shift them to blue.

## Level format

A level is plain data (`core/level.ts`, `LevelDef`): an ASCII plan on a grid of `cell` metres (2 m), an optional
heights plan, and a list of entities. Row 0 is the north edge; +x is east, +z is south.

| Char | Cell |
| --- | --- |
| `#` | wall |
| `.` | floor |
| `~` | low cover (waist high - hides you only while crouched; you can jump onto it) |
| `n` | niche under a low roof (legacy - no longer hides you; use `cover` entities) |
| `^ v < >` | ramp; a run of ramp cells slopes between the flat cells at its two ends |
| `=` | laser grid floor |
| `D` | red wall (part of a wall group opened by a terminal or the firewall) |
| `T` | hack terminal position |
| `C` | checkpoint |
| `A` | the artifact |
| `S` | the start |

`heights` is a second plan of the same size: a digit is the floor height in `heightStep` metres.

Entities (`[col, row]` cells): `videoCamera` (wall side, sweep in degrees, period, phase), `soundCamera`, `motionSensor`,
`drone` (patrol waypoints), `laser`, `redWall`, `terminal` (targets = ids of red walls / lasers / drones, difficulty),
`spawn` (a spawn gate alarm drones fly out of: `wall` = `n`/`e`/`s`/`w`/`up`), `cover` (a tall server block to crouch
behind: `size` = [w, d, h], optional `offset`). `core/grid.ts` validates the plan and reports readable errors.

`bun tools/slice-bot.ts loud|quiet [seeds] [normal|sloppy]` plays the slice headless with the real core and Rapier.

All balance numbers live in `config.json`.

## Layout

```
core/       pure, deterministic rules: state, commands (return events), queries, rules/*, level + grid, save, tests
core/hack/  the hacking mini-game core
adapters/   Rapier physics (the core's World port) and localStorage saves
view/       Three.js scene, HUD, audio, the hero (view/hero.ts, model assets/models/hero.glb built by tools/hero/build.py)
input/      keyboard + mouse
levels/     level data
texts/      UI strings (en.json)
main.ts     wires everything: modes, saves, the loop
```

`bun run lint:layers` enforces the boundaries (the core imports nothing outside itself and uses no clock or
`Math.random`).
