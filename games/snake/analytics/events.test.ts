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

describe('воронка одного визита', () => {
  test('открыл страницу и ушёл: ни одного события', () => {
    const { sent } = setup()
    expect(sent).toEqual([])
  })

  test('первая партия: start; смерть: finish', () => {
    const { tracker, sent } = setup()
    tracker.gameStarted()
    tracker.gameFinished()
    expect(sent).toEqual(['start', 'finish'])
  })

  test('вторая партия за визит — again, третья и дальше — ничего', () => {
    const { tracker, sent } = setup()
    tracker.gameStarted()
    tracker.gameStarted()
    tracker.gameStarted()
    tracker.gameStarted()
    expect(sent).toEqual(['start', 'again'])
  })

  test('start, twist и finish — не чаще раза за визит', () => {
    const { tracker, sent } = setup()
    tracker.gameStarted()
    tracker.twistSeen()
    tracker.twistSeen()
    tracker.gameFinished()
    tracker.gameStarted()
    tracker.gameFinished()
    expect(sent).toEqual(['start', 'twist', 'finish', 'again'])
  })

  test('twist и finish без начатой партии не шлются', () => {
    const { tracker, sent } = setup()
    tracker.twistSeen()
    tracker.gameFinished()
    expect(sent).toEqual([])
  })
})

describe('вернулся', () => {
  test('первый визит вообще: возврата нет, время прихода записано', () => {
    const { tracker, sent, data } = setup()
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30)))
  })

  test('пришёл на следующий день: start и return', () => {
    const { tracker, sent } = setup({ now: at(2026, 9, 30, 10), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 29, 18)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start', 'return'])
  })

  test('вернулся через неделю — тоже возврат', () => {
    const { tracker, sent } = setup({ now: at(2026, 9, 30), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 23)) } })
    tracker.gameStarted()
    expect(sent).toContain('return')
  })

  test('тот же день, другая сессия: не возврат', () => {
    const { tracker, sent } = setup({ now: at(2026, 9, 30, 20), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 30, 9)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
  })

  test('игра за полночь (23:50 -> 00:10) — не возврат', () => {
    const { tracker, sent } = setup({ now: at(2026, 10, 1, 0, 10), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 30, 23, 50)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
  })

  test('в паре с ночным приходом: 23:00 и 04:00 — ещё нет (меньше 6 часов), 05:00 — да', () => {
    const last = String(at(2026, 9, 30, 23, 0))
    expect(isReturn(last, at(2026, 10, 1, 4, 0), 6)).toBe(false)
    expect(isReturn(last, at(2026, 10, 1, 5, 0), 6)).toBe(true)
  })

  test('сменился часовой пояс: календарный день считается по нынешнему поясу, а 6 часов — по настоящему времени', () => {
    // Вечером в одном поясе, через 2 часа в другом уже «завтра»: календарь разный, реального времени прошло мало.
    const last = 1_000 * H
    const now = last + 2 * H
    const eastDay = (ms: number): number => Math.floor((ms + 14 * H) / (24 * H)) // пояс +14 ч
    const westDay = (ms: number): number => Math.floor((ms - 10 * H) / (24 * H)) // пояс -10 ч
    expect(eastDay(now)).toBeGreaterThanOrEqual(westDay(last)) // календарь «поехал»
    expect(isReturn(String(last), now, 6, (ms) => (ms === last ? westDay(ms) : eastDay(ms)))).toBe(false)
    // А вот честный день спустя в новом поясе — возврат.
    const nextDay = last + 30 * H
    expect(isReturn(String(last), nextDay, 6, eastDay)).toBe(true)
  })

  test('часы переведены назад (запись из будущего): не возврат, запись перезаписана', () => {
    const { tracker, sent, data } = setup({ now: at(2026, 9, 30), stored: { [LAST_VISIT_KEY]: String(at(2026, 10, 5)) } })
    tracker.gameStarted()
    expect(sent).toEqual(['start'])
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30)))
  })

  test('мусор в записи: не возврат и не падение', () => {
    for (const junk of ['', 'abc', '-5', '1e9', 'NaN', '12.5', '99999999999999999999']) {
      expect(isReturn(junk, at(2026, 9, 30), 6)).toBe(false)
    }
  })

  test('приход записывается только при старте партии: открыл и ушёл — «вчерашний» день не обновился', () => {
    const { tracker, data } = setup({ stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 29)) } })
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 29)))
    tracker.gameStarted()
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30)))
  })

  test('вторая партия в визите приход не перезаписывает и return повторно не шлёт', () => {
    const { tracker, sent, data, setNow } = setup({ now: at(2026, 9, 30, 10), stored: { [LAST_VISIT_KEY]: String(at(2026, 9, 28)) } })
    tracker.gameStarted()
    setNow(at(2026, 9, 30, 11))
    tracker.gameStarted()
    expect(sent).toEqual(['start', 'return', 'again'])
    expect(data.get(LAST_VISIT_KEY)).toBe(String(at(2026, 9, 30, 10)))
  })

  test('localDayNumber: соседние календарные дни различаются на 1, в том числе через полночь', () => {
    expect(localDayNumber(at(2026, 10, 1, 0, 1)) - localDayNumber(at(2026, 9, 30, 23, 59))).toBe(1)
    expect(localDayNumber(at(2026, 9, 30, 0, 1))).toBe(localDayNumber(at(2026, 9, 30, 23, 59)))
  })
})

describe('отладочные режимы и чужие хосты не портят статистику', () => {
  test('enabled=false: ни событий, ни записи в хранилище', () => {
    const { tracker, sent, data } = setup({ enabled: false })
    tracker.gameStarted()
    tracker.gameStarted()
    tracker.twistSeen()
    tracker.gameFinished()
    expect(sent).toEqual([])
    expect(data.size).toBe(0)
  })

  test('?perf, ?perf=bench, ?perf=freeze выключают счётчик; ?perf=0 — нет', () => {
    expect(analyticsEnabled('user.github.io', true)).toBe(false)
    expect(analyticsEnabled('user.github.io', false)).toBe(true)
  })

  test('локальные адреса не считаются', () => {
    for (const h of ['localhost', '127.0.0.1', '192.168.1.5', '10.0.0.2', '172.20.1.1', '0.0.0.0', 'foo.localhost', '', '[::1]']) expect(isLocalHost(h)).toBe(true)
    for (const h of ['user.github.io', 'html-classic.itch.zone', '172.32.0.1', '11.0.0.1']) expect(isLocalHost(h)).toBe(false)
    expect(analyticsEnabled('localhost', false)).toBe(false)
  })
})
