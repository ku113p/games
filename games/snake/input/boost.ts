// Boost button: a DOM button next to the canvas (a touch that starts on it never reaches touch.ts:
// it does not interfere with swipes or the two-finger tilt). Works in both schemes.
// While the finger is held, boost is on. Release always fires: pointerup, pointercancel,
// lostpointercapture (on the button AND on document: if capture failed and the finger moved off the button, the event
// no longer goes to the button), window blur, hidden tab, detach.
//
// Long press (the "×2 stays on for a couple of seconds" bug): on a phone after ~0.5 s the browser fires contextmenu
// (Android) or starts text selection/callout (iOS). Previously contextmenu also RELEASED boost, so
// holding the button longer than a long press was impossible. Now the long press is killed at the root
// (touchstart preventDefault: no long-press gesture, menu, or magnifier) and contextmenu itself is only suppressed:
// release comes from the finger lifting, not from the menu event. If the system still steals the touch, pointercancel arrives.
import { createBoostHold } from './gestures'
import type { InputHandlers } from './index'

export interface BoostButton {
  /** Highlight "boost is on" (from the final resulting state, including the keyboard). */
  setActive(on: boolean): void
  /** Force release (pause, death, end of game). */
  release(): void
  detach(): void
}

export function attachBoostButton(btn: HTMLElement, h: InputHandlers): BoostButton {
  const hold = createBoostHold((on) => {
    btn.classList.toggle('pressed', on)
    h.onBoost?.(on)
  })
  const src = (id: number): string => `ptr:${id}`

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault() // no focus and no synthetic click
    try {
      btn.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone: pointerup/lostpointercapture will reset everything.
    }
    hold.press(src(e.pointerId))
  }
  function onEnd(e: PointerEvent): void {
    hold.release(src(e.pointerId))
  }
  // Only suppress the menu. Do NOT release: contextmenu arrives mid-hold, the finger is still on the button.
  function onContextMenu(e: Event): void {
    e.preventDefault()
  }
  // Non-passive: preventDefault on touchstart kills the long-press gesture (menu, selection, iOS magnifier),
  // pointer events are not cancelled by it.
  function onTouchStart(e: TouchEvent): void {
    e.preventDefault()
  }
  // Safety net in case setPointerCapture failed: then pointerup/cancel do not arrive on the button.
  // React only to pointers the button is actually held by (hold ignores foreign ones).
  function onDocEnd(e: PointerEvent): void {
    hold.release(src(e.pointerId))
  }
  function onBlur(): void {
    hold.releaseAll()
  }
  function onVisibility(): void {
    if (document.hidden) hold.releaseAll()
  }

  btn.addEventListener('pointerdown', onDown)
  btn.addEventListener('pointerup', onEnd)
  btn.addEventListener('pointercancel', onEnd)
  btn.addEventListener('lostpointercapture', onEnd)
  btn.addEventListener('contextmenu', onContextMenu)
  btn.addEventListener('touchstart', onTouchStart, { passive: false })
  document.addEventListener('pointerup', onDocEnd)
  document.addEventListener('pointercancel', onDocEnd)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    setActive(on) {
      btn.classList.toggle('boosting', on)
    },
    release: () => hold.releaseAll(),
    detach() {
      btn.removeEventListener('pointerdown', onDown)
      btn.removeEventListener('pointerup', onEnd)
      btn.removeEventListener('pointercancel', onEnd)
      btn.removeEventListener('lostpointercapture', onEnd)
      btn.removeEventListener('contextmenu', onContextMenu)
      btn.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('pointerup', onDocEnd)
      document.removeEventListener('pointercancel', onDocEnd)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      hold.releaseAll()
      btn.classList.remove('pressed', 'boosting')
    },
  }
}
