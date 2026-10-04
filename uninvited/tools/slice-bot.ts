// A scripted player for a level (balance check, not a test of the view): runs the real core on the real Rapier
// world with config.json, headless, and reports whether a "normal" player gets through.
//   bun tools/slice-bot.ts loud  [seeds] [normal|sloppy] [--level slice|l1]  - the Breaker: sprint through, fight everything, wait out the waves
//   bun tools/slice-bot.ts quiet [seeds] [normal|sloppy] [--level slice|l1]  - the Hacker: crouch-walk, wait for gaps, hack the terminals
// The routes of each level are in tools/bot-routes.ts (default level: the slice).
// The loud bot plays like a so-so human: it aims with a few degrees of error, reacts late, and dodges only half of
// the shots it sees fired. The quiet bot waits whenever the next steps would be seen, and takes 25-40 s per hack.
import { createRapierWorld, initPhysics } from '../adapters/physics-rapier'
import cfgJson from '../config.json'
import { attack, beginFrame, createIntent, hackPick, interact, moveTap, setAim, switchMode, tick, toggleCrouch, TAP_BACK, TAP_LEFT, TAP_RIGHT } from '../core/commands'
import type { GameConfig } from '../core/config'
import type { GameEvent } from '../core/events'
import { buildGrid, cellAt, CellKind, cellCenterX, cellCenterZ, floorHeightAt, hasFloor } from '../core/grid'
import { solveHack } from '../core/hack/index'
import { createRng, nextFloat, type Rng } from '../core/random'
import { seeFactor } from '../core/rules/detection'
import { sweepYaw } from '../core/rules/devices'
import { wardenLook } from '../core/rules/wardens'
import { createSim, createState, type GameState, type Sim } from '../core/state'
import { levelById } from '../levels/index'
import { ROUTES, type Step } from './bot-routes'

const cfg: GameConfig = cfgJson
const DT = 1 / 60
const DEBUG = process.env['BOT_DEBUG'] === '1'
/** "sloppy": a weaker player - slower to notice, worse aim, dodges fewer shots. */
const flagAt = process.argv.indexOf('--level')
const levelId = flagAt >= 0 ? (process.argv[flagAt + 1] ?? 'slice') : 'slice'
const ARGS = process.argv.filter((a, i) => i >= 2 && a !== '--level' && i !== flagAt + 1 || i < 2)
const level = levelById(levelId)
if (level.id !== levelId) throw new Error(`unknown level "${levelId}"`)
const SLOPPY = ARGS[4] === 'sloppy'
const REACT = SLOPPY ? 1.0 : 0.5
const AIM_ERR = SLOPPY ? 9 : 6
const DODGE = SLOPPY ? 0.2 : 0.5
const DEG = Math.PI / 180

await initPhysics()
const grid = buildGrid(level, cfg.world)

interface Result {
  won: boolean
  why: string
  time: number
  hp: number
  minHp: number
  alarms: number
  kills: number
  waves: number
  hitsTaken: number
  shotsAtPlayer: number
  wormBites: number
}

function cx(c: number): number {
  return cellCenterX(grid, c)
}
function cz(r: number): number {
  return cellCenterZ(grid, r)
}

// --- a fine walk grid for the quiet bot's path finding (0.5 m cells, inflated by the body radius) ---
const FINE = 0.5
const FC = Math.ceil((grid.cols * grid.cell) / FINE)
const FR = Math.ceil((grid.rows * grid.cell) / FINE)
const walk = new Uint8Array(FC * FR)
/** The red wall group on a fine cell (-1 none): it can be walked through once it is open. */
const wallOf = new Int16Array(FC * FR).fill(-1)
const fineH = new Float32Array(FC * FR)
for (let r = 0; r < FR; r++) {
  for (let c = 0; c < FC; c++) {
    const x = (c + 0.5) * FINE
    const z = (r + 0.5) * FINE
    let ok = true
    for (const [ox, oz] of [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]] as const) {
      const i = cellAt(grid, x + ox, z + oz)
      const k = i < 0 ? CellKind.Wall : grid.kind[i]
      if (!hasFloor(grid, i) || k === CellKind.Cover) ok = false
      if (k === CellKind.RedWall) wallOf[r * FC + c] = grid.group[i] as number
      for (const b of grid.blocks) if (x + ox > b.minX && x + ox < b.maxX && z + oz > b.minZ && z + oz < b.maxZ) ok = false
    }
    walk[r * FC + c] = ok ? 1 : 0
    fineH[r * FC + c] = floorHeightAt(grid, x, z)
  }
}
const dist = new Int32Array(FC * FR)
const queue = new Int32Array(FC * FR)
let fieldKey = -1
/** Which red walls are open (one bit per group), kept up to date by the play loop; the distance fields depend on it. */
let wallMask = 0
let fieldMask = -1

