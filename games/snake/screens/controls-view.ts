// screens/controls-view.ts - the controls screen: a diagram of the screen with numbered controls, a short legend, and (where there is a keyboard)
// the key list. Cold path: redrawn in full on open, on a scheme tab, on language change. No game logic.
//
// Everything that can be read from the code is read from it: key names and pad buttons from input/controls-doc.ts (which reads keyboard.ts and
// gestures.ts), which lines exist for a scheme from screens/controls-layout.ts. Only the wording comes from the dictionaries.
import type { InputScheme } from '../input/index'
import type { PadSide } from '../input/gestures'
import { keyRows, padButtons, type KeyAction } from '../input/controls-doc'
import { t } from '../i18n/runtime'
import type { TextKey } from '../i18n/dictionaries'
import { controlLines, keyListPlacement, type ControlId, type InputKinds } from './controls-layout'

export interface ControlsViewDeps {
  /** The scheme the player has selected in settings. The screen opens on it. */
  readonly scheme: () => InputScheme
  readonly padSide: () => PadSide
  readonly kinds: () => InputKinds
}

export interface ControlsView {
  /** Redraw (language change, a tab press). */
  render(): void
  /** On opening: back to the player's own scheme, scroll to the top. */
  reset(): void
}

/** Browser device kinds: `any-pointer` is live across hybrids (a touch laptop is both). Cold path. */
export function detectInputKinds(): InputKinds {
  const has = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches
  return { touch: has('(any-pointer: coarse)'), keyboard: has('(any-pointer: fine)') }
}

const LINE_TEXT: Readonly<Record<ControlId, TextKey>> = {
  swipe: 'controls.swipe',
  arrows: 'controls.arrows',
  boost: 'controls.boost',
  stick: 'controls.stick',
  reset: 'controls.reset',
  pause: 'controls.pause',
}

const KEY_TEXT: Readonly<Record<KeyAction, TextKey>> = {
  turn: 'controls.key.turn',
  boost: 'controls.key.boost',
  cameraReset: 'controls.key.cameraReset',
  pause: 'controls.key.pause',
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls !== undefined) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

// --- the diagram -------------------------------------------------------------------------------------------------
// A phone screen drawn to the same proportions as the real controls (the pad cell is 22 of 160 units, as 58 px of 390),
// with the numbers of the legend on the controls. Mirrored by the pad side, exactly as the game lays them out.

const SVG_NS = 'http://www.w3.org/2000/svg'
const W = 160
const H = 260

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, cls?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  if (cls !== undefined) node.setAttribute('class', cls)
  return node
}

type Num = (id: ControlId) => number | undefined

