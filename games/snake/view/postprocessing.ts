// Постпроцессинг: bloom для неона + короткий глитч поверх доворота камеры.
// Создаётся ОДИН раз на renderer и переиспользуется между партиями
// (attach/detach сцены). Все пассы хранятся в полях и освобождаются в dispose():
// EffectComposer.dispose() трогает только свои таргеты и copyPass.

import { WebGLRenderer, WebGLRenderTarget, HalfFloatType, UnsignedByteType, SRGBColorSpace, Scene, PerspectiveCamera, Vector2 } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { Config } from '../core/rules'
import { BLOOM_RADIUS, BLOOM_STRENGTH, BLOOM_THRESHOLD } from './palette'

// Дизайнер дважды сказал, что гало сильное, а контурный стиль даёт много тонких
// светящихся линий, поэтому свечение снижено с запасом: слабое, узкое, порог
// выше яркости сетки/препятствий/чётных сегментов. Заметно светятся только
// голова, яблоко и яркие рёбра змейки.
// Параметры bloom (сила, радиус, порог) — оформительские, не балансовые числа: см. palette.ts.

// Сглаживание геометрии. Штатный antialias: true у WebGLRenderer сглаживает только дефолтный
// фреймбуфер (канвас), а весь кадр рисуется в render target композера, поэтому без своего
// multisampled target тонкие рёбра и линии рвутся лесенкой. Число сэмплов MSAA (WebGL2):
// 4 — обычно, 0 — выключить сглаживание целиком (композер вернётся к обычному target'у без samples).
export const MSAA_SAMPLES = 4

/**
 * Способ сглаживания (холодный путь, задаётся из perf-settings). Замеры на встроенной графике Intel (ANGLE/D3D11) показали, что
 * MSAA в HalfFloat-цели даёт затык через кадр независимо от числа сэмплов и пикселей, поэтому способов несколько.
 * - samples: число сэмплов MSAA (0 — MSAA нет).
 * - byteTarget: цель 8 бит (RGBA8, аппаратный sRGB) вместо HalfFloat: свет выше 1.0 обрезается (см. отчёт).
 * - resolveDepth: разрешать (blit) multisampled глубину; по умолчанию three делает это, хотя ничто её не читает.
 * - smaa: постобработочное сглаживание SMAA (после OutputPass, в sRGB); MSAA при этом не используется.
 */
export interface AaSettings {
  samples: number
  byteTarget: boolean
  resolveDepth: boolean
  smaa: boolean
}

export class PostFx {
  private composer!: EffectComposer
  private renderPass!: RenderPass
  private bloomPass!: UnrealBloomPass
  private glitchPass!: GlitchPass
  private outputPass!: OutputPass
  private glitchDurationMs: number
  private glitchElapsed = 0
  private glitchActive = false
  private msaaTarget: WebGLRenderTarget | null = null
  private aa: AaSettings
  private smaaPass: SMAAPass | null = null
  // prefers-reduced-motion: как и анимации в index.html, глитч при включённой настройке не играется. Список медиазапроса
  // живой: matches всегда актуален, а слушатель гасит уже идущий глитч, если настройку включили посреди него.
  private readonly reducedMotion: MediaQueryList | null =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  private readonly onReducedMotionChange = (): void => {
    if (this.reducedMotion?.matches) {
      this.glitchActive = false
      this.glitchPass.enabled = false
    }
  }
  private bloomOn = true
  private bloomScale = 1
  private scene: Scene
  private camera: PerspectiveCamera
  private width: number
  private height: number
  private pixelRatio: number

  constructor(
    private renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    config: Config,
    width: number,
    height: number,
    aa: AaSettings = { samples: MSAA_SAMPLES, byteTarget: false, resolveDepth: true, smaa: false },
  ) {
    this.glitchDurationMs = config.camera.glitchMs
    this.scene = scene
    this.camera = camera
    this.width = width
    this.height = height
    this.pixelRatio = renderer.getPixelRatio()
    this.aa = { ...aa }
    this.build()
    this.reducedMotion?.addEventListener('change', this.onReducedMotionChange)
  }

  /** Холодный путь: собрать композер и пассы под текущие msaa/размер/сцену. Вызывается из конструктора и setMsaa. */
  private build(): void {
    const renderer = this.renderer
    // Свой target с samples (тип по умолчанию как у штатного: HalfFloat, размер в физических px).
    // RenderPass пишет в readBuffer композера, поэтому MSAA нужен только ему: writeBuffer
    // (используется глитчем) остаётся без сэмплов, чтобы не платить памятью за два multisampled буфера.
    let target: WebGLRenderTarget | undefined
    this.msaaTarget = null
    const samples = this.aa.smaa ? 0 : this.aa.samples
    if (samples > 0) {
      const pr = this.pixelRatio
      target = new WebGLRenderTarget(Math.max(1, Math.floor(this.width * pr)), Math.max(1, Math.floor(this.height * pr)), {
        type: this.aa.byteTarget ? UnsignedByteType : HalfFloatType,
        // 8 бит линейно дали бы полосы в тёмных градиентах тумана: sRGB-хранение (SRGB8_ALPHA8) даёт точность там, где глаз чувствителен.
        colorSpace: this.aa.byteTarget ? SRGBColorSpace : undefined,
        samples,
        resolveDepthBuffer: this.aa.resolveDepth,
        // Глубина после кадра никому не нужна: без resolve её и хранить незачем (три инвалидирует буфер, тайловым GPU это на руку).
        storeMultisampledDepthBuffer: this.aa.resolveDepth,
      })
    }
    this.composer = new EffectComposer(renderer, target)
    if (samples > 0) {
      this.msaaTarget = this.composer.readBuffer
      this.composer.writeBuffer.samples = 0
    }
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    this.bloomPass = new UnrealBloomPass(new Vector2(this.width, this.height), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD)
    this.bloomPass.enabled = this.bloomOn
    this.composer.addPass(this.bloomPass)

    this.glitchPass = new GlitchPass()
    this.glitchPass.goWild = true
    this.glitchPass.enabled = false
    this.glitchActive = false
    this.composer.addPass(this.glitchPass)

    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)

