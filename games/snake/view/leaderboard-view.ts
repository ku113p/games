// view/leaderboard-view.ts — DOM-представление таблицы лучших и «барабана» ввода имени.
// Холодный путь (экран проигрыша, меню): элементы создаются свободно. Из кадра не вызывается.
// Барабан вместо HTML-input: экранная клавиатура не поднимается и не ломает вёрстку на телефоне.

import { formatDuration, stepSymbol, type LeaderboardConfig, type ScoreEntry } from '../scores/leaderboard'

/** Рисует таблицу в `el`: `size` строк, свободные — тусклые прочерки. `highlight` — индекс своей записи (-1 — нет). */
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

export interface Drum {
  /** Показать барабан с этим именем; onChange — на каждое изменение, onConfirm — «Готово» / Enter. */
  show(name: string, onChange: (name: string) => void, onConfirm: () => void): void
  hide(): void
}

export function createDrum(root: HTMLElement, cfg: LeaderboardConfig): Drum {
  const symbols: string[] = []
  const symEls: HTMLElement[] = []
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

  // Удержание стрелки прокручивает дальше: до нужной буквы из 36 иначе долго тапать.
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
    up.setAttribute('aria-label', `Символ ${slot + 1}: следующий`)
    const sym = document.createElement('div')
    sym.className = 'sym'
    const down = document.createElement('button')
    down.type = 'button'
    down.className = 'step'
    down.tabIndex = -1
    down.textContent = '▼'
    down.setAttribute('aria-label', `Символ ${slot + 1}: предыдущий`)
    sym.addEventListener('pointerdown', () => {
      active = slot
      paint()
    })
    bindStep(up, slot, 1)
    bindStep(down, slot, -1)
    reel.append(up, sym, down)
    root.appendChild(reel)
    symEls.push(sym)
  }
  window.addEventListener('blur', stopRepeat)

  // ПК: символы набираются с клавиатуры, стрелки и Enter — как на барабане.
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
