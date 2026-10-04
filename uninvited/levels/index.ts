// The level registry: main.ts picks one by `?level=<id>` in the URL; the first one is the default.
import type { LevelDef } from '../core/level'
import { l1 } from './l1'
import { slice } from './slice'

export const levels: readonly LevelDef[] = [l1, slice]

/** The level with this id, or the default (the first) one. */
export function levelById(id: string | null): LevelDef {
  return levels.find((l) => l.id === id) ?? (levels[0] as LevelDef)
}
