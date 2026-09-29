// Сборка всего сайта: bun tools/build.ts
//   dist/index.html, dist/<assets>   — лендинг (site/)
//   dist/<игра>/                     — каждая игра из games/<игра>/ (её `bun run build` пишет в ../../dist/<игра>)
//   dist/THIRD_PARTY.md, dist/<игра>/THIRD_PARTY.md — лицензии сторонних компонентов (MIT three требует сохранять уведомление)
//
// Base path. Bun кладёт в собранный html/js ТОЛЬКО относительные пути ("./index-xxx.js", "./track.mp3"),
// а лендинг ссылается на игры как "./<игра>/". Поэтому сборка не зависит от base path: один и тот же dist
// работает и на GitHub Pages (/<репозиторий>/), и в корне, и внутри itch.io. Имя репозитория нигде не вписано.
// Условие: страница игры открывается с завершающим "/" (GitHub Pages сам редиректит /<игра> -> /<игра>/).
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const dist = join(root, 'dist')

function run(cmd: string[], cwd: string): void {
  const p = Bun.spawnSync(cmd, { cwd, stdout: 'inherit', stderr: 'inherit' })
  if (p.exitCode !== 0) {
    console.error(`FAILED (${p.exitCode}): ${cmd.join(' ')} in ${cwd}`)
    process.exit(1)
  }
}

export function listGames(): string[] {
  return readdirSync(join(root, 'games'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, 'games', d.name, 'package.json')))
    .map((d) => d.name)
}

if (import.meta.main) {
  rmSync(dist, { recursive: true, force: true })
  const third = join(root, 'THIRD_PARTY.md')

  for (const game of listGames()) {
    run(['bun', 'run', 'build'], join(root, 'games', game))
    if (!existsSync(join(dist, game, 'index.html'))) {
      console.error(`games/${game}: build did not produce dist/${game}/index.html`)
      process.exit(1)
    }
    cpSync(third, join(dist, game, 'THIRD_PARTY.md'))
  }

  run(['bun', 'build', 'index.html', '--outdir', dist, '--minify'], join(root, 'site'))
  cpSync(third, join(dist, 'THIRD_PARTY.md'))
  writeFileSync(join(dist, '.nojekyll'), '')
  console.log('dist ready:', dist)
}
