// Network vision (DESIGN 8): hold Tab to see links, routes, cones, sensor zones and your noise. A short cooldown
// after it; held too long, it calls the security (alarm +1, someone comes to check) - with a warning before that.
import type { GameState, Sim } from '../state'
import { emit } from '../util'
import { callCheck, raiseAlarm } from './alarm'

/** Drone links follow their drones. */
function refreshLinks(s: GameState): void {
  for (const l of s.links) {
    if (l.kind !== 'drone') continue
    const d = s.drones[l.index]
    if (!d) continue
    l.to.x = d.pos.x
    l.to.y = d.pos.y
    l.to.z = d.pos.z
  }
}

export function updateScan(s: GameState, sim: Sim, dt: number, held: boolean): void {
  const sc = s.scan
  const cfg = sim.cfg.scan
  refreshLinks(s)
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
    sc.heat = Math.min(1, sc.held / cfg.maxSec)
    if (!sc.warned && sc.held >= cfg.warnAt * cfg.maxSec) {
      sc.warned = true
      emit(sim, { type: 'scanWarning' })
      emit(sim, { type: 'scanOverheating' })
    }
    if (sc.held >= cfg.maxSec) {
      sc.active = false
      sc.needRelease = true
      sc.cooldown = cfg.overheatCooldownSec
      emit(sim, { type: 'scanOverheated' })
      const p = s.player.pos
      const from = sim.events.length
      raiseAlarm(s, sim, 'scan', p.x, p.y, p.z)
      const drone = callCheck(s, sim, p.x, p.y, p.z)
      // where the responders come from: the gate of the first drone brought in just now
      let gate = -1
      for (let i = from; i < sim.events.length; i++) {
        const e = sim.events[i]
        if (e?.type !== 'droneSpawned') continue
        gate = s.drones[e.index]?.gate ?? -1
        break
      }
      emit(sim, { type: 'scanTraced', x: p.x, y: p.y, z: p.z, gate, drone })
    }
    return
  }
  if (held && allowed && !sc.needRelease && sc.cooldown <= 0) {
    sc.active = true
    sc.held = 0
    sc.heat = 0
    sc.warned = false
    emit(sim, { type: 'scanOn' })
  }
}
