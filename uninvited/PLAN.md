# Uninvited - day plan

Deadline **2026-10-12 21:00 UTC**; we submit on the **morning of Sun 10-12**. The design is `DESIGN.md`.
Every evening the question is: can someone play it from start to finish right now? If not, that is the next task.

## Milestones
- **WP0 Foundation (10-05):** compiling skeleton, contracts with JSDoc, the box level; the hero walks, swings and shoots.
- **M1 (10-06 evening):** the box plays as a horde fight: monsters, director, spawn points, tank, HUD, sound.
- **M2 freeze (10-08 evening):** L1, L2 and the roof playable end to end. After it only fixes, balance and polish.
- **Submit (10-12 morning):** build, itch page, final playtest.

## Waves
1. **Wave 1 (after WP0):** WP1 spine, stages, main, input; WP2 gunblade and hero; WP3 horde, flyers, tank; WP4 director, spawns, bots;
   WP5 levels, grid, physics, renderer; WP6 camera, HUD, UI, texts; WP7 monster art and bench; WP8 audio. Each owns its files.
2. **Wave 2 (10-06 to 10-08):** levels L1, L2, roof with stages; onboarding beats; balance with the bot; music and sound hookup.
3. **Wave 3 (10-09 to 10-11):** the ending, story cards, polish, performance, bugs.

## Beats (what the player meets)
Box: sword, gun, reload, circular strike. L1 kitchen breach: first pack through the door, medkit, crank. L2: tank and flyers.
Roof: the last stand, then the ending.

## Rules
`bun run check` must be green before every hand-off. Update `DESIGN.md` whenever behaviour changes.
