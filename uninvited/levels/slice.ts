// The Day 2 vertical slice: one run through the open data city, 2-3 minutes, passable quietly (stealth + hacking) and
// by force.
// Format: core/level.ts. One plan cell = 2 m. Row 0 is north; the path runs S (bottom left) -> north -> east ->
// north through the hall -> west to the artifact (top left).
//
//  1. Start corridor: a light bridge over the void, then a video camera sweeps a widening with low cover; sneak behind
//     the blocks. Ramp up to C1.
//  2. East corridor (raised): a motion sensor - walk, do not sprint or jump. Drop down the ledge. Drone 1 patrols;
//     the laser grid blocks the way. Terminal T2 on the north wall has two free-standing server blocks (south and east of it, a gap between them, no niche): crouch there
//     and the drone does not see you while you hack (it pauses the lasers and drone 1). C2 behind the lasers.
//     A short roofed passage leads up to the hall.
//  3. The hall (open sky): a sound camera (sprinting is loud), a second video camera, drone 2. Terminal T1 on the north wall,
//     with two free-standing server blocks beside it, opens the red wall in the top corridor and pauses drone 2 - the window to slip out. C3 behind it, a ramp up to the artifact.
//  4. The top corridor to the artifact: warden 1 walks a round - it stands at the east end watching the way in, walks
//     west and checks a server rack, walks back. Wait behind the rack east of the checkpoint until it walks away,
//     follow it and slip past behind its back while it checks the rack.
//  By force: run the lasers (they burn), break cameras and drones; at alarm 3 waves come out of the spawn gates,
//  and after three cleared waves the firewall drops - every red wall opens.
//  Spawn gates (hatches in the slabs, portals in the sky) are where alarm drones come in and leave.
//  The landmark tower far to the north-west marks where the artifact is.
import type { LevelDef } from '../core/level'

