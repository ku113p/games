const pw = await import('/home/ubuntu/.bun/install/cache/playwright-core@1.55.0@@@1/index.mjs')
const [url, sc = 'scan-still'] = process.argv.slice(2)
const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 480, height: 270 } })
await page.goto(`${url}/?bench=${sc}&level=l1&sec=600`)
await page.click('#bench-go', { timeout: 120000 })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => {
  const R = window.__game.view.renderer
  const out = {}
  R.scene.traverse((o) => { if (o.isLight) { const k = `${o.type} layers=${o.layers.mask} vis=${o.visible}`; out[k] = (out[k] || 0) + 1 } })
  return out
}), null, 1))
await browser.close()
