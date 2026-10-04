// Read-only questions for the view and the HUD (rule 2: the view reads the state only through these).
// Hot path: no allocations - results are numbers, strings, or written into caller-owned objects.
import type { BoltState, CheckpointState, DroneState, Gate, GameState, GateState, LaserState, ScanLink, Vec3, RedWallState, SensorState, Sim, SoundCameraState, TerminalState, VideoCameraState } from './state'
import type { HackSession } from './hack/index'
import { heroColor, isSadEnding, type Rgb } from './rules/progress'
import { nearestInteractable, type Interactable } from './rules/terminals'
import { inCover } from './rules/detection'
import { laserOn } from './rules/devices'
import type { Block, Grid } from './grid'

export type { Rgb } from './rules/progress'
export type { Interactable } from './rules/terminals'

/** The hero's animation state, for the hero view (placeholder now, the H10 model later). */
export type HeroAnim = 'idle' | 'walk' | 'run' | 'crouch' | 'jump' | 'dash' | 'slash' | 'shoot' | 'hit' | 'death' | 'hack'

export function heroAnim(s: GameState, sim: Sim): HeroAnim {
  const p = s.player
  if (s.phase === 'dead') return 'death'
  if (p.hitTime > 0) return 'hit'
  if (p.slashTime > 0) return 'slash'
  if (p.shootTime > 0) return 'shoot'
  if (p.dashTime > 0) return 'dash'
  if (s.hack !== null) return 'hack'
  if (!p.grounded) return 'jump'
  if (p.crouched) return 'crouch'
  if (p.speed > sim.cfg.player.walkSpeed + 0.4) return 'run'
  if (p.speed > 0.3) return 'walk'
  return 'idle'
}

/** 0..1 how far into the current action animation (slash, shoot, hit), for the view's blending. */
export function heroActionProgress(s: GameState, sim: Sim): number {
  const p = s.player
  const c = sim.cfg
  if (p.hitTime > 0) return 1 - p.hitTime / c.player.hitAnimSec
  if (p.slashTime > 0) return 1 - p.slashTime / c.combat.sword.animSec
  if (p.shootTime > 0) return 1 - p.shootTime / c.combat.rifle.animSec
  if (p.dashTime > 0) return 1 - p.dashTime / c.player.dashSec
  return 0
}

export function playerPos(s: GameState): Readonly<{ x: number; y: number; z: number }> {
  return s.player.pos
}

export function playerFacing(s: GameState): number {
  return s.player.facing
}

export function playerSpeed(s: GameState): number {
  return s.player.speed
}

export function isCrouched(s: GameState): boolean {
  return s.player.crouched
}

export function isGrounded(s: GameState): boolean {
  return s.player.grounded
}

export function isRunning(s: GameState): boolean {
  return s.player.running
}

/** Crouched right behind a server block. */
export function isInCover(s: GameState, sim: Sim): boolean {
  return inCover(s, sim)
}

/** @deprecated niches are gone (DESIGN 9.5); the HUD's old "niche" flag now means "crouched in cover". */
export function isHiddenInNiche(s: GameState, sim: Sim): boolean {
  return inCover(s, sim)
}

/** The level's server blocks (world boxes), for the view to build. */
export function coverBlocks(sim: Sim): readonly Readonly<Block>[] {
  return sim.grid.blocks
}

export function weaponMode(s: GameState): 'sword' | 'rifle' {
  return s.player.mode
}

export function hpFraction(s: GameState, sim: Sim): number {
  return s.player.hp / sim.cfg.player.maxHp
}

export function hp(s: GameState): number {
  return s.player.hp
}

export function charges(s: GameState): number {
  return s.player.charges
}

export function dashReady(s: GameState, sim: Sim): number {
  return 1 - Math.max(0, s.player.dashCooldown) / sim.cfg.player.dashCooldownSec
}

export function phase(s: GameState): GameState['phase'] {
  return s.phase
}

export function alarmStage(s: GameState): number {
  return s.alarm.stage
}

