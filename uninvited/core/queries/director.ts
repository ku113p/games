// The director's and the spawn points' questions (owner: WP4).
import type { DirectorPhase, SpawnPoint, SpawnPointState } from '../model/director'
import type { GameState, Sim } from '../state'

/** The static spawn points of the level, and their runtime state (open, telegraph). */
export function spawnPoints(sim: Sim): readonly Readonly<SpawnPoint>[] {
  return sim.spawns
}

export function spawnPointStates(s: GameState): readonly Readonly<SpawnPointState>[] {
  return s.spawnPoints
}

export function directorPhase(s: GameState): DirectorPhase {
  return s.director.phase
}

/** 0..1 how hard the player is pressed (the music follows it). */
export function directorIntensity(s: GameState): number {
  return s.director.intensity
}
