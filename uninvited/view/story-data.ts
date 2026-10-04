// What the story scenes show (DESIGN 5): the shot lists of the still montages. A shot is one still of art/generated with a slow move and
// 0-4 text lines (keys of texts/en.json; a line wrapped in *stars* is narration, the rest is speech or a screen). The texts are DRAFTS
// (docs/roles/08-narrative): the designer edits them in texts/en.json. The office prologue follows the camera role's 9-shot list.
import type { SceneId } from '../core/flow'

export type Move = 'in' | 'out' | 'left' | 'right' | 'down' | 'still'
export type SceneMusic = 'office' | 'room' | 'menu'

export interface StoryShot {
  /** File name in art/generated (listed in view/story-art.ts). */
  art: string
  /** Text keys, shown together. */
  lines: readonly string[]
  /** Shortest time on screen (s); the reading time of the lines can make it longer. */
  minSec?: number
  move?: Move
  /** Zoom origin, CSS (a crop: a point of the still the move heads for). */
  origin?: string
  /** Total scale change of the move (default config story.panZoom); a crop uses a big one. */
  zoom?: number
  /** A document: the lines sit in a centred paper-like panel (Jim's notes). */
  doc?: boolean
}

export interface StorySpec {
  id: SceneId
  music: SceneMusic
  shots: readonly StoryShot[]
  /** Text key of the button on the last shot: the scene waits for it instead of moving on by itself. */
  button?: string
  /** A sting played when the scene starts. */
  sting?: 'end'
}

export const STORY: Partial<Record<SceneId, StorySpec>> = {
  ending: {
    id: 'ending',
    music: 'menu',
    sting: 'end',
    shots: [
      { art: 'S6-cctv-empty.jpg', lines: ['story.ending.1'], move: 'in' },
      { art: 'S6-cctv-empty.jpg', lines: ['story.ending.2'], move: 'still', minSec: 3 },
    ],
    button: 'story.toTitle',
  },
}
