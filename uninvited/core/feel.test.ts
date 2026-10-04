import { describe, expect, test } from 'bun:test'
import { attack, setAim } from './commands'
import { damageTarget } from './rules/combat'
import { placeMonster, placePlayer, run, setup } from './testing'

const HALL = [
  '##############', //
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#.S..........#',
  '##############',
]

/** The combo step of every swing that happened while running `seconds` with `each` called before every tick. */
function swings(f: ReturnType<typeof setup>, seconds: number, each: () => void): number[] {
  const steps: number[] = []
  run(f, seconds, 1 / 60, () => {
    each()
    for (const e of f.sim.events) if (e.type === 'swordSwing') steps.push(e.combo) // a swing the press itself made
  })
  return steps
}

describe('input feel: buffering, combo, cancel', () => {
  test('an attack starts in the very call that presses it', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    attack(f.s, f.sim, 0, 0)
    expect(f.sim.events.some((e) => e.type === 'swordSwing')).toBe(true)
    expect(f.s.player.slashTime).toBeGreaterThan(0)
    expect(f.s.player.facing).toBeCloseTo(0, 5)
  })

  test('a press during the cooldown is kept and fires the moment the weapon is ready', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    attack(f.s, f.sim, 0, 0)
    const cd = f.sim.cfg.sword.cooldownSec
    // pressed again 0.08 s before the cooldown ends: inside the 0.12 s buffer
    let t = 0
    const seen = run(f, cd + 0.1, 1 / 60, () => {
      if (Math.abs(t - (cd - 0.08)) < 1 / 120) attack(f.s, f.sim, 0, 0)
      t += 1 / 60
    })
    expect(seen.filter((e) => e === 'swordSwing').length).toBe(1)
    expect(f.s.player.combo).toBe(1)
  })

  test('a press that is too early is lost, and a held button is not kept after the release', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    attack(f.s, f.sim, 0, 0)
    run(f, 0.02)
    attack(f.s, f.sim, 0, 0) // 0.3 s before the end: the buffer runs out first
    expect(swings(f, f.sim.cfg.sword.cooldownSec + 0.1, () => {})).toEqual([])
    const g = setup(HALL)
    placePlayer(g, 6, 3)
    attack(g.s, g.sim, 0, 0)
    run(g, 0.3)
    attack(g.s, g.sim, 0, 0, false) // only a hold: nothing is kept
    expect(g.s.player.attackBuffer).toBeLessThanOrEqual(0)
  })

  test('three quick swings make the combo, the third is the wide finisher; a late one starts over', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    const steps = swings(f, 1.6, () => attack(f.s, f.sim, 0, 0, false))
    expect(steps.slice(0, 4)).toEqual([0, 1, 2, 0])
    const late = setup(HALL)
    placePlayer(late, 6, 3)
    attack(late.s, late.sim, 0, 0)
    run(late, late.sim.cfg.sword.comboWindowSec + 0.2)
    attack(late.s, late.sim, 0, 0)
    expect(late.s.player.combo).toBe(0)
  })

  test('the finisher reaches wider than the other swings, with the same damage', () => {
    const cfg = setup(HALL).sim.cfg.sword
    expect(cfg.finisher.arcDeg).toBeGreaterThan(cfg.arcDeg)
    expect(cfg.finisher.range).toBeGreaterThan(cfg.range)
    // the rat is behind the shoulder (about 110 degrees off the aim): only the finisher's 270 degrees reach it
    const hitWith = (step: number): boolean => {
      const f = setup(HALL)
      placePlayer(f, 6, 4)
      placeMonster(f, 'zombie', f.s.player.pos.x, f.s.player.pos.z - 1.6)
      f.s.player.combo = step - 1
      f.s.player.comboTime = 0
      attack(f.s, f.sim, Math.PI - 1.9, 0) // aim 109 degrees away from north
      return f.sim.events.some((e) => e.type === 'targetHit')
    }
    expect(hitWith(1)).toBe(false)
    expect(hitWith(2)).toBe(true)
  })

  test('an attack pressed during the gun draw fires when the draw is done', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    f.s.gun.loaded = 12
    setAim(f.s, f.sim, true)
    attack(f.s, f.sim, 0, 0)
    expect(f.s.gun.loaded).toBe(12)
    run(f, f.sim.cfg.gun.aimDrawSec + 0.05)
    expect(f.s.gun.loaded).toBe(11)
  })

  test('a hit pushes a monster back from the player', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 2)
    const m = placeMonster(f, 'zombie', f.s.player.pos.x, f.s.player.pos.z - 1.2)
    const z0 = m.pos.z
    damageTarget(f.s, f.sim, 0, 10, false)
    run(f, 0.3)
    expect(Math.abs(m.pos.z - f.s.player.pos.z)).toBeGreaterThan(Math.abs(z0 - f.s.player.pos.z) + 0.1)
  })
})
