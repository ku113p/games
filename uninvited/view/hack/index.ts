// The hacking mini-game overlay (DESIGN.md section 11): a DOM layer over the game.
//
//   const view = createHackView(root)      // once; root should be a positioned element (the overlay fills it)
//   view.show(session)                     // when a hack starts
//   view.update(session)                   // every frame while it is open - allocation-free unless something changed
//   view.hide()
//
// It reads the session only through core/hack queries. It reacts to what happened by watching the session:
// `last.seq` moves on every accepted pick (correct / wrong), `rev` on every change, `status` at the end.
//
// DOM contract with input/hack.ts (they cannot import each other): every grid cell carries
// data-hack-cell, data-row and data-col; a cell that can be picked right now also carries data-hack-pickable.
import cfgAll from '../../config.json'
import {
  hackCellCode,
  hackCellCodeIndex,
  hackCellPickedAt,
  hackEnteredLabel,
  hackIsDeadEnd,
  hackIsHidden,
  hackIsMarkedWrong,
  hackIsOnActiveLine,
  hackIsPickable,
  hackLength,
  hackMarkCount,
  hackPosition,
  hackSlotLabel,
  hackTimeFraction,
  hackTimeLeft,
  hackWasHidden,
  type HackSession,
  type HackStatus,
} from '../../core/hack/index'
import { type HackAudioOut, HackSound } from './sound'
import { injectHackStyle } from './style'

const V = cfgAll.hack.view

export interface HackView {
  show(s: HackSession): void
  update(s: HackSession): void
  hide(): void
}

export interface HackViewOptions {
  /** Route the sounds into the game's mixer; without it the overlay makes its own AudioContext. */
  audio?: HackAudioOut
}

interface Slot {
  root: HTMLElement
  want: HTMLElement
  got: HTMLElement
  marks: HTMLElement
  markCount: number
}

function div(cls: string, parent?: HTMLElement): HTMLElement {
  const el = document.createElement('div')
  el.className = cls
  if (parent) parent.appendChild(el)
  return el
}

