// The gunblade (DESIGN 9): one weapon, two modes - a 180-degree sword arc close up, a faster but weaker rifle
// with a small spread cone and charges. Plus drone bolts and damage to the player.
import type { TargetKind } from '../events'
import { floorHeightAt } from '../grid'
import { nextFloat } from '../random'
import type { DroneState, GameState, Sim } from '../state'
import { angleDiff, DEG, emit, raySphere } from '../util'
import { callCheck } from './alarm'
import { makeNoise, makeNoiseAt } from './detection'
import { alertDrone } from './drones'
import { playerFrozen } from './movement'
import { damageWorm } from './worms'
import { alertWarden, wardenHit } from './wardens'
import { dropShards, shardsFor } from './shards'

/**
 * Hurts the player (bolts, lasers, bites) from (fromX, fromZ) - the player's own position when it has no direction.
 * Dashing can dodge, a short invulnerability follows every hit. Returns true when it hurt.
 */
export function hurtPlayer(s: GameState, sim: Sim, amount: number, fromX = s.player.pos.x, fromZ = s.player.pos.z): boolean {
  const p = s.player
  const cfg = sim.cfg.player
  if (s.phase !== 'playing' || p.invuln > 0) return false
  if (cfg.dashInvulnerable && p.dashTime > 0) return false
  p.hp = Math.max(0, p.hp - amount)
  p.invuln = cfg.hurtInvulnSec
  p.hitTime = cfg.hitAnimSec
  emit(sim, { type: 'playerHurt', amount, hp: p.hp, fromX, fromZ })
  if (p.hp <= 0) {
    s.phase = 'dead'
    s.hack = null
    s.scan.active = false
    s.run.deaths++
    emit(sim, { type: 'playerDied' })
  }
  return true
}

export function switchMode(s: GameState, sim: Sim): void {
  if (playerFrozen(s) || s.player.aiming) return // aiming holds the rifle
  const p = s.player
  p.mode = p.mode === 'sword' ? 'rifle' : 'sword'
  p.switchCooldown = sim.cfg.combat.switchSec
  emit(sim, { type: 'modeSwitched', mode: p.mode })
}

/** A target position and radius, written into these scratch fields. */
const tgt = { x: 0, y: 0, z: 0, r: 0 }

/** Fills `tgt` for target i of a kind, returns false when it cannot be hit. Lasers have two posts: 2*i and 2*i+1. */
function targetAt(s: GameState, sim: Sim, kind: TargetKind, i: number): boolean {
  const hr = sim.cfg.combat.hitRadius
  if (kind === 'drone') {
    const d = s.drones[i]
    if (!d || !d.active || !d.alive || d.spawnTime > 0) return false
    tgt.x = d.pos.x
    tgt.y = d.pos.y
    tgt.z = d.pos.z
    tgt.r = hr.drone
    return true
  }
  if (kind === 'warden') {
    const w = s.wardens[i]
    if (!w || !w.alive) return false
    tgt.x = w.pos.x
    tgt.y = w.pos.y + sim.cfg.warden.chestHeight
    tgt.z = w.pos.z
    tgt.r = sim.cfg.warden.hitRadius
    return true
  }
  if (kind === 'worm') {
    const w = s.worms[i]
    if (!w || !w.active || !w.alive || w.spawnTime > 0) return false
    tgt.x = w.pos.x
    tgt.y = w.pos.y + 0.25
    tgt.z = w.pos.z
    tgt.r = hr.worm
    return true
  }
  if (kind === 'videoCamera' || kind === 'soundCamera') {
    const c = kind === 'videoCamera' ? s.cameras[i] : s.soundCameras[i]
    if (!c || !c.alive) return false
    tgt.x = c.pos.x
    tgt.y = c.pos.y
    tgt.z = c.pos.z
    tgt.r = hr.camera
    return true
  }
  const l = s.lasers[i >> 1]
  if (!l || !l.alive) return false
  const end = (i & 1) === 0 ? l.min + 0.3 : l.max - 0.3
  tgt.x = l.alongX ? l.coord : end
  tgt.z = l.alongX ? end : l.coord
  tgt.y = l.floor + sim.cfg.laser.height * 0.5
  tgt.r = hr.laser
  return true
}

function targetCount(s: GameState, kind: TargetKind): number {
  if (kind === 'drone') return s.drones.length
  if (kind === 'worm') return s.worms.length
  if (kind === 'warden') return s.wardens.length
  if (kind === 'videoCamera') return s.cameras.length
  if (kind === 'soundCamera') return s.soundCameras.length
  return s.lasers.length * 2
}

/**
 * Distance along a normalized ray to the nearest shootable target (its hit sphere), or -1; nothing beyond maxDist.
 * The camera's aim point uses it, so a target under the crosshair is aimed at and not the wall behind it (DESIGN 9).
 */
