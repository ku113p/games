// Touch input: Pointer Events (no hover), element geometry is re-read
// on every gesture - survives orientation changes without resubscribing.
//
// 'taps' scheme: the canvas yields only camera tilt (two fingers / right button), everything else is the corner pad
// (input/pad.ts, separate DOM buttons: a touch that starts on them never gets here at all).
//
// The pointer is captured (setPointerCapture): if the mouse left the window and
// the button was released there, pointerup still arrives on the element; just in case,
// state is also reset on lostpointercapture / pointercancel.
import type { Config } from '../core/rules'
import {
  isDoubleTap,
  pinchZoomFactor,
  pointerRole,
  swipeDirection,
  tiltPointersNeeded,
  twoFingerMode,
  wheelZoomFactor,
  zoomTuning,
  type TwoFingerMode,
} from './gestures'
import type { InputHandlers, InputScheme } from './index'

export function attachTouch(
  el: HTMLElement,
  scheme: InputScheme,
  config: Config,
  h: InputHandlers,
): () => void {
  let activePointerId: number | null = null

  // Camera from the player. PC: tilt - drag with the right mouse button (left stays for swipes/taps),
  // zoom - wheel. Phone: two fingers, and they mean EITHER tilt (fingers move together) OR zoom (pinch).
  // Which one is decided once per gesture by whichever accumulated first (twoFingerMode), and is not revisited.
  // Increments go out (onCameraTiltBy / onCameraZoomBy): the accumulated value and its limits are kept by main,
  // so tilt and zoom stay in place after the gesture and only an explicit reset can clear them.
  const down = new Map<number, { x: number; y: number }>()
  let tilting = false
  let tiltIsMouse = false
  let fingerMode: TwoFingerMode = 'tilt'
  let baseCx = 0
  let baseCy = 0
  let baseSpread = 0
  let prevCx = 0
  let prevCy = 0
  let prevSpread = 0
  const tiltRadPerPx = config.input.tiltRadPerPx
  const tuning = zoomTuning(config)

  // Center and spread (mean finger distance from the center) of all pressed pointers.
  function centroid(): void {
    let sx = 0
    let sy = 0
    for (const p of down.values()) {
      sx += p.x
      sy += p.y
    }
    const n = down.size || 1
    prevCx = sx / n
    prevCy = sy / n
    let sd = 0
    for (const p of down.values()) sd += Math.hypot(p.x - prevCx, p.y - prevCy)
    prevSpread = sd / n
  }

  function startTilt(isMouse: boolean): void {
    // A gesture begun with one finger is cancelled entirely: no turn now, and no swipe/tap on release.
    resetGesture()
    flushPendingTap()
    tilting = true
    tiltIsMouse = isMouse
    fingerMode = isMouse ? 'tilt' : 'pending'
    centroid()
    rebase()
  }

  // The reference point for the two-finger gesture (for the threshold): shift and spread are measured from it.
  function rebase(): void {
    baseCx = prevCx
    baseCy = prevCy
    baseSpread = prevSpread
  }

  // The gesture ended: return NOTHING, tilt and zoom stay as they are until an explicit reset.
  function endTilt(): void {
    tilting = false
  }

  function forgetPointer(id: number): void {
    if (!down.delete(id)) return
    if (!tilting) return
    if (down.size < tiltPointersNeeded(tiltIsMouse)) endTilt()
    else {
      centroid() // one of three fingers lifted: no jump
      rebase()
    }
  }
  let startX = 0
  let startY = 0
  // A swipe was already sent in the current gesture - on pointerup this is not a tap.
  let swiped = false

  // Timer for a single/double tap at the center (into/out).
  let pendingTapAt: number | null = null
  let pendingTapTimer: ReturnType<typeof setTimeout> | null = null

  function clearPendingTap(): void {
    if (pendingTapTimer !== null) {
      clearTimeout(pendingTapTimer)
      pendingTapTimer = null
    }
    pendingTapAt = null
  }

  // Another gesture began (swipe, two fingers) while a single tap was still waiting for a second: it is no longer a double tap,
  // but not a cancelled one either - flush it as "into" right away and in input order (the tap came before the swipe), rather than losing it.
  function flushPendingTap(): void {
    if (pendingTapTimer === null) return
    clearPendingTap()
    if (h.axisEnabled?.() === false) return
    h.onAxis('into')
  }

  // Tap with no direction (anywhere in 'swipes'):
  // single - into, but if a second tap arrives within doubleTapMs - out.
  function handleAxisTap(now: number): void {
    // 'free' mode: no third axis - the tap does nothing, no timers are started.
    if (h.axisEnabled?.() === false) {
      clearPendingTap()
      return
    }
    if (isDoubleTap(pendingTapAt, now, config.input.doubleTapMs)) {
      clearPendingTap()
      h.onAxis('out')
      return
    }
    clearPendingTap()
    pendingTapAt = now
    pendingTapTimer = setTimeout(() => {
      pendingTapAt = null
      pendingTapTimer = null
      if (h.axisEnabled?.() === false) return // mode changed while waiting for the second tap
      h.onAxis('into')
    }, config.input.doubleTapMs)
  }

  function resetGesture(): void {
    activePointerId = null
    swiped = false
  }

  function onPointerDown(e: PointerEvent): void {
    const role = pointerRole(e.pointerType, e.button, down.size)
    if (role === 'ignore') return
    down.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (role === 'tilt') {
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // The pointer is already gone: pointerup/lostpointercapture will reset everything.
      }
      if (tilting) {
        // third finger: no jump
        centroid()
        rebase()
      }
      else startTilt(e.pointerType === 'mouse')
      return
    }
    activePointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    swiped = false
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone: pointerup/lostpointercapture will reset everything.
    }
  }

  // A turn is sent the moment the threshold is crossed, not on pointerup -
  // otherwise there is a noticeable delay at speed. After firing, the reference point
  // moves right there, so a chain of swipes in one touch works too.
  function onPointerMove(e: PointerEvent): void {
    const p = down.get(e.pointerId)
    if (p !== undefined) {
      p.x = e.clientX
      p.y = e.clientY
    }
    if (tilting) {
      if (p === undefined) return
      const px = prevCx
      const py = prevCy
      const ps = prevSpread
      centroid()
      const dx = prevCx - px
      const dy = prevCy - py
      if (fingerMode === 'pending') {
        fingerMode = twoFingerMode(
          Math.hypot(prevCx - baseCx, prevCy - baseCy),
          Math.abs(prevSpread - baseSpread),
          tuning.lockPx,
        )
        return // nothing is sent until decided: accumulated pixels go into the gesture's "dead zone"
      }
      if (fingerMode === 'tilt') h.onCameraTiltBy?.(dx * tiltRadPerPx, dy * tiltRadPerPx)
      else h.onCameraZoomBy?.(pinchZoomFactor(ps, prevSpread, tuning.pinchGain))
      return
    }
    if (e.pointerId !== activePointerId) return
    // In 'taps' the canvas does not read swipes and taps: turns and axis are on the pad (input/pad.ts).
    if (scheme === 'taps') return
    const dir = swipeDirection(e.clientX - startX, e.clientY - startY, config.input.swipeMinPx)
    if (dir === null) return
    swiped = true
    startX = e.clientX
    startY = e.clientY
    flushPendingTap()
    h.onTurn(dir)
  }

  function onPointerUp(e: PointerEvent): void {
    forgetPointer(e.pointerId)
    if (e.pointerId !== activePointerId) return
    const wasSwipe = swiped
    resetGesture()
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)

    if (wasSwipe) return
    const now = e.timeStamp

    // Threshold not passed (otherwise onPointerMove would have fired) - this is a tap anywhere.
    // In 'taps', taps on the canvas mean nothing.
    if (scheme === 'swipes') handleAxisTap(now)
  }

  function onPointerCancel(e: PointerEvent): void {
    forgetPointer(e.pointerId)
    if (e.pointerId === activePointerId) resetGesture()
  }

  function onLostCapture(e: PointerEvent): void {
    forgetPointer(e.pointerId)
    if (e.pointerId === activePointerId) resetGesture()
  }

  // A long press / right button must not open the system menu over the game.
  function onContextMenu(e: Event): void {
    e.preventDefault()
  }

  // Mouse wheel - zoom. The listener is NOT passive: otherwise preventDefault will not work and the page will scroll.
  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    if (e.deltaY === 0) return
    h.onCameraZoomBy?.(wheelZoomFactor(e.deltaY, e.deltaMode, tuning.wheelPerPx))
  }

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerCancel)
  el.addEventListener('lostpointercapture', onLostCapture)
  el.addEventListener('contextmenu', onContextMenu)

  return () => {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
    el.removeEventListener('lostpointercapture', onLostCapture)
    el.removeEventListener('contextmenu', onContextMenu)
    clearPendingTap()
    resetGesture()
    down.clear()
    endTilt()
  }
}
