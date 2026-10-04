# Uninvited - jam plan

Deadline **2026-10-12 21:00 UTC**; we submit on the morning of the 12th. 8 working days, 3 levels (beginning, middle, end),
two paths (quiet, violent), two real-world scenes (office, room). The riskiest part is the real world: animated, voiced characters.
The designer designs and plays; the agent builds (fast, several things in parallel). The bottleneck is decisions and playtesting, not code.
Every evening: **can someone play it start to finish right now?** If not, that is the next task.

## Day 1 - Sat 10-04: the core on one corridor
Goal: one 1-2 minute stretch (a corridor with cameras, a sensor, a patrol and a locked door) that can be passed both ways - quiet (stealth + hacking) and violent.
- Designer: answer the first block of open questions in `DESIGN.ru.md` (section 15, items 1-9).
- Agent: rebuild the spike into that corridor; the new look (living lines, no boxes, a proper humanoid); a first rough hack.
- Done when: both paths take the corridor in under 2 minutes and feel different.

## Day 2 - Sun 10-05: is it fun + style
Goal: the corridor is fun to replay, the style is fixed.
- Designer: play the corridor many times both ways; say what is boring. Write the art guide (palette, shapes, camera, references)
  and the sound guide (mood per scene, references, prompts). If the core is boring - change it today, not on day 4.
- Agent: tune by feedback; more human movement; the hacking mini-game v1; cameras and the alarm with waves.
- Done when: you want to play the corridor once more; both guides are written.

## Days 3-5 - Mon 10-06 to Wed 10-08: content and the full loop
Goal: menu -> office prologue -> room -> level 1 -> room -> level 2 -> room -> level 3 -> one of two endings -> back to menu.
- Designer: describe each level (rooms, corridors, the quiet and violent routes, enemies, what the AI refuses); story texts; generate music.
- Agent: the real game project (core/view/input, tests); the three levels built in parallel from the descriptions; upgrades;
  the two real-world 3D scenes (office prologue - the most polished scene; the room) with animated, voiced characters;
  tutorial built into level 1; art and sound by the guides.
- Mon evening: the whole loop playable, even if rough. Wed evening: **feature freeze** - new ideas go to `IDEAS.md`.

## Day 6 - Thu 10-09: the build and other eyes
- Upload to itch (draft page). Check it in a browser on another PC.
- 2-3 people play silently; the designer watches where they get stuck. Agent fixes what they hit.

## Days 7-8 - Fri 10-10 to Sat 10-11: polish
- Juice: shake, particles, a sound for every action, smooth transitions.
- Balance: the first minute is easy.
- The itch page: screenshots, GIF, two-line description, controls, the credits list.

## Sun 10-12 - submit in the morning UTC
After that only bug fixes (jam rule).
