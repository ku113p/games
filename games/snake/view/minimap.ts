// Minimap in the corner: a second render pass with an orthographic camera into a scissor region
// of the canvas (not DOM). A muted hint for peripheral vision.
//
// Only in free mode; hidden in plane mode, where the game is an "ordinary snake".
//
// Two parts side by side (designer's decision):
//  1. TOP MAP (label XZ): a windowCells x windowCells square of cells (config.minimap),
//     X horizontal, Z vertical, a slice at head height (Y). RIGIDLY tied to the world axes:
//     it does not reorient when the snake turns. The window scrolls after the head and stops at
//     the arena bounds (see map-window.ts): at a wall the window stands still and the marker moves inside it; in the middle of a
//     large arena the marker stays centered and the "world" slides under it. If the arena is no larger than the window, the window equals the arena.
//  2. LEVEL GAUGE (label Y): a narrow vertical strip, one line. Top of the strip is the top of the world,
//     bottom is the bottom, regardless of the camera. It shows not the whole arena height but a WINDOW of ±levelWindowCells/2 cells
//     around the head (config.minimap, same arithmetic as the map: map-window.ts): one step always
//     moves the picture by a whole strip cell at any arena size (on 100³ the full height would give
//     ~1.5 px per step). The head marker (yellow dash) is at the window center, ticks slide past it (tied to
//     the world: minor ones every cell, major ones every TICK_MAJOR_EVERY); at a wall the window stops and the marker moves
//     inside it. Arena floor and ceiling are bright lines, but only when they fall in the window. The apple is a pink diamond
//     in the window, and outside the window an up/down arrow at the edge. Along the right edge of the strip a thin trough spans the full
//     arena height with two dots (me and the apple): insurance for "where am I in the whole arena". Obstacles and body
//     are not shown on the strip.
//
// The map frame is the edge of the WINDOW, not a wall. The real arena wall is drawn as a bright solid
// line on the side of the window where it hit the boundary; the quiet thin frame is just the
// edge of view, the world continues beyond it. On the strip, floor and ceiling are real walls, always bright.
//
// What the map draws: obstacles are quiet squares STRICTLY of their own slice (only cells at
// head level), the snake body follows the same rule with the green-cyan gradient as in the game,
// the head is the most prominent marker: a point along the heading in map axes, and if the snake moves
// perpendicular to the map (along the Y axis) - nested chevrons "out of the screen" (up: they diverge from the center;
// the map is a top view, up = toward the eye) or "into the screen" (down: they converge to the center) with a pulse on every step.
// The apple is always visible:
//  - diamond: the apple is right here, at head level (in the slice);
//  - empty diamond outline with a stem up/down: the apple is in the window but on another level (projection);
//    the stem length is proportional to the height difference and is capped at the maximum / window edge;
//  - triangle arrow at the window edge: the apple is outside the window, the arrow points where to go.
// Cell sets are rebuilt once per step (head/length/size change), not every frame;
// strip markers move by position. State is read through core/queries. No objects are created per frame.

import {
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  type WebGLRenderer,
} from 'three'
import type { GameState } from '../core/state'
import { applePos, viewFrame, cubeSize, forEachObstacle, forEachSnakeSegment, head, snakeLength } from '../core/queries'
import { clampToWindow, isInWindow, isMajorTick, levelFraction, touchesHighWall, touchesLowWall, windowFraction, windowLength, windowStart } from './map-window'
import {
  APPLE_COLOR,
  MINIMAP_APPLE_ALPHA,
  MINIMAP_APPLE_RING_ALPHA,
  MINIMAP_BG_ALPHA,
  MINIMAP_BG_COLOR,
  MINIMAP_BODY_ALPHA,
  MINIMAP_BORDER_ALPHA,
  MINIMAP_BORDER_COLOR,
  MINIMAP_HEAD_ALPHA,
  MINIMAP_LABEL_ALPHA,
  MINIMAP_LEVEL_TICK_ALPHA,
  MINIMAP_LEVEL_TICK_MAJOR_ALPHA,
  MINIMAP_LEVEL_TRACK_ALPHA,
  MINIMAP_TROUGH_ALPHA,
  MINIMAP_OBSTACLE_ALPHA,
  MINIMAP_OBSTACLE_COLOR,
  MINIMAP_WALL_ALPHA,
  MINIMAP_WALL_COLOR,
  SNAKE_BODY_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_TAIL_COLOR,
} from './palette'

