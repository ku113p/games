// Lists every spot where the floor does not meet what stands next to it cleanly: a pocket of void squeezed between a
// floor and a block (a trench along a wall, its lit edge running away from the wall), a floor edge lit over a void that is
// only a cell or two wide before the next solid, a floor cell whose neighbour block stands lower than the floor beside
// a taller one. The fix is zero spots on every level.
//   bun tools/seam-scan.ts [slice|l1] [--niches]   (exit code 1 when anything is found; --niches also lists the spots
//   boxed in on three sides, the pockets DESIGN 9.5 does not want)
import cfgJson from '../config.json'
import { buildGrid, CellKind, footBeside } from '../core/grid'
import { levels } from '../levels/index'

const niches = process.argv.includes('--niches')
const only = process.argv.slice(2).find((a) => !a.startsWith('--'))
const MIN_RISE = 0.5 // a block beside a floor must stand at least this far above it
const MAX_GAP = 2 // void cells between a floor and a block that still read as a trench
let total = 0
for (const level of levels) {
  if (only && level.id !== only) continue
  const g = buildGrid(level, cfgJson.world)
  const k = (c: number, r: number): number => (c < 0 || r < 0 || c >= g.cols || r >= g.rows ? CellKind.Void : (g.kind[r * g.cols + c] as number))
  const solid = (c: number, r: number): boolean => k(c, r) === CellKind.Wall || k(c, r) === CellKind.Cover
  const void_ = (c: number, r: number): boolean => k(c, r) === CellKind.Void
  const floor = (c: number, r: number): boolean => !solid(c, r) && !void_(c, r)
  const inside = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < g.cols && r < g.rows
  const found: string[] = []
  const seen = new Set<string>()
  const add = (kind: string, c: number, r: number, note: string): void => {
    const key = `${kind}${c},${r}${note}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(`  ${kind.padEnd(8)} [${c}, ${r}] ${note}`)
  }
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!floor(c, r)) continue
      if ((void_(c - 1, r) && void_(c + 1, r)) || (void_(c, r - 1) && void_(c, r + 1))) continue // a bridge: the void beside it is the point
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        // a floor edge over void: how far to the next thing along this direction?
        if (!void_(c + dc, r + dr)) continue
        let n = 1
        while (void_(c + dc * (n + 1), r + dr * (n + 1)) && inside(c + dc * (n + 1), r + dr * (n + 1))) n++
        const ec = c + dc * (n + 1)
        const er = r + dr * (n + 1)
        if (!inside(ec, er) || n > MAX_GAP) continue
        if (solid(ec, er)) add('TRENCH', c, r, `void gap ${n} to a block at [${ec}, ${er}] (${'NSWE'[dc === 0 ? (dr < 0 ? 0 : 1) : dc < 0 ? 2 : 3]})`)
        else if (floor(ec, er) && n === 1) add('SLIT', c, r, `one-cell void to floor [${ec}, ${er}]`)
      }
    }
  }
  // a block beside a floor that does not stand above it (its top is at or below the floor): a sunk box, the floor
  // seems to end in a pit next to the wall. A parapet or a curb must rise at least a step above the floor beside it.
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (k(c, r) !== CellKind.Wall) continue
      const top = g.top[r * g.cols + c] as number
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        if (!floor(c + dc, r + dr)) continue
        const j = (r + dr) * g.cols + c + dc
        const fl = Math.max(g.h0[j] as number, g.h1[j] as number)
        if (top < fl + MIN_RISE) add('SUNK', c, r, `block top ${top.toFixed(2)} vs floor ${fl.toFixed(2)} at [${c + dc}, ${r + dr}]`)
      }
    }
  }
  // a block beside a ramp: the foot of its face must reach the lowest point of the ramp's edge, or a wedge of void
  // shows between the sloping ramp and the flat bottom of the wall (a gap, its lit edge running away from the wall)
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (k(c, r) !== CellKind.Wall) continue
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        if (k(c + dc, r + dr) !== CellKind.Ramp) continue
        const j = (r + dr) * g.cols + c + dc
        // the ramp's heights at the two ends of the shared edge
        const east = dc === 1 ? false : true
        const south = dr === 1 ? false : true
        const ends: number[] = []
        for (const t of [0, 1]) {
          const e = dc !== 0 ? east : t === 1
          const s = dr !== 0 ? south : t === 1
          ends.push(g.rampAxis[j] === 1 ? ((e ? g.h1[j] : g.h0[j]) as number) : g.rampAxis[j] === 2 ? ((s ? g.h1[j] : g.h0[j]) as number) : (g.h0[j] as number))
        }
        const lowest = Math.min(...ends)
        const foot = footBeside(g, j)
        if (foot > lowest + 0.01) add('FLOAT', c, r, `face towards the ramp [${c + dc}, ${r + dr}] ends ${foot.toFixed(2)} m up, the ramp edge goes down to ${lowest.toFixed(2)} m`)
      }
    }
  }
  // niches: a spot on the floor boxed in on three sides within reach (blocks, covers and server blocks all count)
  if (niches) {
    const STEP = 0.25
    const REACH = 1.2
    const solidAt = (x: number, z: number): boolean => {
      const c = Math.floor(x / g.cell)
      const r = Math.floor(z / g.cell)
      if (k(c, r) === CellKind.Wall || k(c, r) === CellKind.Cover) return true
      return g.blocks.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)
    }
    const hit = (x: number, z: number, dx: number, dz: number): boolean => {
      for (let d = STEP; d <= REACH; d += STEP) {
        const c = Math.floor((x + dx * d) / g.cell)
        const r = Math.floor((z + dz * d) / g.cell)
        if (void_(c, r)) return false // the edge of the platform is open
        if (solidAt(x + dx * d, z + dz * d)) return true
      }
      return false
    }
    const cells = new Map<string, number>()
    for (let z = STEP / 2; z < g.rows * g.cell; z += STEP) {
      for (let x = STEP / 2; x < g.cols * g.cell; x += STEP) {
        const c = Math.floor(x / g.cell)
        const r = Math.floor(z / g.cell)
        if (!floor(c, r) || solidAt(x, z)) continue
        const n = (hit(x, z, 1, 0) ? 1 : 0) + (hit(x, z, -1, 0) ? 1 : 0) + (hit(x, z, 0, 1) ? 1 : 0) + (hit(x, z, 0, -1) ? 1 : 0)
        if (n >= 3) cells.set(`${c},${r}`, (cells.get(`${c},${r}`) ?? 0) + 1)
      }
    }
    for (const [key, n] of cells) {
      const [c, r] = key.split(',').map(Number) as [number, number]
      add('NICHE', c, r, `${n} spots boxed in on three sides`)
    }
  }
  console.log(`${level.id}: ${found.length} spot(s)`)
  for (const f of found) console.log(f)
  total += found.length
}
process.exit(total > 0 ? 1 : 0)
