# Producer guide - Uninvited

The producer (jam strategist, with a technical director's eye) owns **whether the game ships, whole, on time, and loads on a
judge's machine**. That covers the day plan, the cut order and the feature freeze, the risk list, the performance budget, the
itch build and page, credits and licences, and how the humans and agents split the work. Files touched: `PLAN.md` (the day
plan and cut order), `CREDITS.md`, `package.json` scripts (build, check, a future `scripts/build-itch.ts`), the
`view.*` performance numbers in `config.json` (`pixelRatioMax`, `bloom`), `view/perf.ts` (the F3 overlay),
`core/save.ts` (save versioning), and `dist/uninvited/`. Deadline: **2026-10-12 21:00 UTC**; we submit the morning of 10-12.

## Principles

- **Score on the categories that are judged.** GameDev.tv Halloween Jam 2026 rates 1-5 on Fun, Theme, Aesthetics, Music,
  Sound, Mechanics, Story (past jams added Overall). Three of seven (Music, Sound, Story) are content, not gameplay: a finished
  story with music outweighs more polished combat. Using the theme in the design "boosts your score". Fixes after the deadline
  are allowed if the original stays visible and marked. -
  [GameDev.tv Halloween Jam 2026](https://itch.io/jam/gamedevtv-halloween-jam-2026),
  [GameDev.tv Jam 2025 rate page](https://itch.io/jam/gamedevtv-jam-2025/rate/3570307)
- **The theme is judged, not the genre.** The theme is "Uninvited". It has to read in the first minutes: on the itch page,
  in the prologue and in May's first line, not only at the end. - same jam page
- **Draw calls are the first budget in three.js.** Aim for ~100 per frame; above ~200 optimise. Instancing or batching cuts
  90%+; small textures (KTX2); trim post effects on weak devices; dispose what you drop. -
  [100 Three.js Tips That Actually Improve Performance (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips),
  [How do you optimize three.js performance for mobile devices](https://digitalstrategyforce.com/journal/how-do-you-optimize-threejs-performance-for-mobile-devices/)
- **itch HTML5 rules.** A zip with `index.html` at the root (a nested one will not load), relative paths, the viewport size
  set on the page, the Fullscreen button ticked. - [itch.io HTML5 docs](https://itch.io/docs/creators/html5),
  [Publishing on itch](https://abratabia.com/publishing-web-games/publishing-on-itch.php)
- **Pointer lock and fullscreen depend on the parent iframe.** Handle a refusal gracefully. -
  [Iframe embedding games](https://app.cinevva.com/tutorials/iframe-embedding-games)
- **Cut early, timebox every feature.** Sort into must / should / could / won't; give each feature a time limit. -
  [The Best Workflow for Cutting Game Features](https://www.wayline.io/blog/best-workflow-cutting-game-features),
  [Solving scope creep in your first game jam](https://www.wayline.io/blog/solving-scope-creep-first-game-jam)
- **Playtest early and often**, even five minutes. -
  [Indie Dev Stories: Focused Scope](https://www.wayline.io/blog/indie-dev-stories-focused-scope),
  [Post Mortem for Spooky 2D Jam '21](https://loonworks.itch.io/this-old-haunt/devlog/307875/post-mortem-for-spooky-2d-jam-21)
- **Reviewer's experience (no source):** always keep an end-to-end playable build; freeze features 2-3 days before
  submission; judges play 5-15 minutes, so the first 2 minutes and the ending decide the score; it must load fast.

## Decisions for Uninvited

DESIGN.md is the source of truth. Where the 2026-10-04 review disagrees with it, DESIGN.md wins and this guide follows it.

- **Length: a ~20-minute game** - about 5 minutes per level and about 5 minutes for all real-world scenes together; L1 is
  cut down to fit (DESIGN 6, "Length changed"). This replaces PLAN's 8-15 minute levels and the review's "L2/L3 short".
- **Theme without Halloween dressing** - no pumpkins, ghosts or Halloween palette; the story carries "Uninvited" (DESIGN 14).
  The review agreed.
- **May's tree is small** - 2 actives (pause a camera, a distraction signal) and 3 passives (shield/regen, more charges, more
  hack time), each costing points; "take over a sentry" and the helper turret are **cut** (DESIGN 10). The review asked for
  "2 skills only"; the designer kept 2 + 3 passives.
- **Waves stay big (4-15+)** - the designer's requirement (DESIGN 8, 9). The review's cut "4-15 -> 4-8" is **overruled**; the
  pressure is made fair with attack tokens instead (`config.tokens`: bite 3, melee 1, ranged 2). If FPS fails, lower the
  concurrent caps (`worm.max` 24, `drone.maxExtra` 10), not the design.
- **Turrets** - one type, ET1, sparingly: L1's core arena and the L3 finale (DESIGN 8).
- **Endings** - an explicit choice in L3, quiet endings; the counter is pressure, not the verdict, and no longer cascades
  (DESIGN 4). Already in `core/rules/progress.ts`.
- **Non-lethal takedown** from behind a warden with E (DESIGN 8) - decided, not built yet.
- **Music** - Ghostrunner-like darksynth, generated (DESIGN 13). The music system already layers stems in one tempo and key
  (`tools/music/build.ts`: 120 BPM, D minor; placeholders `net_calm`, `net_tension`, `net_combat`).
- **Build** - `bun run build` -> `dist/uninvited/`, zipped for itch with `index.html` at the root; never through the
  GitHub Pages workflow (that one serves `first-games/`).
- **Budget** - OpenRouter $10, key expires **2026-10-11**: every generated asset must be in the repo before then (PLAN 5).

## Rules of thumb and metrics

### The day plan, 10-05 .. 10-12 (for the ~20-minute game)

The evening question every day: **can someone play it from the menu to an ending right now?** If not, that is the next task.

| Day | Goal | Done when |
| --- | --- | --- |
| Sun 10-05 | The **skeleton flow** with stubs: menu -> prologue stub -> room stub -> L1 -> room -> L2 stub -> L3 stub -> choice -> ending. Cut L1 to ~5 min. Combat feel timeboxed to the afternoon. Draft all story text (~1200 words) into `texts/en.json`. Generate the music. | A stub run reaches an ending; the designer has the text to edit. |
| Mon 10-06 | Prologue (office 2.5D) and the room ported from `tests/room-fp/`; May's dialogue box; the upgrade screen (2 actives + 3 passives with costs); the takedown. **First itch draft** (restricted). Quality preset Low/High; draw-call count in F3. | Draft opens on itch with pointer lock, sound after the first click and fullscreen working. |
| Tue 10-07 | L2 and L3 in parallel (two coding agents), ~5 min each, 1-2 arenas; layouts approved by the designer in the morning. L3 holds the explicit choice and the ET1 finale. | Both levels pass with the bot, quiet and loud. |
| Wed 10-08 | The rooms between levels (delivery, layoff news, parcel), the Jim encounter screen, both quiet endings. **Feature freeze in the evening**; new ideas go to `IDEAS.md`. | The whole game plays start to finish in ~20 min. |
| Thu 10-09 | The designer plays **cold** once, timed, screen recorded. Bot runs on every level (time, deaths, FPS). Chrome, Firefox, Edge; a weak laptop or integrated GPU. Draft in the jam community tab / GameDev.tv Discord. Bug list P0/P1/P2. Save format and config keys frozen from now on. | A ranked bug list exists. |
| Fri 10-10 | P0/P1 only; balance of the first 2 minutes; juice (hit-stop, sounds); the itch page (cover K3, 4-5 screenshots, a GIF, text, controls, credits). | Page complete in draft. |
| Sat 10-11 | Release candidate in the morning; a second full run; the checklist below; afterwards only blockers. Evening: freeze, archive the zip, tag in git. The OpenRouter key dies today. | RC zip archived and tagged. |
| Sun 10-12 | Upload in the morning, check in a private window, **submit by 12:00 UTC** (9 h buffer). After that only marked bug fixes. | The game shows in the jam's entries. |

Time budget for a first-time player: prologue ~1.5 min, room visits ~0.5 min each (4 visits), Jim encounter + ending ~1 min;
L1, L2, L3 ~5 min each. If a level runs over 7 min in the cold playtest, it shrinks.

### Cut order (if we are late)

In this order: sound cameras -> turrets down to the L3 finale only -> the second music track per level -> real voices
(keep the beep voice) -> L2 down to one arena -> L3 down to its finale arena + the Top's letters. Already cut by the designer:
take over a sentry, the helper turret, Halloween dressing.
**Never cut:** the prologue, the room, the explicit choice and both endings, the hacking mini-game, music for the four main
states (menu/room, calm network, combat, hacking).

### Performance budget

| Item | Target |
| --- | --- |
| Draw calls, average gameplay frame | **< 150** (reference ~100; > 200 is a bug). Measured 250-500 at review time. |
| Frame rate | 60 fps on a mid GPU; stable **>= 30 fps** on integrated graphics with the Low preset |
| Pixel ratio | `view.pixelRatioMax` 1.5 (High); 1.0 or 0.75 (Low) |
| Low preset | no bloom, no floor reflection, lower pixel ratio, shorter far view; auto-drop to Low when F3 shows < 30 fps for ~3 s |
| Static geometry | instanced or merged (slabs, hex columns, cover); no one-mesh-per-cell |
| Hot path | no allocations, no async in the frame loop (PLAN 1) |
| Enemies at once | caps in config (`worm.max` 24, `drone.maxExtra` 10); audio voice limit and a limiter on the master bus |
| Download | ~15-20 MB total; compress glb (meshopt/Draco), music as low-bitrate mp3; a loading screen with progress |
| Time to play | < 10 s from page open to the menu on an average connection |

Measure with F3 and `renderer.info` before and after every optimisation; never optimise by eye.

**The benchmark** (`?bench=<scenario>`, `view/bench.ts`; CLI `bun tools/bench.ts`, see README) is the measuring tool. Scenarios:
`idle`, `scan` / `scan-walk` / `scan-still` / `scan-off` (the hero on arena 2's bridge holding network vision, see below), `wave` (the biggest wave: 15 worms, drone, 2 wardens, heavy; a scripted hero fights it), `fx` and `fx-<category>`
(synthetic bursts of every effect with the real handlers and sounds), `soak` (wave on repeat, 5 min), `all`. The F3 overlay shows
its progress. **Pass thresholds** (real GPU, High preset, 1080p): p95 frame < 20 ms, p99 < 33 ms, nothing over 50 ms after the
first 2 s, JS p95 < 8 ms, `soak`: zero growth (geometries, textures, programs, scene objects, audio voices; heap flat within
25%), pool sizes unchanged (`core/waves-bounded.test.ts` guards the core side), `allocKB` < 100 KB per frame (see below),
`fx-*` p95 within +4 ms of `idle`. Any category that fails its threshold is the place to look.

**As built - the fight FPS drops (2026-10-05).** Method: headless Chrome (software GL, a loaded 24-core box, so only counts
and trends count), l1, `?bench=soak` 180 s with a scripted hero fighting looping waves, plus CPU and heap-sampling profiles.
- *No leak.* Over 180 s geometries/textures/programs/scene objects are constant, the heap is flat (45-53 MB), the state pools
  never change size, audio voices stay under the limit (the effect pools in `view/fx.ts` and the worm/drone rigs are fixed).
- *Cause 1: first-use compiles and uploads.* three compiles a program and uploads geometry/textures the first time a mesh is
  drawn. Before: 4 programs, 14 geometries and 1 texture appeared during play (the first warden of a wave builds its rig and
  compiles its skinned materials mid-fight: a 280-600 ms JS stall in the log at wave start; new areas and effects did the same).
  Fix: `GameView.prewarm()` draws one frame with everything shown (lights untouched: their count must never change) once the
  warden models are loaded, after `WardenViews.warm()` built the sentinel and heavy rigs of slot 0. After: 0 first-use events in
  play, all 95 programs / 283 geometries / 56 textures exist before the first frame. `?nowarm` restores the old behaviour for A/B.
- *Cause 2: GC churn from three's program lookup.* A transparent double-sided material is drawn in two passes and bumps its
  version twice per object per frame, so ~130 glows (cones, rings, tracers, flashes, beams) re-derived their program parameters
  and cache keys every frame (CPU-profile allocation top: `getParameters`/`join`). Fix: `forceSinglePass` for transparent
  double-sided materials that are additive or depth-less (same look; also removes the back-face draw). Version-bumping materials
  31 -> 2, draw calls 738 -> ~700 in a wave. The rest of the garbage (about 450 KB per frame, a young-gen GC every ~1 s; that is
  three's per-object program check for materials shared by skinned and plain meshes or flipping light state between the mirror
  and main pass) is NOT fixed - next candidates: separate materials per mesh kind in the hero/warden rigs, one light set for
  the mirror pass (`light.layers.enable(1)` - tested: same picture, no measurable change in garbage, so not the main source).
- *Not a bug, but it reads as stutter:* hit-stop freezes the sim 40-70 ms per hit/kill; 5% of the frames of the scripted wave
  were frozen (`hitstop%` in the table). If the designer still feels periodic hitches on a real GPU, try `reduceFx` first.
- *Open:* 600-730 draw calls per frame (main ~550 + floor mirror ~175; budget 150) is the biggest GPU-side cost and the first
  thing to cut (merge city props, drop small meshes from the mirror, or lower the mirror's cost on the Low preset).
- **Network vision while moving (2026-10-05, designer: "the frame rate drops hard on the L1 bridge with Tab held").** Method: the
  `scan*` bench scenarios, `--profile`, `--alloc`, a micro-benchmark of `sight.ts` and fragment counting of the cone volumes (additive 1/255
  per fragment). What it is NOT: the sight fans (0.04 ms per camera fan, 0.015 ms per drone or warden fan, at most 20 per second each: well
  under 1 ms a frame for 32 devices), the DataTexture upload (6 KB), the netvision links / routes / rings (a handful of draws, no
  per-frame geometry), or fill (the 32 cone volumes cover 18% of the screen at 960x540 with 1.5 overdraw). The CPU profile of `scan` and
  `scan-still` is flat and the same as `idle`'s (three's draw submission). What was found and fixed:
  1. *The floor mirror pass saw other lights than the main pass.* Hemisphere, hero key / rim and muzzle lights were on layer 0 only, the
     lanterns on 0 and 1; the mirror camera draws layer 1, so three re-resolved (and re-hashed, with allocations) the program of every lit
     material twice a frame, and compiled two programs for each. Fix: every light on both layers (`game-view.ts`). Programs 152 -> 103,
     `getParameters` + `join` garbage -35%, alloc 921 -> 777 KB/frame (idle), 1110 -> 971 (scan). The reflection looks the same.
  2. *The view cones were drawn in the mirror pass as well* (they hang on drone / warden / camera rigs that are marked reflective): an
     additive xray volume per device, twice. Now `noReflect` (`cone.ts`): the mirror pass lost 6 draw calls with Tab held (127 -> 121,
     the same as without Tab); a full frame with Tab 354 -> 346 calls.
  3. *Everything was fanned and drawn whether in view or not.* The floor shader has 10 cone slots (`MAX_CONES`) filled in device order, so
     far cameras took the slots of the near wardens. New `view/cull.ts` (frustum of the last frame, padded 3 m): cones, floor fans and
     sight fans are skipped for devices out of view (cameras no longer cast fans at all without Tab).
  4. *Sight recasts are capped per frame* (`view.cones.recastsPerFrame` 3; forced recasts - a turn past the margin, a new range, a wall
     moving - always go), so a crowd of moving devices cannot recast in one frame.
  Still open: the hero's and the wardens' skinned `Armor` / `ArmorLines` / `Coat` materials re-resolve their program every frame
  (about 40 `getProgram` calls a frame, found by wrapping `customProgramCacheKey`; it is the rest of the `getParameters` garbage): look at
  `view/hero.ts` / `view/wardens.ts` (the same material on plain and skinned meshes, or a per-draw change that bumps its version). Not
  reproduced here: a hard drop on a real GPU (this box's software GL is too noisy: the same scenario varies +-40% run to run), so the
  designer's machine is the check: F3 with and without Tab on the bridge, then `?bench=scan` and `scan-off`.
- Headless frames show a ~2 s stall every few seconds even in `idle`: a software-GL artifact, not the game.

### Working rules

- Every feature gets a timebox in the morning; when it runs out, ship what is there or cut it.
- A save has a version (`core/save.ts` already rejects other versions); wrap storage in try/catch; a "reset save" button.
- A `webglcontextlost` handler with a friendly message.
- CREDITS.md gets a row the moment an asset or AI tool is used.

## How we work

- **The designer decides.** Every design question goes to the designer; the agent proposes and marks open points with ❓
  in DESIGN.md. The designer plays every task on a real GPU and says what feels wrong.
- **Opus agents plan and analyse**: designs, level layouts, reviews, cut and risk calls, plans for coding tasks.
- **Sonnet agents code and review**: implement from a plan, run `bun run check` green, review each other's diffs.
- **DESIGN.md is the source of truth** for the code. The designer edits `DESIGN.ru.md`; the agent carries every change into
  `DESIGN.md` the same day and keeps it in sync with what is built ("as built" notes).
- **Language:** everything in the repository is English (code, comments, commits, docs); chat with the designer is in Russian.
- **Commits** only when the designer asks.

## Review 2026-10-04

### Strengths

- A strong narrative frame (office, room, two endings), 111 SFX, key art and the cover already exist: Story, Sound and
  Aesthetics have a base.
- Discipline: a pure-TS core with tests, `bun run check`, a headless bot (`tools/slice-bot.ts`, routes per level), the F3
  overlay, `?nolock`. This keeps agent work at night from breaking things.
- PLAN already has a cut order and a "never cut" list; the designer plays and gives precise feedback.
- A coherent art target (NN1, NF6, H10).

### Problems, ranked by impact

| # | Problem | Status |
| --- | --- | --- |
| 1 | No end-to-end run (menu -> prologue -> room -> L1-L3 -> ending); only L1 and the slice exist, ~2 days behind PLAN | **open** - top priority 10-05..10-08 |
| 2 | Performance on weak GPUs: 250-500 draw calls, bloom, reflections | **in progress** - pixel ratio capped at 1.5, F3 overlay, instancing in the city; no Low preset or auto-drop yet |
| 3 | Endless L1 polish (enemies look bad, waves weak) | **decided otherwise** - L1 cut to ~5 min; enemy looks chosen (EM1, EW1, EW2, ET1); waves kept big with attack tokens (done in config) |
| 4 | Pointer lock / fullscreen inside the itch iframe | **open** - test on a draft on 10-06 |
| 5 | WebGL context loss and browser differences | **open** |
| 6 | Download size 15 MB; a stale `index-*.js` sits next to the fresh one in `dist/uninvited/` | **open** - clean `dist` before each build; compress glb; loader with progress |
| 7 | Save corruption between builds | **in progress** - versioned saves done; reset button and freeze of the format pending |
| 8 | No outside testers | **open** - cold run 10-09, bot, Discord/community |
| 9 | Music not generated; key expires 10-11 | **in progress** - music system and placeholder stems built; real tracks pending |
| 10 | No itch zip script (`scripts/build-itch.ts` from PLAN is missing) | **open** |
| 11 | Licences and AI disclosure | **in progress** - CREDITS.md kept current |
| - | Wave size cut 4-15 -> 4-8 | **decided otherwise** (DESIGN 8: 4-15+) |
| - | May with 2 skills only | **decided otherwise** (2 actives + 3 passives, DESIGN 10) |

### Top-5 recommendations (updated)

1. **(L) End-to-end playable by the evening of 10-08**, even with rough L2/L3 and stub text. Combat and enemy polish outside
   that is timeboxed. Now sized for ~20 minutes, which makes it reachable.
2. **(M) Performance before the freeze:** merge/instance the static city, a Low/High preset with auto-drop from the F3
   metric, switchable bloom, pixel ratio <= 1.5. Target < 150 draw calls; 60 fps mid GPU, >= 30 on integrated.
3. **(S) An itch draft on 10-06:** iframe, pointer lock, fullscreen, loading, sound after the first click, size.
4. **(M) Music and sound first among content** (3 of 7 categories): one strong track per main state beats one more enemy.
   Generate everything before the key expires on 10-11 - in practice by 10-07.
5. **(S) Robustness:** save reset button, try/catch around storage, a WebGL context-lost handler.

## Release checklist

1. Fresh build from an emptied `dist/uninvited/` (no stale `index-*.js`); `bun run check` green.
2. Zip with `index.html` at the root and relative paths; unzipped into a clean folder and run through a plain http server.
3. itch: kind "HTML", "played in the browser", viewport 1280x720, Fullscreen button on.
4. Played on the itch draft page in Chrome, Firefox and Edge (Safari if possible) with no console errors.
5. Pointer lock works in the iframe; "Click to play" prompt; a sane fallback when the lock is refused.
6. Sound starts after the first click; music and SFX volume sliders work.
7. Loading screen with progress; total size ~15-20 MB; menu within 10 s on an average connection.
8. Low preset reachable from the menu; the page text says "enable hardware acceleration" for laptops.
9. Page: cover K3 (630x500), 4-5 screenshots, a GIF, the pitch from DESIGN 1, controls, the theme "Uninvited" named.
10. Credits and licences from CREDITS.md on the page (Quaternius CC0, AI images and music, fonts); AI content disclosed.
11. Submitted to the jam, project public, link checked in a private window, the game appears in the entries list.
12. Zip archived and the commit tagged.

## Don'ts

- No Halloween dressing; the theme comes from the story and the pitch.
- No new levels or mechanics after the freeze on the evening of 10-08; ideas go to `IDEAS.md`.
- No remodelling enemies because they "look bad" late on: recolour or change the silhouette.
- No changes to the save format, config keys or level structure after 10-09.
- Do not touch the GitHub Pages workflow for itch; zip by hand or with a separate script.
- Do not optimise by eye: measure F3 and draw calls before and after.
- Do not leave the draft upload or the cold playtest for 10-11.
- Do not shrink the waves to save time - that is the designer's call; tune tokens and caps instead.
- Do not spend OpenRouter credit on rerolls before the music is done.

## Review 2026-10-05

Note: 2026-10-05 is a **Monday** (the day plan above and PLAN.md are one weekday off); the team works in UTC+8, so the
deadline is 10-13 05:00 local and the OpenRouter key dies 10-11 14:03 local. Designer feedback this day: shooting and hits
feel artificial, the detours are boring, everything is monotonous - the plan below makes room for that first.

### Status of the 10-04 items

| # | Item | Status |
| --- | --- | --- |
| 1 | End-to-end run | **open** - no scene flow, no prologue/room/L2/L3/endings in the game, 0 words of story text |
| 2 | Performance | **partly** - pass in progress, bench tool built; bench shows 520-735 draw calls on L1 (budget < 150); no Low preset |
| 3 | Endless L1 polish | **partly** - L1 built, but not shrunk: bot quiet route 377-393 s (budget ~5 min for a human) |
| 4 | Pointer lock in the itch iframe | **open** - no draft yet; a refused lock is handled |
| 5 | WebGL context loss | **open** |
| 6 | Size / stale dist | **partly** - fresh build 18 MB, 129 files, relative paths; `dist/uninvited/` still holds stale duplicates; no load progress |
| 7 | Saves | **partly** - versioned, storage in try/catch; no reset button |
| 8 | Outside testers | **open** (cold run 10-09) |
| 9 | Music | **fixed** - 10 Lyria tracks approved and credited |
| 10 | itch zip script | **open** |
| 11 | Licences | **fixed** - CREDITS.md current |
| - | Uncommitted work | **new, high** - 38 modified + 18 untracked files incl. the approved music; `bench/results/` not ignored |

### Cut list applied now (to fund the feel days)

The designer's 10-05 feedback (shooting/hits artificial - reference modern Doom; detours are empty corridors; lanes unclear,
guards fast and everywhere; monotonous) gets 10-05 and 10-06 as feel days, in parallel with the flow skeleton. Paid for by:
May's upgrade tree and points -> after the jam, with the **distraction ping as her fixed gift at T0** and the camera-pause
active cut (designer to confirm); ET1 turret cut; L2 = one arena, L3 = finale arena + letters (fallback: merge L2 into L3);
prologue and endings as still montages first, 2.5D office only if time remains; room = the `tests/room-fp/` port with the
specials as story cards; glory-kill lite, data lifts, establishing glance, L1 sound camera, real voices, second level track:
cut or only-if-slack (`net_calm_b` allowed until 10-08); perf timeboxed (pass closes 10-05, Low preset 10-06).
Kept: the feel pack (gunplay, hit/kill markers, stagger, impact VFX, mix), the takedown, the L1 rebuild (quiet bot <= 220 s,
one lane through each arena, drone 1.4 m/s, 3 checkpoints), arena identity, ambience. Generation closes 10-09 evening.

### Top 5 (2026-10-05)

1. **(L)** Flow skeleton + a reusable story-card screen today (menu -> prologue -> room -> L1 -> room -> L2 -> L3 choice -> ending); real scenes by 10-08.
2. **(M)** Feel before content: gunplay pack 10-05/06, stealth verbs and lanes 10-05/06, arena variety 10-07 - L2/L3 are built on 10-07 with the fixed kit.
3. **(S)** Commit the working tree today (designer's call), ignore `bench/results/`, commit every evening; one owner per file group.
4. **(M)** Perf pass closed with numbers today; Low preset, context-lost handler and the music-race fix 10-06.
5. **(S)** itch draft 10-06 through `build-itch.ts` (clean dist, zip, test lock, audio unlock, fullscreen, adaptive music).
