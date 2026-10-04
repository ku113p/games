import { describe, expect, test } from 'bun:test'
import { analyzeSource } from './layers-lib'

const bad = (file: string, src: string): number => analyzeSource(file, src).length

describe('imports', () => {
  test('core -> three and view: violation', () => {
    expect(bad('core/a.ts', `import * as T from 'three'`)).toBe(1)
    expect(bad('core/a.ts', `import { x } from '../view/index'`)).toBe(1)
    expect(bad('core/a.ts', `export * from "../input/touch"`)).toBe(1)
    expect(bad('core/a.ts', `import type { Config } from './rules'`)).toBe(0)
  })

  test('multiline import', () => {
    expect(bad('core/a.ts', `import {\n a,\n b,\n} from 'three'`)).toBe(1)
  })

  test('dynamic import with a variable or a template', () => {
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

  test('core tests are checked; bun:test is allowed, three is not', () => {
    expect(bad('core/a.test.ts', `import { test } from 'bun:test'`)).toBe(0)
    expect(bad('core/a.test.ts', `import * as T from 'three'`)).toBe(1)
    expect(bad('core/a.ts', `import { test } from 'bun:test'`)).toBe(1)
  })

  test('core tests and the shared fixtures may read config.json, the rest of core may not', () => {
    expect(bad('core/a.test.ts', `import cfg from '../config.json'`)).toBe(0)
    expect(bad('core/testing.ts', `import cfg from '../config.json'`)).toBe(0)
    expect(bad('core/a.ts', `import cfg from '../config.json'`)).toBe(1)
  })

  test('other extensions', () => {
    expect(bad('core/a.js', `import x from 'three'`)).toBe(1)
    expect(bad('input/a.ts', `import { v } from '../view/index'`)).toBe(1)
  })

  test('comments and strings do not cause false positives', () => {
    expect(bad('core/a.ts', `// import x from 'three'\n/* import y from "three" */\nconst s = "import z from 'three'"`)).toBe(0)
    expect(bad('core/a.ts', 'const s = `import a from "three"`')).toBe(0)
    expect(bad('core/a.ts', `const r = /import 'x'/g; const q = a / b`)).toBe(0)
  })
})

describe('core determinism', () => {
  test('forbidden in core', () => {
    expect(bad('core/a.ts', `const r = Math.random()`)).toBe(1)
    expect(bad('core/a.ts', `const t = Date.now()`)).toBe(1)
    expect(bad('core/a.ts', `const t = new Date()`)).toBe(1)
    expect(bad('core/a.ts', `const t = performance.now()`)).toBe(1)
    expect(bad('core/a.ts', `document.title = 'x'`)).toBe(1)
    expect(bad('core/a.ts', `const { random } = Math`)).toBe(1)
  })

  test('in comments, strings and as a property: allowed', () => {
    expect(bad('core/a.ts', `// Math.random() is forbidden\nconst s = 'Date.now'\nconst x = obj.document`)).toBe(0)
    expect(bad('core/a.ts', `const m = Math.floor(1.5) + Math.max(1, 2)`)).toBe(0)
  })

  test('outside core it is allowed', () => {
    expect(bad('view/a.ts', `const r = Math.random(); document.title = 'x'`)).toBe(0)
  })
})

describe('adapters layer', () => {
  test('adapters may use packages and the core, but not view/ or input/', () => {
    expect(bad('adapters/a.ts', `import RAPIER from '@dimforge/rapier3d-compat'`)).toBe(0)
    expect(bad('adapters/a.ts', `import { x } from '../core/ports'`)).toBe(0)
    expect(bad('adapters/a.ts', `const s = localStorage.getItem('k')`)).toBe(0)
    expect(bad('adapters/a.ts', `import { x } from '../view/index'`)).toBe(1)
    expect(bad('adapters/a.ts', `import { x } from '../input/keys'`)).toBe(1)
  })
  test('view/ and input/ do not import adapters/', () => {
    expect(bad('view/a.ts', `import { x } from '../adapters/physics-rapier'`)).toBe(1)
    expect(bad('input/a.ts', `import { x } from '../adapters/storage'`)).toBe(1)
  })
})
