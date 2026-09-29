// Постпроцессинг: bloom для неона + короткий глитч поверх доворота камеры.
// Создаётся ОДИН раз на renderer и переиспользуется между партиями
// (attach/detach сцены). Все пассы хранятся в полях и освобождаются в dispose():
// EffectComposer.dispose() трогает только свои таргеты и copyPass.

import { WebGLRenderer, Scene, PerspectiveCamera, Vector2 } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { Config } from '../core/rules'
import { BLOOM_STRENGTH, BLOOM_THRESHOLD } from './palette'

// Дизайнер дважды сказал, что гало сильное, а контурный стиль даёт много тонких
// светящихся линий, поэтому свечение снижено с запасом: слабое, узкое, порог
// выше яркости сетки/препятствий/чётных сегментов. Заметно светятся только
// голова, яблоко и яркие рёбра змейки.
// Параметры bloom — оформительские (форма свечения), не балансовые числа.
const BLOOM_RADIUS = 0.2

export class PostFx {
  private composer: EffectComposer
  private renderPass: RenderPass
  private bloomPass: UnrealBloomPass
  private glitchPass: GlitchPass
  private outputPass: OutputPass
  private glitchDurationMs: number
  private glitchElapsed = 0
  private glitchActive = false

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, config: Config, width: number, height: number) {
    this.glitchDurationMs = config.camera.glitchMs

    this.composer = new EffectComposer(renderer)
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

  resize(width: number, height: number): void {
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
  }

  dispose(): void {
    this.renderPass.dispose()
    this.bloomPass.dispose()
    this.glitchPass.dispose()
    this.outputPass.dispose()
    this.composer.dispose()
  }
}
