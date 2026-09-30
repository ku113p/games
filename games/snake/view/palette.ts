// Lighting palette.
//
// COLORS ARE DATA. Color sets live in config.json (palettes.sets.<id>, hex strings); the shop decides which one is equipped.
// This module holds LIVE Color objects: the rest of the view imports them under their old names (SNAKE_BODY_COLOR, APPLE_COLOR, ...),
// and applyPalette() overwrites them in place at game start. This is the cold path: nothing is created or read from the config
// per frame. Switching sets on the fly is not supported (materials copy the color at creation): only between games, before createView.
//
// GLOW BRIGHTNESS IS COMPUTED TOO. Bloom takes linear Rec.709 luminance 0.2126R+0.7152G+0.0722B above BLOOM_THRESHOLD (bloomLuminance in palette-math: that is three's own formula, not the old Rec.601).
// A set stores only the hue; the multiplier for each role = target luminance (config.palettes.glow) / hue luminance,
// capped at maxBoost. So every set glows the same way, and "signals glow, quiet things don't" holds without hand-tuning a x3.0.
// The styling constants below (alphas, thresholds) are not balance values; per AGENTS.md balance lives in config.json, and these do not.
// Head-signal distinguishability is checked in palette-math.ts (checkPalette) and palette.test.ts: a set that fails it does not get into the config.

import { Color, FogExp2, UniformsLib, UniformsUtils, type IUniform } from 'three'
import configJson from '../config.json'
import { boostsFor, glowFor, type GlowOverrides, type GlowTargets, type PaletteSet } from './palette-math'

export type { GlowOverrides, GlowTargets, PaletteSet } from './palette-math'

/** The config.palettes section. */
export interface PalettesConfig {
  glow: GlowTargets
  /** Per-set deviations from glow (see GlowOverrides). */
  glowOverrides?: GlowOverrides
  sets: Readonly<Record<string, PaletteSet>>
}

/** Default set, and the fallback when the chosen one is not in the config. */
export const DEFAULT_PALETTE_ID = 'neon'

/** Scene and minimap background (live object, see applyPalette). */
export const BACKGROUND_COLOR = new Color()
// Fog color: not the black background but the visible scene background (faint veil of the cube walls + bloom, about sRGB 30,34,58 in Night Neon):
// otherwise distant blocks turn into black holes against the lighter veil instead of dissolving into it.
export const FOG_COLOR = new Color()

// SCENE FOG. The only mechanism for fading by distance from the CAMERA: exponential
// FogExp2 (exp(-(rho*d)^2), d is the depth in the frame). The fog color equals the background color, so distant things
// do not turn gray but dissolve into the background. The density rho lives in config.json (fog.density, 0 turns fog off
// entirely); each frame view/index.ts sets it to rho*smoothstep(freeAmount), so that in plane mode
// (camera far outside) the first game stays flat, and to 0 when the "Fog" toggle is off.
// Stock materials (snake, direction ray) get fogged on their own (fog: true by default); custom
// shaders take the same uniforms via fogUniforms() + material.fog = true and use the same formula:
// opaque ones with the standard fog_* chunks, transparent dots via fogVisibility (an alpha multiplier).
// Deliberately outside the fog: the apple (must be visible at any distance), the compass, the near head markers
// (near-cells: up to 2 cells), the cube walls, their grid and the head projection (they have their own camera-based falloff:
// FALLOFF_* in cube-frame.ts, which also works in plane mode, where the global fog is off).
export function createFog(): FogExp2 {
  return new FogExp2(FOG_COLOR, 0)
}
/** Fog uniforms for a ShaderMaterial with fog: true (the renderer updates the values from scene.fog). A new set per material. */
export function fogUniforms(): Record<string, IUniform> {
  return UniformsUtils.merge([UniformsLib.fog])
}
/** GLSL: visibility (1 is clear, 0 is full fog) for transparent shaders; same formula as FogExp2. Needs fogUniforms(). */
export const FOG_VISIBILITY_GLSL = /* glsl */ `
uniform float fogDensity;
float fogVisibility(float viewDepth) {
  return exp(-fogDensity * fogDensity * viewDepth * viewDepth);
}
`

// Arena cube edges: they glow but do not flood the frame (bloom threshold BLOOM_THRESHOLD, see the Bloom block below).
// applyPalette computes the multiplier (2.1 in Night Neon: was 1.6, then 2.2; a brighter line gives a visible soft halo along the cube edges).
export const CUBE_EDGE_COLOR = new Color()
// Edge thickness in cells: size * k, clamped to [min, max].
export const CUBE_EDGE_THICKNESS_PER_SIZE = 0.0025
export const CUBE_EDGE_THICKNESS_MIN = 0.045
export const CUBE_EDGE_THICKNESS_MAX = 0.12

