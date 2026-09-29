import { describe, expect, test } from 'bun:test'
import { LANGUAGES, ru, type TextKey } from './dictionaries'
import { format, languageByCode, parseRich, resolveLanguage, translate } from './locale'

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

describe('parseRich', () => {
  test('жирный и курсив', () => {
    expect(parseRich('a **b** c *d*.')).toEqual([
      { text: 'a ', style: 'plain' },
      { text: 'b', style: 'bold' },
      { text: ' c ', style: 'plain' },
      { text: 'd', style: 'italic' },
      { text: '.', style: 'plain' },
    ])
  })
  test('без разметки и с незакрытой звёздочкой — обычный текст', () => {
    expect(parseRich('abc')).toEqual([{ text: 'abc', style: 'plain' }])
    expect(parseRich('a * b')).toEqual([{ text: 'a * b', style: 'plain' }])
  })
})

describe('юридические тексты', () => {
  const keys = Object.keys(ru).filter((k) => k.startsWith('legal.')) as TextKey[]
  test('во всех языках есть все юридические ключи, непустые', () => {
    expect(keys.length).toBe(11)
    for (const l of LANGUAGES) for (const k of keys) expect(l.dict[k].trim().length).toBeGreaterThan(0)
  })
  test('разметка ** сбалансирована в каждом языке', () => {
    for (const l of LANGUAGES) for (const k of keys) expect((l.dict[k].match(/\*\*/g) ?? []).length % 2).toBe(0)
  })
  test('жирное предупреждение и жирное «не собирает» есть в каждом языке', () => {
    for (const l of LANGUAGES) {
      expect(l.dict['legal.warn.p2']).toContain('**')
      expect(l.dict['legal.terms.b2']).toContain('**')
    }
  })
  test('название музыки и лицензия сохранены в каждом языке', () => {
    for (const l of LANGUAGES) {
      expect(l.dict['legal.terms.b3']).toContain('*Cyber Runner*')
      expect(l.dict['legal.terms.b3']).toContain('CC0 1.0')
    }
  })
})
