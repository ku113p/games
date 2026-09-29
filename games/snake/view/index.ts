// Public API of the view (three.js, neon). Strictly per the contract:
// - subscribes to events (handle), reads state ONLY through core/queries,
// - never calls commands and never changes state,
// - render(s, dtMs) creates no new objects and uses no await.
//
// WebGLRenderer and PostFx (composer + passes) are created once per canvas and
// reused between games: recreating the renderer on the same
// GL context leaves foreign state and leaks. View.dispose() releases
// only the game's resources (scene, pools, geometries, materials).
//
// Tone mapping: OFF (NoToneMapping). The neon palette is defined in final
// colors, ACES would compress them; the glow comes from bloom, OutputPass only does
// sRGB conversion. That is why materials have no toneMapped flags.
// Canvas antialias is off: rendering goes into the composer's RenderTarget, canvas MSAA would smooth nothing.
// Antialiasing is our own, in PostFx (MSAA target, 8-bit target or post-processing SMAA, view/perf-settings.ts: AA_PRESETS).

import { WebGLRenderer, Scene, NoToneMapping, MathUtils } from 'three'
import type { GameState } from '../core/state'
import type { GameEvent } from '../core/commands'
import type { Config } from '../core/rules'
import { viewFrame, cubeSize, head } from '../core/queries'
import { viewMode } from './game-mode'
import { BACKGROUND_COLOR, applyPaletteById, createFog, type PalettesConfig } from './palette'
import { resolveCosmetics, type CosmeticsInput } from './cosmetics'
import { CameraRig } from './camera-rig'
import { PostFx } from './postprocessing'
import { CubeFrame } from './cube-frame'
import { SnakeView } from './snake-view'
import { ObstaclesView } from './obstacles-view'
import { AppleView } from './apple-view'
import { CompassView, COMPASS_ENABLED, type CompassHints } from './compass-view'
import { createDirectionHint } from './direction-hint'
import { WallGrid } from './wall-grid'
import { PlaneBoard } from './plane-board'
import { MiniMap } from './minimap'
import { MAX_PIXEL_RATIO, currentAa, perf, type PerfSnapshot } from './perf-settings'
import { readGpuInfo, type GpuInfo } from './perf-env'

export interface View {
  resize(width: number, height: number): void
  handle(event: GameEvent, s: GameState): void
  render(s: GameState, dtMs: number): void
  /** Camera tilt from the player, rad, both within ±1; returns to zero by itself. */
  setCameraTilt(yaw: number, pitch: number): void
  /** The "Fog" toggle from the menu: global distance fog (density is config.fog.density). */
  setFogOn(on: boolean): void
  /** Debug (perf panel), cold path: apply view/perf-settings.ts (MSAA, bloom, MPix cap) immediately. */
  applyPerf(width: number, height: number): void
  /** Debug: fill the render metrics snapshot (after the frame is drawn). No allocations. */
  readPerf(out: PerfSnapshot): void
  /** Debug (benchmark log): GPU and WebGL capabilities. Cold path. */
  gpuInfo(): GpuInfo
  dispose(): void
}

// Pixel ratio limit protects weak phones from fillrate overuse (perf-settings.ts: MAX_PIXEL_RATIO).
// Cap on the number of render buffer pixels, MPix (0 means no cap). The cost of MSAA and bloom grows
// linearly with pixels: on a retina monitor the buffer is 5-8 MPix, on a phone ~1.3. A cap lowers pixelRatio
// on large windows and makes the picture softer, so only the "Low" quality tier sets one (config.json: quality.levels);
// "High" and "Medium" have none. The value lives in perf.megapixelCap (view/perf-settings.ts): the quality level
// and the debug panel change it.

function pixelRatioFor(cssW: number, cssH: number): number {
  let pr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  if (perf.megapixelCap > 0) pr = Math.min(pr, Math.sqrt((perf.megapixelCap * 1e6) / Math.max(1, cssW * cssH)))
  return pr
}

interface Shared {
  canvas: HTMLCanvasElement
  renderer: WebGLRenderer
  postFx: PostFx | null
}
let shared: Shared | null = null

