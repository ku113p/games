// Встроенный бенчмарк: сам прогоняет набор конфигураций рендера по несколько секунд каждую и собирает
// статистику кадров (не одно среднее: медиана, p95, p99, худший, промахи мимо 60 и 30 кадров).
// Чистая логика без DOM и three.js (тестируется): main.ts кормит её кадрами, панель показывает прогресс и лог.
// Все буферы выделены заранее, кадр только пишет число в Float32Array.
//
// Воспроизводимость сцены обеспечивает main.ts: партия с фиксированным seed на арене BENCH_ARENA, логика игры
// заморожена (tick не вызывается, ввод игнорируется), камера в исходном положении, рендер идёт как обычно.

import configJson from '../config.json'
import type { PerfSnapshot, QualityLevel } from './perf-settings'

/** Длительность одного этапа замера, мс. */
export const BENCH_STAGE_MS = 5000
/** Пауза перед первым этапом: камера доезжает, компилируются шейдеры, прогреваются буферы. */
export const BENCH_INITIAL_SETTLE_MS = 2500
/** После смены конфигурации кадры отбрасываются: пересоздаются буферы/композер, это не «скорость игры». */
export const BENCH_SETTLE_MS = 700
/** Не меньше стольких отброшенных кадров после смены (на случай очень медленного кадра). */
export const BENCH_SETTLE_FRAMES = 8
/** Ёмкость буфера кадров этапа: 5 с при 400 fps и с запасом. */
export const BENCH_MAX_FRAMES = 4096
/**
 * «Промах мимо 60»/«мимо 30» кадров/с: порог чуть выше периода кадра (16.7/33.3 мс) с допуском на дрожание
 * метки requestAnimationFrame, иначе нормальные 16.68 мс считались бы промахом.
 */
export const MISS_60_MS = 18
export const MISS_30_MS = 34
/** Арена прогона (самая тяжёлая из доступных) и seed генерации препятствий. */
export const BENCH_ARENA = 100
export const BENCH_SEED = 20240607

export interface BenchStage {
  id: string
  label: string
  msaa: number
  bloom: boolean
  /** Разрешение свечения относительно буфера: 1 — полное, 0.5 — половинное. */
  bloomScale: number
  megapixelCap: number
}

function levelStage(id: string, level: QualityLevel): BenchStage {
  return {
    id,
    label: `quality ${id.replace('q-', '')} (cap ${level.megapixelCap || 'none'} MP, AA ${level.msaa}, bloom ${level.bloom})`,
    msaa: level.msaa,
    bloom: level.bloom !== 'off',
    bloomScale: level.bloom === 'half' ? 0.5 : 1,
    megapixelCap: level.megapixelCap,
  }
}

export const BENCH_STAGES: readonly BenchStage[] = [
  { id: 'as-is', label: 'as is (AA4, bloom, no cap)', msaa: 4, bloom: true, bloomScale: 1, megapixelCap: 0 },
  { id: 'no-aa', label: 'AA off', msaa: 0, bloom: true, bloomScale: 1, megapixelCap: 0 },
  { id: 'no-bloom', label: 'bloom off', msaa: 4, bloom: false, bloomScale: 1, megapixelCap: 0 },
  { id: 'no-aa-bloom', label: 'AA off + bloom off', msaa: 0, bloom: false, bloomScale: 1, megapixelCap: 0 },
  { id: 'cap-2.5', label: 'cap 2.5 MP', msaa: 4, bloom: true, bloomScale: 1, megapixelCap: 2.5 },
  { id: 'cap-1.5', label: 'cap 1.5 MP', msaa: 4, bloom: true, bloomScale: 1, megapixelCap: 1.5 },
  // Ступени качества из меню игры (config.json: quality.levels) — то, что игрок реально выберет.
  levelStage('q-medium', configJson.quality.levels.medium as QualityLevel),
  levelStage('q-low', configJson.quality.levels.low as QualityLevel),
]

export interface StageResult {
  stage: BenchStage
  frames: number
  avgMs: number
  medianMs: number
  p95Ms: number
  p99Ms: number
  minMs: number
  maxMs: number
  over60: number
  over30: number
  /** Время JS-части кадра (tick+render-вызов), мс: если оно мало, а кадр длинный — узкое место GPU/вертикальная синхронизация. */
  jsAvgMs: number
  jsP95Ms: number
  drawCalls: number
  triangles: number
  bufferW: number
  bufferH: number
  pixelRatio: number
}

/** Процентиль по методу ближайшего ранга; `sorted` отсортирован по возрастанию, n > 0. */
export function percentile(sorted: ArrayLike<number>, n: number, p: number): number {
  if (n <= 0) return 0
  let idx = Math.ceil((p / 100) * n) - 1
  if (idx < 0) idx = 0
  if (idx > n - 1) idx = n - 1
  return sorted[idx]!
}

