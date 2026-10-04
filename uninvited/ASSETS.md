# Uninvited - generated assets plan

Budget: one OpenRouter key, **$10 for everything** (expires 2026-10-11). Images get at most **$4**; the rest is kept for voices and music.
The key lives outside the repository (agent's scratchpad). Every generated asset goes into `CREDITS.md` with the model name.

## Models (live test on 2026-10-04, the same hard prompt on 8 models)

| Model | $ / image | Verdict | Used for |
| --- | --- | --- | --- |
| `microsoft/mai-image-2.6-flash` | 0.020 | best price/quality: followed every detail (back to camera, props, window) | **default** |
| `microsoft/mai-image-2.6` | 0.040 | same, more detail | the style anchors (A1, A3, A5) |
| `google/gemini-3.1-flash-image` | 0.067 | strongest at editing a reference while keeping it the same | edits of an anchor (empty plates A2, A4) |
| `recraft/recraft-v4-vector` | ~0.02 | returns SVG | the logo |
| `openai/gpt-image-2` | 0.033 | the only one that renders text reliably | only if an image must contain text |
| flux-3, seedream-5-flash, qwen-image-3, krea-2 | 0.018-0.030 | weaker on this prompt | not used |

## Fixed descriptions (copied verbatim into every prompt that needs them)

- **JOHNNY** - "a slim man in his late thirties with short dark messy hair". Office: "in a cheap grey suit with a loosened tie". Room: "in a dark worn hoodie".
  **His face is never shown** (back, over-the-shoulder, shadow) - the design says the room hides it; the agent keeps it hidden everywhere for consistency.
- **JIM** - "a man in his mid fifties with short grey hair and a trimmed grey beard, in an expensive charcoal three-piece suit, tired stern eyes" (from `concept-art/office-1.jpg`).
- **STEVE** - "a nervous young man in his early twenties, short light-brown hair, white shirt with a corporate lanyard".
- **OFFICE look** - "cold white and steel-blue light, glass partitions, brushed metal, holographic monitors, clean and oppressive megacorporation interior".
- **ROOM look** - "riveted corrugated metal walls and cheap patched plastic panels, everything cheap, worn, fourth-rate and home-made but kept tidy, no garbage, only a few power cords (a wireless era - no data cables), warm tungsten desk lamp against cold cyan screen glow, rain and pink-cyan neon outside one small window".
- **REAL suffix** - "Photorealistic cinematic film still, 35mm lens, natural film grain, no text, no letters, no logos, no watermark."
- **NET look** (key art only; the network itself is built in code) - "Tron Legacy inspired cyberspace: glossy black architecture outlined with thin continuous cyan light lines, red security, deep fog".

## Units

`refs` = reference images passed to the model. 16:9 unless noted. ~2 attempts each.

### A. Style anchors (generated first; everything else references them)

| ID | Use | Model | Refs | Prompt |
| --- | --- | --- | --- | --- |
| A1 room-master | room, fixed camera; clickable props | mai-2.6 | `concept-art/room-2.jpg`, test winner | Fixed wide shot from a corner at standing eye level of a tiny one-room home in a cyberpunk slum. ROOM look. JOHNNY in a dark worn hoodie sits in a worn office chair at a home-made computer rig with three mismatched screens, his back to the camera, face not visible. Clearly separated props: a cheap plastic water bottle and a translucent holographic tablet on a small side table, a narrow shelf with instant noodle packs, a neural-link headset with thick cables hanging on a hook beside the rig, a narrow cot along the wall, a metal door on the left. REAL suffix. |
| A2 room-plate | the same room without the man (for compositing the animated character) | gemini-3.1-flash | A1 | Keep this exact room, camera, framing, lighting and every prop identical. Only change: the office chair is empty and nobody is in the room. REAL suffix. |
| A3 office-master | prologue establishing shot | mai-2.6 | `concept-art/office-1.jpg` | Wide shot of a cramped glass cubicle of a middle manager inside a megacorporation tower. OFFICE look. JOHNNY in a cheap grey suit with a loosened tie sits at his desk facing his holographic monitors, seen from behind at three quarters, face not visible. Behind a glass partition, STEVE sits at a smaller desk. A glass door to a bright white corridor on the right. The cubicle is noticeably smaller than the offices around it. REAL suffix. |
| A4 office-plate | the same cubicle, empty | gemini-3.1-flash | A3 | Keep this exact office, camera, framing, lighting and furniture identical. Only change: nobody is in the room, both chairs are empty. REAL suffix. |
| A5 key-art | title screen, itch page | mai-2.6 | `concept-art/net-2.jpg`, `concept-art/hero-1.jpg`, `concept-art/enemy-1.jpg` | Video game key art. NET look. A lone small figure in a black light suit with thin cyan lines and a smooth helmet stands on a narrow bridge inside a vast vertical data shaft that rises into fog. Three hovering security drones - glossy black discs with a red light ring and a single red eye - watch him from above. Empty dark space in the upper third for a title. Cinematic, high contrast, no text, no letters, no logos. |

### B. Story stills

| ID | Use | Model | Refs | Prompt |
| --- | --- | --- | --- | --- |
| P2 jim-door | prologue: Jim walks in | mai-2.6-flash | A3, office-1 | Medium shot from a seated person's point of view: JIM stands in the glass doorway of a cramped cubicle, looking down at the viewer, one hand on the door frame, about to deliver bad news. OFFICE look. REAL suffix. |
| P3 johnny-hands | prologue: the firing | mai-2.6-flash | A3, P2 | Over-the-shoulder shot from behind JOHNNY in a cheap grey suit, seated, his face not visible, his hands clenched on the desk; JIM stands in front of the desk slightly out of focus, speaking. OFFICE look. REAL suffix. |
| P4 steve | prologue: Steve looks away | mai-2.6-flash | A3 | Through a glass partition: STEVE at a small desk stares hard at his screen, pretending not to hear, guilty, cold screen light on his face. OFFICE look. REAL suffix. |
| P5 box | prologue: leaving | mai-2.6-flash | A3 | JOHNNY in a cheap grey suit seen from behind, carrying a cardboard box with his few belongings down a long sterile white corridor lined with glass cubicles; office workers keep their eyes on their screens; a security guard in a white uniform walks two steps behind him. OFFICE look. REAL suffix. |
| P6 gate | prologue: exile | mai-2.6-flash | P5 | JOHNNY seen from behind, holding a cardboard box, standing in the opening of a huge white corporate security gate as it slides shut behind him. Before him in the rain: the Free Territories, a sprawl of shacks, cables and patched neon signs under a dark sky; behind him: sterile white light. Strong contrast of the two worlds. REAL suffix. |
| S1-S6 cctv | the encounter with Jim: lagged security-camera frames | mai-2.6-flash | P2 | Security camera frame from a high ceiling corner with a wide fisheye lens, grainy low-resolution footage, faint scanlines, slight motion blur, desaturated cold tones, no timestamp, no text. A night office of a senior manager; JIM ... **S1** sits at his desk with his head in his hands. **S2** reads a glowing letter on a holographic screen, a hand over his mouth. **S3** holds a small framed family photo, looking at it. **S4** types alone in the dark, only the screen lights his face. **S5** stands at the window, looking out at the city lights. **S6** (no Jim) the same office empty, the chair pushed back, the desk cleared. |
| N1-N4 news | tablet news in the room | mai-2.6-flash | - | News photo, REAL suffix. **N1** a crowd of fired corporate employees carrying cardboard boxes walking out through giant white corporate gates, drones overhead, rain. **N2** aerial dusk view: gleaming white corporate towers of a megacity on one side of a wall, the sprawling shanty town of the Free Territories on the other. **N3** a corporate executive at a white podium in front of a huge minimalist white tower, cameras flashing. **N4** a busy street market under neon rain in the slums, makeshift stalls, cables overhead. |
| E1 parcel-money | peaceful ending | mai-2.6-flash | A2 | Close-up on the floor of the same small room: an opened cardboard parcel full of bundles of banknotes, the metal door ajar behind it, warm lamp light. ROOM look. REAL suffix. |
| E2 parcel-door | sad ending, before the blast | mai-2.6-flash | A2 | The same small room: a closed cardboard parcel just placed inside the metal door, a tiny red light blinking through a torn corner of the box, ominous. ROOM look. REAL suffix. |
| F1 delivery | after level 1 | mai-2.6-flash | A1 | Close-up on the small side table of the same room: an opened cheap food delivery box with steaming noodles and chopsticks, a cheap plastic water bottle, warm lamp light. ROOM look. REAL suffix. |
| J1 family | Jim's family photo (desk, notes) | mai-2.6-flash | P2 | Slightly faded warm family photo in a simple frame: JIM, smiling a little, with his wife and two children in a city park in summer. REAL suffix. |

### C. Interface and identity

| ID | Use | Model | Refs | Prompt |
| --- | --- | --- | --- | --- |
| M1-M2 may | May's icon in dialogue | mai-2.6-flash, 1:1 | - | Icon of an artificial intelligence: a single ring-shaped eye made of cyan and white light, small glitch fragments breaking off its edge, perfectly centered, symmetrical, on a pure black background, minimal, high contrast, no text. (M2: the same but the ring is half corrupted with a few red glitch pixels.) |
| L1-L2 logo | Shuseki logo (office screens, letters) | recraft-v4-vector, 1:1, SVG | - | Minimal flat corporate logo mark for a megacorporation whose name means "agglomeration": many small squares converging into one dense square block, single color white on black, geometric, no text. (L2: a stylised circle made of concentric dense rings.) |
| C1-C2 portraits | dialogue portraits | mai-2.6-flash, 1:1 | P2 / P4 | Head and shoulders portrait, neutral dark grey background, soft cold key light. C1: JIM. C2: STEVE. REAL suffix. |
| K1 cover | itch cover 630x500 | mai-2.6, 4:3 (cropped) | A5 | The same scene as the reference, recomposed for a near-square cover: the figure on the bridge in the lower middle, drones above, empty space at the top for a title. No text. |

### Round 2 (2026-10-04, after the designer's notes)

- Johnny's face is never shown; the office is **enclosed**; the network must be **narrow enclosed spaces**.
- Network concepts: NN1 corridor with a camera cone and a laser firewall, NN2 tight server hall with a drone, NN3 maintenance duct over a guarded room.
- Enclosed office set replacing A3/A4/P2-P5: O3 master, O4 empty plate, OP2 Jim at the door, OP3 over Johnny's shoulder, OP4 Steve, OP5 leaving with the box.
- The Microsoft model's safety filter falsely blocks some prompts; the runner falls back to Gemini 3.1 Flash Image automatically.

### Round 3 (2026-10-04): first-person real world, key art in the NN1 look

- The real world is seen in **first person** with no animated character (DESIGN.md section 5).
- FP2 room plate from Johnny's chair (MAI-Image-2.6, ref A2; the Gemini edit FP1 kept an empty chair in the middle and was dropped).
  `FP2-room-fp-depth.png` - its depth map from Depth Anything V2 Small (Apache-2.0; the Base model is non-commercial and was not used), run locally through transformers.js, for parallax and focus.
- Close-ups with Johnny's hands (MAI-2.6-flash, ref FP2): CU1 water, CU2 noodles, CU3 tablet (an empty screen; news is overlaid in HTML), CU4 headset.
- KA2 key art in the matte saturated NN1 look (MAI-2.6-flash, refs NN1, hero-1, enemy-1); a MAI-2.6 version was more photographic and dropped.
  K2 cover 4:3 from KA2. These replace A5 and K1.
- The office plates (O3/O4) are still third-person; first-person office shots come with the prologue work (OP2 is already a POV shot).

### Round 4 (2026-10-04): hero redesign

- `hero-1` was too close to the Tron suit. H1-H6: the hero between Tron, a cyber-ninja runner and street cyberpunk; armor and gear,
  white light only on a few seams (the color later follows the ending counter), the face hidden. 9:16, no refs (refs pulled it back to Tron).
- H5 was blocked by the Azure safety filter with a policy error (not the BlockList one), so it was made with Gemini and looks off-style.
- After the designer picks a hero, NN1-style scenes and the KA2/K2 key art get regenerated with the new hero.

### Round 5 (2026-10-04): the room after the designer played it

- The wired headphones did not fit (you jack in with VR), the tablet was too fancy for the room, and the designer wants to look out of the window.
- FP3: a Gemini edit of FP2 - headphones removed (a hoodie on the hook), a second-hand VR headset on the desk cabled to the computer,
  a cheap scuffed tablet with a taped crack. Everything else kept. A MAI full regeneration still drew headphones and was dropped.
- FP3 depth (Depth Anything V2 Small) and exact prop masks from SlimSAM (point and box prompts, run locally through transformers.js):
  `FP3-room-fp-masks-a.png` R window glass, G tablet, B water; `-masks-b.png` R noodles, G VR. The noodles mask is a union of the shelf and per-cup masks.
- Close-ups redone against FP3 (the old ones showed the headphones): CU1b water, CU2b noodles, CU3b tablet, CU4b VR (the first try left a second
  headset on the desk), CU5 the view out of the window (MAI's filter blocked it twice; Gemini made it).
- FP2 and CU1-CU4 were deleted.

### Round 6 (2026-10-04): a wireless era

- The designer: too many cables for a wireless era - power cords are fine, interface cables are not. The chair at the bottom-left
  "sank inward" when the view moved (near-depth parallax at the frame edge).
- FP4: a Gemini edit of FP3 - no data cables, a wireless keyboard and VR headset, the chair removed (the corner is now a floor grate with tools).
  New depth and SlimSAM masks with the same channel layout; close-ups CU1c-CU4c against FP4. FP3 and the CU*b files were deleted.

### Round 7 (2026-10-04): close-ups that match the room, VR from the inside, a better window

- The designer: the props in close-ups differed from the room; a taken bottle must be gone from its place; the VR should be seen as being put on;
  the window should show poverty near and the rich city's neon far beyond the walls; the tablet close-up lost the desk behind.
- Gemini 3.1 Flash Image with two references - the FP4 plate and a crop of the prop from it - then small Gemini edits:
  CU1e water (the side-table spot empty), CU2e noodles (the shelf cups' print), CU3d tablet, CU4e the inside of the VR headset, CU5b window.
- CU1c-CU4c and CU5 were deleted.

### Round 8 (2026-10-04): the hero, simpler

- The designer likes H3 (coat) and H6 (asymmetric) but wants the in-game hero simpler, close to Tron in simplicity (a form-fitting neon suit),
  keeping the coat nuance; energy sword and energy rifle; a little hacker flavor. H7-H10 (MAI-2.6-flash, refs H3/H6).

### Round 9 (2026-10-04): the chosen hero in the network scenes

- The designer chose H10 (hooded coat) and liked that the sword and the gun are one weapon - the design now has one energy gunblade with two modes.
- NN1b corridor (Gemini after MAI's filter blocked it), KA3 key art and K3 cover (MAI-2.6-flash), refs H10 + the NN1/KA2 look. KA2 and K2 were deleted.

### Round 10 (2026-10-04): smaller VR, a livelier window

- The VR close-up was too big: CU4f (Gemini recompose of CU4e - held at ~40 cm, half the frame) and CU4g (an edit removing a second headset
  left on the desk). `CU4g-vr-inside-mask.png` (SlimSAM): the headset with the hands, so only a click on it jacks in.
- The window showed too little: CU5c (Gemini edit of CU5b) - wider, trashier, full of life. CU4e and CU5b were deleted.
- The window neon no longer flickers (it read as a broken picture); it only breathes slowly.

### Round 11 (2026-10-04): the network as an open space - "board city"

- The designer: not tunnels but an open crypto-neuro-microchip space. NB1-NB7 (Gemini, refs H10 + NN1b for the look only): a board city,
  neuro, crypto, die terraces, heat sink, floating boards, corrupted. The designer: "it is the future - why capacitors and processors";
  all NB were deleted.

### Round 12 (2026-10-04): far-future chip architecture

- NF1-NF7 (Gemini, the same refs and framing, present-day parts forbidden in the prompt): photonic, neuromorphic, quantum, nano-hex,
  crystal wafer, data metropolis, crypto lattice. **Chosen (the agent's recommendation, accepted):** NF6 is the base of the world,
  NF4's hex modules are the cover and detail kit everywhere; accents - L2 NF2's neuromorphic growths, L3 NF3's quantum core as the
  landmark and NF7's vault for the finale. Kept: NF2, NF3, NF4, NF6, NF7; NF1 and NF5 were deleted.

### Round 13 (2026-10-04): enemies

- The designer: drones only watch (and shoot very weakly), wardens watch and attack, worms crush by mass, turrets hold points; the
  in-game wardens looked like "square logs". EM1-3 drones, EW1-3 wardens, ET1-3 turrets (Gemini, ref NN1b for the look, a three-view
  sheet each). **Chosen (the agent's recommendation, accepted):** EM1 lens drone, EW1 slender sentinel (EW2 enforcer as the heavy
  warden in waves), ET1 hex pylon turret. Kept: EM1, EW1, EW2, ET1; the rest were deleted.

### D. Not now

- Seamless textures for a 3D room/office - not needed: the real world is 2.5D (generated plates, see `DESIGN.md` section 5).
- The network itself - built in code (lines, light, geometry), no images.
- Voices, music, sound effects - separate plans, after the images.

## Prompt review (done three times before generating)

1. **Against the design:** names, the no-garbage room, the headset as the "go online" device, the props for every room action (water, food, tablet),
   the delivery after level 1, mass-layoff news, the lagged camera frames, both parcel endings, Jim's family. Johnny's face hidden everywhere.
2. **Consistency:** the fixed descriptions are pasted verbatim; every scene references its anchor; one palette per place; 16:9 for scenes.
3. **Model pitfalls:** no real game or film titles inside scene prompts except "Tron Legacy" as a style word for key art; no artist names;
   "no text" everywhere (in-game text is rendered by the game, not baked into images); no negative-only phrasing for objects
   (the earlier "not vehicles" style); camera position and lens stated in each shot.
