// Pure gesture-parsing logic, no DOM - so it can be tested
// separately from the touch glue (input/touch.ts).
import type { ScreenDir } from '../core/state'

/**
 * Swipe direction from the offset (dx, dy) in CSS pixels.
 * dx/dy are (end - start). Returns null if the offset is below the threshold
 * on both axes (the gesture does not count as a swipe yet).
 */
export function swipeDirection(dx: number, dy: number, minPx: number): ScreenDir | null {
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (adx < minPx && ady < minPx) return null
  if (adx > ady) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}


/** Camera tilt limit in radians per axis - an agreement with the view (setCameraTilt). */
export const TILT_LIMIT_RAD = 1

/** Fallback tilt sensitivity (rad per CSS pixel) if config.input has no tiltRadPerPx. */
export const DEFAULT_TILT_RAD_PER_PX = 0.005

/**
 * New tilt value after an offset of deltaPx pixels, clamped to ±limit.
 */
export function accumulateTilt(current: number, deltaPx: number, radPerPx: number, limit: number): number {
  const next = current + deltaPx * radPerPx
  if (next > limit) return limit
  if (next < -limit) return -limit
  return next
}

/** What a new touch is. */
export type PointerRole = 'gesture' | 'tilt' | 'ignore'

/**
 * Role of a new pointer (pointerdown).
 * - mouse, non-primary button (right/middle) - tilt;
 * - any pointer, if another finger is already down - tilt (two fingers);
 * - otherwise - a regular gesture (turn/tap/swipe).
 * Primary mouse button while another pointer is down - a tilt gesture does not start either:
 * that is 'ignore' (a mouse is never a second finger).
 */
export function pointerRole(pointerType: string, button: number, otherDownCount: number): PointerRole {
  if (pointerType === 'mouse') {
    if (button !== 0) return 'tilt'
    return otherDownCount > 0 ? 'ignore' : 'gesture'
  }
  return otherDownCount > 0 ? 'tilt' : 'gesture'
}

/** How many pointers a tilt needs to continue: mouse - 1, fingers - 2. */
export function tiltPointersNeeded(isMouse: boolean): number {
  return isMouse ? 1 : 2
}

// --- Corner pad ('taps' scheme) ------------------------------------------

export type PadSide = 'right' | 'left'

/** The four arrow buttons of the pad (data-pad names). There is no third axis: classic snake has none. */
export const PAD_BUTTONS: readonly string[] = ['left', 'right', 'up', 'down']

/** Pad button name (data-pad) -> the turn it makes. null - unknown button. */
export function padCommand(button: string | undefined): ScreenDir | null {
  if (button === undefined || !PAD_BUTTONS.includes(button)) return null
  return button as ScreenDir
}

/** Pad side from a saved string; anything unclear is right (the default). */
export function parsePadSide(raw: string | null): PadSide {
  return raw === 'left' ? 'left' : 'right'
}

/**
 * A pad touch fires once - on pointerdown. While the same pointer
 * is not released, it does not send the command again (no auto-repeat on hold).
 */
export function shouldFirePad(activePointerIds: ReadonlySet<number>, pointerId: number): boolean {
  return !activePointerIds.has(pointerId)
}

// --- Boost (hold - faster) -----------------------------------------

/** Boost button: on the side of the screen opposite the pad, so it is pressed with the other thumb. */
export function boostSide(padSide: PadSide): PadSide {
  return padSide === 'left' ? 'right' : 'left'
}

export const BOOST_CODES: readonly string[] = ['ShiftLeft', 'ShiftRight', 'Space']

/** Physical boost key (e.code, layout-independent). */
export function isBoostCode(code: string): boolean {
  return BOOST_CODES.includes(code)
}

export interface BoostHold {
  /** A source (finger, key) started holding. Repeating the same source changes nothing. */
  press(source: string): void
  /** A source released. An unknown source is ignored. */
  release(source: string): void
  /** Reset everything at once (blur, pause, end of game, detach). */
  releaseAll(): void
  isOn(): boolean
}

/**
 * Boost is on while at least one source holds (finger on the button, Shift).
 * onChange is called only on a state change, so repeated release/releaseAll are safe.
 */
