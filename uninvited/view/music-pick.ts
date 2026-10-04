// Pure helpers of the music player (view/music.ts), kept free of Web Audio so scripts/music-pick.test.ts can run them.

/**
 * Which of the horizontal versions (0 calm, 1 tension, 2 combat) plays at an intensity, given which have decoded so far:
 * the highest one at or under the intensity, else the lowest one above it (calm missing -> tension), -1 when none exist.
 */
export function pickVersion(have: readonly boolean[], level: number): number {
  let pick = -1
  for (let i = 0; i < have.length && i <= level; i++) if (have[i]) pick = i
  if (pick >= 0) return pick
  for (let i = level + 1; i < have.length; i++) if (have[i]) return i
  return -1
}

/** The gain of each version slot at an intensity: 1 for the picked version, 0 for the rest. */
export function versionGains(have: readonly boolean[], level: number): number[] {
  const pick = pickVersion(have, level)
  return have.map((_, i) => (i === pick ? 1 : 0))
}

/** An equal-power fade from `from` to `to` (the two sides of a crossfade sum to constant power): n points for setValueCurveAtTime. */
export function equalPowerCurve(from: number, to: number, n = 64): Float32Array {
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1)
    c[i] = to >= from ? from + (to - from) * Math.sin((p * Math.PI) / 2) : to + (from - to) * Math.cos((p * Math.PI) / 2)
  }
  return c
}

/** The order the music files load in: the level tracks, then the hack loop, then the rest. */
export function loadGroups(names: readonly string[]): string[][] {
  const level = names.filter((n) => n.startsWith('net_'))
  const hack = names.filter((n) => n === 'hack')
  const rest = names.filter((n) => !n.startsWith('net_') && n !== 'hack')
  return [level, hack, rest].filter((g) => g.length > 0)
}
