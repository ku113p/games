// The HUD and the screens (DOM over the canvas): HP, dash, charges and weapon mode, alarm level, security status,
// the suspicion marks around the crosshair (one arc per watcher noticing you, turned toward it - the view cones show
// only in network vision, so these say where the danger is), network-vision heat and cooldown, the interact prompt,
// toasts and hints; start / pause / death / win screens.
// Every text comes from texts/en.json. Per-frame updates write only when a value changed.
import texts from '../texts/en.json'
import type { SettingsHandle } from './settings'
import { buildSettingsPanel, SETTINGS_CSS } from './settings-ui'
import { TIPS_CFG, type CardId, type Tips } from './tips'

type TextKey = Exclude<keyof typeof texts, 'controls'>

export function t(key: TextKey, vars?: Record<string, string | number>): string {
  let s = texts[key] as string
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

/** Who says a prompt or a card: none (the game) or May, the AI assistant (a name label and her accent colour). */
export type Speaker = 'may'

/** A contextual prompt: `text` may hold {Key} markup. */
export interface PromptSpec {
  id: string
  text: string
  speaker?: Speaker
}

/** A tutorial card: a title and up to three lines with {Key} markup. */
export interface CardSpec {
  id: string
  title: string
  lines: readonly string[]
  speaker?: Speaker
}

const SPEAKER_NAME: Record<Speaker, string> = { may: 'MAY' }

/** The built-in tutorial card `id`, from texts/en.json (card.<id>.title, card.<id>.1..3). */
export function cardSpec(id: CardId): CardSpec {
  const lines: string[] = []
  for (const n of [1, 2, 3]) {
    const line = texts[`card.${id}.${n}` as keyof typeof texts] as string | undefined
    if (line) lines.push(line)
  }
  return { id, title: texts[`card.${id}.title` as keyof typeof texts] as string, lines }
}

/** Draws text with {Key} markup into an element: each {Key} becomes a keycap (a small bordered box), the rest stays text. */
export function renderKeys(parent: HTMLElement, text: string): void {
  parent.replaceChildren()
  const parts = text.split(/\{([^}]+)\}/)
  parts.forEach((p, i) => {
    if (p === '') return
    if (i % 2 === 1) {
      const k = document.createElement('kbd')
      k.textContent = p
      parent.appendChild(k)
    } else parent.appendChild(document.createTextNode(p))
  })
}

/** A watcher noticing the player, as the HUD draws it. */
export interface HudMark {
  /** Clockwise from straight ahead on screen (up), radians. */
  angle: number
  /** 0..1 how much of the arc is filled. */
  level: number
  /** Red and blinking: it has spotted you. */
  spotted: boolean
}

/** At most this many suspicion marks at once. */
export const MAX_MARKS = 8

export interface HudState {
  hp: number
  dash: number
  mode: 'sword' | 'rifle'
  charges: number
  alarm: number
  alarmDecay: number
  status: 'hidden' | 'suspected' | 'detected'
  niche: boolean
  suspicion: number
  scanActive: boolean
  scanHeat: number
  scanCooldown: number
  /** Heat (0..1) where the trace warning starts (config scan.warnAt). */
  scanWarnAt?: number
  /** Past the warning point while scanning. */
  scanWarning?: boolean
  prompt: 'none' | 'terminal' | 'artifact'
  wave: number
  wavesCleared: number
  wavesNeeded: number
  firewallDown: boolean
  crouched: boolean
  /** 0..1 how far into the aim (RMB): the aim crosshair closes in. */
  aim?: number
  /** The suspicion marks: the first markCount of marks are drawn. */
  marks: HudMark[]
  markCount: number
}

