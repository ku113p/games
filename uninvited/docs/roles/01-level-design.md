# Level designer guide - Uninvited

The level designer owns the network levels: the floor plans, heights and tops, roofs, and every placed entity
(terminals, red walls, cameras, sensors, lasers, drones, wardens, cover, hex modules, spawn gates, the landmark),
plus the pacing of a level from the start ledge to the artifact. Files: `levels/*.ts` (`l1.ts`, later `l2.ts`, `l3.ts`,
registered in `levels/index.ts`), the format in `core/level.ts`, the bot routes in `tools/bot-routes.ts` (checked with
`bun tools/slice-bot.ts loud|quiet --level <id>`), and the level parts of `DESIGN.md` sections 4 and 6. Balance numbers
live in `config.json`; the level designer reads them and does not hard-code them. Gameplay rules (`core/rules/`) belong to
other roles; ask for a format change rather than bending a rule inside a level.

## Principles

- **String of pearls.** Short passages teach and rest, big arenas test; a level alternates them.
  Source: The Level Design Book, layout / typology / flow - https://book.leveldesignbook.com
- **Teach, develop, twist, test (kishotenketsu).** Show a mechanic safely, then harder, then with a twist, then as an exam.
  Source: Nintendo's level design in four steps - https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps
- **Stealth readability beats difficulty.** The player must see what the enemy sees; being spotted with no visible cause
  feels like cheating. Source: Mark of the Ninja overview - https://critpoints.net/2016/01/17/mark-of-the-ninja-overview/ and
  https://popmatters.com/166432-mark-of-the-ninja-2495791612.html
- **Several routes, a visible goal, vertical play.** Routes must look like a plausible part of the world; the goal is seen early.
  Source: Level design techniques in Dishonored 2 - https://blogs.ulster.ac.uk/b00860009-fad/files/2023/02/Level-Design-Techniques-in-Dishonored-2.pdf
- **Landmarks and circulation.** A landmark is a unique shape or mass seen from far away; the plan reads as believable
  architecture. Source: The Level Design Book (landmarks, circulation, metrics) - https://book.leveldesignbook.com
- **Combat space.** Cover is predictable and readable at a glance; a flank costs risk; open "no man's land" slows the player
  without fake walls. Source: Mapcore, "Creating a Single-Player Combat Space" - https://www.mapcore.org/articles/development/creating-a-single-player-combat-space-r80
- **The door problem of combat.** Design a fight as a space with entrances, spawns and ways out, not a room with enemies.
  Source: https://www.gamedeveloper.com/design/the-door-problem-of-combat-design
- **Metrics first.** Every size comes from speed, jump height and enemy radii. Source: The Level Design Book (metrics) -
  https://book.leveldesignbook.com

The reviewer read these sources as search excerpts, not in depth; treat them as direction, not citations of detail.

## Decisions for Uninvited

- **Structure** (DESIGN 6): hand-made levels, a linear "string of pearls" in an open data city - platforms over a void,
  NF6 slabs, NF4 hex modules as cover, light bridges, data rivers. Arenas are free inside; a vantage point at each entrance;
  2-3 paths through an arena that cross; guards cover 30-50% of an arena with 4-8 s windows; a landmark marks the goal.
- **Length** (DESIGN 6, changed after the reviews): **about 5 minutes per level**, ~20 minutes for the whole game with the
  real-world scenes. This overrides the review's sizes (3 arenas for L1, 4 for L2/L3). L2 and L3 are **one arena + a finale**.
- **3 checkpoints per level** (DESIGN 6; `ending.totalCheckpoints` 9). A checkpoint counts red only if an alarm-3 wave fight
  happened since the previous one (DESIGN 4) - so checkpoints sit on arena borders where a fight clearly starts and ends.
- **Winning** = taking the artifact; the core sets the phase to `won` at once (`core/rules/terminals.ts`). There is no walk
  back, which settles the review's "no exit after the vault" problem.
- **Enemy roles** (DESIGN 8): drones watch from high up and barely shoot (HP 40, two rifle hits); wardens are the main guards
  and fighters (HP 200, cone 10 m / 21° half angle, turn slowly); worms only come in waves; one turret type, **ET1, used
  sparingly: the L1 core and the L3 finale**. Waves are 4-15+ enemies (`alarm.waves`), out of spawn gates at least
  `minSpawnDist` 12 m from the player; attack tokens cap the pressure (3 bites, 1 melee, 2 ranged at once).
