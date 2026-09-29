import { describe, expect, test } from 'bun:test'
import { BENCH_SETTLE_MS, BENCH_STAGES, applyBenchStage, BENCH_STAGE_MS, BenchRun, formatBenchLog, percentile, summarize, type BenchEnv, type StageResult } from './perf-bench'
import { createPerfSnapshot, perf } from './perf-settings'

describe('percentile / summarize', () => {
  test('ближайший ранг', () => {
    const a = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(percentile(a, 10, 50)).toBe(5)
    expect(percentile(a, 10, 95)).toBe(10)
    expect(percentile(a, 10, 99)).toBe(10)
    expect(percentile(a, 0, 50)).toBe(0)
  })
  test('сводка: подвисание не тонет в среднем', () => {
    const f = new Float32Array(100).fill(16)
    f[10] = 100
    const s = summarize(f, 100)
    expect(s.median).toBe(16)
    expect(s.max).toBe(100)
    expect(s.over60).toBe(1)
    expect(s.over30).toBe(1)
    expect(s.avg).toBeGreaterThan(16)
  })
  test('пустой ввод', () => {
    expect(summarize(new Float32Array(4), 0).avg).toBe(0)
  })
})

describe('BenchRun', () => {
  test('проходит все этапы, отбрасывает кадры после смены и зовёт хуки', () => {
    const applied: string[] = []
    let done: readonly StageResult[] | null = null
    const run = new BenchRun(
      {
        applyStage: (s) => applied.push(s.id),
        sample: () => {},
        finished: (r) => (done = r),
      },
      createPerfSnapshot(),
    )
    let now = 1000
    run.start(now)
    expect(run.running).toBe(true)
    let guard = 0
    while (run.running && guard++ < 100000) {
      now += 10
      run.frame(now, 1)
    }
    expect(applied).toEqual(BENCH_STAGES.map((s) => s.id))
    expect(done).not.toBeNull()
    const res = done as unknown as StageResult[]
    expect(res.length).toBe(BENCH_STAGES.length)
    for (const r of res) {
      // кадры по 10 мс, дельты внутри этапа ровно 10, settle не в статистике
      expect(r.medianMs).toBeCloseTo(10, 3)
      expect(r.frames).toBeLessThanOrEqual(Math.ceil(BENCH_STAGE_MS / 10) + 1)
      expect(r.frames).toBeGreaterThan(BENCH_STAGE_MS / 10 - 3)
    }
    expect(BENCH_SETTLE_MS).toBeGreaterThan(0)
  })

  test('abort отдаёт частичный результат', () => {
    let reason = null as string | null
    const run = new BenchRun({ applyStage: () => {}, sample: () => {}, finished: (_r, a) => (reason = a) }, createPerfSnapshot())
    run.start(0)
    run.abort('test')
    expect(reason).toBe('test')
    expect(run.running).toBe(false)
  })
})

describe('formatBenchLog', () => {
  test('содержит видеокарту и строки этапов', () => {
    const env = { gpuRenderer: 'TEST GPU', gpuVendor: 'V', software: true, extensions: 'x' } as unknown as BenchEnv
    const r = { stage: BENCH_STAGES[0]!, frames: 3, avgMs: 1, medianMs: 1, p95Ms: 1, p99Ms: 1, minMs: 1, maxMs: 1, over60: 0, over30: 0, jsAvgMs: 1, jsP95Ms: 1, drawCalls: 5, triangles: 6, bufferW: 10, bufferH: 10, pixelRatio: 1, aaLabel: 'MSAA4 half' }
    const txt = formatBenchLog(env, [r], 'x')
    expect(txt).toContain('GPU: TEST GPU')
    expect(txt).toContain('WARNING: software')
    expect(txt).toContain('INCOMPLETE: x')
    expect(txt).toContain('as-is')
    expect(txt).toContain('[MSAA4 half]')
  })
})

describe('этапы бенчмарка', () => {
  test('id уникальны, есть кандидаты обхода и «среднее» без AA', () => {
    const ids = BENCH_STAGES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ['as-is', 'no-aa', 'aa4-8bit', 'aa4-nodepth', 'smaa', 'q-high', 'q-medium', 'q-low']) expect(ids).toContain(id)
    const smaa = BENCH_STAGES.find((s) => s.id === 'smaa')!
    expect(smaa.smaa).toBe(true)
    expect(smaa.msaa).toBe(0)
    const med = BENCH_STAGES.find((s) => s.id === 'q-medium')!
    expect([med.msaa, med.smaa, med.bloom, med.bloomScale, med.megapixelCap]).toEqual([0, true, true, 1, 0])
  })

  test('applyBenchStage выставляет все поля perf', () => {
    const saved = { ...perf }
    applyBenchStage(BENCH_STAGES.find((s) => s.id === 'aa4-8bit-nodepth')!)
    expect([perf.msaa, perf.aaByte, perf.aaDepthResolve, perf.smaa]).toEqual([4, true, false, false])
    applyBenchStage(BENCH_STAGES.find((s) => s.id === 'smaa')!)
    expect([perf.msaa, perf.aaByte, perf.aaDepthResolve, perf.smaa]).toEqual([0, false, true, true])
    Object.assign(perf, saved)
  })
})
