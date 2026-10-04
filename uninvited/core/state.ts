// What exists in the game. GameState is plain data (numbers, strings, arrays, plain objects) so a save is
// JSON.stringify(state). Static level data and caches live in Sim (built once per level, never saved).
import type { GameConfig } from './config'
import type { GameEvent } from './events'
import {
  buildGrid,
  CellKind,
  cellCenterX,
  cellCenterZ,
  cellFloor,
  cellIndex,
  colOf,
  groupAt,
  rowOf,
  sideDx,
  sideDz,
  wallSideOf,
  yawAwayFrom,
  yawTowards,
  type Grid,
} from './grid'
import type { HackSession } from './hack/index'
import type { DroneDef, LevelDef, SoundCameraDef, TerminalDef, VideoCameraDef } from './level'
import type { MoveResult, World } from './ports'
import { createRng, type Rng } from './random'
import { createNav, type Nav } from './rules/nav'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type WeaponMode = 'sword' | 'rifle'

export interface PlayerState {
  /** Feet position. */
  pos: Vec3
  vel: Vec3
  /** Where the body faces (yaw: 0 = +z, PI/2 = +x). */
  facing: number
  grounded: boolean
  crouched: boolean
  /** Horizontal speed after the last move, m/s. */
  speed: number
  running: boolean
  coyote: number
  jumpBuffer: number
  dashBuffer: number
  dashTime: number
  dashCooldown: number
  dashX: number
  dashZ: number
  hp: number
  invuln: number
  mode: WeaponMode
  attackCooldown: number
  switchCooldown: number
  charges: number
  slashTime: number
  shootTime: number
  hitTime: number
  runNoise: number
  /** Downward speed while airborne (for landing). */
  fallSpeed: number
}

export type DroneRole = 'patrol' | 'searcher' | 'wave' | 'checker'
export type DroneMode = 'patrol' | 'investigate' | 'alert' | 'search' | 'leave'

export interface DroneState {
  /** A slot in use. Extra slots (searchers, waves) are inactive until spawned. */
  active: boolean
  alive: boolean
  role: DroneRole
  /** Index into Sim.patrols for patrol drones, -1 otherwise. */
  patrol: number
  pos: Vec3
  yaw: number
  hp: number
  mode: DroneMode
  wp: number
  /** Waiting at a waypoint / looking around, s. */
  wait: number
  target: Vec3
  lastKnown: Vec3
  suspicion: number
  sees: boolean
  fireCooldown: number
  lostTimer: number
  pausedTime: number
  /** > 0 while materializing (cannot act or be hit). */
  spawnTime: number
}

export interface VideoCameraState {
  pos: Vec3
  /** Looking straight out of its wall. */
  baseYaw: number
  sweepA: number
  sweepB: number
  period: number
  phase: number
  yaw: number
  hp: number
  alive: boolean
  suspicion: number
  sees: boolean
  respot: number
  pausedTime: number
}

export interface SoundCameraState {
  pos: Vec3
  yaw: number
  hp: number
  alive: boolean
  suspicion: number
  respot: number
  pausedTime: number
  /** Seconds since it last heard something (for the view's flash). */
  heardAgo: number
}

export interface SensorState {
  pos: Vec3
  rearm: number
}

/** A laser grid or a red wall: a vertical plane across the corridor through the middle of its cells. */
export interface BarrierShape {
  /** true: the plane is x = coord (the corridor runs along x); false: z = coord. */
  alongX: boolean
  coord: number
  min: number
  max: number
  floor: number
}

export interface LaserState extends BarrierShape {
  hp: number
  alive: boolean
  pausedTime: number
  trip: number
}

export interface RedWallState extends BarrierShape {
  open: boolean
}

export interface TerminalState {
  /** The console on the wall. */
  pos: Vec3
  yaw: number
  /** Opened its red walls for good. */
  done: boolean
  /** Its paused devices are still paused for this long (cannot be hacked again meanwhile). */
  cooldown: number
}

export interface CheckpointState {
  pos: Vec3
  passed: boolean
  underAlarm: boolean
}

export interface BoltState {
  active: boolean
  pos: Vec3
  vel: Vec3
  life: number
}

export interface AlarmState {
  stage: number
  /** While > 0 a new violation does not raise the stage again (one incident = one stage). */
  cooldown: number
  /** Seconds until stage 1/2 drops by one. */
  decay: number
  center: Vec3
  wave: number
  waveActive: boolean
  waveTimer: number
  wavesCleared: number
  firewallDown: boolean
}

