// The benchmark (`?bench=<scenario>`; absent = this file is never loaded, no cost). Deterministic: the fixed seed, a fixed
// simulation step (1/60 s, up to 6x on a slow machine), scripted hero and camera, synthetic effect events. It measures the frame times of a wall-clock
// stretch per scenario, logs what happened around every slow frame, and ends with a results panel (+ JSON).
//   idle | scan scan-still scan-off | wave | fx | fx-sword fx-shots fx-worm fx-drone fx-warden fx-hurt fx-audio fx-hud | soak | all
// `?bench=all` reloads the page between scenarios (a clean heap and state each); `&sec=N` overrides the duration.
// CLI runner: tools/bench.ts. Pass thresholds and the as-built notes: docs/roles/09-producer.md (perf budget).
import type { GameEvent } from '../core/events'
import { CellKind, floorHeightAt } from '../core/grid'
import { levelGrid } from '../core/queries'
import { raiseAlarm } from '../core/rules/alarm'
import type { GameState, Sim } from '../core/state'
import type { GameView } from './game-view'
import { perfProbe } from './perf'

export interface BenchCtx {
  state(): GameState
  sim: Sim
  view: GameView
  input: { held: Record<string, boolean>; pressed: Record<string, number> }
  level: string
  /** Starts the game (closes the start screen, unlocks audio). */
  start(): void
}

type Cat = 'sword' | 'shots' | 'worm' | 'drone' | 'warden' | 'hurt' | 'audio' | 'hud'
const CATS: Cat[] = ['sword', 'shots', 'worm', 'drone', 'warden', 'hurt', 'audio', 'hud']

interface Scenario {
  sec: number
  /** fight: a wave is played; cats: synthetic effect bursts. */
  fight: boolean
  cats: Cat[]
  /** Network vision benchmarks: the hero is put on arena 2's low bridge (found by its laser) and Tab is held; move: walk/run the bridge back and forth, or stand. */
  scan?: { move: 'walk' | 'run' | 'none'; hold: boolean }
}

const SCENARIOS: Record<string, Scenario> = {
  idle: { sec: 15, fight: false, cats: [] },
  scan: { sec: 20, fight: false, cats: [], scan: { move: 'run', hold: true } },
  'scan-walk': { sec: 20, fight: false, cats: [], scan: { move: 'walk', hold: true } },
  'scan-still': { sec: 20, fight: false, cats: [], scan: { move: 'none', hold: true } },
  'scan-off': { sec: 20, fight: false, cats: [], scan: { move: 'run', hold: false } },
  wave: { sec: 45, fight: true, cats: [] },
  fx: { sec: 20, fight: false, cats: CATS },
  soak: { sec: 300, fight: true, cats: [] },
}
for (const c of CATS) SCENARIOS[`fx-${c}`] = { sec: 12, fight: false, cats: [c] }
const ALL = ['idle', 'scan', 'scan-still', 'wave', 'fx', ...CATS.map((c) => `fx-${c}`)]
/** What each scenario shows, for the on-screen banner (some are invisible on purpose: fx-audio only plays sounds). */
const ABOUT: Record<string, string> = {
  idle: 'the level, nothing happening - the baseline',
  scan: 'running back and forth over arena 2\'s bridge, holding network vision (drone, warden and cones in view)',
  'scan-walk': 'the same, walking',
  'scan-still': 'standing on the bridge, holding network vision',
  'scan-off': 'the same run over the bridge without network vision (the control)',
  wave: 'the biggest alarm-3 wave fighting the hero',
  fx: 'every effect at once, on repeat',
  soak: 'waves on repeat for 5 minutes - leak check',
  'fx-sword': 'sword swings and hits only',
  'fx-shots': 'rifle shots, tracers and impacts only',
  'fx-worm': 'worm deaths only',
  'fx-drone': 'drone hits and kill bursts only',
  'fx-warden': 'warden spawn flares and shield flashes only',
  'fx-hurt': 'player hurt flash, hit-stop and camera kick only',
  'fx-audio': 'sounds only - nothing to see, listen (needs a click for audio)',
  'fx-hud': 'HUD updates only',
}

