// The HUD and the screens (DOM over the canvas): HP, dash, charges and weapon mode, alarm level, security status,
// network-vision heat and cooldown, the interact prompt, toasts and hints; start / pause / death / win screens.
// Every text comes from texts/en.json. Per-frame updates write only when a value changed.
import texts from '../texts/en.json'

type TextKey = Exclude<keyof typeof texts, 'controls'>

export function t(key: TextKey, vars?: Record<string, string | number>): string {
  let s = texts[key] as string
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

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
}

export interface Hud {
  update(h: HudState): void
  toast(text: string, kind?: 'info' | 'alarm' | 'good'): void
  hint(text: string): void
  setVisible(on: boolean): void
  /** Network vision held too long: the security is called - a clear banner. */
  traced(): void
  showStart(onStart: () => void): void
  showPause(on: boolean): void
  showResume(on: boolean): void
  showDead(hasSave: boolean, onLoad: () => void, onRestart: () => void): void
  showWon(stats: string, ending: string, onAgain: () => void): void
  hideScreens(): void
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
.hud-traced { position: absolute; left: 0; right: 0; top: 34%; text-align: center; font-size: 26px; letter-spacing: 0.32em;
  color: #ff4a3a; text-shadow: 0 0 14px #ff2010; opacity: 0; pointer-events: none; transition: opacity 0.25s; }
.hud-traced.on { opacity: 1; animation: traceRisk 0.3s steps(2, start) 4; }
`

export function createHud(root: HTMLElement, toastSec: number, hintSec: number): Hud {
  const css = document.createElement('style')
  css.textContent = TRACE_CSS
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

  // center: crosshair + prompt
  const cross = el('div', 'hud-cross', hud)
  const prompt = el('div', 'hud-prompt', hud)
  const toastBox = el('div', 'hud-toasts', hud)
  const hintBox = el('div', 'hud-hint', hud)

  // screens
  const screens = el('div', 'screens', root)
  const hackRoot = el('div', 'hack-root', root)

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

  let hintTimer: ReturnType<typeof setTimeout> | null = null

  function screen(cls: string): HTMLElement {
    screens.replaceChildren()
    screens.className = 'screens on'
    return el('div', `screen ${cls}`, screens)
  }

  function controlsList(parent: HTMLElement): void {
    const list = el('div', 'controls', parent)
    for (const [k, v] of texts.controls) {
      const row = el('div', 'controls-row', list)
      el('span', 'key', row, k)
      el('span', 'what', row, v)
    }
  }

  return {
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
        prompt.textContent = h.prompt === 'terminal' ? t('prompt.terminal') : h.prompt === 'artifact' ? t('prompt.artifact') : ''
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
      if (h.crouched !== last.crouched) {
        cross.classList.toggle('crouched', h.crouched)
        last.crouched = h.crouched
      }
    },
    toast(text: string, kind: 'info' | 'alarm' | 'good' = 'info'): void {
      const e = el('div', `toast ${kind}`, toastBox, text)
      while (toastBox.children.length > 3) toastBox.firstElementChild?.remove()
      setTimeout(() => e.classList.add('out'), toastSec * 1000)
      setTimeout(() => e.remove(), toastSec * 1000 + 600)
    },
    hint(text: string): void {
      hintBox.textContent = text
      hintBox.classList.add('on')
      if (hintTimer) clearTimeout(hintTimer)
      hintTimer = setTimeout(() => hintBox.classList.remove('on'), hintSec * 1000)
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
      const s = screen('start')
      el('h1', '', s, t('title'))
      el('p', 'tagline', s, t('start.tagline'))
      el('div', 'go', s, t('start.click'))
      controlsList(s)
      el('p', 'note', s, t('routes'))
      el('p', 'note', s, t('start.note'))
      s.addEventListener('click', onStart, { once: true })
    },
    showPause(on: boolean): void {
      if (!on) {
        if (screens.querySelector('.pause')) this.hideScreens()
        return
      }
      const s = screen('pause')
      el('h2', '', s, t('pause.title'))
      el('div', 'go', s, t('pause.click'))
      controlsList(s)
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
  }
}