export interface ScanState {
  active: boolean
  held: number
  cooldown: number
  warned: boolean
  /** After an overheat, Tab must be released before scanning again. */
  needRelease: boolean
}

export interface RunState {
  checkpointsPassed: number
  /** The ending counter (DESIGN 4): checkpoints passed with the alarm at stage 3. */
  alarmCheckpoints: number
  calmCheckpoints: number
  kills: number
  devicesBroken: number
  alarmsRaised: number
  deaths: number
  timeSec: number
}

export interface HackRun {
  terminal: number
  session: HackSession
}

export type Phase = 'playing' | 'dead' | 'won'

export interface GameState {
  levelId: string
  time: number
  rng: Rng
  phase: Phase
  player: PlayerState
  drones: DroneState[]
  cameras: VideoCameraState[]
  soundCameras: SoundCameraState[]
  sensors: SensorState[]
  lasers: LaserState[]
  walls: RedWallState[]
  terminals: TerminalState[]
  checkpoints: CheckpointState[]
  bolts: BoltState[]
  alarm: AlarmState
  scan: ScanState
  run: RunState
  hack: HackRun | null
  artifactTaken: boolean
  lastCheckpoint: number
}

/** What a terminal controls, resolved from the level's ids. */
export interface TerminalLinks {
  walls: number[]
  lasers: number[]
  drones: number[]
  difficulty: number
}

/** A noise made this tick (cleared at the end of every tick). */
export interface Noise {
  x: number
  y: number
  z: number
  radius: number
}

/** Static level data, ports and caches for one level. Not saved. */
export interface Sim {
  cfg: GameConfig
  level: LevelDef
  grid: Grid
  world: World
  events: GameEvent[]
  /** Patrol waypoints per patrol drone (x, z at the cell centres; y = the floor there). */
  patrols: Vec3[][]
  /** Wave / searcher spawn points (hover height not included). */
  spawns: Vec3[]
  terminalLinks: TerminalLinks[]
  artifact: Vec3
  start: Vec3
  nav: Nav
  noises: Noise[]
  noiseCount: number
  move: MoveResult
}

export function vec(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z }
}

function cellPos(g: Grid, col: number, row: number): Vec3 {
  return vec(cellCenterX(g, col), cellFloor(g, cellIndex(g, col, row)), cellCenterZ(g, row))
}

/** The plane of a laser grid or a red wall through the middle of its cells (also used by the physics adapter). */
export function barrierShape(g: Grid, cells: readonly number[]): BarrierShape {
  const first = cells[0] as number
  const sameCol = cells.every((i) => colOf(g, i) === colOf(g, first))
  const sameRow = cells.every((i) => rowOf(g, i) === rowOf(g, first))
  if (!sameCol && !sameRow) throw new Error(`a laser / red wall group must be one straight line of cells (at [${colOf(g, first)}, ${rowOf(g, first)}])`)
  // A column of cells blocks a corridor that runs along x: the plane is x = const.
  const alongX = sameCol && (cells.length > 1 || !sameRowCorridor(g, first))
  let min = Infinity
  let max = -Infinity
  let floor = Infinity
  for (const i of cells) {
    const c = alongX ? rowOf(g, i) : colOf(g, i)
    min = Math.min(min, c * g.cell)
    max = Math.max(max, (c + 1) * g.cell)
    floor = Math.min(floor, cellFloor(g, i))
  }
  const coord = alongX ? cellCenterX(g, colOf(g, first)) : cellCenterZ(g, rowOf(g, first))
  return { alongX, coord, min, max, floor }
}

/** A single cell: walls north and south means the corridor runs along x (so the plane is x = const). */
function sameRowCorridor(g: Grid, i: number): boolean {
  const c = colOf(g, i)
  const r = rowOf(g, i)
  const k = (cc: number, rr: number): number => (cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows ? CellKind.Wall : (g.kind[cellIndex(g, cc, rr)] as number))
  return !(k(c, r - 1) === CellKind.Wall && k(c, r + 1) === CellKind.Wall)
}

