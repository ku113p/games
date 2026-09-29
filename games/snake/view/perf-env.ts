// Окружение для лога бенчмарка: видеокарта (незамаскированный рендерер), версия WebGL, расширения,
// браузер, окно. Холодный путь: вызывается один раз в конце прогона, объекты и строки создаются свободно.

import type { BenchEnv } from './perf-bench'

/** Расширения, важные для этой игры (MSAA/bloom в HalfFloat, таймеры, компиляция шейдеров). */
const EXTENSIONS_OF_INTEREST = [
  'EXT_color_buffer_float',
  'EXT_color_buffer_half_float',
  'OES_texture_float_linear',
  'OES_texture_half_float_linear',
  'EXT_disjoint_timer_query_webgl2',
  'KHR_parallel_shader_compile',
  'WEBGL_debug_renderer_info',
]

/** Признаки программного растеризатора в имени рендерера. */
const SOFTWARE_RE = /swiftshader|llvmpipe|software|softpipe|microsoft basic render|basic render driver/i

export interface GpuInfo {
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
}

export function readGpuInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): GpuInfo {
  const isGl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const glRenderer = String(gl.getParameter(gl.RENDERER))
  const gpuRenderer = dbg !== null ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : `(unmasked unavailable) ${glRenderer}`
  const gpuVendor = dbg !== null ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR))
  const supported = gl.getSupportedExtensions() ?? []
  const present: string[] = []
  for (const name of EXTENSIONS_OF_INTEREST) present.push(`${name}=${supported.includes(name) ? 'yes' : 'no'}`)
  return {
    gpuRenderer,
    gpuVendor,
    glRenderer,
    glVersion: String(gl.getParameter(gl.VERSION)),
    shadingLanguage: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
    webglVersion: isGl2 ? 2 : 1,
    maxSamples: isGl2 ? Number((gl as WebGL2RenderingContext).getParameter((gl as WebGL2RenderingContext).MAX_SAMPLES)) : 0,
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    extensions: present.join(' '),
    software: SOFTWARE_RE.test(gpuRenderer) || SOFTWARE_RE.test(glRenderer),
  }
}

export interface GameFacts {
  arena: number
  snakeLength: number
  mode: string
  seed: number
  language: string
  quality: string
}

export function collectBenchEnv(gpu: GpuInfo, game: GameFacts): BenchEnv {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    startedAt: new Date().toISOString(),
    ...gpu,
    userAgent: nav.userAgent,
    platform: nav.platform,
    cores: nav.hardwareConcurrency || 0,
    memoryGb: nav.deviceMemory ?? 0,
    windowW: window.innerWidth,
    windowH: window.innerHeight,
    screenW: screen.width,
    screenH: screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    ...game,
  }
}
