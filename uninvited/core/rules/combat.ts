// The gunblade (owner: WP2 Gunblade and hero). DESIGN 3: one weapon, sword and gun at once. LMB is always the sword (a
// 180-degree arc, a 3-step combo whose third step is a 270-degree finisher); holding RMB aims and LMB then shoots the gun.
// The gun is charged only by sword and circular-strike kills; reload exists; no weapon switching.
// All targets (monsters, the tank's zones, mannequins and the chandelier) are one list with a unified index:
// [0, monsters) monsters, then TANK_ZONES tank zones, then the stage targets.
import { createTargetSphere, type TargetSphere } from '../model/common'
import type { TargetKind } from '../model/player'
import { nextFloat } from '../random'
import type { GameState, Sim } from '../state'
import { angleDiff, DEG, emit, raySphere } from '../util'
import { damageMonster, monsterSphere } from './horde'
import { shieldBlocks, swordImmune } from './flyers'
import { playerFrozen } from './movement'
import { damageStageTarget, stageTargetSphere } from './stages'
import { damageTank, tankSphere, TANK_ZONES } from './tank'

/**
 * Hurts the player (bites, strikes, projectiles) from (fromX, fromZ) - the player's own position when it has no
 * direction. A short invulnerability follows every hit, the circular strike is immune. Returns true when it hurt.
 * Contract WP3 -> WP2.
 */
export function hurtPlayer(s: GameState, sim: Sim, amount: number, fromX = s.player.pos.x, fromZ = s.player.pos.z): boolean {
  const p = s.player
  const cfg = sim.cfg.player
  if (s.phase !== 'playing' || p.invuln > 0 || s.strike.immune > 0) return false
  p.hp = Math.max(0, p.hp - amount)
  p.invuln = cfg.hurtInvulnSec
  p.hitTime = cfg.hitAnimSec
  emit(sim, { type: 'playerHurt', amount, hp: p.hp, fromX, fromZ })
  if (p.hp <= 0) {
    s.phase = 'dead'
    s.run.deaths++
    emit(sim, { type: 'playerDied' })
  }
  return true
}

/** A target sphere, written into these scratch fields. */
const tgt: TargetSphere = createTargetSphere()

/** How many targets there are (the length of the unified list). */
export function targetCount(s: GameState): number {
  return s.monsters.length + TANK_ZONES + s.targets.length
}

/** Which pool target `t` belongs to. */
export function targetKind(s: GameState, t: number): TargetKind {
  return t < s.monsters.length ? 'monster' : t < s.monsters.length + TANK_ZONES ? 'tank' : 'target'
}

/** The index of target `t` inside its own pool (the tank zone, the stage target slot). */
export function targetIndex(s: GameState, t: number): number {
  return t < s.monsters.length ? t : t < s.monsters.length + TANK_ZONES ? t - s.monsters.length : t - s.monsters.length - TANK_ZONES
}

/** Fills `out` with target t's hit sphere; false when it cannot be hit. Contract WP2 -> WP3. */
export function targetSphere(s: GameState, sim: Sim, t: number, out: TargetSphere): boolean {
  const i = targetIndex(s, t)
  switch (targetKind(s, t)) {
    case 'monster':
      return monsterSphere(s, sim, i, out)
    case 'tank':
      return tankSphere(s, sim, i, out)
    default:
      return stageTargetSphere(s, sim, i, out)
  }
}

/** True when the sword cannot hurt target t (ghosts, the chandelier). */
function swordImmuneTarget(s: GameState, sim: Sim, t: number): boolean {
  const kind = targetKind(s, t)
  const i = targetIndex(s, t)
  if (kind === 'monster') {
    const m = s.monsters[i]
    return m !== undefined && swordImmune(sim, m)
  }
  if (kind === 'target') return s.targets[i]?.kind === 'chandelier'
  return false
}

/**
 * Distance along a normalized ray to the nearest shootable target (its hit sphere), or -1; nothing beyond maxDist.
 * The camera's aim point uses it, so a target under the crosshair is aimed at and not the wall behind it (DESIGN 3).
 */
