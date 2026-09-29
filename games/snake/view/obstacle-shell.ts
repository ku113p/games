// Внешняя оболочка набора препятствий (чистая функция, без three; считается
// один раз на 'started', в кадре не вызывается).
//   Грань клетки — только если соседняя клетка в её сторону свободна
//   (за пределами куба считается свободной).
//   Ребро — только настоящий излом контура. Для видимой грани с нормалью N и
//   соседней в плоскости клеткой A (за ребром), C = A + N:
//     A свободна           — выпуклое ребро, рисуем;
//     A занята, C занята   — вогнутое ребро, рисуем;
//     A занята, C свободна — грань продолжается плоско, ребра нет.
//   Одно и то же ребро приходит от нескольких граней — дедуп по ключу центра.
//   Смыкание граней. Плоскость грани лежит на half от центра клетки (0.49), так что
//   кубы не касаются стенки куба-арены. Но соседние кубы тогда не смыкаются: между
//   ними щель 2*(0.5-half), и раз внутренних граней нет, она сквозная. Поэтому грань
//   не сдвигается, а тянется В СТОРОНУ соседа по каждой из четырёх кромок:
//     соседа нет (выпуклый излом)      — до half, как раньше (одиночный куб не меняется);
//     сосед есть, продолжение плоское  — до 0.5, где стыкуется с гранью соседа;
//     сосед есть и над ним занято      — вогнутый излом, до 1 - half: там стоит
//                                        боковая грань соседа над ним;
//     соседа нет, но над ним занято    — диагональный стык ребром (два куба касаются
//                                        только ребром): то же 1 - half, обе грани
//                                        смыкаются уголком и щель по ребру закрыта.
//   Рёбра-контуры остаются на half и от этого не зависят.
//   Стык только углом (одна точка) не закрывается: там нет ни общего ребра, ни грани,
//   а просвет — точка размером (1-2*half)^2, видимая только вдоль пространственной диагонали.
// Формат: faces = [cx,cy,cz,code] * n, code = face + 6 * (s0 + 3*s1 + 9*s2 + 27*s3):
//         face: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z;
//         s0..s3 — кромки +t1, -t1, +t2, -t2 (t1 = ось a+1, t2 = ось a+2, a — ось грани),
//         состояние кромки: 0 выпуклая, 1 плоская, 2 вогнутая или диагональный стык ребром (см. EDGE_*).
//         edges = [ex,ey,ez,axis] * n, (ex,ey,ez) — центр ребра, axis 0/1/2 — вдоль.

export const EDGE_CONVEX = 0
export const EDGE_FLAT = 1
export const EDGE_CONCAVE = 2

/** Состояние кромки из кода грани: idx 0 +t1, 1 -t1, 2 +t2, 3 -t2. */
export function faceEdgeState(code: number, idx: number): number {
  return Math.floor(code / 6 / 3 ** idx) % 3
}

/** Насколько кромка уходит от центра клетки вдоль касательной (в клетках). */
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
      // Состояния четырёх кромок: t = 1, 2 (ось a+t), знак +/-.
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
          // Сосед в плоскости занят: плоско или вогнуто. Сосед свободен, но над ним занято —
          // диагональный стык ребром: грани обоих кубов тянутся друг к другу как в вогнутом
          // изломе и смыкаются в уголок, иначе между рёбрами кубов остаётся щель 2*(0.5-half).
          const above = isSolid(ax + nn[0]!, ay + nn[1]!, az + nn[2]!)
          const st = isSolid(ax, ay, az) ? (above ? EDGE_CONCAVE : EDGE_FLAT) : above ? EDGE_CONCAVE : EDGE_CONVEX
          code += st * mul
          mul *= 3
        }
      }
      faces.push(c[0]!, c[1]!, c[2]!, f + 6 * code)
      // Четыре ребра грани: направление в плоскости u = ±(a+1), ±(a+2).
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
          // Дедуп по удвоенным координатам центра ребра.
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
