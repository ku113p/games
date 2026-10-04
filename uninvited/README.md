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
hooks (`state`, `sim`, `place(col, row, yaw, pitch)`, `hold(key, on)`, `press(key)`, `scene(id)`, `meeting()`).

### Scenes (`core/flow.ts`)

The game opens on the title, then runs title -> prologue -> room -> level 1 -> Jim's notes -> room -> level 2 and 3 (placeholder cards) -> ending.
The scene is saved ("Continue" on the title). `?scene=<id>` jumps to a scene (`title`, `prologue`, `room1`, `l1`, `notes`, `room2`, `l2`, `l3`,
`ending`); `?level=<id>` plays that level directly with the old start screen. Story cards: `view/story-data.ts` (shot lists), texts `story.*`.

### Benchmark (`?bench=`)

Open `http://localhost:3330/?bench=all` (or `idle`, `scan`, `scan-walk`, `scan-still`, `scan-off`, `wave`, `fx`, `fx-sword|shots|worm|drone|warden|hurt|audio|hud`, `soak`),
add `&level=slice` for the other level and `&sec=N` to change the length. Click the button (it unlocks audio), keep the tab in
front, and a panel with frame-time percentiles, slow-frame counts, draw calls, JS time, growth verdicts and a spike-cause guess
appears at the end (the JSON is copied; "Download JSON" saves it). `?bench=all` reloads between scenarios; `soak` (5 min) is
not part of it. Headless: `bun tools/bench.ts [scenario] [--level l1|slice] [--url http://localhost:3330] [--compare]`
(JSON in `bench/results/`, gitignored; headless Chrome is software GL, so read counts and trends only - the real numbers are
the ones from the browser on a real GPU). The `scan*` scenarios put the hero on arena 2's bridge (found by the laser in the level data), hold Tab and run / walk / stand there with the drone and warden active (`scan-off` is the same run without Tab; `&hold=0|1`, `&at=col,row|route<N>`, `&yaw=`, `&pitch=` for the still-image scripts). `--profile` (CPU) and `--alloc` (heap sampling) on `tools/bench.ts` list the hot functions and allocation sites. Without `?bench` none of it is loaded. Thresholds: `docs/roles/09-producer.md`.

### Camera log (`?camlog`)

`http://localhost:3330/?camlog` (add `&nolock&level=l1` for headless runs) records, every frame, the camera rig's yaw and pitch, the
camera position and its real forward vector, the hero's facing and the boom length (`view/camlog.ts`). A frame where the rig yaw,
the view axis or the hero's facing turns by more than 60 deg is a flip: it is printed with `console.warn("[camlog] camera|hero flip ...")`
and kept in `__camlog.flips` with the stack of the yaw write (if any), the core events of that frame and the mode. `__camlog.frames`
holds the last 600 frames, `__camlog.maxStep` the biggest one-frame turns seen. "camera" = the rig or the view axis turned,
"hero" = only the body turned (a dash, a shot or a swing sets the facing at once). Without the flag nothing is created.
To drive it headless: replace `requestAnimationFrame` with a fixed 1/60 s stepper, stub `__game.view.renderer.render`, and use
`__game.hold/press/place/alarm`.

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
| LMB | attack: a 3-swing sword combo (click on, the third swing is a wide finisher; an early click is kept for 0.12 s) or rifle fire; a dash cancels a swing |
| RMB (hold) | aim - the camera eases in over the right shoulder, a crosshair, slower mouse, walk speed, the rifle drawn (a sword comes back on release) and pointing at the crosshair, with a tighter spread |
| Q / wheel | sword <-> rifle |
| E | hack a terminal / take the artifact / "override" (a silent takedown of an unaware warden from behind, within 1.6 m) |
| 1 / 2 | May's abilities once bought: 1 distraction signal (a noise ping at the aimed point; wardens and drones go to look), 2 pause a camera or drone (aim at it) |
| F3 | show / hide the frame-rate overlay (fps, frame time) |
| Tab (hold) | network vision - terminal links, drone routes, camera cones through walls, sensor zones, your noise ring; an overheat meter warns before it calls the security |
| Esc | pause (the pause screen has Settings and Tips) |
| Enter / click | continue a tutorial card (the game pauses for it; Settings -> Tutorial tips turns the cards and prompts off) |

During a hack: arrows + Enter (or click a lit code), Esc to abort.

## Levels

`?level=<id>` in the URL picks the level (registry: `levels/index.ts`); the default is **l1**, the slice is `?level=slice`.

