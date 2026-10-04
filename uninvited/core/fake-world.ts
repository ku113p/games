// A stand-in World for tests: a flat floor at y = 0 plus axis-aligned boxes. Simple, predictable, no Rapier.
import type { MoveResult, World } from './ports'

export interface Box {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  /** Index of the red wall it stands for, or -1 for a plain box. */
  blocker: number
  solid: boolean
}

const RADIUS = 0.35
const STEP = 0.35
const HEIGHT = 1.8

export class FakeWorld implements World {
  readonly boxes: Box[] = []
  floorY = 0

  box(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, blocker = -1): this {
    this.boxes.push({ minX, minY, minZ, maxX, maxY, maxZ, blocker, solid: true })
    return this
  }

  private groundAt(x: number, z: number, feetY: number): number {
    let top = this.floorY
    for (const b of this.boxes) {
      if (!b.solid) continue
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
      if (b.maxY <= feetY + STEP && b.maxY > top) top = b.maxY
    }
    return top
  }

  private blocked(x: number, z: number, feetY: number): boolean {
    for (const b of this.boxes) {
      if (!b.solid) continue
      if (x + RADIUS <= b.minX || x - RADIUS >= b.maxX || z + RADIUS <= b.minZ || z - RADIUS >= b.maxZ) continue
      if (b.maxY <= feetY + STEP || b.minY >= feetY + HEIGHT) continue
      return true
    }
    return false
  }

  moveCharacter(x: number, y: number, z: number, dx: number, dy: number, dz: number, _crouched: boolean, _dt: number, out: MoveResult): void {
    let nx = x + dx
    let nz = z
    if (this.blocked(nx, nz, y)) nx = x
    nz = z + dz
    if (this.blocked(nx, nz, y)) nz = z
    let ny = y + dy
    const ground = this.groundAt(nx, nz, y)
    let grounded = false
    if (ny <= ground + 1e-4) {
      ny = ground
      grounded = true
    }
    out.x = nx
    out.y = ny
    out.z = nz
    out.grounded = grounded
  }

  private hitDistance(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number {
    let best = max
    if (dy < 0) {
      const t = (this.floorY - oy) / dy
      if (t >= 0 && t < best) best = t
    }
    for (const b of this.boxes) {
      if (!b.solid) continue
      let t0 = 0
      let t1 = best
      const o = [ox, oy, oz]
      const d = [dx, dy, dz]
      const mn = [b.minX, b.minY, b.minZ]
      const mx = [b.maxX, b.maxY, b.maxZ]
      let hit = true
      for (let a = 0; a < 3; a++) {
        const oa = o[a] as number
        const da = d[a] as number
        if (Math.abs(da) < 1e-9) {
          if (oa < (mn[a] as number) || oa > (mx[a] as number)) {
            hit = false
            break
          }
          continue
        }
        let ta = ((mn[a] as number) - oa) / da
        let tb = ((mx[a] as number) - oa) / da
        if (ta > tb) [ta, tb] = [tb, ta]
        t0 = Math.max(t0, ta)
        t1 = Math.min(t1, tb)
        if (t0 > t1) {
          hit = false
          break
        }
      }
      if (hit && t0 < best) best = t0
    }
    return best
  }

  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax
    const dy = by - ay
    const dz = bz - az
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (l < 1e-6) return true
    return this.hitDistance(ax, ay, az, dx / l, dy / l, dz / l, l) >= l - 1e-4
  }

  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number {
    return this.hitDistance(ox, oy, oz, dx, dy, dz, maxDist)
  }

  canStand(x: number, y: number, z: number): boolean {
    for (const b of this.boxes) {
      if (!b.solid) continue
      if (x + RADIUS <= b.minX || x - RADIUS >= b.maxX || z + RADIUS <= b.minZ || z - RADIUS >= b.maxZ) continue
      if (b.minY >= y + HEIGHT || b.maxY <= y + 0.05) continue
      return false
    }
    return true
  }

  setBlocker(index: number, solid: boolean): void {
    for (const b of this.boxes) if (b.blocker === index) b.solid = solid
  }
}
