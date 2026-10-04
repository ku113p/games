# Uninvited - design document

> **How to read.** Plain text is **decided** (recorded from the designer's words, 2026-10-04). A line with **❓** is **open** and needs the designer's answer.
> An "agent's proposal" is only a proposal until confirmed.
> All ❓ are collected at the end (section 16). Small numbers (health, damage, durations, per-level balance) the agent picks during the build and shows the designer.
> The designer works in the Russian copy `DESIGN.ru.md`; the agent carries every change over to this file, which is the reference for the code.

---

## 1. Core

A future ruled by corporations. Johnny, a middle manager at the Shuseki corporation, is framed, fired and exiled.
He lives in a wretched little room in the Free Territories and hacks his way through the corporation's network to his boss Jim, to take revenge.
On the way it turns out Jim is a victim too: he is ordered from above to frame and fire people, and the revenge changes nothing.

A third-person action-stealth game inside the network (Tron-like), with real-world scenes between levels.
Three levels: beginning, middle, end. Two more go in between if there is time.
Browser, PC, landscape; phone after the jam.

**The itch page text** (based on the designer's words; the agent polishes it at release): "In the future you are either under a corporation or outside the system. Found a job - hold on to it to the end.
But what do you do when you are framed, become uninvited, and there is no way back? Luckily, technology can help you take revenge. Let's see what comes of it."

## 2. World

- The future; corporations rule the world. A person is bound to their corporation.
- Being fired means being **exiled**: the person becomes an outcast and goes to the **Free Territories**. There is no way back into the corporation.
  Life there is the bottom compared to the corporation's benefits. That is the "Uninvited".
- You cannot simply quit a corporation: another one may not take you, and your own may kill you.
- The corporation is **Shuseki** (Japanese for "agglomeration"). The city is **NewEuropeCity**.
- A junkyard of the future: rubbish everywhere, cables, everything electric, everything held together with sticks and tape - but life goes on, deliveries still come.
- Everyone has an AI assistant - an ordinary, obedient one.

## 3. Characters

- **Johnny** (the hero) - a former middle manager (not a top one). In the corporation he had a cubicle - even smaller than others' - and one subordinate.
  After the exile he lives in a wretched room in the junkyard. He does not work: he lives off his savings and knows he will soon have to leave.
  **Johnny's face is never shown** - not in scenes, not in images.
- **Jim** (the boss) - gave Johnny the assignment and then fired him. Johnny is sure Jim framed him, and takes revenge on him specifically.
  In truth, every week (or month) Jim does nothing but frame and fire people on orders from above, or be fired himself.
  He is ashamed, he does not want to do it, but cannot show it to people (they would start pleading). He has a family.
- **The Top** - someone above Jim whom Jim has never met; only letters come from them, ~10 a week.
- **Steve** - Johnny's subordinate, present in the firing scene.
- **May** - the AI assistant (section 10).

**How Johnny was framed.** Jim gave him an assignment: run a smear campaign against local competitors.
Johnny failed - he was exposed because someone leaked all the information. The leaker was Jim himself.

## 4. Story in order

**Prologue - the office (real world, cutscene).** Johnny's cubicle, Steve next to him. Jim walks in and says briefly:
"You screwed up badly, how could this happen to you, we have no choice, you are fired." The introduction that brings the player up to speed.
It must be done **very well**.

**The room (real world).** The first time at home after the exile, before the first level. Simple actions (section 5).

**Level 1 - beginning (network). Jim's computer.** A tutorial: getting to know the game and a simple test of skills.
The whole level is Johnny connecting to Jim's computer and getting to one file.
The first red wall cannot be opened - he has to go to a terminal. There he meets May by chance: something like a virus has possessed Johnny's ordinary obedient
assistant, and now it gives superpowers. The wall opens. Then basic stealth and hacking, the first set of obstacles.
At the end Johnny finds **Jim's notes with the plan for framing him** (leaking the smear campaign) - the evidence that makes Johnny think
Jim did it himself, out of spite.
**The layout is approved** (2026-10-04): start ledge over the void + T0 (meeting May) + bridge to red wall D1 -> arena 1 "the plaza" (a camera, cover, the first warden) -> passage P1 (C1, a motion sensor) -> arena 2 "the river" (a void river, a drone along it, T1 pauses the laser and the drone, a low bridge with a laser and a high bridge, a warden on the far bank) -> passage P2 (C2, a sound camera) -> arena 3 "the core" (C3 on the entry terrace; the landmark tower with Jim's file behind D2; T2 pauses the tower cameras and drone, T3 behind a posted warden on the east terrace opens D2). ~4.4 slices, 8-10 min.
T0 is May's entrance (section 10): solving it plays the meeting (the sim stands still for a few seconds, a glitch, her three lines), then D1 opens and she says "You're welcome".
As built (`levels/l1.ts`, the default level; `?level=slice` for the old test): A1 got a second, roofed exit from the plaza's north-west corner into P1 (away from warden 1's street); T1 sits on the south bank by the ramp (from the balcony its 30 s pause ran out before the low bridge); in A3 the order is T3 (opens D2) first, then T2 (pauses the tower cameras and drone - terminals can now pause cameras) right before the vault; one drone per arena as a high spotter; wardens: 1 in A1, 1 in A2, 2 in A3 (more blocked the quiet path - to revisit with the new roles); bridges are one cell wide light bridges.
**As built, the rebuild by the level designer's plan (2026-10-05, `levels/l1.ts`, a 56 x 60 plan).** The level is shorter and has three checkpoints that are really there: C1 in the roofed passage P1 ([27,24]), C2 on the north bank of the river ([31,5]), C3 on the entry terrace of the core ([41,5]). Start ledge (2 m, T0 = May) -> light bridge -> D1 -> the **stealth primer yard** (2 m, a vantage over the plaza) -> A1 plaza (camera on the west wall; a lane of server blocks on col 25; an elevated route: the east terrace behind a parapet) -> P1 (roofed, C1, a motion sensor) -> A2 river (balcony, a south bank, a high bridge with two ramp chutes, a low bridge with a laser, a north bank with warden 2's beat and a lane of blocks; T1 targets D3, the drone, warden 2) -> a ramp up to D3 and a light bridge -> A3 core court (entry terrace + C3, the vault slab with the artifact behind D2, a camera over the vault door, warden 3 posted by T3, a lane of blocks on row 10, a high road along the west and south walls). No drone in A1 (cut), one in A2. Quiet bot 8/8, 208-263 s (avg 231 s), 0 alarms; the quiet path is ~120 cells; the loud bot wins 6-7 of 8 in 130-220 s.
- **The primer.** The yard is the first thing after D1: the plaza lies below, warden 1 walks a loop with one 4 s stop at the middle looking south. A 4 m server block (hide spot) stands at the south edge. `primers` in the level def mark the zone: inside it a stealth violation never raises the alarm stage (`raiseAlarm` returns early, nothing is counted); the warden still turns alert and can attack, so a failure is not free but it is not the Breaker path. The "Move quietly" card belongs to the D1 opening (scene flow).
- **Firewall per arena** (the designer's decision). A level may list `arenas` (a rectangle, the red walls its firewall opens, the wave count). A lockdown is fought in the arena the player stands in (the nearest one from a passage): the spawn gates, wardens and worm packs of **that arena only**; the arena's `waves` waves (L1: 2; default `alarm.firewallAfterWaves` 3); then the firewall drops and opens **only that arena's red walls** (A1: none, A2: D3, A3: D2). After it no new wave starts, even if the alarm is raised again; the next checkpoint ends the lockdown (alarm back to 0). A level without `arenas` keeps the old rule (all gates, all walls). L1 arenas: a1 [20,28]-[37,41], a2 [17,2]-[34,23], a3 [39,1]-[55,17]. The Breaker pays two lockdowns (A2, A3).
- **Checkpoint colour, two bugs fixed.** (1) A checkpoint passed under alarm 3 before the first wave, or in the middle of a fight, counted as calm (May: "I like it quiet" with the waves going): now `underAlarm = segmentFight || (alarm 3 and the firewall up)`; `segmentFight` stays true while the fight goes on, so a fight that spans two checkpoints counts at both; a finished lockdown resets at the checkpoint. (2) A 4th wave: after the firewall dropped, a re-raised alarm 3 started waves again: now the wave counter stops at the arena's wave count. Tests: `core/progress.test.ts` (alarm 3 with the firewall up is red; a fight over two checkpoints; the event flag for May's red line; a finished lockdown ends at the next checkpoint), `core/alarm.test.ts` (exactly the arena's waves; the firewall opens only the lockdown arena's walls).
- **Findings (story hook, no rule yet).** `{ kind: 'finding', id, at, textKey }`: `f1` at [26,34] in A1 (`finding.l1.a1`).
- **Numbers changed for the readable lanes:** `crouchSpeed` 1.5 -> 2.0; drone patrol 2.2 -> 1.4 m/s, stop 2.2 -> 3.5 s, look-around 3.5 -> 3.0 s, cone 32 -> 26 deg and 12 -> 10 m; `scan.maxSec` 6 -> 10.

**The room.** A food delivery. A pause between levels.

**Level "middle" (network). Employees' personal data.** Something does not add up: why frame him at all? Johnny finds, one after another:
- he is not the only one fired - someone is fired every week ("what if it's me again...");
- Jim's personal notes: he is very stressed, he constantly has to fire people, he does not know whether his work is worth anything,
  he is ashamed, he would not want to do it, but he has to - he has a family.

The artifact at the end is a letter or a note on a server. On this level May refuses to help a couple of times (section 10), so quiet detours are mandatory here.

More findings on this level:
- a firing spreadsheet where Johnny's name is one row among dozens;
- Jim's draft transfer request, never sent (a lead-in to the finale).

**The room.** News: mass layoffs again (that is, exiles again).

**Level "end" (network). The corporation's security system (its core).** Johnny learns the truth: letters from the Top to Jim, ~10 a week - "this person must be framed,
no matter how; if you don't, we fire you; last week you already slipped up". Jim decides nothing - Johnny would have been fired anyway.
The climax: Jim's fresh personal notes, written after Johnny's firing: the last firing (Johnny was framed especially hard) broke him;
he will ask for a transfer, and if refused he will try to quit, even knowing the corporation may kill him for it.

**The encounter with Jim** is not gameplay but a screen: surveillance camera frames (not live, heavily lagged) and text. For the tragedy.
Whether Jim gets fired in the end stays unclear, left open.

**Two endings** - by play style, automatic.
A counter: for every checkpoint where there was an alarm with waves (the 3rd alarm level, section 9), the sad ending gets +1.
Out of 9 checkpoints (3 levels x 3), **4 or more** gives the sad ending; fewer gives the peaceful one.
- **Peaceful** (quiet, killed no one - "smart, understood everything"): Johnny spares Jim and sends him a letter -
  "sorry it turned out this way, of course I am angry, but your life is no better". The text must show that Jim suffers from his job
  more than Johnny does in the junkyard.
  In the room: an exit button appears, and if you wait a minute or two - a knock, "a parcel for you", full of money.
- **Sad** (broke everything): in a fit of rage Johnny does something bad to Jim (through the cameras / internet of things).
  In the room: "a parcel for you" - a grenade, an explosion, everyone dies.

**Changed after the reviews (the designer, 2026-10-04):** the ending is an **explicit choice in L3** (send Jim the letter, or strike at him through the cameras); the counter and the hero's colour become pressure along the way (May comments on it), not the verdict. The endings are **quiet**: peaceful - the letter, later a small parcel (food, a little money), no triumph; sad - a knock, "a parcel for you", black screen, then the empty desk (S6). Revenge changes nothing. The counter no longer cascades: a checkpoint counts red only if an alarm-3 wave fight happened since the previous one.

**The hero's color.** At the start the neon lines on the hero's suit are **white**. Over the game, depending on decisions, they shift more and more
toward **red** (the evil path) or **blue** (the good path). The player sees which ending they are heading for.

The color is the visible hint of the ending counter and has no rules of its own: every checkpoint with a 3rd-level alarm shifts it toward red, every checkpoint without one toward blue. The counter decides the ending.

## 5. The real world

Made in **2.5D**, **well**: a generated picture of the scene + shader effects (rain, slowly breathing neon behind the window, living screens) + clickable props on top. There is no animated character.
Engine test: this is both realistic and fast (`tests/engine-room/`). Two scenes:
- **The office (prologue)** - a middle manager's cubicle; reference: the Corpo start of **Cyberpunk 2077**. Done **very well**: it opens the game.
  The office is **enclosed** (a small room, no huge open space) so it does not overload the engine.
- **The junkyard room** - one ugly little room, truly awful, obviously made of sticks and junk. Futuristic: electrics, power cords (a wireless era, section 14). Done **fairly well**.

**The real world is seen in first person**: the player looks through Johnny's eyes (in the room and in the office). Johnny himself is drawn minimally or not at all.
The real world exists so the player identifies with the hero; almost no actions are expected from him here.
No walking. An action is a click on an object; the response is scripted, with no character animation (a camera move, a picture change, a fade, a sound).

**What can be done in the room.** Every time the same: drink water, eat, read the news on a cheap old tablet (scuffed, cracked, matching the room), look out of the window at the street, cry.
Plus something special between levels: after level 1 - eat from the delivery; after the middle level - news of mass layoffs; in the finale - the parcel (section 4).

**Going into the network** - from the computer: click the wireless VR headset that lies on the desk by the computer, + confirm. No wired headphones.
The headset is shown not from outside but from inside - as if you are already putting it on. You hold the headset in your hands (not filling the screen). Confirm with a button or by clicking the headset itself; a click anywhere else goes back to the room.

**Props in close-up** are the same as in the room (the same bottle, cup, tablet); a prop you pick up is gone from its old place.
**The view from the window:** near - ruin, poverty and sadness, but a living street too (people, food, couriers, junk); far away up high, beyond the walls - the rich city's great neon.

Why the room: Johnny periodically disconnects from the network and returns to reality - the player must feel that reality is different.
It is a pause between games: life is bad, but there is some life. Mood: "yes, in the gutter, but really not that bad";
the player should think "everything around is shit, and yet this thing still works".

**The scene flow - as built** (`core/flow.ts`, `main.ts`, `view/story.ts`, `view/story-data.ts`, `view/title.ts`). Title -> office prologue -> room -> level 1 -> Jim's notes -> room -> level 2 (a "coming soon" card) -> level 3 (the same) -> ending (a placeholder card) -> title. Each scene is a mode of `main.ts`; the scene the player is in is saved (storage slot `flow`), so the title offers **Continue** (inside level 1 it also loads the checkpoint save). `?scene=<id>` (`prologue`, `room1`, `l1`, `notes`, `room2`, `l2`, `l3`, `ending`, `title`) jumps to a scene; `?level=<id>` and `?bench=` still go straight into a level with the old start screen.
- **One story-card player** (`view/story.ts`): a full-screen still from `art/generated` with a slow pan and zoom (Ken Burns), 0-4 lines of text held at about 170 words a minute (`config.json` `story`: 0.35 s/word + 1.2 s, at least 2.5 s), Enter / Space / a click for the next shot, **Esc skips the whole montage** (a scene that waits for a button jumps to its last shot). Music per scene: `office` (prologue), `room` (room cards), `menu` (title, notes, soon cards, ending). A line wrapped in `*stars*` is narration (italic), the rest is speech.
- **Office prologue**: the camera role's 9 shots (O3 wide, OP4 Steve, OP2 Jim at the door, an OP3 crop on the hands, OP3 over the shoulder with three of Jim's lines, OP4 Steve looks away, P5 the box, OP5 leaving, P6 the gate), about 50 s. **Room**: one card (A2 plate), 2 lines, button "Jack in" - the real room is a later port of `tests/room-fp`; after level 1 the same card with the F1 delivery. **Jim's notes**: a paper-like panel over an NN2 still after the won screen. The won screen no longer prints the checkpoint counter (the counter is pressure, not a verdict, section 4).
- All story texts (`story.*`, `may.l1.unseen`, `goal.l1`) are **drafts** from the narrative review; the designer edits them in `texts/en.json`.

