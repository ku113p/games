// Build-time helpers of the data city (view/city.ts): a mitered polyline offset, the hex-column lattice, and the light
// guides on the floors (the routes along the streets to the checkpoints, the artifact and the terminals). Cold path,
// pure functions of the grid; nothing here touches three.js materials.
import cfgAll from '../config.json'
import { CellKind, type Grid } from '../core/grid'
import type { P3 } from './geo'

const Y = cfgAll.view.city

export function hash(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return v - Math.floor(v)
}

/**
 * A polyline moved sideways by d metres to its left (left of the walking direction is (dz, -dx)), with mitered
 * corners. y is kept.
 */
export function offsetLine(pts: readonly P3[], closed: boolean, d: number): P3[] {
  const n = pts.length
  const nrm = (a: P3, b: P3): [number, number] => {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const l = Math.hypot(dx, dz) || 1
    return [dz / l, -dx / l]
  }
  const out: P3[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[i] as P3
    const a = closed || i > 0 ? nrm(pts[(i - 1 + n) % n] as P3, p) : null
    const b = closed || i < n - 1 ? nrm(p, pts[(i + 1) % n] as P3) : null
    let nx = 0
    let nz = 0
    if (a && b) {
      const k = d / Math.max(1 + a[0] * b[0] + a[1] * b[1], 0.25)
      nx = (a[0] + b[0]) * k
      nz = (a[1] + b[1]) * k
    } else {
      const u = (a ?? b) as [number, number]
      nx = u[0] * d
      nz = u[1] * d
    }
    out.push({ x: p.x + nx, y: p.y, z: p.z + nz })
  }
  return out
}

export interface HexCol {
  x: number
  z: number
  /** The prism's circumradius (corners along x). */
  r: number
}

/**
 * A honeycomb of flat-topped hexagons (radius R, a gap between neighbours) over a region: those whose six corners are
 * all inside `inside` are kept. Anchored on the world origin, so neighbouring regions line up.
 */
export function hexLattice(R: number, gap: number, minX: number, maxX: number, minZ: number, maxZ: number, inside: (x: number, z: number) => boolean): HexCol[] {
  const r = R - gap / Math.sqrt(3)
  const dx = 1.5 * R
  const dz = Math.sqrt(3) * R
  const out: HexCol[] = []
  for (let i = Math.floor(minX / dx) - 1; i <= Math.ceil(maxX / dx) + 1; i++) {
    const x = i * dx
    const off = (((i % 2) + 2) % 2) * 0.5
    for (let j = Math.floor(minZ / dz) - 1; j <= Math.ceil(maxZ / dz) + 1; j++) {
      const z = (j + off) * dz
      let ok = true
      for (let k = 0; k < 6 && ok; k++) ok = inside(x + Math.cos((k * Math.PI) / 3) * r, z + Math.sin((k * Math.PI) / 3) * r)
      if (ok) out.push({ x, z, r })
    }
  }
  return out
}

const D4: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]

/**
 * The light guides on the floors: the main route from the start through the checkpoints to the artifact, and a spur
 * from every terminal to it. They follow the streets (cell centres, few turns, away from walls and the void).
 */