export function pickTarget(s: GameState, sim: Sim, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number {
  let best = -1
  const n = targetCount(s)
  for (let t = 0; t < n; t++) {
    if (!targetSphere(s, sim, t, tgt)) continue
    const d = raySphere(ox, oy, oz, dx, dy, dz, tgt.x, tgt.y, tgt.z, tgt.r)
    if (d >= 0 && d < maxDist && (best < 0 || d < best)) best = d
  }
  return best
}

/**
 * Applies damage to target t, emits the hit and credits the gun when a sword or strike kill happened. Returns true
 * when it killed. A skeleton's shield stops gun bolts from the front. Contract WP3 -> WP2.
 */
export function damageTarget(s: GameState, sim: Sim, t: number, amount: number, byGun: boolean): boolean {
  if (!targetSphere(s, sim, t, tgt)) return false
  const x = tgt.x
  const y = tgt.y
  const z = tgt.z
  const kind = targetKind(s, t)
  const i = targetIndex(s, t)
  const out = sim.kill
  out.killed = false
  let killed = false
  if (kind === 'monster') {
    const m = s.monsters[i]
    if (!m) return false
    if (byGun && shieldBlocks(sim, m, s.player.pos.x, s.player.pos.z)) {
      emit(sim, { type: 'shieldBlocked', index: i, x, y, z })
      return false
    }
    killed = damageMonster(s, sim, i, amount, byGun, out)
  } else if (kind === 'tank') killed = damageTank(s, sim, i, amount, byGun, out)
  else killed = damageStageTarget(s, sim, i, amount, byGun, out)
  emit(sim, { type: 'targetHit', target: kind, index: i, x, y, z, killed, byGun })
  if (killed && !byGun) chargeGun(s, sim, out.kind, x, y, z)
  return killed
}

/** A sword or strike kill charges the gun's reserve (DESIGN 3); the first charge ever is flagged for the hint. */
function chargeGun(s: GameState, sim: Sim, kind: string, x: number, y: number, z: number): void {
  const cfg = sim.cfg.gun
  const amount = (cfg.chargePerKill as Record<string, number | undefined>)[kind] ?? 0
  if (amount <= 0) return
  const g = s.gun
  const add = Math.min(amount, cfg.reserveMax - g.reserve)
  if (add <= 0) return
  g.reserve += add
  const first = !g.everCharged
  g.everCharged = true
  emit(sim, { type: 'gunCharged', amount: add, x, y, z, first })
}

/**
 * LMB: swing (or, while aiming, fire) at once when the weapon is ready (the same frame as the press); rate-limited by
 * the weapon's cooldown. A press that comes too early is kept for inputBufferSec and fires the moment it can (see
 * fireBuffered). main calls it every frame the button is held (press = false on the frames that are only a hold).
 */
export function attack(s: GameState, sim: Sim, aimYaw: number, aimPitch: number, press = true): void {
  const p = s.player
  if (playerFrozen(s)) return
  if (p.attackCooldown > 0 || p.drawTime > 0) {
    if (!press) return // a held button only repeats the attack: it is not kept once released
    p.attackBuffer = sim.cfg.player.inputBufferSec
    p.bufYaw = aimYaw
    p.bufPitch = aimPitch
    return
  }
  p.attackBuffer = 0
  if (p.aiming) fire(s, sim, aimYaw, aimPitch)
  else swing(s, sim, aimYaw)
}

/** Once per tick, after the timers ran: a buffered attack goes off as soon as the weapon is ready. */
export function fireBuffered(s: GameState, sim: Sim, dt: number): void {
  const p = s.player
  if (!(p.attackBuffer > 0)) return
  p.attackBuffer -= dt
  if (p.attackBuffer <= 0 || playerFrozen(s) || p.attackCooldown > 0 || p.drawTime > 0) return
  attack(s, sim, p.bufYaw, p.bufPitch, false)
}

/** Once per tick: the reload timer and the strike's timers. */
export function updateGun(s: GameState, sim: Sim, dt: number): void {
  const g = s.gun
  if (g.reloadTime > 0) {
    g.reloadTime -= dt
    if (g.reloadTime <= 0) {
      g.reloadTime = 0
      const move = Math.min(sim.cfg.gun.magSize - g.loaded, g.reserve)
      g.loaded += move
      g.reserve -= move
      emit(sim, { type: 'reloadDone', loaded: g.loaded })
    }
  }
}

/** R (or an empty trigger): reloads the cylinder from the reserve. A swing cancels it, aiming does not. */
export function reload(s: GameState, sim: Sim): void {
  const g = s.gun
  if (playerFrozen(s) || g.reloadTime > 0 || g.reserve <= 0 || g.loaded >= sim.cfg.gun.magSize) return
  g.reloadTime = sim.cfg.gun.reloadSec
  emit(sim, { type: 'reloadStarted' })
}

/** Q: the wide circular strike (works in the air too): 360 degrees, big damage and knockback, then a long cooldown. */
export function circularStrike(s: GameState, sim: Sim): void {
  const p = s.player
  const cfg = sim.cfg.strike
  if (playerFrozen(s) || s.strike.cooldown > 0) return
  s.strike.cooldown = cfg.cooldownSec
  s.strike.animTime = cfg.animSec
  s.strike.immune = cfg.immuneSec
  cancelReload(s, sim)
  emit(sim, { type: 'strikeUsed' })
  const chestY = p.pos.y + sim.cfg.player.chestHeight
  const n = targetCount(s)
  for (let t = 0; t < n; t++) {
    if (!targetSphere(s, sim, t, tgt) || swordImmuneTarget(s, sim, t)) continue
    const dx = tgt.x - p.pos.x
    const dz = tgt.z - p.pos.z
    if (Math.sqrt(dx * dx + dz * dz) > cfg.radius + tgt.r) continue
    if (tgt.y - tgt.r > p.pos.y + cfg.reachUp || tgt.y + tgt.r < p.pos.y - cfg.reachDown) continue
    if (!sim.world.lineOfSight(p.pos.x, chestY, p.pos.z, tgt.x, tgt.y, tgt.z)) continue
    damageTarget(s, sim, t, cfg.damage, false)
  }
}

function cancelReload(s: GameState, sim: Sim): void {
  if (s.gun.reloadTime <= 0) return
  s.gun.reloadTime = 0
  emit(sim, { type: 'reloadCancelled' })
}

function swing(s: GameState, sim: Sim, aimYaw: number): void {
  const p = s.player
  const cfg = sim.cfg.sword
  cancelReload(s, sim) // the sword always wins
  // the combo: a swing soon after the last one goes on to the next step; the third is the wide finisher
  p.combo = p.comboTime <= cfg.comboWindowSec ? (p.combo + 1) % 3 : 0
  p.comboTime = 0
  const fin = p.combo === 2
  p.attackCooldown = fin ? cfg.finisher.cooldownSec : cfg.cooldownSec
  p.slashLen = fin ? cfg.finisher.animSec : cfg.animSec
  p.slashTime = p.slashLen
  p.facing = aimYaw
  emit(sim, { type: 'swordSwing', yaw: aimYaw, combo: p.combo })
  const half = ((fin ? cfg.finisher.arcDeg : cfg.arcDeg) / 2) * DEG
  const range = fin ? cfg.finisher.range : cfg.range
  const chestY = p.pos.y + sim.cfg.player.chestHeight
  const n = targetCount(s)
  for (let t = 0; t < n; t++) {
    if (!targetSphere(s, sim, t, tgt) || swordImmuneTarget(s, sim, t)) continue
    const dx = tgt.x - p.pos.x
    const dz = tgt.z - p.pos.z
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d > range + tgt.r) continue
    if (tgt.y - tgt.r > p.pos.y + cfg.reachUp || tgt.y + tgt.r < p.pos.y - cfg.reachDown) continue
    if (d > 0.6 && Math.abs(angleDiff(Math.atan2(dx, dz), aimYaw)) > half) continue
    if (!sim.world.lineOfSight(p.pos.x, chestY, p.pos.z, tgt.x, tgt.y, tgt.z)) continue
    damageTarget(s, sim, t, cfg.damage, false)
  }
}