- **Non-lethal takedown** (DESIGN 8): sneak up behind a warden, press E. Levels must offer real "behind the back" approaches.
- **May** (DESIGN 10): actives are pause a camera and a distraction; take-over and the helper turret are cut - do not design
  a route that needs either. On L2 May refuses a couple of hacks; a quiet detour must always exist there.
- **No Halloween dressing** (DESIGN 14). Accents per level: L1 clean NF6; L2 NF2 neuromorphic "trees" along the arena edges;
  L3 NF3's quantum core as the landmark and NF7's vault in the finale.
- **Where the review and DESIGN.md disagree, DESIGN.md wins**: level count and length, the turret type, the cut abilities.

### L1 as built, and how it shrinks to ~5 minutes

As built (`levels/l1.ts`, top-down render in the review folder): 60x70 cells; start ledge with T0 and D1 -> A1 plaza
(cam1, warden1, drone0, two exits) -> P1 (C1, sensor) -> A2 river (T1 pauses laser1 + drone1, warden2, high and low bridge)
-> P2 (C2, sound camera) -> A3 core, 23x23 cells (cam2, cam3, drone2, warden3 posted by T3, warden4, sensor2, T3 opens D2,
T2 pauses the tower cameras and drone). Four hacks, 4 wardens, 3 drones, 3 cameras, 26 spawn gates.
Measured on the plan, the quiet critical path is about 165 cells (~330 m): ~3 min of crouch/walk, ~2.5 min of hacks,
~2 min of waiting - **7-8 min for a good first run**, 10 with mistakes.

Target budget (~5 min): about 100 cells (~200 m) of quiet path, **3 hacks** (T0 trivial, then two), ~1.5 min of waiting.

