// Debug performance settings (performance panel, view/perf-panel.ts).
// They live at module level: they survive a game restart but not a page reload (no need to persist them).
// Defaults = the game's earlier behavior, so with the panel closed nothing changes.

import type { AaSettings } from './postprocessing'

/**
 * Antialiasing methods for the panel and benchmark (the first = the game's default). They cost differently on different hardware:
 * on Intel integrated graphics (ANGLE/D3D11) MSAA in a HalfFloat target stalls every other frame (designer's measurement), so
 * workaround candidates sit alongside: an 8-bit target, MSAA without depth resolve, post-processing SMAA.
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
/** Steps of the render buffer megapixel cap (0 means no cap, as in the default game). */
export const MEGAPIXEL_STEPS: readonly number[] = [0, 4, 2.5, 1.5]

/** Upper bound of the pixel density multiplier (protects weak phones from fillrate overuse). */
export const MAX_PIXEL_RATIO = 2

export interface PerfSettings {
  /** Number of MSAA samples (0 for none). The other fields of the method are below; setAaPreset/applyQualityLevel set them all together. */
  msaa: number
  /** 8-bit (sRGB) MSAA target instead of HalfFloat. */
  aaByte: boolean
  /** Allow multisampled depth resolve (three allows it by default). */
  aaDepthResolve: boolean
  /** Post-processing SMAA instead of MSAA. */
  smaa: boolean
  bloom: boolean
  /** Bloom resolution relative to the frame buffer: 1 is full, 0.5 is half (cheaper, halo wider and softer). */
  bloomScale: number
  megapixelCap: number
  fog: boolean
  miniMap: boolean
  /** Panel is open: enables the manual renderer.info reset (otherwise it would count only the last pass). */
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

/** Preallocated metrics snapshot; filled by View.readPerf and main.ts, read by the panel. */
export interface PerfSnapshot {
  drawCalls: number
  triangles: number
  bufferW: number
  bufferH: number
  pixelRatio: number
  devicePixelRatio: number
  arena: number
  snakeLength: number
  /** What is actually enabled in the composer (label for the benchmark log). */
  aaLabel: string
  /** Bottom edge of the minimap in CSS px from the top of the window (so the panel does not cover the map). */
  miniMapBottomPx: number
}

export function createPerfSnapshot(): PerfSnapshot {
  return { drawCalls: 0, triangles: 0, bufferW: 0, bufferH: 0, pixelRatio: 1, devicePixelRatio: 1, arena: 0, snakeLength: 0, aaLabel: '', miniMapBottomPx: 0 }
}

// --- Quality for the player (menu and pause): a bundle of MPix cap, antialiasing and bloom. The numbers are in config.json (quality). ---

export type QualityId = 'high' | 'medium' | 'low'
export const QUALITY_IDS: readonly QualityId[] = ['high', 'medium', 'low']

export interface QualityLevel {
  megapixelCap: number
  msaa: number
  /** Optional refinements of the antialiasing method; if unset, same as "high": HalfFloat target, depth is resolved, no SMAA. */
  aaByte?: boolean
  aaDepthResolve?: boolean
  smaa?: boolean
  bloom: 'full' | 'half' | 'off'
}

export interface QualityConfig {
  autoMediumFromMegapixels: number
  autoLowFromMegapixels: number
  /** Default level on weak/unrecognized desktop graphics: MSAA there is an option, not the default (see autoQuality). */
  autoWeakGpu: QualityId
  /** Regex (case-insensitive) over the GPU string: what counts as a strong GPU on which MSAA stays the default. */
  strongGpuPattern: string
  levels: Record<QualityId, QualityLevel>
}

export function isQualityId(v: unknown): v is QualityId {
  return v === 'high' || v === 'medium' || v === 'low'
}

/** Sets perf from a quality level (cold path; applying it to the renderer is View.applyPerf). */
export function applyQualityLevel(level: QualityLevel): void {
  perf.megapixelCap = level.megapixelCap
  perf.msaa = level.msaa
  perf.aaByte = level.aaByte ?? false
  perf.aaDepthResolve = level.aaDepthResolve ?? true
  perf.smaa = level.smaa ?? false
  perf.bloom = level.bloom !== 'off'
  perf.bloomScale = level.bloom === 'half' ? 0.5 : 1
}

/** Frame buffer size at "high", MPix: the window in CSS px times the density multiplier (capped at MAX_PIXEL_RATIO). */
export function bufferMegapixels(cssW: number, cssH: number, devicePixelRatio: number): number {
  const pr = Math.min(devicePixelRatio > 0 ? devicePixelRatio : 1, MAX_PIXEL_RATIO)
  return (cssW * pr * cssH * pr) / 1e6
}

/** Sets the antialiasing method as a whole (panel, benchmark). Cold path. */
export function setAaPreset(p: AaSettings): void {
  perf.msaa = p.samples
  perf.aaByte = p.byteTarget
  perf.aaDepthResolve = p.resolveDepth
  perf.smaa = p.smaa
}

/** Current antialiasing as composer settings (cold path; allocates an object). */
export function currentAa(): AaSettings {
  return { samples: perf.smaa ? 0 : perf.msaa, byteTarget: perf.aaByte, resolveDepth: perf.aaDepthResolve, smaa: perf.smaa }
}

/** The panel preset matching the current settings; null means a combination not in the list. */
export function currentAaPreset(): AaPreset | null {
  for (const p of AA_PRESETS) {
    if (p.smaa === perf.smaa && p.samples === (perf.smaa ? 0 : perf.msaa) && p.byteTarget === perf.aaByte && p.resolveDepth === perf.aaDepthResolve) return p
  }
  return null
}

/** GPU class for choosing the default level. */
export type GpuClass = 'strong' | 'weak' | 'software' | 'unknown'

const SOFTWARE_GPU_RE = /swiftshader|llvmpipe|software|softpipe|microsoft basic render|basic render driver/i

/**
 * Class from the GPU string (WEBGL_debug_renderer_info). A pure function (tested).
 * strong: discrete and mobile GPUs where MSAA is known to be cheap: the `cfg.strongGpuPattern` pattern.
 * weak: anything recognized as Intel/AMD/other integrated graphics that did not match strong (measured: Intel Xe/Arc iGPU on D3D11 stalls every other frame with MSAA).
 * unknown: no string (the browser hid it): the pointer type decides.
 */
export function classifyGpu(renderer: string, cfg: QualityConfig): GpuClass {
  if (renderer === '') return 'unknown'
  if (SOFTWARE_GPU_RE.test(renderer)) return 'software'
  if (new RegExp(cfg.strongGpuPattern, 'i').test(renderer)) return 'strong'
  return 'weak'
}

let gpuRendererCache: string | null = null

/** GPU string via a temporary WebGL context (cold path, once; '' means it failed/hidden). */
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

/** Whether the device's primary pointer is a mouse/touchpad (desktop, laptop). A phone and tablet have a coarse pointer (touch). */
export function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: fine)').matches
}

