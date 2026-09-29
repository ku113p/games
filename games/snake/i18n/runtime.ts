// i18n/runtime.ts — текущий язык, сохранение выбора, применение к DOM. Холодный путь (меню, смена языка).
// Разметка помечается атрибутами: data-i18n="ключ" (текст), data-i18n-rich="ключ" (текст с **жирным**/*курсивом*), data-i18n-aria="ключ" (aria-label).

import { LANGUAGES, type Language, type TextKey } from './dictionaries'
import { languageByCode, parseRich, resolveLanguage, translate } from './locale'

export const LANG_KEY = 'snake:lang'

interface Storage {
  get(key: string): string | null
  set(key: string, value: string): void
}

let current: Language = resolveLanguage([])
const listeners: Array<(lang: Language) => void> = []

export function currentLanguage(): Language {
  return current
}

export function t(key: TextKey, params?: Readonly<Record<string, string | number>>): string {
  return translate(current.dict, key, params)
}

/** Подписка на смену языка (для динамических строк: тумблеры, подписи барабана). */
export function onLanguageChange(cb: (lang: Language) => void): void {
  listeners.push(cb)
}

/** Разметка -> текущий язык: data-i18n, data-i18n-aria, заголовок вкладки и `lang` документа. */
export function applyToDocument(root: ParentNode = document): void {
  document.documentElement.lang = current.code
  document.title = t('doc.title')
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset['i18n'] as TextKey)
  }
  // data-i18n-rich: то же, но с **жирным** и *курсивом* из словаря; узлы строятся через DOM, не innerHTML.
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-rich]')) {
    const spans = parseRich(t(el.dataset['i18nRich'] as TextKey))
    el.replaceChildren(
      ...spans.map((sp) => {
        if (sp.style === 'plain') return document.createTextNode(sp.text)
        const node = document.createElement(sp.style === 'bold' ? 'strong' : 'em')
        node.textContent = sp.text
        return node
      }),
    )
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset['i18nAria'] as TextKey))
  }
}

/** Ручной выбор: запоминается и после этого язык браузера уже не переопределяет. Текст меняется сразу. */
export function setLanguage(code: string, storage: Storage): void {
  const lang = languageByCode(code)
  if (lang === null) return
  current = lang
  storage.set(LANG_KEY, lang.code)
  applyToDocument()
  for (const cb of listeners) cb(lang)
}

/** Старт: сохранённый выбор, иначе язык браузера, иначе английский. Выбор при этом НЕ сохраняется. */
export function initLanguage(storage: Storage, nav: { languages?: readonly string[]; language?: string }): void {
  const saved = languageByCode(storage.get(LANG_KEY))
  if (saved !== null) current = saved
  else current = resolveLanguage([...(nav.languages ?? []), nav.language])
  applyToDocument()
}

export { LANGUAGES }