/** Restart a CSS animation class. */
function kick(el: HTMLElement, cls: string): void {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

export function createHackView(root: HTMLElement, opts: HackViewOptions = {}): HackView {
  injectHackStyle(root.ownerDocument)
  const sound = new HackSound(V.volume, opts.audio)

  // ---------------------------------------------------------------------------------------------- the skeleton
  const el = div('hk', root)
  el.hidden = true
  const panel = div('hk-panel', el)
  const clock = div('hk-clock', panel)
  const clockFill = div('hk-clock-fill', clock)
  const clockLoss = div('hk-clock-loss', clock)
  const head = div('hk-head', panel)
  const title = div('hk-title', head)
  title.innerHTML = '<b>breach</b> / shuseki.net'
  const timeEl = div('hk-time', head)
  const timeNum = document.createElement('span')
  timeEl.appendChild(timeNum)
  timeEl.insertAdjacentHTML('beforeend', '<small>s</small>')
  const body = div('hk-body', panel)
  const grid = div('hk-grid', body)
  const band = div('hk-band row', grid)
  const preview = div('hk-preview', grid)
  const side = div('hk-side', body)
  div('hk-cap', side).textContent = 'target sequence'
  const seq = div('hk-seq', side)
  const hint = div('hk-hint', side)
  const tally = div('hk-tally', side)
  const keys = div('hk-keys', side)
  keys.innerHTML =
    '<span><kbd>arrows</kbd>move</span><span><kbd>enter</kbd>pick</span><span><kbd>esc</kbd>abort</span>' +
    '<span>or click a lit code</span>'
  // a mouse click must not move the keyboard cursor (focus); input/hack.ts still gets the click
  grid.addEventListener('mousedown', (e) => e.preventDefault())
  const flash = div('hk-flash', panel)
  const result = div('hk-result', panel)
  const resultTitle = document.createElement('h2')
  const resultText = document.createElement('p')
  result.append(resultTitle, resultText)

  // ---------------------------------------------------------------------------------------------- per-session state
  let cur: HackSession | null = null
  let cells: HTMLElement[] = []
  let slots: Slot[] = []
  let seenRev = -1
  let seenSeq = 0
  let seenStatus: HackStatus = 'running'
  let shownTenths = -1
  let timeTexts: string[] = []
  let low = false
  let clockAnim: Animation | null = null
  let hover = -1
  let hideTimer = 0

  function build(s: HackSession): void {
    const n = s.size
    for (const c of cells) c.remove()
    cells = []
    el.style.setProperty('--n', String(n))
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = div('hk-cell', grid)
        cell.tabIndex = -1
        cell.setAttribute('role', 'button')
        cell.dataset['hackCell'] = ''
        cell.dataset['row'] = String(r)
        cell.dataset['col'] = String(c)
        cell.style.setProperty('--d', `${(r + c) * V.cellCascadeMs}ms`)
        cell.textContent = hackCellCode(s, r, c)
        cells.push(cell)
      }
    }
    seq.textContent = ''
    slots = []
    for (let i = 0; i < hackLength(s); i++) {
      const slotRoot = div('hk-slot', seq)
      slots.push({
        root: slotRoot,
        want: div('hk-want', slotRoot),
        got: div('hk-got', slotRoot),
        marks: div('hk-marks', slotRoot),
        markCount: 0,
      })
    }
    // the clock text for every tenth of a second, so the frame loop only assigns ready strings
    timeTexts = []
    const tenths = Math.ceil(s.timeTotal * 10)
    for (let t = 0; t <= tenths; t++) timeTexts.push((t / 10).toFixed(1))
    clockAnim?.cancel()
    clockAnim = clockFill.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
      duration: 1000,
      fill: 'both',
    })
    clockAnim.pause()
  }

  function lineName(s: HackSession): string {
    if (hackPosition(s) === 0) return 'the top row'
    return s.lineIsRow ? 'the lit row' : 'the lit column'
  }

  /** Everything that changes only when the session does (picks, resets, the end). Cold path. */
  function render(s: HackSession): void {
    const n = s.size
    const pos = hackPosition(s)
    const running = s.status === 'running'
    const hiddenNow = running && hackIsHidden(s, pos)
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = cells[r * n + c] as HTMLElement
        const pickedAt = hackCellPickedAt(s, r, c)
        const pickable = hackIsPickable(s, r, c)
        cell.classList.remove('pop', 'bad') // finished feedback from earlier picks
        const onLine = running && hackIsOnActiveLine(s, r, c)
        cell.classList.toggle('line', onLine)
        cell.classList.toggle('pick', pickable)
        cell.classList.toggle('used', pickedAt >= 0)
        cell.classList.toggle('ruled', onLine && hiddenNow && hackIsMarkedWrong(s, pos, hackCellCodeIndex(s, r, c)))
        if (pickedAt >= 0) cell.dataset['n'] = String(pickedAt + 1)
        if (pickable) cell.dataset['hackPickable'] = ''
        else delete cell.dataset['hackPickable']
      }
    }
    band.className = `hk-band ${s.lineIsRow ? 'row' : 'col'}`
    band.style.setProperty('--i', String(s.line))
    band.style.opacity = running ? '' : '0'

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i] as Slot
      slot.want.textContent = hackSlotLabel(s, i, V.hiddenLabel)
      slot.root.classList.toggle('qq', hackIsHidden(s, i))
      slot.root.classList.toggle('was-qq', hackWasHidden(s, i))
      slot.root.classList.toggle('now', running && i === pos)
      const entered = hackEnteredLabel(s, i)
      slot.got.textContent = entered
      slot.got.classList.toggle('in', entered !== '')
      const marks = hackMarkCount(s, i)
      if (marks !== slot.markCount) {
        slot.marks.textContent = ''
        for (let code = 0; code < s.codes.length; code++) {
          if (!hackIsMarkedWrong(s, i, code)) continue
          const m = document.createElement('span')
          m.textContent = s.codes[code] as string
          m.dataset['code'] = String(code)
          slot.marks.appendChild(m)
        }
        slot.markCount = marks
      }
    }

    const pen = s.penaltySec.toFixed(1)
    if (!running) hint.innerHTML = ''
    else if (hiddenNow)
      hint.innerHTML = `Guess the hidden code in ${lineName(s)}. A miss costs <b>${pen} s</b> and restarts the sequence.`
    else if (hackIsDeadEnd(s))
      hint.innerHTML = `<span class="warn">No ${hackSlotLabel(s, pos, V.hiddenLabel)} left in ${lineName(s)}.</span> Any pick restarts the sequence (<b>-${pen} s</b>).`
    else hint.innerHTML = `Pick <b>${hackSlotLabel(s, pos, V.hiddenLabel)}</b> in ${lineName(s)}.`
    tally.innerHTML =
      s.mistakes === 0 ? 'No misses yet.' : `Misses: <b>${s.mistakes}</b>, <b>${(s.mistakes * s.penaltySec).toFixed(1)} s</b> lost.`
    preview.classList.remove('on')
    el.classList.remove('over')
    hover = -1
  }

  function focusNearest(s: HackSession, row: number, col: number): void {
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || !grid.contains(active)) return
    const n = s.size
    let best: HTMLElement | null = null
    let bestD = Infinity
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!hackIsPickable(s, r, c)) continue
        const d = Math.abs(r - row) + Math.abs(c - col)
        if (d < bestD) {
          bestD = d
          best = cells[r * n + c] as HTMLElement
        }
      }
    }
    best?.focus({ preventScroll: true })
  }

  /** A pick happened (s.last). Cold path. */
  function react(s: HackSession): void {
    const a = s.last
    const cell = cells[a.row * s.size + a.col]
    sound.resume()
    sound.play('hack_select', V.selectVolume)
    if (a.kind === 'correct') {
      sound.play('hack_correct', 1, 1 + a.position * V.correctPitchStep)
      if (cell) kick(cell, 'pop')
      const slot = slots[a.position]
      if (slot) kick(slot.got, 'pop')
      if (a.revealed && slot) {
        kick(slot.want, 'reveal')
        sound.play('glitch', V.glitchVolume)
      }
    } else if (a.kind === 'wrong') {
      sound.play('hack_wrong')
      sound.play('glitch', V.glitchVolume)
      if (cell) kick(cell, 'bad')
      kick(panel, 'shake')
      kick(flash, 'hit')
      kick(timeEl, 'hurt')
      kick(seq, 'wipe')
      // the lost piece of the clock breaks off: from the new end of the line to where it was
      const total = s.timeTotal > 0 ? s.timeTotal : 1
      const from = hackTimeLeft(s) / total
      clockLoss.style.left = `${from * 100}%`
      clockLoss.style.width = `${(a.penaltySec / total) * 100}%`
      kick(clockLoss, 'go')
      if (a.marked) {
        const code = String(hackCellCodeIndex(s, a.row, a.col))
        const slot = slots[a.position]
        if (slot) for (const m of slot.marks.children) if ((m as HTMLElement).dataset['code'] === code) kick(m as HTMLElement, 'new')
      }
    }
    focusNearest(s, a.row, a.col)
  }

  function finish(s: HackSession): void {
    sound.stopTick()
    el.classList.add('done')
    result.className = 'hk-result'
    if (s.status === 'solved') {
      sound.play('hack_success')
      kick(flash, 'win')
      resultTitle.textContent = 'access granted'
      resultText.textContent = `${hackTimeLeft(s).toFixed(1)} s to spare`
      result.classList.add('win')
    } else {
      sound.play('hack_fail')
      sound.play('glitch', V.glitchVolume)
      kick(flash, 'fail')
      kick(panel, 'shake')
      resultTitle.textContent = 'trace complete'
      resultText.textContent = 'the alarm goes up'
      result.classList.add('fail')
    }
    kick(result, 'on')
  }

  // ---------------------------------------------------------------------------------------------- hover feedback
  function hoverCell(target: EventTarget | null): void {
    const s = cur
    if (!s || !(target instanceof HTMLElement)) return
    const cell = target.closest<HTMLElement>('[data-hack-cell]')
    if (!cell || !cell.classList.contains('pick')) return
    const idx = cells.indexOf(cell)
    if (idx < 0 || idx === hover) return
    hover = idx
    const r = Math.floor(idx / s.size)
    const c = idx % s.size
    // the line that becomes active if this cell is picked
    preview.className = `hk-preview on ${s.lineIsRow ? 'col' : 'row'}`
    preview.style.setProperty('--i', String(s.lineIsRow ? c : r))
    el.classList.add('over')
    sound.play('ui_hover', V.hoverVolume)
  }
  function unhover(): void {
    hover = -1
    preview.classList.remove('on')
    el.classList.remove('over')
  }
  grid.addEventListener('pointerover', (e) => hoverCell(e.target))
  grid.addEventListener('pointerleave', unhover)
  grid.addEventListener('focusin', (e) => hoverCell(e.target))

  // ---------------------------------------------------------------------------------------------- the API
  function show(s: HackSession): void {
    window.clearTimeout(hideTimer)
    cur = s
    build(s)
    seenRev = -1
    seenSeq = s.last.seq
    seenStatus = s.status
    shownTenths = -1
    low = false
    hover = -1
    el.classList.remove('low', 'done', 'on', 'over')
    result.className = 'hk-result'
    el.hidden = false
    void el.offsetWidth
    el.classList.add('on')
    sound.resume()
    sound.play('hack_start')
    render(s)
    seenRev = s.rev
    update(s)
  }

  /** Every frame while open. No allocations unless the session changed. */
  function update(s: HackSession): void {
    if (s !== cur) {
      show(s)
      return
    }
    if (s.rev !== seenRev) {
      seenRev = s.rev
      render(s)
    }
    if (s.last.seq !== seenSeq) {
      seenSeq = s.last.seq
      react(s)
    }
    if (s.status !== seenStatus) {
      seenStatus = s.status
      if (s.status !== 'running') finish(s)
    }
    if (clockAnim) clockAnim.currentTime = (1 - hackTimeFraction(s)) * 1000
    const tenths = Math.ceil(hackTimeLeft(s) * 10)
    if (tenths !== shownTenths) {
      shownTenths = tenths
      timeNum.textContent = timeTexts[tenths] ?? ''
    }
    const running = s.status === 'running'
    const isLow = running && hackTimeLeft(s) <= V.lowTimeSec
    if (isLow !== low) {
      low = isLow
      el.classList.toggle('low', isLow)
      sound.setTickRate(isLow ? V.tickRateLow : 1)
    }
    if (running && !sound.ticking) {
      sound.startTick(V.tickVolume)
      if (low) sound.setTickRate(V.tickRateLow)
    }
  }

  function hide(): void {
    sound.stopTick()
    cur = null
    el.classList.remove('on')
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      if (!cur) el.hidden = true
    }, 200)
  }

  return { show, update, hide }
}
