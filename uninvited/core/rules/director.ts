// The director (owner: WP4 Director, spawns, bots): a continuous L4D-style intensity curve per stage - build-up -> peak ->
// relief - that decides when and where packs come out (DESIGN 2). WP0: the contracts only; `updateDirector` does nothing.
import type { DirectorPhase } from '../model/director'
import type { GameState, Sim } from '../state'

/** One tick of the director: intensity, phases, packs from the spawn points. Stub: WP4. */
export function updateDirector(s: GameState, sim: Sim, dt: number): void {
  void s
  void sim
  void dt
}

/** A stage began: use director profile `profileId` with these spawn points enabled. Contract WP1 -> WP4. Stub. */
export function startStageDirector(s: GameState, sim: Sim, profileId: string, spawnIds: readonly string[]): void {
  void sim
  s.director.profile = profileId
  for (let i = 0; i < sim.spawns.length; i++) {
    const st = s.spawnPoints[i]
    if (st) st.enabled = spawnIds.includes((sim.spawns[i] as { id: string }).id)
  }
}

/** Forces a phase for `sec` seconds (the crank and the tank's entrance force a peak, an opened portcullis a relax). Contract WP1 -> WP4. Stub. */
export function forcePhase(s: GameState, sim: Sim, phase: DirectorPhase, sec: number): void {
  void sim
  s.director.forcedPhase = phase
  s.director.forcedTime = sec
}

/** The roof hold-out's elapsed fraction 0..1 (hidden from the HUD). Contract WP1 -> WP4. Stub. */
export function setHoldOut(s: GameState, sim: Sim, fraction: number): void {
  void sim
  s.director.holdOut = fraction
}
