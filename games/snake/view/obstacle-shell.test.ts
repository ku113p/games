import { describe, expect, test } from 'bun:test'
import { computeShell, edgeReach, faceEdgeState, EDGE_CONCAVE, EDGE_CONVEX, EDGE_FLAT } from './obstacle-shell'

const n = 6
const set = (...cells: number[][]): Set<number> => new Set(cells.map(([x, y, z]) => x! + n * (y! + n * z!)))

describe('computeShell', () => {
  test('одиночный куб: 6 граней, 12 рёбер', () => {
    const sh = computeShell(set([2, 2, 2]), n, 0.5)
    expect(sh.faceCount).toBe(6)
    expect(sh.edgeCount).toBe(12)
  })

  test('два соседних куба: внутренние грани скрыты, рёбра без стыковых', () => {
    const sh = computeShell(set([2, 2, 2], [3, 2, 2]), n, 0.5)
    expect(sh.faceCount).toBe(10) // 12 - 2 внутренние
    // Параллелепипед 2x1x1: 4 длинных ребра по 2 отрезка + 8 коротких, ничего у стыка.
    expect(sh.edgeCount).toBe(16)
  })

  test('куб 2x2x2: 24 грани, 12 рёбер по 2 отрезка (плоские грани без внутренних линий)', () => {
    const cells: number[][] = []
    for (let x = 2; x < 4; x++) for (let y = 2; y < 4; y++) for (let z = 2; z < 4; z++) cells.push([x, y, z])
    const sh = computeShell(set(...cells), n, 0.5)
    expect(sh.faceCount).toBe(24)
    expect(sh.edgeCount).toBe(24)
  })

  test('вогнутый излом сохраняется: Г-образная фигура', () => {
    // Клетки (2,2,2), (3,2,2), (2,3,2): лежат в одной плоскости z, грани +z плоские.
    const sh = computeShell(set([2, 2, 2], [3, 2, 2], [2, 3, 2]), n, 0.5)
    expect(sh.faceCount).toBe(3 * 6 - 4) // 2 стыка по 2 грани
    // Контур верха Г-образной фигуры: 8 отрезков; то же снизу, плюс 6 вертикальных.
    expect(sh.edgeCount).toBe(8 + 8 + 6)
  })

  test('рёбра не дублируются', () => {
    const sh = computeShell(set([1, 1, 1], [2, 2, 1], [3, 3, 1]), n, 0.5)
    const keys = new Set<string>()
    for (let i = 0; i < sh.edgeCount; i++) keys.add(Array.from(sh.edges.slice(i * 4, i * 4 + 4)).join(','))
    expect(keys.size).toBe(sh.edgeCount)
  })

  // Достаём состояния кромок граней клетки (cx,cy,cz) с гранью face.
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

  test('одиночный куб: все кромки выпуклые, габарит не раздувается', () => {
    const sh = computeShell(set([2, 2, 2]), n, 0.49)
    for (let f = 0; f < 6; f++) expect(edgeStates(sh, [2, 2, 2], f)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX])
    expect(edgeReach(EDGE_CONVEX, 0.49)).toBe(0.49)
  })

  test('стык двух кубов: грани тянутся друг к другу до 0.5, остальные кромки не трогаются', () => {
    const sh = computeShell(set([2, 2, 2], [3, 2, 2]), n, 0.49)
    // Грань +y: t1 = ось z, t2 = ось x. У куба x=2 сосед по +x (кромка +t2, индекс 2).
    expect(edgeStates(sh, [2, 2, 2], 2)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_FLAT, EDGE_CONVEX])
    expect(edgeStates(sh, [3, 2, 2], 2)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX, EDGE_FLAT])
    // Вылеты двух кромок в сумме покрывают всю щель: 0.5 + 0.5 = 1 = расстояние между центрами.
    expect(edgeReach(EDGE_FLAT, 0.49) * 2).toBe(1)
  })

  test('вогнутый излом: грань тянется до боковой грани соседа над ним', () => {
    // (2,2,2), (3,2,2), (3,3,2): грань +y куба (2,2,2) упирается в кромку +x, над соседом занято.
    const sh = computeShell(set([2, 2, 2], [3, 2, 2], [3, 3, 2]), n, 0.49)
    expect(edgeStates(sh, [2, 2, 2], 2)![2]).toBe(EDGE_CONCAVE)
    // И боковая грань -x куба (3,3,2) тянется вниз к плоскости верха: её кромка -y вогнутая.
    // Грань -x: a=0, t1 = y, t2 = z; кромка -t1 — индекс 1.
    expect(edgeStates(sh, [3, 3, 2], 1)![1]).toBe(EDGE_CONCAVE)
    // Плоскость верха (half) и боковой грани (1 - half) смыкаются: 0.51 от центра соседа = 0.49 от своего.
    expect(edgeReach(EDGE_CONCAVE, 0.49) + 0.49).toBe(1)
  })

  test('диагональный стык ребром: обе грани, смотрящие в карманы, тянутся друг к другу', () => {
    // (2,2,2) и (3,3,2) касаются только ребром вдоль z. Грань +x первого: t1 = y, кромка +t1 (индекс 0).
    const sh = computeShell(set([2, 2, 2], [3, 3, 2]), n, 0.49)
    expect(edgeStates(sh, [2, 2, 2], 0)![0]).toBe(EDGE_CONCAVE)
    // Грань -y второго: a=1, t1 = z, t2 = x; кромка -t2 (индекс 3).
    expect(edgeStates(sh, [3, 3, 2], 3)![3]).toBe(EDGE_CONCAVE)
    // Грань +y первого и -x второго — с другой стороны стыка.
    expect(edgeStates(sh, [2, 2, 2], 2)![2]).toBe(EDGE_CONCAVE)
    expect(edgeStates(sh, [3, 3, 2], 1)![1]).toBe(EDGE_CONCAVE)
  })

  test('стык только углом: кромки остаются выпуклыми', () => {
    const sh = computeShell(set([2, 2, 2], [3, 3, 3]), n, 0.49)
    for (let f = 0; f < 6; f++) expect(edgeStates(sh, [2, 2, 2], f)).toEqual([EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX, EDGE_CONVEX])
  })
})
