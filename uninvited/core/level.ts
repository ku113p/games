// The level data format (PLAN.md section 1): an ASCII floor plan on a grid + a list of entities.
// Levels live in levels/*.ts as plain data; core/grid.ts turns the plan into the runtime grid.
//
// The network is an open data city (DESIGN 6): platforms over a dark void, slabs and hex towers of different heights,
// open sky. Only `roofs` put a ceiling over a stretch (the short enclosed passages between arenas).
//
// Plan characters (one per cell, cell = LevelDef.cell metres; row 0 is the north edge, +z goes south, +x east):
//   #  slab: a solid block standing on the cell, as tall as its `tops` character says (a clean NF6 slab)
//   H  hex block: the same solid block, dressed in hex modules (NF4) - the two mix freely
//   _  void: no floor, a drop into the dark. Falling in returns you to the last safe ground (config world.fall);
//      walkers never path into it. A floor cell between void cells is a bridge.
//   .  floor
//   ~  low cover: a block about waist high - hides you only while you crouch; you can jump onto it
//   n  niche: floor under a low roof (drones cannot fit under it); no special hiding rule - the slice uses server blocks
//   ^ v  ramp along north-south;  < >  ramp along west-east. A run of ramp cells slopes linearly between the
//        flat cells at its two ends (the arrow points uphill, for the reader only)
//   =  laser grid (floor you can walk through - it burns and trips the alarm while it is on)
//   D  red wall (blocks while closed; opened by a terminal or when the firewall drops)
//   T  hack terminal (floor; the console sits on the neighbouring wall)
//   C  checkpoint
//   A  the artifact (the level's goal)
//   S  the start
// Heights: an optional second plan of the same size; a digit = floor height in `heightStep` metres, anything else = 0.
//   For a block it is the height its foot stands at.
// Tops: an optional third plan of the same size; on a block ('#' or 'H') a character from config world.tops = how tall
//   the block is above its foot (e.g. '2' low cover you can jump onto, '9' a tower). '.' or no plan = blockTop.
//   Anything but '.' on a cell that is not a block is an error.

/** [col, row] on the plan. */
export type Cell = readonly [number, number]

/** A wall side of a cell: the wall a device is mounted on, or a facing. */
export type Side = 'n' | 'e' | 's' | 'w'

export interface VideoCameraDef {
  kind: 'videoCamera'
  id: string
  at: Cell
  /** Mounted on this wall of the cell, looking away from it. */
  wall: Side
  /** The sweep, in degrees relative to looking straight out of the wall (positive = turned to the left when looking out). */
  sweep: readonly [number, number]
  /** Overrides config videoCamera.sweepPeriodSec. */
  periodSec?: number
  /** Start phase 0..1 of the sweep. */
  phase?: number
}

export interface SoundCameraDef {
  kind: 'soundCamera'
  id: string
  at: Cell
  wall: Side
}

export interface MotionSensorDef {
  kind: 'motionSensor'
  id: string
  at: Cell
}

export interface DroneDef {
  kind: 'drone'
  id: string
  /** Patrol waypoints, looped. The drone starts at the first one. */
  patrol: readonly Cell[]
}

export interface LaserDef {
  kind: 'laser'
  id: string
  /** Any cell of the connected group of '=' cells. */
  at: Cell
}

export interface RedWallDef {
  kind: 'redWall'
  id: string
  /** Any cell of the connected group of 'D' cells. */
  at: Cell
}

export interface TerminalDef {
  kind: 'terminal'
  id: string
  at: Cell
  /** Ids of what it controls: red walls open for good; lasers, drones, wardens and cameras (video or sound) are paused for terminal.pauseSec. */
  targets: readonly string[]
  /** 0..1, passed to the hacking mini-game. */
  difficulty: number
}

/**
 * A spawn gate: a hatch alarm drones fly in through (and leave by). `at` is the floor cell in front of it; `wall` is
 * the side of that cell it is cut into: n/e/s/w = into the slab on that side; 'down' = a hatch in the floor of the
 * cell; 'up' (the default) = from above: a hatch in the roof over the cell, or in the open a portal in the sky.
 */
