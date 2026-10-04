// Worms (DESIGN 9): small, fast melee programs that crawl out of the spawn gates in packs of 4-6 and rush the player
// along the floor - straight when the way is clear, otherwise along the grid's flow field. Close up a worm stops and
// rears up (the telegraph), then bites; stepping back or dashing dodges it. One sword swing cuts down a whole pack, the
// rifle needs a few shots each. At alarm 3 they come with the waves; at alarm 2 a pack joins the search.
import { cellAt, CellKind, cellCenterX, cellCenterZ, colOf, floorHeightAt, rowOf } from '../grid'
import type { Gate, GameState, Sim, WormRole, WormState } from '../state'
import { angleDiff, DEG, dist2, emit, turnTowards } from '../util'
import { randomSearchPoint } from './alarm'
import { hurtPlayer } from './combat'
import { pickGate, openGate } from './gates'
import { flyable, navDistance, nextCell } from './nav'
import { biteTokens, ringRadius } from './tokens'

/** Seconds between two line-of-sight checks of one worm (they are spread over the ticks). */
const THINK_SEC = 0.2

/** Is (x, z) floor a worm can be on (no walls, no niches, no closed red walls)? */
function walkable(sim: Sim, x: number, z: number): boolean {
  const c = cellAt(sim.grid, x, z)
  return c >= 0 && flyable(sim.crawl, c)
}

/** The top of what a worm crawls on at (x, z): the floor, low cover, a server block. */
export function wormGround(sim: Sim, x: number, z: number): number {
  const g = sim.grid
  let y = floorHeightAt(g, x, z)
  const c = cellAt(g, x, z)
  if (c >= 0 && g.kind[c] === CellKind.Cover) y += g.coverHeight
  for (const b of g.blocks) if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.maxY > y) y = b.maxY
  return y
}

/** Moves a worm by (dx, dz), sliding along walls (each axis checked at the body's edge). */
function moveBy(sim: Sim, w: WormState, dx: number, dz: number, r: number): void {
  if (dx !== 0) {
    const nx = w.pos.x + dx
    const ex = nx + (dx > 0 ? r : -r)
    if (walkable(sim, ex, w.pos.z - r * 0.7) && walkable(sim, ex, w.pos.z + r * 0.7)) w.pos.x = nx
  }
  if (dz !== 0) {
    const nz = w.pos.z + dz
    const ez = nz + (dz > 0 ? r : -r)
    if (walkable(sim, w.pos.x - r * 0.7, ez) && walkable(sim, w.pos.x + r * 0.7, ez)) w.pos.z = nz
  }
}

/** Crawls towards (gx, gz) along its yaw (turning fast), `speed` m/s. */
function crawl(sim: Sim, w: WormState, gx: number, gz: number, speed: number, dt: number): void {
  const dx = gx - w.pos.x
  const dz = gz - w.pos.z
  const l = Math.sqrt(dx * dx + dz * dz)
  if (l < 1e-4) return
  w.yaw = turnTowards(w.yaw, Math.atan2(dx, dz), sim.cfg.worm.turnRate * dt)
  // slow down while turning hard, so they do not orbit their goal
  const off = Math.abs(angleDiff(Math.atan2(dx, dz), w.yaw))
  const step = Math.min(l, speed * dt * (off > 1.2 ? 0.35 : 1))
  moveBy(sim, w, Math.sin(w.yaw) * step, Math.cos(w.yaw) * step, sim.cfg.worm.radius)
}

/** The next point on the way to (tx, tz): the next cell's centre on the flow field, or the point itself when in its cell. */
const way = { x: 0, z: 0 }
function wayTowards(sim: Sim, w: WormState, tx: number, tz: number): void {
  const g = sim.grid
  way.x = tx
  way.z = tz
  const from = cellAt(g, w.pos.x, w.pos.z)
  const to = cellAt(g, tx, tz)
  const next = nextCell(sim.crawl, from, to)
  if (next < 0) return
  way.x = cellCenterX(g, colOf(g, next))
  way.z = cellCenterZ(g, rowOf(g, next))
}

