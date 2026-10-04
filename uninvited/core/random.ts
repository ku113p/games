// Seeded random for the core (rule 4: the core is deterministic). mulberry32: small, fast, good enough for gameplay.
// The state is a plain number kept in the game state, so a save restores the exact sequence.

export interface Rng {
  seed: number
}

export function createRng(seed: number): Rng {
  return { seed: seed >>> 0 }
}

/** A float in [0, 1). Advances the generator in place. */
export function nextFloat(rng: Rng): number {
  rng.seed = (rng.seed + 0x6d2b79f5) >>> 0
  let t = rng.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** An integer in [min, max] inclusive. */
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1))
}

/** A random element of a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[nextInt(rng, 0, items.length - 1)]
  if (item === undefined) throw new Error('pick: empty array')
  return item
}
