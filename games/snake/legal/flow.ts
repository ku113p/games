// legal/flow.ts — порядок юридических экранов и память о согласии. Без DOM: хранилище и показ передаются снаружи.
// Порядок: предупреждение о мигающих огнях (при КАЖДОМ открытии) -> условия (только пока согласие не сохранено) -> меню.

export const TERMS_ACCEPTED_KEY = 'snake:termsAccepted'

export type LegalStep = 'warning' | 'terms'

export interface LegalStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

/** Условия нужны, пока нет сохранённого согласия: первый запуск, сброшенное хранилище, недоступное хранилище. */
export function needsTerms(storage: LegalStorage): boolean {
  return storage.get(TERMS_ACCEPTED_KEY) !== '1'
}

/** Экраны к показу в этом запуске, по порядку. Предупреждение есть всегда. */
export function legalSteps(storage: LegalStorage): LegalStep[] {
  return needsTerms(storage) ? ['warning', 'terms'] : ['warning']
}

export interface LegalFlow {
  /** Показывает первый экран. */
  start(): void
  /** Кнопка текущего экрана нажата: принять условия (если это они) и перейти дальше или закончить. */
  confirm(): void
  /** Отладочный режим: экраны не показываются, согласие не записывается — при обычном запуске игрок увидит их как обычно. */
  skipAll(): void
}

/**
 * show(step) — показать экран; show(null) — все пройдены, можно открывать меню.
 * Согласие пишется в момент нажатия «Принимаю», а не при показе: закрыл вкладку на экране условий — увидит их снова.
 */
export function createLegalFlow(storage: LegalStorage, show: (step: LegalStep | null) => void): LegalFlow {
  let queue: LegalStep[] = []
  let current: LegalStep | null = null
  const next = (): void => {
    current = queue.shift() ?? null
    show(current)
  }
  return {
    start() {
      queue = legalSteps(storage)
      next()
    },
    confirm() {
      if (current === null) return
      if (current === 'terms') storage.set(TERMS_ACCEPTED_KEY, '1')
      next()
    },
    skipAll() {
      queue = []
      current = null
      show(null)
    },
  }
}

/**
 * Отладка включена параметром ?perf (?perf=bench, ?perf=freeze); ?perf=0 и ?perf=false — выключена.
 * Одно условие и для отладочной панели, и для пропуска юридических экранов: они не должны расходиться.
 */
export function isPerfDebugRequested(search: string): boolean {
  const p = new URLSearchParams(search).get('perf')
  return p !== null && p !== '0' && p !== 'false'
}

/**
 * Режим сам запускает замер через полсекунды после загрузки: ?perf=bench и ?perf=freeze. Только тогда юридические
 * экраны пропускаются: непрозрачный экран поверх канваса испортил бы числа. Простой ?perf ничего не запускает —
 * там предупреждение о мигающих огнях показывается как обычно.
 */
export function isSelfStartingPerfMode(search: string): boolean {
  const p = new URLSearchParams(search).get('perf')
  return p === 'bench' || p === 'freeze'
}
