// Единственное место, где вид узнаёт фазу камеры.
// Правило 2 AGENTS.md: вид читает состояние только через queries.

import type { GameState } from '../core/state'
import { gameMode } from '../core/queries'

export type ViewMode = 'plane' | 'free'

export function viewMode(s: GameState): ViewMode {
  return gameMode(s)
}
