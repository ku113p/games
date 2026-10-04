// A leak guard for the core (the view's counterpart is `bun tools/bench.ts soak`): the pools of enemies and bolts are
// fixed-size, so playing many waves in a row - spawning, killing, spawning again - must never grow them, leave active
// entries beyond the pool, or pile up events. Slots are reused, not appended.
import { describe, expect, test } from 'bun:test'
import { attack } from './commands'
import type { EntityDef } from './level'
import { raiseAlarm } from './rules/alarm'
import { damageTarget } from './rules/combat'
import { placePlayer, run, setup, testConfig } from './testing'

const BIG = [
  '########################',
  ...Array.from({ length: 9 }, () => '#......................#'),
  '#.S..................A.#',
  '########################',
]
const GATES: EntityDef[] = [
  { kind: 'spawn', at: [21, 1], wall: 'n' },
  { kind: 'spawn', at: [1, 1], wall: 'w' },
  { kind: 'spawn', at: [21, 10], wall: 's' },
  { kind: 'spawn', at: [11, 10], wall: 's' },
]

describe('waves on repeat', () => {
  test('the state arrays stay the same size and no events pile up over 12 waves', () => {
    const cfg = testConfig()
    cfg.alarm.waves = [{ packs: [6, 5, 4], drones: 1, wardens: 1, heavy: 1 }]
    cfg.alarm.waveWardenSlots = 3
    cfg.alarm.minSpawnDist = 4
    cfg.alarm.searchers = [0, 0, 0, 0]
    cfg.worm.max = 24
    const f = setup(BIG, GATES, cfg)
    placePlayer(f, 11, 5)
    f.s.player.hp = 1e9
    for (let i = 0; i < 3; i++) {
      f.s.alarm.cooldown = 0
      raiseAlarm(f.s, f.sim, 'camera', 0, 0, 0)
    }
    const sizes = (): number[] => [f.s.worms.length, f.s.drones.length, f.s.wardens.length, f.s.bolts.length]
    const before = sizes()
    let waves = 0
    let maxEvents = 0
    for (let step = 0; step < 4000 && waves < 12; step++) {
      run(f, 0.5, 1 / 30, () => {
        maxEvents = Math.max(maxEvents, f.sim.events.length)
      })
      if (f.s.alarm.waveActive) {
        // a fast "player": cut down everything alive
        for (let i = 0; i < f.s.worms.length; i++) if (f.s.worms[i]?.active && f.s.worms[i]?.alive) damageTarget(f.s, f.sim, 'worm', i, 1000, false)
        for (let i = 0; i < f.s.drones.length; i++) if (f.s.drones[i]?.active && f.s.drones[i]?.alive) damageTarget(f.s, f.sim, 'drone', i, 1000, false)
        for (let i = 0; i < f.s.wardens.length; i++) if (f.s.wardens[i]?.alive && f.s.wardens[i]?.wave) damageTarget(f.s, f.sim, 'warden', i, 1000, false)
        attack(f.s, f.sim, 0, 0)
      }
      if (f.s.alarm.wavesCleared > waves) waves = f.s.alarm.wavesCleared
      f.s.alarm.firewallDown = false // keep the waves coming
      expect(sizes()).toEqual(before)
    }
    expect(waves).toBeGreaterThanOrEqual(3)
    expect(maxEvents).toBeLessThanOrEqual(cfg.sim.maxEvents)
    expect(sizes()).toEqual(before)
  })
})
