import { describe, expect, test } from 'bun:test'
import { jump } from './commands'
import { grabPlayer, pushPlayer, releasePlayer } from './rules/movement'
import { placePlayer, run, setup } from './testing'

const ROOM = [
  '############', //
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#.S........#',
  '############',
]

describe('moving the player', () => {
  test('walking ramps up over a couple of frames, not instantly', () => {
    const f = setup(ROOM)
    f.intent.moveForward = 1
    f.intent.lookYaw = Math.PI / 2 // walk east
    run(f, 1 / 60)
    expect(f.s.player.speed).toBeGreaterThan(0)
    expect(f.s.player.speed).toBeLessThan(f.sim.cfg.player.walkSpeed)
    run(f, 0.6)
    expect(f.s.player.speed).toBeCloseTo(f.sim.cfg.player.walkSpeed, 1)
    expect(f.s.player.facing).toBeCloseTo(Math.PI / 2, 1)
  })

  test('running is faster than walking', () => {
    const speedWith = (setupIntent: (f: ReturnType<typeof setup>) => void): number => {
      const f = setup(ROOM)
      f.intent.lookYaw = Math.PI / 2
      f.intent.moveForward = 1
      setupIntent(f)
      run(f, 0.8)
      return f.s.player.speed
    }
    const walk = speedWith(() => {})
    const runSpeed = speedWith((f) => (f.intent.run = true))
    expect(runSpeed).toBeGreaterThan(walk)
  })

  test('jump goes up and comes down', () => {
    const f = setup(ROOM)
    jump(f.s, f.sim)
    let top = 0
    const seen = run(f, 1.2, 1 / 60, () => {
      top = Math.max(top, f.s.player.pos.y)
    })
    expect(seen).toContain('jumped')
    expect(top).toBeGreaterThan(1)
    expect(f.s.player.pos.y).toBeCloseTo(0)
    expect(f.s.player.grounded).toBe(true)
  })

  test('the controls are snappy: full speed and a full stop within a few frames, turning almost at once', () => {
    const f = setup(ROOM)
    placePlayer(f, 5, 3)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    f.intent.run = true
    run(f, 0.2)
    expect(f.s.player.speed).toBeGreaterThan(f.sim.cfg.player.runSpeed * 0.9)
    f.intent.moveForward = 0
    f.intent.run = false
    run(f, 0.15)
    expect(f.s.player.speed).toBeLessThan(0.3)
    f.intent.moveForward = -1 // turn around
    run(f, 0.15)
    expect(Math.abs(Math.abs(f.s.player.facing) - Math.PI / 2)).toBeLessThan(0.05)
    expect(f.s.player.facing).toBeLessThan(0)
  })

  test('sprinting is clearly faster than walking', () => {
    const f = setup(ROOM)
    expect(f.sim.cfg.player.runSpeed).toBeGreaterThan(f.sim.cfg.player.walkSpeed * 1.6)
  })

  test('the tank holds the hero, throws them, and they lie down, then get up', () => {
    const f = setup(ROOM)
    placePlayer(f, 3, 3)
    expect(grabPlayer(f.s, f.sim)).toBe(true)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    const x0 = f.s.player.pos.x
    run(f, 0.3)
    expect(f.s.player.pos.x).toBe(x0) // held: the input does nothing
    releasePlayer(f.s, f.sim, 1, 0, 8)
    f.intent.moveForward = 0
    const seen = run(f, 0.4)
    expect(seen).not.toContain('playerGotUp')
    expect(f.s.player.pos.x).toBeGreaterThan(x0 + 1)
    const later = run(f, f.sim.cfg.player.downSec + f.sim.cfg.player.getUpSec + 1)
    expect(later).toContain('playerGotUp')
    expect(f.s.player.control).toBe('free')
  })

  test('a push adds a velocity; a throw into a wall hurts', () => {
    const f = setup(ROOM)
    placePlayer(f, 3, 3)
    pushPlayer(f.s, f.sim, 3, 0)
    expect(f.s.player.vel.x).toBe(3)
    placePlayer(f, 9, 3)
    grabPlayer(f.s, f.sim)
    releasePlayer(f.s, f.sim, 1, 0, 12)
    run(f, 1)
    expect(f.s.player.hp).toBe(f.sim.cfg.player.maxHp - f.sim.cfg.player.wallSlamDamage)
  })

  test('walls stop the player', () => {
    const f = setup(ROOM)
    placePlayer(f, 10, 3)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    run(f, 2)
    expect(f.s.player.pos.x).toBeLessThan(22 - 0.3)
  })
})