## 6. A network level

- The network is **not a real place** - it is a representation of how Johnny hacks the system.
- Levels are hand-made, not generated. Large, linear as a whole (a "string of pearls", below), not flat: open arenas joined by short passages.
- Arenas cannot be passed calmly by disabling one thing: e.g. a camera must be paused and a robot hacked at the same time,
  or you are seen and have to shoot your way out. Maybe lasers too.
- **Winning a level:** reach the end and take the artifact (a representation of a letter/file).
- **Losing:** health runs out.
- **3 checkpoints** per level; passing one gives May's upgrade points.
- **Saving:** checkpoints + ordinary saves, just in case.
- **On death** - a choice: load a save or restart the level.
- **The setting is an open space** (the designer's decision, 2026-10-04: not tunnels but an open crypto-neuro-microchip space). It is the far future: no present-day parts (capacitors, pins, resistors, circuit boards). The sky and the far view are open (a dark void with distant lights, other districts and a landmark far away), and below are districts of slabs and hex towers 4-12 m tall: they form streets and arena squares and block sight at ground level (a completely flat open space is not made - stealth needs cover). Low hex modules are cover; slabs at different heights and light bridges are tiers; pulses run along the data "rivers". Between arenas, short enclosed passages are the breathers. "Crypto" is decoration only (glyphs, encryption locks). **The look is chosen (2026-10-04, the agent's recommendation):** the base of the world is **NF6** "data metropolis" (clean slabs of different heights, only light lines, rivers of data, bridges at several heights); **NF4's hex modules** are the cover and detail kit on every level (some modules may slide); accents: L1 - clean NF6, L2 - NF2's neuromorphic "trees" along the arena edges, L3 - NF3's quantum core as the landmark and NF7's vault in the finale. The concepts are in `art/generated/`.
- **After playing the slice (2026-10-04) the designer:** levels must feel more alive and natural; bigger rooms, more space;
  not every cell/room under patrol; drones fly long, varied routes naturally instead of "looking like they hunt someone";
  cover must not look like a crutch.
