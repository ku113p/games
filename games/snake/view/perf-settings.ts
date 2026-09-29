// Отладочные настройки производительности (панель перформанса, view/perf-panel.ts).
// Живут на уровне модуля: переживают перезапуск партии, но не перезагрузку страницы (запоминать не надо).
// Значения по умолчанию = прежнее поведение игры, поэтому с закрытой панелью ничего не меняется.

/** Ступени MSAA (число сэмплов; 0 — без сглаживания). Первая = штатное значение игры. */
export const MSAA_STEPS: readonly number[] = [4, 2, 0]
/** Ступени потолка мегапикселей буфера отрисовки (0 — без потолка, как в игре по умолчанию). */
export const MEGAPIXEL_STEPS: readonly number[] = [0, 4, 2.5, 1.5]

/** Верхняя граница множителя плотности пикселей (защита слабых телефонов от перерасхода fillrate). */
export const MAX_PIXEL_RATIO = 2

export interface PerfSettings {
  msaa: number
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
  msaa: MSAA_STEPS[0]!,
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
  /** Нижний край мини-карты в CSS px от верха окна (чтобы панель не перекрывала карту). */
  miniMapBottomPx: number
}

export function createPerfSnapshot(): PerfSnapshot {
  return { drawCalls: 0, triangles: 0, bufferW: 0, bufferH: 0, pixelRatio: 1, devicePixelRatio: 1, arena: 0, snakeLength: 0, miniMapBottomPx: 0 }
}

// --- Качество для игрока (меню и пауза): связка потолка МПикс, сглаживания и свечения. Числа — config.json (quality). ---

export type QualityId = 'high' | 'medium' | 'low'
export const QUALITY_IDS: readonly QualityId[] = ['high', 'medium', 'low']

export interface QualityLevel {
  megapixelCap: number
  msaa: number
  bloom: 'full' | 'half' | 'off'
}

export interface QualityConfig {
  autoMediumFromMegapixels: number
  autoLowFromMegapixels: number
  levels: Record<QualityId, QualityLevel>
}

export function isQualityId(v: unknown): v is QualityId {
  return v === 'high' || v === 'medium' || v === 'low'
}

/** Выставляет perf по ступени качества (холодный путь; применение к рендеру — View.applyPerf). */
export function applyQualityLevel(level: QualityLevel): void {
  perf.megapixelCap = level.megapixelCap
  perf.msaa = level.msaa
  perf.bloom = level.bloom !== 'off'
  perf.bloomScale = level.bloom === 'half' ? 0.5 : 1
}

/** Размер буфера кадра на «высоком», МПикс: окно в CSS px, умноженное на множитель плотности (не выше MAX_PIXEL_RATIO). */
export function bufferMegapixels(cssW: number, cssH: number, devicePixelRatio: number): number {
  const pr = Math.min(devicePixelRatio > 0 ? devicePixelRatio : 1, MAX_PIXEL_RATIO)
  return (cssW * pr * cssH * pr) / 1e6
}

/**
 * Ступень по умолчанию, пока игрок ничего не выбрал: решает РАЗМЕР БУФЕРА, а не тип устройства (цена кадра линейна по пикселям).
 * Телефон (~1.3 МПикс) и обычный 1080p (~2 МПикс) остаются на «высоком»; большой монитор и ретина — ниже.
 */
export function autoQuality(megapixels: number, cfg: QualityConfig): QualityId {
  if (megapixels >= cfg.autoLowFromMegapixels) return 'low'
  if (megapixels >= cfg.autoMediumFromMegapixels) return 'medium'
  return 'high'
}
