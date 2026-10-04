import { describe, expect, test } from 'bun:test'
import { attack, switchMode } from './commands'
import type { EntityDef } from './level'
import { placePlayer, run, setup, type Fixture } from './testing'

const HALL = [
  '##############', //
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#.S........A.#',
  '##############',
]
const ONE_DRONE: EntityDef[] = [{ kind: 'drone', id: 'd', patrol: [[6, 2], [6, 2]] }]

function droneAhead(f: Fixture): void {
  placePlayer(f, 6, 3) // the drone hovers one cell north
  const d = f.s.drones[0]
  if (d) d.yaw = 0
}

describe('the gunblade', () => {
  test('the sword hits in a 180-degree arc in front and not behind', () => {
    const f = setup(HALL, ONE_DRONE)
    droneAhead(f)
    attack(f.s, f.sim, 0, 0) // facing south, the drone is north
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(false)
    run(f, 0.5)
    f.sim.events.length = 0
    attack(f.s, f.sim, Math.PI * 0.6, 0) // facing east-north-east: the drone is inside the half circle
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(true)
  })

  test('two sword hits kill a drone; a kill is loud and counted', () => {
    const f = setup(HALL, [...ONE_DRONE, { kind: 'spawn', at: [12, 1] }])
    droneAhead(f)
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.s.drones[0]?.mode).toBe('alert') // hitting it blows your cover
    run(f, 0.5)
    attack(f.s, f.sim, Math.PI, 0)
    const types = f.sim.events.map((e) => e.type)
    expect(f.s.drones[0]?.alive).toBe(false)
    expect(types).toContain('noise')
    expect(f.s.run.kills).toBe(1)
  })

  test('the rifle spends charges and clicks when empty', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    switchMode(f.s, f.sim)
    expect(f.s.player.mode).toBe('rifle')
    run(f, 0.3)
    for (let i = 0; i < 3; i++) {
      f.sim.events.length = 0
      attack(f.s, f.sim, 0, 0)
      expect(f.sim.events.some((e) => e.type === 'rifleShot')).toBe(true)
      run(f, 0.2)
    }
    expect(f.s.player.charges).toBe(0)
    f.sim.events.length = 0
    attack(f.s, f.sim, 0, 0)
    expect(f.sim.events.map((e) => e.type)).toContain('rifleEmpty')
  })

  test('the rifle fires faster than the sword swings, and hits what it aims at', () => {
    const cfg = setup(HALL).sim.cfg.combat
    expect(cfg.rifle.intervalSec).toBeLessThan(cfg.sword.cooldownSec)
    expect(cfg.rifle.damage).toBeLessThan(cfg.sword.damage)
    const f = setup(HALL, ONE_DRONE)
    placePlayer(f, 6, 5)
    switchMode(f.s, f.sim)
    run(f, 0.3)
    attack(f.s, f.sim, Math.PI, 0.1) // north, a little up: the aim assist finds it
    const hit = f.sim.events.find((e) => e.type === 'targetHit')
    expect(hit).toBeDefined()
    expect(f.s.drones[0]?.hp).toBe(f.sim.cfg.drone.hp - f.sim.cfg.combat.rifle.damage)
  })

  test('you cannot attack while switching modes', () => {
    const f = setup(HALL, ONE_DRONE)
    droneAhead(f)
    switchMode(f.s, f.sim)
    switchMode(f.s, f.sim)
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.some((e) => e.type === 'swordSwing')).toBe(false)
  })

  test('drone bolts hurt, a dash dodges them, and running out of HP is death', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    f.s.player.hp = 15
    const b = f.s.bolts[0]
    if (!b) return
    const fire = (): void => {
      b.active = true
      b.life = 2
      b.pos.x = f.s.player.pos.x
      b.pos.y = 1.1
      b.pos.z = f.s.player.pos.z - 3
      b.vel.x = 0
      b.vel.y = 0
      b.vel.z = 15
    }
    f.s.player.dashTime = 1
    fire()
    run(f, 0.4)
    expect(f.s.player.hp).toBe(15)
    f.s.player.dashTime = 0
    placePlayer(f, 6, 3)
    fire()
    expect(run(f, 0.4)).toContain('playerHurt')
    expect(f.s.player.hp).toBe(5)
    f.s.player.invuln = 0
    fire()
    expect(run(f, 0.4)).toContain('playerDied')
    expect(f.s.phase).toBe('dead')
  })
})