/** A clear crawl line from the worm to the player (low, so cover and ledges break it). */
function clearLine(s: GameState, sim: Sim, w: WormState, maxDist: number, eyeY: number): boolean {
  const p = s.player.pos
  if (dist2(w.pos.x, w.pos.z, p.x, p.z) > maxDist * maxDist) return false
  return sim.world.lineOfSight(w.pos.x, w.pos.y + 0.35, w.pos.z, p.x, p.y + eyeY, p.z)
}

/**
 * Brings a pack of `count` worms out of spawn gate `gateIndex` into free slots, one after another. Returns how many
 * came (fewer when the slots run out).
 */
export function spawnWormPack(s: GameState, sim: Sim, gateIndex: number, count: number, role: WormRole): number {
  const cfg = sim.cfg.worm
  const gate = sim.gates[gateIndex]
  if (!gate || count <= 0) return 0
  let n = 0
  for (let i = 0; i < s.worms.length && n < count; i++) {
    const w = s.worms[i] as WormState
    if (w.active) continue
    w.active = true
    w.alive = true
    w.role = role
    w.mode = 'emerge'
    w.hp = cfg.hp
    w.pos.x = gate.deep.x
    w.pos.y = gate.deep.y
    w.pos.z = gate.deep.z
    w.yaw = Math.atan2(gate.nx, gate.nz)
    w.gate = gateIndex
    w.spawnTime = cfg.spawnSec + n * cfg.gateStaggerSec
    w.timer = cfg.emergeSec
    w.target.x = s.alarm.center.x
    w.target.y = s.alarm.center.y
    w.target.z = s.alarm.center.z
    w.lost = 0
    w.stagger = 0
    w.pushX = 0
    w.pushZ = 0
    w.direct = false
    w.think = (i % 5) * (THINK_SEC / 5)
    // a fixed per-slot pace in [1 - spread, 1 + spread] (golden-ratio spacing: no two neighbours alike)
    w.pace = 1 + cfg.speedSpread * (((i * 0.618034) % 1) * 2 - 1)
    w.token = false
    w.tokenWait = 0
    w.regroup = 0
    w.ringDir = i % 2 === 0 ? 1 : -1
    n++
  }
  if (n > 0) {
    openGate(s, sim, gateIndex, cfg.spawnSec + n * cfg.gateStaggerSec + cfg.emergeSec * 0.6)
    emit(sim, { type: 'wormPack', gate: gateIndex, count: n, role })
  }
  return n
}

const used: number[] = []

/** A gate on the same side as one already used costs this many extra cells of crawl (so packs come from several sides,
 * but never from across the level when a near gate is free). */
const SAME_SIDE_CELLS = 8

/**
 * A gate for a wave's next worm pack: the usable gate (not right next to the player, reachable on foot) with the
 * shortest crawl to the player, where a gate whose bearing from the player is within 70 degrees of a gate already
 * used this wave counts SAME_SIDE_CELLS longer - packs tend to come from several sides. Falls back to pickGate.
 * Not a hot path.
 */
export function pickPackGate(s: GameState, sim: Sim, usedGates: readonly number[]): number {
  const p = s.player.pos
  const target = cellAt(sim.grid, p.x, p.z)
  const minD = sim.cfg.alarm.minSpawnDist
  let best = -1
  let bestCost = Infinity
  for (let i = 0; i < sim.gates.length; i++) {
    if (usedGates.includes(i)) continue
    const g = sim.gates[i] as Gate
    if (dist2(g.out.x, g.out.z, p.x, p.z) < minD * minD) continue
    const d = target >= 0 ? navDistance(sim.crawl, g.cell, target) : 0
    if (d < 0) continue
    const bearing = Math.atan2(g.out.x - p.x, g.out.z - p.z)
    let cost = d
    for (const u of usedGates) {
      const ug = sim.gates[u]
      if (ug && Math.abs(angleDiff(Math.atan2(ug.out.x - p.x, ug.out.z - p.z), bearing)) < (70 * Math.PI) / 180) {
        cost += SAME_SIDE_CELLS
        break
      }
    }
    if (cost < bestCost) {
      bestCost = cost
      best = i
    }
  }
  if (best >= 0) return best
  return pickGate(s, sim, p.x, p.z, usedGates.length)
}

