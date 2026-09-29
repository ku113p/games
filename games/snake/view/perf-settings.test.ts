import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { AA_PRESETS, applyQualityLevel, autoQuality, bufferMegapixels, classifyGpu, currentAa, currentAaPreset, isQualityId, perf, QUALITY_IDS, setAaPreset, type QualityConfig } from './perf-settings'

const cfg = configJson.quality as QualityConfig

describe('качество', () => {
  test('в config.json есть все ступени, «высокое» = прежняя картинка', () => {
    for (const id of QUALITY_IDS) expect(cfg.levels[id]).toBeDefined()
    expect(cfg.levels.high).toEqual({ megapixelCap: 0, msaa: 4, bloom: 'full' })
  })

  test('каждая следующая ступень не дороже предыдущей по всем трём величинам', () => {
    const cap = (v: number): number => (v === 0 ? Infinity : v)
    const bloomCost = { full: 2, half: 1, off: 0 } as const
    for (let i = 1; i < QUALITY_IDS.length; i++) {
      const a = cfg.levels[QUALITY_IDS[i - 1]!]
      const b = cfg.levels[QUALITY_IDS[i]!]
      expect(cap(b.megapixelCap)).toBeLessThanOrEqual(cap(a.megapixelCap))
      expect(b.msaa).toBeLessThanOrEqual(a.msaa)
      expect(bloomCost[b.bloom]).toBeLessThanOrEqual(bloomCost[a.bloom])
      // и хоть что-то дешевле (не косметика)
      expect(cap(b.megapixelCap) < cap(a.megapixelCap) || b.msaa < a.msaa || bloomCost[b.bloom] < bloomCost[a.bloom]).toBe(true)
    }
  })

  test('applyQualityLevel выставляет связку', () => {
    const saved = { ...perf }
    applyQualityLevel(cfg.levels.medium)
    expect([perf.megapixelCap, perf.msaa, perf.smaa, perf.bloom, perf.bloomScale]).toEqual([0, 0, true, true, 1])
    applyQualityLevel(cfg.levels.low)
    expect([perf.msaa, perf.bloom, perf.bloomScale]).toEqual([0, false, 1])
    applyQualityLevel(cfg.levels.high)
    expect([perf.megapixelCap, perf.msaa, perf.aaByte, perf.aaDepthResolve, perf.smaa, perf.bloom, perf.bloomScale]).toEqual([0, 4, false, true, false, true, 1])
    Object.assign(perf, saved)
  })

  test('размер буфера считается с потолком плотности 2', () => {
    expect(bufferMegapixels(1000, 1000, 1)).toBeCloseTo(1, 6)
    expect(bufferMegapixels(1000, 1000, 3)).toBeCloseTo(4, 6) // 3 -> 2
    expect(bufferMegapixels(1000, 1000, 0)).toBeCloseTo(1, 6)
  })

  test('«среднее» — полное разрешение и свечение, SMAA (замер на Intel: SMAA 8 промахов из 384, MSAA — затык через кадр)', () => {
    expect(cfg.levels.medium).toEqual({ megapixelCap: 0, msaa: 0, smaa: true, bloom: 'full' })
    // кандидаты обхода (8 бит, без resolve глубины) в ступени не берём: по замеру они не лечат затык, а 8 бит теряет гало сигналов
    for (const id of QUALITY_IDS) {
      expect(cfg.levels[id].aaByte ?? false).toBe(false)
      expect(cfg.levels[id].aaDepthResolve ?? true).toBe(true)
    }
  })

  test('сильная карта (телефон, дискретная): ступень по размеру буфера, «высокое» с MSAA остаётся умолчанием', () => {
    expect(autoQuality(bufferMegapixels(390, 844, 3), cfg, 'strong')).toBe('high') // телефон, ~1.3 МПикс
    expect(autoQuality(bufferMegapixels(1920, 1080, 1), cfg, 'strong')).toBe('high') // 1080p с дискретной
    expect(autoQuality(bufferMegapixels(2560, 1440, 1), cfg, 'strong')).toBe('medium') // 3.7
    expect(autoQuality(bufferMegapixels(3840, 2160, 1), cfg, 'strong')).toBe('low') // 8.3
  })

  test('слабая встроенная графика: без MSAA по умолчанию при любом размере буфера', () => {
    // окно дизайнера: 1897x998 при плотности 1.35 = 3.45 МПикс, Intel iGPU
    expect(autoQuality(bufferMegapixels(1897, 998, 1.35), cfg, 'weak')).toBe(cfg.autoWeakGpu)
    expect(autoQuality(bufferMegapixels(1280, 720, 1), cfg, 'weak')).toBe(cfg.autoWeakGpu) // и маленькое окно тоже
    expect(cfg.autoWeakGpu).toBe('medium')
    expect(cfg.levels[cfg.autoWeakGpu].msaa).toBe(0)
    expect(cfg.levels[cfg.autoWeakGpu].smaa).toBe(true)
    expect(autoQuality(bufferMegapixels(3840, 2160, 1), cfg, 'weak')).toBe('low')
  })

  test('программный рендер — «низкое»', () => {
    expect(autoQuality(0.5, cfg, 'software')).toBe('low')
  })

  test('классификация видеокарты по строке', () => {
    const c = (s: string) => classifyGpu(s, cfg)
    // строка из лога дизайнера
    expect(c('ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('weak')
    expect(c('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)')).toBe('weak')
    expect(c('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)')).toBe('strong')
    expect(c('ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)')).toBe('strong')
    expect(c('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0)')).toBe('weak') // встроенная Ryzen
    expect(c('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)')).toBe('strong')
    expect(c('Adreno (TM) 730')).toBe('strong')
    expect(c('Mali-G710')).toBe('strong')
    expect(c('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe('software')
    expect(c('')).toBe('unknown')
  })

  test('способы сглаживания: пресеты не повторяются, первый — штатный', () => {
    expect(AA_PRESETS[0]).toMatchObject({ samples: 4, byteTarget: false, resolveDepth: true, smaa: false })
    const keys = AA_PRESETS.map((p) => `${p.samples}/${p.byteTarget}/${p.resolveDepth}/${p.smaa}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const p of AA_PRESETS) if (p.smaa) expect(p.samples).toBe(0)
  })

  test('setAaPreset / currentAaPreset сходятся туда и обратно', () => {
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
