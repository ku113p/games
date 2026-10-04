# Uninvited - feel spike

Throwaway prototype built before `DESIGN.md`, to answer two questions by playing:
1. Does moving, hiding and striking as a small figure inside a neon network feel good?
2. Which of three looks: **A Grid** (clean Tron), **B Neon city** (cyberpunk), **C Darksynth** (hot red on black)?

It deliberately ignores the game architecture (no core/view split, Rapier calls in the frame loop allocate).
When the game starts, take the numbers and ideas, not the code.

## Run

```
cd uninvited
bun install
bun run spike          # http://localhost:3320
```

## What is in it

- Third-person runner on foot: acceleration, jump with coyote time and buffer, dash (with afterimages and FOV kick,
  invulnerable while dashing), sneak (slower, harder to notice, low walls hide you only while crouched).
  Rapier's kinematic character controller does collisions, steps and slopes.
- Security drones: patrol waypoints, a visible vision cone, suspicion that builds faster the closer you are,
  alert -> chase and shoot bolts, then search the last place they saw you. A loud kill alerts drones nearby.
- Strike: a melee swipe. From behind on an unaware drone it is a silent one-hit takedown.
- AI ability "ghost signal": a flickering decoy that drones look at instead of you. Inside the server zone the AI refuses
  ("No. Not in there.") - a taste of the "the AI is not fully obedient" idea.
- A node that drops the firewall when you hold E on it, then the server is the goal. Win screen with stats.
- Juice: bloom, hit-stop, screen shake, sparks, hurt flash and chromatic aberration, placeholder synth SFX.

Controls: WASD, mouse, Space jump, Shift dash, C/Ctrl sneak, LMB strike, RMB/F ghost signal, E capture, R restart, 1/2/3 look.
All the tuning numbers are in `config.json`.
