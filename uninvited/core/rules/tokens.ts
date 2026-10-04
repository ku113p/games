// Attack tokens (DESIGN 5): the crowd is a show, not a wall of damage - only a few attacks of each kind run at once
// (bites, melee strikes, throws, bat swoops). Whoever wants to attack asks for a token and waits on the ring around
// the player until it gets one; the token comes back when the attack's recovery is over. Tokens are flags on the
// monsters themselves, so a dead or gone monster gives its token back by itself. Owner: WP3.
import type { TokenKind } from '../model/monsters'
import type { GameState, Sim } from '../state'

/** Monsters that hold a token of this kind. */
export function tokensInUse(s: GameState, sim: Sim, kind: TokenKind): number {
  let n = 0
  for (const m of s.monsters) if (m.active && m.alive && m.token && sim.cfg.horde.kinds[m.kind].token === kind) n++
  return n
}

export function tokenFree(s: GameState, sim: Sim, kind: TokenKind): boolean {
  return tokensInUse(s, sim, kind) < sim.cfg.horde.tokens[kind]
}

/** The place on the ring (ringMin..ringMax from the player) monster `i` waits at: a fixed share per slot, so a crowd spreads over the ring. */
export function ringRadius(sim: Sim, i: number): number {
  const t = sim.cfg.horde.tokens
  return t.ringMin + (t.ringMax - t.ringMin) * ((i * 0.618034) % 1)
}
