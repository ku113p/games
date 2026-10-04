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
As built (`levels/l1.ts`, the default level; `?level=slice` for the old test): A1 got a second, roofed exit from the plaza's north-west corner into P1 (away from warden 1's street); T1 sits on the south bank by the ramp (from the balcony its 30 s pause ran out before the low bridge); in A3 the order is T3 (opens D2) first, then T2 (pauses the tower cameras and drone - terminals can now pause cameras) right before the vault; one drone per arena as a high spotter; wardens: 1 in A1, 1 in A2, 2 in A3 (more blocked the quiet path - to revisit with the new roles); bridges are one cell wide light bridges.

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
- **Breaker** - go straight through and break everything. **Much harder**: the alarm grows, waves come and wear you down, the firewall drops only at the very end.
- **Hacker** (stealth + hacking) - pass unseen, pause the security, hack. Any stealth violation or attack is **punished hard**.

## 8. Stealth and security

- While you are not seen, you are not seen.
- **Cameras:** each has a view cone, turns in a repeating pattern, not too fast - there is always a way to slip past.
  There are **video-only** and **sound-only** cameras, and they look different. Cameras **cannot be hacked**, but can be **paused**.
- **Noise:** running, jumping, fighting.
- **View ranges and noise are not shown without network vision** (the designer's decision, 2026-10-04): the cones of cameras, drones and wardens, sensor zones and the radius of your noise show only in network vision. Without it you read the direction from the devices themselves (a camera's lens glow, a drone's eye, a warden's visor), and when something starts noticing you, an on-screen suspicion indicator points at the source.
  As built: a camera and a drone always show a glowing lens / eye and a short look beam; the view range (the cone and its grid on the floor) fades in with network vision, and so do a sound camera's hearing ring and the noise rings. The floor grid stops where the device's line of sight stops - at walls, and behind cover, server blocks and steps wherever a crouched head is hidden, exactly as the detection rule sees it. Around the crosshair each watcher that is noticing you gets an arc turned toward it that fills with its suspicion (amber), red and blinking once it has spotted you.
- Hacking keeps your stance: start a hack crouched behind cover and you stay crouched (and hidden) through it and after it.
- **Motion sensors:** the sensor itself is a small blinking dot on a wall, noticeable up close if you look; its **zone** shows only in network vision (a translucent red volume). It trips on **sprint, dash and jump** inside the zone; walking and crouching pass.
  A careless, running player always trips them.
- **Enemy roles** (the designer, 2026-10-04, after playing): **drones watch** - they spot you and call the others, and shoot only very weakly, and die from 1-2 rifle shots; **wardens watch and attack** - the main guards and fighters, there are more of them; **worms crush by mass**; **turrets** hold fixed key points. Waves are big, zombie-like: at least 4-15 enemies per wave. Wardens are active: they shoot from range and switch to melee up close.
  Looks (chosen 2026-10-04, `art/generated/`): drone **EM1** (a lens orb with orbiting light rings), warden **EW1** (a slender sentinel with an energy halberd; not "square logs"), heavy warden in waves **EW2** (an enforcer with a hex energy shield), turret **ET1** (a hex pylon with a floating rotating head).
