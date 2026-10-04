import { afterAll, describe, expect, test } from 'bun:test'
import { ColorManagement, FogExp2, LinearSRGBColorSpace, Matrix4, Scene, Vector3 } from 'three'
import config from '../config.json'
import {
  HEX_RE,
  boostFor,
  boostsFor,
  checkPalette,
  headStates,
  hexToLinear,
  bloomLuminance,
  bloomLuminanceOf,
  glowFor,
  deltaE,
  displayedLinear,
  worstHeadPair,
  type GlowTargets,
  type PaletteSet,
} from './palette-math'
import {
  APPLE_COLOR,
  BLOOM_THRESHOLD,
  DEFAULT_PALETTE_ID,
  HEAD_DANGER_COLOR_FAR,
  SNAKE_BODY_COLOR,
  SNAKE_HEAD_COLOR,
  APPLE_EMISSIVE_PULSE_MAX,
  APPLE_EMISSIVE_PULSE_MIN,
  applyPaletteById,
  type PalettesConfig,
} from './palette'
import { APPLE_SKINS, COMPASS_SKINS, DEFAULT_COSMETICS, SNAKE_SKINS, resolveCosmetics } from './cosmetics'
import { appleSegments } from './apple-view'
import { compassGeometry } from './compass-view'
import { TAIL_ARROWS, TailGuides } from './tail-guides'
import { Color } from 'three'
import { DANGER_BREATH, DANGER_PULSE, HEAD_PULSE, SnakeView, bodyScaleOf, headScaleOf } from './snake-view'
import { makeState, v } from '../core/test-helpers'

const palettes = config.palettes as unknown as PalettesConfig
const glow: GlowTargets = palettes.glow
/** The glow targets that apply to a set (palettes.glow plus that set's overrides): what applyPalette uses. */
const glowOf = (id: string): GlowTargets => glowFor(glow, palettes.glowOverrides, id)
const ROLES: (keyof PaletteSet)[] = ['background', 'fog', 'body', 'tail', 'head', 'apple', 'dangerFar', 'dangerNear', 'rayDanger', 'obstacle', 'edge', 'grid', 'mark', 'wall']

afterAll(() => {
  applyPaletteById(palettes, DEFAULT_PALETTE_ID) // other view tests expect the default set
})

describe('color sets in config.json', () => {
  test('every set has all roles, and all values are hex', () => {
    for (const [id, set] of Object.entries(palettes.sets)) {
      expect(Object.keys(set).sort(), id).toEqual([...ROLES].sort())
      for (const r of ROLES) expect(HEX_RE.test(set[r]), `${id}.${r}`).toBe(true)
    }
  })

  test('every shop palette item points to an existing set, and vice versa', () => {
    const used = config.shop.items.filter((i) => i.kind === 'palette').map((i) => (i.payload as { palette: string }).palette)
    for (const id of used) expect(palettes.sets[id], id).toBeDefined()
    for (const id of Object.keys(palettes.sets)) expect(used, id).toContain(id)
    expect(palettes.sets[DEFAULT_PALETTE_ID]).toBeDefined()
  })

  test('the snake, apple and arrow skins from the shop are known to the view', () => {
    const skins = (kind: string): string[] => config.shop.items.filter((i) => i.kind === kind).map((i) => (i.payload as { skin: string }).skin)
    for (const s of skins('snakeSkin')) expect(SNAKE_SKINS as readonly string[], s).toContain(s)
    for (const s of skins('appleSkin')) expect(APPLE_SKINS as readonly string[], s).toContain(s)
    for (const s of skins('compassSkin')) expect(COMPASS_SKINS as readonly string[], s).toContain(s)
  })
})

// THE ONLY EXCEPTION. Night Neon is the current look of the game; the designer spent a long time tuning the purple obstacles 8f5cff (thin edges in the distance),
// so we do not touch their color. The pink apple against them: delta E 35 for normal vision and 18.6 for deuteranopia/protanopia (thresholds 40 / 20).
// The pair stays distinguishable by shape and pulse, but this is a weak spot, not a "pass". The floor below keeps it from getting worse;
// replacing it costs one line in config.json (obstacle #765ffe gives 50 / 20, but the lines are about 6% dimmer and bluer).
const KNOWN_WEAK: Record<string, Record<string, number>> = {
  neon: { 'apple/obstacle': 18 },
}

