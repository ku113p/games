// Build the whole site: bun tools/build.ts
//   dist/index.html, dist/<assets>   - landing page (site/)
//   dist/<game>/                     - each game from games/<game>/ (its `bun run build` writes to ../../dist/<game>)
//   dist/THIRD_PARTY.md, dist/<game>/THIRD_PARTY.md - third-party licenses (three's MIT license requires keeping the notice)
//
// Base path. Bun puts ONLY relative paths into the built html/js ("./index-xxx.js", "./track.mp3"),
// and the landing page links to games as "./<game>/". So the build does not depend on the base path: the same dist
// works on GitHub Pages (/<repository>/), at the root, and inside itch.io. The repository name is written nowhere.
// Condition: the game page is opened with a trailing "/" (GitHub Pages itself redirects /<game> -> /<game>/).
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
