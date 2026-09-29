# Snake 3D

> Status: on 2026-09-30 the numbers, names and prices in this file (speed, boost, shop, hints, sound, analytics, arena rules) were checked line by line against `config.json` and the code. The "Designer decisions" section at the end is what he has already decided;
> "Designer decision needed" is what is still open. Everything above is already implemented; if something is written down differently from how you decided it, fix it here
> and we'll bring the code into line. Quotes in quotation marks are your own words from the work sessions.

## One sentence
A snake that looks like an ordinary 2D snake, until on step 5 the camera moves behind its head and the flat board turns out to be one layer of a cube.

## First impression
At first the game must look like an **ordinary snake**. The volume reveals itself later, in one moment (the twist).

## Goal and failure
Only the **high score**. There is no winning. The goal is to eat as many apples as possible.
Death: **your own body**, **a cube wall**, **an obstacle**. Moving into a cell that the tail is vacating on this same step is allowed.

## Controls

Four turns: left, right, up, down. There is no third axis in the controls: classic snake has none, and the flat opening is selling exactly that illusion; in the 3D game the four turns already cover every direction. The scheme is chosen in settings and remembered.

| Scheme | Turns |
| --- | --- |
| Swipes | swipe anywhere on the screen (a tap does nothing) |
| Taps | four arrow buttons of the pad in the bottom corner |

**The pad.** A cross-shaped pad in the bottom corner, each button at least 44 px. The command fires on touch; holding does not repeat it.
A command that has been accepted but not yet executed is highlighted. The pad side (left/right, for left-handed players) is in settings.

**Boost (both schemes).** A big round button that works **only while held**: let go and the pace is back to normal.
In the "Taps" scheme it sits in the center of the pad, in "Swipes" it is at the bottom, in the corner on the pad side. The button shows the **active**
factor (not the purchased one): if it has hit the floor (see "Speed"), a smaller number is shown there. Boost cannot get stuck:
it is released when the finger leaves, on focus loss, on a hidden tab, on pause, on death.
PC: Shift or Space (hold).

**Camera (both schemes).** Tilt - two fingers on the canvas or the right (or middle) mouse button; zoom - pinch or wheel; tilt and zoom stay
until reset. Reset - the crosshair button (above the boost in "Swipes", above the pad in "Taps"), a quick tap on the stick, or the R key. On a phone, in the corner opposite the pad, there is
the camera stick (it sets the turn speed). Tilt and zoom do not carry over into the next game.

**Pause.** The "❚❚" button in the top right corner, Escape, minimizing the tab. When the tab is minimized the game pauses instead of living through
the missed time. On pause boost is off, you can change sound, fog and quality, continue or leave to the menu.
Leaving to the menu in the middle of a game counts what was earned: the score goes to the leaderboard and the coins go to the wallet.

**PC:** arrows/WASD - turn, Shift/Space - boost, R - camera reset,
Escape - pause (and resume). Keys are read by physical position, so WASD works on a Russian layout too; Ctrl/Cmd/Alt combinations are left to the browser.
Mouse: the right (or middle) button dragged - camera tilt, wheel - zoom, left button - swipes and taps exactly as on a phone.

**Boost hint (one-time).** Nothing on the screen used to say the boost must be *held*, so a player could finish a whole first game without touching it.
Now, in the player's **first game only**, a small prompt appears next to the boost button: 0.6 s after the start, for 4 s
(`config.boostHint.showAfterMs` / `visibleMs`, counted in running game time, not wall time). The boost button gets a ring for as long as the prompt is up.
- **Once in a lifetime.** It is marked as seen (`snake:boostHintSeen`) the moment it first appears, so it never returns: not in the next game, not after a reload, not when the
  first game is repeated because the snake died before the camera transition. A returning player who has already had the twist never sees it.
- **It vanishes the moment the player boosts** (button or key), and if they boost before it appears it never appears. Someone who already understood is not lectured.
- **Only over a running game.** Pause hides it and freezes its clock (resume shows what is left); the demo explainer, game over and the menu end it for good. It is never on the legal screens.
- **Where:** never over the boost button and never over the pad, stick, camera reset or pause. "Swipes": on the boost's own row, toward the centre of the screen.
  "Taps": the boost sits inside the pad's cross with no room beside it, so the prompt takes the free spot in the opposite corner, above the camera stick, level with the top of the cross;
  the ring on the button links the two. Both follow the pad side setting.