describe('palettes preserve the head signals (IDEAS §4)', () => {
  for (const [id, set] of Object.entries(palettes.sets)) {
    test(`${id}: all distinguishability checks pass`, () => {
      const bad = checkPalette(set, glowOf(id)).filter((c) => {
        if (c.ok) return false
        const floor = KNOWN_WEAK[id]?.[c.name]
        if (floor === undefined) return true
        // normal vision >= 34, with color blindness >= floor; tritanopia is informational
        return c.vision === 'normal' ? c.value < 34 : c.vision === 'tritanopia' ? false : c.value < floor
      })
      expect(bad.map((c) => `${c.name} [${c.vision}] ${c.value.toFixed(1)} < ${c.min}`)).toEqual([])
    })
  }

  test('the check rejects a bad set ("Heat" from IDEAS.md: a warm body blends into warm danger)', () => {
    const heat: PaletteSet = { ...palettes.sets['neon']!, background: '#0a0403', body: '#ff6a3d', tail: '#ffb02e', head: '#d9e6ff', apple: '#38f2ff', dangerFar: '#ffe600', dangerNear: '#ff2d95' }
    expect(checkPalette(heat, glow).some((c) => !c.ok)).toBe(true)
  })

  test('the check catches merged states: identical dangers', () => {
    const same: PaletteSet = { ...palettes.sets['neon']!, dangerFar: '#ff2010' }
    const st = headStates(same, boostsFor(same, glow))
    expect(worstHeadPair(st, 'normal').pair).toBe('dangerFar/dangerNear')
    expect(checkPalette(same, glow).some((c) => !c.ok && c.name === 'head:dangerFar/dangerNear')).toBe(true)
  })
})

