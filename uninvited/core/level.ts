// The level data format (PLAN 3.1): an ASCII floor plan on a grid + rooms, a retreat route, stages and a list of entities.
// Levels live in levels/*.ts as plain data; core/grid.ts turns the plan into the runtime grid. One LevelDef per floor
// (box, l1, l2, l3, roof); the exit cell leads to the next floor.
//
// Plan characters (one per cell, cell = LevelDef.cell metres; row 0 is the north edge, +z goes south, +x east):
//   #  wall, full height to the room ceiling (ghosts pass through)
//   W  wall with a window (impassable; a spawn point when a `spawn` entity stands in front of it)
//   F  fireplace in a wall (impassable; a spawn point)
//   X  broken door (burning / collapsed / webbed / roots, by its entity): impassable, a spawn point
//   .  floor
//   ~  low furniture (a table, a sofa, ~0.9 m): the player and walkers cannot pass; the swarm climbs over it
//   ^ v < >  stairs / ramps (the arrow points uphill)
//   d  doorway (a floor cell with a frame)
//   D  portcullis / grille: closed until a crank or a script opens it (a group of connected D and B cells)
//   B  breakable wall (the tank's entrance): a `D` group the script opens with debris
//   _  outside (the roof: beyond the parapet; no floor; never pathed)
//   S  the start,  E  the exit (stairs up -> the next level; reaching it emits `levelDone`)
// Heights: an optional second plan of the same size; a digit = floor height in `heightStep` metres, anything else = 0.
// Tops: an optional third plan; on a wall cell a character from config world.tops = how tall it is above its foot.
//
// Known leftovers WP5 removes with the grid rewrite: `Grid.blocks` (always empty now), the niche cell kind and `roofs`
// (rooms build them for now).

/** [col, row] on the plan. */
export type Cell = readonly [number, number]

/** A wall side of a cell: the wall a device is mounted on, or a facing. */
export type Side = 'n' | 'e' | 's' | 'w'

export type MonsterKindId = 'rat' | 'spider' | 'beetle' | 'zombie' | 'skeleton' | 'witch' | 'gremlin' | 'bat' | 'ghost'

/**
 * A room: a rectangle of cells (corners inclusive) with its ceiling, camera zone and dressing. Every floor cell lies in
 * exactly one room. Rooms build the ceilings (physics and view) and tell the camera how tall the space is.
 */
export interface RoomDef {
  id: string
  from: Cell
  to: Cell
  /** The ceiling's underside above the room's floor, m. */
  ceiling: number
  kind: 'hall' | 'room' | 'corridor' | 'stair' | 'roof'
  wall?: 'panel' | 'stone' | 'paper'
  floor?: 'oak' | 'marble' | 'carpet'
}

/** A stage's objective (DESIGN 2, 6). */
export type StageObjective =
  | { kind: 'crank'; id: string }
  | { kind: 'reach'; from: Cell; to: Cell }
  | { kind: 'tank' }
  | { kind: 'holdout' }

/** A pinch ambush: fires once when the player enters the rectangle. */
export interface AmbushDef {
  trigger: { from: Cell; to: Cell }
  /** Spawn point ids that send the packs. */
  points: readonly string[]
  packs: readonly { kind: MonsterKindId; count: number }[]
}

/** A piece of the level the player fights through: the director profile and the active spawn points change with it. */
export interface StageDef {
  id: string
  /** Entering this rectangle (cells, corners inclusive) starts the stage. */
  trigger: { from: Cell; to: Cell }
  /** Where a death puts the hero back (the stage start), and where they look. */
  respawn: Cell
  facing: Side
  /** A key of config director.profiles. */
  profile: string
  /** The ids of the spawn points active in this stage. */
  spawns: readonly string[]
  objective?: StageObjective
  /** Ids of `sleepers` entities placed (asleep) in this stage. */
  sleepers?: readonly string[]
  ambush?: readonly AmbushDef[]
  /** Spawn point ids allowed to send packs ahead of the player (pinch ambushes). */
  ahead?: readonly string[]
}

/**
 * A spawn point: where monsters come from. `at` is the floor cell in front of it; `wall` is the side of that cell it is
 * cut into: n/e/s/w = into the wall on that side (a window, a fireplace, a broken door, a wall for ghosts); 'down' = a
 * crack in the floor; 'up' = an opening overhead (the roof's edge).
 */
export interface SpawnPointDef {
  kind: 'spawn'
  id: string
  at: Cell
  wall: Side | 'up' | 'down'
  type: 'window' | 'fireplace' | 'crack' | 'door' | 'wall' | 'edge'
  look?: 'fire' | 'web' | 'roots' | 'rubble'
}

export interface MedkitDef {
  kind: 'medkit'
  at: Cell
}

export interface MannequinDef {
  kind: 'mannequin'
  at: Cell
  facing: Side
}

export interface ChandelierDef {
  kind: 'chandelier'
  at: Cell
  /** Hanging height above the floor, m. */
  height: number
  /** When it falls, the debris blocks these cells (an obstacle for the later retreat line). */
  debris: { from: Cell; to: Cell }
}

export interface LetterDef {
  kind: 'letter'
  at: Cell
}

export interface CrankDef {
  kind: 'crank'
  id: string
  at: Cell
  wall: Side
  /** The id of the portcullis it opens. */
  opens: string
}

export interface PortcullisDef {
  kind: 'portcullis'
  id: string
  /** Any cell of the connected group of 'D' (or 'B') cells. */
  at: Cell
}

export interface TankDef {
  kind: 'tank'
  at: Cell
  /** The id of a 'B' group it breaks through first. */
  breaks?: string
}

/** The packed corridor of L2: monsters that stand asleep until woken by proximity, a hit or the stage script. */
export interface SleeperDef {
  kind: 'sleepers'
  id: string
  from: Cell
  to: Cell
  monster: MonsterKindId
  count: number
}

/** Dressing (view only): portraits, trophies, pumpkins. */
export interface DecorDef {
  kind: 'decor'
  model: string
  at: Cell
  wall?: Side
  offset?: readonly [number, number]
  yaw?: number
}

export type EntityDef = SpawnPointDef | MedkitDef | MannequinDef | ChandelierDef | LetterDef | CrankDef | PortcullisDef | TankDef | SleeperDef | DecorDef

/** A roof over a rectangle of cells (corners inclusive): built from the rooms' ceilings. */
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
  /** Size of one plan cell, metres (PLAN: 1 m; fall back to 2 m if something breaks - only level data differs). */
  cell: number
  heightStep: number
  /** The nominal room height above y = 0, metres: the default ceiling of a room without one. */
  ceiling: number
  /** How tall a wall ('#') is above its foot when its `tops` character is '.' (or there is no tops plan). */
  blockTop?: number
  /** Low furniture height above its floor. */
  coverHeight: number
  /** Niche roof height above its floor (leftover, unused). */
  nicheHeight: number
  /** Initial facing at the start (where the camera looks). */
  startFacing: Side
  plan: readonly string[]
  heights?: readonly string[]
  tops?: readonly string[]
  roofs?: readonly RoofDef[]
  rooms: readonly RoomDef[]
  /** The retreat path through the level (a polyline of cells): the director's "front", the bot's route, the medkit check. */
  route: readonly Cell[]
  stages: readonly StageDef[]
  entities: readonly EntityDef[]
}