- **Two texts.** A device with a mouse or trackpad (`any-pointer: fine`) is told the keys - "Hold Shift / Space to boost" (the key names come from `input/keyboard.ts` and `input/gestures.ts`,
  they are not typed in); a touch-only device is told the button - "Hold ×1.5 to boost", with the number the button really shows. A tap is the wrong word on a desktop, and key names are noise on a phone.
  (Not to be confused with the head signals and other visual "Hints" below.)

**Controls screen.** A "Controls" button on the menu (under Play, in the lower half) opens a screen that explains the controls with a drawing first and words second:
a diagram of the screen with the pad, boost, stick, camera reset and pause drawn where the game puts them (mirrored for the left-hand pad), numbered, with a one-line legend beside it.
- **Both schemes.** It opens on the scheme the player has selected; two tabs (Swipes / Taps) let them look at the other one, and a line says so when they do ("Not your current scheme").
- **Read from the code.** The lines, the key names, the pad buttons are taken from `input/` (`controls-doc.ts` reads `keyboard.ts` and `gestures.ts`; tests fail if a key is rebound and the screen is not); only the wording is in the dictionaries.
- **Device.** The stick and the two-finger gesture appear only on a touch device; the keyboard and mouse list only where there is a mouse or trackpad (first on a desktop, after the diagram on a touch laptop).
- It is a base screen like Records and Shop: reachable from the menu only, Back/Escape return to the menu, never over a game, pause or the legal screens.

The "hold" scheme is thrown out; the "pull up for ×4" gesture is cancelled in favor of the shop.

## Camera
The camera rolls around **the axis along which the snake is currently moving**. After the roll the picture reads as flat again,
but the world axes are different - all three are available. The price of this decision, which you accepted knowingly: the player loses track of which way is up more easily.

## Rules
- On an axis turn the body **stays where it is**. No teleport and no random cells.
- **Food:** one apple at a time, on a random free cell. The snake grows by 1 per apple. One apple = one point.
- **Obstacles:** cubes and obstacle clusters (blocks stick together). Hard requirement: **no dead zones** - every free cell
  is reachable. The outer layer of the cube along the walls and the area around the start are free of obstacles. The same set of parameters
  and the same seed give the same arena.
- The starting snake length is 3 cells, the start is in the center of the cube.

## Game settings
Chosen in the shop before the start (see "Shop"). They cannot be changed inside a game.

- **Arena size:** 20³ (default), 50³, 100³ and the tight 5³ (see below).
- **The 5³ arena is without obstacles only.** In a 5³ cube the clear zone around the head (radius 4) covers the whole cube, so there are
  no obstacles at any density. The same holds for every cube up to 11³ (there the clear zone together with the free outer layer
  leaves no room for obstacles; `arenaHasObstacles`, and the shipped sizes are 5, 20, 50 and 100). We do not scale the clear zone and we do not add obstacles to 5³
  (designer decision: "5*3 — no obstacles only"). While 5³ is equipped, the "Obstacles" section in the shop is locked: a caption with
  the reason on top, the buy and equip buttons inactive, "No obstacles" in the section header. The chosen density is **not erased**:
  it is kept and takes effect again as soon as the player equips a bigger arena.
- **Obstacle density:** standard (about 3% of cells) - the default; ×2, ×½, ×¼ of the standard and "no obstacles"
  (bare walls). An arena without obstacles is not a convenience but a different game: there is almost no risk of crashing, it is a way to relax.
  Your decision: "an empty arena should be expensive, but not too expensive."
- **Pace - four tiers:** "Calm" (slower than standard), "Normal" (default), "Fast", "Very fast".
  A tier stretches or squeezes the whole speed-up curve at once, so its shape and the apple at which the speed cap is reached
  do not change. "Very fast" halves every step (it starts at 540 ms and its speed cap is 180 ms instead of 360 ms) - that is why it is expensive.
- **Boost:** the factor, see below.

## Speed and boost
- The snake starts with a step of 1080 ms, each apple makes the step 24 ms shorter, the cap is 360 ms (reached at the 30th apple).
  The step is constant, the snake moves in jerks from cell to cell.
- **Boost:** while the button is held, the step is divided by the factor. The default is **×1.5** (free), the others - ×2, ×3, ×4 -
  are bought. The top tier is ×4; ×8 is removed (designer decision: "x8 — remove"). The chosen factor is fixed for the game.
