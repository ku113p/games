# AGENTS.md - Uninvited (GameDev.tv Halloween Jam 2026)

The base rules are `../first-games/AGENTS.md`: roles (sections 0), stack (2), game architecture and its hard rules (4),
the Definition of Done (8). This file lists only what differs for the jam.

## The jam

- https://itch.io/jam/gamedevtv-halloween-jam-2026 - theme "Uninvited".
- Submissions: 2026-10-02 21:00 UTC - **2026-10-12 21:00 UTC**. After the deadline only bug fixes, no new features.
- Judged 1-5 on: Fun, Theme, Aesthetics, **Music**, **Sound**, Mechanics, **Story**.
- Assets: only what we have permission for. **Everything we did not make ourselves is listed in the submission**
  (keep `CREDITS.md` up to date the moment an asset or AI tool is used). AI-generated content is not forbidden by the rules.
- Web build preferred (itch "played in the browser").

## Differences from the collection rules

- **Timebox:** the jam deadline, not 1-2 days. Plan the days backwards from it; feature freeze is decided by the designer.
- **Platform:** PC browser first, **landscape**, keyboard + mouse. Phone controls come later, after the PC version works.
  (Section 5 of the base rules - portrait, taps - does not apply until then.)
- **Assets:** AI-generated art, models, music and SFX are allowed. Pixel art is still out.
- **Physics:** Rapier (`@dimforge/rapier3d-compat`) for the character controller and line-of-sight rays.
- **Analytics and the collection site** are not required for the jam build.

## Folders

```
uninvited/
  AGENTS.md      this file
  DESIGN.md      the design: plain text = decided, lines with ❓ = open (collected in its last section) - no game code before it
  DESIGN.ru.md   the Russian working copy the designer edits; carry every change over to DESIGN.md
  PLAN.md        the day-by-day jam plan, designer and agent tracks
  spike/         throwaway feel/look prototype - NOT the game architecture, do not grow it into the game
  core/ view/ input/ main.ts config.json   - the game itself, created once DESIGN.md exists
```
