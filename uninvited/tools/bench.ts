// Runs the in-game benchmark (`?bench=`, see view/bench.ts) in a headless browser, prints a table and saves the JSON.
//   bun tools/bench.ts [scenario=all] [--level l1|slice] [--url http://localhost:3330] [--sec N] [--compare] [--gpu] [--profile]
// --alloc: a sampling heap profile (who allocates), prints the top allocation sites.
// --profile: a CPU profile of the run (CDP), prints the functions with the most self time (JS side; GL calls show as native).
// Scenarios: idle scan scan-walk scan-still scan-off wave fx fx-sword fx-shots fx-worm fx-drone fx-warden fx-hurt fx-audio fx-hud soak all (all = no soak).
// Results: bench/results/<date>-<scenario>-<level>.json (gitignored). --compare diffs against the previous file of the same scenario.
// Headless Chrome renders with SwiftShader (software GL): read the trends, spikes and counts, NOT the absolute frame
// times. The real numbers come from opening the same ?bench= URL in a real browser on a real GPU.
// Playwright: `playwright-core` if installed, else the bun cache copy below.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const flag = (n: string): string | undefined => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}
const scenario = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1]?.startsWith('--') && ['--level', '--url', '--sec', '--w', '--h', '--q'].includes(argv[i - 1] as string))) ?? 'all'
const level = flag('--level') ?? 'l1'
const base = flag('--url') ?? 'http://localhost:3330'
const sec = flag('--sec')
const compare = argv.includes('--compare')

