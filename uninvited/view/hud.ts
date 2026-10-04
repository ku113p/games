// The HUD and the screens (DOM over the canvas): HP, the gun's cylinder and reserve, the circular-strike cooldown, the aim
// crosshair, the interact prompt, toasts and hints; start / pause / death / win screens. WP0 stub: WP6 builds the hunter-style
// HUD of PLAN 4.6 (revolver cylinder, reload ring, threat arcs) on this interface.
// Every text comes from texts/en.json. Per-frame updates write only when a value changed.
import texts from '../texts/en.json'
import type { SettingsHandle } from './settings'
import { buildSettingsPanel, SETTINGS_CSS } from './settings-ui'
import { TIPS_CFG, type CardId, type Tips } from './tips'
import { createHitMarks, type HitMarks } from './hitmarks'

type TextKey = Exclude<keyof typeof texts, 'controls'>

export function t(key: TextKey, vars?: Record<string, string | number>): string {
  let s = texts[key] as string
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

/** A contextual prompt: `text` may hold {Key} markup. */
export interface PromptSpec {
  id: string
  text: string
}

/** A tutorial card: a title and up to three lines with {Key} markup. */
export interface CardSpec {
  id: string
  title: string
  lines: readonly string[]
}

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

/** What the HUD shows (PLAN 4.6, trimmed: WP6 adds the stage name, threat arcs, the crank progress and the death percentage). */
export interface HudState {
  /** 0..1. */
  hp: number
  gunLoaded: number
  gunMag: number
  gunReserve: number
  /** 0..1 reload progress, 0 when not reloading. */
  reloading: number
  /** 0..1: 1 = the circular strike is ready. */
  strike: number
  /** 0..1 how far into the aim (RMB): the aim crosshair closes in. */
  aim: number
  prompt: 'none' | 'crank' | 'letter' | 'medkitFull'
}

export interface Hud {
  /** The hit / kill / block markers and the crosshair bloom (view/hitmarks.ts), driven by the game view. */
  readonly marks: HitMarks
  update(h: HudState): void
  toast(text: string, kind?: 'info' | 'alarm' | 'good'): void
  /** The contextual prompt (non-blocking, big, with keycaps): the text, or null to fade it out. It has no timer. */
  hint(spec: PromptSpec | null): void
  /** A tutorial card (the caller pauses the game). Enter or a click calls onContinue once. back: the footer says "go back". */
  showCard(spec: CardSpec, back: boolean, onContinue: () => void): void
  setVisible(on: boolean): void
  /** You got hit: a red flash at the screen edges and a red arc pointing where it came from (clockwise from up, radians). */
  hit(angle: number, strength: number): void
  showStart(onStart: () => void): void
  showPause(on: boolean): void
  showResume(on: boolean): void
  /** The stage was lost: "Again" (the stage restarts by itself after the death cam; a click skips the wait). */
  showDead(onRestart: () => void): void
  showWon(stats: string, ending: string, onAgain: () => void, buttonKey?: 'won.again' | 'won.continue'): void
  /** The level title banner (3 s, non-blocking): the name and a one-line goal. */
  banner(title: string, goal: string, sec: number): void
  /** The bottom column (the hint and the interact prompt): they cannot collide. */
  stack: HTMLElement
  hideScreens(): void
  /** HUD size in percent (100, 125, 150). */
  setScale(pct: number): void
  /** Reduced flashing: no full-screen hit flash (the direction arc stays). */
  reduceFlash(on: boolean): void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (text !== undefined) e.textContent = text
  parent.appendChild(e)
  return e
}

/** The banner and the reduced-flash rule. */
const BANNER_CSS = `
.hud-banner { position: absolute; left: 0; right: 0; top: 24%; text-align: center; opacity: 0; pointer-events: none; }
.hud-banner.on { animation: hudBanner var(--banner-sec, 3s) ease-in-out 1 forwards; }
.hud-banner h3 { margin: 0; font-weight: 300; font-size: clamp(28px, 5vh, 64px); letter-spacing: 0.3em; text-transform: uppercase; color: var(--white); text-shadow: 0 0 22px var(--cyan), 0 2px 8px #000; }
.hud-banner p { margin: 0.6em 0 0; font-size: clamp(16px, 2.4vh, 30px); letter-spacing: 0.08em; color: #bff7ff; text-shadow: 0 2px 8px #000; }
@keyframes hudBanner { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
`

/** The contextual prompt, the interact prompt, keycaps and the tutorial card. Font: about 2.6 % of the screen height, the card body 2.8 % (the HUD size multiplies it). */
const TIPS_CSS = `
.hud-stack { position: absolute; left: 0; right: 0; bottom: 6vh; z-index: 40; display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.hud-hint, .hud-prompt { max-width: 88%; box-sizing: border-box; text-align: center;
  font-size: clamp(18px, 2.6vh, 34px); line-height: 1.35; padding: 0.35em 0.9em; color: var(--white); letter-spacing: 0.02em;
  background: rgba(0, 8, 14, 0.88); border: 1px solid rgba(111, 244, 255, 0.55); border-left: 0.2em solid var(--amber);
  box-shadow: 0 0 22px rgba(0, 0, 0, 0.7); opacity: 0; pointer-events: none; }
.hud-hint { position: static; order: 3; display: none; width: max-content; max-width: calc(44vw / var(--zoom, 1)); }
.hud-hint.on { display: block; animation: hintIn ${TIPS_CFG.promptFadeSec}s ease-out 1; opacity: 1; }
@keyframes hintIn { from { opacity: 0; } to { opacity: 1; } }
/* the interact prompt is the top of the bottom column, far from the crosshair ring */
.hud-prompt { position: static; order: 0; display: none; width: max-content; max-width: calc(44vw / var(--zoom, 1)); border-left-color: var(--cyan); }
.hud-prompt.on { display: block; opacity: 1; }
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
  css.textContent = BANNER_CSS + AIM_HIT_CSS + SETTINGS_CSS + TIPS_CSS
  document.head.appendChild(css)
  const hud = el('div', 'hud', root)
  const stack = el('div', 'hud-stack', root)

  // bottom left: HP
  const left = el('div', 'hud-left', hud)
  el('div', 'hud-label', left, t('hud.hp'))
  const hpBar = el('div', 'hud-bar', left)
  const hpFill = el('div', 'hud-bar-fill', hpBar)

  // bottom right: the gun (cylinder / reserve, reload) and the circular strike
  const right = el('div', 'hud-right', hud)
  const ammo = el('div', 'hud-charges', right)
  el('div', 'hud-label small', right, t('hud.strike'))
  const strikeBar = el('div', 'hud-bar thin', right)
  const strikeFill = el('div', 'hud-bar-fill', strikeBar)

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
  const hitMarks = createHitMarks(hud, [cross, aimCross])
  const prompt = el('div', 'hud-prompt', stack)
  prompt.style.setProperty('zoom', String((settings?.values.hudScale ?? 100) / 100))
  const toastBox = el('div', 'hud-toasts', hud)
  const hintBox = el('div', 'hud-hint', stack)
  hintBox.style.setProperty('zoom', String((settings?.values.hudScale ?? 100) / 100))
  stack.style.setProperty('--zoom', String((settings?.values.hudScale ?? 100) / 100))
  const banner = el('div', 'hud-banner', hud)

  // screens
  const screens = el('div', 'screens', root)

  const last = { hp: -1, ammo: '', strike: -1, prompt: '' }
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
    marks: hitMarks,
    stack,
    update(h: HudState): void {
      const hp = Math.round(h.hp * 100)
      if (hp !== last.hp) {
        hpFill.style.width = `${hp}%`
        hpBar.classList.toggle('low', hp <= 30)
        last.hp = hp
      }
      const a = `${h.gunLoaded}/${h.gunMag}|${h.gunReserve}|${Math.round(h.reloading * 10)}`
      if (a !== last.ammo) {
        ammo.textContent = h.reloading > 0 ? t('hud.reloading') : `${h.gunLoaded} / ${h.gunMag}  +${h.gunReserve}`
        ammo.classList.toggle('empty', h.gunLoaded === 0 && h.gunReserve === 0)
        last.ammo = a
      }
      const st = Math.round(h.strike * 20)
      if (st !== last.strike) {
        strikeFill.style.width = `${st * 5}%`
        strikeBar.classList.toggle('cool', h.strike < 1)
        last.strike = st
      }
      if (h.prompt !== last.prompt) {
        renderKeys(prompt, h.prompt === 'crank' ? t('prompt.crank') : h.prompt === 'letter' ? t('prompt.letter') : h.prompt === 'medkitFull' ? t('prompt.medkitFull') : '')
        prompt.classList.toggle('on', h.prompt !== 'none')
        last.prompt = h.prompt
      }
      const aimK = Math.round(h.aim * 20) / 20
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
    },
    toast(text: string, kind: 'info' | 'alarm' | 'good' = 'info'): void {
      const e = el('div', `toast ${kind}`, toastBox, text)
      while (toastBox.children.length > 3) toastBox.firstElementChild?.remove()
      setTimeout(() => e.classList.add('out'), toastSec * 1000)
      setTimeout(() => e.remove(), toastSec * 1000 + 600)
    },
    hint(spec: PromptSpec | null): void {
      if (spec !== null) {
        const key = spec.text
        if (key !== hintText) {
          renderKeys(hintBox, spec.text)
          hintBox.className = 'hud-hint on'
          hintText = key
        }
        hintBox.classList.add('on')
      } else hintBox.classList.remove('on')
    },
    showCard(spec: CardSpec, back: boolean, onContinue: () => void): void {
      const s = screen('card')
      const sc = settings?.values.hudScale ?? 100
      s.style.setProperty('zoom', String(sc / 100))
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
      el('div', 'go', s, t('resume.click'))
    },
    showDead(onRestart: () => void): void {
      const s = screen('dead')
      el('h2', '', s, t('dead.title'))
      el('p', '', s, t('dead.text'))
      const again = el('button', 'btn', s, t('dead.again'))
      again.addEventListener('click', onRestart, { once: true })
    },
    banner(title: string, goal: string, sec: number): void {
      banner.replaceChildren()
      el('h3', '', banner, title)
      if (goal) el('p', '', banner, goal)
      banner.style.setProperty('--banner-sec', `${sec}s`)
      banner.classList.remove('on')
      void banner.offsetWidth
      banner.classList.add('on')
    },
    showWon(stats: string, ending: string, onAgain: () => void, buttonKey: 'won.again' | 'won.continue' = 'won.again'): void {
      const s = screen('won')
      el('h2', '', s, t('won.title'))
      el('p', '', s, stats)
      if (ending) el('p', 'note', s, ending)
      const again = el('button', 'btn', s, t(buttonKey))
      again.addEventListener('click', onAgain, { once: true })
    },
    hideScreens(): void {
      screens.replaceChildren()
      screens.className = 'screens'
    },
    setScale(pct: number): void {
      hud.style.setProperty('zoom', String(pct / 100))
      hintBox.style.setProperty('zoom', String(pct / 100))
      prompt.style.setProperty('zoom', String(pct / 100))
      stack.style.setProperty('--zoom', String(pct / 100))
    },
    reduceFlash(on: boolean): void {
      hud.classList.toggle('reduce-fx', on)
    },
  }
  return api
}
