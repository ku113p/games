import { describe, expect, test } from 'bun:test'
import { jump, moveTap, TAP_BACK, TAP_FORWARD, TAP_RIGHT, toggleCrouch } from './commands'
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

  test('a double tap of a direction dashes that way, then waits for its cooldown', () => {
    const f = setup(ROOM)
    placePlayer(f, 2, 3)
    f.intent.lookYaw = Math.PI / 2 // camera looks east: "forward" is +x
    moveTap(f.s, f.sim, TAP_FORWARD, f.intent.lookYaw)
    run(f, 0.1)
    moveTap(f.s, f.sim, TAP_FORWARD, f.intent.lookYaw)
    const x0 = f.s.player.pos.x
    expect(run(f, 0.2)).toContain('dashed')
    expect(f.s.player.pos.x - x0).toBeGreaterThan(1.6)
    moveTap(f.s, f.sim, TAP_FORWARD, f.intent.lookYaw)
    moveTap(f.s, f.sim, TAP_FORWARD, f.intent.lookYaw)
    expect(run(f, 0.1)).not.toContain('dashed')
  })

  test('the dash goes where the double-tapped key points, relative to the camera', () => {
    const f = setup(ROOM)
    placePlayer(f, 5, 3)
    f.intent.lookYaw = Math.PI / 2 // east; right of that is south (+z)
    moveTap(f.s, f.sim, TAP_RIGHT, f.intent.lookYaw)
    moveTap(f.s, f.sim, TAP_RIGHT, f.intent.lookYaw)
    const z0 = f.s.player.pos.z
    run(f, 0.2)
    expect(f.s.player.pos.z - z0).toBeGreaterThan(1.5)
  })

  test('two slow taps, or two different keys, do not dash', () => {
    const f = setup(ROOM)
    placePlayer(f, 5, 3)
    moveTap(f.s, f.sim, TAP_FORWARD, 0)
    run(f, f.sim.cfg.player.dashTapSec + 0.05)
    moveTap(f.s, f.sim, TAP_FORWARD, 0)
    expect(run(f, 0.1)).not.toContain('dashed')
    run(f, 0.5)
    moveTap(f.s, f.sim, TAP_FORWARD, 0)
    moveTap(f.s, f.sim, TAP_BACK, 0)
    expect(run(f, 0.1)).not.toContain('dashed')
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

  test('Ctrl crouches while held and stands up on release - once there is room', () => {
    const f = setup(ROOM)
    f.intent.crouchHold = true
    run(f, 0.05)
    expect(f.s.player.crouched).toBe(true)
    const p = f.s.player.pos
    f.world.box(p.x - 1, 1.3, p.z - 1, p.x + 1, 2, p.z + 1)
    f.intent.crouchHold = false
    run(f, 0.1)
    expect(f.s.player.crouched).toBe(true) // no room yet
    f.world.boxes.pop()
    run(f, 0.05)
    expect(f.s.player.crouched).toBe(false)
  })

  test('C during a Ctrl crouch keeps the crouch after Ctrl is released; Ctrl does not undo a C crouch', () => {
    const f = setup(ROOM)
    f.intent.crouchHold = true
    run(f, 0.05)
    toggleCrouch(f.s, f.sim)
    f.intent.crouchHold = false
    run(f, 0.1)
    expect(f.s.player.crouched).toBe(true)
    toggleCrouch(f.s, f.sim)
    expect(f.s.player.crouched).toBe(false)
    toggleCrouch(f.s, f.sim)
    f.intent.crouchHold = true
    run(f, 0.05)
    f.intent.crouchHold = false
    run(f, 0.05)
    expect(f.s.player.crouched).toBe(true)
  })

  test('the noise radius follows sprinting and fades after it', () => {
    const f = setup(ROOM)
    placePlayer(f, 2, 3)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    run(f, 0.5)
    expect(f.s.player.noise).toBe(0)
    f.intent.run = true
    run(f, 0.3)
    expect(f.s.player.noise).toBe(f.sim.cfg.noise.run)
    f.intent.run = false
    f.intent.moveForward = 0
    run(f, f.sim.cfg.noise.fadeSec + 0.1)
    expect(f.s.player.noise).toBe(0)
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
