# AGENTS.md - rules of the browser game collection

The agent reads this file before any work in the repository. It is also my checklist.

## 0. Roles

- **Me (the human)** - game designer and reviewer. I come up with the rules and twists, I decide whether something is fun, I play and test.
- **Agent** - implements what is described in the game's `DESIGN.md`. Does not invent mechanics, twists, goals or balance on its own.
- If a rule in `DESIGN.md` is unclear or missing - **the agent asks, it does not guess**.
- If a game has no `DESIGN.md`, or it is empty - the agent **does not start the code** and reminds me to write it (template in section 10).
- **Language: everything is written in English** - code comments, commit messages, documents, agent reports.
  Russian remains only in the values of UI strings in the translation dictionaries.

## 1. Goal of the collection

Small browser games for phone and PC, published on the collection site and on itch.io.
For now the goal is game design skill and data on what hooks people.
Later - one big game grown from the prototype that I get hooked on myself for longer than the tests require.

## 2. Stack

| What | With what | Note |
| --- | --- | --- |
| Runtime, packages, build, dev server | Bun | Vite - only if we run into assets, HMR or building the collection |
| Language | TypeScript, strict | |
| 2D and 3D rendering | Three.js | 2D through an orthographic camera. Version is pinned: `three@<VERSION>` |
| Physics | Rapier (`@dimforge/rapier2d` / `rapier3d`) | Only in games where things fall, collide, roll. Not for grids and turn-based |
| Tests | `bun test` | Mandatory for `core/` |
| Linter | a rule forbidding imports between layers | See section 4 |
| Screenshots | Playwright | After every visual change |
| Assets | Kenney (CC0) for placeholders, Meshy/Tripo for my own models | **No pixel art** |

The agent uses the Three.js API of the version given in `package.json`, not from memory of old examples.

## 3. Repository structure

```
games/<game>/     one folder per game (structure in section 4)
site/             landing page of the collection: name, gif, a "play" button for each game
shared/           appears only after the second game and only for what has really repeated
JOURNAL.md        common development journal (section 9)
IDEAS.md          deferred ideas
AGENTS.md         this file
```

Candidates for `shared/` (extract when something has repeated twice): scaling to the screen, touch input,
the "Tap to play" screen and audio unlock, saves, object pools, seeded random.

## 4. Architecture of every game

```
games/<game>/
  core/          pure TS, no Three.js
    state.ts       what exists in the game
    commands.ts    player actions → change the state, return events
    queries.ts     questions to the state (read-only)
    rules.ts       the rules themselves
  view/          Three.js: subscribed to events, reads through queries
  input/         touch, keyboard → calls commands
  main.ts        wires everything together
  config.json    all balance values
  DESIGN.md      one page of rules in my own words
  NOTES.md       this game's notes (section 9)
```

### Hard rules

1. State changes **only** through commands. A command returns events.
2. The view reacts to events (animation, sound, shake, particles) and reads state **only** through queries.
3. `core/` does not import `view/`, `input/` or Three.js. The linter checks this.
4. Time and random are passed into the core from outside, random with a seed. The core is deterministic.
5. All balance values are in `config.json`. Magic numbers in code are a review error.
6. Names in code come from `DESIGN.md`. If the design says "the line burns out", the code says `burnLine`.
7. The **hot path** (every frame, every entity) - no new objects and no `async`/`await`.
   Pools, reuse, in-place mutation. The **cold path** (loading, menu, level start) - whatever is convenient.
8. A new feature = a command or a query + a test in `core/`.
9. If the game grows into a big one, the boundaries are formalized as ports and the game moves to full hexagonal architecture.

## 5. Phone requirements (from day one)

- Portrait orientation by default, scaling to the screen.
- Tap zones at least 44 px, the important things in the bottom half of the screen.
- No hover. Controls only by taps and swipes; keyboard is an extra for PC.
- Sound turns on only after the first touch - the "Tap to play" screen.
- Text input is an HTML input over the canvas, the UI must survive the on-screen keyboard.
- Performance is checked on a weak phone, not on a laptop.

## 6. Hosting and deploy