- **Boosted-step floor: 60 ms** (`config.speed.minEffectiveStepMs`). Reason: the head signals (below) do not have time to show
  on a very short step, and a purchased boost must not break the danger warning. Consequence: on a very short
  normal step the big factors hit the floor and go slower than advertised (on the "Very fast" pace at the speed cap
  ×3 and ×4 give the same thing - 60 ms). The floor does not touch a normal step.
- **Why there is no ×8:** with a 60 ms floor that is 16 cells per second with a warning window of 120 ms, and human reaction is 200-250 ms:
  it is physically impossible to dodge an obstacle that has just appeared. The tier is removed from the catalog and from the config. A save where ×8 is already bought
  is parsed without errors: the unknown item is dropped, boost goes back to ×1.5, the coins stay.
- Boost also speeds up earning: score and coins come for apples, not for time.

## Hints
The game is hard to read in volume, so the hints are part of the mechanics. In plane mode (the first game) they are hidden or weakened, and anything at another depth than the snake's layer is not drawn at all:
the first game must look like an ordinary flat snake.

**Head signals - four states shown by color.** This is a mechanic, not decoration:

| State | When |
| --- | --- |
| Idle | a muted head, nothing is happening |
| Goal | the apple lies on a straight line along the heading and the path is clear (an apple behind an obstacle is not a goal); the head takes the apple's color |
| Danger in 2 steps | along the heading in two steps there is a wall, an obstacle or your own body |
| Danger in 1 step | the same in one step; danger overrides the goal |

The heading is computed taking into account a turn that has already been entered but not yet executed. The color rises in 50 ms and fades in 400 ms (`config.headSignal`), so that
on a fast step the head does not blink on every step. There is no blinking: the states differ by hue, and only a soft "breathing"
of the head remains (it is off under "reduced motion" in the system). Reason: blinking about five times a second is dangerous for
photosensitive people. **Any palette must keep these four states distinguishable** (normally and under color blindness);
for cosmetics this is a hard constraint.

**Compass.** A 3D arrow in the apple's color on the top face of the head. It shows the direction to the apple **in a straight line**, not the path
around obstacles and the tail, and honestly conveys "higher/lower/closer/farther". It turns smoothly. Apple right next to you (up to 1.5 cells
in a straight line) - the arrow is hidden, from 3 cells it is fully visible, in between it fades smoothly. The window is narrowed on purpose: before, the arrow went out
at a distance that was still a long way to go around, and it looked like a stuck bug. There is no compass in plane mode.

**Lattice, ray, markers:**
- **The lattice** - a sparse background layout, "where am I in the volume": nodes every 4 cells around the head, with short
  stubs along the axes coming out of each one. It does not show directions.
- **The ahead ray** - a dashed line from the head along the heading, ending at a wall, an obstacle, your own body or the apple; the obstacle it hits
  is painted over.
- **Near-cell markers** - an arrow in the cells where you can step (forward, left, right, up, down) and one cell farther
  along the same axis; a red-orange cross if you cannot go there. A marker behind an obstacle is dimmer (a third of the brightness) than in an open
  spot: it reads as "it is behind a wall", not "it is on the wall".

**Minimaps** (free mode only), your decision: "one normal top view, the second literally a strip up and down."
- **The top map** - world axes X × Z, a slice at head height, a 20×20-cell window. The snake's turns do not reorient the map.
  At a wall the window stands still and the marker moves inside it, in the middle of the arena the marker is in the center and the world moves under it. The apple is always visible
  (in the slice, on another level, outside the window - three kinds of marker).
- **The level gauge** - a strip "up and down", up is always the world's up, down is the world's down. See the question about the strip's window at the end.

**Fog.** Your decision: "just fog everywhere, getting thicker into the distance." One common fog: the farther from the camera, the thicker, everything dissolves
into the background color. The apple does not sink in the fog, the cube walls, the compass and the near markers are outside the fog. There is no fog in plane mode.
The "Fog" toggle in settings and on pause, on by default.

## Shop

**The currency is coins. One eaten apple = one coin, the same at any settings** (arena size, density, pace do not affect it).
Coins are awarded after the game, including on leaving to the menu in the middle of it. The wallet and the leaderboard are different things: a purchase
does not "devalue" the high score. Stored only in the player's browser.

