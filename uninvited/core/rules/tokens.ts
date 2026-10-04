// Attack tokens (DESIGN 9): the crowd is a show, not a wall of damage - only a few attacks of each kind run at once
// (worm bites, warden melee strikes, ranged shots of wardens and drones). Whoever wants to attack asks for a token and
// waits on the ring around the player until it gets one; the token comes back when the attack's recovery is over.
// Tokens are flags on the enemies themselves, so a dead or gone enemy gives its token back by itself.
import type { GameState, Sim } from '../state'

/** Worms that hold a bite token. */
export function biteTokens(s: GameState): number {
  let n = 0
  for (const w of s.worms) if (w.active && w.alive && w.token) n++
  return n
}

/** Wardens that hold a melee token (token 1). */
export function meleeTokens(s: GameState): number {
  let n = 0
  for (const w of s.wardens) if (w.alive && w.token === 1) n++
  return n
}

/** Ranged tokens in use: wardens (token 2) and drones. */
export function rangedTokens(s: GameState): number {
  let n = 0
  for (const w of s.wardens) if (w.alive && w.token === 2) n++
  for (const d of s.drones) if (d.active && d.alive && d.token) n++
  return n
}

export function meleeFree(s: GameState, sim: Sim): boolean {
  return meleeTokens(s) < sim.cfg.tokens.melee
}

export function rangedFree(s: GameState, sim: Sim): boolean {
  return rangedTokens(s) < sim.cfg.tokens.ranged
}

/** The place on the ring (ringMin..ringMax from the player) enemy `i` waits at: a fixed share per slot, so a crowd spreads over the ring. */
export function ringRadius(sim: Sim, i: number): number {
  const t = sim.cfg.tokens
  return t.ringMin + (t.ringMax - t.ringMin) * ((i * 0.618034) % 1)
}