    // SMAA после OutputPass: работает в sRGB (как задумано в алгоритме), последним пассом сразу пишет на экран.
    this.smaaPass = null
    if (this.aa.smaa) {
      this.smaaPass = new SMAAPass()
      this.composer.addPass(this.smaaPass)
    }

    this.composer.setPixelRatio(this.pixelRatio)
    this.composer.setSize(this.width, this.height)
    this.applyBloomSize()
  }

  /**
   * Свечение в доле разрешения буфера: composer.setSize задаёт всем пассам полный размер, поэтому после него
   * свечению ставится свой. 1 — как всегда (ничего не трогаем, чтобы «высокое» осталось прежним).
   */
  private applyBloomSize(): void {
    if (this.bloomScale === 1) return
    const k = this.pixelRatio * this.bloomScale
    this.bloomPass.setSize(Math.max(2, Math.floor(this.width * k)), Math.max(2, Math.floor(this.height * k)))
  }

  private teardown(): void {
    this.renderPass.dispose()
    this.bloomPass.dispose()
    this.glitchPass.dispose()
    this.outputPass.dispose()
    this.smaaPass?.dispose()
    this.composer.dispose()
  }

  /** Холодный путь (меню качества, перф-панель, бенчмарк): сменить способ сглаживания, пересоздав композер. */
  setAa(aa: AaSettings): void {
    const a = this.aa
    if (a.samples === aa.samples && a.byteTarget === aa.byteTarget && a.resolveDepth === aa.resolveDepth && a.smaa === aa.smaa) return
    this.aa = { ...aa }
    this.teardown()
    this.build()
  }

  /** Что реально включено сейчас (для лога бенчмарка: подпись этапа не должна зависеть от того, что «хотели»). */
  aaLabel(): string {
    const a = this.aa
    if (a.smaa) return 'SMAA'
    if (a.samples <= 0) return 'off'
    return `MSAA${a.samples} ${a.byteTarget ? '8bit' : 'half'}${a.resolveDepth ? '' : ' nodepthresolve'}`
  }

  /** Качество «среднее»: свечение в половинном разрешении (0.5); 1 — полное. Холодный путь. */
  setBloomScale(scale: number): void {
    if (scale === this.bloomScale) return
    this.bloomScale = scale
    // Возврат к 1 требует полного размера, а setSize свечения зовётся только при resize: переставляем сразу.
    this.composer.setSize(this.width, this.height)
    this.applyBloomSize()
  }

  /** Отладка: включить/выключить bloom (выключенный пасс композер пропускает целиком). */
  setBloom(on: boolean): void {
    this.bloomOn = on
    this.bloomPass.enabled = on
  }

  /** Холодный путь: новая партия — новая сцена/камера/конфиг на тех же пассах. */
  attach(scene: Scene, camera: PerspectiveCamera, config: Config): void {
    this.scene = scene
    this.camera = camera
    this.renderPass.scene = scene
    this.renderPass.camera = camera
    this.glitchDurationMs = config.camera.glitchMs
    this.glitchActive = false
    this.glitchPass.enabled = false
  }

  /** Холодный путь: отцепить сцену (её уже уничтожили), не держим ссылки. */
  detach(): void {
    this.glitchActive = false
    this.glitchPass.enabled = false
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width
    this.height = height
    this.pixelRatio = pixelRatio
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    this.applyBloomSize()
  }

  /** Вызывается из render() в кадре, где начался доворот камеры; сама не аллоцирует. */
  triggerGlitch(): void {
    if (this.reducedMotion?.matches) return // доворот камеры и микропауза остаются, гасится только шум
    this.glitchActive = true
    this.glitchElapsed = 0
    this.glitchPass.enabled = true
  }

  /** Кадр: без аллокаций. */
  render(dtMs: number): void {
    if (this.glitchActive) {
      this.glitchElapsed += dtMs
      if (this.glitchElapsed >= this.glitchDurationMs) {
        this.glitchActive = false
        this.glitchPass.enabled = false
      }
    }
    this.composer.render(dtMs / 1000)
    // Глитч меняет буферы местами (нечётное число swap'ов): возвращаем multisampled в readBuffer,
    // иначе на следующем кадре RenderPass рисовал бы в несглаженный.
    if (this.msaaTarget && this.composer.readBuffer !== this.msaaTarget) this.composer.swapBuffers()
  }

  dispose(): void {
    this.reducedMotion?.removeEventListener('change', this.onReducedMotionChange)
    this.teardown()
  }
}
