// Built-in benchmark: runs a set of render configurations for several seconds each and collects
// frame statistics (not a single average: median, p95, p99, worst, misses of the 60 and 30 fps budgets).
// Pure logic with no DOM or three.js (testable): main.ts feeds it frames, the panel shows progress and the log.
// All buffers are preallocated, a frame only writes a number into a Float32Array.
//
// Scene reproducibility is ensured by main.ts: a game with a fixed seed on the BENCH_ARENA arena, game logic
// frozen (tick is not called, input is ignored), camera in its initial position, rendering runs as usual.

import configJson from '../config.json'
import { perf, type PerfSnapshot, type QualityLevel } from './perf-settings'

/** Duration of one measurement stage, ms. */
export const BENCH_STAGE_MS = 5000
/** Pause before the first stage: the camera settles, shaders compile, buffers warm up. */
export const BENCH_INITIAL_SETTLE_MS = 2500
/** After a configuration change frames are discarded: buffers/composer are recreated, this is not "game speed". */
export const BENCH_SETTLE_MS = 700
/** At least this many frames discarded after a change (in case of a very slow frame). */
export const BENCH_SETTLE_FRAMES = 8
/** Capacity of the stage frame buffer: 5 s at 400 fps with headroom. */
export const BENCH_MAX_FRAMES = 4096
/**
 * "Miss of 60"/"miss of 30" frames/s: the threshold is slightly above the frame period (16.7/33.3 ms) with tolerance for jitter
 * in the requestAnimationFrame timestamp, otherwise a normal 16.68 ms would count as a miss.
 */
export const MISS_60_MS = 18
export const MISS_30_MS = 34
/** Run arena (the heaviest available) and the obstacle generation seed. */
export const BENCH_ARENA = 100
export const BENCH_SEED = 20240607

export interface BenchStage {
  id: string
  label: string
  msaa: number
  /** 8-bit (sRGB) MSAA target instead of HalfFloat. */
  aaByte: boolean
  /** Allow multisampled depth resolve (three allows it by default). */
  aaDepthResolve: boolean
  /** Post-processing SMAA (msaa is 0 then). */
  smaa: boolean
  bloom: boolean
  /** Bloom resolution relative to the buffer: 1 is full, 0.5 is half. */
  bloomScale: number
  megapixelCap: number
}

/** Apply a stage to the perf settings as a whole (including the antialiasing method). Cold path; afterwards View.applyPerf. */
export function applyBenchStage(stage: BenchStage): void {
  perf.msaa = stage.msaa
  perf.aaByte = stage.aaByte
  perf.aaDepthResolve = stage.aaDepthResolve
  perf.smaa = stage.smaa
  perf.bloom = stage.bloom
  perf.bloomScale = stage.bloomScale
  perf.megapixelCap = stage.megapixelCap
}

function aaName(level: QualityLevel): string {
  if (level.smaa) return 'SMAA'
  if (level.msaa === 0) return 'off'
  return `MSAA${level.msaa}${level.aaByte ? ' 8bit' : ''}`
}

function levelStage(id: string, level: QualityLevel): BenchStage {
  return {
    id,
    label: `quality ${id.replace('q-', '')} (cap ${level.megapixelCap || 'none'} MP, AA ${aaName(level)}, bloom ${level.bloom})`,
    msaa: level.msaa,
    aaByte: level.aaByte ?? false,
    aaDepthResolve: level.aaDepthResolve ?? true,
    smaa: level.smaa ?? false,
    bloom: level.bloom !== 'off',
    bloomScale: level.bloom === 'half' ? 0.5 : 1,
    megapixelCap: level.megapixelCap,
  }
}

function stage(id: string, label: string, over: Partial<BenchStage>): BenchStage {
  return { id, label, msaa: 0, aaByte: false, aaDepthResolve: true, smaa: false, bloom: true, bloomScale: 1, megapixelCap: 0, ...over }
}

