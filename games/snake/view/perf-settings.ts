// Отладочные настройки производительности (панель перформанса, view/perf-panel.ts).
// Живут на уровне модуля: переживают перезапуск партии, но не перезагрузку страницы (запоминать не надо).
// Значения по умолчанию = прежнее поведение игры, поэтому с закрытой панелью ничего не меняется.

import type { AaSettings } from './postprocessing'

/**
 * Способы сглаживания для панели и бенчмарка (первый = штатное значение игры). Это разные цены на разном железе:
 * на встроенной графике Intel (ANGLE/D3D11) MSAA в HalfFloat-цели даёт затык через кадр (замер дизайнера), поэтому
 * рядом стоят кандидаты обхода: 8-битная цель, MSAA без resolve глубины, постобработочный SMAA.
 */
export interface AaPreset extends AaSettings {
  id: string
  label: string
}
export const AA_PRESETS: readonly AaPreset[] = [
  { id: 'msaa4', label: 'MSAA4', samples: 4, byteTarget: false, resolveDepth: true, smaa: false },
  { id: 'msaa2', label: 'MSAA2', samples: 2, byteTarget: false, resolveDepth: true, smaa: false },
  { id: 'msaa4-8bit', label: 'MSAA4 8bit', samples: 4, byteTarget: true, resolveDepth: true, smaa: false },
  { id: 'msaa4-nodepth', label: 'MSAA4 no depth resolve', samples: 4, byteTarget: false, resolveDepth: false, smaa: false },
  { id: 'msaa4-8bit-nodepth', label: 'MSAA4 8bit no depth resolve', samples: 4, byteTarget: true, resolveDepth: false, smaa: false },
  { id: 'smaa', label: 'SMAA', samples: 0, byteTarget: false, resolveDepth: true, smaa: true },
  { id: 'off', label: 'off', samples: 0, byteTarget: false, resolveDepth: true, smaa: false },
]
/** Ступени потолка мегапикселей буфера отрисовки (0 — без потолка, как в игре по умолчанию). */
export const MEGAPIXEL_STEPS: readonly number[] = [0, 4, 2.5, 1.5]

/** Верхняя граница множителя плотности пикселей (защита слабых телефонов от перерасхода fillrate). */
export const MAX_PIXEL_RATIO = 2

export interface PerfSettings {
  /** Число сэмплов MSAA (0 — нет). Остальные поля способа — ниже; целиком их выставляет setAaPreset/applyQualityLevel. */
  msaa: number
  /** MSAA-цель 8 бит (sRGB) вместо HalfFloat. */
  aaByte: boolean
  /** Разрешать multisampled глубину (по умолчанию three разрешает). */
  aaDepthResolve: boolean
  /** Постобработочный SMAA вместо MSAA. */
  smaa: boolean
  bloom: boolean
  /** Разрешение свечения относительно буфера кадра: 1 — полное, 0.5 — половинное (дешевле, гало шире и мягче). */
  bloomScale: number
  megapixelCap: number
  fog: boolean
  miniMap: boolean
  /** Панель открыта: включает ручной сброс renderer.info (иначе он считал бы только последний пасс). */
  statsOn: boolean
}

export const perf: PerfSettings = {
  msaa: AA_PRESETS[0]!.samples,
  aaByte: false,
  aaDepthResolve: true,
  smaa: false,
  bloom: true,
  bloomScale: 1,
  megapixelCap: MEGAPIXEL_STEPS[0]!,
  fog: true,
  miniMap: true,
  statsOn: false,
}

/** Заранее выделенный снимок показателей; заполняется View.readPerf и main.ts, читается панелью. */
export interface PerfSnapshot {
  drawCalls: number
  triangles: number
  bufferW: number
  bufferH: number
  pixelRatio: number
  devicePixelRatio: number
  arena: number
  snakeLength: number
  /** Что реально включено в композере (подпись для лога бенчмарка). */
  aaLabel: string
  /** Нижний край мини-карты в CSS px от верха окна (чтобы панель не перекрывала карту). */
  miniMapBottomPx: number
}

