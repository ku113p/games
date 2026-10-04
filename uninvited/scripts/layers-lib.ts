// Pure logic of the layer linter (no file I/O) - so that it can be
// tested. The linter itself is run by scripts/check-layers.ts.
//
// This is NOT a full parser: a small scanner that first strips comments
// and the contents of strings/templates/regex literals (so an import inside a comment or
// string gives no false positives), and then looks for imports and forbidden APIs with regexes
// in the remaining code. Tricky bypasses (aliasing globals through variables and the like) it does not catch.

export type Layer = 'core' | 'view' | 'input' | 'adapters'

export interface Violation {
  file: string
  message: string
}

// Markers in the cleaned code: string literal #N, template with ${} (dynamic), regex.
const STR = '\u0001'
const DYN = '\u0002'
const RX = '\u0003'

interface Sanitized {
  code: string
  strings: string[]
}

interface Tpl {
  hasSubs: boolean
  text: string
  braceDepth: number
}

export function sanitize(src: string): Sanitized {
  const strings: string[] = []
  const tpls: Tpl[] = []
  let out = ''
  let lastSig = ''
  let i = 0
  const n = src.length

  function emitString(text: string): void {
    strings.push(text)
    out += `${STR}${strings.length - 1}${STR}`
    lastSig = 'a'
  }

  function newlines(text: string): string {
    let r = ''
    for (const ch of text) if (ch === '\n') r += '\n'
    return r
  }

  // i stands right after ` or after the closing } of a substitution.
  function readTemplate(t: Tpl): void {
    while (i < n) {
      const c = src[i]
      if (c === '\\') {
        t.text += src.slice(i, i + 2)
        i += 2
        continue
      }
      if (c === '`') {
        i++
        tpls.pop()
        if (t.hasSubs) {
          out += DYN
          lastSig = 'a'
        } else {
          emitString(t.text)
        }
        out += newlines(t.text)
        return
      }
      if (c === '$' && src[i + 1] === '{') {
        i += 2
        t.hasSubs = true
        t.braceDepth = 0
        return
      }
      t.text += c
      i++
    }
    tpls.pop()
  }

  while (i < n) {
    const c = src[i] as string
    const next = src[i + 1]

    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      out += newlines(src.slice(i, stop))
      i = stop
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      let text = ''
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          text += src.slice(j, j + 2)
          j += 2
          continue
        }
        text += src[j]
        j++
      }
      i = j + 1
      emitString(text)
      continue
    }
    if (c === '`') {
      const t: Tpl = { hasSubs: false, text: '', braceDepth: 0 }
      tpls.push(t)
      i++
      readTemplate(t)
      continue
    }
    if (c === '/') {
      // Division or regex literal: decided by the previous significant character.
      if (lastSig === '' || '(,=:[!&|?{};+-*%<>~^'.includes(lastSig)) {
        let j = i + 1
        let inClass = false
        while (j < n && src[j] !== '\n') {
          const d = src[j]
          if (d === '\\') {
            j += 2
            continue
          }
          if (d === '[') inClass = true
          else if (d === ']') inClass = false
          else if (d === '/' && !inClass) break
          j++
        }
        j++
        while (j < n && /[a-z]/i.test(src[j] as string)) j++
        i = j
        out += RX
        lastSig = 'a'
        continue
      }
    }
    const top = tpls[tpls.length - 1]
    if (top !== undefined) {
      if (c === '{') top.braceDepth++
      else if (c === '}') {
        if (top.braceDepth === 0) {
          i++
          readTemplate(top)
          continue
        }
        top.braceDepth--
      }
    }
    out += c
    if (!/\s/.test(c)) lastSig = c
    i++
  }
  return { code: out, strings }
}

// --- paths ---------------------------------------------------------------

function normalizeSegments(parts: string[]): string[] {
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out
}

/** Resolves a relative specifier against the file path (both relative to the game root). */
export function resolveSpecifier(fileRelPath: string, spec: string): string {
  const dirSegs = fileRelPath.split('/').slice(0, -1)
  return normalizeSegments([...dirSegs, ...spec.split('/')]).join('/')
}

function layerOfPath(relPath: string): Layer | 'other' {
  const first = relPath.split('/')[0]
  return first === 'core' || first === 'view' || first === 'input' || first === 'adapters' ? first : 'other'
}

// --- forbidden in the core (AGENTS.md rule 4: the core is deterministic) -----

