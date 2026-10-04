// The level data format (PLAN.md section 1): an ASCII floor plan on a grid + a list of entities.
// Levels live in levels/*.ts as plain data; core/grid.ts turns the plan into the runtime grid.
//
// Plan characters (one per cell, cell = LevelDef.cell metres; row 0 is the north edge, +z goes south, +x east):
//   #  wall (solid, floor to ceiling)
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
  /** Ids of what it controls: red walls open for good; lasers and drones are paused for terminal.pauseSec. */
  targets: readonly string[]
  /** 0..1, passed to the hacking mini-game. */
  difficulty: number
}

/**
 * A spawn gate: a hatch alarm drones fly in through (and leave by). `at` is the floor cell in front of it; `wall` is
 * the wall of that cell it is cut into ('up' = a hatch in the ceiling above the cell, the default).
 */
export interface SpawnDef {
  kind: 'spawn'
  at: Cell
  wall?: Side | 'up'
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

export type EntityDef = VideoCameraDef | SoundCameraDef | MotionSensorDef | DroneDef | LaserDef | RedWallDef | TerminalDef | SpawnDef | CoverDef

export interface LevelDef {
  id: string
  /** Key of the level name in texts/en.json. */
  nameKey: string
  /** Size of one plan cell, metres. */
  cell: number
  heightStep: number
  /** Ceiling height above y = 0, metres. */
  ceiling: number
  /** Low cover height above its floor. */
  coverHeight: number
  /** Niche roof height above its floor. */
  nicheHeight: number
  /** Initial facing at the start (where the camera looks). */
  startFacing: Side
  plan: readonly string[]
  heights?: readonly string[]
  entities: readonly EntityDef[]
}