/** Default class for the current device: the GPU string, and if hidden, the pointer type (touch = tile-based mobile GPU). */
export function detectGpuClass(cfg: QualityConfig): GpuClass {
  const g = classifyGpu(readGpuRendererString(), cfg)
  if (g === 'unknown') return hasFinePointer() ? 'weak' : 'strong'
  return g
}

/**
 * Default level until the player picks anything. Principle: do not silently hand multisampling to weak hardware, but do not
 * silently take it from strong hardware either. The player can pick any level in the menu (the choice is remembered), so the default must be safe.
 * Measured on Intel integrated graphics (Windows, D3D11): MSAA stalls every other frame at any sample count and any
 * buffer size, while without MSAA the same buffer holds 60 fps. Buffer size does not predict this, so the GPU class comes first:
 * - buffer from `autoLowFromMegapixels` up or a software renderer: "low" (fillrate);
 * - strong (discrete NVIDIA/AMD RX, Apple, mobile Adreno/Mali/PowerVR): the earlier rule by buffer size
 *   ("high" with MSAA, on a large buffer "medium");
 * - weak (integrated graphics, the card not recognized as strong, a hidden string on desktop): `cfg.autoWeakGpu` ("medium" = full resolution
 *   and bloom, no MSAA).
 */
export function autoQuality(megapixels: number, cfg: QualityConfig, gpu: GpuClass = detectGpuClass(cfg)): QualityId {
  if (megapixels >= cfg.autoLowFromMegapixels || gpu === 'software') return 'low'
  if (gpu === 'weak') return cfg.autoWeakGpu
  if (megapixels >= cfg.autoMediumFromMegapixels) return 'medium'
  return 'high'
}

// Debug from the console (only with ?perf in the URL): window.__perf.msaa = 0 etc. before the panel's applyPerf; for screenshots of the levels.
if (typeof location !== 'undefined' && /[?&]perf\b/.test(location.search)) (globalThis as Record<string, unknown>)['__perf'] = perf
