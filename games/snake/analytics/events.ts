// analytics/events.ts — which event and when. Pure logic: no DOM, time or network, everything comes from outside.
// We count only counters: nothing goes into an event except its name (no score, no three symbols, no identifier).
//
// Five events, each at most once per visit (a visit = one page load), so that the funnel reads as "how many
// visits got this far":
//   start  — a real game started (not the page opening, not a ?perf measurement).
//   twist  — reached the twist: the camera moved behind the head (only happens in the player's very first game).
//   finish — a game ended by death (a closed tab and leaving to the menu do not count).
//   again  — started a second game in one visit: the main sign of "hooked".
//   return — started a game on a different day than last time.

export type AnalyticsEvent = 'start' | 'twist' | 'finish' | 'again' | 'return'

export const LAST_VISIT_KEY = 'snake:lastVisit'

export interface AnalyticsStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

export interface TrackerDeps {
  /** false = debug or a non-production host: nothing is sent and nothing is written to storage. */
  enabled: boolean
  now: () => number
  storage: AnalyticsStorage
  send: (event: AnalyticsEvent) => void
  /** Minimum hours between two arrivals for the second to count as a return (config.json → analytics). */
  returnMinGapHours: number
  /** Local-time calendar day number; defaults to the browser time zone. Replaced in tests. */
  dayOf?: (ms: number) => number
}

export interface Tracker {
  gameStarted(): void
  twistSeen(): void
  gameFinished(): void
}

/** Ordinal number of the local day: monotonic by calendar, independent of how many hours a day has (daylight saving switch). */
export function localDayNumber(ms: number): number {
  const d = new Date(ms)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

/**
  * Whether the player came on a different day than last time. Two conditions at once:
  *  - the calendar day (in local time) is later than the last one: "a different day", not "the same session";
  *  - at least minGapHours have passed: a game past midnight (23:50 → 00:10) and a time zone that shifted the date the same evening do not count as a return.
  * The record cannot be read (missing, garbage, from the future because the clock was set back): it is not a return.
 */
export function isReturn(lastRaw: string | null, nowMs: number, minGapHours: number, dayOf: (ms: number) => number = localDayNumber): boolean {
  if (lastRaw === null || !/^\d{1,16}$/.test(lastRaw)) return false
  const last = Number(lastRaw)
  if (!Number.isFinite(last) || last > nowMs) return false
  if (nowMs - last < minGapHours * 3_600_000) return false
  return dayOf(nowMs) > dayOf(last)
}

export function createTracker(deps: TrackerDeps): Tracker {
  const dayOf = deps.dayOf ?? localDayNumber
  let games = 0
  let twist = false
  let finish = false
  return {
    gameStarted() {
      if (!deps.enabled) return
      games++
      if (games === 1) {
        // A return is determined from the record left by the previous visit, and only then is it overwritten.
        const back = isReturn(deps.storage.get(LAST_VISIT_KEY), deps.now(), deps.returnMinGapHours, dayOf)
        deps.storage.set(LAST_VISIT_KEY, String(deps.now()))
        deps.send('start')
        if (back) deps.send('return')
      } else if (games === 2) {
        deps.send('again')
      }
    },
    twistSeen() {
      if (!deps.enabled || games === 0 || twist) return
      twist = true
      deps.send('twist')
    },
    gameFinished() {
      if (!deps.enabled || games === 0 || finish) return
      finish = true
      deps.send('finish')
    },
  }
}

/** Hosts where the counter stays silent: our own development must not end up in the stats. */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === '' || h === 'localhost' || h.endsWith('.localhost') || h === '[::1]' || /^(127|10)\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '0.0.0.0'
}

/** The counter is on only on the production host and without debug ?perf (any that turns the panel on). */
export function analyticsEnabled(hostname: string, perfDebug: boolean): boolean {
  return !perfDebug && !isLocalHost(hostname)
}