/** Distance field (in fine steps) towards the fine cell of (x, z); a step up more than 0.45 m is not allowed. */
function fieldTo(x: number, z: number): void {
  const key = Math.floor(z / FINE) * FC + Math.floor(x / FINE)
  if (key === fieldKey && wallMask === fieldMask) return
  fieldKey = key
  fieldMask = wallMask
  dist.fill(-1)
  let head = 0
  let tail = 0
  dist[key] = 0
  queue[tail++] = key
  while (head < tail) {
    const i = queue[head++] as number
    const c = i % FC
    const r = Math.floor(i / FC)
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= FC || nr >= FR) continue
      const j = nr * FC + nc
      if (dist[j] !== -1 || !walk[j] || ((wallOf[j] as number) >= 0 && !((wallMask >> (wallOf[j] as number)) & 1))) continue
      // walking from j to i: no climbing a ledge
      if ((fineH[i] as number) - (fineH[j] as number) > 0.45) continue
      dist[j] = (dist[i] as number) + 1
      queue[tail++] = j
    }
  }
}

/** A point a few steps along the shortest walk from (x, z) towards the current field's target. */
function walkStep(x: number, z: number, out: { x: number; z: number }): boolean {
  let i = Math.floor(z / FINE) * FC + Math.floor(x / FINE)
  if ((dist[i] ?? -1) < 0) return false
  for (let k = 0; k < 3; k++) {
    const c = i % FC
    const r = Math.floor(i / FC)
    let best = i
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const j = (r + dr) * FC + (c + dc)
      const d = dist[j] ?? -1
      if (d >= 0 && d < (dist[best] as number)) best = j
    }
    i = best
  }
  out.x = ((i % FC) + 0.5) * FINE
  out.z = (Math.floor(i / FC) + 0.5) * FINE
  return true
}
const stepOut = { x: 0, z: 0 }
if (process.env['BOT_MAP']) {
  // BOT_MAP="col,row" prints the walk grid around the plan with the distance field to that cell (debug)
  const [mc, mr] = (process.env['BOT_MAP'] as string).split(',').map(Number) as [number, number]
  wallMask = 3
  fieldTo(cx(mc), cz(mr))
  for (let rr = 17; rr <= 25; rr++) console.log(rr, [41.6, 42.1, 42.6, 43.1, 43.6].map((x) => dist[Math.floor(((rr + 0.5) * 2) / FINE) * FC + Math.floor(x / FINE)]).join(' '), [41.6, 42.1, 42.6, 43.1, 43.6].map((x) => walk[Math.floor(((rr + 0.5) * 2) / FINE) * FC + Math.floor(x / FINE)]).join(' '))
  for (let r = 0; r < FR; r += 2) {
    let line = ''
    for (let c = 0; c < FC; c += 2) line += !walk[r * FC + c] ? '#' : (dist[r * FC + c] as number) < 0 ? 'x' : '.'
    console.log(line)
  }
}

function droneVisible(s: GameState, sim: Sim, i: number): boolean {
  const d = s.drones[i]
  if (!d || !d.active || !d.alive || d.spawnTime > 0) return false
  const p = s.player.pos
  return sim.world.lineOfSight(p.x, p.y + 1.4, p.z, d.pos.x, d.pos.y, d.pos.z)
}