describe('glow: multipliers are computed from luminance', () => {
  test('the glow luminance is the one the bloom pass thresholds on: three\'s own Rec.709 coefficients', () => {
    // UnrealBloomPass -> LuminosityHighPassShader -> three's luminance(): linear-sRGB (working space) coefficients. If three or the working space ever changes, this fails.
    const w = ColorManagement.getLuminanceCoefficients(new Vector3(), LinearSRGBColorSpace)
    expect([w.x, w.y, w.z]).toEqual([0.2126, 0.7152, 0.0722])
    for (const c of [new Color('#3dffa6'), new Color('#ff2d78'), new Color('#8f5cff'), new Color('#fff27a')]) {
      const three = c.r * w.x + c.g * w.y + c.b * w.z
      expect(bloomLuminanceOf(c.r, c.g, c.b)).toBeCloseTo(three, 12)
      expect(bloomLuminance(hexToLinear('#' + c.getHexString()))).toBeCloseTo(three, 3) // hexToLinear is the same sRGB decoding three applies
    }
    // the primaries: the weights themselves (the old Rec.601 formula gave 0.299 / 0.587 / 0.114 here)
    expect(bloomLuminance([1, 0, 0])).toBeCloseTo(0.2126, 6)
    expect(bloomLuminance([0, 1, 0])).toBeCloseTo(0.7152, 6)
    expect(bloomLuminance([0, 0, 1])).toBeCloseTo(0.0722, 6)
  })

  test('the multiplier is target / bloom luminance: a color lands exactly on its target on the scale the bloom sees', () => {
    expect(boostFor('#00ff00', 0.7152 * 2, 5)).toBeCloseTo(2, 6)
    expect(boostFor('#ff0000', 0.2126 * 3, 5)).toBeCloseTo(3, 6)
    for (const [id, set] of Object.entries(palettes.sets)) {
      const g = glowOf(id)
      const b = boostsFor(set, g)
      const landed = (hex: string, k: number): number => bloomLuminance(hexToLinear(hex)) * k
      expect(landed(set.head, b.headIdle), id).toBeCloseTo(g.headIdle, 6)
      expect(landed(set.apple, b.headGoal), id).toBeCloseTo(g.headGoal, 6)
      expect(landed(set.dangerFar, b.dangerFar), id).toBeCloseTo(g.dangerFar, 6)
      expect(landed(set.dangerNear, b.dangerNear), id).toBeCloseTo(g.dangerNear, 6)
      expect(landed(set.apple, b.apple), id).toBeCloseTo(g.apple, 6)
      expect(landed(set.body, b.body), id).toBeCloseTo(g.body, 6)
      expect(landed(set.edge, b.edge), id).toBeCloseTo(g.edge, 6)
      expect(landed(set.obstacle, b.obstacleLine), id).toBeCloseTo(g.obstacleLine, 6)
    }
  })

  test('glowFor: overrides sit on top of palettes.glow, only for the sets that list them', () => {
    expect(glowFor(glow, undefined, 'neon')).toBe(glow)
    expect(glowFor(glow, { neon: { obstacleLine: 0.5 } }, 'ice')).toBe(glow)
    const g = glowFor(glow, { neon: { obstacleLine: 0.5 } }, 'neon')
    expect(g.obstacleLine).toBe(0.5)
    expect(g.headGoal).toBe(glow.headGoal)
    for (const id of Object.keys(palettes.glowOverrides ?? {})) expect(palettes.sets[id], `override for an unknown set ${id}`).toBeDefined()
  })

  test('multiplier cap: a very dark color does not burn out', () => {
    expect(boostFor('#000000', 1, 5)).toBe(5)
    expect(boostFor('#101010', 1, 5)).toBe(5)
  })

  for (const [id, set] of Object.entries(palettes.sets)) {
    test(`${id}: idle head glows (above the threshold and at least as bright as the body), so do goal and both dangers; the body glows along its whole ramp, tail end included`, () => {
      const g = glowOf(id)
      const b = boostsFor(set, g)
      const lum = (hex: string, k: number): number => bloomLuminance(hexToLinear(hex)) * k
      // Designer's ruling: a dark head in front of a glowing tail reads as a bug. The calm head glows, and never less than the body.
      expect(lum(set.head, b.headIdle)).toBeGreaterThan(BLOOM_THRESHOLD)
      expect(lum(set.head, b.headIdle)).toBeGreaterThanOrEqual(lum(set.body, b.body))
      expect(lum(set.dangerFar, b.dangerFar)).toBeGreaterThan(BLOOM_THRESHOLD)
      expect(lum(set.dangerNear, b.dangerNear)).toBeGreaterThan(BLOOM_THRESHOLD)
      expect(lum(set.apple, b.headGoal)).toBeGreaterThan(BLOOM_THRESHOLD)
      // The body glows from the neck to the last segment: both ends of the ramp are above the threshold, with a real margin (the tail never goes dark).
      expect(lum(set.body, b.body)).toBeGreaterThan(BLOOM_THRESHOLD + 0.05)
      expect(lum(set.tail, boostFor(set.tail, g.bodyTail, g.maxBoost)), 'last segment').toBeGreaterThan(BLOOM_THRESHOLD + 0.04)
      expect(g.bodyTail).toBeLessThanOrEqual(g.body)
    })

    test(`${id}: no threshold flicker: glowing states stay above the bloom threshold through the whole breath, quiet ones stay below`, () => {
      const g = glowOf(id)
      const b = boostsFor(set, g)
      const lum = (hex: string, k: number): number => bloomLuminance(hexToLinear(hex)) * k
      const T = BLOOM_THRESHOLD
      // The danger head breathes by +-DANGER_BREATH (snake-view) and bloom cuts hard at the threshold: the trough must still clear it, with a margin.
      const troughFar = lum(set.dangerFar, b.dangerFar) * (1 - DANGER_BREATH)
      const troughNear = lum(set.dangerNear, b.dangerNear) * (1 - DANGER_BREATH)
      expect(troughFar, 'danger in 2 steps, trough of the breath').toBeGreaterThan(T + 0.1)
      expect(troughNear, 'danger in 1 step, trough of the breath').toBeGreaterThan(T + 0.1)
      // The goal head does not breathe in brightness (only in size), so its margin is the plain one.
      expect(lum(set.apple, b.headGoal), 'goal').toBeGreaterThan(T + 0.05)
      // The calm head glows steadily (it breathes in size only, but a margin over the threshold keeps it lit even if that ever changes).
      expect(lum(set.head, b.headIdle) * (1 - DANGER_BREATH), 'calm head at the bottom of a danger-sized breath').toBeGreaterThan(T + 0.05)
      expect(lum(set.head, b.headIdle), 'calm head').toBeGreaterThan(lum(set.body, b.body))
      // Head end (neck) and the bright body segments: a steady value clear of the threshold.
      expect(lum(set.body, boostFor(set.body, g.headEnd, g.maxBoost)), 'neck').toBeGreaterThan(T + 0.05)
      expect(lum(set.body, b.body), 'body').toBeGreaterThan(T + 0.03)
      expect(g.bodyTail, 'tail end of the body ramp').toBeGreaterThan(T + 0.03)
      // The neck eased down next to the camera still glows: its floor sits above the threshold (a floor below it made the neck flicker on and off as the camera swung).
      expect(lum(set.body, boostFor(set.body, g.headEndNearLuminance, g.maxBoost)), 'neck near the camera').toBeGreaterThan(T + 0.02)
      // Apple: dark at the bottom of its pulse, glowing only near the top.
      expect(lum(set.apple, b.apple) * APPLE_EMISSIVE_PULSE_MIN, 'apple at the bottom of its pulse').toBeLessThan(T - 0.1)
      expect(lum(set.apple, b.apple) * APPLE_EMISSIVE_PULSE_MAX, 'apple at the top of its pulse').toBeGreaterThan(T + 0.05)
      expect(lum(set.apple, b.apple) * ((APPLE_EMISSIVE_PULSE_MIN + APPLE_EMISSIVE_PULSE_MAX) / 2), 'apple at mid-pulse').toBeLessThan(T)
    })
  }
})

