// Неоновые контуры: геометрия «каркас из тонких балок». Строится один раз
// (холодный путь), дальше живёт в InstancedMesh / Mesh как обычная геометрия:
// пустая середина, светятся только рёбра. Балки — тонкие параллелепипеды, а не
// линии GL: линия в 1 px на телефоне не читается и не даёт толщины для bloom.

import { BoxGeometry, BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Двенадцать рёбер куба с полуразмером half, центр в нуле: [ax,ay,az,bx,by,bz]*12. */
export function cubeEdgeSegments(half: number): number[] {
  const out: number[] = []
  const s = [-half, half]
  for (const a of s) {
    for (const b of s) {
      out.push(-half, a, b, half, a, b) // вдоль x
      out.push(a, -half, b, a, half, b) // вдоль y
      out.push(a, b, -half, a, b, half) // вдоль z
    }
  }
  return out
}

/** Четырёхгранная пирамида: остриё в +y, основание в плоскости y = -height/2. Восемь рёбер. */
export function pyramidEdgeSegments(radius: number, height: number): number[] {
  const t = height / 2
  const c: number[][] = [
    [radius, -t, 0],
    [0, -t, radius],
    [-radius, -t, 0],
    [0, -t, -radius],
  ]
  const out: number[] = []
  for (let i = 0; i < 4; i++) {
    const a = c[i]!
    const b = c[(i + 1) % 4]!
    out.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!) // основание
    out.push(a[0]!, a[1]!, a[2]!, 0, t, 0) // к острию
  }
  return out
}

/** Склеенная геометрия балок по отрезкам [ax,ay,az,bx,by,bz]*n; только position. */
export function beamGeometry(segments: number[], thickness: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  const a = new Vector3()
  const b = new Vector3()
  const dir = new Vector3()
  const mid = new Vector3()
  const q = new Quaternion()
  const m = new Matrix4()
  const one = new Vector3(1, 1, 1)
  const zAxis = new Vector3(0, 0, 1)
  for (let i = 0; i + 5 < segments.length; i += 6) {
    a.set(segments[i]!, segments[i + 1]!, segments[i + 2]!)
    b.set(segments[i + 3]!, segments[i + 4]!, segments[i + 5]!)
    dir.subVectors(b, a)
    const len = dir.length()
    dir.divideScalar(len)
    mid.addVectors(a, b).multiplyScalar(0.5)
    q.setFromUnitVectors(zAxis, dir)
    m.compose(mid, q, one)
    // +thickness по длине: углы соседних балок закрывают друг друга.
    const box = new BoxGeometry(thickness, thickness, len + thickness)
    box.applyMatrix4(m)
    box.deleteAttribute('uv')
    box.deleteAttribute('normal')
    parts.push(box)
  }
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  return merged
}
