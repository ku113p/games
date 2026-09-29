# Deferred ideas

<!-- Big ideas that show up in the middle of work on the current game move here. -->

- Generated sci-fi RPG as a corporate mercenary (real wounds, four paths to the goal, the world remembers)
- A fleet with behavior patterns
- BYOK OpenRouter as a feature
- Online, Steam, mobile stores

## From work on snake

- **Other snakes in the cube.** Yours grows, and you have to maneuver between the enemies.
  The smaller ones can be eaten if you manage to hit the first three rows from their head.
  Deferred: in the first version only the speed grows over time.

## Shop for points (snake) — DECIDED: we build it, in snake

Status: the designer decided to build a shop and to build it in snake: "we're making a shop now where you can buy and pick before the start of a game session".
Below is the breakdown to start from. Everything marked "agent's proposal" is up to the designer; open questions are collected in one list in section 8 (they can be answered in one go).
While the shop is not in `DESIGN.md`, the agent per AGENTS.md §0 asks instead of guessing: after the answers to section 8 the designer moves what was accepted into `DESIGN.md` ("What changes over time" / a new "Shop" section).

### 0. The designer's idea, in his words
> also thinking of adding some kind of store but buying with points
> - lighting designs (color palette — a set costs more, but you can separately pick obstacles, apple, something else, arena borders)
> - design of the snake's squares (for example with guides for the tail's movement)
> - apple type
> - type of the guide vector
> - boost speed — by default x2 is given only for the first 10 games — then you buy it. there's x4 (btw I never saw it from you even though I asked for it — but never mind) x3, x8
> currency is the collected points — make it so that 1000 is like shorter come up with different ones — be more careful with colors so the composition matches — if needed — google it

About "×4": in `DESIGN.md` and `config.json` there is only `speed.boostFactor = 2` and one "×2" button. There is nothing about ×4 in the repository
(it could have been a spoken request outside the files). If you want ×4 right away, it's one line in the config, but a separate button/multiplier choice is only needed together with the shop.

"Make it so that 1000 is like shorter" was understood two ways, see question Q3.

### 1. The parts of the idea and what each does to the game

| Part | What it is | Affects difficulty | Risk |
| --- | --- | --- | --- |
| Palettes (set + separate slots) | Cosmetics | No, but only if the head signals stay distinguishable (section 4) | A bad palette breaks the readability of danger and goal |
| Snake segment skin | Cosmetics | No | Expensive in volume if "tail guides" are new geometry |
| Apple type | Cosmetics | No | The apple must be visible at any distance in fog; a new shape must not be smaller |
| Guide vector type | Cosmetics **or** not | Depends: if the variants show different amounts of information (ray far ahead / only the neighboring cell), that is already a hint = difficulty | Need to decide which variants (question Q6) |
| Boost multipliers | Upgrade | Yes: shortens a game several times over and changes how fast points accumulate | See below |
| "×2 only for the first 10 games" | Taking away | Yes, a game after the 10th is twice as long | See below |

**Boost is not cosmetics and not an "upgrade", it is the pace of the game.** The agent's estimate (not data, there is no analytics yet):
the snake starts at 1080 ms/step, speeds up by 24 ms per apple, floor 360 ms. An apple in a 20³ cube is on average ~20 steps away in a straight line, ~26 with detours.

| Cube | 10 apples without boost | 10 apples with ×2 | 30 apples without / with ×2 |
| --- | --- | --- | --- |
| 20³ | ~4 min | ~2 min | ~9.5 / ~5 min |
| 50³ | ~10 min | ~5 min | ~24 / ~12 min |
| 100³ | ~21 min | ~10 min | ~48 / ~24 min |

(Another agent is already reworking the core for an arbitrary boost multiplier: the multiplier is a game parameter, the list ×2/×3/×4/×8 is data in the config. The technical basis for selling boost will appear on its own.)

That is, without ×2 a ten-apple game in a standard cube lasts twice as long, and in 50³ and 100³ it is already tedious. ×2 is part of the normal pace of the game,
not a bonus. Therefore:

**"×2 only for the first 10 games, then you buy it" — the agent's honest opinion: don't do it.**
- It is taking away something familiar. A loss feels stronger than an equal gain (loss aversion), and the break will land exactly on the 11th game:
  a person who liked it suddenly gets a game twice as slow for the same thing. The most likely response is to leave, not to buy.
- The data will be polluted. If "returned" drops after the 10th game, it will be unclear whether snake or the taking-away is to blame. The experiment about progress turns into an experiment about punishment.
- It breaks the "×2" button, described in `DESIGN.md` as a basic control element of both schemes (it is used with one thumb).
- While boost is the only thing that gives the player control over the pace, selling it means selling convenience, not decoration.
- A shop should sell what the player did not have, not what they already had.

Alternatives with the same effect (money/goal go into boost, but without the feeling of something taken away). The agent's proposals:
- **A. ×2 free forever, ×3, ×4, ×8 are sold.** Nothing is taken away. The simplest variant, breaks nothing.
- **B. A trial higher multiplier.** For the first 10 games ×4 is available "as a gift" with an explicit "trial" label, ×2 stays forever. Losing the trial feels softer,
  because the player did not count it as theirs; fit the price of ×4 so that by the 10th game what has been accumulated is enough (see the economy).
- **C. Boost is earned, not taken away:** "played 10 games → ×3 unlocked forever" (the same "10 games", but in the other direction: the player only gains).
- **D. Boost as a temporary item** (charges per game). Works, but adds a charge counter on the screen; heavy for the first version.
- **The specific variant the agent proposes as a package (A + C):** ×2 for everyone forever, nothing is taken away. ×3 unlocks for free on the 10th game played ("10 games" stay, but the player only gains,
  and the promise is visible in advance: in the shop a row "×3 — play 10 games"). ×4 and ×8 are bought. That way the designer's thought "the first 10 games are special" is kept, but there is no taking away.
  If you specifically want "try ×4", variant B: for the first 10 games ×4 is available with the label "trial until the 10th game"; on the 11th it disappears, but ×2 and what was bought stay.
  A trial is more honest than a taking-away because the base does not change: the player can always play the way they played. The designer decides (question Q2).
