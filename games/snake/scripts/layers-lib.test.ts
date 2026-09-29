import { describe, expect, test } from 'bun:test'
import { analyzeSource } from './layers-lib'

const bad = (file: string, src: string): number => analyzeSource(file, src).length

describe('импорты', () => {
  test('core -> three и view: нарушение', () => {
    expect(bad('core/a.ts', `import * as T from 'three'`)).toBe(1)
    expect(bad('core/a.ts', `import { x } from '../view/index'`)).toBe(1)
    expect(bad('core/a.ts', `export * from "../input/touch"`)).toBe(1)
    expect(bad('core/a.ts', `import type { Config } from './rules'`)).toBe(0)
  })

  test('многострочный import', () => {
    expect(bad('core/a.ts', `import {\n a,\n b,\n} from 'three'`)).toBe(1)
  })

  test('динамический import с переменной или шаблоном', () => {
    expect(bad('view/a.ts', `const p = './x'; await import(p)`)).toBe(1)
    expect(bad('view/a.ts', 'await import(`../input/${name}`)')).toBe(1)
    expect(bad('view/a.ts', `await import('../input/touch')`)).toBe(1)
    expect(bad('view/a.ts', `await import('three')`)).toBe(0)
  })

  test('new URL(..., import.meta.url)', () => {
    expect(bad('view/a.ts', `new URL('../input/touch.ts', import.meta.url)`)).toBe(1)
    expect(bad('view/a.ts', `new URL(name, import.meta.url)`)).toBe(1)
    expect(bad('view/a.ts', `new URL('./tex.png', import.meta.url)`)).toBe(0)
  })

  test('тесты ядра проверяются; bun:test можно, three нельзя', () => {
    expect(bad('core/a.test.ts', `import { test } from 'bun:test'`)).toBe(0)
    expect(bad('core/a.test.ts', `import * as T from 'three'`)).toBe(1)
    expect(bad('core/a.ts', `import { test } from 'bun:test'`)).toBe(1)
  })

  test('другие расширения', () => {
    expect(bad('core/a.js', `import x from 'three'`)).toBe(1)
    expect(bad('input/a.ts', `import { v } from '../view/index'`)).toBe(1)
  })

  test('комментарии и строки не дают ложных срабатываний', () => {
    expect(bad('core/a.ts', `// import x from 'three'\n/* import y from "three" */\nconst s = "import z from 'three'"`)).toBe(0)
    expect(bad('core/a.ts', 'const s = `import a from "three"`')).toBe(0)
    expect(bad('core/a.ts', `const r = /import 'x'/g; const q = a / b`)).toBe(0)
  })
})

describe('детерминизм ядра', () => {
  test('запрещённое в core', () => {
    expect(bad('core/a.ts', `const r = Math.random()`)).toBe(1)
    expect(bad('core/a.ts', `const t = Date.now()`)).toBe(1)
    expect(bad('core/a.ts', `const t = new Date()`)).toBe(1)
    expect(bad('core/a.ts', `const t = performance.now()`)).toBe(1)
    expect(bad('core/a.ts', `document.title = 'x'`)).toBe(1)
    expect(bad('core/a.ts', `const { random } = Math`)).toBe(1)
  })

  test('в комментариях, строках и как поле — можно', () => {
    expect(bad('core/a.ts', `// Math.random() нельзя\nconst s = 'Date.now'\nconst x = obj.document`)).toBe(0)
    expect(bad('core/a.ts', `const m = Math.floor(1.5) + Math.max(1, 2)`)).toBe(0)
  })

  test('вне core разрешено', () => {
    expect(bad('view/a.ts', `const r = Math.random(); document.title = 'x'`)).toBe(0)
  })
})
