import { describe, expect, test } from 'bun:test'
import { attack, dash, jump, toggleCrouch } from './commands'
import { sensorZones, suspicionSources, type SuspicionSource } from './queries'
import { sweepYaw } from './rules/devices'
import type { EntityDef } from './level'
import { placePlayer, run, setup } from './testing'

// A hall 10 cells wide; a camera on the north wall looks south.
const HALL = [
  '############', //
  '#..........#',
  '#..........#',
  '#..........#',
  '#....~.....#',
  '#..........#',
  '#..........#',
  '#.S......A.#',
  '############',
]
const CAMERA: EntityDef[] = [{ kind: 'videoCamera', id: 'c', at: [5, 1], wall: 'n', sweep: [0, 0] }]

describe('video cameras', () => {
  test('a camera spots a standing player in its cone and raises the alarm', () => {
    const f = setup(HALL, CAMERA)
    placePlayer(f, 5, 6)
    const seen = run(f, 2)
    expect(f.s.cameras[0]?.sees).toBe(true)
    expect(seen).toContain('cameraSpotted')
    expect(f.s.alarm.stage).toBe(1)
  })

  test('outside the cone or behind a wall it sees nothing', () => {
    const f = setup(HALL, CAMERA)
    placePlayer(f, 10, 1) // far to the side, almost under the wall
    run(f, 2)
    expect(f.s.cameras[0]?.sees).toBe(false)
    const g = setup(HALL, CAMERA)
    placePlayer(g, 5, 6)
    g.world.box(8, 0, 6, 14, 5, 7) // a wall between
    run(g, 2)
    expect(g.s.cameras[0]?.sees).toBe(false)
    expect(g.s.alarm.stage).toBe(0)
  })

  test('low cover hides you only while you crouch', () => {
    const f = setup(HALL, CAMERA)
    placePlayer(f, 5, 5) // right behind the cover block at [5, 4]
    f.s.player.pos.z = 10.5
    run(f, 0.1)
    expect(f.s.cameras[0]?.sees).toBe(true)
    toggleCrouch(f.s, f.sim)
    run(f, 0.1)
    expect(f.s.cameras[0]?.sees).toBe(false)
  })

  test('crouching fills the suspicion slower', () => {
    const standing = setup(HALL, CAMERA)
    placePlayer(standing, 7, 6)
    run(standing, 0.5)
    const crouched = setup(HALL, CAMERA)
    placePlayer(crouched, 7, 6)
    toggleCrouch(crouched.s, crouched.sim)
    run(crouched, 0.5)
    expect(crouched.s.cameras[0]?.suspicion ?? 1).toBeLessThan(standing.s.cameras[0]?.suspicion ?? 0)
  })

  test('the sweep eases between its ends and holds at each end', () => {
    const a = -1
    const b = 1
    expect(sweepYaw(0, a, b, 8, 0, 0.25, 0)).toBeCloseTo(a)
    expect(sweepYaw(0, a, b, 8, 0, 0.25, 0.4)).toBeCloseTo(a) // still holding
    expect(sweepYaw(0, a, b, 8, 0, 0.25, 4)).toBeCloseTo(b)
    expect(sweepYaw(0, a, b, 8, 0, 0.25, 2)).toBeCloseTo(0, 1)
    expect(sweepYaw(0, a, b, 8, 0, 0.25, 8)).toBeCloseTo(a)
  })

  test('breaking a camera brings someone to check', () => {
    const f = setup(HALL, [...CAMERA, { kind: 'spawn', at: [10, 1] }])
    placePlayer(f, 5, 2)
    f.s.player.mode = 'rifle'
    // aim at the camera: up and north
    const cam = f.s.cameras[0]
    expect(cam).toBeDefined()
    if (!cam) return
    const p = f.s.player.pos
    const dx = cam.pos.x - p.x
    const dz = cam.pos.z - p.z
    const dy = cam.pos.y - (p.y + f.sim.cfg.combat.rifle.muzzleHeight)
    const yaw = Math.atan2(dx, dz)
    const pitch = Math.atan2(dy, Math.hypot(dx, dz))
    attack(f.s, f.sim, yaw, pitch)
    run(f, 0.2)
    attack(f.s, f.sim, yaw, pitch)
    const types = f.sim.events.map((e) => e.type)
    run(f, 0.1)
    expect(cam.alive).toBe(false)
    expect(types).toContain('checkCalled')
    expect(f.s.drones.some((d) => d.active && d.role === 'checker')).toBe(true)
    expect(f.s.run.devicesBroken).toBe(1)
  })
})