**Buying and choosing - only before the start of a game**, there is no shop inside a game. The entrance is the balance chip on the menu screen and the
"To the shop" button on the game-over screen (if there is enough money for something new). Until the first finished game the entrance is hidden (for those who have already played
it is open right away). What is bought is never taken away, the price does not rise, no refunds. In each section one item is equipped; equipping is free.

| Section | What is sold (given by default - first) | Price, coins |
| --- | --- | --- |
| Boost | ×1.5 - given; ×2, ×3, ×4 | 40, 100, 250 |
| Arena | 20³ - given; "Tight" 5³, 50³, 100³ | 120, 80, 200 |
| Obstacles | standard - given; ×2, ×½, ×¼, no obstacles | 40, 40, 60, 300 |
| Pace | "Normal" - given; "Calm", "Fast", "Very fast" | 30, 50, 100 |
| Coin multiplier | permanent ×1.25 and ×1.5; temporary ×2 (5 games), ×3 (5 games), ×5 (3 games) | 80, 240; 60, 150, 200 |
| Palette | "Night Neon" and "Contrast" - given; "Synthwave", "Ice", "Terminal" | 250 each |
| Snake | "Classic" - given; "Tail guides" (a thread along the body and arrows on the tail, to see where the tail is going) | 100 |
| Apple | "Diamond" - given; "Orb", "Star" | 15, 30 |
| Arrow (compass) | "Default" - given; "Chevron", "Ring" | 20, 50 |

Every section of the shop also ends with one locked "Soon" slot (coming soon) - a slot with no purchase.

**The coin multiplier** increases only what is credited to the wallet. **It does not affect the game score or the leaderboard** - otherwise
someone who bought their way in would beat everyone. The permanent and temporary multipliers multiply together (the best of each kind is taken).

**Temporary items are counted in games, not in minutes:** a wall-clock timer in a browser game is unfair (close the tab - and
what you paid for burns away). A game is deducted at the start; the last paid game still pays at the increased rate. Buying again
extends the term (no more than 50 games in total) instead of creating a second item.

A player who chose 50³ or 100³ in the old settings keeps that size equipped for free.

## Screens and flow
1. **Photosensitivity warning** - on **every** launch. One button. The text is in `LEGAL.md`.
2. **Terms of use** - only on the very first launch (the consent is remembered). An "Accept" button.
   Both screens have a language switch: a person with a foreign language must be able to change it before them.
3. **Menu screen** - the title, the best high score in one line (a tap opens the leaderboard), a big play button, a "Controls" button, a gear,
   the language, the balance chip (after the first game). One goal within three seconds.
4. **Settings** - control scheme, pad side, music and sounds, fog, quality. The arena size lives in the shop.
5. **Records** - the leaderboard.
6. **Controls** - how to play (see "Controls"): a numbered diagram of the screen, a legend, the key list on desktop. Back returns to the menu.
7. **Shop** - sections from top to bottom: what changes the game (boost, arena, obstacles, pace), then the coin multiplier,
   then the looks; at the bottom a big "Play".
8. **Game.** Pause (see "Controls"). In the player's first game, on the camera transition, the explainer screen (see "My twist").
9. **Game over** - a neon GAME OVER (the inscription is not translated), the score, the time, the coins earned (with the multiplier), the leaderboard.
   If the result made the top 3 - entering three symbols with the drum (see below), then the buttons: "Again" (the same arena and scheme, no menu),
   "To the shop", "To the menu".

## Leaderboard
**One for all settings** (arena size, density, pace, multipliers do not split it). Top 3, each entry: score, three symbols, game
time. Only results of 1 point or more go into the leaderboard; on a tie the one who scored earlier ranks higher. The three symbols are from A-Z and 0-9,
entered with a drum of three slots (not a text field: the on-screen keyboard breaks the layout on a phone); the remembered symbols
are filled in next time.

## What changes over time
- **Within a game:** speed grows with every apple (see "Speed"). Nothing else.
- **Between games:** progress is purchases for coins (see "Shop").

## My twist
**The game starts as an ordinary flat snake, and on step 5 the camera moves behind the head and the cube opens up into full 3D.**
The camera transition itself is the twist.

