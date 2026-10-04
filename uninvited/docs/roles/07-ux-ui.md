# UX/UI designer guide - Uninvited

The UX/UI role owns everything the player reads, clicks or has to understand without being told twice: the start, pause, death and win
screens, the HUD (status, alarm, health, weapon, network vision meter, suspicion marks around the crosshair), toasts, contextual hints and
prompts, the hacking overlay's controls and result, the settings menu, colour coding and its accessibility, and the first 60 seconds in a
browser tab on itch.io (click to start, pointer lock, sound unlock, Esc). Files: `texts/en.json` (every line of UI text), `index.html` (HUD
CSS), `view/hud.ts`, `view/settings.ts`, `view/settings-ui.ts`, `view/hack/` (overlay and its input), the hint triggers in `view/game-view.ts`,
the pause/lock flow in `main.ts` and `input/keyboard-mouse.ts`, and the `view.hud` and `audio.settings` blocks of `config.json`.
DESIGN.md is the source of truth; where the 2026-10-04 review disagrees with it, DESIGN.md wins and this guide says so.

## Principles

- **The basics matter most.** Mouse sensitivity, separate volumes (effects/music/voice) and "colour is never the only carrier" fix the most
  common complaints; full remapping is the next step, not the first. Game Accessibility Guidelines, Basic - https://gameaccessibilityguidelines.com/basic/
- **Subtitles and dialogue lines:** readable size, at most ~38 characters per line, always on a contrasting backing. Same source, Hearing section.
- **Check HUD and in-game text contrast on their own** (HUD, crosshair, damage indicators, hints); a high-contrast target is 7:1.
  Xbox Accessibility Guidelines 101 (Text display) and 102 (Contrast) - https://devdocs.xbox.com/gaming/accessibility/xbox-accessibility-guidelines/101
- **Teach by doing, at the moment the skill is needed;** working memory is small, so one new thing at a time. Celia Hodent, "The Gamer's Brain,
  Part 2: UX of Onboarding and Player Engagement" (GDC 2016) - https://www.goodreads.com/author_blog_posts/21085992-the-gamer-s-brain-part-2-ux-of-onboarding-and-player-engagement-gdc16?tab=author ;
  IxDF Game UX overview - https://ixdf.org/courses/game-ux-design-ultimate-guide
- **Diegetic vs non-diegetic is a choice by tone.** For stealth use a hybrid: state lives in the world (lens glow, visor), exact numbers on the HUD.
  https://uxdesign.cc/understanding-ux-in-video-games-diegesis-theory-f59d5a94cbcf
- **In a browser one user click does two jobs:** it unlocks the AudioContext and requests pointer lock. Esc releases pointer lock (and fullscreen)
  before the page sees the key, so pause on `pointerlockchange`, never on the Esc keydown. Fullscreen is a separate opt-in button.
  https://bugnet.io/blog/how-to-fix-pointer-lock-errors-and-the-mouse-escaping-in-browser-fps-games , https://web.dev/articles/pointerlock-intro
- **A failure must not trap the player:** if lock or sound is refused, show a clear screen with the next action, not a dead frame.
  https://dev.to/skywalker_2de7de5f97df567/a-capability-first-loading-screen-for-browser-horror-games-42kj
- **Flashing:** keep blinking at or under 3 flashes per second and let the player turn shake and flashes down (added to the review's list:
  WCAG 2.3.1 - https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html).

## Decisions for Uninvited

- **Length budget** (DESIGN 6, changed 2026-10-04): ~5 minutes per level plus ~5 minutes of real-world scenes, a ~20-minute game. Onboarding
  cannot be a tutorial level; L1 itself is the tutorial (DESIGN 4), so every hint has to earn its seconds.
- **Ranges are hidden without network vision** (DESIGN 8). Cones, sensor zones and noise rings appear only while Tab is held. Without it the
  player reads the lens glow, the drone eye, the warden visor, and the **suspicion marks**: one arc per watcher around the crosshair, turned
  toward it, filling amber, red and blinking once it has spotted you (`view/hud.ts`, `MARK_R` 150 px).
- **Network vision must warn before it bites** (DESIGN 8): a visible overheat meter while scanning, a warning near the limit (sound, the meter
  pulsing red, a label), and the clear message "SCAN TRACED - SECURITY CALLED". Numbers: `scan.warnAt` 0.7, `maxSec` 6, `cooldownSec` 1.5,
  `overheatCooldownSec` 6. So the review's "one label only" (P8) is narrowed: keep one warning label, cut the rest.
