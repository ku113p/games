// Small self-centering camera turn stick (phone, both schemes). A DOM element next to the canvas:
// a touch that starts on it never reaches the canvas handlers (touch.ts), so it does not get mixed up with swipes, taps
// and the two-finger tilt. The stick sets turn SPEED, not position: hold it sideways -
// the camera moves, release it - the knob returns to center and the camera stays where it was (reset is explicit only).
// Outputs deflection per axis in -1..1 (after dead zone and curve) - main polls it every frame.
// A quick tap on the stick (short touch, finger never left the dead zone) resets the camera: see isStickTap.

export interface StickTuning {
  /** Dead zone: fraction of the radius inside which there is no deflection (finger jitter does not move the camera). */
  deadZone: number
  /** Response curve exponent: 1 - linear, > 1 - finer near the center, faster at the edge. */
  curve: number
  /** Tap: a touch no longer than this (ms) that never leaves the dead zone is a camera reset, not a turn. */
  tapMaxMs: number
}

/** Stick deflection per axis: x - right, y - down (as on screen), each in -1..1. Mutated in place. */
export interface StickState {
  x: number
  y: number
}

/**
 * Deflection from the knob's offset vector (px) from the center, allocation-free: the result is written to out.
 * The vector length is clamped to the radius; up to the dead zone it is zero, beyond it grows 0..1 along the curve.
 */
export function stickDeflection(
  dx: number,
  dy: number,
  radius: number,
  t: StickTuning,
  out: StickState,
): void {
  const len = Math.hypot(dx, dy)
  if (radius <= 0 || len === 0) {
    out.x = 0
    out.y = 0
    return
  }
  const raw = Math.min(len / radius, 1)
  if (raw <= t.deadZone) {
    out.x = 0
    out.y = 0
    return
  }
  const mag = Math.pow((raw - t.deadZone) / (1 - t.deadZone), t.curve)
  out.x = (dx / len) * mag
  out.y = (dy / len) * mag
}

/**
 * Whether the touch was a tap (-> camera reset). A tap is BOTH short AND with no deflection at all:
 * if the stick ever left the dead zone (`maxTravel` - fraction of the radius, maximum during the touch), it is a turn,
 * even if the finger returned to the center before release. So an attempt to nudge the camera slightly will not reset it by accident.
 */
export function isStickTap(durationMs: number, maxTravel: number, t: StickTuning): boolean {
  return durationMs >= 0 && durationMs <= t.tapMaxMs && maxTravel <= t.deadZone
}

/** Turn per frame (rad): deflection × max speed × dt. The sign follows dragging (right/down - positive). */
export function stickStep(deflection: number, maxRadPerSec: number, dtMs: number): number {
  return (deflection * maxRadPerSec * dtMs) / 1000
}

export interface Stick {
  /** Current deflection (live object, read in the frame without copies). */
  readonly state: StickState
  /** Force release (pause, death, end of game; camera reset not needed: the stick stores no position). */
  release(): void
  detach(): void
}

export function attachStick(base: HTMLElement, knob: HTMLElement, t: StickTuning, onTap: () => void): Stick {
  const state: StickState = { x: 0, y: 0 }
  let pointerId: number | null = null
  let cx = 0
  let cy = 0
  let radius = 1
  // For tap detection: when the touch began and how far from the center the finger went (fraction of the radius, before clamping).
  let downAt = 0
  let maxTravel = 0

  function moveKnob(dx: number, dy: number): void {
    knob.style.transform = `translate(${dx}px, ${dy}px)`
  }

  function update(e: PointerEvent): void {
    // The knob moves on a circle of radius radius; clamp the vector to the same length as the deflection.
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const len = Math.hypot(dx, dy)
    if (len > radius) {
      dx = (dx / len) * radius
      dy = (dy / len) * radius
    }
    const travel = radius > 0 ? len / radius : 0
    if (travel > maxTravel) maxTravel = travel
    stickDeflection(dx, dy, radius, t, state)
    moveKnob(dx, dy)
  }

  function release(): void {
    if (pointerId !== null && base.hasPointerCapture(pointerId)) {
      try {
        base.releasePointerCapture(pointerId)
      } catch {
        // The pointer is already gone.
      }
    }
    pointerId = null
    state.x = 0
    state.y = 0
    moveKnob(0, 0)
    base.classList.remove('active')
  }

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault() // no focus, no selection and no synthetic click
    if (pointerId !== null) return // one finger per stick
    const r = base.getBoundingClientRect()
    cx = r.left + r.width / 2
    cy = r.top + r.height / 2
    radius = (r.width - knob.offsetWidth) / 2 // the knob does not go past the edge of the base
    if (radius < 1) radius = r.width / 2
    pointerId = e.pointerId
    downAt = e.timeStamp
    maxTravel = 0
    try {
      base.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone: pointerup/lostpointercapture will reset everything.
    }
    base.classList.add('active')
    update(e)
  }

  function onMove(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return
    update(e)
  }

  function onEnd(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return
    // Only a real release counts as a tap: cancel, lost capture, blur and pause are not a reset.
    const tap = e.type === 'pointerup' && isStickTap(e.timeStamp - downAt, maxTravel, t)
    release()
    if (tap) {
      flash()
      onTap()
    }
  }

  // A brief stick flash: the reset fired (the aim button may already be "dim" if the camera is at its default view anyway).
  function flash(): void {
    base.classList.remove('flash')
    void base.offsetWidth // restart the animation on a repeated tap
    base.classList.add('flash')
  }

  function onFlashEnd(): void {
    base.classList.remove('flash')
  }

  function onContextMenu(e: Event): void {
    e.preventDefault()
  }

  function onTouchStart(e: Event): void {
    e.preventDefault() // no long-press gesture, menu, or magnifier
  }

  function onBlur(): void {
    release()
  }

  function onVisibility(): void {
    if (document.hidden) release()
  }

  base.addEventListener('animationend', onFlashEnd)
  base.addEventListener('pointerdown', onDown)
  base.addEventListener('pointermove', onMove)
  base.addEventListener('pointerup', onEnd)
  base.addEventListener('pointercancel', onEnd)
  base.addEventListener('lostpointercapture', onEnd)
  base.addEventListener('contextmenu', onContextMenu)
  base.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    state,
    release,
    detach(): void {
      base.removeEventListener('animationend', onFlashEnd)
      base.removeEventListener('pointerdown', onDown)
      base.removeEventListener('pointermove', onMove)
      base.removeEventListener('pointerup', onEnd)
      base.removeEventListener('pointercancel', onEnd)
      base.removeEventListener('lostpointercapture', onEnd)
      base.removeEventListener('contextmenu', onContextMenu)
      base.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    },
  }
}
