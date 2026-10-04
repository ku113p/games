// The Day 2 vertical slice: one corridor, 2-3 minutes, passable quietly (stealth + hacking) and by force.
// Format: core/level.ts. One plan cell = 2 m. Row 0 is north; the path runs S (bottom left) -> north -> east ->
// north through the hall -> west to the artifact (top left).
//
//  1. Start corridor: a video camera sweeps a widening with low cover; sneak behind the blocks. Ramp up to C1.
//  2. East corridor (raised): a motion sensor - walk, do not sprint or jump. Drop down the ledge. Drone 1 patrols;
//     the laser grid blocks the way. Terminal T2 on the north wall sits behind an L of server blocks: crouch there
//     and the drone does not see you while you hack (it pauses the lasers and drone 1). C2 behind the lasers.
//  3. The hall: a sound camera (sprinting is loud), a second video camera, drone 2. Terminal T1 on the north wall,
//     behind an L of server blocks, opens the red wall in the top corridor and pauses drone 2 - the window to slip out. C3 behind it, a ramp up to the artifact.
//  By force: run the lasers (they burn), break cameras and drones; at alarm 3 waves come out of the spawn gates,
//  and after three cleared waves the firewall drops - every red wall opens.
//  Spawn gates (hatches in the walls and the ceiling) are where alarm drones come in and leave.
import type { LevelDef } from '../core/level'

export const slice: LevelDef = {
  id: 'slice',
  nameKey: 'level.slice',
  cell: 2,
  heightStep: 0.5,
  ceiling: 5.2,
  coverHeight: 1.1,
  nicheHeight: 1.35, // unused: the slice has no niches (server blocks instead)
  startFacing: 'n',
  // prettier-ignore
  plan: [
    '################################', //  0
    '##.....<<.......C...D......#####', //  1
    '##..A..<<...........D......#####', //  2
    '##.....#################...#####', //  3
    '##.....#################...#####', //  4
    '#################..T.........###', //  5
    '#################............###', //  6
    '#################...~~.......###', //  7
    '#################............###', //  8
    '#################......~~....###', //  9
    '#################............###', // 10
    '#################............###', // 11
    '######################...#######', // 12
    '######################...#######', // 13
    '##...........T...=.......#######', // 14
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
    { kind: 'spawn', at: [5, 31], wall: 'e' },
    { kind: 'spawn', at: [1, 22], wall: 'w' },
    // 2. east corridor
    { kind: 'motionSensor', id: 'sensor1', at: [7, 15] },
    { kind: 'drone', id: 'drone1', patrol: [[11, 15], [23, 15]] },
    { kind: 'laser', id: 'laser1', at: [17, 15] },
    { kind: 'terminal', id: 't2', at: [13, 14], targets: ['laser1', 'drone1'], difficulty: 0 },
    // the L of server blocks in front of T2 (south, east); come in from the west
    { kind: 'cover', at: [13, 14], size: [4, 0.6, 1.4], offset: [0, 0.5] },
    { kind: 'cover', at: [13, 14], size: [0.6, 1.3, 1.4], offset: [1.7, -0.35] },
    // one more past the lasers, to wait for the drone's back
    { kind: 'cover', at: [21, 16], size: [1.6, 0.6, 1.4], offset: [0, -0.2] },
    { kind: 'spawn', at: [3, 14], wall: 'n' },
    { kind: 'spawn', at: [24, 16], wall: 'e' },
    { kind: 'spawn', at: [22, 14], wall: 'up' },
    // 3. the hall and the top corridor
    { kind: 'soundCamera', id: 'mic1', at: [28, 8], wall: 'e' },
    { kind: 'videoCamera', id: 'cam2', at: [17, 9], wall: 'w', sweep: [-40, 40], periodSec: 10, phase: 0.3 },
    { kind: 'drone', id: 'drone2', patrol: [[21, 10], [27, 10], [27, 6], [21, 6]] },
    { kind: 'terminal', id: 't1', at: [19, 5], targets: ['wall1', 'drone2'], difficulty: 0.3 },
    // the L of server blocks in front of T1 (south, east); come in from the west
    { kind: 'cover', at: [19, 5], size: [3.2, 0.6, 1.4], offset: [-0.1, 0.5] },
    { kind: 'cover', at: [19, 5], size: [0.6, 1.3, 1.4], offset: [1.2, -0.35] },
    // a few more in the hall to break the camera's view
    { kind: 'cover', at: [22, 8], size: [1.6, 0.6, 1.4] },
    { kind: 'cover', at: [25, 10], size: [0.6, 1.6, 1.4] },
    { kind: 'redWall', id: 'wall1', at: [20, 1] },
    { kind: 'motionSensor', id: 'sensor2', at: [24, 2] },
    { kind: 'spawn', at: [28, 11], wall: 'e' },
    { kind: 'spawn', at: [24, 8], wall: 'up' },
    { kind: 'spawn', at: [26, 1], wall: 'e' },
    { kind: 'spawn', at: [10, 2], wall: 's' },
  ],
}
