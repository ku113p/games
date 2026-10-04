// The level's questions (owner: WP5).
import type { Grid } from '../grid'
import type { Sim } from '../state'

/** The level's static grid (for building the mansion). */
export function levelGrid(sim: Sim): Readonly<Grid> {
  return sim.grid
}

export function levelCeiling(sim: Sim): number {
  return sim.grid.ceiling
}