**Level 1, Jim's computer (`levels/l1.ts`)** - the tutorial, 56 x 60 cells, ~4-5 min quiet. A start ledge 2 m over the void (T0 is the meeting with May,
who opens the red wall D1 at the end of a light bridge), the **stealth primer yard** (a 2 m vantage over the plaza; a warden walks a loop below, a
4 m server block is the hide spot; inside the primer zone a stealth slip never raises the alarm stage), arena 1 "the plaza" (a camera on the west wall, a lane of
server blocks, an elevated east terrace, a finding marker), the roofed passage P1 (C1, a motion sensor), arena 2 "the river" (a balcony, a void river with a
drone, a high bridge, a low bridge with a laser, warden 2 on the north bank; T1 pauses the laser, the drone and the warden and opens D3), arena 3 "the core" (C3
on the entry terrace, the artifact in a roofed vault behind the red wall D2, a camera over the vault door, warden 3 posted at T3, which opens D2; a lane of
blocks and a high road). Three checkpoints: C1 in P1, C2 on the north bank, C3 on the entry terrace. **Each arena has its own firewall:** a lockdown is fought in
the arena you stand in (its gates, its 2 waves), then the firewall opens only that arena's red walls (A1 none, A2 D3, A3 D2).

**Level format additions** (`core/level.ts`): `arenas: [{ id, from, to, walls: [wall ids], waves? }]` (cell rectangles; the lockdown arena, its spawn gates and the
walls its firewall opens; `waves` overrides `alarm.firewallAfterWaves`; a level without arenas keeps all gates / all walls), `primers: [{ id, from, to }]` (zones where the
alarm stage never rises), and the entity `{ kind: 'finding', id, at, textKey? }` (a story marker, no rule yet). `bun tools/coverage-scan.ts l1 [--sec 90] [--map] [--legs]`
runs the real sim with a parked player and prints how much of each arena the cameras, drones and wardens ever see, and the timing windows of a route's legs.

## The slice level (`levels/slice.ts`)

One run through the open data city from the start to the artifact, three checkpoints: a light bridge over the void,
the start corridor, the raised east corridor, a short roofed passage up to the open-sky hall, the top corridor along
the north edge, the artifact on its dais (the landmark tower far beyond it). Two ways through:

- **Quiet:** walk, crouch behind the low cover past the first camera, wait for the drone's back, crouch behind the server
  blocks at the terminal next to the laser grid and hack it (the laser and the drone pause), keep out of the sound
  camera's ring (walk, never sprint), avoid the second camera's sweep, hide behind the blocks at the second terminal and
  hack it (it opens the red wall and pauses the hall drone). Past the red wall the warden walks its round: wait behind the
  rack east of the checkpoint until it walks away, follow it and slip past behind its back while it checks the rack, walk
  up the ramp to the artifact.
- **Loud:** break the cameras, cut down the drones, run through. Each incident raises the alarm a stage; at stage 2 a
  pack of worms joins the search; at stage 3 mixed waves come (drones plus worm packs from other gates - cut the packs
  down with the sword, shoot the drones at range), and after three cleared waves the firewall drops and the red wall
  opens.

