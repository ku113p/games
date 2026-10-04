# Room, first person - engine test

Throwaway test for DESIGN.md section 5: the junkyard room seen through Johnny's eyes as a 2.5D plate
(`art/generated/FP4-room-fp.jpg` + its depth map and SAM prop masks), made as juicy as we can. Not the game architecture.

## Run

```sh
cd uninvited
bun run test:room     # then open http://localhost:3325/ (production mode: no Bun error overlay)
bunx tsc --noEmit -p .                       # type-check
```

The server bundles once at start: restart it after changing code or config.

## Controls

| Input | What |
| --- | --- |
| click "Click to start" | unlocks Web Audio, starts the rain and room hum |
| mouse move | the head follows a little (parallax) |
| hover a prop | rack focus to it, glow, label, tick |
| click a prop | push-in and its close-up |
| click / Esc / right-click | back to the room |
| VR headset -> Confirm (or Enter) | jack in; "Jack out" button (or Esc) to come back |
| H | hide / show the stats (fps, draw calls, resolution) |

Props: water bottle (drink), noodle shelf (eat), tablet (news), VR headset on the desk (jack in), window glass (look outside).

## Effects

- **Living head** - per-pixel depth parallax (3 fixed-point steps on the depth map), the view pans toward the mouse,
  a slow breathing sway and zoom. A critically damped spring drives the look. The plate is overscanned (`head.baseZoom`).
  Very near depths are capped (`head.nearCap`) and the parallax fades toward the frame edges (`head.edgeFade`,
  `head.edgeStrength`), so foreground at the border does not stretch.
- **Rack focus** - depth of field from the depth map: blur = |depth - focus|, sampled from the plate's mipmaps with
  4 taps. Focus eases to the hovered prop's depth (measured once at load: 75th percentile of the depth map inside its mask).
  `dof.idleFocus`, `dof.blurGain`, `dof.deadZone` and `head.depthClamp` depend on the depth map's value range: re-check them with a new plate.
- **Hover** - the prop masks (`masks-a`: R window glass, G tablet, B water; `masks-b`: R noodles, G VR headset):
  glow inside the mask, a rim from the mask's edge (8 offset samples), everything else dims slightly.
  Hit-testing reads the same masks once on the CPU at load (one bit per prop per pixel), so the cursor and the label react
  only over the actual prop. The rect of each hotspot is just a quick reject; the push-in aims at the mask's centroid.
- **Push-in + close-up** - ease-in push toward the prop with a radial zoom blur, a flash cut to the close-up,
  which settles and then drifts slowly (Ken Burns). Back = reverse cut and an ease-out pull.
- **Tablet** - an HTML news panel mapped onto the empty screen of the tablet close-up (`tablet.screen` corners) with a projective `matrix3d`
  that follows the drift; `mix-blend-mode: multiply` lets the glow show through. The news copy is a placeholder.
- **Noodles** - GPU-animated steam sprites over the cup.
- **Rain** - drops and trails sliding down the glass with refraction, fogged glass blur except where drops clear it,
  only where the window-glass mask is (feathered inward by sampling a coarser mip), kept subtle (`rain.dropAmount`):
  the plate already has painted drops. The neon behind flickers now and then; its mask and flicker band come from the
  refracted coordinate with soft band edges, and the drop highlights go on after the flicker, so it stays behind the glass.
- **Look outside** - the window glass is a hotspot: push-in (the radial blur streams from the window, since the view
  is clamped to the picture), `CU5-window.jpg` with a slow drift, the rain loop gets louder.
- **Screens** - scanlines, a scrolling glow line, a small flicker, only on their glowing pixels.
- **Lamp** - warm pixels follow the lamp level; every few seconds the contact fails for a moment. Dust motes drift in its light
  (GPU-animated points, depth-blurred like the rest).
- **Post** - vignette, film grain, chromatic aberration at the edges; glitch (row shifts, jumping blocks, RGB split,
  a rolling scanline tear), white flash and black fade for the transitions.
- **Jack in** - confirm on the VR headset close-up -> exponential push into the centre screen with rising glitch, timed so
  the white flash lands on the slam of `jack_in.mp3` (1.565 s) -> the network fades in from white with a glitch settle and a drift.
  Jack out: `jack_out.mp3` glitch burst while the network falls away, black, and on its thump (1.40 s) back in the room.
- **Audio** - one AudioContext created on the first click; files fetched at load and decoded once; `_vN` variants picked at random.
  Rain + hum loops on an ambient bus that is ducked in close-ups and ducked + low-passed in the network.
  `room_hum_loop` is mostly 50-250 Hz, so laptop speakers barely play it - judge its level on headphones.

## Files

- `art.ts` - every picture the test may use, imported by file name (Bun bundles only static imports: a new picture
  needs one line here). `config.json` (`assets`, each hotspot's `closeup`) picks which are used, so swapping a set is a config change.
- `main.ts` - state machine (room / push / closeup / pull / jackPush / net / jackOut), input, frame loop.
- `shaders.ts` - world pass (plate or image), dust, steam, post.
- `audio.ts` - the Web Audio mixer.
- `config.json` - every tuning number and asset name: parallax, focus, hotspots (rect, mask channel, close-up, sound, ducking,
  rain level), the tablet screen corners in the tablet close-up, timings, volumes.

Draw calls: 3 in the room (plate, dust, post), 2-3 in close-ups. No allocations in the frame loop except the tablet's
transform string while the news is open.

## Test hooks

`window.__test`: `start()`, `hover(name | null)`, `click(name)`, `confirm()` / `jackIn()`, `back()`, `state()`,
`timeScale(k)` (0 freezes the animation for screenshots), `mouse(x, y)` (-1..1).
