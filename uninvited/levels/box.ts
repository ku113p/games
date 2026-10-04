// The test box (WP0): one 30 x 20 m room at cell = 1 m with two windows, a crack in the floor, a fireplace and a medkit.
// The default level until the mansion floors (l1, l2, l3, roof) exist. Plan: the outer ring is wall; the windows and the
// fireplace are wall cells of the ring with a spawn point on the floor in front of them.
import type { LevelDef } from '../core/level'

const COLS = 32
const ROWS = 22

/** The plan, built from the room's rectangle: the ring is wall, windows in the north wall, a fireplace in the south wall. */
function plan(): string[] {
  const rows: string[] = []
  for (let r = 0; r < ROWS; r++) {
    let line = ''
    for (let c = 0; c < COLS; c++) {
      const ring = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1
      let ch = ring ? '#' : '.'
      if (r === 0 && (c === 8 || c === 23)) ch = 'W'
      if (r === ROWS - 1 && c === 16) ch = 'F'
      if (r === 17 && c === 16) ch = 'S'
      line += ch
    }
    rows.push(line)
  }
  return rows
}

export const box: LevelDef = {
  id: 'box',
  nameKey: 'level.box',
  cell: 1,
  heightStep: 0.5,
  ceiling: 9,
  blockTop: 9,
  coverHeight: 0.9,
  nicheHeight: 1.3,
  startFacing: 'n',
  plan: plan(),
  rooms: [{ id: 'box', from: [1, 1], to: [COLS - 2, ROWS - 2], ceiling: 9, kind: 'hall', wall: 'panel', floor: 'oak' }],
  route: [
    [16, 17],
    [16, 3],
  ],
  stages: [
    {
      id: 'box',
      trigger: { from: [1, 1], to: [COLS - 2, ROWS - 2] },
      respawn: [16, 17],
      facing: 'n',
      profile: 'box',
      spawns: ['window-w', 'window-e', 'fireplace', 'crack'],
    },
  ],
  entities: [
    { kind: 'spawn', id: 'window-w', at: [8, 1], wall: 'n', type: 'window' },
    { kind: 'spawn', id: 'window-e', at: [23, 1], wall: 'n', type: 'window' },
    { kind: 'spawn', id: 'fireplace', at: [16, 20], wall: 's', type: 'fireplace', look: 'fire' },
    { kind: 'spawn', id: 'crack', at: [24, 10], wall: 'down', type: 'crack' },
    { kind: 'medkit', at: [14, 10] },
  ],
}
