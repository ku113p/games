import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { AA_PRESETS, applyQualityLevel, autoQuality, bufferMegapixels, classifyGpu, currentAa, currentAaPreset, isQualityId, perf, QUALITY_IDS, setAaPreset, type QualityConfig } from './perf-settings'

const cfg = configJson.quality as QualityConfig

describe('quality', () => {
  test('config.json has all levels, "high" = the earlier picture', () => {
    for (const id of QUALITY_IDS) expect(cfg.levels[id]).toBeDefined()
    expect(cfg.levels.high).toEqual({ megapixelCap: 0, msaa: 4, bloom: 'full' })
  })

  test('each next level is no more expensive than the previous one on all three values', () => {
    const cap = (v: number): number => (v === 0 ? Infinity : v)
    const bloomCost = { full: 2, half: 1, off: 0 } as const
    for (let i = 1; i < QUALITY_IDS.length; i++) {
      const a = cfg.levels[QUALITY_IDS[i - 1]!]
      const b = cfg.levels[QUALITY_IDS[i]!]
      expect(cap(b.megapixelCap)).toBeLessThanOrEqual(cap(a.megapixelCap))
      expect(b.msaa).toBeLessThanOrEqual(a.msaa)
      expect(bloomCost[b.bloom]).toBeLessThanOrEqual(bloomCost[a.bloom])
      // and at least something is cheaper (not cosmetic)
      expect(cap(b.megapixelCap) < cap(a.megapixelCap) || b.msaa < a.msaa || bloomCost[b.bloom] < bloomCost[a.bloom]).toBe(true)
    }
  })

  test('applyQualityLevel sets the bundle', () => {
    const saved = { ...perf }
    applyQualityLevel(cfg.levels.medium)
    expect([perf.megapixelCap, perf.msaa, perf.smaa, perf.bloom, perf.bloomScale]).toEqual([0, 0, true, true, 1])
    applyQualityLevel(cfg.levels.low)
    expect([perf.msaa, perf.bloom, perf.bloomScale]).toEqual([0, false, 1])
    applyQualityLevel(cfg.levels.high)
    expect([perf.megapixelCap, perf.msaa, perf.aaByte, perf.aaDepthResolve, perf.smaa, perf.bloom, perf.bloomScale]).toEqual([0, 4, false, true, false, true, 1])
    Object.assign(perf, saved)
  })

  test('buffer size is computed with a density cap of 2', () => {
    expect(bufferMegapixels(1000, 1000, 1)).toBeCloseTo(1, 6)
    expect(bufferMegapixels(1000, 1000, 3)).toBeCloseTo(4, 6) // 3 -> 2
    expect(bufferMegapixels(1000, 1000, 0)).toBeCloseTo(1, 6)
  })

  test('"medium" is full resolution and bloom, SMAA (Intel measurement: SMAA 8 misses out of 384, MSAA stalls every other frame)', () => {
    expect(cfg.levels.medium).toEqual({ megapixelCap: 0, msaa: 0, smaa: true, bloom: 'full' })
    // workaround candidates (8-bit, no depth resolve) are not taken as levels: by measurement they do not cure the stall, and 8-bit loses the signal halo
    for (const id of QUALITY_IDS) {
      expect(cfg.levels[id].aaByte ?? false).toBe(false)
      expect(cfg.levels[id].aaDepthResolve ?? true).toBe(true)
    }
  })

  test('strong GPU (phone, discrete): level by buffer size, "high" with MSAA stays the default', () => {
    expect(autoQuality(bufferMegapixels(390, 844, 3), cfg, 'strong')).toBe('high') // phone, ~1.3 MPix
    expect(autoQuality(bufferMegapixels(1920, 1080, 1), cfg, 'strong')).toBe('high') // 1080p with a discrete GPU
    expect(autoQuality(bufferMegapixels(2560, 1440, 1), cfg, 'strong')).toBe('medium') // 3.7
    expect(autoQuality(bufferMegapixels(3840, 2160, 1), cfg, 'strong')).toBe('low') // 8.3
  })

  test('weak integrated graphics: no MSAA by default at any buffer size', () => {
    // designer's window: 1897x998 at density 1.35 = 3.45 MPix, Intel iGPU
    expect(autoQuality(bufferMegapixels(1897, 998, 1.35), cfg, 'weak')).toBe(cfg.autoWeakGpu)
    expect(autoQuality(bufferMegapixels(1280, 720, 1), cfg, 'weak')).toBe(cfg.autoWeakGpu) // and a small window too
    expect(cfg.autoWeakGpu).toBe('medium')
    expect(cfg.levels[cfg.autoWeakGpu].msaa).toBe(0)
    expect(cfg.levels[cfg.autoWeakGpu].smaa).toBe(true)
    expect(autoQuality(bufferMegapixels(3840, 2160, 1), cfg, 'weak')).toBe('low')
  })

  test('software renderer is "low"', () => {
    expect(autoQuality(0.5, cfg, 'software')).toBe('low')
  })

  test('GPU classification by string', () => {
    const c = (s: string) => classifyGpu(s, cfg)
    // string from the designer's log
    expect(c('ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('weak')
    expect(c('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)')).toBe('weak')
    expect(c('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)')).toBe('strong')
    expect(c('ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)')).toBe('strong')
    expect(c('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0)')).toBe('weak') // integrated Ryzen
    expect(c('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)')).toBe('strong')
    expect(c('Adreno (TM) 730')).toBe('strong')
    expect(c('Mali-G710')).toBe('strong')
    expect(c('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe('software')
    expect(c('')).toBe('unknown')
  })

  test('antialiasing methods: presets do not repeat, the first is the default', () => {
    expect(AA_PRESETS[0]).toMatchObject({ samples: 4, byteTarget: false, resolveDepth: true, smaa: false })
    const keys = AA_PRESETS.map((p) => `${p.samples}/${p.byteTarget}/${p.resolveDepth}/${p.smaa}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const p of AA_PRESETS) if (p.smaa) expect(p.samples).toBe(0)
  })

  test('setAaPreset / currentAaPreset round-trip', () => {
    const saved = { ...perf }
    for (const p of AA_PRESETS) {
      setAaPreset(p)
      expect(currentAaPreset()).toBe(p)
      expect(currentAa()).toEqual({ samples: p.samples, byteTarget: p.byteTarget, resolveDepth: p.resolveDepth, smaa: p.smaa })
    }
    Object.assign(perf, saved)
  })

  test('isQualityId', () => {
    expect(isQualityId('high')).toBe(true)
    expect(isQualityId('ultra')).toBe(false)
    expect(isQualityId(null)).toBe(false)
  })
})
