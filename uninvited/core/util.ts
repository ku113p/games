// Small shared helpers for the rules: math and the event buffer.
import type { GameEvent } from './events'
import type { Sim } from './state'

export const DEG = Math.PI / 180

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Signed smallest difference a - b, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  else if (d <= -Math.PI) d += Math.PI * 2
  return d
}

/** Turns `from` towards `to` by at most rate*dt radians. */
export function turnTowards(from: number, to: number, maxStep: number): number {
  const d = angleDiff(to, from)
  if (Math.abs(d) <= maxStep) return to
  return from + Math.sign(d) * maxStep
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx
  const dz = az - bz
  return dx * dx + dz * dz
}

export function dist3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = ax - bx
  const dy = ay - by
  const dz = az - bz
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Adds an event to this frame's buffer (bounded, so a runaway rule cannot grow it forever). */
export function emit(sim: Sim, e: GameEvent): void {
  if (sim.events.length < sim.cfg.sim.maxEvents) sim.events.push(e)
}

/**
 * Ray-sphere hit distance along a normalized direction, or -1.
 */
export function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number): number {
  const lx = cx - ox
  const ly = cy - oy
  const lz = cz - oz
  const tca = lx * dx + ly * dy + lz * dz
  if (tca < 0) return -1
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca
  const r2 = r * r
  if (d2 > r2) return -1
  return tca - Math.sqrt(r2 - d2)
}
