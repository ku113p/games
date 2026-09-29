import { describe, expect, test } from 'bun:test'
import { LANGUAGES, en, type TextKey } from './dictionaries'
import { format, languageByCode, languageShortLabel, parseRich, resolveLanguage, translate } from './locale'

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

  test('unknown code -> English', () => {
    expect(code(['xx'])).toBe('en')
    expect(code(['fr-FR'])).toBe('en')
    expect(code(['ar-EG'])).toBe('en')
  })

  test('empty list and garbage -> English', () => {
    expect(code([])).toBe('en')
    expect(code([''])).toBe('en')
    expect(code(['-'])).toBe('en')
    expect(code([undefined, null])).toBe('en')
  })

  test('the first recognized one in preference order is taken', () => {
    expect(code(['fr-FR', 'es-419', 'ru'])).toBe('es')
    expect(code(['en-US', 'ru'])).toBe('en')
    expect(code(['de', undefined, 'zh-CN'])).toBe('zh-Hans')
  })
})

describe('languageByCode', () => {
  test('exact code', () => {
    expect(languageByCode('pt-BR')?.native).toBe('Português')
    expect(languageByCode('zh-Hans')?.primary).toBe('zh')
  })
  test('foreign and empty -> null', () => {
    expect(languageByCode('pt')).toBeNull()
    expect(languageByCode('fr')).toBeNull()
    expect(languageByCode(null)).toBeNull()
    expect(languageByCode(undefined)).toBeNull()
  })
})

describe('format / translate', () => {
  test('substitution', () => {
    expect(format('Символ {n}: следующий', { n: 2 })).toBe('Символ 2: следующий')
  })
  test('an unknown placeholder stays', () => {
    expect(format('a {x} b', { n: 1 })).toBe('a {x} b')
    expect(format('a {x} b')).toBe('a {x} b')
  })
  test('translate takes the dictionary', () => {
    const en = languageByCode('en')
    expect(en && translate(en.dict, 'aria.reelNext', { n: 3 })).toBe('Symbol 3: next')
  })
})

describe('dictionaries', () => {
  const keys = Object.keys(en) as TextKey[]
  const placeholders = (s: string): string => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

  test('codes and primary subtags are unique', () => {
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length)
    expect(new Set(LANGUAGES.map((l) => l.primary)).size).toBe(LANGUAGES.length)
  })

  test('five languages', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['en', 'es', 'pt-BR', 'ru', 'zh-Hans'])
  })

  for (const lang of LANGUAGES) {
    test(`${lang.code}: the same keys, nothing empty, the same placeholders`, () => {
      expect(Object.keys(lang.dict).sort()).toEqual([...keys].sort())
      for (const k of keys) {
        expect(lang.dict[k].trim().length).toBeGreaterThan(0)
        expect(placeholders(lang.dict[k])).toBe(placeholders(en[k]))
      }
    })

    test(`${lang.code}: GAME OVER is not in the dictionary`, () => {
      for (const k of keys) expect(lang.dict[k].toUpperCase()).not.toContain('GAME OVER')
    })
  }
})

describe('parseRich', () => {
  test('bold and italic', () => {
    expect(parseRich('a **b** c *d*.')).toEqual([
      { text: 'a ', style: 'plain' },
      { text: 'b', style: 'bold' },
      { text: ' c ', style: 'plain' },
      { text: 'd', style: 'italic' },
      { text: '.', style: 'plain' },
    ])
  })
  test('without markup and with an unclosed asterisk: plain text', () => {
    expect(parseRich('abc')).toEqual([{ text: 'abc', style: 'plain' }])
    expect(parseRich('a * b')).toEqual([{ text: 'a * b', style: 'plain' }])
  })
})

describe('legal texts', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('legal.')) as TextKey[]
  test('all languages have all the legal keys, non-empty', () => {
    expect(keys.length).toBe(12)
    for (const l of LANGUAGES) for (const k of keys) expect(l.dict[k].trim().length).toBeGreaterThan(0)
  })
  test('the ** markup is balanced in every language', () => {
    for (const l of LANGUAGES) for (const k of keys) expect((l.dict[k].match(/\*\*/g) ?? []).length % 2).toBe(0)
  })
  test('the bold warning and the bold "nothing personal" are present in every language', () => {
    for (const l of LANGUAGES) {
      expect(l.dict['legal.warn.p2']).toContain('**')
      expect(l.dict['legal.terms.b2']).toContain('**')
    }
  })
  test('the terms name the counter and hosting in every language (we do not bring back the false "sends nothing")', () => {
    for (const l of LANGUAGES) {
      expect(l.dict['legal.terms.b2']).toContain('GoatCounter')
      expect(l.dict['legal.terms.b2']).toContain('GitHub Pages')
    }
  })
  test('the music title and license are kept in every language', () => {
    for (const l of LANGUAGES) {
      expect(l.dict['legal.terms.b3']).toContain('*Cyber Runner*')
      expect(l.dict['legal.terms.b3']).toContain('CC0 1.0')
    }
  })
})

describe('languageShortLabel', () => {
  test('every language gets two Latin letters, no repeats', () => {
    const labels = LANGUAGES.map((l) => languageShortLabel(l))
    expect(labels).toEqual(['EN', 'ES', 'PT', 'ZH', 'RU'])
    for (const l of labels) expect(l).toMatch(/^[A-Z]{2}$/)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