const CORE_BANNED: ReadonlyArray<{ re: RegExp; what: string }> = [
  { re: /\bMath\s*\.\s*random\b/, what: 'Math.random()' },
  { re: /\bMath\s*\[/, what: 'Math[...] (bypass of the Math.random ban)' },
  { re: /\{[^{}]*\}\s*=\s*Math\b/, what: 'destructuring from Math (bypass of the Math.random ban)' },
  { re: /(?<![.\w$])Date\b/, what: 'Date (time comes from outside)' },
  { re: /(?<![.\w$])performance\b/, what: 'performance (time comes from outside)' },
  { re: /(?<![.\w$])crypto\b/, what: 'crypto (random only through a seed)' },
  {
    re: /(?<![.\w$])(document|window|localStorage|sessionStorage|navigator|requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|globalThis)\b/,
    what: 'browser/global API',
  },
]

// --- file analysis ---------------------------------------------------------

/**
 * @param fileRelPath file path relative to the game root, with '/', e.g. 'core/rules.ts'
 */
export function analyzeSource(fileRelPath: string, source: string): Violation[] {
  const layer = layerOfPath(fileRelPath)
  if (layer === 'other') return []
  const isTest = /\.test\.[cm]?[jt]sx?$/.test(fileRelPath)
  const { code, strings } = sanitize(source)
  const violations: Violation[] = []
  const add = (message: string): void => {
    violations.push({ file: fileRelPath, message })
  }
  const lineAt = (index: number): number => {
    let line = 1
    for (let k = 0; k < index; k++) if (code[k] === '\n') line++
    return line
  }

  const checkSpec = (spec: string, how: string, at: number): void => {
    const where = `${fileRelPath}:${lineAt(at)}`
    if (!spec.startsWith('.')) {
      if (layer === 'core') {
        // In tests of pure layers only the runner is allowed.
        if (isTest && spec === 'bun:test') return
        add(`${where} ${layer}/ ${how} "${spec}" — ${layer}/ may import only its own files (no three/node/npm packages)`)
      }
      return
    }
    const resolved = resolveSpecifier(fileRelPath, spec)
    const target = layerOfPath(resolved)
    if (layer === 'core' && target !== layer) {
      add(`${where} ${layer}/ ${how} a file outside ${layer}/: "${spec}"`)
    } else if (layer === 'adapters' && (target === 'view' || target === 'input')) {
      add(`${where} adapters/ ${how} ${target}/: "${spec}" - adapters serve the core and know nothing of the view or input`)
    } else if ((layer === 'view' || layer === 'input') && target === 'adapters') {
      add(`${where} ${layer}/ ${how} adapters/: "${spec}" - main.ts wires adapters in`)
    } else if (layer === 'view' && target === 'input') {
      add(`${where} view/ ${how} input/: "${spec}"`)
    } else if (layer === 'input' && target === 'view') {
      add(`${where} input/ ${how} view/: "${spec}"`)
    }
  }

  const literal = (idx: string): string => strings[Number(idx)] ?? ''

  // import ... from "x" / export ... from "x"
  for (const m of code.matchAll(new RegExp(`\\bfrom\\s*${STR}(\\d+)${STR}`, 'g'))) {
    checkSpec(literal(m[1] as string), 'imports', m.index)
  }
  // import "x" (side effect)
  for (const m of code.matchAll(new RegExp(`\\bimport\\s*${STR}(\\d+)${STR}`, 'g'))) {
    checkSpec(literal(m[1] as string), 'imports', m.index)
  }
  // import x = require("x")
  // import("x") / require("x"): the argument must be a literal, otherwise it cannot be checked.
  for (const m of code.matchAll(/(?<![.\w$])(import|require)\s*\(\s*([^)]*)\)/g)) {
    const arg = (m[2] as string).trim()
    const lit = new RegExp(`^${STR}(\\d+)${STR}$`).exec(arg)
    if (lit === null) {
      add(`${fileRelPath}:${lineAt(m.index)} ${m[1] as string}() with an unverifiable argument (variable/template) - use a static import`)
    } else {
      checkSpec(literal(lit[1] as string), m[1] === 'import' ? 'dynamically imports' : 'requires', m.index)
    }
  }
  // new URL('../view/x', import.meta.url)
  for (const m of code.matchAll(/\bnew\s+URL\s*\(([^)]*)\)/g)) {
    const args = m[1] as string
    if (!/\bimport\s*\.\s*meta\s*\.\s*url\b/.test(args)) continue
    const first = (args.split(',')[0] ?? '').trim()
    const lit = new RegExp(`^${STR}(\\d+)${STR}$`).exec(first)
    if (lit === null) {
      add(`${fileRelPath}:${lineAt(m.index)} new URL(..., import.meta.url) with an unverifiable path`)
    } else {
      const spec = literal(lit[1] as string)
      checkSpec(spec.startsWith('.') ? spec : `./${spec}`, 'references via new URL', m.index)
    }
  }
  for (const m of code.matchAll(/\bimport\s*\.\s*meta\s*\.\s*(glob|resolve|require)\b/g)) {
    add(`${fileRelPath}:${lineAt(m.index)} import.meta.${m[1] as string} — bypasses the import check`)
  }

  if (layer === 'core' && !isTest) {
    for (const { re, what } of CORE_BANNED) {
      const m = re.exec(code)
      if (m !== null) add(`${fileRelPath}:${lineAt(m.index)} ${layer}/ uses ${what} — the core must be deterministic (AGENTS.md, rule 4)`)
    }
  }
  return violations
}
