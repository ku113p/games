// The title screen (DESIGN 12 "as built"): the title over the key art (KA3), no HUD behind it. Start, Continue (when a scene is saved),
// Controls, Settings, Fullscreen; a note while the audio is still locked (a browser unlocks it on the first click).
import texts from '../texts/en.json'
import { buildSettingsPanel } from './settings-ui'
import type { SettingsHandle } from './settings'
import { STORY_ART } from './story-art'

const CSS = `
.title { position: fixed; inset: 0; z-index: 150; background: #000; pointer-events: auto; overflow: hidden; display: none; }
.title.on { display: block; }
.title-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation: titleDrift 40s ease-in-out infinite alternate; }
@keyframes titleDrift { from { transform: scale(1.02); } to { transform: scale(1.1) translateX(-1.5%); } }
.title-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0, 4, 8, 0.92) 0%, rgba(0, 4, 8, 0.7) 32%, rgba(0, 4, 8, 0) 62%), linear-gradient(0deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0) 30%); }
.title-col { position: absolute; left: 6vw; top: 0; bottom: 0; width: min(44vw, 640px); display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 1.2vh; }
.title-col h1 { margin: 0; font-weight: 300; font-size: clamp(40px, 9vh, 110px); letter-spacing: 0.2em; line-height: 1; color: var(--white); text-shadow: 0 0 28px var(--cyan); }
.title-col .tag { margin: 0 0 3vh; font-size: clamp(14px, 2.1vh, 26px); line-height: 1.4; color: rgba(230, 248, 255, 0.85); max-width: 28em; }
.title-col .btn { margin: 0; min-width: 14em; text-align: left; font-size: clamp(15px, 2.4vh, 30px); padding: 0.5em 1.2em; }
.title-col .btn.primary { background: rgba(40, 200, 255, 0.2); color: #fff; }
.title-col .note { margin-top: 3vh; font-size: clamp(12px, 1.6vh, 18px); color: rgba(220, 245, 255, 0.65); }
.title-col .snd { color: var(--amber); min-height: 1.4em; }
.title-col .settings, .title-col .controls { margin: 1vh 0; }
.title-col .controls { font-size: clamp(12px, 1.7vh, 20px); }
`

export interface TitleOpts {
  hasContinue: boolean
  /** Any click on the screen (the first one unlocks the audio). */
  onAnyClick?(): void
  onStart(): void
  onContinue(): void
}

export interface Title {
  show(o: TitleOpts): void
  hide(): void
  readonly active: boolean
  /** The audio has been unlocked (hides the note). */
  setSoundOn(on: boolean): void
}

export function createTitle(parent: HTMLElement, settings: SettingsHandle | undefined): Title {
  const css = document.createElement('style')
  css.textContent = CSS
  document.head.appendChild(css)
  const root = document.createElement('div')
  root.className = 'title'
  const art = document.createElement('img')
  art.className = 'title-art'
  art.alt = ''
  art.src = STORY_ART['KA3-key-art.jpg'] ?? ''
  const shade = Object.assign(document.createElement('div'), { className: 'title-shade' })
  const col = Object.assign(document.createElement('div'), { className: 'title-col' })
  root.append(art, shade, col)
  parent.appendChild(root)
  root.addEventListener('click', () => opts?.onAnyClick?.())
  let inSub = false
  let soundOn = false
  let snd: HTMLElement | null = null
  let opts: TitleOpts | null = null
  let onKey: ((e: KeyboardEvent) => void) | null = null

  const button = (label: string, cls: string, fn: () => void): HTMLButtonElement => {
    const b = Object.assign(document.createElement('button'), { className: `btn ${cls}`, textContent: label })
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      fn()
    })
    col.appendChild(b)
    return b
  }
  const fsBtnLabel = (): string => (document.fullscreenElement ? texts['title.exitFullscreen'] : texts['title.fullscreen'])

  function build(): void {
    inSub = false
    col.replaceChildren()
    const o = opts as TitleOpts
    col.appendChild(Object.assign(document.createElement('h1'), { textContent: texts.title }))
    col.appendChild(Object.assign(document.createElement('p'), { className: 'tag', textContent: texts['start.tagline'] }))
    button(texts['title.start'], o.hasContinue ? '' : 'primary', o.onStart)
    if (o.hasContinue) button(texts['title.continue'], 'primary', o.onContinue)
    button(texts['title.controls'], '', () => sub('controls'))
    if (settings) button(texts['settings.open'], '', () => sub('settings'))
    if (document.documentElement.requestFullscreen) {
      const fs = button(fsBtnLabel(), '', () => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen().catch(() => undefined)
      })
      document.addEventListener('fullscreenchange', () => (fs.textContent = fsBtnLabel()))
    }
    col.appendChild(Object.assign(document.createElement('p'), { className: 'note', textContent: texts['start.note'] }))
    snd = Object.assign(document.createElement('p'), { className: 'note snd', textContent: soundOn ? '' : texts['title.soundOff'] })
    col.appendChild(snd)
  }

  function sub(kind: 'controls' | 'settings'): void {
    inSub = true
    col.replaceChildren()
    col.appendChild(Object.assign(document.createElement('h1'), { textContent: texts[kind === 'controls' ? 'controls.title' : 'settings.title'] }))
    if (kind === 'settings' && settings) buildSettingsPanel(col, settings)
    else {
      const list = Object.assign(document.createElement('div'), { className: 'controls' })
      for (const [k, v] of texts.controls) {
        const row = Object.assign(document.createElement('div'), { className: 'controls-row' })
        row.append(Object.assign(document.createElement('span'), { className: 'key', textContent: k }), Object.assign(document.createElement('span'), { className: 'what', textContent: v }))
        list.appendChild(row)
      }
      col.appendChild(list)
    }
    button(texts['title.back'], '', build)
  }

  return {
    get active(): boolean {
      return root.classList.contains('on')
    },
    show(o): void {
      opts = o
      build()
      root.classList.add('on')
      onKey = (e): void => {
        if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat && opts && !inSub) {
          e.preventDefault()
          e.stopPropagation()
          if (opts.hasContinue) opts.onContinue()
          else opts.onStart()
        }
      }
      document.addEventListener('keydown', onKey, true)
    },
    hide(): void {
      root.classList.remove('on')
      if (onKey) document.removeEventListener('keydown', onKey, true)
      onKey = null
    },
    setSoundOn(on): void {
      soundOn = on
      if (snd) snd.textContent = on ? '' : texts['title.soundOff']
    },
  }
}
