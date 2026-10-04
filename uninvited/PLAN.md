# Uninvited - build plan

Deadline **2026-10-12 21:00 UTC**; we submit on the **morning of Sun 10-12**. Today is Sat 10-04 (evening).
The design is `DESIGN.md` (no open questions). This plan says **what is built, in which order, and what the designer does**.
Every evening the question is: **can someone play it from start to finish right now?** If not, that is the next task.

Already done (day 1): the design, concept art and story stills, 111 sound effects, the 2.5D first-person room test
(`tests/room-fp/`), the hero (H10), the network look (NN1), key art and the itch cover.

---

## 1. Architecture

The game lives in `uninvited/` next to the docs, as `uninvited/AGENTS.md` lists. The rules are those of `../first-games/AGENTS.md` section 4.

```
uninvited/
  index.html  main.ts  config.json      entry, wiring, every balance number
  core/                                  pure TS: no three, no rapier, no DOM; deterministic (time and seeded random come from outside)
    state.ts        what exists: run (level, checkpoint, ending counter, May points, upgrades), player, enemies, devices, alarm, hack session
    commands.ts     tick(dt, intent), interact, attack, switchMode, useAbility, scan, hackPick, chooseUpgrade, ... -> events
    queries.ts      read-only questions for the view and the HUD
    rules/          movement intent, detection (cones, noise, sensors), cameras, drones, turrets, alarm, combat, abilities,
                    network vision, hacking mini-game (generator + solver), checkpoints/saves, progression, ending counter and hero color
    ports.ts        the World port the core asks: moveCharacter(), lineOfSight(), overlap() - so the core never sees Rapier
    level.ts        the level data types
  adapters/         physics-rapier.ts (implements the World port), storage.ts (localStorage saves)
  view/             three.js: corridor builder (living lines), hero, drones, cameras, lasers, fx, post, HUD, scan overlay,
                    hack UI, May's dialogue, upgrade screen; scenes/: menu, prologue (2.5D), room (2.5D, from tests/room-fp), ending
  input/            keyboard + mouse (pointer lock) -> commands
  audio/            sfx player (audio/sfx), music player with crossfades
  levels/           l1.ts, l2.ts, l3.ts - hand-made levels (format below)
  texts/en.json     every line of text: May, notes, letters, news, prologue, endings, UI
  scripts/          check-layers.ts (copied from snake and adapted), build-itch.ts
```

- **Tests** (`bun test`, mandatory for `core/`): every command and rule; the hack generator is checked on 10 000 seeds (always solvable);
  a fake World (flat floor + boxes) stands in for Rapier.
