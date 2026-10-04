import { describe, expect, test } from 'bun:test'
import { toggleCrouch } from './commands'
import type { EntityDef } from './level'
import { makeNoise } from './rules/detection'
import { nextCell } from './rules/nav'
import { cellIndex } from './grid'
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

  test('crouched in a niche you are seen only up close', () => {
    const plan = [
      '##############', //
      '#............#',
      '#............#',
      '#............#',
      '#....n.......#',
      '#.S..#.....A.#',
      '##############',
    ]
    const f = setup(plan, [{ kind: 'drone', id: 'd', patrol: [[5, 1], [5, 1]] }])
    placePlayer(f, 5, 4)
    toggleCrouch(f.s, f.sim)
    const d = f.s.drones[0]
    if (d) d.yaw = 0
    run(f, 2)
    expect(d?.sees).toBe(false)
    expect(f.s.alarm.stage).toBe(0)
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
