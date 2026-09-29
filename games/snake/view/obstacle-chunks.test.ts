import { describe, expect, test } from 'bun:test'
import { computeShell } from './obstacle-shell'
import { CHUNK_SPHERE_PAD, chunkShell } from './obstacle-chunks'

function randomSolid(n: number, density: number, seed: number): Set<number> {
  let s = seed
  const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const solid = new Set<number>()
  for (let i = 0; i < n * n * n; i++) if (rnd() < density) solid.add(i)
  return solid
}

describe('chunkShell', () => {
  const n = 30
  const half = 0.49
  const shell = computeShell(randomSolid(n, 0.08, 7), n, half)
  const chunks = chunkShell(shell.faces, shell.faceCount, shell.edges, shell.edgeCount, n, 8)

  test('каждая грань и каждое ребро попадают ровно в один кусок', () => {
    expect(chunks.reduce((a, c) => a + c.faceCount, 0)).toBe(shell.faceCount)
    expect(chunks.reduce((a, c) => a + c.edgeCount, 0)).toBe(shell.edgeCount)
    const key = (a: Float32Array, i: number): string => `${a[i * 4]},${a[i * 4 + 1]},${a[i * 4 + 2]},${a[i * 4 + 3]}`
    const orig = new Map<string, number>()
    for (let i = 0; i < shell.faceCount; i++) orig.set(key(shell.faces, i), (orig.get(key(shell.faces, i)) ?? 0) + 1)
    for (const c of chunks) for (let i = 0; i < c.faceCount; i++) orig.set(key(c.faces, i), (orig.get(key(c.faces, i)) ?? 0) - 1)
    for (const v of orig.values()) expect(v).toBe(0)
  })

  test('сфера куска содержит все вершины его граней и рёбер', () => {
    for (const c of chunks) {
      const inside = (x: number, y: number, z: number, reach: number): boolean =>
        Math.hypot(x - c.cx, y - c.cy, z - c.cz) + reach <= c.radius
      for (let i = 0; i < c.faceCount; i++) {
        // самая дальняя вершина грани: не дальше диагонали клетки от её центра
        expect(inside(c.faces[i * 4]!, c.faces[i * 4 + 1]!, c.faces[i * 4 + 2]!, Math.sqrt(3))).toBe(true)
      }
      for (let i = 0; i < c.edgeCount; i++) {
        expect(inside(c.edges[i * 4]!, c.edges[i * 4 + 1]!, c.edges[i * 4 + 2]!, 1.5)).toBe(true)
      }
    }
    expect(CHUNK_SPHERE_PAD).toBeGreaterThan(1)
  })

  test('грани одной клетки остаются подряд внутри куска', () => {
    for (const c of chunks) {
      const seen = new Set<string>()
      let last = ''
      for (let i = 0; i < c.faceCount; i++) {
        const k = `${c.faces[i * 4]},${c.faces[i * 4 + 1]},${c.faces[i * 4 + 2]}`
        if (k !== last) {
          expect(seen.has(k)).toBe(false)
          seen.add(k)
          last = k
        }
      }
    }
  })

  test('пустая арена и арена меньше куска', () => {
    expect(chunkShell(new Float32Array(0), 0, new Float32Array(0), 0, 20, 25)).toEqual([])
    const small = computeShell(new Set([5 + 20 * (5 + 20 * 5)]), 20, half)
    const cs = chunkShell(small.faces, small.faceCount, small.edges, small.edgeCount, 20, 25)
    expect(cs.length).toBe(1)
  })
})
