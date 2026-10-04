// Detection (DESIGN 8): view cones with line of sight, stance and distance; noise for sound cameras and drones.
// Hiding is geometry only: crouch behind a server block or low cover and the line of sight to your head is cut.
import type { GameState, Sim } from '../state'
import { emit } from '../util'

/** The point watchers look at: the player's head (lower while crouched). */
export function playerEyeY(s: GameState, sim: Sim): number {
  const p = s.player
  return p.pos.y + (p.crouched ? sim.cfg.player.crouchEyeHeight : sim.cfg.player.eyeHeight)
}

/** True while the player crouches right next to a server block (the HUD's "in cover"; detection itself is by line of sight). */
export function inCover(s: GameState, sim: Sim): boolean {
  const p = s.player
  if (!p.crouched) return false
  const reach = sim.cfg.player.radius + 0.45
  for (const b of sim.grid.blocks) {
    if (p.pos.x < b.minX - reach || p.pos.x > b.maxX + reach || p.pos.z < b.minZ - reach || p.pos.z > b.maxZ + reach) continue
    if (p.pos.y + 0.3 < b.minY || p.pos.y > b.maxY) continue
    return true
  }
  return false
}

/**
 * How well a watcher at (ex, ey, ez) looking along the normalized (fx, fy, fz) sees the player: 0 = not at all,
 * otherwise a suspicion rate factor (closer and more exposed = higher).
 */
export function seeFactor(
  s: GameState,
  sim: Sim,
  ex: number,
  ey: number,
  ez: number,
  fx: number,
  fy: number,
  fz: number,
  cosHalf: number,
  range: number,
): number {
  if (s.phase !== 'playing') return 0
  const p = s.player
  const hx = p.pos.x
  const hy = playerEyeY(s, sim)
  const hz = p.pos.z
  const dx = hx - ex
  const dy = hy - ey
  const dz = hz - ez
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (d > range || d < 1e-3) return d < 1e-3 ? 1 : 0
  if ((dx * fx + dy * fy + dz * fz) / d < cosHalf) return 0
  const cfg = sim.cfg.detection
  if (!sim.world.lineOfSight(ex, ey, ez, hx, hy, hz)) return 0
  const near = 1 - (1 - cfg.farFactor) * (d / range)
  const stance = p.crouched ? cfg.crouchFactor : p.running || p.dashTime > 0 ? cfg.runFactor : 1
  return near * stance
}

/** The player made a noise of this radius (how far it carries) at their position. */
export function makeNoise(s: GameState, sim: Sim, radius: number): void {
  const p = s.player
  if (radius > p.noise) p.noise = radius
  makeNoiseAt(sim, p.pos.x, p.pos.y + 1, p.pos.z, radius)
}

export function makeNoiseAt(sim: Sim, x: number, y: number, z: number, radius: number): void {
  if (radius <= 0) return
  if (sim.noiseCount >= sim.noises.length) return
  const n = sim.noises[sim.noiseCount++]
  if (!n) return
  n.x = x
  n.y = y
  n.z = z
  n.radius = radius
  emit(sim, { type: 'noise', x, y, z, radius })
}
