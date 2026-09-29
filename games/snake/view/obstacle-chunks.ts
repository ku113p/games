// Splitting the obstacle shell into spatial chunks (pure function, no three; cold path, on 'started').
// Why: one huge instanced batch (at 100^3 ~130k faces and ~220k edges) was drawn in full every frame,
// although only part of the arena is on screen. Chunks with their own bounding sphere are culled by three.js's built-in frustum culling:
// the image does not change (only what is outside the view frustum is culled), and vertex work drops
// in proportion to the invisible share of the arena. Chunk = a chunkCells^3 block of cells; a cell belongs to a chunk by its coordinates,
// an edge - by its owner cell (rounding the edge center, as in obstacles-view).

export interface ShellChunk {
  /** [cx,cy,cz,code] * faceCount (a view onto the shared buffer, face order within a cell preserved). */
  faces: Float32Array
  faceCount: number
  /** [ex,ey,ez,axis] * edgeCount. */
  edges: Float32Array
  edgeCount: number
  /** Bounding sphere of all the chunk's cells, with margin for face edges/edge ribbons. */
  cx: number
  cy: number
  cz: number
  radius: number
}

/** Sphere margin beyond the cell bounds: the overhang of face edges (<1 cell) and the width of the edge's screen ribbon. */
export const CHUNK_SPHERE_PAD = 2

function chunkIndex(x: number, y: number, z: number, cs: number, cn: number): number {
  return Math.floor(x / cs) + cn * (Math.floor(y / cs) + cn * Math.floor(z / cs))
}

export function chunkShell(
  faces: Float32Array,
  faceCount: number,
  edges: Float32Array,
  edgeCount: number,
  n: number,
  chunkCells: number,
): ShellChunk[] {
  const cn = Math.max(1, Math.ceil(n / chunkCells))
  const slots = cn * cn * cn
  const faceStart = new Int32Array(slots + 1)
  const edgeStart = new Int32Array(slots + 1)
  const faceChunk = new Int32Array(faceCount)
  const edgeChunk = new Int32Array(edgeCount)
  for (let i = 0; i < faceCount; i++) {
    const c = chunkIndex(faces[i * 4]!, faces[i * 4 + 1]!, faces[i * 4 + 2]!, chunkCells, cn)
    faceChunk[i] = c
    faceStart[c + 1]!++
  }
  for (let i = 0; i < edgeCount; i++) {
    const c = chunkIndex(Math.round(edges[i * 4]!), Math.round(edges[i * 4 + 1]!), Math.round(edges[i * 4 + 2]!), chunkCells, cn)
    edgeChunk[i] = c
    edgeStart[c + 1]!++
  }
  for (let c = 0; c < slots; c++) {
    faceStart[c + 1]! += faceStart[c]!
    edgeStart[c + 1]! += edgeStart[c]!
  }
  const sortedFaces = new Float32Array(faceCount * 4)
  const sortedEdges = new Float32Array(edgeCount * 4)
  const fFill = faceStart.slice(0, slots)
  const eFill = edgeStart.slice(0, slots)
  const minX = new Float32Array(slots).fill(Infinity)
  const minY = new Float32Array(slots).fill(Infinity)
  const minZ = new Float32Array(slots).fill(Infinity)
  const maxX = new Float32Array(slots).fill(-Infinity)
  const maxY = new Float32Array(slots).fill(-Infinity)
  const maxZ = new Float32Array(slots).fill(-Infinity)
  for (let i = 0; i < faceCount; i++) {
    const c = faceChunk[i]!
    const o = fFill[c]!++ * 4
    const x = faces[i * 4]!
    const y = faces[i * 4 + 1]!
    const z = faces[i * 4 + 2]!
    sortedFaces[o] = x
    sortedFaces[o + 1] = y
    sortedFaces[o + 2] = z
    sortedFaces[o + 3] = faces[i * 4 + 3]!
    if (x < minX[c]!) minX[c] = x
    if (y < minY[c]!) minY[c] = y
    if (z < minZ[c]!) minZ[c] = z
    if (x > maxX[c]!) maxX[c] = x
    if (y > maxY[c]!) maxY[c] = y
    if (z > maxZ[c]!) maxZ[c] = z
  }
  for (let i = 0; i < edgeCount; i++) {
    const c = edgeChunk[i]!
    const o = eFill[c]!++ * 4
    sortedEdges[o] = edges[i * 4]!
    sortedEdges[o + 1] = edges[i * 4 + 1]!
    sortedEdges[o + 2] = edges[i * 4 + 2]!
    sortedEdges[o + 3] = edges[i * 4 + 3]!
    // The edge's owner is a cell with its own faces, so it is already counted in the chunk bounds; in case of
    // an edge without faces we extend the bounds by it as well.
    const x = Math.round(edges[i * 4]!)
    const y = Math.round(edges[i * 4 + 1]!)
    const z = Math.round(edges[i * 4 + 2]!)
    if (x < minX[c]!) minX[c] = x
    if (y < minY[c]!) minY[c] = y
    if (z < minZ[c]!) minZ[c] = z
    if (x > maxX[c]!) maxX[c] = x
    if (y > maxY[c]!) maxY[c] = y
    if (z > maxZ[c]!) maxZ[c] = z
  }
  const out: ShellChunk[] = []
  for (let c = 0; c < slots; c++) {
    const fc = faceStart[c + 1]! - faceStart[c]!
    const ec = edgeStart[c + 1]! - edgeStart[c]!
    if (fc === 0 && ec === 0) continue
    const dx = maxX[c]! - minX[c]!
    const dy = maxY[c]! - minY[c]!
    const dz = maxZ[c]! - minZ[c]!
    out.push({
      faces: sortedFaces.subarray(faceStart[c]! * 4, faceStart[c + 1]! * 4),
      faceCount: fc,
      edges: sortedEdges.subarray(edgeStart[c]! * 4, edgeStart[c + 1]! * 4),
      edgeCount: ec,
      cx: (minX[c]! + maxX[c]!) / 2,
      cy: (minY[c]! + maxY[c]!) / 2,
      cz: (minZ[c]! + maxZ[c]!) / 2,
      radius: Math.sqrt(dx * dx + dy * dy + dz * dz) / 2 + Math.sqrt(3) / 2 + CHUNK_SPHERE_PAD,
    })
  }
  return out
}