/** Spawns a wave's worm packs (sizes) after its drones came out of `droneGates`; returns the worms spawned. */
export function spawnWavePacks(s: GameState, sim: Sim, sizes: readonly number[], droneGates: readonly number[]): number {
  used.length = 0
  for (const g of droneGates) used.push(g)
  let n = 0
  for (const size of sizes) {
    const g = pickPackGate(s, sim, used)
    if (g < 0) break
    used.push(g)
    n += spawnWormPack(s, sim, g, size, 'wave')
  }
  return n
}

/** Worms of a role that are still alive (in the level or coming out of a gate). */
export function liveWorms(s: GameState, role: WormRole): number {
  let n = 0
  for (const w of s.worms) if (w.active && w.alive && w.role === role) n++
  return n
}

/** A searcher worm is after the player right now (the alarm does not cool down meanwhile). */
export function wormsHunting(s: GameState): boolean {
  for (const w of s.worms) if (w.active && w.alive && w.role === 'searcher' && (w.mode === 'hunt' || w.mode === 'windup')) return true
  return false
}

/** The alarm moved (raised to `stage`, or the search centre moved): searchers come to look, at 3 everyone hunts. */
export function wormsOnAlarm(s: GameState, sim: Sim, x: number, z: number): void {
  const stage = s.alarm.stage
  const want = sim.cfg.alarm.searchPacks[stage] ?? 0
  if (stage < 3 && want > 0 && liveWorms(s, 'searcher') === 0) {
    const g = pickGate(s, sim, x, z, 0)
    if (g >= 0) spawnWormPack(s, sim, g, want, 'searcher')
  }
  for (const w of s.worms) {
    if (!w.active || !w.alive || w.role !== 'searcher') continue
    if (stage >= 3) {
      w.role = 'wave'
      if (w.mode === 'search' || w.mode === 'leave') w.mode = 'hunt'
    } else if (w.mode === 'search' || w.mode === 'leave') {
      w.mode = 'search'
      w.target.x = x
      w.target.z = z
    }
  }
}

/** The alarm cooled down to `stage`: searchers it no longer wants crawl back into a gate. */
export function wormsOnAlarmLowered(s: GameState, sim: Sim): void {
  if ((sim.cfg.alarm.searchPacks[s.alarm.stage] ?? 0) > 0) return
  for (const w of s.worms) if (w.active && w.alive && w.role === 'searcher' && w.mode !== 'emerge') w.mode = 'leave'
}

/** Damage from the gunblade; returns true when it killed the worm. A surviving worm is stopped and pushed back. */
export function damageWorm(s: GameState, sim: Sim, i: number, amount: number): boolean {
  const w = s.worms[i]
  if (!w || !w.active || !w.alive) return false
  w.hp -= amount
  if (w.hp <= 0) {
    w.alive = false
    w.active = false
    s.run.kills++
    return true
  }
  const cfg = sim.cfg.worm
  const p = s.player.pos
  const dx = w.pos.x - p.x
  const dz = w.pos.z - p.z
  const l = Math.sqrt(dx * dx + dz * dz) || 1
  w.stagger = cfg.staggerSec
  w.pushX = (dx / l) * cfg.knockback
  w.pushZ = (dz / l) * cfg.knockback
  if (w.mode === 'windup') {
    w.mode = 'hunt'
    w.timer = 0
    w.token = false
    w.regroup = sim.cfg.tokens.regroupSec * 0.5
  }
  if (w.role === 'searcher' && (w.mode === 'search' || w.mode === 'leave')) {
    w.mode = 'hunt'
    w.direct = true
    emit(sim, { type: 'wormSensed', index: i })
  }
  return false
}

/** 0..1 how far worm i is into its bite windup; 0 when not winding up. */
export function wormWindupProgress(s: GameState, sim: Sim, i: number): number {
  const w = s.worms[i]
  if (!w || !w.active || !w.alive || w.mode !== 'windup') return 0
  return Math.max(0, Math.min(1, 1 - w.timer / sim.cfg.worm.windupSec))
}

/** A searcher's next point: a random spot near the alarm it can crawl to (drones' search points may be over no floor). */
function searchPoint(s: GameState, sim: Sim, w: WormState): void {
  const from = cellAt(sim.grid, w.pos.x, w.pos.z)
  for (let tries = 0; tries < 4; tries++) {
    randomSearchPoint(s, sim, s.alarm.center.x, s.alarm.center.z, sim.cfg.alarm.searchRadius[s.alarm.stage] ?? 10, w.target)
    const c = cellAt(sim.grid, w.target.x, w.target.z)
    if (c >= 0 && from >= 0 && navDistance(sim.crawl, from, c) >= 0) return
  }
  w.target.x = w.pos.x
  w.target.z = w.pos.z
}

