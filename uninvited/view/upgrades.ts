// May's upgrade screen (DESIGN 10): a full-screen overlay in the game's cyan-and-keycap style. The game pauses while it is
// open (main.ts owns the mode); it opens at a checkpoint and later from the room: `open(onClose)`.
//   Arrows / WASD choose a card, Enter or a click buys, Esc / Tab / E / Space (or the button) continue.
// The view reads the state through core/queries only; buying goes through the `buy` callback (main.ts calls the core command).
import { anyAffordable, buyState, effectAt, mayPoints, maxRank, nextCost, rankOf, hackTimeRange, pauseLengthSec, maxCharges, type BuyState } from '../core/queries'
import type { GameState, Sim } from '../core/state'
import { renderKeys, t } from './hud'

export interface UpgradeDeps {
  state(): GameState
  sim: Sim
  /** Buys the next rank of an upgrade (the core command) and flushes its events. */
  buy(id: string): void
  /** Plays a UI sound: 'move' | 'buy' | 'deny' | 'close'. */
  sfx?(kind: 'move' | 'buy' | 'deny' | 'close'): void
}

export interface UpgradeScreen {
  /** Shows the screen; `onClose` runs once when the player continues. May's first line is chosen by what can be bought. */
  open(onClose: () => void): void
  /** Closes without a callback (a state reset). */
  close(): void
  readonly isOpen: boolean
}

type TextKey = Parameters<typeof t>[0]

/** Rows of the screen: the actives, then the passives. Their order is the card order. */
const ROWS: readonly (readonly string[])[] = [
  ['distract', 'pause', 'pauseTime', 'cooldown'],
  ['shield', 'charges', 'hackTime'],
]
const KEY_OF: Record<string, string> = { distract: '1', pause: '2' }

const CSS = `
.upg { position: absolute; inset: 0; z-index: 70; display: none; align-items: center; justify-content: center; pointer-events: auto;
  background: radial-gradient(ellipse at center, rgba(0, 6, 12, 0.82), rgba(0, 0, 0, 0.96)); font-size: clamp(13px, 2vh, 24px); color: var(--white); }
.upg.on { display: flex; }
.upg-box { box-sizing: border-box; width: min(94vw, 1240px); max-height: 96vh; overflow: hidden; padding: 1.1em 1.5em 1em; background: rgba(0, 10, 16, 0.94);
  border: 1px solid var(--cyan); border-top: 0.25em solid var(--cyan); box-shadow: 0 0 40px rgba(111, 244, 255, 0.25); }
.upg-head { display: flex; align-items: baseline; gap: 0.9em; }
.upg-head .who { display: inline-block; padding: 0 0.5em; font-size: 0.75em; font-weight: 700; letter-spacing: 0.2em; color: #04141a; background: var(--cyan); }
.upg-head h2 { margin: 0; font-weight: 300; font-size: 1.5em; letter-spacing: 0.3em; text-shadow: 0 0 14px var(--cyan); }
.upg-pts { margin-left: auto; letter-spacing: 0.2em; color: var(--dim); }
.upg-pts b { font-size: 1.7em; font-weight: 700; color: var(--white); text-shadow: 0 0 12px var(--cyan); margin-left: 0.3em; }
.upg-say { margin: 0.7em 0 0.9em; padding: 0.35em 0.9em; border-left: 0.2em solid var(--cyan); background: rgba(111, 244, 255, 0.06); min-height: 1.4em; line-height: 1.4; }
.upg-label { margin: 0.5em 0 0.35em; font-size: 0.75em; letter-spacing: 0.3em; color: var(--dim); }
.upg-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.7em; }
.upg-card { position: relative; box-sizing: border-box; padding: 0.6em 0.75em 0.55em; background: rgba(0, 18, 26, 0.7); border: 1px solid rgba(111, 244, 255, 0.35); cursor: pointer; min-height: 11.2em; display: flex; flex-direction: column; }
.upg-card.sel { border-color: var(--cyan); box-shadow: 0 0 18px rgba(111, 244, 255, 0.45), inset 0 0 0 1px rgba(111, 244, 255, 0.35); background: rgba(8, 40, 52, 0.8); }
.upg-card.locked, .upg-card.max .upg-price { opacity: 0.55; }
.upg-card.locked { border-style: dashed; }
.upg-card.poor .upg-price { color: var(--amber); }
.upg-name { font-weight: 700; letter-spacing: 0.08em; font-size: 1.05em; }
.upg-name kbd { margin-right: 0.5em; }
.upg-pips { margin: 0.3em 0; display: flex; gap: 0.3em; }
.upg-pip { width: 1.4em; height: 0.4em; border: 1px solid rgba(111, 244, 255, 0.6); }
.upg-pip.on { background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.upg-desc { font-size: 0.82em; line-height: 1.4; color: rgba(220, 245, 255, 0.78); flex: 1; }
.upg-fx { margin-top: 0.4em; font-size: 0.82em; display: grid; grid-template-columns: auto 1fr; gap: 0 0.7em; }
.upg-fx i { font-style: normal; color: var(--dim); letter-spacing: 0.15em; }
.upg-fx .nx { color: var(--cyan); }
.upg-price { margin-top: 0.45em; padding-top: 0.35em; border-top: 1px solid rgba(111, 244, 255, 0.2); letter-spacing: 0.18em; font-weight: 700; color: var(--cyan); }
.upg-card.buy .upg-price { color: var(--white); text-shadow: 0 0 10px var(--cyan); }
.upg-rules { box-sizing: border-box; padding: 0.6em 0.75em; border: 1px dashed rgba(255, 176, 58, 0.55); background: rgba(40, 24, 0, 0.35); font-size: 0.82em; line-height: 1.6; min-height: 11.2em; }
.upg-rules h3 { margin: 0 0 0.4em; font-size: 0.95em; letter-spacing: 0.22em; color: var(--amber); font-weight: 700; }
.upg-foot { display: flex; align-items: center; gap: 1.2em; margin-top: 0.9em; }
.upg-keys { color: var(--dim); font-size: 0.85em; }
.upg-go { margin-left: auto; padding: 0.4em 1.4em; letter-spacing: 0.2em; color: var(--cyan); border: 1px solid currentColor; box-shadow: 0 0 14px -4px currentColor; cursor: pointer; }
.upg-go:hover { background: rgba(111, 244, 255, 0.12); }
.upg-card.pop { animation: upgPop 0.4s ease-out 1; }
@keyframes upgPop { from { box-shadow: 0 0 34px rgba(111, 244, 255, 1); } }
.upg-card.shake { animation: upgShake 0.25s steps(4) 1; }
@keyframes upgShake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@media (max-height: 560px) { .upg-card, .upg-rules { min-height: 0; } }
`

