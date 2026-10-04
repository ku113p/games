// usage: bun gpu.mjs <url> <scenario> [w h]  - times the render passes (with gl.finish) under toggles
const pw = await import('/home/ubuntu/.bun/install/cache/playwright-core@1.55.0@@@1/index.mjs')
const [url, sc = 'scan-still', w = '960', h = '540'] = process.argv.slice(2)
const browser = await pw.chromium.launch({ args: ['--enable-precise-memory-info', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
await page.goto(`${url}/?bench=${sc}&level=l1&sec=600`)
await page.click('#bench-go', { timeout: 120000 })
await page.waitForTimeout(6000)
const out = await page.evaluate(async () => {
  const g = window.__game
  const R = g.view.renderer
  const gl = R.renderer.getContext()
  const scene = R.scene
  const px = new Uint8Array(4)
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1]
  const time = (fn, n = 12) => {
    const t = []
    for (let i = 0; i < n; i++) { const a = performance.now(); fn(); (gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px)); t.push(performance.now() - a) }
    return +med(t).toFixed(1)
  }
  const full = () => R.render(1)
  const res = {}
  R.renderer.info.autoReset = false
  const info = () => { R.renderer.info.reset(); R.render(1); return R.renderer.info.render.calls }
  const cones = []
  scene.traverse((o) => { const m = o.material; if (m && m.uniforms && m.uniforms.uFans && m.uniforms.uScan) cones.push(o) })
  const nvRoot = scene.children.find((c) => c.children.length && c.children.some((m) => m.material && m.material.uniforms && m.material.uniforms.uFade))
  const byName = {
    routes: nvRoot.children.filter((m) => m.geometry && m.geometry.index && m.geometry.index.count > 500),
    links: nvRoot.children.filter((m) => m.geometry && m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop < 0.2),
  }
  const rest = nvRoot.children.filter((m) => !byName.routes.includes(m) && !byName.links.includes(m))
  const refl = cones.filter((o) => (o.layers.mask & 2) !== 0)
  const variants = {
    full: () => {},
    noCones: () => { cones.forEach((o) => (o.__v = o.visible, o.visible = false)); return () => cones.forEach((o) => (o.visible = o.__v)) },
    noConesInMirror: () => { refl.forEach((o) => o.layers.disable(1)); return () => refl.forEach((o) => o.layers.enable(1)) },
    noRoutes: () => { byName.routes.forEach((o) => (o.__v = o.visible, o.visible = false)); return () => byName.routes.forEach((o) => (o.visible = o.__v)) },
    noLinks: () => { byName.links.forEach((o) => (o.__v = o.visible, o.visible = false)); return () => byName.links.forEach((o) => (o.visible = o.__v)) },
    noZonesRing: () => { rest.forEach((o) => (o.__v = o.visible, o.visible = false)); return () => rest.forEach((o) => (o.visible = o.__v)) },
    noNetvision: () => { nvRoot.visible = false; return () => (nvRoot.visible = true) },
  }
  res.counts = { cones: cones.length, visCones: cones.filter((o) => o.visible).length, inMirror: refl.length, routes: byName.routes.length, links: byName.links.length, linksVisible: byName.links.filter((o) => o.visible).length, rest: rest.length, restVisible: rest.filter((o) => o.visible).length }
  for (let round = 0; round < 2; round++) {
    for (const [k, v] of Object.entries(variants)) {
      const undo = v()
      const t = time(full, 8)
      const calls = info()
      if (undo) undo()
      res[k] = res[k] ? [res[k], t, calls] : t
    }
  }
  return res
})
console.log(JSON.stringify(out, null, 1))
await page.screenshot({ path: new URL('./gpu-last.png', import.meta.url).pathname })
await browser.close()
