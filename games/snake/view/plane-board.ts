// The board of the flat opening: the head's layer drawn as a flat playing field, a grid of cells with a bright border. It is what
// makes the first game look like ordinary flat snake: with the other depth layers clipped away (camera-rig.ts, updateClip) the
// walls of the cube are not drawn, so the layer needs a field of its own.
// It exists only in a game that starts flat (createView builds it for mode 'plane'); it fades out as the camera leaves
// the plane view (rig.reveal 0 -> 1) and is hidden after that. Built once (cold path); per frame only update(), allocation-free.

import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, type Scene } from 'three'
import type { GameState } from '../core/state'
import { head } from '../core/queries'
import { CUBE_EDGE_COLOR, GRID_COLOR } from './palette'

// Styling constants, not balance values.
const GRID_ALPHA = 0.22 // cell lines: readable on a phone, quiet next to the snake
const GRID_MAJOR_ALPHA = 0.4
const MAJOR_EVERY = 5
const BORDER_THICKNESS = 0.12 // cells
const BORDER_ALPHA = 1
// Behind the snake's cells (they are drawn around the layer's center, +-0.4): the grid must never poke through the snake or the apple.
const BOARD_BEHIND = 0.46
const BORDER_BEHIND = 0.3

export class PlaneBoard {
  private scene: Scene
  private lines: LineSegments[] = []
  private lineMaterials: LineBasicMaterial[] = []
  private border: Mesh[] = []
  private borderGeometry: BoxGeometry | null = null
  private borderMaterial: MeshBasicMaterial | null = null
  private lineBase: number[] = []
  private shown = true
  private lastReveal = -1

  constructor(scene: Scene, s: GameState) {
    this.scene = scene
    const size = s.size
    const d = s.frame.depth
    // Depth axis (0, 1 or 2) and the side the viewer is on; u and v are the other two axes.
    const axis = Math.abs(d.x) > 0.5 ? 0 : Math.abs(d.y) > 0.5 ? 1 : 2
    const towardViewer = (axis === 0 ? d.x : axis === 1 ? d.y : d.z) > 0 ? 1 : -1
    const h = head(s)
    const layer = axis === 0 ? h.x : axis === 1 ? h.y : h.z
    const u = (axis + 1) % 3
    const v = (axis + 2) % 3
    const lo = -0.5
    const hi = size - 0.5

    const minor: number[] = []
    const major: number[] = []
    const pushLine = (into: number[], c: number, alongV: boolean, w: number): void => {
      const a = [0, 0, 0]
      const b = [0, 0, 0]
      a[axis] = w
      b[axis] = w
      if (alongV) {
        a[u] = c; a[v] = lo
        b[u] = c; b[v] = hi
      } else {
        a[u] = lo; a[v] = c
        b[u] = hi; b[v] = c
      }
      into.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!)
    }
    const wGrid = layer - towardViewer * BOARD_BEHIND
    // Lines on the cell boundaries; the border replaces the outermost two.
    for (let k = 1; k < size; k++) {
      const c = lo + k
      const into = k % MAJOR_EVERY === 0 ? major : minor
      pushLine(into, c, true, wGrid)
      pushLine(into, c, false, wGrid)
    }
    for (const [pts, alpha] of [[minor, GRID_ALPHA], [major, GRID_MAJOR_ALPHA]] as const) {
      if (pts.length === 0) continue
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(pts, 3))
      const m = new LineBasicMaterial({ color: GRID_COLOR.clone(), transparent: true, opacity: alpha, depthWrite: false, fog: false })
      const ls = new LineSegments(g, m)
      ls.frustumCulled = false
      this.lines.push(ls)
      this.lineMaterials.push(m)
      this.lineBase.push(alpha)
      scene.add(ls)
    }

    // Border: four bars around the layer, like the cube's edges but flat.
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshBasicMaterial({ color: new Color().copy(CUBE_EDGE_COLOR), transparent: true, opacity: BORDER_ALPHA, fog: false })
    this.borderGeometry = geometry
    this.borderMaterial = material
    const t = BORDER_THICKNESS
    const len = size + t
    const wBorder = layer - towardViewer * BORDER_BEHIND
    for (let along = 0; along < 2; along++) {
      const a1 = along === 0 ? u : v // the bar runs along this axis
      const a2 = along === 0 ? v : u // and sits at lo/hi of this one
      for (let side = 0; side < 2; side++) {
        const m = new Mesh(geometry, material)
        const sc = [t, t, t]
        sc[a1] = len
        m.scale.set(sc[0]!, sc[1]!, sc[2]!)
        const pos = [0, 0, 0]
        pos[axis] = wBorder
        pos[a1] = (size - 1) / 2
        pos[a2] = side === 0 ? lo : hi
        m.position.set(pos[0]!, pos[1]!, pos[2]!)
        m.frustumCulled = false
        this.border.push(m)
        scene.add(m)
      }
    }
  }

  /** Per frame: the board fades with the reveal of the other layers and is hidden once it is complete. reveal is 0..1. */
  update(reveal: number): void {
    if (reveal === this.lastReveal) return
    this.lastReveal = reveal
    const show = reveal < 1
    if (show !== this.shown) {
      this.shown = show
      for (let i = 0; i < this.lines.length; i++) this.lines[i]!.visible = show
      for (let i = 0; i < this.border.length; i++) this.border[i]!.visible = show
    }
    if (!show) return
    const k = 1 - reveal
    for (let i = 0; i < this.lineMaterials.length; i++) this.lineMaterials[i]!.opacity = this.lineBase[i]! * k
    if (this.borderMaterial) this.borderMaterial.opacity = BORDER_ALPHA * k
  }

  dispose(): void {
    for (const l of this.lines) {
      this.scene.remove(l)
      l.geometry.dispose()
    }
    for (const m of this.lineMaterials) m.dispose()
    for (const b of this.border) this.scene.remove(b)
    this.borderGeometry?.dispose()
    this.borderMaterial?.dispose()
    this.lines.length = 0
    this.lineMaterials.length = 0
    this.border.length = 0
  }
}