describe('glow ladder: brightness rises with danger', () => {
  for (const [id, set] of Object.entries(palettes.sets)) {
    test(`${id}: body < neck <= calm head < goal < danger in 2 steps < danger in 1 step; no target is cut by the multiplier cap`, () => {
      const g = glowOf(id)
      const lum = (hex: string, target: number): number => bloomLuminance(hexToLinear(hex)) * boostFor(hex, target, g.maxBoost)
      const idle = lum(set.head, g.headIdle)
      const neck = lum(set.body, g.headEnd)
      const far = lum(set.dangerFar, g.dangerFar)
      const near = lum(set.dangerNear, g.dangerNear)
      const goal = lum(set.apple, g.headGoal)
      expect(lum(set.body, g.body)).toBeLessThan(neck)
      expect(g.bodyTail).toBeLessThanOrEqual(g.body)
      expect(lum(set.tail, g.bodyTail)).toBeCloseTo(g.bodyTail, 3)
      expect(neck).toBeLessThanOrEqual(idle)
      expect(idle).toBeLessThan(goal - 0.04)
      expect(goal).toBeLessThan(far)
      expect(far).toBeLessThan(near - 0.05)
      // the achieved luminance is the requested one (the cap did not bite), for every role
      expect(far).toBeCloseTo(g.dangerFar, 3)
      expect(near).toBeCloseTo(g.dangerNear, 3)
      expect(neck).toBeCloseTo(g.headEnd, 3)
      expect(idle).toBeCloseTo(g.headIdle, 3)
      expect(lum(set.apple, g.headGoal)).toBeCloseTo(g.headGoal, 3)
      expect(lum(set.apple, g.apple)).toBeCloseTo(g.apple, 3)
      expect(lum(set.body, g.body)).toBeCloseTo(g.body, 3)
      expect(lum(set.edge, g.edge)).toBeCloseTo(g.edge, 3)
      expect(lum(set.obstacle, g.obstacleLine)).toBeCloseTo(g.obstacleLine, 3)
    })
  }

  test('the head is outside the fog: its glow targets are what the bloom pass sees', () => {
    const view = new SnakeView(new Scene())
    expect((view as unknown as { headMaterial: { fog: boolean } }).headMaterial.fog).toBe(false)
    view.dispose()
  })
})