| | "Plane" mode | "Free" mode |
| --- | --- | --- |
| Camera | straight on, far away, through a narrow lens (a flat board) | from behind the head, flying after it |
| Movement | 4 turns in the board's layer, nothing else | 4 turns cover the whole volume |
| Look | indistinguishable from a 2D snake | honest 3D, hints, maps, fog available |

**Only in the player's very first game.** All following games start right away in free mode: the flat start is a one-time intro
device. If the player dies before the transition, the intro is not used up and will repeat in the next game.

**The first game is always on the 20³ arena** (designer decision: "the first game always starts on 20*20, bought and equipped or not"). Whatever is bought
and equipped in the shop, the very first game of a player's life is 20³; the equipped arena applies from the second game on (`arenaSizeFor` in `core/rules.ts`, tested
against a wallet with 50³ bought and equipped). The opening is framed for 20³ and only for it.

**What the flat opening looks like.** It has to read as ordinary flat snake, so that the reveal lands:
- **A flat board that fills the screen.** The camera is far from the cube and looks through a narrow lens (`camera.plane.fovDeg`), so cells stay square and nothing leans. The head's layer
  (20×20) plus half a cell of margin on each side fills the screen width, the board is raised up the screen by `camera.plane.raise` of the screen height so that the pad and the
  buttons in the lower corners do not cover it. It has a grid and a bright border of its own (`view/plane-board.ts`); the cube's walls, the wall grids and the edge frame are not drawn.
- **Only the snake's own layer is drawn.** Obstacles, walls, hints, everything at another depth is not drawn at all - not dimmed, not faded. The camera's near and far clipping planes are put on the faces
  of the head's layer, and the obstacles (whose shader cannot be clipped that way) drop every cell outside the layer themselves. The layer's obstacles are drawn as solid squares from a shell of their own. Tilting the camera is off
  while flat (a tilted view would cut the layer at the wrong plane); zoom still works.
- **The apple is in the snake's own layer.** In the flat opening (core, mode `plane`, and only there) every apple lands on a free cell of the head's layer that the snake can reach without leaving it,
  at most `plane.appleMaxSteps` (4) moves from the head, so it can be eaten before the camera moves (the demo turn is on step 5). One seeded draw, deterministic. The general rule (a random free cell of the whole cube)
  is untouched and is what every later apple and every later game uses.
- **The reveal.** When the camera moves, the other layers appear outward from the board's layer over the first `camera.plane.revealShare` of the flight, while the lens widens from the narrow one to the game's own.

**Demo turn (first game):** on step 5 the snake turns by itself along the third axis - into a random free side (not into a wall
and not into an obstacle); the camera moves behind the head with a glitch and a roll, the game pauses and shows the explainer screen.
After that the player does the turning. This is the **only** way out of plane mode (the third axis used to be in the controls, but it never left the mode: it only rolled the flat camera). If both sides are blocked
the demo turn is not spent and is tried again on the next step, so a player cannot be stuck flat.

## Game feel
Neon and volume. The camera flight at the twist: a glitch at the start and at the midpoint, the lens widening, the world appearing from the board outward (under "reduced motion" the glitch noise is muted, the flight stays).
The snake slides into the cell in a jerk at the start of the step and stands until the next one.

**Sound.** Turns on only after the first touch. Music - *Cyber Runner* (Luis Zuno, CC0), quiet, looped. The sounds are
generated, there are no files:
- **apple** - a rising sweep, each next one in a row a semitone higher, the ceiling is an octave;
- **buttons** - a short quiet click;
- **death** - a falling low sweep with noise;
- **step tick** - a quiet soft "thud" on every step, of slightly varying pitch. It is **quieter during the speed-up**, so it does not turn into chatter:
  the volume falls with the pace (from the full volume at a 1080 ms step down to half of it at 180 ms per step and shorter; at the standard speed cap of 360 ms it is 0.6 of the starting one), and below 300 ms per step
  every second tick sounds. If a step is immediately followed by an apple or death, the tick is not played, so as not to cover an important sound.
Music and sounds can be turned off separately (settings and pause).

**Graphics quality - three tiers** (settings and pause, the choice is remembered): "High" - MSAA ×4 antialiasing and full bloom,
"Medium" - full resolution and bloom, SMAA antialiasing instead of MSAA, "Low" - reduced resolution, no antialiasing and
no bloom. It was needed because on weak integrated graphics MSAA lags every second frame regardless of screen
size. The default is chosen by GPU class and screen size (weak integrated - "Medium", a very large buffer or
software rendering - "Low", the rest - "High"); any tier can be chosen manually.

