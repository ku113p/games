// analytics/goatcounter.ts — тонкая обёртка на краю: подключает счётчик GoatCounter и отправляет события.
// Любой сбой (скрипт заблокирован, нет сети, домен не резолвится) глотается: игрок не должен его заметить.
// Вызывается из обработчиков событий раз за визит, не из кадра. Отправка уходит из текущего стека через setTimeout.

import type { AnalyticsEvent } from './events'
import cfg from './config.json'

const TITLES: Record<AnalyticsEvent, string> = {
  start: 'Game started',
  twist: 'Reached the twist',
  finish: 'Game finished',
  again: 'Second game in a visit',
  return: 'Came back on another day',
}

interface GoatCounterApi {
  count?: (vars: { path: string; title: string; event: boolean }) => void
}

/** Подключает count.js (он сам считает посещение). Без onload/onerror-шума: async-скрипт кадры не задерживает. */
export function loadCounter(): void {
  try {
    const s = document.createElement('script')
    s.async = true
    s.dataset['goatcounter'] = cfg.counterUrl
    s.src = cfg.scriptUrl
    s.onerror = () => {} // заблокировано расширением или нет сети: тихо
    document.head.appendChild(s)
  } catch {
    /* нечего делать: игра живёт без счётчика */
  }
}

export function sendEvent(event: AnalyticsEvent): void {
  setTimeout(() => {
    try {
      const gc = (window as unknown as { goatcounter?: GoatCounterApi }).goatcounter
      if (gc !== undefined && typeof gc.count === 'function') gc.count({ path: `snake-${event}`, title: TITLES[event], event: true })
    } catch {
      /* счётчик не загрузился или сломался: не мешаем игре */
    }
  }, 0)
}
