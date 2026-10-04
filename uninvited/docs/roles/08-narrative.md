# Narrative designer / writer guide - Uninvited

The narrative role owns every word the player reads and the order the player learns things in. That covers the prologue, the room scenes, May's lines, the findings in the levels (Jim's notes, the firing spreadsheet, the Top's letters), the news banners, the CCTV encounter with Jim, the L3 choice, both endings and the itch page text. It also owns how the story and the mechanics fit together: the ending counter, the hero's colour and May's refusal. Files: `texts/en.json`, which holds every line (story keys go next to the UI keys; no story text in code), DESIGN.md sections 1-5 and 10 (the story is decided there, so any change goes into `DESIGN.ru.md` and `DESIGN.md` together), the story stills in `art/generated/` (OP*, S1-S6, J1, N1-N4, M1-M2, E1-E2) and the itch page. The rules for ending logic live in `core/rules/progress.ts` and `config.json` `ending`. Changes there go through the gameplay owner. This role sets what they must mean.

## Principles

- **The environment tells the story; the player works out "what happened here".** Props, light, composition and subtext come before exposition. Source: Smith & Worch, "What Happened Here? Environmental Storytelling", GDC 2010 - https://gdcvault.com/play/1012647/What-Happened-Here-Environmental
- **No ludonarrative dissonance.** The mechanic and the theme must not say opposite things. If playing the fun way earns shame, the game must say out loud that this was the player's choice. Source: Clint Hocking, 2007 (overview: https://en.wikipedia.org/wiki/Ludonarrative_dissonance)
- **A blunt kill counter turns into binary morality.** Weights, visible consequences in the world and a real choice make branching mean something. Source: Dishonored's chaos system - https://wccftech.com/dishonored-2s-chaos-system-implications-explained-game-director/amp/
- **A voice grows out of a limit; "funny is funny once"; tie every line to what the player just did.** Source: Wolpaw / the Portal team - https://www.gamedeveloper.com/game-platforms/best-of-gdc-the-secrets-of-i-portal-i-s-huge-success , https://www.shacknews.com/article/51474/gdc-08-portal-creators-on
- **Do not slow the game down for the story; let the player do the story.** Source: "Making a Fun Story Without Slowing the Game Down" - https://pgad.itch.io/one-room-one-boom/devlog/1133039/making-a-fun-story-without-slowing-the-game-down
- **Short snippets, the point first; players skim.** A jam story needs three beats: hook, choice, resolution. Sources: Failbetter, "Narrative snippets" - https://www.failbettergames.com/narrative-snippets-writing-for-story-games/ ; https://www.wayline.io/blog/best-practices-narrative-game-mvps
- **Indie narrative: little content, strong repeatable devices.** Source: Edwin McRae - https://emshort.blog/2018/06/05/narrative-design-for-indies-edwin-mcrae/
- **From common knowledge:** Papers, Please builds morality out of routine and time pressure. Gone Home and Firewatch put the plot in objects and a voice, and the player chooses how deep to read.

## Decisions for Uninvited

- **The story** (DESIGN 1, 3, 4). Johnny, a middle manager at Shuseki, is framed and exiled to the Free Territories. He hacks towards Jim to take revenge. Jim turns out to be a victim too: the Top orders him by letter to frame and fire people, and the revenge changes nothing. Johnny's face is never shown. The real world is seen in first person (DESIGN 5).
- **Length** (DESIGN 6, changed 2026-10-04): about 5 minutes per level plus about 5 minutes of real-world scenes, a ~20-minute game. This replaces the 30-45 minutes the review assumed. All text budgets below are sized for 20 minutes.
- **The theme is "Uninvited" only** (DESIGN 14): no Halloween dressing. Every layer carries the theme. Johnny is uninvited in the corporation and in Jim's network. May is the uninvited virus in his assistant. The parcel is the uninvited guest at the door.
- **The reveal order** (DESIGN 4). L1: Jim's framing notes (the evidence that misleads). Room: the food delivery. L2: Johnny is one of many (the firing spreadsheet), Jim's private notes, the unsent transfer request. Room: news of mass layoffs. L3: the Top's letters (~10 a week) and Jim's fresh notes. Then the encounter, which is a screen of lagged CCTV stills plus text, not gameplay.
- **May** (DESIGN 10): a voice close to GLaDOS, delivered as a beep voice with subtitles (DESIGN 13). She meets Johnny by chance at T0 in L1. She refuses only in L2, a couple of times ("personal data of innocent people"), and quiet detours always exist.
- **The ending is an explicit choice in L3** (DESIGN 4, "Changed after the reviews"). Johnny either sends Jim the letter or strikes at him through the cameras. The counter and the hero's colour are pressure along the way, and May comments on them. They are not the verdict.
- **The counter no longer cascades** (DESIGN 4). A checkpoint counts red only if an alarm-3 wave fight happened since the previous checkpoint. Thresholds come from `config.json`: `"ending": { "sadAt": 4, "totalCheckpoints": 9 }`. They now drive the colour and May's comments.
- **Quiet endings** (DESIGN 4). Peaceful: the letter, then later a knock and a small parcel (food, a little money), with no triumph. Sad: a knock, "a parcel for you", black screen, then the empty desk (S6). Revenge changes nothing.
- **The non-lethal takedown** (DESIGN 8): an override from behind powers a warden down. It does not count as a kill for the story.
- **Where DESIGN.md wins over the review.** The game is 20 minutes, not 30-45. The ending is chosen, not computed. The grenade and the "everyone dies" ending are gone. May's line budget is cut from the review's 60-80 lines. The hero's colour stays as a visible hint (DESIGN 4), but it is no longer the verdict.

