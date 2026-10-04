import { describe, expect, test } from 'bun:test'
import { attack, setAim, switchMode, tick } from './commands'
import type { GameEvent } from './events'
import { CellKind, cellAt } from './grid'
import type { EntityDef } from './level'
import { raiseAlarm } from './rules/alarm'
import { spawnWormPack } from './rules/worms'
import type { WormState } from './state'
import { placePlayer, run, setup, testConfig, type Fixture } from './testing'

// two halls joined by a gap in the wall at column 7: from the gate (top right) the worms must find the gap
const PLAN = [
  '####################', //
  '#..................#',
  '#..................#',
  '#######.############',
  '#..................#',
  '#.S..............A.#',
  '####################',
]
const GATES: EntityDef[] = [
  { kind: 'spawn', at: [17, 1], wall: 'n' },
  { kind: 'spawn', at: [1, 1], wall: 'w' },
  { kind: 'spawn', at: [18, 4], wall: 'e' },
]

function events(f: Fixture, seconds: number, each?: () => void): GameEvent[] {
  const out: GameEvent[] = []
  for (let t = 0; t < seconds; t += 1 / 60) {
    f.sim.events.length = 0
    each?.()
    tick(f.s, f.sim, 1 / 60, f.intent)
    out.push(...f.sim.events)
  }
  return out
}

/** A hunting worm put straight on the floor at (x, z), facing yaw. */
function wormAt(f: Fixture, i: number, x: number, z: number, yaw = 0): WormState {
  const w = f.s.worms[i] as WormState
  w.active = true
  w.alive = true
  w.role = 'wave'
  w.mode = 'hunt'
  w.hp = f.sim.cfg.worm.hp
  w.pos.x = x
  w.pos.y = 0
  w.pos.z = z
  w.yaw = yaw
  w.spawnTime = 0
  w.timer = 0
  w.pace = 1
  return w
}

function alive(f: Fixture): number {
  return f.s.worms.filter((w) => w.active && w.alive).length
}

