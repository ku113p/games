// What exists in the game. GameState is plain data (numbers, strings, arrays, plain objects) so a save is
// JSON.stringify(state). Static level data and caches live in Sim (built once per level, never saved).
// The domain shapes live in core/model/*; this file composes them (owner: WP1 Spine).
import type { GameConfig } from './config'
import type { GameEvent } from './events'
import { buildGrid, CellKind, cellCenterX, cellCenterZ, cellFloor, cellIndex, colOf, groupAt, rowOf, yawTowards, type Grid } from './grid'
import type { CrankDef, EntityDef, LevelDef, PortcullisDef } from './level'
import { vec, type BarrierShape, type KillInfo, type Vec3, createKillInfo } from './model/common'
import type { DirectorState, SpawnPoint, SpawnPointState } from './model/director'
import type { MonsterState, ProjectileState, PuddleState, TankState } from './model/monsters'
import type { GunState, PlayerState, StrikeState } from './model/player'
import type { CrankState, MedkitState, OnboardingState, PortcullisState, RunState, StageState, TargetState } from './model/stage'
import type { MoveResult, World } from './ports'
import { createRng, type Rng } from './random'
import { buildSpawnPoints } from './rules/spawns'
import { createNav, tallCells, type Nav } from './rules/nav'
import { createWalkNav, type WalkNav } from './rules/walk'

export type { BarrierShape, KillInfo, Vec3 }
export { vec, createKillInfo }

/** playing; dead (the stage restarts from its snapshot); levelDone (the exit was reached); rescued (the roof's helicopter came). */
export type Phase = 'playing' | 'dead' | 'levelDone' | 'rescued'

export interface GameState {
  levelId: string
  time: number
  rng: Rng
  phase: Phase
  player: PlayerState
  gun: GunState
  strike: StrikeState
  monsters: MonsterState[]
  tank: TankState
  projectiles: ProjectileState[]
  puddles: PuddleState[]
  director: DirectorState
  spawnPoints: SpawnPointState[]
  stage: StageState
  onboarding: OnboardingState
  medkits: MedkitState[]
  /** Mannequins and the chandelier. */
  targets: TargetState[]
  cranks: CrankState[]
  /** Portcullises and breakable walls, in the grid's 'D' / 'B' group order. */
  portcullis: PortcullisState[]
  run: RunState
}

/** Static level data, ports and caches for one level. Not saved. */
export interface Sim {
  cfg: GameConfig
  level: LevelDef
  grid: Grid
  world: World
  events: GameEvent[]
  /** The spawn points of the level (the static shape; the state is `GameState.spawnPoints`). */
  spawns: SpawnPoint[]
  start: Vec3
  /** The exit cell's centre, or null. */
  exit: Vec3 | null
  /** The retreat route (cell centres). */
  route: Vec3[]
  /** Flying navigation (bats). */
  nav: Nav
  /** Crawling navigation (swarm: climbs ledges up to config horde.kinds.rat.climb). */
  crawl: Nav
  /** Walking navigation for infantry and ranged monsters (a lower climb). */
  ground: Nav
  /** A* walking navigation (the tank). */
  walk: WalkNav
  move: MoveResult
  /** Scratch for kill credits (hot path: one object, reused). */
  kill: KillInfo
}

export function cellPos(g: Grid, col: number, row: number): Vec3 {
  return vec(cellCenterX(g, col), cellFloor(g, cellIndex(g, col, row)), cellCenterZ(g, row))
}

/** The plane of a portcullis through the middle of its cells (also used by the physics adapter). */
export function barrierShape(g: Grid, cells: readonly number[]): BarrierShape {
  const first = cells[0] as number
  const sameCol = cells.every((i) => colOf(g, i) === colOf(g, first))
  const sameRow = cells.every((i) => rowOf(g, i) === rowOf(g, first))
  if (!sameCol && !sameRow) throw new Error(`a portcullis group must be one straight line of cells (at [${colOf(g, first)}, ${rowOf(g, first)}])`)
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
    speed: 0,
    running: false,
    coyote: 0,
    jumpBuffer: 0,
    hp: cfg.player.maxHp,
    invuln: 0,
    attackCooldown: 0,
    slashTime: 0,
    slashLen: cfg.sword.animSec,
    shootTime: 0,
    hitTime: 0,
    attackBuffer: 0,
    bufYaw: 0,
    bufPitch: 0,
    combo: 0,
    comboTime: 99,
    fallSpeed: 0,
    jumping: false,
    aiming: false,
    drawTime: 0,
    control: 'free',
    controlTime: 0,
  }
}

export function emptyMonster(): MonsterState {
  return {
    active: false,
    alive: false,
    kind: 'rat',
    cls: 'swarm',
    mode: 'emerge',
    pos: vec(),
    yaw: 0,
    hp: 0,
    timer: 0,
    spawnTime: 0,
    spawnPoint: -1,
    stagger: 0,
    pushX: 0,
    pushZ: 0,
    direct: false,
    think: 0,
    pace: 1,
    token: false,
    tokenWait: 0,
    ringDir: 1,
    regroup: 0,
    shieldYaw: 0,
    attackTimer: 0,
    sleep: false,
  }
}

