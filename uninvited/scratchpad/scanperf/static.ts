const [dir, port] = Bun.argv.slice(2)
Bun.serve({ port: Number(port), async fetch(r) {
  let p = new URL(r.url).pathname; if (p === '/') p = '/index.html'
  const f = Bun.file(dir + p)
  return (await f.exists()) ? new Response(f) : new Response('nf', { status: 404 })
} })
console.log('static', dir, port)