export interface Hud {
  update(h: HudState): void
  toast(text: string, kind?: 'info' | 'alarm' | 'good'): void
  /** The contextual prompt (non-blocking, big, with keycaps): the text, or null to fade it out. It has no timer. */
  hint(spec: PromptSpec | null): void
  /** A tutorial card (the caller pauses the game). Enter or a click calls onContinue once. back: the footer says "go back". */
  showCard(spec: CardSpec, back: boolean, onContinue: () => void): void
  setVisible(on: boolean): void
  /** Network vision held too long: the security is called - a clear banner. */
  traced(): void
  /** You got hit: a red flash at the screen edges and a red arc pointing where it came from (clockwise from up, radians). */
  hit(angle: number, strength: number): void
  showStart(onStart: () => void): void
  showPause(on: boolean): void
  showResume(on: boolean): void
  showDead(hasSave: boolean, onLoad: () => void, onRestart: () => void): void
  showWon(stats: string, ending: string, onAgain: () => void): void
  hideScreens(): void
  /** HUD size in percent (100, 125, 150). */
  setScale(pct: number): void
  /** Reduced flashing: no full-screen hit flash (the direction arc stays). */
  reduceFlash(on: boolean): void
  /** The first Esc in a hack: tells the player to press it again to abort (cleared by hackEsc(false) or after a while). */
  hackEsc(on: boolean): void
  /** The element the hack overlay is mounted in. */
  hackRoot: HTMLElement
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (text !== undefined) e.textContent = text
  parent.appendChild(e)
  return e
}

/** The trace meter and the traced banner (their styles live here, not in index.html). */
const TRACE_CSS = `
.hud-trace { position: absolute; left: 50%; top: 68%; width: 300px; margin-left: -150px; text-align: center;
  font-size: 11px; letter-spacing: 0.3em; color: #9fefff; opacity: 0; transition: opacity 0.15s; pointer-events: none; }
.hud-trace.on { opacity: 1; }
.hud-trace-bar { position: relative; height: 5px; margin-top: 6px; background: rgba(120, 220, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(120, 220, 255, 0.25); }
.hud-trace-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #8ff0ff; box-shadow: 0 0 8px #4fe0ff; }
.hud-trace-mark { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #ff4a3a; box-shadow: 0 0 6px #ff3020; }
.hud-trace.risk { color: #ff5a48; animation: traceRisk 0.45s steps(2, start) infinite; }
.hud-trace.risk .hud-trace-fill { background: #ff3a2a; box-shadow: 0 0 10px #ff2010; }
.hud-trace.risk .hud-trace-bar { box-shadow: inset 0 0 0 1px rgba(255, 70, 50, 0.6), 0 0 12px rgba(255, 40, 20, 0.5); }
@keyframes traceRisk { 50% { opacity: 0.45; } }
.hud-marks { position: absolute; left: 50%; top: 50%; width: 360px; height: 360px; margin: -180px 0 0 -180px;
  overflow: visible; pointer-events: none; }
.hud-mark { opacity: 0; transition: opacity 0.2s; }
.hud-mark.on { opacity: 1; }
.hud-mark-track { fill: none; stroke: rgba(255, 176, 60, 0.28); stroke-width: 7; stroke-linecap: round; }
.hud-mark-fill { fill: none; stroke: #ffb03c; stroke-width: 7; stroke-linecap: round; filter: drop-shadow(0 0 4px #ff9a20); }
.hud-mark-tip { fill: #ffb03c; }
.hud-mark.spotted .hud-mark-track { stroke: rgba(255, 60, 40, 0.45); }
.hud-mark.spotted .hud-mark-fill { stroke: #ff3a2a; filter: drop-shadow(0 0 6px #ff2010); }
.hud-mark.spotted .hud-mark-tip { fill: #ff3a2a; }
.hud-mark.spotted { animation: traceRisk 0.4s steps(2, start) infinite; }
.hud-traced { position: absolute; left: 0; right: 0; top: 34%; text-align: center; font-size: 26px; letter-spacing: 0.32em;
  color: #ff4a3a; text-shadow: 0 0 14px #ff2010; opacity: 0; pointer-events: none; transition: opacity 0.25s; }
.hud-traced.on { opacity: 1; animation: traceRisk 0.3s steps(2, start) 4; }
`

/** The "Esc again to abort" line over the hack overlay. */
const HACK_ESC_CSS = `
.hack-esc { position: absolute; left: 50%; bottom: 7%; transform: translateX(-50%); z-index: 60; padding: 8px 20px; letter-spacing: 3px;
  color: #ffd6a0; background: rgba(20, 8, 0, 0.82); border: 1px solid #ffb03a; box-shadow: 0 0 14px rgba(255, 176, 58, 0.5);
  pointer-events: none; }
`

