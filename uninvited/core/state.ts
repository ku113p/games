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
  roofAt,
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
import { createWalkNav, type WalkNav } from './rules/walk'
import { buildWardenRoutes, createWardens, type WalkPath, type WardenRoute } from './rules/wardens'

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
  /** A dash asked for (buffered briefly), towards (dashX, dashZ). */
  dashBuffer: number
  dashTime: number
  dashCooldown: number
  dashX: number
  dashZ: number
  /** The last direction key tapped (0 forward, 1 back, 2 left, 3 right; -1 none) and when (game time), for the double tap. */
  tapDir: number
  tapTime: number
  /** Ctrl was held on the last tick (the hold crouch reacts to press and release). */
  crouchHold: boolean
  /** The current crouch comes from holding Ctrl: releasing it stands you up (as soon as there is room). */
  crouchByHold: boolean
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
  /** In the air after a jump (motion sensors trip on it). */
  jumping: boolean
  /** How far the player's noise carries right now, m (sprinting keeps it up; jumps and fights spike it, then it fades). */
  noise: number
  /** RMB held: aiming (walk speed, facing the aim, the rifle's tighter spread). */
  aiming: boolean
  /** The aim drew the rifle from the sword: releasing it puts the sword back. */
  aimSwap: boolean
  /** The last safe ground the player stood on (feet): falling into the void puts the player back here. */
  safe: Vec3
  /**
   * Falling into the void: counts down from world.fall.fadeSec (the screen fades out) through 0 (the player is put
   * back on safe ground) to -fadeSec (it fades in again); 0 when not falling.
   */
  fallTime: number
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
  /** > 0 while its spawn gate opens: it waits behind the gate (cannot act or be hit). */
  spawnTime: number
  /** The gate it comes out of / goes into, -1 none. */
  gate: number
  /** > 0 while flying the gate path (out of the gate, or into it when gateIn). */
  gateTime: number
  gateIn: boolean
  /** > 0 while locking on before a shot (the telegraph), s left. */
  aim: number
}

export type WormRole = 'wave' | 'searcher'
/** emerge: crawling out of its gate; hunt: rushing the player; search: combing the alarm area (searchers);
 * windup: reared up before a bite (the telegraph); recover: backing off after a bite; leave: crawling back to a gate. */
export type WormMode = 'emerge' | 'hunt' | 'search' | 'windup' | 'recover' | 'leave'

/** A worm (DESIGN 9): a small, fast melee program on the floor; they come in packs. */
export interface WormState {
  active: boolean
  alive: boolean
  role: WormRole
  mode: WormMode
  /** On the floor (the view adds the wiggle). */
  pos: Vec3
  yaw: number
  hp: number
  /** Seconds left of the current windup / recovery / emergence. */
  timer: number
  /** > 0 while waiting behind its opening gate (cannot act or be hit). */
  spawnTime: number
  gate: number
  /** A searcher's current search point, or where it last sensed the player. */
  target: Vec3
  /** Seconds since a hunting searcher last sensed the player. */
  lost: number
  /** > 0 while stopped by a hit. */
  stagger: number
  /** Knockback velocity, m/s (fades out). */
  pushX: number
  pushZ: number
  /** Going straight at the player (clear line) rather than along the flow field; re-checked every few ticks. */
  direct: boolean
  /** Seconds until the next line check. */
  think: number
  /** Its own speed factor (packs do not move in lockstep). */
  pace: number
}

/** patrol: its round (or its post); suspicious: stopped, turning to a cue; investigate: walking over to check it;
 * search: combing the alarm area (alarm 1-2); return: walking back to its round; alert: fighting. */
export type WardenMode = 'patrol' | 'suspicious' | 'investigate' | 'search' | 'return' | 'alert'
/** What a warden does on its round (for the view): walking, standing, a slow look around, checking a rack. */
export type WardenAct = 'walk' | 'stand' | 'scan' | 'check'

