// The horde (owner: WP3 Horde AI): one pool `monsters[]` with a `kind`, generalized from the old worm crowd AI.
// Swarm and infantry come out of spawn points in packs and go at the player - straight when the way is clear,
// otherwise along the grid's flow field. Close up a monster stops and rears up (the telegraph), then attacks; one
// sword swing cuts down a whole pack. WP0 keeps this base compiling and running for the swarm kinds; WP3 adds the
// ranged throw, sleepers, the spider leap, the shield and the walking nav of the infantry.
import { cellAt, CellKind, cellCenterX, cellCenterZ, colOf, floorHeightAt, rowOf } from '../grid'
import type { KindConfig, MonsterClass, MonsterKind, MonsterState } from '../model/monsters'
import type { KillInfo, TargetSphere } from '../model/common'
import type { GameState, Sim } from '../state'
import { angleDiff, DEG, dist2, emit, turnTowards } from '../util'
import { hurtPlayer } from './combat'
import { flyable, nextCell, type Nav } from './nav'
import { openSpawnPoint } from './spawns'
import { ringRadius, tokenFree } from './tokens'

/** Seconds between two line-of-sight checks of one monster (they are spread over the ticks). */
const THINK_SEC = 0.2

function kindOf(sim: Sim, m: MonsterState): KindConfig {
  return sim.cfg.horde.kinds[m.kind]
}

/** The ground navigation of a monster: swarm crawls over ledges, infantry and ranged walk. */
function navOf(sim: Sim, m: MonsterState): Nav {
  return m.cls === 'swarm' ? sim.crawl : sim.ground
}

/** Is (x, z) floor this monster can be on (no walls, closed portcullises)? */
function walkable(sim: Sim, m: MonsterState, x: number, z: number): boolean {
  const c = cellAt(sim.grid, x, z)
  return c >= 0 && flyable(navOf(sim, m), c)
}

/** The top of what a monster stands on at (x, z): the floor, low furniture. */
export function monsterGround(sim: Sim, x: number, z: number): number {
  const g = sim.grid
  let y = floorHeightAt(g, x, z)
  const c = cellAt(g, x, z)
  if (c >= 0 && g.kind[c] === CellKind.Cover) y += g.coverHeight
  return y
}

/** Moves a monster by (dx, dz), sliding along walls (each axis checked at the body's edge). */
function moveBy(sim: Sim, m: MonsterState, dx: number, dz: number, r: number): void {
  if (dx !== 0) {
    const nx = m.pos.x + dx
    const ex = nx + (dx > 0 ? r : -r)
    if (walkable(sim, m, ex, m.pos.z - r * 0.7) && walkable(sim, m, ex, m.pos.z + r * 0.7)) m.pos.x = nx
  }
  if (dz !== 0) {
    const nz = m.pos.z + dz
    const ez = nz + (dz > 0 ? r : -r)
    if (walkable(sim, m, m.pos.x - r * 0.7, ez) && walkable(sim, m, m.pos.x + r * 0.7, ez)) m.pos.z = nz
  }
}

/** Walks towards (gx, gz) along its yaw (turning fast), `speed` m/s. */
function crawl(sim: Sim, m: MonsterState, gx: number, gz: number, speed: number, dt: number): void {
  const dx = gx - m.pos.x
  const dz = gz - m.pos.z
  const l = Math.sqrt(dx * dx + dz * dz)
  if (l < 1e-4) return
  m.yaw = turnTowards(m.yaw, Math.atan2(dx, dz), sim.cfg.horde.turnRate * dt)
  // slow down while turning hard, so they do not orbit their goal
  const off = Math.abs(angleDiff(Math.atan2(dx, dz), m.yaw))
  const step = Math.min(l, speed * dt * (off > 1.2 ? 0.35 : 1))
  moveBy(sim, m, Math.sin(m.yaw) * step, Math.cos(m.yaw) * step, kindOf(sim, m).radius)
}