/** The contextual prompt, the interact prompt, keycaps and the tutorial card. Font: about 2.6 % of the screen height, the card body 2.8 % like May's subtitles (the HUD size multiplies it). */
const TIPS_CSS = `
.hud-hint, .hud-prompt { position: absolute; left: 50%; transform: translateX(-50%); max-width: 88%; box-sizing: border-box; text-align: center;
  font-size: clamp(18px, 2.6vh, 34px); line-height: 1.35; padding: 0.35em 0.9em; color: var(--white); letter-spacing: 0.02em;
  background: rgba(0, 8, 14, 0.88); border: 1px solid rgba(111, 244, 255, 0.55); border-left: 0.2em solid var(--amber);
  box-shadow: 0 0 22px rgba(0, 0, 0, 0.7); opacity: 0; pointer-events: none; }
.hud-hint { bottom: 9vh; transition: opacity ${TIPS_CFG.promptFadeSec}s; }
.hud-prompt { top: 60%; border-left-color: var(--cyan); transition: opacity 0.15s; }
.hud-hint.on, .hud-prompt.on { opacity: 1; }
.who { display: inline-block; margin-right: 0.8em; padding: 0 0.5em; font-size: 0.7em; font-weight: 700; letter-spacing: 0.2em; color: #04141a; background: var(--cyan); vertical-align: 0.1em; }
.hud-hint.by-may { border-left-color: var(--cyan); }
.screen.card .who { display: block; width: fit-content; margin: 0 0 0.6em; }
.screen.card.by-may { border-top-color: var(--cyan); }
kbd { display: inline-block; min-width: 1.3em; box-sizing: border-box; padding: 0 0.4em; margin: 0 0.18em; font: inherit; font-weight: 700; line-height: 1.35;
  text-align: center; color: var(--white); background: #10303a; border: 1px solid var(--cyan); border-bottom-width: 0.18em; border-radius: 0.28em;
  box-shadow: 0 0 8px rgba(111, 244, 255, 0.35); }
.screen.card { box-sizing: border-box; width: ${TIPS_CFG.cardPercent}vw; max-width: none; text-align: left; cursor: pointer;
  font-size: clamp(20px, 2.8vh, 36px); padding: 1.2em 1.7em 1.1em; max-height: 92vh; overflow: auto; background: rgba(0, 10, 16, 0.94); border: 1px solid var(--cyan);
  border-top: 0.25em solid var(--amber); box-shadow: 0 0 40px rgba(111, 244, 255, 0.25); }
.screen.card h2 { font-size: 1.6em; letter-spacing: 0.22em; margin: 0 0 0.6em; text-transform: uppercase; }
.screen.card p { margin: 0.5em 0; line-height: 1.5; }
.screen.card .go { display: block; text-align: center; margin: 1.2em 0 0; padding: 0.5em 1em; letter-spacing: 0.15em; }
.tips-list { display: flex; flex-direction: column; gap: 4px; align-items: center; margin: 10px 0; }
.tips-list .btn { margin-top: 6px; min-width: 260px; }
`

/** The aim crosshair and the hit cues. */
const AIM_HIT_CSS = `
.hud-aim { position: absolute; left: 50%; top: 50%; width: 0; height: 0; opacity: 0; pointer-events: none; }
.hud-aim i { position: absolute; display: block; background: #eef8ff; box-shadow: 0 0 6px #6ff4ff; }
.hud-aim i.u, .hud-aim i.d { width: 2px; height: 9px; left: -1px; }
.hud-aim i.l, .hud-aim i.r { width: 9px; height: 2px; top: -1px; }
.hud-aim b { position: absolute; left: -2px; top: -2px; width: 4px; height: 4px; border-radius: 50%; background: #ff5a6a;
  box-shadow: 0 0 6px #ff3646; }
.hud-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0;
  box-shadow: inset 0 0 140px 30px rgba(255, 30, 40, 0.75); background: radial-gradient(ellipse at center, rgba(255, 0, 0, 0) 55%, rgba(255, 20, 30, 0.22)); }
.hud-flash.on { animation: hudFlash 0.42s ease-out 1; }
@keyframes hudFlash { 0% { opacity: 1; } 100% { opacity: 0; } }
.hud-hit { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; }
.hud-hit-arc { position: absolute; left: -90px; top: -190px; width: 180px; height: 60px; opacity: 0;
  border-top: 7px solid #ff2a36; border-radius: 50% 50% 0 0 / 100% 100% 0 0; filter: drop-shadow(0 0 8px #ff1020); }
.hud-hit.on .hud-hit-arc { animation: hudHit 0.9s ease-out 1; }
@keyframes hudHit { 0% { opacity: 1; transform: translateY(8px) scaleX(1.15); } 25% { opacity: 1; } 100% { opacity: 0; transform: none; } }
.hud-bar.hit .hud-bar-fill { background: #fff; box-shadow: 0 0 16px #ff3646; }
`

