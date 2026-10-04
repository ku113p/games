// Layer-boundary linter (../first-games/AGENTS.md, section 4; uninvited/AGENTS.md).
// Run: `bun scripts/check-layers.ts` (non-zero exit code on a violation).
//
// Rules:
//   1. core/ imports only its own files (no three, no packages, no view/, no input/);
//      'bun:test' is additionally allowed in core/*.test.ts.
//   2. view/ does not import input/; input/ does not import view/.
//   3. Dynamic import()/require()/new URL(..., import.meta.url) - literal only
//      (otherwise the boundary cannot be checked).
//   1a. adapters/ (Rapier, storage) may import the core and packages, but not view/ or input/; view/ and input/ do not import adapters/.
//   4. core/ is deterministic (AGENTS.md rule 4): no Math.random, Date, performance,
//      crypto, document/window/localStorage or timers.
// Checked: .ts .tsx .mts .cts .js .jsx .mjs .cjs, including tests.
// The logic is in layers-lib.ts (which also spells out the limits of the regex approach).
import { analyzeSource, type Violation } from './layers-lib'

const root = import.meta.dir.replace(/\/scripts$/, '')
const LAYERS = ['core', 'view', 'input', 'adapters'] as const

const violations: Violation[] = []
const glob = new Bun.Glob('**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}')

for (const layer of LAYERS) {
  const dir = `${root}/${layer}`
  let files: string[]
  try {
    files = Array.from(glob.scanSync({ cwd: dir }))
  } catch {
    continue // the layer does not exist yet
  }
  for (const rel of files) {
    const src = await Bun.file(`${dir}/${rel}`).text()
    violations.push(...analyzeSource(`${layer}/${rel}`, src))
  }
}

if (violations.length > 0) {
  const lines = violations.map((v) => `  ${v.message}`)
  throw new Error(`check-layers: violations found:\n\n${lines.join('\n')}\n\nTotal: ${violations.length}`)
}
console.log('check-layers: clean - core/, view/, input/, adapters/ respect the layer boundaries, the core is deterministic.')
