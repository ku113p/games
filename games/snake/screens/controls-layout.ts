// screens/controls-layout.ts - which lines the controls screen shows. Pure: no DOM, no i18n (the wording is picked by the view).
// What each line says is read out of the input layer (input/controls-doc.ts: key names, pad buttons); here only the selection and order:
// per control scheme, and per kind of device (a stick exists only on a touch device, key caps only where there is a keyboard).
import type { InputScheme } from '../input/index'

/** One numbered line of the diagram legend. */
export type ControlId = 'swipe' | 'tap' | 'doubleTap' | 'arrows' | 'axisButtons' | 'boost' | 'stick' | 'reset' | 'pause'

/** What the device can do. Read from the browser's pointer media queries by the view (`any-pointer`). */
export interface InputKinds {
  /** A touch screen: the camera stick and two-finger gestures exist. */
  readonly touch: boolean
  /** A mouse or trackpad, i.e. (in practice) a keyboard: the key list is shown. */
  readonly keyboard: boolean
}

const BY_SCHEME: Readonly<Record<InputScheme, readonly ControlId[]>> = {
  swipes: ['swipe', 'tap', 'doubleTap', 'boost', 'stick', 'reset', 'pause'],
  taps: ['arrows', 'axisButtons', 'boost', 'stick', 'reset', 'pause'],
}

/** The numbered lines for a scheme, in reading order. The stick is dropped where it does not exist (no touch screen). */
export function controlLines(scheme: InputScheme, kinds: InputKinds): ControlId[] {
  return BY_SCHEME[scheme].filter((id) => id !== 'stick' || kinds.touch)
}

/** The key list goes first for a keyboard-only device, after the touch diagram otherwise. It is absent without a keyboard. */
export function keyListPlacement(kinds: InputKinds): 'first' | 'last' | 'none' {
  if (!kinds.keyboard) return 'none'
  return kinds.touch ? 'last' : 'first'
}