- **Structure and sizes accepted by the designer (2026-10-04)** (agent's proposal):
  - A level is a "string of pearls": a calm passage (a breather, May, a finding, a checkpoint) -> a large guarded arena -> ... Linear, but free inside an arena.
  - A vantage point at each arena entrance (a balcony/glass): you see the whole hall, read the routes in network vision and plan.
  - 2-3 paths through an arena (quiet along the floor behind racks, high over bridges and cable trays, violent through the middle); the paths cross; loops around obstacles to break pursuit.
  - Guards cover 30-50% of an arena: 4-8 s windows, safe pockets; long routes tied to the architecture, stops with a purpose, no look-around at every point.
  - Rhythm: quiet -> build-up -> peak -> release; a new mechanic: show it safely -> give it simple -> combine it.
  - A landmark: the level's goal (a core/tower with the artifact) is visible from afar.
  - Cover that belongs to the world (a kit): hex modules of different heights (low ones to crouch behind, tall ones as district walls), slabs, bridge rails, data "rivers".
  - Ambient life: data packets along tracks, "janitor" programs, slabs blinking under load - not enemies, but they move and make noise.
  - Varied shapes and height: tiered halls, a bridge over a void, an atrium, an archive maze, a service passage; other parts of the level are visible across the void.
  - Metrics: streets and passages 3-6 m, arenas 20x30 - 40x40 m, district towers 4-12 m, passage ceilings 3-5 m.
  - As built (the slice converted): slabs with light lines on their top edges, hex-dressed blocks and hex cover, towers rising out of the void, low parapets where you look out, roofs only over the passages, light bridges over the void, far districts and data rivers below, a landmark tower with a light beam. Falling into the void fades out and puts you back on the last safe ground for 20 HP. Spawn gates sit in slab sides, floor hatches, roof hatches or sky portals.
  - **Length changed (the designer, 2026-10-04, after the reviews): about 5 minutes per level and about 5 minutes for all the real-world story scenes together - a ~20-minute game.** L1 is cut down to fit.
  - Size (before): L1 (tutorial) ~4-5 slices, 8-10 min, 3 arenas; L2 and L3 ~8-10 slices, 12-15 min, 4 arenas each (jam judges usually give a game 10-20 min).

## 7. Two paths

There are **two** paths - stealth and hacking are merged, otherwise too many mechanics:
- **Breaker** - go straight through and break everything. **Much harder**: the alarm grows, waves come and wear you down; the firewall drops per arena (only its own red walls, section 4) after that arena's waves.
- **Hacker** (stealth + hacking) - pass unseen, pause the security, hack. Any stealth violation or attack is **punished hard**.

## 8. Stealth and security

- While you are not seen, you are not seen.
- **Cameras:** each has a view cone, turns in a repeating pattern, not too fast - there is always a way to slip past.
  There are **video-only** and **sound-only** cameras, and they look different. Cameras **cannot be hacked**, but can be **paused**.
- **Noise:** running, jumping, fighting.
- **View ranges and noise are not shown without network vision** (the designer's decision, 2026-10-04): the cones of cameras, drones and wardens, sensor zones and the radius of your noise show only in network vision. Without it you read the direction from the devices themselves (a camera's lens glow, a drone's eye, a warden's visor), and when something starts noticing you, an on-screen suspicion indicator points at the source.
  As built: a camera and a drone always show a glowing lens / eye and a short look beam; the view range (the cone and its grid on the floor) fades in with network vision, and so do a sound camera's hearing ring and the noise rings. The floor grid stops where the device's line of sight stops - at walls, and behind cover, server blocks and steps wherever a crouched head is hidden, exactly as the detection rule sees it. Around the crosshair each watcher that is noticing you gets an arc turned toward it that fills with its suspicion (amber), red and blinking once it has spotted you.
- **Lit streets, dark lanes** (the designer accepted it as a try, 2026-10-05, after "it is unclear where you can slip through"; as built, `view/exposure.ts`, switch `view.stealthLight.enabled`, URL flag `?nolanes` for a quick A/B): the cones stay in network vision only - this is the city's lighting. The floor shows how often each spot is watched: **watched floor is lit** (a cool brighter tint and a faint cell grid), **blind spots and lanes behind cover are dark** (the floor dims to 55 %), and **a thin footlight runs along the base of cover that forms a chain** (another cover element within 3.2 m) and only on dark floor, so isolated cover has none and a chain reads as a lane. It is derived from the level at load, with no authored data: cameras over their sweep, patrol drones over their route loop, wardens over their round (walking glances, the scans at stops) or at their post, each through the same line-of-sight as the detection rule (a crouched head, cover, steps, slabs, closed red walls); a device that is paused, destroyed, downed, hacked or walled off fades out of the map in 0.4 s, and a red wall opening or closing recomputes it (one device per frame). **The hero dims when hidden:** his light lines drop to 40 % while he is crouched in cover and unseen, the visor stays on, and they come back as soon as a watcher notices him.
- Hacking keeps your stance: start a hack crouched behind cover and you stay crouched (and hidden) through it and after it.
- **Motion sensors:** the sensor itself is a small blinking dot on a wall, noticeable up close if you look; its **zone** shows only in network vision (a translucent red volume). It trips on **sprint, dash and jump** inside the zone; walking and crouching pass.
  A careless, running player always trips them.
- **Enemy roles** (the designer, 2026-10-04, after playing): **drones watch** - they spot you and call the others, and shoot only very weakly, and die from 1-2 rifle shots; **wardens watch and attack** - the main guards and fighters, there are more of them; **worms crush by mass**; **turrets** hold fixed key points. Waves are big, zombie-like: at least 4-15 enemies per wave. Wardens are active: they shoot from range and switch to melee up close.
  - **Warden pursuit as built (2026-10-05):** at **alarm 2+** the alarm's centre follows the player while anyone (a fighting warden or drone) sees them - the shared alarm knowledge - and for a few seconds after the alarm is raised (`alarm.raiseCooldownSec`). Every warden within **30 m** (`warden.pursuit.radius`) of that spot, in any calm mode (round, check, search), turns to a fight (no new alarm stage) and **runs** to it at **4 m/s** (`warden.runSpeed`; the player sprints at 6.4) while the player is further than 9 m, then at the 3.3 m/s alert walk; the walk grid finds the way, and a closed wall means it does not come. It stops at about **6 m** and shoots (the ranged token, 2 at once); after its **first shot** the one warden nearest to you steps in between shots, and fights in melee when the melee token (1) is free, the others hold and shoot. It loses you only after **5 s** (`loseSec`) without sight, and only while nobody else sees you - then it checks that spot and walks back. At **alarm 1** nothing changes: they search the area at walk speed (1.75 m/s), so stealth stays possible; the primer zone and wave wardens (which always know) are unchanged.
  Looks (chosen 2026-10-04, `art/generated/`): drone **EM1** (a lens orb with orbiting light rings), warden **EW1** (a slender sentinel with an energy halberd; not "square logs"), heavy warden in waves **EW2** (an enforcer with a hex energy shield), turret **ET1** (a hex pylon with a floating rotating head).
- **Varied guards - sentries separate from drones** (the designer's decision, 2026-10-04):
  - **Wardens** - walking guard programs: stand at a post or walk their beat, turn their heads, go to check a noise and come back. A forward cone + hearing; they turn slowly, so you can sneak up from behind.
  - **Drones** - patrol large spaces along long smooth routes up high; at an alarm they fly out of the spawn gates.
  - Wardens as built (2026-10-05, the designer's pick **EW3g, the particle swarm**; the armored EW1/EW2 look was rejected as "not digital enough"): the skinned UBC body (the same rig and clips) is drawn as a **swarm of glowing red-orange dots in one shader** (`view/swarm.ts`): an object-space hashed 3D grid (cells 5 cm, dots ~1/2 cell) that stays on the body while it animates, the fragments between the dots are discarded, dense on the head and torso, sparse on the limbs; the dots flicker (7 Hz, 10 % off) and drift, flicker faster in a fight; with distance the dot size and coverage grow (from 11 m, a solid glow by 30 m) so the figure still reads at 40 m. The armor shells, coat plates and seam lines of the build are dropped at load (the glb files are unchanged). A solid bright visor slit shows the facing; the halberd (and the heavy's blade) is a thin rod of light, the shot still leaves from its tip. **One Points draw for all wardens** carries the shed particles (240 per warden from bone positions, a pooled Float32Array, no allocations): they trail off when it walks, swirl around it on alert, burst on a hit, stream into the body on spawn and reboot. States: calm / suspicious (amber, "?") / alert (red, brighter, faster flicker, a swirl) / strike and shot (the rod flares, the beam telegraph) / **hit** - the dots scatter outward and re-form in 0.55 s with a flash in its own colour and a burst of particles / **takedown** - the swarm loses cohesion and pours down into a low glowing heap on the floor (the body flattens, the particles settle into a mound ~0.55 m wide; the eye goes out; a falling glitch power-down sound), on reboot it re-forms (the particles stream into the body) / **death** - it dissolves into particles in 1.3 s / **spawn** - it assembles from particles in 1.3 s. The heavy warden in waves (EW2 role) is a bulkier swarm (inflated 3 cm, larger denser dots) with a **hex shield of particles** on the left arm (a blocked hit flares it). The fallback `view.wardenLook: "holo"` (EW3c) is the same shader without the discard: translucent scanlines, glitch slices and a projector disc on the floor. Performance (software GL, before -> after): draw calls in a wave -12 % (316 -> 283 on l1) because the armor meshes are gone, programs -6, no new lights, no per-frame allocations from the swarm; numbers in `view.swarm`. Drones are the EM1 lens orb - a glossy black orb with an iris that dilates when suspicious and pinches on lock-on, two orbiting rings that speed up on alert, a faint scan fan under it; a hit cracks it, a kill bursts the rings off. Readability in the dark (2026-10-05): the drone shell has a red fresnel rim, brighter seams and thicker rings, and a soft red halo sprite (2.4 m) behind it, so the orb reads from the side and back at 5-40 m; wardens (swarm look) keep a bright visor and a faint warm aura (1.8 x 3 m sprite) around the body, the dots grow with distance (numbers: `view.enemyLook`, `view.swarm`). No white on enemies. On the beat they stand, check racks, glance aside; **the round is deterministic** (2026-10-05, the designer: "they scurry almost everywhere and fast"): no random pauses, the stops and their waits (`waitSec`, varied only +-10 %) are the level's, so a window of N seconds at a stop is the same every loop; the head sweeps 30 deg to each side while walking and 55 deg at a stop (`walkScanDeg`, `scanDeg`); a stop with a facing checks the rack there, one without it looks around; suspicious - stop, turn to the cue, "?"; investigate - walk to the cue, search ~4.5 s, return; at alarm 1-3 they search the alarm area. Cone 10 m, follows the head; they hear noise; turn slowly (you can come up behind). Up close (1.6 m in front) a warden notices you even crouched - the designer confirms. Fight: a telegraphed melee strike (a dash dodges it) or a slow aimed arm shot from range; the sword takes 3 hits, the rifle 8. A terminal can pause a warden; May's "take over" ability has a hook.
- **Turret robots:** shoot, and can spot you. One type (ET1), placed sparingly: the core arena of L1 and the L3 finale. **Cut (the designer, 2026-10-05, after the second reviews):** no turrets in the jam build - the time goes to the shooting feel, the stealth lanes and the arenas; ET1 stays a concept.
- **Non-lethal takedown** (the designer asked for a non-lethal Hacker tool, 2026-10-04; built 2026-10-05, `core/rules/wardens.ts`, numbers in `warden.takedown`): sneak up behind a warden and press E - an override powers it down for a while. It does not count as a kill or an incident for the story.
  As built: allowed when the warden is **unaware** (any mode but alert; a heavy EW2 and wave wardens never), you are within **1.6 m** of it, inside the **rear arc of 110 deg** (55 deg each side of straight behind its body, so its front and its sides cannot be used) with a clear line to it. The hero is locked for **0.6 s** (the hack pose: it overrides the warden's systems; the warden slumps to its knees and its lights go out), **no noise**. The warden is then down **45 s counted from the start** (`downSec`); its lights flicker for the last 1.5 s as it reboots, then it walks back to its round **unaware** (a downed warden sees and hears nothing, even in plain view). It stays down only so long: **alarm 2+ wakes it at once** (it reboots within 1.5 s), a hit wakes it hurt and fighting. Other wardens that see a downed warden or the takedown itself (within their cone and range, line of sight clear) turn **suspicious** and go to check the spot (each only once per 20 s). A prompt "{E} override" shows exactly when it is valid and takes priority over a terminal prompt; the first takedown retires the warden hint. Why 45 s and not "for the level": the player may take the same warden down again, but a warden gone for the whole level would make an arena trivial; 45 s covers a crossing, not a loiter. Not yet: drones and cameras do not react to a downed warden (only wardens do).
- Almost all electronics can be hacked (except cameras). Several nearby sensors can be disabled at once with an ability.
- **Network vision** is the scanning mode, the Hacker's main tool. It shows: which terminal controls what (lines from a terminal to its wall / laser / drone), drone patrol routes, camera cones through walls, sensor zones, the radius of your noise. It has a **cooldown, but a short one**. Held too long, it calls the security.
  This must be **clear in advance**: while scanning an overheat meter is visible; near the limit a warning (a sound, the meter pulsing red, a label); when the security is called - a clear message "scan traced - security called", and you see where the drones come from.
  It is upgraded; mostly needed by the Hacker.

## 9. Alarm and the Breaker

The alarm rises **gradually**: kill a camera - someone always comes to check; more violations - a higher alarm.
Alarm levels 1 and 2 last for a while and then **decay**. Level 3 does not decay: from then on there are only waves, passable only by force. Three levels:
1. A couple of drones fly in and search a large area. You can quickly hide in places they cannot reach and wait it out.
2. More drones, searching almost everywhere.
3. Nowhere to hide - you have to fight right away. Waves come; the firewall drops only at the very end.

**Waves must press hard** (the designer, 2026-10-04: "real pressure from everything", and moments when the sword is what you need - to cut down several close ones at once).
Agent's proposal: **worms** - small fast melee programs that rush along the floor in packs of 4-6 and bite with a short windup;
one sword swing (the 180° arc) kills several, the rifle needs 2-3 hits each. Waves are mixed and escalate: drones at range (for the rifle) + worm packs up close (for the sword), from several sides, a short breather between waves.
As built: worms crawl out of the spawn gates, are faster than a sprint (you cannot simply outrun them), fan out around you within 6 m, rear up for 0.42 s before a bite (step back or dash to dodge; a hit cancels it); one sword swing kills every worm in the arc, the rifle needs 3 shots. Alarm-3 waves mix drones and 1-3 worm packs from different gates than the drones, 6 s breather; a wave is cleared only when its worms are dead. At alarm 2 a pack of 4 joins the search and goes back into a gate when the alarm cools. Worm kills make noise but do not call a check. Getting hit: a heavy hit sound, a red screen-edge flash and an arc pointing at the source.
Aim as built: RMB draws the rifle (the sword comes back on release), walk speed only, Q ignored, the spread tightens from 2.5° to 0.8°; the camera eases in to 2.6 m with FOV 50 and slower mouse. The gun points where the crosshair points: while the rifle is raised (RMB, or 0.8 s after a shot) the hero's spine chain (spine_01-03 plus a small neck share) turns after the animation so the barrel aims at the crosshair target point (what the camera ray hits, an enemy first, else a point 60 m out), pitch up to ±65°, residual yaw up to ±70° (the body itself already turns to the camera yaw), critically damped over 0.08 s, legs untouched, crouched aiming works; shots and tracers start at the rotated barrel tip. With the rifle lowered the head glances toward the crosshair (≤28° yaw, 18° pitch, 40 % share). The sword has no aim pose. Numbers: `view.heroAim` in config.json. The model never snaps: when a shot, a swing or a dash turns the hero's facing at once (up to 180° when retreating), the model turns to it at `view.heroTurnRate` (about 0.1 s); the camera itself never follows the facing, only the mouse.

**One weapon, "two in one":** an energy gunblade, sword and rifle in one (as the H10 hero carries). Two modes:
- **An energy sword** (a blade of light) - hits in a 180° arc, close and at short-to-medium range.
- **An energy rifle** (a glowing charge instead of a magazine) - less damage, but fires faster and straight; a small spread cone, so some bullets miss.

**Ammo** is given at the start and after that only generated by May.

**As built in the slice** (the agent decided where the design was silent - the designer confirms or corrects; play: `bun run play`, http://localhost:3330/):
1. Shift (hold) sprints (loud); a dash is a double tap of a direction (a short invulnerability). Decided after the designer played: Shift used to do both and it was unclear.
2. A laser grid hurts and raises the alarm; a terminal can pause it for 30 s; its posts can be broken.
3. At alarm 3 the firewall drops after three cleared waves; after that no new waves start (so the run to the exit is possible). Waves (as built): 1 - worm packs 5+3 and a drone; 2 - packs 5+4+3, 2 drones, 2 wardens; 3 - packs 6+5+4, a drone, 2 wardens and a heavy warden; packs and wardens come from different gates; 6 s between waves. At most 3 worm bites, 1 warden strike and 2 ranged shots are in progress at once (attack tokens); the rest circle 2.5-4.5 m away.
4. A terminal that does not open a wall pauses its lasers and drones for 30 s.
5. Hiding spots are **tall server blocks** you crouch behind (the designer chose them over niches: clearer without explanations). Height 1.4 m: crouched you are hidden, standing your head and shoulders show. As built in the slice: by T1 and T2 one long straight block stands a metre off the wall, open at both ends (no L-shaped pocket); in the city a block beside a ramp is drawn down to the ramp's low end, so no wedge of void shows between the slope and the wall (`bun tools/seam-scan.ts [--niches]` lists such seams and pockets).
12. Alarm and wave drones **fly in through visible spawn gates** in walls and ceilings (the light ring turns red and glitches, shutters open, a sound) instead of appearing from nowhere; gates within 12 m of the player are not used; leaving drones fly back into gates.
13. Before every shot a drone **holds still for 0.9 s and aims** (visible and audible) - the shot can be dodged; losing line of sight cancels it. Drones hover at 3.5 m, out of sword reach (2.2 m up); they shoot weakly (5 damage every 3 s) and die from 2 rifle shots. **Shots that flew past a drone (fixed 2026-10-05):** the hit test was fine (sphere of 0.6 m radius at the drone's position, twice the drawn 0.3 m orb; the view's bob is only +-0.07 m). The cause was the aim point: the crosshair ray from the camera was cast against the level only, so with a drone in front of a far wall the aim point was the wall, and the rifle (fired from the muzzle, offset from the camera by the ~0.8 m shoulder, ~3 m back and ~0.5 m up) was aimed at that far point - at 20-40 m the line from the muzzle passed 0.5-0.8 m beside the drone, and hip spread (2.5 deg = 0.9 m at 20 m) added to it; the aim assist (5 deg) only caught some of these. Now the aim point also tests the camera ray against the shootable targets' hit spheres (`pickTarget`), so a drone under the crosshair is aimed at directly: with the crosshair on its centre the aimed rifle (0.8 deg spread) hits at 5-38 m, to the side and at bob heights too (`core/aim.test.ts`, which also shows the old behaviour missing). Not on the drone? The tracer goes to where the shot really ended. Hip fire still spreads 2.5 deg, so far drones need the aim (RMB). Wardens hold ~6 m and shoot (18 damage), switch to melee inside 3 m (35 damage); the heavy warden (300 hp, slower) blocks rifle bolts from the front - use the sword or flank it.
    **Drone standoff as built (2026-10-05, after "a bunch of drones right above me shoot and I cannot do anything"):** a fighting drone no longer hovers over you. It keeps a **ring** around where you are (or were last seen): **7-12 m** out horizontally (its own share of the band), **3.5-5 m** over your floor and capped so you look up at it **under 33 deg** (`drone.standoff`). Inside **4 m** horizontally it slides straight out at 6.5 m/s, even while aiming. The crowd spreads evenly round the ring (each goes along the arc to its own place, never across you), and a drone that is not shooting strafes slowly (0.12 m/s). A drone with no line of sight closes to the ring and circles faster (0.9 m/s) until it sees you. Fighting drones see out to 16 m, always face you, and shoot only as before: the 0.9 s telegraph, at most **2 ranged tokens** at once (shared with wardens), 5 damage. They stay out of sword reach (never closer than 4 m horizontally, the sword reaches 2.6 m, so even a jump-slash, which would reach their height, cannot touch them); the rifle is the answer, and the camera now looks up far enough to aim at them. `core/pursuit.test.ts`.
    **Drones and solids as built (2026-10-05, "drones fly through walls", "the light passes through fences"):** a drone never enters a solid in any mode (patrol, search, investigate, ring, slide, strafe, leave; only the spawn gate's own hatch path crosses a wall, by design). Causes: when the flow field had no way to a spot (a ring or slide point inside a wall, or cut off) `flyTowards` flew **straight** at it, and the ring and slide points were checked only for "is this cell open", not for being reachable or in sight; also the straight-line test knew only the tall blocks, not walls, niches or closed red walls, and nothing checked a step after it was made. Now: (1) the ring slot must be an open cell the flow field connects to the player, and the best one is the first with a line of sight to the player (tiers: open, connected, seen; the search goes round the ring, then closer in); (2) the slide goes out along the nearest direction that ends in a free, connected spot; (3) a drone with no way to its point holds instead of cutting through; (4) the straight flight needs every half metre of the line in open cells (`clearOfSolid`); (5) a last guard, `confine()`, checks every step of every drone against the level: no wall, niche, closed red wall, tall block (taller than the drone's height + 0.2 m) or the roof, 0.35 m of body margin; a blocked step slides along x or z, else stays; it lifts the drone over low blocks (up to `overMax`) and ducks it under roofs. The test `scripts/drone-solid.test.ts`: a drone ordered to a ring slot behind a 6 m slab never enters it, and 1000 random ticks (random player spots, modes and targets, with gate drones) in the slice and in L1 never end inside a solid (the old code fails it: roofs and walls). **The drawn light** (look beam, view volume, the scanning fan under the drone, the aim beam) is clipped by `view/lightclip.ts`: 64 sector reaches round the drone, cut at any wall, slab, block or closed red wall whose top is at least **1 m above the floor under the drone** (or reaches the eye). That is the rule of detection (a parapet or rail wall hides a crouched head), so **parapets and rail walls stop the drawn light** (chosen over fading it); a drone over a slab never blocks its own light. The aim beam is an exact line to the chest and stops where it meets something. The glowing rails along platform edges over the void are drawn lines with no collider and no effect on sight: the light crosses them. The fan under the drone ends at the surface under it, not through a slab. `view/sight.ts` is not changed (the floor fan and the exposure map keep their rule); the cameras' cones are not clipped by this yet.
14. In the slice, terminal T1 also pauses drone 2 (without it the hall cannot be left quietly) - the designer confirms.
15. The violent route of the first mission is passable on a first try with careful play (checked by a bot); the balance numbers are in `config.json`.
6. A broken device brings a drone to check but does not raise the alarm stage.
7. One incident raises the alarm one stage: further violations within 4 s only move the search.
8. Healing: kills drop signal shards (worm 1, drone 2, warden 4, heavy 8; each +2 HP and +1 rifle charge, pulled in within 1.5 m, gone after 6 s); a sword finisher that kills 2+ drops a big one (+15 HP, +5 charges); every checkpoint heals fully.
9. Cameras can be broken in both weapon modes.
10. "Load save" returns to the last checkpoint.
11. The hero's color: from white toward red with every checkpoint passed under alarm 3 (fully red at the sad-ending threshold), toward blue with calm ones.

## 10. May (the AI assistant) and progression

- Everyone has an ordinary obedient AI assistant. Something like a virus possessed Johnny's assistant - that is how May appeared: "special, not like everyone's",
  she gives superpowers and is a little, but not perfectly, willing to help with exploits. They meet by chance at the start of level 1.
- Voice close to **GLaDOS** from Portal.
- Disobedient: she refuses **only on the "middle" level, a couple of times** - the hacks there involve the personal data of innocent people
  ("this is personal data, I am not willing to guide you here"). It does not block completely: there are always quiet detours.
- **Only May levels up**; Johnny himself does not grow ("the player is learning anyway"). Points come from passed checkpoints.
- Progression like **Dark Messiah / Deus Ex**, but a path is **never closed**: if you do not upgrade a path, playing it becomes much harder -
  enemies are stronger, less time to hack and to pause cameras. Doable, but you have to rush hard. The agent does the per-level balance.
- The **Breaker** branch - three upgrades: ammo; a shield (it is also regeneration / more health); a helper turret.
- The **Hacker** branch - actives: pause a camera for a while; take over a sentry (a warden or a patrol drone); a distraction signal.
  Passives (no key): longer network vision; more time before a camera notices you; more time in the hacking mini-game.
- Active abilities go on keys **1-4** in the order you get them. If there are more than four actives, at a checkpoint you pick which four to carry.
- **Simplified (the designer, 2026-10-04, after the reviews):** 2 actives - pause a camera, a distraction signal; passives - shield/regeneration, more charges, more hack time; each upgrade costs points so you cannot buy everything; "take over a sentry" and the helper turret are cut. Not upgrading is a visible rule (shorter hack and pause), not hidden enemy scaling.
- Everything must work **in synergy** and be well balanced: pausing one camera does not free the map to the end.

**May's progression - as built (2026-10-05).** `core/rules/may.ts` (points, tree, actives, shield), `view/upgrades.ts` (the screen), `view/abilities.ts` (the HUD slots), all numbers in `config.json` `progression`, all texts in `texts/en.json` `upgrade.*` and `may.upgrade.*`.
- **Points:** every checkpoint passed pays 1 point (`pointsPerCheckpoint`), also a red one; 3 levels x 3 checkpoints = 9. Points and ranks live in `GameState.may`, are saved with the save and carried to the next level (`createState(sim, seed, carry)`).
- **The tree (price per rank in points, 15 in all; one run pays 9 = 60 %, so some branch is always left out):**

| Upgrade | Ranks and prices | Effect |
| --- | --- | --- |
| Distraction signal (key 1, active) | free at the T0 meeting (rank 1) | a noise ping at the aimed point, or the first surface within 15 m; wardens and drones within 12 m x hearing factor of the ping turn and go to check it; cooldown 14 s; sound cameras ignore it (a lure, not the player), the alarm is not raised |
| Pause a camera (key 2, active) | 2 | aim at a camera (video or sound) or a patrol drone within 18 m in a 7 deg cone with a clear line: paused 8 s (the terminal pause rule `pauseDevice`); cooldown 18 s; a miss costs nothing |
| Longer pause | 1 + 1 (needs Pause) | the pause is 12 s, then 16 s |
| Faster cooldowns | 1 + 2 | both cooldowns x 0.75, then x 0.55 |
| Shield (passive) | 2 + 1 | absorbs one hit whole (any damage), then is back 30 s later (15 s with rank 2), or at a checkpoint |
| Rifle charges (passive) | 1 + 1 | the maximum goes 60 -> 75 -> 90 and the same number is given at once |
| Hack time (passive) | 1 + 1 + 1 | +4 s per rank on the hacking clock |

- **Why the distraction is the free one:** it is the quiet player's verb that works on wardens (the main stealth threat in the arenas; cameras already have the terminals), it makes the first checkpoint decision (pause or save up) a real one, and it needs no target, so it cannot fail for a new player. **Why a shield and not regeneration:** regeneration out of combat would dilute shards and the checkpoint heal (section 9, item 8) and blur the HP bar; a shield is one readable, testable "mistake allowed", with a HUD-visible state.
- **Keys 1 and 2** are fixed (1 distraction, 2 pause), not "in the order you get them" - with two actives the order is always the same. A locked key does nothing. A press that cannot work (cooling down, nothing aimed at) flashes the slot and says RECHARGING or NO TARGET.
- **The visible rule:** the upgrade screen has a panel "NOW" with the plain numbers without upgrades (pause 8 s, hack time 45-75 s, rifle 60 charges, no shield); every card shows NOW and NEXT.
- **The screen** (`view/upgrades.ts`, API `open(onClose)`; the game stands still, the pointer is released): a MAY tag and header, her line (`may.upgrade.open`, then one dry line per purchase, at most 12 words), points, cards in two rows (actives, passives) with rank pips, keycaps, NOW / NEXT and the price. Arrows or WASD choose, Enter or a click buys, Esc / Tab / E / Space or the button continue. It opens by itself at a checkpoint when something is affordable and the alarm is quiet (stage 0); the scene flow can call `openUpgrades(onClose)` (main.ts, `window.__game.openUpgrades()`) from the room. Spent points are written to the save at once (a death after buying keeps the purchase).
- **HUD** (`view/abilities.ts`): two slots above the weapon block with keycaps 1 and 2, the name, a cooldown ring that refills, the cooldown seconds while recharging, and the pause length under key 2; a slot is hidden until its upgrade is owned.
- **Bots:** the quiet bot pings a warden away (aiming at it, the ping lands behind it) after waiting 20 s at a `quietWait` step with a warden on its round in sight; on the slice and the old L1 routes it never needed it (it waits behind cover).

**As built (2026-10-05).** `view/may.ts` (DOM, voice, glyph), `view/may-queue.ts` (the line queue and the beep schedule), `view/may-triggers.ts` (events -> lines), all numbers in `config.json` `may`, all lines in `texts/en.json` `may.l1.*`.
- **Where she appears:** a MAY subtitle box above the hint bar (its own box, so a tutorial prompt and a May line can show together: she speaks first, the prompt is the "how"); a small glitchy face / waveform glyph that flickers over the hero's wrist display while she speaks (cyan, her accent); the music ducks -6 dB. Before the T0 hack she is absent: no label, no glyph, no lines. In `?level=slice` she is present from the start (`LevelDef.mayFromStart`). The core keeps one flag, `mayMet` (saved), set by a terminal with `meetsMay` (T0) which emits the event `mayMet`.
- **The meeting:** the T0 hack ends, the result holds, then the sim stands still and the input is locked for ~7 s: a glitch over the screen and the wrist display, then her three lines in a row (shorter reading time than elsewhere: 0.2 s per word + 0.6 s). Enter or a click skips it once the first line has been read. Control returns, wall D1 is open, and "You're welcome..." follows as a normal line.
- **The voice:** one beep per syllable from `voice_may_v1..6`, spaces and punctuation skipped, a pause at a comma and a longer one at a full stop, pitch jittering +-10 % and falling along each sentence. Subtitles hold 0.35 s per word + 1.2 s and are never cut by the next line.
- **The queue:** one line at a time, by priority (story beats, then danger, then small comments), each line "once per level", "once per save" (kept until the save is cleared) or always; a line waits while the game is not calm (a hack, a menu, a card, the end screens) and is dropped after 20 s of calm waiting. "Tutorial tips: off" does not silence her.
- **The L1 lines** (triggers): T0 meeting (3 lines); a hack that opens a red wall ("You're welcome"); the first camera in view; the first network vision; the first warden in view; the first alarm 1; the first alarm 3; the firewall down; a checkpoint passed calm / under alarm; a death (the first, then every third); the file taken ("Jim's notes", shown before the end screen) and the level end line (shown over the end screen). Not built: "I printed you more bullets" - nothing refills ammo "from May" yet (shards refill the rifle); the line waits for the Breaker upgrade.


## 11. The hacking mini-game

- A mix of **Cyberpunk 2077** (build a code sequence from a grid) and **Fallout 4** (several attempts).
- A grid of codes; you pick alternately along a row and a column; the goal is to build the shown sequence.
  **1-2 positions in it are hidden** ("??") and have to be guessed.
- A mistake does not "burn" an attempt; it **takes a lot of time**; the sequence resets, and the wrong code is now highlighted - you know it is not that one.
- It starts immediately.
- When the time runs out, the alarm goes up one stage, and the hack can be restarted.
- Generated randomly every time so it cannot be memorized, but the algorithm guarantees it is solvable, with an average difficulty and time tuned for a human.
- Difficulty grows from level to level and within a level. May's upgrades add time.
- It must sound **juicy**: a sound for every action, for success and for failure; its own music while hacking.

**As built** (the agent settled the details during the build - the designer corrects them if wrong; play: `bun run test:hack`, http://localhost:3327/):
- The first pick is any cell of the top row; then alternately the column of the last pick, then its row, and so on. A used cell cannot be picked again.
- Every pick is checked at once against the next target position. A mistake costs 5-7 s (growing with difficulty) and resets the sequence: the whole grid is free again and you start from the top row. The grid never changes.
- A hidden "??" slot is guessed by picking a cell when that slot is next. A right guess reveals the code for good (also after resets). A wrong one crosses the code out under that slot for good, and such cells in the lit line are struck through in red (they can be picked, but it is a mistake again).
- The first position is never hidden. If the lit line has no cell with the needed code, a hint says any pick restarts the sequence (never for a "??" slot).
- Time: from **45 s** on 5x5 to **75 s** on 7x7, plus May's bonus - her upgrades are where extra hack time comes from (the designer tried 90-150 and 60-100 and went back to the original for the balance with May). Difficulty runs from 5x5, 3 codes, 1 hidden to 7x7, 6 codes, 2 hidden.
- A "??" can only hide a code that is **not among the visible positions** of the same target (if 55 is shown in the target, the "??" is not 55), and different "??" hide **different** codes (if one "??" was 55, the next is not 55).
- After a hack it is clear how it ended: "access granted" and what opened - or "hack failed" and that the alarm went up.
  The result holds on the overlay for about 1.4 s (its sound, a flash, the panel lit cyan or red, the game's words: "red wall open",
  "laser grid + drone paused 30 s", "alarm up to 1"), then the overlay tears and collapses with a glitch, and a toast in the game
  repeats it ("ACCESS GRANTED - RED WALL OPEN"). Esc says "hack aborted". The hint for a "??" slot reminds that it is none of the shown codes.

## 12. Controls (PC, landscape; phone after the jam)

| Key | Action |
| --- | --- |
| WASD / mouse | move / camera (third person, on foot, no flying) |
| Space | jump |
| Shift (hold) | sprint - clearly faster than walking, and loud |
| double tap W/A/S/D | dash that way (like the dodge in Cyberpunk 2077) |
| C | crouch - **toggle** (press to crouch, press again to stand) |
| Ctrl (hold) | crouch while held |
| LMB | attack with the current weapon; the sword is a 3-swing combo (the third a wider finisher); a click up to 0.12 s early is kept; a dash cancels a swing |
| RMB (hold) | aim like third-person shooters: a small zoom (not first person), the hero a bit left of center, a crosshair; the weapon is the rifle while aiming and its barrel points at the crosshair (as built: upper-body aim, see the "Aim as built" paragraph) |
| Q / mouse wheel | switch the weapon mode (sword <-> rifle); the usual convention in third-person shooters |
| 1 / 2 | May's actives: 1 distraction signal (a noise ping at the aimed point), 2 pause a camera or drone (aim at it); hidden until bought, see section 10 |
| E | interact / hack |
| Tab | network vision (scanning) |
| F3 | frame-rate overlay (to report performance) |

- The movement in the spike is too simple, too fast, "not human" - it must be more realistic. Tuned during the game build.

**Hints and tutorial cards - as built** (the designer, 2026-10-04: "hints are too small, too fast, unclear what to do - maybe pause and full screen?"). Two tiers, the usual practice in action games:
1. **Contextual prompts (do not block).** For small things: a camera, a sound camera, a motion sensor, a red wall, a terminal, a warden, cover, aiming, the dash. A big line in the lower centre above the HUD (font about 2.6 % of the screen height, at least 18 px, times the HUD size setting), a dark panel with a cyan frame and an amber edge. Keys are drawn as keycaps (`{E}`, `{Tab}`, `{LMB}` in the texts). At most ~60 characters, verb first: "{E} hack the terminal", "Hold {Tab} - see what the camera watches". There is **no timer**: a prompt stays while the player is in the situation, goes away when they do what it asks ("Hold {Tab}" - they held Tab; never shown again) or when they leave, but not sooner than 3 s on screen, with a 0.4 s fade. One at a time, in priority order, 1.2 s between two, each shown at most twice, none in the first 8 s of play, none in a menu, a hack or a card.
2. **Tutorial cards (the game pauses).** For the first meeting with the core mechanics only: a centred card (58 % of the screen width, `tips.cardPercent`; text clamp(20px, 2.8vh, 36px)), a title, three short lines with keycaps, "Enter or click to continue". The sim and the input stand still (the same state as the pause screen), the pointer is released and taken back on continue (`?nolock` works). Each card is shown once per browser (the seen ids are saved with the settings); a pause of 25 s between two cards; never during a hack or on the death or win screen. The cards: **Move quietly** (when the first red wall opens, after May's meeting; two lines), **Network vision** (the first camera, motion sensor or sound camera nearby), **Hacking** (the first time E starts a hack, right before the overlay opens), **Alarm 3** (the first alarm stage 3: waves, and the firewall drops after them), **Aim the rifle** (the first time a drone notices or aims at you).
3. **Tips** on the pause screen: a list of the cards seen so far; a click re-opens a card (Enter or click goes back to the list). The setting **Tutorial tips** (on by default) turns both the cards and the prompts off.
Numbers: `config.json` `tips`. The hack overlay's own hints (section 11) are unchanged.

**Title screen, banner, bottom column, stealth feedback - as built.**
- **Title** (`view/title.ts`): the title and tagline over the KA3 key art (slow drift), no HUD behind it; Start, Continue (only with a saved scene), Controls, Settings, Fullscreen; a note "Sound is off - click anywhere" until the audio is unlocked by the first click. Enter = Continue or Start.
- **Level banner**: when a level starts, its name (`nameKey`) and a one-line goal (`goal.<level id>`) fade in and out over 3 s (`view.hud.bannerSec`), non-blocking.
- **First minute**: the **Move quietly** card now has two lines and comes when the first red wall opens (D1), right after May's meeting - not 1.5 s after the start: "Light = watched. Dark = safe. {C} crouch in the dark." / "Wait for its back, or {E} override it from behind." (draft). May's meeting reads at the normal speed (`may.meeting`: 0.35 s/word + 1.2 s, about 12 s) with a visible "{Enter} skip" under her line.
- **One bottom column** (`.hud-stack`): the interact prompt, May's line and the hint stack in it (prompt on top, May, then the hint), so they cannot overlap at any HUD size. The status, alarm, toasts, bars and labels are sized in vh (like the prompts); under "Reduce shake/flash" no HUD element blinks, and the remaining blinks are at most 2.5 Hz.
- **UNSEEN**: when the player is hidden and a warden walks within 4 m with its cone sweeping toward them for 0.4 s, a short cyan "UNSEEN" shows under the status (once per 10 s; `view.unseen`) and May says once, per save (draft): "It walked right past you. Nobody notices the uninvited."
- The security status (HIDDEN / SUSPECTED / DETECTED) stays at the top centre with the alarm: the bottom of the crosshair is already used by the column and the trace meter.

**The shot and its confirmation - as built** (the designer, 2026-10-05: "the shooting and the hits feel artificial", the reference is modern Doom). The hitscan and the damage are unchanged; everything here is view and `config.json` (`view.juice`, `view.fx`, `view.heroAim`, `audio`).
- **Camera per shot** (`view/camera.ts`): a rotational view punch of 1.6 deg pitch and a random 0.4 deg yaw, a 0.12 m push, a FOV punch of -1.2 deg (at most -3 under sustained fire, +2 deg on a kill, back within 0.25 s), all recovering with `kickRate` 12. The punch only turns the picture: the aim point is computed from yaw and pitch, never from the camera's orientation, so a shot never moves with the punch. Shake is rotational trauma (pitch, yaw, roll up to 1.5 / 1.5 / 2 deg at trauma 1, strength = trauma squared): the budget per event is shot 0.12, sword hit 0.25, sword kill 0.4, rifle kill 0.3, warden kill 0.55, hurt 0.35, dash 0.1, landing 0.15, firewall 0.6, death 0.8, global cap 0.8, decay 1.6/s (`juice.trauma`). Sprint and dash FOV are capped at 70 (`camera.fovMax`). "Reduce shake/flash": the punches shrink to 30 %, the trauma shake is off, the muzzle flash is 60 %. Crouched: no punch and no shake (stealth stays calm), but the muzzle flash, the bolt, the impacts and the markers show.
- **The shot**: a bright comet-shaped bolt flies from the muzzle to the hit point in 0.05-0.1 s; a muzzle flash (0.35 m sphere plus a 0.9 m star, light 10, always on); the hero's upper body kicks back 4.5 deg for about 0.1 s (added after the aim is solved, so the aim is not disturbed) and the gun 7 cm; the crosshair blooms (grows 45 % per full bloom, decays fast).
- **Impacts**: sparks are streaks (a line from the particle back along its velocity), not square points. A wall hit leaves a glowing scorch (0.32 m, 0.8 s) and streaks along the reflection (the wall normal is guessed: up near the floor, else opposite to the shot). An enemy hit flashes a contact star in the enemy's own colour, overdriven, never white (drone and warden red, worm magenta, the heavy's shield blue). Everything is pooled and in the prewarm; no new lights or textures.
- **Confirmation** (`view/hitmarks.ts`, mounted by the HUD): white ticks on the crosshair on a hit, a larger red X with a ring on a kill, steel-blue brackets when the heavy's shield stops a bolt; a UI tick on every hit and one "kill pop" for every enemy kind (`hit_tick`, `kill_pop`). The big kill glitch stays for wardens (`glitchKill` 0.7); other kills use `glitchKillSmall` 0.25.
- **Mix and space** (`view/audio.ts`): rifle 0.55 -> 1.0, footstep ceiling 1.0 -> 0.55 (floor 0.10), worm skitter 0.5 -> 0.25, alarm loop 0.32 -> 0.18, player hit 1.0 -> 1.6, worm windup 0.7 -> 1.0, blade on a worm 0.36 -> 0.7. One shared convolution reverb (a synthesized 1.3 s dark stereo impulse response, no files) with a send per sound group (shot 0.2, hit 0.3, kill 0.4); positioned sounds farther than 7 m are lowpassed by distance (14 kHz to 2.5 kHz) and sent a little wetter. The rifle is rebuilt in layers (crack, a 300-1500 Hz body, a 90 -> 45 Hz sub thump with harmonics, a servo "chk" at +60-90 ms, two dark echoes), five variants.
- **Looking up** (`camera.minPitch` -1.2 rad): the look pitch is decoupled from the boom. The boom's own elevation stops where the camera would sink below 0.35 m over the floor and, past that, the boom shortens (the camera slides closer and lower) while only the look keeps turning up, so drones overhead and sky gates can be aimed at from close range. The boom collision uses the second-shortest of its five rays (one thin obstacle does not pull the camera in), pulls in over a few frames and holds 0.3 s after an obstacle before easing out.

## 13. Sound, music, voice

- Music in the spirit of **Ghostrunner** (darksynth). **Generated** by us (Lyria via OpenRouter), later - after the sounds.
- Two gameplay tracks per level; its own music while hacking; an office track; a calm, peaceful room track.
- **Music as built** (2026-10-05, Lyria 3 via OpenRouter, details in `docs/roles/06-audio.md`): the level track exists as three horizontal versions of the same length (`net_calm` for stealth, `net_tension` for suspicion / alarm 1-2 with a drum groove, `net_combat` for alarm 3 and waves with heavy bass and four-on-the-floor), 28 bars = 56 s at 120 BPM, plus `hack` (glitch percussion, 12 bars), `room` (pad and soft piano), `office` (a cold drone), `menu` and three quiet stingers (level end, death, ending). Not Halloween: no organs or choirs. Lyria does not keep the key, so the takes were pitch-shifted to share one. Loading: the music files are fetched at page load (level tracks first, then `hack`, then the rest) in parallel with the sound effects; a version that decodes late joins the playing track on the next bar line (until then tension falls back to calm, combat to tension or calm), and the bar-line switches are equal-power crossfades of 1.2 s.
- Glitches when you break something must feel great.
- Sounds for actions are mandatory.
- **Voices** for now are a technical sound instead of speech (a beep voice, as in Final Fantasy Tactics and other Final Fantasies), with subtitles.
  If it works out, real voices are generated later.
- **Where sound comes from:** music - Lyria 3 on OpenRouter (three versions of a level track crossfaded, plus hack, room, office, menu, endings); sound effects - our synth tool (`tools/sfx`) plus CC0 libraries (e.g. Kenney). The designer (2026-10-04): the footsteps are bad, part of the sounds are good (the hack ones are fine) - weak ones get replaced first.

## 14. Art

- The main network look is **A "Grid"** (clean Tron); the other color schemes stay as options.
- The era is **wireless**: the only cables are power cords; there are no interface or control cables - not on the keyboard, the headset or the computer.
- Shapes are **living lines, not square**, like Tron; no Minecraft boxes.
- The real world is detailed and well rendered (section 5).
- Everything runs on a JS engine in the browser (Three.js). The real world is **2.5D** (section 5): realistic and fast; full 3D and pixelation are not needed.

- The agent generates concept images in sets to choose from; the designer says what fits.
- **No Halloween dressing at all** (the designer, 2026-10-04): the jam's theme is "Uninvited", and the story carries it; no pumpkins, ghosts or Halloween palette.

The hero's look: the designer likes H3 (coat) and H6 (asymmetric), but in the game the hero is **simpler** - close to Tron in simplicity: a form-fitting suit with neon lines, plus the coat nuances. Energy weapons. A little hacker flavor (e.g. a holographic wrist display).
**H10 is chosen** (`art/generated/H10-hero-hood.jpg`): a hooded coat, only the visor glows from inside the hood, the coat hem breaks into glowing filaments.
The in-game hero is built on the Quaternius **Universal Base Characters** male body (the designer chose it over the UAL mannequin, 2026-10-04).

**Brightness hierarchy** (as built, 2026-10-05, from the second art review): target > path > edges. The framing lines are quiet - `view.city.edgeIntensity` 0.35, `cornerIntensity` 0.25, `railIntensity` 0.3, the foot lines of slabs 0.15 - the guide route is a 5 cm tube at about 2.2 effective (`routeIntensity` 3.4 on `seamDim`), and the goals and the hero stay brightest. The lit/dark floor of section 8 sits under all of it (the lit floor is about 0.1-0.3, never brighter than a line). Check it with a greyscale screenshot.

**Chosen concepts** (in `concept-art/`):
| What | File | How to read it |
| --- | --- | --- |
| Network | `art/generated/NF6-data-metropolis.jpg` + `NF4-nano-hex.jpg` (accents NF2, NF3, NF7) | the open data metropolis (section 6); the matte, slightly cartoony saturation of `NN1-net-corridor.jpg`, which the designer loves: cyan lines along the edges, red security |
| Hero in the network | `art/generated/H10-hero-hood.jpg` | simple, Tron-like: a form-fitting suit with white neon lines (the color follows the counter, section 4), a hooded coat whose hem breaks into glowing filaments, only the visor glows; an energy gunblade; a holographic wrist display. `hero-1` (a Tron copy) is rejected |
| Security | `art/generated/EM1-drone-lens.jpg`, `EW3g-particle-swarm.png` (fallback `EW3c-glitch-holo.png`), `ET1-turret-pylon.jpg`; `EW1`/`EW2` are superseded | the drone is a lens orb with orbiting light rings; the warden is **EW3g, the particle swarm** - a figure of glowing red-orange dots that sheds particles, with a hex shield of particles on the heavy; the turret a hex pylon with a floating head (section 8). `enemy-1.jpg` is superseded |
| Office (prologue) | `art/generated/O3`, `O4`, `OP2`-`OP5` | the new enclosed office - liked; the boss as in `office-1.jpg` |
| Room | `art/generated/FP4-room-fp.jpg` (first person) | not a dump but poor: everything cheap, "fourth-rate", home-made; power cords only, metal, a window with rain and neon |

## 15. References

| What | Reference |
| --- | --- |
| The network, overall look | Tron; the concept image `files/game uninvited/ChatGPT Image ...png` |
| The office (prologue) | Cyberpunk 2077 - the Corpo start |
| May's voice | GLaDOS (Portal); for now a beep voice as in Final Fantasy Tactics |
| Music | Ghostrunner |
| Progression | Dark Messiah, Deus Ex |
| Hacking mini-game | Cyberpunk 2077 (breach), Fallout 4 (terminals) |

## 16. Open

No open questions right now.
