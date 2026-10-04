import { describe, expect, test } from 'bun:test'
import cfg from '../config.json'

// Relations the combat design depends on (designer: drones watch and die fast, wardens fight, worms crush by mass).
describe('config.json balance relations', () => {
  test('drones die to 1-2 rifle shots or one sword hit, and hover out of the standing sword swing', () => {
    expect(cfg.drone.hp).toBeLessThanOrEqual(cfg.combat.rifle.damage * 2)
    expect(cfg.drone.hp).toBeLessThanOrEqual(cfg.combat.sword.damage)
    // a jump apex (v^2 / 2g) plus the sword's upward reach stays below the hovering drone
    const apex = (cfg.player.jumpSpeed * cfg.player.jumpSpeed) / (2 * cfg.player.gravity)
    expect(cfg.combat.sword.reachUp + apex).toBeLessThan(cfg.drone.hover)
    // ...but a warden's chest is well inside it
    expect(cfg.warden.chestHeight).toBeLessThan(cfg.combat.sword.reachUp)
  })

  test('drones shoot weakly, wardens hit harder than drones and worms', () => {
    expect(cfg.drone.boltDamage).toBeLessThan(cfg.warden.boltDamage)
    expect(cfg.drone.boltDamage).toBeLessThan(cfg.worm.biteDamage)
    expect(cfg.warden.strikeDamage).toBeGreaterThan(cfg.worm.biteDamage)
    expect(cfg.warden.meleeDist).toBeGreaterThan(cfg.warden.strikeRange)
    expect(cfg.warden.shotMinDist).toBeGreaterThan(cfg.warden.meleeDist)
  })

  test('waves escalate and stay inside the worm cap', () => {
    const waves = cfg.alarm.waves
    expect(waves.length).toBeGreaterThanOrEqual(cfg.alarm.firewallAfterWaves)
    let last = 0
    for (const w of waves) {
      const worms = w.packs.reduce((a, b) => a + b, 0)
      const total = worms + w.drones + w.wardens + w.heavy
      expect(total).toBeGreaterThanOrEqual(8)
      expect(total).toBeLessThanOrEqual(24)
      expect(worms).toBeLessThanOrEqual(cfg.worm.max)
      expect(w.wardens + w.heavy).toBeLessThanOrEqual(cfg.alarm.waveWardenSlots)
      expect(total).toBeGreaterThanOrEqual(last)
      last = total
    }
    expect(waves[waves.length - 1]?.heavy).toBeGreaterThanOrEqual(1)
  })

  test('tokens: a ring in front of the bite range, and small caps', () => {
    expect(cfg.tokens.ringMin).toBeGreaterThan(cfg.worm.biteRange)
    expect(cfg.tokens.ringMax).toBeGreaterThan(cfg.tokens.ringMin)
    expect(cfg.tokens.bite).toBe(3)
    expect(cfg.tokens.melee).toBe(1)
    expect(cfg.tokens.ranged).toBe(2)
  })
})
