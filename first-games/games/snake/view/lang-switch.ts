// view/lang-switch.ts is a compact language switcher: a row of two-letter buttons (EN ES PT ZH RU).
// The same one on the main screen and the legal screens: a person who got the wrong language changes it in place, with one tap.
// Cold path (menu, language change). Buttons are built from LANGUAGES: a sixth language = an entry in i18n/dictionaries.ts.
// The label is the language code (a flag is not a language, and zh-Hans has none); the full name in its own language is in aria-label and title.

import { LANGUAGES } from '../i18n/dictionaries'
import { languageShortLabel } from '../i18n/locale'
import { currentLanguage, onLanguageChange, setLanguage, t } from '../i18n/runtime'

const roots: HTMLElement[] = []

function mark(root: HTMLElement): void {
  const code = currentLanguage().code
  for (const btn of root.querySelectorAll<HTMLButtonElement>('button')) {
    const on = btn.dataset['lang'] === code
    btn.classList.toggle('selected', on)
    btn.setAttribute('aria-pressed', String(on))
  }
  root.setAttribute('aria-label', t('aria.language'))
}

let subscribed = false

/** Fills root with language buttons and follows language changes. Can be called for several containers. */
export function mountLangSwitch(root: HTMLElement, storage: { get(k: string): string | null; set(k: string, v: string): void }): void {
  root.setAttribute('role', 'group')
  root.replaceChildren()
  for (const lang of LANGUAGES) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset['lang'] = lang.code
    btn.lang = lang.code
    btn.textContent = languageShortLabel(lang)
    btn.setAttribute('aria-label', lang.native)
    btn.title = lang.native
    root.appendChild(btn)
  }
  root.addEventListener('click', (e) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const btn = target.closest('button')
    const code = btn?.dataset['lang']
    if (code !== undefined) setLanguage(code, storage) // all interface text changes at once, the choice is remembered
  })
  roots.push(root)
  mark(root)
  if (!subscribed) {
    subscribed = true
    onLanguageChange(() => {
      for (const r of roots) mark(r)
    })
  }
}
