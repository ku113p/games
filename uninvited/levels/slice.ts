// The Day 2 vertical slice: one corridor, 2-3 minutes, passable quietly (stealth + hacking) and by force.
// Format: core/level.ts. One plan cell = 2 m. Row 0 is north; the path runs S (bottom left) -> north -> east ->
// north through the hall -> west to the artifact (top left).
//
//  1. Start corridor: a video camera sweeps a widening with low cover; sneak behind the blocks. Ramp up to C1.
//  2. East corridor (raised): a motion sensor - walk, do not run. Drop down the ledge. Drone 1 patrols; the laser
//     grid blocks the way. The niche on the north wall hides you (drones cannot get in) and holds terminal T2,
//     which pauses the lasers and drone 1. C2 behind the lasers.
//  3. The hall: a sound camera (running is loud), a second video camera, drone 2. Terminal T1 in a niche in the
//     north wall opens the red wall in the top corridor. C3 behind it, a ramp up to the artifact.
//  By force: run the lasers (they burn), break cameras and drones; at alarm 3 waves come, and after three cleared
//  waves the firewall drops - every red wall opens.
import type { LevelDef } from '../core/level'

export const slice: LevelDef = {
  id: 'slice',
  nameKey: 'level.slice',
  cell: 2,
  heightStep: 0.5,
  ceiling: 5.2,
  coverHeight: 1.1,
  nicheHeight: 1.35,
  startFacing: 'n',
  // prettier-ignore
  plan: [
    '################################', //  0
    '##.....<<.......C...D......#####', //  1
    '##..A..<<...........D......#####', //  2
    '##.....#################...#####', //  3
    '##.....############n####...#####', //  4
    '#################............###', //  5
    '#################............###', //  6
    '#################...~~.......###', //  7
    '#################............###', //  8
    '#################......~~....###', //  9
    '#################............###', // 10
    '#################............###', // 11
    '######################...#######', // 12
    '#############n########...#######', // 13
    '##...............=.......#######', // 14
    '##...............=..C....#######', // 15
    '##...............=.......#######', // 16
    '##.C.###########################', // 17
    '##^^^###########################', // 18
    '##^^^###########################', // 19
    '##...###########################', // 20
    '##...###########################', // 21
    '#.....##########################', // 22
    '#.~...##########################', // 23
    '#....~##########################', // 24
    '#.....##########################', // 25
    '#.~...##########################', // 26
    '#...~.##########################', // 27
    '#.....##########################', // 28
    '##...###########################', // 29
    '##...###########################', // 30
    '#.....##########################', // 31
    '#..S..##########################', // 32
    '#.....##########################', // 33
    '################################', // 34
  ],
  // Floor heights in 0.5 m steps: the artifact dais (1.5 m), the raised start of the east corridor (1 m).
  // prettier-ignore
  heights: [
    '................................', //  0
    '..33333.........................', //  1
    '..33333.........................', //  2
    '..33333.........................', //  3
    '..33333.........................', //  4
    '................................', //  5
    '................................', //  6
    '................................', //  7
    '................................', //  8
    '................................', //  9
    '................................', // 10
    '................................', // 11
    '................................', // 12
    '................................', // 13
    '..222222222.....................', // 14
    '..222222222.....................', // 15
    '..222222222.....................', // 16
    '..222...........................', // 17
    '................................', // 18
    '................................', // 19
    '................................', // 20
    '................................', // 21
    '................................', // 22
    '................................', // 23
    '................................', // 24
    '................................', // 25
    '................................', // 26
    '................................', // 27
    '................................', // 28
    '................................', // 29
    '................................', // 30
    '................................', // 31
    '................................', // 32
    '................................', // 33
    '................................', // 34
  ],
  entities: [
    // 1. start corridor
    { kind: 'videoCamera', id: 'cam1', at: [5, 25], wall: 'e', sweep: [-55, 55], periodSec: 8 },
    { kind: 'spawn', at: [4, 31] },
    { kind: 'spawn', at: [1, 22] },
    // 2. east corridor
    { kind: 'motionSensor', id: 'sensor1', at: [7, 15] },
    { kind: 'drone', id: 'drone1', patrol: [[11, 15], [23, 15]] },
    { kind: 'laser', id: 'laser1', at: [17, 15] },
    { kind: 'terminal', id: 't2', at: [13, 13], targets: ['laser1', 'drone1'], difficulty: 0 },
    { kind: 'spawn', at: [3, 14] },
    { kind: 'spawn', at: [24, 16] },
    // 3. the hall and the top corridor
    { kind: 'soundCamera', id: 'mic1', at: [28, 8], wall: 'e' },
    { kind: 'videoCamera', id: 'cam2', at: [17, 9], wall: 'w', sweep: [-40, 40], periodSec: 10, phase: 0.3 },
    { kind: 'drone', id: 'drone2', patrol: [[21, 10], [27, 10], [27, 6], [21, 6]] },
    { kind: 'terminal', id: 't1', at: [19, 4], targets: ['wall1'], difficulty: 0.3 },
    { kind: 'redWall', id: 'wall1', at: [20, 1] },
    { kind: 'motionSensor', id: 'sensor2', at: [24, 2] },
    { kind: 'spawn', at: [28, 11] },
    { kind: 'spawn', at: [26, 1] },
    { kind: 'spawn', at: [10, 2] },
  ],
}
