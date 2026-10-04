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

**The hero's color.** At the start the neon lines on the hero's suit are **white**. Over the game, depending on decisions, they shift more and more
toward **red** (the evil path) or **blue** (the good path). The player sees which ending they are heading for.

The color is the visible hint of the ending counter and has no rules of its own: every checkpoint with a 3rd-level alarm shifts it toward red, every checkpoint without one toward blue. The counter decides the ending.

## 5. The real world

Made in **2.5D**, **well**: a generated picture of the scene + shader effects (rain, flickering neon and screens) + clickable props on top. There is no animated character.
Engine test: this is both realistic and fast (`tests/engine-room/`). Two scenes:
- **The office (prologue)** - a middle manager's cubicle; reference: the Corpo start of **Cyberpunk 2077**. Done **very well**: it opens the game.
  The office is **enclosed** (a small room, no huge open space) so it does not overload the engine.
- **The junkyard room** - one ugly little room, truly awful, obviously made of sticks and junk. Futuristic: cables, wiring. Done **fairly well**.

**The real world is seen in first person**: the player looks through Johnny's eyes (in the room and in the office). Johnny himself is drawn minimally or not at all.
The real world exists so the player identifies with the hero; almost no actions are expected from him here.
No walking. An action is a click on an object; the response is scripted, with no character animation (a camera move, a picture change, a fade, a sound).

**What can be done in the room.** Every time the same: drink water, eat, read the news on a cheap old tablet (scuffed, cracked, matching the room), look out of the window at the street, cry.
Plus something special between levels: after level 1 - eat from the delivery; after the middle level - news of mass layoffs; in the finale - the parcel (section 4).

**Going into the network** - from the computer: click the wireless VR headset that lies on the desk by the computer, + confirm. No wired headphones.

Why the room: Johnny periodically disconnects from the network and returns to reality - the player must feel that reality is different.
It is a pause between games: life is bad, but there is some life. Mood: "yes, in the gutter, but really not that bad";
the player should think "everything around is shit, and yet this thing still works".

## 6. A network level

- The network is **not a real place** - it is a representation of how Johnny hacks the system.
- Levels are hand-made, not generated. Large (10-50x the spike), **corridor-like**, more linear, not flat, no empty spaces.
- Corridors cannot be passed calmly by disabling one thing: e.g. a camera must be paused and a robot hacked at the same time,
  or you are seen and have to shoot your way out. Maybe lasers too.
- **Winning a level:** reach the end and take the artifact (a representation of a letter/file).
- **Losing:** health runs out.
- **3 checkpoints** per level; passing one gives May's upgrade points.
- **Saving:** checkpoints + ordinary saves, just in case.
- **On death** - a choice: load a save or restart the level.

## 7. Two paths

There are **two** paths - stealth and hacking are merged, otherwise too many mechanics:
- **Breaker** - go straight through and break everything. **Much harder**: the alarm grows, waves come and wear you down, the firewall drops only at the very end.
- **Hacker** (stealth + hacking) - pass unseen, pause the security, hack. Any stealth violation or attack is **punished hard**.

## 8. Stealth and security

- While you are not seen, you are not seen.
- **Cameras:** each has a view cone, turns in a repeating pattern, not too fast - there is always a way to slip past.
  There are **video-only** and **sound-only** cameras, and they look different. Cameras **cannot be hacked**, but can be **paused**.
- **Noise:** running, jumping, fighting.
- **Motion sensors:** hard to see by default; in scanning mode (network vision) they show as a small blinking light.
  A careless, running player always trips them.
- **Patrols are drones.**
- **Turret robots:** shoot, and can spot you.
- Almost all electronics can be hacked (except cameras). Several nearby sensors can be disabled at once with an ability.
- **Network vision** is the scanning mode: shows the security, links, sensors. It has a **cooldown, but a short one**. Held too long, it calls the security.
  It is upgraded; mostly needed by the Hacker.

## 9. Alarm and the Breaker

