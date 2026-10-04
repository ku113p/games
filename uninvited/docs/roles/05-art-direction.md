# Art director / environment art guide - Uninvited

This role owns how the network looks and reads: the colour roles, the brightness hierarchy, the shape language of the hero,
the guards and the city, the far view, bloom and post, and the itch cover and screenshots. It approves which generated
concepts are the reference (`art/generated/`, logged in `ASSETS.md`) and checks that the built scene matches them. Files it
touches: `config.json` -> `view.colors`, `view.bloom`, `view.fog`, `view.post`, `view.city`, `view.skyline`, `view.cityLife`;
`view/look.ts` (palette, shared materials, rim), `view/city.ts`, `view/city-kit.ts`, `view/skyline.ts`, `view/city-life.ts`,
`view/props.ts`, and the look of `view/hero.ts`, `view/drones.ts`, `view/wardens.ts`, `view/worms.ts`, `view/spawn-gates.ts`;
the Blender builds `tools/hero/build.py`, `tools/warden/build.py`. The real world (2.5D room and office plates) is in scope
only for the contrast with the network (DESIGN 5).

## Principles

- **Readability beats detail.** Silhouette and big forms read before texture; a character must be recognisable in shadow
  and in motion. Overwatch: big bold silhouettes that skins never change.
  [Designing Overwatch](https://www.cookandbecker.com/en/article/378/designing-overwatch.html),
  [Readable game art: why clarity beats detail](https://bugnet.io/blog/readable-game-art-why-clarity-beats-detail),
  [GDC: The Art of Overwatch Evolving](https://gdcvault.com/play/1024268/The-Art-of-Overwatch-Evolving).
- **Shape language per role.** Square = solid/threat, round = harmless, sharp = danger; hero, guards and environment need
  different dominant shapes.
  [Shape language in game character design](https://rocketbrush.com/blog/shape-language-in-game-character-design-how-to-make-characters-readable-and-consistent).
- **Value test without colour.** If a greyscale frame does not read, colour will not save it. Size, contrast, position and
  colour are the four levers; the eye goes to the biggest, brightest, most contrasted thing.
  [Visual hierarchy in game UI](https://bugnet.io/blog/how-to-design-a-visual-hierarchy-in-game-ui),
  [How to reduce visual confusion in your game](https://gamedeveloper.com/design/how-to-reduce-visual-confusion-in-your-game).
- **One accent colour per role, never as background.** Ghostrunner 2 paints yellow only what you must look at.
  [Ghostrunner 2 level design secrets](https://creativebloq.com/news/ghostrunner-2-level-design-secrets).
- **Light is the design element (Tron).** Light lines wrap the forms and lead the eye; straight lines tie hero, machines and
  architecture into one world. [Tron: Legacy design team interview](https://www.denofgeek.com/?p=142524),
  [Tron: Legacy production design](https://danielsimon.com/film-design/tron-legacy/).
- **Environmental storytelling ("What happened here?").** Props, light, composition and the world's reaction to the player
  hint at events; the player completes the story.
  [Smith & Worch, What Happened Here? (GDC 2010)](https://gdcvault.com/play/1012647/What-Happened-Here-Environmental),
  [Nieman Storyboard on the talk](https://niemanstoryboard.org/2011/01/14/harvey-smith-on-environmental-storytelling-and-embedding-narrative/).
- **itch cover.** 630x500 (shown as a 315x250 centre crop), the game's own palette, plus several screenshots on the page.
  [Making your itch.io page more appealing](https://itch.io/jam/treasure-hunt/topic/702390/how-to-make-your-itchio-game-page-more-appealing),
  [itch.io: cover size](https://itch.io/t/358996/what-size-for-the-games-site-banner-and-background).

## Decisions for Uninvited

**The look** (DESIGN 14, 6): clean Tron "Grid", **living lines, not square boxes**, matte and slightly cartoony saturated
like NN1. A wireless era - no interface cables anywhere. **No Halloween dressing at all** (DESIGN 14): the theme "Uninvited"
is carried by the story, not by pumpkins, ghosts or an orange-purple palette. The network is an **open data metropolis**
(DESIGN 6): platforms over a dark void, slabs and hex towers 4-12 m, light bridges, data rivers below, a landmark far away.

**Chosen concepts** (all in `art/generated/`):

| Concept | Role in the game | What to take from it |
| --- | --- | --- |
| `NF6-data-metropolis.jpg` | base of the world, every level | clean dark slabs of many heights with light only on edges, data rivers between blocks, bridges at several heights, haze, one central glowing spire |
| `NF4-nano-hex.jpg` | cover and detail kit, every level | hex prisms as real columns and terraces of varied height; DESIGN 6 says "hex towers" and "hex modules" - geometry, never a printed pattern |
| `NF2-neuromorphic.jpg` | L2 accent | neuromorphic "trees" along arena edges |
| `NF3-quantum.jpg` / `NF7-crypto-lattice.jpg` | L3 landmark / L3 finale vault | quantum core as the tower; the lattice vault |
| `NN1-net-corridor.jpg`, `NN1b` | the surface treatment | matte saturation, cyan lines along edges, red security, the floor reflection and laser grids (`view/reflect.ts`, `view/props.ts`) |
| `H10-hero-hood.jpg` | the hero | hooded long coat, only the visor glows inside the hood, the hem breaks into glowing filaments, white suit lines, gunblade, wrist display; Johnny's face never shown |
| `EM1-drone-lens.jpg` | drone | black glossy orb, a big red iris/lens, 2-3 thin orbiting red-orange rings, a red view cone |
| `EW1-warden-sentinel.jpg` | warden | tall slender figure, faceless helmet with one vertical red slit, high collar, long stiff coat plates, an energy halberd taller than the body with a glowing blade |
| `EW2-warden-enforcer.jpg` | heavy warden in waves | bulky armour, horizontal visor band, a hex energy shield on the left arm, a short heavy red blade, ~2.2 m |
| `ET1-turret-pylon.jpg` | turret, one type, sparingly (L1 core arena, L3 finale - DESIGN 8) | a faceted pylon on a hex base with two floating red rings, a floating dome head with twin barrels and a red lens |
| `KA3`, `K3`, `M1`/`M2` | key art, cover, May's icon | KA3 red-dominant symmetric corridor; M1 a ring eye in cyan and white, M2 corrupted with red |

Note: DESIGN 14's "chosen concepts" table still names `enemy-1.jpg` for security; DESIGN 8 (EM1/EW1/EW2/ET1) is the newer
decision and wins.

**Colour roles.** Code colours are linear HDR values in `config.json` `view.colors` (a channel above 1 feeds the bloom). The
hex below is the hue at full saturation (normalised to the peak, sRGB); "peak" is the brightest channel. The "review target"
column is the reviewer's proposal, not a decision.

| Role | Key | Now: hue / peak | Review target | Note |
| --- | --- | --- | --- | --- |
| World lines, terminals | `seam`, `terminal` | #5BE6FF / 2.4, #63E5FF / 2.8 | path #00E5FF, framing #0A6E80 | cyan = the world and what the hero can use |
| Dim world lines, floor guides, rivers | `seamDim` | #5CE3FF / 0.65 | - | same hue, low value |
| Hero (neutral) | `heroWhite` | #F2F7FF / 2.7 | #FFFFFF, hero only | white belongs to the hero and his blade |
| Hero, sad path / good path | `heroRed`, `heroBlue` | #FF4138 / 3.0, #5289FF / 3.0 | - | follows the ending counter (DESIGN 4) |
| Security, alarm | `security`, `securityDim` | #FF3F36 / 3.2, / 1.0 | #FF3B30, thicker lines | drones, wardens, cones, lasers, red walls, alarm waves |
| Drone rings / pupil | (uses `security`) | - | rings #FF5A3C, pupil #FF1E1E | EM1 |
| Suspicion | `suspicious` | #FFBC35 / 2.8 | #FFB000, suspicion only | "?" marks, filling arcs |
| Sound camera | `sound` | #FFA841 / 2.8 | - | too close to suspicion amber - see Review |
| Paused device | `paused` | #A7C5FF / 0.9 | - | network-vision links to paused guards |
| Checkpoint | `checkpoint` | #68D8FF / 2.9 | - | |
| Artifact (goal) | `artifact` | #FFF6CE / 2.6 | goal tier | warm white - keep it warm, never pure white |
| Worms | `worm`, `wormEye` | #FF39AF / 2.9, #FFBCE9 / 3.2 | #FF2BD6, peak <= 1.5, no white cores | magenta = mass |
| Slabs | `view.city.slabTones` | #10202c, #0e2428, #171b2c | - | three matte tones |
| Hex columns | `view.city.hexTones` | #12303a, #16283f, #1c2433 | - | |
| Fog / near haze | `view.fog` | #050c11, density 0.016 | far fog #04202A | |

**Brightness hierarchy (target, from the review, accepted direction).** Hero > enemy > goal/landmark > player's path >
framing > everything else. Concretely, by effective peak (colour peak x intensity) against the bloom threshold 0.9:

| Tier | What | Target effective peak | Now |
| --- | --- | --- | --- |
| 1 | hero lines, visor, blade | 2.5-2.7, the only white | 2.7 |
| 1 | enemy eyes, lenses, telegraphs | 3.0-3.2, red | 3.2 |
| 2 | landmark beam, artifact, checkpoint | 2.5-4, strong bloom | beam 2.4 x 1.6 = 3.8; artifact 2.6; checkpoint 2.9 |
| 3 | main floor guide (the way) | 1.2-1.6, light bloom | 0.65 x 1.5 = ~1.0 |
| 4 | slab top edges, rails, ribs, framing | <= 0.8, no bloom, thin | edges 2.4 x 0.85 = ~2.0; ribs ~1.3; rails ~1.1 |
| 5 | far city lines, windows, motes | <= 1.0 and inside the haze | far lines ~1.0 in haze 0.0042 |

Today tier 4 outshines tier 3 - the framing is brighter than the path. Fixing that is the top open item.

**Shape language per role** (review, consistent with DESIGN 8 and 14): hero = a vertical wedge with a hood and a ragged,
glowing hem; warden = tall narrow body with high square shoulders and a halberd (EW1), heavy = a wide block with a hex
shield (EW2); drone = a circle with orbits (EM1); worms = low arcs along the floor; turret = a vertical pylon with a floating
head (ET1); environment = long horizontal slabs with chamfers and setbacks, hex only as clustered prisms.

**What the world-visuals pass changed** (uncommitted work since `1f01fe6`; headers of `view/city.ts`, `view/skyline.ts`,
the new `view/city-kit.ts`, and `config.json` `view.city` / `view.skyline`):
- **Slabs have form now**: three matte tones; a 0.12 m chamfer on every free top edge with a lit crease; a sloped plinth
  where a floor meets them (`skirt` 0.45 x 0.1 m); bays (2.4-4.2 m) and tiers (3.2 m) of inset panels; vertical light
  seams on 16 % of bays; lit data windows high up (5 % warm); a stepped crown on 70 % of slabs taller than 6.5 m.
- **Hex is geometry only**: `H` cells are a terraced base with a honeycomb of prism columns of varied height (radius 0.62 m,
  rise up to 2.6 m, three tones); 30 % of low cover is a plate with a small column cluster (one instanced draw); other
  cover is a clean bevelled block with an inset seam. The old hex-dressed slabs and hex-seam texture are gone.
- **Edges over the void**: a curb, a lit lip and a low glowing rail (0.42 m, posts every 1.8 m). A one-cell void slit
  between walkable cells is a recessed lit duct grating.
- **Floor guides replace the decorative circuit paths**: `view/city-kit.ts` `buildGuides` lays one route along the streets
  from the start through the checkpoints to the artifact, with chevrons every 3.4 m, and a dimmer spur to each terminal -
  in cyan (`seamDim`), not amber.
- **Far city**: solid towers with setbacks (45 %) and spires, sparse lit windows (10 %, some warm), sky bridges (25 %);
  only a few "lit" towers keep light outlines (no more wireframe boxes); bodies slightly lighter
  (`body` 0.012/0.022/0.03), faces toward the level lighter than the sides.

## Rules of thumb and metrics

- Judge at play distance: the player sees hero and guards at **6-12 m**. A silhouette plus 2-3 accent lines is enough;
  never spend a day on close-up model detail.
- Every new glowing thing gets a tier from the table above before it gets a colour. If it is not tier 1-3, keep it under
  the bloom threshold (effective peak < 0.9).
- **Greyscale test** on every look change: screenshot, desaturate, check the order hero > enemy > goal > path > rest.
- **One hue, one meaning**: cyan = world/usable, red = security/danger, amber = suspicion only, magenta = worms, white = hero.
  Anything new that needs a colour reuses a role or asks the designer.
- **White is the hero's**: no white cores, white hit flashes or white UI-in-world on anything else near him. Warm white for
  the artifact only.
- Bloom (`view.bloom`): strength 0.45, threshold 0.9, tight mips (`factors` 1/0.35/0.1/0.03). Do not raise strength or
  radius to "make it pop"; lower intensities instead.
- Hex share: hex appears only as prism columns, `H` towers and some cover clusters (`coverHexShare` 0.3). Large flat walls
  are matte panels with seams and at most one guiding line.
- Metrics that art must respect (DESIGN 6): streets 3-6 m, arenas 20x30-40x40 m, district towers 4-12 m, cover 1.4 m tall,
  passage ceilings 3-5 m. Hero ~1.8 m, EW1 ~2.1 m, EW2 ~2.2 m, halberd ~1.3x body height.
- The landmark (the level's goal) is visible from every arena and is the single brightest far shape; the level designer's
  suggestion is 25-30 m high, above everything near.
- Performance: everything static is merged per 16-cell chunk; new far-view parts go into the existing instanced mesh. The
  summary measured 250-500 draw calls against a ~150 target - every art addition must be instanced or merged.
- Real world vs network: warm amber-pink, dirty, detailed 2.5D vs cold, clean, matte network. Keep the contrast; never
  add photorealism inside the network.

## Review 2026-10-04

**Strengths.** The hero reads best in frame (white lines on a black hood, a unique hood + ragged hem silhouette). Basic
colour coding works (cyan world, red security, amber suspicion, magenta worms); a red drive line on dark cyan reads at
once. The NN1-style corridor is the best shot in the build. The warm dirty room against the cold clean network is a strong
contrast, and the glitch transition fits. KA3 is a strong cover: red dominant, hero centred, symmetric.

**Problems, by impact.**

| # | Problem | Status |
| --- | --- | --- |
| P2 | No brightness hierarchy: every slab edge glows the same; bloom too wide, floods the lower third with cyan | **open** - edges (~2.0) still outshine the guides (~1.0); bloom unchanged |
| P1 | Open world flat and boxy, not NF6: wireframe far city, no haze gradient, no dominant | **in progress** - the world pass gave slabs chamfers, tiers, crowns and solid far towers with setbacks; haze, rivers and the landmark beam exist; needs a screenshot check |
| P4 | Hero silhouette lost in combat: worm white cores merge with his hem; tall foreground slabs cover 40 % of the frame | **open** - `wormEye` is near-white #FFBCE9 at 3.2 and hits flash white; no fade of slabs between camera and hero (only the hero dithers when the camera is close) |
| P5 | Enemies not EW1/EM1; amber used for guards, guide arrows and the goal spiral | **in progress** - EW1/EW2 builds rewritten in `tools/warden/build.py`, `warden.glb` rebuilt, `warden-heavy.glb` not built yet, `view/wardens.ts` header still describes the old warden; drone still the `enemy-1` disc (EM1 open); guides are cyan now; `sound` camera amber still overlaps suspicion |
| P3 | Hex as wallpaper | **done** in the world pass (hex only as prism geometry). DESIGN 6 keeps hex towers and hex cover on every level, so the review's "5-10 % accent" is overruled: hex stays as the kit, as geometry |
| P6 | The void and scale: a bright block grid under the drop, sky flat black | **in progress** - solid far towers and haze; DESIGN 6 wants a dark void with distant lights, so keep it dark, add depth not light |
| P7 | Flat dark walls 40-60 % of frame | **in progress** - bays, panels, seams, windows, crowns added |
| P8 | Cover/thumbnail: KA3 is a closed red corridor while the game is an open cyan city; no title; K3 empty top third | **open** |
| P9 | "Uninvited" barely visible in frame | **decided otherwise** - no Halloween or new decor (DESIGN 14); the story carries the theme; the alarm-3 red waves along the lines already show the world reacting to him |

**Top-5 recommendations, updated.**
1. **[M] Brightness hierarchy and bloom.** Bring framing (slab edges, ribs, rails) under the bloom threshold
   (`view.city.edgeIntensity` ~0.3, `cornerIntensity` ~0.25, `railIntensity` ~0.3), raise the main guide to 1.2-1.6
   effective; leave bloom strength alone or lower it. Check with the greyscale test.
2. **[S] Finish the NF6 far view** (mostly done by the world pass): make the landmark the brightest far shape, in the goal's
   direction; check the haze gradient (far towers at ~30 % value); data rivers stay dim (`seamDim`).
3. **[S] Foreground occluders.** Dither-fade slabs between camera and hero (shared with camera staging); hex wallpaper is
   already gone.
4. **[M] Enemy silhouettes and colours.** Finish EW2 (`warden-heavy.glb`), update the warden view header; give drones EM1's
   two orbit rings and a red iris (procedural, small); worms magenta only, eye and hit flash not white; amber only for
   suspicion, shift the sound camera's colour away from it. ET1 only if turrets survive the cut list (PLAN 3).
5. **[S] Cover 630x500 and 4-5 screenshots** after the look settles (PLAN days 7-8): hero large left-centre, a red EM1 drone
   upper right, the cyan spire and city behind, the title in the bottom third; KA3 may stay as page background.
   Screenshots: room, corridor/NN1, open city with the spire, a worm fight, the hack.

## Release checklist

- [ ] Greyscale screenshot of an arena reads hero > enemy > goal > path > rest.
- [ ] Nothing but the hero is white; the artifact is visibly warm, not white.
- [ ] Amber appears only for suspicion; red only for security/danger; guides are cyan.
- [ ] The landmark is visible from every arena of every level and is the brightest far shape.
- [ ] No hex used as a flat texture; no square "Minecraft" boxes without chamfers or setbacks in the near city.
- [ ] Drones read as EM1, wardens as EW1/EW2 at 10 m; turrets (if kept) as ET1.
- [ ] In a wave fight with 10+ enemies the hero's silhouette stays visible; no slab covers him from the camera.
- [ ] No Halloween props or palette anywhere.
- [ ] itch cover 630x500 reads at the 315x250 crop, with the title; 4-5 screenshots in the game's palette.
- [ ] The F3 overlay holds a stable frame rate on a weak laptop with the new geometry; draw calls checked.
- [ ] `CREDITS.md` lists every generated image and model used (the Quaternius CC0 bodies, the image models).

## Don'ts

- Do not raise bloom or add new glowing lines "for beauty": the problem is too much light, not too little.
- Do not bring hex back as a background pattern or put it on every wall.
- Do not add photorealism inside the network; keep NN1's matte look.
- Do not use the hero's white, the security red or the suspicion amber for decoration.
- Do not detail models for close-ups; the camera is 4.3 m behind the hero and enemies are 6-12 m away.
- Do not redraw KA3/K3 from scratch; crop and add the title.
- Do not add Halloween dressing, cables in the network, or present-day chip parts (capacitors, pins, boards).
- Watch the sad path: `heroRed` is almost the same red as `security`; if a fully red hero gets lost among guards, keep his
  white visor and hem filaments as the identifier rather than changing the design.

## Review 2026-10-05

Second review (`scratchpad/reviews2/05-art-direction.md`). It weighs the designer's new feedback: the hits feel
artificial, the detours are boring, everything is monotonous; the shooting reference is modern Doom; the stealth lanes
are unclear ("you just want to dash along the map edge").

**Status of earlier items.**
- P3 (hex as wallpaper): fixed.
- P5 (enemy shapes): fixed. EW1, EW2 and EM1 read at play distance after the rim/aura pass (`view.enemyLook`). The
  colour part is only partly done: amber is still on the sound camera, and amber is now also the accent of the UI cards
  and prompts.
- P1 (the open world): partly done. The far towers and the landmark beam work. The near city still reads as outlined
  boxes, and the far city looks the same in every direction.
- P4 (the hero lost in combat): partly done. Enemy effects are still white, there is no slab fade between camera and
  hero, and in melee the hero blocks the view of the enemy he is hitting.
- P6 (the void) and P7 (flat walls): partly done. One motif, a triple stripe, repeats on almost every wall.
- **P2 (brightness hierarchy): still open.** The config is unchanged: the slab edges are about 2.0 effective, and the
  route is a 2 cm tube at about 1.0.
- P8 (cover and title): open. The start screen is a text list over the live HUD.

**New findings, by impact.**
- The impact VFX are 9 cm square points, mostly white, with no contact shape, no hit flash on wardens, no damage states
  and no death dissolve (`view/fx.ts`, `view/game-view.ts` 497-570).
- L1 has one palette, one wall motif and one light level in all three arenas, and no arena has its own set-piece.
- Nothing in the art shows where the safe lanes are.
- Amber is the UI accent, though amber means suspicion.

**Top 5.**
1. [M] **Impact VFX.**
   - Streak sparks: line segments along the velocity instead of square points.
   - A contact star sprite in the target's colour at 5-6x.
   - A hit flash on wardens and worms in their own colour, never white.
   - Warden damage states: broken, flickering lines below 50 % HP; leaking sparks below 25 %.
   - A 0.4 s derez death with a red ring on the floor.
   - A tracer with a 0.05 m radius that lasts 0.12 s, plus a glow where a shot hits a wall.
2. [M] **Arena identity and lit/dark stealth language.**
   - Per-zone overrides of slab tone, fog tint, edge intensity and windows: the plaza stays cyan, the river is lit from
     below by a brighter data river, the core gets heavy red trim.
   - One set-piece per arena and 3-4 wall motifs instead of one.
   - Lit floor plates where patrols walk, dark lanes behind cover, and footlights linking the cover chains.
   - The hero's lines drop to about 40 % while he is hidden (as in Mark of the Ninja).
   - This is lighting, not view cones, so DESIGN 8 (cones only in network vision) still holds.
3. [S] **Brightness hierarchy:** `edgeIntensity` 0.35, `cornerIntensity` 0.25, `railIntensity` 0.3, `routeRadius` 0.05,
   and the route at about 2.2 effective. Check with the greyscale test.
4. [S] **Colour roles:**
   - Cyan for the UI cards and prompts.
   - No white in enemy effects.
   - `wormEye` at a peak of 1.5, magenta.
   - The sound camera moved off amber.
   - The M1 icon on May's chip.
5. [S] **Title screen:** the logo over KA3, with no HUD. After items 1-3, make the 630x500 cover and 5 screenshots.
