// Entry point of the input layer: touch (touch.ts) + keyboard (keyboard.ts).
// Exactly the signature from the contract - do not change.
import type { AxisDir, ScreenDir } from '../core/state'
import type { Config } from '../core/rules'
import { attachKeyboard } from './keyboard'
import { attachTouch } from './touch'

export type InputScheme = 'swipes' | 'taps'

export interface InputHandlers {
  onTurn(dir: ScreenDir): void
  onAxis(dir: AxisDir): void
  /** Optional: false - the third axis is unavailable right now ('free' mode), taps and Q/E are ignored. If absent, always true. */
  axisEnabled?(): boolean
  /** Optional: true - boost held, false - released (always arrives as a pair; reset on blur/detach). */
  onBoost?(on: boolean): void
  /**
   * Optional: camera tilt increment in radians (mouse with right button / two fingers together).
   * An increment, not an absolute: the accumulated value and its limits are kept by the caller; the tilt stays
   * after the gesture and goes away only on onCameraReset.
   */
  onCameraTiltBy?(dYaw: number, dPitch: number): void
  /**
   * Optional: camera distance multiplier (mouse wheel, two-finger pinch). > 1 - farther, < 1 - closer.
   * Also an increment: the limits and the current zoom are kept by the caller.
   */
  onCameraZoomBy?(factor: number): void
  /** Optional: reset camera tilt and zoom (R key; the on-screen button is wired by main itself). */
  onCameraReset?(): void
  /** Escape on PC: pause or exit to the menu. */
  onPause?(): void
}

export function attachInput(
  el: HTMLElement,
  scheme: InputScheme,
  config: Config,
  h: InputHandlers,
): () => void {
  const detachTouch = attachTouch(el, scheme, config, h)
  const detachKeyboard = attachKeyboard(h)

  return () => {
    detachTouch()
    detachKeyboard()
  }
}
