import { describe, expect, test } from 'bun:test'
import { computeShell, edgeReach, faceEdgeState, EDGE_CONCAVE, EDGE_CONVEX, EDGE_FLAT } from './obstacle-shell'

const n = 6
const set = (...cells: number[][]): Set<number> => new Set(cells.map(([x, y, z]) => x! + n * (y! + n * z!)))

describe('computeShell', () => {
  test('single cube: 6 faces, 12 edges', () => {
    const sh = computeShell(set([2, 2, 2]), n, 0.5)
    expect(sh.faceCount).toBe(6)
    expect(sh.edgeCount).toBe(12)
  })

  test('two adjacent cubes: inner faces hidden, edges without seam edges', () => {
    const sh = computeShell(set([2, 2, 2], [3, 2, 2]), n, 0.5)
    expect(sh.faceCount).toBe(10) // 12 - 2 inner
    // 2x1x1 box: 4 long edges of 2 segments each + 8 short ones, none at the seam.
    expect(sh.edgeCount).toBe(16)
  })

  test('2x2x2 cube: 24 faces, 12 edges of 2 segments each (flat faces have no inner lines)', () => {
    const cells: number[][] = []
    for (let x = 2; x < 4; x++) for (let y = 2; y < 4; y++) for (let z = 2; z < 4; z++) cells.push([x, y, z])
    const sh = computeShell(set(...cells), n, 0.5)
    expect(sh.faceCount).toBe(24)
    expect(sh.edgeCount).toBe(24)
  })

  test('concave kink is kept: L-shaped figure', () => {
    // Cells (2,2,2), (3,2,2), (2,3,2): all in one z plane, the +z faces are flat.
    const sh = computeShell(set([2, 2, 2], [3, 2, 2], [2, 3, 2]), n, 0.5)
    expect(sh.faceCount).toBe(3 * 6 - 4) // 2 seams of 2 faces each
    // Outline of the L-shape's top: 8 segments; the same at the bottom, plus 6 vertical ones.
    expect(sh.edgeCount).toBe(8 + 8 + 6)
  })

  test('edges are not duplicated', () => {
    const sh = computeShell(set([1, 1, 1], [2, 2, 1], [3, 3, 1]), n, 0.5)
    const keys = new Set<string>()
    for (let i = 0; i < sh.edgeCount; i++) keys.add(Array.from(sh.edges.slice(i * 4, i * 4 + 4)).join(','))
    expect(keys.size).toBe(sh.edgeCount)
  })

  // Get the edge states of the faces of cell (cx,cy,cz) for face `face`.
  const edgeStates = (sh: ReturnType<typeof computeShell>, cell: number[], face: number): number[] | null => {
    for (let i = 0; i < sh.faceCount; i++) {
      const b = i * 4
      if (sh.faces[b] !== cell[0] || sh.faces[b + 1] !== cell[1] || sh.faces[b + 2] !== cell[2]) continue
      const code = sh.faces[b + 3]!
      if (code % 6 !== face) continue
      return [0, 1, 2, 3].map((k) => faceEdgeState(code, k))
    }
    return null
  }

  test('single cube: all edges convex, the extent does not inflate', () => {
    const sh = computeShell(set([2, 2, 2]), n, 0.49)
    for (let f = 0; f < 6; f++) expect(edgeStates(sh, [2, 2, 2], f)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX])
    expect(edgeReach(EDGE_CONVEX, 0.49)).toBe(0.49)
  })

  test('seam of two cubes: faces reach toward each other up to 0.5, other edges untouched', () => {
    const sh = computeShell(set([2, 2, 2], [3, 2, 2]), n, 0.49)
    // +y face: t1 = z axis, t2 = x axis. The cube at x=2 has a +x neighbor (edge +t2, index 2).
    expect(edgeStates(sh, [2, 2, 2], 2)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_FLAT, EDGE_CONVEX])
    expect(edgeStates(sh, [3, 2, 2], 2)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX, EDGE_FLAT])
    // The overhangs of the two edges together cover the whole gap: 0.5 + 0.5 = 1 = distance between centers.
    expect(edgeReach(EDGE_FLAT, 0.49) * 2).toBe(1)
  })

  test('concave kink: the face reaches the side face of the neighbor above it', () => {
    // (2,2,2), (3,2,2), (3,3,2): the +y face of cube (2,2,2) meets the +x edge, above the neighbor is occupied.
    const sh = computeShell(set([2, 2, 2], [3, 2, 2], [3, 3, 2]), n, 0.49)
    expect(edgeStates(sh, [2, 2, 2], 2)![2]).toBe(EDGE_CONCAVE)
    // And the -x side face of cube (3,3,2) reaches down to the top plane: its -y edge is concave.
    // -x face: a=0, t1 = y, t2 = z; edge -t1 is index 1.
    expect(edgeStates(sh, [3, 3, 2], 1)![1]).toBe(EDGE_CONCAVE)
    // The top plane (half) and the side face (1 - half) meet: 0.51 from the neighbor's center = 0.49 from its own.
    expect(edgeReach(EDGE_CONCAVE, 0.49) + 0.49).toBe(1)
  })

  test('diagonal edge-to-edge seam: both faces looking into the pockets reach toward each other', () => {
    // (2,2,2) and (3,3,2) touch only along an edge parallel to z. The first one's +x face: t1 = y, edge +t1 (index 0).
    const sh = computeShell(set([2, 2, 2], [3, 3, 2]), n, 0.49)
    expect(edgeStates(sh, [2, 2, 2], 0)![0]).toBe(EDGE_CONCAVE)
    // The second one's -y face: a=1, t1 = z, t2 = x; edge -t2 (index 3).
    expect(edgeStates(sh, [3, 3, 2], 3)![3]).toBe(EDGE_CONCAVE)
    // The first one's +y face and the second one's -x face are on the other side of the seam.
    expect(edgeStates(sh, [2, 2, 2], 2)![2]).toBe(EDGE_CONCAVE)
    expect(edgeStates(sh, [3, 3, 2], 1)![1]).toBe(EDGE_CONCAVE)
  })

  test('corner-only seam: edges stay convex', () => {
    const sh = computeShell(set([2, 2, 2], [3, 3, 3]), n, 0.49)
    for (let f = 0; f < 6; f++) expect(edgeStates(sh, [2, 2, 2], f)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX])
  })
})
