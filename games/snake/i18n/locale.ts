// i18n/locale.ts — чистые функции: выбор языка по списку от браузера, подстановка в строки.
// Без DOM и без состояния (тестируются напрямую). Состояние и DOM — в runtime.ts.

import { FALLBACK_CODE, LANGUAGES, type Dictionary, type Language, type TextKey } from './dictionaries'

/** Язык по точному коду из LANGUAGES (например значение из localStorage); иначе null. */
export function languageByCode(code: string | null | undefined): Language | null {
  if (code === null || code === undefined) return null
  return LANGUAGES.find((l) => l.code === code) ?? null
}

/**
 * Первый язык из предпочтений браузера (navigator.languages, за ним navigator.language), который у нас есть.
 * Сравнивается только главный подтег: `pt-PT` и `pt` -> pt-BR (ближайший из имеющихся), `zh-TW` и `zh-Hant` -> zh-Hans
 * (традиционного словаря нет; читателю упрощённые иероглифы понятнее английского), `es-419` -> es.
 * Ничего не подошло или список пуст — английский.
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

/** Подставляет {name} из params; неизвестный плейсхолдер остаётся как есть (видно в глаза, а не пустота). */
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
 * Разметка в словарях: `**жирный**` и `*курсив*` (курсив — название произведения). Возвращает куски по порядку;
 * DOM собирает runtime.ts (без innerHTML). Незакрытые звёздочки остаются обычным текстом.
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
