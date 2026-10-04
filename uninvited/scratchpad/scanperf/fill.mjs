// counts the fragments the scan-only meshes shade in the main view (overdraw: additive 1/255 per fragment)
const pw = await import('/home/ubuntu/.bun/install/cache/playwright-core@1.55.0@@@1/index.mjs')
const [url, sc = 'scan-still', w = '960', h = '540'] = process.argv.slice(2)
const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
await page.goto(`${url}/?bench=${sc}&level=l1&sec=600`)
await page.click('#bench-go', { timeout: 120000 })
await page.waitForTimeout(6000)
const out = await page.evaluate(() => {
  const g = window.__game
  const R = g.view.renderer
  const scene = R.scene, cam = R.camera, rd = R.renderer
  const gl = rd.getContext()
  const SM = scene.children.find((c) => c.material && c.material.constructor.name)?.material.constructor
  const cones = []
  scene.traverse((o) => { const m = o.material; if (m && m.uniforms && m.uniforms.uFans && m.uniforms.uScan) cones.push(o) })
  const nvRoot = scene.children.find((c) => c.children.length && c.children.some((m) => m.material && m.material.uniforms && m.material.uniforms.uFade))
  const count = (objs, name) => {
    const saved = objs.map((o) => [o.material, o.layers.mask])
    const mats = objs.map((o) => { const m = new o.material.constructor({ vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'void main(){gl_FragColor=vec4(1.0/255.0,0.0,0.0,1.0);}', transparent: true, depthWrite: false, depthTest: o.material.depthTest, blending: 2, side: 2 }); return m })
    objs.forEach((o, i) => { o.material = mats[i]; o.layers.enable(5) })
    const oldMask = cam.layers.mask
    cam.layers.set(5)
    const bg = scene.background, fog = scene.fog
    scene.background = null; scene.fog = null
    rd.setRenderTarget(null)
    rd.setClearColor(0x000000, 1)
    rd.clear()
    rd.render(scene, cam)
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight
    const px = new Uint8Array(W * H * 4)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    let sum = 0, cov = 0
    for (let i = 0; i < px.length; i += 4) { sum += px[i]; if (px[i]) cov++ }
    objs.forEach((o, i) => { o.material = saved[i][0]; o.layers.mask = saved[i][1] })
    cam.layers.mask = oldMask
    scene.background = bg; scene.fog = fog
    return { name, W, H, fragments: sum, coveredPx: cov, overdraw: +(sum / Math.max(1, cov)).toFixed(2), screenShare: +(sum / (W * H)).toFixed(2) }
  }
  const vis = cones.filter((o) => o.visible)
  const res = [count(vis, 'cone volumes (visible)')]
  const routes = nvRoot.children.filter((m) => m.visible && m.material && m.material.uniforms)
  res.push(count(routes, 'netvision meshes (visible)'))
  return { n: vis.length, res }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