function createPlayer(cfg: GameConfig, at: Vec3, facing: number): PlayerState {
  return {
    pos: vec(at.x, at.y, at.z),
    vel: vec(),
    facing,
    grounded: true,
    crouched: false,
    speed: 0,
    running: false,
    coyote: 0,
    jumpBuffer: 0,
    dashBuffer: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashX: 0,
    dashZ: 1,
    hp: cfg.player.maxHp,
    invuln: 0,
    mode: 'sword',
    attackCooldown: 0,
    switchCooldown: 0,
    charges: cfg.combat.rifle.charges,
    slashTime: 0,
    shootTime: 0,
    hitTime: 0,
    runNoise: 0,
    fallSpeed: 0,
  }
}

export function emptyDrone(): DroneState {
  return {
    active: false,
    alive: false,
    role: 'searcher',
    patrol: -1,
    pos: vec(),
    yaw: 0,
    hp: 0,
    mode: 'patrol',
    wp: 0,
    wait: 0,
    target: vec(),
    lastKnown: vec(),
    suspicion: 0,
    sees: false,
    fireCooldown: 0,
    lostTimer: 0,
    pausedTime: 0,
    spawnTime: 0,
  }
}

/** Builds the static side of a level: grid, waypoints, spawns, terminal links. Cold path. */
export function createSim(level: LevelDef, cfg: GameConfig, world: World, prebuilt?: Grid): Sim {
  const grid = prebuilt ?? buildGrid(level)
  const droneDefs = level.entities.filter((e): e is DroneDef => e.kind === 'drone')
  const patrols = droneDefs.map((d) => {
    if (d.patrol.length === 0) throw new Error(`drone ${d.id}: empty patrol`)
    return d.patrol.map(([c, r]) => cellPos(grid, c, r))
  })
  const spawns = level.entities.flatMap((e) => (e.kind === 'spawn' ? [cellPos(grid, e.at[0], e.at[1])] : []))
  const laserIds = new Map<string, number>()
  const wallIds = new Map<string, number>()
  for (const e of level.entities) {
    if (e.kind === 'laser') laserIds.set(e.id, groupAt(grid, e.at, CellKind.Laser, `laser ${e.id}`))
    if (e.kind === 'redWall') wallIds.set(e.id, groupAt(grid, e.at, CellKind.RedWall, `red wall ${e.id}`))
  }
  const droneIds = new Map(droneDefs.map((d, i) => [d.id, i]))
  const terminalLinks = level.entities
    .filter((e): e is TerminalDef => e.kind === 'terminal')
    .map((t) => {
      const links: TerminalLinks = { walls: [], lasers: [], drones: [], difficulty: t.difficulty }
      for (const id of t.targets) {
        const w = wallIds.get(id)
        const l = laserIds.get(id)
        const d = droneIds.get(id)
        if (w !== undefined) links.walls.push(w)
        else if (l !== undefined) links.lasers.push(l)
        else if (d !== undefined) links.drones.push(d)
        else throw new Error(`terminal ${t.id}: unknown target "${id}"`)
      }
      return links
    })
  const noises: Noise[] = []
  for (let i = 0; i < 16; i++) noises.push({ x: 0, y: 0, z: 0, radius: 0 })
  return {
    cfg,
    level,
    grid,
    world,
    events: [],
    patrols,
    spawns,
    terminalLinks,
    artifact: cellPos(grid, colOf(grid, grid.artifact), rowOf(grid, grid.artifact)),
    start: cellPos(grid, colOf(grid, grid.start), rowOf(grid, grid.start)),
    nav: createNav(grid),
    noises,
    noiseCount: 0,
    move: { x: 0, y: 0, z: 0, grounded: false },
  }
}

function mount(g: Grid, at: readonly [number, number], wall: 'n' | 'e' | 's' | 'w', height: number): { pos: Vec3; yaw: number } {
  const i = cellIndex(g, at[0], at[1])
  if (g.kind[i] === CellKind.Wall) throw new Error(`device at [${at[0]}, ${at[1]}] sits in a wall cell`)
  const inset = g.cell / 2 - 0.25
  return {
    pos: vec(cellCenterX(g, at[0]) + sideDx(wall) * inset, cellFloor(g, i) + height, cellCenterZ(g, at[1]) + sideDz(wall) * inset),
    yaw: yawAwayFrom(wall),
  }
}

const DEG = Math.PI / 180

