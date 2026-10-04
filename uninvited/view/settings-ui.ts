// The settings panel (DOM): sliders for Master / Music / SFX volume and mouse sensitivity, checkboxes for invert Y and
// reduced shake/flash, buttons for the HUD size. Used inside the start and pause screens. Every change goes straight to
// the SettingsHandle (which saves and applies it).
import texts from '../texts/en.json'
import { HUD_SCALES, SENS_MAX, SENS_MIN, type SettingsHandle } from './settings'

export const SETTINGS_CSS = `
.settings { display: grid; grid-template-columns: auto 200px 52px; gap: 10px 18px; align-items: center; text-align: left;
  width: fit-content; font-size: 13px; margin: 14px auto 18px; cursor: default; }
.settings label { color: var(--cyan); letter-spacing: 2px; }
.settings .val { text-align: right; opacity: 0.85; }
.settings input[type=range] { width: 200px; accent-color: #6ff4ff; }
.settings input[type=checkbox] { width: 18px; height: 18px; accent-color: #6ff4ff; justify-self: start; }
.settings .sizes { grid-column: 2 / 4; display: flex; gap: 8px; }
.settings .sizes button { font: inherit; padding: 4px 10px; color: var(--cyan); background: rgba(0, 10, 16, 0.6);
  border: 1px solid rgba(111, 244, 255, 0.4); cursor: pointer; }
.settings .sizes button.on { background: rgba(40, 200, 255, 0.28); color: #fff; }
.settings .note { grid-column: 1 / 4; opacity: 0.55; font-size: 11px; }
.reduce-fx .hud-flash { display: none; }
`

type SliderKey = 'master' | 'music' | 'sfx' | 'sensitivity'

export function buildSettingsPanel(parent: HTMLElement, settings: SettingsHandle): void {
  const root = document.createElement('div')
  root.className = 'settings'
  parent.appendChild(root)
  const v = settings.values

  function row(label: string): HTMLLabelElement {
    const l = document.createElement('label')
    l.textContent = label
    root.appendChild(l)
    return l
  }

  function slider(key: SliderKey, label: string, min: number, max: number, step: number, show: (x: number) => string): void {
    const l = row(label)
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.value = String(v[key])
    input.id = `set-${key}`
    l.htmlFor = input.id
    const out = document.createElement('span')
    out.className = 'val'
    out.textContent = show(v[key])
    input.addEventListener('input', () => {
      const x = Number(input.value)
      settings.set(key, x)
      out.textContent = show(x)
    })
    root.append(input, out)
  }

  function check(key: 'invertY' | 'reduceFx', label: string): void {
    const l = row(label)
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = v[key]
    input.id = `set-${key}`
    l.htmlFor = input.id
    input.addEventListener('change', () => settings.set(key, input.checked))
    const filler = document.createElement('span')
    root.append(input, filler)
  }

  const pct = (x: number): string => `${Math.round(x * 100)}%`
  slider('master', texts['settings.master'], 0, 1, 0.05, pct)
  slider('music', texts['settings.music'], 0, 1, 0.05, pct)
  slider('sfx', texts['settings.sfx'], 0, 1, 0.05, pct)
  slider('sensitivity', texts['settings.sensitivity'], SENS_MIN, SENS_MAX, 0.05, (x) => `${x.toFixed(2)}x`)
  check('invertY', texts['settings.invertY'])
  check('reduceFx', texts['settings.reduceFx'])
  row(texts['settings.hudSize'])
  const sizes = document.createElement('div')
  sizes.className = 'sizes'
  const buttons: HTMLButtonElement[] = []
  for (const pctSize of HUD_SCALES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `${pctSize}%`
    b.classList.toggle('on', v.hudScale === pctSize)
    b.addEventListener('click', () => {
      settings.set('hudScale', pctSize)
      for (const o of buttons) o.classList.toggle('on', o === b)
    })
    buttons.push(b)
    sizes.appendChild(b)
  }
  root.appendChild(sizes)
  const note = document.createElement('div')
  note.className = 'note'
  note.textContent = texts['settings.note']
  root.appendChild(note)
}