- If the designer still keeps the original "×2 for the first 10 games, then buy" (variant D): the minimum softening is to warn in advance (a game or two ahead: "×2 free for N more games"), make the price of ×2 equal to what the player has already
  earned in 10 games (so that after the 10th they can buy right away instead of saving), and measure separately: the share of those who returned after the 11th game. But this is what the agent would not do.

Separate risks of the multipliers (outside the question about 10 games):
- **The head signals can't keep up.** `headSignal.riseMs = 110`, `fallMs = 320`, danger horizon 2 steps. With a step of 360 ms and ×8 the step is 45 ms:
  the "danger in 2 steps" signal lasts 90 ms, shorter than its own rise time. On ×4 (90 ms) barely. A floor on the effective step is needed
  (a number in `config.json`) or limit the multiplier. The step ticks too: `minGapMs 90` in the `tick` blip.
- **Boost speeds up earning too.** Points come for an apple, not for time, so ×8 gives two to four times more points per hour than ×2:
  you buy boost — you save up for the rest faster. This is either a desired loop or a skew; decide consciously (question Q5).
- **Playing on ×8 with no safety-net screen** (hardcore). ×8 from 360 ms = 45 ms per step, which is less than two frames at 60 fps and on a weak phone. Check by hand.
- **Interface:** right now there is one "×2" button. Choosing the multiplier is either a setting in the menu (simpler) or a cycle-through switch button; every tap on the button is an extra step.

### 2. The decision and its consequence for the collection plan (AGENTS.md §7)

The decision is made: the shop is built in snake. A shop for points is experiment No. 5 ("progress"). A consequence worth remembering in a month:
**snake stops being experiment No. 1** ("feel of the action") **and becomes an experiment about progress.** The question "is the action itself pleasant: camera, boost, third axis" will stay without a clean answer:
if people come back, it will be impossible to separate "liked the game" from "want to buy more". In snake's `NOTES.md`, in "Experiment question", write this down explicitly (the designer writes it).
The reason the first game "grew": it is cheaper to test a shop on a finished game than to build a second one.

