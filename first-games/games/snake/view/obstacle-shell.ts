// Outer shell of the obstacle set (pure function, no three; computed
// once on 'started', not called per frame).
//   A cell's face exists only if the neighboring cell on that side is free
//   (outside the cube counts as free).
//   An edge exists only at a real kink of the outline. For a visible face with normal N and
//   an in-plane neighbor cell A (beyond the edge), C = A + N:
//     A free              - convex edge, drawn;
//     A occupied, C occupied - concave edge, drawn;
//     A occupied, C free  - the face continues flat, no edge.
//   The same edge arrives from several faces - deduplicated by the center key.
//   Closing the gaps. The face plane sits at `half` from the cell center (0.49), so
//   cubes do not touch the wall of the arena cube. But then neighboring cubes do not meet: there is
//   a gap 2*(0.5-half) between them, and with no inner faces it is see-through. So the face
//   is not shifted but stretched TOWARD the neighbor along each of its four edges:
//     no neighbor (convex kink)         - up to half, as before (a single cube is unchanged);
//     neighbor present, continues flat  - up to 0.5, where it meets the neighbor's face;
//     neighbor present and occupied above it - concave kink, up to 1 - half: there stands
//                                        the neighbor's side face above it;
//     no neighbor, but occupied above it - diagonal edge-to-edge seam (two cubes touch
//                                        only along an edge): the same 1 - half, both faces
//                                        meet in a corner and the gap along the edge is closed.
//   Outline edges stay at half and do not depend on this.
//   A corner-only seam (a single point) is not closed: there is neither a shared edge nor a face,
//   and the opening is a point of size (1-2*half)^2, visible only along the space diagonal.
// Format: faces = [cx,cy,cz,code] * n, code = face + 6 * (s0 + 3*s1 + 9*s2 + 27*s3):
//         face: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z;
//         s0..s3 - edges +t1, -t1, +t2, -t2 (t1 = axis a+1, t2 = axis a+2, a - the face's axis),
//         edge state: 0 convex, 1 flat, 2 concave or diagonal edge-to-edge seam (see EDGE_*).
//         edges = [ex,ey,ez,axis] * n, (ex,ey,ez) - edge center, axis 0/1/2 - the direction it runs along.

export const EDGE_CONVEX = 0
export const EDGE_FLAT = 1
export const EDGE_CONCAVE = 2

/** Edge state from a face code: idx 0 +t1, 1 -t1, 2 +t2, 3 -t2. */
export function faceEdgeState(code: number, idx: number): number {
  return Math.floor(code / 6 / 3 ** idx) % 3
}

/** How far the edge extends from the cell center along the tangent (in cells). */
export function edgeReach(state: number, half: number): number {
  return state === EDGE_CONVEX ? half : state === EDGE_FLAT ? 0.5 : 1 - half
}

export interface Shell {
  faces: Float32Array
  edges: Float32Array
  faceCount: number
  edgeCount: number
}

export function computeShell(solid: ReadonlySet<number>, n: number, half: number): Shell {
  const key = (x: number, y: number, z: number): number => x + n * (y + n * z)
  const isSolid = (x: number, y: number, z: number): boolean =>
    x >= 0 && y >= 0 && z >= 0 && x < n && y < n && z < n && solid.has(key(x, y, z))
  const faces: number[] = []
  const edges: number[] = []
  const seen = new Set<number>()
  const m = 2 * n + 3
  const c = [0, 0, 0]
  const e = [0, 0, 0]
  const nn = [0, 0, 0]
  const uu = [0, 0, 0]

  for (const k of solid) {
    c[0] = k % n
    c[1] = Math.floor(k / n) % n
    c[2] = Math.floor(k / (n * n))
    for (let f = 0; f < 6; f++) {
      const a = f >> 1
      const sgn = f & 1 ? -1 : 1
      nn[0] = nn[1] = nn[2] = 0
      nn[a] = sgn
      if (isSolid(c[0]! + nn[0]!, c[1]! + nn[1]!, c[2]! + nn[2]!)) continue
      // States of the four edges: t = 1, 2 (axis a+t), sign +/-.
      let code = 0
      let mul = 1
      for (let t = 1; t <= 2; t++) {
        const ua = (a + t) % 3
        for (let su = 1; su >= -1; su -= 2) {
          uu[0] = uu[1] = uu[2] = 0
          uu[ua] = su
          const ax = c[0]! + uu[0]!
          const ay = c[1]! + uu[1]!
          const az = c[2]! + uu[2]!
          // In-plane neighbor occupied: flat or concave. Neighbor free but occupied above it -
          // a diagonal edge-to-edge seam: the faces of both cubes stretch toward each other as in a concave
          // kink and meet in a corner, otherwise a gap 2*(0.5-half) remains between the cubes' edges.
          const above = isSolid(ax + nn[0]!, ay + nn[1]!, az + nn[2]!)
          const st = isSolid(ax, ay, az) ? (above ? EDGE_CONCAVE : EDGE_FLAT) : above ? EDGE_CONCAVE : EDGE_CONVEX
          code += st * mul
          mul *= 3
        }
      }
      faces.push(c[0]!, c[1]!, c[2]!, f + 6 * code)
      // The face's four edges: in-plane direction u = ±(a+1), ±(a+2).
      for (let t = 1; t <= 2; t++) {
        const ua = (a + t) % 3
        const edgeAxis = 3 - a - ua
        for (let su = -1; su <= 1; su += 2) {
          uu[0] = uu[1] = uu[2] = 0
          uu[ua] = su
          const ax = c[0]! + uu[0]!
          const ay = c[1]! + uu[1]!
          const az = c[2]! + uu[2]!
          if (isSolid(ax, ay, az) && !isSolid(ax + nn[0]!, ay + nn[1]!, az + nn[2]!)) continue
          // Dedup by the doubled edge-center coordinates.
          const x2 = 2 * c[0]! + nn[0]! + uu[0]!
          const y2 = 2 * c[1]! + nn[1]! + uu[1]!
          const z2 = 2 * c[2]! + nn[2]! + uu[2]!
          const id = ((x2 + 1) * m + (y2 + 1)) * m + (z2 + 1)
          if (seen.has(id)) continue
          seen.add(id)
          e[0] = c[0]! + (nn[0]! + uu[0]!) * half
          e[1] = c[1]! + (nn[1]! + uu[1]!) * half
          e[2] = c[2]! + (nn[2]! + uu[2]!) * half
          edges.push(e[0], e[1], e[2], edgeAxis)
        }
      }
    }
  }
  return {
    faces: new Float32Array(faces),
    edges: new Float32Array(edges),
    faceCount: faces.length / 4,
    edgeCount: edges.length / 4,
  }
}
