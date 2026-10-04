// May's progression (DESIGN 10 "as built"): points from checkpoints, the upgrade tree, the two actives on keys 1-2
// (1: distraction signal, 2: pause a camera) and the passives (shield, more charges, more hack time).
// Everything is data in config.progression; the state holds only points, ranks, cooldowns and the shield timer.
import type { GameState, Sim } from '../state'
import { DEG, emit, raySphere } from '../util'
import { makeNoiseAt } from './detection'
import { pauseDevice } from './terminals'

export const UPGRADE_IDS = ['distract', 'pause', 'pauseTime', 'cooldown', 'shield', 'charges', 'hackTime'] as const
export type UpgradeId = (typeof UPGRADE_IDS)[number]

/** The actives, by slot (key 1 = slot 0). */
export const ACTIVE_IDS = ['distract', 'pause'] as const

export function rankOf(s: GameState, id: string): number {
  return s.may.ranks[id] ?? 0
}

export function maxRank(sim: Sim, id: string): number {
  return sim.cfg.progression.items[id]?.costs.length ?? 0
}

/** The price of the next rank, or Infinity at the top. */
export function nextCost(s: GameState, sim: Sim, id: string): number {
  const costs = sim.cfg.progression.items[id]?.costs
  return costs?.[rankOf(s, id)] ?? Infinity
}

/** max: all ranks bought; locked: its `requires` is missing; poor: not enough points; buy: affordable now. */
export type BuyState = 'max' | 'locked' | 'poor' | 'buy'

export function buyState(s: GameState, sim: Sim, id: string): BuyState {
  const item = sim.cfg.progression.items[id]
  if (!item) return 'locked'
  if (rankOf(s, id) >= item.costs.length) return 'max'
  if (item.requires && rankOf(s, item.requires) < 1) return 'locked'
  return s.may.points >= nextCost(s, sim, id) ? 'buy' : 'poor'
}

/** Is there anything May could sell right now. */
export function anyAffordable(s: GameState, sim: Sim): boolean {
  for (const id of UPGRADE_IDS) if (buyState(s, sim, id) === 'buy') return true
  return false
}

/** Buys the next rank of an upgrade. Returns false (nothing changes) when it is locked, maxed or too dear. */
export function buyUpgrade(s: GameState, sim: Sim, id: string): boolean {
  if (buyState(s, sim, id) !== 'buy') return false
  s.may.points -= nextCost(s, sim, id)
  const rank = rankOf(s, id) + 1
  s.may.ranks[id] = rank
  const prog = sim.cfg.progression
  if (id === 'shield') s.may.shieldWait = 0
  if (id === 'charges') s.player.charges = Math.min(maxCharges(s, sim), s.player.charges + prog.chargesPerRank)
  emit(sim, { type: 'upgradeBought', id, rank })
  return true
}

/** May's first gift (the T0 meeting): the distraction signal, free. */
export function grantFreeUpgrade(s: GameState): void {
  if (rankOf(s, 'distract') < 1) s.may.ranks['distract'] = 1
}

/** A checkpoint pays May's points and puts the shield back up. */
export function awardCheckpoint(s: GameState, sim: Sim): void {
  const n = sim.cfg.progression.pointsPerCheckpoint
  s.may.points += n
  s.may.shieldWait = 0
  emit(sim, { type: 'mayPoints', gained: n, total: s.may.points })
}

// --- the numbers the upgrades give (also read by the HUD and the upgrade screen) ---

export function maxCharges(s: GameState, sim: Sim): number {
  return sim.cfg.combat.rifle.charges + rankOf(s, 'charges') * sim.cfg.progression.chargesPerRank
}

/** Extra hacking time, s. */
export function hackBonusSec(s: GameState, sim: Sim): number {
  return rankOf(s, 'hackTime') * sim.cfg.progression.hackTimeSec
}

/** How long May's pause lasts, s. */
export function pauseLengthSec(s: GameState, sim: Sim): number {
  const p = sim.cfg.progression.pause
  return p.baseSec + rankOf(s, 'pauseTime') * p.pauseTimeSec
}