function fire(s: GameState, sim: Sim, aimYaw: number, aimPitch: number): void {
  const p = s.player
  const cfg = sim.cfg.gun
  p.attackCooldown = cfg.intervalSec
  if (s.gun.loaded <= 0) {
    emit(sim, { type: 'gunEmpty' })
    reload(s, sim) // an empty cylinder reloads by itself when there is something to load
    return
  }
  if (s.gun.reloadTime > 0) return
  s.gun.loaded--
  p.shootTime = cfg.animSec
  p.facing = aimYaw
  const ox = p.pos.x + Math.sin(aimYaw) * 0.4
  const oy = p.pos.y + cfg.muzzleHeight
  const oz = p.pos.z + Math.cos(aimYaw) * 0.4
  let dx = Math.sin(aimYaw) * Math.cos(aimPitch)
  let dy = Math.sin(aimPitch)
  let dz = Math.cos(aimYaw) * Math.cos(aimPitch)
  const n = targetCount(s)

  // aim assist: snap to the target closest to the aim line inside a small cone (third-person parallax)
  let bestCos = Math.cos(cfg.aimAssistDeg * DEG)
  let ax = 0
  let ay = 0
  let az = 0
  let assisted = false
  for (let t = 0; t < n; t++) {
    if (!targetSphere(s, sim, t, tgt)) continue
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
  if (assisted) {
    dx = ax
    dy = ay
    dz = az
  }
  // spread: a random direction inside the cone (some shots miss, DESIGN 3)
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
  let hit = -1
  for (let t = 0; t < n; t++) {
    if (!targetSphere(s, sim, t, tgt)) continue
    const d = raySphere(ox, oy, oz, dx, dy, dz, tgt.x, tgt.y, tgt.z, tgt.r)
    if (d >= 0 && d < hitDist) {
      hitDist = d
      hit = t
    }
  }
  emit(sim, { type: 'gunShot', fromX: ox, fromY: oy, fromZ: oz, toX: ox + dx * hitDist, toY: oy + dy * hitDist, toZ: oz + dz * hitDist, hit: hit >= 0 })
  if (hit >= 0) damageTarget(s, sim, hit, cfg.damage, true)
}