export function createHud(root: HTMLElement, toastSec: number, settings?: SettingsHandle, tips?: Tips): Hud {
  const css = document.createElement('style')
  css.textContent = TRACE_CSS + AIM_HIT_CSS + SETTINGS_CSS + HACK_ESC_CSS + TIPS_CSS
  document.head.appendChild(css)
  const hud = el('div', 'hud', root)

  // top: status + alarm
  const top = el('div', 'hud-top', hud)
  const status = el('div', 'hud-status', top, t('hud.hidden'))
  const susBar = el('div', 'hud-sus', top)
  const susFill = el('div', 'hud-sus-fill', susBar)
  const alarmRow = el('div', 'hud-alarm', top)
  el('span', 'hud-alarm-label', alarmRow, t('hud.alarm'))
  const pips: HTMLElement[] = []
  for (let i = 0; i < 3; i++) pips.push(el('span', 'hud-pip', alarmRow))
  const decay = el('div', 'hud-decay', top)
  const decayFill = el('div', 'hud-decay-fill', decay)
  const wave = el('div', 'hud-wave', top)

  // bottom left: signal (HP) + dash
  const left = el('div', 'hud-left', hud)
  el('div', 'hud-label', left, t('hud.signal'))
  const hpBar = el('div', 'hud-bar', left)
  const hpFill = el('div', 'hud-bar-fill', hpBar)
  el('div', 'hud-label small', left, t('hud.dash'))
  const dashBar = el('div', 'hud-bar thin', left)
  const dashFill = el('div', 'hud-bar-fill', dashBar)

  // bottom right: weapon + network vision
  const right = el('div', 'hud-right', hud)
  const modeRow = el('div', 'hud-mode', right)
  const swordTag = el('span', 'hud-mode-tag', modeRow, t('hud.sword'))
  const rifleTag = el('span', 'hud-mode-tag', modeRow, t('hud.rifle'))
  const charges = el('div', 'hud-charges', right)
  el('div', 'hud-label small', right, t('hud.scan'))
  const scanBar = el('div', 'hud-bar thin scan', right)
  const scanFill = el('div', 'hud-bar-fill', scanBar)

  // center bottom: the trace meter while scanning; the traced banner
  const trace = el('div', 'hud-trace', hud)
  const traceLabel = el('div', 'hud-trace-label', trace, t('hud.trace'))
  const traceBar = el('div', 'hud-trace-bar', trace)
  const traceFill = el('div', 'hud-trace-fill', traceBar)
  const traceMark = el('div', 'hud-trace-mark', traceBar)
  const tracedBanner = el('div', 'hud-traced', hud, t('hud.traced'))
  let tracedTimer: ReturnType<typeof setTimeout> | null = null

  // center: the suspicion marks around the crosshair (an arc of MARK_ARC at MARK_R px, an arrow tip outside it)
  const SVG = 'http://www.w3.org/2000/svg'
  const svgEl = (tag: string, cls: string, parent: Element): SVGElement => {
    const e = document.createElementNS(SVG, tag) as SVGElement
    e.setAttribute('class', cls)
    parent.appendChild(e)
    return e
  }
  const marksSvg = svgEl('svg', 'hud-marks', hud)
  marksSvg.setAttribute('viewBox', '-180 -180 360 360')
  const MARK_R = 150
  const MARK_ARC = 0.2 // radians each side of the middle
  const ax = (MARK_R * Math.sin(MARK_ARC)).toFixed(1)
  const ay = (-MARK_R * Math.cos(MARK_ARC)).toFixed(1)
  const arc = `M -${ax} ${ay} A ${MARK_R} ${MARK_R} 0 0 1 ${ax} ${ay}`
  const tip = `M -9 ${-MARK_R - 9} L 0 ${-MARK_R - 21} L 9 ${-MARK_R - 9} Z`
  const marks: { g: SVGElement; fill: SVGElement; angle: number; level: number; cls: string }[] = []
  for (let i = 0; i < MAX_MARKS; i++) {
    const g = svgEl('g', 'hud-mark', marksSvg)
    svgEl('path', 'hud-mark-track', g).setAttribute('d', arc)
    const fill = svgEl('path', 'hud-mark-fill', g)
    fill.setAttribute('d', arc)
    fill.setAttribute('pathLength', '1')
    svgEl('path', 'hud-mark-tip', g).setAttribute('d', tip)
    marks.push({ g, fill, angle: NaN, level: -1, cls: '' })
  }

  // hit cues: a red flash at the edges, pooled direction arcs
  const flash = el('div', 'hud-flash', hud)
  const hitArcs: HTMLElement[] = []
  for (let i = 0; i < 4; i++) {
    const h = el('div', 'hud-hit', hud)
    el('div', 'hud-hit-arc', h)
    hitArcs.push(h)
  }
  let nextHit = 0
  let hpHitTimer: ReturnType<typeof setTimeout> | null = null

  // center: crosshair + prompt; the aim crosshair (four ticks closing in, a red dot) while aiming
  const aimCross = el('div', 'hud-aim', hud)
  const aimTicks = ['u', 'd', 'l', 'r'].map((c) => el('i', c, aimCross))
  el('b', '', aimCross)
  let lastAim = -1
  const cross = el('div', 'hud-cross', hud)
  const prompt = el('div', 'hud-prompt', hud)
  const toastBox = el('div', 'hud-toasts', hud)
  const hintBox = el('div', 'hud-hint', hud)

  // screens
  const screens = el('div', 'screens', root)
  const hackRoot = el('div', 'hack-root', root)
  let hackEscEl: HTMLElement | null = null
  let hackEscTimer: ReturnType<typeof setTimeout> | null = null

  let last = {
    hp: -1,
    dash: -1,
    mode: '',
    charges: -1,
    alarm: -1,
    decay: -1,
    status: '',
    sus: -1,
    scan: -1,
    trace: -1,
    prompt: '',
    wave: -1,
    crouched: false,
  }

  let hintText = ''

  function screen(cls: string): HTMLElement {
    screens.replaceChildren()
    screens.className = 'screens on'
    return el('div', `screen ${cls}`, screens)
  }

  /** The settings button of a screen; it swaps the screen for the settings panel, and Back brings the screen back. */
  function settingsButton(parent: HTMLElement, cls: string, rebuild: () => void): void {
    if (!settings) return
    const b = el('button', 'btn', parent, t('settings.open'))
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      const s = screen(`${cls} settings-view`)
      el('h2', '', s, t('settings.title'))
      buildSettingsPanel(s, settings)
      const back = el('button', 'btn', s, t('settings.back'))
      back.addEventListener('click', (ev) => {
        ev.stopPropagation()
        rebuild()
      })
    })
  }

  /** The Tips button of the pause screen: the cards seen so far, each re-opens; Back returns to the screen. */
  function tipsButton(parent: HTMLElement, cls: string, rebuild: () => void): void {
    if (!tips) return
    const b = el('button', 'btn', parent, t('tips.open'))
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      const list = (): void => {
        const s = screen(`${cls} tips-view`)
        el('h2', '', s, t('tips.title'))
        const box = el('div', 'tips-list', s)
        const seen = tips.seen()
        if (seen.length === 0) el('p', 'note', box, t('tips.empty'))
        for (const id of seen) {
          const c = el('button', 'btn', box, texts[`card.${id}.title` as keyof typeof texts] as string)
          c.addEventListener('click', (ev) => {
            ev.stopPropagation()
            api.showCard(cardSpec(id), true, list)
          })
        }
        const back = el('button', 'btn', s, t('settings.back'))
        back.addEventListener('click', (ev) => {
          ev.stopPropagation()
          rebuild()
        })
      }
      list()
    })
  }

  function controlsList(parent: HTMLElement): void {
    const list = el('div', 'controls', parent)
    for (const [k, v] of texts.controls) {
      const row = el('div', 'controls-row', list)
      el('span', 'key', row, k)
      el('span', 'what', row, v)
    }
  }

  const api: Hud = {
    hackRoot,
    update(h: HudState): void {
      const hp = Math.round(h.hp * 100)
      if (hp !== last.hp) {
        hpFill.style.width = `${hp}%`
        hpBar.classList.toggle('low', hp <= 30)
        last.hp = hp
      }
      const dash = Math.round(h.dash * 20)
      if (dash !== last.dash) {
        dashFill.style.width = `${dash * 5}%`
        last.dash = dash
      }
      if (h.mode !== last.mode) {
        swordTag.classList.toggle('on', h.mode === 'sword')
        rifleTag.classList.toggle('on', h.mode === 'rifle')
        cross.className = `hud-cross ${h.mode}`
        last.mode = h.mode
      }
      if (h.charges !== last.charges) {
        charges.textContent = `${h.charges} ${t('hud.charges')}`
        charges.classList.toggle('empty', h.charges === 0)
        last.charges = h.charges
      }
      if (h.alarm !== last.alarm) {
        for (let i = 0; i < 3; i++) (pips[i] as HTMLElement).classList.toggle('on', i < h.alarm)
        top.className = `hud-top alarm${h.alarm}`
        last.alarm = h.alarm
      }
      const dec = Math.round(h.alarmDecay * 50)
      if (dec !== last.decay) {
        decayFill.style.width = `${dec * 2}%`
        decay.style.visibility = h.alarm === 1 || h.alarm === 2 ? 'visible' : 'hidden'
        last.decay = dec
      }
      const st = h.niche && h.status !== 'detected' ? 'niche' : h.status
      if (st !== last.status) {
        status.textContent = st === 'niche' ? t('hud.niche') : t(`hud.${h.status}`)
        status.className = `hud-status ${st}`
        last.status = st
      }
      const sus = Math.round(h.suspicion * 25)
      if (sus !== last.sus) {
        susFill.style.width = `${sus * 4}%`
        susBar.style.visibility = sus > 0 && h.status !== 'detected' ? 'visible' : 'hidden'
        last.sus = sus
      }
      const scanKey = (h.scanActive ? 10000 : 0) + Math.round(h.scanHeat * 50) * 100 + Math.round(h.scanCooldown * 50)
      if (scanKey !== last.scan) {
        const v = h.scanActive ? h.scanHeat : 1 - h.scanCooldown
        scanFill.style.width = `${Math.round(v * 100)}%`
        scanBar.classList.toggle('active', h.scanActive)
        scanBar.classList.toggle('hot', h.scanActive && h.scanHeat > 0.55)
        scanBar.classList.toggle('cool', !h.scanActive && h.scanCooldown > 0)
        last.scan = scanKey
      }
      const warnAt = h.scanWarnAt ?? 0.7
      const risk = h.scanActive && (h.scanWarning === true || h.scanHeat >= warnAt)
      const traceKey = h.scanActive ? 1 + Math.round(h.scanHeat * 100) * 10 + (risk ? 5 : 0) + Math.round(warnAt * 100) * 10000 : 0
      if (traceKey !== last.trace) {
        trace.classList.toggle('on', h.scanActive)
        trace.classList.toggle('risk', risk)
        traceLabel.textContent = risk ? t('hud.traceRisk') : t('hud.trace')
        traceFill.style.width = `${Math.round(h.scanHeat * 100)}%`
        traceMark.style.left = `${Math.round(warnAt * 100)}%`
        last.trace = traceKey
      }
      if (h.prompt !== last.prompt) {
        renderKeys(prompt, h.prompt === 'terminal' ? t('prompt.terminal') : h.prompt === 'artifact' ? t('prompt.artifact') : '')
        prompt.classList.toggle('on', h.prompt !== 'none')
        last.prompt = h.prompt
      }
      const waveKey = h.alarm < 3 ? 0 : 1 + h.wave * 1000 + h.wavesCleared * 10 + (h.firewallDown ? 1 : 0)
      if (waveKey !== last.wave) {
        wave.textContent =
          h.alarm < 3
            ? ''
            : `${h.wave > 0 ? t('hud.wave', { wave: h.wave }) + '  -  ' : ''}${h.firewallDown ? t('hud.firewallDown') : t('hud.firewall', { cleared: h.wavesCleared, needed: h.wavesNeeded })}`
        last.wave = waveKey
      }
      const aimK = Math.round((h.aim ?? 0) * 20) / 20
      if (aimK !== lastAim) {
        lastAim = aimK
        aimCross.style.opacity = String(aimK)
        cross.style.opacity = String(1 - aimK)
        const gap = Math.round(22 - 13 * aimK)
        const [u, d, l, r] = aimTicks as [HTMLElement, HTMLElement, HTMLElement, HTMLElement]
        u.style.top = `${-gap - 9}px`
        d.style.top = `${gap}px`
        l.style.left = `${-gap - 9}px`
        r.style.left = `${gap}px`
      }
      if (h.crouched !== last.crouched) {
        cross.classList.toggle('crouched', h.crouched)
        last.crouched = h.crouched
      }
      for (let i = 0; i < MAX_MARKS; i++) {
        const m = marks[i] as (typeof marks)[number]
        const src = i < h.markCount ? h.marks[i] : undefined
        const cls = src ? (src.spotted ? 'hud-mark on spotted' : 'hud-mark on') : 'hud-mark'
        if (cls !== m.cls) {
          m.g.setAttribute('class', cls)
          m.cls = cls
        }
        if (!src) continue
        const deg = Math.round((src.angle * 180) / Math.PI)
        if (deg !== m.angle) {
          m.g.setAttribute('transform', `rotate(${deg})`)
          m.angle = deg
        }
        const lv = Math.round(Math.max(0.08, src.level) * 40) / 40
        if (lv !== m.level) {
          // fills from the middle out
          m.fill.setAttribute('stroke-dasharray', `${lv} 1`)
          m.fill.setAttribute('stroke-dashoffset', `${-(1 - lv) / 2}`)
          m.level = lv
        }
      }
    },
    toast(text: string, kind: 'info' | 'alarm' | 'good' = 'info'): void {
      const e = el('div', `toast ${kind}`, toastBox, text)
      while (toastBox.children.length > 3) toastBox.firstElementChild?.remove()
      setTimeout(() => e.classList.add('out'), toastSec * 1000)
      setTimeout(() => e.remove(), toastSec * 1000 + 600)
    },
    hint(spec: PromptSpec | null): void {
      if (spec !== null) {
        const key = `${spec.speaker ?? ''}|${spec.text}`
        if (key !== hintText) {
          renderKeys(hintBox, spec.text)
          if (spec.speaker) {
            const who = document.createElement('span')
            who.className = 'who'
            who.textContent = SPEAKER_NAME[spec.speaker]
            hintBox.prepend(who)
          }
          hintBox.className = `hud-hint${spec.speaker ? ` by-${spec.speaker}` : ''} on`
          hintText = key
        }
        hintBox.classList.add('on')
      } else hintBox.classList.remove('on')
    },
    showCard(spec: CardSpec, back: boolean, onContinue: () => void): void {
      const s = screen('card')
      const sc = settings?.values.hudScale ?? 100
      s.style.setProperty('zoom', String(sc / 100))
      if (spec.speaker) s.classList.add(`by-${spec.speaker}`)
      if (spec.speaker) el('div', 'who', s, SPEAKER_NAME[spec.speaker])
      el('h2', '', s, spec.title)
      for (const line of spec.lines) renderKeys(el('p', '', s), line)
      renderKeys(el('div', 'go', s), t(back ? 'card.back' : 'card.continue'))
      let done = false
      const finish = (): void => {
        if (done) return
        done = true
        document.removeEventListener('keydown', onKey, true)
        onContinue()
      }
      const onKey = (e: KeyboardEvent): void => {
        if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return
        e.preventDefault()
        e.stopPropagation()
        if (!e.repeat) finish()
      }
      document.addEventListener('keydown', onKey, true)
      s.addEventListener('click', (e) => {
        e.stopPropagation()
        finish()
      })
    },
    hit(angle: number, strength: number): void {
      flash.classList.remove('on')
      void flash.offsetWidth
      flash.style.filter = `opacity(${Math.round(Math.min(1, 0.45 + strength * 0.55) * 100)}%)`
      flash.classList.add('on')
      const a = hitArcs[nextHit] as HTMLElement
      nextHit = (nextHit + 1) % hitArcs.length
      a.classList.remove('on')
      a.style.transform = `rotate(${Math.round((angle * 180) / Math.PI)}deg)`
      void a.offsetWidth
      a.classList.add('on')
      hpBar.classList.add('hit')
      if (hpHitTimer) clearTimeout(hpHitTimer)
      hpHitTimer = setTimeout(() => hpBar.classList.remove('hit'), 140)
    },
    traced(): void {
      tracedBanner.classList.remove('on')
      void tracedBanner.offsetWidth
      tracedBanner.classList.add('on')
      if (tracedTimer) clearTimeout(tracedTimer)
      tracedTimer = setTimeout(() => tracedBanner.classList.remove('on'), 3200)
    },
    setVisible(on: boolean): void {
      hud.style.display = on ? '' : 'none'
    },
    showStart(onStart: () => void): void {
      let started = false
      const build = (): void => {
        const s = screen('start')
        el('h1', '', s, t('title'))
        el('p', 'tagline', s, t('start.tagline'))
        el('div', 'go', s, t('start.click'))
        settingsButton(s, 'start', build)
        controlsList(s)
        el('p', 'note', s, t('routes'))
        el('p', 'note', s, t('start.note'))
        s.addEventListener('click', (e) => {
          // the settings button and panel are not "click to start"
          if (started || (e.target instanceof Element && e.target.closest('.settings, .btn'))) return
          started = true
          onStart()
        })
      }
      build()
    },
    showPause(on: boolean): void {
      if (!on) {
        if (screens.querySelector('.pause')) this.hideScreens()
        return
      }
      const build = (): void => {
        const s = screen('pause')
        el('h2', '', s, t('pause.title'))
        el('div', 'go', s, t('pause.click'))
        settingsButton(s, 'pause', build)
        tipsButton(s, 'pause', build)
        controlsList(s)
      }
      build()
    },
    showResume(on: boolean): void {
      if (!on) {
        if (screens.querySelector('.resume')) this.hideScreens()
        return
      }
      const s = screen('resume')
      el('div', 'go', s, t('resume.afterHack'))
    },
    showDead(hasSave: boolean, onLoad: () => void, onRestart: () => void): void {
      const s = screen('dead')
      el('h2', '', s, t('dead.title'))
      el('p', '', s, t('dead.text'))
      const row = el('div', 'buttons', s)
      const load = el('button', 'btn', row, t('dead.load'))
      const restart = el('button', 'btn', row, t('dead.restart'))
      if (!hasSave) el('p', 'note', s, t('dead.noSave'))
      load.addEventListener('click', onLoad, { once: true })
      restart.addEventListener('click', onRestart, { once: true })
    },
    showWon(stats: string, ending: string, onAgain: () => void): void {
      const s = screen('won')
      el('h2', '', s, t('won.title'))
      el('p', '', s, stats)
      el('p', 'note', s, ending)
      const again = el('button', 'btn', s, t('won.again'))
      again.addEventListener('click', onAgain, { once: true })
    },
    hideScreens(): void {
      screens.replaceChildren()
      screens.className = 'screens'
    },
    setScale(pct: number): void {
      hud.style.setProperty('zoom', String(pct / 100))
    },
    reduceFlash(on: boolean): void {
      hud.classList.toggle('reduce-fx', on)
    },
    hackEsc(on: boolean): void {
      if (hackEscTimer) clearTimeout(hackEscTimer)
      hackEscTimer = null
      if (!on) {
        hackEscEl?.remove()
        hackEscEl = null
        return
      }
      if (!hackEscEl) hackEscEl = el('div', 'hack-esc', hackRoot, t('hack.escAgain'))
      hackEscTimer = setTimeout(() => {
        hackEscEl?.remove()
        hackEscEl = null
      }, 2000)
    },
  }
  return api
}