Checkpoints passed under alarm 3 count towards the sad ending (the hero's lines shift to red); calm ones shift them to blue.

## Level format

A level is plain data (`core/level.ts`, `LevelDef`): an ASCII plan on a grid of `cell` metres (2 m), optional heights
and tops plans of the same size, a list of roofs and a list of entities. Row 0 is the north edge; +x is east, +z is
south. The network is an open data city: platforms over a dark void, slabs and hex towers of different heights, open
sky; only the roofs put a ceiling over a stretch.

| Char | Cell |
| --- | --- |
| `#` | slab: a solid block as tall as its `tops` character says (a clean NF6 slab) |
| `H` | hex block: the same solid block (a terraced base) with a honeycomb of hexagonal prism columns of varied heights rising out of it (real geometry, no hex texture) |
| `_` | void: no floor, a drop into the dark (falling in puts you back on the last safe ground, `world.fall` in config) |
| `.` | floor (a floor cell with the void on two opposite sides is drawn as a light bridge) |
| `~` | low cover (waist high - hides you only while crouched; you can jump onto it) |
| `n` | niche under a low roof (legacy - no longer hides you; use `cover` entities) |
| `^ v < >` | ramp; a run of ramp cells slopes between the flat cells at its two ends (a block beside it is drawn down to the ramp's low end, so no wedge of void shows under the wall) |
| `=` | laser grid floor |
| `D` | red wall (part of a wall group opened by a terminal or the firewall) |
| `T` | hack terminal position |
| `C` | checkpoint |
| `A` | the artifact |
| `S` | the start |

`heights`: a digit is the floor height in `heightStep` metres (for a block: the height its foot stands at).
`tops`: on a block, a character from `config.json` `world.tops` is how tall it is above its foot (`2` = 1.1 m, a
parapet or low block you can jump onto, `4` = 2.4 m, `6`-`9` = 4.5-11 m slabs, `a`-`d` = 14-32 m towers); `.` (or no
tops plan) = the level's `blockTop`, else `world.defaultTop`. A tops character on a cell that is not a block is an error.
Ground-level stealth still needs walls: tall blocks block every line of sight, low ones only hide you while crouched
(cameras and drones see over them), the void hides nothing.

`roofs`: `{ from, to, height? }` - a ceiling over a rectangle of cells (corners inclusive), its underside `height` metres
above y = 0 (default: the level's `ceiling`). Use them for the short enclosed passages between arenas.

Entities (`[col, row]` cells): `videoCamera` (wall side, sweep in degrees, period, phase), `soundCamera`, `motionSensor`,
`drone` (patrol waypoints; it flies over blocks up to `drone.overMax` tall - hex modules, server blocks, parapets - and round taller ones), `laser`, `redWall`, `terminal` (targets = ids of red walls / lasers / drones / wardens / cameras, difficulty),
`spawn` (a spawn gate alarm drones fly and worms crawl out of: `wall` = `n`/`e`/`s`/`w` - cut into the slab on that
side, which must be tall enough; `down` - a hatch in the floor; `up` - a hatch in the roof over the cell, or in the open
a portal in the sky `world.skyGate` metres up), `cover` (a tall server block to crouch behind: `size` = [w, d, h],
optional `offset`), `hex` (a hex module: `radius` centre to corner, `height`, optional `offset` and `id` - low ones are
cover, tall ones towers; it mixes freely with `cover` boxes and slabs), `landmark` (view only: the glowing core tower
far away, `at` may lie outside the plan, `height`, `radius`, optional `base`), `warden` (a walking guard, see below).
Wall-mounted devices need a slab behind them at least as tall as their mount. `core/grid.ts` validates the plan and
reports readable errors. Where a walker may stand is `hasFloor()` in `core/grid.ts` (no block, no void) - the wardens'
walk grid, the worms' `crawlable()` and the bot all follow it.

A `warden` stands at `at`. With a `route` (a list of stops `{ at, waitSec?, look? }`, looped) it walks its round: at a
stop with `waitSec` it stands about that long (varied) facing `look` (`n`/`e`/`s`/`w` or a yaw in degrees, 0 = south,
90 = east), checking a rack or looking around; at a stop without one it walks on (now and then it pauses anyway).
Without a route it keeps its post at `at`, facing `post` (`n`/`e`/`s`/`w`). Every stop must be reachable on foot
(`createSim` says which one is not). A terminal's `targets` may name a warden (it is paused like a drone).

`bun tools/slice-bot.ts loud|quiet [seeds] [normal|sloppy] [--level slice|l1]` plays a level headless with the real core and Rapier (default: the
slice; the routes per level are in `tools/bot-routes.ts`).

All balance numbers live in `config.json`.

## Layout

```
core/       pure, deterministic rules: state, commands (return events), queries, rules/*, level + grid, save, tests
core/hack/  the hacking mini-game core
adapters/   Rapier physics (the core's World port) and localStorage saves
view/       Three.js scene, HUD, audio, the hero (view/hero.ts, model assets/models/hero.glb built by tools/hero/build.py);
            the city from the plan (view/city.ts), the sky, void rivers, far districts and landmark (view/skyline.ts),
            ambient data packets and motes (view/city-life.ts)
input/      keyboard + mouse
levels/     level data
texts/      UI strings (en.json)
main.ts     wires everything: modes, saves, the loop
```

`bun run lint:layers` enforces the boundaries (the core imports nothing outside itself and uses no clock or
`Math.random`).

## Music files

Drop looping mp3 files into `audio/music/` (the folder may be empty: the game then plays no music) and run
`bun run music:manifest` (`play`, `build` and `check` run it too). All tracks share one tempo (`audio.music.bpm`, default
120) and a whole number of bars, so crossfades on bar lines stay in time. Expected names:

- `net_a.stem1.mp3` .. `net_a.stem4.mp3` - vertical stems of the level track (stem 1 always, more with tension and combat), or
- `net_calm.mp3`, `net_tension.mp3`, `net_combat.mp3` - horizontal versions of it
- `hack.mp3`, `room.mp3`, `office.mp3`, `menu.mp3` - one loop each (a missing hack plays the level track at tension, a missing menu its calm version)
- `sting_win.mp3`, `sting_death.mp3`, `sting_end.mp3` - one-shot stingers (synthesized stand-ins play when missing)

The files now there are the real tracks (Google Lyria 3 via OpenRouter, 2026-10-05): the `net_*` loops are 28 bars (56 s), `menu` 20 bars,
`hack` 12 bars, `room` and `office` 28 bars, all at -16 LUFS; the stingers 4.5-6.5 s at -19 LUFS (see `CREDITS.md`). The old
placeholder loops from `bun tools/music/build.ts` are gone (do not run it over the real files).
Use gapless-trimmed files: an mp3 encoder delay leaves a tiny gap at the loop seam. The loops carry LAME delay/padding fields
patched so that Chrome and Firefox decode exactly N samples with a continuous wrap.
