// Fixed security (DESIGN 8): video cameras sweep a cone, sound cameras hear noise, motion sensors catch fast
// movement, laser grids burn and trip the alarm.
import type { GameState, Sim } from '../state'
import { DEG, dist2, emit } from '../util'
import { callCheck, raiseAlarm } from './alarm'
import { hurtPlayer } from './combat'
import { makeNoise, seeFactor } from './detection'
import { dronesHear } from './drones'

/** The sweep: eases from A to B and back, holding a moment at each end. */
export function sweepYaw(baseYaw: number, a: number, b: number, period: number, phase: number, holdShare: number, time: number): number {
  const t = (((time / period + phase) % 1) + 1) % 1
  const tri = 1 - Math.abs(2 * t - 1)
  let w = (tri - holdShare / 2) / (1 - holdShare)
  w = w < 0 ? 0 : w > 1 ? 1 : w
  const e = w * w * (3 - 2 * w)
  return baseYaw + a + (b - a) * e
}

export function updateCameras(s: GameState, sim: Sim, dt: number): void {
  const cfg = sim.cfg.videoCamera
  const det = sim.cfg.detection
  const cosHalf = Math.cos(cfg.halfAngleDeg * DEG)
  const pitch = cfg.pitchDeg * DEG
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  for (let i = 0; i < s.cameras.length; i++) {
    const c = s.cameras[i]
    if (!c || !c.alive) continue
    c.respot -= dt
    if (c.pausedTime > 0) {
      c.pausedTime -= dt
      c.sees = false
      c.suspicion = Math.max(0, c.suspicion - det.decay * dt)
      continue
    }
    c.yaw = sweepYaw(c.baseYaw, c.sweepA, c.sweepB, c.period, c.phase, cfg.holdShare, s.time)
    const f = seeFactor(s, sim, c.pos.x, c.pos.y, c.pos.z, Math.sin(c.yaw) * cp, -sp, Math.cos(c.yaw) * cp, cosHalf, cfg.range)
    c.sees = f > 0
    if (c.sees) c.suspicion = Math.min(1, c.suspicion + det.rate * f * dt)
    else c.suspicion = Math.max(0, c.suspicion - det.decay * dt)
    if (c.suspicion >= 1 && c.respot <= 0) {
      c.respot = cfg.respotSec
      const p = s.player.pos
      emit(sim, { type: 'cameraSpotted', index: i })
      raiseAlarm(s, sim, 'camera', p.x, p.y, p.z)
      callCheck(s, sim, p.x, p.y, p.z)
    }
  }
}

/** Sound cameras and drones react to this tick's noises. */
export function updateHearing(s: GameState, sim: Sim, dt: number): void {
  const cfg = sim.cfg.soundCamera
  for (let i = 0; i < s.soundCameras.length; i++) {
    const c = s.soundCameras[i]
    if (!c || !c.alive) continue
    c.respot -= dt
    c.heardAgo += dt
    if (c.pausedTime > 0) {
      c.pausedTime -= dt
      continue
    }
    c.suspicion = Math.max(0, c.suspicion - cfg.decay * dt)
    for (let n = 0; n < sim.noiseCount; n++) {
      const z = sim.noises[n]
      if (!z) continue
      const d2 = dist2(z.x, z.z, c.pos.x, c.pos.z)
      // heard when made inside its ring, or loud enough to carry to it
      if (d2 > cfg.radius * cfg.radius && d2 > z.radius * z.radius) continue
      c.suspicion = Math.min(1, c.suspicion + cfg.hearGain * Math.min(2, z.radius / sim.cfg.noise.run))
      c.heardAgo = 0
      if (c.suspicion >= 1 && c.respot <= 0) {
        c.respot = cfg.respotSec
        emit(sim, { type: 'soundHeard', index: i })
        raiseAlarm(s, sim, 'sound', z.x, z.y, z.z)
        callCheck(s, sim, z.x, z.y, z.z)
      }
    }
  }
  for (let n = 0; n < sim.noiseCount; n++) {
    const z = sim.noises[n]
    if (z) dronesHear(s, sim, z.x, z.z, z.radius)
  }
}

/** A motion sensor trips on sprinting, dashing and jumping inside its zone; walking and crouching pass (DESIGN 8). */
export function sensorTrips(s: GameState): boolean {
  const p = s.player
  return p.running || p.dashTime > 0 || p.jumping
}

export function updateSensors(s: GameState, sim: Sim, dt: number): void {
  const cfg = sim.cfg.motionSensor
  const p = s.player
  const eyeY = p.pos.y + sim.cfg.player.eyeHeight
  for (let i = 0; i < s.sensors.length; i++) {
    const m = s.sensors[i]
    if (!m) continue
    m.rearm -= dt
    const d2 = dist2(p.pos.x, p.pos.z, m.pos.x, m.pos.z)
    m.seenUpClose = d2 < cfg.noticeDist * cfg.noticeDist && sim.world.lineOfSight(p.pos.x, eyeY, p.pos.z, m.pos.x, m.pos.y + 0.3, m.pos.z)
    if (m.rearm > 0 || s.phase !== 'playing') continue
    if (d2 > m.radius * m.radius || Math.abs(p.pos.y - m.pos.y) > 2.5) continue
    if (!sensorTrips(s)) continue
    m.rearm = cfg.rearmSec
    emit(sim, { type: 'sensorTripped', index: i })
    raiseAlarm(s, sim, 'sensor', m.pos.x, m.pos.y, m.pos.z)
    callCheck(s, sim, m.pos.x, m.pos.y, m.pos.z)
  }
}

export function laserOn(s: GameState, i: number): boolean {
  const l = s.lasers[i]
  return !!l && l.alive && l.pausedTime <= 0
}

export function updateLasers(s: GameState, sim: Sim, dt: number): void {
  const cfg = sim.cfg.laser
  const p = s.player
  const r = sim.cfg.player.radius
  for (let i = 0; i < s.lasers.length; i++) {
    const l = s.lasers[i]
    if (!l) continue
    l.trip -= dt
    if (l.pausedTime > 0) l.pausedTime -= dt
    if (!laserOn(s, i) || s.phase !== 'playing') continue
    const across = l.alongX ? p.pos.x - l.coord : p.pos.z - l.coord
    const along = l.alongX ? p.pos.z : p.pos.x
    if (Math.abs(across) > r + 0.1 || along < l.min || along > l.max) continue
    if (p.pos.y > l.floor + cfg.height || p.pos.y + 1.7 < l.floor) continue
    if (l.trip > 0) continue
    l.trip = cfg.tripCooldownSec
    emit(sim, { type: 'laserTripped', index: i })
    makeNoise(s, sim, sim.cfg.noise.laser)
    hurtPlayer(s, sim, cfg.damage)
    raiseAlarm(s, sim, 'laser', p.pos.x, p.pos.y, p.pos.z)
  }
}