function div(parent: HTMLElement | null, cls: string, text?: string): HTMLDivElement {
  const d = document.createElement('div')
  d.className = cls
  if (text !== undefined) d.textContent = text
  parent?.appendChild(d)
  return d
}

export function createUpgradeScreen(parent: HTMLElement, deps: UpgradeDeps): UpgradeScreen {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  const root = div(parent, 'upg')
  let opened = false
  let onClose: (() => void) | null = null
  let sel = 0
  let say = ''
  const flat = ROWS.flat()
  const cards = new Map<string, HTMLElement>()

  const name = (id: string): string => t(`upgrade.name.${id}` as TextKey)

  function fx(sim: Sim, id: string, rank: number): string {
    const v = effectAt(sim, id, rank)
    return v < 0 ? t('upgrade.none') : t(`upgrade.fx.${id}` as TextKey, { v })
  }

  function build(): void {
    const s = deps.state()
    const sim = deps.sim
    root.replaceChildren()
    cards.clear()
    const box = div(root, 'upg-box')
    const head = div(box, 'upg-head')
    div(head, 'who', 'MAY')
    const h2 = document.createElement('h2')
    h2.textContent = t('upgrade.title')
    head.appendChild(h2)
    const pts = div(head, 'upg-pts', t('upgrade.points'))
    const b = document.createElement('b')
    b.textContent = String(mayPoints(s))
    pts.appendChild(b)
    div(box, 'upg-say', say)

    ROWS.forEach((row, r) => {
      div(box, 'upg-label', t(r === 0 ? 'upgrade.actives' : 'upgrade.passives'))
      const grid = div(box, 'upg-row')
      for (const id of row) grid.appendChild(card(s, sim, id))
      if (r === 1) grid.appendChild(rules(s, sim))
    })

    const foot = div(box, 'upg-foot')
    renderKeys(div(foot, 'upg-keys'), t('upgrade.keys'))
    const go = div(foot, 'upg-go')
    renderKeys(go, t('upgrade.continue'))
    go.addEventListener('click', () => close(true))
    select(sel, false)
  }

  function card(s: GameState, sim: Sim, id: string): HTMLElement {
    const st: BuyState = buyState(s, sim, id)
    const rank = rankOf(s, id)
    const max = maxRank(sim, id)
    const c = div(null, `upg-card ${st}`)
    cards.set(id, c)
    const nm = div(c, 'upg-name')
    const key = KEY_OF[id]
    if (key) {
      const k = document.createElement('kbd')
      k.textContent = key
      nm.appendChild(k)
    }
    nm.appendChild(document.createTextNode(name(id)))
    const pips = div(c, 'upg-pips')
    for (let i = 0; i < max; i++) div(pips, `upg-pip${i < rank ? ' on' : ''}`)
    const desc = div(c, 'upg-desc')
    renderKeys(desc, t(`upgrade.desc.${id}` as TextKey))
    const f = div(c, 'upg-fx')
    const i1 = document.createElement('i')
    i1.textContent = t('upgrade.now')
    f.appendChild(i1)
    div(f, '', fx(sim, id, rank))
    if (rank < max) {
      const i2 = document.createElement('i')
      i2.textContent = t('upgrade.next')
      f.appendChild(i2)
      div(f, 'nx', fx(sim, id, rank + 1))
    }
    const cost = nextCost(s, sim, id)
    const price = div(c, 'upg-price')
    if (st === 'max') price.textContent = t('upgrade.max')
    else if (st === 'locked') price.textContent = t('upgrade.locked', { name: name(sim.cfg.progression.items[id]?.requires ?? '').toUpperCase() })
    else price.textContent = cost === 0 ? t('upgrade.free') : t('upgrade.cost', { n: cost })
    c.addEventListener('mouseenter', () => select(flat.indexOf(id), true))
    c.addEventListener('click', () => {
      select(flat.indexOf(id), false)
      buySelected()
    })
    return c
  }

  /** The visible rule: what the player gets without upgrades is shown as plain numbers. */
  function rules(s: GameState, sim: Sim): HTMLElement {
    const r = div(null, 'upg-rules')
    const h = document.createElement('h3')
    h.textContent = t('upgrade.rulesNow')
    r.appendChild(h)
    const range = { min: 0, max: 0 }
    hackTimeRange(s, sim, range)
    div(r, '', t('upgrade.rule.pause', { v: Math.round(pauseLengthSec(s, sim)) }))
    div(r, '', t('upgrade.rule.hack', { min: Math.round(range.min), max: Math.round(range.max) }))
    div(r, '', t('upgrade.rule.charges', { v: maxCharges(s, sim) }))
    div(r, '', rankOf(s, 'shield') > 0 ? fx(sim, 'shield', rankOf(s, 'shield')).replace(/^/, `${name('shield')}: `) : t('upgrade.rule.shield'))
    return r
  }

  function select(i: number, hover: boolean): void {
    const n = flat.length
    const next = ((i % n) + n) % n
    if (next !== sel && !hover) deps.sfx?.('move')
    sel = next
    for (const [id, el] of cards) el.classList.toggle('sel', id === flat[sel])
  }

  function buySelected(): void {
    const id = flat[sel] as string
    const s = deps.state()
    if (buyState(s, deps.sim, id) !== 'buy') {
      deps.sfx?.('deny')
      cards.get(id)?.classList.add('shake')
      setTimeout(() => cards.get(id)?.classList.remove('shake'), 300)
      return
    }
    deps.buy(id)
    deps.sfx?.('buy')
    const key = `may.upgrade.${id}` as TextKey
    say = t(key)
    build()
    cards.get(id)?.classList.add('pop')
  }

  /** Moves the selection one card in a direction, staying in the row grid (4 + 3 cards). */
  function move(dx: number, dy: number): void {
    const id = flat[sel] as string
    let r = ROWS.findIndex((row) => row.includes(id))
    let c = (ROWS[r] as readonly string[]).indexOf(id)
    if (dy !== 0) {
      r = (r + dy + ROWS.length) % ROWS.length
      c = Math.min(c, (ROWS[r] as readonly string[]).length - 1)
    } else {
      const len = (ROWS[r] as readonly string[]).length
      c = (c + dx + len) % len
    }
    select(flat.indexOf((ROWS[r] as readonly string[])[c] as string), false)
  }

  function onKey(e: KeyboardEvent): void {
    if (!opened) return
    let used = true
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        move(-1, 0)
        break
      case 'ArrowRight':
      case 'KeyD':
        move(1, 0)
        break
      case 'ArrowUp':
      case 'KeyW':
        move(0, -1)
        break
      case 'ArrowDown':
      case 'KeyS':
        move(0, 1)
        break
      case 'Enter':
      case 'NumpadEnter':
        if (!e.repeat) buySelected()
        break
      case 'Escape':
      case 'Tab':
      case 'KeyE':
      case 'Space':
        if (!e.repeat) close(true)
        break
      default:
        used = false
    }
    if (used) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
  document.addEventListener('keydown', onKey, true)

  function close(callback: boolean): void {
    if (!opened) return
    opened = false
    root.classList.remove('on')
    deps.sfx?.('close')
    const fn = onClose
    onClose = null
    if (callback) fn?.()
  }

  return {
    open(cb): void {
      if (opened) return
      opened = true
      onClose = cb
      const s = deps.state()
      const first = flat.find((id) => buyState(s, deps.sim, id) === 'buy')
      sel = first ? flat.indexOf(first) : 0
      say = t(anyAffordable(s, deps.sim) ? 'may.upgrade.open' : 'may.upgrade.empty')
      build()
      root.classList.add('on')
    },
    close: () => close(false),
    get isOpen(): boolean {
      return opened
    },
  }
}
