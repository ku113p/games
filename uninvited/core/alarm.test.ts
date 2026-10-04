import { describe, expect, test } from 'bun:test'
import type { EntityDef } from './level'
import { raiseAlarm } from './rules/alarm'
import { placePlayer, run, setup, type Fixture } from './testing'

const PLAN = [
  '##################', //
  '#................#',
  '#................#',
  '#........D.......#',
  '#.S......D.....A.#',
  '##################',
]
const ENTITIES: EntityDef[] = [
  { kind: 'redWall', id: 'w', at: [9, 3] },
  { kind: 'spawn', at: [15, 1] },
  { kind: 'spawn', at: [1, 1] },
  { kind: 'spawn', at: [12, 2] },
]

function raise(f: Fixture, times: number): void {
  for (let i = 0; i < times; i++) {
    f.s.alarm.cooldown = 0
    raiseAlarm(f.s, f.sim, 'camera', 20, 0, 3)
  }
}

function hidePlayer(f: Fixture): void {
  // far from everything and out of sight: the searchers will not find you in these tests
  placePlayer(f, 2, 4)
  f.s.player.pos.x = -50
}

describe('the alarm', () => {
  test('violations raise it a stage at a time, up to 3', () => {
    const f = setup(PLAN, ENTITIES)
    raise(f, 1)
    expect(f.s.alarm.stage).toBe(1)
    raise(f, 5)
    expect(f.s.alarm.stage).toBe(3)
  })

  test('one incident raises one stage: violations right after it do not stack', () => {
    const f = setup(PLAN, ENTITIES)
    raiseAlarm(f.s, f.sim, 'drone', 20, 0, 3)
    raiseAlarm(f.s, f.sim, 'drone', 20, 0, 3)
    raiseAlarm(f.s, f.sim, 'camera', 20, 0, 3)
    expect(f.s.alarm.stage).toBe(1)
    hidePlayer(f)
    run(f, f.sim.cfg.alarm.raiseCooldownSec + 0.1, 1 / 30)
    raiseAlarm(f.s, f.sim, 'camera', 20, 0, 3)
    expect(f.s.alarm.stage).toBe(2)
  })

  test('stage 1 sends a couple of searchers, stage 2 more', () => {
    const f = setup(PLAN, ENTITIES)
    const searchers = (): number => f.s.drones.filter((d) => d.active && d.role === 'searcher').length
    raise(f, 1)
    expect(searchers()).toBe(f.sim.cfg.alarm.searchers[1] ?? -1)
    raise(f, 1)
    expect(searchers()).toBe(f.sim.cfg.alarm.searchers[2] ?? -1)
  })

  test('stages 1 and 2 decay after a quiet while; the searchers go home', () => {
    const f = setup(PLAN, ENTITIES)
    hidePlayer(f)
    raise(f, 2)
    const decay = f.sim.cfg.alarm.decaySec
    const seen = run(f, (decay[2] ?? 0) + 0.5, 1 / 30)
    expect(seen).toContain('alarmLowered')
    expect(f.s.alarm.stage).toBe(1)
    run(f, (decay[1] ?? 0) + 0.5, 1 / 30)
    expect(f.s.alarm.stage).toBe(0)
    run(f, 30, 1 / 30)
    expect(f.s.drones.filter((d) => d.active).length).toBe(0)
  })

  test('stage 3 never decays and brings waves; enough cleared waves drop the firewall', () => {
    const f = setup(PLAN, ENTITIES)
    placePlayer(f, 2, 4)
    raise(f, 3)
    expect(f.s.walls[0]?.open).toBe(false)
    let waves = 0
    let dropped = false
    for (let t = 0; t < 40 && !dropped; t += 1 / 30) {
      f.sim.events.length = 0
      run(f, 1 / 30, 1 / 30)
      // the player "wins" every fight instantly: kill whatever spawned
      for (const d of f.s.drones) {
        if (d.active && d.alive && d.role === 'wave' && d.spawnTime <= 0) {
          d.alive = false
          d.active = false
        }
      }
      f.s.player.hp = 100
      waves = f.s.alarm.wave
      dropped = f.s.alarm.firewallDown
    }
    expect(f.s.alarm.stage).toBe(3)
    expect(waves).toBeGreaterThanOrEqual(f.sim.cfg.alarm.firewallAfterWaves)
    expect(dropped).toBe(true)
    expect(f.s.walls[0]?.open).toBe(true)
    expect(f.world.boxes.some((b) => b.blocker === 0 && b.solid)).toBe(false)
  })

  test('the decay waits while you are being chased', () => {
    const f = setup(PLAN, [...ENTITIES, { kind: 'drone', id: 'd', patrol: [[3, 1], [3, 1]] }])
    hidePlayer(f)
    raise(f, 1)
    const d = f.s.drones[0]
    if (d) d.mode = 'alert'
    if (d) d.role = 'wave' // a hunter that never gives up, for this test
    run(f, (f.sim.cfg.alarm.decaySec[1] ?? 0) + 2, 1 / 30)
    expect(f.s.alarm.stage).toBe(1)
  })

  function killWaves(f: Fixture): void {
    for (const d of f.s.drones) if (d.active && d.alive && d.role === 'wave' && d.spawnTime <= 0) ((d.alive = false), (d.active = false))
    for (const w of f.s.worms) if (w.active && w.role === 'wave') ((w.alive = false), (w.active = false))
    for (const w of f.s.wardens) if (w.wave && w.alive) w.alive = false
  }

  test('a lockdown is exactly its arena waves long: re-raising the alarm after the firewall dropped starts no new wave', () => {
    const f = setup(PLAN, ENTITIES)
    f.sim.arenas.push({ id: 'a', x0: 0, z0: 0, x1: 40, z1: 20, walls: [0], waves: 2 })
    for (const g of f.sim.gates) g.arena = 0
    placePlayer(f, 2, 4)
    raise(f, 3)
    let started = 0
    for (let t = 0; t < 120; t += 1 / 30) {
      f.sim.events.length = 0
      run(f, 1 / 30, 1 / 30)
      killWaves(f)
      f.s.player.hp = 100
      started = Math.max(started, f.s.alarm.wave)
      if (f.s.alarm.firewallDown) break
    }
    expect(f.s.alarm.firewallDown).toBe(true)
    expect(started).toBe(2)
    // new incidents in the same arena push the alarm again: still no more waves
    raise(f, 3)
    run(f, 60, 1 / 30)
    expect(f.s.alarm.wave).toBe(2)
    expect(f.s.alarm.waveActive).toBe(false)
  })

  test('the firewall opens only the red walls of the arena the lockdown is fought in', () => {
    const plan = ['####################', '#........D.....D...#', '#.S......D.....D.A.#', '####################']
    const f = setup(plan, [{ kind: 'redWall', id: 'w1', at: [9, 1] }, { kind: 'redWall', id: 'w2', at: [15, 1] }, { kind: 'spawn', at: [2, 1] }])
    f.sim.arenas.push({ id: 'a', x0: 0, z0: 0, x1: 18, z1: 8, walls: [0], waves: 2 }, { id: 'b', x0: 18, z0: 0, x1: 40, z1: 8, walls: [1], waves: 2 })
    placePlayer(f, 12, 1) // in the second arena
    f.s.alarm.stage = 3
    f.s.alarm.firewallDown = false
    f.s.alarm.waveActive = false
    f.s.alarm.wave = 2
    f.s.alarm.wavesCleared = 2
    run(f, 0.2)
    expect(f.s.walls[0]?.open).toBe(false)
    expect(f.s.walls[1]?.open).toBe(true)
  })
})
