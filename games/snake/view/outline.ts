// Neon outlines: "frame of thin beams" geometry. Built once
// (cold path), then lives in an InstancedMesh / Mesh as ordinary geometry:
// hollow inside, only the edges glow. Beams are thin cuboids, not
// GL lines: a 1 px line is unreadable on a phone and gives no thickness for bloom.

import { BoxGeometry, BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Twelve cube edges with half-size half, centered at zero: [ax,ay,az,bx,by,bz]*12. */
export function cubeEdgeSegments(half: number): number[] {
  const out: number[] = []
  const s = [-half, half]
  for (const a of s) {
    for (const b of s) {
      out.push(-half, a, b, half, a, b) // along x
      out.push(a, -half, b, a, half, b) // along y
      out.push(a, b, -half, a, b, half) // along z
    }
  }
  return out
}

/** Square pyramid: apex at +y, base in the plane y = -height/2. Eight edges. */
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
    out.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!) // base
    out.push(a[0]!, a[1]!, a[2]!, 0, t, 0) // to the apex
  }
  return out
}

/** Circle of radius r in the plane perpendicular to the axis (0 is x, 1 is y, 2 is z), n segments: [ax,ay,az,bx,by,bz]*n. */
export function circleSegments(radius: number, n: number, axis: 0 | 1 | 2): number[] {
  const out: number[] = []
  const pt = (k: number): [number, number, number] => {
    const a = (k / n) * Math.PI * 2
    const u = Math.cos(a) * radius
    const v = Math.sin(a) * radius
    return axis === 0 ? [0, u, v] : axis === 1 ? [u, 0, v] : [u, v, 0]
  }
  for (let k = 0; k < n; k++) {
    const a = pt(k)
    const b = pt(k + 1)
    out.push(a[0], a[1], a[2], b[0], b[1], b[2])
  }
  return out
}

/** Star: two tetrahedra inscribed in a cube with half-size half (eight cube vertices, twelve edges: face diagonals). */
export function stellaOctangulaSegments(half: number): number[] {
  const tetra = (sign: 1 | -1): number[][] => [
    [sign * half, sign * half, sign * half],
    [sign * half, -sign * half, -sign * half],
    [-sign * half, sign * half, -sign * half],
    [-sign * half, -sign * half, sign * half],
  ]
  const out: number[] = []
  for (const sign of [1, -1] as const) {
    const t = tetra(sign)
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) out.push(...t[i]!, ...t[j]!)
    }
  }
  return out
}

/** The same segments, rotated so the cube diagonal (1,1,1) lies on the z axis: a view along z gives a six-pointed star, not an "hourglass". */
export function cornerOnZ(segments: number[]): number[] {
  const q = new Quaternion().setFromUnitVectors(new Vector3(1, 1, 1).normalize(), new Vector3(0, 0, 1))
  const v = new Vector3()
  const out: number[] = []
  for (let i = 0; i + 2 < segments.length; i += 3) {
    v.set(segments[i]!, segments[i + 1]!, segments[i + 2]!).applyQuaternion(q)
    out.push(v.x, v.y, v.z)
  }
  return out
}

/** Merged beam geometry from segments [ax,ay,az,bx,by,bz]*n; position only. */
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
    // +thickness along the length: the corners of adjacent beams cover each other.
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
