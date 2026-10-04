// Room at the bottom while the page is fullscreen. On a phone the browser pins a system toast ("To exit full
// screen, drag from the top ...") to the bottom edge, over the page; controls and the legal accept button
// must not sit under it. The reserve is added on top of the safe-area inset (index.html does
// max(edge, env(safe-area-inset-bottom)) + var(--fs-reserve)).
//
// Detection. On itch.io the game runs in an iframe and the *iframe* element becomes the fullscreen element
// of the PARENT document (cross-origin: not readable). Inside the iframe document.fullscreenElement stays
// null and no fullscreenchange fires (checked in Chromium). What does work inside the frame is the
// `(display-mode: fullscreen)` media query, with a change event. So fullscreen = any of: own
// fullscreenElement (standalone page), webkit-prefixed one (old iOS Safari), display-mode media query (iframe).

export interface FullscreenLayoutConfig {
  fullscreenBottomReservePx: number
}

export interface FullscreenSignals {
  fullscreenElement: unknown
  webkitFullscreenElement: unknown
  displayModeFullscreen: boolean
}

export function isFullscreen(s: FullscreenSignals): boolean {
  return Boolean(s.fullscreenElement) || Boolean(s.webkitFullscreenElement) || s.displayModeFullscreen
}

/** The extra reserve in px: the configured value in fullscreen, 0 otherwise (never negative or NaN). */
export function fullscreenReservePx(fullscreen: boolean, cfg: FullscreenLayoutConfig): number {
  const v = cfg.fullscreenBottomReservePx
  return fullscreen && Number.isFinite(v) && v > 0 ? v : 0
}

/** Distance from the bottom edge of the screen to the lowest control: max(minEdge, safe-area inset) + reserve. */
export function bottomEdgePx(minEdgePx: number, safeInsetPx: number, reservePx: number): number {
  return Math.max(minEdgePx, safeInsetPx) + reservePx
}

/** Keeps the CSS variable --fs-reserve in step with the fullscreen state. Cold path (events only). Returns a detach function. */
export function attachFullscreenReserve(cfg: FullscreenLayoutConfig, doc: Document = document, win: Window = window): () => void {
  const root = doc.documentElement
  const mq = win.matchMedia('(display-mode: fullscreen)')
  const apply = (): void => {
    const d = doc as Document & { webkitFullscreenElement?: Element | null }
    const fs = isFullscreen({
      fullscreenElement: doc.fullscreenElement,
      webkitFullscreenElement: d.webkitFullscreenElement,
      displayModeFullscreen: mq.matches,
    })
    root.style.setProperty('--fs-reserve', `${fullscreenReservePx(fs, cfg)}px`)
  }
  doc.addEventListener('fullscreenchange', apply)
  doc.addEventListener('webkitfullscreenchange', apply)
  mq.addEventListener('change', apply)
  // Orientation change / resize: re-check (some browsers report the change only through a resize).
  win.addEventListener('resize', apply)
  win.addEventListener('orientationchange', apply)
  apply()
  return () => {
    doc.removeEventListener('fullscreenchange', apply)
    doc.removeEventListener('webkitfullscreenchange', apply)
    mq.removeEventListener('change', apply)
    win.removeEventListener('resize', apply)
    win.removeEventListener('orientationchange', apply)
  }
}