- **Hacking overlay** (DESIGN 11): mouse and keyboard are equal (arrows / Enter / Esc, or click a lit code). The result holds ~1.4 s
  (`hack.view.outroSec`) in the game's words, then a toast repeats it. Time 45 s (5x5) to 75 s (7x7), `lowTimeSec` 10. Esc says "HACK ABORTED".
- **Controls** (DESIGN 12): fixed bindings, no remap for the jam. C toggles crouch, Ctrl holds it; dash is a double tap; Tab is network vision;
  E is interact, hack and (new) the takedown from behind (DESIGN 8, "Non-lethal takedown") - it needs its own prompt.
- **May's actives** are now two (pause a camera, distraction; DESIGN 10 "Simplified"), on keys 1-2. Not upgrading is a visible rule
  (shorter hack and pause), so the UI must show the current hack time and pause length, not hide them.
- **Endings are an explicit choice in L3** (DESIGN 4, "Changed after the reviews"): the choice screen is UI work - two plain buttons, equal
  weight, no timer. The hero's colour (white -> red/blue) is pressure along the way, not a hidden verdict.
- **Real world is first person, click-only** (DESIGN 5); clickable props need a hover highlight and a cursor change.
- **Voices are beeps with subtitles** (DESIGN 13), so every May line is on screen.
- **No Halloween dressing** (DESIGN 14), in the UI too: no pumpkin orange, no spooky fonts. The palette is `index.html` `:root`:
  cyan `#6ff4ff`, red `#ff3646`, amber `#ffb03a`, white `#eef8ff`, dim `rgba(160,230,255,0.55)`.
- **Settings** (built in `view/settings.ts` + `view/settings-ui.ts`, defaults in `config.json` `audio.settings`, saved in localStorage
  under `settings` with every value clamped on load):

| Setting | Range / default | Applies to |
| --- | --- | --- |
| Master volume | 0-1, default 1.0 | `audio.setVolumes` |
| Music volume | 0-1, default 0.7 | music bus |
| Sound FX volume | 0-1, default 1.0 | sfx buses |
| Mouse sensitivity | 0.3-2.0x of base `view.camera.sensitivity` 0.0022 (aim keeps its own 0.55 factor) | camera rig |
| Invert Y | off | camera rig |
| Tutorial tips | on | tutorial cards and contextual prompts (`view/tips.ts`) |
| Reduce shake / flash | off | camera shake and kick, full-screen hit flash, kill flash, glitch strength, blinking HUD |
| HUD size | 100 / 125 / 150 % | `hud.setScale` |

  Reachable from the start screen and the pause screen ("Settings" button); the pause screen also shows the controls list.
  Remapping is out for the jam; voice volume comes only if real voices land.

- **Hints are two tiers** (decided 2026-10-04 after the designer found toasts too small, too fast and unclear; DESIGN 12 "as built"):
  non-blocking **contextual prompts** (big lower-centre line, font `clamp(18px, 2.6vh, 34px)` times the HUD size, keycaps from `{Key}` markup, no
  timer: they stay while the situation lasts and go when the player does the action or leaves, min 3 s, fade 0.4 s, one at a time, at most
  2 shows each) and **pausing tutorial cards** for the first meeting with five mechanics (quiet movement, network vision, hacking, alarm 3,
  aiming), once per browser, with a Tips list on the pause screen and a "Tutorial tips" setting that switches both tiers off. Code:
  `view/tips.ts` (pure logic, tested in `scripts/tips.test.ts`), `view/hud.ts` (`hint`, `showCard`, `renderKeys`), triggers in `view/game-view.ts`
  (`situations`, `tipEvent`), card mode in `main.ts`. `hud.hintSec` is gone; the numbers are `config.json` `tips`. The interact prompt
  ("{E} hack the terminal") uses the same big keycap style. The rules below still hold for the text length (60 characters) and the wording;
  rules 4-6 (calm only, 4 s between, 7 s hold) are replaced by the behaviour above.
- **Speaker slot for May** (DESIGN 10): `view.guide.prompt({ id, text, speaker?: 'may', until })` shows a custom prompt (one at a time, in turn with
  the built-in ones, until `until()` is true, at most 2 shows) and `view.guide.card({ id, title, lines, speaker? })` queues a pausing card
  (`main.ts` takes it when calm). `speaker: 'may'` adds a MAY name label and a cyan accent (`by-may` class in `view/hud.ts`). These are story, so
  "Tutorial tips: off" does not silence them. May's own lines do not use it: they have a subtitle box of their own (`view/may.ts`, above the hint bar, same style, 2.8 % of the screen height) so a May line and a tutorial prompt can show together. The slot stays for cards and prompts that need the label (types `PromptSpec`, `CardSpec`, `Speaker` in `view/hud.ts`). Sizes (2026-10-05): the card body is the same size as the prompt, `clamp(20px, 2.8vh, 36px)`, the title 1.6 times that; the card is 58 vw wide and scrolls inside 92 vh at large HUD sizes.