/** The next point on the way to (tx, tz): the next cell's centre on the flow field, or the point itself when in its cell. */
const way = { x: 0, z: 0 }
function wayTowards(sim: Sim, m: MonsterState, tx: number, tz: number): void {
  const g = sim.grid
  way.x = tx
  way.z = tz
  const from = cellAt(g, m.pos.x, m.pos.z)
  const to = cellAt(g, tx, tz)
  const next = nextCell(navOf(sim, m), from, to)
  if (next < 0) return
  way.x = cellCenterX(g, colOf(g, next))
  way.z = cellCenterZ(g, rowOf(g, next))
}

/** A clear line from the monster to the player (low, so furniture and ledges break it). */
function clearLine(s: GameState, sim: Sim, m: MonsterState, maxDist: number, eyeY: number): boolean {
  const p = s.player.pos
  if (dist2(m.pos.x, m.pos.z, p.x, p.z) > maxDist * maxDist) return false
  return sim.world.lineOfSight(m.pos.x, m.pos.y + 0.35, m.pos.z, p.x, p.y + eyeY, p.z)
}

/**
 * Brings a pack of `count` monsters of `kind` out of spawn point `point` into free slots, one after another. Returns
 * how many came (fewer when the pool runs out).
 * Contract WP4 -> WP3.
 */
export function spawnMonsters(s: GameState, sim: Sim, kind: MonsterKind, point: number, count: number): number {
  const cfg = sim.cfg.horde
  const k = cfg.kinds[kind]
  const sp = sim.spawns[point]
  if (!sp || count <= 0) return 0
  let n = 0
  for (let i = 0; i < s.monsters.length && n < count; i++) {
    const m = s.monsters[i] as MonsterState
    if (m.active) continue
    m.active = true
    m.alive = true
    m.kind = kind
    m.cls = k.cls
    m.mode = 'emerge'
    m.hp = k.hp
    m.pos.x = sp.deep.x
    m.pos.y = sp.deep.y
    m.pos.z = sp.deep.z
    m.yaw = Math.atan2(sp.nx, sp.nz)
    m.shieldYaw = m.yaw
    m.spawnPoint = point
    m.spawnTime = cfg.spawnSec + n * cfg.gateStaggerSec
    m.timer = cfg.emergeSec
    m.stagger = 0
    m.pushX = 0
    m.pushZ = 0
    m.direct = false
    m.think = (i % 5) * (THINK_SEC / 5)
    // a fixed per-slot pace in [1 - spread, 1 + spread] (golden-ratio spacing: no two neighbours alike)
    m.pace = 1 + k.speedSpread * (((i * 0.618034) % 1) * 2 - 1)
    m.token = false
    m.tokenWait = 0
    m.regroup = 0
    m.ringDir = i % 2 === 0 ? 1 : -1
    m.attackTimer = 0
    m.sleep = false
    n++
  }
  if (n > 0) {
    openSpawnPoint(s, sim, point, cfg.spawnSec + n * cfg.gateStaggerSec + cfg.emergeSec * 0.6)
    const st = s.spawnPoints[point]
    if (st) st.sinceUsed = 0
    emit(sim, { type: 'monsterPack', point, count: n, kind })
  }
  return n
}

/** Monsters of a class that are alive (in the level or coming out of a spawn point). Contract WP4 -> WP3. */
export function aliveByClass(s: GameState, cls: MonsterClass): number {
  let n = 0
  for (const m of s.monsters) if (m.active && m.alive && m.cls === cls) n++
  return n
}

/**
 * Wakes the sleepers of a level `sleepers` entity (the packed corridor): they stop standing still and hunt. Ripples to
 * neighbours (config horde.sleepers). Contract WP4 -> WP3; the body comes with WP3 (the entity spawns them asleep).
 */
export function wakeSleepers(s: GameState, sim: Sim, id: string): void {
  void s
  void sim
  void id
}

/** Fills `out` with monster i's hit sphere; false when it cannot be hit (free slot, dead, still behind its spawn point). */
export function monsterSphere(s: GameState, sim: Sim, i: number, out: TargetSphere): boolean {
  const m = s.monsters[i]
  if (!m || !m.active || !m.alive || m.spawnTime > 0) return false
  const k = kindOf(sim, m)
  out.x = m.pos.x
  out.y = m.pos.y + k.height
  out.z = m.pos.z
  out.r = k.hitRadius
  return true
}