function play(seed: number, route: Step[], loud: boolean): Result {
  const physics = createRapierWorld(grid, { radius: cfg.player.radius, ...cfgJson.physics })
  const sim = createSim(level, cfg, physics, grid)
  const s = createState(sim, seed)
  const rng: Rng = createRng(seed * 7919 + 13)
  const intent = createIntent()
  let step = 0
  let stuck = 0
  let detour = 0
  let detourSide = 1
  let unsticks = 0
  let lastX = s.player.pos.x
  let lastZ = s.player.pos.z
  let strafe = 1
  let strafeT = 0
  const dodges: number[] = [] // times to dodge at
  const backDodges: number[] = [] // times to dash back (away from a worm about to bite)
  let hitsTaken = 0
  let shots = 0
  let minHp = s.player.hp
  let hackWait = 0
  let waiting = 0
  let camYaw = s.player.facing
  /** Per drone slot: game time from which the bot "knows" about it (Infinity = not noticed). */
  const knownAt: number[] = s.drones.map(() => Infinity)
  /** The same for worms (noticed in front, or heard skittering right next to you). */
  const wormKnownAt: number[] = s.worms.map(() => Infinity)
  let wormBites = 0

  let firstAlarm = ''
  const done = (won: boolean, why0: string): Result => {
    const why = firstAlarm ? `${why0} [first alarm: ${firstAlarm}]` : why0
    physics.dispose()
    return { won, why, time: s.time, hp: s.player.hp, minHp, alarms: s.run.alarmsRaised, kills: s.run.kills, waves: s.alarm.wavesCleared, hitsTaken, shotsAtPlayer: shots, wormBites }
  }

  let why = ''
  /** Would a crouched/standing player at (x, z) be seen by anyone in the next `ahead` seconds? */
  function unsafe(x: number, z: number, ahead: number): boolean {
    const p = s.player
    const ox = p.pos.x
    const oz = p.pos.z
    p.pos.x = x
    p.pos.z = z
    const vc = cfg.videoCamera
    let seen = false
    for (const c of s.cameras) {
      if (!c.alive || c.pausedTime > 0) continue
      for (let t = 0; t <= ahead && !seen; t += 0.25) {
        const yaw = sweepYaw(c.baseYaw, c.sweepA, c.sweepB, c.period, c.phase, vc.holdShare, s.time + t)
        const cp = Math.cos(vc.pitchDeg * DEG)
        const f = seeFactor(s, sim, c.pos.x, c.pos.y, c.pos.z, Math.sin(yaw) * cp, -Math.sin(vc.pitchDeg * DEG), Math.cos(yaw) * cp, Math.cos((vc.halfAngleDeg + 8) * DEG), vc.range + 1)
        if (f > 0) { seen = true; why = 'cam' + s.cameras.indexOf(c) }
      }
    }
    const dc = cfg.drone
    for (const d of s.drones) {
      if (seen) break
      if (!d.active || !d.alive || d.pausedTime > 0 || d.spawnTime > 0) continue
      // a drone may turn: anything within its range and line of sight close by counts, its cone further out
      const dist = Math.hypot(d.pos.x - x, d.pos.z - z)
      const cp = Math.cos(dc.pitchDeg * DEG)
      const cone = Math.cos((dist < 5 ? 179 : dc.halfAngleDeg + 25) * DEG)
      const f = seeFactor(s, sim, d.pos.x, d.pos.y, d.pos.z, Math.sin(d.yaw) * cp, -Math.sin(dc.pitchDeg * DEG), Math.cos(d.yaw) * cp, cone, dc.range + 1)
      if (f > 0) { seen = true; why = 'drone' + s.drones.indexOf(d) }
    }
    // wardens: their cone (where the head looks) widened for a turn, and never right next to one
    const wc = cfg.warden
    for (const w of s.wardens) {
      if (seen) break
      if (!w.alive || w.pausedTime > 0) continue
      if (Math.hypot(w.pos.x - x, w.pos.z - z) < 1.4) {
        seen = true
        why = 'wclose' + s.wardens.indexOf(w)
        break
      }
      const look = wardenLook(w)
      const cp = Math.cos(wc.pitchDeg * DEG)
      const f = seeFactor(s, sim, w.pos.x, w.pos.y + wc.eyeHeight, w.pos.z, Math.sin(look) * cp, -Math.sin(wc.pitchDeg * DEG), Math.cos(look) * cp, Math.cos((wc.halfAngleDeg + 30) * DEG), wc.range + 1.5)
      if (f > 0) { seen = true; why = 'warden' + s.wardens.indexOf(w) }
    }
    p.pos.x = ox
    p.pos.z = oz
    return seen
  }

  const last: GameEvent[] = [] // the events of the previous tick
  /** The next legs after `from` are out of every drone's reach and every camera's sweep for a while. */
  function wayClear(from: number): boolean {
    // a warden nearby must be walking its round with its back to us
    const p = s.player.pos
    for (const w of s.wardens) {
      if (!w.alive || w.pausedTime > 0 || Math.hypot(w.pos.x - p.x, w.pos.z - p.z) > 24) continue
      if (Math.hypot(w.pos.x - p.x, w.pos.z - p.z) > cfg.warden.range + 3) continue // far off: the checks of the next legs decide
      if (w.mode !== 'patrol' || w.act !== 'walk' || w.speed < 0.3) return false
      const off = Math.atan2(Math.sin(Math.atan2(p.x - w.pos.x, p.z - w.pos.z) - wardenLook(w)), Math.cos(Math.atan2(p.x - w.pos.x, p.z - w.pos.z) - wardenLook(w)))
      if (Math.abs(off) < 110 * DEG) return false
    }
    if (route[from]?.wardenGap) return true
    if (route[from]?.warden) {
      // wait until every warden is far from the next two stops (the dash through its street)
      for (const w of s.wardens) {
        if (!w.alive || w.pausedTime > 0) continue
        const exit = route[from + 2]
        if (!exit || Math.hypot(w.pos.x - cx(exit.at[0]), w.pos.z - cz(exit.at[1])) > 24) continue
        if (w.act !== 'stand' || w.actTime < 3) return false // go while it stands at the far end of its street
        for (const k of [from + 1, from + 2, from + 3]) {
          const st = route[k]
          if (route[from]?.warden !== 'stand' && st && Math.hypot(w.pos.x - cx(st.at[0]), w.pos.z - cz(st.at[1])) < 13) return false
        }
      }
    }
    for (let k = from + 1; k <= from + 3; k++) {
      const w = route[k]
      if (!w) break
      const x = cx(w.at[0])
      const z = cz(w.at[1])
      for (const d of s.drones) if (d.active && d.alive && d.pausedTime <= 0 && Math.hypot(d.pos.x - x, d.pos.z - z) < 9) return false
      if (unsafe(x, z, 3)) return false
    }
    return true
  }

  for (let frame = 0; frame < 60 * 600; frame++) {
    last.length = 0
    last.push(...sim.events)
    beginFrame(sim)
    const p = s.player
    if (s.phase === 'dead') return done(false, `died at step ${step} (${route[step]?.at.join(',')})`)
    if (s.phase === 'won') return done(true, 'took the file')
    minHp = Math.min(minHp, p.hp)

    if (DEBUG && s.hack) for (const e of last) if (e.type === 'alarmRaised' || e.type === 'droneAlerted' || e.type === 'wardenSuspicious' || e.type === 'cameraSpotted') console.log(`  (hacking) t=${s.time.toFixed(1)} ${JSON.stringify(e)}`)
    // hacking: stand at the console for a human-ish while, then solve it
    if (s.hack) {
      hackWait -= DT
      if (hackWait <= 0) {
        const sol = solveHack(s.hack.session)
        if (sol) for (const idx of sol) hackPick(s, sim, Math.floor(idx / s.hack.session.size), idx % s.hack.session.size)
      }
      intent.moveForward = intent.moveRight = 0
      tick(s, sim, DT, intent)
      continue
    }

    wallMask = 0
    for (let w = 0; w < s.walls.length; w++) if (s.walls[w]?.open) wallMask |= 1 << w
    if (DEBUG && process.env['BOT_TRACE'] && frame % 60 === 0 && (why = why) === why && s.time > Number(process.env['BOT_TRACE'])) console.log(`  t=${s.time.toFixed(0)} step ${step} at ${(p.pos.x / 2).toFixed(2)},${(p.pos.z / 2).toFixed(2)} y=${p.pos.y.toFixed(2)} crouched=${p.crouched} stuck=${stuck.toFixed(1)} wait=${waiting.toFixed(0)} w1=${s.wardens[0]?.pos.x.toFixed(0)},${s.wardens[0]?.pos.z.toFixed(0)} why=${why} ch=${p.charges} mode=${p.mode} drones=${s.drones.filter((d) => d.active && d.alive).map((d) => `${(d.pos.x / 2).toFixed(0)},${(d.pos.z / 2).toFixed(0)},${d.pos.y.toFixed(1)}`).join(";")} wardens=${s.wardens.filter((w) => w.alive).map((w) => `${(w.pos.x / 2).toFixed(0)},${(w.pos.z / 2).toFixed(0)}:${w.mode}`).join(";")} worms=${s.worms.filter((w) => w.active && w.alive).length}`)
    if (!firstAlarm) for (const e of last) if (e.type === 'alarmRaised') firstAlarm = `${e.reason} t=${s.time.toFixed(0)} step ${step} at ${(p.pos.x / 2).toFixed(1)},${(p.pos.z / 2).toFixed(1)}`
    if (!firstAlarm) for (const e of last) if (e.type === 'alarmRaised') firstAlarm = `${e.reason} t=${s.time.toFixed(0)} step ${step} at ${(p.pos.x / 2).toFixed(1)},${(p.pos.z / 2).toFixed(1)}`
    const target = route[step]
    if (!target) return done(false, 'route ended')
    const tx = cx(target.at[0])
    const tz = cz(target.at[1])
    const dist = Math.hypot(tx - p.pos.x, tz - p.pos.z)
    let wx = tx - p.pos.x
    let wz = tz - p.pos.z
    if (!loud || unsticks >= 3) {
      // walk around blocks and cover instead of into them (the loud bot only once it keeps getting stuck)
      fieldTo(tx, tz)
      if (walkStep(p.pos.x, p.pos.z, stepOut) && dist >= 0.7) {
        wx = stepOut.x - p.pos.x
        wz = stepOut.z - p.pos.z
        if (Math.hypot(wx, wz) < 0.05) {
          wx = tx - p.pos.x
          wz = tz - p.pos.z
        }
      }
    }
    let wantYaw = Math.atan2(wx, wz)
    let sprint = loud
    let hold = false

    // arrived?
    if (dist < 0.7) {
      if (target.act === 'firewall' && !s.alarm.firewallDown && s.walls.some((w) => !w.open)) hold = true
      else if (target.act === 'hack' && s.terminals.some((t) => !t.done && t.cooldown <= 0 && Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 1.7)) {
        interact(s, sim)
        hackWait = 25 + nextFloat(rng) * 15
      } else if (target.act === 'take') {
        interact(s, sim)
      } else if (target.quietWait && !wayClear(step)) {
        hold = true
        waiting += DT
      } else {
        if (target.act === 'crouch' && !p.crouched) toggleCrouch(s, sim)
        if (target.act === 'stand' && p.crouched) toggleCrouch(s, sim)
        step++
        stuck = 0
        if (DEBUG) console.log(`  [step ${step - 1} done at t=${s.time.toFixed(0)} waited ${waiting.toFixed(0)}]`)
      }
    }
    if (hold) {
      wx = 0
      wz = 0
    }

    // the loud player fights what it has noticed: drones in front of the camera (after a reaction time), or ones
    // that shoot at it from elsewhere (noticed late)
    if (loud) {
      for (let i = 0; i < s.drones.length; i++) {
        const d = s.drones[i]
        if (!d || !d.active || !d.alive || d.spawnTime > 0) {
          knownAt[i] = Infinity
          continue
        }
        if (knownAt[i] !== Infinity) continue
        const off = Math.abs(Math.atan2(Math.sin(Math.atan2(d.pos.x - p.pos.x, d.pos.z - p.pos.z) - camYaw), Math.cos(Math.atan2(d.pos.x - p.pos.x, d.pos.z - p.pos.z) - camYaw)))
        if (off < 35 * DEG && droneVisible(s, sim, i)) knownAt[i] = s.time + REACT + nextFloat(rng) * 0.6
      }
      for (const e of last) if ((e.type === 'droneFired' || e.type === 'droneAlerted') && knownAt[e.index] === Infinity) knownAt[e.index] = s.time + 1.2 + nextFloat(rng) * 0.8
      let best = -1
      let bestD = 18
      for (let i = 0; i < s.drones.length; i++) {
        const d = s.drones[i]
        if (!d || !d.active || !d.alive || d.spawnTime > 0 || (knownAt[i] as number) > s.time || !droneVisible(s, sim, i)) continue
        const dd = Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z)
        if (s.alarm.firewallDown && dd > 6) continue // after the firewall: just run for it
        if (dd < bestD) {
          bestD = dd
          best = i
        }
      }
      const bd = best >= 0 ? s.drones[best] : undefined
      let d: { pos: { x: number; y: number; z: number } } | undefined = bd
      // what the target is: drones hover out of the sword's reach (rifle only), a heavy warden's shield stops bolts from the front (sword)
      let dKind: 'drone' | 'warden' | 'heavy' = 'drone'
      // a warden fighting us in plain sight close by comes first (it hits hard in melee)
      for (const w of s.wardens) {
        if (!w.alive || w.mode !== 'alert') continue
        const dd = Math.hypot(w.pos.x - p.pos.x, w.pos.z - p.pos.z)
        if (dd > 9 || (d && dd > bestD) || !sim.world.lineOfSight(p.pos.x, p.pos.y + 1.4, p.pos.z, w.pos.x, w.pos.y + 1.4, w.pos.z)) continue
        d = { pos: { x: w.pos.x, y: w.pos.y + cfg.warden.chestHeight, z: w.pos.z } }
        dKind = w.heavy ? 'heavy' : 'warden'
        bestD = dd
      }
      // worms: a pack close by comes first, with the sword - turn to the thick of them and swing; drones at range
      // wait. Noticed in front (after the reaction time), or heard skittering right next to you.
      let wx0 = 0
      let wz0 = 0
      let wn = 0
      let nearW = Infinity
      for (let i = 0; i < s.worms.length; i++) {
        const w = s.worms[i]
        if (!w || !w.active || !w.alive || w.spawnTime > 0 || w.mode === 'emerge') {
          wormKnownAt[i] = Infinity
          continue
        }
        const dd = Math.hypot(w.pos.x - p.pos.x, w.pos.z - p.pos.z)
        if (wormKnownAt[i] === Infinity) {
          const bearing = Math.atan2(w.pos.x - p.pos.x, w.pos.z - p.pos.z)
          const off = Math.abs(Math.atan2(Math.sin(bearing - camYaw), Math.cos(bearing - camYaw)))
          if ((off < 40 * DEG && dd < 12) || dd < 3) wormKnownAt[i] = s.time + REACT * 0.8 + nextFloat(rng) * 0.4
          continue
        }
        if ((wormKnownAt[i] as number) > s.time || dd > 5.5) continue
        const k = 1 / Math.max(0.5, dd)
        wx0 += (w.pos.x - p.pos.x) * k
        wz0 += (w.pos.z - p.pos.z) * k
        wn += k
        if (dd < nearW) nearW = dd
      }
      if (wn > 0 && nearW < 4.5) dKind = 'warden'
      if (wn > 0 && nearW < 4.5) d = { pos: { x: p.pos.x + wx0 / wn, y: p.pos.y + 0.3, z: p.pos.z + wz0 / wn } }
      const fightingWorms = wn > 0 && nearW < 4.5
      if (d) {
        const dx = d.pos.x - p.pos.x
        const dz = d.pos.z - p.pos.z
        const hd = Math.hypot(dx, dz)
        const muzzleY = p.pos.y + cfg.combat.rifle.muzzleHeight
        const wantRifle = !fightingWorms && p.charges > 0 && (dKind === 'drone' || (dKind === 'warden' && hd > 4.5))
        // aim (RMB) with the rifle at a drone further away: the tighter spread
        setAim(s, sim, wantRifle && p.mode === 'rifle' && hd > 6)
        if ((p.mode === 'rifle') !== wantRifle && p.switchCooldown <= 0) switchMode(s, sim)
        wantYaw = Math.atan2(dx, dz)
        const off = Math.abs(Math.atan2(Math.sin(wantYaw - camYaw), Math.cos(wantYaw - camYaw)))
        const err = (nextFloat(rng) - 0.5) * 2 * AIM_ERR * DEG
        const aimPitch = Math.atan2(d.pos.y - muzzleY, hd) + (nextFloat(rng) - 0.5) * 2 * 3 * DEG
        if (off < 10 * DEG && !fightingWorms) attack(s, sim, camYaw + err, aimPitch)
        if (fightingWorms) {
          // hold the ground and swing when the closest is in reach (a little early, like a human mashing the button)
          wx = 0
          wz = 0
          sprint = false
          if (nearW > cfg.combat.sword.range + 0.3 && off < 10 * DEG) {
            // not yet in reach: do not swing at air
          } else if (off < 35 * DEG) attack(s, sim, camYaw + err, 0)
        } else if (dKind === 'drone' && p.charges <= 0) {
          // out of charges: a hovering drone cannot be cut, carry on
        } else if (p.mode === 'sword') {
          // close in
          wx = hd > 1.8 ? dx : 0
          wz = hd > 1.8 ? dz : 0
          sprint = true
        } else {
          // strafe while shooting
          strafeT -= DT
          if (strafeT <= 0) {
            strafe = -strafe
            strafeT = 0.8 + nextFloat(rng) * 0.8
          }
          wx = Math.cos(wantYaw) * strafe * -1
          wz = Math.sin(wantYaw) * strafe
          sprint = false
        }
      }
    } else {
      // the quiet player: only go on when the next metre is unseen for a while
      if (dist >= 0.7 && wx * wx + wz * wz > 0 && !target.dash) {
        const l = Math.hypot(wx, wz)
        const ax = p.pos.x + (wx / l) * Math.min(1.5, l)
        const az = p.pos.z + (wz / l) * Math.min(1.5, l)
        if (unsafe(ax, az, 1.5)) {
          if (!unsafe(p.pos.x, p.pos.z, 0.6)) {
            wx = 0
            wz = 0
            waiting += DT
          } else {
            // about to be seen where we stand: step to the nearby spot that stays hidden, nearest the goal first
            let bx = 0
            let bz = 0
            let bestD = Infinity
            for (let k = 0; k < 8; k++) {
              const a = (k * Math.PI) / 4
              const qx = p.pos.x + Math.sin(a) * 1.2
              const qz = p.pos.z + Math.cos(a) * 1.2
              const px = Math.cos(a) * 0.35
              const pz = -Math.sin(a) * 0.35
              const y = p.pos.y + 0.5
              if (!sim.world.lineOfSight(p.pos.x + px, y, p.pos.z + pz, qx + px, y, qz + pz)) continue
              if (!sim.world.lineOfSight(p.pos.x - px, y, p.pos.z - pz, qx - px, y, qz - pz)) continue
              if (!sim.world.lineOfSight(p.pos.x, y, p.pos.z, qx, y, qz)) continue
              if (unsafe(qx, qz, 1)) continue
              const dd = Math.hypot(tx - qx, tz - qz)
              if (dd < bestD) {
                bestD = dd
                bx = qx - p.pos.x
                bz = qz - p.pos.z
              }
            }
            if (bestD < Infinity) {
              wx = bx
              wz = bz
            } else {
              // nowhere hidden nearby: back off from the closest watching drone
              let fx = 0
              let fz = 0
              let fd = Infinity
              for (const d of s.drones) {
                if (!d.active || !d.alive || !d.sees) continue
                const dd = Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z)
                if (dd < fd) {
                  fd = dd
                  fx = p.pos.x - d.pos.x
                  fz = p.pos.z - d.pos.z
                }
              }
              if (fd < Infinity) {
                wx = fx
                wz = fz
              }
            }
          }
        }
      }
    }

    // dodge: react to some of the shots fired at us
    for (const e of last) {
      if (e.type === 'droneFired') {
        shots++
        if (loud && nextFloat(rng) < DODGE) dodges.push(s.time + 0.15 + nextFloat(rng) * 0.2)
      }
      if (e.type === 'playerHurt') hitsTaken++
      if (e.type === 'wormBite' && e.hit) wormBites++
      if (DEBUG && (e.type === 'wormWindup' || e.type === 'wormBite' || e.type === 'waveStarted' || e.type === 'wormPack' || (e.type === 'targetHit' && e.target === 'worm')))
        console.log(`  t=${s.time.toFixed(2)} hp ${p.hp} ${JSON.stringify(e)}`)
      // a worm rearing up right in front: step back out of its reach (sometimes)
      if (loud && e.type === 'wormWindup' && nextFloat(rng) < DODGE) {
        const w = s.worms[e.index]
        if (w && Math.hypot(w.pos.x - p.pos.x, w.pos.z - p.pos.z) < 2) backDodges.push(s.time + 0.12 + nextFloat(rng) * 0.15)
      }
      if (DEBUG && e.type === 'wardenSuspicious') console.log(`  t=${s.time.toFixed(1)} warden suspicious`, JSON.stringify(s.wardens[0]))
      if (DEBUG && (e.type === 'alarmRaised' || e.type === 'laserTripped' || e.type === 'playerHurt' || e.type === 'hackSolved' || e.type === 'hackTimedOut' || e.type === 'cameraSpotted' || e.type === 'sensorTripped' || e.type === 'soundHeard' || e.type === 'droneAlerted'))
        console.log(`  t=${s.time.toFixed(1)} step ${step} at ${(p.pos.x / 2).toFixed(1)},${(p.pos.z / 2).toFixed(1)} crouched=${p.crouched}: ${JSON.stringify(e)}`)
    }
    for (let k = dodges.length - 1; k >= 0; k--) {
      if ((dodges[k] as number) <= s.time) {
        dodges.splice(k, 1)
        const dir = nextFloat(rng) < 0.5 ? TAP_LEFT : TAP_RIGHT
        moveTap(s, sim, dir, camYaw)
        moveTap(s, sim, dir, camYaw)
      }
    }
    for (let k = backDodges.length - 1; k >= 0; k--) {
      if ((backDodges[k] as number) <= s.time) {
        backDodges.splice(k, 1)
        moveTap(s, sim, TAP_BACK, camYaw)
        moveTap(s, sim, TAP_BACK, camYaw)
      }
    }

    // stuck on something: slide sideways for a moment (alternating sides), give up after a while
    if (detour > 0) {
      detour -= DT
      const gl = Math.hypot(tx - p.pos.x, tz - p.pos.z) || 1
      const gx = (tx - p.pos.x) / gl
      const gz = (tz - p.pos.z) / gl
      wx = -gz * detourSide - gx * 0.3
      wz = gx * detourSide - gz * 0.3
    }
    const moved = Math.hypot(p.pos.x - lastX, p.pos.z - lastZ)
    lastX = p.pos.x
    lastZ = p.pos.z
    if (wx * wx + wz * wz > 0.01 && moved < 0.2 * DT) stuck += DT
    else stuck = Math.max(0, stuck - DT * 0.25)
    if (stuck > 0.5 && detour <= 0) {
      detour = 0.8
      detourSide = -detourSide
      unsticks++
    }
    if (unsticks > 40) {
      if (!loud) return done(false, `stuck at step ${step} (${target.at.join(',')}) at ${(p.pos.x / 2).toFixed(2)},${(p.pos.z / 2).toFixed(2)}`)
      unsticks = 0
    }

    // the camera turns like a mouse hand would (fast, not instant); the intent is relative to it
    const turn = Math.atan2(Math.sin(wantYaw - camYaw), Math.cos(wantYaw - camYaw))
    camYaw += Math.max(-6 * DT, Math.min(6 * DT, turn))
    const l = Math.hypot(wx, wz)
    const sy = Math.sin(camYaw)
    const cy = Math.cos(camYaw)
    intent.lookYaw = camYaw
    intent.moveForward = l > 1e-3 ? (sy * wx + cy * wz) / l : 0
    intent.moveRight = l > 1e-3 ? (-cy * wx + sy * wz) / l : 0
    intent.run = sprint && !p.crouched
    tick(s, sim, DT, intent)
  }
  return done(false, `timed out at step ${step} (${route[step]?.at.join(',')}) at ${(s.player.pos.x / 2).toFixed(2)},${(s.player.pos.z / 2).toFixed(2)} after waiting ${waiting.toFixed(0)} s`)
}

