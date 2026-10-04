import { describe, expect, test } from 'bun:test'
import { attack, dash, switchMode } from './commands'
import type { EntityDef } from './level'
import { damageTarget } from './rules/combat'
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
    const cd = f.sim.cfg.combat.sword.cooldownSec
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
    expect(swings(f, f.sim.cfg.combat.sword.cooldownSec + 0.1, () => {})).toEqual([])
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
    run(late, late.sim.cfg.combat.sword.comboWindowSec + 0.2)
    attack(late.s, late.sim, 0, 0)
    expect(late.s.player.combo).toBe(0)
  })

  test('the finisher reaches wider than the other swings, with the same damage', () => {
    const drones: EntityDef[] = [{ kind: 'drone', id: 'd', patrol: [[6, 1], [6, 1]] }]
    const cfg = setup(HALL).sim.cfg.combat.sword
    expect(cfg.finisher.arcDeg).toBeGreaterThan(cfg.arcDeg)
    expect(cfg.finisher.range).toBeGreaterThan(cfg.range)
    // the drone is behind the shoulder (about 110 degrees off the aim): only the finisher's 270 degrees reach it
    const hitWith = (step: number): boolean => {
      const f = setup(HALL, drones)
      placePlayer(f, 6, 2)
      f.s.player.combo = step - 1
      f.s.player.comboTime = 0
      attack(f.s, f.sim, Math.PI - 1.9, 0) // aim 109 degrees away from north
      return f.sim.events.some((e) => e.type === 'targetHit')
    }
    expect(hitWith(1)).toBe(false)
    expect(hitWith(2)).toBe(true)
  })

  test('a dash cancels the recovery of a swing and frees the weapon at once', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    attack(f.s, f.sim, 0, 0)
    expect(f.s.player.slashTime).toBeGreaterThan(0)
    dash(f.s, f.sim, 1, 0)
    run(f, 1 / 60)
    expect(f.s.player.dashTime).toBeGreaterThan(0)
    expect(f.s.player.slashTime).toBe(0)
    expect(f.s.player.attackCooldown).toBe(0)
  })

  test('a dash pressed just before it is ready still happens', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    dash(f.s, f.sim, 1, 0)
    run(f, 1 / 60)
    const cd = f.sim.cfg.player.dashCooldownSec
    run(f, f.sim.cfg.player.dashSec + 0.05)
    let t = f.sim.cfg.player.dashSec + 0.05
    const seen = run(f, cd + 0.1, 1 / 60, () => {
      t += 1 / 60
      if (Math.abs(t - (cd - 0.06)) < 1 / 120) dash(f.s, f.sim, 1, 0)
    })
    expect(seen.filter((e) => e === 'dashed').length).toBe(1)
  })

  test('an attack pressed right after a weapon switch fires when the switch is done', () => {
    const f = setup(HALL)
    placePlayer(f, 6, 3)
    f.sim.cfg.combat.switchSec = 0.1
    switchMode(f.s, f.sim)
    attack(f.s, f.sim, 0, 0)
    expect(f.s.player.charges).toBe(f.sim.cfg.combat.rifle.charges)
    run(f, f.sim.cfg.combat.switchSec + 0.05)
    expect(f.s.player.charges).toBe(f.sim.cfg.combat.rifle.charges - 1)
  })

  test('a hit pushes a warden back from the player', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 1], route: [{ at: [6, 1] }, { at: [6, 1] }] }])
    placePlayer(f, 6, 2)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    const z0 = w.pos.z
    damageTarget(f.s, f.sim, 'warden', 0, 10, false)
    run(f, 0.3)
    expect(Math.abs(w.pos.z - f.s.player.pos.z)).toBeGreaterThan(Math.abs(z0 - f.s.player.pos.z) + 0.1)
  })
})