// Presentation constants, not balance values. Screen sizes are in CSS pixels.
// Map + level gauge together: share of screen width, bounds and a height ceiling (top of the screen, portrait:
// the lower half is taken by controls).
const WIDTH_FRACTION = 0.52
const WIDTH_MIN_PX = 170
const WIDTH_MAX_PX = 380
const HEIGHT_MAX_FRACTION = 0.26
// Top-left corner: the bottom of the screen is taken by tap zones, top center by the score, right by pause.
// Generous top offset for the notch/status bar (the canvas does not know the safe area).
const MARGIN_LEFT_PX = 12
const MARGIN_TOP_PX = 48
// Geometry in map cells. On-screen cell size derives from the panel width.
const GAP = 1.8 // gap between the map and the strip
const STRIP_W = 3.2 // width of the level-gauge strip
const LEVEL_MARK_H = 0.9 // thickness of the head dash on the strip (independent of arena height)
const TROUGH_ZONE = 0.9 // width of the strip's right zone reserved for the trough
const TROUGH_W = 0.35 // trough thickness (~2.5 px with a typical panel)
const TROUGH_DOT = 0.9 // diameter of the "me" and "apple" dots in the trough
const TICK_H = 0.16 // thickness of a strip window tick
const TICK_MINOR_W = 0.8 // length of a minor tick (from the strip's left edge)
const TICK_MAJOR_W = 1.6 // length of a major tick
const TICK_MAJOR_EVERY = 5 // major tick every this many world cells
const LEVEL_ARROW = 1.6 // size of the apple arrow when the apple is outside the strip window
const LEVEL_ARROW_INSET = 1.0 // inset of that arrow from the strip edge
const LEVEL_APPLE_R = 1.35 // apple diamond "radius" on the strip
const WALL_THICK = 0.7 // thickness of the real wall line (outside the window, in the frame)
const EDGE_PAD = 0.4 // margin behind the wall up to the camera edge
const MARKER = 1.8 // head marker size
const APPLE_R = 1.35 // apple diamond "radius"
const RING_INNER = 0.55 // inner radius of the diamond outline (fraction of the outer)
const ARROW = 2.2 // size of the apple arrow outside the window
// Head chevrons when moving along Y: four sides x two nested layers.
const CHEV_ARM = 0.5 // reach of the chevron "arm"
const CHEV_THICK = 0.3 // stroke thickness
const CHEV_R0 = 0.55 // radius of the inner layer
const CHEV_GAP = 0.8 // step between layers
const CHEV_SCALE = 1.4 // overall chevron scale (the head marker must be no smaller than the point-triangle)
const PULSE_MS = 200 // chevron pulse on every step
const PULSE_GAIN = 0.5 // scale gain at the start of the pulse
// Apple stem (apple in the window but on another level): map units.
const LEG_PER_CELL = 0.5 // stem length per cell of height difference
const LEG_MAX = 5 // cap: it does not grow beyond this
const LEG_THICK = 0.3
const LEG_CAP_W = 1.0 // crossbar at the end of the stem
const LEG_EDGE_PAD = 0.2 // margin to the window edge
const OBSTACLE_CELL = 0.9 // size of an obstacle/body square in cells
const LABEL_H = 1.8 // height of the axis label letter
const LABEL_W = 1.2
const LABEL_GAP = 0.5
// Below this free-mode weight the map is not drawn at all.
const MIN_AMOUNT = 0.02
// Strips for walls: 4 sides of the map + strip floor and ceiling.
const WALL_BARS = 6

