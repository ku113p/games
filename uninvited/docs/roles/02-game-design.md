# Game designer (systems) guide - Uninvited

The systems designer owns the rules that turn the parts into a game: the core loop, the two paths (Hacker and Breaker), the alarm
ladder, the enemy roles as rules (not as looks), the non-lethal takedown, May's progression and its point costs, the ending counter
and the ending choice, the first five minutes and the length of a session. In code this role touches `config.json` (every balance
number), `core/rules/` (`alarm.ts`, `progress.ts`, `scan.ts`, `terminals.ts`, `tokens.ts`, `shards.ts`, `wardens.ts`, `drones.ts`,
`worms.ts`, and the future abilities/upgrades rules), `core/state.ts` (`RunState`), `texts/en.json` (hints and toasts that teach a
rule), `tools/slice-bot.ts` + `tools/bot-routes.ts` (balance checks) and `DESIGN.md` sections 4, 6, 7, 8, 9, 10, 11. `DESIGN.md` is
the source of truth: where the review below says something else, DESIGN.md wins and this guide says so.

## Principles

- **Stealth state reads without UI.** The hero's visibility and each guard's awareness must be readable from the world itself, in a
  few clear steps. Source: [Mark of the Ninja's Five Stealth Design Rules (Game Developer)](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules).
- **Noise is shown as rings; ring size = loudness.** The player knows before acting whether a guard will hear. Source:
  [Klei Forums, Shadows and visual sound](https://kleiforums.com/forums/topic/171749-shadows-and-visual-sound-why-mark-of-the-ninja-is-still-the-king-of-stealth/).
- **Narrow gulf of execution, frequent checkpoints, encounter space about one screen** so the player can hold it in memory.
  Source: Five Stealth Design Rules (above).
- **A "chaos" system must not punish the most fun style.** Dishonored's good ending asks you to give up the best tools; players read
  that as punishment, not choice. Sources: [Scientific Gamer, Thoughts: Dishonored 2](https://scientificgamer.com/thoughts-dishonored-2/),
  [Game Revolution, Dishonored Review](https://www.gamerevolution.com/review/57423-dishonored-review).
- **Teach by play (World 1-1):** show a mechanic safely, give it simple, then raise the stakes; one mechanic at a time. Sources:
  [MCV, Miyamoto breaks down World 1-1](https://www.mcvuk.com/development-news/video-miyamoto-shares-his-level-design-secrets/),
  [Game Revolution, The Perfect Level](https://www.gamerevolution.com/features/362525-perfect-level-super-mario-bros-world-1-1-changed-everything).
- **Jam reality:** something interesting in the first ~15 s; a judge plays ~5 minutes; scope is the main killer; the last 25% of the
  time goes to making the game passable by a stranger. Sources: [bugnet.io, how to scope a game jam entry](https://bugnet.io/blog/how-to-scope-a-48-hour-game-jam-entry),
  [Game Developer, Make the most of your game jam](https://gamedeveloper.com/audio/make-the-most-of-your-game-jam).
- **MDA: design from the feeling down.** Target aesthetics: "a ghost hacker" and "a sword whirlwind" (Sensation, Narrative, Challenge,
  Discovery); mechanics serve them. Source: [Hunicke, LeBlanc, Zubek, MDA](https://users.cs.northwestern.edu/%7Ehunicke/MDA.pdf).

## Decisions for Uninvited

- **Core loop** (DESIGN 6, 8, 11): enter an arena at its vantage point -> Tab (network vision) to read cones, routes, sensor zones and
  terminal links -> plan -> move (crouch, wait for windows, takedown or detour) -> hack a terminal in the live world (the phase stays
  `playing`, stance kept, timeout = alarm +1) -> checkpoint -> breather passage. If seen, the alarm ladder takes over and the loop
  becomes "fight or hide".
- **Session length** (DESIGN 6, changed 2026-10-04): ~5 minutes per network level + ~5 minutes of real-world story in total = **a
  ~20-minute game**. L1 is cut down to fit (it was approved at ~4.4 slices, 8-10 min). Three levels, 3 checkpoints each = 9.
- **Two paths** (DESIGN 7): **Hacker** (stealth + hacking; any violation is punished hard) and **Breaker** (go through and break things;
  much harder: waves wear you down, the firewall drops only at the very end). The path is never closed.
- **Alarm ladder** (DESIGN 9): one incident = +1 stage, further violations within `alarm.raiseCooldownSec` 4 s only move the search.
  Stage 1: 1 searcher drone, radius 14 m, decays after 30 s. Stage 2: 2 drones, radius 40 m, plus a worm pack of 4, decays after
  45 s. Stage 3: no decay, waves only; firewall after `firewallAfterWaves` 3 cleared waves. A broken device brings a check but no stage.
  Waves (`alarm.waves`): 1 drone + packs 5+3; 2 drones + 2 wardens + packs 4+4+3; 1 drone + 2 wardens + 1 heavy + packs 5+5+4 -
  9 / 15 / 18 enemies, within the designer's "4-15+". First wave after 5 s, 6 s between waves.
- **Fair pressure:** attack tokens (`tokens`: 3 biters, 1 melee warden, 2 ranged at once) and signal shards (`shards`: heal 3 per
  shard, 15 for a big one from a 2+ kill finisher; worm 1, drone 2, warden 4, heavy 8 drops) - the Breaker's own heal loop.
- **Enemy roles** (DESIGN 8): drones watch and call, shoot very weakly (`boltDamage` 5 every 3 s, 1.0 s windup) and die in 2 rifle
  shots (`drone.hp` 40 / rifle 20); they fly out of sword reach. Wardens are the main guards and fighters (hp 200: 3 sword hits,
  8 rifle shots; strike 30 with a 0.7 s windup; bolt 14). Worms crush by mass (hp 45: one swing, 3 shots). Turrets: **one type, ET1,
  used sparingly** - L1 arena 3 and the L3 finale only.
- **Non-lethal takedown** (DESIGN 8): sneak up behind a warden, press E - an override powers it down for a while, no noise, no kill;
  it reboots later or wakes at an alarm. It does not count as a kill for the story. This is the Hacker's "aggressive" verb. *Built 2026-10-05.*
- **May's tree, simplified** (DESIGN 10): 2 actives on keys 1-2 - **pause a camera**, **distraction signal**; 3 passives - **shield/regen**,
  **more charges**, **more hack time**. Points come from checkpoints (1 each, 9 total); **every upgrade costs points so you cannot buy
  everything**. Not upgrading is a **visible rule** (shorter hack and pause), not hidden enemy scaling. Cut: "take over a sentry",
  the helper turret.
- **Endings** (DESIGN 4, changed 2026-10-04): the ending is an **explicit choice in L3** - send Jim the letter or strike at him through the
  cameras. The counter and the hero's colour are pressure along the way (May comments on it), not the verdict. Endings are **quiet**
  (peaceful: the letter, later a small parcel; sad: a knock, "a parcel for you", black screen, the empty desk). The counter **no longer
  cascades**: a checkpoint is red only if an alarm-3 wave fight happened since the previous checkpoint. `ending.sadAt` 4 of 9 now only
  scales the hero's colour (white -> red / blue).
- **Hacking** (DESIGN 11): 45 s on 5x5 to 75 s on 7x7; a mistake costs 5-7 s and resets the sequence; extra time only from May.

## Rules of thumb and metrics

- **Proposed point costs (agent's proposal - show the designer before building):** pause camera 2, distraction 2, shield/regen 3,
  charges 2, hack time 2 = **11 points for everything vs 9 earned** - a full run buys 3-4 of 5. One tier per upgrade, no ranks. The
  upgrade screen opens at every checkpoint; unspent points carry over.
- **Visible "not upgraded" rule:** without the hack-time passive the hack timer is the base value; with it +25%. Without nothing else
  hidden. Show the number in the upgrade screen ("hack time 45 s -> 56 s").
- **Pause camera:** ~8 s on one camera (terminals keep their 30 s area pause, `terminal.pauseSec`), a cooldown longer than the pause
  (~20 s) so one press never frees a whole arena (DESIGN 10: synergy, not a skeleton key).
- **Distraction:** a ping at a point within ~15 m; wardens in hearing range walk to it and search ~4.5 s (`investigateLookSec`);
  drones glance. It must not raise the alarm.
- **Takedown:** only outside the warden's front close zone (`closeDist` 1.6 m, `closeHalfAngleDeg` 60 - so from the back 240 deg),
  noise 0, ~0.6 s lock-in animation, the warden down for ~45 s or until alarm 2+. A prompt appears only when the takedown is valid.
- **Hacker vs Breaker parity check:** each arena must have a quiet line with at least one 4-8 s window per guard and safe pockets
  (DESIGN 6: guards cover 30-50%), and a loud line the bot passes on a first try (`bun tools/slice-bot.ts loud|quiet --level l1`).
- **Counter rule in code:** a `RunState` flag "alarm-3 fight since the last checkpoint" set when a wave spawns, cleared at each checkpoint;
  red = that flag, not `alarm.stage >= 3` at the moment of passing.
- **Healing:** shards in fights; **full heal at every checkpoint** (the plan in `shards.ts` says so; `progress.ts` does not do it yet).
- **First 5 minutes, measured with a stopwatch:** first input in the network <= 90 s after Start on a first run; first hack (T0) with no
  guard in range and nothing to lose; Tab taught in the first hint; one new mechanic per space (show -> simple -> combine).
- **Hint text:** one line, ~60 characters, one rule per hint (see `hint.*` in `texts/en.json`; `hint.start` packs four rules today).
- **Session budget:** L1 ~5 min (cold play by the designer), L2 ~5, L3 ~5, prologue + room visits + Jim + ending ~5. Over budget -> cut
  an arena, not a scene.

## Review 2026-10-04

**Strengths.** A rare, clear combination - stealth + hacking mini-game + gunblade - in one verb loop "look (Tab) - plan - go - hack".
Hacking happens in the live world (checked in `terminals.ts`), which gives real tension. Stealth reads well: floor cones stop behind
cover exactly where detection stops, suspicion arcs at the crosshair (amber -> red), HIDDEN/SUSPECTED labels, a TRACE bar for the scan.
The hero's colour as a visible ending meter is cheap and strong. The L1 layout has three lines into arenas, a landmark, a
passage-arena rhythm and checkpoints after arenas. Spawn gates, the drone's 0.7 s aim, the worm's 0.42 s rear-up are honest threats.

**Problems, by impact on the experience:**

1. **Scope does not fit the time** (30-35 min of play planned, prologue, room x3, music, endings, upgrades, 4 enemy types in ~7 days).
   - *Decided:* a ~20-minute game, ~5 min per level, L1 cut down. *Status: in progress* - L1 as built is still the 8-10 min layout;
     prologue, room, ending scenes are not built (`view/` has no scenes yet).
2. **The ending counter punishes fun and cascades.** Alarm 3 does not decay until the firewall, so one mistake paints several
   checkpoints red; DESIGN said "killed no one" while the rule counts only alarm 3; the sad ending reads as a Breaker penalty.
   - *Decided otherwise* for the verdict: the ending is an explicit L3 choice, endings are quiet, the counter is only pressure; the
     takedown does not count as a kill, so the "killed no one" wording is moot. *Cascade fix: decided, open in code* - `progress.ts`
     still sets `underAlarm = alarm.stage >= 3` at the moment of passing.
3. **The paths are unequal in verbs; no quiet takedown.** The Hacker has only Tab, terminals and crouch; the Breaker is a failure
   state, not a choice; sneaking up behind a warden leads nowhere.
   - *Decided:* non-lethal takedown from behind + 2 Hacker actives. *Status: takedown built (2026-10-05, E from behind, `warden.takedown`); the 2 Hacker actives (distraction key 1, camera pause key 2) built 2026-10-05.* Shards gave the Breaker its own
     reward: *done*.
4. **May's tree is a choice without choice** (9 points for 9 items; hidden scaling; no healing).
   - *Decided:* 5 items with costs, visible rule, take-over and turret cut. *Status: built 2026-10-05* (DESIGN 10 "May's progression - as built":
     1 point per checkpoint, 7 upgrades / 15 points, distraction free at T0, pause 2, shield, charges, hack time; upgrade screen with the "NOW" rules panel;
     `core/may.test.ts`). Healing: shards *done*, checkpoint full heal *done*.
5. **The first 5 minutes** (2-4 minutes of clicking before play; the first obstacle is a hack; the first hint omits Tab; ~10 mechanics
   in L1).
   - *Status: open.* The T0 hack before stealth is decided by the story (meeting May) - keep it, but make it pressure-free.
     The sound camera C2 is still in L1.
6. **Tab is the only information channel** (cones show only in network vision).
   - *Decided otherwise:* the designer keeps it (DESIGN 8). Mitigation *in progress*: lens glow + look beam, device hints mention Tab;
     a one-time forced cone reveal in arena 1 is *open*.
7. **Enemy roles blur on screen; drone hp 80 vs "1-2 shots".** *Done:* `drone.hp` 40. Turrets: the reviewer said "do not start" -
   *decided otherwise*: one ET1 type, sparingly (*open* in code).
8. **No risk/reward inside an arena** (no optional goals, the Hacker's reward arrives after 30 min). *Status: open.*

**Top-5 recommendations, updated:**

1. Cut to a short whole game (**M**, a decision first). Superseded by the designer's ~20-minute target; what remains is cutting L1 to
   ~5 min and keeping L2/L3 to 1-2 arenas.
2. Fix the counter cascade (**S**) - one red per segment, flag set by a wave fight since the last checkpoint. The rest (threshold,
   "killed no one", redemption) is no longer needed because of the explicit choice.
3. Give the Hacker real verbs (**M**): distraction, camera pause, non-lethal takedown (the reviewer proposed an instant kill; DESIGN
   chose a non-lethal override). Do not start "take over".
4. May's tree with costs and a visible rule (**S-M**) + full heal at checkpoints (**S**).
5. Fix the first 5 minutes (**M**): prologue + room <= 60-90 s on the first run with Skip; only the headset active in the room before
   L1; a pressure-free first hack; the first hint about Tab; move C2 (sound camera) to L2.

## Release checklist

- [ ] The full chain menu -> prologue -> room -> L1 -> room -> L2 -> room -> L3 -> choice -> ending plays in ~20 minutes (stopwatch, cold).
- [ ] A checkpoint is red only after an alarm-3 wave fight since the previous one (core test for one long alarm across 2 checkpoints).
- [ ] The L3 choice is explicit and works with any counter value; May comments on the counter at least once per level.
- [ ] Every L1-L3 arena passes quietly and loudly by the bot; the designer passes each once both ways.
- [ ] Takedown works only from behind, makes no noise, the warden reboots, and the story never counts it as a kill.
- [ ] May's upgrade screen: costs visible, 9 points cannot buy everything, the "not upgraded" numbers are shown.
- [ ] Full heal at each checkpoint; shards heal in fights; death offers load / restart.
- [ ] First network input <= 90 s after Start; the first hint mentions Tab; T0 hack cannot fail into a fight.
- [ ] Every number cited in DESIGN matches `config.json` (drone 2 shots, hack 45-75 s, waves 4-15+).
- [ ] FPS holds during wave 3 (18 enemies) on the Low preset.

## Don'ts

- Do not let the ending be decided by one mistake: no cascades, no hidden verdicts; the choice in L3 is the verdict.
- Do not add hidden difficulty scaling for an un-upgraded path - only visible, numbered rules.
- Do not bring back "take over a sentry", the helper turret, a second turret type or a third Hacker active after the feature freeze.
- Do not teach two mechanics in one space or in one hint; do not put the first fight before the first safe look at a guard.
- Do not make the takedown a kill or give it noise - it is the Hacker's non-lethal tool.
- Do not let one camera pause or one terminal free a whole arena (DESIGN 6: arenas need two things at once).
- Do not change a balance number in code - only in `config.json`, and update DESIGN.md if the behaviour changes.
- Do not add Halloween dressing to rules or texts; the theme is "Uninvited" and the story carries it.

## Review 2026-10-05

**Status of earlier items.** Counter cascade: **fixed** (`alarm.ts` sets `segmentFight` on a wave spawn, `progress.ts` reads and clears it).
Checkpoint full heal: **fixed**. Drone hp 40: **fixed**. Readability and hints: **partly** (lens glow, look beams, enemy rim/aura/halo,
two-tier hints, Tab card; the forced cone reveal is open). Scope: **partly** (L1 built but still the 8-10 min layout; no L2/L3, scenes,
choice, endings). Takedown, distraction, camera pause, May's tree: **built 2026-10-05** (the Hacker's actives are on keys 1-2; the tree is tuned to ~60 % of its price per run). Sound camera still in L1 P2. The wave numbers
above (9/15/18) are outdated: `config.json` and DESIGN 9 have packs 5+3, 5+4+3, 6+5+4 = 9/16/19.

**Measured (bots, 8 seeds, L1).** Loud 8/8 in 115-205 s (min HP 14-105, 57 kills); sloppy loud 5/8; quiet 8/8 in 368-393 s with 0 alarms.
Hacking is ~41 % of the quiet run (4 hacks, ~162 s). The quiet bot waits only 7 s in total because the quiet line avoids the guards by
geography (the edges). The firewall opens every red wall in the level, so loud skips T1-T3 and is 2.5x faster than quiet (against
DESIGN 7). L1 has only 2 checkpoints, both after arena 2 (cells 26,15 and 37,15).

**The designer's feedback (2026-10-05)** - "shooting and hits feel artificial (reference: Doom 2016/Eternal), detours are boring and empty,
monotonous, unclear where to slip through, guards scurry everywhere and fast". System causes:
- There is no stealth verb, yet the hint and May promise "go behind it", while a hit from behind raises the alarm.
- Four identical hacks and one global wave ladder.
- Hip shots snap to targets inside a 5 deg cone, and hit spheres are 2x the drawn size.
- A warden is an 8-shot sponge with no weak side and one flinch for every hit.
- A crouching player (1.5 m/s) is slower than a patrolling drone (2.2 m/s).
- Wardens sweep +-55 deg while walking.
- The A1 drone loops over the plaza centre.
- Network vision overheats at 6 s, while patrol loops are 20-40 s.
- The edge line is free and the interior pays nothing.

**Top 5 (2026-10-05):**
1. Active stealth (**M**): takedown (*built 2026-10-05*: E from behind, 0.6 s, down 45 s, no noise, not a kill) + May's distraction ping (key 1, 15 m,
   12-15 s cooldown); given at the T0 meeting.
2. Readable, rewarding interior; L1 cut to ~5 min (**S-M**):
   - guard numbers: crouch 2.0, drone patrol 1.4 with 3.5 s stops and a 26 deg / 10 m cone, wardens scan 30 deg while walking
     (55 at stops);
   - the A1 drone off the plaza centre;
   - network vision: `scan.maxSec` 10, plus route stop rings;
   - a coverage-scan tool (30-50 % coverage, at least 4 s windows on the quiet line);
   - at most 1 hack per arena (merge T2 into T3), the sound camera moved to L2;
   - the interior line 40-60 % shorter than the edge, with a finding or a shard cache in it;
   - target: quiet bot ~200-220 s.
3. Firewall per arena + 3 checkpoints per level (**S**): a lockdown opens only its arena's walls, the alarm resets at the next
   checkpoint, L1 lockdowns are 2 waves; a checkpoint goes in P1.
4. The 20-minute arc skeleton by 10-08 (**L**, with the producer): scenes, L2/L3 one arena each, the explicit two-button L3 choice, the
   quiet endings; cut ET1 and May's passives/points screen if needed.
5. Honest hits + the Doom link + distinct waves (**S-M**):
   - hip assist 5 -> 2 deg (0 when aimed), hit spheres ~1.25x, warden back/flank x2;
   - "shoot to stagger, cut to finish": the warden staggers at 50 % hp for 2 s, then any sword hit kills it for 6 shards;
   - waves with one job each (worms / ranged / heavy).