/** The gate a leaving worm can crawl to soonest, or -1. */
function nearestCrawlGate(sim: Sim, x: number, z: number): number {
  const from = cellAt(sim.grid, x, z)
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < sim.gates.length; i++) {
    const d = from >= 0 ? navDistance(sim.crawl, (sim.gates[i] as Gate).cell, from) : -1
    if (d >= 0 && d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Out of the gate: from behind it to its mouth, then down the wall (or from the ceiling) to the floor in front. */
function emergeStep(sim: Sim, w: WormState, dt: number): void {
  const cfg = sim.cfg.worm
  const gate = sim.gates[w.gate]
  w.timer -= dt
  if (!gate) {
    w.timer = 0
    return
  }
  const t = 1 - Math.max(0, w.timer) / cfg.emergeSec
  const fx = gate.mouth.x + gate.nx * 0.55
  const fz = gate.mouth.z + gate.nz * 0.55
  const fy = wormGround(sim, fx, fz)
  if (t < 0.35) {
    const k = smooth(t / 0.35)
    w.pos.x = gate.deep.x + (gate.mouth.x - gate.deep.x) * k
    w.pos.y = gate.deep.y + (gate.mouth.y - gate.deep.y) * k
    w.pos.z = gate.deep.z + (gate.mouth.z - gate.deep.z) * k
  } else {
    const k = (t - 0.35) / 0.65
    w.pos.x = gate.mouth.x + (fx - gate.mouth.x) * smooth(Math.min(1, k * 1.6))
    w.pos.z = gate.mouth.z + (fz - gate.mouth.z) * smooth(Math.min(1, k * 1.6))
    w.pos.y = gate.mouth.y + (fy - gate.mouth.y) * k * k
  }
  if (w.timer <= 0) {
    w.pos.x = fx
    w.pos.y = fy
    w.pos.z = fz
    w.mode = w.role === 'wave' ? 'hunt' : 'search'
  }
}

/**
 * Gives the free bite tokens to the hunting worms nearest the player (ties: the lower slot), those that already came
 * within the ring's reach. The others keep waiting on the ring.
 */
function grantBiteTokens(s: GameState, sim: Sim): void {
  const t = sim.cfg.tokens
  let free = t.bite - biteTokens(s)
  if (free <= 0) return
  const p = s.player.pos
  const reach = t.ringMax + 1.5
  while (free > 0) {
    let best = -1
    let bestD = reach * reach
    for (let i = 0; i < s.worms.length; i++) {
      const w = s.worms[i] as WormState
      if (!w.active || !w.alive || w.token || w.mode !== 'hunt' || w.spawnTime > 0 || w.stagger > 0 || w.regroup > 0) continue
      if (Math.abs(p.y - w.pos.y) > 1.5) continue
      const d = dist2(w.pos.x, w.pos.z, p.x, p.z)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) return
    const w = s.worms[best] as WormState
    w.token = true
    w.tokenWait = 0
    free--
  }
}

export function updateWorms(s: GameState, sim: Sim, dt: number): void {
  const cfg = sim.cfg.worm
  const p = s.player
  const playing = s.phase === 'playing'
  const r = cfg.radius
  if (playing) grantBiteTokens(s, sim)
  for (let i = 0; i < s.worms.length; i++) {
    const w = s.worms[i] as WormState
    if (!w.active || !w.alive) continue
    if (w.regroup > 0) w.regroup -= dt
    if (w.spawnTime > 0) {
      w.spawnTime -= dt
      continue
    }
    if (w.mode === 'emerge') {
      emergeStep(sim, w, dt)
      continue
    }

    // knockback and stagger
    if (w.pushX !== 0 || w.pushZ !== 0) {
      moveBy(sim, w, w.pushX * dt, w.pushZ * dt, r)
      const k = Math.max(0, 1 - dt * 8)
      w.pushX *= k
      w.pushZ *= k
      if (Math.abs(w.pushX) + Math.abs(w.pushZ) < 0.05) w.pushX = w.pushZ = 0
    }
    if (w.stagger > 0) {
      w.stagger -= dt
      w.pos.y += (wormGround(sim, w.pos.x, w.pos.z) - w.pos.y) * Math.min(1, dt * 14)
      continue
    }

    const dx = p.pos.x - w.pos.x
    const dz = p.pos.z - w.pos.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const dy = Math.abs(p.pos.y - w.pos.y)

    // a line check now and then (spread over the ticks)
    w.think -= dt
    const thinking = w.think <= 0
    if (thinking) w.think += THINK_SEC

    switch (w.mode) {
      case 'search': {
        const sense = p.crouched ? cfg.senseCrouchDist : cfg.senseDist
        if (playing && thinking && clearLine(s, sim, w, sense, p.crouched ? 0.6 : 1.2)) {
          w.mode = 'hunt'
          w.direct = true
          w.lost = 0
          emit(sim, { type: 'wormSensed', index: i })
          break
        }
        // a noise draws it
        const hear = sim.cfg.drone.hearFactor
        for (let k = 0; k < sim.noiseCount; k++) {
          const n = sim.noises[k]
          if (n && dist2(n.x, n.z, w.pos.x, w.pos.z) < n.radius * hear * n.radius * hear) {
            w.target.x = n.x
            w.target.z = n.z
          }
        }
        if (dist2(w.pos.x, w.pos.z, w.target.x, w.target.z) < 0.8 * 0.8) {
          searchPoint(s, sim, w)
        }
        wayTowards(sim, w, w.target.x, w.target.z)
        crawl(sim, w, way.x, way.z, cfg.searchSpeed * w.pace, dt)
        break
      }
      case 'hunt': {
        if (!playing) break
        if (w.token) {
          // a token that is not used soon goes back (the worm is stuck behind something): others get their turn
          w.tokenWait += dt
          if (w.tokenWait > sim.cfg.tokens.biteWaitSec) {
            w.token = false
            w.regroup = sim.cfg.tokens.regroupSec
          }
        }
        if (w.token && dist < cfg.biteRange && dy < 1.5) {
          w.mode = 'windup'
          w.timer = cfg.windupSec
          emit(sim, { type: 'wormWindup', index: i })
          break
        }
        let tx = p.pos.x
        let tz = p.pos.z
        if (w.role === 'searcher') {
          // a searcher follows what it senses; out of sense for a while, it goes back to searching
          if (thinking) w.direct = clearLine(s, sim, w, cfg.senseDist * 1.5, 1.0)
          if (w.direct) {
            w.lost = 0
            w.target.x = p.pos.x
            w.target.z = p.pos.z
          } else {
            w.lost += dt
            tx = w.target.x
            tz = w.target.z
            if (w.lost > cfg.loseSec) {
              w.mode = 'search'
              w.token = false
              break
            }
          }
        } else if (thinking) {
          w.direct = clearLine(s, sim, w, cfg.directDist, 0.35)
        }
        if (!w.token && w.direct && dist < sim.cfg.tokens.ringMax + 1.5 && dist > 1e-3) {
          // no token: hold the ring around the player and circle slowly until one is free
          const ring = ringRadius(sim, i)
          const b = Math.atan2(-dx, -dz) + w.ringDir * 0.35
          const fx = p.pos.x + Math.sin(b) * ring
          const fz = p.pos.z + Math.cos(b) * ring
          const ok = walkable(sim, fx, fz)
          if (dist > ring + 0.5) crawl(sim, w, ok ? fx : p.pos.x, ok ? fz : p.pos.z, cfg.speed * w.pace, dt)
          else if (ok) crawl(sim, w, fx, fz, cfg.speed * w.pace * 0.5, dt)
          break
        }
        if (w.direct) {
          way.x = tx
          way.z = tz
          // close in from its own side: a pack fans out around the player instead of queuing in front of one swing
          if (w.role === 'wave' && dist < cfg.flankDist && dist > cfg.biteRange) {
            const side = cfg.flankDeg * DEG * (((i * 0.618034) % 1) * 2 - 1)
            const k = Math.min(1, (dist - cfg.biteRange) / (cfg.flankDist - cfg.biteRange))
            const b = Math.atan2(-dx, -dz) + side * k
            const r = Math.max(cfg.biteRange * 0.7, dist - 1.2)
            const fx = p.pos.x + Math.sin(b) * r
            const fz = p.pos.z + Math.cos(b) * r
            if (walkable(sim, fx, fz)) {
              way.x = fx
              way.z = fz
            }
          }
        } else wayTowards(sim, w, tx, tz)
        crawl(sim, w, way.x, way.z, cfg.speed * w.pace, dt)
        break
      }
      case 'windup': {
        // reared up, locked on the player; at the end it snaps
        w.yaw = turnTowards(w.yaw, Math.atan2(dx, dz), cfg.turnRate * 0.6 * dt)
        w.timer -= dt
        if (w.timer > 0) break
        // the lunge
        moveBy(sim, w, Math.sin(w.yaw) * 0.35, Math.cos(w.yaw) * 0.35, r)
        const hit = playing && dist < cfg.biteReach && dy < 1.6 && hurtPlayer(s, sim, cfg.biteDamage, w.pos.x, w.pos.z)
        emit(sim, { type: 'wormBite', index: i, hit })
        w.mode = 'recover'
        w.timer = cfg.recoverSec
        break
      }
      case 'recover': {
        // backs off a little, still facing the player
        w.timer -= dt
        if (dist > 1e-3) moveBy(sim, w, (-dx / dist) * 1.2 * dt, (-dz / dist) * 1.2 * dt, r)
        w.yaw = turnTowards(w.yaw, Math.atan2(dx, dz), cfg.turnRate * dt)
        if (w.timer <= 0) {
          w.mode = 'hunt'
          w.token = false // the token comes back after the recovery
          w.regroup = sim.cfg.tokens.regroupSec * 0.5
        }
        break
      }
      case 'leave': {
        const g = nearestCrawlGate(sim, w.pos.x, w.pos.z)
        const gate = sim.gates[g]
        if (!gate || dist2(w.pos.x, w.pos.z, gate.out.x, gate.out.z) < 1.2 * 1.2) {
          w.active = false
          emit(sim, { type: 'wormLeft', index: i })
          break
        }
        wayTowards(sim, w, gate.out.x, gate.out.z)
        crawl(sim, w, way.x, way.z, cfg.searchSpeed * w.pace, dt)
        break
      }
      default:
        break
    }
    if (!w.active) continue
    // climb whatever is under it (floor, cover, server blocks)
    w.pos.y += (wormGround(sim, w.pos.x, w.pos.z) - w.pos.y) * Math.min(1, dt * 14)
  }
  separate(s, sim)
}

/** Worms keep a body apart from each other and from the player (a pack surrounds you instead of stacking). */
function separate(s: GameState, sim: Sim): void {
  const r = sim.cfg.worm.radius
  const min = r * 2.2
  const ws = s.worms
  const p = s.player.pos
  const pr = r + sim.cfg.player.radius
  for (let i = 0; i < ws.length; i++) {
    const a = ws[i] as WormState
    if (!a.active || !a.alive || a.spawnTime > 0 || a.mode === 'emerge') continue
    for (let j = i + 1; j < ws.length; j++) {
      const b = ws[j] as WormState
      if (!b.active || !b.alive || b.spawnTime > 0 || b.mode === 'emerge') continue
      const dx = b.pos.x - a.pos.x
      const dz = b.pos.z - a.pos.z
      const d2 = dx * dx + dz * dz
      if (d2 >= min * min) continue
      const d = Math.sqrt(d2)
      // exactly on top of each other: split along a fixed per-pair direction
      const nx = d > 1e-4 ? dx / d : Math.sin(i * 2.4 + j)
      const nz = d > 1e-4 ? dz / d : Math.cos(i * 2.4 + j)
      const push = (min - d) * 0.5
      moveBy(sim, a, -nx * push, -nz * push, r)
      moveBy(sim, b, nx * push, nz * push, r)
    }
    if (s.phase !== 'playing') continue
    const dx = a.pos.x - p.x
    const dz = a.pos.z - p.z
    const d2 = dx * dx + dz * dz
    if (d2 < pr * pr && Math.abs(a.pos.y - p.y) < 1.2) {
      const d = Math.sqrt(d2)
      const nx = d > 1e-4 ? dx / d : Math.sin(i * 2.4)
      const nz = d > 1e-4 ? dz / d : Math.cos(i * 2.4)
      moveBy(sim, a, nx * (pr - d), nz * (pr - d), r)
    }
  }
}
