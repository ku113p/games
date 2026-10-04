// The World port on Rapier: static colliders built from the level grid (slabs and hex blocks as tall as their tops,
// platforms with nothing under the void, hex modules as prisms, ceilings only under the level's roofs), a kinematic
// character controller for the player (with a crouched capsule), rays for line of sight, and red walls that can be
// switched off.
// Hot path: reused Ray / vectors; Rapier's own wasm bindings still allocate small result objects per call.
import RAPIER from '@dimforge/rapier3d-compat'
import { CellKind, RampAxis, type Grid } from '../core/grid'
import type { MoveResult, World } from '../core/ports'
import { barrierExtent } from '../core/barrier'
import { barrierShape } from '../core/state'

export interface CharacterShape {
  radius: number
  /** Half the length of the capsule's straight part, standing and crouched. */
  halfHeight: number
  crouchHalfHeight: number
  /** Kinematic controller tuning. */
  offset: number
  autostep: number
  autostepMinWidth: number
  snapToGround: number
  maxSlopeDeg: number
  /** Red walls are this thick (m). */
  redWallThickness: number
}

export interface RapierWorld extends World {
  /** Releases the wasm memory (on level change). */
  dispose(): void
}

let ready: Promise<void> | null = null

/** Loads the wasm once (cold path). */
export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init()
  return ready
}

