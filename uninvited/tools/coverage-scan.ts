// How much of a level the security sees, measured on the real core: the devices run for a while (cameras sweep, drones
// and wardens walk their routes) and at every step each floor cell is tested for a crouched hero (the real view cones and
// line of sight). Prints, per arena, the share of floor ever seen and seen over a fifth of the time, a map (0-9 = tenths of
// the time seen, q = the quiet bot's waypoints), and for every leg of the quiet route the longest start window in which
// the leg can be walked crouched without being seen at all.
//   bun tools/coverage-scan.ts [l1|slice] [--sec 90] [--map] [--legs]
import { createRapierWorld, initPhysics } from '../adapters/physics-rapier'
import cfgJson from '../config.json'
import { beginFrame, createIntent, tick } from '../core/commands'
import type { GameConfig } from '../core/config'
import { buildGrid, cellAt, cellCenterX, cellCenterZ, CellKind, floorHeightAt, hasFloor } from '../core/grid'
import { seeFactor } from '../core/rules/detection'
import { wardenLook } from '../core/rules/wardens'
import { createSim, createState } from '../core/state'
import type { LevelDef } from '../core/level'
import { levelById } from '../levels/index'
import { ROUTES, type Step } from './bot-routes'

const cfg: GameConfig = cfgJson
const DT = 1 / 60
const STEP = 0.25
const DEG = Math.PI / 180

export interface Leg {
  index: number
  to: readonly [number, number]
  meters: number
  seconds: number
  /** Share of start times with no sighting at all, and the longest such window (s). */
  clear: number
  window: number
  /** The same with a tolerance of 0.75 s in view (crouched suspicion fills at ~0.25 per second). */
  tolClear: number
  tolWindow: number
}

export interface Scan {
  grid: ReturnType<typeof buildGrid>
  cells: number[]
  shares: Map<number, number>
  legs(route: readonly Step[], from?: { x: number; z: number }): Leg[]
  start: { x: number; z: number }
}

