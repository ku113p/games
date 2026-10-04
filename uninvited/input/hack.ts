// Input for the hacking mini-game: mouse and keyboard -> onPick(row, col) / onCancel().
//
// DOM contract with view/hack (they cannot import each other): every grid cell carries data-hack-cell, data-row and
// data-col; a cell that can be picked right now also carries data-hack-pickable. The keyboard cursor is DOM focus.
//
//   mouse      click a lit cell
//   arrows     move along the active line (left/right on a row, up/down on a column), wrapping around
//   Enter/Space  pick the focused cell
//   Esc        cancel
//
// Keys are caught on window in the capture phase and stopped there, so the game's own bindings (Esc = pause, Space =
// jump, ...) do not fire while the hack is open. Bind when the hack opens, call the returned unbind when it closes.

const CELL = '[data-hack-cell]'
const PICKABLE = '[data-hack-cell][data-hack-pickable]'

function rowCol(el: Element): [number, number] {
  const h = el as HTMLElement
  return [Number(h.dataset['row']), Number(h.dataset['col'])]
}

export function bindHackInput(
  root: HTMLElement,
  onPick: (row: number, col: number) => void,
  onCancel: () => void,
): () => void {
  function onClick(e: MouseEvent): void {
    if (e.button !== 0 || !(e.target instanceof Element)) return
    const cell = e.target.closest(CELL)
    if (!cell || !root.contains(cell)) return
    const [r, c] = rowCol(cell)
    onPick(r, c)
  }

  function focused(): HTMLElement | null {
    const a = document.activeElement
    return a instanceof HTMLElement && a.matches(CELL) && root.contains(a) ? a : null
  }

  function move(dRow: number, dCol: number): void {
    const pickable = Array.from(root.querySelectorAll<HTMLElement>(PICKABLE))
    if (pickable.length === 0) return
    const from = focused()
    if (!from || !from.matches(PICKABLE)) {
      // nothing (or a used cell) focused: go to the nearest pickable cell
      const [fr, fc] = from ? rowCol(from) : [0, 0]
      let best = pickable[0] as HTMLElement
      let bestD = Infinity
      for (const el of pickable) {
        const [r, c] = rowCol(el)
        const d = Math.abs(r - fr) + Math.abs(c - fc)
        if (d < bestD) {
          bestD = d
          best = el
        }
      }
      best.focus({ preventScroll: true })
      return
    }
    const [r0, c0] = rowCol(from)
    // the candidates along the pressed axis, in the same row/column, ordered by distance in that direction (wrapping)
    let best: HTMLElement | null = null
    let bestStep = Infinity
    let span = 0
    for (const el of pickable) {
      const [r, c] = rowCol(el)
      span = Math.max(span, r + 1, c + 1)
    }
    for (const el of pickable) {
      const [r, c] = rowCol(el)
      if (el === from) continue
      if (dCol !== 0 && r !== r0) continue
      if (dRow !== 0 && c !== c0) continue
      const delta = dCol !== 0 ? (c - c0) * dCol : (r - r0) * dRow
      const step = (delta + span) % span
      if (step > 0 && step < bestStep) {
        bestStep = step
        best = el
      }
    }
    best?.focus({ preventScroll: true })
  }

  function onKey(e: KeyboardEvent): void {
    let handled = true
    switch (e.code) {
      case 'ArrowLeft':
        move(0, -1)
        break
      case 'ArrowRight':
        move(0, 1)
        break
      case 'ArrowUp':
        move(-1, 0)
        break
      case 'ArrowDown':
        move(1, 0)
        break
      case 'Enter':
      case 'NumpadEnter':
      case 'Space': {
        if (e.repeat) break
        const cell = focused()
        if (cell) {
          const [r, c] = rowCol(cell)
          onPick(r, c)
        } else move(0, 0)
        break
      }
      case 'Escape':
        if (!e.repeat) onCancel()
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }

  root.addEventListener('click', onClick)
  window.addEventListener('keydown', onKey, true)
  return () => {
    root.removeEventListener('click', onClick)
    window.removeEventListener('keydown', onKey, true)
  }
}