/** Head chevrons: 4 sides x 2 nested layers; outward - vertices point away from the center (out of the screen), otherwise toward the center (into the screen). Cold path. */
function chevronGeometry(outward: boolean): BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const seg = (ax: number, ay: number, bx: number, by: number): void => {
    const dx = bx - ax
    const dy = by - ay
    const l = Math.hypot(dx, dy)
    const nx = (-dy / l) * (CHEV_THICK / 2)
    const ny = (dx / l) * (CHEV_THICK / 2)
    const i = pos.length / 3
    pos.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0)
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  for (let side = 0; side < 4; side++) {
    const ang = (side * Math.PI) / 2
    const ux = Math.cos(ang)
    const uy = Math.sin(ang)
    const vx = -uy
    const vy = ux
    for (let layer = 0; layer < 2; layer++) {
      const r = CHEV_R0 + layer * CHEV_GAP
      // Vertex nearer the center (into the screen) or farther (out of the screen); the arms are at a different depth.
      const tipR = outward ? r + CHEV_ARM : r
      const armR = outward ? r : r + CHEV_ARM
      const tx = ux * tipR
      const ty = uy * tipR
      seg(tx, ty, ux * armR + vx * CHEV_ARM, uy * armR + vy * CHEV_ARM)
      seg(tx, ty, ux * armR - vx * CHEV_ARM, uy * armR - vy * CHEV_ARM)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

interface Layer {
  material: MeshBasicMaterial | LineBasicMaterial
  base: number
}

export class MiniMap {
  private scene = new Scene()
  private camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1)
  private layers: Layer[] = []
  private geometries: BufferGeometry[] = []
  private disposables: { dispose(): void }[] = []

  private bgTop: Mesh
  private bgStrip: Mesh
  private borderTop: LineLoop
  private borderStrip: LineLoop
  private stripTrack: Mesh
  private levelHead: Mesh
  private levelApple: Mesh
  private levelArrow: Mesh
  private troughLine: Mesh
  private troughHead: Mesh
  private troughApple: Mesh
  private tickMinor: InstancedMesh
  private tickMajor: InstancedMesh
  private walls: InstancedMesh
  private labels: LineSegments
  private obstacles: InstancedMesh
  private body: InstancedMesh
  private obstacleCount = 0
  private bodyCount = 0
  private bodyDenom = 1
  private bodyLen = -1
  private obstacleKey = -1
  private obstaclesDirty = true
  private tmpMatrix = new Matrix4()
  private tmpColor = new Color()

  // Top-map markers.
  private headTri: Mesh
  private headDot: Mesh
  private appleHere: Mesh
  private appleRing: Mesh
  private appleArrow: Mesh
  private appleLeg: Mesh
  private appleLegCap: Mesh
  private headChevIn: Mesh
  private headChevOut: Mesh
  private pulseT0 = -1e9

  // Layout (cold path, setSize).
  private windowCells: number
  private levelWindowCells: number
  private levelLen = 1 // strip window height in world cells
  private cellH = 1 // cell height on the strip, in map units
  private size = -1
  private len = 1 // window side in cells
  private stripX0 = 0 // left edge of the strip along X
  private mainX = 0 // center of the strip's main part (window markers)
  private troughX = 0 // center of the trough
  // Window of the current step (origins along the world axes).
  private sx = 0
  private sz = 0
  private hy = 0
  private sy = 0 // origin of the strip window along Y

  private screenW = 1
  private screenH = 1
  private panelW = 0
  private panelH = 0

  constructor(windowCells: number, levelWindowCells: number) {
    this.windowCells = Math.max(1, Math.floor(windowCells))
    this.levelWindowCells = Math.max(2, Math.floor(levelWindowCells))
    const cap = this.windowCells * this.windowCells // map slice is no larger than the window
    const quad = new PlaneGeometry(1, 1)
    const tri = new BufferGeometry()
    tri.setAttribute('position', new Float32BufferAttribute([0, 0.6, 0, -0.45, -0.4, 0, 0.45, -0.4, 0], 3))
    const outline = new BufferGeometry()
    outline.setAttribute('position', new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    const diamond = new CircleGeometry(1, 4)
    const ring = new RingGeometry(RING_INNER, 1, 4, 1)
    const dot = new CircleGeometry(0.5, 12)
    const chevIn = chevronGeometry(false)
    const chevOut = chevronGeometry(true)
    this.geometries.push(quad, tri, outline, diamond, ring, dot, chevIn, chevOut)

    this.bgTop = this.mesh(quad, MINIMAP_BG_COLOR, MINIMAP_BG_ALPHA, 0)
    this.bgStrip = this.mesh(quad, MINIMAP_BG_COLOR, MINIMAP_BG_ALPHA, 0)
    this.borderTop = this.loop(outline, MINIMAP_BORDER_COLOR, MINIMAP_BORDER_ALPHA, 1)
    this.borderStrip = this.loop(outline, MINIMAP_BORDER_COLOR, MINIMAP_BORDER_ALPHA, 1)
    this.stripTrack = this.mesh(quad, MINIMAP_BORDER_COLOR, MINIMAP_LEVEL_TRACK_ALPHA, 1)

    this.walls = this.instanced(quad, MINIMAP_WALL_COLOR, MINIMAP_WALL_ALPHA, WALL_BARS, 5)
    this.obstacles = this.instanced(quad, MINIMAP_OBSTACLE_COLOR, MINIMAP_OBSTACLE_ALPHA, cap, 1)
    // Obstacle instance color is white (the material supplies the color); filled up front, once.
    for (let i = 0; i < cap; i++) this.obstacles.setColorAt(i, this.tmpColor.setRGB(1, 1, 1))
    this.body = this.instanced(quad, new Color(1, 1, 1), MINIMAP_BODY_ALPHA, cap, 2)
    this.body.setColorAt(0, this.tmpColor.setRGB(1, 1, 1))

    this.appleRing = this.mesh(ring, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 3)
    this.appleHere = this.mesh(diamond, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 3)
    this.appleArrow = this.mesh(tri, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 4)
    this.headDot = this.mesh(dot, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 5)
    this.headTri = this.mesh(tri, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 6)
    this.headChevIn = this.mesh(chevIn, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 6)
    this.headChevOut = this.mesh(chevOut, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 6)
    this.appleLeg = this.mesh(quad, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 3)
    this.appleLegCap = this.mesh(quad, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 3)
    // Level-gauge markers: head dash and apple diamond (apple is later in order so it does not vanish under the dash).
    this.levelHead = this.mesh(quad, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 5)
    this.levelApple = this.mesh(diamond, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 6)
    this.levelArrow = this.mesh(tri, APPLE_COLOR, MINIMAP_APPLE_RING_ALPHA, 6)
    // Full-arena-height trough and the dots in it; window ticks.
    this.troughLine = this.mesh(quad, MINIMAP_BORDER_COLOR, MINIMAP_TROUGH_ALPHA, 2)
    this.troughHead = this.mesh(dot, SNAKE_HEAD_COLOR, MINIMAP_HEAD_ALPHA, 5)
    this.troughApple = this.mesh(dot, APPLE_COLOR, MINIMAP_APPLE_ALPHA, 6)
    this.tickMinor = this.instanced(quad, MINIMAP_BORDER_COLOR, MINIMAP_LEVEL_TICK_ALPHA, this.levelWindowCells + 1, 2)
    this.tickMajor = this.instanced(quad, MINIMAP_BORDER_COLOR, MINIMAP_LEVEL_TICK_MAJOR_ALPHA, this.levelWindowCells + 1, 2)
    const lm = new LineBasicMaterial({ color: MINIMAP_BORDER_COLOR, transparent: true, opacity: MINIMAP_LABEL_ALPHA, depthTest: false, depthWrite: false })
    this.disposables.push(lm)
    this.layers.push({ material: lm, base: MINIMAP_LABEL_ALPHA })
    this.labels = new LineSegments(new BufferGeometry(), lm)
    this.labels.renderOrder = 1
    this.labels.frustumCulled = false
    this.scene.add(this.labels)
  }

  private mesh(g: BufferGeometry, color: Color, alpha: number, order: number): Mesh {
    const m = new MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false, depthWrite: false })
    this.disposables.push(m)
    this.layers.push({ material: m, base: alpha })
    const mesh = new Mesh(g, m)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return mesh
  }

  private instanced(g: BufferGeometry, color: Color, alpha: number, capacity: number, order: number): InstancedMesh {
    const m = new MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false, depthWrite: false })
    this.disposables.push(m)
    this.layers.push({ material: m, base: alpha })
    const im = new InstancedMesh(g, m, capacity)
    im.count = 0
    im.renderOrder = order
    im.frustumCulled = false
    this.scene.add(im)
    return im
  }

  private loop(g: BufferGeometry, color: Color, alpha: number, order: number): LineLoop {
    const m = new LineBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false, depthWrite: false })
    this.disposables.push(m)
    this.layers.push({ material: m, base: alpha })
    const l = new LineLoop(g, m)
    l.renderOrder = order
    l.frustumCulled = false
    this.scene.add(l)
    return l
  }

  /** Cold path: the game started (the obstacle set may have changed). */
  invalidate(): void {
    this.obstaclesDirty = true
  }

  // Slice cell -> position in map-camera cells: (x, z) at y == hy. Callbacks are created once.
  private putCell(im: InstancedMesh, i: number, px: number, py: number): void {
    this.tmpMatrix.makeScale(OBSTACLE_CELL, OBSTACLE_CELL, 1).setPosition(px, py, 0)
    im.setMatrixAt(i, this.tmpMatrix)
  }

  private readonly writeObstacle = (x: number, y: number, z: number): void => {
    if (y !== this.hy) return
    const len = this.len
    const dx = x - this.sx
    const dz = z - this.sz
    if (dx < 0 || dx >= len || dz < 0 || dz >= len) return
    if (this.obstacleCount < this.obstacles.instanceMatrix.count) {
      this.putCell(this.obstacles, this.obstacleCount++, dx + 0.5, dz + 0.5)
    }
  }

  // Body segment (except the head): same slice rule as for obstacles.
  private readonly writeBody = (x: number, y: number, z: number, i: number): void => {
    if (i === 0 || y !== this.hy) return
    const len = this.len
    const dx = x - this.sx
    const dz = z - this.sz
    if (dx < 0 || dx >= len || dz < 0 || dz >= len) return
    if (this.bodyCount < this.body.instanceMatrix.count) {
      this.tmpColor.copy(SNAKE_BODY_COLOR).lerp(SNAKE_TAIL_COLOR, i / this.bodyDenom)
      this.body.setColorAt(this.bodyCount, this.tmpColor)
      this.putCell(this.body, this.bodyCount++, dx + 0.5, dz + 0.5)
    }
  }

  /** Real-wall strip: center and size in camera cells. */
  private putWall(i: number, cx: number, cy: number, w: number, h: number): number {
    this.tmpMatrix.makeScale(w, h, 1).setPosition(cx, cy, 0)
    this.walls.setMatrixAt(i, this.tmpMatrix)
    return i + 1
  }

  /** Map walls: a strip only where the window hit the arena boundary. */
  private putMapWalls(n: number, sH: number, sV: number): number {
    const len = this.len
    const t = WALL_THICK
    if (touchesLowWall(sH)) n = this.putWall(n, -t / 2, len / 2, t, len + 2 * t)
    if (touchesHighWall(sH, len, this.size)) n = this.putWall(n, len + t / 2, len / 2, t, len + 2 * t)
    if (touchesLowWall(sV)) n = this.putWall(n, len / 2, -t / 2, len + 2 * t, t)
    if (touchesHighWall(sV, len, this.size)) n = this.putWall(n, len / 2, len + t / 2, len + 2 * t, t)
    return n
  }

  /** Rebuild layers for the window around the head; once per step, not every frame. */
  private refresh(s: GameState, hx: number, hy: number, hz: number): void {
    const size = cubeSize(s)
    this.len = windowLength(size, this.windowCells)
    this.hy = hy
    this.sx = windowStart(hx, size, this.windowCells)
    this.sz = windowStart(hz, size, this.windowCells)
    this.levelLen = windowLength(size, this.levelWindowCells)
    this.sy = windowStart(hy, size, this.levelWindowCells)

    this.obstacleCount = 0
    forEachObstacle(s, this.writeObstacle)
    this.obstacles.count = this.obstacleCount
    this.obstacles.instanceMatrix.needsUpdate = true

    this.bodyCount = 0
    this.bodyLen = snakeLength(s)
    this.bodyDenom = Math.max(1, this.bodyLen - 1)
    forEachSnakeSegment(s, this.writeBody)
    this.body.count = this.bodyCount
    this.body.instanceMatrix.needsUpdate = true
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true

    let n = this.putMapWalls(0, this.sx, this.sz)
    // Level-gauge floor and ceiling: real walls, only when they fall in the strip window.
    const t = WALL_THICK
    const cx = this.stripX0 + STRIP_W / 2
    if (touchesLowWall(this.sy)) n = this.putWall(n, cx, -t / 2, STRIP_W + 2 * t, t)
    if (touchesHighWall(this.sy, this.levelLen, size)) n = this.putWall(n, cx, this.len + t / 2, STRIP_W + 2 * t, t)
    this.walls.count = n
    this.walls.instanceMatrix.needsUpdate = true
    this.putTicks(size)
  }

  /** Window ticks of the strip: world cell boundaries inside the window (walls and window edges are drawn by the frame/walls). */
  private putTicks(size: number): void {
    let nm = 0
    let nM = 0
    const ch = this.cellH
    for (let b = this.sy + 1; b < this.sy + this.levelLen; b++) {
      if (b <= 0 || b >= size) continue
      const y = (b - this.sy) * ch
      if (isMajorTick(b, TICK_MAJOR_EVERY)) {
        this.tmpMatrix.makeScale(TICK_MAJOR_W, TICK_H, 1).setPosition(this.stripX0 + TICK_MAJOR_W / 2, y, 0)
        this.tickMajor.setMatrixAt(nM++, this.tmpMatrix)
      } else {
        this.tmpMatrix.makeScale(TICK_MINOR_W, TICK_H, 1).setPosition(this.stripX0 + TICK_MINOR_W / 2, y, 0)
        this.tickMinor.setMatrixAt(nm++, this.tmpMatrix)
      }
    }
    this.tickMinor.count = nm
    this.tickMajor.count = nM
    this.tickMinor.instanceMatrix.needsUpdate = true
    this.tickMajor.instanceMatrix.needsUpdate = true
  }

  /** Apple markers on the map: here / in the window on another level / outside the window. */
  private placeApple(va: number, vb: number, sa: number, sb: number, inSlice: boolean, dy: number): void {
    const len = this.len
    const here = this.appleHere
    const ring = this.appleRing
    const arrow = this.appleArrow
    const inside = isInWindow(va, sa, len) && isInWindow(vb, sb, len)
    const px = clampToWindow(va, sa, len) + 0.5
    const py = clampToWindow(vb, sb, len) + 0.5
    here.visible = inside && inSlice
    ring.visible = inside && !inSlice
    arrow.visible = !inside
    // Stem: only on the outline (apple in the window but on another level). Up - the apple is higher.
    const leg = this.appleLeg
    const cap = this.appleLegCap
    let legLen = 0
    let dir = 1
    if (inside && !inSlice) {
      dir = dy > 0 ? 1 : -1
      const y0 = py + dir * APPLE_R
      const room = (dir > 0 ? len - y0 : y0) - LEG_EDGE_PAD
      legLen = Math.min(Math.abs(dy) * LEG_PER_CELL, LEG_MAX, room)
      if (legLen > 0) {
        leg.position.set(px, y0 + (dir * legLen) / 2, 0)
        leg.scale.set(LEG_THICK, legLen, 1)
        cap.position.set(px, y0 + dir * legLen, 0)
        cap.scale.set(LEG_CAP_W, LEG_THICK, 1)
      }
    }
    leg.visible = legLen > 0
    cap.visible = legLen > 0
    if (inside) {
      const target = inSlice ? here : ring
      target.position.set(px, py, 0)
    } else {
      arrow.position.set(px, py, 0)
      // The arrow points from the window center to the apple (the "where to go" direction).
      const c = (len - 1) / 2
      arrow.rotation.z = Math.atan2(-(va - sa - c), vb - sb - c)
    }
  }

  /**
   * Head marker: a point along the heading in map axes; when moving along the slice normal (Y axis) - nested chevrons:
   * up (toward the eye above the map) they diverge from the center "out of the screen", down they converge "into the screen". The pulse is on a step.
   */
  private placeHead(px: number, py: number, hmx: number, hmy: number, vy: number): void {
    const tri = this.headTri
    const dot = this.headDot
    const cin = this.headChevIn
    const cout = this.headChevOut
    const moving = hmx !== 0 || hmy !== 0
    tri.visible = moving
    cout.visible = !moving && vy > 0
    cin.visible = !moving && vy < 0
    dot.visible = !moving && vy === 0
    tri.position.set(px, py, 0)
    dot.position.set(px, py, 0)
    cin.position.set(px, py, 0)
    cout.position.set(px, py, 0)
    if (moving) tri.rotation.z = Math.atan2(-hmx, hmy)
    const k = 1 - (performance.now() - this.pulseT0) / PULSE_MS
    const sc = CHEV_SCALE * (k > 0 ? 1 + PULSE_GAIN * k * k : 1)
    cin.scale.set(sc, sc, 1)
    cout.scale.set(sc, sc, 1)
  }

  /** Cold path: the cube size changed - layout of the maps in cells. */
  setSize(size: number): void {
    if (size === this.size) return
    this.size = size
    const len = windowLength(size, this.windowCells)
    this.len = len
    this.stripX0 = len + GAP
    this.levelLen = windowLength(size, this.levelWindowCells)
    this.cellH = len / this.levelLen
    const t = WALL_THICK
    const labelY = len + t + 0.5
    this.camera.left = -t - EDGE_PAD
    this.camera.right = this.stripX0 + STRIP_W + t + EDGE_PAD
    this.camera.bottom = -t - EDGE_PAD
    this.camera.top = labelY + LABEL_H + EDGE_PAD
    this.camera.updateProjectionMatrix()

    const cx = this.stripX0 + STRIP_W / 2
    const mainW = STRIP_W - TROUGH_ZONE
    const mx = this.stripX0 + mainW / 2 // center of the strip's main part
    const tx = this.stripX0 + STRIP_W - TROUGH_ZONE / 2 // center of the trough
    this.bgTop.position.set(len / 2, len / 2, 0)
    this.bgTop.scale.set(len + 2 * t, len + 2 * t, 1)
    this.bgStrip.position.set(cx, len / 2, 0)
    this.bgStrip.scale.set(STRIP_W + 2 * t, len + 2 * t, 1)
    this.borderTop.position.set(len / 2, len / 2, 0)
    this.borderTop.scale.set(len, len, 1)
    this.borderStrip.position.set(cx, len / 2, 0)
    this.borderStrip.scale.set(STRIP_W, len, 1)
    // Strip center line: "1 line = level".
    this.stripTrack.position.set(mx, len / 2, 0)
    this.stripTrack.scale.set(LEVEL_MARK_H * 0.25, len, 1)
    this.levelHead.scale.set(mainW, LEVEL_MARK_H, 1)
    this.levelApple.scale.set(LEVEL_APPLE_R, LEVEL_APPLE_R, 1)
    this.levelArrow.scale.set(LEVEL_ARROW, LEVEL_ARROW, 1)
    this.troughLine.position.set(tx, len / 2, 0)
    this.troughLine.scale.set(TROUGH_W, len, 1)
    this.troughHead.scale.set(TROUGH_DOT, TROUGH_DOT, 1)
    this.troughApple.scale.set(TROUGH_DOT, TROUGH_DOT, 1)
    this.mainX = mx
    this.troughX = tx

    this.headTri.scale.set(MARKER, MARKER, 1)
    this.headDot.scale.set(MARKER * 0.8, MARKER * 0.8, 1)
    this.appleHere.scale.set(APPLE_R, APPLE_R, 1)
    this.appleRing.scale.set(APPLE_R, APPLE_R, 1)
    this.appleArrow.scale.set(ARROW, ARROW, 1)
    this.buildLabels(labelY)
    this.obstacleKey = -1
    this.layout()
  }

  // Labels: "XZ" above the map, "Y" above the strip, as segments. Cold path.
  private labelSegs: number[] = []
  private buildLabels(y0: number): void {
    this.labelSegs.length = 0
    this.pushLetter('X', 0, y0)
    this.pushLetter('Z', LABEL_W + LABEL_GAP, y0)
    this.pushLetter('Y', this.stripX0 + (STRIP_W - LABEL_W) / 2, y0)
    this.labels.geometry.dispose()
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.labelSegs, 3))
    this.labels.geometry = g
  }

  private pushLetter(ch: string, x0: number, y0: number): void {
    const w = LABEL_W
    const h = LABEL_H
    const seg = (ax: number, ay: number, bx: number, by: number): void => {
      this.labelSegs.push(x0 + ax * w, y0 + ay * h, 0, x0 + bx * w, y0 + by * h, 0)
    }
    if (ch === 'X') {
      seg(0, 0, 1, 1)
      seg(0, 1, 1, 0)
    } else if (ch === 'Z') {
      seg(0, 1, 1, 1)
      seg(1, 1, 0, 0)
      seg(0, 0, 1, 0)
    } else {
      seg(0, 1, 0.5, 0.5)
      seg(1, 1, 0.5, 0.5)
      seg(0.5, 0.5, 0.5, 0)
    }
  }

  /** Bottom edge of the map panel in CSS px from the top of the window (for the debug panel). */
  get bottomCssPx(): number {
    return MARGIN_TOP_PX + this.panelH
  }

  resize(width: number, height: number): void {
    this.screenW = width
    this.screenH = height
    this.layout()
  }

  private layout(): void {
    if (this.size < 0) return
    const contentW = this.camera.right - this.camera.left
    const contentH = this.camera.top - this.camera.bottom
    let w = Math.min(WIDTH_MAX_PX, Math.max(WIDTH_MIN_PX, this.screenW * WIDTH_FRACTION))
    const maxH = this.screenH * HEIGHT_MAX_FRACTION
    if ((w * contentH) / contentW > maxH) w = (maxH * contentW) / contentH
    this.panelW = w
    this.panelH = (w * contentH) / contentW
  }

  /** Frame, allocation-free: draws the maps over the already finished frame on screen. */
  render(renderer: WebGLRenderer, s: GameState, freeAmount: number): void {
    if (freeAmount < MIN_AMOUNT || this.size < 0) return
    const size = cubeSize(s)
    const hd = head(s)
    const ap = applePos(s)
    // viewFrame: the head arrow on the map must turn immediately on input,
    // together with the camera and hints, not on the next step.
    const f = viewFrame(s)

    // Layers: rebuilt only when head/size/game/length changes (i.e. once per step).
    const key = hd.x + size * (hd.y + size * hd.z)
    if (this.obstaclesDirty || key !== this.obstacleKey || snakeLength(s) !== this.bodyLen) {
      this.obstaclesDirty = false
      this.obstacleKey = key
      this.pulseT0 = performance.now() // step: chevron pulse
      this.refresh(s, hd.x, hd.y, hd.z)
    }

    // Markers in world axes; heading = -depth (lies in the frame plane), projected onto the map axes.
    const sx = this.sx, sz = this.sz
    this.placeHead(hd.x - sx + 0.5, hd.z - sz + 0.5, -f.depth.x, -f.depth.z, -f.depth.y)
    this.placeApple(ap.x, ap.z, sx, sz, ap.y === hd.y, ap.y - hd.y)
    // Level gauge: window around the head (marker centered, moves inside at a wall), one step = one strip cell.
    const mx = this.mainX
    const sy = this.sy
    const ll = this.levelLen
    this.levelHead.position.set(mx, windowFraction(hd.y, sy, ll) * this.len, 0)
    const aIn = isInWindow(ap.y, sy, ll)
    this.levelApple.visible = aIn
    this.levelArrow.visible = !aIn
    if (aIn) {
      this.levelApple.position.set(mx, windowFraction(ap.y, sy, ll) * this.len, 0)
    } else {
      const up = ap.y >= sy + ll
      this.levelArrow.position.set(mx, up ? this.len - LEVEL_ARROW_INSET : LEVEL_ARROW_INSET, 0)
      this.levelArrow.rotation.z = up ? 0 : Math.PI
    }
    // Trough: the whole arena height, the overall picture (1.5 px per step on 100³ - insurance, not a movement indicator).
    this.troughHead.position.set(this.troughX, levelFraction(hd.y, size) * this.len, 0)
    this.troughApple.position.set(this.troughX, levelFraction(ap.y, size) * this.len, 0)

    // Transparency: free-mode weight.
    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i]!
      l.material.opacity = l.base * freeAmount
    }

    const h = this.screenH
    const x = MARGIN_LEFT_PX
    const y = h - MARGIN_TOP_PX - this.panelH
    const prevAutoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setScissorTest(true)
    renderer.setScissor(x, y, this.panelW, this.panelH)
    renderer.setViewport(x, y, this.panelW, this.panelH)
    renderer.render(this.scene, this.camera)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, this.screenW, this.screenH)
    renderer.autoClear = prevAutoClear
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose()
    this.labels.geometry.dispose()
    for (const d of this.disposables) d.dispose()
    this.geometries.length = 0
    this.disposables.length = 0
    this.layers.length = 0
  }
}
