// Ambient life in the data city (DESIGN 6: "data packets along tracks"; pure view, no gameplay): bright packets that
// run along the floors' light paths, and faint motes of data drifting in the air around the camera (NF4's specks).
// Built once; update() moves them in place (no allocations).
import { AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Points, Quaternion, ShaderMaterial, Vector3, type Camera } from 'three'
import cfgAll from '../config.json'
import type { P3 } from './geo'
import { palette } from './look'

const A = cfgAll.view.cityLife

interface Packet {
  path: number
  /** Distance travelled along the path, m (wraps). */
  s: number
  speed: number
}

export interface CityLife {
  root: Group
  update(dt: number, camera: Camera): void
}

function hash(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return v - Math.floor(v)
}

export function buildCityLife(paths: readonly P3[][]): CityLife {
  const root = new Group()
  // ---- packets along the light paths
  const lens = paths.map((p) => {
    let l = 0
    for (let k = 1; k < p.length; k++) l += Math.hypot((p[k] as P3).x - (p[k - 1] as P3).x, (p[k] as P3).z - (p[k - 1] as P3).z)
    return l
  })
  const packets: Packet[] = []
  const [lo, hi] = A.packetSpeed as [number, number]
  paths.forEach((_, i) => {
    const count = Math.max(1, Math.round((lens[i] as number) / A.packetEvery))
    for (let k = 0; k < count; k++) packets.push({ path: i, s: hash(i, k) * (lens[i] as number), speed: lo + hash(k, i) * (hi - lo) })
  })
  const mat = new MeshBasicMaterial({ color: palette.seam.clone().multiplyScalar(A.packetGlow), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
  const mesh = new InstancedMesh(new BoxGeometry(...(A.packetSize as [number, number, number])), mat, Math.max(1, packets.length))
  mesh.count = packets.length
  mesh.frustumCulled = false
  mesh.userData['noReflect'] = true
  root.add(mesh)
  const m = new Matrix4()
  const q = new Quaternion()
  const pos = new Vector3()
  const scl = new Vector3(1, 1, 1)
  const up = new Vector3(0, 1, 0)

  // ---- motes drifting in a box around the camera (wrapped), additive points
  const MOTES = A.motes
  const motePos = new Float32Array(MOTES * 3)
  const seeds = new Float32Array(MOTES)
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = (hash(i, 1) - 0.5) * A.moteBox
    motePos[i * 3 + 1] = (hash(i, 2) - 0.3) * A.moteBox * 0.4
    motePos[i * 3 + 2] = (hash(i, 3) - 0.5) * A.moteBox
    seeds[i] = hash(i, 4)
  }
  const moteGeo = new BufferGeometry()
  const moteAttr = new BufferAttribute(new Float32Array(MOTES * 3), 3)
  moteGeo.setAttribute('position', moteAttr)
  // round specks, a few pixels at most, fading out right in front of the camera
  const moteMat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color().copy(palette.seamDim).multiplyScalar(A.moteGlow) }, uSize: { value: A.moteSize }, uMaxPx: { value: A.moteMaxPx } },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uMaxPx;
      varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        vFade = smoothstep(1.5, 4.0, d) * (1.0 - smoothstep(14.0, 18.0, d));
        gl_PointSize = min(uMaxPx, uSize * projectionMatrix[1][1] * 360.0 / max(d, 0.1));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(uColor * vFade * (1.0 - r * 1.6), 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const motes = new Points(moteGeo, moteMat)
  motes.frustumCulled = false
  motes.userData['noReflect'] = true
  root.add(motes)

  let time = 0
  const cam = new Vector3()
  return {
    root,
    update(dt: number, camera: Camera): void {
      time += dt
      for (let k = 0; k < packets.length; k++) {
        const p = packets[k] as Packet
        const path = paths[p.path] as P3[]
        const len = lens[p.path] as number
        p.s = (p.s + p.speed * dt) % len
        let s = p.s
        let j = 1
        for (; j < path.length - 1; j++) {
          const seg = Math.hypot((path[j] as P3).x - (path[j - 1] as P3).x, (path[j] as P3).z - (path[j - 1] as P3).z)
          if (s <= seg) break
          s -= seg
        }
        const a = path[j - 1] as P3
        const b = path[j] as P3
        const seg = Math.hypot(b.x - a.x, b.z - a.z) || 1
        const t = Math.min(1, s / seg)
        pos.set(a.x + (b.x - a.x) * t, a.y + A.packetLift, a.z + (b.z - a.z) * t)
        q.setFromAxisAngle(up, Math.atan2(b.x - a.x, b.z - a.z))
        m.compose(pos, q, scl)
        mesh.setMatrixAt(k, m)
      }
      mesh.instanceMatrix.needsUpdate = true
      camera.getWorldPosition(cam)
      const box = A.moteBox
      const arr = moteAttr.array as Float32Array
      for (let i = 0; i < MOTES; i++) {
        const sd = seeds[i] as number
        const bx = (motePos[i * 3] as number) + Math.sin(time * 0.2 + sd * 30) * 0.6
        const by = (motePos[i * 3 + 1] as number) + time * A.moteRise * (0.5 + sd)
        const bz = (motePos[i * 3 + 2] as number) + Math.cos(time * 0.17 + sd * 20) * 0.6
        // wrap into the box around the camera
        arr[i * 3] = cam.x + ((((bx - cam.x) % box) + box * 1.5) % box) - box / 2
        arr[i * 3 + 1] = cam.y + ((((by - cam.y) % (box * 0.4)) + box * 0.6) % (box * 0.4)) - box * 0.2
        arr[i * 3 + 2] = cam.z + ((((bz - cam.z) % box) + box * 1.5) % box) - box / 2
      }
      moteAttr.needsUpdate = true
    },
  }
}