/** A fresh state for the start of a level. */
export function createState(sim: Sim, seed: number): GameState {
  const { cfg, level, grid: g } = sim
  const drones: DroneState[] = []
  sim.patrols.forEach((points, i) => {
    const d = emptyDrone()
    const p0 = points[0] as Vec3
    d.active = true
    d.alive = true
    d.role = 'patrol'
    d.patrol = i
    d.hp = cfg.drone.hp
    d.pos.x = p0.x
    d.pos.y = p0.y + cfg.drone.hover
    d.pos.z = p0.z
    const p1 = points[1 % points.length] as Vec3
    d.yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z)
    d.wp = points.length > 1 ? 1 : 0
    drones.push(d)
  })
  for (let i = 0; i < cfg.drone.maxExtra; i++) drones.push(emptyDrone())

  const cameras = level.entities
    .filter((e): e is VideoCameraDef => e.kind === 'videoCamera')
    .map((c): VideoCameraState => {
      const m = mount(g, c.at, c.wall, cfg.videoCamera.mountHeight)
      return {
        pos: m.pos,
        baseYaw: m.yaw,
        sweepA: c.sweep[0] * DEG,
        sweepB: c.sweep[1] * DEG,
        period: c.periodSec ?? cfg.videoCamera.sweepPeriodSec,
        phase: c.phase ?? 0,
        yaw: m.yaw + c.sweep[0] * DEG,
        hp: cfg.videoCamera.hp,
        alive: true,
        suspicion: 0,
        sees: false,
        respot: 0,
        pausedTime: 0,
      }
    })
  const soundCameras = level.entities
    .filter((e): e is SoundCameraDef => e.kind === 'soundCamera')
    .map((c): SoundCameraState => {
      const m = mount(g, c.at, c.wall, cfg.soundCamera.mountHeight)
      return { pos: m.pos, yaw: m.yaw, hp: cfg.soundCamera.hp, alive: true, suspicion: 0, respot: 0, pausedTime: 0, heardAgo: 99 }
    })
  const sensors = level.entities.flatMap((e): SensorState[] => (e.kind === 'motionSensor' ? [{ pos: cellPos(g, e.at[0], e.at[1]), rearm: 0 }] : []))
  const lasers = g.laserGroups.map((cells): LaserState => ({ ...barrierShape(g, cells), hp: cfg.laser.hp, alive: true, pausedTime: 0, trip: 0 }))
  const walls = g.wallGroups.map((cells): RedWallState => ({ ...barrierShape(g, cells), open: false }))
  const terminals = level.entities
    .filter((e): e is TerminalDef => e.kind === 'terminal')
    .map((t): TerminalState => {
      const i = cellIndex(g, t.at[0], t.at[1])
      const k = g.kind[i]
      if (k !== CellKind.Terminal && k !== CellKind.Niche) throw new Error(`terminal ${t.id}: [${t.at[0]}, ${t.at[1]}] must be a 'T' or 'n' cell`)
      const side = wallSideOf(g, i)
      const m = mount(g, t.at, side, 0)
      return { pos: vec(m.pos.x, m.pos.y, m.pos.z), yaw: m.yaw, done: false, cooldown: 0 }
    })
  const checkpoints = g.checkpoints.map((i): CheckpointState => ({ pos: cellPos(g, colOf(g, i), rowOf(g, i)), passed: false, underAlarm: false }))
  const bolts: BoltState[] = []
  for (let i = 0; i < 48; i++) bolts.push({ active: false, pos: vec(), vel: vec(), life: 0 })

  return {
    levelId: level.id,
    time: 0,
    rng: createRng(seed),
    phase: 'playing',
    player: createPlayer(cfg, sim.start, yawTowards(level.startFacing)),
    drones,
    cameras,
    soundCameras,
    sensors,
    lasers,
    walls,
    terminals,
    checkpoints,
    bolts,
    alarm: { stage: 0, cooldown: 0, decay: 0, center: vec(), wave: 0, waveActive: false, waveTimer: 0, wavesCleared: 0, firewallDown: false },
    scan: { active: false, held: 0, cooldown: 0, warned: false, needRelease: false },
    run: { checkpointsPassed: 0, alarmCheckpoints: 0, calmCheckpoints: 0, kills: 0, devicesBroken: 0, alarmsRaised: 0, deaths: 0, timeSec: 0 },
    hack: null,
    artifactTaken: false,
    lastCheckpoint: -1,
  }
}
