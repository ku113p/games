// The player's body: walk / run / crouch / jump / dash with inertia, through the World port's character mover.
import type { GameState, Sim } from '../state'
import { angleDiff, emit, turnTowards } from '../util'
import { makeNoise } from './detection'

/** Continuous input for one tick (discrete actions are separate commands). */
export interface Intent {
  /** -1..1 forward/back and right/left, relative to the camera. */
  moveForward: number
  moveRight: number
  /** Shift held: run. */
  run: boolean
  /** The camera's yaw (0 = +z, PI/2 = +x): movement and aim are relative to it. */
  lookYaw: number
  /** Aim pitch in radians, positive = up. */
  aimPitch: number
  /** Tab held: network vision. */
  scan: boolean
}

export function createIntent(): Intent {
  return { moveForward: 0, moveRight: 0, run: false, lookYaw: 0, aimPitch: 0, scan: false }
}

/** The player cannot act: dead, done, or standing at a terminal while hacking. */
export function playerFrozen(s: GameState): boolean {
  return s.phase !== 'playing' || s.hack !== null
}

export function updatePlayer(s: GameState, sim: Sim, dt: number, intent: Intent): void {
  const cfg = sim.cfg.player
  const p = s.player
  p.coyote -= dt
  p.jumpBuffer -= dt
  p.dashBuffer -= dt
  p.dashCooldown -= dt
  p.invuln -= dt
  p.attackCooldown -= dt
  p.switchCooldown -= dt
  p.slashTime -= dt
  p.shootTime -= dt
  p.hitTime -= dt

  const frozen = playerFrozen(s)
  let wx = 0
  let wz = 0
  if (!frozen) {
    const sy = Math.sin(intent.lookYaw)
    const cy = Math.cos(intent.lookYaw)
    // forward = (sin, cos); right = (-cos, sin)
    wx = sy * intent.moveForward - cy * intent.moveRight
    wz = cy * intent.moveForward + sy * intent.moveRight
    const len = Math.sqrt(wx * wx + wz * wz)
    if (len > 1) {
      wx /= len
      wz /= len
    }
  }
  const wishing = wx * wx + wz * wz > 1e-4

  // dash (buffered by the dash command)
  if (!frozen && p.dashBuffer > 0 && p.dashCooldown <= 0) {
    p.dashBuffer = 0
    p.dashTime = cfg.dashSec
    p.dashCooldown = cfg.dashCooldownSec
    if (wishing) {
      const l = Math.sqrt(wx * wx + wz * wz)
      p.dashX = wx / l
      p.dashZ = wz / l
    } else {
      p.dashX = Math.sin(p.facing)
      p.dashZ = Math.cos(p.facing)
    }
    p.facing = Math.atan2(p.dashX, p.dashZ)
    emit(sim, { type: 'dashed' })
    makeNoise(s, sim, sim.cfg.noise.dash)
  }

  p.running = !frozen && intent.run && wishing && !p.crouched && p.grounded
  if (p.dashTime > 0) {
    p.dashTime -= dt
    p.vel.x = p.dashX * cfg.dashSpeed
    p.vel.z = p.dashZ * cfg.dashSpeed
    if (p.vel.y < 0) p.vel.y = 0
  } else {
    const speed = p.crouched ? cfg.crouchSpeed : p.running ? cfg.runSpeed : cfg.walkSpeed
    const tx = wx * speed
    const tz = wz * speed
    const ax = tx - p.vel.x
    const az = tz - p.vel.z
    const al = Math.sqrt(ax * ax + az * az)
    const rate = (p.grounded ? (wishing ? cfg.groundAccel : cfg.groundDecel) : cfg.airAccel) * dt
    if (al <= rate) {
      p.vel.x = tx
      p.vel.z = tz
    } else {
      p.vel.x += (ax / al) * rate
      p.vel.z += (az / al) * rate
    }
  }

  // jump (buffered, with coyote time); jumping stands you up when there is room
  if (!frozen && p.jumpBuffer > 0 && (p.grounded || p.coyote > 0)) {
    if (p.crouched && sim.world.canStand(p.pos.x, p.pos.y, p.pos.z)) {
      p.crouched = false
      emit(sim, { type: 'crouchChanged', crouched: false })
    }
    if (!p.crouched) {
      p.vel.y = cfg.jumpSpeed
      p.jumpBuffer = 0
      p.coyote = 0
      p.grounded = false
      emit(sim, { type: 'jumped' })
      makeNoise(s, sim, sim.cfg.noise.jump)
    }
  }
  if (p.dashTime <= 0) p.vel.y = Math.max(-cfg.maxFall, p.vel.y - cfg.gravity * dt)

  const dx = p.vel.x * dt
  const dy = p.vel.y * dt
  const dz = p.vel.z * dt
  const m = sim.move
  sim.world.moveCharacter(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, p.crouched, dt, m)
  const mx = m.x - p.pos.x
  const my = m.y - p.pos.y
  const mz = m.z - p.pos.z
  const wasGrounded = p.grounded
  p.pos.x = m.x
  p.pos.y = m.y
  p.pos.z = m.z
  p.grounded = m.grounded
  if (!p.grounded && p.vel.y < 0) p.fallSpeed = -p.vel.y
  if (p.grounded) {
    p.coyote = cfg.coyoteSec
    if (p.vel.y < 0) p.vel.y = 0
    if (!wasGrounded && p.fallSpeed > cfg.landNoiseSpeed) {
      emit(sim, { type: 'landed', speed: p.fallSpeed })
      makeNoise(s, sim, sim.cfg.noise.land)
    }
    p.fallSpeed = 0
  } else if (p.vel.y > 0 && my < dy * 0.5) {
    p.vel.y = 0 // bumped the ceiling
  }
  // Blocked by a wall: lose that part of the speed so you do not keep pushing into it.
  if (dt > 0) {
    if (Math.abs(mx) < Math.abs(dx) * 0.5) p.vel.x = mx / dt
    if (Math.abs(mz) < Math.abs(dz) * 0.5) p.vel.z = mz / dt
  }
  p.speed = dt > 0 ? Math.sqrt(mx * mx + mz * mz) / dt : 0

  // facing: towards the aim while attacking, otherwise towards the movement
  const acting = p.slashTime > 0 || p.shootTime > 0
  if (acting) p.facing = turnTowards(p.facing, intent.lookYaw, cfg.turnRate * 2 * dt)
  else if (p.speed > 0.4 && p.dashTime <= 0) p.facing = turnTowards(p.facing, Math.atan2(p.vel.x, p.vel.z), cfg.turnRate * dt)
  p.facing = angleDiff(p.facing, 0)

  // running is loud (DESIGN 8)
  if (p.running && p.grounded && p.speed > cfg.walkSpeed) {
    p.runNoise -= dt
    if (p.runNoise <= 0) {
      p.runNoise = sim.cfg.noise.runEverySec
      makeNoise(s, sim, sim.cfg.noise.run)
    }
  } else {
    p.runNoise = 0
  }
}
