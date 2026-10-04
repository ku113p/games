// Test fixtures: a full config with round numbers and tiny levels on the fake world. Used only by *.test.ts
// (the core cannot read config.json - main.ts passes it in - so tests carry their own numbers).
import type { GameConfig } from './config'
import { FakeWorld } from './fake-world'
import { CellKind, cellCenterX, cellCenterZ, type Grid } from './grid'
import type { EntityDef, LevelDef } from './level'
import { createSim, createState, type GameState, type Sim } from './state'
import { createIntent, tick, type Intent } from './commands'

export function testConfig(): GameConfig {
  return {
    sim: { maxDt: 0.05, maxEvents: 512 },
    world: {
      tops: { '1': 0.5, '2': 1.1, '3': 1.6, '4': 2.4, '5': 3.2, '6': 4.5, '7': 6, '8': 8, '9': 11 },
      defaultTop: 8,
      voidDepth: 40,
      skyGate: 7,
      fall: { depth: 6, fadeSec: 0.5, damage: 20, safeMargin: 0.8 },
    },
    player: {
      walkSpeed: 2.6,
      runSpeed: 6.4,
      crouchSpeed: 1.5,
      groundAccel: 50,
      groundDecel: 60,
      airAccel: 4,
      turnRate: 24,
      jumpSpeed: 6,
      gravity: 16,
      maxFall: 24,
      coyoteSec: 0.1,
      jumpBufferSec: 0.12,
      dashSpeed: 10,
      dashSec: 0.2,
      dashCooldownSec: 1,
      dashTapSec: 0.25,
      dashInvulnerable: true,
      maxHp: 100,
      hurtInvulnSec: 0.4,
      eyeHeight: 1.5,
      crouchEyeHeight: 0.7,
      chestHeight: 1.1,
      radius: 0.35,
      landNoiseSpeed: 7,
      hitAnimSec: 0.3,
    },
    noise: { run: 8, jump: 5, land: 7, dash: 7, sword: 6, rifle: 16, hit: 10, kill: 14, laser: 10, runEverySec: 0.35, fadeSec: 0.6 },
    combat: {
      switchSec: 0.25,
      aimDrawSec: 0.1,
      sword: { damage: 55, range: 2.6, arcDeg: 180, cooldownSec: 0.4, reachUp: 3.2, reachDown: 1, animSec: 0.3 },
      rifle: { damage: 20, intervalSec: 0.15, spreadDeg: 0, aimSpreadDeg: 0, range: 40, charges: 3, aimAssistDeg: 5, muzzleHeight: 1.35, animSec: 0.1 },
      hitRadius: { drone: 0.6, camera: 0.45, laser: 0.5, worm: 0.4 },
    },
    detection: { rate: 1, decay: 0.5, crouchFactor: 0.4, runFactor: 1.5, farFactor: 0.5 },
    videoCamera: { range: 14, halfAngleDeg: 25, pitchDeg: 20, mountHeight: 3.5, sweepPeriodSec: 8, holdShare: 0.25, hp: 40, respotSec: 5 },
    soundCamera: { radius: 9, mountHeight: 3.4, hp: 40, respotSec: 5, hearGain: 0.4, decay: 0.3, pingSec: 2.5 },
    motionSensor: { radius: 2.5, rearmSec: 5, noticeDist: 4 },
    laser: { damage: 20, hp: 80, tripCooldownSec: 1, height: 2.4 },
    drone: {
      hp: 100,
      hover: 2.2,
      radius: 0.55,
      patrolSpeed: 2,
      searchSpeed: 3,
      chaseSpeed: 4.5,
      turnRate: 3,
      range: 12,
      halfAngleDeg: 35,
      pitchDeg: 15,
      waypointPauseSec: 1,
      lookAroundSec: 2,
      keepDist: 6,
      loseSec: 3,
      fireIntervalSec: 1,
      fireWindupSec: 0.5,
      aimSec: 0.5,
      boltSpeed: 15,
      boltDamage: 10,
      boltLifeSec: 2.5,
      hearFactor: 1,
      maxExtra: 8,
      spawnSec: 0.5,
      gateExitSec: 0.5,
      gateDepth: 1.5,
      gateOut: 1.2,
      gateStaggerSec: 0.5,
    },
    worm: {
      hp: 45,
      radius: 0.3,
      speed: 5,
      speedSpread: 0,
      searchSpeed: 2.4,
      turnRate: 10,
      max: 12,
      biteRange: 1.25,
      biteReach: 1.75,
      windupSec: 0.45,
      recoverSec: 0.7,
      biteDamage: 7,
      staggerSec: 0.25,
      knockback: 4,
      spawnSec: 0.5,
      emergeSec: 0.5,
      gateStaggerSec: 0.2,
      directDist: 9,
      flankDist: 6,
      flankDeg: 100,
      senseDist: 7,
      senseCrouchDist: 3.5,
      loseSec: 4,
      climb: 1.6,
    },
    warden: {
      hp: 200,
      rifleFactor: 1.25,
      radius: 0.4,
      eyeHeight: 1.85,
      chestHeight: 1.35,
      hitRadius: 0.6,
      range: 10,
      halfAngleDeg: 21,
      pitchDeg: 12,
      closeDist: 1.6,
      closeHalfAngleDeg: 60,
      patrolSpeed: 1.2,
      investigateSpeed: 1.5,
      searchSpeed: 1.8,
      alertSpeed: 3.3,
      turnRate: 1.6,
      alertTurnRate: 2.6,
      headTurnRate: 1,
      headMaxDeg: 70,
      pauseChance: 0.3,
      pauseSec: [1.2, 2.8],
      postActSec: [4, 8],
      waitVary: 0.3,
      scanDeg: 55,
      scanPeriodSec: 5,
      glanceDeg: 35,
      suspiciousSec: 1.6,
      investigateLookSec: 4,
      searchLookSec: 3,
      loseSec: 5,
      keen: 1.5,
      hearFactor: 0.9,
      strikeRange: 1.7,
      strikeReach: 2.3,
      strikeArcDeg: 100,
      strikeWindupSec: 0.7,
      strikeRecoverSec: 0.8,
      strikeDamage: 22,
      shotMinDist: 4.5,
      shotAimSec: 1.1,
      shotIntervalSec: 3.2,
      shotFirstSec: 1.4,
      boltSpeed: 9,
      hitAnimSec: 0.35,
      bumpSuspicion: 0.6,
      repathSec: 1,
    },
    alarm: {
      decaySec: [0, 10, 20, 0],
      searchers: [0, 2, 4, 0],
      searchRadius: [0, 10, 30, 60],
      waveSizes: [2, 3],
      wavePacks: [],
      waveFirstDelaySec: 1,
      waveGapSec: 2,
      firewallAfterWaves: 2,
      maxWaveDrones: 6,
      searchPacks: [0, 0, 0, 0],
      minSpawnDist: 4,
      raiseCooldownSec: 3,
    },
    scan: { warnAt: 0.6, maxSec: 5, cooldownSec: 1.5, overheatCooldownSec: 6 },
    terminal: { interactRadius: 1.7, pauseSec: 30, timeBonusSec: 0 },
    checkpoint: { radius: 2 },
    artifact: { radius: 1.8 },
    ending: { sadAt: 4, totalCheckpoints: 9 },
    hack: {
      codes: ['1C', 'BD', '55', 'E9', '7A', 'FF'],
      gridSize: { easy: 5, hard: 7 },
      codeCount: { easy: 5, hard: 5 },
      sequenceLength: { easy: 3, hard: 6 },
      hiddenCount: { easy: 1, hard: 2 },
      timeBaseSec: 15,
      timePerCodeSec: 4,
      timePerHiddenSec: 18,
      mistakePenaltySec: { easy: 5, hard: 7 },
    },
  }
}