/** A warden: a walking sentinel program (a guard). Its vision cone follows its head (yaw + head). */
export interface WardenState {
  /** The level's id (for abilities and links). */
  id: string
  alive: boolean
  hp: number
  /** Feet position. */
  pos: Vec3
  /** Body facing. */
  yaw: number
  /** Head turn relative to the body (radians, + = to its left); the cone looks along yaw + head. */
  head: number
  headWant: number
  /** Walking speed right now, m/s (the view syncs the feet). */
  speed: number
  mode: WardenMode
  act: WardenAct
  /** Seconds left of the current act (standing, looking around...), and its full length. */
  actTime: number
  actLen: number
  /** The glance aside of a standing act, radians. */
  glance: number
  /** The route stop it walks to / stands at. */
  stop: number
  /** Where it walks right now. */
  goal: Vec3
  /** The last place it saw or heard the player (or the cue it is suspicious of). */
  lastKnown: Vec3
  suspicion: number
  sees: boolean
  lostTimer: number
  /** A general timer: suspicious stop, looking around at a cue or a search point. */
  wait: number
  pausedTime: number
  /** > 0 while winding up a melee strike (the telegraph), s left; then recover > 0 while it recovers. */
  strike: number
  recover: number
  /** > 0 while aiming the arm shot (the telegraph), s left. */
  aim: number
  fireCooldown: number
  /** > 0 while flinching from a hit. */
  hitTime: number
  /** Seconds until the walk is planned again. */
  repath: number
  /** Taken over (May's "take over a sentry", DESIGN 10): it sees and fights nothing while true. */
  controlled: boolean
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
  /** Its zone's radius, m. */
  radius: number
  /** > 0 after a trip while it rearms. */
  rearm: number
  /** The player is close enough to notice its blinking dot. */
  seenUpClose: boolean
}

/** A network-vision link: terminal `terminal` controls this wall / laser / drone (DESIGN 8). */
export interface ScanLink {
  kind: 'wall' | 'laser' | 'drone' | 'warden'
  /** Index of the wall, laser, drone or warden. */
  index: number
  terminal: number
  /** The terminal console. */
  from: Vec3
  /** The controlled device (a drone link follows the drone). */
  to: Vec3
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

/** A spawn gate (DESIGN 9: drones arrive visibly). */
export interface GateState {
  /** Stays open for this long, s (0 = closed). */
  open: number
  /** The next drone queued at it waits this long more, s. */
  busy: number
}

/** A spawn gate's static shape: drones wait at `deep` (behind the surface), come out through `mouth` to `out`. */
export interface Gate {
  mouth: Vec3
  deep: Vec3
  out: Vec3
  /** Outward normal (into the corridor). */
  nx: number
  ny: number
  nz: number
  /** True for a gate overhead: a hatch in a roof, or a portal in the open sky. */
  ceiling: boolean
  /** The plan cell in front of it. */
  cell: number
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
  /** 0..1 of the limit while active (1 = the security is called). */
  heat: number
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
  worms: WormState[]
  wardens: WardenState[]
  cameras: VideoCameraState[]
  soundCameras: SoundCameraState[]
  sensors: SensorState[]
  lasers: LaserState[]
  walls: RedWallState[]
  terminals: TerminalState[]
  checkpoints: CheckpointState[]
  gates: GateState[]
  /** Network-vision links, built with the level (drone ends follow their drones). */
  links: ScanLink[]
  /** Patrol waypoints per drone slot (empty for searchers and waves). */
  routes: Vec3[][]
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
  wardens: number[]
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
  /** Spawn gates for searchers, checkers and waves. */
  gates: Gate[]
  terminalLinks: TerminalLinks[]
  artifact: Vec3
  start: Vec3
  nav: Nav
  /** Crawling navigation (worms): the drones' flow fields limited to floor a worm can crawl on. */
  crawl: Nav
  /** Walking navigation (wardens). */
  walk: WalkNav
  /** Per warden: its round (stops, the walked loop). */
  wardenRoutes: WardenRoute[]
  /** Per warden: the walk it follows right now (scratch, not saved). */
  wardenPaths: WalkPath[]
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
    tapDir: -1,
    tapTime: -10,
    crouchHold: false,
    crouchByHold: false,
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
    jumping: false,
    noise: 0,
    aiming: false,
    aimSwap: false,
    safe: vec(at.x, at.y, at.z),
    fallTime: 0,
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
    gate: -1,
    gateTime: 0,
    gateIn: false,
    aim: 0,
  }
}

export function emptyWorm(): WormState {
  return {
    active: false,
    alive: false,
    role: 'wave',
    mode: 'emerge',
    pos: vec(),
    yaw: 0,
    hp: 0,
    timer: 0,
    spawnTime: 0,
    gate: -1,
    target: vec(),
    lost: 0,
    stagger: 0,
    pushX: 0,
    pushZ: 0,
    direct: false,
    think: 0,
    pace: 1,
  }
}

