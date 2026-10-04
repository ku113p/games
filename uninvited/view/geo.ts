// Small geometry helpers for the merged level meshes (cold path, build time only): a builder that collects
// vertices into one BufferGeometry, thin light tubes along polylines, and chamfered panels (the beveled faces the
// server blocks are dressed with). Everything static ends up in a few merged meshes, so the detail costs triangles,
// not draw calls.
import { BufferAttribute, BufferGeometry } from 'three'

export interface P3 {
  x: number
  y: number
  z: number
}

/** Collects vertices: position, normal and one 4-float extra per vertex (a shader attribute or a vertex color). */
export class GeoBuilder {
  pos: number[] = []
  nor: number[] = []
  extra: number[] = []
  idx: number[] = []
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, e0 = 0, e1 = 0, e2 = 0, e3 = 1): number {
    this.pos.push(x, y, z)
    this.nor.push(nx, ny, nz)
    this.extra.push(e0, e1, e2, e3)
    return this.pos.length / 3 - 1
  }
  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c)
  }
  /** A triangle wound so it faces the way its vertex normals point (for sweeps whose direction is not known). */
  triFacing(a: number, b: number, c: number): void {
    const p = this.pos
    const q = this.nor
    const ax = p[a * 3] as number
    const ay = p[a * 3 + 1] as number
    const az = p[a * 3 + 2] as number
    const ux = (p[b * 3] as number) - ax
    const uy = (p[b * 3 + 1] as number) - ay
    const uz = (p[b * 3 + 2] as number) - az
    const vx = (p[c * 3] as number) - ax
    const vy = (p[c * 3 + 1] as number) - ay
    const vz = (p[c * 3 + 2] as number) - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    let dot = 0
    for (const i of [a, b, c]) dot += nx * (q[i * 3] as number) + ny * (q[i * 3 + 1] as number) + nz * (q[i * 3 + 2] as number)
    if (dot >= 0) this.idx.push(a, b, c)
    else this.idx.push(a, c, b)
  }
  quad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d)
  }
  get empty(): boolean {
    return this.idx.length === 0
  }
  /** extra: 'aE' = a vec4 attribute, 'color' = vertex colors (rgb), null = dropped. */
  build(extra: 'aE' | 'color' | null): BufferGeometry {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3))
    if (extra === 'aE') geo.setAttribute('aE', new BufferAttribute(new Float32Array(this.extra), 4))
    if (extra === 'color') {
      const n = this.extra.length / 4
      const c = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        c[i * 3] = this.extra[i * 4] as number
        c[i * 3 + 1] = this.extra[i * 4 + 1] as number
        c[i * 3 + 2] = this.extra[i * 4 + 2] as number
      }
      geo.setAttribute('color', new BufferAttribute(c, 3))
    }
    geo.setIndex(this.idx)
    geo.computeBoundingSphere()
    return geo
  }
}

/** A thin tube along a polyline (closed or open). */
export function tube(b: GeoBuilder, pts: readonly P3[], radius: number, closed: boolean, sides = 5): void {
  const n = pts.length
  if (n < 2) return
  const base = b.pos.length / 3
  for (let i = 0; i < n; i++) {
    const p = pts[i] as P3
    const pa = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as P3
    const pb = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as P3
    let tx = pb.x - pa.x
    let ty = pb.y - pa.y
    let tz = pb.z - pa.z
    const tl = Math.hypot(tx, ty, tz) || 1
    tx /= tl
    ty /= tl
    tz /= tl
    // a side vector: perpendicular to the tangent and as horizontal as possible
    let sx = -tz
    let sz = tx
    let sl = Math.hypot(sx, sz)
    if (sl < 1e-3) {
      sx = 1
      sz = 0
      sl = 1
    }
    sx /= sl
    sz /= sl
    // up = tangent x side
    const ux = ty * sz
    const uy = tz * sx - tx * sz
    const uz = -ty * sx
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const nx = sx * ca + ux * sa
      const ny = uy * sa
      const nz = sz * ca + uz * sa
      b.vertex(p.x + nx * radius, p.y + ny * radius, p.z + nz * radius, nx, ny, nz)
    }
  }
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const i0 = base + i * sides
    const i1 = base + ((i + 1) % n) * sides
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides
      b.tri(i0 + k, i1 + k, i0 + k1)
      b.tri(i0 + k1, i1 + k, i1 + k1)
    }
  }
}