- **GitHub Pages, public repository.** Deploy through GitHub Actions on push: all games and the landing page are built.
- **Base path:** the site lives at `/<repository>/`, games at `/<repository>/<game>/`. It is set in each game's build.
- There are no keys or secrets in the code.
- **itch.io** for each game: a zip of the build contents, `index.html` at the root of the archive,
  "This file will be played in the browser", "Mobile friendly", orientation.
  itch limits: up to 500 MB unpacked, up to 200 MB per file, up to 1000 files.

## 7. The cycle of one game

Timebox: **1-2 days per game.** Time is up - we release as is.

1. **DESIGN.md** - I write it. No code starts without it.
2. **Base version** - the agent, in small tasks. After every task I play.
3. **My twist** - one rule that changes the game. I come up with it and write it into DESIGN.md.
4. **Game feel** - sound, shake, particles, animation for every action.
5. **Analytics** - at least three events: started, finished, returned.
6. **Release** - the site, itch.io, a post on r/playmygame.
7. **Retrospective** - ratings and the journal (section 9).

Plan for the first games: **five experiments**, each answering its own question:
feel of the action · a rule twist · generation · a choice in one move · progression.
I decide which games. A platformer is not among the first five.

## 8. Definition of Done for an agent task

- [ ] `core/` tests pass.
- [ ] The import linter is clean.
- [ ] No allocations and no `await` in the frame loop.
- [ ] New numbers are in `config.json`.
- [ ] For visual changes a screenshot was taken through Playwright and checked against the task.
- [ ] The build opens at the base path.
- [ ] The agent briefly wrote what changed and what I should check by hand on a phone.

## 9. Journal and reminders

### The agent MUST remind me

- **At the start of a session on a game:** whether `DESIGN.md` exists and whether the twist is described in it. If not - remind me before any code.
- **After every task:** "Play it on your phone. What feels wrong?"
- **When a game reaches step 6 (release):** fill in the retrospective in the game's `NOTES.md` and a row in `JOURNAL.md`.
- **If more than 2 days have passed since work on the game began:** remind me about the timebox - we release as is.
- **If I propose a new big idea in the middle of the work:** write it down in `IDEAS.md` and go back to the current game.
- **Once a week (or after the third game):** reread `JOURNAL.md` and compare the ratings - which prototype to grow.
- **If a released game has no ratings in `NOTES.md`** - remind me at the next session.

The agent may create empty files from the templates below on its own, but **does not fill in** ratings, conclusions and feelings for me.

### `NOTES.md` template for a game

```markdown
# <game> - notes

## Experiment question
What I wanted to test with this game:

## What I planned

## What came out

## What worked for people / what did not
(links to reviews, analytics numbers: started / finished / returned)

## Ratings (0-10)
- Fun to build:
- Play it myself when not testing:
- People's reaction:

## Five lines for the future
1.
2.
3.
4.
5.
```

### `JOURNAL.md` format (one row per released game)

```markdown
| Date | Game | Question | Build | Play myself | People | Main takeaway |
| --- | --- | --- | --- | --- | --- | --- |
```

## 10. `DESIGN.md` template for a game (I write it)

```markdown
# <game>

## One sentence
Who the player is and what they do.

## Goal and failure
How to win. How to lose. Clear within 3 seconds?

## Controls
What a tap / swipe does. What the keyboard does on PC.

## Rules
(short, in points)

## What changes over time
Difficulty, speed, new elements.

## My twist
One rule that the original does not have.

## Game feel
What should feel pleasant and how to emphasize it.

## Out of scope
What will definitely not be in this game.
```

## 11. What to look at in review

- Boundaries: `core/` knows nothing about the view and input.
- The frame loop: no new objects and no `await`.
- Numbers only in `config.json`.
- The first 30 seconds are clear without text.
- One goal, clear within 3 seconds.
- Checked on a real phone.

## 12. Deferred (see `IDEAS.md`)

A generated sci-fi RPG about a corporate mercenary (real wounds, four paths to the goal, the world remembers),
a fleet with behavior patterns, BYOK OpenRouter as a feature, online, Steam and mobile stores.
I come back when at least one experiment shows that I get hooked.