export const slice: LevelDef = {
  id: 'slice',
  nameKey: 'level.slice',
  cell: 2,
  heightStep: 0.5,
  ceiling: 5.2,
  blockTop: 8,
  coverHeight: 1.1,
  nicheHeight: 1.35, // unused: the slice has no niches (server blocks instead)
  startFacing: 'n',
  mayFromStart: true,
  // The open city (DESIGN 6): the walkable platforms are ringed by slabs ('#') and hex blocks ('H'); low parapets
  // ('2' in tops) on the outer edges look out over the void ('_'), where towers rise from the dark and data rivers
  // flow far below. A one-cell light bridge crosses the void in the start corridor (rows 29-30).
  // prettier-ignore
  plan: [
    '_###########################____', //  0
    '_#.....<<.......C...D......#__#_', //  1
    '_#..A..<<...........D......#__#_', //  2
    '_#.....#################...#____', //  3
    '_#.....#________########...##H__', //  4
    '_#######________#..T.........H__', //  5
    '__________##____#............H__', //  6
    '__HH______##____#...~~.......H##', //  7
    '__HH____________#............H##', //  8
    '______##________#......~~....H__', //  9
    '______##____HH__#............H__', // 10
    '___#________HH__#............H__', // 11
    '________________######...####H__', // 12
    '_#####HHH######HHH####...#______', // 13
    '_#...........T...=.......#______', // 14
    '_#...............=..C....#___##_', // 15
    '_#...............=.......#___##_', // 16
    '_#.C.#####################______', // 17
    '_#^^^#_______________##_________', // 18
    '_#^^^#________HHH_______HHH_____', // 19
    '_#...#___##___HHH_______HHH_____', // 20
    '##...##__##_____________________', // 21
    '#.....#_____________________HH__', // 22
    '#.~...#____________##_______HH__', // 23
    '#....~#____________##___________', // 24
    '#.....#_____##__________________', // 25
    '#.~...#_____##__________________', // 26
    '#...~.#_____##__________##______', // 27
    '#.....#_________________##______', // 28
    '___.__#__________##_____________', // 29
    '___.__#_##_______##_____________', // 30
    '#.....#_##______________________', // 31
    '#..S..#____________________HHH__', // 32
    '#.....#____________________HHH__', // 33
    '#######_________________________', // 34
  ],
  // Floor heights in 0.5 m steps: the artifact dais (1.5 m), the raised start of the east corridor (1 m); the parapets
  // next to them stand at the same height.
  // prettier-ignore
  heights: [
    '.3333333........................', //  0
    '.333333.........................', //  1
    '.333333.........................', //  2
    '.333333.........................', //  3
    '.333333.........................', //  4
    '.333333.........................', //  5
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
    '.2222..22222....................', // 17
    '.2..............................', // 18
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
  // Block heights (config world.tops): '2' a parapet you can jump onto, '6'-'9' slabs, 'a'-'d' towers.
  // prettier-ignore
  tops: [
    '.555353555555555553555553539....', // 0
    '.5.........................9..9.', // 1
    '.5.........................9..9.', // 2
    '.5.....777799998888aaaa7...9....', // 3
    '.5.....8........99988888...979..', // 4
    '.5355557........a............8..', // 5
    '..........dd....9............9..', //  6
    '..cc......dd....a............8bb', //  7
    '..cc............a............9bb', //  8
    '......bb........9............8..', //  9
    '......bb....aa..a............9..', // 10
    '...9........aa..a............8..', // 11
    '................888889...98888..', // 12
    '.889998889998889998889...9......', // 13
    '.7.......................7......', // 14
    '.7.......................7...cc.', // 15
    '.7.......................7...cc.', // 16
    '.3...665353566655555553537......', // 17
    '.4...6...............77.........', // 18
    '.5...6........aaa.......999.....', // 19
    '.5...6...cc...aaa.......999.....', // 20
    '55...67..cc.....................', // 21
    '7.....7.....................dd..', // 22
    '5.....7............bb.......dd..', // 23
    '5.....7............bb...........', // 24
    '5.....7.....dd..................', // 25
    '7.....7.....dd..................', // 26
    '6.....7.....dd..........aa......', // 27
    '5.....7.................aa......', // 28
    '......7..........cc.............', // 29
    '......7.aa.......cc.............', // 30
    '5.....7.aa......................', // 31
    '5.....7....................888..', // 32
    '5.....6....................888..', // 33
    '5353536.........................', // 34
  ],
  // the passage from the east corridor up to the hall is the one enclosed stretch: a breather under a roof
  roofs: [{ from: [22, 12], to: [24, 13], height: 4.2 }],
  // One firewall arena: the whole slice; its lockdown opens the one red wall.
  arenas: [{ id: 'slice', from: [0, 0], to: [31, 25], walls: ['wall1'] }],
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
    // a long free-standing server block south of T2, a metre off the wall (no niche, open at both ends): crouch behind it
    { kind: 'cover', at: [13, 14], size: [6.8, 0.6, 1.4], offset: [1.6, 0.3] },
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
    // a long free-standing server block south of T1, a metre off the wall (no niche, open at both ends): crouch behind it
    { kind: 'cover', at: [19, 5], size: [6, 0.8, 1.4], offset: [1.4, 0.4] },
    // a few hex modules in the hall to break the camera's view, and two hex towers in its corners
    { kind: 'hex', at: [22, 8], radius: 0.8, height: 1.4 },
    { kind: 'hex', at: [25, 10], radius: 0.8, height: 1.4 },
    { kind: 'hex', at: [28, 5], radius: 1.0, height: 7, offset: [0.3, -0.3] },
    { kind: 'hex', at: [17, 10], radius: 0.9, height: 3.2, offset: [0.4, 0] },
    { kind: 'hex', at: [20, 10], radius: 0.55, height: 1.2 },
    { kind: 'redWall', id: 'wall1', at: [20, 1] },
    { kind: 'motionSensor', id: 'sensor2', at: [24, 2] },
    { kind: 'spawn', at: [28, 11], wall: 'e' },
    { kind: 'spawn', at: [24, 8], wall: 'down' },
    { kind: 'spawn', at: [26, 1], wall: 'e' },
    { kind: 'spawn', at: [10, 2], wall: 's' },
    // 4. the warden's round in the top corridor: the rack it checks (against the south wall), a rack to wait behind
    { kind: 'warden', id: 'warden1', at: [14, 1], route: [{ at: [14, 1], waitSec: 4, look: 'e' }, { at: [10, 2], waitSec: 5, look: 's' }] },
    { kind: 'cover', at: [10, 2], size: [1.6, 0.4, 1.3], offset: [0, 0.8] },
    { kind: 'cover', at: [18, 2], size: [0.6, 1.8, 1.4], offset: [0, 0.1] },
    // the core tower far away, beyond the artifact
    { kind: 'landmark', at: [-100, -130], height: 170, radius: 10 },
  ],
}