1. **Start ledge**: keep; put T0 within 4 cells of S. T0 teaches hacking and opens D1 (unchanged).
2. **A1 plaza**: shrink to about 24x14 cells; the quiet loop round the edge is at most 30 cells. Keep cam1 and warden1 - A1
   now teaches the camera **and the takedown** (warden1's west-street stop with its back to a hex group). Remove drone0:
   drones are introduced in A2. Keep the second, roofed exit.
3. **P1**: C1 + the motion sensor, at most 8 cells.
4. **A2 river**: keep almost as is - it is the level's real choice (high bridge vs. low bridge + laser). Make drone1's patrol
   cover only the low-bridge half so the high-bridge landing is not under it. C2 at the exit.
5. **Cut P2 and the sound camera** (sound cameras debut in L2; they are also on the PLAN cut list). Join A2 to the core by a
   short light bridge (4-6 cells).
6. **The core becomes a finale court** of about 14x14 cells round the landmark tower: C3 on the entry terrace (the vantage),
   warden3 posted with its back to T3, one ET1 turret covering the vault door, T3 targets `['wall2', 'turret1']` (opens D2
   for good, pauses the turret 30 s). Cut T2, cam2/cam3, drone2, warden4, sensor2. Two things must be handled at once
   (the warden and the turret), as DESIGN 6 asks. If turrets are cut (PLAN section 3), one tower camera takes the turret's place.
7. Keep 2-3 spawn gates per space (A1, A2, the court), not 26; remove gates in passages.

The turret needs a `turret` entity in `core/level.ts` (id, at, facing, sweep) and terminals able to pause it.

### L2 and L3: one arena + a finale, in the level format

Both follow one template so they can be built in parallel and reuse L1's pieces (plaza ring, river, tower court):

| Part | Plan size (cells) | Contents |
| --- | --- | --- |
| Start pad + intro passage | 6x6 + up to 8 | S, a May line, the level's new element shown safely; roofed passage (`roofs`) |
| C1 | - | at the arena balcony (2 m up via `heights` + `^` ramps): the vantage |
| The arena | 20x16 to 22x20 (40x32 - 44x40 m) | 2-3 crossing routes, 2 wardens, 1 drone, 1-2 cameras, 1-2 terminals, 3 spawn gates on slab sides >= 12 m from the middle, one 8-10 m open field |
| C2 | - | at the arena exit, in a short passage |
| Finale | 12x12 to 14x14 | C3 at its entry terrace, the landmark, the artifact behind a red wall, one combined lock |

- **L2 "employees' personal data"**: the arena is an archive district - hex-module stacks as aisles (`H` blocks with tops
  4-7) and NF2 trees on the edges. New element: the sound camera, shown in the intro passage. May refuses two terminals
  (personal data), so each has a visible quiet detour: an upper bridge or a crouch route behind low cover. The findings
  (the firing spreadsheet, the unsent transfer request) sit on the critical path. The finale court holds the server with the letter;
  its red wall opens from a terminal May does help with. No turret.
- **L3 "the security core"**: the arena is a firewall ring around the NF3 quantum core (the landmark). New element: the heavy
  warden (`heavy: true`) at a post. The finale is the NF7 vault with 1-2 ET1 turrets and the strongest wave table; taking the
  artifact leads into the explicit ending choice (DESIGN 4). Firewall-drop pacing stays as in DESIGN 9.
- Format additions both levels need (ask the core owner): `turret`; a readable `finding` (a text key); a terminal flag for
  May's refusal; per-level wave tables if one global `alarm.waves` proves too strong for L1.

## Rules of thumb and metrics

Numbers from `config.json` (cell = 2 m):
- Walk 2.6 m/s, crouch 1.5, sprint 6.4; worms run 6.4 m/s too - **cover does not save you from worms, space does**.
- Jump apex 7.2^2 / (2 x 22) = **1.18 m**. Jump-on cover must be at most 1.1 m (tops `2` = 1.1); hex cover 1.3-1.5 m cannot be
  climbed - never write "climb onto" for it. Anything higher needs a ramp (`^ v < >`).
- Hiding: crouched eye 0.7 m; cover 1.1-1.5 m hides a crouched hero, not a standing one.
- Warden: cone 10 m, 21° half angle, patrol 1.15 m/s, notices you even crouched within 1.6 m in front.
  Camera: 14 m, 24° half angle, 9 s sweep, 25% hold. Drone: 12 m, 32°, hover 3.5 m. Sound camera: 9 m. Sensor: 2.6 m.
- Sword 2.6 m / 180°, finisher 3.2 m / 270°: narrow places (3-6 m) make the sword strong against packs.
- Streets and passages 3-6 m; arenas 20x30 to 40x40 m; towers 4-12 m; passage ceilings 3-5 m (DESIGN 6).
- Passages at most 8 cells; a level's quiet critical path about 100 cells; at most 3 hacks per level.
- For every warden write its cycle (walk N s, stand M s, look K) and mark a >= 5 s window next to cover on the plan.
- At least 40% of an arena's floor outside every cone; no patrol within 6 m (3 cells) of a checkpoint or terminal.
- One new threat per space; one twist per arena.
- Landmark taller than every ring around it (25-30 m minimum) and seen from the start ledge.
- Spawn gates: 2-3 per arena, on slab sides or sky portals, >= 12 m from where the fight is expected; none in passages
  (a gate cut into a slab needs a slab tall enough - the build checks it).
- Every terminal: a server block or hex to crouch behind while hacking, and two approaches.
- Run both bots after every change: `bun tools/slice-bot.ts quiet 5 normal --level <id>` and `... loud ...` (routes in
  `tools/bot-routes.ts`). On 2026-10-04 evening the L1 build failed on load (`spawn gate at [13, 31]: the slab on its 's' side
  is too low`) - fix the data before trusting any timing.

## Review 2026-10-04

Reviewed: the approved L1 draft (60x70 cells, 3 arenas, 4 wardens, 2 drones, 3 cameras, 1 microphone, 2 sensors,
1 laser, 4 terminals, 3 checkpoints), `config.json`, slice screenshots.

**Strengths.** An honest structure: a start ledge over the void, each passage teaching one thing (sensor: walk; microphone: do
not run), arenas as exams. Terminals escalate well (T0 safe, T1 pauses a laser and a drone, T2 cameras, T3 behind a warden).
The river arena uses the void meaningfully - the one real choice. Checkpoints sit on arena borders, so the counter is fair.

**Problems, by impact:**

| # | Problem | Status |
| --- | --- | --- |
| P1 | Waves on the loud path are not in the geometry: no gates, no retreat, no combat zones; worms as fast as a sprint make cover useless; 48x32 m arenas with no corners turn a wave into running in circles; the camera crowds the hero in tight spots | in progress - 26 spawn gates placed, attack tokens and shard healing built; combat zones and open fields still open |
| P2 | Routes converge: all paths share P1, P2 and one A1 exit next to warden1; the quiet A1 detour is 60+ cells | in progress - A1 got a second roofed exit; the shrink above removes P2 |
| P3 | The first fight only comes from failure; sword and rifle are never taught safely | open |
| P4 | Metrics: jump 1.18 m cannot reach 1.4 m cover or 2 m terraces; the high-bridge landing sits on warden2's line and under the river drone | in progress - low cover is 1.1 m and the format no longer promises climbing hex; the drone overlap is open |
| P5 | The landmark may be hidden behind 4-12 m rings | done - the landmark is 95 m tall with a beam |
| P6 | Guard density and windows are not set; "every cell watched" | open - no windows or safe-share check yet; the art side is built (2026-10-05): the floor is lit where watched and dark in blind spots, derived from the level (`view/exposure.ts`), so the lanes you author now show on screen |
| P7 | T3 behind a posted warden, one approach, a dead end if seen | decided otherwise - the warden faces away from T3 and the takedown gives the tool; a second approach is still wanted |
| P8 | The slice shows big blank dark walls; arenas are rectangles with 2-3 blocks | in progress - city kit with seams, windows and crowns |
| P9 | No defined end after the artifact | done - taking the artifact wins the level |

**Top 5 recommendations, updated:**
1. **[M] Combat zones and gates in the plan** - 2-3 gates per arena on slab sides, one 8-10 m open field per arena with cover
   taller than a worm along it; waves stay in arenas, not passages. Gates done; fields open.
2. **[S] A combat primer before the first mistake** - an optional 2-worm pack or the takedown on warden1 near C1, plus the LMB
   hint. Open.
3. **[S] Metrics and routes** - no climbing 1.4 m cover (done), move the river drone off the high-bridge landing (open),
   a second A1 exit (done).
4. **[S] Landmark and wayfinding** - spire above every ring (done); route lights in two colours, cyan quiet and magenta
   loud (open; check against the art direction's colour budget).
5. **[M] Guard windows and safe pockets** - write each warden's cycle, >= 5 s windows, >= 40% safe floor; define the end of
   A3 (done by the win rule). Open; now part of the L1 shrink.

## Release checklist

- [ ] Every level loads (`createSim` throws on bad data) and both bots win on 5 seeds, quiet and loud.
- [ ] A first quiet run of each level takes about 5 minutes (time a human run, not only the bot).
- [ ] Each level has exactly 3 checkpoints on arena borders, and none inside a guard's patrol.
- [ ] Each arena has a vantage point at its entrance and a landmark visible from it.
- [ ] Every terminal has cover to hack behind and two approaches; every red wall's terminal is linked in network vision.
- [ ] Every warden cycle has a >= 5 s window by cover; >= 40% of arena floor is outside all cones.
- [ ] No promise of climbing anything above 1.1 m; every height change over that has a ramp.
- [ ] Spawn gates exist in every arena and are >= 12 m from the expected fight; no waves in passages.
- [ ] L2 has a quiet detour around every terminal May refuses.
- [ ] L3 finale: the artifact leads into the ending choice; turrets 1-2 at most.
- [ ] Falling into the void returns the player to safe ground near where they fell (no soft-lock).
- [ ] `README.md` and `DESIGN.md` describe each level as built.

## Don'ts

- Do not keep L1 at 3 arenas and 4 hacks: the game is ~20 minutes now.
- Do not build L2/L3 as new maps from scratch; reuse the plaza ring, the river and the tower court.
- Do not add a new enemy type or mechanic to a level before its waves and routes are bot-checked.
- Do not make guard AI smarter (alerting, room searches) to fix a level - readable geometry wins in a jam.
- Do not route through "take over a sentry" or the helper turret - both are cut.
- Do not hide the reason for detection: a cone or camera must be readable from the device itself.
- Do not put waves in narrow passages or spawn gates right next to the player.
- Do not place a patrol so that every cell is watched; leave real safe pockets.
- Do not add Halloween props.
- Do not change the level format silently - core/level.ts, README and DESIGN change together.

## Review 2026-10-05

Reviewed: `levels/l1.ts` as built (unchanged since 10-04 except T0 `meetsMay`), both bots (8 seeds), `seam-scan --niches`,
shots at the vantage points, and the designer's feedback ("detours are boring", "monotonous", "unclear where you can slip
through", "you want to dash along the edge", "empty corridors"). Full text: the session scratchpad `reviews2/01-level-design.md`.

**Measured.** Quiet bot 8/8, 368-393 s; loud bot 8/8, 115-205 s. Quiet route 201 cells vs. a 102-cell shortest walk
(A1 57, A3 79 with a T3 -> T2 -> vault back-and-forth). **Only 2 checkpoints** ([26,15], [37,15]) - DESIGN wants 3, README
claims C1 in P1. 26 spawn gates, two under passage roofs ([11,41], [30,15]). Ever-watched floor: A1 45%, A2 33%, A3 65%;
the never-watched cells are the arena rims, so the rim is the dominant route. Low hexes on watched cells: A1 8/18, A3 16/19.
No jump-usable cover in L1. Niches: [9,25], [10,25].

**Earlier items.** P1 partly (gates, no combat front); P2 partly; P3 open; P4 partly (river drone still over both bridges);
P5 fixed; P6 open; P7 decided (takedown, not built); P8 partly (arenas still read alike); P9 fixed; route lights open (dropped
from the top 5).

**Rules added by this review.**
- The quiet route is different, not longer: it goes through an arena on a readable lane, never round its rim.
- A lane is a straight chain of one prop (the 1.4 m server block) at <= 3 m spacing, <= 2 m gaps, between tall blocks that
  cut the main watcher's view. Tall = safe, waist-high = safe crouched, open floor = timed. No low cover on watched cells.
- No free rim street: the arena edge either touches the inner blocks or carries the walking warden / the drone.
- Patrols are loops with readable gaps: authored wardens without random pauses (*rule built 2026-10-05*: only `waitSec` stops, +-10 %, head sweep 30 deg walking / 55 deg at a stop), a 20-30 s cycle with one >= 6 s window;
  drones slower than walking (proposal 1.4 m/s) on straight back-and-forth lines.
- A connector is <= 6-8 cells and has exactly one beat (checkpoint, sensor lesson, vista, May line, finding) or it is cut.
- One identity, one threat, one set piece per arena; <= 50% ever-watched floor.

**Top 5 (2026-10-05).**
1. [M] Shrink L1 aimed at no detour tax and readable lanes; add C1 in P1; cut P2, T2, cam3, drone0, drone2, warden4, sensor2;
   quiet path <= ~110 cells, quiet bot <= ~220 s.
2. [S/M] One identity + set piece per arena: A1 the camera, A2 the river and T1's timed 30 s run, A3 the tower reacting to T3.
3. [S] One elevated route per arena (ramps + 1.1 m steps) so height and jump matter.
4. [M, game/combat owners] The takedown before L2/L3 content; a behind-the-back approach per warden. If it slips, cut wardens.
5. [M] L2 and L3 as one arena + finale each with their own shape and twist (archive stacks with a top level; firewall ring),
   2-3 gates on one side as a combat front, bot-checked before the 10-08 freeze.

**Status (2026-10-05, the rebuild).** Top 5 item 1 done: L1 rebuilt (56 x 60), 3 checkpoints with C1 in P1 ([27,24]), quiet path ~120 cells (was 201),
quiet bot 8/8 208-263 s, 0 alarms; the loud bot 6-7 of 8, 130-220 s. P2, T2, cam3, drone0, drone2, warden4 and sensor2 are cut; A1's drone is cut too. One
identity per arena (A1 the camera and a lane, A2 the river and T1's timed run, A3 the vault camera and posted warden 3). One elevated route per arena
(A1 the east terrace, A2 the high bridge, A3 the high road). Firewall per arena and a stealth primer added (DESIGN section 4). Measured: A1 ~22% ever
watched, A2 ~50%, A3 ~25%. Open: the loud bot is not slower than the quiet one (the Breaker pays two lockdowns; A1 has no wall), A2 is above the 50% target.