/** A plain level: the plan as given, flat, with these entities. */
export function testLevel(plan: string[], entities: EntityDef[] = [], heights?: string[]): LevelDef {
  return {
    id: 'test',
    nameKey: 'level.test',
    cell: 2,
    heightStep: 0.5,
    ceiling: 5,
    coverHeight: 1.1,
    nicheHeight: 1.35,
    startFacing: 'n',
    plan,
    ...(heights ? { heights } : {}),
    entities,
  }
}

/** Fake-world boxes for walls, cover and red walls of a grid (flat levels only). */
export function worldFromGrid(g: Grid): FakeWorld {
  const w = new FakeWorld()
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const k = g.kind[r * g.cols + c]
      const x0 = c * g.cell
      const z0 = r * g.cell
      if (k === CellKind.Wall) w.box(x0, -1, z0, x0 + g.cell, g.ceiling, z0 + g.cell)
      if (k === CellKind.Cover) w.box(x0, 0, z0, x0 + g.cell, g.coverHeight, z0 + g.cell)
    }
  }
  for (const b of g.blocks) w.box(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ)
  g.wallGroups.forEach((cells, i) => {
    for (const idx of cells) {
      const c = idx % g.cols
      const r = Math.floor(idx / g.cols)
      w.box(c * g.cell, 0, r * g.cell, (c + 1) * g.cell, g.ceiling, (r + 1) * g.cell, i)
    }
  })
  return w
}

export interface Fixture {
  s: GameState
  sim: Sim
  world: FakeWorld
  intent: Intent
}

/** A ready game on a test level. */
export function setup(plan: string[], entities: EntityDef[] = [], cfg: GameConfig = testConfig(), seed = 1): Fixture {
  const level = testLevel(plan, entities)
  // build the grid once through a throwaway sim to derive the fake world, then the real sim on it
  const probe = createSim(level, cfg, new FakeWorld())
  const world = worldFromGrid(probe.grid)
  const sim = createSim(level, cfg, world)
  const s = createState(sim, seed)
  return { s, sim, world, intent: createIntent() }
}

/** Runs ticks of dt for a duration, collecting every event type seen. */
export function run(f: Fixture, seconds: number, dt = 1 / 60, each?: () => void): string[] {
  const seen: string[] = []
  for (let t = 0; t < seconds; t += dt) {
    f.sim.events.length = 0
    each?.()
    tick(f.s, f.sim, dt, f.intent)
    for (const e of f.sim.events) seen.push(e.type)
  }
  return seen
}

/** Puts the player's feet on a cell centre. */
export function placePlayer(f: Fixture, col: number, row: number, y = 0): void {
  f.s.player.pos.x = cellCenterX(f.sim.grid, col)
  f.s.player.pos.z = cellCenterZ(f.sim.grid, row)
  f.s.player.pos.y = y
  f.s.player.vel.x = 0
  f.s.player.vel.y = 0
  f.s.player.vel.z = 0
}
