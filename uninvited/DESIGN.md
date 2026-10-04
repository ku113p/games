# Uninvited - design document

> **How to read.** Plain text is **decided** (recorded from the designer's words, 2026-10-05). A line with **❓** is **open** and needs the designer's answer; all ❓ are collected in section 12.
> The designer works in the Russian copy `DESIGN.ru.md`; the agent carries every change over to this file, which is the reference for the code.
> The old design (the cyber network, stealth, hacking, the real world) was **replaced entirely** on 2026-10-05; it stays in git history (commit `ae74371`).

---

## 1. Core

Halloween. A gloomy (not scary) mansion of a monster-hunter family. The hero is the family's heir.
A letter is slipped under the door: "Midnight. Wait. Now it's our turn." At midnight the clock strikes, something scratches at the door - and monsters pour in from everywhere: windows, doors, fireplaces, cracks in the floor.
Combat only, survive: the hero **retreats** floor by floor, upwards, to the roof, and escapes by helicopter.
The ending: from the helicopter the mansion glows in every window - the monsters are partying in your house. First they were the uninvited; now the uninvited one is you. There is no going home.

Third person, browser, PC, keyboard and mouse.

## 2. The core feeling - retreat

- Enemies **press**, the player **falls back**. Not Doom's "push forward": the pressure must make the player want to retreat.
- Where to retreat is broadly clear (up through the house). But you cannot simply leave: on the way you must, say, raise a portcullis, and cut down whatever climbs in meanwhile.
- Narrow spots are the best moments: pinched front and back, no stepping back, you must break through.
- Pacing is a **continuous flow** that drives its own rhythm: build-up -> peak -> relief (like the Left 4 Dead director). Sometimes the flow presses on purpose so the player wants to fall back.

## 3. The weapon - a gunblade

- **One weapon, sword and gun at once** (a gunblade). Our own, long, a hunter's; inspired by the Final Fantasy 8 gunblade, not a copy.
- **LMB is always the sword.** **Hold RMB - aim, it is a gun, LMB shoots.** No weapon switching.
- **The gun charges only from monsters:** a sword kill charges the gun (picked up automatically). No ammo on the level. Reload exists.
- Why both modes: the sword is for the crowd; the gun for single targets you cannot reach; only the gun takes ghosts; bats are fast and hard to hit with the gun, but you can always jump up to them and cut them in the air.
- **Start:** the gun is empty, only the sword. A sword kill shows a hint: the gun is charged. This must be taught at the start.
- ❓ Lore: what the gun shoots (monster blood? something else) - the designer decides later.
- **Getting out of a crowd:** no dodge. Clear yourself with the sword. One skill: a **wide circular sword strike** on a long cooldown.
- The shooting feel from the old build stays (camera kick, FOV punch, trauma, bolts, hit marks, the "tu-tu-tu" sound - the sound gets a light rework).

## 4. Health and death

- **Medkits lie along the retreat path.** No other healing.
- **Death restarts the current stage** (not the game, not the whole floor). Quick.

## 5. Enemies

Mostly a crowd of weak ones that overwhelm by mass. About 10 % attack from range. All numbers (HP, speed, attack interval, waves) live in one config; balance comes later.

| Role | Who | Behaviour decided |
| --- | --- | --- |
| Swarm | rats, spiders, beetles | fast, on the floor, must be clearly visible |
| Infantry | zombies, skeletons | come in crowds |
| Flyers | bats | fly in (through windows), bite and fly off; fast, hard to hit with the gun; **you can always jump up to them and cut them with the sword in the air** |
| Flyers | ghosts | come **through walls**; **gun only**; only a few |
| Ranged (~10 %) | witches (throw potions), gremlins/goblins (throw things) | attack from range |
| Heavy | the tank (as in Left 4 Dead) | just cut/shoot it down; weak spots (eyes, belly - more damage); **grabs the hero, hits a few times and throws them**; **one per level, near the level's end** |

- The look: concepts `MO-a...j`, all approved.

## 6. Levels

- **3-4 floors, 3-5 minutes each.** Floors differ by **how the monsters come**, not by a separate style.
- **L1 - the hall.** A wide hall: the tutorial, then the first raids; it slowly prepares you to leave into the corridor. The end of L1: leave the hall through a corridor up to the second floor; the corridor is harder, faster reactions.
- **L2 - the second floor.** Corridors, real small rooms, the library. The key moment: a corridor so packed you cannot just walk through - you must **cut your way forward with the sword** while a hard-to-kill wave pushes from behind; you keep going deeper.
- ❓ L3 (and L4 if any) - the designer sorts it out later.
- **The finale - the roof.** Hold out: monsters climb from everywhere, the spawn points multiply, you fall back to the centre. At first the helicopter is **gone** - someone already flew off in it. Then the helicopter sound slowly approaches ("is someone really coming for me?"). It saves you when there is no time left at all. Reference: the last mission of Warcraft III - at first you are in control, by the end it is total hell, and only the timer saves you.
  - **The timer is hidden.** On death only a percentage shows: "you got 80 % of the way".
- Broken doors the monsters come through are impassable (burning, collapsed, webs, roots). Windows are visible. Fun antourage: hunter portraits, trophies, weapons on the walls.
- **The L1 layout - option A "Long Hall"** (the designer, 2026-10-05; sketch `art/halloween/L1-A-long-hall.jpg`). A 28 x 52 m hall on one axis. The letter draws the player to the front door, the horde enters there; the retreat goes through **clear fallback lines** (fallen chandelier -> overturned table -> dais), a medkit behind each. On the dais - the **portcullis crank** under pressure. Then the hunters' gallery narrows to 4 m (a pinch: front and back). **The tank breaks the wall out of the burning kitchen** before the stairs, the horde behind. Up the stairs -> L2. About 4:20. Stages (restart points): start, C1, C2, C3.
- **Who is in L1:** rats, zombies, bats, **about 4 ranged** (witches; gremlins allowed too) - not bosses, they just shoot now and then and get in the way - and the tank at the end. Spiders, beetles, skeletons, ghosts and gremlins are not cut: they come on later floors (or in L1 if the designer says so).
- **The portcullis crank** (the designer set the goal, the agent the details): crank it and the portcullis rises; at an unpredictable moment a wave comes - it must be sudden and stressful. The agent's proposal: the crank has ratchet stops (every ~25 %); let go between stops and the portcullis slowly slides back to the previous stop. The player chooses when to drop the crank and fight and when to reach the next stop. The wave comes at a random moment within a segment, from different sides.

## 7. Onboarding (the first 30 seconds)

- Before midnight the hero trains on **mannequins** (the sword, LMB). The gun is empty.
- After the training a **bat** happens to fly in through an open window; the hero cuts it down - the gun charges (hint: a sword kill charges the gun).
- Then **shoot the chandelier**. The gun fires only while the aim is on the chandelier; pressing while aiming elsewhere fires nothing and the player gets an unobtrusive "aim at the target". The chandelier falls in the middle of the hall and becomes the first fallback line.
- Then a **letter** is slipped under the door: "Midnight. Wait. Now it's our turn" (draft text). The clock strikes twelve, scratching, the first rats.

## 8. Story and theme

- The Uninvited theme works twice: first the monsters are the uninvited (they climb into the house), in the end the uninvited one is you (the house is theirs now).
- The story is told in the game: the letter, the portraits and objects in the house, the final image. No long cutscenes.

## 9. Art

- **Style - a mix of SF-a (low-poly) and SF-d (toon 3D)** (the designer, 2026-10-05). One model set; detail (polygon count, smoothing) is a graphics setting. The floor stays light so the small swarm reads.
- **Gunblade - GB2-a** (the designer, 2026-10-05): GB-a's silver blade with a revolver cylinder; the barrel lies along the top of the blade almost to the tip, the point is cut away downward, the line of fire is clear. Concept `art/halloween/GB2-a-spine-barrel.jpg`.
- **Hero - HE-b (the heir in the hat)**.
- **Monsters - all ten concepts** (`MO-a...j`). **Places** - the concepts are approved as the reference. All approved concepts are in `art/halloween/`.

## 10. Sound and music

- Keep the shot's feel, rework the sound a little.
- ❓ Music: the old 10 tracks are cyberpunk; Halloween needs new ones (Lyria, the key works until 2026-10-11).

## 11. Controls

WASD move, mouse camera, LMB sword (shot while aiming), RMB (hold) aim, R reload, Q circular strike, Space jump (and a sword strike in the air), Shift sprint (the designer, 2026-10-05).

## 12. Open questions

1. L3/L4 (section 6).
2. Gun lore - what it shoots (section 3).
3. Music (section 10).