/** Builds the static side of a level: grid, waypoints, spawns, terminal links. Cold path. */
export function createSim(level: LevelDef, cfg: GameConfig, world: World, prebuilt?: Grid): Sim {
  const grid = prebuilt ?? buildGrid(level, cfg.world)
  const droneDefs = level.entities.filter((e): e is DroneDef => e.kind === 'drone')
  const patrols = droneDefs.map((d) => {
    if (d.patrol.length === 0) throw new Error(`drone ${d.id}: empty patrol`)
    return d.patrol.map(([c, r]) => cellPos(grid, c, r))
  })
  const gates = level.entities.flatMap((e) => (e.kind === 'spawn' ? [buildGate(grid, cfg, e.at, e.wall ?? 'up')] : []))
  const laserIds = new Map<string, number>()
  const wallIds = new Map<string, number>()
  for (const e of level.entities) {
    if (e.kind === 'laser') laserIds.set(e.id, groupAt(grid, e.at, CellKind.Laser, `laser ${e.id}`))
    if (e.kind === 'redWall') wallIds.set(e.id, groupAt(grid, e.at, CellKind.RedWall, `red wall ${e.id}`))
  }
  const droneIds = new Map(droneDefs.map((d, i) => [d.id, i]))
  const wardenIds = new Map(level.entities.flatMap((e) => (e.kind === 'warden' ? [e.id] : [])).map((id, i) => [id, i]))
  const terminalLinks = level.entities
    .filter((e): e is TerminalDef => e.kind === 'terminal')
    .map((t) => {
      const links: TerminalLinks = { walls: [], lasers: [], drones: [], wardens: [], difficulty: t.difficulty }
      for (const id of t.targets) {
        const w = wallIds.get(id)
        const l = laserIds.get(id)
        const d = droneIds.get(id)
        const wd = wardenIds.get(id)
        if (w !== undefined) links.walls.push(w)
        else if (l !== undefined) links.lasers.push(l)
        else if (d !== undefined) links.drones.push(d)
        else if (wd !== undefined) links.wardens.push(wd)
        else throw new Error(`terminal ${t.id}: unknown target "${id}"`)
      }
      return links
    })
  const noises: Noise[] = []
  for (let i = 0; i < 16; i++) noises.push({ x: 0, y: 0, z: 0, radius: 0 })
  const nav = createNav(grid)
  const crawl = createNav(grid, true, nav, cfg.worm.climb)
  const walk = createWalkNav(grid, cfg.warden.radius, nav.wallOpen)
  const wardenRoutes = buildWardenRoutes(level, grid, walk)
  return {
    cfg,
    level,
    grid,
    world,
    events: [],
    patrols,
    gates,
    terminalLinks,
    artifact: cellPos(grid, colOf(grid, grid.artifact), rowOf(grid, grid.artifact)),
    start: cellPos(grid, colOf(grid, grid.start), rowOf(grid, grid.start)),
    nav,
    crawl,
    walk,
    wardenRoutes,
    wardenPaths: wardenRoutes.map((): WalkPath => ({ pts: new Float32Array(64), n: 0, k: 0, gx: NaN, gz: NaN })),
    noises,
    noiseCount: 0,
    move: { x: 0, y: 0, z: 0, grounded: false },
  }
}

/**
 * A spawn gate in front of plan cell `at`, cut into the slab on its `wall` side, into its floor ('down'), or overhead
 * ('up': a hatch in the roof over it, or in the open a portal in the sky). Cold path.
 */
function buildGate(g: Grid, cfg: GameConfig, at: readonly [number, number], wall: 'n' | 'e' | 's' | 'w' | 'up' | 'down'): Gate {
  const i = cellIndex(g, at[0], at[1])
  const k = g.kind[i]
  if (k === undefined || k === CellKind.Wall || k === CellKind.Niche || k === CellKind.Void) throw new Error(`spawn gate at [${at[0]}, ${at[1]}]: must stand on an open floor cell`)
  const floor = cellFloor(g, i)
  const cx = cellCenterX(g, at[0])
  const cz = cellCenterZ(g, at[1])
  const hover = floor + cfg.drone.hover
  const d = cfg.drone
  if (wall === 'down') {
    return { mouth: vec(cx, floor, cz), deep: vec(cx, floor - d.gateDepth, cz), out: vec(cx, hover, cz), nx: 0, ny: 1, nz: 0, ceiling: false, cell: i }
  }
  if (wall === 'up') {
    const roof = roofAt(g, cx, cz)
    const top = Number.isFinite(roof) ? roof : floor + cfg.world.skyGate
    return {
      mouth: vec(cx, top, cz),
      deep: vec(cx, top + d.gateDepth, cz),
      out: vec(cx, hover, cz),
      nx: 0,
      ny: -1,
      nz: 0,
      ceiling: true,
      cell: i,
    }
  }
  const sx = sideDx(wall)
  const sz = sideDz(wall)
  const behind = g.kind[cellIndex(g, at[0] + sx, at[1] + sz)]
  if (behind !== CellKind.Wall) throw new Error(`spawn gate at [${at[0]}, ${at[1]}]: there is no slab on its '${wall}' side`)
  const slabTop = g.top[cellIndex(g, at[0] + sx, at[1] + sz)] as number
  if (hover + 0.9 > slabTop) throw new Error(`spawn gate at [${at[0]}, ${at[1]}]: the slab on its '${wall}' side is too low for a gate`)
  const mx = cx + (sx * g.cell) / 2
  const mz = cz + (sz * g.cell) / 2
  return {
    mouth: vec(mx, hover, mz),
    deep: vec(mx + sx * d.gateDepth, hover, mz + sz * d.gateDepth),
    out: vec(mx - sx * d.gateOut, hover, mz - sz * d.gateOut),
    nx: -sx,
    ny: 0,
    nz: -sz,
    ceiling: false,
    cell: i,
  }
}

