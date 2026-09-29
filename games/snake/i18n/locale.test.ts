import { describe, expect, test } from 'bun:test'
import { LANGUAGES, ru, type TextKey } from './dictionaries'
import { format, languageByCode, resolveLanguage, translate } from './locale'

const code = (list: readonly (string | null | undefined)[]): string => resolveLanguage(list).code

describe('resolveLanguage', () => {
  test.each([
    ['ru', 'ru'],
    ['ru-RU', 'ru'],
    ['pt', 'pt-BR'],
    ['pt-BR', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['zh', 'zh-Hans'],
    ['zh-CN', 'zh-Hans'],
    ['zh-Hans', 'zh-Hans'],
    ['zh-Hans-CN', 'zh-Hans'],
    ['zh-TW', 'zh-Hans'],
    ['es', 'es'],
    ['es-419', 'es'],
    ['es-MX', 'es'],
    ['en-US', 'en'],
    ['EN-gb', 'en'],
    ['pt_BR', 'pt-BR'],
  ])('%s -> %s', (tag, expected) => {
    expect(code([tag])).toBe(expected)
  })

  test('неизвестный код -> английский', () => {
    expect(code(['xx'])).toBe('en')
    expect(code(['fr-FR'])).toBe('en')
    expect(code(['ar-EG'])).toBe('en')
  })

  test('пустой список и мусор -> английский', () => {
    expect(code([])).toBe('en')
    expect(code([''])).toBe('en')
    expect(code(['-'])).toBe('en')
    expect(code([undefined, null])).toBe('en')
  })

  test('берётся первый опознанный по порядку предпочтений', () => {
    expect(code(['fr-FR', 'es-419', 'ru'])).toBe('es')
    expect(code(['en-US', 'ru'])).toBe('en')
    expect(code(['de', undefined, 'zh-CN'])).toBe('zh-Hans')
  })
})

describe('languageByCode', () => {
  test('точный код', () => {
    expect(languageByCode('pt-BR')?.native).toBe('Português')
    expect(languageByCode('zh-Hans')?.primary).toBe('zh')
  })
  test('чужое и пустое -> null', () => {
    expect(languageByCode('pt')).toBeNull()
    expect(languageByCode('fr')).toBeNull()
    expect(languageByCode(null)).toBeNull()
    expect(languageByCode(undefined)).toBeNull()
  })
})

describe('format / translate', () => {
  test('подстановка', () => {
    expect(format('Символ {n}: следующий', { n: 2 })).toBe('Символ 2: следующий')
  })
  test('неизвестный плейсхолдер остаётся', () => {
    expect(format('a {x} b', { n: 1 })).toBe('a {x} b')
    expect(format('a {x} b')).toBe('a {x} b')
  })
  test('translate берёт словарь', () => {
    const en = languageByCode('en')
    expect(en && translate(en.dict, 'aria.reelNext', { n: 3 })).toBe('Symbol 3: next')
  })
})

describe('словари', () => {
  const keys = Object.keys(ru) as TextKey[]
  const placeholders = (s: string): string => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

  test('коды и главные подтеги уникальны', () => {
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length)
    expect(new Set(LANGUAGES.map((l) => l.primary)).size).toBe(LANGUAGES.length)
  })

  test('пять языков', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['en', 'es', 'pt-BR', 'ru', 'zh-Hans'])
  })

  for (const lang of LANGUAGES) {
    test(`${lang.code}: те же ключи, ничего пустого, те же плейсхолдеры`, () => {
      expect(Object.keys(lang.dict).sort()).toEqual([...keys].sort())
      for (const k of keys) {
        expect(lang.dict[k].trim().length).toBeGreaterThan(0)
        expect(placeholders(lang.dict[k])).toBe(placeholders(ru[k]))
      }
    })

    test(`${lang.code}: GAME OVER в словаре нет`, () => {
      for (const k of keys) expect(lang.dict[k].toUpperCase()).not.toContain('GAME OVER')
    })
  }
})
