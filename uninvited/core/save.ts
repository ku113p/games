// Saves and stage snapshots (owner: WP1): the game state is plain data, so a save is its JSON. `main.ts` snapshots the
// state when a stage starts (a death restarts the stage from it) and writes it to storage (Continue); the storage
// itself (localStorage) is an adapter's job.
import { syncWorld } from './rules/stages'
import type { GameState, Sim } from './state'

export interface SaveData {
  version: number
  levelId: string
  state: GameState
}

const VERSION = 6

export function serializeState(s: GameState): string {
  const data: SaveData = { version: VERSION, levelId: s.levelId, state: s }
  return JSON.stringify(data)
}

/** Parses a save for this level, or null when it is missing, broken or from another level / version. */
export function parseSave(json: string | null, levelId: string): GameState | null {
  if (!json) return null
  try {
    const data = JSON.parse(json) as Partial<SaveData>
    if (data.version !== VERSION || data.levelId !== levelId || !data.state) return null
    // A save never holds a dead player.
    data.state.phase = 'playing'
    return data.state
  } catch {
    return null
  }
}

/** Makes the physical world and caches match a restored state (portcullises). */
export function applyLoadedState(s: GameState, sim: Sim): void {
  sim.events.length = 0
  syncWorld(s, sim)
}