/** Сводка по кадрам (холодный путь, в конце этапа). `scratch` портится сортировкой. */
export function summarize(frames: Float32Array, n: number): { avg: number; median: number; p95: number; p99: number; min: number; max: number; over60: number; over30: number } {
  if (n <= 0) return { avg: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0, over60: 0, over30: 0 }
  let sum = 0
  let over60 = 0
  let over30 = 0
  for (let i = 0; i < n; i++) {
    const v = frames[i]!
    sum += v
    if (v > MISS_60_MS) over60++
    if (v > MISS_30_MS) over30++
  }
  const sorted = frames.slice(0, n).sort()
  return {
    avg: sum / n,
    median: percentile(sorted, n, 50),
    p95: percentile(sorted, n, 95),
    p99: percentile(sorted, n, 99),
    min: sorted[0]!,
    max: sorted[n - 1]!,
    over60,
    over30,
  }
}

export interface BenchHooks {
  /** Применить конфигурацию этапа (пересоздание композера/буферов; холодный путь). */
  applyStage(stage: BenchStage): void
  /** Снять показатели рендера (вызовы, треугольники, буфер) для этапа. */
  sample(out: PerfSnapshot): void
  /** Прогон закончен (все этапы или отмена): вернуть прежние настройки. */
  finished(results: readonly StageResult[], aborted: string | null): void
}

type Phase = 'idle' | 'settle' | 'measure'

export class BenchRun {
  private phase: Phase = 'idle'
  private stageIndex = -1
  private phaseEnd = 0
  private settleFrames = 0
  private lastNow = 0
  private n = 0
  private readonly frames = new Float32Array(BENCH_MAX_FRAMES)
  private readonly js = new Float32Array(BENCH_MAX_FRAMES)
  private readonly results: StageResult[] = []
  private readonly snap: PerfSnapshot

  constructor(private hooks: BenchHooks, snap: PerfSnapshot) {
    this.snap = snap
  }

  get running(): boolean {
    return this.phase !== 'idle'
  }
  get stageNumber(): number {
    return this.stageIndex + 1
  }
  get stageCount(): number {
    return BENCH_STAGES.length
  }
  get stageLabel(): string {
    return this.stageIndex >= 0 && this.stageIndex < BENCH_STAGES.length ? BENCH_STAGES[this.stageIndex]!.label : ''
  }
  get measuring(): boolean {
    return this.phase === 'measure'
  }
  /** Сколько мс осталось до конца прогона (оценка: текущая фаза + оставшиеся этапы). */
  remainingMs(now: number): number {
    if (this.phase === 'idle') return 0
    const left = Math.max(0, this.phaseEnd - now)
    const stagesLeft = BENCH_STAGES.length - this.stageIndex - 1
    const rest = stagesLeft * (BENCH_SETTLE_MS + BENCH_STAGE_MS)
    return this.phase === 'settle' ? left + BENCH_STAGE_MS + rest : left + rest
  }

  start(now: number): void {
    this.results.length = 0
    this.stageIndex = 0
    this.enterSettle(now, BENCH_INITIAL_SETTLE_MS)
    this.hooks.applyStage(BENCH_STAGES[0]!)
  }

  abort(reason: string): void {
    if (this.phase === 'idle') return
    this.phase = 'idle'
    this.hooks.finished(this.results.slice(), reason)
  }

  private enterSettle(now: number, ms: number): void {
    this.phase = 'settle'
    this.phaseEnd = now + ms
    this.settleFrames = 0
    this.lastNow = 0
  }

  /** Раз в кадр (rAF-метка now, мс) после tick+render. jsMs — длительность JS-части этого кадра. */
  frame(now: number, jsMs: number): void {
    if (this.phase === 'idle') return
    const dt = this.lastNow === 0 ? 0 : now - this.lastNow
    this.lastNow = now
    if (this.phase === 'settle') {
      this.settleFrames++
      if (now >= this.phaseEnd && this.settleFrames >= BENCH_SETTLE_FRAMES) {
        this.phase = 'measure'
        this.phaseEnd = now + BENCH_STAGE_MS
        this.n = 0
        this.lastNow = now // первый замеренный кадр — следующий, без дельты через границу фаз
      }
      return
    }
    if (dt > 0 && this.n < BENCH_MAX_FRAMES) {
      this.frames[this.n] = dt
      this.js[this.n] = jsMs
      this.n++
    }
    if (now >= this.phaseEnd) this.finishStage(now)
  }

