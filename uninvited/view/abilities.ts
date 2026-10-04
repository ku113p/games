// May's two actives on the HUD (DESIGN 10): a slot per key (1 distraction signal, 2 pause a camera) with a keycap, a name,
// a cooldown ring that fills while it recharges, and for the pause its current length. A slot stays hidden until the
// upgrade is bought. The module owns its DOM and its style; game-view calls update() once a frame.
import { t } from './hud'

export interface AbilitySlotView {
  unlocked: boolean
  /** Seconds until ready (0 = ready) and the full cooldown, s. */
  cooldown: number
  cooldownLength: number
}

export interface AbilityHudState {
  slots: readonly [AbilitySlotView, AbilitySlotView]
  /** The current pause length, s (shown under key 2). */
  pauseSec: number
}

export interface AbilityHud {
  update(h: AbilityHudState): void
  /** HUD size in percent (100, 125, 150), like the rest of the HUD. */
  setScale(pct: number): void
  setVisible(on: boolean): void
  /** The slot flashes (a press that did nothing: cooling down, nothing aimed at). */
  deny(slot: number): void
  /** The slot flashes (used). */
  used(slot: number): void
}

const R = 26
const CIRC = 2 * Math.PI * R

const CSS = `
.abil { position: absolute; right: 26px; bottom: 118px; display: flex; gap: 12px; align-items: flex-end; pointer-events: none; transform-origin: right bottom; z-index: 5; }
.abil-slot { position: relative; width: 66px; text-align: center; opacity: 1; transition: opacity 0.25s; }
.abil-slot.off { display: none; }
.abil-ring { position: relative; width: 64px; height: 64px; border: 1px solid rgba(111, 244, 255, 0.55); background: rgba(0, 8, 14, 0.72); box-shadow: 0 0 14px rgba(111, 244, 255, 0.25); }
.abil-ring svg { position: absolute; inset: 5px; width: 54px; height: 54px; transform: rotate(-90deg); overflow: visible; }
.abil-ring circle { fill: none; stroke-width: 3; }
.abil-ring .track { stroke: rgba(111, 244, 255, 0.2); }
.abil-ring .fill { stroke: #6ff4ff; stroke-linecap: butt; filter: drop-shadow(0 0 4px #6ff4ff); }
.abil-slot.cool .abil-ring { border-color: rgba(111, 244, 255, 0.22); box-shadow: none; }
.abil-slot.cool .fill { stroke: rgba(111, 244, 255, 0.5); filter: none; }
.abil-slot.cool .abil-name { color: rgba(200, 240, 255, 0.4); }
.abil-key { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); font-size: 20px; font-weight: 700; color: var(--white);
  min-width: 1.3em; padding: 0 0.3em; line-height: 1.35; background: #10303a; border: 1px solid var(--cyan); border-bottom-width: 3px; border-radius: 4px; box-shadow: 0 0 8px rgba(111, 244, 255, 0.35); }
.abil-slot.cool .abil-key { opacity: 0.45; }
.abil-time { position: absolute; left: 0; right: 0; top: 66%; font-size: 12px; font-weight: 700; color: var(--cyan); }
.abil-name { margin-top: 5px; font-size: 10px; letter-spacing: 3px; color: var(--dim); }
.abil-slot.flash .abil-ring { animation: abilFlash 0.35s ease-out 1; }
.abil-slot.deny .abil-ring { animation: abilDeny 0.3s steps(2, start) 1; }
@keyframes abilFlash { from { box-shadow: 0 0 26px rgba(111, 244, 255, 0.95); background: rgba(40, 120, 140, 0.7); } }
@keyframes abilDeny { 50% { border-color: #ff4a3a; box-shadow: 0 0 14px rgba(255, 60, 40, 0.7); } }
`

function svgCircle(parent: Element, cls: string): SVGCircleElement {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  c.setAttribute('class', cls)
  c.setAttribute('cx', '27')
  c.setAttribute('cy', '27')
  c.setAttribute('r', String(R))
  parent.appendChild(c)
  return c
}

export function createAbilityHud(parent: HTMLElement): AbilityHud {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  const root = document.createElement('div')
  root.className = 'abil'
  parent.appendChild(root)

  interface Slot {
    el: HTMLElement
    fill: SVGCircleElement
    time: HTMLElement
    lastOff: number
    lastText: string
    lastCool: number
  }
  const make = (key: string, name: string): Slot => {
    const el = document.createElement('div')
    el.className = 'abil-slot off'
    const ring = document.createElement('div')
    ring.className = 'abil-ring'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 54 54')
    svgCircle(svg, 'track')
    const fill = svgCircle(svg, 'fill')
    fill.setAttribute('stroke-dasharray', String(CIRC))
    ring.appendChild(svg)
    const k = document.createElement('span')
    k.className = 'abil-key'
    k.textContent = key
    ring.appendChild(k)
    const time = document.createElement('div')
    time.className = 'abil-time'
    ring.appendChild(time)
    el.appendChild(ring)
    const n = document.createElement('div')
    n.className = 'abil-name'
    n.textContent = name
    el.appendChild(n)
    root.appendChild(el)
    return { el, fill, time, lastOff: -1, lastText: '', lastCool: -1 }
  }
  const slots = [make('1', t('hud.ability.distract')), make('2', t('hud.ability.pause'))]
  const timers: (ReturnType<typeof setTimeout> | null)[] = [null, null]

  function pulse(i: number, cls: 'flash' | 'deny'): void {
    const el = (slots[i] as Slot).el
    el.classList.remove('flash', 'deny')
    void el.offsetWidth // restart the animation
    el.classList.add(cls)
    const tm = timers[i]
    if (tm) clearTimeout(tm)
    timers[i] = setTimeout(() => el.classList.remove('flash', 'deny'), 400)
  }

  return {
    update(h): void {
      for (let i = 0; i < 2; i++) {
        const v = h.slots[i] as AbilitySlotView
        const s = slots[i] as Slot
        const off = v.unlocked ? 0 : 1
        if (off !== s.lastOff) {
          s.el.classList.toggle('off', off === 1)
          s.lastOff = off
        }
        if (!v.unlocked) continue
        // the ring is full when ready and empties as the cooldown starts, then refills
        const k = v.cooldown > 0 ? 1 - Math.min(1, v.cooldown / Math.max(0.01, v.cooldownLength)) : 1
        const q = Math.round(k * 100)
        if (q !== s.lastCool) {
          s.fill.setAttribute('stroke-dashoffset', String(CIRC * (1 - k)))
          s.el.classList.toggle('cool', v.cooldown > 0)
          s.lastCool = q
        }
        const text = v.cooldown > 0 ? String(Math.ceil(v.cooldown)) : i === 1 ? `${Math.round(h.pauseSec)} s` : ''
        if (text !== s.lastText) {
          s.time.textContent = text
          s.lastText = text
        }
      }
    },
    setScale(pct): void {
      root.style.setProperty('zoom', String(pct / 100))
    },
    setVisible(on): void {
      root.style.display = on ? '' : 'none'
    },
    deny: (slot) => pulse(slot, 'deny'),
    used: (slot) => pulse(slot, 'flash'),
  }
}
