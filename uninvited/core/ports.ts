// The World port: everything the core asks of the physical world. The game implements it with Rapier
// (adapters/physics-rapier.ts); tests use a flat floor with boxes (core/fake-world.ts). The core never sees Rapier.
// Hot path: plain numbers in, results written into caller-owned objects - no allocations.

export interface MoveResult {
  x: number
  y: number
  z: number
  grounded: boolean
}

export interface World {
  /**
   * Moves the character standing with its feet at (x, y, z) by (dx, dy, dz) with collisions, steps and slopes.
   * Writes the new feet position and whether it stands on the ground into `out`.
   */
  moveCharacter(x: number, y: number, z: number, dx: number, dy: number, dz: number, crouched: boolean, dt: number, out: MoveResult): void
  /** True when no static geometry (walls, cover, closed red walls) blocks the segment a -> b. The character itself never blocks. */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean
  /** Distance along a normalized direction to the first static hit, or maxDist when nothing is hit. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number
  /** True when a standing character fits with its feet at (x, y, z) - for standing up from a crouch. */
  canStand(x: number, y: number, z: number): boolean
  /** Makes red wall number `index` (the level's 'D' group order) solid or passable. */
  setBlocker(index: number, solid: boolean): void
}