  private finishStage(now: number): void {
    const stage = BENCH_STAGES[this.stageIndex]!
    const f = summarize(this.frames, this.n)
    let jsSum = 0
    for (let i = 0; i < this.n; i++) jsSum += this.js[i]!
    const jsSorted = this.js.slice(0, this.n).sort()
    this.hooks.sample(this.snap)
    this.results.push({
      stage,
      frames: this.n,
      avgMs: f.avg,
      medianMs: f.median,
      p95Ms: f.p95,
      p99Ms: f.p99,
      minMs: f.min,
      maxMs: f.max,
      over60: f.over60,
      over30: f.over30,
      jsAvgMs: this.n > 0 ? jsSum / this.n : 0,
      jsP95Ms: percentile(jsSorted, this.n, 95),
      drawCalls: this.snap.drawCalls,
      triangles: this.snap.triangles,
      bufferW: this.snap.bufferW,
      bufferH: this.snap.bufferH,
      pixelRatio: this.snap.pixelRatio,
    })
    this.stageIndex++
    if (this.stageIndex >= BENCH_STAGES.length) {
      this.phase = 'idle'
      this.hooks.finished(this.results.slice(), null)
      return
    }
    this.enterSettle(now, BENCH_SETTLE_MS)
    this.hooks.applyStage(BENCH_STAGES[this.stageIndex]!)
  }
}

// --- лог ---------------------------------------------------------------

export interface BenchEnv {
  startedAt: string
  gpuRenderer: string
  gpuVendor: string
  glRenderer: string
  glVersion: string
  shadingLanguage: string
  webglVersion: number
  maxSamples: number
  maxTextureSize: number
  extensions: string
  software: boolean
  userAgent: string
  platform: string
  cores: number
  memoryGb: number
  windowW: number
  windowH: number
  screenW: number
  screenH: number
  devicePixelRatio: number
  arena: number
  snakeLength: number
  mode: string
  seed: number
  language: string
  /** Ступень качества из меню на момент запуска и откуда она (выбрана игроком или по умолчанию). */
  quality: string
}

function n1(v: number, w: number): string {
  return v.toFixed(1).padStart(w, ' ')
}

/** Человекочитаемый компактный лог (холодный путь). Числа этапов выровнены столбцами. */
export function formatBenchLog(env: BenchEnv, results: readonly StageResult[], aborted: string | null): string {
  const L: string[] = []
  L.push('SNAKE BENCH v1' + (aborted !== null ? ` (INCOMPLETE: ${aborted})` : ''))
  L.push(`date: ${env.startedAt}`)
  L.push(`GPU: ${env.gpuRenderer}`)
  L.push(`GPU vendor: ${env.gpuVendor}`)
  if (env.software) L.push('WARNING: software rendering detected, the browser is NOT using the video card (check hardware acceleration)')
  L.push(`WebGL: ${env.glVersion} | GLSL: ${env.shadingLanguage} | maxSamples ${env.maxSamples} | maxTex ${env.maxTextureSize}`)
  L.push(`GL renderer (masked): ${env.glRenderer}`)
  L.push(`extensions: ${env.extensions}`)
  L.push(`browser: ${env.userAgent}`)
  L.push(`platform: ${env.platform} | cores ${env.cores} | mem ${env.memoryGb > 0 ? env.memoryGb + ' GB' : 'n/a'}`)
  L.push(`window ${env.windowW}x${env.windowH} css | screen ${env.screenW}x${env.screenH} | devicePixelRatio ${env.devicePixelRatio}`)
  L.push(`game quality setting at start: ${env.quality}`)
  L.push(`scene: arena ${env.arena}^3, snake ${env.snakeLength}, mode ${env.mode}, seed ${env.seed}, logic frozen, default camera`)
  L.push(
    `run: ${BENCH_STAGE_MS / 1000} s per stage, first ${BENCH_SETTLE_MS} ms after each switch discarded; ` +
      `frame = requestAnimationFrame interval; over60 = >${MISS_60_MS} ms, over30 = >${MISS_30_MS} ms; js = tick+render call CPU time`,
  )
  L.push('')
  L.push('stage         frames   avg   med   p95   p99   max  >60  >30   js  jsp95 draws    tris  buffer         MP   pr  vs-med')
  const base = results.length > 0 ? results[0]!.medianMs : 0
  for (const r of results) {
    const mp = (r.bufferW * r.bufferH) / 1e6
    const delta = base > 0 ? `${(((r.medianMs - base) / base) * 100).toFixed(0)}%`.padStart(6, ' ') : '     -'
    L.push(
      `${r.stage.id.padEnd(13, ' ')} ${String(r.frames).padStart(6, ' ')} ${n1(r.avgMs, 5)} ${n1(r.medianMs, 5)} ${n1(r.p95Ms, 5)} ${n1(r.p99Ms, 5)} ${n1(r.maxMs, 5)} ` +
        `${String(r.over60).padStart(4, ' ')} ${String(r.over30).padStart(4, ' ')} ${n1(r.jsAvgMs, 4)} ${n1(r.jsP95Ms, 5)} ` +
        `${String(r.drawCalls).padStart(5, ' ')} ${String(r.triangles).padStart(7, ' ')}  ${`${r.bufferW}x${r.bufferH}`.padEnd(10, ' ')} ${mp.toFixed(2).padStart(5, ' ')} ${r.pixelRatio.toFixed(2)} ${delta}`,
    )
  }
  L.push('(all times in ms; vs-med = median frame time relative to "as-is", negative = faster)')
  return L.join('\n')
}