export function pickTarget(s: GameState, sim: Sim, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number {
  let best = -1
  for (const kind of KINDS) {
    const n = targetCount(s, kind)
    for (let i = 0; i < n; i++) {
      if (!targetAt(s, sim, kind, i)) continue
      const t = raySphere(ox, oy, oz, dx, dy, dz, tgt.x, tgt.y, tgt.z, tgt.r)
      if (t >= 0 && t < maxDist && (best < 0 || t < best)) best = t
    }
  }
  return best
}

const KINDS: readonly TargetKind[] = ['drone', 'warden', 'worm', 'videoCamera', 'soundCamera', 'laser']

/** Applies damage; kills break things loudly and always bring someone to check (DESIGN 9). */
export function damageTarget(s: GameState, sim: Sim, kind: TargetKind, i: number, amount: number, byRifle: boolean): void {
  if (!targetAt(s, sim, kind, i)) return
  const x = tgt.x
  const y = tgt.y
  const z = tgt.z
  let killed = false
  if (kind === 'drone') {
    const d = s.drones[i] as DroneState
    d.hp -= amount
    killed = d.hp <= 0
    if (killed) {
      d.alive = false
      d.active = false
      s.run.kills++
    } else {
      alertDrone(s, sim, i)
    }
  } else if (kind === 'warden') {
    const w = s.wardens[i]
    if (!w) return
    // the heavy warden's shield: rifle bolts from the front stop on it (the sword cuts through, and so do bolts from the side or back)
    if (byRifle && w.heavy) {
      const p = s.player.pos
      const from = Math.atan2(p.x - w.pos.x, p.z - w.pos.z)
      if (Math.abs(angleDiff(from, w.yaw)) <= sim.cfg.warden.heavy.shieldHalfDeg * DEG) {
        emit(sim, { type: 'shieldBlocked', index: i, x, y, z })
        alertWarden(s, sim, i)
        return
      }
    }
    // armor: the rifle's charges hit it a little harder than their damage (about 8 shots or 3 sword hits)
    w.hp -= byRifle ? amount * sim.cfg.warden.rifleFactor : amount
    killed = w.hp <= 0
    if (killed) {
      w.alive = false
      w.speed = 0
      s.run.kills++
    } else wardenHit(s, sim, i)
  } else if (kind === 'worm') {
    killed = damageWorm(s, sim, i, amount)
  } else if (kind === 'laser') {
    const l = s.lasers[i >> 1]
    if (!l) return
    l.hp -= amount
    killed = l.hp <= 0
    if (killed) l.alive = false
  } else {
    const c = kind === 'videoCamera' ? s.cameras[i] : s.soundCameras[i]
    if (!c) return
    c.hp -= amount
    killed = c.hp <= 0
    if (killed) c.alive = false
  }
  emit(sim, { type: 'targetHit', target: kind, index: kind === 'laser' ? i >> 1 : i, x, y, z, killed, byRifle })
  if (killed && (kind === 'worm' || kind === 'drone' || kind === 'warden')) {
    const heavy = kind === 'warden' && (s.wardens[i]?.heavy ?? false)
    dropShards(s, sim, x, z, shardsFor(sim, kind, heavy), false)
  }
  makeNoiseAt(sim, x, y, z, killed ? sim.cfg.noise.kill : sim.cfg.noise.hit)
  if (killed && kind !== 'worm') {
    // (worms are the alarm's own: killing one is noise enough)
    if (kind !== 'drone' && kind !== 'warden') s.run.devicesBroken++
    if (s.alarm.stage < 3) callCheck(s, sim, x, y, z)
  }
}

/**
 * LMB: swing or fire at once when the weapon is ready (the same frame as the press); rate-limited by the weapon's
 * cooldown. A press that comes too early is kept for inputBufferSec and fires the moment it can (see fireBuffered).
 * main calls it every frame the button is held (press = false on the frames that are only a hold).
 */
export function attack(s: GameState, sim: Sim, aimYaw: number, aimPitch: number, press = true): void {
  const p = s.player
  if (playerFrozen(s)) return
  if (p.attackCooldown > 0 || p.switchCooldown > 0) {
    if (!press) return // a held button only repeats the attack: it is not kept once released
    p.attackBuffer = sim.cfg.player.inputBufferSec
    p.bufYaw = aimYaw
    p.bufPitch = aimPitch
    return
  }
  p.attackBuffer = 0
  if (p.mode === 'sword') swing(s, sim, aimYaw)
  else fire(s, sim, aimYaw, aimPitch)
}

/** Once per tick, after the timers ran: a buffered attack goes off as soon as the weapon is ready. */
export function fireBuffered(s: GameState, sim: Sim, dt: number): void {
  const p = s.player
  if (!(p.attackBuffer > 0)) return
  p.attackBuffer -= dt
  if (p.attackBuffer <= 0 || playerFrozen(s) || p.attackCooldown > 0 || p.switchCooldown > 0) return
  attack(s, sim, p.bufYaw, p.bufPitch, false)
}

function swing(s: GameState, sim: Sim, aimYaw: number): void {
  const p = s.player
  const cfg = sim.cfg.combat.sword
  // the combo: a swing soon after the last one goes on to the next step; the third is the wide finisher
  p.combo = p.comboTime <= cfg.comboWindowSec ? (p.combo + 1) % 3 : 0
  p.comboTime = 0
  const fin = p.combo === 2
  p.attackCooldown = fin ? cfg.finisher.cooldownSec : cfg.cooldownSec
  p.slashLen = fin ? cfg.finisher.animSec : cfg.animSec
  p.slashTime = p.slashLen
  p.facing = aimYaw
  emit(sim, { type: 'swordSwing', yaw: aimYaw, combo: p.combo })
  makeNoise(s, sim, sim.cfg.noise.sword)
  const half = ((fin ? cfg.finisher.arcDeg : cfg.arcDeg) / 2) * DEG
  const range = fin ? cfg.finisher.range : cfg.range
  const chestY = p.pos.y + sim.cfg.player.chestHeight
  const killsBefore = s.run.kills
  for (const kind of KINDS) {
    const n = targetCount(s, kind)
    for (let i = 0; i < n; i++) {
      if (!targetAt(s, sim, kind, i)) continue
      const dx = tgt.x - p.pos.x
      const dz = tgt.z - p.pos.z
      const d = Math.sqrt(dx * dx + dz * dz)
      if (d > range + tgt.r) continue
      if (tgt.y > p.pos.y + cfg.reachUp || tgt.y < p.pos.y - cfg.reachDown) continue
      if (d > 0.6 && Math.abs(angleDiff(Math.atan2(dx, dz), aimYaw)) > half) continue
      if (!sim.world.lineOfSight(p.pos.x, chestY, p.pos.z, tgt.x, tgt.y, tgt.z)) continue
      damageTarget(s, sim, kind, i, cfg.damage, false)
    }
  }
  // a finisher that cut down several: a big shard in front of the player
  if (fin && s.run.kills - killsBefore >= sim.cfg.shards.finisherKills) {
    dropShards(s, sim, p.pos.x + Math.sin(aimYaw) * 1.2, p.pos.z + Math.cos(aimYaw) * 1.2, 1, true)
  }
}

function fire(s: GameState, sim: Sim, aimYaw: number, aimPitch: number): void {
  const p = s.player
  const cfg = sim.cfg.combat.rifle
  p.attackCooldown = cfg.intervalSec
  if (p.charges <= 0) {
    emit(sim, { type: 'rifleEmpty' })
    return
  }
  p.charges--
  p.shootTime = cfg.animSec
  p.facing = aimYaw
  const ox = p.pos.x + Math.sin(aimYaw) * 0.4
  const oy = p.pos.y + cfg.muzzleHeight
  const oz = p.pos.z + Math.cos(aimYaw) * 0.4
  let dx = Math.sin(aimYaw) * Math.cos(aimPitch)
  let dy = Math.sin(aimPitch)
  let dz = Math.cos(aimYaw) * Math.cos(aimPitch)

  // aim assist: snap to the target closest to the aim line inside a small cone (third-person parallax)
  let bestCos = Math.cos(cfg.aimAssistDeg * DEG)
  let ax = 0
  let ay = 0
  let az = 0
  let assisted = false
  for (const kind of KINDS) {
    const n = targetCount(s, kind)
    for (let i = 0; i < n; i++) {
      if (!targetAt(s, sim, kind, i)) continue
      const tx = tgt.x - ox
      const ty = tgt.y - oy
      const tz = tgt.z - oz
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz)
      if (tl > cfg.range || tl < 1e-3) continue
      const c = (tx * dx + ty * dy + tz * dz) / tl
      if (c <= bestCos) continue
      if (!sim.world.lineOfSight(ox, oy, oz, tgt.x, tgt.y, tgt.z)) continue
      bestCos = c
      ax = tx / tl
      ay = ty / tl
      az = tz / tl
      assisted = true
    }
  }
  if (assisted) {
    dx = ax
    dy = ay
    dz = az
  }
  // spread: a random direction inside the cone (some shots miss, DESIGN 9)
  const spread = (p.aiming ? cfg.aimSpreadDeg : cfg.spreadDeg) * DEG * Math.sqrt(nextFloat(s.rng))
  const around = nextFloat(s.rng) * Math.PI * 2
  // two axes perpendicular to the shot
  let ux = -dz
  let uy = 0
  let uz = dx
  const ul = Math.sqrt(ux * ux + uz * uz) || 1
  ux /= ul
  uz /= ul
  const vx = dy * uz - dz * uy
  const vy = dz * ux - dx * uz
  const vz = dx * uy - dy * ux
  const ts = Math.tan(spread)
  const ca = Math.cos(around) * ts
  const sa = Math.sin(around) * ts
  dx += ux * ca + vx * sa
  dy += uy * ca + vy * sa
  dz += uz * ca + vz * sa
  const dl = Math.sqrt(dx * dx + dy * dy + dz * dz)
  dx /= dl
  dy /= dl
  dz /= dl

  let hitDist = sim.world.raycast(ox, oy, oz, dx, dy, dz, cfg.range)
  let hitKind: TargetKind | null = null
  let hitIndex = -1
  for (const kind of KINDS) {
    const n = targetCount(s, kind)
    for (let i = 0; i < n; i++) {
      if (!targetAt(s, sim, kind, i)) continue
      const t = raySphere(ox, oy, oz, dx, dy, dz, tgt.x, tgt.y, tgt.z, tgt.r)
      if (t >= 0 && t < hitDist) {
        hitDist = t
        hitKind = kind
        hitIndex = i
      }
    }
  }
  emit(sim, { type: 'rifleShot', fromX: ox, fromY: oy, fromZ: oz, toX: ox + dx * hitDist, toY: oy + dy * hitDist, toZ: oz + dz * hitDist, hit: hitKind !== null })
  makeNoise(s, sim, sim.cfg.noise.rifle)
  if (hitKind !== null) damageTarget(s, sim, hitKind, hitIndex, cfg.damage, true)
}