/** Runs the level's devices for `sec` seconds and records, per step, which floor cells a crouched hero would be seen on. */
export async function scan(level: LevelDef, sec: number): Promise<Scan> {
  await initPhysics()
  const grid = buildGrid(level, cfg.world)
  const physics = createRapierWorld(grid, { radius: cfg.player.radius, ...cfgJson.physics })
  const sim = createSim(level, cfg, physics, grid)
  const s = createState(sim, 1)
  const intent = createIntent()
  const home = { x: s.player.pos.x, y: s.player.pos.y, z: s.player.pos.z }
  const cells: number[] = []
  for (let i = 0; i < grid.kind.length; i++) if (hasFloor(grid, i) && grid.kind[i] !== CellKind.Cover && grid.kind[i] !== CellKind.RedWall) cells.push(i)
  const cellX = (i: number): number => cellCenterX(grid, i % grid.cols)
  const cellZ = (i: number): number => cellCenterZ(grid, Math.floor(i / grid.cols))
  const steps = Math.floor(sec / STEP)
  const seen = new Uint8Array(steps * grid.kind.length)

  const seenAt = (x: number, z: number): boolean => {
    const p = s.player
    p.pos.x = x
    p.pos.z = z
    p.pos.y = floorHeightAt(grid, x, z)
    p.crouched = true
    const vc = cfg.videoCamera
    const dc = cfg.drone
    const wc = cfg.warden
    for (const c of s.cameras) {
      if (!c.alive || c.pausedTime > 0) continue
      const cp = Math.cos(vc.pitchDeg * DEG)
      if (seeFactor(s, sim, c.pos.x, c.pos.y, c.pos.z, Math.sin(c.yaw) * cp, -Math.sin(vc.pitchDeg * DEG), Math.cos(c.yaw) * cp, Math.cos(vc.halfAngleDeg * DEG), vc.range) > 0) return true
    }
    for (const d of s.drones) {
      if (!d.active || !d.alive || d.pausedTime > 0 || d.spawnTime > 0) continue
      const cp = Math.cos(dc.pitchDeg * DEG)
      if (seeFactor(s, sim, d.pos.x, d.pos.y, d.pos.z, Math.sin(d.yaw) * cp, -Math.sin(dc.pitchDeg * DEG), Math.cos(d.yaw) * cp, Math.cos(dc.halfAngleDeg * DEG), dc.range) > 0) return true
    }
    for (const w of s.wardens) {
      if (!w.alive || w.pausedTime > 0) continue
      const look = wardenLook(w)
      const cp = Math.cos(wc.pitchDeg * DEG)
      if (seeFactor(s, sim, w.pos.x, w.pos.y + wc.eyeHeight, w.pos.z, Math.sin(look) * cp, -Math.sin(wc.pitchDeg * DEG), Math.cos(look) * cp, Math.cos(wc.halfAngleDeg * DEG), wc.range) > 0) return true
      const dx = x - w.pos.x
      const dz = z - w.pos.z
      if (dx * dx + dz * dz < wc.closeDist ** 2 && Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - look), Math.cos(Math.atan2(dx, dz) - look))) < wc.closeHalfAngleDeg * DEG) return true
    }
    return false
  }

  for (let k = 0; k < steps; k++) {
    for (let f = 0; f < STEP / DT; f++) {
      beginFrame(sim)
      s.player.pos.x = home.x
      s.player.pos.y = home.y
      s.player.pos.z = home.z
      s.alarm.stage = 0
      tick(s, sim, DT, intent)
    }
    for (const i of cells) if (seenAt(cellX(i), cellZ(i))) seen[k * grid.kind.length + i] = 1
  }
  physics.dispose()

  const shares = new Map<number, number>()
  for (const i of cells) {
    let n = 0
    for (let k = 0; k < steps; k++) n += seen[k * grid.kind.length + i] as number
    shares.set(i, n / steps)
  }
  const legs = (route: readonly Step[], from0: { x: number; z: number } = { x: home.x, z: home.z }): Leg[] => {
    const out: Leg[] = []
    const v = cfg.player.crouchSpeed
    let from = from0
    for (let li = 0; li < route.length; li++) {
      const st = route[li] as Step
      const to = { x: cellCenterX(grid, st.at[0] - 0.5), z: cellCenterZ(grid, st.at[1] - 0.5) }
      const len = Math.hypot(to.x - from.x, to.z - from.z)
      const n = Math.max(1, Math.ceil(len / 0.5))
      const dur = len / v
      let clear = 0
      let best = 0
      let run = 0
      let tolClear = 0
      let tolBest = 0
      let tolRun = 0
      for (let k0 = 0; k0 < steps; k0++) {
        let exposed = 0
        for (let j = 0; j <= n; j++) {
          const t = k0 + Math.round(((j / n) * dur) / STEP)
          const i = cellAt(grid, from.x + ((to.x - from.x) * j) / n, from.z + ((to.z - from.z) * j) / n)
          if (i >= 0 && (seen[(t % steps) * grid.kind.length + i] as number)) exposed += dur / n
        }
        if (exposed === 0) {
          clear++
          run++
          best = Math.max(best, run)
        } else run = 0
        if (exposed <= 0.75) {
          tolClear++
          tolRun++
          tolBest = Math.max(tolBest, tolRun)
        } else tolRun = 0
      }
      out.push({ index: li, to: st.at, meters: len, seconds: dur, clear: clear / steps, window: best * STEP, tolClear: tolClear / steps, tolWindow: tolBest * STEP })
      from = to
    }
    return out
  }
  return { grid, cells, shares, legs, start: { x: home.x, z: home.z } }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const levelId = args.find((a) => !a.startsWith('--') && Number.isNaN(Number(a))) ?? 'l1'
  const secAt = args.indexOf('--sec')
  const SEC = secAt >= 0 ? Number(args[secAt + 1]) : 90
  const level = levelById(levelId)
  const r = await scan(level, SEC)
  const { grid, cells, shares } = r
  const arenas = level.arenas ?? [{ id: 'all', from: [0, 0] as const, to: [grid.cols - 1, grid.rows - 1] as const, walls: [] }]
  const q = new Set((ROUTES[level.id]?.quiet ?? []).map((st) => `${Math.round(st.at[0])},${Math.round(st.at[1])}`))
  for (const a of arenas) {
    let tot = 0
    let ever = 0
    let often = 0
    for (const i of cells) {
      const c = i % grid.cols
      const rr = Math.floor(i / grid.cols)
      if (c < a.from[0] || c > a.to[0] || rr < a.from[1] || rr > a.to[1]) continue
      tot++
      const sh = shares.get(i) as number
      if (sh > 0) ever++
      if (sh > 0.2) often++
    }
    console.log(`${a.id}: floor ${tot} cells, ever seen ${((100 * ever) / Math.max(1, tot)).toFixed(0)}%, seen over 20% of the time ${((100 * often) / Math.max(1, tot)).toFixed(0)}%`)
    if (args.includes('--map')) {
      for (let rr = a.from[1]; rr <= a.to[1]; rr++) {
        let line = ''
        for (let c = a.from[0]; c <= a.to[0]; c++) {
          const i = rr * grid.cols + c
          const k = grid.kind[i]
          line += k === CellKind.Void ? ' ' : k === CellKind.Wall ? '#' : k === CellKind.Cover ? 'o' : q.has(`${c},${rr}`) ? 'q' : cells.includes(i) ? String(Math.min(9, Math.floor((shares.get(i) as number) * 10))) : '?'
        }
        console.log(String(rr).padStart(3), line)
      }
    }
  }
  if (args.includes('--legs')) {
    for (const l of r.legs(ROUTES[level.id]?.quiet ?? [])) {
      if (l.clear < 1) console.log(`leg ${l.index} -> [${l.to}] ${l.meters.toFixed(1)} m ${l.seconds.toFixed(1)} s: never seen for ${(100 * l.clear).toFixed(0)}% of start times (window ${l.window.toFixed(1)} s); under 0.75 s seen for ${(100 * l.tolClear).toFixed(0)}% (window ${l.tolWindow.toFixed(1)} s)`)
    }
  }
}
