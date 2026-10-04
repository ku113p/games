// Stages, medkits, cranks, the exit, onboarding and the hold-out (owner: WP1 Spine, stages and flow).
// WP0 gives: medkits (touch to heal while hurt), the exit (-> levelDone), `openGroup`, and the stage-target stubs.
// WP1 adds the stage triggers, the crank, the onboarding steps and the hold-out.
import { setNavWallOpen } from './nav'
import type { KillInfo, TargetSphere } from '../model/common'
import type { GameState, Sim } from '../state'
import { dist2, emit } from '../util'

/** One tick of the stage logic. */
export function updateStages(s: GameState, sim: Sim, dt: number): void {
  void dt
  const p = s.player
  const cfg = sim.cfg.medkit
  for (let i = 0; i < s.medkits.length; i++) {
    const m = s.medkits[i]
    if (!m || m.taken) continue
    if (dist2(m.pos.x, m.pos.z, p.pos.x, p.pos.z) > cfg.pickupDist * cfg.pickupDist || Math.abs(m.pos.y - p.pos.y) > 1.5) continue
    // taken by touch only when hurt: the player can save them for later
    if (p.hp >= sim.cfg.player.maxHp) continue
    m.taken = true
    p.hp = Math.min(sim.cfg.player.maxHp, p.hp + cfg.heal)
    emit(sim, { type: 'medkitTaken', index: i, hp: p.hp })
  }
  if (sim.exit && s.phase === 'playing' && dist2(sim.exit.x, sim.exit.z, p.pos.x, p.pos.z) < sim.grid.cell * sim.grid.cell * 0.25) {
    s.phase = 'levelDone'
    emit(sim, { type: 'levelDone' })
  }
}

/**
 * Opens portcullis / breakable wall group `groupIndex` for good: the physical blocker goes, the navigation flags flip.
 * Contract WP1 -> WP5.
 */
export function openGroup(s: GameState, sim: Sim, groupIndex: number): void {
  const w = s.portcullis[groupIndex]
  if (!w || w.open) return
  w.open = true
  sim.world.setBlocker(groupIndex, false)
  setNavWallOpen(sim.nav, groupIndex, true)
  emit(sim, { type: 'portcullisOpened', index: groupIndex })
}

/** Makes the physical world and caches match a restored state (portcullises). */
export function syncWorld(s: GameState, sim: Sim): void {
  for (let i = 0; i < s.portcullis.length; i++) {
    const open = s.portcullis[i]?.open === true
    sim.world.setBlocker(i, !open)
    setNavWallOpen(sim.nav, i, open)
  }
}

/** Fills `out` with the sphere of stage target `i` (a mannequin or the chandelier); false when it cannot be hit. Contract WP2 <-> WP1. */
export function stageTargetSphere(s: GameState, sim: Sim, i: number, out: TargetSphere): boolean {
  void sim
  const t = s.targets[i]
  if (!t || !t.alive) return false
  out.x = t.pos.x
  out.y = t.pos.y + t.height
  out.z = t.pos.z
  out.r = t.radius
  return true
}

/**
 * Damage to a stage target; true when it died. Mannequins take the sword and the gun, the chandelier only the gun
 * (the onboarding teaches both). Contract WP2 <-> WP1. WP1 adds the respawn and the onboarding steps.
 */
export function damageStageTarget(s: GameState, sim: Sim, i: number, amount: number, byGun: boolean, out: KillInfo): boolean {
  void sim
  const t = s.targets[i]
  out.killed = false
  if (!t || !t.alive) return false
  if (t.kind === 'chandelier' && !byGun) return false
  t.hp -= amount
  out.kind = t.kind
  out.x = t.pos.x
  out.y = t.pos.y + t.height
  out.z = t.pos.z
  if (t.hp > 0) return false
  t.alive = false
  out.killed = true
  return true
}
