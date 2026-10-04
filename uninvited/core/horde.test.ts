// The horde base (WP0 port of the old worm tests; WP3 grows it into horde / crowd / flyers / tank tests).
import { describe, expect, test } from 'bun:test'
import type { EntityDef } from './level'
import { aliveByClass, spawnMonsters } from './rules/horde'
import { tokensInUse } from './rules/tokens'
import { placePlayer, run, setup } from './testing'

const HALL = [
  '####################', //
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#S.................#',
  '####################',
]
const POINTS: EntityDef[] = [{ kind: 'spawn', id: 'door', at: [18, 2], wall: 'e', type: 'door' }]

describe('the horde', () => {
  test('a pack comes out of a spawn point, rushes the player and bites', () => {
    const f = setup(HALL, POINTS)
    placePlayer(f, 3, 3)
    expect(spawnMonsters(f.s, f.sim, 'rat', 0, 4)).toBe(4)
    expect(aliveByClass(f.s, 'swarm')).toBe(4)
    expect(f.sim.events.map((e) => e.type)).toEqual(['spawnOpened', 'monsterPack'])
    f.s.player.hp = 1000
    const seen = run(f, 10)
    expect(seen).toContain('monsterWindup')
    expect(seen).toContain('monsterAttack')
    expect(f.s.player.hp).toBeLessThan(1000)
  })

  test('only the token count attacks at once; the others wait on the ring', () => {
    const f = setup(HALL, POINTS)
    placePlayer(f, 3, 3)
    f.s.player.hp = 100000
    spawnMonsters(f.s, f.sim, 'rat', 0, 12)
    let most = 0
    run(f, 6, 1 / 60, () => {
      most = Math.max(most, tokensInUse(f.s, f.sim, 'bite'))
    })
    expect(most).toBeGreaterThan(0)
    expect(most).toBeLessThanOrEqual(f.sim.cfg.horde.tokens.bite)
  })

  test('the pool is bounded: asking for more than it holds spawns what fits', () => {
    const f = setup(HALL, POINTS)
    const max = f.sim.cfg.horde.max
    expect(spawnMonsters(f.s, f.sim, 'rat', 0, max + 50)).toBe(max)
    expect(spawnMonsters(f.s, f.sim, 'rat', 0, 5)).toBe(0)
  })

  test('the same seed gives the same run', () => {
    const play = (): string => {
      const f = setup(HALL, POINTS, undefined, 7)
      placePlayer(f, 3, 3)
      f.s.player.hp = 100000
      spawnMonsters(f.s, f.sim, 'rat', 0, 6)
      run(f, 4)
      return JSON.stringify(f.s.monsters.filter((m) => m.active).map((m) => [m.pos.x.toFixed(3), m.pos.z.toFixed(3), m.mode]))
    }
    expect(play()).toBe(play())
  })
})