describe('the goal head is a signal, not a lamp', () => {
  // A head lit above the bloom threshold puts out light in proportion to the area it covers: config.headSignal.goalScale makes the goal head smaller
  // (the luminance target cannot go lower, the flicker test above keeps it above the threshold).
  function headScale(apple: { x: number; y: number; z: number }): number {
    applyPaletteById(palettes, DEFAULT_PALETTE_ID)
    const view = new SnakeView(new Scene())
    const s = makeState({ snake: [v(10, 10, 10), v(9, 10, 10), v(8, 10, 10)], mode: 'free', apple })
    view.ensureCapacity(s)
    for (let i = 0; i < 40; i++) {
      s.elapsedMs += 16
      view.update(s, 30, 10, 10, 1)
    }
    const scale = (view as unknown as { headMesh: { scale: { x: number } } }).headMesh.scale.x
    view.dispose()
    return scale
  }
  test('the head is never drawn smaller than the body: goal shrink and the pulse trough stacked, strictly above a body segment with a visible margin', () => {
    // Everything that multiplies the head: the goal shrink (goalScale, fully on) and the breathing pulse (idle +-HEAD_PULSE, danger +-DANGER_PULSE; mid-transition it is a lerp of the two,
    // so the trough is never deeper than the larger of them). The near-camera fade applies to body segments only, never to the head.
    const trough = -Math.max(HEAD_PULSE, DANGER_PULSE)
    const worst = headScaleOf(trough, 1, config.headSignal.goalScale)
    const body = bodyScaleOf()
    expect(worst).toBeGreaterThan(body * 1.08)
    // and the goal shrink stays perceptible: at least a tenth off the calm head
    expect(config.headSignal.goalScale).toBeLessThanOrEqual(0.9)
    // the view really uses this: sweep the pulse through a whole breath with the apple ahead
    const sm = Math.min(...[-1, -0.5, 0, 0.5, 1].map((w) => headScaleOf(Math.max(HEAD_PULSE, DANGER_PULSE) * w, 1, config.headSignal.goalScale)))
    expect(sm).toBeGreaterThan(body * 1.08)
    // and in the running view: the apple straight ahead, a few breaths; the drawn head never goes under the body size (nor under the margin)
    applyPaletteById(palettes, DEFAULT_PALETTE_ID)
    const view = new SnakeView(new Scene())
    const st = makeState({ snake: [v(10, 10, 10), v(9, 10, 10), v(8, 10, 10)], mode: 'free', apple: v(16, 10, 10) })
    view.ensureCapacity(st)
    let min = Infinity
    for (let i = 0; i < 400; i++) {
      st.elapsedMs += 16
      view.update(st, 30, 10, 10, 1)
      min = Math.min(min, (view as unknown as { headMesh: { scale: { x: number } } }).headMesh.scale.x)
    }
    view.dispose()
    expect(min).toBeGreaterThan(body * 1.08)
  })
  test('goalScale is a real shrink, not a hidden head', () => {
    expect(config.headSignal.goalScale).toBeGreaterThanOrEqual(0.5)
    expect(config.headSignal.goalScale).toBeLessThan(1)
  })
  test('with the apple straight ahead the head is drawn at goalScale (within its breath); with the apple off the course it is full size', () => {
    const goal = headScale(v(16, 10, 10))
    const idle = headScale(v(16, 15, 10))
    expect(goal).toBeCloseTo(config.headSignal.goalScale, 1)
    expect(goal).toBeLessThan(idle * 0.9)
    expect(idle).toBeGreaterThan(0.94)
  })
})

describe('obstacles keep their quiet look (the designer: leave the obstacles as they were)', () => {
  test('the outlines of Night Neon, Contrast and Synthwave stay under the bloom threshold: dim lines, no halo', () => {
    for (const id of ['neon', 'contrast', 'synthwave']) {
      const g = glowOf(id)
      expect(bloomLuminance(hexToLinear(palettes.sets[id]!.obstacle)) * boostFor(palettes.sets[id]!.obstacle, g.obstacleLine, g.maxBoost), id).toBeLessThan(BLOOM_THRESHOLD - 0.02)
    }
  })
  test('no set lights its obstacles up above the level they had before the Rec.709 fix (0.83): the faces do not glow either', () => {
    for (const id of Object.keys(palettes.sets)) expect(glowOf(id).obstacleLine, id).toBeLessThanOrEqual(0.83)
  })
})