**Languages - five:** English, Spanish, Brazilian Portuguese, Simplified Chinese, Russian. The language is taken from the browser
(falling back to English), switched with the two-letter codes EN ES PT ZH RU on the menu and legal screens without a reload, the choice is
remembered. Flags are rejected.

## Analytics (step 5 of the cycle)
Five anonymous counters (at most once per visit): started a game, reached the twist, finished (death), played again,
returned on another day. Nothing personal (no scores, no symbols, no identifier). Does not run on local addresses.

## Out of scope
- Teleporting the snake to a random cell - cancelled.
- Tying the axis turn to a level - cancelled.
- Winning as a state - there will not be one, only the high score.
- The "hold" control scheme, the "pull for ×4" gesture - thrown out.
- Online, a server, real money, refunds for purchases.
- Other snakes and eating smaller ones - deferred, see `IDEAS.md`.

## Designer decisions (2026-09-30)

**Names**
- The game is called **"Snake 3D"** - final.
- The collection is called **"Black Games"** (the draft "Tiny Games" is cancelled). The landing page is renamed.

**Shop and economy**
- **Prices:** he trusts the agent and will not check them. In the code the prices are as in the "Shop" table. The "10 coins per point" scale from the old analysis in `IDEAS.md` is not in force: an apple = 1 coin.
- **Boost:** the default is ×1.5, ×2 costs 40 - his deliberate decision.
- **Coin multipliers** multiply together with no cap (×1.5 × ×5 = ×7.5) - that is how it was intended.
- **Paid deviation from the standard in both directions** (both "harder" and "easier") - yes. A caveat: he had intended it differently - so that score and coins would be literally the same thing, and perks would give more. For now we leave it as is, we may revisit.
- **One leaderboard for all settings** - a deliberate pay-to-win, he is fine with it; there is no settings mark on the entry.
- **The "???"/"Coming soon" slots** stay and will appear in all sections of the shop (another agent is doing it).
- **Palettes** are sold whole, with no separate slots for apple/obstacles/borders - accepted.
- **"Type of the guide vector"** = the look of the compass arrow (accepted); rays and the lattice are not sold as variants.
- **The shop entrance** is hidden until the first finished game - accepted.

**Rules and screens**
- **Minimaps:** accepted as is (a ±5-cell window on the level gauge, not a static strip). Finishing it is deferred, see `IDEAS.md`, the "Minimaps" section.
- **Bloom on "Low":** the head signals are weaker - accepted, we will not fix it.
- **The color distinguishability bar** is approved: between the four head states ΔE ≥ 30 normally and ≥ 20 under deuteranopia/protanopia.
- **Leaving to the menu from pause counts the game** (score to the leaderboard, coins to the wallet) - that is how it should be.
- **Growth per apple is one cell** - confirmed.
- **The third axis is removed from the controls** (tap = deeper, double tap = closer, the pad's two buttons, Q and E, `turnAxis`, `input.doubleTapMs`). It only ever worked during the flat opening and never left plane mode. Now the
  opening is a proper 2D board with the apple in reach, the controls have no purpose, and classic snake has none. This also closes the old question about the 240 ms wait of a single tap.

**Boost and arena (2026-09-30)**
- **×8 - remove** (the reason is in the "Speed and boost" section). The top tier is ×4.
- **5³ - no obstacles only.** The rule is written down in "Game settings".

## Designer decision needed

The questions that still have no answer.

1. **The 60 ms floor on the boosted step.** It was chosen by the agent. On the "Very fast" pace at the speed cap ×3 and ×4 give the same thing (60 ms),
   which means part of the purchased boost is useless there. Should it be that way, or make the floor lower/higher, or forbid the useless purchases?
   Also: the head color rises in 50 ms, the boosted-step floor is 60 ms.
2. **"×3 free after 10 games"** (an idea from `IDEAS.md`) is not implemented in the code. Is it needed or forget it?
3. **"Contrast" is free** (accessibility is not sold) - is that your decision, or leave it as the agent decided?
4. **Legal text.** The terms list four events ("opened the game, started a game, finished, returned"), the code has
   five (added "reached the twist" and "second game"), and "opened the game" is not sent as a separate event. Fix the text
   before release? It is your name under the text.
