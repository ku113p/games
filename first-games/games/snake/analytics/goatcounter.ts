// analytics/goatcounter.ts — a thin wrapper at the edge: loads the GoatCounter counter and sends events.
// Any failure (script blocked, no network, domain does not resolve) is swallowed: the player must not notice it.
// Called from event handlers once per visit, not from the frame loop. Sending leaves the current stack via setTimeout.

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

/** Loads count.js (it counts the visit itself). No onload/onerror noise: an async script does not delay frames. */
export function loadCounter(): void {
  try {
    const s = document.createElement('script')
    s.async = true
    s.dataset['goatcounter'] = cfg.counterUrl
    s.src = cfg.scriptUrl
    s.onerror = () => {} // blocked by an extension or no network: quiet
    document.head.appendChild(s)
  } catch {
    /* nothing to do: the game lives without the counter */
  }
}

export function sendEvent(event: AnalyticsEvent): void {
  setTimeout(() => {
    try {
      const gc = (window as unknown as { goatcounter?: GoatCounterApi }).goatcounter
      if (gc !== undefined && typeof gc.count === 'function') gc.count({ path: `snake-${event}`, title: TITLES[event], event: true })
    } catch {
      /* the counter did not load or broke: do not disturb the game */
    }
  }, 0)
}