function barrierMid(b: BarrierShape, y: number): Vec3 {
  const mid = (b.min + b.max) / 2
  return b.alongX ? vec(b.coord, b.floor + y, mid) : vec(mid, b.floor + y, b.coord)
}

/** Terminal -> device links for network vision. Cold path. */
function buildLinks(sim: Sim, terminals: TerminalState[], lasers: LaserState[], walls: RedWallState[], drones: DroneState[], wardens: WardenState[]): ScanLink[] {
  const out: ScanLink[] = []
  sim.terminalLinks.forEach((l, t) => {
    const term = terminals[t]
    if (!term) return
    const from = (): Vec3 => vec(term.pos.x, term.pos.y + 1.1, term.pos.z)
    for (const w of l.walls) {
      const shape = walls[w]
      if (shape) out.push({ kind: 'wall', index: w, terminal: t, from: from(), to: barrierMid(shape, 1.6) })
    }
    for (const k of l.lasers) {
      const shape = lasers[k]
      if (shape) out.push({ kind: 'laser', index: k, terminal: t, from: from(), to: barrierMid(shape, 1.2) })
    }
    for (const d of l.drones) {
      const dr = drones[d]
      if (dr) out.push({ kind: 'drone', index: d, terminal: t, from: from(), to: vec(dr.pos.x, dr.pos.y, dr.pos.z) })
    }
    for (const k of l.wardens) {
      const w = wardens[k]
      if (w) out.push({ kind: 'warden', index: k, terminal: t, from: from(), to: vec(w.pos.x, w.pos.y + sim.cfg.warden.eyeHeight, w.pos.z) })
    }
  })
  return out
}

function mount(g: Grid, at: readonly [number, number], wall: 'n' | 'e' | 's' | 'w', height: number): { pos: Vec3; yaw: number } {
  const i = cellIndex(g, at[0], at[1])
  if (g.kind[i] === CellKind.Wall) throw new Error(`device at [${at[0]}, ${at[1]}] sits in a wall cell`)
  if (g.kind[i] === CellKind.Void) throw new Error(`device at [${at[0]}, ${at[1]}] sits over the void`)
  const back = g.kind[cellIndex(g, at[0] + sideDx(wall), at[1] + sideDz(wall))]
  if (back === CellKind.Wall && (g.top[cellIndex(g, at[0] + sideDx(wall), at[1] + sideDz(wall))] as number) < cellFloor(g, i) + height + 0.2)
    throw new Error(`device at [${at[0]}, ${at[1]}]: the slab on its '${wall}' side is lower than its mount height`)
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
  const worms: WormState[] = []
  for (let i = 0; i < cfg.worm.max; i++) worms.push(emptyWorm())
  const wardens = createWardens(sim)

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
  const sensors = level.entities.flatMap((e): SensorState[] =>
    e.kind === 'motionSensor' ? [{ pos: cellPos(g, e.at[0], e.at[1]), radius: cfg.motionSensor.radius, rearm: 0, seenUpClose: false }] : [],
  )
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
    worms,
    wardens,
    cameras,
    soundCameras,
    sensors,
    lasers,
    walls,
    terminals,
    checkpoints,
    gates: sim.gates.map((): GateState => ({ open: 0, busy: 0 })),
    links: buildLinks(sim, terminals, lasers, walls, drones, wardens),
    routes: drones.map((_, i) => (sim.patrols[i] ?? []).map((w) => vec(w.x, w.y + cfg.drone.hover, w.z))),
    bolts,
    alarm: { stage: 0, cooldown: 0, decay: 0, center: vec(), wave: 0, waveActive: false, waveTimer: 0, wavesCleared: 0, firewallDown: false },
    scan: { active: false, held: 0, heat: 0, cooldown: 0, warned: false, needRelease: false },
    run: { checkpointsPassed: 0, alarmCheckpoints: 0, calmCheckpoints: 0, kills: 0, devicesBroken: 0, alarmsRaised: 0, deaths: 0, timeSec: 0 },
    hack: null,
    artifactTaken: false,
    lastCheckpoint: -1,
  }
}