// Head projection on the walls: very quiet, clearly dimmer than the edges and the snake.
// Luminance (linear color * alpha) is below BLOOM_THRESHOLD.
export const MARK_COLOR = new Color()
export const MARK_LINE_ALPHA = 0.12
export const MARK_SQUARE_ALPHA = 0.2

// Readability: body and tail are bright (blue-green neon, luminance never drops below
// the level of a bright segment); the head is warm and brighter than the body, so it cannot be
// confused with the body or with the apple (pink).
export const SNAKE_BODY_COLOR = new Color()
export const SNAKE_TAIL_COLOR = new Color()
export const SNAKE_HEAD_COLOR = new Color()
// Even/odd segments differ slightly in brightness, so length and motion are visible.
export const SNAKE_STRIPE_DIM = 0.72
// Snake body brightness multiplier (snake view only; the minimap does not use it).
// Neon pass: was 1.0 (the body did not glow at all), now 1.06 (Night Neon; computed). Bright segments glow,
// the dim stripes (SNAKE_STRIPE_DIM) stay below the threshold, so the striping does not vanish.
export let SNAKE_BODY_GLOW_BOOST = 1.25
// Head end of the snake: the first SNAKE_HEAD_END_SEGMENTS body segments (right behind the head) glow always: no stripe dimming, no body-to-tail ramp (the
// pure body hue: a normalised cyan tail collides with the goal pink for deuteranopia), luminance pinned to SNAKE_HEAD_END_LUMINANCE (config.palettes.glow.headEnd,
// above BLOOM_THRESHOLD). Without it a short snake glowed nowhere and a long one only on the even segments.
export let SNAKE_HEAD_END_LUMINANCE = 0.9
export let SNAKE_HEAD_END_SEGMENTS = 3
export let SNAKE_HEAD_END_MAX_BOOST = 5
// Close to the camera a head-end segment is huge on screen and its bloom would flood the frame ("far too fat"): the luminance falls to NEAR_LUMINANCE
// (below the threshold) inside NEAR_FROM cells and rises to the full glow at NEAR_TO cells and beyond.
export let SNAKE_HEAD_END_NEAR_LUMINANCE = 0.6
export let SNAKE_HEAD_END_NEAR_FROM = 1.5
export let SNAKE_HEAD_END_NEAR_TO = 3.5

export const APPLE_COLOR = new Color()
// Apple brightness multiplier (the minimap does not use it). Neon pass: was 1.0 (the linear luminance
// of the red-pink is about 0.25 on the bloom scale, below the threshold, so the apple did not glow), now 2.65 in Night Neon (computed).
export let APPLE_GLOW_BOOST = 2.5
export const APPLE_EMISSIVE_PULSE_MIN = 0.6
export const APPLE_EMISSIVE_PULSE_MAX = 1.35

// Obstacle outlines: purple neon. Neon pass: the multiplier was 1.0, now computed (3.19 in Night Neon, the look it had before the Rec.709 fix). The thin
// 1 px line became bright, but its halo is tiny: the faces themselves do not glow.
// The faces take the same color, so OBSTACLE_FACE_BRIGHTNESS is divided by the multiplier:
// face brightness stays as before (0.3 of the old color); only the line changes.
// The line color is already multiplied by the multiplier (applyPalette); OBSTACLE_FACE_BRIGHTNESS is divided by it.
export const OBSTACLE_COLOR = new Color()

// Wall grid: dim, below the bloom threshold; every 5th line is brighter.
export const GRID_COLOR = new Color()
export const GRID_MINOR_ALPHA = 0.1
export const GRID_MAJOR_ALPHA = 0.3

// Minimap: a muted hint for peripheral vision.
export const MINIMAP_BG_COLOR = new Color()
export const MINIMAP_BG_ALPHA = 0.4
export const MINIMAP_BORDER_COLOR = new Color()
// Quiet edge of the viewport (the world continues beyond it), clearly dimmer than the wall.
export const MINIMAP_BORDER_ALPHA = 0.22
// The real arena wall on the map: a solid thick line along the side of the window where it hit the wall.
export const MINIMAP_WALL_COLOR = new Color()
export const MINIMAP_WALL_ALPHA = 0.95
// Axis labels ("XZ" on the top map, "Y" on the level gauge).
export const MINIMAP_LABEL_ALPHA = 0.6
// Center line of the level gauge (the vertical floor-to-ceiling strip): quiet, markers on top.
export const MINIMAP_LEVEL_TRACK_ALPHA = 0.35
// Window ticks of the strip (minor every cell, major every N world cells); they "scroll" past the head marker.
export const MINIMAP_LEVEL_TICK_ALPHA = 0.3
export const MINIMAP_LEVEL_TICK_MAJOR_ALPHA = 0.7
// Strip trough spanning the full arena height: a thin quiet line with two dots on it (me and the apple).
export const MINIMAP_TROUGH_ALPHA = 0.5
export const MINIMAP_HEAD_ALPHA = 0.9
export const MINIMAP_APPLE_ALPHA = 0.85
// An apple outside the slice (projection) or outside the window (arrow at the edge) is quieter than an "apple here", but still visible.
export const MINIMAP_APPLE_RING_ALPHA = 0.95