const mode = ARGS[2] === 'quiet' ? 'quiet' : 'loud'
if (ARGS[5] === 'old') {
  // the balance the designer could not beat, for comparison
  Object.assign(cfg.player, { maxHp: 100 })
  Object.assign(cfg.drone, { hp: 100, fireIntervalSec: 1.15, fireWindupSec: 0.6, aimSec: 0.05, boltSpeed: 15, boltDamage: 7 })
  Object.assign(cfg.combat.sword, { damage: 55 })
  Object.assign(cfg.alarm, { searchers: [0, 2, 3, 0], waveSizes: [2, 3, 4], waveFirstDelaySec: 3, waveGapSec: 6, maxWaveDrones: 5 })
}
const seeds = Number(ARGS[3] ?? 8)
const routes = ROUTES[level.id]
if (!routes) throw new Error(`no bot routes for level ${level.id} (tools/bot-routes.ts)`)
let wins = 0
for (let seed = 1; seed <= seeds; seed++) {
  const r = mode === 'loud' ? play(seed, routes.loud, true) : play(seed, routes.quiet, false)
  if (r.won) wins++
  console.log(
    `${level.id} ${mode} seed ${seed}: ${r.won ? 'WON ' : 'LOST'} ${r.why} | ${r.time.toFixed(0)} s, hp ${r.hp.toFixed(0)} (min ${r.minHp.toFixed(0)}/${cfg.player.maxHp}), ` +
      `alarms ${r.alarms}, kills ${r.kills}, waves cleared ${r.waves}, hits taken ${r.hitsTaken} (${r.wormBites} bites, ${r.shotsAtPlayer} shots)`,
  )
}
console.log(`${level.id} ${mode}: ${wins}/${seeds} won`)
