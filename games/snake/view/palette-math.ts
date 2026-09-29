// Pure palette math (no Three.js): luminance for glow, automatic multiplier selection, and the distinguishability check.
// It lives in view/ because palettes are presentation. The core knows nothing about them.
//
// What is checked. The head signals four states (idle / goal / danger in 2 steps / danger in 1 step),
// and that is a mechanic, not decoration. So we compare not the "raw" hex values from the set but what actually reaches the screen:
// hex -> linear color -> glow multiplier (boostFor) -> channel clamp to 1 -> sRGB. Then delta E (CIE76, Lab) for normal vision
// and through the Machado 2009 matrices (full severity) for deuteranopia, protanopia and tritanopia.

export type Rgb = readonly [number, number, number]

/** Color roles of a set: "#rrggbb" hex strings. Some carry meaning (signals), others are decorative. */
export interface PaletteSet {
  /** Scene and minimap background. */
  background: string
  /** Fog color: the visible scene background (background + wall veil), otherwise distant blocks turn into black holes. */
  fog: string
  body: string
  tail: string
  /** Head, idle state. */
  head: string
  /** Apple; also the color of the "goal" signal on the head. */
  apple: string
  dangerFar: string
  dangerNear: string
  /** Highlight of what the ray will hit, and of blocked near markers. */
  rayDanger: string
  obstacle: string
  edge: string
  grid: string
  /** Head projection on the walls. */
  mark: string
  /** The real arena wall on the minimap. */
  wall: string
}

/** Target linear luminance (0.299R+0.587G+0.114B after the multiplier) per role: the multiplier is computed automatically. */
export interface GlowTargets {
  headIdle: number
  headGoal: number
  dangerFar: number
  dangerNear: number
  apple: number
  /** Bright body segment (the dim stripes are x stripeDim). */
  body: number
  edge: number
  obstacleLine: number
  /** Multiplier cap: the color does not burn out to white. */
  maxBoost: number
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
export function linearToSrgb(c: number): number {
  const v = c <= 0 ? 0 : c >= 1 ? 1 : c
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

/** "#rrggbb" -> linear channels 0..1 (as Three.js does with color management enabled). */
export function hexToLinear(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)]
}

/** The luminance the bloom threshold sees: computed from linear channels. */
export function luminance(c: Rgb): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

/** Multiplier that brings the color's luminance up to target; at most maxBoost. */
export function boostFor(hex: string, target: number, maxBoost: number): number {
  const l = luminance(hexToLinear(hex))
  return l <= 1e-6 ? maxBoost : Math.min(maxBoost, target / l)
}

/** The color as it reaches the screen: linear x multiplier, channels clamped to 1 (no tone mapping). Linear channels. */
export function displayedLinear(hex: string, boost: number): Rgb {
  const c = hexToLinear(hex)
  return [Math.min(1, c[0] * boost), Math.min(1, c[1] * boost), Math.min(1, c[2] * boost)]
}

export type Vision = 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia'
export const VISIONS: readonly Vision[] = ['normal', 'deuteranopia', 'protanopia', 'tritanopia']

// Machado, Oliveira, Fernandes 2009, full severity (1.0), on linear RGB.
const MACHADO: Record<Exclude<Vision, 'normal'>, readonly number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

function simulate(c: Rgb, v: Vision): Rgb {
  if (v === 'normal') return c
  const m = MACHADO[v]
  const cl = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
  return [
    cl(m[0]! * c[0] + m[1]! * c[1] + m[2]! * c[2]),
    cl(m[3]! * c[0] + m[4]! * c[1] + m[5]! * c[2]),
    cl(m[6]! * c[0] + m[7]! * c[1] + m[8]! * c[2]),
  ]
}

