// Network vision (DESIGN 8): hold Tab to see sensors and links. A short cooldown after it; held too long, it calls
// the security (alarm +1, someone comes to check).
import type { GameState, Sim } from '../state'
import { emit } from '../util'
import { callCheck, raiseAlarm } from './alarm'

export function updateScan(s: GameState, sim: Sim, dt: number, held: boolean): void {
  const sc = s.scan
  const cfg = sim.cfg.scan
  if (sc.cooldown > 0) sc.cooldown -= dt
  if (!held) sc.needRelease = false
  const allowed = s.phase === 'playing' && s.hack === null
  if (sc.active) {
    if (!held || !allowed) {
      sc.active = false
      sc.cooldown = cfg.cooldownSec
      emit(sim, { type: 'scanOff' })
      return
    }
    sc.held += dt
    if (!sc.warned && sc.held >= cfg.warnSec) {
      sc.warned = true
      emit(sim, { type: 'scanOverheating' })
    }
    if (sc.held >= cfg.maxSec) {
      sc.active = false
      sc.needRelease = true
      sc.cooldown = cfg.overheatCooldownSec
      emit(sim, { type: 'scanOverheated' })
      const p = s.player.pos
      raiseAlarm(s, sim, 'scan', p.x, p.y, p.z)
      callCheck(s, sim, p.x, p.y, p.z)
    }
    return
  }
  if (held && allowed && !sc.needRelease && sc.cooldown <= 0) {
    sc.active = true
    sc.held = 0
    sc.warned = false
    emit(sim, { type: 'scanOn' })
  }
}