export function buildGuides(g: Grid): { main: P3[][]; spurs: P3[][] } {
  const n = g.cols * g.rows
  const col = (i: number): number => i % g.cols
  const row = (i: number): number => Math.floor(i / g.cols)
  const blocked = new Uint8Array(n)
  const solidAt = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return true
    const k = g.kind[r * g.cols + c]
    return k === CellKind.Wall || k === CellKind.Cover || k === CellKind.Void || k === CellKind.Niche
  }
  for (let i = 0; i < n; i++) {
    if (solidAt(col(i), row(i))) blocked[i] = 1
    const x = (col(i) + 0.5) * g.cell
    const z = (row(i) + 0.5) * g.cell
    for (const b of g.blocks) if (x > b.minX - 0.6 && x < b.maxX + 0.6 && z > b.minZ - 0.6 && z < b.maxZ + 0.6) blocked[i] = 1
  }
  const near = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let c = 0
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dc !== 0 || dr !== 0) && solidAt(col(i) + dc, row(i) + dr)) c++
    near[i] = Math.min(c, 3) / 3
  }
  const walkable = (i: number): boolean => blocked[i] === 0

  // Dijkstra over (cell, heading): a turn costs extra, so the routes are long straight streets
  const route = (from: number, goal: (i: number) => boolean, dist?: Float32Array): number[] | null => {
    const INF = 1e9
    const cost = new Float32Array(n * 4).fill(INF)
    const prev = new Int32Array(n * 4).fill(-1)
    const heap: [number, number][] = []
    const push = (d: number, s: number): void => {
      heap.push([d, s])
      let k = heap.length - 1
      while (k > 0) {
        const p = (k - 1) >> 1
        if ((heap[p] as [number, number])[0] <= (heap[k] as [number, number])[0]) break
        const t = heap[p] as [number, number]
        heap[p] = heap[k] as [number, number]
        heap[k] = t
        k = p
      }
    }
    const pop = (): [number, number] => {
      const top = heap[0] as [number, number]
      const last = heap.pop() as [number, number]
      if (heap.length > 0) {
        heap[0] = last
        let k = 0
        for (;;) {
          const l = 2 * k + 1
          const r = l + 1
          let m = k
          if (l < heap.length && (heap[l] as [number, number])[0] < (heap[m] as [number, number])[0]) m = l
          if (r < heap.length && (heap[r] as [number, number])[0] < (heap[m] as [number, number])[0]) m = r
          if (m === k) break
          const t = heap[m] as [number, number]
          heap[m] = heap[k] as [number, number]
          heap[k] = t
          k = m
        }
      }
      return top
    }
    for (let h = 0; h < 4; h++) {
      cost[from * 4 + h] = 0
      push(0, from * 4 + h)
    }
    while (heap.length > 0) {
      const [d, s] = pop()
      if (d > (cost[s] as number)) continue
      const i = s >> 2
      const h = s & 3
      if (dist) dist[i] = Math.min(dist[i] as number, d)
      if (!dist && goal(i)) {
        const cells: number[] = []
        for (let k = s; k >= 0; k = prev[k] as number) {
          if (cells[cells.length - 1] !== k >> 2) cells.push(k >> 2)
        }
        return cells.reverse()
      }
      for (let nh = 0; nh < 4; nh++) {
        if (nh === ((h + 2) & 3)) continue
        const dc = (D4[nh] as [number, number])[0]
        const dr = (D4[nh] as [number, number])[1]
        const c = col(i) + dc
        const r = row(i) + dr
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue
        const j = r * g.cols + c
        if (!walkable(j)) continue
        const nd = d + 1 + Y.routeEdge * (near[j] as number) + (nh === h || d === 0 ? 0 : Y.routeTurn)
        const ns = j * 4 + nh
        if (nd < (cost[ns] as number)) {
          cost[ns] = nd
          prev[ns] = s
          push(nd, ns)
        }
      }
    }
    return null
  }

  const centre = (i: number): P3 => {
    const y = ((g.h0[i] as number) + (g.h1[i] as number)) / 2
    return { x: (col(i) + 0.5) * g.cell, y: y + 0.012, z: (row(i) + 0.5) * g.cell }
  }
  const polyline = (cells: number[]): P3[] => {
    const pts = cells.map(centre)
    return pts.filter((p, k) => {
      if (k === 0 || k === pts.length - 1) return true
      const a = pts[k - 1] as P3
      const b = pts[k + 1] as P3
      const straight = Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) < 1e-6
      return !(straight && Math.abs(p.y - a.y) < 1e-4 && Math.abs(p.y - b.y) < 1e-4)
    })
  }
  const open = (i: number): number => {
    // a marker cell may itself be flagged blocked by a block: unblock it for routing
    blocked[i] = 0
    return i
  }

  const main: P3[][] = []
  const spurs: P3[][] = []
  if (g.start < 0 || g.artifact < 0) return { main, spurs }
  const nodes = [open(g.start)]
  const toStart = new Float32Array(n).fill(1e9)
  route(open(g.start), () => false, toStart)
  const cps = g.checkpoints.map(open).sort((a, b) => (toStart[a] as number) - (toStart[b] as number))
  nodes.push(...cps, open(g.artifact))
  const onRoute = new Set<number>()
  for (let k = 0; k + 1 < nodes.length; k++) {
    const goal = nodes[k + 1] as number
    const cells = route(nodes[k] as number, (i) => i === goal)
    if (!cells || cells.length < 2) continue
    for (const c of cells) onRoute.add(c)
    main.push(polyline(cells))
  }
  for (const t of g.terminals) {
    const start = open(t)
    if (onRoute.has(start)) continue
    const cells = route(start, (i) => onRoute.has(i))
    if (cells && cells.length >= 2) spurs.push(polyline(cells))
  }
  return { main, spurs }
}
