// scores/leaderboard.ts — the best-scores table: pure logic without DOM or storage (the core knows nothing about it).
// An entry: score, a short name of alphabet symbols, game duration, date.
// Everything tunable (table size, alphabet, name length) comes from config.json → leaderboard.

export interface ScoreEntry {
  score: number
  name: string
  /** Game duration, ms; 0 = unknown (the entry was carried over from the old single high score). */
  durationMs: number
  /** Unix time of the game end, ms; 0 = unknown. */
  date: number
}

export interface LeaderboardConfig {
  /** How many entries are kept (top N). */
  size: number
  /** How many symbols in a name. */
  nameLength: number
  /** Allowed drum symbols, in scroll order. */
  alphabet: string
  /** Default name until the player has picked anything. */
  defaultName: string
  /** Name of an entry carried over from the old single high score (it had no name symbols). */
  legacyName: string
  /** A score below this does not make the table (0 points is not a result). */
  minScore: number
  /** Holding a drum button: the pause before auto-repeat and the auto-repeat period, ms. */
  repeatDelayMs: number
  repeatMs: number
}

type TableRules = Pick<LeaderboardConfig, 'size' | 'minScore'>

/**
  * Where a score lands in the table (sorted descending). -1 means it did not make it.
  * On a tie the new one goes AFTER the old ones: the place belongs to whoever scored first.
 */
export function insertionIndex(table: readonly ScoreEntry[], score: number, rules: TableRules): number {
  if (!(score >= rules.minScore)) return -1 // NaN too
  let i = 0
  while (i < table.length && (table[i] as ScoreEntry).score >= score) i++
  return i < rules.size ? i : -1
}

export function qualifies(table: readonly ScoreEntry[], score: number, rules: TableRules): boolean {
  return insertionIndex(table, score, rules) >= 0
}

/** A new table with the entry inserted (the displaced last one drops off) and its index; -1 if it did not make it. */
export function insertEntry(
  table: readonly ScoreEntry[],
  entry: ScoreEntry,
  rules: TableRules,
): { table: ScoreEntry[]; index: number } {
  const index = insertionIndex(table, entry.score, rules)
  if (index < 0) return { table: table.slice(0, rules.size), index }
  const next = table.slice()
  next.splice(index, 0, entry)
  next.length = Math.min(next.length, rules.size)
  return { table: next, index }
}

/** A copy of the table where the entry at `index` has a different name. */
export function renameEntry(table: readonly ScoreEntry[], index: number, name: string): ScoreEntry[] {
  return table.map((e, i) => (i === index ? { ...e, name } : e))
}

/** The neighboring alphabet symbol with wrap-around (delta +1 = next). An unknown symbol → the start of the alphabet. */
export function stepSymbol(alphabet: string, current: string, delta: number): string {
  const n = alphabet.length
  if (n === 0) return current
  const at = alphabet.indexOf(current)
  if (at < 0) return alphabet.charAt(0)
  return alphabet.charAt((((at + delta) % n) + n) % n)
}

/** A name from storage → a valid name: uppercase, only alphabet symbols, exactly nameLength; otherwise the default name. */
export function sanitizeName(raw: unknown, cfg: LeaderboardConfig): string {
  if (typeof raw !== 'string') return cfg.defaultName
  const up = raw.toUpperCase()
  if (up.length !== cfg.nameLength) return cfg.defaultName
  for (const ch of up) if (!cfg.alphabet.includes(ch)) return cfg.defaultName
  return up
}

function isEntry(v: unknown): v is { score: number; name: unknown; durationMs: unknown; date: unknown } {
  if (typeof v !== 'object' || v === null) return false
  const score = (v as { score?: unknown }).score
  return typeof score === 'number' && Number.isFinite(score) && score >= 0
}

function nonNegative(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

/**
  * A table from the raw storage string. null means no key or not a table (then we try carrying over the old high score).
  * Broken entries are dropped, order and size are normalized.
 */
export function parseTable(raw: string | null, cfg: LeaderboardConfig): ScoreEntry[] | null {
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(data)) return null
  const entries: ScoreEntry[] = []
  for (const v of data) {
    if (!isEntry(v)) continue
    // The name of a carried-over entry ("---") does not belong to the alphabet: we do not spoil it.
    const name = v.name === cfg.legacyName ? cfg.legacyName : sanitizeName(v.name, cfg)
    entries.push({ score: v.score, name, durationMs: nonNegative(v.durationMs), date: nonNegative(v.date) })
  }
  // The sort is stable (ES2019+): equal scores keep the "who was first" order.
  entries.sort((a, b) => b.score - a.score)
  return entries.slice(0, cfg.size)
}

/** The old single high score (a storage string) → a table of one entry; no high score means an empty one. */
export function migrateLegacy(rawHighScore: string | null, cfg: LeaderboardConfig): ScoreEntry[] {
  if (rawHighScore === null) return []
  const n = Number.parseInt(rawHighScore, 10)
  if (!Number.isFinite(n) || n < cfg.minScore) return []
  return [{ score: n, name: cfg.legacyName, durationMs: 0, date: 0 }]
}

/** Game duration for display: "m:ss" (hours fit into minutes); 0 and garbage show "—". */
export function formatDuration(ms: number): string {
  if (!(ms > 0)) return '—'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
