# Camera designer and cinematographer guide - Uninvited

This role owns everything the player sees *through*: the third-person gameplay camera in the network (follow, collision,
aim, crouch, sprint/dash FOV, camera juice) and the staging of every real-world scene (the office prologue, the room, the
transition into the network, the CCTV encounter with Jim, both endings). It touches `view/camera.ts`, the camera wiring in
`view/game-view.ts` (FOV, shake, kick), the hero fade in `view/hero.ts`, `config.json` `view.camera`, `view.fov`,
`view.dashFov` and `view.juice`, the `reduceFx` switch in `view/settings.ts`, and - once they exist - the 2.5D scenes
(`tests/room-fp/` today, `view/scenes/` later) and the story stills in `art/generated/` (O3, OP2-OP5, P6, S1-S6, CU*, E1-E2, F1, N1-N4).

## Principles

1. **The camera serves the player's task.** It must never break orientation, distance judgement or line of sight.
   John Nesky, "50 Game Camera Mistakes", GDC 2014 (https://gdcvault.com/play/1020460/50-Camera; summary:
   https://gamedeveloper.com/design/video-50-common-game-camera-mistakes----and-how-to-fix-them).
2. **The camera filters input but never costs responsiveness.** Damp and smooth, but keep offset, distance and FOV as data.
   Mark Haigh-Hutchinson, "Real-Time Cameras" (https://www.routledge.com/Real-Time-Cameras-A-Guide-for-Game-Designers-and-Developers/Haigh-Hutchinson/p/book/9780429258190).
3. **Over-the-shoulder** (RE4, Gears): the hero sits off-centre, aiming = closer + narrower FOV + more shoulder.
   (https://giantbomb.com/wiki/Concepts/Over_the_Shoulder; Cinemachine ThirdPersonFollow:
   https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineThirdPersonFollow.html).
4. **Lead room / looking space.** Leave space in the frame in the direction of movement and gaze (https://www.learnaboutfilm.com/?p=1666).
5. **Eyeline match, shot/reverse shot, the 180-degree rule.** Eyelines agree across cuts; characters keep their screen side
   (https://www.masterclass.com/articles/shot-reverse-shot;
   https://www.masterclass.com/articles/film-101-what-are-eyelines-how-to-use-eyeline-match-to-tell-a-story-and-drive-a-narrative).
6. **The Kuleshov effect.** Meaning comes from the cut: a face plus an object reads as emotion with no animation
   (https://en.wikipedia.org/wiki/Soviet_montage_theory). This is how a 2.5D scene with no animated character tells a story.
7. **Ken Burns.** A slow push or pan with parallax turns a still into film, and the move must go *toward* the meaning, not
   just breathe (https://en.wikipedia.org/wiki/Ken_Burns_effect; https://www.poynter.org/news/meaning-motion-ken-burns-and-his-effect).
8. **Rhythm.** Shot length follows the information in it; alternate wide, medium and close; hold on the emotional beat
   (general editing practice, same sources as 6-7).

## Decisions for Uninvited

- **Real world = first person, 2.5D, no animated character** (DESIGN 5). A generated plate + shader life (rain, neon, screens)
  + parallax from a depth map; the response to a click is a camera move, a picture change, a fade or a sound.
  **Johnny's face is never shown** (DESIGN 3) - not in close-ups either. His hands, back and the back of his head may appear
  ("drawn minimally", DESIGN 5); OP3 and OP5 are therefore allowed, a face close-up is not.
- **The story budget is ~5 minutes of real-world scenes in total** for a ~20-minute game (DESIGN 6, "Length changed").
  That budget is split below; the prologue gets about one minute.
- **The network is an open "data metropolis"** (NF6 slabs and towers 4-12 m, hex cover, light bridges over the void,
  DESIGN 6), not tunnels. The camera problem is no longer ceilings - it is tall slabs and hex cover between the camera
  and the hero, and a lot of void below.
- **Gameplay camera as built** (`config.json view.camera`): distance 4.3 m, pivot 1.6 m, shoulder 0.55 m, FOV 62
  (`view.fov`), follow lerp 32 / 16 (Y), crouch 3.5 m / pivot 1.1 m; pitch -0.45..1.15 rad, start 0.22; 5-ray boom sweep
  (radius 0.28, pad 0.14) snaps in and eases out at 2.5/s; sprint FOV +7, stride bob 0.035/0.022 m.
  Aim (RMB): 2.6 m (crouched 2.2), shoulder 0.85, FOV 50, sensitivity x0.55, ease 0.1 s (DESIGN 9 "Aim as built").
  Dash FOV is `view.dashFov` 70. When the camera comes within 1.4 m of the hero the body dithers out (to 10% at 0.6 m)
  while the visor and lines stay faintly lit (`view/hero.ts`).
- **Camera juice exists** (`view.juice`): hit-stop 40-70 ms, kick (push 0.05-0.2 m, pitch 0.012-0.03 rad, settle rate 16),
  shake on hit/kill/hurt/land/dash/shot with decay 7, glitch on kill/alarm/wall/hurt. The settings menu's "reduce shake/flash"
  (`reduceFx`) turns hit-stop shake, kick and flashes off.
- **Combat staging:** waves stay at 4-15+ enemies (DESIGN 8 "Enemy roles"); drones shoot weakly from height, wardens
  shoot from range and switch to a telegraphed melee strike up close, worms rear up for 0.42 s before a bite. All of those
  telegraphs must land inside the default frame.
- **Non-lethal takedown from behind** (DESIGN 8): press E behind a warden. No cutscene, no camera takeover - at most a tiny
  push-in and a hit-stop; control stays with the player.
- **Endings are quiet and the choice is explicit in L3** (DESIGN 4, "Changed after the reviews"): the encounter with Jim is
  lagged CCTV stills (S1-S6) and text; the sad ending is a knock, "a parcel for you", black, then the empty desk (S6);
  the peaceful one is the letter and later a small parcel. No triumph shots, no explosion on screen.
- **No Halloween dressing** in any frame (DESIGN 14).
- No new camera types (isometric, fixed angles) and no auto-rotate behind the hero during the jam.

### Real-world time budget (~5 min)

| Scene | When | Target | Notes |
| --- | --- | --- | --- |
| Office prologue | before the room | ~55 s | storyboard below; skippable on a replay |
| The room, first time | before L1 | ~70 s | 2-3 clicks (water, tablet news N2, window), then the headset CU4 |
| The room, delivery | after L1 | ~40 s | F1 noodles, one click, headset |
| The room, layoff news | after L2 | ~40 s | tablet N1, headset |
| Encounter with Jim | end of L3 | ~50 s | S1-S6 + text, then the explicit choice |
| Ending | after the choice | ~35 s | quiet; ends on S6 (sad) or the parcel (peaceful) |

Every scene is player-paced where possible (click to advance); the numbers are the pace of an attentive first-time player.

## Rules of thumb and metrics

- **FOV:** stay inside 50-70 degrees in play. Total change from the base 62 must not exceed 12 degrees in either direction
  (aim -12, sprint +7, dash +8 today - do not stack sprint and dash past 70).
- **Collision:** snap in instantly, ease out slowly (keep `easeOutRate` 2-3). The camera is never inside a slab, a bridge or a roof.
- **Look-ahead (to build):** shift the pivot 0.6-0.8 m toward movement, damped ~0.35 s; in combat bias toward the nearest
  enemy in the forward cone; settle back to shoulder 0.55 at rest. Keep `followLerp` 32 for the hero itself.
- **Combat framing (to build):** when >= 4 enemies are within 8 m - distance 4.3 -> 5.4 m, pivot +0.3 m, pitch +0.08 rad
  over 0.6 s; release over 1.5 s. FOV no higher than 68 for this.
- **Occluders (to build):** ray from camera to hero; dither out level geometry closer than ~1.2 m to the camera or covering
  the hero's chest. Never let a hex cover block fill the bottom third during a wave.
- **Aim framing (to tune):** distance 2.6 -> 3.0, shoulder 0.85 -> 0.95, crosshair at ~0.52 of screen height; the hero
  should fill no more than ~40% of the frame height while aiming.
- **Camera juice:** dash FOV kick +5..+8 in 0.08 s, back in 0.25 s; hurt shake ~0.08 m / 0.15 s and never rotates the view
  (do not take control away); every shake and kick goes through `reduceFx`.
- **Real-world shots:** 2.0-5.0 s per shot, longer only for subtitles (~15 characters per second, at least 1.5 s per card).
  Push-ins 3-6% of frame; pull-outs about 0.35 s, shorter than the push. Leave 2-3 shots in every scene static so motion stays noticeable.
- **Sound leads the cut:** J-cut - the next shot's sound starts ~0.3 s before the picture.
- **Grade:** all office stills share one grade and grain (OP4 is currently softer and lighter than OP2 - match it in the
  shader, not by regenerating). Cold steel for the corporation, warm neon for the room.
- **Screen sides:** Jim is screen-right, Johnny screen-left, for the whole prologue.

## Review 2026-10-04

The reviewer read the code and screenshots (`review/sheet1.jpg`, `world/sheet.jpg`, `combat2/aim-*`, `combat2/wave-*`,
`rfp-review.jpg`), but did not play; motion was judged from numbers.

**Strengths.**
- A good core: the 5-ray boom with instant snap-in and slow return is exactly Nesky's "never show the camera inside a
  wall, but come back gently". The "camera through walls" bug is closed.
- The aim camera follows the Gears/RE4 canon (4.3 -> 2.6 m, FOV 62 -> 50, shoulder 0.55 -> 0.85 in 0.1 s) and reads well.
- Crouch lowers the pivot and pulls in: it feels like hiding, and cover starts blocking the view the right way.
- The prologue stills are already directed: OP3 (back of Johnny's head, Jim standing over him, fists on the desk) is the
  strongest shot - over the shoulder, status by height. OP5 (the back with the box, a guard in white in the doorway) is a
  ready final image with depth. Cold steel vs warm neon reads "corporation vs slum" with no words.
- The room: FP4 + parallax + push-in on the tablet with hands is the right "hands in frame" language; the glitch jack-in
  into the network fits.

**Problems, by impact.**
1. **High - the hero sits near the centre and there is no lead room.** The hero is ~30% of the frame height, the head blocks
   the view ahead, there is no look-ahead (follow lerp 32 is nearly rigid). Worst on big open vistas over the void.
   *Status: open* (`view/camera.ts` has no look-ahead).
2. **High - in waves the camera is blocked by the level's own blocks.** `wave-8.png`: two glossy blocks fill the lower third,
   worms are ~10 px tall in the distance. Distance is fixed at 4.3 except aim/crouch. *Status: open.* The open-world rebuild
   removed the ceilings, but slabs and hex cover still occlude; with waves kept at 4-15+ (DESIGN 8) this fix matters more,
   not less. Only the hero dithers when the camera is close; level geometry does not.
3. **Medium - pitch/height too low in open zones.** Pivot 1.6 and start pitch 0.22 give floor-and-wall frames; the vista shots
   are good by accident. *Status: open.* The vantage point at each arena entrance (DESIGN 6) is the natural "showcase" spot.
4. **Medium - the hero is too big while aiming** (~60% of frame height, the left third blind). *Status: open* (config unchanged).
5. **Medium - no camera reaction to dash, hit or damage.** *Status: done* - `view.juice` now has hit-stop, kick, shake and
   glitch, `view.dashFov` 70, and `reduceFx` turns them off. Tune: the dash kick is +8, above the reviewer's +5.
6. **High for the Story score - the prologue is four stills with no movement and no editing rules.** Three similar frontal
   medium/wide shots in a row, no close-ups, inconsistent grade (OP4 vs OP2). *Status: open* - the prologue scene is not
   built yet (PLAN day 4); the storyboard below is the plan. One fix differs from the review: the review asked for a close-up
   of Johnny's face, which DESIGN 3 forbids - DESIGN wins, it is replaced by a POV close-up of his hands.
7. **Medium - the room speaks only in close-ups, no breath between shots.** The pull-back should be ~0.35 s, the hold set
   by the text; the HUD line and FPS overlay in `rfp-review.jpg` must not ship. *Status: in progress* - the room is still
   in `tests/room-fp/`; the FPS overlay is now behind F3 in the game.
8. **Risk - the CCTV encounter is not verified.** Strong idea (cold distance, lag), risk of looking like slides.
   *Status: open* - S1-S6 exist; DESIGN now makes the endings quiet and the choice explicit, which suits the CCTV language.

**Top-5 recommendations, updated.**
1. **(S) Look-ahead and lead room** - pivot shift 0.6-0.8 m toward movement / the nearest threat, damped ~0.35 s. Open.
2. **(M) Adaptive combat distance + occluder dither** - 4.3 -> 5.4 m with >= 4 enemies in 8 m; dither slabs and cover
   between the camera and the hero. Open; the most important item for the 4-15+ waves.
3. **(S) Smaller hero when aiming** - 3.0 m, shoulder 0.95, crosshair at 0.52 height, FOV 50 kept. Open.
4. **(S) Camera juice for dash, hit and hurt** - done; only check the dash kick against the FOV cap and that `reduceFx` covers all of it.
5. **(M) The prologue as montage, not slides** - the 9 shots below, ~55 s, parallax per shot, sound leading the cut. Needs
   2-3 new stills (a POV close-up of the hands, Steve looking away, the box being packed). Open, PLAN day 4.

## Prologue storyboard (9 shots, ~55 s)

Stretched from the review's ~35 s to fit the one-minute share of the ~5-minute story budget: longer holds for Jim's
subtitles and the exile, plus the existing P6 gate still as the closing image. All shots stay on one side of the line
(Jim right, Johnny left); Johnny's face never appears.

1. **O3, wide, 4.0 s.** The enclosed office, quiet, keys clicking; Ken Burns push 4% toward Johnny's monitor.
   Sound: air conditioning hum, soft clicks. Hard cut.
2. **OP4, Steve, 3.0 s.** Steve at his desk, eyes on his screen; slow pan 3% right toward the door.
   Sound: footsteps in the corridor, growing. Cut on the sound.
3. **OP2, Jim at the door (POV), 4.5 s.** Static, then a 6% push-in on his face. Sound: the door's pneumatics,
   Jim's beep voice, subtitle "Johnny." The shot holds the pause before he speaks.
4. **New still: POV close-up of Johnny's hands on the desk, 2.5 s.** The fingers close into fists, a badge under them;
   a slight tremor (shader shake, not animation). Replaces the review's face close-up (DESIGN 3). Sound: silence, harder. Cut.
5. **OP3, over the shoulder, 12.0 s.** Jim's line in three subtitle cards: "You screwed up badly." / "How could this happen
   to you? We have no choice." / "You are fired." Push-in 3% across the whole shot, no cuts inside. Sound: muffled hum.
6. **New still (or C2 crop): Steve looks away, 3.0 s.** He looks aside, not at Johnny - sympathy and guilt with no words
   (Kuleshov). Static. Sound: a quiet exhale.
7. **New still: POV hands packing the box, 4.0 s.** A few cheap belongings go in; tilt down. Static camera otherwise.
   Sound: objects knocking into cardboard.
8. **OP5, leaving with the box, 6.0 s.** Johnny's back walks to the door, the guard in white in the opening on the right;
   slow push toward the doorway with parallax. Sound: footsteps; the music starts with a low bass.
9. **P6, the gate, 11.0 s.** 6.5 s: the white gate slides shut behind him, rain and the Free Territories ahead
   (static - the gate is the motion). Then fade to black 1.5 s, the title on black 3.0 s. Sound: the gate's clunk,
   silence, then the room's rain. Into the room: fade in from dark with a 4% pull-out.

Shots 1, 6 and 7 stay mostly still so the pushes in 3, 5 and 8 are felt. The whole sequence is click-to-skip after the first viewing.

## Release checklist

1. On a full L1 run (and L2/L3 when built) the camera never sits inside a slab, bridge, tower or roof; the bot's screenshots confirm it.
2. In a 15-enemy wave the hero and the nearest threats are on screen; a worm's rear-up and a warden's melee windup are visible at default distance.
3. While aiming the target and the left periphery are both readable; the hero covers no more than ~40% of the frame height.
4. FOV stays inside 50-70 in all states, sprint and dash included.
5. `reduceFx` removes shake, kick, hit-stop shake and flashes everywhere (gameplay and scenes).
6. The prologue runs ~50-60 s, keeps Jim right / Johnny left, never shows Johnny's face, and can be skipped on a replay.
7. All real-world scenes together take about 5 minutes on a stopwatch during a cold playthrough.
8. Subtitles in every scene stay up long enough to read (~15 characters per second).
9. The CCTV encounter's lag reads as intentional; every still stays on screen long enough to read its text.
10. No debug HUD or FPS overlay in the build or the itch screenshots; F3 is off by default.
11. After regaining pointer lock in the itch iframe the camera does not jump (it snaps cleanly).
12. Itch screenshots and the GIF use lead room and show the hero, a threat and the landmark together.

## Don'ts

- No free "director" camera in gameplay and no cutscene for the takedown - never take control away (Nesky).
- No auto-rotate behind the hero and no new camera types (isometric, fixed angles) before the deadline.
- No Ken Burns on every shot - if everything breathes, nothing moves.
- No Johnny's face in any shot, close-up or reflection; no animated body in the real world.
- No FOV swings beyond 12 degrees from the base, and no shake that rotates the view.
- Do not let real-world scenes grow past the ~5-minute budget - cut shots before stretching holds.
- No triumph or explosion shots in the endings - they are quiet (DESIGN 4).
- No Halloween props, palette or framing gags (DESIGN 14).
- Do not regenerate stills to fix grade differences - unify them in the shader.
