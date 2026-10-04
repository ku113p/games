import { describe, expect, test } from 'bun:test'
import type { GameEvent } from './events'
import { gateStates, spawnGates } from './queries'
import { raiseAlarm } from './rules/alarm'
import { tick } from './commands'
import { FakeWorld } from './fake-world'
import type { EntityDef, LevelDef } from './level'
import { createSim } from './state'
import { placePlayer, run, setup, testConfig, testLevel, type Fixture } from './testing'

const PLAN = [
  '####################', //
  '#..................#',
  '#..................#',
  '#..................#',
  '#.S..............A.#',
  '####################',
]
const GATES: EntityDef[] = [
  { kind: 'spawn', at: [17, 1], wall: 'n' },
  { kind: 'spawn', at: [10, 2], wall: 'up' },
  { kind: 'spawn', at: [18, 3], wall: 'e' },
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

describe('spawn gates', () => {
  test('a wall gate sits in the slab, an overhead one opens in the open sky; a bad wall side is a readable error', () => {
    const f = setup(PLAN, GATES)
    const g = spawnGates(f.sim)
    expect(g).toHaveLength(3)
    expect(g[0]?.mouth.z).toBeCloseTo(2) // north wall of row 1
    expect(g[0]?.nz).toBe(1)
    expect(g[1]?.ceiling).toBe(true)
    expect(g[1]?.mouth.y).toBeCloseTo(f.sim.cfg.world.skyGate) // no roof: a portal in the sky
    expect(() => setup(PLAN, [{ kind: 'spawn', at: [10, 2], wall: 'n' }])).toThrow(/no slab on its 'n' side/)
  })

  test('under a roof the overhead gate is a hatch in it; a floor hatch opens upwards; a low slab cannot take a gate', () => {
    const cfg = testConfig()
    const level = { ...testLevel(PLAN, [...GATES, { kind: 'spawn', at: [5, 3], wall: 'down' }]), roofs: [{ from: [8, 1], to: [12, 3], height: 4.5 }] } satisfies LevelDef
    const sim = createSim(level, cfg, new FakeWorld())
    const g = spawnGates(sim)
    expect(g[1]?.mouth.y).toBeCloseTo(4.5)
    expect(g[3]?.ny).toBe(1)
    expect(g[3]?.mouth.y).toBeCloseTo(0)
    expect(g[3]?.deep.y).toBeLessThan(0)
    const low = { ...testLevel(PLAN, [{ kind: 'spawn', at: [17, 1], wall: 'n' }]), tops: PLAN.map((row, r) => (r === 0 ? row.replace(/#/g, '2') : row.replace(/[^#]/g, '.').replace(/#/g, '.'))) }
    expect(() => createSim(low, cfg, new FakeWorld())).toThrow(/too low for a gate/)
  })

  test('an alarm drone comes out of a gate: the gate opens first, the drone waits behind it, then flies out', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 2, 4)
    raiseAlarm(f.s, f.sim, 'camera', 30, 0, 5)
    const opened = f.sim.events.filter((e) => e.type === 'gateOpened')
    expect(opened.length).toBeGreaterThan(0)
    const d = f.s.drones.find((x) => x.active)
    expect(d).toBeDefined()
    if (!d) return
    const gate = spawnGates(f.sim)[d.gate]
    expect(gate).toBeDefined()
    if (!gate) return
    expect(gateStates(f.s)[d.gate]?.open).toBeGreaterThan(0)
    // waiting behind the surface, not in the corridor
    expect(d.pos.x).toBeCloseTo(gate.deep.x)
    expect(d.pos.y).toBeCloseTo(gate.deep.y)
    expect(d.pos.z).toBeCloseTo(gate.deep.z)
    run(f, f.sim.cfg.drone.spawnSec * 0.9)
    expect(d.pos.z).toBeCloseTo(gate.deep.z)
    run(f, f.sim.cfg.drone.spawnSec * 0.1 + f.sim.cfg.drone.gateExitSec + 0.05)
    // out in the corridor now, flying towards the alarm
    expect(Math.hypot(d.pos.x - gate.out.x, d.pos.z - gate.out.z)).toBeLessThan(1)
    expect(d.gateTime).toBe(0)
  })

  test('gates near the player are skipped; a wave spreads over several gates', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 16, 1) // right under the north gate
    for (let i = 0; i < 3; i++) {
      f.s.alarm.cooldown = 0
      raiseAlarm(f.s, f.sim, 'camera', 32, 0, 3)
    }
    const used = new Set<number>()
    events(f, f.sim.cfg.alarm.waveFirstDelaySec + 0.1)
    for (const d of f.s.drones) if (d.active && d.role === 'wave') used.add(d.gate)
    expect(used.has(0)).toBe(false)
    expect(used.size).toBeGreaterThanOrEqual(Math.min(2, f.sim.cfg.alarm.waves[0]?.drones ?? 1))
  })

  test('drones queued at the same gate come out one after another', () => {
    const f = setup(PLAN, [{ kind: 'spawn', at: [17, 1], wall: 'n' }])
    placePlayer(f, 2, 4)
    raiseAlarm(f.s, f.sim, 'camera', 30, 0, 5)
    f.s.alarm.cooldown = 0
    raiseAlarm(f.s, f.sim, 'camera', 30, 0, 5)
    const ds = f.s.drones.filter((x) => x.active)
    expect(ds.length).toBeGreaterThanOrEqual(2)
    expect(Math.abs((ds[1]?.spawnTime ?? 0) - (ds[0]?.spawnTime ?? 0))).toBeGreaterThan(f.sim.cfg.drone.gateStaggerSec * 0.5)
  })

  test('a leaving drone flies back into a gate', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 2, 4)
    f.s.player.pos.x = -50 // out of the way
    raiseAlarm(f.s, f.sim, 'camera', 20, 0, 5)
    const seen = events(f, 60).map((e) => e.type)
    expect(seen).toContain('alarmLowered')
    expect(seen.filter((t) => t === 'gateOpened').length).toBeGreaterThanOrEqual(2) // out, and back in
    expect(seen).toContain('droneLeft')
    expect(f.s.drones.filter((d) => d.active).length).toBe(0)
  })
})