export function createPerfSnapshot(): PerfSnapshot {
  return { drawCalls: 0, triangles: 0, bufferW: 0, bufferH: 0, pixelRatio: 1, devicePixelRatio: 1, arena: 0, snakeLength: 0, aaLabel: '', miniMapBottomPx: 0 }
}

// --- Качество для игрока (меню и пауза): связка потолка МПикс, сглаживания и свечения. Числа — config.json (quality). ---

export type QualityId = 'high' | 'medium' | 'low'
export const QUALITY_IDS: readonly QualityId[] = ['high', 'medium', 'low']

export interface QualityLevel {
  megapixelCap: number
  msaa: number
  /** Необязательные уточнения способа сглаживания; не заданы — как «высокое»: HalfFloat-цель, глубина разрешается, без SMAA. */
  aaByte?: boolean
  aaDepthResolve?: boolean
  smaa?: boolean
  bloom: 'full' | 'half' | 'off'
}

export interface QualityConfig {
  autoMediumFromMegapixels: number
  autoLowFromMegapixels: number
  /** Ступень по умолчанию на слабой/неопознанной десктопной графике: MSAA там опция, а не умолчание (см. autoQuality). */
  autoWeakGpu: QualityId
  /** Регулярка (без учёта регистра) по строке видеокарты: что считать сильным GPU, на котором MSAA остаётся умолчанием. */
  strongGpuPattern: string
  levels: Record<QualityId, QualityLevel>
}

export function isQualityId(v: unknown): v is QualityId {
  return v === 'high' || v === 'medium' || v === 'low'
}

/** Выставляет perf по ступени качества (холодный путь; применение к рендеру — View.applyPerf). */
export function applyQualityLevel(level: QualityLevel): void {
  perf.megapixelCap = level.megapixelCap
  perf.msaa = level.msaa
  perf.aaByte = level.aaByte ?? false
  perf.aaDepthResolve = level.aaDepthResolve ?? true
  perf.smaa = level.smaa ?? false
  perf.bloom = level.bloom !== 'off'
  perf.bloomScale = level.bloom === 'half' ? 0.5 : 1
}

/** Размер буфера кадра на «высоком», МПикс: окно в CSS px, умноженное на множитель плотности (не выше MAX_PIXEL_RATIO). */
export function bufferMegapixels(cssW: number, cssH: number, devicePixelRatio: number): number {
  const pr = Math.min(devicePixelRatio > 0 ? devicePixelRatio : 1, MAX_PIXEL_RATIO)
  return (cssW * pr * cssH * pr) / 1e6
}

/** Выставляет способ сглаживания целиком (панель, бенчмарк). Холодный путь. */
export function setAaPreset(p: AaSettings): void {
  perf.msaa = p.samples
  perf.aaByte = p.byteTarget
  perf.aaDepthResolve = p.resolveDepth
  perf.smaa = p.smaa
}

/** Текущее сглаживание как настройки композера (холодный путь; аллоцирует объект). */
export function currentAa(): AaSettings {
  return { samples: perf.smaa ? 0 : perf.msaa, byteTarget: perf.aaByte, resolveDepth: perf.aaDepthResolve, smaa: perf.smaa }
}

/** Пресет панели, соответствующий текущим настройкам; null — сочетание не из списка. */
export function currentAaPreset(): AaPreset | null {
  for (const p of AA_PRESETS) {
    if (p.smaa === perf.smaa && p.samples === (perf.smaa ? 0 : perf.msaa) && p.byteTarget === perf.aaByte && p.resolveDepth === perf.aaDepthResolve) return p
  }
  return null
}

/** Класс видеокарты для выбора ступени по умолчанию. */
export type GpuClass = 'strong' | 'weak' | 'software' | 'unknown'