export function createRapierWorld(g: Grid, shape: CharacterShape): RapierWorld {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  const fixed = (desc: RAPIER.ColliderDesc): RAPIER.Collider => world.createCollider(desc)
  const cuboid = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): RAPIER.Collider =>
    fixed(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))

  const cell = g.cell
  const top = g.ceiling
  const kindAt = (c: number, r: number): number => (c < 0 || r < 0 || c >= g.cols || r >= g.rows ? CellKind.Wall : (g.kind[r * g.cols + c] as number))
  const solidTop = (c: number, r: number): number => g.top[r * g.cols + c] as number
  const deep = g.bottom - 2

  // blocks ('#', 'H'): merge runs of block cells of the same top along each row; they reach down into the void
  for (let r = 0; r < g.rows; r++) {
    let c = 0
    while (c < g.cols) {
      if (kindAt(c, r) !== CellKind.Wall) {
        c++
        continue
      }
      const c0 = c
      const t = solidTop(c, r)
      while (c < g.cols && kindAt(c, r) === CellKind.Wall && solidTop(c, r) === t) c++
      cuboid(c0 * cell, deep, r * cell, c * cell, t, (r + 1) * cell)
    }
  }
  // floors: flat runs of the same height merged; ramps as sloped convex hulls
  for (let r = 0; r < g.rows; r++) {
    let c = 0
    while (c < g.cols) {
      const i = r * g.cols + c
      const k = kindAt(c, r)
      if (k === CellKind.Wall || k === CellKind.Void) {
        c++
        continue
      }
      if (g.rampAxis[i] !== RampAxis.None) {
        const h0 = g.h0[i] as number
        const h1 = g.h1[i] as number
        const x0 = c * cell
        const x1 = x0 + cell
        const z0 = r * cell
        const z1 = z0 + cell
        const lo = Math.min(h0, h1) - 1
        // top corners: along X h0 at x0, h1 at x1; along Z h0 at z0, h1 at z1
        const alongX = g.rampAxis[i] === RampAxis.X
        const pts = new Float32Array([
          x0, lo, z0, x1, lo, z0, x0, lo, z1, x1, lo, z1,
          x0, h0, z0, x1, alongX ? h1 : h0, z0, x0, alongX ? h0 : h1, z1, x1, h1, z1,
        ])
        const desc = RAPIER.ColliderDesc.convexHull(pts)
        if (desc) fixed(desc)
        c++
        continue
      }
      const h = g.h0[i] as number
      const c0 = c
      while (c < g.cols) {
        const j = r * g.cols + c
        const kj = kindAt(c, r)
        if (kj === CellKind.Wall || kj === CellKind.Void || g.rampAxis[j] !== RampAxis.None || g.h0[j] !== h) break
        c++
      }
      cuboid(c0 * cell, h - 1, r * cell, c * cell, h, (r + 1) * cell)
    }
  }
  // cover blocks and niche roofs
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c
      const h = g.h0[i] as number
      if (g.kind[i] === CellKind.Cover) cuboid(c * cell + 0.05, h, r * cell + 0.05, (c + 1) * cell - 0.05, h + g.coverHeight, (r + 1) * cell - 0.05)
      if (g.kind[i] === CellKind.Niche) cuboid(c * cell, h + g.nicheHeight, r * cell, (c + 1) * cell, top + 1, (r + 1) * cell)
    }
  }
  // server blocks (the level's cover entities) and hex modules (hexagonal prisms)
  for (const b of g.blocks) {
    if (!b.hex) {
      cuboid(b.minX, b.minY - 0.5, b.minZ, b.maxX, b.maxY, b.maxZ)
      continue
    }
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const rr = (b.maxX - b.minX) / 2
    const pts = new Float32Array(36)
    for (let k = 0; k < 12; k++) {
      const a = ((k % 6) * Math.PI) / 3
      pts[k * 3] = cx + Math.cos(a) * rr
      pts[k * 3 + 1] = k < 6 ? b.minY - 0.5 : b.maxY
      pts[k * 3 + 2] = cz + Math.sin(a) * rr
    }
    const desc = RAPIER.ColliderDesc.convexHull(pts)
    if (desc) fixed(desc)
  }
  // ceilings only under the roofs: the rest is open sky
  for (const roof of g.roofs) cuboid(roof.minX, roof.y, roof.minZ, roof.maxX, roof.y + 1, roof.maxZ)

  // red walls: a thin plane across the corridor, run on through the blocks that continue its line (no way round along a
  // parapet) and tall enough that no jump from anything beside it gets over (core/barrier.ts)
  const blockers: RAPIER.Collider[] = g.wallGroups.map((cells) => {
    const b = barrierExtent(g, barrierShape(g, cells), cells)
    const t = shape.redWallThickness / 2
    return b.alongX ? cuboid(b.coord - t, b.bottom, b.min, b.coord + t, b.top, b.max) : cuboid(b.min, b.bottom, b.coord - t, b.max, b.top, b.coord + t)
  })

  // the player
  const standing = new RAPIER.Capsule(shape.halfHeight, shape.radius)
  const crouching = new RAPIER.Capsule(shape.crouchHalfHeight, shape.radius)
  const player = fixed(RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius).setTranslation(0, -50, 0))
  let crouchedNow = false
  const controller = world.createCharacterController(shape.offset)
  controller.enableAutostep(shape.autostep, shape.autostepMinWidth, false)
  controller.enableSnapToGround(shape.snapToGround)
  controller.setMaxSlopeClimbAngle((shape.maxSlopeDeg * Math.PI) / 180)
  controller.setSlideEnabled(true)

  world.step()
  let dirty = false

  const pos = { x: 0, y: 0, z: 0 }
  const delta = { x: 0, y: 0, z: 0 }
  const moved = new RAPIER.Vector3(0, 0, 0)
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
  const rot = { x: 0, y: 0, z: 0, w: 1 }

  function cast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number {
    if (dirty) {
      world.step()
      dirty = false
    }
    ray.origin.x = ox
    ray.origin.y = oy
    ray.origin.z = oz
    ray.dir.x = dx
    ray.dir.y = dy
    ray.dir.z = dz
    const hit = world.castRay(ray, max, true, undefined, undefined, player)
    return hit ? hit.timeOfImpact : max
  }

  return {
    moveCharacter(x, y, z, dx, dy, dz, crouched, _dt, out: MoveResult): void {
      if (dirty) {
        world.step()
        dirty = false
      }
      if (crouched !== crouchedNow) {
        crouchedNow = crouched
        player.setShape(crouched ? crouching : standing)
      }
      const lift = (crouched ? shape.crouchHalfHeight : shape.halfHeight) + shape.radius
      pos.x = x
      pos.y = y + lift
      pos.z = z
      player.setTranslation(pos)
      delta.x = dx
      delta.y = dy
      delta.z = dz
      controller.computeColliderMovement(player, delta)
      controller.computedMovement(moved)
      out.x = x + moved.x
      out.y = y + moved.y
      out.z = z + moved.z
      out.grounded = controller.computedGrounded()
      pos.x = out.x
      pos.y = out.y + lift
      pos.z = out.z
      player.setTranslation(pos)
    },
    lineOfSight(ax, ay, az, bx, by, bz): boolean {
      const dx = bx - ax
      const dy = by - ay
      const dz = bz - az
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (l < 1e-5) return true
      return cast(ax, ay, az, dx / l, dy / l, dz / l, l) >= l - 1e-3
    },
    raycast(ox, oy, oz, dx, dy, dz, maxDist): number {
      return cast(ox, oy, oz, dx, dy, dz, maxDist)
    },
    canStand(x, y, z): boolean {
      if (dirty) {
        world.step()
        dirty = false
      }
      pos.x = x
      pos.y = y + shape.halfHeight + shape.radius + 0.05
      pos.z = z
      return world.intersectionWithShape(pos, rot, standing, undefined, undefined, player) === null
    },
    setBlocker(index, solid): void {
      const b = blockers[index]
      if (!b || b.isEnabled() === solid) return
      b.setEnabled(solid)
      dirty = true
    },
    dispose(): void {
      world.free()
    },
  }
}