/** A local frame on a wall: u along the wall, v up, n out of the wall (into the corridor). */
export interface Frame3 {
  ux: number
  uz: number
  nx: number
  nz: number
}

/**
 * A chamfered plate standing out of a wall: centre (x, y, z) on the wall surface, half sizes hu (along) and hv (up),
 * depth d out of the wall, bevel bv on the front edges. Front, four bevels, four sides; no back. `shade` is written
 * to the extra (vertex color / AO): the front gets it as is, the sides darker.
 */
export function panel(b: GeoBuilder, f: Frame3, x: number, y: number, z: number, hu: number, hv: number, d: number, bv: number, shade: number): void {
  const at = (su: number, sv: number, sd: number): P3 => ({ x: x + f.ux * su + f.nx * sd, y: y + sv, z: z + f.uz * su + f.nz * sd })
  const face = (a: P3, bb: P3, c: P3, dd: P3, nx: number, ny: number, nz: number, k: number): void => {
    const s = shade * k
    const i0 = b.vertex(a.x, a.y, a.z, nx, ny, nz, s, s, s)
    const i1 = b.vertex(bb.x, bb.y, bb.z, nx, ny, nz, s, s, s)
    const i2 = b.vertex(c.x, c.y, c.z, nx, ny, nz, s, s, s)
    const i3 = b.vertex(dd.x, dd.y, dd.z, nx, ny, nz, s, s, s)
    b.quad(i0, i1, i2, i3)
  }
  const bvc = Math.min(bv, hu * 0.5, hv * 0.5, d * 0.9)
  const iu = hu - bvc
  const iv = hv - bvc
  const df = d
  const db = d - bvc
  // front (counter-clockwise seen from the front)
  face(at(-iu, -iv, df), at(iu, -iv, df), at(iu, iv, df), at(-iu, iv, df), f.nx, 0, f.nz, 1)
  const r = Math.SQRT1_2
  // bevels: bottom, right, top, left
  face(at(-hu, -hv, db), at(hu, -hv, db), at(iu, -iv, df), at(-iu, -iv, df), f.nx * r, -r, f.nz * r, 0.8)
  face(at(hu, -hv, db), at(hu, hv, db), at(iu, iv, df), at(iu, -iv, df), (f.nx + f.ux) * r, 0, (f.nz + f.uz) * r, 0.9)
  face(at(hu, hv, db), at(-hu, hv, db), at(-iu, iv, df), at(iu, iv, df), f.nx * r, r, f.nz * r, 1.15)
  face(at(-hu, hv, db), at(-hu, -hv, db), at(-iu, -iv, df), at(-iu, iv, df), (f.nx - f.ux) * r, 0, (f.nz - f.uz) * r, 0.9)
  // sides: bottom, right, top, left
  face(at(-hu, -hv, 0), at(hu, -hv, 0), at(hu, -hv, db), at(-hu, -hv, db), 0, -1, 0, 0.5)
  face(at(hu, -hv, 0), at(hu, hv, 0), at(hu, hv, db), at(hu, -hv, db), f.ux, 0, f.uz, 0.7)
  face(at(hu, hv, 0), at(-hu, hv, 0), at(-hu, hv, db), at(hu, hv, db), 0, 1, 0, 0.9)
  face(at(-hu, hv, 0), at(-hu, -hv, 0), at(-hu, -hv, db), at(-hu, hv, db), -f.ux, 0, -f.uz, 0.7)
}

/** A flat glowing quad on a wall (status lights, slits, light rails): extra = its color. */
export function glowQuad(b: GeoBuilder, f: Frame3, x: number, y: number, z: number, hu: number, hv: number, d: number, r: number, g: number, bl: number): void {
  const p = (su: number, sv: number): number => b.vertex(x + f.ux * su + f.nx * d, y + sv, z + f.uz * su + f.nz * d, f.nx, 0, f.nz, r, g, bl)
  b.quad(p(-hu, -hv), p(hu, -hv), p(hu, hv), p(-hu, hv))
}
