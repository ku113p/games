// Corner control pad ('taps' scheme): DOM buttons over the canvas, Pointer Events, no hover.
// The buttons are siblings of the canvas, not children: a touch that starts on the pad never reaches the canvas handlers
// (touch.ts), so it takes no part in the two-finger camera tilt, and a finger on the canvas
// cannot press the pad. The command is sent once on pointerdown (no delay); holding does not repeat.
import { padCommand, shouldFirePad } from './gestures'
import type { InputHandlers } from './index'

export interface Pad {
  /** Clear the "command accepted, waiting for a step" highlight (call when the snake has taken a step/turn). */
  clearQueued(): void
  detach(): void
}

export function attachPad(root: HTMLElement, h: InputHandlers): Pad {
  const active = new Map<number, HTMLElement>()
  const buttons = root.querySelectorAll<HTMLElement>('[data-pad]')

  function clearQueued(): void {
    for (const b of buttons) b.classList.remove('queued')
  }

  function release(id: number): void {
    const b = active.get(id)
    if (b === undefined) return
    b.classList.remove('pressed')
    active.delete(id)
  }

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-pad]')
    if (btn === null || btn === undefined || !root.contains(btn)) return
    e.preventDefault() // no focus and no synthetic click
    if (!shouldFirePad(new Set(active.keys()), e.pointerId)) return
    try {
      btn.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone: pointerup/lostpointercapture will reset everything.
    }
    const cmd = padCommand(btn.dataset['pad'], h.axisEnabled?.() !== false)
    if (cmd === null) return
    active.set(e.pointerId, btn)
    btn.classList.add('pressed')
    clearQueued()
    btn.classList.add('queued')
    if (cmd.kind === 'turn') h.onTurn(cmd.dir)
    else h.onAxis(cmd.dir)
    // Haptic feedback where available (Android); with a step a second long it shows the command was accepted.
    if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
  }

  function onEnd(e: PointerEvent): void {
    release(e.pointerId)
  }

  function onContextMenu(e: Event): void {
    e.preventDefault()
  }

  root.addEventListener('pointerdown', onDown)
  root.addEventListener('pointerup', onEnd)
  root.addEventListener('pointercancel', onEnd)
  root.addEventListener('lostpointercapture', onEnd)
  root.addEventListener('contextmenu', onContextMenu)

  return {
    clearQueued,
    detach(): void {
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', onEnd)
      root.removeEventListener('pointercancel', onEnd)
      root.removeEventListener('lostpointercapture', onEnd)
      root.removeEventListener('contextmenu', onContextMenu)
      for (const b of buttons) b.classList.remove('pressed', 'queued')
      active.clear()
    },
  }
}