## Rules of thumb and metrics

**Hint-writing rules** (for every `hint.*` and `toast.*` in `texts/en.json`):

1. One hint = one action. Name the thing first, then the verb: "Camera. Hold Tab to see its view."
2. At most ~60 characters for a hint, ~28 for a toast (toasts are `white-space: nowrap`, 13 px, 4 px letter spacing).
3. Keys in the player's words and in front: "[E] Hack", "Tab", "Shift". Never "press the interact key".
4. Show a hint once per key, when the player meets the thing (as now: camera 15 m, sensor 9 m, terminal 4 m, warden 14 m), but only when calm:
   alarm 0, no enemy aiming, not mid-dash. If not calm, queue it.
5. One hint on screen at a time; a new one waits in a queue (today `hud.hint` replaces the current text). At least 4 s between hints.
6. Hold a hint 7 s (`view.hud.hintSec` is 6 now); a toast 2.8 s (`toastSec`) is fine once toasts are short.
7. Do not explain what network vision already shows; point the player at Tab instead.
8. No "you should", no lore in hints. May may say flavour; the hint bar says what to press.

**Rewritten hints** (review examples, updated to the latest decisions):

| Key | Now (chars) | New |
| --- | --- | --- |
| `hint.start` | 130, three skills at once | "WASD to move. Shift sprints - loud. C to crouch." |
| `hint.dash` (new, first time an enemy aims or a worm rears) | - | "Double-tap a direction to dash." |
| `hint.camera` | 2 sentences | "Camera. Hold Tab to see its view. Move when it looks away." |
| `hint.sensor` | 2 sentences | "Sensor zone. Walk or crouch - sprint, dash, jump trip it." |
| `hint.sound` | 2 sentences | "Sound camera. It hears running, jumps and fights." |
| `hint.niche` | 2 sentences | "Crouch behind server blocks to hide. Standing, you show." |
| `hint.terminal` | 2 sentences | "[E] Hack. Security keeps moving while you work." |
| `hint.redWall` | 2 sentences | "Red wall. A terminal opens it." |
| `hint.warden` | 2 sentences | "Warden. Stay out of its view - or come up behind it." |
| `prompt.takedown` (new, behind a warden within reach) | - | "[E] SHUT IT DOWN" |
| `hint.scan` (new, first Tab) | - | "Network vision. Hold too long and it gets traced." |

Toasts: "ALARM 1 - DRONES INCOMING", "ALARM 2 - SEARCH WIDENS", "ALARM 3 - NO MORE HIDING", "A DRONE IS COMING TO CHECK" (DESIGN 9.6:
a broken device brings a drone). Put the cause under the alarm toast in small text from the unused `reason.*` strings ("a camera saw you").

**Colour-blind second channel** (deuteranopia makes amber and red nearly one colour):

- Suspicion marks: an amber arc with a "?" in the tip while filling; a red arc with "!" once spotted. The blink stays as a third cue.
- Status: keep the words HIDDEN / SUSPECTED / DETECTED (already the main carrier); add a dashed border for IN COVER (exists) and a solid one
  for the rest.
- Alarm pips: filled diamonds for active stages, outlined for inactive - not red vs dim rectangles.
- Devices: a paused device dims its lens (`lookBeam.pausedStrength` 4 vs 14) and shows a pause glyph in network vision; a done terminal changes
  its icon, not only cyan -> green.
- Network vision meter: the warning state pulses and shows "TRACE RISING"; the bar alone turning red is not enough.
- Check one screenshot of each state through a deuteranopia simulator before the itch draft.

**HUD legibility numbers:** labels 13-14 px (now `.hud-label` 10 px, `.small` 9 px, alarm 10 px, charges 11 px); label colour `#bff7ff`
instead of `--dim` at 0.55 alpha; inactive weapon tag at 60 % (now 0.3 alpha); hint backing `rgba(0,0,0,0.7)`; contrast at least 4.5:1 against
the brightest likely background, 7:1 for the status and the hint. Hide "60 charges" while the sword is out. Drop the "DASH" label (keep the bar).
Every element must still read in a ~960x540 itch embed at HUD 100 %.

**Layering:** at most one toast in the centre band and one hint at the bottom; extra toasts stack upward (the box keeps 3 now). Nothing
covers the crosshair circle (radius ~150 px, where the marks live).

