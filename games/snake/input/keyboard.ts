// PC keyboard: arrows/WASD - turn in the plane, Q/E - third axis, Shift/Space (hold) - boost,
// R - camera reset (tilt and zoom).
// Works in both control schemes (swipes and taps).
// We read e.code (the physical key), not e.key: on a Russian layout WASD
// yields ц/ф/ы/в, and e.key would break the controls.
import type { AxisDir, ScreenDir } from '../core/state'
import { createBoostHold, isBoostCode } from './gestures'
import type { InputHandlers } from './index'

const PLANE_CODES: Readonly<Record<string, ScreenDir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

const AXIS_CODES: Readonly<Record<string, AxisDir>> = {
  KeyQ: 'into',
  KeyE: 'out',
}

/** Pure parsing function: null - not our key. Kept separate so it can be tested without a DOM. */
export function keyAction(code: string): { plane: ScreenDir | null; axis: AxisDir | null } | null {
  const plane = PLANE_CODES[code] ?? null
  const axis = AXIS_CODES[code] ?? null
  if (plane === null && axis === null) return null
  return { plane, axis }
}

export function attachKeyboard(h: InputHandlers): () => void {
  // Shift/Space: boost while held. Release must always fire (blur, hidden tab, detach).
  const boost = createBoostHold((on) => h.onBoost?.(on))

  function onKeyDown(e: KeyboardEvent): void {
    // Escape - pause and exit to the menu. Checked first: works with modifiers
    // and with boost held, because it is an emergency exit from the game.
    if (e.code === 'Escape') {
      e.preventDefault()
      if (!e.repeat) h.onPause?.()
      return
    }
    // R (Reset) - camera reset. No modifiers: Ctrl+R reloads the page, not ours.
    if (e.code === 'KeyR') {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      if (!e.repeat) h.onCameraReset?.()
      return
    }
    if (isBoostCode(e.code)) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault() // Space would otherwise press a focused button and scroll
      if (!e.repeat) boost.press(e.code)
      return
    }
    // Ctrl/Cmd/Alt+key is a browser shortcut (Ctrl+S, Ctrl+A, Cmd+D...), not the game.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const action = keyAction(e.code)
    if (action === null) return
    // Arrows would otherwise scroll the page; harmless for our other keys too.
    e.preventDefault()
    // Auto-repeat while held must not spam commands.
    if (e.repeat) return
    if (action.plane !== null) h.onTurn(action.plane)
    else if (action.axis !== null && h.axisEnabled?.() !== false) h.onAxis(action.axis)
  }

  // keyup without a modifier check: releasing is always allowed.
  function onKeyUp(e: KeyboardEvent): void {
    if (isBoostCode(e.code)) boost.release(e.code)
  }
  function onBlur(): void {
    boost.releaseAll()
  }
  function onVisibility(): void {
    if (document.hidden) boost.releaseAll()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
    boost.releaseAll()
  }
}
