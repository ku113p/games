import { describe, expect, test } from 'bun:test'
import { dash, jump, toggleCrouch } from './commands'
import { placePlayer, run, setup } from './testing'

const ROOM = [
  '############', //
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#.S......A.#',
  '############',
]

describe('moving the player', () => {
  test('walking builds up speed with inertia instead of jumping to it', () => {
    const f = setup(ROOM)
    f.intent.moveForward = 1
    f.intent.lookYaw = Math.PI / 2 // walk east
    run(f, 0.05)
    expect(f.s.player.speed).toBeGreaterThan(0)
    expect(f.s.player.speed).toBeLessThan(f.sim.cfg.player.walkSpeed * 0.6)
    run(f, 0.6)
    expect(f.s.player.speed).toBeCloseTo(f.sim.cfg.player.walkSpeed, 1)
    expect(f.s.player.facing).toBeCloseTo(Math.PI / 2, 1)
  })

  test('running is faster than walking and crouching is slower', () => {
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
    const crouch = speedWith((f) => toggleCrouch(f.s, f.sim))
    expect(runSpeed).toBeGreaterThan(walk)
    expect(crouch).toBeLessThan(walk)
  })

  test('running is noisy, walking is not', () => {
    const f = setup(ROOM)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    expect(run(f, 1)).not.toContain('noise')
    f.intent.run = true
    expect(run(f, 1)).toContain('noise')
  })

  test('C toggles the crouch, and you cannot stand up under something low', () => {
    const f = setup(ROOM)
    toggleCrouch(f.s, f.sim)
    expect(f.s.player.crouched).toBe(true)
    const p = f.s.player.pos
    f.world.box(p.x - 1, 1.3, p.z - 1, p.x + 1, 2, p.z + 1)
    toggleCrouch(f.s, f.sim)
    expect(f.s.player.crouched).toBe(true)
    f.world.boxes.pop()
    toggleCrouch(f.s, f.sim)
    expect(f.s.player.crouched).toBe(false)
  })

  test('jump goes up, comes down and is loud', () => {
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

  test('dash bursts forward, then waits for its cooldown', () => {
    const f = setup(ROOM)
    placePlayer(f, 2, 3)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    dash(f.s, f.sim)
    const x0 = f.s.player.pos.x
    expect(run(f, 0.2)).toContain('dashed')
    expect(f.s.player.pos.x - x0).toBeGreaterThan(1.6)
    dash(f.s, f.sim)
    expect(run(f, 0.1)).not.toContain('dashed')
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
