// A placeholder mansion (WP0): a light floor, plain wall boxes, markers where monsters will come from, and the medkits.
// WP5 replaces it with view/mansion.ts (the real kit: wainscot, floors, ceilings, windows with moonlight, fireplaces) and
// the spawn point and medkit views. It only reads the grid and the state through queries.
import { AmbientLight, BoxGeometry, Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry } from 'three'
import { CellKind } from '../core/grid'
import { levelGrid, medkits, spawnPointStates, spawnPoints } from '../core/queries'
import type { GameState, Sim } from '../core/state'

export interface PlaceholderLevel {
  root: Group
  update(s: GameState): void
}

const SPAWN_COLOR: Record<string, number> = { window: 0x9fc8ff, fireplace: 0xff8a2a, crack: 0x6dff7a, door: 0xffcf6a, wall: 0xc9a8ff, edge: 0xffffff }

export function buildPlaceholder(sim: Sim, s: GameState): PlaceholderLevel {
  const g = levelGrid(sim)
  const root = new Group()
  root.add(new AmbientLight(0xfff1dc, 1.1))

  const floor = new Mesh(new PlaneGeometry(g.cols * g.cell, g.rows * g.cell), new MeshStandardMaterial({ color: 0xcdb593, roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set((g.cols * g.cell) / 2, 0, (g.rows * g.cell) / 2)
  root.add(floor)

  const cells: number[] = []
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === CellKind.Wall) cells.push(i)
  const box = new BoxGeometry(g.cell, 1, g.cell)
  const walls = new InstancedMesh(box, new MeshStandardMaterial({ color: 0x7a5a42, roughness: 0.9 }), Math.max(1, cells.length))
  const d = new Object3D()
  cells.forEach((i, n) => {
    const top = g.top[i] as number
    d.position.set(((i % g.cols) + 0.5) * g.cell, top / 2, (Math.floor(i / g.cols) + 0.5) * g.cell)
    d.scale.set(1, top, 1)
    d.updateMatrix()
    walls.setMatrixAt(n, d.matrix)
  })
  walls.count = cells.length
  root.add(walls)

  // spawn point markers: a glowing slab at the mouth, brighter while the point is open or telegraphing
  const marks: { mat: MeshBasicMaterial; base: Color }[] = []
  for (const sp of spawnPoints(sim)) {
    const base = new Color(SPAWN_COLOR[sp.type] ?? 0xffffff)
    const mat = new MeshBasicMaterial({ color: base.clone().multiplyScalar(0.35), toneMapped: false })
    const m = new Mesh(new BoxGeometry(sp.ny !== 0 ? 1.4 : 0.1 + Math.abs(sp.nz) * 1.3, sp.ny !== 0 ? 0.05 : 1.4, sp.ny !== 0 ? 1.4 : 0.1 + Math.abs(sp.nx) * 1.3), mat)
    m.position.set(sp.mouth.x + sp.nx * 0.06, sp.mouth.y + (sp.ny !== 0 ? 0.03 : 0.9), sp.mouth.z + sp.nz * 0.06)
    root.add(m)
    marks.push({ mat, base })
  }

  const kits: Mesh[] = medkits(s).map((k) => {
    const m = new Mesh(new BoxGeometry(0.5, 0.3, 0.35), new MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x22aa44, emissiveIntensity: 0.8 }))
    m.position.set(k.pos.x, k.pos.y + 0.2, k.pos.z)
    root.add(m)
    return m
  })

  return {
    root,
    update(st: GameState): void {
      const states = spawnPointStates(st)
      for (let i = 0; i < marks.length; i++) {
        const st2 = states[i]
        const m = marks[i]
        if (!m || !st2) continue
        const k = st2.open > 0 ? 1.6 : st2.telegraph > 0 ? 1.1 : 0.35
        m.mat.color.copy(m.base).multiplyScalar(k)
      }
      const ks = medkits(st)
      for (let i = 0; i < kits.length; i++) (kits[i] as Mesh).visible = !(ks[i]?.taken ?? false)
    },
  }
}
