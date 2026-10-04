import { describe, expect, test } from 'bun:test'
import { attack, circularStrike, reload, setAim } from './commands'
import { hurtPlayer } from './rules/combat'
import { placeMonster, placePlayer, run, setup, type Fixture } from './testing'

const HALL = [
  '##############', //
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#.S..........#',
  '##############',
]

/** The hero at (6, 5) with a monster one cell north (facing it is yaw PI). */
function ratAhead(f: Fixture, kind: 'rat' | 'zombie' | 'bat' = 'rat'): void {
  placePlayer(f, 6, 5)
  placeMonster(f, kind, f.s.player.pos.x, f.s.player.pos.z - 1.6)
}

describe('the gunblade', () => {
  test('the sword hits in a 180-degree arc in front and not behind', () => {
    const f = setup(HALL)
    ratAhead(f)
    attack(f.s, f.sim, 0, 0) // facing south, the rat is north
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(false)
    run(f, 0.5)
    f.sim.events.length = 0
    attack(f.s, f.sim, Math.PI * 0.6, 0) // facing east-north-east: inside the half circle
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(true)
  })

  test('LMB without RMB never fires the gun, even with rounds in it', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 5)
    f.s.gun.loaded = 12
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.some((e) => e.type === 'swordSwing')).toBe(true)
    expect(f.sim.events.some((e) => e.type === 'gunShot')).toBe(false)
    expect(f.s.gun.loaded).toBe(12)
  })

  test('the gun starts empty: aiming and pulling clicks', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 5)
    expect(f.s.gun.loaded + f.s.gun.reserve).toBe(0)
    setAim(f.s, f.sim, true)
    run(f, 0.3)
    f.sim.events.length = 0
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.map((e) => e.type)).toContain('gunEmpty')
  })

  test('a sword kill charges the gun; a gun kill does not', () => {
    const f = setup(HALL)
    ratAhead(f)
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.s.monsters.some((m) => m.active)).toBe(false) // one sword hit kills a rat
    expect(f.s.gun.reserve).toBe(f.sim.cfg.gun.chargePerKill.rat as number)
    expect(f.sim.events.find((e) => e.type === 'gunCharged')).toMatchObject({ first: true })
    expect(f.s.run.kills).toBe(1)
    // the gun kills a rat without charging anything
    f.s.gun.reserve = 0
    f.s.gun.loaded = 12
    run(f, 0.5)
    placeMonster(f, 'rat', f.s.player.pos.x, f.s.player.pos.z - 4, 0.3)
    setAim(f.s, f.sim, true)
    run(f, 0.3)
    f.s.gun.loaded = 12
    attack(f.s, f.sim, Math.PI, 0)
    attack(f.s, f.sim, Math.PI, 0)
    run(f, 0.5)
    for (let i = 0; i < 4 && f.s.monsters.some((m) => m.active); i++) {
      attack(f.s, f.sim, Math.PI, 0)
      run(f, 0.3)
    }
    expect(f.s.gun.reserve).toBe(0)
  })

  test('reload moves min(mag - loaded, reserve); a swing cancels it, aiming does not', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 5)
    f.s.gun.reserve = 30
    reload(f.s, f.sim)
    expect(f.s.gun.reloadTime).toBeGreaterThan(0)
    setAim(f.s, f.sim, true)
    run(f, f.sim.cfg.gun.reloadSec + 0.2)
    expect(f.s.gun.loaded).toBe(f.sim.cfg.gun.magSize)
    expect(f.s.gun.reserve).toBe(30 - f.sim.cfg.gun.magSize)
    f.s.gun.loaded = 0
    setAim(f.s, f.sim, false)
    run(f, 0.3)
    reload(f.s, f.sim)
    attack(f.s, f.sim, 0, 0) // a swing
    expect(f.s.gun.reloadTime).toBe(0)
    expect(f.sim.events.map((e) => e.type)).toContain('reloadCancelled')
  })

  test('the circular strike hits all around, has a long cooldown and makes the hero immune', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    placeMonster(f, 'rat', f.s.player.pos.x + 2, f.s.player.pos.z)
    placeMonster(f, 'rat', f.s.player.pos.x - 2, f.s.player.pos.z)
    circularStrike(f.s, f.sim)
    expect(f.s.monsters.filter((m) => m.active)).toHaveLength(0)
    expect(f.s.strike.cooldown).toBe(f.sim.cfg.strike.cooldownSec)
    expect(f.s.strike.immune).toBeGreaterThan(0)
    expect(hurtPlayer(f.s, f.sim, 10)).toBe(false)
    f.sim.events.length = 0
    circularStrike(f.s, f.sim)
    expect(f.sim.events.some((e) => e.type === 'strikeUsed')).toBe(false) // still cooling down
  })

  test('the sword cannot reach a bat overhead, a hero who jumped up can', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 5)
    placeMonster(f, 'bat', f.s.player.pos.x, f.s.player.pos.z - 1.6)
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(false)
    run(f, 0.5)
    f.s.player.pos.y = 1.2 // the top of a jump
    f.sim.events.length = 0
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(true)
  })

  test('you cannot attack during the draw', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 5)
    setAim(f.s, f.sim, true)
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.some((e) => e.type === 'gunShot' || e.type === 'gunEmpty')).toBe(false)
  })

  test('hits hurt, a short invulnerability follows, and running out of HP is death', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    f.s.player.hp = 15
    expect(hurtPlayer(f.s, f.sim, 10)).toBe(true)
    expect(f.s.player.hp).toBe(5)
    expect(hurtPlayer(f.s, f.sim, 10)).toBe(false) // invulnerable
    f.s.player.invuln = 0
    expect(hurtPlayer(f.s, f.sim, 10)).toBe(true)
    expect(f.sim.events.map((e) => e.type)).toContain('playerDied')
    expect(f.s.phase).toBe('dead')
  })
})