const STEP = 1 / 60
const WARMUP_FRAMES = 6
const SOUNDS = ['sword_swing', 'rifle_shot', 'worm_death', 'drone_kill', 'derez', 'glitch', 'player_hit', 'wave_spawn', 'bullet_impact', 'sword_hit', 'drone_hit', 'worm_hit']

interface Snap {
  geometries: number
  textures: number
  programs: number
  objects: number
  voices: number
  heapMB: number
  calls: number
  triangles: number
}
interface Long {
  t: number
  ms: number
  cpu: number
  tags: string[]
}

export interface BenchResult {
  scenario: string
  level: string
  sec: number
  frames: number
  fps: number
  p50: number
  p95: number
  p99: number
  max: number
  cpuAvg: number
  /** JS time of a frame (sim + view + submitting the draw calls; not the GPU): the number that stays meaningful on software GL. */
  cpuP95: number
  cpuMax: number
  cpuOver16: number
  /** Heap allocated per frame, KB (sum of the upward steps of the JS heap; 0 when the browser hides it). Steady fights should stay near a few KB. */
  allocKB: number
  /** Share of frames the simulation stood still in a hit-stop (a designed freeze that reads as a stutter in a fight), %. */
  hitStopPct: number
  over33: number
  over50: number
  longs: Long[]
  start: Snap
  mid: Snap
  end: Snap
  /** A snapshot every 30 s (60 s in a soak): the growth over time. */
  series: (Snap & { t: number })[]
  /** Sizes of the core's pools at the end: they are fixed-size, so they must not change. */
  pools: Record<string, number>
  /** How much happened (a fight that never fights proves nothing): event totals of the run. */
  happened: Record<string, number>
  callsAvg: number
  callsMax: number
  growth: string[]
  spikeCauses: Record<string, number>
  pass: { p95: boolean; growth: boolean }
}

export interface Bench {
  /** Called after beginFrame(): drives the hero and the effects; returns the simulation step (0 when finished or waiting for the click). */
  pre(now: number): number
  /** Called at the end of the frame. */
  post(): void
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] as number
}

