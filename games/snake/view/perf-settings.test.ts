import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { applyQualityLevel, autoQuality, bufferMegapixels, isQualityId, perf, QUALITY_IDS, type QualityConfig } from './perf-settings'

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
    expect([perf.megapixelCap, perf.msaa, perf.bloom, perf.bloomScale]).toEqual([2.5, 2, true, 0.5])
    applyQualityLevel(cfg.levels.low)
    expect([perf.msaa, perf.bloom, perf.bloomScale]).toEqual([0, false, 1])
    applyQualityLevel(cfg.levels.high)
    expect([perf.megapixelCap, perf.msaa, perf.bloom, perf.bloomScale]).toEqual([0, 4, true, 1])
    Object.assign(perf, saved)
  })

  test('размер буфера считается с потолком плотности 2', () => {
    expect(bufferMegapixels(1000, 1000, 1)).toBeCloseTo(1, 6)
    expect(bufferMegapixels(1000, 1000, 3)).toBeCloseTo(4, 6) // 3 -> 2
    expect(bufferMegapixels(1000, 1000, 0)).toBeCloseTo(1, 6)
  })

  test('ступень по умолчанию решает размер буфера, а не тип устройства', () => {
    expect(autoQuality(bufferMegapixels(390, 844, 3), cfg)).toBe('high') // телефон, ~1.3 МПикс
    expect(autoQuality(bufferMegapixels(1920, 1080, 1), cfg)).toBe('high') // 1080p, ~2.1
    expect(autoQuality(bufferMegapixels(2560, 1440, 1), cfg)).toBe('medium') // 3.7
    expect(autoQuality(bufferMegapixels(1440, 900, 2), cfg)).toBe('medium') // ретина, 5.2
    expect(autoQuality(bufferMegapixels(3840, 2160, 1), cfg)).toBe('low') // 4K, 8.3
    // планшет с большим экраном и плотностью — тоже по пикселям
    expect(autoQuality(bufferMegapixels(1024, 1366, 2), cfg)).toBe('medium') // 5.6
  })

  test('isQualityId', () => {
    expect(isQualityId('high')).toBe(true)
    expect(isQualityId('ultra')).toBe(false)
    expect(isQualityId(null)).toBe(false)
  })
})
