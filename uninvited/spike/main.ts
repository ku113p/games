// UNINVITED - feel spike. Throwaway: answers "does moving, hiding and striking in a neon network feel good?"
// and "which of three looks?". Not the game architecture (no core/view split) - see README.md.
import RAPIER from '@dimforge/rapier3d-compat'
import {
  Color,
  FogExp2,
  HalfFloatType,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { sfx, unlockAudio } from './audio'
import cfg from './config.json'
import { Drone, type SeeTarget } from './drones'
import { Afterimages, Bolts, Decoy, Impact, SlashArc, Sparks } from './fx'
import { Hero } from './hero'
import { Level } from './level'
import { findLook, LOOKS, type Look } from './looks'
import { Materials } from './materials'

const P = cfg.player
const C = cfg.camera
const S = cfg.strike
const FEET_TO_CENTER = P.halfHeight + P.radius

await RAPIER.init()

// ---------- renderer & post ----------
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
const scene = new Scene()
const camera = new PerspectiveCamera(C.fov, innerWidth / innerHeight, 0.1, 600)
const hemi = new HemisphereLight(0xffffff, 0x000000, 1.2)
scene.add(hemi)
scene.fog = new FogExp2(0x000000, 0.02)

const target = new WebGLRenderTarget(innerWidth, innerHeight, { samples: 4, type: HalfFloatType })
const composer = new EffectComposer(renderer, target)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new Vector2(innerWidth / 2, innerHeight / 2), 1, 0.5, 0.5)
composer.addPass(bloom)
composer.addPass(new OutputPass())
const finalPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0 },
    uScan: { value: 0 },
    uAberr: { value: 0 },
    uHurt: { value: 0 },
    uTime: { value: 0 },
    uRes: { value: new Vector2(innerWidth, innerHeight) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVignette, uScan, uAberr, uHurt, uTime; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5;
      float a = uAberr + uHurt * 0.006;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d * a).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * a).b);
      c *= 1.0 - uScan * (0.5 + 0.5 * sin(vUv.y * uRes.y * 1.5));
      c *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.2, 1.0)));
      c = mix(c, vec3(1.0, 0.05, 0.1), uHurt * 0.35 * smoothstep(0.2, 0.8, length(d)));
      gl_FragColor = vec4(c, 1.0);
    }`,
})
composer.addPass(finalPass)

// ---------- world ----------
const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
const mats = new Materials()
const level = new Level(world, mats)
scene.add(level.root)

const hero = new Hero(mats)
scene.add(hero.root)
const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0))
const playerCollider = world.createCollider(RAPIER.ColliderDesc.capsule(P.halfHeight, P.radius), body)
const controller = world.createCharacterController(0.02)
controller.enableSnapToGround(0.3)
controller.enableAutostep(0.4, 0.2, false)
controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
controller.setSlideEnabled(true)

const drones = level.patrols.map((p) => new Drone(p, mats))
for (const d of drones) scene.add(d.root, d.coneMesh)

const sparks = new Sparks(mats)
scene.add(sparks.mesh)
const bolts = new Bolts(scene, mats)
const ghosts = new Afterimages(scene, hero, mats)
const slash = new SlashArc(mats)
scene.add(slash.mesh)
const decoy = new Decoy(mats)
scene.add(decoy.root)
const impact = new Impact()

// ---------- HUD ----------
const $ = (id: string) => document.getElementById(id)!
const hud = {
  hp: $('hp-fill'),
  status: $('status'),
  ai: $('ai'),
  look: $('look'),
  start: $('start'),
  end: $('end'),
  endTitle: $('end-title'),
  endStats: $('end-stats'),
  decoy: $('decoy-fill'),
  dash: $('dash-fill'),
  objective: $('objective'),
  hintCapture: $('hint-capture'),
}

let aiTimer = 0
const aiSaid = new Set<string>()
function say(key: string, text: string, once = true): void {
  if (once && aiSaid.has(key)) return
  aiSaid.add(key)
  hud.ai.textContent = text
  hud.ai.classList.add('on')
  aiTimer = 4.5
}

// ---------- look ----------
let look: Look = findLook(new URLSearchParams(location.search).get('look'))
function applyLook(l: Look): void {
  look = l
  mats.apply(l)
  scene.background = new Color(l.background)
  ;(scene.fog as FogExp2).color.setHex(l.fog)
  ;(scene.fog as FogExp2).density = l.fogDensity
  hemi.color.setHex(l.hemiSky)
  hemi.groundColor.setHex(l.hemiGround)
  bloom.strength = l.bloomStrength
  bloom.radius = l.bloomRadius
  bloom.threshold = l.bloomThreshold
  finalPass.uniforms['uVignette']!.value = l.vignette
  finalPass.uniforms['uScan']!.value = l.scanlines
  finalPass.uniforms['uAberr']!.value = l.aberration
  hud.look.textContent = `${l.name}   [1] [2] [3]`
  document.documentElement.style.setProperty('--hud', '#' + new Color(l.hero).getHexString())
  document.documentElement.style.setProperty('--enemy', '#' + new Color(l.enemy).getHexString())
  document.documentElement.style.setProperty('--accent', '#' + new Color(l.accent).getHexString())
}
applyLook(look)

// ---------- input ----------
const keys = new Set<string>()
const pressed = new Set<string>()
let yaw = 0
let pitch = C.startPitch
let started = false
window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) pressed.add(e.code)
  keys.add(e.code)
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault()
})
window.addEventListener('keyup', (e) => keys.delete(e.code))
window.addEventListener('blur', () => keys.clear())
canvas.addEventListener('mousedown', (e) => {
  if (!started) return
  if (document.pointerLockElement !== canvas) {
    void canvas.requestPointerLock()
    return
  }
  pressed.add(e.button === 2 ? 'Mouse2' : 'Mouse0')
})
canvas.addEventListener('contextmenu', (e) => e.preventDefault())
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return
  yaw -= e.movementX * C.sensitivity
  pitch = Math.min(C.maxPitch, Math.max(C.minPitch, pitch + e.movementY * C.sensitivity))
})
hud.start.addEventListener('click', () => {
  unlockAudio()
  started = true
  hud.start.classList.add('hidden')
  void canvas.requestPointerLock()
  say('start', 'AI: Sector 7. The firewall seals the server. There is a node on the east side - get me to it.')
})

// ---------- player state ----------
const feet = new Vector3()
const center = new Vector3()
const vel = new Vector3()
const wish = new Vector3()
const fwd = new Vector3()
const right = new Vector3()
const desired = { x: 0, y: 0, z: 0 }
const dashDir = new Vector3()
let grounded = false
let coyote = 0
let jumpBuf = 0
let dashT = 0
let dashCd = 0
let ghostT = 0
let strikeCd = 0
let strikeT = 0
let lungeT = 0
let facingYaw = 0
let hp = P.maxHp
let invuln = 0
let hurtFx = 0
let dead = 0
let decoyCd = 0
let capture = 0
let captured = false
let firewallOpenT = 0
let won = false
let runTime = 0
let stats = { alerts: 0, takedowns: 0, kills: 0, deaths: 0 }

const seePlayer: SeeTarget = { pos: new Vector3(), collider: playerCollider, sneaking: false }
const seeDecoy: SeeTarget = { pos: new Vector3(), collider: null, sneaking: false }

function resetSector(full: boolean): void {
  feet.copy(level.start)
  vel.set(0, 0, 0)
  center.copy(feet).y += FEET_TO_CENTER
  body.setTranslation(center, true)
  body.setNextKinematicTranslation(center)
  yaw = 0
  pitch = C.startPitch
  facingYaw = 0
  hp = P.maxHp
  dead = 0
  hero.root.visible = true
  for (const d of drones) d.reset()
  bolts.clear()
  decoy.life = 0
  decoy.root.visible = false
  decoyCd = 0
  capture = 0
  captured = false
  firewallOpenT = 0
  level.closeFirewall()
  won = false
  hud.end.classList.add('hidden')
  if (full) {
    runTime = 0
    stats = { alerts: 0, takedowns: 0, kills: 0, deaths: 0 }
  }
}
resetSector(true)

function hurt(amount: number): void {
  if (invuln > 0 || dashT > 0 || dead > 0 || won) return
  hp -= amount
  invuln = P.hurtInvulnMs / 1000
  hurtFx = 1
  impact.shake(0.45)
  impact.hitStop(40)
  sfx.hurt()
  sparks.burst(center.x, center.y, center.z, 14, 6, 0.4, 0.4)
  if (hp <= 0) {
    hp = 0
    dead = P.respawnMs / 1000
    stats.deaths++
    hero.root.visible = false
    sparks.burst(center.x, center.y, center.z, 120, 11, 0.6, 1.0)
    impact.shake(1)
    sfx.die()
    say('dead' + stats.deaths, 'AI: Lost your signal. Pulling you back out.', false)
  }
}

function fireBolt(from: Vector3, dir: Vector3): void {
  bolts.fire(from, dir)
  sfx.bolt()
}

const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
const tmpV = new Vector3()
const pivot = new Vector3()

function castFrom(o: Vector3, dir: Vector3, max: number): number {
  ray.origin.x = o.x
  ray.origin.y = o.y
  ray.origin.z = o.z
  ray.dir.x = dir.x
  ray.dir.y = dir.y
  ray.dir.z = dir.z
  const hit = world.castRay(ray, max, true, undefined, undefined, playerCollider)
  return hit ? hit.timeOfImpact : max
}

function angleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function strike(): void {
  strikeCd = S.cooldownMs / 1000
  strikeT = 1
  lungeT = S.lungeMs / 1000
  facingYaw = yaw
  slash.show(feet.x, feet.y + 1.0, feet.z, yaw)
  sfx.strike()
  let hitAny = false
  for (const d of drones) {
    if (d.state === 'dead') continue
    const dx = d.pos.x - feet.x
    const dz = d.pos.z - feet.z
    const dist = Math.hypot(dx, dz)
    if (dist > S.range + 0.5 || d.pos.y - feet.y > 3.2) continue
    const ang = Math.abs(angleDiff(Math.atan2(dx, dz), yaw))
    if (ang > ((S.arcDeg / 2) * Math.PI) / 180 && dist > 0.8) continue
    hitAny = true
    const unaware = d.state !== 'alert'
    if (unaware && d.isBehind(feet.x, feet.z)) {
      d.damage(9999)
      stats.takedowns++
      impact.hitStop(S.killHitStopMs)
      impact.shake(0.5)
      sparks.burst(d.pos.x, d.pos.y, d.pos.z, 70, 9, 0.3, 0.9)
      sfx.takedown()
      say('takedown', 'AI: Clean. They will not log that one.')
      continue
    }
    const killed = d.damage(S.damage)
    if (killed) {
      stats.kills++
      impact.hitStop(S.killHitStopMs)
      impact.shake(0.7)
      sparks.burst(d.pos.x, d.pos.y, d.pos.z, 90, 12, 0.4, 1.0)
      sfx.kill()
      // A loud kill: everyone nearby comes to look
      for (const o of drones) if (o !== d && o.pos.distanceTo(d.pos) < 14) o.alertTo(feet)
    } else {
      impact.hitStop(S.hitStopMs)
      impact.shake(0.3)
      sparks.burst(d.pos.x, d.pos.y, d.pos.z, 24, 7, 0.3, 0.5)
      sfx.hit()
    }
  }
  if (!hitAny) impact.shake(0.05)
}

function useDecoy(): void {
  if (decoyCd > 0) return
  if (feet.z > level.firewallZ) {
    // The AI's own line: it will not spoof a signal inside the server zone.
    decoyCd = 1
    sfx.refuse()
    say('refuse' + Math.floor(runTime), 'AI: No. Not in there. Do not ask me why.', false)
    return
  }
  fwd.set(Math.sin(yaw), 0, Math.cos(yaw))
  tmpV.copy(feet).y += 1
  const dist = Math.max(0.5, castFrom(tmpV, fwd, cfg.decoy.throwDist) - 0.6)
  tmpV.copy(feet).addScaledVector(fwd, dist)
  decoy.place(tmpV)
  decoyCd = cfg.decoy.cooldownMs / 1000
  sparks.burst(tmpV.x, tmpV.y + 1, tmpV.z, 30, 5, 0.6, 0.6)
  sfx.decoy()
  say('decoy', 'AI: Ghost signal is up. Four seconds.')
}

// ---------- frame ----------
let last = performance.now()
let time = 0
let alertedCount = 0

function frame(now: number): void {
  requestAnimationFrame(frame)
  const rawDt = Math.min(cfg.sim.maxDt, (now - last) / 1000)
  last = now
  time += rawDt
  impact.update(rawDt, time)
  let dt = rawDt
  if (impact.stop > 0) {
    impact.stop -= rawDt
    dt = 0
  }
  if (started && !won) runTime += dt

  for (const l of LOOKS) if (pressed.has('Digit' + (LOOKS.indexOf(l) + 1))) applyLook(l)
  if (pressed.has('KeyR')) resetSector(true)

  // --- input -> wish direction (camera-relative) ---
  fwd.set(Math.sin(yaw), 0, Math.cos(yaw))
  right.set(-fwd.z, 0, fwd.x)
  wish.set(0, 0, 0)
  if (started && dead <= 0 && !won) {
    if (keys.has('KeyW')) wish.add(fwd)
    if (keys.has('KeyS')) wish.sub(fwd)
    if (keys.has('KeyD')) wish.add(right)
    if (keys.has('KeyA')) wish.sub(right)
  }
  if (wish.lengthSq() > 0) wish.normalize()
  const sneaking = started && (keys.has('KeyC') || keys.has('ControlLeft')) && grounded && dashT <= 0
  seePlayer.sneaking = sneaking

  if (dt > 0) {
    // timers
    coyote -= dt
    jumpBuf -= dt
    dashCd -= dt
    strikeCd -= dt
    decoyCd -= dt
    invuln -= dt
    strikeT = Math.max(0, strikeT - dt / 0.2)
    lungeT -= dt
    hurtFx = Math.max(0, hurtFx - dt * 2.5)

    if (dead > 0) {
      dead -= dt
      if (dead <= 0) resetSector(false)
    }

    const alive = dead <= 0 && !won && started
    if (alive && pressed.has('Space')) jumpBuf = P.jumpBufferMs / 1000
    if (alive && (pressed.has('ShiftLeft') || pressed.has('ShiftRight')) && dashCd <= 0) {
      dashT = P.dashMs / 1000
      dashCd = P.dashCooldownMs / 1000
      if (wish.lengthSq() > 0) dashDir.copy(wish)
      else dashDir.set(Math.sin(facingYaw), 0, Math.cos(facingYaw))
      facingYaw = Math.atan2(dashDir.x, dashDir.z)
      ghostT = 0
      sfx.dash()
      impact.shake(0.12)
    }
    if (alive && (pressed.has('Mouse0') || pressed.has('KeyJ')) && strikeCd <= 0) strike()
    if (alive && (pressed.has('Mouse2') || pressed.has('KeyF'))) useDecoy()

    // horizontal velocity
    if (dashT > 0) {
      dashT -= dt
      vel.x = dashDir.x * P.dashSpeed
      vel.z = dashDir.z * P.dashSpeed
      vel.y = Math.max(vel.y, 0)
      ghostT -= dt
      if (ghostT <= 0) {
        ghosts.spawn()
        ghostT = 0.03
      }
    } else {
      const speed = sneaking ? P.sneakSpeed : P.runSpeed
      const accel = (grounded ? P.groundAccel : P.airAccel) * dt
      const tx = wish.x * speed
      const tz = wish.z * speed
      const dx = tx - vel.x
      const dz = tz - vel.z
      const dl = Math.hypot(dx, dz)
      if (dl <= accel) {
        vel.x = tx
        vel.z = tz
      } else {
        vel.x += (dx / dl) * accel
        vel.z += (dz / dl) * accel
      }
      if (lungeT > 0) {
        vel.x += Math.sin(yaw) * S.lungeSpeed * dt * 8
        vel.z += Math.cos(yaw) * S.lungeSpeed * dt * 8
      }
    }

    // jump & gravity
    if (jumpBuf > 0 && (grounded || coyote > 0)) {
      vel.y = P.jumpSpeed
      jumpBuf = 0
      coyote = 0
      grounded = false
      sfx.jump()
    }
    if (dashT <= 0) vel.y = Math.max(-P.maxFall, vel.y - P.gravity * dt)

    // move through Rapier's character controller
    desired.x = vel.x * dt
    desired.y = vel.y * dt
    desired.z = vel.z * dt
    if (dead > 0) desired.x = desired.y = desired.z = 0
    controller.computeColliderMovement(playerCollider, desired)
    const m = controller.computedMovement()
    const wasGrounded = grounded
    const fallSpeed = vel.y
    grounded = controller.computedGrounded()
    center.x += m.x
    center.y += m.y
    center.z += m.z
    body.setNextKinematicTranslation(center)
    if (grounded) {
      coyote = P.coyoteMs / 1000
      if (vel.y < 0) vel.y = 0
      if (!wasGrounded && fallSpeed < -9) {
        sfx.land()
        impact.shake(Math.min(0.35, -fallSpeed / 60))
        sparks.burst(center.x, center.y - FEET_TO_CENTER + 0.05, center.z, 16, 4, -0.6, 0.35)
      }
    } else if (vel.y > 0 && m.y < desired.y * 0.5) {
      vel.y = 0 // bonked a ceiling
    }
    // Collisions with walls kill the matching velocity, so you do not "stick" when sliding along them
    if (Math.abs(m.x) < Math.abs(desired.x) * 0.5) vel.x *= 0.5
    if (Math.abs(m.z) < Math.abs(desired.z) * 0.5) vel.z *= 0.5
    world.step()
    feet.copy(center).y -= FEET_TO_CENTER

    // facing
    const hs = Math.hypot(vel.x, vel.z)
    if (strikeT <= 0 && hs > 0.5 && dashT <= 0) facingYaw += angleDiff(Math.atan2(vel.x, vel.z), facingYaw) * Math.min(1, dt * P.turnRate)

    // drones
    seePlayer.pos.set(feet.x, feet.y + (sneaking ? 0.75 : 1.35), feet.z)
    const decoyTarget = decoy.active ? seeDecoy : null
    if (decoy.active) seeDecoy.pos.set(decoy.pos.x, decoy.pos.y + 1.2, decoy.pos.z)
    let alerted = 0
    let suspicious = 0
    for (const d of drones) {
      const changed = d.update(dt, time, world, dead > 0 || won ? (seeDecoy as SeeTarget) : seePlayer, decoyTarget, fireBolt)
      if (changed === 'alert') {
        sfx.alert()
        stats.alerts++
      } else if (changed === 'suspicious') {
        sfx.suspicious()
        say('sus', 'AI: They are scanning for you. Hold C to stay low - low walls hide you only when you crouch.')
      }
      if (d.state === 'alert') alerted++
      else if (d.state === 'suspicious' || d.state === 'search') suspicious++
    }
    if (alerted > 0 && alertedCount === 0) say('alert', 'AI: You are flagged. Break line of sight, or break them. Shift dashes through bolts.')
    alertedCount = alerted
    hud.status.textContent = alerted > 0 ? 'DETECTED' : suspicious > 0 ? 'SUSPECTED' : 'HIDDEN'
    hud.status.className = alerted > 0 ? 'alert' : suspicious > 0 ? 'sus' : ''

    // bolts
    for (const b of bolts.items) {
      if (b.life <= 0) continue
      b.life -= dt
      b.mesh.position.addScaledVector(b.vel, dt)
      const p = b.mesh.position
      if (b.life <= 0 || p.y < 0 || level.solidAt(p.x, p.y, p.z)) {
        sparks.burst(p.x, Math.max(0.05, p.y), p.z, 6, 3, 0.4, 0.3)
        bolts.kill(b)
        continue
      }
      const dx = p.x - center.x
      const dy = p.y - center.y
      const dz = p.z - center.z
      if (dx * dx + dz * dz < 0.3 && Math.abs(dy) < 1.0) {
        bolts.kill(b)
        hurt(cfg.drone.boltDamage)
      }
    }

    // node capture -> firewall
    const nd = Math.hypot(feet.x - level.nodePos.x, feet.z - level.nodePos.z)
    const near = !captured && nd < cfg.node.radius && dead <= 0
    hud.hintCapture.classList.toggle('hidden', !near)
    if (near && keys.has('KeyE')) {
      capture += dt / (cfg.node.captureMs / 1000)
      if (Math.random() < 0.3) sparks.burst(level.nodeCore.position.x, 1.7, level.nodeCore.position.z, 1, 3, 0.5, 0.4)
      if (capture >= 1) {
        captured = true
        capture = 1
        firewallOpenT = 0.001
        level.openFirewall()
        sfx.capture()
        sfx.firewallDown()
        impact.shake(0.6)
        sparks.burst(level.nodePos.x, 1.7, level.nodePos.z, 80, 8, 0.8, 1.0)
        say('captured', 'AI: Node is ours. Dropping the firewall.')
      }
    } else if (!captured) {
      capture = Math.max(0, capture - dt * 0.5)
    }
    if (!captured && feet.z > level.firewallZ - 3) say('wall', 'AI: I cannot open that from here. The node, east side. Hold E on it.')
    if (firewallOpenT > 0 && firewallOpenT < 1) {
      firewallOpenT = Math.min(1, firewallOpenT + dt)
      level.setFirewallOpen(firewallOpenT)
    }

    // goal
    if (captured && !won && dead <= 0 && Math.hypot(feet.x - level.serverPos.x, feet.z - level.serverPos.z) < 3.2) {
      won = true
      sfx.win()
      impact.shake(0.4)
      hud.endTitle.textContent = 'SECTOR CLEARED'
      hud.endStats.textContent = `time ${runTime.toFixed(1)}s   ·   detected ${stats.alerts}×   ·   takedowns ${stats.takedowns}   ·   kills ${stats.kills}   ·   deaths ${stats.deaths}`
      hud.end.classList.remove('hidden')
      say('win', 'AI: You are in. ...That was the easy part.')
      document.exitPointerLock()
    }
  }

  // ---------- visuals ----------
  hero.root.position.copy(feet)
  hero.root.rotation.y = facingYaw
  hero.root.visible = dead <= 0 && (invuln <= 0 || Math.sin(time * 50) > 0)
  hero.animate(rawDt * (dt > 0 ? 1 : 0.1), Math.min(1, Math.hypot(vel.x, vel.z) / P.runSpeed), grounded, sneaking, dashT > 0, strikeT, vel.y)
  ghosts.update(rawDt)
  slash.update(rawDt, mats)
  decoy.update(dt, time)
  sparks.update(dt)
  level.nodeCore.rotation.y += rawDt * (captured ? 0.5 : 2)
  level.nodeCore.position.y = 1.7 + Math.sin(time * 2) * 0.12
  level.nodeProgress.scale.setScalar(Math.max(0.0001, capture))
  level.serverBeam.visible = captured
  for (let i = 0; i < level.towerRings.length; i++) level.towerRings[i]!.rotation.z = time * (0.1 + i * 0.07) * (i % 2 ? -1 : 1)
  mats.grid.uniforms['uTime']!.value = time
  ;(mats.grid.uniforms['uFocus']!.value as Vector3).copy(feet)
  mats.firewall.uniforms['uTime']!.value = time
  finalPass.uniforms['uTime']!.value = time
  finalPass.uniforms['uHurt']!.value = hurtFx

  // camera: orbit behind, pulled in when something is in the way
  const cp = Math.cos(pitch)
  tmpV.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
  pivot.copy(center).setY(feet.y + C.lookHeight)
  pivot.addScaledVector(right, -0.45)
  const camDist = Math.min(C.distance, castFrom(pivot, tmpV, C.distance) - C.collisionPad)
  camera.position.copy(pivot).addScaledVector(tmpV, Math.max(0.6, camDist))
  camera.position.y += C.height * 0.2
  camera.position.add(impact.offset)
  camera.lookAt(pivot.x - tmpV.x * 4, pivot.y - tmpV.y * 4 + 0.2, pivot.z - tmpV.z * 4)
  const wantFov = dashT > 0 ? C.dashFov : C.fov
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, rawDt * 12)
    camera.updateProjectionMatrix()
  }

  // HUD
  hud.hp.style.width = `${(hp / P.maxHp) * 100}%`
  hud.decoy.style.width = `${Math.min(1, Math.max(0, 1 - decoyCd / (cfg.decoy.cooldownMs / 1000))) * 100}%`
  hud.dash.style.width = `${Math.min(1, Math.max(0, 1 - dashCd / (P.dashCooldownMs / 1000))) * 100}%`
  hud.objective.textContent = captured ? 'Reach the server' : 'Capture the node (east) to drop the firewall'
  if (aiTimer > 0) {
    aiTimer -= rawDt
    if (aiTimer <= 0) hud.ai.classList.remove('on')
  }

  pressed.clear()
  composer.render()
}

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight)
  composer.setSize(innerWidth, innerHeight)
  bloom.resolution.set(innerWidth / 2, innerHeight / 2)
  ;(finalPass.uniforms['uRes']!.value as Vector2).set(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
})

// Hooks for the screenshot script (Playwright) - not used by the game itself.
;(window as unknown as Record<string, unknown>)['__spike'] = {
  start: () => hud.start.click(),
  look: (id: string) => applyLook(findLook(id)),
  place: (x: number, z: number, y: number, p: number) => {
    center.set(x, FEET_TO_CENTER + 0.05, z)
    body.setTranslation(center, true)
    feet.copy(center).y -= FEET_TO_CENTER
    yaw = y
    pitch = p
    facingYaw = y
  },
  key: (code: string, down: boolean) => (down ? (keys.add(code), pressed.add(code)) : keys.delete(code)),
  press: (code: string) => pressed.add(code),
  hideHud: (on: boolean) => document.body.classList.toggle('clean', on),
}

requestAnimationFrame(frame)
