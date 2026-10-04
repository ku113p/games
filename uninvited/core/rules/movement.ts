// The player's body (owner: WP2): walk / sprint / jump through the World port's character mover, plus the states the tank
// puts it in (grabbed, thrown, down). Tuned to feel responsive: high ground acceleration, near-instant turning, little
// air drift - at human speeds. There is no dash, no crouch and no noise any more (DESIGN 3: no dodge).
import type { GameState, Sim } from '../state'
import { angleDiff, emit, turnTowards } from '../util'
import { hurtPlayer } from './combat'

/** Continuous input for one tick (discrete actions are separate commands). */
export interface Intent {
  /** -1..1 forward/back and right/left, relative to the camera. */
  moveForward: number
  moveRight: number
  /** Shift held: sprint. */
  run: boolean
  /** E held: interact (the crank). */
  interact: boolean
  /** The camera's yaw (0 = +z, PI/2 = +x): movement and aim are relative to it. */
  lookYaw: number
  /** Aim pitch in radians, positive = up. */
  aimPitch: number
}

export function createIntent(): Intent {
  return { moveForward: 0, moveRight: 0, run: false, interact: false, lookYaw: 0, aimPitch: 0 }
}

/** The player cannot act: dead, done, held by the tank, thrown or down. */
export function playerFrozen(s: GameState): boolean {
  return s.phase !== 'playing' || s.player.control === 'grabbed' || s.player.control === 'thrown' || s.player.control === 'down'
}

/** The tank grabs the player: the body is locked (the tank moves it with its hand). False when already grabbed. Contract WP3 -> WP2. */
export function grabPlayer(s: GameState, sim: Sim): boolean {
  const p = s.player
  if (s.phase !== 'playing' || p.control === 'grabbed' || s.strike.immune > 0) return false
  p.control = 'grabbed'
  p.controlTime = 0
  p.vel.x = p.vel.y = p.vel.z = 0
  p.attackBuffer = 0
  s.gun.reloadTime = 0
  emit(sim, { type: 'playerGrabbed' })
  return true
}

/** Lets go of the grabbed player and throws them towards (throwX, throwZ) at `speed` m/s; they land, lie `downSec`, then get up. Contract WP3 -> WP2. */
export function releasePlayer(s: GameState, sim: Sim, throwX: number, throwZ: number, speed: number): void {
  const p = s.player
  if (p.control !== 'grabbed') return
  const l = Math.sqrt(throwX * throwX + throwZ * throwZ) || 1
  p.control = 'thrown'
  p.vel.x = (throwX / l) * speed
  p.vel.z = (throwZ / l) * speed
  p.vel.y = 3
  p.grounded = false
  emit(sim, { type: 'playerThrown' })
}

/** Adds a velocity impulse to the player (knockback). Contract WP3 -> WP2. */
export function pushPlayer(s: GameState, sim: Sim, vx: number, vz: number): void {
  void sim
  if (s.player.control !== 'free') return
  s.player.vel.x += vx
  s.player.vel.z += vz
}