const SOFTWARE_GPU_RE = /swiftshader|llvmpipe|software|softpipe|microsoft basic render|basic render driver/i

/**
 * Класс по строке видеокарты (WEBGL_debug_renderer_info). Чистая функция (тестируется).
 * strong — дискретные и мобильные GPU, где MSAA известно дёшев: шаблон `cfg.strongGpuPattern`.
 * weak — всё, что распознано как встроенная графика Intel/AMD/прочее и не подошло под strong (замер: Intel Xe/Arc iGPU на D3D11 даёт затык через кадр с MSAA).
 * unknown — строки нет (браузер скрыл): решает тип указателя.
 */
export function classifyGpu(renderer: string, cfg: QualityConfig): GpuClass {
  if (renderer === '') return 'unknown'
  if (SOFTWARE_GPU_RE.test(renderer)) return 'software'
  if (new RegExp(cfg.strongGpuPattern, 'i').test(renderer)) return 'strong'
  return 'weak'
}

let gpuRendererCache: string | null = null

/** Строка видеокарты через временный WebGL-контекст (холодный путь, один раз; '' — не удалось/скрыто). */
export function readGpuRendererString(): string {
  if (gpuRendererCache !== null) return gpuRendererCache
  gpuRendererCache = ''
  try {
    if (typeof document === 'undefined') return gpuRendererCache
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    if (gl === null) return gpuRendererCache
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    if (dbg !== null) gpuRendererCache = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    gpuRendererCache = ''
  }
  return gpuRendererCache
}

/** Есть ли у устройства основной указатель «мышь/тачпад» (десктоп, ноутбук). Телефон и планшет — грубый указатель (касание). */
export function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: fine)').matches
}

/** Класс по умолчанию для текущего устройства: строка карты, а если она скрыта — тип указателя (касание = тайловый мобильный GPU). */
export function detectGpuClass(cfg: QualityConfig): GpuClass {
  const g = classifyGpu(readGpuRendererString(), cfg)
  if (g === 'unknown') return hasFinePointer() ? 'weak' : 'strong'
  return g
}

/**
 * Ступень по умолчанию, пока игрок ничего не выбрал. Принцип: не отдавать слабому железу мультисэмплинг молча, но и сильному
 * не отбирать его молча. Игрок может выбрать любую ступень в меню (выбор запоминается), поэтому умолчание должно быть безопасным.
 * Замер на встроенной графике Intel (Windows, D3D11): MSAA даёт затык на каждом втором кадре при любом числе сэмплов и любом
 * размере буфера, без MSAA тот же буфер держит 60 кадров/с. Размер буфера этого не предсказывает, поэтому сначала класс карты:
 * - буфер от `autoLowFromMegapixels` или программный рендер — «низкое» (fillrate);
 * - strong (дискретные NVIDIA/AMD RX, Apple, мобильные Adreno/Mali/PowerVR): прежнее правило по размеру буфера
 *   («высокое» с MSAA, на большом буфере «среднее»);
 * - weak (встроенная графика, карта не опознана как сильная, скрытая строка на десктопе): `cfg.autoWeakGpu` («среднее» = полное разрешение
 *   и свечение, без MSAA).
 */
export function autoQuality(megapixels: number, cfg: QualityConfig, gpu: GpuClass = detectGpuClass(cfg)): QualityId {
  if (megapixels >= cfg.autoLowFromMegapixels || gpu === 'software') return 'low'
  if (gpu === 'weak') return cfg.autoWeakGpu
  if (megapixels >= cfg.autoMediumFromMegapixels) return 'medium'
  return 'high'
}

// Отладка из консоли (только при ?perf в адресе): window.__perf.msaa = 0 и т.п. до applyPerf панели; для скриншотов ступеней.
if (typeof location !== 'undefined' && /[?&]perf\b/.test(location.search)) (globalThis as Record<string, unknown>)['__perf'] = perf