describe('worms', () => {
  test('a pack crawls out of its gate and rushes the player along the floor, around the wall, never through it', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 3, 5)
    expect(spawnWormPack(f.s, f.sim, 0, 5, 'wave')).toBe(5)
    expect(f.sim.events.some((e) => e.type === 'gateOpened')).toBe(true)
    expect(f.sim.events.some((e) => e.type === 'wormPack' && e.count === 5)).toBe(true)
    const p = f.s.player.pos
    const start = Math.hypot((f.sim.gates[0]?.out.x ?? 0) - p.x, (f.sim.gates[0]?.out.z ?? 0) - p.z)
    let inWall = false
    events(f, 10, () => {
      for (const w of f.s.worms) {
        if (!w.active || w.mode === 'emerge' || w.spawnTime > 0) continue
        const c = cellAt(f.sim.grid, w.pos.x, w.pos.z)
        if (c < 0 || f.sim.grid.kind[c] === CellKind.Wall) inWall = true
      }
    })
    expect(inWall).toBe(false)
    // every worm made it through the gap into the player's hall and crowds around the player (biting, backing off)
    const pack = f.s.worms.filter((x) => x.active)
    expect(start).toBeGreaterThan(10)
    for (const w of pack) {
      expect(w.pos.z).toBeGreaterThan(8) // south of the wall
      expect(Math.hypot(w.pos.x - p.x, w.pos.z - p.z)).toBeLessThan(3.5)
      expect(w.pos.y).toBeCloseTo(0, 1) // on the floor
    }
    expect(pack.filter((w) => Math.hypot(w.pos.x - p.x, w.pos.z - p.z) < 2).length).toBeGreaterThanOrEqual(3)
    expect(f.s.player.hp).toBeLessThan(f.sim.cfg.player.maxHp) // and they bit
  })

  test('close up a worm rears up first (the telegraph), then bites; stepping back during the windup dodges it', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 3, 5)
    const p = f.s.player.pos
    wormAt(f, 0, p.x, p.z - 1.0)
    const first = events(f, 0.05)
    expect(first.some((e) => e.type === 'wormWindup')).toBe(true)
    expect(f.s.player.hp).toBe(f.sim.cfg.player.maxHp) // no damage during the windup
    const bite = events(f, 0.5)
    const b = bite.find((e) => e.type === 'wormBite')
    expect(b && b.type === 'wormBite' && b.hit).toBe(true)
    const hurt = bite.find((e) => e.type === 'playerHurt')
    expect(hurt && hurt.type === 'playerHurt' && hurt.fromZ < p.z).toBe(true) // the hurt says where it came from

    // a second worm: walk away (south) during its windup
    const g = setup(PLAN, GATES)
    placePlayer(g, 3, 4)
    const q = g.s.player.pos
    wormAt(g, 0, q.x, q.z - 1.0)
    events(g, 0.05)
    g.intent.moveForward = -1 // the camera looks north (yaw PI): back = south, away from the worm
    g.intent.lookYaw = Math.PI
    const dodge = events(g, 0.5)
    const miss = dodge.find((e) => e.type === 'wormBite')
    expect(miss && miss.type === 'wormBite' && !miss.hit).toBe(true)
    expect(g.s.player.hp).toBe(g.sim.cfg.player.maxHp)
  })

  test('one sword swing cuts down several worms in its 180-degree arc, not the ones behind', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 9, 1)
    const p = f.s.player.pos
    // four in front (south), one behind (north... the wall is there: put it west-north-west, behind the arc)
    wormAt(f, 0, p.x - 1.2, p.z + 0.8)
    wormAt(f, 1, p.x, p.z + 1.6)
    wormAt(f, 2, p.x + 1.4, p.z + 0.6)
    wormAt(f, 3, p.x + 0.6, p.z + 2.2)
    wormAt(f, 4, p.x - 1.5, p.z - 0.5)
    f.sim.events.length = 0
    attack(f.s, f.sim, 0, 0) // facing south (+z)
    const hits = f.sim.events.filter((e) => e.type === 'targetHit' && e.target === 'worm' && e.killed)
    expect(hits).toHaveLength(4)
    expect(f.s.worms[4]?.alive).toBe(true)
    expect(f.s.run.kills).toBe(4)
  })

  test('the rifle needs three shots for a worm; a hit that does not kill stops it and cancels its bite', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 3, 4)
    f.s.player.charges = 10
    switchMode(f.s, f.sim)
    run(f, 0.3)
    const p = f.s.player.pos
    const w = wormAt(f, 0, p.x + 6, p.z, -Math.PI / 2)
    const aimAt = (): void => {
      const dx = w.pos.x - p.x
      const dz = w.pos.z - p.z
      const pitch = Math.atan2(w.pos.y + 0.25 - (p.y + f.sim.cfg.combat.rifle.muzzleHeight), Math.hypot(dx, dz))
      attack(f.s, f.sim, Math.atan2(dx, dz), pitch)
    }
    aimAt()
    expect(w.alive).toBe(true)
    expect(w.stagger).toBeGreaterThan(0)
    run(f, 0.2)
    aimAt()
    expect(w.alive).toBe(true)
    run(f, 0.2)
    aimAt()
    expect(w.alive).toBe(false)
  })

  test('the same seed and the same input give the same worms (deterministic)', () => {
    const trace = (): string => {
      const f = setup(PLAN, GATES, testConfig(), 7)
      placePlayer(f, 4, 5)
      spawnWormPack(f.s, f.sim, 0, 6, 'wave')
      spawnWormPack(f.s, f.sim, 2, 4, 'wave')
      f.intent.moveRight = 1
      f.intent.lookYaw = Math.PI
      const out: string[] = []
      for (let k = 0; k < 6; k++) {
        run(f, 0.5)
        if (k === 3) attack(f.s, f.sim, Math.PI / 2, 0)
        out.push(f.s.worms.map((w) => `${w.mode}:${w.pos.x.toFixed(4)},${w.pos.z.toFixed(4)}`).join('|'), String(f.s.player.hp))
      }
      return out.join('\n')
    }
    expect(trace()).toBe(trace())
  })

  test('alarm 3 waves mix drones and worm packs from different gates; a wave is cleared only when the worms are dead too', () => {
    const cfg = testConfig()
    cfg.alarm.waveSizes = [1]
    cfg.alarm.wavePacks = [[3, 3]]
    cfg.alarm.minSpawnDist = 2
    cfg.alarm.searchers = [0, 0, 0, 0] // only the wave's own drone
    const f = setup(PLAN, GATES, cfg)
    placePlayer(f, 9, 5)
    for (let i = 0; i < 3; i++) {
      f.s.alarm.cooldown = 0
      raiseAlarm(f.s, f.sim, 'camera', 10, 0, 10)
    }
    expect(f.s.alarm.stage).toBe(3)
    const seen = events(f, 1.2)
    const started = seen.find((e) => e.type === 'waveStarted')
    expect(started && started.type === 'waveStarted' && started.count === 1 && started.worms === 6).toBe(true)
    const packGates = seen.flatMap((e) => (e.type === 'wormPack' ? [e.gate] : []))
    expect(packGates).toHaveLength(2)
    expect(new Set(packGates).size).toBe(2)
    const droneGate = f.s.drones.find((d) => d.active && d.role === 'wave')?.gate
    expect(packGates).not.toContain(droneGate)
    // kill the drone: the wave goes on while worms live
    for (const d of f.s.drones) if (d.role === 'wave') d.alive = d.active = false
    events(f, 0.2)
    expect(f.s.alarm.waveActive).toBe(true)
    for (const w of f.s.worms) w.alive = w.active = false
    const after = events(f, 0.2)
    expect(after.some((e) => e.type === 'waveCleared')).toBe(true)
  })

  test('at alarm 2 a worm pack joins the search, senses a player close by, and leaves when the alarm cools down', () => {
    const cfg = testConfig()
    cfg.alarm.searchPacks = [0, 0, 3, 0]
    cfg.alarm.searchers = [0, 0, 0, 0]
    const f = setup(PLAN, GATES, cfg)
    placePlayer(f, 2, 5)
    f.s.player.pos.x = -40 // out of the level: nobody finds you
    f.s.alarm.cooldown = 0
    raiseAlarm(f.s, f.sim, 'camera', 20, 0, 3)
    expect(alive(f)).toBe(0) // not at alarm 1
    f.s.alarm.cooldown = 0
    raiseAlarm(f.s, f.sim, 'camera', 20, 0, 3)
    expect(f.s.alarm.stage).toBe(2)
    expect(alive(f)).toBe(3)
    events(f, 2)
    expect(f.s.worms.filter((w) => w.active).every((w) => w.mode === 'search')).toBe(true)
    // walk into one's nose
    const w = f.s.worms.find((x) => x.active) as WormState
    f.s.player.pos.x = w.pos.x + 3
    f.s.player.pos.z = w.pos.z
    f.s.player.pos.y = 0
    const sensed = events(f, 0.5)
    expect(sensed.some((e) => e.type === 'wormSensed')).toBe(true)
    // gone again: they lose you, the alarm cools down to 1, the worms crawl back into a gate
    f.s.player.pos.x = -40
    const later = events(f, 40)
    expect(later.some((e) => e.type === 'alarmLowered')).toBe(true)
    expect(later.some((e) => e.type === 'wormLeft')).toBe(true)
    expect(alive(f)).toBe(0)
  })
})