/** The full cooldown of an active (slot 0 = distraction, 1 = pause), s. */
export function cooldownLengthSec(s: GameState, sim: Sim, slot: number): number {
  const prog = sim.cfg.progression
  const base = slot === 0 ? prog.distract.cooldownSec : prog.pause.cooldownSec
  const f = prog.cooldownFactor
  return base * (f[Math.min(rankOf(s, 'cooldown'), f.length - 1)] ?? 1)
}

/** Seconds until the shield is back (0 = up), or -1 without a shield. */
export function shieldWaitSec(s: GameState): number {
  return rankOf(s, 'shield') < 1 ? -1 : s.may.shieldWait
}

export function shieldRechargeSec(s: GameState, sim: Sim): number {
  const r = sim.cfg.progression.shield.rechargeSec
  return r[Math.min(rankOf(s, 'shield'), r.length) - 1] ?? 0
}

/** A hit meets the shield: it takes the hit whole and goes down for its recharge time. True when it did. */
export function shieldAbsorb(s: GameState, sim: Sim): boolean {
  if (rankOf(s, 'shield') < 1 || s.may.shieldWait > 0) return false
  s.may.shieldWait = shieldRechargeSec(s, sim)
  emit(sim, { type: 'shieldAbsorbed' })
  return true
}

/** The slot's ability is unlocked. */
export function abilityUnlocked(s: GameState, slot: number): boolean {
  const id = ACTIVE_IDS[slot]
  return id !== undefined && rankOf(s, id) >= 1
}

export function updateMay(s: GameState, _sim: Sim, dt: number): void {
  const m = s.may
  for (let i = 0; i < m.cd.length; i++) if ((m.cd[i] as number) > 0) m.cd[i] = Math.max(0, (m.cd[i] as number) - dt)
  if (m.shieldWait > 0) m.shieldWait = Math.max(0, m.shieldWait - dt)
}

/**
 * What an upgrade gives at `rank` (the upgrade screen shows "now" and "next"), or -1 when it does nothing at that rank:
 * distract: the range, m; pause: the pause base, s; pauseTime: the pause length, s; cooldown: the share the cooldowns are cut by, percent;
 * shield: the recharge, s; charges: the rifle's maximum; hackTime: the extra hack time, s.
 */
export function effectAt(sim: Sim, id: string, rank: number): number {
  const prog = sim.cfg.progression
  switch (id) {
    case 'distract':
      return rank < 1 ? -1 : prog.distract.range
    case 'pause':
      return rank < 1 ? -1 : prog.pause.baseSec
    case 'pauseTime':
      return prog.pause.baseSec + rank * prog.pause.pauseTimeSec
    case 'cooldown': {
      if (rank < 1) return -1
      const f = prog.cooldownFactor
      return Math.round((1 - (f[Math.min(rank, f.length - 1)] ?? 1)) * 100)
    }
    case 'shield':
      return rank < 1 ? -1 : (prog.shield.rechargeSec[Math.min(rank, prog.shield.rechargeSec.length) - 1] ?? -1)
    case 'charges':
      return sim.cfg.combat.rifle.charges + rank * prog.chargesPerRank
    case 'hackTime':
      return rank < 1 ? -1 : rank * prog.hackTimeSec
    default:
      return -1
  }
}

// --- the actives ---

/**
 * Key 1 / 2. `yaw` / `pitch` are the aim (the crosshair, as for the rifle). A locked slot does nothing; a slot that is
 * cooling down or has no target emits abilityFailed and costs nothing; a use starts the cooldown.
 */
export function useAbility(s: GameState, sim: Sim, slot: number, yaw: number, pitch: number): void {
  if (s.phase !== 'playing' || s.hack !== null || s.player.takedownTime > 0 || !abilityUnlocked(s, slot)) return
  if ((s.may.cd[slot] as number) > 0) {
    emit(sim, { type: 'abilityFailed', slot, reason: 'cooldown' })
    return
  }
  const ok = slot === 0 ? distract(s, sim, yaw, pitch) : pauseAimed(s, sim, yaw, pitch)
  if (!ok) {
    emit(sim, { type: 'abilityFailed', slot, reason: 'noTarget' })
    return
  }
  s.may.cd[slot] = cooldownLengthSec(s, sim, slot)
}