// The MPix caps (cap-2.5, cap-1.5) from the earlier set were removed: the designer's measurement showed a cap does not cure the stall. The main question
// now is which antialiasing does not tank Intel integrated graphics and what it does for the picture.
export const BENCH_STAGES: readonly BenchStage[] = [
  stage('as-is', 'as is (MSAA4 half-float target, bloom, no cap)', { msaa: 4 }),
  stage('no-aa', 'AA off (full res, full bloom)', {}),
  stage('no-bloom', 'bloom off (MSAA4 half)', { msaa: 4, bloom: false }),
  stage('no-aa-bloom', 'AA off + bloom off', { bloom: false }),
  // Candidates for working around the MSAA stall:
  stage('aa4-8bit', 'MSAA4, 8-bit sRGB target', { msaa: 4, aaByte: true }),
  stage('aa2-8bit', 'MSAA2, 8-bit sRGB target', { msaa: 2, aaByte: true }),
  stage('aa4-nodepth', 'MSAA4 half, no depth resolve', { msaa: 4, aaDepthResolve: false }),
  stage('aa4-8bit-nodepth', 'MSAA4 8-bit, no depth resolve', { msaa: 4, aaByte: true, aaDepthResolve: false }),
  stage('smaa', 'SMAA (post-process), full bloom', { smaa: true }),
  // Quality levels from the game menu (config.json: quality.levels) are what the player will actually pick.
  levelStage('q-high', configJson.quality.levels.high as QualityLevel),
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
  /** JS part of the frame (tick + render call), ms: if it is small while the frame is long, the bottleneck is the GPU/vsync. */
  jsAvgMs: number
  jsP95Ms: number
  drawCalls: number
  triangles: number
  bufferW: number
  bufferH: number
  pixelRatio: number
  /** What was actually enabled in the composer during the stage (not "what we wanted"): the antialiasing label. */
  aaLabel: string
}

/** Percentile by the nearest-rank method; `sorted` is ascending, n > 0. */
export function percentile(sorted: ArrayLike<number>, n: number, p: number): number {
  if (n <= 0) return 0
  let idx = Math.ceil((p / 100) * n) - 1
  if (idx < 0) idx = 0
  if (idx > n - 1) idx = n - 1
  return sorted[idx]!
}

/** Frame summary (cold path, at the end of a stage). `scratch` is ruined by sorting. */
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
  /** Apply the stage configuration (recreate composer/buffers; cold path). */
  applyStage(stage: BenchStage): void
  /** Capture render metrics (calls, triangles, buffer) for the stage. */
  sample(out: PerfSnapshot): void
  /** Run finished (all stages or cancelled): restore the previous settings. */
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
  /** How many ms remain until the end of the run (estimate: current phase + remaining stages). */
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

  /** Once per frame (rAF timestamp now, ms) after tick+render. jsMs is the duration of this frame's JS part. */
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
        this.lastNow = now // the first measured frame is the next one, with no delta across the phase boundary
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
      aaLabel: this.snap.aaLabel,
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

// --- log ---------------------------------------------------------------

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
  /** Quality level from the menu at launch time and where it came from (chosen by the player or the default). */
  quality: string
}

function n1(v: number, w: number): string {
  return v.toFixed(1).padStart(w, ' ')
}

/** Human-readable compact log (cold path). Stage numbers are aligned in columns. */
export function formatBenchLog(env: BenchEnv, results: readonly StageResult[], aborted: string | null): string {
  const L: string[] = []
  L.push('SNAKE BENCH v2' + (aborted !== null ? ` (INCOMPLETE: ${aborted})` : ''))
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
  L.push('stage              frames   avg   med   p95   p99   max  >60  >30   js  jsp95 draws    tris  buffer         MP   pr  vs-med')
  const base = results.length > 0 ? results[0]!.medianMs : 0
  for (const r of results) {
    const mp = (r.bufferW * r.bufferH) / 1e6
    const delta = base > 0 ? `${(((r.medianMs - base) / base) * 100).toFixed(0)}%`.padStart(6, ' ') : '     -'
    L.push(
      `${r.stage.id.padEnd(18, ' ')} ${String(r.frames).padStart(6, ' ')} ${n1(r.avgMs, 5)} ${n1(r.medianMs, 5)} ${n1(r.p95Ms, 5)} ${n1(r.p99Ms, 5)} ${n1(r.maxMs, 5)} ` +
        `${String(r.over60).padStart(4, ' ')} ${String(r.over30).padStart(4, ' ')} ${n1(r.jsAvgMs, 4)} ${n1(r.jsP95Ms, 5)} ` +
        `${String(r.drawCalls).padStart(5, ' ')} ${String(r.triangles).padStart(7, ' ')}  ${`${r.bufferW}x${r.bufferH}`.padEnd(10, ' ')} ${mp.toFixed(2).padStart(5, ' ')} ${r.pixelRatio.toFixed(2)} ${delta}  [${r.aaLabel}]`,
    )
  }
  L.push('(all times in ms; vs-med = median frame time relative to "as-is", negative = faster)')
  return L.join('\n')
}
