import { describe, expect, test } from 'bun:test'
import { analyticsEnabled, createTracker, isLocalHost, isReturn, LAST_VISIT_KEY, localDayNumber, type AnalyticsEvent } from './events'

const H = 3_600_000
const at = (y: number, mo: number, d: number, h = 12, mi = 0): number => new Date(y, mo - 1, d, h, mi).getTime()

function setup(opts: { enabled?: boolean; now?: number; stored?: Record<string, string>; dayOf?: (ms: number) => number } = {}) {
  const data = new Map(Object.entries(opts.stored ?? {}))
  const sent: AnalyticsEvent[] = []
  let now = opts.now ?? at(2026, 9, 30)
  const tracker = createTracker({
    enabled: opts.enabled ?? true,
    now: () => now,
    storage: { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) },
    send: (e) => sent.push(e),
    returnMinGapHours: 6,
    ...(opts.dayOf === undefined ? {} : { dayOf: opts.dayOf }),
  })
  return { tracker, sent, data, setNow: (n: number) => (now = n) }
}

describe('funnel of a single visit', () => {
  test('opened the page and left: no events at all', () => {
    const { sent } = setup()
    expect(sent).toEqual([])
  })

  test('first game: start; death: finish', () => {
    const { tracker, sent } = setup()
    tracker.gameStarted()
    tracker.gameFinished()
    expect(sent).toEqual(['start', 'finish'])
  })

  test('a second game in a visit: again, the third and later: nothing', () => {
    const { tracker, sent } = setup()
    tracker.gameStarted()
    tracker.gameStarted()
    tracker.gameStarted()
    tracker.gameStarted()
    expect(sent).toEqual(['start', 'again'])
  })

  test('start, twist and finish: at most once per visit', () => {
    const { tracker, sent } = setup()
    tracker.gameStarted()
    tracker.twistSeen()
    tracker.twistSeen()
    tracker.gameFinished()
    tracker.gameStarted()
    tracker.gameFinished()
    expect(sent).toEqual(['start', 'twist', 'finish', 'again'])
  })

  test('twist and finish without a started game are not sent', () => {
    const { tracker, sent } = setup()
    tracker.twistSeen()
    tracker.gameFinished()
    expect(sent).toEqual([])
  })
})

describe('returned', () => {
  test('the very first visit: no return, the arrival time is recorded', () => {
    const { tracker, sent, data } = setup()
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30)))
  })

  test('came the next day: start and return', () => {
    const { tracker, sent } = setup({ now: at(2026, 9, 30, 10), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 29, 18)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start', 'return'])
  })

  test('came back a week later: also a return', () => {
    const { tracker, sent } = setup({ now: at(2026, 9, 30), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 23)) } })
    tracker.gameStarted()
    expect(sent).toContain('return')
  })

  test('same day, another session: not a return', () => {
    const { tracker, sent } = setup({ now: at(2026, 9, 30, 20), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 30, 9)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
  })

  test('a game past midnight (23:50 -> 00:10): not a return', () => {
    const { tracker, sent } = setup({ now: at(2026, 10, 1, 0, 10), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 30, 23, 50)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
  })

  test('paired with a night arrival: 23:00 and 04:00 do not count yet (under 6 hours), 05:00 does', () => {
    const last = String(at(2026, 9, 30, 23, 0))
    expect(isReturn(last, at(2026, 10, 1, 4, 0), 6)).toBe(false)
    expect(isReturn(last, at(2026, 10, 1, 5, 0), 6)).toBe(true)
  })

  test('time zone changed: the calendar day is counted by the current zone, and the 6 hours by real time', () => {
    // In the evening in one zone, 2 hours later in another it is already "tomorrow": the calendar differs, little real time has passed.
    const last = 1_000 * H
    const now = last + 2 * H
    const eastDay = (ms: number): number => Math.floor((ms + 14 * H) / (24 * H)) // zone +14 h
    const westDay = (ms: number): number => Math.floor((ms - 10 * H) / (24 * H)) // zone -10 h
    expect(eastDay(now)).toBeGreaterThanOrEqual(westDay(last)) // the calendar "jumped"
    expect(isReturn(String(last), now, 6, (ms) => (ms === last ? westDay(ms) : eastDay(ms)))).toBe(false)
    // But an honest day later in the new zone is a return.
    const nextDay = last + 30 * H
    expect(isReturn(String(last), nextDay, 6, eastDay)).toBe(true)
  })

  test('the clock was set back (a record from the future): not a return, the record is overwritten', () => {
    const { tracker, sent, data } = setup({ now: at(2026, 9, 30), stored: { [LAST_VISIT_KEY]: String(at(2026, 10, 5)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30)))
  })

  test('garbage in the record: not a return and not a crash', () => {
    for (const junk of ['', 'abc', '-5', '1e9', 'NaN', '12.5', '99999999999999999999']) {
      expect(isReturn(junk, at(2026, 9, 30), 6)).toBe(false)
    }
  })

  test('the arrival is recorded only on game start: opened and left, the "yesterday" day did not update', () => {
    const { tracker, data } = setup({ stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 29)) } })
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 29)))
    tracker.gameStarted()
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30)))
  })

  test('a second game in a visit does not overwrite the arrival and does not send return again', () => {
    const { tracker, sent, data, setNow } = setup({ now: at(2026, 9, 30, 10), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 28)) } })
    tracker.gameStarted()
    setNow(at(2026, 9, 30, 11))
    tracker.gameStarted()
    expect(sent).toEqual(['start', 'return', 'again'])
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30, 10)))
  })

  test('localDayNumber: adjacent calendar days differ by 1, including across midnight', () => {
    expect(localDayNumber(at(2026, 10, 1, 0, 1)) - localDayNumber(at(2026, 9, 30, 23, 59))).toBe(1)
    expect(localDayNumber(at(2026, 9, 30, 0, 1))).toBe(localDayNumber(at(2026, 9, 30, 23, 59)))
  })
})

describe('debug modes and foreign hosts do not spoil the stats', () => {
  test('enabled=false: no events and no writes to storage', () => {
    const { tracker, sent, data } = setup({ enabled: false })
    tracker.gameStarted()
    tracker.gameStarted()
    tracker.twistSeen()
    tracker.gameFinished()
    expect(sent).toEqual([])
    expect(data.size).toBe(0)
  })

  test('?perf, ?perf=bench, ?perf=freeze turn the counter off; ?perf=0 does not', () => {
    expect(analyticsEnabled('user.github.io', true)).toBe(false)
    expect(analyticsEnabled('user.github.io', false)).toBe(true)
  })

  test('local addresses do not count', () => {
    for (const h of ['localhost', '127.0.0.1', '192.168.1.5', '10.0.0.2', '172.20.1.1', '0.0.0.0', 'foo.localhost', '', '[::1]']) expect(isLocalHost(h)).toBe(true)
    for (const h of ['user.github.io', 'html-classic.itch.zone', '172.32.0.1', '11.0.0.1']) expect(isLocalHost(h)).toBe(false)
    expect(analyticsEnabled('localhost', false)).toBe(false)
  })
})