What we do so that the loss is not total (agent's proposal):
- **Analytics before the shop** (step 5 of the cycle): "started", "finished", "returned" plus shop events (opened, bought X, picked Y). Without it not a single question about progress can be answered.
- Put the implementation order together so that **stage 1 (palettes + a switch, no economy) can be released and played** before the money: it is cheap and immediately shows whether people care about looks at all (section 5).
- The 1–2 day timebox from AGENTS.md is already exceeded in fact (first commit 2026-09-29, the base version is not released yet); the shop is ~4–6 agent days on top. That is the designer's decision, the agent only reminds: "we release as is" applies here too, the stages (section 5) exist so that you can stop at any one.

### 3. Economy (agent's proposal; the numbers are not decisions)

What there is now: a point = one apple (`core/commands.ts`: `s.score += 1`). There are no points from anywhere else: not for time, not for cube size, not for a streak.
The leaderboard stores the top 3 (`scores/leaderboard.ts`), there is no other bookkeeping. A typical game in 20³ — the agent's estimate, not data: 5–12 apples (2–5 minutes);
a good one — 20–30 (8–10 min at ×1, half as long at ×2); a big one — 50 (13 min at ×1). In 50³ and 100³ the same number of points costs 2–5 times more time,
so at the same price per point the big cubes are "unprofitable".

**About "so that 1000 is shorter"**: at 1 point = 1 apple a price of a thousand is ~100 typical games (7 hours). So you either have to split prices down to tens and hundreds,
or introduce a multiplier. Proposal: **the core and the leaderboard stay as they are (point = apple), the wallet is a separate account outside `core/`,
where per game `points × payoutPerPoint` is credited**, a number in `config.json` (proposal 10). Then:
- a typical game ≈ 80 (8 apples), a good one ≈ 250, a big one ≈ 500;
- 1000 in the wallet is about 10–12 typical games, that is an hour to an hour and a half of play: "a noticeable sum", neither pocket change nor unreachable;
- the high score and the leaderboard stay in honest "apples"; the wallet lives its own life.

Price scale (agent's proposal; "games" are typical ones, ~80 coins):

| Level | Price | Games | What goes here |
| --- | --- | --- | --- |
| First purchase | 100–150 | 1–2 | The cheapest: an apple type or a guide skin. The first purchase should happen in the first or second session, otherwise the shop won't be seen as a system |
| Small | 300–500 | 4–6 | A separate palette slot (only apple / only obstacles / only border) |
| Medium | 1000 | 12 | Snake skin, ×3 |
| Large | 2500 | ~30 | A whole palette set (cheaper than the sum of the parts: 4 slots at 800 = 3200, set 2500), ×4 |
| Top | 6000 | ~75 | ×8, an exclusive snake skin |

**Catalog (agent's proposal; prices in coins at `payoutPerPoint = 10`, by the scale above).** "Default" — what the player has without purchases.

| Section | Item | Price | Default |
| --- | --- | --- | --- |
| Boost | ×2 | 0 | yes (base) |
| Boost | ×3 | 1000 (or free after 10 games, question Q2) | no |
| Boost | ×4 | 2500 | no |
| Boost | ×8 | 6000 | no |
| Palette set | "Night Neon" | 0 | yes |
| Palette set | "Contrast" | 0 (accessibility is not sold) | yes |
| Palette set | "Synthwave", "Ice", "Terminal" | 2500 each (a set is cheaper than the sum of slots) | no |
| Palette slot | apple / obstacles / edges-grid from any set | 300–500 | no |
| Snake skin | "Classic" (the current stripes) | 0 | yes |
| Snake skin | 2 new skins (for example, with tail guides) | 1000 and 6000 | no |
| Apple | the current diamond | 0 | yes |
| Apple | 2–3 new shapes | 100–150 (first purchase), 300 | no |
| Guide | the current look | 0 | yes |
| Guide | 2 variants (depends on Q6) | 100–500 | no |

Choosing before the start: in each category the player has one of what was bought "equipped". A palette "slot" overrides the corresponding color of the chosen set: first the set, slots on top of it.
What was bought is not taken away and does not "spoil"; the price does not grow. No refunds (without a server and payments there is nothing to verify a refund with; question Q10).

The whole shop is ~15–20 thousand coins, that is 200+ games. Plenty for a prototype: the goal is not to "beat the shop", but to see which milestone people hold on to.
If it is decided to sell boost ×3/×4/×8, then ×3 = 1000 should be fitted to "by the 10th game ≈ 800–1000 accumulated" (variant B above).

**Are points spent, or is it a running total.** The agent's proposal: two independent numbers.
- **Balance** — is spent, drops on purchase.
- **Total earned** — does not decrease, shown as "progress" (and works for unlocking things at a threshold).
- **The high score and the leaderboard** are not connected to the wallet at all: a purchase does not "devalue" the high score.
Why not one account: if balance = points, then a purchase sinks the number people are used to, and the high score loses its meaning.

**High scores already earned.** Storage has only the top 3 (`snake:leaderboard`), there is no total of games played, and you can't count exactly "how much the person has already earned".
Options (question Q4): (i) a wallet from zero, honest and simple; (ii) a starting bonus from the sum of points in the top 3 (a rough estimate, so old players don't start from zero).
There has been no public launch yet, so probably (i).

Storage: in `localStorage` with no server, so it is easy to cheat through the console. For a game with no money and no online ranking, for a wallet this is acceptable; the leaderboard is a separate story (already local).

### 4. Color palettes

#### 4.1. What the current palette is built on (`games/snake/view/palette.ts`)

Colors split into **meaningful (mechanics)** and **decorative**:

| Role | Now | Meaning or decoration | Note |
| --- | --- | --- | --- |
| Head: idle | `#fff27a` × `HEAD_IDLE_BOOST` 0.7 | **Meaning** | Dull yellow, below the bloom threshold. The only warm neutral: not to be confused with the body |
| Head: goal (apple on the heading) | apple color `#ff2d78` × 3.0 | **Meaning** | The head takes the apple's color: "you're heading for the apple" |
| Head: danger in 2 steps | `#ff7000` × 2.0 | **Meaning** | Orange |
| Head: danger in 1 step | `#ff2010` × 3.6 | **Meaning** | Red. Danger overrides goal (`stepsToCrash` and `appleOnCourse` in `core/queries.ts`, horizon `headSignal.dangerHorizon = 2`) |
| Highlight of what the ray hits | `RAY_DANGER_COLOR #ff5a30` | Meaning | Also "danger", warm |
| Apple | `#ff2d78` × 2.5 | Meaning (goal) | Apple color = the color of the "goal" signal on the head |
| Body / tail | `#3dffa6` → `#18c8ff`, stripes ×0.72 | Meaning in the part "length is visible" | The stripes give a sense of length and motion |
| Obstacles | `#8f5cff` | Meaning (what you can't go into) | Must read as "barrier" and not match the apple/danger in color |
| Cube edges / grid | `#1fb6ff` / `#2a8cff` | Decoration | Changes freely |
| Head projection on the walls | `#d9b84a` | Decoration | Free, but quieter than the bloom |
| Background | `#02030a` | Decoration | Affects the contrast of everything else |
| Fog | `#1e223a` | Decoration | Tied to the background: "background + a faint veil of the walls"; a wrong fog color paints far blocks as holes |
| Minimap | colors from the same constants | Inherits | There is no separate set |
| Layout (menu, buttons) | CSS variables in `index.html` (`--neon #39ffe0`, `--accent #ff2fb0`) | Decoration | 42 hex/rgba values, sit separately from `palette.ts` |

**Critical: any palette must keep the four head states distinguishable** (idle / goal / danger-2 / danger-1),
as well as "goal" ≠ body color, "danger" ≠ obstacle color.

**Measurement of the current palette (agent, by script; see the method below).** In normal vision everything is distinguishable (ΔE between the four states 30–108),
but **the two orange-red danger states are close**: ΔE 30 in normal vision and 10 with deuteranopia (red-green blindness). Head-goal (pink) and danger-1 (red): ΔE 53 in normal vision.
And the green body against the pink apple with deuteranopia is ΔE 25. So the color problem is already there in the current palette, regardless of the shop.

#### 4.2. What the search said about coherent neon palettes

Search (general guides to cyberpunk palettes, I read the pages from the search engine's excerpts, not in full):
- The base is an almost black or very dark blue-violet background plus **2–3 saturated neon accents**; secondary elements are medium-saturation versions of the same colors, not new hues.
- The composition holds on **opposite or nearby pairs on the wheel**: cyan/magenta, pink/turquoise; on dark they "vibrate". The rule of thumb "70% dark / 30% neon".
- Neon is brightness, not saturation: the main ratio is **a dark background and bright thin lines**, the glow adds a halo.
- For accessibility: the Okabe-Ito palette has 8 colors worked out for protanopia, deuteranopia, tritanopia; red + green without a second channel (shape, brightness, line) are weak, and blue/orange is the safest pair.

Links:
- Neon Color Palette Inspiration (Envato Tuts+): https://design.tutsplus.com/articles/neon-color-palette-inspiration-trending-palettes-and-templates--cms-39479
- Cyberpunk Neon, a collection of palettes (Color Archive): https://colorarchive.org/collections/cyberpunk-neon/
- How To Create a Cyberpunk Color Palette (Pageflows): https://pageflows.com/resources/cyberpunk-color-palette/
- 15 Cyberpunk Aesthetic Color Palettes (Depositphotos): https://blog.depositphotos.com/15-cyberpunk-color-palettes-for-dystopian-designs.html
- Top Neon, Cyberpunk & Synthwave Color Palettes 2026 (with HEX): https://www.colorpickerweb.com/neon-cyberpunk-synthwave-palettes/
- Coloring for Colorblindness (David Nichols, palette and checking): https://davidmathlogic.com/colorblind/
- Colorblind-Friendly Palettes for Web Design (AudioEye): https://www.audioeye.com/post/colorblind-friendly-palettes/
- Okabe-Ito hex codes (reference): https://scifig.ai/blog/okabe-ito-color-palette-hex-codes

#### 4.3. What the bloom imposes

- The threshold `BLOOM_THRESHOLD = 0.75` is computed on linear brightness `0.299R + 0.587G + 0.114B` after the multiplier. There is no tone mapping (`NoToneMapping`), everything above 1.0 is simply clipped.
- Blue and red are "darker" for the threshold than they look: pure red has brightness 0.30, pure blue 0.11, so in the current palette red and pink go with multipliers of 3.0–3.6.
  A dark color without a multiplier won't glow at all.
- Body: so that the bright stripes glow but the dim ones (×0.72) don't, the brightness of the body color with `SNAKE_BODY_GLOW_BOOST` 1.25 should lie in roughly 0.6–0.83.
  The tail in the gradient can go lower: the glow fades toward the tail.
- Quiet elements (grid, rays, head projection, dim stripes) must stay **below** the threshold; bright signals (goal, danger, apple, edges) — above.
- **The agent's proposal:** store only the color in the palette ("what hue it is"), and compute the brightness multiplier automatically: `boost = target brightness / color brightness`
  (with a ceiling so the color doesn't burn out to white). Then any palette glows the same, no need to pick `×3.0` by hand for each color.

#### 4.4. A set of six palettes (agent's proposal; values checked by script)

Roles in each set: background, body, tail, head (idle), apple (= "goal" signal), danger-2, danger-1, obstacles, edges/grid.
Additionally: head projection, fog (background + a light veil of the edge color) and minimap are derived from these roles.

Checking method: the agent's script computes ΔE (CIE76, in Lab) between the four head states on the original hex (without brightness multipliers and without fog) in normal vision and through the simulation matrices
of Machado 2009 (deuteranopia / protanopia / tritanopia, full degree). This is an estimate, not a certified tool, the final check must be done on screenshots
and with an external check (for example, https://davidmathlogic.com/colorblind/). Guideline: ΔE ≥ 30 in normal vision — confident, ≥ 20 with color blindness — readable, below — doubtful.

| # | Name | Background | Body → tail | Head (idle) | Apple = goal | Danger-2 | Danger-1 | Obstacles | Edges |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | **Night Neon** (current) | `#02030a` | `#3dffa6` → `#18c8ff` | `#fff27a` | `#ff2d78` | `#ff7000` | `#ff2010` | `#8f5cff` | `#1fb6ff` |
| 1 | **Synthwave** | `#0a0418` | `#ff4fd8` → `#8b5cff` | `#fff1e0` | `#2ee9ff` | `#ffb020` | `#ff2a2a` | `#4d6bff` | `#ff3df2` |
| 2 | **Ice** | `#030812` | `#7df9ff` → `#3d7bff` | `#fff1dc` | `#e070ff` | `#ffb000` | `#ff2233` | `#6a6cff` | `#5ecbff` |
| 3 | **Terminal** | `#030a05` | `#2effa0` → `#00b98a` | `#f4f4f4` | `#e070ff` | `#ffb000` | `#ff2a1a` | `#7a6cff` | `#1fbf8a` |
| 4 | **Contrast** (after Okabe-Ito, for colorblind people) | `#03060c` | `#56b4e9` → `#3d8bff` | `#ffffff` | `#f0e442` | `#e8600a` | `#ff2d95` | `#7a6cff` | `#2f8cff` |
| 5 | **Heat** (failed the check, see below) | `#0a0403` | `#ff6a3d` → `#ffb02e` | `#d9e6ff` | `#38f2ff` | `#ffe600` | `#ff2d95` | `#8a5cff` | `#ff8a3d` |

Why each one holds together:
- **Night Neon** — current: a green-cyan body, cold edges and violet obstacles make up a cold gamut; warm (yellow head, pink apple, orange-red danger) is only what matters.
  A principle worth keeping in all palettes: **cold is environment and snake, warm and contrasting are signals**.
- **Synthwave** — a magenta/turquoise pair: body and edges are magenta, the apple is turquoise (the opposite side of the wheel, "vibrates" on dark). The background has a violet tint. Obstacles are blue, so as not to confuse them with the pink body.
- **Ice** — almost monochrome: blue-cyan body, blue obstacles, a warm pale tint of the head; the apple is lilac, to differ from both the body and the yellow-orange danger.
- **Terminal** — green phosphor: the body is emerald, everything else is restrained. The apple is lilac, not green, otherwise it would merge with the body.
- **Contrast** — based on Okabe-Ito (`#56b4e9`, `#f0e442`, `#d55e00` in simplified form): the apple is yellow, the body light blue, danger orange and magenta-pink — different in hue and brightness, not "red against orange".
- **Heat** — a warm body. Shows the limit: if the body is orange, then orange-yellow danger gets lost against it, and the cyan apple next to a pale head merges with protanopia (ΔE 0). Not recommended; kept as an example
  of why "any set" won't do and an automatic check is needed. A repair is possible (another head, another apple), but then it will be a different set.

Result of the check: the smallest ΔE among the six pairs of the four head states:

| Set | Normal | Deuteranopia | Protanopia | Tritanopia | Weak spot |
| --- | --- | --- | --- | --- | --- |
| 0 Night Neon | 30 | **10** | 19 | 15 | danger-2 against danger-1 (orange / red) |
| 1 Synthwave | 52 | 24 | 27 | 41 | danger-2 against danger-1 with deuteranopia |
| 2 Ice | 71 | 30 | 54 | 25 | apple against danger-2 with tritanopia |
| 3 Terminal | 64 | 23 | 42 | 25 | danger-2 against danger-1 with deuteranopia |
| 4 Contrast | 64 | 29 | 47 | 15 | danger-1 (pink) against danger-2 with tritanopia (a rare case) |
| 5 Heat | 41 | 11 | 0 | 26 | fails |

Additionally: body against apple (deuteranopia) — Synthwave 55, Ice 39, Terminal 79, Contrast 113 (in the current one 25).

Conclusion from the data: the best overall result is "Ice" and "Contrast"; the main weak spot almost everywhere is the same, **the danger-2 / danger-1 pair**, when both are warm. Orange against red is poorly distinguishable with red-green blindness in any palette.

#### 4.5. Accessibility (color blindness)

About 8% of men and 0.5% of women can't tell red from green. What to do (agent's proposal, in order of rising cost):
1. **Separate danger-2 and danger-1 not only by hue but by brightness/hue around the wheel** (yellow-orange against magenta-red, as in "Contrast"), not "orange against red".
2. **A second channel instead of one color:** size or shape of the mark on the head, thickness and brightness of the ray, sound. Right now `DESIGN.md`/the config say outright that signals are read by color, not by pulse; whether to change that is the designer's decision (question Q7).
   There are already indirect channels: the highlight of the face the ray hits and the near-cell markers, they work independently of the signal color on the head.
3. **An automatic palette check by test:** for each palette, check the pairs of head states, "goal against body" and "danger against obstacles" by ΔE in normal vision and through deuteranopia/protanopia simulation. Palettes that fail don't get into the shop.
   Threshold from this measurement (proposal): ≥ 30 in normal vision, ≥ 20 with deuteranopia and protanopia. The current palette fails the threshold, this needs fixing in any case.
4. **The "Contrast" palette is free in the base delivery**, so that accessibility is not paid.

### 5. What is needed in the code (a list, not an implementation)

Layers per AGENTS.md §4: `core/` must not know about cosmetics and money. The shop, wallet and look selection live outside the core, like `scores/` (pure logic with no DOM and no storage; storage is in `main.ts`).
The core takes only balance values from outside: `config.speed.boostFactor` is already copied into the state per game (`core/rules.ts`, `core/state.ts`),
so a purchased multiplier is substituted into the game config without a single change to the core.

| # | Task | What to change | Size (agent days, estimate) |
| --- | --- | --- | --- |
| 1 | **Palettes as data.** Right now colors are module constants `Color` in `view/palette.ts` (~72 uses of `SNAKE_*`/`APPLE_*`/`HEAD_*` in `view/`), plus `BACKGROUND_COLOR` in `view/index.ts` and CSS variables in `index.html`. Needed: a pure data file (hex strings, no Three.js), an "apply the set" function, a palette check by test. Switching the set — only between games, not on the fly | `view/palette.ts` → data + an application layer; `view/*.ts` where a color is taken by constant; `index.html` | 1–1.5 |
| 2 | Automatic glow brightness by color (section 4.3) and a palette check by test (ΔE, color blindness) | `view/palette.ts`, new `view/palette.test.ts` | 0.5–1 |
| 3 | Each new palette: values, a screenshot of all states in Playwright, verification | data + `scripts/` | ~0.25 per palette |
| 4 | Choosing the palette by slots (apple / obstacles / borders separately) | menu + slots in data | 0.5–1 |
| 5 | Wallet: balance, total earned, purchases, `payoutPerPoint`, storage in `localStorage` with keys `snake:wallet…`; pure logic with tests in the style of `scores/` | new folder `shop/` (pure), `main.ts` | 1 |
| 6 | Shop screen: list, prices, buy/equip, "owned" state. The menu screen is already split into three (`screens/screens.ts`), a fourth is added there | `screens/`, `i18n/dictionaries.ts` (five languages!), `index.html` | 1–1.5 |
| 7 | Boost multipliers. The core for any multiplier is being done by another agent right now, the list ×2/×3/×4/×8 will be in `config.json`: the technical part is almost free. What remains: substitute the purchased multiplier into the game config, the multiplier choice (button/menu), the effective step floor, checking head signals at high multipliers | `main.ts`, `input/boost.ts`, button UI | 0.25–0.5 |
| 8 | Apple skin (2–3 shapes) | `view/apple-view.ts` (48 lines), compass, minimap | 0.5 |
| 9 | Snake segment skin (including "tail guides" — this is new geometry and logic for their placement) | `view/snake-view.ts` (292 lines), minimap | 1–2 |
| 10 | Guide vector type | depends on the answer to Q6: `ahead-ray.ts`, `ahead-dots.ts`, `near-cells.ts`, `direction-hint.ts`, `compass-view.ts` | 0.5–1 |
| 11 | Analytics (needed in any case): started / finished / returned; for the shop also "opened the shop", "bought X" | `main.ts`, step 5 of the cycle | 0.5 |

Cheap: 2, 3, 7, 8, 11. Medium: 1, 4, 5, 10. Expensive: **6 (the shop screen, five languages) and 9 (new geometry)**; and all the cosmetics together are expensive, because every item needs screenshots and checking.
In total the whole shop is ~4–6 agent days (with the boost multiplier base ready).

**Order of stages (agent's proposal), each can be released separately:**
1. Analytics (11) + palettes as data (1, 2, 3): no economy, the choice is in settings. ~2 days.
2. Wallet and the shop screen (5, 6) with the categories "palette" and "boost" (7). This is where buying appears. ~2 days.
3. The rest of the cosmetics (8, 9, 10), one thing at a time, as needed.
The Definition of Done of each part includes: `core/` tests (unchanged), the layer linter, numbers only in `config.json`, screenshots, a check by base path.

What to store for the player (keys modeled on `snake:*`): balance, total earned, the list of bought items, the chosen set by slot, trial period flags, the counter of games played (for B/C).
All of this is `localStorage`, in try/catch (already done that way in `main.ts`).

### 7. Honest objections

- **The shop is a bet without data.** There is no analytics at all. It is unknown whether people play to the end and whether they come back. If people don't come back to the game, the shop will fix nothing: there is nothing to buy more of. The decision is made, so the goal is to make the bet measurable (analytics before the shop, section 2).
- **Cosmetics work well where the player sees themselves from outside and shares** (skins in multiplayer, social networks). In single-player snake on a phone almost nobody will see that you have a different palette except you yourself.
  The goal of cosmetics here is personal pleasure, and that is weaker than a social reward.
- **Progress that affects the game (boost) changes the balance.** Growing multipliers speed up earning; players who bought ×8 play a different game than those who have only ×2, and the records in a shared leaderboard (the future online version) stop being comparable.
  While the leaderboard is local this is not scary, but later it will become a problem.
- **Points = apples, and apples in different cubes cost different amounts.** 10 apples in 100³ is 10–20 minutes, in 20³ it's 4. The shop rewards the easy cubes. Either `payoutPerPoint` depends on cube size, or people will sit on 20³.
- **Expecting the shop to be more interesting than the game is a risk.** If the base game doesn't hook, pretty palettes will hold people only briefly. Checking the value: first stage 1 (palettes as a choice in settings), watch the analytics for who opens it.
- **Taking away ×2 (see section 1).** The only element of the idea that I consider harmful.
- **Volume against the timebox.** Four to six agent days against a timebox of 1–2 days per game. The decision is made, so there is one mitigation: the stages (section 5), each can be released, and analytics before the shop.
- **Palettes and people with poor vision.** The pretty "Synthwave" — a pink body on pink tones — easily breaks readability; palettes that fail the automatic check must not be sold.
- **Weak phones.** Palettes by themselves are free for the GPU; new apple shapes and segments with "tail guides" are not (need to measure on a weak phone via `perf-*`).

What to measure to understand whether the bet worked (after releasing stage 1–2):
1. How many people finished, how many came back on the second day (after the release and analytics)?
2. How many games on average per session and how many apples per game in each cube? (gives a real price scale instead of my estimate)
3. Do people open settings (scheme, fog, cube size)? If people don't touch settings, the shop will pass by too.
4. How often is ×2 used? If almost always, ×2 is the base and can't be sold.
5. Does the designer play himself outside tests? If not, the shop alone won't save the game (write it in `NOTES.md`, the "play it myself" rating).

### 6. Screens and flow (agent's proposal)

Buying and choosing happen **before the start of a game**, outside a game. The screens right now (`screens/screens.ts`): warning and terms (legal), menu, settings, records,
game (HUD), game over, pause, demo turn explainer. The main ones: `menu | settings | records | game | over`. The main screen is "bare": the title, the No. 1 high score, one big "play" button, a gear and a language switch.
This is deliberate: AGENTS.md §11 requires that the goal reads in three seconds, and that the first 30 seconds are understandable without text. The shop must not stand between "I want to play" and the game.

How to combine (proposal):
1. **The "play" button stays the only main one and does not change.** Press it — the game starts with what is "equipped" now. Buying anything is not required, the selection screen doesn't stand in the way.
2. **The shop is a new sub-screen** `shop`, of the same type as settings and records: `BaseScreen` + `ScreenId` + `ALL_SCREENS` + `openShop()` in `screens.ts`, "back" leads to the menu, tests in `screens.test.ts`.
   The entrance is **an icon next to the gear** in the bottom part of the menu, without text (tap zone ≥ 44 px), with a dot marker if there are enough coins for something new.
3. **There is no icon until the first finished game.** The first game is the demo twist (the camera moves away on step 5, the explainer screen), nothing extra is added there. The flag already exists: `snake:hasPlayedBefore`. The shop opens up after the first loss.
4. **The shop screen:** on top the balance (large) and "total earned"; below, categories as a horizontal strip (palettes, boost, snake, apple, guide);
   item cards in a grid with a preview and a state ("equipped" / "owned" / price / "N short"); **at the bottom, in the lower half of the screen, two buttons: "back" and a big "play"** (straight into a game, skipping the menu).
   Tap on a card: owned — equip; not owned and affordable — a "buy for N" panel with a button in the lower half (a second tap, so as not to buy by accident); not enough — a message saying how much is needed.
5. **Previews without a complex scene:** palettes — a strip of the set's colors and the background, shown as a small picture taken by a Playwright screenshot at asset build time; apple/snake shapes — static icons or a small `<canvas>` with no animation.
   Three seconds per card: colors and shape are visible, minimum text.
6. **The game-over screen.** Here is the peak of the desire to buy (just earned), so: a "+N coins" line counting up, and if there is enough for something — a secondary "To the shop" button next to "To the menu".
   The main "Again" stays the main one. After death the game still restarts with the same settings (DESIGN.md).
7. **Boost.** Choosing the multiplier is "equip" in the shop (category "boost"); in a game the "×N" button shows the equipped number and is still one. No switching of the multiplier in a game.
8. **The look is applied at the start of a game**, not on the fly: no need to recolor a live scene; switching the set costs one reload of materials.
9. **There is no shop inside a game, no coins on the HUD** (score in the center, pause at top right, pad at the bottom stay as they are). The pause has no shop either.
10. **Strings and languages:** names, prices, "owned", "not enough" — into all five dictionaries (`i18n/dictionaries.ts`).

Flow: legal → menu → (shop icon, after the first game) → shop → "play" → game → game over (+coins, "To the shop" / "Again") → menu.


### 8. Open questions to the designer (answer in one go; for each the agent's variant is marked "recommendation")

- **Q1. Shop entrance.** (a) an icon next to the gear, appears after the first game *(recommendation)*; (b) an icon from the very start; (c) a separate "Shop" button next to "Play" (risks smearing the "one goal" of the main screen).
- **Q2. Boost and "×2 only for the first 10 games".** (A) ×2 free forever, ×3/×4/×8 are sold; (A+C) like A, but ×3 unlocks for free on the 10th game *(recommendation)*; (B) A + "trial ×4" for 10 games; (D) as conceived: ×2 only for 10 games, then a purchase (the agent is against, see section 1).
- **Q3. What does "so that 1000 is shorter" mean?** (i) prices such that a thousand is a noticeable sum: wallet = points × `payoutPerPoint`, proposal 10 *(recommendation)*; (ii) points as is, but prices in tens (100–500 instead of thousands); (iii) something else. And what the currency is called: "points" (as the designer said) or a separate word ("coins", "credits")? If points, then the in-game score and the wallet must be shown separately.
- **Q4. High scores already earned.** (i) a wallet from zero *(recommendation, there has been no public launch yet)*; (ii) a starting bonus from the top 3.
- **Q5. Boost speeds up earning.** (i) leave as is: bought ×4 — save up faster, a conscious loop; (ii) credit coins per game with an adjustment for the multiplier (at ×4 and above less per apple). *Recommendation: (i) at the first stage, watch the analytics.*
- **Q6. "Type of the guide vector" — what is that?** (i) the look of the same ray (color, thickness, dashes); (ii) different hints: a ray far ahead, lattice dots, only the neighboring cells (different information = different difficulty); (iii) the look of the arrow/marker on the minimap.
- **Q7. Tell danger apart by more than color?** (i) no, leave "reads by color"; (ii) yes, separate the two dangers by hue and brightness (section 4.5, item 1) *(minimum)*; (iii) plus a second channel: shape/size of the mark on the head, thickness of the ray.
- **Q8. Do the menu and button colors (CSS) follow the chosen palette or stay neutral?** Neutral is cheaper *(recommendation for stage 1)*, following is more coherent.
- **Q9. Coins by cube size:** the same per apple in all cubes *(simpler)* or more in 50³ and 100³, where an apple costs 2–5 times more in time?
- **Q10. Refund / resale of what was bought:** no *(recommendation)*; or a full refund, to try without fear.
- **Q11. Contents of the first shop release (stage 2).** (i) only palettes and boost *(recommendation: cheap and noticeable)*; (ii) everything at once; (iii) palettes without boost.
- **Q12. Which palettes to take out of six** (section 4.4) and whether to keep "Contrast" free in the base *(recommendation: yes, accessibility is not sold)*; whether to drop "Heat".

## Snake for the blind / a game played by ear (designer's idea, 2026-09-30)

The designer: "I actually also have plans to do this for the blind somehow, but I don't know if it can be done or not".
The agent's breakdown (volume estimates are guesses, not measurements).

### What is realistic, what is not

- **No: translate the current snake into sound one to one.** The game is built on the picture: a cube 20³–100³, the camera rolls around the axis of movement
  (after the roll "up" is different), obstacles are clusters of cubes, in fog, there are minimaps. A person can't assemble a map of 8000 cells by ear
  and won't track where the camera is looking right now. Sound conveys several streams at once poorly: one or two targets, not a scene.
  You can't promise "the same game for the blind".
- **Yes: a navigator game in a cube, simplified for hearing.** The player steers the head blind, hears where the apple is, where the wall is and where to turn.
  It is the same mechanic on another channel, but with different rules (a smaller arena, fewer obstacles, a slower pace). Realistic.
- **What can be conveyed by sound** (almost all of this the core already computes for the picture):
  - **Direction to the apple.** The compass arrow (`view/compass-view.ts`) already computes the vector from the head to the apple in a straight line.
    We lay it out into hearing: left/right, forward/back (relative to the snake's heading) — by panning and timbre, up/down — by pitch.
  - **Distance to the apple** — volume or the frequency of a rhythm (the closer, the more frequent the pulse), like "hot-cold".
  - **A wall/obstacle on the heading.** There is already `stepsToCrash` (danger in 1 and 2 steps — the same four head states, see DESIGN).
    By sound: a tone that rises in pitch or rhythm at "2 steps" and "1 step". This is the exact analog of the head colors, only not by color.
  - **A turn and an axis change** — a short recognizable sound + a voice hint ("up", "into") via the browser's `speechSynthesis`.
  - **Ate an apple, death, step** — already there (`view/sfx.ts`).
- **What is already done (half the work).** `view/sfx.ts` — procedural sounds on WebAudio with controllable pitch (`freqFrom`/`freqTo`, a shift by combo)
  and volume; for the step tick the volume is already tied to the pace. What is missing: panning (`StereoPannerNode` / `PannerNode`), constant
  looped "beacons" (right now the sounds are one-shot: a new node is created for each sound) and voice-over.

### How this is done in games for the blind (audio games)

General techniques found in the sources below:
- **Stereo panning = direction** "left/right"; a looped beacon sound on the target that is louder and/or higher as you approach.
- **Pitch = height (up/down)** — in research up and down are separated by a pitch shift up to an octave; volume — distance.
- **Rhythm = closeness** (sonar, the pulse gets more frequent on approach).
- **A sound compass and voice hints** for the cardinal directions; separate timbres for different objects (apple, wall).
- **Binaural sound (HRTF)** in headphones gives "forward/back" and vertical better than panning: that's how Papa Sangre is made, where the world is entirely by ear and headphones are mandatory.
  In the browser there is `PannerNode` with HRTF, but the quality depends on the headphones.
- **Headphones are mandatory** for any scheme with panning.

Sources (I read them from the search engine's excerpts, did not open the pages in full):
- Playing by Ear: Using Audio to Create Blind-Accessible Games (Game Developer): https://www.gamedeveloper.com/audio/playing-by-ear-using-audio-to-create-blind-accessible-games
- How to make your games blind accessible with game audio (A Sound Effect): https://www.asoundeffect.com/game-audio-blind-accessibility/
- Blind Accessibility in Interactive Entertainment (Audiokinetic): https://www.audiokinetic.com/en/blog/blind-accessibility-in-interactive-entertainment/
- The World of Audio Games: A Crash Course (AFB AccessWorld): https://afb.org/aw/14/11/15738
- The neglected history of videogames for the blind (Kill Screen): https://killscreen.com/articles/real-sound-audiogames-blindness-shadow-history-gaming
- Navigational audio games: an effective approach toward improving spatial contextual learning for blind people (De Gruyter): https://www.degruyterbrill.com/document/doi/10.1515/ijdhd-2014-0018/html
- Accessible Games for Blind Children, Empowered by Binaural Sound (ResearchGate): https://www.researchgate.net/publication/279913811_Accessible_Games_for_Blind_Children_Empowered_by_Binaural_Sound
- Game accessibility for visually impaired people: a review (Springer): https://link.springer.com/article/10.1007/s00500-024-09827-4
- A catalog of audio games: audiogames.net (from the list of games you can see what people already play by ear).

### Volume and what to rebuild

- **Minimum (voicing the current game, with no picture):** a layer `view/audio-guide.ts` (a view, the core is not touched: everything needed is already in `core/queries.ts`:
  `stepsToCrash`, `appleOnCourse`, `applePos`, `head`), continuous beacons with panning and pitch, voicing of turns, the mode is switched on by a setting.
  Estimate 2–4 agent days. But a blind person is unlikely to be able to play: menu, shop, records, three letters by drum, warning screens — everything is on the picture.
- **Fully:** also a voiced interface (screens, buttons — `aria-*` + live regions, focus order), control without sight (taps on screen zones
  already exist, but the pad has to be felt for: swipe gestures fit better), a separate arena mode (a small cube, few or no obstacles, a slow pace),
  a review of analytics and terms. Estimate ~1–1.5 weeks, and it is already almost a new game, not a mode of snake.
- **Only a blind person can test it.** Without users with impaired vision you can't claim the mode works; the agent and the designer are sighted. Testers are needed.
- **Cosmetics and the shop are pointless** for such a mode: a separate path without them.

### Proposal: a separate experiment of the collection

Per AGENTS.md §7 the designer has five experiments (feel of the action · rule twist · generation · one-move choice · progress).
Snake has already taken "progress" (the shop). **"A game played by ear" is a strong candidate for a separate experiment**
(feel of the action or rule twist): the question "is it interesting to play blind on sound, for sighted people too?".
Reasons for: the twist is more interesting than finishing snake; for sighted people it is also a novelty (a game with closed eyes, in headphones); you can take a small mechanic
(a 2D or 3D arena 8³–10³, one apple, walls) instead of dragging in all of snake's volume; we already know sound. Reasons against: it needs checking by people
who really can't see; the audience and channels (r/playmygame) are different; the risk of making something unplayable by ear.
The designer decides. If we take it, it's worth starting with a 1-day prototype: 2D snake by ear on a 9×9 grid (direction by panning, distance by rhythm), test it on myself with my eyes closed.

## Snake minimaps: finish, maybe sell (deferred, 2026-09-30)

The designer: "it's a mess there, but actually you can play and more or less comfortably. I think I'll fix them up later too and maybe even add them to purchases too".
For now accepted as is, finishing is deferred.

**What is wrong now** (`view/minimap.ts`, DESIGN "Minimaps"):
- The designer asked: "one proper top view, the second literally a strip up and down" — the second as a **static full-height strip that doesn't change at all** (top — top of the world, bottom — bottom of the world).
- What came out: the "level gauge" strip shows a **window of ±5 cells around the head with running ticks** (the marker in the center, the world moves past), plus a thin gutter
  the full height with two dots. The agent's reason for the decision: at full height one step moved the marker 1.5–7.5 px on a 100³ arena — the movement isn't visible.
  That is, the requirement "static strip" and "readable step" contradict each other on big arenas.
- The top map: a 20×20 cell window; on a 100³ arena this is a small part, in the middle of the arena the marker is in the center, the world moves under it.

**What the designer proposed:** fix it up later and maybe add to the shop (for example, map size/look, a version with a bigger window, a full strip).
If into the shop, then this is no longer cosmetics but a hint (it gives information, so it changes difficulty, like the "guide vector types" in the old breakdown above),
and the price must be set accordingly. Open questions for the designer when we come back: which of the two strip variants (static full / window) is the main one;
whether to sell the maps outright (not in the base) or only the improved versions.