export interface SpawnDef {
  kind: 'spawn'
  at: Cell
  wall?: Side | 'up' | 'down'
}

/**
 * A server block: a solid box standing on the floor that you crouch behind. Tall enough to hide a crouched hero from
 * cameras and drones by geometry alone, low enough that a standing hero's head and shoulders show over it.
 */
export interface CoverDef {
  kind: 'cover'
  /** The plan cell it stands in (its floor height is used). */
  at: Cell
  /** Width along x, depth along z, height, metres. */
  size: readonly [number, number, number]
  /** Shift of its centre from the cell centre, metres (x, z). */
  offset?: readonly [number, number]
}

/**
 * A hex module (NF4): a solid hexagonal prism standing on the floor - low ones to crouch behind, tall ones as towers.
 * Two corners point along x (east-west), two flat sides face north and south. Mixes freely with `cover` boxes and slabs.
 */
export interface HexDef {
  kind: 'hex'
  /** The plan cell it stands in (its floor height is used). */
  at: Cell
  /** Centre to corner, metres. */
  radius: number
  /** Height above its floor, metres. */
  height: number
  /** Shift of its centre from the cell centre, metres (x, z). */
  offset?: readonly [number, number]
  /** Names the module, for mechanics that move it later (sliding modules); unused by the rules so far. */
  id?: string
}

/**
 * A landmark (view only): the glowing core tower far away that shows where the level's goal is. `at` may lie outside
 * the plan (it usually does); its foot stands at `base` metres (default: far below, in the void).
 */
export interface LandmarkDef {
  kind: 'landmark'
  at: Cell
  /** Top above y = 0, metres. */
  height: number
  /** Footprint half width, metres. */
  radius: number
  base?: number
}

/** A stop on a warden's route. */
export interface WardenStop {
  at: Cell
  /** Stand here about this long, s (varied a little each time). Absent or 0: walk on (now and then it pauses anyway). */
  waitSec?: number
  /** While standing here, face this way: a side, or a yaw in degrees (0 = south / +z, 90 = east / +x). */
  look?: Side | number
}

/**
 * A warden: a walking sentinel program (a guard, separate from the drones). It walks its `route` (looped, starting
 * at `at`), or without a route keeps its post at `at`, facing `post`. It sees in a forward cone that follows its
 * head, hears noise, investigates, and fights in melee or with a slow arm shot when it spots you.
 */
export interface WardenDef {
  kind: 'warden'
  id: string
  at: Cell
  route?: readonly WardenStop[]
  /** The facing at its post (no route). Default: south. */
  post?: Side
  /** A heavy warden: more hit points, slower, a frontal shield against rifle bolts. */
  heavy?: boolean
}

export type EntityDef =
  | VideoCameraDef
  | SoundCameraDef
  | MotionSensorDef
  | DroneDef
  | LaserDef
  | RedWallDef
  | TerminalDef
  | SpawnDef
  | CoverDef
  | HexDef
  | LandmarkDef
  | WardenDef

/** A roof over a rectangle of cells (corners inclusive): the only ceilings in the open city. */
export interface RoofDef {
  from: Cell
  to: Cell
  /** Its underside above y = 0, metres. Default: the level's `ceiling`. */
  height?: number
}

export interface LevelDef {
  id: string
  /** Key of the level name in texts/en.json. */
  nameKey: string
  /** Size of one plan cell, metres. */
  cell: number
  heightStep: number
  /**
   * The nominal room height above y = 0, metres: the default height of roofs, red walls and the artifact's beam.
   * The open city has no ceiling - only `roofs` have one.
   */
  ceiling: number
  /** How tall a block ('#', 'H') is above its foot when its `tops` character is '.' (or there is no tops plan). */
  blockTop?: number
  /** Low cover height above its floor. */
  coverHeight: number
  /** Niche roof height above its floor. */
  nicheHeight: number
  /** Initial facing at the start (where the camera looks). */
  startFacing: Side
  plan: readonly string[]
  heights?: readonly string[]
  tops?: readonly string[]
  roofs?: readonly RoofDef[]
  entities: readonly EntityDef[]
}