describe('aim', () => {
  test('aiming with the sword out draws the rifle and puts the sword back on release; Q does nothing meanwhile', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 3, 4)
    expect(f.s.player.mode).toBe('sword')
    setAim(f.s, f.sim, true)
    expect(f.s.player.mode).toBe('rifle')
    expect(f.sim.events.some((e) => e.type === 'modeSwitched')).toBe(true)
    expect(f.s.player.switchCooldown).toBeLessThanOrEqual(f.sim.cfg.combat.aimDrawSec)
    switchMode(f.s, f.sim)
    expect(f.s.player.mode).toBe('rifle')
    setAim(f.s, f.sim, false)
    expect(f.s.player.mode).toBe('sword')
    // with the rifle already out it stays the rifle
    run(f, 0.3)
    switchMode(f.s, f.sim)
    setAim(f.s, f.sim, true)
    setAim(f.s, f.sim, false)
    expect(f.s.player.mode).toBe('rifle')
  })

  test('aiming walks (no sprint) and turns the body to the aim', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 3, 4)
    setAim(f.s, f.sim, true)
    f.intent.moveRight = 1
    f.intent.run = true
    f.intent.lookYaw = Math.PI / 2
    run(f, 0.6)
    expect(f.s.player.running).toBe(false)
    expect(f.s.player.speed).toBeLessThanOrEqual(f.sim.cfg.player.walkSpeed + 0.01)
    expect(Math.abs(f.s.player.facing - Math.PI / 2)).toBeLessThan(0.05)
  })

  test('aimed rifle shots spread less', () => {
    const cfg = testConfig()
    cfg.combat.rifle.spreadDeg = 8
    cfg.combat.rifle.aimSpreadDeg = 1
    cfg.combat.rifle.charges = 200
    const spread = (aimed: boolean): number => {
      const f = setup(PLAN, [], cfg, 3)
      placePlayer(f, 2, 4)
      switchMode(f.s, f.sim)
      run(f, 0.3)
      setAim(f.s, f.sim, aimed)
      let worst = 0
      for (let k = 0; k < 40; k++) {
        f.sim.events.length = 0
        attack(f.s, f.sim, Math.PI / 2, 0)
        const e = f.sim.events.find((x) => x.type === 'rifleShot')
        if (e && e.type === 'rifleShot') worst = Math.max(worst, Math.abs(Math.atan2(e.toZ - e.fromZ, e.toX - e.fromX)))
        run(f, 0.2)
      }
      return worst
    }
    expect(spread(true)).toBeLessThan(spread(false) * 0.5)
  })
})
