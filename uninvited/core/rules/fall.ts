// The void (DESIGN 6): the open city's platforms have edges. Step off one and you drop into the dark; the screen fades
// out, you are put back on the last safe ground with a damage penalty, and it fades in again (config world.fall).
// Safe ground: standing on a floor at least fall.safeMargin from the void, so you are never put back on the edge.
import { CellKind, cellAt, type Grid } from '../grid'
import type { GameState, Sim } from '../state'
import { emit } from '../util'
import { hurtPlayer } from './combat'

/** Is the floor around (x, z) at least `margin` from the void on every side (the cell under it included)? */
function safeGround(g: Grid, x: number, z: number, margin: number): boolean {
  for (let k = 0; k < 9; k++) {
    const i = cellAt(g, x + ((k % 3) - 1) * margin, z + (Math.floor(k / 3) - 1) * margin)
    if (i < 0 || g.kind[i] === CellKind.Void) return false
  }
  return true
}

export function updateFall(s: GameState, sim: Sim, dt: number): void {
  const p = s.player
  const cfg = sim.cfg.world.fall
  if (p.fallTime > 0) {
    p.fallTime -= dt
    if (p.fallTime > 0) return
    // back on the last safe ground, still in the dark - it fades in from here
    p.fallTime = -cfg.fadeSec
    p.pos.x = p.safe.x
    p.pos.y = p.safe.y
    p.pos.z = p.safe.z
    p.vel.x = 0
    p.vel.y = 0
    p.vel.z = 0
    p.dashTime = 0
    p.fallSpeed = 0
    p.grounded = true
    emit(sim, { type: 'voidReturned', damage: cfg.damage })
    p.invuln = 0 // the void's bite is not dodged by a dash's or a hit's grace
    hurtPlayer(s, sim, cfg.damage)
    return
  }
  if (p.fallTime < 0) p.fallTime = Math.min(0, p.fallTime + dt)
  const g = sim.grid
  if (p.grounded && safeGround(g, p.pos.x, p.pos.z, cfg.safeMargin)) {
    p.safe.x = p.pos.x
    p.safe.y = p.pos.y
    p.safe.z = p.pos.z
    return
  }
  if (p.grounded || p.pos.y > p.safe.y - cfg.depth) return
  const i = cellAt(g, p.pos.x, p.pos.z)
  if (i >= 0 && g.kind[i] !== CellKind.Void) return // over a floor: it will land
  p.fallTime = cfg.fadeSec
  emit(sim, { type: 'fellIntoVoid' })
}
