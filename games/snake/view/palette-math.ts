// Чистая математика палитр (без Three.js): яркость для свечения, автоподбор множителя и проверка различимости.
// Живёт в view/, потому что палитры — оформление. Ядро о ней не знает.
//
// Что проверяется. Голова сигналит четыре состояния (обычное / цель / опасность за 2 хода / опасность за 1 ход),
// и это механика, а не украшение. Поэтому сравниваются не «сырые» hex из набора, а то, что реально попадает на экран:
// hex -> линейный цвет -> множитель свечения (boostFor) -> обрезка каналов до 1 -> sRGB. Потом ΔE (CIE76, Lab) в норме
// и через матрицы Machado 2009 (полная степень) для дейтеранопии, протанопии, тританопии.

export type Rgb = readonly [number, number, number]

/** Роли цветов набора: hex-строки «#rrggbb». Смысловые (сигналы) и декоративные. */
export interface PaletteSet {
  /** Фон сцены и мини-карты. */
  background: string
  /** Цвет тумана: видимый фон сцены (фон + вуаль стенок), иначе далёкие блоки чернеют дырами. */
  fog: string
  body: string
  tail: string
  /** Голова, обычное состояние. */
  head: string
  /** Яблоко; он же цвет сигнала «цель» на голове. */
  apple: string
  dangerFar: string
  dangerNear: string
  /** Подсветка того, во что упрётся луч, и заблокированные ближние метки. */
  rayDanger: string
  obstacle: string
  edge: string
  grid: string
  /** Проекция головы на стенки. */
  mark: string
  /** Настоящая стена арены на мини-карте. */
  wall: string
}

/** Целевая линейная яркость (0.299R+0.587G+0.114B после множителя) по ролям: множитель считается сам. */
export interface GlowTargets {
  headIdle: number
  headGoal: number
  dangerFar: number
  dangerNear: number
  apple: number
  /** Яркий сегмент тела (тусклые полосы = × stripeDim). */
  body: number
  edge: number
  obstacleLine: number
  /** Потолок множителя: цвет не выгорает в белое. */
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

/** «#rrggbb» -> линейные каналы 0..1 (как Three.js при включённом управлении цветом). */
export function hexToLinear(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)]
}

/** Яркость, которую видит порог bloom: по линейным каналам. */
export function luminance(c: Rgb): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

/** Множитель, доводящий яркость цвета до target; не больше maxBoost. */
export function boostFor(hex: string, target: number, maxBoost: number): number {
  const l = luminance(hexToLinear(hex))
  return l <= 1e-6 ? maxBoost : Math.min(maxBoost, target / l)
}

/** Цвет, каким он попадёт на экран: линейный × множитель, каналы обрезаны до 1 (тон-маппинга нет). Линейные каналы. */
export function displayedLinear(hex: string, boost: number): Rgb {
  const c = hexToLinear(hex)
  return [Math.min(1, c[0] * boost), Math.min(1, c[1] * boost), Math.min(1, c[2] * boost)]
}

export type Vision = 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia'
export const VISIONS: readonly Vision[] = ['normal', 'deuteranopia', 'protanopia', 'tritanopia']

// Machado, Oliveira, Fernandes 2009, полная степень (1.0), на линейном RGB.
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

/** Линейный RGB (0..1) -> CIE Lab (D65). */
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

/** ΔE CIE76 между двумя линейными цветами, как их видит зрение `v`. */
export function deltaE(a: Rgb, b: Rgb, v: Vision = 'normal'): number {
  const la = toLab(simulate(a, v))
  const lb = toLab(simulate(b, v))
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

/** Множители свечения набора по ролям (то же, что применяет view/palette.ts). */
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

/** Четыре состояния головы на экране (линейные каналы после множителя и обрезки). */
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

/** Минимум ΔE среди шести пар состояний головы и та пара, что его даёт. */
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

/** Пороги приёмки (IDEAS.md §4.4–4.5): ΔE ≥ 30 в норме, ≥ 20 при дейтеранопии и протанопии; тританопия — справочно. */
export const PASS_NORMAL = 30
export const PASS_DEUT_PROT = 20
/**
 * Яблоко против препятствий строже: обе вещи заметные, крупные и одного «тёплого/холодного» ряда, глазами (скриншоты) при ΔE ~32 их путают.
 * Нормальное зрение ≥ 40; при дейтеранопии и протанопии прежние 20.
 */
export const PASS_APPLE_OBSTACLE_NORMAL = 40
/** Минимум ΔE «сигнал против фона»: цвет состояния обязан читаться на тёмном фоне. */
export const PASS_VS_BACKGROUND = 40
/**
 * Минимум яркости (то, что на экране, после обрезки каналов) линии препятствия: тонкое ребро вдали не должно тускнеть.
 * Ночной неон даёт ~0.54; порог на ~15% ниже. Синие оттенки светят слабее (яркость синего 0.11), поэтому тёмно-синие
 * препятствия сюда не проходят, сколько множитель ни поднимай: канал упирается в 1, оттенок белеет.
 */
export const PASS_OBSTACLE_EDGE_LUM = 0.45

export interface PaletteCheck {
  /** Что сравнивалось, например «head:dangerFar/dangerNear» или «goal/body». */
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
 * Все проверки набора. Гейт: нормальное зрение ≥ 30, дейтеранопия и протанопия ≥ 20 (тританопия — справочно, min 0).
 * Пары: шесть пар состояний головы; цель против тела и хвоста; обычная голова против тела и хвоста;
 * яблоко против препятствий и рёбер; опасность против препятствий. Плюс каждое состояние головы против фона (только норма, ≥ 40).
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

/** Худшая по запасу проверка на каждое зрение (для таблицы отчёта). */
export function worstByVision(checks: readonly PaletteCheck[], v: Vision, prefix = ''): PaletteCheck | undefined {
  let worst: PaletteCheck | undefined
  for (const c of checks) {
    if (c.vision !== v || !c.name.startsWith(prefix)) continue
    if (worst === undefined || c.value - c.min < worst.value - worst.min) worst = c
  }
  return worst
}