const CACHE = '/home/ubuntu/.bun/install/cache/playwright-core@1.55.0@@@1/index.mjs'
const load = (m: string): Promise<any> => import(m)
const pw: any = await load('playwright-core').catch(() => load(CACHE))
const args = ['--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required']
if (!argv.includes('--gpu')) args.push('--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist')
const browser = await pw.chromium.launch({ args })
const page = await browser.newPage({ viewport: { width: Number(flag('--w') ?? 480), height: Number(flag('--h') ?? 270) } })
const errors: string[] = []
page.on('pageerror', (e: Error) => errors.push(e.message))
page.on('console', (m: any) => {
  if (m.type() === 'error') errors.push(m.text())
})
const url = `${base}/?bench=${scenario}&level=${level}${sec ? `&sec=${sec}` : ''}${argv.includes('--nowarm') ? '&nowarm' : ''}${flag('--q') ?? ''}`
console.log(`bench ${url}\n(software GL: trends and counts only, not absolute frame times)`)
await page.goto(url)
const cdp = argv.includes('--profile') ? await page.context().newCDPSession(page) : null
await page.click('#bench-go', { timeout: 60000 })
const cdpA = argv.includes('--alloc') ? await page.context().newCDPSession(page) : null
if (cdpA) await cdpA.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
if (cdp) {
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 })
  await cdp.send('Profiler.start')
}
const limit = (scenario === 'all' ? 1500 : (Number(sec) || (scenario === 'soak' ? 300 : 60)) + 120) * 1000
await page.waitForFunction(() => (window as any).__benchResult, null, { timeout: limit, polling: 1000 })
const out = await page.evaluate(() => (window as any).__benchResult)
if (cdpA) {
  const { profile } = await cdpA.send('HeapProfiler.stopSampling')
  const sites = new Map<string, number>()
  const walk = (n: any): void => {
    const c = n.callFrame
    const k = `${c.functionName || '(anon)'} ${String(c.url).split('/').pop()}:${c.lineNumber + 1}`
    sites.set(k, (sites.get(k) ?? 0) + n.selfSize)
    for (const ch of n.children) walk(ch)
  }
  walk(profile.head)
  const tot = [...sites.values()].reduce((a, b) => a + b, 0)
  console.log(`alloc profile: ${(tot / 1048576).toFixed(1)} MB sampled over the run; top sites:`)
  for (const [k, v] of [...sites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${(v / 1024).toFixed(0).padStart(8)} KB  ${k}`)
}
if (cdp) {
  const { profile } = await cdp.send('Profiler.stop')
  const self = new Map<string, number>()
  const byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
  const dt: number[] = profile.timeDeltas
  profile.samples.forEach((id: number, i: number) => {
    const c = byId.get(id).callFrame
    const k = `${c.functionName || '(anon)'} ${String(c.url).split('/').pop()}:${c.lineNumber + 1}`
    self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000)
  })
  const total = [...self.values()].reduce((a, b) => a + b, 0)
  const idle = (self.get('(idle) :1') ?? 0) + (self.get('(program) :1') ?? 0)
  console.log(`profile: ${total.toFixed(0)} ms sampled, ${idle.toFixed(0)} ms idle/program; top self time:`)
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log(`${v.toFixed(0).padStart(7)} ms  ${k}`)
}
await browser.close()

const dir = new URL('../bench/results/', import.meta.url).pathname
mkdirSync(dir, { recursive: true })
const prevFiles = readdirSync(dir).filter((f) => f.endsWith(`-${scenario}-${level}.json`)).sort()
const prev = prevFiles.length ? JSON.parse(readFileSync(dir + prevFiles[prevFiles.length - 1], 'utf8')) : null
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const file = `${dir}${stamp}-${scenario}-${level}.json`
writeFileSync(file, JSON.stringify(out, null, 1))

const f = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '-')
const rows = out.results.map((r: any) => {
  const p = prev?.results?.find((q: any) => q.scenario === r.scenario)
  const d = (k: string): string => (compare && p ? ` (${r[k] >= p[k] ? '+' : ''}${f(r[k] - p[k])})` : '')
  return {
    scenario: r.scenario,
    fps: f(r.fps),
    p50: f(r.p50),
    p95: f(r.p95) + d('p95'),
    p99: f(r.p99),
    max: f(r.max, 0),
    'js p95': f(r.cpuP95),
    'js max': f(r.cpuMax),
    'js>16': r.cpuOver16,
    'KB/frame': r.allocKB,
    'hitstop%': r.hitStopPct,
    '>33': r.over33 + (compare && p ? ` (${r.over33 - p.over33 >= 0 ? '+' : ''}${r.over33 - p.over33})` : ''),
    '>50': r.over50,
    calls: `${f(r.callsAvg, 0)}/${r.callsMax}`,
    geo: r.end.geometries,
    tex: r.end.textures,
    prog: r.end.programs,
    objs: r.end.objects,
    voices: r.end.voices,
    'heap MB': f(r.end.heapMB, 0),
    happened: Object.entries(r.happened).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', '),
    growth: r.growth.length ? r.growth.join('; ') : 'none',
    spikes: Object.entries(r.spikeCauses).map(([a, b]) => `${b}x ${a}`).join('; ') || '-',
    pass: r.pass.p95 && r.pass.growth ? 'ok' : 'FAIL',
  }
})
console.table(rows)
for (const r of out.results) {
  const top = [...r.longs].sort((a: any, b: any) => b.ms - a.ms).slice(0, 5)
  if (top.length) console.log(`${r.scenario}: worst frames [t s, ms, js ms, what]:`, top.map((l: any) => `${l.t}s ${l.ms}ms js${l.cpu} ${l.tags.join('+')}`).join(' | '))
}
for (const r of out.results) {
  if (r.series.length > 2 && (argv.includes('--series') || r.scenario === 'soak')) {
    console.log(`${r.scenario}: over time (pools ${JSON.stringify(r.pools)})`)
    console.table(r.series.map((x: any) => ({ t: x.t, geo: x.geometries, tex: x.textures, prog: x.programs, objs: x.objects, voices: x.voices, 'heap MB': x.heapMB })))
  }
}
if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5))
console.log(`saved ${file}${compare && !prev ? ' (no previous run to compare)' : ''}`)
if (!existsSync(file)) process.exit(1)
