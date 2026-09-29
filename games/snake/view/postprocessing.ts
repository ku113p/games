// Постпроцессинг: bloom для неона + короткий глитч поверх доворота камеры.
// Создаётся ОДИН раз на renderer и переиспользуется между партиями
// (attach/detach сцены). Все пассы хранятся в полях и освобождаются в dispose():
// EffectComposer.dispose() трогает только свои таргеты и copyPass.

import { WebGLRenderer, WebGLRenderTarget, HalfFloatType, Scene, PerspectiveCamera, Vector2 } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
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

export class PostFx {
  private composer: EffectComposer
  private renderPass: RenderPass
  private bloomPass: UnrealBloomPass
  private glitchPass: GlitchPass
  private outputPass: OutputPass
  private glitchDurationMs: number
  private glitchElapsed = 0
  private glitchActive = false
  private msaaTarget: WebGLRenderTarget | null = null

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, config: Config, width: number, height: number) {
    this.glitchDurationMs = config.camera.glitchMs

    // Свой target с samples (тип как у штатного: HalfFloat, размер в физических px).
    // RenderPass пишет в readBuffer композера, поэтому MSAA нужен только ему: writeBuffer
    // (используется глитчем) остаётся без сэмплов, чтобы не платить памятью за два multisampled буфера.
    let target: WebGLRenderTarget | undefined
    if (MSAA_SAMPLES > 0) {
      const pr = renderer.getPixelRatio()
      target = new WebGLRenderTarget(Math.max(1, Math.floor(width * pr)), Math.max(1, Math.floor(height * pr)), {
        type: HalfFloatType,
        samples: MSAA_SAMPLES,
      })
    }
    this.composer = new EffectComposer(renderer, target)
    if (MSAA_SAMPLES > 0) {
      this.msaaTarget = this.composer.readBuffer
      this.composer.writeBuffer.samples = 0
    }
    this.renderPass = new RenderPass(scene, camera)
    this.composer.addPass(this.renderPass)

    this.bloomPass = new UnrealBloomPass(new Vector2(width, height), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD)
    this.composer.addPass(this.bloomPass)

    this.glitchPass = new GlitchPass()
    this.glitchPass.goWild = true
    this.glitchPass.enabled = false
    this.composer.addPass(this.glitchPass)

    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)

    this.composer.setSize(width, height)
  }

  /** Холодный путь: новая партия — новая сцена/камера/конфиг на тех же пассах. */
  attach(scene: Scene, camera: PerspectiveCamera, config: Config): void {
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
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
  }

  /** Вызывается из render() в кадре, где начался доворот камеры; сама не аллоцирует. */
  triggerGlitch(): void {
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
    this.renderPass.dispose()
    this.bloomPass.dispose()
    this.glitchPass.dispose()
    this.outputPass.dispose()
    this.composer.dispose()
  }
}