// Direction rays. Linear luminance is safely below BLOOM_THRESHOLD (0.75):
// five rays instead of one must not add a halo.
export const RAY_MAIN_BRIGHTNESS = 0.48
export const RAY_SIDE_BRIGHTNESS = 0.2
// Highlight of what the main ray will hit (wall, obstacle, body):
// warm red-orange, linear luminance about 0.35, below the bloom threshold.
export const RAY_DANGER_COLOR = new Color()
// The hit-face fill is solid and so visually heavier than the old frame: brightness is reduced,
// and the color's linear luminance stays below BLOOM_THRESHOLD (currently about 0.16).
export const RAY_HIT_FILL_BRIGHTNESS = 0.5
// Head signals. Four states, read by COLOR (not by pulsing): idle is a calm muted
// light yellow (below the bloom threshold, no glow: the head is distinguishable but not at maximum brightness);
// goal (apple straight ahead) is bright, like the head used to be, and glows (pink, the apple's color);
// danger in 2 steps is orange; danger in 1 step is red. Danger overrides goal.
// The multipliers are chosen with bloom in mind: it takes Rec.709 luminance 0.2126R+0.7152G+0.0722B > BLOOM_THRESHOLD.
// Pure red/pink has low luminance, so they need a multiplier above 2 (otherwise no halo), while for orange
// the multiplier also raises the green channel and shifts the hue toward yellow, so we take an orange with a low G.
// Was: head 0xfff27a * 1.4 (luminance about 1.18, the brightest spot in the frame); now: * 0.7 (about 0.60, no halo).
// applyPalette computes the HEAD_* multipliers and the danger colors. In Night Neon: idle x0.70, goal x3.54, danger-2 x3.04, danger-1 x4.93.
export let HEAD_IDLE_BOOST = 0.7
export const HEAD_GOAL_COLOR = APPLE_COLOR
export let HEAD_GOAL_BOOST = 3.0
export const HEAD_DANGER_COLOR_FAR = new Color()
export const HEAD_DANGER_COLOR_NEAR = new Color()

// Obstacle faces: solid, opaque (writing depth). Face brightness
// is a share of the edge color (edges 1.0, faces 0.3): the cube reads as a volume with an outline, not as
// a flat fill. Shading by normal axis (the light is fixed in the world) gives shape
// even where neighboring faces share a color: +y is lightest, z is darkest,
// and negative sides are dimmer by another NEG_SHADE.
export const OBSTACLE_FACE_SHARE = 0.3
export let OBSTACLE_FACE_BRIGHTNESS = OBSTACLE_FACE_SHARE
export const OBSTACLE_FACE_SHADE_X = 0.85
export const OBSTACLE_FACE_SHADE_Y = 1.0
export const OBSTACLE_FACE_SHADE_Z = 0.65
export const OBSTACLE_FACE_NEG_SHADE = 0.8
// Alpha of a face of an obstacle that blocks the view (between the camera and the head).
export const OBSTACLE_GHOST_ALPHA = 0.08

// Bloom. The designer asked three times to weaken the halo (faces were getting lost), then asked for "more neon,
// but not too much". So the neon comes not from strength but from the brightness of the lines themselves (*_BOOST above) and
// from the RADIUS: a wider, softer halo rather than a brighter one. To roll back to the old look, use the "was" values.
// Threshold 0.75: bright lines pass with a margin; the grid, rays and dim stripes (luminance below 0.5)
// do not glow. The white hint dots (0.9) are just above the threshold and give a tiny spark, which is fine.
// (Was 0.8, now 0.75; the other comments in the view/ files refer to this value.)
export const BLOOM_THRESHOLD = 0.75
// Was 0.22, now 0.26: barely touched.
export const BLOOM_STRENGTH = 0.26
// Was 0.2, now 0.45: the main lever, a wider and softer halo at the same strength.
export const BLOOM_RADIUS = 0.45
// Other levers (tried, not adopted): BLOOM_STRENGTH 0.35+ gives a milky haze around the head;
// a threshold below 0.7 makes the dim body stripes and the obstacle faces glow as well.

// Lattice hint: white dots, linear luminance 0.9 (about 0.95 after sRGB, white)
// with BLOOM_THRESHOLD 0.75: almost no halo, only a tiny spark. Alpha counts toward luminance: 1.0 * 0.9.
export const DOT_BASE_COLOR = new Color(1, 1, 1)
export const DOT_BASE_ALPHA = 0.9

