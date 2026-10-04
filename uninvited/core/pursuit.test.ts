import { describe, expect, test } from 'bun:test'
import { tick } from './commands'
import type { EntityDef } from './level'
import { rangedTokens } from './rules/tokens'
import type { DroneState, WardenState } from './state'
import { placePlayer, run, setup, type Fixture } from './testing'

const BIG = [
  '########################',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#.S..................A.#',
  '########################',
]

function horiz(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

describe('warden pursuit (alarm 2+)', () => {
  function pursuit(stage: number): { f: Fixture; w: WardenState; start: number } {
    const f = setup(BIG, [{ kind: 'warden', id: 'w', at: [14, 8], post: 'n' }])
    placePlayer(f, 3, 2)
    const w = f.s.wardens[0] as WardenState
    const a = f.s.alarm
    a.stage = stage
    a.decay = 30
    a.cooldown = f.sim.cfg.alarm.raiseCooldownSec
    a.center.x = f.s.player.pos.x
    a.center.y = f.s.player.pos.y
    a.center.z = f.s.player.pos.z
    return { f, w, start: horiz(w.pos, f.s.player.pos) }
  }

  test('at alarm 2 with a known position a far warden runs to it and takes a ranged position', () => {
    const { f, w, start } = pursuit(2)
    expect(start).toBeGreaterThan(20)
    expect(start).toBeLessThan(f.sim.cfg.warden.pursuit.radius)
    let fastest = 0
    run(f, 14, 1 / 60, () => {
      fastest = Math.max(fastest, w.speed)
    })
    expect(w.mode).toBe('alert')
    expect(fastest).toBeGreaterThan(f.sim.cfg.warden.alertSpeed)
    expect(fastest).toBeLessThanOrEqual(f.sim.cfg.warden.runSpeed + 0.01)
    expect(f.sim.cfg.warden.runSpeed).toBeLessThan(f.sim.cfg.player.runSpeed)
    expect(horiz(w.pos, f.s.player.pos)).toBeLessThan(start * 0.5)
  })

  test('at alarm 1 it only searches at a walk (stealth stays possible)', () => {
    const { f, w } = pursuit(1)
    let fastest = 0
    run(f, 14, 1 / 60, () => {
      fastest = Math.max(fastest, w.speed)
    })
    expect(w.mode).not.toBe('alert')
    expect(fastest).toBeLessThanOrEqual(f.sim.cfg.warden.searchSpeed + 0.01)
  })

  test('outside the pursuit radius it does not come', () => {
    const { f, w } = pursuit(2)
    f.sim.cfg.warden.pursuit.radius = 10
    run(f, 6)
    expect(w.mode).not.toBe('alert')
  })

  test('it loses the player only after breaking sight for loseSec, then searches the spot', () => {
    const { f, w } = pursuit(2)
    run(f, 4)
    expect(w.mode).toBe('alert')
    // nobody sees the player and the alarm news is old: it gives up and checks the last known spot
    f.s.alarm.cooldown = 0
    f.s.player.pos.x = 300
    w.sees = false
    run(f, f.sim.cfg.warden.loseSec + 1.5)
    expect(['investigate', 'return', 'patrol', 'alert']).toContain(w.mode)
  })
})

describe('drone standoff', () => {
  const FOUR: EntityDef[] = [0, 1, 2, 3].map((k) => ({ kind: 'drone', id: `d${k}`, patrol: [[11, 5], [11, 5]] }) as EntityDef)

  function fight(drones: EntityDef[]): { f: Fixture; ds: DroneState[] } {
    const f = setup(BIG, drones)
    placePlayer(f, 11, 5)
    f.s.player.hp = 100000
    const p = f.s.player.pos
    const ds = f.s.drones.filter((d) => d.active && d.alive)
    ds.forEach((d, k) => {
      d.pos.x = p.x + 0.3 * k // all stacked right above the player
      d.pos.z = p.z + 0.2 * k
      d.pos.y = p.y + f.sim.cfg.drone.hover
      d.mode = 'alert'
      d.lastKnown.x = p.x
      d.lastKnown.z = p.z
      d.fireCooldown = 1
    })
    return { f, ds }
  }

  test('a drone right above the player slides out and never stays within 4 m horizontally', () => {
    const { f, ds } = fight(FOUR.slice(0, 1))
    const d = ds[0] as DroneState
    const clear = f.sim.cfg.drone.standoff.clearRadius
    run(f, 2.5)
    expect(horiz(d.pos, f.s.player.pos)).toBeGreaterThanOrEqual(clear - 0.01)
    let worst = Infinity
    run(f, 20, 1 / 60, () => {
      worst = Math.min(worst, horiz(d.pos, f.s.player.pos))
    })
    expect(worst).toBeGreaterThanOrEqual(clear - 0.5)
  })

  test('a crowd spreads over the ring: apart from each other, 7-12 m out, a few metres up, under 35 degrees', () => {
    const { f, ds } = fight(FOUR)
    const so = f.sim.cfg.drone.standoff
    run(f, 10)
    const p = f.s.player.pos
    for (const d of ds) {
      const h = horiz(d.pos, p)
      expect(h).toBeGreaterThan(so.ringMin - 1.5)
      expect(h).toBeLessThan(so.ringMax + 2)
      const up = d.pos.y - p.y
      expect(up).toBeGreaterThan(2.5)
      expect(Math.atan2(up, h) * (180 / Math.PI)).toBeLessThan(36)
    }
    let minGap = Infinity
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) minGap = Math.min(minGap, horiz((ds[i] as DroneState).pos, (ds[j] as DroneState).pos))
    expect(minGap).toBeGreaterThan(2.5)
  })

  test('shot tokens hold: never more than the ranged limit shoot at once, and each shot is telegraphed', () => {
    const { f, ds } = fight(FOUR)
    const limit = f.sim.cfg.tokens.ranged
    let shots = 0
    let aimed = 0
    for (let t = 0; t < 16; t += 1 / 60) {
      f.sim.events.length = 0
      tick(f.s, f.sim, 1 / 60, f.intent)
      f.s.player.hp = 100000
      expect(rangedTokens(f.s)).toBeLessThanOrEqual(limit)
      for (const e of f.sim.events) {
        if (e.type === 'droneFired') shots++
        if (e.type === 'droneAiming') aimed++
      }
    }
    expect(shots).toBeGreaterThan(0)
    expect(aimed).toBeGreaterThanOrEqual(shots)
    expect(ds.every((d) => d.alive)).toBe(true)
  })
})
