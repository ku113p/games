// Публичный API вида (three.js, неон). Строго по контракту:
// - подписан на события (handle), состояние читает ТОЛЬКО через core/queries,
// - никогда не вызывает команды и не меняет состояние,
// - render(s, dtMs) не создаёт новых объектов и не использует await.
//
// WebGLRenderer и PostFx (composer + пассы) создаются один раз на canvas и
// переиспользуются между партиями: пересоздание рендерера на том же
// GL-контексте оставляет чужое состояние и утечки. View.dispose() освобождает
// только ресурсы партии (сцена, пулы, геометрии, материалы).
//
// Тонмаппинг: ВЫКЛЮЧЕН (NoToneMapping). Палитра неона задана в конечных
// цветах, ACES сжимал бы их; свечение даёт bloom, OutputPass делает только
// sRGB-конвертацию. Поэтому флагов toneMapped у материалов нет.
// Antialias канваса выключен: рендер идёт в RenderTarget composer'а, MSAA канваса ничего бы не сглаживал.
// Сглаживание — свой способ в PostFx (MSAA-цель, 8-битная цель или постобработочный SMAA, view/perf-settings.ts: AA_PRESETS).

import { WebGLRenderer, Scene, Color, NoToneMapping, MathUtils } from 'three'
import type { GameState } from '../core/state'
import type { GameEvent } from '../core/commands'
import type { Config } from '../core/rules'
import { viewFrame, cubeSize, head } from '../core/queries'
import { BACKGROUND_COLOR, createFog } from './palette'
import { CameraRig } from './camera-rig'
import { PostFx } from './postprocessing'
import { CubeFrame } from './cube-frame'
import { SnakeView } from './snake-view'
import { ObstaclesView } from './obstacles-view'
import { AppleView } from './apple-view'
import { CompassView, COMPASS_ENABLED } from './compass-view'
import { createDirectionHint } from './direction-hint'
import { WallGrid } from './wall-grid'
import { MiniMap } from './minimap'
import { MAX_PIXEL_RATIO, currentAa, perf, type PerfSnapshot } from './perf-settings'
import { readGpuInfo, type GpuInfo } from './perf-env'

export interface View {
  resize(width: number, height: number): void
  handle(event: GameEvent, s: GameState): void
  render(s: GameState, dtMs: number): void
  /** Наклон камеры от игрока, рад, оба в пределах ±1; сам возвращается к нулю. */
  setCameraTilt(yaw: number, pitch: number): void
  /** Тумблер «Туман» из меню: общий туман по дальности (плотность — config.fog.density). */
  setFogOn(on: boolean): void
  /** Отладка (перф-панель), холодный путь: применить view/perf-settings.ts (MSAA, bloom, потолок МПикс) сразу. */
  applyPerf(width: number, height: number): void
  /** Отладка: заполнить снимок показателей рендера (после отрисовки кадра). Без аллокаций. */
  readPerf(out: PerfSnapshot): void
  /** Отладка (лог бенчмарка): видеокарта и возможности WebGL. Холодный путь. */
  gpuInfo(): GpuInfo
  dispose(): void
}

// Ограничение pixel ratio — защита слабых телефонов от перерасхода fillrate (perf-settings.ts: MAX_PIXEL_RATIO).
// Потолок числа пикселей буфера отрисовки, МПикс (0 — без потолка, как было). Стоимость MSAA и bloom растёт
// линейно с пикселями: на ретина-мониторе буфер 5-8 МПикс, на телефоне ~1.3. Включение снижает pixelRatio
// на больших окнах и делает картинку мягче; решать дизайнеру (см. отчёт), поэтому по умолчанию выключен.
// Значение живёт в perf.megapixelCap (view/perf-settings.ts): его меняет отладочная панель.

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
  renderer.setClearColor(new Color(BACKGROUND_COLOR), 1)
  shared = { canvas, renderer, postFx: null }
  return shared
}

/** Полное освобождение renderer и composer (при уходе со страницы игры). */
export function disposeSharedRenderer(): void {
  if (!shared) return
  shared.postFx?.dispose()
  shared.renderer.dispose()
  shared = null
}

export function createView(canvas: HTMLCanvasElement, config: Config, s: GameState): View {
  const sh = getShared(canvas)
  const renderer = sh.renderer

  const scene = new Scene()
  const cameraRig = new CameraRig(config)
  const cubeFrame = new CubeFrame(scene)
  const wallGrid = new WallGrid(scene)
  const miniMap = new MiniMap(config.minimap.windowCells, config.minimap.levelWindowCells)
  const snakeView = new SnakeView(scene)
  const obstaclesView = new ObstaclesView(scene)
  const appleView = new AppleView(scene)
  const fog = createFog()
  scene.fog = fog
  let fogOn = config.fog.defaultOn
  const compass = COMPASS_ENABLED ? new CompassView(scene) : null
  const aheadRay = createDirectionHint(scene, config)

  const initialWidth = canvas.clientWidth || canvas.width || 1
  const initialHeight = canvas.clientHeight || canvas.height || 1
  // Качество могли сменить в меню между партиями: множитель плотности пересчитывается по текущему потолку.
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

  // Структура (каркас + препятствия) уже собрана под состояние из createView;
  // первый 'started' её не пересобирает.
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
          // Ёмкость пула заранее (холодный путь), рендер только мутирует.
          snakeView.ensureCapacity(state)
          break
        default:
          // axisTurned и modeChanged камере не нужны: она ведётся к
          // cameraFrame(s) и фазе из состояния (самоисцеление).
          break
      }
    },

    render(state: GameState, dtMs: number): void {
      // Панель открыта: composer рисует несколько пассов, а info по умолчанию сбрасывается на каждом render().
      if (perf.statsOn) renderer.info.reset()
      cameraRig.update(dtMs, state)
      if (cameraRig.consumeGlitchRequest()) {
        fx.triggerGlitch()
      }
      const cam = cameraRig.camera.position
      snakeView.update(state, cam.x, cam.y, cam.z, cameraRig.freeAmount)
      const h = head(state)
      // viewFrame, а не cameraFrame: кадр ядра доворачивается только на такте, и ось
      // глубины препятствий отставала бы от камеры на шаг после ввода поворота.
      const fr = viewFrame(state)
      obstaclesView.update(dtMs, cam.x, cam.y, cam.z, h.x, h.y, h.z, fr.depth.x, fr.depth.y, fr.depth.z, cameraRig.freeAmount)
      const dir = snakeView.direction
      aheadRay.update(state, dir.x, dir.y, dir.z, obstaclesView.isSolid, cameraRig.freeAmount)
      // Туман проявляется вместе с объёмом (в plane камера далеко снаружи, там он выключен); 0 — тумблер «выкл».
      fog.density = fogOn && perf.fog ? config.fog.density * MathUtils.smoothstep(cameraRig.freeAmount, 0, 1) : 0
      appleView.update(state, aheadRay.appleTargeted)
      compass?.update(state, cameraRig.camera, dtMs, cameraRig.freeAmount)
      cubeFrame.update(cam.x, cam.y, cam.z, cameraRig.freeAmount, h.x, h.y, h.z)
      wallGrid.update(cam.x, cam.y, cam.z, cameraRig.freeAmount)
      fx.render(dtMs)
      if (perf.miniMap) miniMap.render(renderer, state, cameraRig.freeAmount)
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      fx.detach()
      cubeFrame.dispose()
      wallGrid.dispose()
      miniMap.dispose()
      snakeView.dispose()
      obstaclesView.dispose()
      appleView.dispose()
      compass?.dispose()
      aheadRay.dispose()
    },
  }
}