export function createBench(ctx: BenchCtx, name: string): Bench {
  const params = new URLSearchParams(location.search)
  const chain = name === 'all'
  const step = chain ? Number(params.get('bi') ?? 0) : 0
  const scName = chain ? (ALL[step] as string) : name
  const sc = SCENARIOS[scName]
  if (!sc) throw new Error(`unknown bench scenario "${name}" (${Object.keys(SCENARIOS).join(', ')}, all)`)
  const secs = Number(params.get('sec') ?? sc.sec)
  const r = ctx.view.renderer.renderer
  r.info.autoReset = false
  perfProbe.status = `bench ${scName}: click to start`

  const frameMs: number[] = []
  const cpuMs: number[] = []
  const longs: Long[] = []
  let running = false
  let finished = false
  let t0 = 0 // wall start, ms
  let last = 0
  let t1 = 0 // this frame's cpu start
  let frame = 0
  let snapStart: Snap | null = null
  let snapMid: Snap | null = null
  let prevPrograms = 0
  let prevGeo = 0
  let prevTex = 0
  let prevHeap = 0
  let allocBytes = 0
  let hitStopFrames = 0
  const happened: Record<string, number> = { swordSwing: 0, rifleShot: 0, targetHit: 0, kills: 0, playerHurt: 0, waveStarted: 0, wormPack: 0 }
  const series: (Snap & { t: number })[] = []
  let nextSnap = 0
  const every = secs > 120 ? 60 : 30
  let calls = 0
  let callsMax = 0
  let tags: string[] = []
  let lastCpu = 0
  const lastEv: string[] = []
  const toTime = (): number => (performance.now() - t0) / 1000

  // ---- the start gate: a click is the user gesture that unlocks audio (and starts the clock)
  const gate = document.createElement('div')
  gate.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,6,10,0.85);font:14px monospace;color:#9fefff'
  const go = document.createElement('button')
  go.id = 'bench-go'
  go.textContent = `Start benchmark "${scName}" (${secs} s)${chain ? ` [${step + 1}/${ALL.length}]` : ''}`
  go.style.cssText = 'font:16px monospace;padding:14px 22px;background:#06222c;color:#9fefff;border:1px solid #4ff0ff;cursor:pointer'
  gate.appendChild(go)
  document.body.appendChild(gate)
  const banner = document.createElement('div')
  banner.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:100;font:600 18px monospace;padding:8px 16px;background:rgba(0,10,16,0.8);color:#9fefff;border:1px solid #4ff0ff;pointer-events:none'
  const begin = (): void => {
    gate.remove()
    ctx.start()
    setup()
    running = true
    perfProbe.on = true
    banner.textContent = `BENCH ${chain ? `${step + 1}/${ALL.length} ` : ''}${scName} - ${ABOUT[scName] ?? ''}`
    document.body.appendChild(banner)
    t0 = last = performance.now()
  }
  go.addEventListener('click', begin)
  if (chain && step > 0 && scName !== 'fx-audio') setTimeout(begin, 300) // chained: the first click's gesture is gone after a reload, audio stays locked then

  function snap(): Snap {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    let objects = 0
    ctx.view.renderer.scene.traverse(() => objects++)
    return {
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
      programs: r.info.programs?.length ?? 0,
      objects,
      voices: (ctx.view.sound as unknown as { total: number }).total ?? 0,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 10485.76) / 100 : 0,
      calls: r.info.render.calls,
      triangles: r.info.render.triangles,
    }
  }

  function setup(): void {
    const s = ctx.state()
    if (sc?.fight) {
      for (let i = 0; i < 4 && s.alarm.stage < 3; i++) {
        s.alarm.cooldown = 0
        raiseAlarm(s, ctx.sim, 'camera', s.player.pos.x, s.player.pos.y, s.player.pos.z)
      }
      s.alarm.wave = 2 // the biggest wave of config.alarm.waves (15 worms, a drone, 2 wardens, a heavy)
      s.alarm.waveTimer = 0.5
    }
  }

  // ---- the scripted hero: turns to the nearest enemy, walks at it, attacks, switches weapons
  let lonely = 0
  function fight(f: number): void {
    const s = ctx.state()
    const a = s.alarm
    s.player.hp = 9999
    if (!a.waveActive) {
      a.wave = 2
      a.wavesCleared = 0
      a.firewallDown = false
      if (a.waveTimer > 1.5) a.waveTimer = 1.5
    }
    const p = s.player.pos
    let best = 1e9
    let tx = 0
    let tz = 0
    let ty = 0
    const consider = (x: number, y: number, z: number): void => {
      const d = (x - p.x) ** 2 + (z - p.z) ** 2
      if (d < best) {
        best = d
        tx = x
        ty = y
        tz = z
      }
    }
    for (const w of s.worms) if (w.active && w.alive && Math.abs(w.pos.y - p.y) < 1.5) consider(w.pos.x, w.pos.y + 0.3, w.pos.z)
    for (const d of s.drones) if (d.active && d.alive) consider(d.pos.x, d.pos.y, d.pos.z)
    for (const w of s.wardens) if (w.alive && Math.abs(w.pos.y - p.y) < 1.5) consider(w.pos.x, w.pos.y + 1.2, w.pos.z)
    const rig = ctx.view.rig
    // no ground enemy within reach for a while (they may be held behind a gate or a wall): step next to the nearest one, so the fight
    // always happens (the script only has to be deterministic, not smart)
    let gx = 0
    let gz = 0
    let gbest = 1e9
    for (const w of s.worms) {
      const d = (w.pos.x - p.x) ** 2 + (w.pos.z - p.z) ** 2
      if (w.active && w.alive && d < gbest && Math.abs(w.pos.y - p.y) < 1.5) {
        gbest = d
        gx = w.pos.x
        gz = w.pos.z
      }
    }
    if (gbest > 16) lonely++
    else lonely = 0
    if (lonely > 30 && gbest < 1e8) {
      lonely = 0
      const k = 2.5 / Math.sqrt(gbest)
      p.x = gx + (p.x - gx) * k
      p.z = gz + (p.z - gz) * k
    }
    if (best < 1e8) {
      let da = Math.atan2(tx - p.x, tz - p.z) - rig.yaw
      da = Math.atan2(Math.sin(da), Math.cos(da))
      rig.yaw += Math.max(-0.12, Math.min(0.12, da))
      // the camera sits behind and above the hero: tip it so the crosshair ray meets the target (positive pitch looks down)
      const want = -Math.atan2(ty - (p.y + 1.6), Math.sqrt(best) + 4)
      rig.pitch += Math.max(-0.1, Math.min(0.1, want - rig.pitch))
    } else rig.yaw += 0.02
    const h = ctx.input.held
    h['attack'] = true
    h['forward'] = best > 6
    h['run'] = f % 360 < 120
    h['aim'] = false
    if (f % 240 === 100) ctx.input.pressed['switchMode'] = (ctx.input.pressed['switchMode'] ?? 0) + 1
  }

  // ---- the scan routes: the low bridge of arena 2 is the straight line of cells through the laser, out to the banks
  // (found by the level's data, so a reshaped plan keeps working)
  const route: { ax: number; az: number; bx: number; bz: number } = { ax: 0, az: 0, bx: 0, bz: 0 }
  let leg = 0 // 0: towards b, 1: back to a
  const start = { x: 0, y: 0, z: 0, yaw: 0 }
  function findRoute(): void {
    const g = levelGrid(ctx.sim)
    const cs = g.cell
    const laser = ctx.state().lasers[0]
    // the laser plane is across the bridge: its plan cell is the middle of the run
    const lx = laser ? (laser.alongX ? laser.coord : (laser.min + laser.max) / 2) : (g.cols * cs) / 2
    const lz = laser ? (laser.alongX ? (laser.min + laser.max) / 2 : laser.coord) : (g.rows * cs) / 2
    const c0 = Math.floor(lx / cs)
    const r0 = Math.floor(lz / cs)
    const open = (c: number, r: number): boolean => {
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false
      const k = g.kind[r * g.cols + c]
      return k !== CellKind.Void && k !== CellKind.Wall
    }
    // the bridge runs along the axis whose neighbours are open (the sides are the void)
    const alongZ = open(c0, r0 - 1) && open(c0, r0 + 1)
    const dc = alongZ ? 0 : 1
    const dr = alongZ ? 1 : 0
    // out over the bridge, then four cells onto the bank (where the cells beside the route are open again)
    const reach = (sign: number): [number, number] => {
      let c = c0
      let r = r0
      let past = 0
      for (let i = 0; i < 40; i++) {
        const nc = c + dc * sign
        const nr = r + dr * sign
        if (!open(nc, nr)) break
        c = nc
        r = nr
        if (alongZ ? open(c - 1, r) || open(c + 1, r) : open(c, r - 1) || open(c, r + 1)) past++
        if (past >= 4) break
      }
      return [c, r]
    }
    const a = reach(-1)
    const b = reach(1)
    route.ax = (a[0] + 0.5) * cs
    route.az = (a[1] + 0.5) * cs
    route.bx = (b[0] + 0.5) * cs
    route.bz = (b[1] + 0.5) * cs
  }
  function scanRoute(f: number): void {
    const s = ctx.state()
    const m = (sc as Scenario).scan as NonNullable<Scenario['scan']>
    const p = s.player.pos
    if (f === 0) {
      findRoute()
      // `&at=col,row` (or `route<N>`: the first waypoint of drone route N), `&yaw=deg` and `&pitch=deg` put the hero elsewhere (the still-image scripts)
      const g = levelGrid(ctx.sim)
      const routeAt = /^route(\d+)$/.exec(params.get('at') ?? '')
      const wp = routeAt ? s.routes[Number(routeAt[1])]?.[0] : undefined
      const at = wp ? [Math.floor(wp.x / g.cell), Math.floor(wp.z / g.cell) + 1] : params.get('at')?.split(',').map(Number)
      start.yaw = Math.atan2(route.bx - route.ax, route.bz - route.az)
      start.x = route.ax
      start.z = route.az
      if (at && at.length === 2 && Number.isFinite(at[0]) && Number.isFinite(at[1])) {
        start.x = ((at[0] as number) + 0.5) * g.cell
        start.z = ((at[1] as number) + 0.5) * g.cell
      }
      start.y = floorHeightAt(g, start.x, start.z)
      if (params.has('yaw')) start.yaw = (Number(params.get('yaw')) * Math.PI) / 180
    }
    if (f < 30) {
      // the game may still load its checkpoint over the first frames: keep putting the hero on the spot until it stays
      p.x = start.x
      p.y = start.y
      p.z = start.z
      s.player.vel.x = s.player.vel.y = s.player.vel.z = 0
      ctx.view.rig.yaw = start.yaw
      if (params.has('pitch')) ctx.view.rig.pitch = (Number(params.get('pitch')) * Math.PI) / 180
    }
    s.player.hp = 9999
    // the devices never notice the hero: the scenario measures the drawing of network vision, not a chase (and stays the same every run)
    s.alarm.stage = 0
    for (const d of s.drones) d.suspicion = 0
    for (const w of s.wardens) w.suspicion = 0
    for (const c of s.cameras) c.suspicion = 0
    for (const l of s.lasers) l.pausedTime = 1e9 // T1 solved: the laser is down
    s.scan.held = 0 // never overheats (that would raise the alarm)
    const h = ctx.input.held
    h['scan'] = m.hold && params.get('hold') !== '0'
    const tx = leg === 0 ? route.bx : route.ax
    const tz = leg === 0 ? route.bz : route.az
    if (Math.hypot(tx - p.x, tz - p.z) < 1.2) leg = 1 - leg
    let da = Math.atan2(tx - p.x, tz - p.z) - ctx.view.rig.yaw
    da = Math.atan2(Math.sin(da), Math.cos(da))
    if (m.move !== 'none') ctx.view.rig.yaw += Math.max(-0.12, Math.min(0.12, da))
    h['forward'] = m.move !== 'none' && Math.abs(da) < 0.6 // turn on the spot at the ends
    h['run'] = m.move === 'run'
  }

  // ---- synthetic effect bursts (the real handlers run: sounds, sparks, flashes, hit-stop, camera kick)
  let k = 0
  function burst(): void {
    const s = ctx.state()
    const ev = ctx.sim.events as GameEvent[]
    const p = s.player.pos
    const yaw = ctx.view.rig.yaw
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const at = (d: number, side: number): { x: number; y: number; z: number } => ({ x: p.x + fx * d + fz * side, y: p.y + 1, z: p.z + fz * d - fx * side })
    const nW = Math.max(1, s.worms.length)
    const nD = Math.max(1, s.drones.length)
    k++
    for (const c of sc?.cats ?? []) {
      switch (c) {
        case 'sword':
          ev.push({ type: 'swordSwing', yaw, combo: k % 3 })
          for (let i = 0; i < 3; i++) ev.push({ type: 'targetHit', target: 'worm', index: (k + i) % nW, ...at(2 + i, i - 1), killed: false, byRifle: false })
          ev.push({ type: 'targetHit', target: 'drone', index: k % nD, ...at(3, 0), killed: false, byRifle: false })
          break
        case 'shots':
          for (let i = 0; i < 3; i++) {
            const to = at(8, i - 1)
            ev.push({ type: 'rifleShot', fromX: p.x, fromY: p.y + 1.2, fromZ: p.z, toX: to.x, toY: to.y, toZ: to.z, hit: i !== 1 })
            ev.push({ type: 'boltHit', ...to, player: false })
          }
          ev.push({ type: 'targetHit', target: 'drone', index: k % nD, ...at(6, 0), killed: false, byRifle: true })
          ev.push({ type: 'droneFired', index: k % nD })
          break
        case 'worm':
          for (let i = 0; i < 4; i++) ev.push({ type: 'targetHit', target: 'worm', index: (k + i) % nW, ...at(3 + i, i - 2), killed: i % 2 === 0, byRifle: false })
          ev.push({ type: 'wormPack', gate: 0, count: 5, role: 'wave' })
          ev.push({ type: 'wormBite', index: k % nW, hit: true })
          ev.push({ type: 'wormWindup', index: k % nW })
          break
        case 'drone':
          ev.push({ type: 'targetHit', target: 'drone', index: k % nD, ...at(4, 0), killed: false, byRifle: false })
          ev.push({ type: 'targetHit', target: 'drone', index: (k + 1) % nD, ...at(5, 1), killed: true, byRifle: true })
          ev.push({ type: 'droneSpawned', index: k % nD, role: 'wave' })
          ev.push({ type: 'droneAlerted', index: k % nD })
          ev.push({ type: 'droneAiming', index: k % nD })
          break
        case 'warden':
          for (let i = 0; i < 3; i++) {
            ev.push({ type: 'wardenSpawned', index: i, gate: 0, heavy: i === 0 })
            ev.push({ type: 'shieldBlocked', index: i, ...at(4, i - 1) })
            ev.push({ type: 'wardenStruck', index: i, hit: false })
            ev.push({ type: 'wardenFired', index: i })
          }
          ev.push({ type: 'targetHit', target: 'warden', index: k % 3, ...at(4, 0), killed: k % 4 === 0, byRifle: false })
          break
        case 'hurt':
          ev.push({ type: 'playerHurt', amount: 10, hp: 40, fromX: p.x + fz * 3, fromZ: p.z - fx * 3 })
          break
        case 'audio':
          for (let i = 0; i < 10; i++) ctx.view.sound.playAt(SOUNDS[(k + i) % SOUNDS.length] as string, p.x + fz * (i - 5), p.z - fx * (i - 5), 0.4)
          break
        case 'hud':
          ctx.view.hud.toast(`bench toast ${k}`, k % 2 ? 'alarm' : 'good')
          ctx.view.hud.hit((k % 8) * 0.8, 0.7)
          ctx.view.hud.hint({ id: 'bench', text: `bench hint ${k % 5}` })
          break
      }
    }
  }

  function finish(): void {
    finished = true
    banner.remove()
    ctx.input.held['attack'] = ctx.input.held['forward'] = ctx.input.held['run'] = ctx.input.held['scan'] = false
    const end = snap()
    const sorted = frameMs.slice(WARMUP_FRAMES).sort((x, y) => x - y)
    const sum = sorted.reduce((x, y) => x + y, 0)
    const growth: string[] = []
    const m = snapMid ?? end
    for (const key of ['geometries', 'textures', 'programs', 'objects', 'voices'] as const) if (end[key] > m[key] + (key === 'voices' ? 8 : 0)) growth.push(`${key} ${m[key]} -> ${end[key]}`)
    if (end.heapMB > m.heapMB * 1.25 && end.heapMB - m.heapMB > 15) growth.push(`heap ${m.heapMB} -> ${end.heapMB} MB`)
    const causes: Record<string, number> = {}
    for (const l of longs) {
      const c = l.tags.some((x) => x.startsWith('prog+') || x.startsWith('geo+') || x.startsWith('tex+'))
        ? 'first use (shader/geometry/texture)'
        : l.tags.includes('gc')
          ? 'GC (heap dropped)'
          : l.tags.length > 0
            ? 'effects/spawns in the frame'
            : 'unknown (GPU/browser)'
      causes[c] = (causes[c] ?? 0) + 1
    }
    const res: BenchResult = {
      scenario: scName,
      level: ctx.level,
      sec: Math.round(toTime() * 10) / 10,
      frames: sorted.length,
      fps: sum > 0 ? Math.round((sorted.length / sum) * 10000) / 10 : 0,
      p50: pct(sorted, 0.5),
      p95: pct(sorted, 0.95),
      p99: pct(sorted, 0.99),
      max: sorted[sorted.length - 1] ?? 0,
      cpuAvg: cpuMs.reduce((x, y) => x + y, 0) / Math.max(1, cpuMs.length),
      cpuP95: pct(cpuMs.slice(WARMUP_FRAMES).sort((x, y) => x - y), 0.95),
      cpuMax: Math.max(0, ...cpuMs.slice(WARMUP_FRAMES)),
      hitStopPct: Math.round((hitStopFrames / Math.max(1, frame)) * 1000) / 10,
      allocKB: Math.round(allocBytes / 1024 / Math.max(1, frame)),
      cpuOver16: cpuMs.slice(WARMUP_FRAMES).filter((x) => x > 16).length,
      over33: sorted.filter((x) => x > 33).length,
      over50: sorted.filter((x) => x > 50).length,
      longs: longs.slice(0, 200),
      series,
      happened: { ...happened },
      pools: { worms: ctx.state().worms.length, drones: ctx.state().drones.length, wardens: ctx.state().wardens.length, bolts: ctx.state().bolts?.length ?? 0, events: ctx.sim.events.length },
      start: snapStart ?? end,
      mid: m,
      end,
      callsAvg: calls / Math.max(1, frame),
      callsMax,
      growth,
      spikeCauses: causes,
      pass: { p95: pct(sorted, 0.95) < 20, growth: growth.length === 0 },
    }
    perfProbe.status = `bench ${scName}: done p95 ${res.p95.toFixed(1)} ms`
    const key = 'bench.chain'
    let all: BenchResult[] = []
    if (chain) {
      try {
        all = step === 0 ? [] : (JSON.parse(sessionStorage.getItem(key) ?? '[]') as BenchResult[])
      } catch {
        all = []
      }
    }
    all.push(res)
    if (chain && step + 1 < ALL.length) {
      try {
        sessionStorage.setItem(key, JSON.stringify(all))
        const u = new URL(location.href)
        u.searchParams.set('bi', String(step + 1))
        location.replace(u.toString())
        return
      } catch {
        // storage refused: show what we have
      }
    }
    panel(all)
  }

  function panel(all: BenchResult[]): void {
    const gl = r.getContext()
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const json = JSON.stringify({ when: new Date().toISOString(), ua: navigator.userAgent, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', dpr: devicePixelRatio, size: [innerWidth, innerHeight], results: all }, null, 1)
    ;(window as unknown as Record<string, unknown>)['__benchResult'] = JSON.parse(json)
    const f = (x: number): string => x.toFixed(1)
    const rows = all
      .map((x) => `${x.scenario.padEnd(11)} ${f(x.fps).padStart(5)}fps p50 ${f(x.p50).padStart(5)} p95 ${f(x.p95).padStart(5)} p99 ${f(x.p99).padStart(5)} max ${f(x.max).padStart(6)} >33:${String(x.over33).padStart(3)} >50:${String(x.over50).padStart(3)} hitstop ${x.hitStopPct}% alloc ${x.allocKB}KB/f js p95 ${f(x.cpuP95)} max ${f(x.cpuMax)} >16:${x.cpuOver16} calls ${x.callsAvg.toFixed(0)}/${x.callsMax} ${x.pass.p95 ? 'ok ' : 'SLOW'} ${x.pass.growth ? '' : 'GROWTH: ' + x.growth.join(', ')}  ${Object.entries(x.spikeCauses).map(([a, b]) => `${b}x ${a}`).join('; ')}`)
      .join('\n')
    const box = document.createElement('div')
    box.style.cssText = 'position:fixed;inset:0;z-index:100;overflow:auto;background:rgba(0,6,10,0.94);color:#9fefff;font:12px/1.5 monospace;padding:20px;white-space:pre'
    box.textContent = `BENCH DONE   gpu: ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?'}   ${innerWidth}x${innerHeight}\npass = p95 < 20 ms and nothing grows. Software-GL numbers are for trends only.\n\n${rows}\n\n`
    const copy = document.createElement('button')
    copy.textContent = 'Copy JSON'
    copy.onclick = () => void navigator.clipboard?.writeText(json).catch(() => undefined)
    const dl = document.createElement('a')
    dl.textContent = '  Download JSON'
    dl.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    dl.download = `bench-${scName}.json`
    dl.style.color = '#4ff0ff'
    box.append(copy, dl)
    document.body.appendChild(box)
    void navigator.clipboard?.writeText(json).catch(() => undefined)
  }

  return {
    pre(now: number): number {
      if (!running || finished) return 0
      t1 = performance.now()
      r.info.reset()
      const ms = now - last
      last = now
      if (frame > 0) {
        frameMs.push(ms)
        // what changed since the last frame explains a spike: a first use, a GC
        tags = []
        const programs = r.info.programs?.length ?? 0
        if (programs > prevPrograms && frame > 1) tags.push(`prog+${programs - prevPrograms}`)
        if (r.info.memory.geometries > prevGeo && frame > 1) tags.push(`geo+${r.info.memory.geometries - prevGeo}`)
        if (r.info.memory.textures > prevTex && frame > 1) tags.push(`tex+${r.info.memory.textures - prevTex}`)
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        if (mem) {
          if (mem.usedJSHeapSize < prevHeap - 1048576) tags.push('gc')
          else if (mem.usedJSHeapSize > prevHeap) allocBytes += mem.usedJSHeapSize - prevHeap
          prevHeap = mem.usedJSHeapSize
        }
        prevPrograms = programs
        prevGeo = r.info.memory.geometries
        prevTex = r.info.memory.textures
        // the slow frame is the one that just ended: its events were noted in post()
        if (ms > 33 && longs.length < 400) {
          const seen = new Set<string>(tags)
          for (const e of lastEv) seen.add(e)
          longs.push({ t: Math.round(((now - t0) / 1000) * 100) / 100, ms: Math.round(ms * 10) / 10, cpu: Math.round(lastCpu * 10) / 10, tags: [...seen] })
        }
      }
      const t = toTime()
      if (frame === 3) snapStart = snap()
      if (t >= nextSnap) {
        series.push({ t: Math.round(t), ...snap() })
        nextSnap += every
      }
      if (!snapMid && t > secs / 2) snapMid = snap()
      if (t >= secs) {
        finish()
        return 0
      }
      const f = frame++
      if (sc.fight) fight(f)
      else if (sc.scan) scanRoute(f)
      else {
        ctx.view.rig.yaw += 0.01
        if (f % 8 === 0) burst()
      }
      // 1-6 sixtieths of a second, following the real frame time: on a slow machine the fight still advances (and on a fast one it is exactly 1/60)
      return STEP * Math.max(1, Math.min(6, Math.round(ms / 1000 / STEP)))
    },
    post(): void {
      if (!running || finished) return
      const cpu = performance.now() - t1
      cpuMs.push(cpu)
      calls += r.info.render.calls
      if (r.info.render.calls > callsMax) callsMax = r.info.render.calls
      lastCpu = cpu
      if (ctx.view.hitStop > 0) hitStopFrames++
      // the first network vision unlocks May's actives and her upgrade screen opens at the checkpoint; it stops the simulation: continue (E)
      if (sc?.scan && (window as unknown as { __game?: { mode: string } }).__game?.mode === 'card') document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }))
      for (const e of ctx.sim.events) {
        if (e.type in happened) happened[e.type] = (happened[e.type] ?? 0) + 1
        if (e.type === 'targetHit' && e.killed) happened['kills'] = (happened['kills'] ?? 0) + 1
      }
      lastEv.length = 0
      for (const e of ctx.sim.events) if (lastEv.length < 10 && !lastEv.includes(e.type)) lastEv.push(e.type)
      perfProbe.status = `bench ${scName}: ${toTime().toFixed(0)}/${secs} s, ${longs.length} slow frames`
    },
  }
}