describe('drone fire', () => {
  test('every shot is telegraphed: the drone locks on for aimSec first, and breaking the line of sight cancels it', () => {
    const f = setup(PLAN, [{ kind: 'drone', id: 'd', patrol: [[8, 2], [8, 2]] }])
    placePlayer(f, 8, 4)
    const d = f.s.drones[0]
    if (!d) return
    d.yaw = 0
    const evs = events(f, 4)
    const aimAt = evs.findIndex((e) => e.type === 'droneAiming')
    const fireAt = evs.findIndex((e) => e.type === 'droneFired')
    expect(aimAt).toBeGreaterThanOrEqual(0)
    expect(fireAt).toBeGreaterThan(aimAt)

    // break the line of sight in the middle of an aim
    const g = setup(PLAN, [{ kind: 'drone', id: 'd', patrol: [[8, 2], [8, 2]] }])
    placePlayer(g, 8, 4)
    const d2 = g.s.drones[0]
    if (!d2) return
    d2.yaw = 0
    let fired = false
    let hid = false
    events(g, 6, () => {
      if (d2.aim > 0 && !hid) {
        hid = true
        g.world.box(10, 0, 6.2, 22, 5, 6.6) // a wall between them
      }
      for (const e of g.sim.events) if (e.type === 'droneFired') fired = true
    })
    expect(hid).toBe(true)
    expect(fired).toBe(false)
  })
})

describe('network vision trace', () => {
  test('held too long it warns first, then calls the security and says where it comes from', () => {
    const f = setup(PLAN, GATES)
    placePlayer(f, 2, 4)
    f.intent.scan = true
    const evs = events(f, f.sim.cfg.scan.maxSec + 0.2)
    const warnAt = evs.findIndex((e) => e.type === 'scanWarning')
    const traced = evs.find((e) => e.type === 'scanTraced')
    expect(warnAt).toBeGreaterThanOrEqual(0)
    expect(traced).toBeDefined()
    if (traced?.type !== 'scanTraced') return
    expect(traced.gate).toBeGreaterThanOrEqual(0)
    expect(traced.drone).toBeGreaterThanOrEqual(0)
    expect(f.s.alarm.stage).toBe(1)
  })
})
