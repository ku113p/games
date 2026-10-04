// Checkpoints and the ending counter (DESIGN 4, 6): a checkpoint is red (adds one to the sad ending) only when an alarm-3
// wave fight happened since the previous checkpoint - at most one red per segment, and once the firewall is down no more
// waves come, so one mistake cannot cascade into several reds. A checkpoint also heals fully; the hero's line color shows where the counter is heading - white, then red or blue.
import type { EndingConfig } from '../config'
import type { GameState, RunState, Sim } from '../state'
import { dist2, emit } from '../util'
import { awardCheckpoint } from './may'
import { endLockdown } from './alarm'

export function updateCheckpoints(s: GameState, sim: Sim): void {
  if (s.phase !== 'playing') return
  const p = s.player.pos
  const r = sim.cfg.checkpoint.radius
  for (let i = 0; i < s.checkpoints.length; i++) {
    const c = s.checkpoints[i]
    if (!c || c.passed) continue
    if (Math.abs(c.pos.y - p.y) > 2 || dist2(p.x, p.z, c.pos.x, c.pos.z) > r * r) continue
    passCheckpoint(s, sim, i)
  }
}

export function passCheckpoint(s: GameState, sim: Sim, i: number): void {
  const c = s.checkpoints[i]
  if (!c || c.passed) return
  c.passed = true
  // red when a wave fight happened in this segment, or a lockdown is on right now (alarm 3, firewall still up: waves are
  // running or coming); a fight that spans several checkpoints counts at each of them
  const fightOn = s.alarm.stage >= 3 && !s.alarm.firewallDown
  c.underAlarm = s.alarm.segmentFight || fightOn
  s.alarm.segmentFight = fightOn // a finished fight is counted; one still going counts at the next checkpoint too
  endLockdown(s, sim) // a finished lockdown ends here: the next arena is a fresh choice
  s.player.hp = sim.cfg.player.maxHp
  awardCheckpoint(s, sim)
  s.run.checkpointsPassed++
  if (c.underAlarm) s.run.alarmCheckpoints++
  else s.run.calmCheckpoints++
  s.lastCheckpoint = i
  emit(sim, { type: 'checkpointReached', index: i, underAlarm: c.underAlarm })
}

/** The sad ending is reached at `sadAt` alarm checkpoints out of all of them (DESIGN 4: 4 of 9). */
export function isSadEnding(run: RunState, cfg: EndingConfig): boolean {
  return run.alarmCheckpoints >= cfg.sadAt
}

export interface Rgb {
  r: number
  g: number
  b: number
}

/**
 * The hero's line color: white at the start; every checkpoint under alarm 3 pulls it towards red, every calm one
 * towards blue. Red is full at the sad threshold, blue is full when the sad ending can no longer happen.
 */
export function heroColor(run: RunState, cfg: EndingConfig, red: Rgb, blue: Rgb, out: Rgb): Rgb {
  const redness = Math.min(1, run.alarmCheckpoints / Math.max(1, cfg.sadAt))
  const blueness = Math.min(1, run.calmCheckpoints / Math.max(1, cfg.totalCheckpoints - cfg.sadAt + 1))
  const k = redness - blueness
  const to = k >= 0 ? red : blue
  const t = Math.abs(k)
  out.r = 1 + (to.r - 1) * t
  out.g = 1 + (to.g - 1) * t
  out.b = 1 + (to.b - 1) * t
  return out
}