- **Varied guards - sentries separate from drones** (the designer's decision, 2026-10-04):
  - **Wardens** - walking guard programs: stand at a post or walk their beat, turn their heads, go to check a noise and come back. A forward cone + hearing; they turn slowly, so you can sneak up from behind.
  - **Drones** - patrol large spaces along long smooth routes up high; at an alarm they fly out of the spawn gates.
  - Wardens as built: an angular armored figure with a hex "lantern" helmet and red-orange lines. On the beat they stand, check racks, glance aside, with varied pauses; suspicious - stop, turn to the cue, "?"; investigate - walk to the cue, search ~4.5 s, return; at alarm 1-3 they search the alarm area. Cone 10 m, follows the head; they hear noise; turn slowly (you can come up behind). Up close (1.6 m in front) a warden notices you even crouched - the designer confirms. Fight: a telegraphed melee strike (a dash dodges it) or a slow aimed arm shot from range; the sword takes 3 hits, the rifle 8. A terminal can pause a warden; May's "take over" ability has a hook.
- **Turret robots:** shoot, and can spot you. One type (ET1), placed sparingly: the core arena of L1 and the L3 finale.
- **Non-lethal takedown** (the designer asked for a non-lethal Hacker tool, 2026-10-04): sneak up behind a warden and press E - an override powers it down for a while (no noise, no kill; it reboots later, or wakes at an alarm). It does not count as a kill for the story.
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
Aim as built: RMB draws the rifle (the sword comes back on release), walk speed only, Q ignored, the spread tightens from 2.5° to 0.8°; the camera eases in to 2.6 m with FOV 50 and slower mouse.

**One weapon, "two in one":** an energy gunblade, sword and rifle in one (as the H10 hero carries). Two modes:
- **An energy sword** (a blade of light) - hits in a 180° arc, close and at short-to-medium range.
- **An energy rifle** (a glowing charge instead of a magazine) - less damage, but fires faster and straight; a small spread cone, so some bullets miss.

**Ammo** is given at the start and after that only generated by May.

**As built in the slice** (the agent decided where the design was silent - the designer confirms or corrects; play: `bun run play`, http://localhost:3330/):
1. Shift (hold) sprints (loud); a dash is a double tap of a direction (a short invulnerability). Decided after the designer played: Shift used to do both and it was unclear.
2. A laser grid hurts and raises the alarm; a terminal can pause it for 30 s; its posts can be broken.
3. At alarm 3 the firewall drops after three cleared waves; waves keep coming after that.
4. A terminal that does not open a wall pauses its lasers and drones for 30 s.
5. Hiding spots are **tall server blocks** you crouch behind (the designer chose them over niches: clearer without explanations). Height 1.4 m: crouched you are hidden, standing your head and shoulders show.
12. Alarm and wave drones **fly in through visible spawn gates** in walls and ceilings (the light ring turns red and glitches, shutters open, a sound) instead of appearing from nowhere; gates within 12 m of the player are not used; leaving drones fly back into gates.
13. Before every shot a drone **holds still for 0.7 s and aims** (visible and audible) - the shot can be dodged; losing line of sight cancels it.
14. In the slice, terminal T1 also pauses drone 2 (without it the hall cannot be left quietly) - the designer confirms.
15. The violent route of the first mission is passable on a first try with careful play (checked by a bot); the balance numbers are in `config.json`.
6. A broken device brings a drone to check but does not raise the alarm stage.
7. One incident raises the alarm one stage: further violations within 4 s only move the search.
8. No healing (the shield/regeneration comes with May's upgrades).
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
| RMB (hold) | aim like third-person shooters: a small zoom (not first person), the hero a bit left of center, a crosshair; the weapon is the rifle while aiming |
| Q / mouse wheel | switch the weapon mode (sword <-> rifle); the usual convention in third-person shooters |
| 1-4 | May's abilities |
| E | interact / hack |
| Tab | network vision (scanning) |
| F3 | frame-rate overlay (to report performance) |

- The movement in the spike is too simple, too fast, "not human" - it must be more realistic. Tuned during the game build.

## 13. Sound, music, voice

- Music in the spirit of **Ghostrunner** (darksynth). **Generated** by us (Lyria via OpenRouter), later - after the sounds.
- Two gameplay tracks per level; its own music while hacking; an office track; a calm, peaceful room track.
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

**Chosen concepts** (in `concept-art/`):
| What | File | How to read it |
| --- | --- | --- |
| Network | `art/generated/NF6-data-metropolis.jpg` + `NF4-nano-hex.jpg` (accents NF2, NF3, NF7) | the open data metropolis (section 6); the matte, slightly cartoony saturation of `NN1-net-corridor.jpg`, which the designer loves: cyan lines along the edges, red security |
| Hero in the network | `art/generated/H10-hero-hood.jpg` | simple, Tron-like: a form-fitting suit with white neon lines (the color follows the counter, section 4), a hooded coat whose hem breaks into glowing filaments, only the visor glows; an energy gunblade; a holographic wrist display. `hero-1` (a Tron copy) is rejected |
| Security | `art/generated/EM1-drone-lens.jpg`, `EW1-warden-sentinel.jpg`, `EW2-warden-enforcer.jpg`, `ET1-turret-pylon.jpg` | the drone is a lens orb with orbiting light rings; the warden a slender sentinel with an energy halberd (EW2 the heavy with a shield); the turret a hex pylon with a floating head (section 8). `enemy-1.jpg` is superseded |
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