**First-60-seconds browser checklist** (run it in the itch iframe, not only on localhost):

1. Loading shows progress (percent or a bar), not a bare "LOADING" (`index.html` `#loading`), and never sits silent for more than 2 s.
2. The start screen's single click unlocks audio and requests pointer lock (`main.ts` `showStart` -> `sound.unlock()`, `play()`).
3. If the lock is refused, the pause screen says "Click to resume" - never a frozen frame (the per-frame lock check in `main.ts` does this).
4. If audio stays suspended after the click, show a one-line "Sound is off - click to enable" note.
5. Esc pauses through `pointerlockchange` (`input.onUnlock`); alt-tab pauses too. Pause shows Resume, Settings and the controls.
6. In a hack the first Esc shows "Esc again to abort the hack" (`hack.escAgain`, `hud.hackEsc`); only the second, within 2 s, aborts.
7. A Fullscreen button sits next to Start; fullscreen is never forced.
8. Settings are reachable before the first click into the game, so a judge can set volume and mouse speed first.
9. The first 60 s teach one thing by doing: the start ledge and T0 (meeting May) have no security in sight; the first hack is the easiest
   (5x5, 3 codes, 1 hidden, 45 s) - the first thing the player does is the hardest skill, so it must be calm.
10. The first threat (the A1 camera) is avoidable and visible from cover before it matters; the camera, niche and warden hints queue there,
    they do not stack.
11. No hint appears before the player has moved (today `hint.start` fires at 1.5 s; trigger it on the first input or at 3 s).
12. Reload the tab: settings persist; with storage blocked the game still starts with defaults.

## Review 2026-10-04

The reviewer judged build 1f01fe6 from code, `texts/en.json` and screenshots, without playing it live.

**Strengths**

- Canonical start screen ("Click to start", "Headphones on. Mouse and keyboard."); "Click to continue" after a hack restores the lock.
- Hints tied to place and thing, once per key - the right "just in time" model.
- Clear status hierarchy (HIDDEN / SUSPECTED / DETECTED, alarm pips); the suspicion arcs are a good world/HUD hybrid.
- The hacking overlay is the best UI in the game (big grid, lit line, big timer, red "??", struck-through wrong code, key legend), and its
  results speak the world's language ("RED WALL OPEN", "ALARM UP TO 1").
- Death gives an honest choice (load / restart); cause strings (`reason.*`) exist, rare in a jam.

**Problems by impact**

| # | Problem | Status |
| --- | --- | --- |
| P1 | No settings at all (sensitivity a constant, one volume) | **In progress**: model, panel, texts, `hud.setScale`/`reduceFlash`, `audio.setVolumes`, camera `sensitivity`/`invertY` exist; not wired - `createSettings` is never called and `game-view.ts` creates the HUD without settings, so the button does not show |
| P2 | HUD text tiny and dim (9-11 px, 0.55 alpha), inactive weapon nearly invisible | Open (HUD size setting helps once wired) |
| P3 | Hints long (130 chars) and dense; 6 s too short; start hint teaches three skills at 1.5 s | Open - texts unchanged; also hints overwrite each other |
| P4 | Colour is the only channel for suspicion arcs and alarm pips | Open |
| P5 | Too many layers at once; two centre toasts over the target; long alarm toasts | Partly: toasts stack (max 3); texts still long |
| P6 | Esc is pause, lock release and hack abort at once | In progress: pause on `pointerlockchange` and lock-lost check done; the hack exits the lock on entry; "Esc again" UI exists but Esc still aborts at once |
| P7 | Room/office props need hover highlight and cursor change | Open - scenes not in the game yet; rule set above |
| P8 | Four network-vision labels | Decided otherwise in part: DESIGN 8 requires a warning label and the traced banner; cut "TRACE"/"TRACE RISK" only |
| P9 | No reduce shake/flash while juice grows | In progress: the setting exists; it must reach shake, kick, glitch and kill flash, not only the HUD flash |

Also found while writing this guide: `reason.*` strings are not shown anywhere.

**Top 5 before submission (updated)**

1. **[S] Wire the settings** (was M; the module is built): `createSettings` in `main.ts` with the save store, pass it to `createHud`, apply
   to audio, camera and FX; Settings on start and pause.
2. **[S] Rewrite hints and toasts** per the table above; add a hint queue with a calm gate and a 4 s gap; `hintSec` 7.
3. **[S] HUD legibility**: sizes and colours above; drop "DASH", "TRACE", "TRACE RISK", hide charges in sword mode.
4. **[S] Second channel for colour**: "?"/"!" in the marks, diamond pips, one deuteranopia screenshot pass.
5. **[S] First 60 seconds in the browser**: wire "Esc again", load progress, audio-refused note, fullscreen button, calm T0, all checked in
   the itch iframe on the 10-09 draft.