### How the L3 choice works (the target; not built yet)

1. L3 ends at the artifact. The CCTV screen plays S1-S5 as lagged stills (Jim alone, the family photo J1 in his hands), with one caption line each.
2. The last still holds and two options appear, presented equally: **SEND THE LETTER** / **CAMERAS -> JIM**. There is no timer, no default focus and no dialogue tree.
3. Right before the choice, May speaks one line chosen by the counter (red-leaning, blue-leaning or even). This is the only place where the counter touches the ending, and only as tone.
4. The choice alone picks the ending. `isSadEnding()` in `core/rules/progress.ts` still decides by the counter and must be replaced by the stored choice when the endings are built. The non-cascading counter is already in the working tree (`alarm.segmentFight`).
5. "Cameras -> Jim" is never shown on screen. The stills cut to static, and the player never learns exactly what Johnny did. This keeps "Whether Jim gets fired stays unclear" (DESIGN 4) true for both branches.

### How the quiet endings play

- **Peaceful:** the letter text is shown on Johnny's screen (4-5 lines). Back in the room an exit button appears. If the player waits a minute or two, there is a knock: "A parcel for you." It holds noodles and a thin envelope. `E1-parcel-money.jpg` shows a whole box of cash, which reads as a reward. It does not match "a little money" and needs a reroll or a new still.
- **Sad:** back in the room, a knock: "A parcel for you." Black screen. A low sound with no explosion visual. Then S6, the empty desk with the light still on. `E2-parcel-door.jpg` (the box with a red light) belongs to this branch only. It must never appear in the room before the finale or in the peaceful ending.

## Rules of thumb and metrics

**Text budget: about 1200 words in the game, total.** This is a ceiling, not a target, at roughly 6 minutes of reading:

| Block | Words |
| --- | --- |
| Prologue (8-10 lines; Jim's firing speech from DESIGN 4) | ~120 |
| Room: repeated actions (water, eat, tablet, window, cry) + 3 specials | ~150 |
| May: 40-50 lines at 12 words or fewer, by trigger | ~350 |
| Findings: 8 at 25-30 words or fewer | ~230 |
| News banners: 4 at 15 words or fewer | ~60 |
| CCTV captions + the choice | ~90 |
| Two endings | ~120 |
| itch page (outside the game) | ~80 |

**Findings.** One finding is one screen with 25-30 words at most and one sharp detail. Only the three level artifacts must be read: L1 Jim's framing notes, L2 the note on the server, L3 the Top's letter. Everything else is optional (E to read), like Gone Home. Six vivid findings beat twenty grey ones. Each finding needs a place in the world: Jim's desk in L1, the archive of the fired in L2 (rows of grey icons) and the room of the Top's letters in L3 (a stream of identical requests).

**May - tone rules.**
- Dry, precise and amused, like GLaDOS with less menace. At most 12 words per line, because sarcasm reads only in text over a beep voice.
- Every line is tied to an action: the meeting, a death, an alarm, a hack, a red wall, the refusal, a checkpoint under alarm and the choice. She never comments on nothing.
- She is silent more often than she speaks. No line repeats within a level. At most one line per 30-40 s of play outside scripted beats.
- She never explains the twist and never moralises. She asks: "Feels good, doesn't it?"
- Her arc in one sentence: an assistant nobody asked for. She is uninvited too. She is cynical until the L2 refusal, sincere there, and afterwards cynical again but no longer simple.
- She calls him "Johnny". She talks about "the letters" and "upstairs", never "the Top".

**Jim's notes - tone rules.**
- Private, tired, short sentences. One domestic detail per note (Anna, seven o'clock, the kids' school). No self-pitying monologue.
- L1 notes are cold, list-like and literally true. On a second reading after L3 they mean something else. Plant one crack, such as "Don't think about it."
- L2 notes are personal and dated. L3 notes are fresh, written after Johnny's firing: broken, the transfer, the risk of quitting.
- Jim never names the Top. Jim never addresses Johnny.

**The Top's letters - tone rules.**
- A corporate template, polite and menacing in HR language. The subject line is an employee's name. There is no signature, only "This message requires no reply."
- Repetition is the point: show a scrolling list of identical subject lines, and let the player read only one or two letters in full. Johnny's name is one row among them.
- 25 words at most. No adjectives about people.

**Sample lines (tone; drafts for `texts/en.json`):**
- May, the meeting (L1, T0): "Oh. A visitor. Nobody invites me in either. Hold still, I'm borrowing your hands."
- May, the first red wall opens: "You're welcome. I'd say it was nothing, but it was exactly nothing."
- May, alarm 3: "That was not stealth. That was a doorbell."
- May, a red checkpoint: "Feels good, doesn't it? That's usually how it starts."
- May, the L2 refusal: "These are people's names. Their kids' schools. I won't hold the door open for this. Find another way, Johnny."
- May, before the choice (blue-leaning): "You came all this way without a sound. Your call."
- May, before the choice (red-leaning): "You've been loud all night. Finish it. Or don't."
- Jim's note, L1: "Thursday: leak the Kessler file. J. takes the fall. Clean. Don't think about it."
- Jim's note, L2: "Fired nine this week. Smiled for all of them. Home at seven, told Anna it was a quiet day."
- The Top's letter, L3: "Subject: J. Lee. Frame him cleanly. Last week you hesitated. We noticed. This message requires no reply."
- Peaceful ending, Johnny's letter: "I'm still angry. But I saw your desk, Jim. Your room is smaller than mine."
- Sad ending: "A parcel for you." *Silence. Black screen. An empty desk, the light still on.*

**Pacing of the twist: three shifts.** "He did it" (L1) -> "not only me" (L2 spreadsheet + the room's layoff news) -> "him too" (L3 letters + CCTV). Each shift is a scene or an object, not a sentence like "something does not add up".

## Review 2026-10-04

**Strengths.**
- The emotional core is rare for a jam: revenge that changes nothing, and an enemy who is also a victim.
- The theme has more layers than the doc says: Johnny exiled, May as the uninvited virus, the parcel at the door.
- The stills already tell the story. OP2: Jim guilty in the doorway. S3: Jim holding the family photo on a fisheye camera, the best frame. S6: the empty desk. N1: Johnny is not alone. J1: warm light against cold metal.
- The room works as a pause. The CCTV encounter is cheap and stronger than a boss fight. The faceless first-person hero gives identification at no cost.

**Problems, by impact.**

| # | Problem | Impact | Status |
| --- | --- | --- | --- |
| A | The counter measured stealth failure (alarm-3 checkpoints), while the ending text judged morality ("killed no one"). Playing Breaker, the fun way, earned a tragedy. | High | In progress. The explicit L3 choice and the non-cascading counter are decided (DESIGN 4). The counter is in the working tree; the choice is not built. The takedown gives Hacker a non-lethal tool (DESIGN 8, not built). |
| B | L2 morality inverts: the "smart" Hacker reads innocents' data and the Breaker never touches it, so May's refusal is only an obstacle. | High | Open. Make the refusal a scene with a cost (rec. 3). |
| C | The twist risks being predictable, and nothing between L1 and L2 shakes the player's certainty. | High | Open for the text. DESIGN already places the spreadsheet in L2 and the layoff news in the room, so the three shifts fit the structure. |
| D | The endings read as reward and punishment (a box of cash; a grenade and "everyone dies"). | Medium | In progress. Quiet endings are decided (DESIGN 4) but not built. E1 still shows a box of cash. |
| E | The theme lives in the plot, but the player does not hear the word. | Medium | Open. One recurring line from May, the level titles and the ending screen should carry it. |
| F | May has no written voice. The only line, `may.l1.meet`, is narration. | Medium | Open. |
| G | Too many findings for the playtime; jam players read 1-2 lines. | Medium | Open. The budget above sets limits. It is even tighter now because the game is 20 minutes. |
| H | The itch pitch ("Let's see what comes of it") does not sell May, the theme or the style. | Medium | Open. DESIGN 1 says the agent polishes it at release. |
| I | The abstract network has no story places, and the hero's colour gives the ending away too plainly. | Low-medium | Partly decided otherwise. The colour stays as a visible hint (DESIGN 4), but it is now pressure rather than the verdict, so the code's full red at `sadAt` is acceptable. The story places are open. |

**Top-5 recommendations (updated).**
1. **(M) Write all story text in one pass** into `texts/en.json`, inside the ~1200-word budget, before L2/L3 are laid out. Right now `en.json` has no story lines.
2. **(M) Build the L3 choice screen** on top of the CCTV stills: two equal options, one May line picked by the counter, the stored choice replacing `isSadEnding()`. The non-cascading counter is done in the working tree.
3. **(S) Turn May's L2 refusal into the central scene.** She refuses to open personal data. The Hacker can work around her and read the finding at the cost of shame (one line from her afterwards), or leave it unread. Privacy becomes both the theme and a choice.
4. **(S) Build the quiet endings** as decided: a small parcel (reroll E1), and knock, black, S6. No spectacle and no reward.
5. **(S) Rewrite the itch pitch and make "Uninvited" audible.** Draft: "Fired. Exiled. Uninvited. Johnny breaks into the network of the boss who framed him, with an AI nobody invited either. Sneak and hack, or break everything. The deeper you go, the less revenge makes sense." Screenshot order: key art, S3, May, combat.

## Release checklist

- [ ] Every story line is in `texts/en.json` and none is hard-coded. The total in-game word count is about 1200 or less (count it).
- [ ] No May line is longer than 12 words, and no finding is longer than 30 words. Each finding has exactly one sharp detail.
- [ ] The three mandatory artifacts (L1 notes, L2 server note, L3 Top's letter) read on their own. A player who skips every optional finding still understands the twist.
- [ ] May refuses in L2 and nowhere else, and a quiet detour exists at each refusal (test on the bot route).
- [ ] The L3 choice is reachable on both paths. Both options are equally styled, and the choice, not the counter, decides the ending.
- [ ] Peaceful ending: the letter, the exit button, a delayed knock and a small parcel. No cash box, and no red light anywhere in the room.
- [ ] Sad ending: knock, "A parcel for you", black screen, S6. No explosion visual and no on-screen violence against Jim.
- [ ] Johnny's face appears nowhere: not in stills, not in the prologue, not on the itch page.
- [ ] No Halloween words or imagery. "Uninvited" is heard at least three times: May, the meeting or a level title, and the ending.
- [ ] Subtitles stay on screen long enough to read: about 1 s plus 0.3 s per word, and never cut by the next line.
- [ ] Story text has been read once aloud for rhythm and once by the designer cold. Typos and tense are checked.
- [ ] The itch page text is final and matches the game's ending structure (it no longer promises an automatic ending).

## Don'ts

- Do not add Halloween motifs (ghosts, horror, pumpkins). The theme is "Uninvited" only.
- Do not add a dialogue tree or reply choices. The single L3 choice is the only branch.
- Do not show Johnny's face and do not voice him. A beep voice and subtitles are enough.
- Do not explain the twist in a monologue. The letters and S3 carry it.
- Do not let the counter silently decide the ending, and do not let May call the player "bad". She can only ask.
- Do not show what "cameras -> Jim" does, and do not resolve whether Jim is fired.
- Do not make May joke on every line ("funny is funny once"). Silence is part of her voice.
- Do not multiply findings, and do not write a finding the player has to read twice to get.
- Do not put the red-lit parcel (E2) or a money box (E1) on screen before the finale.
- Do not write a story change only into this guide. Story decisions go into `DESIGN.ru.md` and `DESIGN.md`.
