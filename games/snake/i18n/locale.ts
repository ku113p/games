// i18n/locale.ts — pure functions: choosing a language from the browser's list, substituting into strings.
// No DOM and no state (tested directly). State and DOM live in runtime.ts.

import { FALLBACK_CODE, LANGUAGES, type Dictionary, type Language, type TextKey } from './dictionaries'

/** A language by the exact code from LANGUAGES (for example a value from localStorage); otherwise null. */
export function languageByCode(code: string | null | undefined): Language | null {
  if (code === null || code === undefined) return null
  return LANGUAGES.find((l) => l.code === code) ?? null
}

/**
  * The first language from the browser preferences (navigator.languages, then navigator.language) that we have.
  * Only the primary subtag is compared: `pt-PT` and `pt` -> pt-BR (the closest available), `zh-TW` and `zh-Hant` -> zh-Hans
  * (there is no traditional dictionary; simplified characters are clearer to the reader than English), `es-419` -> es.
  * Nothing matched or the list is empty: English.
 */
export function resolveLanguage(preferred: readonly (string | null | undefined)[]): Language {
  for (const tag of preferred) {
    if (typeof tag !== 'string') continue
    const primary = tag.trim().toLowerCase().split(/[-_]/, 1)[0]
    if (primary === undefined || primary === '') continue
    const hit = LANGUAGES.find((l) => l.primary === primary)
    if (hit !== undefined) return hit
  }
  return languageByCode(FALLBACK_CODE) ?? (LANGUAGES[0] as Language)
}

/** Substitutes {name} from params; an unknown placeholder stays as is (visible to the eye rather than an empty gap). */
export function format(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name]
    return v === undefined ? m : String(v)
  })
}

export function translate(dict: Dictionary, key: TextKey, params?: Readonly<Record<string, string | number>>): string {
  return format(dict[key], params)
}

/**
  * Markup in dictionaries: `**bold**` and `*italic*` (italic is a title of a work). Returns the pieces in order;
  * the DOM is assembled by runtime.ts (no innerHTML). Unclosed asterisks stay plain text.
 */
export interface RichSpan {
  readonly text: string
  readonly style: 'plain' | 'bold' | 'italic'
}

export function parseRich(src: string): RichSpan[] {
  const out: RichSpan[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), style: 'plain' })
    if (m[1] !== undefined) out.push({ text: m[1], style: 'bold' })
    else out.push({ text: m[2] as string, style: 'italic' })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ text: src.slice(last), style: 'plain' })
  return out
}

/** A two-letter label of a language for the compact switcher: EN, ES, PT, ZH, RU (the primary subtag in uppercase). */
export function languageShortLabel(lang: Pick<Language, 'primary'>): string {
  return lang.primary.toUpperCase()
}