// Near layer of the hint (cell corners two cells ahead). Below the bloom threshold.
// The nearer cell is brighter, the farther one is a fraction of it (size and alpha).
export const NEAR_FORWARD_BRIGHTNESS = 0.9
export const NEAR_SIDE_BRIGHTNESS = 0.72
export const NEAR_BLOCKED_BRIGHTNESS = 0.75
export const NEAR_FAR_SIZE = 0.4
export const NEAR_FAR_ALPHA = 0.38
// A marker behind an obstacle (deeper than whatever is in front of it): a fraction of the normal alpha. It reads as "behind the wall",
// not "on the wall"; it does not blink, it is static. NEAR_DEPTH_BIAS is how many cells the marker is
// pulled toward the camera for the depth test (half the cell diagonal is about 0.87), so the marker's own cell/face is not counted as blocking it.
export const NEAR_OCCLUDED_ALPHA = 0.3
export const NEAR_DEPTH_BIAS = 0.9

// Minimap: obstacles are quieter than the head and the apple (background, not figure).
export const MINIMAP_OBSTACLE_COLOR = new Color()
export const MINIMAP_OBSTACLE_ALPHA = 0.4
// Snake body on the map: a green-cyan gradient as in the game (SNAKE_* colors), brighter than the obstacles
// and a different hue, but quieter than the head (yellow triangle, alpha 0.9, on top of everything).
export const MINIMAP_BODY_ALPHA = 0.7

/**
 * Apply a color set: overwrite the live Color objects and multipliers in place. Cold path, only between games (before createView).
 * Knows nothing about where the set came from.
 */
export function applyPalette(set: PaletteSet, glow: GlowTargets): void {
  const b = boostsFor(set, glow)
  BACKGROUND_COLOR.set(set.background)
  FOG_COLOR.set(set.fog)
  MINIMAP_BG_COLOR.set(set.background)
  CUBE_EDGE_COLOR.set(set.edge).multiplyScalar(b.edge)
  MARK_COLOR.set(set.mark)
  SNAKE_BODY_COLOR.set(set.body)
  SNAKE_TAIL_COLOR.set(set.tail)
  SNAKE_HEAD_COLOR.set(set.head)
  SNAKE_BODY_GLOW_BOOST = b.body
  SNAKE_HEAD_END_LUMINANCE = glow.headEnd
  SNAKE_HEAD_END_SEGMENTS = glow.headEndSegments
  SNAKE_HEAD_END_MAX_BOOST = glow.maxBoost
  SNAKE_HEAD_END_NEAR_LUMINANCE = glow.headEndNearLuminance
  SNAKE_HEAD_END_NEAR_FROM = glow.headEndNearFromCells
  SNAKE_HEAD_END_NEAR_TO = glow.headEndNearToCells
  APPLE_COLOR.set(set.apple)
  APPLE_GLOW_BOOST = b.apple
  OBSTACLE_COLOR.set(set.obstacle).multiplyScalar(b.obstacleLine)
  OBSTACLE_FACE_BRIGHTNESS = OBSTACLE_FACE_SHARE / b.obstacleLine
  GRID_COLOR.set(set.grid)
  MINIMAP_BORDER_COLOR.set(set.edge)
  MINIMAP_WALL_COLOR.set(set.wall)
  MINIMAP_OBSTACLE_COLOR.set(set.obstacle)
  RAY_DANGER_COLOR.set(set.rayDanger)
  HEAD_IDLE_BOOST = b.headIdle
  HEAD_GOAL_BOOST = b.headGoal
  HEAD_DANGER_COLOR_FAR.set(set.dangerFar).multiplyScalar(b.dangerFar)
  HEAD_DANGER_COLOR_NEAR.set(set.dangerNear).multiplyScalar(b.dangerNear)
}

/**
 * Apply a set by id from config.palettes. Unknown id: fall back to DEFAULT_PALETTE_ID.
 * Returns the id that was actually applied.
 */
export function applyPaletteById(given: PalettesConfig | undefined, id: string | undefined): string {
  const palettes = given ?? (configJson.palettes as PalettesConfig) // a config without the section (test config): take the sets from config.json
  const want = id !== undefined && palettes.sets[id] !== undefined ? id : DEFAULT_PALETTE_ID
  const set = palettes.sets[want]
  if (set === undefined) return DEFAULT_PALETTE_ID
  applyPalette(set, glowFor(palettes.glow, palettes.glowOverrides, want))
  return want
}

// Colors must not be empty before the first game (view modules create materials in tests too).
applyPaletteById(configJson.palettes as PalettesConfig, DEFAULT_PALETTE_ID)
