// Проверочный сервер: bun tools/serve.ts [порт] [префикс]  (по умолчанию 4173 и /games/)
// Раздаёт dist/ по вложенному пути, имитируя GitHub Pages: /<префикс>/<игра>/ . Вне префикса — 404.
import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 4173)
const prefix = (process.argv[3] ?? '/games/').replace(/\/?$/, '/')
const dist = resolve(import.meta.dir, '..', 'dist')

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url)
    if (!url.pathname.startsWith(prefix)) return new Response('not found (outside prefix)', { status: 404 })
    let rel = decodeURIComponent(url.pathname.slice(prefix.length))
    const p = join(dist, rel)
    if (!p.startsWith(dist)) return new Response('forbidden', { status: 403 })
    if (existsSync(p) && statSync(p).isDirectory()) {
      if (!url.pathname.endsWith('/')) return Response.redirect(url.pathname + '/', 301)
      rel = join(rel, 'index.html')
    }
    const f = Bun.file(join(dist, rel))
    return f.size ? new Response(f) : new Response('not found', { status: 404 })
  },
})
console.log(`serving ${dist} at http://localhost:${port}${prefix}`)