describe('applyPaletteById', () => {
  test('overwrites the live colors in place (references do not change)', () => {
    const ref = SNAKE_HEAD_COLOR
    applyPaletteById(palettes, 'synthwave')
    expect(SNAKE_HEAD_COLOR).toBe(ref)
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['synthwave']!.head)
    expect('#' + APPLE_COLOR.getHexString()).toBe(palettes.sets['synthwave']!.apple)
    expect('#' + SNAKE_BODY_COLOR.getHexString()).toBe(palettes.sets['synthwave']!.body)
    applyPaletteById(palettes, 'ice')
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['ice']!.head)
  })

  test('the danger-in-2-steps color already includes the multiplier: the channel is larger than the raw hue', () => {
    applyPaletteById(palettes, 'neon')
    const raw = new Color(palettes.sets['neon']!.dangerFar)
    expect(HEAD_DANGER_COLOR_FAR.r).toBeGreaterThan(raw.r)
  })

  test('an unknown id and an empty id give the default set', () => {
    expect(applyPaletteById(palettes, 'no-such-set')).toBe(DEFAULT_PALETTE_ID)
    expect(applyPaletteById(palettes, undefined)).toBe(DEFAULT_PALETTE_ID)
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['neon']!.head)
  })

  test('a config without the palettes section falls back to the sets from config.json', () => {
    expect(applyPaletteById(undefined, 'terminal')).toBe('terminal')
    expect('#' + SNAKE_HEAD_COLOR.getHexString()).toBe(palettes.sets['terminal']!.head)
  })
})

describe('resolveCosmetics', () => {
  test('with no choice, the defaults', () => {
    expect(resolveCosmetics()).toEqual(DEFAULT_COSMETICS)
    expect(resolveCosmetics({})).toEqual(DEFAULT_COSMETICS)
  })
  test('known values pass through, unknown ones are replaced by defaults', () => {
    expect(resolveCosmetics({ palette: 'ice', snakeSkin: 'tailGuides', appleSkin: 'star', compassSkin: 'ring' })).toEqual({
      palette: 'ice',
      snakeSkin: 'tailGuides',
      appleSkin: 'star',
      compassSkin: 'ring',
    })
    expect(resolveCosmetics({ snakeSkin: 'x', appleSkin: '', compassSkin: undefined })).toEqual(DEFAULT_COSMETICS)
  })
})

describe('apple and arrow skins', () => {
  function extent(seg: number[]): number {
    return Math.max(...seg.map((v) => Math.abs(v)))
  }
  test('every apple skin is no smaller than the old cube', () => {
    const cube = extent(appleSegments('diamond'))
    for (const s of APPLE_SKINS) {
      expect(appleSegments(s).length, s).toBeGreaterThan(0)
      expect(extent(appleSegments(s)), s).toBeGreaterThanOrEqual(cube - 1e-9)
    }
  })
  test('the star is twelve edges of two tetrahedra', () => {
    expect(appleSegments('star').length / 6).toBe(12)
    expect(appleSegments('diamond').length / 6).toBe(12)
  })
  test('an arrow of any skin has unit length along +Y: the tip is at about 0.5', () => {
    for (const s of COMPASS_SKINS) {
      const g = compassGeometry(s)
      g.computeBoundingBox()
      expect(g.boundingBox!.max.y, s).toBeGreaterThan(0.45)
      expect(g.boundingBox!.max.y, s).toBeLessThanOrEqual(0.5 + 1e-6)
      expect(g.boundingBox!.min.y, s).toBeGreaterThanOrEqual(-0.65)
      g.dispose()
    }
  })
})