function getShared(canvas: HTMLCanvasElement): Shared {
  if (shared && shared.canvas === canvas) return shared
  disposeSharedRenderer()
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false })
  renderer.setPixelRatio(pixelRatioFor(canvas.clientWidth || canvas.width || 1, canvas.clientHeight || canvas.height || 1))
  renderer.toneMapping = NoToneMapping
  renderer.setClearColor(BACKGROUND_COLOR, 1)
  shared = { canvas, renderer, postFx: null }
  return shared
}

/** Full release of the renderer and composer (when leaving the game page). */
export function disposeSharedRenderer(): void {
  if (!shared) return
  shared.postFx?.dispose()
  shared.renderer.dispose()
  shared = null
}

/**
 * `cosmetics` is what is equipped in the shop (palette, snake, apple and arrow skins); without it, the default look.
 * Applied when the view is created, i.e. at game start (cold path): changing the set on the fly is not supported.
 */
export function createView(canvas: HTMLCanvasElement, config: Config, s: GameState, cosmetics?: CosmeticsInput): View {
  const look = resolveCosmetics(cosmetics)
  // Colors come before creating any view object: materials copy the color at creation.
  applyPaletteById((config as { palettes?: PalettesConfig }).palettes, look.palette)
  const sh = getShared(canvas)
  const renderer = sh.renderer
  renderer.setClearColor(BACKGROUND_COLOR, 1) // the renderer is shared between games, the set's background is applied every time

  const scene = new Scene()
  const cameraRig = new CameraRig(config)
  const cubeFrame = new CubeFrame(scene)
  const wallGrid = new WallGrid(scene)
  // The flat board exists only in a game that starts flat (the player's first game); the 3D game never builds it.
  const planeBoard = viewMode(s) === 'plane' ? new PlaneBoard(scene, s) : null
  const miniMap = new MiniMap(config.minimap.windowCells, config.minimap.levelWindowCells)
  const snakeView = new SnakeView(scene, undefined, look.snakeSkin)
  const obstaclesView = new ObstaclesView(scene)
  const appleView = new AppleView(scene, look.appleSkin)
  const fog = createFog()
  scene.fog = fog
  let fogOn = config.fog.defaultOn
  const compass = COMPASS_ENABLED ? new CompassView(scene, config.hints as typeof config.hints & CompassHints, look.compassSkin) : null
  const aheadRay = createDirectionHint(scene, config)

  const initialWidth = canvas.clientWidth || canvas.width || 1
  const initialHeight = canvas.clientHeight || canvas.height || 1
  // Quality could have been changed in the menu between games: the density multiplier is recomputed against the current cap.
  const startPr = pixelRatioFor(initialWidth, initialHeight)
  if (startPr !== renderer.getPixelRatio()) renderer.setPixelRatio(startPr)
  renderer.setSize(initialWidth, initialHeight, false)
  cameraRig.resize(initialWidth, initialHeight)
  miniMap.resize(initialWidth, initialHeight)
  aheadRay.setViewportHeight?.(initialHeight * renderer.getPixelRatio())

  let postFx = sh.postFx
  if (postFx) {
    postFx.attach(scene, cameraRig.camera, config)
    postFx.setAa(currentAa())
    postFx.setBloomScale(perf.bloomScale)
    postFx.resize(initialWidth, initialHeight, renderer.getPixelRatio())
  } else {
    postFx = new PostFx(renderer, scene, cameraRig.camera, config, initialWidth, initialHeight, currentAa())
    sh.postFx = postFx
  }
  const fx = postFx
  fx.setBloomScale(perf.bloomScale)
  fx.setBloom(perf.bloom)
  renderer.info.autoReset = !perf.statsOn

  function syncCheap(state: GameState): void {
    snakeView.ensureCapacity(state)
    cameraRig.resetTurn()
    cameraRig.syncImmediate(state)
    const cam = cameraRig.camera.position
    snakeView.update(state, cam.x, cam.y, cam.z, cameraRig.freeAmount)
  }

  function syncStructural(state: GameState): void {
    cubeFrame.setSize(cubeSize(state))
    wallGrid.setSize(cubeSize(state))
    miniMap.setSize(cubeSize(state))
    miniMap.invalidate()
    obstaclesView.rebuild(state)
    compass?.reset()
    syncCheap(state)
  }

  // The structure (frame + obstacles) is already built for the state from createView;
  // the first 'started' does not rebuild it.
  syncStructural(s)
  let structuralFresh = true
  let disposed = false

  return {
    resize(width: number, height: number): void {
      const pr = pixelRatioFor(width, height)
      if (pr !== renderer.getPixelRatio()) renderer.setPixelRatio(pr)
      renderer.setSize(width, height, false)
      cameraRig.resize(width, height)
      miniMap.resize(width, height)
      aheadRay.setViewportHeight?.(height * renderer.getPixelRatio())
      fx.resize(width, height, pr)
    },

    setCameraTilt(yaw: number, pitch: number): void {
      cameraRig.setTilt(yaw, pitch)
    },

    setFogOn(on: boolean): void {
      fogOn = on
    },

    applyPerf(width: number, height: number): void {
      fx.setAa(currentAa())
      fx.setBloomScale(perf.bloomScale)
      fx.setBloom(perf.bloom)
      renderer.info.autoReset = !perf.statsOn
      this.resize(width, height)
    },

    gpuInfo(): GpuInfo {
      return readGpuInfo(renderer.getContext())
    },

    readPerf(out: PerfSnapshot): void {
      const info = renderer.info.render
      out.drawCalls = info.calls
      out.triangles = info.triangles
      out.bufferW = canvas.width
      out.bufferH = canvas.height
      out.pixelRatio = renderer.getPixelRatio()
      out.aaLabel = fx.aaLabel()
      out.devicePixelRatio = window.devicePixelRatio || 1
      out.miniMapBottomPx = miniMap.bottomCssPx
    },

    handle(event: GameEvent, state: GameState): void {
      switch (event.type) {
        case 'started':
          if (structuralFresh) {
            structuralFresh = false
            syncCheap(state)
          } else {
            syncStructural(state)
          }
          break
        case 'moved':
        case 'ate':
          // Pool capacity up front (cold path), render only mutates.
          snakeView.ensureCapacity(state)
          break
        default:
          // axisTurned and modeChanged are not needed by the camera: it is driven toward
          // cameraFrame(s) and the mode from state (self-healing).
          break
      }
    },

    render(state: GameState, dtMs: number): void {
      // Panel is open: the composer draws several passes, and info is reset on every render() by default.
      if (perf.statsOn) renderer.info.reset()
      cameraRig.update(dtMs, state)
      if (cameraRig.consumeGlitchRequest()) {
        fx.triggerGlitch()
      }
      const cam = cameraRig.camera.position
      snakeView.update(state, cam.x, cam.y, cam.z, cameraRig.freeAmount)
      const h = head(state)
      // viewFrame, not cameraFrame: the core frame rolls only on a step, and the obstacles' depth
      // axis would lag one step behind the camera after a turn input.
      const fr = viewFrame(state)
      obstaclesView.update(dtMs, cam.x, cam.y, cam.z, h.x, h.y, h.z, fr.depth.x, fr.depth.y, fr.depth.z, cameraRig.freeAmount, cameraRig.layerReach)
      const dir = snakeView.direction
      aheadRay.update(state, dir.x, dir.y, dir.z, obstaclesView.isSolid, cameraRig.freeAmount)
      // Fog appears together with volume (in plane mode the camera is far outside, where it is off); 0 means the toggle is off.
      fog.density = fogOn && perf.fog ? config.fog.density * MathUtils.smoothstep(cameraRig.freeAmount, 0, 1) : 0
      appleView.update(state)
      compass?.update(state, cameraRig.camera, dtMs, cameraRig.freeAmount)
      // Flat opening: only the head's layer is drawn (the camera clips the rest), the cube's walls stay hidden until the reveal starts.
      const flat = cameraRig.reveal <= 0
      cubeFrame.update(cam.x, cam.y, cam.z, cameraRig.freeAmount, h.x, h.y, h.z, flat)
      wallGrid.update(cam.x, cam.y, cam.z, cameraRig.freeAmount, flat)
      planeBoard?.update(cameraRig.reveal)
      fx.render(dtMs)
      if (perf.miniMap) miniMap.render(renderer, state, cameraRig.freeAmount)
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      fx.detach()
      cubeFrame.dispose()
      wallGrid.dispose()
      planeBoard?.dispose()
      miniMap.dispose()
      snakeView.dispose()
      obstaclesView.dispose()
      appleView.dispose()
      compass?.dispose()
      aheadRay.dispose()
    },
  }
}
