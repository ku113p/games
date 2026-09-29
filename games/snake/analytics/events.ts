// analytics/events.ts — какое событие и когда. Чистая логика: без DOM, времени и сети, всё приходит снаружи.
// Считаем только счётчики: в событие не попадает ничего, кроме его имени (ни счёта, ни трёх букв, ни идентификатора).
//
// Пять событий, каждое не чаще раза за визит (визит = одна загрузка страницы), чтобы воронка читалась как «сколько
// визитов дошло досюда»:
//   start  — началась настоящая партия (не открытие страницы, не замер ?perf).
//   twist  — дожили до твиста: камера уехала за голову (бывает только в самой первой игре игрока).
//   finish — партия закончилась смертью (закрытая вкладка и выход в меню не считаются).
//   again  — начали вторую партию за визит: главный признак «зацепило».
//   return — начали партию в другой день, чем прошлый раз.

export type AnalyticsEvent = 'start' | 'twist' | 'finish' | 'again' | 'return'

export const LAST_VISIT_KEY = 'snake:lastVisit'

export interface AnalyticsStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

export interface TrackerDeps {
  /** false — отладка или не боевой хост: ничего не шлётся и в хранилище не пишется. */
  enabled: boolean
  now: () => number
  storage: AnalyticsStorage
  send: (event: AnalyticsEvent) => void
  /** Минимум часов между двумя приходами, чтобы второй считался возвратом (config.json → analytics). */
  returnMinGapHours: number
  /** Номер календарного дня по местному времени; по умолчанию — часовой пояс браузера. Подменяется в тестах. */
  dayOf?: (ms: number) => number
}

export interface Tracker {
  gameStarted(): void
  twistSeen(): void
  gameFinished(): void
}

/** Порядковый номер местного дня: монотонен по календарю, не зависит от того, сколько в дне часов (переход на летнее время). */
export function localDayNumber(ms: number): number {
  const d = new Date(ms)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

/**
 * Пришёл ли игрок в другой день, чем в прошлый раз. Два условия сразу:
 *  - календарный день (по местному времени) позже прошлого — «в другой день», а не «в той же сессии»;
 *  - прошло не меньше minGapHours — игра за полночь (23:50 → 00:10) и часовой пояс, сдвинувший дату в тот же вечер, возвратом не считаются.
 * Запись не читается (нет, мусор, из будущего — часы переведены назад) — это не возврат.
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
        // Возврат определяем по записи, оставленной прошлым визитом, и только потом перезаписываем её.
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

/** Хосты, где счётчик молчит: своя разработка не должна попадать в статистику. */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === '' || h === 'localhost' || h.endsWith('.localhost') || h === '[::1]' || /^(127|10)\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '0.0.0.0'
}

/** Счётчик включён только на боевом хосте и без отладочного ?perf (любого, что включает панель). */
export function analyticsEnabled(hostname: string, perfDebug: boolean): boolean {
  return !perfDebug && !isLocalHost(hostname)
}
