// The level registry: main.ts picks one by `?level=<id>` in the URL; the first one is the default.
import type { LevelDef } from '../core/level'
import { box } from './box'

export const levels: readonly LevelDef[] = [box]

/** The level with this id, or the default (the first) one. */
export function levelById(id: string | null): LevelDef {
  return levels.find((l) => l.id === id) ?? (levels[0] as LevelDef)
}
