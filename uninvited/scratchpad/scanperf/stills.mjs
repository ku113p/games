// usage: bun stills.mjs <url> <tag>
const pw = await import('/home/ubuntu/.bun/install/cache/playwright-core@1.55.0@@@1/index.mjs')
const [url, tag] = process.argv.slice(2)
const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const shots = [
  ['bridge-scan', 'scan-still', '&hold=1'],
  ['bridge-off', 'scan-still', '&hold=0'],
  ['plaza-routes-scan', 'scan-still', '&hold=1&at=29,39&yaw=0'],
  ['river-routes-scan', 'scan-still', '&hold=1&at=13,25&yaw=180'],
]
for (const [name, sc, extra] of shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(`${url}/?bench=${sc}&level=l1&sec=600${extra}`)
  await page.click('#bench-go', { timeout: 120000 })
  await page.waitForTimeout(9000)
  await page.evaluate(() => { document.getElementById('bench-go')?.remove() })
  await page.screenshot({ path: new URL(`./${name}-${tag}.png`, import.meta.url).pathname })
  await page.close()
}
await browser.close()
