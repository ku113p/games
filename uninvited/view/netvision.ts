// Network vision (DESIGN 8: the Hacker's main tool): while scanning, the level shows what it hides - glowing links
// from every terminal to what it controls (seen through walls), the drones' patrol routes as chevrons running along
// the floor in their direction, the motion sensors' zones as translucent red volumes (pulsing when tripped), the
// radius of the hero's own noise as a ring on the floor, and the security's view cones through walls (view/cone.ts).
// Everything fades in and out with the scan. Pools are built once; updating never allocates.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  Vector3,
  type Color,
} from 'three'
import cfgAll from '../config.json'
import { floorHeightAt } from '../core/grid'
import { drones, dronePatrolRoutes, gameTime, levelGrid, noiseRadius, playerPos, scanActive, scanLinks, sensorZones } from '../core/queries'
import type { GameState, Sim } from '../core/state'
import { setConesXray } from './cone'
import { palette } from './look'

const N = cfgAll.view.netVision
const MAX_LINKS = 16
const MAX_ROUTES = 16
const UP = new Vector3(0, 1, 0)
const tmpDir = new Vector3()

const LINK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uLen;
uniform float uFade;
varying vec2 vUv;
void main() {
  // packets running from the terminal to the device, over a steady thin core
  float s = vUv.y * uLen;
  float pkt = smoothstep(0.75, 1.0, fract(s / 1.4 - uTime * 1.6));
  float a = (0.35 + 1.2 * pkt) * uFade;
  gl_FragColor = vec4(uColor * a, 1.0);
}`

const ROUTE_VERT = /* glsl */ `
attribute float aS;
attribute float aSide;
attribute float aDrone;
varying float vS;
varying float vSide;
varying float vDrone;
void main() {
  vS = aS;
  vSide = aSide;
  vDrone = aDrone;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

// A thin spine with small chevrons pointing along the route, evenly spaced and drifting slowly forward. Distances are in
// metres (vS along the route, vSide * uHalf across it), so the width and the spacing stay the same on every bend.
const ROUTE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uFade;
uniform float uHalf;
uniform float uOn[${MAX_ROUTES}];
varying float vS;
varying float vSide;
varying float vDrone;
void main() {
  int i = int(vDrone + 0.5);
  float on = 0.0;
  for (int k = 0; k < ${MAX_ROUTES}; k++) if (k == i) on = uOn[k];
  if (on <= 0.0) discard;
  float lat = abs(vSide) * uHalf;
  // the chevron's arms trail behind its tip: the stroke sits where s + |lat| is a multiple of the spacing
  float p = fract((vS + lat) / ${N.chevronSpacing.toFixed(2)} - uTime * 0.35);
  float d = min(p, 1.0 - p) * ${N.chevronSpacing.toFixed(2)};
  float chev = 1.0 - smoothstep(${(N.chevronStroke * 0.4).toFixed(3)}, ${N.chevronStroke.toFixed(3)}, d);
  float spine = (1.0 - smoothstep(0.012, 0.035, lat)) * 0.3;
  float edge = 1.0 - smoothstep(0.8, 1.0, abs(vSide));
  gl_FragColor = vec4(uColor * (chev * edge + spine) * uFade * on, 1.0);
}`

const ZONE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`

const ZONE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
uniform float uPulse;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  // a translucent column: brighter at its silhouette and its foot, scanlines rising
  float edge = pow(1.0 - abs(dot(normalize(vN), vV)), 2.5);
  float foot = pow(1.0 - vUv.y, 3.0);
  float lines = 0.6 + 0.4 * step(0.8, fract(vUv.y * 14.0 - uTime * 0.8));
  float a = (0.05 + 0.35 * edge) * (0.25 + 0.75 * foot) * lines * (1.0 + uPulse * 2.0);
  gl_FragColor = vec4(uColor * a * uFade, 1.0);
}`

const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(uColor * uFade, 1.0);
}`

const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

function overlayMat(frag: string, vert: string, color: Color, extra: Record<string, { value: unknown }> = {}, xray = false): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uFade: { value: 0 }, uTime: { value: 0 }, ...extra },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: !xray,
    blending: AdditiveBlending,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
}

