// Debug free camera (?camera=free). NOT part of the game: a tool for store screenshots and for looking at the scene. The chase
// camera (camera-rig.ts) is untouched; while this is on, its pose is simply overwritten after it has been computed each frame.
// Off (the default): createFreeCamera is never called - no listeners, no per-frame work beyond one null check in view/index.ts.
//
// Keys (e.code, layout-independent; none of them is a gameplay key: those are arrows, WASD, Space, Shift, Escape, R, Backquote):
//   I / K  fly forward / back      J / L  fly left / right      U / O  fly down / up
//   F      focus: put the orbit target on the snake's head
//   C      reset to the start view of the whole cube
//   H      hide / show the HUD (score, pause, minimap, pad, boost, stick, hints) for a clean frame
// Mouse on the canvas: drag - orbit, wheel - dolly. These are taken over completely while the mode is on (the canvas swipe
// and tilt gestures do not see them); the snake is steered by the keyboard.
import { head } from '../core/queries'
import type { GameState } from '../core/state'
import {
  cameraPosition,
  createFreePose,
  dollyBy,
  flyBy,
  focusOn,
  orbitBy,
  resetPose,
  type FreeCameraConfig,
  type Vec3,
} from './free-camera-math'
import type { PerspectiveCamera } from 'three'

export const FREE_KEYS = {
  forward: 'KeyI',
  back: 'KeyK',
  left: 'KeyJ',
  right: 'KeyL',
  down: 'KeyU',
  up: 'KeyO',
  focusHead: 'KeyF',
  resetView: 'KeyC',
  toggleHud: 'KeyH',
} as const

const HUD_STYLE_ID = 'free-camera-hud-style'
const HUD_HIDDEN_CLASS = 'free-camera-hud-off'
// The DOM overlays of the game screen. The minimap is drawn on the canvas: the view skips it through hudHidden.
const HUD_SELECTOR = '#hud, #pad, #boost, #boost-hint, #stick, #pause-btn, #cam-reset'

export interface FreeCamera {
  /** Called once per frame after the chase camera was computed: overwrites the pose, the lens and the far plane. No allocation. */
  apply(camera: PerspectiveCamera, s: GameState, dtMs: number): void
  /** The HUD is hidden (so the view must not draw the minimap on the canvas either). */
  readonly hudHidden: boolean
  dispose(): void
}

export function createFreeCamera(canvas: HTMLCanvasElement, cfg: FreeCameraConfig, size: number): FreeCamera {
  const pose = createFreePose()
  resetPose(pose, size, cfg)
  const pos: Vec3 = { x: 0, y: 0, z: 0 }
  let curSize = size
  let hudHidden = false
  let wantFocus = false
  let dragging = false
  let lastX = 0
  let lastY = 0
  let fwd = 0
  let back = 0
  let left = 0
  let right = 0
  let down = 0
  let up = 0

  const style = document.createElement('style')
  style.id = HUD_STYLE_ID
  style.textContent = `html.${HUD_HIDDEN_CLASS} :is(${HUD_SELECTOR}) { display: none !important; }`
  document.head.appendChild(style)

  function setHud(hidden: boolean): void {
    hudHidden = hidden
    document.documentElement.classList.toggle(HUD_HIDDEN_CLASS, hidden)
  }

  function typing(e: KeyboardEvent): boolean {
    const tg = e.target as HTMLElement | null
    return tg !== null && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return
    if (setAxis(e.code, true)) {
      e.preventDefault()
      return
    }
    if (e.repeat) return
    if (e.code === FREE_KEYS.focusHead) wantFocus = true
    else if (e.code === FREE_KEYS.resetView) resetPose(pose, curSize, cfg)
    else if (e.code === FREE_KEYS.toggleHud) setHud(!hudHidden)
  }
  function onKeyUp(e: KeyboardEvent): void {
    setAxis(e.code, false)
  }
  function setAxis(code: string, on: boolean): boolean {
    const v = on ? 1 : 0
    switch (code) {
      case FREE_KEYS.forward: fwd = v; return true
      case FREE_KEYS.back: back = v; return true
      case FREE_KEYS.left: left = v; return true
      case FREE_KEYS.right: right = v; return true
      case FREE_KEYS.down: down = v; return true
      case FREE_KEYS.up: up = v; return true
      default: return false
    }
  }
  function releaseAll(): void {
    fwd = back = left = right = down = up = 0
    dragging = false
  }

  // Capture phase on the canvas: runs before the game's own canvas listeners (swipes, tilt, wheel zoom), and swallows the event.
  function onPointerDown(e: PointerEvent): void {
    e.stopImmediatePropagation()
    e.preventDefault()
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return
    e.stopImmediatePropagation()
    orbitBy(pose, e.clientX - lastX, e.clientY - lastY, cfg)
    lastX = e.clientX
    lastY = e.clientY
  }
  function onPointerEnd(e: PointerEvent): void {
    if (!dragging) return
    e.stopImmediatePropagation()
    dragging = false
  }
  function onWheel(e: WheelEvent): void {
    e.stopImmediatePropagation()
    e.preventDefault()
    dollyBy(pose, e.deltaY, cfg)
  }
  function onContextMenu(e: Event): void {
    e.preventDefault()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseAll)
  canvas.addEventListener('pointerdown', onPointerDown, true)
  canvas.addEventListener('pointermove', onPointerMove, true)
  canvas.addEventListener('pointerup', onPointerEnd, true)
  canvas.addEventListener('pointercancel', onPointerEnd, true)
  canvas.addEventListener('wheel', onWheel, { capture: true, passive: false })
  canvas.addEventListener('contextmenu', onContextMenu, true)

  return {
    get hudHidden(): boolean {
      return hudHidden
    },
    apply(camera: PerspectiveCamera, s: GameState, dtMs: number): void {
      const n = s.size
      if (n !== curSize) {
        curSize = n
        resetPose(pose, n, cfg)
      }
      if (wantFocus) {
        wantFocus = false
        const h = head(s)
        focusOn(pose, h.x, h.y, h.z)
      }
      flyBy(pose, fwd - back, right - left, up - down, dtMs, cfg)
      cameraPosition(pose, pos)
      camera.position.set(pos.x, pos.y, pos.z)
      camera.lookAt(pose.tx, pose.ty, pose.tz)
      camera.fov = cfg.fovDeg
      camera.near = cfg.near
      camera.far = curSize * cfg.farFactor + pose.dist
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove, true)
      canvas.removeEventListener('pointerup', onPointerEnd, true)
      canvas.removeEventListener('pointercancel', onPointerEnd, true)
      canvas.removeEventListener('wheel', onWheel, true)
      canvas.removeEventListener('contextmenu', onContextMenu, true)
      style.remove()
      document.documentElement.classList.remove(HUD_HIDDEN_CLASS)
    },
  }
}
