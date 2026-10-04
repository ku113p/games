import { describe, expect, test } from 'bun:test'
import { toggleCrouch } from './commands'
import type { EntityDef } from './level'
import { makeNoise } from './rules/detection'
import { nextCell } from './rules/nav'
import { cellIndex } from './grid'
import { isInCover } from './queries'
import { placePlayer, run, setup } from './testing'

const HALL = [
  '##############', //
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#.S........A.#',
  '##############',
]

const PATROL: EntityDef[] = [{ kind: 'drone', id: 'd', patrol: [[2, 1], [11, 1]] }]

describe('patrol drones', () => {
  test('fly between their waypoints and pause at each', () => {
    const f = setup(HALL, PATROL)
    placePlayer(f, 2, 5)
    f.s.player.pos.z = 11 // keep out of sight below
    const d = f.s.drones[0]
    expect(d?.pos.x).toBe(5)
    run(f, 6)
    expect(d?.pos.x).toBeGreaterThan(15)
    expect(d?.pos.y).toBeCloseTo(f.sim.cfg.drone.hover, 1)
  })

  test('a drone that sees you grows suspicious, then alerts, raises the alarm and shoots', () => {
    const f = setup(HALL, [{ kind: 'drone', id: 'd', patrol: [[2, 1], [2, 1]] }])
    placePlayer(f, 2, 5) // straight ahead of it (it faces south at the start? make it)
    const d = f.s.drones[0]
    if (d) d.yaw = 0
    const seen = run(f, 3)
    expect(seen).toContain('droneSuspicious')
    expect(seen).toContain('droneAlerted')
    expect(f.s.alarm.stage).toBeGreaterThanOrEqual(1)
    expect(seen).toContain('droneFired')
    run(f, 2)
    expect(f.s.player.hp).toBeLessThan(f.sim.cfg.player.maxHp)
  })

  test('crouched behind a server block you are hidden; standing, your head shows over it', () => {
    const block: EntityDef = { kind: 'cover', at: [5, 4], size: [3, 0.6, 1.4], offset: [0, -0.6] }
    const drone: EntityDef = { kind: 'drone', id: 'd', patrol: [[5, 1], [5, 1]] }
    const f = setup(HALL, [block, drone])
    placePlayer(f, 5, 4)
    f.s.player.pos.z += 0.3
    toggleCrouch(f.s, f.sim)
    const d = f.s.drones[0]
    run(f, 2, 1 / 60, () => {
      if (d) d.yaw = 0 // keep it looking straight at the block
    })
    expect(d?.sees).toBe(false)
    expect(f.s.alarm.stage).toBe(0)
    expect(isInCover(f.s, f.sim)).toBe(true)
    toggleCrouch(f.s, f.sim)
    if (d) d.yaw = 0
    run(f, 1 / 60)
    expect(d?.sees).toBe(true)
  })

  test('a patrol drone comes to look at a noise', () => {
    const f = setup(HALL, [{ kind: 'drone', id: 'd', patrol: [[2, 1], [2, 1]] }])
    placePlayer(f, 10, 4)
    const d = f.s.drones[0]
    if (d) d.yaw = Math.PI // looking away
    makeNoise(f.s, f.sim, 20)
    run(f, 0.1)
    expect(d?.mode).toBe('investigate')
    expect(d?.target.x).toBeCloseTo(21)
  })

  test('a drone flies over a low hex module and around a tall one', () => {
    const route: EntityDef = { kind: 'drone', id: 'd', patrol: [[2, 3], [11, 3]] }
    const low = setup(HALL, [route, { kind: 'hex', at: [6, 3], radius: 0.8, height: 1.4 }])
    placePlayer(low, 2, 5)
    low.s.player.pos.z = 11
    let top = 0
    run(low, 6, 1 / 60, () => {
      const d = low.s.drones[0]
      if (d && Math.abs(d.pos.x - 13) < 0.5) top = Math.max(top, d.pos.y)
    })
    expect(top).toBeGreaterThan(2.1) // 1.4 + the clearance, over the module
    const tall = setup(HALL, [route, { kind: 'hex', at: [6, 3], radius: 0.8, height: 5 }])
    placePlayer(tall, 2, 5)
    tall.s.player.pos.z = 11
    const d = tall.s.drones[0]
    let inside = 0
    let passed = false
    run(tall, 14, 1 / 60, () => {
      if (!d) return
      if (Math.abs(d.pos.x - 13) < 0.8 && Math.abs(d.pos.z - 7) < 0.7) inside++
      if (d.pos.x > 16) passed = true
    })
    expect(inside).toBe(0)
    expect(passed).toBe(true)
  })

  test('the flow field leads around walls', () => {
    const plan = [
      '#######', //
      '#S....#',
      '####..#',
      '#A....#',
      '#######',
    ]
    const f = setup(plan)
    const g = f.sim.grid
    let at = cellIndex(g, 1, 1)
    const goal = cellIndex(g, 1, 3)
    const path: number[] = []
    for (let i = 0; i < 20 && at !== goal; i++) {
      at = nextCell(f.sim.nav, at, goal)
      expect(at).toBeGreaterThanOrEqual(0)
      path.push(at)
    }
    expect(at).toBe(goal)
    expect(path.length).toBeGreaterThan(4) // it had to go round
  })
})