/** A drone fires a bolt at the player's chest. */
export function fireBolt(s: GameState, sim: Sim, d: DroneState, index: number): void {
  let b = null
  for (const x of s.bolts) {
    if (!x.active) {
      b = x
      break
    }
  }
  if (!b) return
  const cfg = sim.cfg.drone
  const p = s.player
  const tx = p.pos.x - d.pos.x
  const ty = p.pos.y + sim.cfg.player.chestHeight - d.pos.y
  const tz = p.pos.z - d.pos.z
  const l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1
  b.active = true
  b.life = cfg.boltLifeSec
  b.damage = cfg.boltDamage
  b.pos.x = d.pos.x + (tx / l) * 0.5
  b.pos.y = d.pos.y + (ty / l) * 0.5
  b.pos.z = d.pos.z + (tz / l) * 0.5
  b.vel.x = (tx / l) * cfg.boltSpeed
  b.vel.y = (ty / l) * cfg.boltSpeed
  b.vel.z = (tz / l) * cfg.boltSpeed
  emit(sim, { type: 'droneFired', index })
}

export function updateBolts(s: GameState, sim: Sim, dt: number): void {
  const p = s.player
  const pc = sim.cfg.player
  for (const b of s.bolts) {
    if (!b.active) continue
    b.life -= dt
    const stepX = b.vel.x * dt
    const stepY = b.vel.y * dt
    const stepZ = b.vel.z * dt
    const len = Math.sqrt(stepX * stepX + stepY * stepY + stepZ * stepZ)
    if (b.life <= 0 || len < 1e-6) {
      b.active = false
      continue
    }
    // player: distance from the bolt's new position to the body's axis
    const nx = b.pos.x + stepX
    const ny = b.pos.y + stepY
    const nz = b.pos.z + stepZ
    if (s.phase === 'playing') {
      const ay = Math.max(p.pos.y + 0.2, Math.min(p.pos.y + (p.crouched ? 1.0 : 1.6), ny))
      const hx = nx - p.pos.x
      const hy = ny - ay
      const hz = nz - p.pos.z
      if (hx * hx + hy * hy + hz * hz < (pc.radius + 0.15) * (pc.radius + 0.15)) {
        b.active = false
        emit(sim, { type: 'boltHit', x: nx, y: ny, z: nz, player: true })
        hurtPlayer(s, sim, b.damage, b.pos.x - b.vel.x, b.pos.z - b.vel.z)
        continue
      }
    }
    const wall = sim.world.raycast(b.pos.x, b.pos.y, b.pos.z, stepX / len, stepY / len, stepZ / len, len)
    if (wall < len || ny < floorHeightAt(sim.grid, nx, nz)) {
      b.active = false
      emit(sim, { type: 'boltHit', x: b.pos.x + (stepX / len) * wall, y: b.pos.y + (stepY / len) * wall, z: b.pos.z + (stepZ / len) * wall, player: false })
      continue
    }
    b.pos.x = nx
    b.pos.y = ny
    b.pos.z = nz
  }
}
