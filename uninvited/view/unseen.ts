// "Unseen": a positive beat for stealth. While the player is hidden (no suspicion anywhere) and a warden walks within a few metres with its
// view cone sweeping toward the player for a moment, the HUD flashes UNSEEN and May may comment. The logic only (no DOM), so it is testable.
import cfgAll from '../config.json'

export const UNSEEN_CFG = cfgAll.view.unseen

export interface Watcher {
  x: number
  z: number
  /** Where it looks (radians, atan2(dx, dz) like the rest of the game). */
  yaw: number
}

export interface Unseen {
  /** One step of dt seconds; true on the frame the moment happens. */
  step(dt: number, hidden: boolean, px: number, pz: number, watchers: readonly Watcher[]): boolean
  reset(): void
}

export function createUnseen(cfg: typeof UNSEEN_CFG = UNSEEN_CFG): Unseen {
  let near = 0
  let cool = 0
  const cosCone = Math.cos((cfg.coneDeg * Math.PI) / 180)
  return {
    reset(): void {
      near = 0
      cool = 0
    },
    step(dt, hidden, px, pz, watchers): boolean {
      cool -= dt
      let sweeping = false
      if (hidden) {
        for (const w of watchers) {
          const dx = px - w.x
          const dz = pz - w.z
          const d = Math.hypot(dx, dz)
          if (d > cfg.dist || d < 0.01) continue
          if ((dx * Math.sin(w.yaw) + dz * Math.cos(w.yaw)) / d >= cosCone) sweeping = true
        }
      }
      near = sweeping ? near + dt : 0
      if (near >= cfg.holdSec && cool <= 0) {
        near = 0
        cool = cfg.cooldownSec
        return true
      }
      return false
    },
  }
}
