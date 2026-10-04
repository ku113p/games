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
  prologue: {
    id: 'prologue',
    music: 'office',
    shots: [
      { art: 'O3-office-master.jpg', lines: [], minSec: 4, move: 'in', origin: '20% 55%', zoom: 0.08 },
      { art: 'OP4-steve.jpg', lines: [], minSec: 3, move: 'right' },
      { art: 'OP2-jim-door.jpg', lines: ['story.prologue.1', 'story.prologue.2'], move: 'in', origin: '50% 35%', zoom: 0.1 },
      { art: 'OP3-johnny-hands.jpg', lines: [], minSec: 2.5, move: 'in', origin: '50% 98%', zoom: 0.9 },
      { art: 'OP3-johnny-hands.jpg', lines: ['story.prologue.3', 'story.prologue.4', 'story.prologue.5'], move: 'in', origin: '65% 30%', zoom: 0.07 },
      { art: 'OP4-steve.jpg', lines: ['story.prologue.6'], move: 'left' },
      { art: 'P5-box.jpg', lines: ['story.prologue.7'], move: 'down', minSec: 3 },
      { art: 'OP5-box.jpg', lines: [], minSec: 4, move: 'in', origin: '70% 50%', zoom: 0.1 },
      { art: 'P6-gate.jpg', lines: ['story.prologue.8', 'story.prologue.9'], move: 'out', minSec: 6.5 },
    ],
  },
  room1: { id: 'room1', music: 'room', shots: [{ art: 'A2-room-plate.jpg', lines: ['story.room1.1', 'story.room1.2'], move: 'in', origin: '60% 60%' }], button: 'story.jackIn' },
  notes: { id: 'notes', music: 'menu', shots: [{ art: 'NN2-net-server-hall.jpg', lines: ['story.notes.1', 'story.notes.2', 'story.notes.3', 'story.notes.4'], move: 'in', doc: true }] },
  room2: { id: 'room2', music: 'room', shots: [{ art: 'F1-delivery.jpg', lines: ['story.room2.1', 'story.room2.2'], move: 'in', origin: '45% 55%' }], button: 'story.jackIn' },
  l2: { id: 'l2', music: 'menu', shots: [{ art: 'NF6-data-metropolis.jpg', lines: ['story.l2.1', 'story.l2.2'], move: 'in' }], button: 'story.continue' },
  l3: { id: 'l3', music: 'menu', shots: [{ art: 'NF7-crypto-lattice.jpg', lines: ['story.l3.1', 'story.l3.2'], move: 'in' }], button: 'story.continue' },
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
