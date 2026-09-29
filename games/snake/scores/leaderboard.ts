// scores/leaderboard.ts — таблица лучших: чистая логика без DOM и хранилища (ядро про неё не знает).
// Запись: счёт, короткое имя из символов алфавита, длительность партии, дата.
// Всё, что можно крутить (размер таблицы, алфавит, длина имени), приходит из config.json → leaderboard.

export interface ScoreEntry {
  score: number
  name: string
  /** Длительность партии, мс; 0 — неизвестна (запись перенесена из старого одиночного рекорда). */
  durationMs: number
  /** Unix-время конца партии, мс; 0 — неизвестно. */
  date: number
}

export interface LeaderboardConfig {
  /** Сколько записей хранится (топ-N). */
  size: number
  /** Сколько символов в имени. */
  nameLength: number
  /** Допустимые символы барабана, по порядку прокрутки. */
  alphabet: string
  /** Имя по умолчанию, пока игрок ничего не выбирал. */
  defaultName: string
  /** Имя записи, перенесённой из старого одиночного рекорда (букв у него не было). */
  legacyName: string
  /** Счёт ниже этого в таблицу не попадает (0 очков — не результат). */
  minScore: number
  /** Удержание кнопки барабана: пауза до автоповтора и период автоповтора, мс. */
  repeatDelayMs: number
  repeatMs: number
}

type TableRules = Pick<LeaderboardConfig, 'size' | 'minScore'>

/**
 * Куда встанет счёт в таблице (отсортирована по убыванию). -1 — не попал.
 * При равном счёте новый идёт ПОСЛЕ прежних: место держит тот, кто набрал раньше.
 */
export function insertionIndex(table: readonly ScoreEntry[], score: number, rules: TableRules): number {
  if (!(score >= rules.minScore)) return -1 // и NaN тоже
  let i = 0
  while (i < table.length && (table[i] as ScoreEntry).score >= score) i++
  return i < rules.size ? i : -1
}

export function qualifies(table: readonly ScoreEntry[], score: number, rules: TableRules): boolean {
  return insertionIndex(table, score, rules) >= 0
}

/** Новая таблица с вставленной записью (вытесненная последняя отпадает) и её индекс; -1, если не попала. */
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

/** Копия таблицы, где у записи `index` другое имя. */
export function renameEntry(table: readonly ScoreEntry[], index: number, name: string): ScoreEntry[] {
  return table.map((e, i) => (i === index ? { ...e, name } : e))
}

/** Соседний символ алфавита с заворотом (delta +1 — следующий). Незнакомый символ → начало алфавита. */
export function stepSymbol(alphabet: string, current: string, delta: number): string {
  const n = alphabet.length
  if (n === 0) return current
  const at = alphabet.indexOf(current)
  if (at < 0) return alphabet.charAt(0)
  return alphabet.charAt((((at + delta) % n) + n) % n)
}

/** Имя из хранилища → верное имя: заглавные, только символы алфавита, ровно nameLength; иначе имя по умолчанию. */
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
 * Таблица из сырой строки хранилища. null — ключа нет или это не таблица (тогда пробуем перенос старого рекорда).
 * Битые записи отбрасываются, порядок и размер приводятся к норме.
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
    // Имя переносной записи («---») алфавиту не принадлежит — её не портим.
    const name = v.name === cfg.legacyName ? cfg.legacyName : sanitizeName(v.name, cfg)
    entries.push({ score: v.score, name, durationMs: nonNegative(v.durationMs), date: nonNegative(v.date) })
  }
  // Сортировка устойчивая (ES2019+): равные счета сохраняют порядок «кто раньше».
  entries.sort((a, b) => b.score - a.score)
  return entries.slice(0, cfg.size)
}

/** Старый одиночный рекорд (строка из хранилища) → таблица из одной записи; нет рекорда — пустая. */
export function migrateLegacy(rawHighScore: string | null, cfg: LeaderboardConfig): ScoreEntry[] {
  if (rawHighScore === null) return []
  const n = Number.parseInt(rawHighScore, 10)
  if (!Number.isFinite(n) || n < cfg.minScore) return []
  return [{ score: n, name: cfg.legacyName, durationMs: 0, date: 0 }]
}

/** Длительность партии для показа: «m:ss» (часы влезают в минуты); 0 и мусор — «—». */
export function formatDuration(ms: number): string {
  if (!(ms > 0)) return '—'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