The alarm rises **gradually**: kill a camera - someone always comes to check; more violations - a higher alarm.
Alarm levels 1 and 2 last for a while and then **decay**. Level 3 does not decay: from then on there are only waves, passable only by force. Three levels:
1. A couple of drones fly in and search a large area. You can quickly hide in places they cannot reach and wait it out.
2. More drones, searching almost everywhere.
3. Nowhere to hide - you have to fight right away. Waves come; the firewall drops only at the very end.

**Two weapons:**
- **A sword** - hits in a 180° arc, close and at short-to-medium range.
- **An assault rifle** - less damage, but fires faster and straight; a small spread cone, so some bullets miss.

**Ammo** is given at the start and after that only generated by May.

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
- The **Hacker** branch - actives: pause a camera for a while; take over a sentry (a patrol drone); a distraction signal.
  Passives (no key): longer network vision; more time before a camera notices you; more time in the hacking mini-game.
- Active abilities go on keys **1-4** in the order you get them. If there are more than four actives, at a checkpoint you pick which four to carry.
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

## 12. Controls (PC, landscape; phone after the jam)

| Key | Action |
| --- | --- |
| WASD / mouse | move / camera (third person, on foot, no flying) |
| Space | jump |
| Shift | dash |
| C | crouch - **toggle** (press to crouch, press again to stand) |
| LMB | attack with the current weapon |
| Q / mouse wheel | switch weapon (sword <-> rifle); the usual convention in third-person shooters |
| 1-4 | May's abilities |
| E | interact / hack |
| Tab | network vision (scanning) |

- The movement in the spike is too simple, too fast, "not human" - it must be more realistic. Tuned during the game build.

## 13. Sound, music, voice

- Music in the spirit of **Ghostrunner** (darksynth). **Generated** by us (Lyria via OpenRouter), later - after the sounds.
- Two gameplay tracks per level; its own music while hacking; an office track; a calm, peaceful room track.
- Glitches when you break something must feel great.
- Sounds for actions are mandatory.
- **Voices** for now are a technical sound instead of speech (a beep voice, as in Final Fantasy Tactics and other Final Fantasies), with subtitles.
  If it works out, real voices are generated later.

## 14. Art

- The main network look is **A "Grid"** (clean Tron); the other color schemes stay as options.
- The era is **wireless**: the only cables are power cords; there are no interface or control cables - not on the keyboard, the headset or the computer.
- Shapes are **living lines, not square**, like Tron; no Minecraft boxes.
- The real world is detailed and well rendered (section 5).
- Everything runs on a JS engine in the browser (Three.js). The real world is **2.5D** (section 5): realistic and fast; full 3D and pixelation are not needed.

- The agent generates concept images in sets to choose from; the designer says what fits.

❓ The hero's look in the network - pick from `art/generated/H1`-`H6` (ninja, techwear, coat, cables, home-made armor, asymmetric) or say what to mix.

**Chosen concepts** (in `concept-art/`):
| What | File | How to read it |
| --- | --- | --- |
| Network | `art/generated/NN1-net-corridor.jpg` | a **narrow enclosed corridor**; the designer loves the **matte saturation, slightly cartoony**: cyan lines along the edges, red security - a laser grid, a drone's camera cone, a hack terminal in the wall |
| Hero in the network | - | `hero-1` is too direct a copy of the Tron suit, rejected. The hero must be **between Tron, Ghostrunner and Cyberpunk**: armor and gear, only some seams glow (white - the color follows the counter, section 4), the helmet hides the face |
| Security | `enemy-1.jpg` | glossy black drones with a red ring and a single red eye |
| Office (prologue) | `art/generated/O3`, `O4`, `OP2`-`OP5` | the new enclosed office - liked; the boss as in `office-1.jpg` |
| Room | `room-2.jpg`, **but without the garbage** | not a dump but poor: everything cheap, "fourth-rate", home-made; cables, metal, a window with rain and neon |

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

1. The hero's look in the network: pick from `art/generated/H1`-`H6` or say what to mix (section 14).
