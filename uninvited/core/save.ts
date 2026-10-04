// Saves (DESIGN 6): the game state is plain data, so a save is its JSON. Checkpoints save automatically;
// the storage itself (localStorage) is an adapter's job.
import { syncWorld } from './rules/terminals'
import { createMay, type GameState, type MayState, type Sim } from './state'

export interface SaveData {
  version: number
  levelId: string
  state: GameState
}

const VERSION = 5

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
    const s = data.state
    // A save never holds an open hacking session or a dead player.
    s.hack = null
    s.phase = 'playing'
    s.scan.active = false
    s.may ??= createMay() // saves from before May's progression
    return s
  } catch {
    return null
  }
}

/** Makes the physical world and caches match a restored state (red walls). */
export function applyLoadedState(s: GameState, sim: Sim): void {
  sim.events.length = 0
  sim.noiseCount = 0
  syncWorld(s, sim)
}

/** The same save with its progression replaced (the upgrade screen spent points after the checkpoint saved); null when there is no usable save. */
export function patchSaveMay(json: string | null, may: MayState): string | null {
  if (!json) return null
  try {
    const data = JSON.parse(json) as Partial<SaveData>
    if (!data.state) return null
    data.state.may = may
    return JSON.stringify(data)
  } catch {
    return null
  }
}