## Review 2026-10-05

Second review (the working tree on top of 15a3ec7, screenshots at 1280x720 and 1920x1080; full text in the session's `reviews2/07-ux-ui.md`).

**Status of the 2026-10-04 items:** P1 settings - fixed. P3 hints - fixed (prompter, keycaps, no timer, one at a time), but the
three-skills-at-1.5-s problem came back as the "Move quietly" card. P6 Esc - fixed (pause on `pointerlockchange`, alt-tab, hidden tab; Esc
twice in a hack). P9 reduce shake/flash - mostly fixed (shake, kick, hit-stop, flashes, glitch); HUD blinks are not covered, and the
traced banner blinks at 3.3 Hz. P5 and P8 - partly (toasts stack but keep their long texts; "TRACE RISK" plus two red bars). Open: P2
HUD sizes (labels 9-10 px, status, alarm and toasts 10-13 px, fixed px at every resolution), P4 colour second channel, load progress,
fullscreen button, the "sound is off" note, `reason.*` on screen.

**New:** at HUD 150 % May's subtitle (`bottom: 17vh`) covers the interact prompt (`top: 60%`) and overlaps the hint bar. The meeting runs
at 0.2 s/word (~300 wpm, against the 160-180 wpm subtitle norm). There is no hit, kill or block marker on the crosshair and no damage
progress on wardens, which matches the designer's "the shooting and hits feel artificial". No level name or goal is shown. DESIGN 12 says
cards are 50 % wide, but they are built at 58 vw.

**Top 5 (freeze 10-08):**

1. [S-M] Crosshair hit / kill / block markers with distinct UI ticks, plus a short HP sliver over a hit warden.
2. [S] Calm the first minute: "Move quietly" on D1 opening with 2 lines (not at 1.5 s), the meeting at the normal reading speed with a
   "{Enter} skip" hint.
3. [S] One bottom column for May's line and the hint; the interact prompt moved out of the crosshair ring; re-check 100 / 150 % at both
   resolutions.
4. [S] HUD hierarchy in vh (status, toasts, labels), "?"/"!" marks and diamond pips, HUD blinks under Reduce shake/flash at 3 Hz or less,
   shorter alarm toasts.
5. [S] Level title and goal banner, load progress, Fullscreen button, "sound is off" note; run the release checklist in the itch iframe
   (Chrome and Firefox, the card relock path) on the 10-09 draft.

## Release checklist

1. Settings open from start and pause; every slider changes something audible or visible right away; values survive a reload.
2. Mouse at 0.3x and 2.0x both feel usable; Invert Y works in normal and aim mode.
3. Reduce shake/flash on: no camera shake, no full-screen flashes, no glitch tear; nothing blinks faster than 3 times a second.
4. HUD at 150 % fits a 1280x720 window without overlap; HUD at 100 % reads in the itch embed.
5. Every hint is at most 60 characters and every toast at most 28; no two hints on screen; no hint during alarm 3.
6. Deuteranopia screenshot: suspected vs spotted, alarm stages, paused vs active device are all distinguishable.
7. itch iframe: click to start gives sound and lock; Esc pauses; alt-tab pauses; resume works; fullscreen is optional.
8. In a hack, one Esc does not abort; two do; the result and its toast both appear.
9. Takedown shows "[E] SHUT IT DOWN" only from behind; May's abilities 1-2 show their key and cooldown.
10. Every May line and every real-world line has a subtitle at most ~38 characters per line on a dark backing.
11. The L3 ending choice shows two equal buttons and cannot be clicked by accident (no auto-advance, no timer).
12. Death and alarm messages say why ("a camera saw you").

## Don'ts

- Do not build a tutorial level or a wall of text; L1 is the tutorial and the game is ~20 minutes.
- Do not bind pause to the Esc keydown, and never let the first Esc in a hack abort it.
- Do not request pointer lock or start audio on page load; it always fails and burns the first impression.
- Do not add full key remapping, colour themes or localisation for the jam.
- Do not show cones or zones without network vision (DESIGN 8); do not let colour carry meaning alone; no Halloween orange (DESIGN 14).
- Do not fire hints in combat or stack them; a missed hint is better than an unread one.
- Do not use `localStorage` without try/catch; a refusing browser must still play with defaults.
- Do not invent rules in UI text: if a hint and DESIGN.md disagree, fix the hint (or ask the designer and update DESIGN.md, then DESIGN.ru.md).
