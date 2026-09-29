// The only place where the view learns the camera mode.
// AGENTS.md rule 2: the view reads state only through queries.

import type { GameState } from '../core/state'
import { gameMode } from '../core/queries'

export type ViewMode = 'plane' | 'free'

export function viewMode(s: GameState): ViewMode {
  return gameMode(s)
}