/**
 * Damage from the gunblade; returns true when it killed the monster (and fills `out`). A surviving monster is stopped
 * and pushed back. Contract WP2 <-> WP3.
 */
export function damageMonster(s: GameState, sim: Sim, i: number, amount: number, byGun: boolean, out: KillInfo): boolean {
  void byGun
  const m = s.monsters[i]
  out.killed = false
  if (!m || !m.active || !m.alive) return false
  const k = kindOf(sim, m)
  m.hp -= amount
  out.kind = m.kind
  out.x = m.pos.x
  out.y = m.pos.y + k.height
  out.z = m.pos.z
  if (m.hp <= 0) {
    m.alive = false
    m.active = false
    s.run.kills++
    out.killed = true
    return true
  }
  const p = s.player.pos
  const dx = m.pos.x - p.x
  const dz = m.pos.z - p.z
  const l = Math.sqrt(dx * dx + dz * dz) || 1
  m.stagger = k.staggerSec
  m.pushX = (dx / l) * k.knockback
  m.pushZ = (dz / l) * k.knockback
  if (m.mode === 'windup') {
    m.mode = 'hunt'
    m.timer = 0
    m.token = false
    m.regroup = sim.cfg.horde.tokens.regroupSec * 0.5
  }
  return false
}

/** 0..1 how far monster i is into its attack windup; 0 when not winding up. */
export function monsterWindupProgress(s: GameState, sim: Sim, i: number): number {
  const m = s.monsters[i]
  if (!m || !m.active || !m.alive || m.mode !== 'windup') return 0
  return Math.max(0, Math.min(1, 1 - m.timer / kindOf(sim, m).windupSec))
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Out of the spawn point: from behind it to its mouth, then down the wall (or up from the floor) to the floor in front. */
function emergeStep(sim: Sim, m: MonsterState, dt: number): void {
  const cfg = sim.cfg.horde
  const sp = sim.spawns[m.spawnPoint]
  m.timer -= dt
  if (!sp) {
    m.timer = 0
    m.mode = 'hunt'
    return
  }
  const t = 1 - Math.max(0, m.timer) / cfg.emergeSec
  const fx = sp.mouth.x + sp.nx * 0.55
  const fz = sp.mouth.z + sp.nz * 0.55
  const fy = monsterGround(sim, fx, fz)
  if (t < 0.35) {
    const k = smooth(t / 0.35)
    m.pos.x = sp.deep.x + (sp.mouth.x - sp.deep.x) * k
    m.pos.y = sp.deep.y + (sp.mouth.y - sp.deep.y) * k
    m.pos.z = sp.deep.z + (sp.mouth.z - sp.deep.z) * k
  } else {
    const k = (t - 0.35) / 0.65
    m.pos.x = sp.mouth.x + (fx - sp.mouth.x) * smooth(Math.min(1, k * 1.6))
    m.pos.z = sp.mouth.z + (fz - sp.mouth.z) * smooth(Math.min(1, k * 1.6))
    m.pos.y = sp.mouth.y + (fy - sp.mouth.y) * k * k
  }
  if (m.timer <= 0) {
    m.pos.x = fx
    m.pos.y = fy
    m.pos.z = fz
    m.mode = 'hunt'
  }
}

/**
 * Gives the free tokens to the hunting monsters nearest the player (ties: the lower slot), those that already came
 * within the ring's reach. The others keep waiting on the ring.
 */
function grantTokens(s: GameState, sim: Sim): void {
  const reach = sim.cfg.horde.tokens.ringMax + 1.5
  const p = s.player.pos
  for (const kind of ['bite', 'strike'] as const) {
    let guard = sim.cfg.horde.tokens[kind]
    while (guard-- > 0 && tokenFree(s, sim, kind)) {
      let best = -1
      let bestD = reach * reach
      for (let i = 0; i < s.monsters.length; i++) {
        const m = s.monsters[i] as MonsterState
        if (!m.active || !m.alive || m.token || m.mode !== 'hunt' || m.spawnTime > 0 || m.stagger > 0 || m.regroup > 0) continue
        if (kindOf(sim, m).token !== kind) continue
        if (Math.abs(p.y - m.pos.y) > 1.5) continue
        const d = dist2(m.pos.x, m.pos.z, p.x, p.z)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      if (best < 0) break
      const m = s.monsters[best] as MonsterState
      m.token = true
      m.tokenWait = 0
    }
  }
}

export function updateHorde(s: GameState, sim: Sim, dt: number): void {
  const cfg = sim.cfg.horde
  const p = s.player
  const playing = s.phase === 'playing'
  if (playing) grantTokens(s, sim)
  for (let i = 0; i < s.monsters.length; i++) {
    const m = s.monsters[i] as MonsterState
    if (!m.active || !m.alive || m.cls === 'flyer') continue // flyers: rules/flyers.ts
    const k = kindOf(sim, m)
    const r = k.radius
    if (m.regroup > 0) m.regroup -= dt
    if (m.spawnTime > 0) {
      m.spawnTime -= dt
      continue
    }
    if (m.mode === 'emerge') {
      emergeStep(sim, m, dt)
      continue
    }
    if (m.mode === 'sleep') continue

    // knockback and stagger
    if (m.pushX !== 0 || m.pushZ !== 0) {
      moveBy(sim, m, m.pushX * dt, m.pushZ * dt, r)
      const f = Math.max(0, 1 - dt * 8)
      m.pushX *= f
      m.pushZ *= f
      if (Math.abs(m.pushX) + Math.abs(m.pushZ) < 0.05) m.pushX = m.pushZ = 0
    }
    if (m.stagger > 0) {
      m.stagger -= dt
      m.pos.y += (monsterGround(sim, m.pos.x, m.pos.z) - m.pos.y) * Math.min(1, dt * 14)
      continue
    }

    const dx = p.pos.x - m.pos.x
    const dz = p.pos.z - m.pos.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const dy = Math.abs(p.pos.y - m.pos.y)

    // a line check now and then (spread over the ticks)
    m.think -= dt
    const thinking = m.think <= 0
    if (thinking) m.think += THINK_SEC

    switch (m.mode) {
      case 'hunt': {
        if (!playing) break
        if (m.token) {
          // a token that is not used soon goes back (the monster is stuck behind something): others get their turn
          m.tokenWait += dt
          if (m.tokenWait > cfg.tokens.biteWaitSec) {
            m.token = false
            m.regroup = cfg.tokens.regroupSec
          }
        }
        if (m.token && dist < k.range && dy < 1.5) {
          m.mode = 'windup'
          m.timer = k.windupSec
          emit(sim, { type: 'monsterWindup', index: i })
          break
        }
        const tx = p.pos.x
        const tz = p.pos.z
        if (thinking) m.direct = clearLine(s, sim, m, cfg.directDist, 0.35)
        if (!m.token && m.direct && dist < cfg.tokens.ringMax + 1.5 && dist > 1e-3) {
          // no token: hold the ring around the player and circle slowly until one is free
          const ring = ringRadius(sim, i)
          const b = Math.atan2(-dx, -dz) + m.ringDir * 0.35
          const fx = p.pos.x + Math.sin(b) * ring
          const fz = p.pos.z + Math.cos(b) * ring
          const ok = walkable(sim, m, fx, fz)
          const sp = k.speed * m.pace
          if (dist > ring + 0.5) crawl(sim, m, ok ? fx : p.pos.x, ok ? fz : p.pos.z, sp, dt)
          else if (ok) crawl(sim, m, fx, fz, sp * 0.5, dt)
          break
        }
        if (m.direct) {
          way.x = tx
          way.z = tz
          // close in from its own side: a pack fans out around the player instead of queuing in front of one swing
          if (dist < cfg.flankDist && dist > k.range) {
            const side = cfg.flankDeg * DEG * (((i * 0.618034) % 1) * 2 - 1)
            const f = Math.min(1, (dist - k.range) / (cfg.flankDist - k.range))
            const b = Math.atan2(-dx, -dz) + side * f
            const rr = Math.max(k.range * 0.7, dist - 1.2)
            const fx = p.pos.x + Math.sin(b) * rr
            const fz = p.pos.z + Math.cos(b) * rr
            if (walkable(sim, m, fx, fz)) {
              way.x = fx
              way.z = fz
            }
          }
        } else wayTowards(sim, m, tx, tz)
        crawl(sim, m, way.x, way.z, k.speed * m.pace, dt)
        break
      }
      case 'windup': {
        // reared up, locked on the player; at the end it snaps
        m.yaw = turnTowards(m.yaw, Math.atan2(dx, dz), cfg.turnRate * 0.6 * dt)
        m.timer -= dt
        if (m.timer > 0) break
        // the lunge
        moveBy(sim, m, Math.sin(m.yaw) * 0.35, Math.cos(m.yaw) * 0.35, r)
        const hit = playing && dist < k.reach && dy < 1.6 && hurtPlayer(s, sim, k.damage, m.pos.x, m.pos.z)
        emit(sim, { type: 'monsterAttack', index: i, hit })
        m.mode = 'recover'
        m.timer = k.recoverSec
        break
      }
      case 'recover': {
        // backs off a little, still facing the player
        m.timer -= dt
        if (dist > 1e-3) moveBy(sim, m, (-dx / dist) * 1.2 * dt, (-dz / dist) * 1.2 * dt, r)
        m.yaw = turnTowards(m.yaw, Math.atan2(dx, dz), cfg.turnRate * dt)
        if (m.timer <= 0) {
          m.mode = 'hunt'
          m.token = false // the token comes back after the recovery
          m.regroup = cfg.tokens.regroupSec * 0.5
        }
        break
      }
      case 'leave': {
        // back to the nearest spawn point is WP3's; for now it just goes away
        m.active = false
        emit(sim, { type: 'monsterLeft', index: i })
        break
      }
      default:
        break
    }
    if (!m.active) continue
    // climb whatever is under it (floor, furniture)
    m.pos.y += (monsterGround(sim, m.pos.x, m.pos.z) - m.pos.y) * Math.min(1, dt * 14)
  }
  separate(s, sim)
}

/** Monsters keep a body apart from each other and from the player (a pack surrounds you instead of stacking). */
function separate(s: GameState, sim: Sim): void {
  const scale = sim.cfg.horde.separation.radiusScale
  const ms = s.monsters
  const p = s.player.pos
  for (let i = 0; i < ms.length; i++) {
    const a = ms[i] as MonsterState
    if (!a.active || !a.alive || a.cls === 'flyer' || a.spawnTime > 0 || a.mode === 'emerge') continue
    const ra = kindOf(sim, a).radius
    for (let j = i + 1; j < ms.length; j++) {
      const b = ms[j] as MonsterState
      if (!b.active || !b.alive || b.cls === 'flyer' || b.spawnTime > 0 || b.mode === 'emerge') continue
      const rb = kindOf(sim, b).radius
      const min = ((ra + rb) / 2) * scale
      const dx = b.pos.x - a.pos.x
      const dz = b.pos.z - a.pos.z
      const d2 = dx * dx + dz * dz
      if (d2 >= min * min) continue
      const d = Math.sqrt(d2)
      // exactly on top of each other: split along a fixed per-pair direction
      const nx = d > 1e-4 ? dx / d : Math.sin(i * 2.4 + j)
      const nz = d > 1e-4 ? dz / d : Math.cos(i * 2.4 + j)
      const push = (min - d) * 0.5
      moveBy(sim, a, -nx * push, -nz * push, ra)
      moveBy(sim, b, nx * push, nz * push, rb)
    }
    if (s.phase !== 'playing') continue
    const pr = ra + sim.cfg.player.radius
    const dx = a.pos.x - p.x
    const dz = a.pos.z - p.z
    const d2 = dx * dx + dz * dz
    if (d2 < pr * pr && Math.abs(a.pos.y - p.y) < 1.2) {
      const d = Math.sqrt(d2)
      const nx = d > 1e-4 ? dx / d : Math.sin(i * 2.4)
      const nz = d > 1e-4 ? dz / d : Math.cos(i * 2.4)
      moveBy(sim, a, nx * (pr - d), nz * (pr - d), ra)
    }
  }
}

/** Moves the projectiles (potions, junk), hits the player, spawns puddles. Stub: WP3 (the pool exists in state, nothing flies yet). */
export function updateProjectiles(s: GameState, sim: Sim, dt: number): void {
  void s
  void sim
  void dt
}