export function createBoostHold(onChange: (on: boolean) => void): BoostHold {
  const held = new Set<string>()
  let on = false
  function sync(): void {
    const next = held.size > 0
    if (next === on) return
    on = next
    onChange(on)
  }
  return {
    press(source) {
      held.add(source)
      sync()
    },
    release(source) {
      held.delete(source)
      sync()
    },
    releaseAll() {
      held.clear()
      sync()
    },
    isOn: () => on,
  }
}

// --- Camera zoom (mouse wheel, pinch) and two-finger parsing -----------------

/** Fallback values while config.camera / config.input have no zoom fields (see tuning below). */
const DEFAULT_WHEEL_PER_PX = 0.0012
const DEFAULT_PINCH_GAIN = 1
const DEFAULT_TWO_FINGER_LOCK_PX = 10
// wheel deltaMode: 0 - pixels, 1 - lines, 2 - pages. Lines/pages are converted to pixels.
const WHEEL_LINE_PX = 16
const WHEEL_PAGE_PX = 400

export interface ZoomTuning {
  /** Logarithmic wheel sensitivity: distance multiplier = exp(deltaPx * wheelPerPx). */
  wheelPerPx: number
  /** Pinch exponent: multiplier = (distance_before / distance_after) ^ pinchGain. */
  pinchGain: number
  /** How many pixels must accumulate (pinch in/out or center shift) for the two-finger gesture to be determined. */
  lockPx: number
}

/** The numbers live in config.camera (zoom) and config.input (threshold); the Config type may lack them, so read them defensively. */
export function zoomTuning(config: {
  camera: object
  input: object
}): ZoomTuning {
  const cam = config.camera as { zoomWheelPerPx?: number; zoomPinchGain?: number }
  const inp = config.input as { twoFingerLockPx?: number }
  return {
    wheelPerPx: cam.zoomWheelPerPx ?? DEFAULT_WHEEL_PER_PX,
    pinchGain: cam.zoomPinchGain ?? DEFAULT_PINCH_GAIN,
    lockPx: inp.twoFingerLockPx ?? DEFAULT_TWO_FINGER_LOCK_PX,
  }
}

/** Wheel -> camera distance multiplier. Down (deltaY > 0) - farther (>1), up - closer (<1). */
export function wheelZoomFactor(deltaY: number, deltaMode: number, wheelPerPx: number): number {
  const px = deltaMode === 1 ? deltaY * WHEEL_LINE_PX : deltaMode === 2 ? deltaY * WHEEL_PAGE_PX : deltaY
  return Math.exp(px * wheelPerPx)
}

/** Pinch -> camera distance multiplier: fingers spread (spread grows) - camera closer (<1). */
export function pinchZoomFactor(prevSpread: number, spread: number, gain: number): number {
  if (prevSpread <= 0 || spread <= 0) return 1
  return Math.pow(prevSpread / spread, gain)
}

/** Clamp zoom (distance multiplier) to the config limits. */
export function clampZoom(zoom: number, min: number, max: number): number {
  return zoom < min ? min : zoom > max ? max : zoom
}

/** What two fingers do on the canvas: until the threshold accumulates - 'pending', then until release - one of the two. */
export type TwoFingerMode = 'pending' | 'tilt' | 'zoom'

/**
 * Separates tilt from zoom. moved - how far the finger center has moved since the gesture began (px, absolute),
 * spread - how much the finger spread has changed (px, absolute). Measured from the gesture start, not as an
 * accumulated path: center jitter during a pinch (or spread jitter during a tilt) does not pile up in its favor.
 * The threshold lockPx is the gesture's "dead zone". Pointer events arrive one per finger, so
 * when only one finger has moved, moved and spread are equal (both d/2) - such an ambiguity
 * (difference below a quarter of the threshold) stays 'pending' until the second finger moves.
 * The decision is not revisited afterwards: otherwise jitter in one gesture would break the other.
 */
export function twoFingerMode(moved: number, spread: number, lockPx: number): TwoFingerMode {
  if (moved < lockPx && spread < lockPx) return 'pending'
  if (Math.abs(spread - moved) < lockPx / 4) return 'pending'
  return spread > moved ? 'zoom' : 'tilt'
}
