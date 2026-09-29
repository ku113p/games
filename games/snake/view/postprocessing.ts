// Post-processing: bloom for the neon look + a short glitch on top of the camera roll.
// Created ONCE per renderer and reused between games
// (attach/detach of the scene). All passes are kept in fields and released in dispose():
// EffectComposer.dispose() only touches its own targets and copyPass.

import { WebGLRenderer, WebGLRenderTarget, HalfFloatType, UnsignedByteType, SRGBColorSpace, Scene, PerspectiveCamera, Vector2 } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { Config } from '../core/rules'
import { BLOOM_RADIUS, BLOOM_STRENGTH, BLOOM_THRESHOLD } from './palette'

// The designer said more than once that the halo was too strong (palette.ts keeps the history of the
// values), and the outline style produces many thin glowing lines, so the bloom is kept weak (low
// strength) and the threshold sits above the luminance of the grid/obstacles/even segments. Only the
// head, the apple and the bright snake edges visibly glow.
// The bloom parameters (strength, radius, threshold) are styling, not balance numbers: see palette.ts.

// Geometry antialiasing. The stock antialias: true of WebGLRenderer only smooths the default
// framebuffer (the canvas), but the whole frame is drawn into the composer's render target, so without our own
// multisampled target thin edges and lines come out jagged. MSAA sample count (WebGL2):
// 4 is the usual value, 0 turns antialiasing off entirely (the composer falls back to a regular target without samples).
export const MSAA_SAMPLES = 4

/**
 * Antialiasing method (cold path, set from perf-settings). Measurements on Intel integrated graphics (ANGLE/D3D11) showed that
 * MSAA in a HalfFloat target causes a hitch every other frame regardless of the sample count and pixel count, hence several methods.
 * - samples: MSAA sample count (0 means no MSAA).
 * - byteTarget: an 8-bit target (RGBA8, hardware sRGB) instead of HalfFloat: light above 1.0 is clipped, so the HDR glow colors lose their overshoot. Only an experiment (perf panel, benchmark): no quality tier uses it.
 * - resolveDepth: resolve (blit) the multisampled depth; three does this by default even though nothing reads it.
 * - smaa: SMAA post-process antialiasing (after OutputPass, in sRGB); MSAA is not used with it.
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
  // prefers-reduced-motion: like the animations in index.html, the glitch is not played when the setting is on. The media query list
  // is live: matches is always current, and the listener stops a glitch already in progress if the setting is turned on in the middle of it.
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

  /** Cold path: build the composer and passes for the current msaa/size/scene. Called from the constructor and setAa. */
  private build(): void {
    const renderer = this.renderer
    // Our own target with samples (default type same as the stock one: HalfFloat, size in physical px).
    // RenderPass writes into the composer's readBuffer, so only that one needs MSAA: writeBuffer
    // (used by the glitch) stays without samples, so we do not pay memory for two multisampled buffers.
    let target: WebGLRenderTarget | undefined
    this.msaaTarget = null
    const samples = this.aa.smaa ? 0 : this.aa.samples
    if (samples > 0) {
      const pr = this.pixelRatio
      target = new WebGLRenderTarget(Math.max(1, Math.floor(this.width * pr)), Math.max(1, Math.floor(this.height * pr)), {
        type: this.aa.byteTarget ? UnsignedByteType : HalfFloatType,
        // 8 bits linear would band in the dark fog gradients: sRGB storage (SRGB8_ALPHA8) gives precision where the eye is sensitive.
        colorSpace: this.aa.byteTarget ? SRGBColorSpace : undefined,
        samples,
        resolveDepthBuffer: this.aa.resolveDepth,
        // Nobody needs the depth after the frame: without a resolve there is no point storing it (three invalidates the buffer, which helps tile-based GPUs).
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

    // SMAA after OutputPass: it works in sRGB (as the algorithm intends) and, as the last pass, writes straight to the screen.
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
   * Bloom at a fraction of the buffer resolution: composer.setSize gives every pass the full size, so after it
   * the bloom gets its own. 1 means as always (we touch nothing, so "high" stays as it was).
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

  /** Cold path (quality menu, perf panel, benchmark): change the antialiasing method by recreating the composer. */
  setAa(aa: AaSettings): void {
    const a = this.aa
    if (a.samples === aa.samples && a.byteTarget === aa.byteTarget && a.resolveDepth === aa.resolveDepth && a.smaa === aa.smaa) return
    this.aa = { ...aa }
    this.teardown()
    this.build()
  }

  /** What is actually on right now (for the benchmark log: a stage label must not depend on what was "wanted"). */
  aaLabel(): string {
    const a = this.aa
    if (a.smaa) return 'SMAA'
    if (a.samples <= 0) return 'off'
    return `MSAA${a.samples} ${a.byteTarget ? '8bit' : 'half'}${a.resolveDepth ? '' : ' nodepthresolve'}`
  }

  /** "Medium" quality: bloom at half resolution (0.5); 1 is full. Cold path. */
  setBloomScale(scale: number): void {
    if (scale === this.bloomScale) return
    this.bloomScale = scale
    // Going back to 1 needs the full size, and the bloom's setSize is only called on resize, so we reapply it right away.
    this.composer.setSize(this.width, this.height)
    this.applyBloomSize()
  }

  /** Debug: turn bloom on/off (the composer skips a disabled pass entirely). */
  setBloom(on: boolean): void {
    this.bloomOn = on
    this.bloomPass.enabled = on
  }

  /** Cold path: a new game means a new scene/camera/config on the same passes. */
  attach(scene: Scene, camera: PerspectiveCamera, config: Config): void {
    this.scene = scene
    this.camera = camera
    this.renderPass.scene = scene
    this.renderPass.camera = camera
    this.glitchDurationMs = config.camera.glitchMs
    this.glitchActive = false
    this.glitchPass.enabled = false
  }

  /** Cold path: detach the scene (it has already been destroyed) so we hold no references. */
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

  /** Called from render() in the frame where the camera roll started; does not allocate itself. */
  triggerGlitch(): void {
    if (this.reducedMotion?.matches) return // the camera roll and micro-pause stay; only the noise is suppressed
    this.glitchActive = true
    this.glitchElapsed = 0
    this.glitchPass.enabled = true
  }

  /** Per frame: no allocations. */
  render(dtMs: number): void {
    if (this.glitchActive) {
      this.glitchElapsed += dtMs
      if (this.glitchElapsed >= this.glitchDurationMs) {
        this.glitchActive = false
        this.glitchPass.enabled = false
      }
    }
    this.composer.render(dtMs / 1000)
    // The glitch swaps the buffers (an odd number of swaps): put the multisampled one back into readBuffer,
    // otherwise on the next frame RenderPass would draw into the non-antialiased one.
    if (this.msaaTarget && this.composer.readBuffer !== this.msaaTarget) this.composer.swapBuffers()
  }

  dispose(): void {
    this.reducedMotion?.removeEventListener('change', this.onReducedMotionChange)
    this.teardown()
  }
}