/** Linear RGB (0..1) -> CIE Lab (D65). */
export function toLab(c: Rgb): [number, number, number] {
  const x = (0.4124564 * c[0] + 0.3575761 * c[1] + 0.1804375 * c[2]) / 0.95047
  const y = 0.2126729 * c[0] + 0.7151522 * c[1] + 0.072175 * c[2]
  const z = (0.0193339 * c[0] + 0.119192 * c[1] + 0.9503041 * c[2]) / 1.08883
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIE76 delta E between two linear colors as seen with vision `v`. */
export function deltaE(a: Rgb, b: Rgb, v: Vision = 'normal'): number {
  const la = toLab(simulate(a, v))
  const lb = toLab(simulate(b, v))
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

/** Glow multipliers of a set per role (the same ones view/palette.ts applies). */
export interface Boosts {
  headIdle: number
  headGoal: number
  dangerFar: number
  dangerNear: number
  apple: number
  body: number
  edge: number
  obstacleLine: number
}

export function boostsFor(set: PaletteSet, g: GlowTargets): Boosts {
  return {
    headIdle: boostFor(set.head, g.headIdle, g.maxBoost),
    headGoal: boostFor(set.apple, g.headGoal, g.maxBoost),
    dangerFar: boostFor(set.dangerFar, g.dangerFar, g.maxBoost),
    dangerNear: boostFor(set.dangerNear, g.dangerNear, g.maxBoost),
    apple: boostFor(set.apple, g.apple, g.maxBoost),
    body: boostFor(set.body, g.body, g.maxBoost),
    edge: boostFor(set.edge, g.edge, g.maxBoost),
    obstacleLine: boostFor(set.obstacle, g.obstacleLine, g.maxBoost),
  }
}

/** The four head states on screen (linear channels after the multiplier and clamping). */
export interface HeadStates {
  idle: Rgb
  goal: Rgb
  dangerFar: Rgb
  dangerNear: Rgb
}
export const HEAD_STATE_NAMES = ['idle', 'goal', 'dangerFar', 'dangerNear'] as const
export type HeadStateName = (typeof HEAD_STATE_NAMES)[number]

export function headStates(set: PaletteSet, b: Boosts): HeadStates {
  return {
    idle: displayedLinear(set.head, b.headIdle),
    goal: displayedLinear(set.apple, b.headGoal),
    dangerFar: displayedLinear(set.dangerFar, b.dangerFar),
    dangerNear: displayedLinear(set.dangerNear, b.dangerNear),
  }
}

/** The minimum delta E among the six head-state pairs, and the pair that gives it. */
export function worstHeadPair(st: HeadStates, v: Vision): { de: number; pair: string } {
  let best = Infinity
  let pair = ''
  for (let i = 0; i < HEAD_STATE_NAMES.length; i++) {
    for (let j = i + 1; j < HEAD_STATE_NAMES.length; j++) {
      const a = HEAD_STATE_NAMES[i]!
      const c = HEAD_STATE_NAMES[j]!
      const de = deltaE(st[a], st[c], v)
      if (de < best) {
        best = de
        pair = `${a}/${c}`
      }
    }
  }
  return { de: best, pair }
}

/** Acceptance thresholds (IDEAS.md §4.4-4.5): delta E >= 30 for normal vision, >= 20 for deuteranopia and protanopia; tritanopia is informational. */
export const PASS_NORMAL = 30
export const PASS_DEUT_PROT = 20
/**
 * Apple vs obstacles is stricter: both are prominent, large and from the same "warm/cool" family, and by eye (screenshots) they get confused at delta E of about 32.
 * Normal vision >= 40; for deuteranopia and protanopia the same 20 as before.
 */
export const PASS_APPLE_OBSTACLE_NORMAL = 40
/** Minimum delta E of "signal vs background": a state's color must read against the dark background. */
export const PASS_VS_BACKGROUND = 40
/**
 * Minimum luminance (as on screen, after channel clamping) of the obstacle line: a thin edge in the distance must not go dim.
 * Night Neon gives about 0.54; the threshold is about 15% lower. Blue hues glow weaker (blue's luminance weight is 0.11), so dark-blue
 * obstacles fail here no matter how much the multiplier is raised: the channel hits 1 and the hue washes out to white.
 */
export const PASS_OBSTACLE_EDGE_LUM = 0.45

export interface PaletteCheck {
  /** What was compared, e.g. "head:dangerFar/dangerNear" or "goal/body". */
  name: string
  vision: Vision
  value: number
  min: number
  ok: boolean
}

function minFor(v: Vision, normal = PASS_NORMAL): number {
  return v === 'normal' ? normal : v === 'tritanopia' ? 0 : PASS_DEUT_PROT
}

/**
 * All checks of a set. Gate: normal vision >= 30, deuteranopia and protanopia >= 20 (tritanopia is informational, min 0).
 * Pairs: the six head-state pairs; goal vs body and tail; idle head vs body and tail;
 * apple vs obstacles and edges; danger vs obstacles. Plus each head state vs the background (normal vision only, >= 40).
 */
export function checkPalette(set: PaletteSet, g: GlowTargets): PaletteCheck[] {
  const b = boostsFor(set, g)
  const st = headStates(set, b)
  const body = displayedLinear(set.body, b.body)
  const tail = displayedLinear(set.tail, b.body)
  const obs = displayedLinear(set.obstacle, b.obstacleLine)
  const edge = displayedLinear(set.edge, b.edge)
  const bg = hexToLinear(set.background)
  const out: PaletteCheck[] = []
  const pair = (name: string, x: Rgb, y: Rgb, normal = PASS_NORMAL): void => {
    for (const v of VISIONS) {
      const value = deltaE(x, y, v)
      const min = minFor(v, normal)
      out.push({ name, vision: v, value, min, ok: value >= min })
    }
  }
  for (let i = 0; i < HEAD_STATE_NAMES.length; i++) {
    for (let j = i + 1; j < HEAD_STATE_NAMES.length; j++) {
      const a = HEAD_STATE_NAMES[i]!
      const c = HEAD_STATE_NAMES[j]!
      pair(`head:${a}/${c}`, st[a], st[c])
    }
  }
  pair('goal/body', st.goal, body)
  pair('goal/tail', st.goal, tail)
  pair('idle/body', st.idle, body)
  pair('idle/tail', st.idle, tail)
  pair('apple/obstacle', st.goal, obs, PASS_APPLE_OBSTACLE_NORMAL)
  pair('apple/edge', st.goal, edge)
  pair('dangerFar/obstacle', st.dangerFar, obs)
  pair('dangerNear/obstacle', st.dangerNear, obs)
  for (const n of HEAD_STATE_NAMES) {
    const value = deltaE(st[n], bg)
    out.push({ name: `${n}/background`, vision: 'normal', value, min: PASS_VS_BACKGROUND, ok: value >= PASS_VS_BACKGROUND })
  }
  const lum = luminance(displayedLinear(set.obstacle, b.obstacleLine))
  out.push({ name: 'obstacle/edgeLuminance', vision: 'normal', value: lum, min: PASS_OBSTACLE_EDGE_LUM, ok: lum >= PASS_OBSTACLE_EDGE_LUM })
  return out
}

/** The check with the smallest margin for each vision type (for the report table). */
export function worstByVision(checks: readonly PaletteCheck[], v: Vision, prefix = ''): PaletteCheck | undefined {
  let worst: PaletteCheck | undefined
  for (const c of checks) {
    if (c.vision !== v || !c.name.startsWith(prefix)) continue
    if (worst === undefined || c.value - c.min < worst.value - worst.min) worst = c
  }
  return worst
}