/** 0..1 of the time left before stage 1/2 cools down; 1 at stage 3 (never decays), 0 at stage 0. */
export function alarmDecayFraction(s: GameState, sim: Sim): number {
  const a = s.alarm
  if (a.stage === 0) return 0
  if (a.stage >= 3) return 1
  const full = sim.cfg.alarm.decaySec[a.stage] ?? 1
  return Math.max(0, Math.min(1, a.decay / full))
}

export function waveInfo(s: GameState, sim: Sim, out: { wave: number; cleared: number; needed: number; firewallDown: boolean; active: boolean }): void {
  out.wave = s.alarm.wave
  out.cleared = s.alarm.wavesCleared
  out.needed = sim.cfg.alarm.firewallAfterWaves
  out.firewallDown = s.alarm.firewallDown
  out.active = s.alarm.waveActive
}

export type SecurityStatus = 'hidden' | 'suspected' | 'detected'

/** How the security sees you right now (the HUD's top line). */
export function securityStatus(s: GameState): SecurityStatus {
  let suspected = false
  for (const d of s.drones) {
    if (!d.active || !d.alive) continue
    if (d.mode === 'alert' && d.sees) return 'detected'
    if (d.suspicion > 0.02 || d.mode === 'investigate' || d.mode === 'search' || d.mode === 'alert') suspected = true
  }
  for (const c of s.cameras) {
    if (!c.alive) continue
    if (c.sees && c.suspicion >= 1) return 'detected'
    if (c.suspicion > 0.02) suspected = true
  }
  for (const c of s.soundCameras) if (c.alive && c.suspicion > 0.05) suspected = true
  return suspected ? 'suspected' : 'hidden'
}

/** The highest suspicion any watcher has of you (0..1), for a HUD meter. */
export function maxSuspicion(s: GameState): number {
  let m = 0
  for (const d of s.drones) if (d.active && d.alive && d.suspicion > m) m = d.suspicion
  for (const c of s.cameras) if (c.alive && c.suspicion > m) m = c.suspicion
  for (const c of s.soundCameras) if (c.alive && c.suspicion > m) m = c.suspicion
  return m
}

export function scanActive(s: GameState): boolean {
  return s.scan.active
}

/** 0..1 how close the held network vision is to calling the security (0 while it is off). The sim argument is unused (kept for old callers). */
export function scanHeat(s: GameState, _sim?: Sim): number {
  return s.scan.active ? s.scan.heat : 0
}

/** The heat (0..1) at which the warning comes (config scan.warnAt). */
export function scanWarnAt(sim: Sim): number {
  return sim.cfg.scan.warnAt
}

/** Network-vision links: terminal -> the wall / laser / drone it controls (drone ends follow the drones). */
export function scanLinks(s: GameState): readonly Readonly<ScanLink>[] {
  return s.links
}

/** Patrol waypoints (at hover height) per drone slot - same indices as drones(); empty for searchers and waves. */
export function dronePatrolRoutes(s: GameState): readonly (readonly Readonly<Vec3>[])[] {
  return s.routes
}

/** How far the player's noise carries right now, m (0 when silent): sprinting keeps it at noise.run, jumps and fights spike it. */
export function noiseRadius(s: GameState): number {
  return s.phase === 'playing' ? s.player.noise : 0
}

export interface SensorZone {
  x: number
  y: number
  z: number
  radius: number
  /** Tripped recently (rearming). */
  tripped: boolean
  /** The player is close enough to notice the sensor's dot. */
  seenUpClose: boolean
}

const zones: SensorZone[] = []

/** Motion-sensor zones (circles on the floor). The returned objects are reused between calls - read them, do not keep them. */
export function sensorZones(s: GameState): readonly Readonly<SensorZone>[] {
  while (zones.length < s.sensors.length) zones.push({ x: 0, y: 0, z: 0, radius: 0, tripped: false, seenUpClose: false })
  zones.length = s.sensors.length
  for (let i = 0; i < s.sensors.length; i++) {
    const m = s.sensors[i] as SensorState
    const z = zones[i] as SensorZone
    z.x = m.pos.x
    z.y = m.pos.y
    z.z = m.pos.z
    z.radius = m.radius
    z.tripped = m.rearm > 0
    z.seenUpClose = m.seenUpClose
  }
  return zones
}

