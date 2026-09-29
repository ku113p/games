// Линтер границ между слоями (/home/ubuntu/docs/games/AGENTS.md, раздел 4; CONTRACT.md).
// Запуск: `bun scripts/check-layers.ts` (ненулевой код выхода при нарушении).
//
// Правила:
//   1. core/ импортирует только свои файлы (ни three, ни пакетов, ни view/, ни input/);
//      в core/*.test.ts дополнительно разрешён 'bun:test'.
//   2. view/ не импортирует input/; input/ не импортирует view/.
//   3. Динамические import()/require()/new URL(..., import.meta.url) — только с литералом
//      (иначе границу не проверить).
//   4. core/ детерминирован (правило 4 AGENTS.md): без Math.random, Date, performance,
//      crypto, document/window/localStorage и таймеров.
// Проверяются .ts .tsx .mts .cts .js .jsx .mjs .cjs, включая тесты.
// Логика — в layers-lib.ts (там же оговорены пределы регулярочного подхода).
import { analyzeSource, type Violation } from './layers-lib'

const root = import.meta.dir.replace(/\/scripts$/, '')
const LAYERS = ['core', 'view', 'input'] as const

const violations: Violation[] = []
const glob = new Bun.Glob('**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}')

for (const layer of LAYERS) {
  const dir = `${root}/${layer}`
  let files: string[]
  try {
    files = Array.from(glob.scanSync({ cwd: dir }))
  } catch {
    continue // слой ещё не существует
  }
  for (const rel of files) {
    const src = await Bun.file(`${dir}/${rel}`).text()
    violations.push(...analyzeSource(`${layer}/${rel}`, src))
  }
}

if (violations.length > 0) {
  const lines = violations.map((v) => `  ${v.message}`)
  throw new Error(`check-layers: найдены нарушения:\n\n${lines.join('\n')}\n\nВсего: ${violations.length}`)
}
console.log('check-layers: чисто — core/, view/, input/ соблюдают границы слоёв, ядро детерминировано.')