- **Layer linter:** `core/` must not import three, rapier, `view/`, `input/`, `adapters/`.
- **Frame loop:** no allocations and no async in the hot path (pools, reused vectors) - checked in review.
- **Level format** (fast to write by hand and to build in parallel): an ASCII floor plan per level on a 2 m grid
  (`#` wall, `.` floor, `^`/`v` ramp, `~` low cover, `=` laser grid, `D` door/red wall, `T` terminal, `C` checkpoint, `A` artifact...)
  plus a list of entities with grid positions (camera kind and sweep, drone patrol path, sensor, turret, spawn points for waves, May's lines).
  The view turns the grid into **rounded corridors with continuous light lines** (no boxes), with height steps so levels are not flat.
  A debug top-down map (key M in dev builds) shows the layout and cones.
- **Build:** `bun build` with relative paths -> `dist/uninvited/`, zipped for itch (`index.html` at the root). Not on GitHub Pages (the jam wants itch).

## 2. Days

### Day 2 - Sun 10-05: the core on one corridor (vertical slice)
Goal: one corridor, 2-3 minutes, passable **quietly** and **by force**, with the real architecture.
- Project skeleton: folders, config, layer linter, tests, level format + the first corridor in it, Rapier adapter, scene flow stub.
- Player: walk / run / crouch toggle / jump / dash, slower and more human than the spike; third-person camera with collision.
  Placeholder body (a capsule with neon lines) until the hero model lands.
- Security: video camera (sweep pattern, cone), sound camera (hears noise), motion sensor (visible only in network vision),
  drone patrol (suspicion -> alert -> chase/shoot -> search), laser grid, a red wall opened from a terminal.
- Alarm 1-2-3: 1-2 decay after a while, 3 brings waves and does not decay.
- Gunblade: sword mode (180° arc) and rifle mode (spread cone, charges), Q / mouse wheel; HP, death, checkpoint, "load save / restart level".
- Network vision (Tab): shows sensors and links; cooldown; held too long -> alarm.
- Hacking mini-game v1 (core + a plain UI): grid, alternating row/column, 1-2 hidden codes, time penalty and the wrong code marked, timeout -> alarm +1.
- Done when: the designer passes the corridor both ways and says how each feels.

### Day 3 - Mon 10-06: the hero, May, abilities, the loop
- **Hero model H10** (in parallel, a separate agent): Quaternius CC0 base character + the Universal Animation Library (CC0) in Blender,
  scripted: hood, coat with filament hem, visor strip, white neon lines (color driven by the ending counter), the gunblade with two modes.
  Clips: idle, walk, run, crouch-walk, jump, dash, sword slashes, shoot, hit, death. Exported as one glb.
- **May:** dialogue box with her icon (M1/M2), beep voice, subtitles; her lines from `texts/en.json`; she refuses on the middle level.
- **Abilities + upgrades:** points per checkpoint; Breaker (charges, shield/regen, turret) and Hacker (pause camera, take over a sentry,
  distraction signal + three passives); keys 1-4; the upgrade screen at checkpoints.
- **The scene flow:** menu -> room -> level -> room, saves in localStorage. The room comes over from `tests/room-fp/` into `view/scenes/room`.
- Done when: the loop menu -> room -> corridor -> room works.

### Day 4 - Tue 10-07: level 1 + the prologue + music
- **Level 1 (Jim's computer):** the tutorial, the first red wall, meeting May at a terminal, basic stealth and hacking, three checkpoints,
  the artifact = Jim's framing notes.
- **Office prologue (2.5D, first person):** O4 plate + the POV stills (Jim at the door, Jim speaking, Steve looking away, carrying the box,
  the gate closing), parallax and depth like the room, beep voices + subtitles, music. Two or three new POV stills (~$0.2).
- **Music** (Lyria via OpenRouter, ~$1-2): menu, office, room, hacking, two tracks per level, waves, two endings.
- Done when: prologue -> room -> level 1 -> room plays through.

### Day 5 - Wed 10-08: levels 2 and 3, the endings - **feature freeze in the evening**
- **Level 2 (employees' data)** and **level 3 (security core)** built in parallel (two agents) from the level format.
  Level 2: May refuses twice, quiet detours; findings (firing spreadsheet, Jim's unsent transfer request). Level 3: the Top's letters,
  Jim's fresh notes, waves under alarm 3, the firewall drops at the very end.
- **The room between levels:** the delivery (after L1), the layoff news (after L2), the parcel (finale).
- **The encounter with Jim** (lagged CCTV stills S1-S6 + text) and **both endings** by the counter (4+ of 9 -> sad).
- Evening: the full game plays start to finish. New ideas go to `IDEAS.md` from here on.

### Day 6 - Thu 10-09: the build and other eyes
- Upload to itch as a draft; check on another PC and a weak laptop.
- There are no outside testers (none came for snake either). Instead: the designer plays the whole game once "cold", start to finish,
  without the agent's notes, and writes where they got stuck or bored; the agent adds a scripted smoke playthrough of every scene.
- Optional: post the draft in the jam's community tab and the GameDev.tv Discord playtest channel - jam participants trade plays there.

### Days 7-8 - Fri 10-10, Sat 10-11: polish
- Juice: hit-stop, shake, sparks, glitches when something breaks, transitions; a sound for every action.
- Balance: the first minute is easy; both paths doable; per-level numbers.
- The itch page: KA3/K3, screenshots, a GIF, the text from DESIGN section 1, controls, the credits list from `CREDITS.md`.

### Sun 10-12 morning UTC: submit. After that only bug fixes.

## 3. What gets cut first if we are late

In this order: the "take over a sentry" ability -> turrets -> sound cameras -> real voices -> the second track per level ->
level 3 shrinks to its finale. Never cut: the prologue, the room, the two endings, the hacking mini-game.

## 4. What the agent needs from the designer

| When | What |
| --- | --- |
| Every task | Play it and say what feels wrong (on your PC with a real GPU). |
| Day 2 evening | Pass the slice both ways; say which path is boring. |
| Day 2 | Download the Quaternius CC0 packs (Universal Base Characters, Universal Animation Library 1 and 2) into Windows Downloads. |
| Day 3-4 | Texts (agreed): the agent drafts every line (May, notes, letters, news, prologue, endings) into `texts/en.json` from the story in DESIGN; you edit. The game is in English. |
| Day 4 | Levels (agreed): the agent proposes each layout (ASCII map + a top-down picture); you approve or redraw. Level 1 on day 4, levels 2 and 3 on day 5. |
| Day 4 | Music: approve the style prompts (Ghostrunner-like darksynth). |
| Day 6 | Play the whole draft once "cold" and write where it stuck or bored; optionally post it in the jam community. |
| Day 8 | Fill in the retrospective in `NOTES.md` and a row in the journal after release. |

## 5. Budget

OpenRouter: $3.71 spent of $10 (the key expires 2026-10-11). Left for: music ~$1-2, the prologue POV stills ~$0.2,
small rerolls. Everything else (models, animations, sounds) is free or made by our own code.