export function updatePlayer(s: GameState, sim: Sim, dt: number, intent: Intent): void {
  const cfg = sim.cfg.player
  const p = s.player
  p.coyote -= dt
  p.jumpBuffer -= dt
  p.invuln -= dt
  p.attackCooldown -= dt
  p.drawTime -= dt
  p.slashTime -= dt
  p.comboTime += dt
  p.shootTime -= dt
  p.hitTime -= dt
  if (s.strike.cooldown > 0) {
    s.strike.cooldown -= dt
    if (s.strike.cooldown <= 0) {
      s.strike.cooldown = 0
      emit(sim, { type: 'strikeReady' })
    }
  }
  if (s.strike.animTime > 0) s.strike.animTime -= dt
  if (s.strike.immune > 0) s.strike.immune -= dt

  const control = p.control
  const frozen = playerFrozen(s) || control === 'crank'
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

  // aiming walks (no sprint)
  p.running = !frozen && intent.run && wishing && p.grounded && !p.aiming
  if (control === 'free' || control === 'crank') {
    const speed = p.running ? cfg.runSpeed : cfg.walkSpeed
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
  } else if (control === 'down') {
    p.vel.x = p.vel.z = 0
    p.controlTime -= dt
    if (p.controlTime <= 0) {
      p.control = 'free'
      emit(sim, { type: 'playerGotUp' })
    }
  } else if (control === 'grabbed') {
    p.vel.x = p.vel.y = p.vel.z = 0
  }

  // jump (buffered, with coyote time)
  if (!frozen && p.jumpBuffer > 0 && (p.grounded || p.coyote > 0)) {
    p.vel.y = cfg.jumpSpeed
    p.jumpBuffer = 0
    p.coyote = 0
    p.grounded = false
    p.jumping = true
    emit(sim, { type: 'jumped' })
  }
  if (control !== 'grabbed') p.vel.y = Math.max(-cfg.maxFall, p.vel.y - cfg.gravity * dt)

  const dx = p.vel.x * dt
  const dy = p.vel.y * dt
  const dz = p.vel.z * dt
  const m = sim.move
  if (control !== 'grabbed') sim.world.moveCharacter(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, false, dt, m)
  else {
    m.x = p.pos.x
    m.y = p.pos.y
    m.z = p.pos.z
    m.grounded = true
  }
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
    if (p.vel.y <= 0) p.jumping = false
    p.coyote = cfg.coyoteSec
    if (p.vel.y < 0) p.vel.y = 0
    if (!wasGrounded && p.fallSpeed > cfg.landNoiseSpeed) emit(sim, { type: 'landed', speed: p.fallSpeed })
    p.fallSpeed = 0
    if (control === 'thrown') {
      p.control = 'down'
      p.controlTime = cfg.downSec + cfg.getUpSec
      p.vel.x = p.vel.z = 0
    }
  } else if (p.vel.y > 0 && my < dy * 0.5) {
    p.vel.y = 0 // bumped the ceiling
  }
  // Blocked by a wall: lose that part of the speed so you do not keep pushing into it (a throw into a wall hurts).
  if (dt > 0) {
    const blockedX = Math.abs(mx) < Math.abs(dx) * 0.5
    const blockedZ = Math.abs(mz) < Math.abs(dz) * 0.5
    if (control === 'thrown' && (blockedX || blockedZ) && Math.hypot(p.vel.x, p.vel.z) > cfg.wallSlamSpeed) {
      hurtPlayer(s, sim, cfg.wallSlamDamage)
      p.vel.x = p.vel.z = 0
    }
    if (blockedX) p.vel.x = mx / dt
    if (blockedZ) p.vel.z = mz / dt
  }
  p.speed = dt > 0 ? Math.sqrt(mx * mx + mz * mz) / dt : 0

  // facing: towards the aim while shooting or aiming (a swing sets it at once and holds it), otherwise towards the movement
  const acting = p.shootTime > 0 || p.aiming
  if (frozen) {
    // the tank (or the crank) owns the facing
  } else if (acting) p.facing = turnTowards(p.facing, intent.lookYaw, cfg.turnRate * 2 * dt)
  else if (wishing && p.slashTime <= 0) p.facing = turnTowards(p.facing, Math.atan2(wx, wz), cfg.turnRate * dt)
  p.facing = angleDiff(p.facing, 0)
}

/**
 * RMB (hold): aim. Walk speed, the body faces the aim, the gun's spread tightens; no attack during the draw (and the
 * holster). LMB then shoots, without RMB it swings the sword. Call it every frame with the button.
 */
export function setAim(s: GameState, sim: Sim, on: boolean): void {
  const p = s.player
  const want = on && !playerFrozen(s)
  if (want === p.aiming) return
  p.aiming = want
  p.drawTime = Math.max(p.drawTime, sim.cfg.gun.aimDrawSec)
}