describe('suspicion sources (the HUD marks)', () => {
  const pool = (): SuspicionSource[] => Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, level: 0, spotted: false }))

  test('a camera noticing you is listed at its position, red once it has spotted you; nobody noticing lists nothing', () => {
    const f = setup(HALL, CAMERA)
    const out = pool()
    placePlayer(f, 10, 1) // outside the cone
    run(f, 0.5)
    expect(suspicionSources(f.s, out)).toBe(0)
    placePlayer(f, 5, 6)
    run(f, 0.3)
    expect(suspicionSources(f.s, out)).toBe(1)
    expect(out[0]?.x).toBeCloseTo(f.s.cameras[0]?.pos.x ?? -1)
    expect(out[0]?.level).toBeGreaterThan(0)
    expect(out[0]?.spotted).toBe(false)
    run(f, 2)
    expect(suspicionSources(f.s, out)).toBe(1)
    expect(out[0]?.level).toBe(1)
    expect(out[0]?.spotted).toBe(true)
  })
})

describe('sound cameras', () => {
  const MIC: EntityDef[] = [{ kind: 'soundCamera', id: 'm', at: [5, 1], wall: 'n' }]

  test('running inside its ring is heard and raises the alarm; walking is not', () => {
    const walk = setup(HALL, MIC)
    placePlayer(walk, 2, 3)
    walk.intent.lookYaw = Math.PI / 2
    walk.intent.moveForward = 1
    run(walk, 2)
    expect(walk.s.alarm.stage).toBe(0)

    const f = setup(HALL, MIC)
    placePlayer(f, 2, 3)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    f.intent.run = true
    const seen = run(f, 2)
    expect(seen).toContain('soundHeard')
    expect(f.s.alarm.stage).toBe(1)
  })
})

describe('motion sensors', () => {
  const SENSOR: EntityDef[] = [{ kind: 'motionSensor', id: 's', at: [6, 3] }]

  test('walking past is fine, running past trips it', () => {
    const walk = setup(HALL, SENSOR)
    placePlayer(walk, 2, 3)
    walk.intent.lookYaw = Math.PI / 2
    walk.intent.moveForward = 1
    expect(run(walk, 3)).not.toContain('sensorTripped')

    const f = setup(HALL, SENSOR)
    placePlayer(f, 2, 3)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    f.intent.run = true
    expect(run(f, 3)).toContain('sensorTripped')
    expect(f.s.alarm.stage).toBe(1)
  })

  test('crouch-walking passes; a jump or a dash inside the zone trips it', () => {
    const crouch = setup(HALL, SENSOR)
    placePlayer(crouch, 2, 3)
    toggleCrouch(crouch.s, crouch.sim)
    crouch.intent.lookYaw = Math.PI / 2
    crouch.intent.moveForward = 1
    expect(run(crouch, 6)).not.toContain('sensorTripped')

    const j = setup(HALL, SENSOR)
    placePlayer(j, 6, 3)
    jump(j.s, j.sim)
    expect(run(j, 0.5)).toContain('sensorTripped')

    const d = setup(HALL, SENSOR)
    placePlayer(d, 4, 3)
    dash(d.s, d.sim, 1, 0)
    expect(run(d, 0.3)).toContain('sensorTripped')
  })

  test('its zone, whether it is rearming, and whether you are close enough to notice it are readable', () => {
    const f = setup(HALL, SENSOR)
    placePlayer(f, 1, 7)
    run(f, 0.05)
    expect(sensorZones(f.s)[0]?.seenUpClose).toBe(false)
    placePlayer(f, 5, 3)
    run(f, 0.05)
    const z = sensorZones(f.s)[0]
    expect(z?.seenUpClose).toBe(true)
    expect(z?.radius).toBe(f.sim.cfg.motionSensor.radius)
    expect(z?.tripped).toBe(false)
  })
})

describe('laser grids', () => {
  const CORRIDOR = [
    '##########', //
    '#....=...#',
    '#S...=..A#',
    '#....=...#',
    '##########',
  ]
  const LASER: EntityDef[] = [{ kind: 'laser', id: 'l', at: [5, 2] }]

  test('the grid spans the corridor as one plane', () => {
    const f = setup(CORRIDOR, LASER)
    const l = f.s.lasers[0]
    expect(l?.alongX).toBe(true)
    expect(l?.coord).toBe(11)
    expect(l?.min).toBe(2)
    expect(l?.max).toBe(8)
  })

  test('walking through burns and raises the alarm', () => {
    const f = setup(CORRIDOR, LASER)
    placePlayer(f, 3, 2)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    const seen = run(f, 3)
    expect(seen).toContain('laserTripped')
    expect(f.s.player.hp).toBe(f.sim.cfg.player.maxHp - f.sim.cfg.laser.damage)
    expect(f.s.alarm.stage).toBe(1)
  })

  test('a paused grid lets you through', () => {
    const f = setup(CORRIDOR, LASER)
    const l = f.s.lasers[0]
    if (l) l.pausedTime = 10
    placePlayer(f, 3, 2)
    f.intent.lookYaw = Math.PI / 2
    f.intent.moveForward = 1
    expect(run(f, 3)).not.toContain('laserTripped')
    expect(f.s.alarm.stage).toBe(0)
  })
})
