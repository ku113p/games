// Signal shards (DESIGN 9): killed worms, drones and wardens drop small shards; walking close pulls them in and each
// one heals a little and refills a rifle charge. A sword finisher that cuts down several at once drops a big one. They fade after a few seconds,
// so the healing is earned in the middle of the fight, not after it. Checkpoints heal fully (progress.ts).
import { floorHeightAt } from '../grid'
import type { GameState, Sim } from '../state'
import { emit } from '../util'

/** Drops `count` shards around (x, z); the oldest one is reused when every slot is busy. */
export function dropShards(s: GameState, sim: Sim, x: number, z: number, count: number, big: boolean): void {
  const g = sim.grid
  for (let k = 0; k < count; k++) {
    let slot = -1
    let oldest = Infinity
    for (let i = 0; i < s.shards.length; i++) {
      const sh = s.shards[i]
      if (!sh) continue
      if (!sh.active) {
        slot = i
        break
      }
      if (sh.life < oldest) {
        oldest = sh.life
        slot = i
      }
    }
    const sh = s.shards[slot]
    if (!sh) return
    // a small fixed spread around the kill (golden angle), so a pack's drops do not stack
    const a = (s.run.kills * 2.4 + k * 2.4 + slot) % (Math.PI * 2)
    const r = count > 1 ? 0.35 : 0
    sh.active = true
    sh.big = big
    sh.life = sim.cfg.shards.lifeSec
    sh.pos.x = x + Math.sin(a) * r
    sh.pos.z = z + Math.cos(a) * r
    sh.pos.y = floorHeightAt(g, sh.pos.x, sh.pos.z) + 0.55
    emit(sim, { type: 'shardDropped', index: slot, x: sh.pos.x, y: sh.pos.y, z: sh.pos.z, big })
  }
}

/** Shards a killed enemy of this kind drops. */
export function shardsFor(sim: Sim, kind: 'worm' | 'drone' | 'warden', heavy: boolean): number {
  const c = sim.cfg.shards
  if (kind === 'worm') return c.wormDrops
  if (kind === 'drone') return c.droneDrops
  return heavy ? c.heavyDrops : c.wardenDrops
}

export function updateShards(s: GameState, sim: Sim, dt: number): void {
  const c = sim.cfg.shards
  const p = s.player
  const maxHp = sim.cfg.player.maxHp
  const playing = s.phase === 'playing'
  for (let i = 0; i < s.shards.length; i++) {
    const sh = s.shards[i]
    if (!sh || !sh.active) continue
    sh.life -= dt
    if (sh.life <= 0) {
      sh.active = false
      continue
    }
    if (!playing) continue
    const dx = p.pos.x - sh.pos.x
    const dz = p.pos.z - sh.pos.z
    const dy = p.pos.y + 0.9 - sh.pos.y
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy)
    if (Math.abs(p.pos.y - sh.pos.y) > 2.5) continue
    if (d <= c.pickupDist) {
      sh.active = false
      const heal = sh.big ? c.bigHeal : c.heal
      if (p.hp < maxHp) p.hp = Math.min(maxHp, p.hp + heal)
      p.charges = Math.min(sim.cfg.combat.rifle.charges, p.charges + (sh.big ? c.bigCharges : c.charges))
      emit(sim, { type: 'shardTaken', x: sh.pos.x, y: sh.pos.y, z: sh.pos.z, big: sh.big, hp: p.hp })
    } else if (d <= c.magnetDist) {
      const k = Math.min(1, (c.magnetSpeed * dt) / d)
      sh.pos.x += dx * k
      sh.pos.z += dz * k
      sh.pos.y += dy * k
    }
  }
}
