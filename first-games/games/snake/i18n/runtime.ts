// i18n/runtime.ts — the current language, saving the choice, applying it to the DOM. Cold path (menu, language change).
// Markup is tagged with attributes: data-i18n="key" (text), data-i18n-rich="key" (text with **bold**/*italic*), data-i18n-aria="key" (aria-label).

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

/** Subscription to language changes (for dynamic strings: toggles, drum labels). */
export function onLanguageChange(cb: (lang: Language) => void): void {
  listeners.push(cb)
}

/** Markup -> the current language: data-i18n, data-i18n-aria, the tab title and the document `lang`. */
export function applyToDocument(root: ParentNode = document): void {
  document.documentElement.lang = current.code
  document.title = t('doc.title')
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset['i18n'] as TextKey)
  }
  // data-i18n-rich: the same, but with **bold** and *italic* from the dictionary; nodes are built through the DOM, not innerHTML.
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

/** A manual choice: it is remembered, and after that the browser language no longer overrides it. The text changes immediately. */
export function setLanguage(code: string, storage: Storage): void {
  const lang = languageByCode(code)
  if (lang === null) return
  current = lang
  storage.set(LANG_KEY, lang.code)
  applyToDocument()
  for (const cb of listeners) cb(lang)
}

/** Start: the saved choice, otherwise the browser language, otherwise English. The choice is NOT saved at this point. */
export function initLanguage(storage: Storage, nav: { languages?: readonly string[]; language?: string }): void {
  const saved = languageByCode(storage.get(LANG_KEY))
  if (saved !== null) current = saved
  else current = resolveLanguage([...(nav.languages ?? []), nav.language])
  applyToDocument()
}

export { LANGUAGES }
