// Controls as data, read out of the input code itself (keyboard.ts, gestures.ts) - never typed in by hand.
// The controls screen and the boost hint show these; if a key is rebound in the input layer, the screen follows.
// Pure: no DOM, no i18n (the wording lives in the dictionaries; only key names are produced here).
import type { ScreenDir } from '../core/state'
import { BOOST_CODES, PAD_BUTTONS } from './gestures'
import { AXIS_CODES, CAMERA_RESET_CODE, PAUSE_CODE, PLANE_CODES } from './keyboard'

export type KeyAction = 'turn' | 'into' | 'out' | 'boost' | 'cameraReset' | 'pause'

/** One line of the keyboard list: alternatives (groups) that do the same thing; each group is a set of key caps. */
export interface KeyRow {
  readonly action: KeyAction
  readonly groups: readonly (readonly string[])[]
}

const ARROWS: Readonly<Record<string, string>> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }

/** The text on a key cap for a physical key code (e.code). */
export function keyLabel(code: string): string {
  const arrow = ARROWS[code]
  if (arrow !== undefined) return arrow
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Shift')) return 'Shift'
  if (code === 'Escape') return 'Esc'
  return code
}

const TURN_ORDER: readonly ScreenDir[] = ['up', 'left', 'down', 'right']

function codesFor<V>(map: Readonly<Record<string, V>>, want: V): string[] {
  return Object.keys(map).filter((c) => map[c] === want)
}

function uniq(labels: string[]): string[] {
  return [...new Set(labels)]
}

/** The keyboard lines, derived from the real key maps. */
export function keyRows(): KeyRow[] {
  const turnCodes = TURN_ORDER.flatMap((d) => codesFor(PLANE_CODES, d))
  const arrows = turnCodes.filter((c) => c.startsWith('Arrow'))
  const letters = turnCodes.filter((c) => !c.startsWith('Arrow'))
  return [
    { action: 'turn', groups: [arrows.map(keyLabel), letters.map(keyLabel)] },
    { action: 'into', groups: [codesFor(AXIS_CODES, 'into').map(keyLabel)] },
    { action: 'out', groups: [codesFor(AXIS_CODES, 'out').map(keyLabel)] },
    { action: 'boost', groups: uniq(BOOST_CODES.map(keyLabel)).map((l) => [l]) },
    { action: 'cameraReset', groups: [[keyLabel(CAMERA_RESET_CODE)]] },
    { action: 'pause', groups: [[keyLabel(PAUSE_CODE)]] },
  ]
}

/** Boost key names for the hint ("Shift / Space"). */
export function boostKeyLabels(): string[] {
  return uniq(BOOST_CODES.map(keyLabel))
}

/** The pad buttons that exist (data-pad names), in the code's order. */
export function padButtons(): readonly string[] {
  return PAD_BUTTONS
}
