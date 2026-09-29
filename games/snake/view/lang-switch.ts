// view/lang-switch.ts — компактный переключатель языка: строка кнопок из двух букв (EN ES PT ZH RU).
// Один и тот же на главном экране и на юридических: человек, которому попал не тот язык, меняет его на месте, одним тапом.
// Холодный путь (меню, смена языка). Кнопки строятся из LANGUAGES: шестой язык = запись в i18n/dictionaries.ts.
// Подпись — код языка (флаг не равен языку, а для zh-Hans его нет); полное название на самом языке — в aria-label и title.

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

/** Наполняет root кнопками языков и следит за сменой языка. Можно звать для нескольких контейнеров. */
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
    if (code !== undefined) setLanguage(code, storage) // текст всего интерфейса меняется сразу, выбор запоминается
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