function emptyTank(): TankState {
  return {
    active: false,
    alive: false,
    mode: 'idle',
    attack: 'none',
    pos: vec(),
    yaw: 0,
    hp: 0,
    timer: 0,
    punchesLeft: 0,
    punchTimer: 0,
    grabDamage: 0,
    grabCooldown: 0,
    staggerDamage: 0,
    staggerWindow: 0,
    repath: 0,
  }
}

/** Builds the static side of a level: grid, spawn points, navigation. Cold path. */
export function createSim(level: LevelDef, cfg: GameConfig, world: World, prebuilt?: Grid): Sim {
  const grid = prebuilt ?? buildGrid(level, cfg.world)
  const nav = createNav(grid, false, undefined, Infinity, tallCells(grid, cfg.horde.flyers.overMax))
  const crawl = createNav(grid, true, nav, cfg.horde.kinds.rat.climb)
  const ground = createNav(grid, true, nav, cfg.horde.kinds.zombie.climb)
  const walk = createWalkNav(grid, cfg.tank.radius, nav.wallOpen)
  return {
    cfg,
    level,
    grid,
    world,
    events: [],
    spawns: buildSpawnPoints(grid, cfg, level),
    start: cellPos(grid, colOf(grid, grid.start), rowOf(grid, grid.start)),
    exit: grid.exit >= 0 ? cellPos(grid, colOf(grid, grid.exit), rowOf(grid, grid.exit)) : null,
    route: level.route.map(([c, r]) => cellPos(grid, c, r)),
    nav,
    crawl,
    ground,
    walk,
    move: { x: 0, y: 0, z: 0, grounded: false },
    kill: createKillInfo(),
  }
}

function entitiesOf<K extends EntityDef['kind']>(level: LevelDef, kind: K): Extract<EntityDef, { kind: K }>[] {
  return level.entities.filter((e): e is Extract<EntityDef, { kind: K }> => e.kind === kind)
}

/** A fresh state for the start of a level. */
export function createState(sim: Sim, seed: number): GameState {
  const { cfg, level, grid: g } = sim
  const monsters: MonsterState[] = []
  for (let i = 0; i < cfg.horde.max; i++) monsters.push(emptyMonster())
  const projectiles: ProjectileState[] = []
  for (let i = 0; i < cfg.horde.projectile.max; i++) projectiles.push({ active: false, kind: 'junk', damage: 0, pos: vec(), vel: vec(), life: 0 })
  const puddles: PuddleState[] = []
  for (let i = 0; i < cfg.horde.puddle.max; i++) puddles.push({ active: false, pos: vec(), radius: 0, life: 0 })

  const portcullis = g.wallGroups.map((cells): PortcullisState => ({ ...barrierShape(g, cells), open: false }))
  const portIds = new Map(entitiesOf(level, 'portcullis').map((p: PortcullisDef) => [p.id, groupAt(g, p.at, `portcullis ${p.id}`)]))
  const cranks = entitiesOf(level, 'crank').map((c: CrankDef): CrankState => {
    const opens = portIds.get(c.opens)
    if (opens === undefined) throw new Error(`crank ${c.id}: unknown portcullis "${c.opens}"`)
    return { pos: cellPos(g, c.at[0], c.at[1]), progress: 0, opens, done: false }
  })
  const targets: TargetState[] = []
  for (const m of entitiesOf(level, 'mannequin')) {
    targets.push({ kind: 'mannequin', pos: cellPos(g, m.at[0], m.at[1]), height: 1.1, radius: 0.5, hp: cfg.onboarding.mannequinHp, alive: true, timer: 0 })
  }
  for (const c of entitiesOf(level, 'chandelier')) {
    targets.push({ kind: 'chandelier', pos: cellPos(g, c.at[0], c.at[1]), height: c.height, radius: cfg.onboarding.chandelierRadius * 0.25, hp: cfg.onboarding.chandelierHp, alive: true, timer: 0 })
  }
  const medkits = entitiesOf(level, 'medkit').map((m): MedkitState => ({ pos: cellPos(g, m.at[0], m.at[1]), taken: false }))
  const player = createPlayer(cfg, sim.start, yawTowards(level.startFacing))

  return {
    levelId: level.id,
    time: 0,
    rng: createRng(seed),
    phase: 'playing',
    player,
    gun: { loaded: cfg.gun.startLoaded, reserve: cfg.gun.startReserve, reloadTime: 0, everCharged: false },
    strike: { cooldown: 0, animTime: 0, immune: 0 },
    monsters,
    tank: emptyTank(),
    projectiles,
    puddles,
    director: {
      intensity: 0,
      phase: 'idle',
      phaseTime: 0,
      spawnTimer: 0,
      budget: 0,
      profile: '',
      forcedTime: 0,
      forcedPhase: 'idle',
      calmTime: 99,
      progress: 0,
      holdOut: -1,
      peaks: 0,
    },
    spawnPoints: sim.spawns.map((): SpawnPointState => ({ enabled: true, telegraph: 0, open: 0, busy: 0, sinceUsed: 99 })),
    stage: { index: -1, startedAt: 0, cleared: false, holdOut: -1, ambushed: [] },
    onboarding: { step: targets.some((t) => t.kind === 'mannequin') ? 'mannequins' : 'done', kills: 0, strikeUsed: false, timer: 0 },
    medkits,
    targets,
    cranks,
    portcullis,
    run: { kills: 0, deaths: 0, restarts: 0, timeSec: 0 },
  }
}
