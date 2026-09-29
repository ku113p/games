// view/leaderboard-view.ts is the DOM view of the leaderboard and the name-entry drum.
// Cold path (game-over screen, menu): elements are created freely. Not called from the frame.
// A drum instead of an HTML input: the on-screen keyboard does not pop up and does not break the layout on a phone.

import { t } from '../i18n/runtime'
import { formatDuration, stepSymbol, type LeaderboardConfig, type ScoreEntry } from '../scores/leaderboard'

/** Draws the table into `el`: `size` rows, empty ones are dim dashes. `highlight` is the index of your own entry (-1 for none). */
export function renderBoard(el: HTMLElement, table: readonly ScoreEntry[], size: number, highlight: number): void {
  el.replaceChildren()
  for (let i = 0; i < size; i++) {
    const entry = table[i]
    const row = document.createElement('li')
    row.className = 'board-row'
    if (entry === undefined) row.classList.add('empty')
    if (i === highlight) row.classList.add('mine')
    const cells: [string, string][] = [
      ['rank', String(i + 1)],
      ['name', entry?.name ?? '···'],
      ['score', entry === undefined ? '—' : String(entry.score)],
      ['time', entry === undefined ? '' : formatDuration(entry.durationMs)],
    ]
    for (const [cls, text] of cells) {
      const cell = document.createElement('span')
      cell.className = cls
      cell.textContent = text
      row.appendChild(cell)
    }
    el.appendChild(row)
  }
}

/**
 * Row for high score #1 for the main screen: "1 ABC 1240". If the table is empty, the label reads "No records yet".
 * Returns true if there is a record (with an empty table the button that opens the table is disabled).
 */
export function renderTopLine(el: HTMLElement, table: readonly ScoreEntry[]): boolean {
  el.replaceChildren()
  const top = table[0]
  if (top === undefined) {
    const label = document.createElement('span')
    label.className = 'empty-label'
    label.textContent = t('records.empty')
    el.appendChild(label)
    return false
  }
  for (const [cls, text] of [['rank', '1'], ['name', top.name], ['score', String(top.score)]] as const) {
    const cell = document.createElement('span')
    cell.className = cls
    cell.textContent = text
    el.appendChild(cell)
  }
  return true
}

export interface Drum {
  /** Show the drum with this name; onChange fires on every change, onConfirm on "Done" / Enter. */
  show(name: string, onChange: (name: string) => void, onConfirm: () => void): void
  hide(): void
  /** Language changed: rebuild the arrow labels (aria-label). */
  relabel(): void
}

export function createDrum(root: HTMLElement, cfg: LeaderboardConfig): Drum {
  const symbols: string[] = []
  const symEls: HTMLElement[] = []
  const upEls: HTMLElement[] = []
  const downEls: HTMLElement[] = []
  let active = 0
  let onChange: (name: string) => void = () => {}
  let onConfirm: () => void = () => {}
  let repeatTimer = 0
  let repeatInterval = 0

  function name(): string {
    return symbols.join('')
  }

  function paint(): void {
    for (let i = 0; i < symEls.length; i++) {
      const el = symEls[i] as HTMLElement
      el.textContent = symbols[i] as string
      el.classList.toggle('active', i === active)
    }
  }

  function changed(): void {
    paint()
    onChange(name())
  }

  function step(slot: number, delta: number): void {
    active = slot
    symbols[slot] = stepSymbol(cfg.alphabet, symbols[slot] as string, delta)
    changed()
  }

  function stopRepeat(): void {
    window.clearTimeout(repeatTimer)
    window.clearInterval(repeatInterval)
  }

  // Holding an arrow scrolls further: otherwise reaching the right symbol out of 36 takes a lot of tapping.
  function bindStep(btn: HTMLButtonElement, slot: number, delta: number): void {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      stopRepeat()
      step(slot, delta)
      repeatTimer = window.setTimeout(() => {
        repeatInterval = window.setInterval(() => step(slot, delta), cfg.repeatMs)
      }, cfg.repeatDelayMs)
    })
    for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) {
      btn.addEventListener(type, stopRepeat)
    }
    btn.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  for (let slot = 0; slot < cfg.nameLength; slot++) {
    symbols.push(cfg.alphabet.charAt(0))
    const reel = document.createElement('div')
    reel.className = 'reel'
    const up = document.createElement('button')
    up.type = 'button'
    up.className = 'step'
    up.tabIndex = -1
    up.textContent = '▲'
    const sym = document.createElement('div')
    sym.className = 'sym'
    const down = document.createElement('button')
    down.type = 'button'
    down.className = 'step'
    down.tabIndex = -1
    down.textContent = '▼'
    sym.addEventListener('pointerdown', () => {
      active = slot
      paint()
    })
    bindStep(up, slot, 1)
    bindStep(down, slot, -1)
    reel.append(up, sym, down)
    root.appendChild(reel)
    symEls.push(sym)
    upEls.push(up)
    downEls.push(down)
  }
  function relabel(): void {
    for (let i = 0; i < symEls.length; i++) {
      ;(upEls[i] as HTMLElement).setAttribute('aria-label', t('aria.reelNext', { n: i + 1 }))
      ;(downEls[i] as HTMLElement).setAttribute('aria-label', t('aria.reelPrev', { n: i + 1 }))
    }
  }
  relabel()
  window.addEventListener('blur', stopRepeat)

  // Desktop: symbols are typed on the keyboard, arrows and Enter work as on the drum.
  function onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const key = e.key
    if (key === 'ArrowUp' || key === 'ArrowDown') step(active, key === 'ArrowUp' ? 1 : -1)
    else if (key === 'ArrowLeft') active = Math.max(0, active - 1)
    else if (key === 'ArrowRight') active = Math.min(symbols.length - 1, active + 1)
    else if (key === 'Backspace') active = Math.max(0, active - 1)
    else if (key === 'Enter') onConfirm()
    else if (key.length === 1 && cfg.alphabet.includes(key.toUpperCase())) {
      symbols[active] = key.toUpperCase()
      active = Math.min(symbols.length - 1, active + 1)
      changed()
    } else return
    e.preventDefault()
    paint()
  }

  return {
    relabel,
    show(initial, change, confirm) {
      const clean = initial.length === symbols.length ? initial : cfg.defaultName
      for (let i = 0; i < symbols.length; i++) symbols[i] = clean.charAt(i)
      active = 0
      onChange = change
      onConfirm = confirm
      paint()
      root.classList.remove('hidden')
      window.addEventListener('keydown', onKey)
    },
    hide() {
      stopRepeat()
      window.removeEventListener('keydown', onKey)
      root.classList.add('hidden')
    },
  }
}
