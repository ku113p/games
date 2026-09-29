// Minimap window along one axis: pure arithmetic, no Three.js.
// The window (windowCells cells) follows the head but stops at the arena bounds:
// at a wall it stays put and the marker moves inside it; in the middle of a big arena the marker is centered
// and the "world" slides beneath it. Discrete: the window shifts by a whole cell with each step.

/** Window length along the axis: an arena smaller than the window - the window equals the whole arena. */
export function windowLength(size: number, windowCells: number): number {
  return Math.min(size, windowCells)
}

/** Window start along the axis = clamp(head - half the window, 0, size - window). */
export function windowStart(head: number, size: number, windowCells: number): number {
  const max = Math.max(0, size - windowCells)
  const start = head - Math.floor(windowCells / 2)
  return start < 0 ? 0 : start > max ? max : start
}

/** Cell v in window coordinates (may fall outside 0..len-1 if v is outside the window). */
export function inWindow(v: number, start: number): number {
  return v - start
}

/** Is cell v inside the window [start, start+len)? */
export function isInWindow(v: number, start: number, len: number): boolean {
  return v >= start && v < start + len
}

/** Cell v in window coordinates, clamped to its edge (a "where to go" marker). */
export function clampToWindow(v: number, start: number, len: number): number {
  const i = v - start
  return i < 0 ? 0 : i > len - 1 ? len - 1 : i
}

/** The window's bottom edge lies on a real arena wall. */
export function touchesLowWall(start: number): boolean {
  return start <= 0
}

/** The window's top edge lies on a real arena wall. */
export function touchesHighWall(start: number, len: number, size: number): boolean {
  return start + len >= size
}

/** Cell v inside the window, fraction 0..1 along the window length (cell center; 0 - window bottom, 1 - top). For the level gauge. */
export function windowFraction(v: number, start: number, len: number): number {
  return (v - start + 0.5) / len
}

/** The boundary between cells b-1 and b (world coordinate) is "major": a multiple of every. Ticks are tied to the world, not the window. */
export function isMajorTick(b: number, every: number): boolean {
  return b % every === 0
}

/** Gauge trough: center of cell v over the whole arena height, fraction 0..1 (0 - floor, 1 - ceiling). The overall picture, no window. */
export function levelFraction(v: number, size: number): number {
  return (v + 0.5) / size
}