function drawDiagram(scheme: InputScheme, side: PadSide, num: Num): SVGSVGElement {
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, 'ctl-diagram')
  svg.setAttribute('aria-label', t('aria.controlsDiagram'))
  const right = side === 'right'
  // x of a point / of a box's left edge, mirrored for the left-hand pad.
  const X = (x: number): number => (right ? x : W - x)
  const stickX = right ? 24 : W - 24 // the stick sits in the corner opposite the pad

  const badge = (cx: number, cy: number, id: ControlId, cls = 'd-badge'): void => {
    const n = num(id)
    if (n === undefined) return
    svg.append(s('circle', { cx, cy, r: 7.5 }, cls))
    const label = s('text', { x: cx, y: cy + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'd-num')
    label.textContent = String(n)
    svg.append(label)
  }
  const arrowGlyph = (cx: number, cy: number, angle: number, size: number): void => {
    // A chevron pointing "up", rotated: 0 up, 90 right, 180 down, 270 left.
    svg.append(s('path', { d: `M${-size} ${size * 0.5} L0 ${-size * 0.5} L${size} ${size * 0.5}`, transform: `translate(${cx} ${cy}) rotate(${angle})` }, 'd-line'))
  }

  svg.append(s('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 14 }, 'd-frame'))

  // Pause: top right, in both schemes.
  svg.append(s('circle', { cx: 144, cy: 16, r: 9 }, 'd-ctl'))
  svg.append(s('rect', { x: 140, y: 12, width: 2.6, height: 8, rx: 0.8 }, 'd-fill'))
  svg.append(s('rect', { x: 145.4, y: 12, width: 2.6, height: 8, rx: 0.8 }, 'd-fill'))
  badge(126, 16, 'pause')

  // Camera reset: the crosshair. Stick: on the side opposite the pad.
  const crosshair = (cx: number, cy: number, r: number): void => {
    svg.append(s('circle', { cx, cy, r }, 'd-ctl'))
    svg.append(s('circle', { cx, cy, r: 2.2 }, 'd-line'))
    svg.append(s('path', { d: `M${cx} ${cy - r + 2} v3 M${cx} ${cy + r - 2} v-3 M${cx - r + 2} ${cy} h3 M${cx + r - 2} ${cy} h-3` }, 'd-line'))
  }
  const stick = (cx: number, cy: number): void => {
    if (num('stick') === undefined) return
    svg.append(s('circle', { cx, cy, r: 19 }, 'd-ctl'))
    svg.append(s('circle', { cx, cy, r: 6 }, 'd-ctl'))
    badge(cx, cy - 19 - 9, 'stick')
  }

  if (scheme === 'swipes') {
    // Swipe: a plus of arrows in the field.
    for (const angle of [0, 90, 180, 270]) {
      const rad = (angle * Math.PI) / 180
      arrowGlyph(80 + Math.sin(rad) * 24, 110 - Math.cos(rad) * 24, angle, 6)
    }
    badge(80, 68, 'swipe')
    // The boost is a corner button on the pad side; the crosshair above it.
    svg.append(s('circle', { cx: X(136), cy: 236, r: 16 }, 'd-boost'))
    badge(X(136), 236, 'boost', 'd-badge boost')
    crosshair(X(136), 206, 10)
    badge(X(136), 206 - 10 - 9, 'reset')
    stick(stickX, 236)
  } else {
    // The pad: a cross of four arrow buttons with the boost in its centre, in the corner on the pad side.
    const cell = 22
    const y0 = 182
    const crossX0 = right ? 82 : 8
    const cx = (col: number): number => crossX0 + col * (cell + 2)
    const cy = (row: number): number => y0 + row * (cell + 2)
    const cells: ReadonlyArray<{ id: string; col: number; row: number; angle: number }> = [
      { id: 'up', col: 1, row: 0, angle: 0 },
      { id: 'left', col: 0, row: 1, angle: 270 },
      { id: 'right', col: 2, row: 1, angle: 90 },
      { id: 'down', col: 1, row: 2, angle: 180 },
    ]
    // The four arrow buttons are the pad buttons that turn in the plane: the ids come from the code's list (input/gestures.ts PAD_BUTTONS).
    const known = new Set(padButtons())
    for (const c of cells) {
      if (!known.has(c.id)) continue
      svg.append(s('rect', { x: cx(c.col), y: cy(c.row), width: cell, height: cell, rx: 5 }, 'd-ctl'))
      arrowGlyph(cx(c.col) + cell / 2, cy(c.row) + cell / 2, c.angle, 5)
    }
    const midX = cx(1) + cell / 2
    badge(midX, y0 - 9, 'arrows')
    svg.append(s('circle', { cx: midX, cy: cy(1) + cell / 2, r: 10 }, 'd-boost'))
    badge(midX, cy(1) + cell / 2, 'boost', 'd-badge boost')
    // The camera reset sits above the outer column of the cross, at the screen edge.
    const edgeX = cx(right ? 2 : 0) + cell / 2
    crosshair(edgeX, 169, 9)
    badge(edgeX, 169 - 9 - 9, 'reset')
    stick(stickX, 217)
  }
  return svg
}

// --- the screen --------------------------------------------------------------------------------------------------

export function createControlsView(body: HTMLElement, deps: ControlsViewDeps): ControlsView {
  let shown: InputScheme = deps.scheme()

  function keyList(): HTMLElement {
    const box = el('section', 'ctl-keys')
    box.append(el('h3', undefined, t('controls.keys.title')))
    const list = el('dl', 'ctl-keylist')
    for (const row of keyRows()) {
      list.append(el('dt', undefined, t(KEY_TEXT[row.action])))
      const dd = el('dd')
      row.groups.forEach((group, i) => {
        if (i > 0) dd.append(el('span', 'ctl-or', '/'))
        const caps = el('span', 'ctl-caps')
        for (const k of group) caps.append(el('kbd', undefined, k))
        dd.append(caps)
      })
      list.append(dd)
    }
    box.append(list)
    // The mouse: the tilt is the right/middle button (touch.ts pointerRole), the zoom is the wheel.
    box.append(el('p', 'ctl-note', t('controls.mouse.tilt')), el('p', 'ctl-note', t('controls.mouse.zoom')))
    return box
  }

  function render(): void {
    const kinds = deps.kinds()
    const mine = deps.scheme()
    const lines = controlLines(shown, kinds)
    const num: Num = (id) => {
      const i = lines.indexOf(id)
      return i < 0 ? undefined : i + 1
    }

    const tabs = el('div', 'options ctl-tabs')
    tabs.setAttribute('role', 'radiogroup')
    tabs.setAttribute('aria-label', t('aria.controlsScheme'))
    for (const scheme of ['swipes', 'taps'] as const) {
      const btn = el('button', scheme === shown ? 'selected' : '', t(scheme === 'swipes' ? 'scheme.swipes' : 'scheme.taps'))
      btn.type = 'button'
      btn.dataset['ctlScheme'] = scheme
      btn.setAttribute('aria-pressed', String(scheme === shown))
      tabs.append(btn)
    }

    const main = el('div', 'ctl-main')
    main.append(drawDiagram(shown, deps.padSide(), num))
    const legend = el('ol', 'ctl-legend')
    for (const id of lines) {
      const li = el('li')
      li.append(el('span', id === 'boost' ? 'ctl-badge boost' : 'ctl-badge', String(num(id))), el('span', 'ctl-text', t(id === 'reset' && !kinds.touch ? 'controls.resetNoStick' : LINE_TEXT[id])))
      legend.append(li)
    }
    main.append(legend)

    const parts: Node[] = [tabs]
    if (shown !== mine) parts.push(el('p', 'ctl-other', t('controls.other')))
    parts.push(main)
    if (kinds.touch) parts.push(el('p', 'ctl-note', t('controls.note.fingers')))
    const placement = keyListPlacement(kinds)
    if (placement === 'first') parts.unshift(keyList())
    else if (placement === 'last') parts.push(keyList())
    body.replaceChildren(...parts)
  }

  body.addEventListener('click', (e) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const btn = target.closest<HTMLElement>('button[data-ctl-scheme]')
    if (btn === null) return
    const next = btn.dataset['ctlScheme']
    if (next !== 'swipes' && next !== 'taps' || next === shown) return
    shown = next
    render()
  })

  return {
    render,
    reset() {
      shown = deps.scheme()
      render()
      body.scrollTop = 0
    },
  }
}