/** 0..1 of the cooldown left (0 = ready). */
export function scanCooldown(s: GameState, sim: Sim): number {
  const full = s.scan.needRelease || s.scan.cooldown > sim.cfg.scan.cooldownSec ? sim.cfg.scan.overheatCooldownSec : sim.cfg.scan.cooldownSec
  return Math.max(0, Math.min(1, s.scan.cooldown / full))
}

export function scanWarning(s: GameState): boolean {
  return s.scan.active && s.scan.warned
}

const interactOut = { index: -1 }

/** What the E prompt says right now. */
export function interactPrompt(s: GameState, sim: Sim): Interactable {
  return nearestInteractable(s, sim, interactOut)
}

export function hackSession(s: GameState): HackSession | null {
  return s.hack?.session ?? null
}

export function hackTerminal(s: GameState): number {
  return s.hack?.terminal ?? -1
}

export function drones(s: GameState): readonly Readonly<DroneState>[] {
  return s.drones
}

/** 0..1 how far drone i is into locking on for a shot (the telegraph); 0 when not aiming. */
export function droneAim(s: GameState, sim: Sim, i: number): number {
  const d = s.drones[i]
  if (!d || !d.active || !d.alive || d.aim <= 0) return 0
  return 1 - d.aim / sim.cfg.drone.aimSec
}

/** The level's spawn gates (static shapes). */
export function spawnGates(sim: Sim): readonly Readonly<Gate>[] {
  return sim.gates
}

/** The spawn gates' live state (open timers). */
export function gateStates(s: GameState): readonly Readonly<GateState>[] {
  return s.gates
}

export function videoCameras(s: GameState): readonly Readonly<VideoCameraState>[] {
  return s.cameras
}

export function soundCameras(s: GameState): readonly Readonly<SoundCameraState>[] {
  return s.soundCameras
}

export function motionSensors(s: GameState): readonly Readonly<SensorState>[] {
  return s.sensors
}

export function lasers(s: GameState): readonly Readonly<LaserState>[] {
  return s.lasers
}

export function isLaserOn(s: GameState, i: number): boolean {
  return laserOn(s, i)
}

export function redWalls(s: GameState): readonly Readonly<RedWallState>[] {
  return s.walls
}

export function terminals(s: GameState): readonly Readonly<TerminalState>[] {
  return s.terminals
}

/** Indices of what a terminal controls (for the network-vision links). */
export function terminalLinks(sim: Sim, i: number): Readonly<{ walls: readonly number[]; lasers: readonly number[]; drones: readonly number[] }> | null {
  return sim.terminalLinks[i] ?? null
}

export function checkpoints(s: GameState): readonly Readonly<CheckpointState>[] {
  return s.checkpoints
}

export function bolts(s: GameState): readonly Readonly<BoltState>[] {
  return s.bolts
}

export function artifactPos(sim: Sim): Readonly<{ x: number; y: number; z: number }> {
  return sim.artifact
}

export function artifactTaken(s: GameState): boolean {
  return s.artifactTaken
}

/** The ending counter (DESIGN 4): checkpoints passed with the alarm at stage 3. */
export function endingCounter(s: GameState): number {
  return s.run.alarmCheckpoints
}

export function sadEndingAhead(s: GameState, sim: Sim): boolean {
  return isSadEnding(s.run, sim.cfg.ending)
}

/** The hero's line color by the ending counter: white -> red (alarm checkpoints) or blue (calm ones). */
export function heroLineColor(s: GameState, sim: Sim, red: Rgb, blue: Rgb, out: Rgb): Rgb {
  return heroColor(s.run, sim.cfg.ending, red, blue, out)
}

export function runStats(s: GameState): Readonly<GameState['run']> {
  return s.run
}

export function gameTime(s: GameState): number {
  return s.time
}

/** The level's static grid (for building the corridors). */
export function levelGrid(sim: Sim): Readonly<Grid> {
  return sim.grid
}

export function levelCeiling(sim: Sim): number {
  return sim.grid.ceiling
}
