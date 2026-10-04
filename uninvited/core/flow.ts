// The scene flow (DESIGN 5, 12 "as built"): title -> office prologue -> room -> level 1 -> Jim's notes -> room -> level 2 (soon)
// -> level 3 (soon) -> ending -> title. Pure data and rules: main.ts runs the scenes, view/story-data.ts says what the story scenes show.
// The scene the player is in is saved (the storage adapter) so the title can offer "Continue".

export const SCENES = ['prologue', 'room1', 'l1', 'notes', 'room2', 'l2', 'l3', 'ending'] as const
export type SceneId = (typeof SCENES)[number]
export type AnyScene = SceneId | 'title'

/** The scenes that are a playable level (the rest are story cards). */
export const LEVEL_SCENES: readonly SceneId[] = ['l1']

export function isSceneId(x: unknown): x is SceneId {
  return typeof x === 'string' && (SCENES as readonly string[]).includes(x)
}

/** The scene after `id`; the one after the ending is the title. */
export function nextScene(id: SceneId): AnyScene {
  const i = SCENES.indexOf(id)
  return SCENES[i + 1] ?? 'title'
}

export function isLevelScene(id: AnyScene): boolean {
  return (LEVEL_SCENES as readonly string[]).includes(id)
}

const VERSION = 1

export function serializeFlow(id: SceneId): string {
  return JSON.stringify({ version: VERSION, scene: id })
}

/** The saved scene, or null for a missing, broken or old save. */
export function parseFlow(raw: string | null): SceneId | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as { version?: unknown; scene?: unknown }
    return j.version === VERSION && isSceneId(j.scene) ? j.scene : null
  } catch {
    return null
  }
}