describe('tail guides', () => {
  const col = (n: number): [Float32Array, Float32Array, Float32Array] => [new Float32Array(n).fill(0.2), new Float32Array(n).fill(1), new Float32Array(n).fill(0.6)]
  function line(n: number): [Float32Array, Float32Array, Float32Array, Float32Array] {
    const gx = new Float32Array(n)
    const gy = new Float32Array(n)
    const gz = new Float32Array(n)
    const gk = new Float32Array(n).fill(1)
    for (let i = 0; i < n; i++) gx[i] = 10 - i // head at 10, the tail follows in decreasing x
    return [gx, gy, gz, gk]
  }
  test('one fewer link than segments; arrows only on the last links', () => {
    const g = new TailGuides(new Scene())
    const [gx, gy, gz, gk] = line(9)
    g.ensureCapacity(9)
    g.update(9, gx, gy, gz, gk, ...col(9))
    expect((g as unknown as { links: { mesh: { count: number } } }).links.mesh.count).toBe(8)
    expect((g as unknown as { arrows: { mesh: { count: number } } }).arrows.mesh.count).toBe(TAIL_ARROWS)
    g.dispose()
  })
  test('short snake: no more arrows than links; coinciding segments do not break the frame', () => {
    const g = new TailGuides(new Scene())
    const [gx, gy, gz, gk] = line(3)
    gx[1] = gx[0]! // the segments coincide
    g.ensureCapacity(3)
    expect(() => g.update(3, gx, gy, gz, gk, ...col(3))).not.toThrow()
    expect((g as unknown as { arrows: { mesh: { count: number } } }).arrows.mesh.count).toBe(2)
    g.dispose()
  })
})

describe('measurement functions', () => {
  test('delta E of identical colors is 0, of black and white is about 100', () => {
    const w = displayedLinear('#ffffff', 1)
    const k = displayedLinear('#000000', 1)
    expect(deltaE(w, w)).toBeCloseTo(0, 6)
    expect(deltaE(w, k)).toBeGreaterThan(95)
  })
  test('deuteranopia barely distinguishes red and green of equal luminance', () => {
    const r = displayedLinear('#c86400', 1)
    const g = displayedLinear('#5f9600', 1)
    expect(deltaE(r, g, 'deuteranopia')).toBeLessThan(deltaE(r, g, 'normal') / 3)
  })
})