export interface NetVision {
  root: Group
  update(s: GameState, sim: Sim, dt: number): void
}

export function buildNetVision(s: GameState, sim: Sim): NetVision {
  const root = new Group()
  const g = levelGrid(sim)
  let fade = 0

  // ---- links: a pool of thin glowing cylinders, re-aimed every frame (drone ends move)
  const linkGeo = new CylinderGeometry(N.linkRadius, N.linkRadius, 1, 6, 1, true)
  linkGeo.translate(0, 0.5, 0)
  const links: { mesh: Mesh; mat: ShaderMaterial }[] = []
  for (let i = 0; i < MAX_LINKS; i++) {
    const mat = overlayMat(LINK_FRAG, UV_VERT, palette.terminal, { uLen: { value: 1 } }, true)
    const mesh = new Mesh(linkGeo, mat)
    mesh.visible = false
    mesh.frustumCulled = false
    mesh.renderOrder = 30
    mesh.userData['noReflect'] = true
    root.add(mesh)
    links.push({ mesh, mat })
  }

  // ---- patrol routes: a ribbon per drone on the floor, all in one geometry. The waypoints are joined by straight runs with
  // rounded corners (a quadratic bend of up to N.routeCorner m, never more than half a run), so a route turns where it really
  // turns and never kinks at a cell corner. Built once.
  const routes = dronePatrolRoutes(s)
  const pos: number[] = []
  const aS: number[] = []
  const aSide: number[] = []
  const aDrone: number[] = []
  const idx: number[] = []
  const W = N.routeWidth / 2
  const smooth = (r: readonly { x: number; z: number }[]): { x: number; z: number }[] => {
    const out: { x: number; z: number }[] = []
    const n = r.length
    for (let k = 0; k < n; k++) {
      const a = r[(k + n - 1) % n] as { x: number; z: number }
      const c = r[k] as { x: number; z: number }
      const b = r[(k + 1) % n] as { x: number; z: number }
      const l0 = Math.hypot(c.x - a.x, c.z - a.z)
      const l1 = Math.hypot(b.x - c.x, b.z - c.z)
      if (l0 < 0.05 || l1 < 0.05) continue
      const ix = (c.x - a.x) / l0
      const iz = (c.z - a.z) / l0
      const ox = (b.x - c.x) / l1
      const oz = (b.z - c.z) / l1
      if (Math.abs(ix * oz - iz * ox) < 0.02 && ix * ox + iz * oz > 0) {
        out.push({ x: c.x, z: c.z }) // straight on
        continue
      }
      const cut = Math.min(N.routeCorner, l0 / 2, l1 / 2)
      const p0x = c.x - ix * cut
      const p0z = c.z - iz * cut
      const p2x = c.x + ox * cut
      const p2z = c.z + oz * cut
      const steps = 8
      for (let t = 0; t <= steps; t++) {
        const u = t / steps
        const q = 1 - u
        out.push({ x: q * q * p0x + 2 * q * u * c.x + u * u * p2x, z: q * q * p0z + 2 * q * u * c.z + u * u * p2z })
      }
    }
    return out
  }
  for (let d = 0; d < routes.length && d < MAX_ROUTES; d++) {
    let r = routes[d]
    if (!r || r.length < 2) continue
    if (r.length === 2) {
      // out and back along one line: two lanes side by side with a rounded turn at each end, so the way back reads as its own
      const a = r[0] as { x: number; z: number }
      const b = r[1] as { x: number; z: number }
      const l = Math.hypot(b.x - a.x, b.z - a.z)
      if (l < 0.05) continue
      const nx = (-(b.z - a.z) / l) * N.routeLane
      const nz = ((b.x - a.x) / l) * N.routeLane
      r = [
        { x: a.x + nx, z: a.z + nz },
        { x: b.x + nx, z: b.z + nz },
        { x: b.x - nx, z: b.z - nz },
        { x: a.x - nx, z: a.z - nz },
      ] as unknown as typeof r
    }
    const pts = smooth(r)
    const n = pts.length
    if (n < 2) continue
    // resample at an even spacing (the bends are dense, the runs sparse), arc length measured along the loop
    let total = 0
    for (let k = 0; k < n; k++) total += Math.hypot((pts[(k + 1) % n] as { x: number }).x - (pts[k] as { x: number }).x, (pts[(k + 1) % n] as { z: number }).z - (pts[k] as { z: number }).z)
    const count = Math.max(8, Math.round(total / 0.25))
    const step = total / count
    // a whole number of chevrons round the loop, so the pattern is seamless where it closes
    const cs = Math.max(1, Math.round(total / N.chevronSpacing)) * N.chevronSpacing
    const arcScale = cs / total
    const samples: { x: number; z: number }[] = []
    let k = 0
    let segStart = 0
    for (let i = 0; i < count; i++) {
      const want = i * step
      for (;;) {
        const a = pts[k % n] as { x: number; z: number }
        const b = pts[(k + 1) % n] as { x: number; z: number }
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        if (want <= segStart + len || k > n * 2) {
          const t = len > 1e-6 ? Math.min(1, Math.max(0, (want - segStart) / len)) : 0
          samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
          break
        }
        segStart += len
        k++
      }
    }
    const base0 = pos.length / 3
    for (let i = 0; i <= count; i++) {
      const c = samples[i % count] as { x: number; z: number }
      const a = samples[(i + count - 1) % count] as { x: number; z: number }
      const b = samples[(i + 1) % count] as { x: number; z: number }
      let tx = b.x - a.x
      let tz = b.z - a.z
      const tl = Math.hypot(tx, tz) || 1
      tx /= tl
      tz /= tl
      const y = floorHeightAt(g, c.x, c.z) + 0.045
      for (const side of [-1, 1]) {
        pos.push(c.x - tz * W * side, y, c.z + tx * W * side)
        aS.push(i * step * arcScale)
        aSide.push(side)
        aDrone.push(d)
      }
    }
    for (let i = 0; i < count; i++) {
      const q = base0 + i * 2
      idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3)
    }
  }
  const routeGeo = new BufferGeometry()
  routeGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  routeGeo.setAttribute('aS', new BufferAttribute(new Float32Array(aS), 1))
  routeGeo.setAttribute('aSide', new BufferAttribute(new Float32Array(aSide), 1))
  routeGeo.setAttribute('aDrone', new BufferAttribute(new Float32Array(aDrone), 1))
  routeGeo.setIndex(idx)
  const routeOn: number[] = []
  for (let i = 0; i < MAX_ROUTES; i++) routeOn.push(0)
  const routeMat = overlayMat(ROUTE_FRAG, ROUTE_VERT, palette.security.clone().multiplyScalar(N.routeStrength), { uOn: { value: routeOn }, uHalf: { value: W } })
  const routeMesh = new Mesh(routeGeo, routeMat)
  routeMesh.visible = false
  routeMesh.renderOrder = 6
  routeMesh.userData['noReflect'] = true
  root.add(routeMesh)

  // ---- motion-sensor zones: a translucent red column and a ring on the floor each
  const zoneGeo = new CylinderGeometry(1, 1, N.zoneHeight, 40, 1, true)
  zoneGeo.translate(0, N.zoneHeight / 2, 0)
  const ringGeo = new RingGeometry(0.97, 1, 72)
  ringGeo.rotateX(-Math.PI / 2)
  const zones: { col: Mesh; ring: Mesh; mat: ShaderMaterial; ringMat: ShaderMaterial }[] = []
  for (let i = 0; i < sensorZones(s).length; i++) {
    const mat = overlayMat(ZONE_FRAG, ZONE_VERT, palette.security, { uPulse: { value: 0 } })
    const ringMat = overlayMat(RING_FRAG, UV_VERT, palette.security.clone().multiplyScalar(0.6))
    const col = new Mesh(zoneGeo, mat)
    const ring = new Mesh(ringGeo, ringMat)
    for (const m of [col, ring]) {
      m.visible = false
      m.renderOrder = 7
      m.userData['noReflect'] = true
      root.add(m)
    }
    zones.push({ col, ring, mat, ringMat })
  }

  // ---- the hero's noise radius
  const noiseMat = overlayMat(RING_FRAG, UV_VERT, palette.sound.clone().multiplyScalar(N.noiseStrength))
  const noiseRing = new Mesh(new RingGeometry(0.975, 1, 96).rotateX(-Math.PI / 2), noiseMat)
  noiseRing.visible = false
  noiseRing.renderOrder = 7
  noiseRing.userData['noReflect'] = true
  root.add(noiseRing)
  let noiseR = 0

  const setFade = (m: ShaderMaterial, v: number, time: number): void => {
    ;(m.uniforms['uFade'] as { value: number }).value = v
    ;(m.uniforms['uTime'] as { value: number }).value = time
  }

  return {
    root,
    update(st: GameState, _sm: Sim, dt: number): void {
      const scanning = scanActive(st)
      fade += ((scanning ? 1 : 0) - fade) * Math.min(1, dt * 8)
      if (fade < 0.01) fade = 0
      const on = fade > 0
      setConesXray(scanning)
      const time = gameTime(st)

      // links
      const ls = scanLinks(st)
      for (let i = 0; i < MAX_LINKS; i++) {
        const v = links[i] as { mesh: Mesh; mat: ShaderMaterial }
        const l = i < ls.length ? ls[i] : undefined
        v.mesh.visible = on && l !== undefined
        if (!v.mesh.visible || !l) continue
        tmpDir.set(l.to.x - l.from.x, l.to.y - l.from.y, l.to.z - l.from.z)
        const len = tmpDir.length()
        if (len < 0.05) {
          v.mesh.visible = false
          continue
        }
        v.mesh.position.set(l.from.x, l.from.y, l.from.z)
        v.mesh.quaternion.setFromUnitVectors(UP, tmpDir.multiplyScalar(1 / len))
        v.mesh.scale.set(1, len, 1)
        ;(v.mat.uniforms['uLen'] as { value: number }).value = len
        ;(v.mat.uniforms['uColor']?.value as Color).copy(l.kind === 'drone' || l.kind === 'warden' || l.kind === 'camera' ? palette.paused : palette.terminal).multiplyScalar(N.linkStrength)
        setFade(v.mat, fade, time)
      }

      // routes of the patrol drones still flying their round
      routeMesh.visible = on
      if (on) {
        const ds = drones(st)
        for (let i = 0; i < MAX_ROUTES; i++) {
          const d = ds[i]
          routeOn[i] = d && d.active && d.alive && d.mode === 'patrol' ? 1 : d && d.active && d.alive ? 0.35 : 0
        }
        setFade(routeMat, fade, time)
      }

      // sensor zones
      const zs = sensorZones(st)
      for (let i = 0; i < zones.length; i++) {
        const v = zones[i] as { col: Mesh; ring: Mesh; mat: ShaderMaterial; ringMat: ShaderMaterial }
        const z = zs[i]
        v.col.visible = on && z !== undefined
        v.ring.visible = v.col.visible
        if (!z || !v.col.visible) continue
        v.col.position.set(z.x, z.y, z.z)
        v.col.scale.set(z.radius, 1, z.radius)
        v.ring.position.set(z.x, z.y + 0.04, z.z)
        v.ring.scale.set(z.radius, 1, z.radius)
        ;(v.mat.uniforms['uPulse'] as { value: number }).value = z.tripped ? 0.5 + 0.5 * Math.sin(time * 14) : 0
        setFade(v.mat, fade, time)
        setFade(v.ringMat, fade * (z.tripped ? 1.6 : 1), time)
      }

      // the hero's noise
      const nr = noiseRadius(st)
      noiseR += (nr - noiseR) * Math.min(1, dt * 10)
      noiseRing.visible = on && noiseR > 0.15
      if (noiseRing.visible) {
        const p = playerPos(st)
        noiseRing.position.set(p.x, floorHeightAt(g, p.x, p.z) + 0.05, p.z)
        noiseRing.scale.set(noiseR, 1, noiseR)
        setFade(noiseMat, fade, time)
      }
    },
  }
}
