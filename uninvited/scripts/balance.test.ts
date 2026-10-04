import { describe, expect, test } from 'bun:test'
import cfg from '../config.json'

// Relations the combat design depends on (DESIGN 3, 5). WP4 grows it with the director and the ammo economy.
describe('config.json balance relations', () => {
  test('a rat dies to one sword hit, a zombie to two, a beetle is armoured', () => {
    const sword = cfg.sword.damage
    expect(cfg.horde.kinds.rat.hp).toBeLessThanOrEqual(sword)
    expect(cfg.horde.kinds.zombie.hp).toBeGreaterThan(sword)
    expect(cfg.horde.kinds.zombie.hp).toBeLessThanOrEqual(sword * 2)
    expect(cfg.horde.kinds.beetle.hp).toBeGreaterThan(cfg.horde.kinds.zombie.hp * 0.8)
  })

  test('a bat is out of the standing sword swing but inside the reach of a hero at the top of a jump', () => {
    const apex = (cfg.player.jumpSpeed * cfg.player.jumpSpeed) / (2 * cfg.player.gravity)
    const bat = cfg.horde.kinds.bat
    expect(bat.height - bat.hitRadius).toBeGreaterThan(cfg.sword.reachUp)
    expect(bat.height - bat.hitRadius).toBeLessThan(cfg.sword.reachUp + apex)
    expect((bat as { swordImmune?: boolean }).swordImmune ?? false).toBe(false)
    expect((cfg.horde.kinds.ghost as { swordImmune?: boolean }).swordImmune).toBe(true)
  })

  test('the strike is a rare tool; the gun starts empty and is fed by sword kills', () => {
    expect(cfg.strike.cooldownSec).toBeGreaterThan(10)
    expect(cfg.strike.radius).toBeGreaterThan(cfg.sword.range)
    expect(cfg.gun.startLoaded + cfg.gun.startReserve).toBe(0)
    expect(cfg.gun.chargePerKill.rat).toBeGreaterThan(0)
    expect(cfg.gun.intervalSec).toBeLessThan(cfg.sword.cooldownSec)
    expect(cfg.gun.damage).toBeLessThan(cfg.sword.damage)
  })

  test('the peak caps fit the pool and every director profile uses known kinds', () => {
    const caps = cfg.director.caps
    expect(caps.swarm + caps.infantry + caps.ranged + caps.flyer).toBeLessThanOrEqual(cfg.horde.max * 1.5)
    for (const p of Object.values(cfg.director.profiles)) for (const k of Object.keys(p.mix)) expect(Object.keys(cfg.horde.kinds)).toContain(k)
  })

  test('ranged attackers are about a tenth of the horde at most (DESIGN 5)', () => {
    expect(cfg.director.caps.ranged / cfg.horde.max).toBeLessThanOrEqual(0.1)
  })
})