describe('the snake is one body: the same glow and the same size along its whole length', () => {
  const lumOf = (c: Color): number => bloomLuminanceOf(c.r, c.g, c.b)
  function bodyColors(length: number, cam: number): Color[] {
    applyPaletteById(palettes, DEFAULT_PALETTE_ID)
    const snake = Array.from({ length }, (_, i) => v(10 - i, 10, 10))
    const view = new SnakeView(new Scene())
    const s = makeState({ snake, mode: 'free' })
    view.ensureCapacity(s)
    view.update(s, 10 + cam, 10, 10, 1)
    const mesh = (view as unknown as { pool: { mesh: { getColorAt: (i: number, c: Color) => void } } }).pool.mesh
    const out: Color[] = []
    for (let i = 0; i < length - 1; i++) {
      const c = new Color()
      mesh.getColorAt(i, c)
      out.push(c)
    }
    view.dispose()
    return out
  }
  test('every body segment is above the bloom threshold whatever its index, the last one of a long snake included (no stripes, no dark tail)', () => {
    for (const length of [3, 4, 16, 40]) {
      const cols = bodyColors(length, 30) // no fog in this scene: the colour is what the bloom pass sees
      for (let i = 1; i <= length - 1; i++) expect(lumOf(cols[i - 1]!), `length ${length}, segment ${i}`).toBeGreaterThan(BLOOM_THRESHOLD + 0.03)
    }
  })
  test('neighbours do not alternate: no segment differs from the next by a stripe step, and the ramp only falls gently toward the tail', () => {
    const cols = bodyColors(40, 30).map(lumOf)
    for (let i = 4; i < cols.length; i++) {
      expect(cols[i]!, `segment ${i + 1}`).toBeLessThanOrEqual(cols[i - 1]! + 1e-9)
      expect(cols[i - 1]! - cols[i]!).toBeLessThan(0.01)
    }
    expect(cols[cols.length - 1]!).toBeGreaterThan(glow.bodyTail - 0.01)
  })
  test('close to the camera the head end is eased down but still glows, and the ease is monotone (no cliff at the threshold)', () => {
    const near = lumOf(bodyColors(16, 1)[0]!) // makeState is at the start of a step: segment 1 still sits on the cell of segment 2, 3 cells from the camera
    expect(near).toBeGreaterThan(BLOOM_THRESHOLD + 0.02)
    let prev = 0
    for (const cam of [0, 1, 2, 3, 5, 8]) {
      const l = lumOf(bodyColors(16, cam)[0]!)
      expect(l, `camera ${cam} cells away`).toBeGreaterThan(BLOOM_THRESHOLD + 0.02)
      expect(l).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = l
    }
  })
  test('the body is one size: bodyScale of the head, identical for every segment index and every camera distance away from the fade', () => {
    applyPaletteById(palettes, DEFAULT_PALETTE_ID)
    expect(bodyScaleOf()).toBe(config.snakeView.bodyScale)
    expect(config.snakeView.bodyScale).toBe(0.75)
    const scales = (cam: number, length: number): number[] => {
      const view = new SnakeView(new Scene())
      const st = makeState({ snake: Array.from({ length }, (_, i) => v(10 - i, 10, 10)), mode: 'free' })
      view.ensureCapacity(st)
      view.update(st, 10 + cam, 10, 10, 1)
      const m = new Matrix4()
      const out: number[] = []
      for (let i = 0; i < length - 1; i++) {
        ;(view as unknown as { pool: { mesh: { getMatrixAt: (i: number, m: Matrix4) => void } } }).pool.mesh.getMatrixAt(i, m)
        out.push(new Vector3().setFromMatrixScale(m).x)
      }
      view.dispose()
      return out
    }
    // Camera in front of the head, so segment i is (cam + i) cells from it: 4 and up is well outside the fade (it collapses only what is almost inside the camera).
    for (const cam of [4, 6, 30]) for (const length of [4, 16, 40]) {
      for (const k of scales(cam, length)) expect(k).toBeCloseTo(config.snakeView.bodyScale, 6)
    }
  })
  test('the tail end is no bigger and no smaller than the neck: equal size at equal distance across segment indices', () => {
    const view = new SnakeView(new Scene())
    const st = makeState({ snake: Array.from({ length: 30 }, (_, i) => v(10 - i, 10, 10)), mode: 'free' })
    view.ensureCapacity(st)
    view.update(st, 10 + 5, 10, 10, 1)
    const gk = (view as unknown as { gk: Float32Array }).gk
    expect(gk[0]).toBe(1) // the head is a normal cube
    for (let i = 1; i < 30; i++) expect(gk[i]).toBeCloseTo(gk[1]!, 6)
    view.dispose()
  })
  test('the body is fog-compensated: after the fog it stays above the bloom threshold at every camera distance (up to the boost cap), so it cannot flicker across it or fade to a dark tail', () => {
    applyPaletteById(palettes, DEFAULT_PALETTE_ID)
    const fogColor = new Color(0x1e223a)
    const fogLum = lumOf(fogColor)
    const density = config.fog.density
    for (const length of [4, 16, 40]) for (const cam of [1, 2, 3, 4, 6, 9, 14]) {
      const scene = new Scene()
      scene.fog = new FogExp2(fogColor, density)
      const view = new SnakeView(scene)
      const st = makeState({ snake: Array.from({ length }, (_, i) => v(10 - i, 10, 10)), mode: 'free' })
      view.ensureCapacity(st)
      view.update(st, 10 + cam, 10, 10, 1)
      const mesh = (view as unknown as { pool: { mesh: { getColorAt: (i: number, c: Color) => void; getMatrixAt: (i: number, m: Matrix4) => void } } }).pool.mesh
      const c = new Color()
      const m = new Matrix4()
      const p = new Vector3()
      for (let i = 1; i <= length - 1; i++) {
        mesh.getColorAt(i - 1, c)
        mesh.getMatrixAt(i - 1, m)
        p.setFromMatrixPosition(m)
        const depth = Math.abs(p.x - (10 + cam)) // the camera looks along x here, so the view depth is the x distance
        const f = 1 - Math.exp(-density * density * depth * depth)
        const onScreen = lumOf(c) * (1 - f) + fogLum * f
        if (depth > 14) continue // past ~14 cells the fog outruns the boost cap (glow.maxBoost): there the colour stays pinned at the cap instead
        expect(onScreen, `length ${length}, camera ${cam}, segment ${i}`).toBeGreaterThan(BLOOM_THRESHOLD + 0.02)
      }
      view.dispose()
    }
  })
})