const ray = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0 }

function aimRay(s: GameState, sim: Sim, yaw: number, pitch: number): void {
  const p = s.player
  ray.ox = p.pos.x + Math.sin(yaw) * 0.4
  ray.oy = p.pos.y + sim.cfg.combat.rifle.muzzleHeight
  ray.oz = p.pos.z + Math.cos(yaw) * 0.4
  ray.dx = Math.sin(yaw) * Math.cos(pitch)
  ray.dy = Math.sin(pitch)
  ray.dz = Math.cos(yaw) * Math.cos(pitch)
}

/** A noise ping at the aimed point, or at the first surface the aim meets within range: wardens and drones in earshot come to look. */
function distract(s: GameState, sim: Sim, yaw: number, pitch: number): boolean {
  const c = sim.cfg.progression.distract
  aimRay(s, sim, yaw, pitch)
  const hit = sim.world.raycast(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, c.range)
  const d = Math.max(0, hit < c.range ? hit - 0.3 : c.range)
  const x = ray.ox + ray.dx * d
  const y = ray.oy + ray.dy * d
  const z = ray.oz + ray.dz * d
  makeNoiseAt(sim, x, y, z, c.noiseRadius, true)
  emit(sim, { type: 'abilityUsed', slot: 0, x, y, z })
  return true
}

/** Pauses the camera or drone nearest to the aim line (a small cone, line of sight, within range). */
function pauseAimed(s: GameState, sim: Sim, yaw: number, pitch: number): boolean {
  const c = sim.cfg.progression.pause
  aimRay(s, sim, yaw, pitch)
  const sec = pauseLengthSec(s, sim)
  let bestCos = Math.cos(c.aimDeg * DEG)
  let target: 'camera' | 'drone' | '' = ''
  let index = -1
  let tx = 0
  let ty = 0
  let tz = 0
  const consider = (kind: 'camera' | 'drone', i: number, x: number, y: number, z: number, radius: number): void => {
    const vx = x - ray.ox
    const vy = y - ray.oy
    const vz = z - ray.oz
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz)
    if (len > c.range || len < 1e-3) return
    let cos = (vx * ray.dx + vy * ray.dy + vz * ray.dz) / len
    // straight through the body counts as a hit however close the cone is
    if (raySphere(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, x, y, z, radius) >= 0) cos = Math.max(cos, 1)
    if (cos <= bestCos) return
    if (!sim.world.lineOfSight(ray.ox, ray.oy, ray.oz, x, y, z)) return
    bestCos = cos
    target = kind
    index = i
    tx = x
    ty = y
    tz = z
  }
  const hr = sim.cfg.combat.hitRadius
  for (let i = 0; i < s.cameras.length; i++) {
    const cam = s.cameras[i]
    if (cam?.alive) consider('camera', i, cam.pos.x, cam.pos.y, cam.pos.z, hr.camera)
  }
  for (let i = 0; i < s.soundCameras.length; i++) {
    const cam = s.soundCameras[i]
    if (cam?.alive) consider('camera', s.cameras.length + i, cam.pos.x, cam.pos.y, cam.pos.z, hr.camera)
  }
  for (let i = 0; i < s.drones.length; i++) {
    const d = s.drones[i]
    if (d?.alive && d.active && d.spawnTime <= 0 && d.gateTime <= 0) consider('drone', i, d.pos.x, d.pos.y, d.pos.z, hr.drone)
  }
  if (target === '') return false
  // paused already for as long: nothing to do, and the cooldown stays unspent
  if (!pauseDevice(s, sim, target, index, sec)) return false
  emit(sim, { type: 'abilityUsed', slot: 1, x: tx, y: ty, z: tz })
  return true
}
