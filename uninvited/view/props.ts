// Security devices and level props: video cameras with sweeping cones, sound cameras with their hearing ring,
// motion sensors (visible only in network vision), laser grids, red walls, hack terminals, checkpoints, the artifact,
// and the network-vision links from terminals to what they control.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import cfgAll from '../config.json'
import type { GameState, Sim } from '../core/state'
import {
  artifactPos,
  artifactTaken,
  checkpoints,
  drones,
  gameTime,
  hackTerminal,
  isLaserOn,
  lasers,
  levelCeiling,
  motionSensors,
  redWalls,
  scanActive,
  soundCameras,
  terminalLinks,
  terminals,
  videoCameras,
} from '../core/queries'
import { createCone, type ViewCone } from './cone'
import { palette, type Materials } from './look'
import { fanSpread, type Sight } from './sight'

const DEG = Math.PI / 180
const VC = cfgAll.videoCamera
const SC = cfgAll.soundCamera
const MS = cfgAll.motionSensor
const LZ = cfgAll.laser

const tmpColor = new Color()
const CAM_SPREAD = fanSpread(VC.halfAngleDeg * DEG, VC.pitchDeg * DEG)

/** Flat floor decals would only double themselves in the floor mirror. */
function noReflect(m: Mesh): Mesh {
  m.userData['noReflect'] = true
  return m
}

function screenTexture(lines: number, seed: number, tint: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 160
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#021016'
    g.fillRect(0, 0, 128, 160)
    g.fillStyle = tint
    let s = seed
    for (let i = 0; i < lines; i++) {
      s = (s * 9301 + 49297) % 233280
      const w = 20 + (s / 233280) * 90
      g.globalAlpha = 0.5 + ((i * 37) % 5) / 10
      g.fillRect(10, 12 + i * 11, w, 4)
    }
    g.globalAlpha = 1
    g.strokeStyle = tint
    g.lineWidth = 3
    g.strokeRect(3, 3, 122, 154)
  }
  const t = new CanvasTexture(c)
  return t
}

interface CameraView {
  pivot: Group
  cone: ViewCone
  lens: MeshBasicMaterial
  root: Group
}

interface SoundView {
  root: Group
  rings: Mesh[]
  ringMat: MeshBasicMaterial
  floorRing: Mesh
  floorMat: MeshBasicMaterial
  pulse: Mesh
  pulseMat: MeshBasicMaterial
}

interface SensorView {
  root: Group
  light: Mesh
  lightMat: MeshBasicMaterial
  ring: Mesh
  ringMat: MeshBasicMaterial
}

interface LaserView {
  root: Group
  beams: Mesh
  beamMat: MeshBasicMaterial
  posts: Mesh[]
  dots: MeshBasicMaterial
}

interface WallView {
  root: Group
  mat: ShaderMaterial
  open: number
}

interface TerminalView {
  root: Group
  screenMat: MeshBasicMaterial
  halo: MeshBasicMaterial
}

interface CheckpointView {
  root: Group
  ringMat: MeshBasicMaterial
  pillarMat: ShaderMaterial
  flash: number
}

/** A soft column of light that fades upwards (checkpoints, the artifact). */
function columnMaterial(color: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: color } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }',
    fragmentShader:
      'uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(1.0 - abs(dot(vN, vV)), 2.0); float a = pow(1.0 - vUv.y, 2.2) * (0.25 + 0.75 * edge); gl_FragColor = vec4(uColor * a, 1.0); }',
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
}

const WALL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
void main() {
  float bars = step(0.9, fract(vUv.x * 14.0 + uTime * 0.25));
  float rows = step(0.93, fract(vUv.y * 18.0 - uTime * 0.6));
  float scan = 0.5 + 0.5 * sin(vUv.y * 120.0 - uTime * 9.0);
  float edge = max(smoothstep(0.04, 0.0, vUv.x) + smoothstep(0.96, 1.0, vUv.x), smoothstep(0.03, 0.0, vUv.y) + smoothstep(0.97, 1.0, vUv.y));
  float dissolve = step(uOpen, fract(sin(dot(floor(vUv * vec2(40.0, 60.0)), vec2(12.9898, 78.233))) * 43758.5453) * 0.999);
  float a = (0.16 + 0.12 * scan + 0.55 * max(bars, rows) + edge) * dissolve * (1.0 - uOpen * 0.5);
  gl_FragColor = vec4(uColor * a, 1.0);
}`

export interface Props {
  root: Group
  update(s: GameState, sim: Sim, dt: number): void
  /** A checkpoint was reached: flash it. */
  flashCheckpoint(i: number): void
  /** Rebuild per-state parts after a load or restart. */
  reset(s: GameState): void
}

export function buildProps(s: GameState, sim: Sim, mats: Materials, sight: Sight): Props {
  const root = new Group()
  const ceiling = levelCeiling(sim)

  // ---- video cameras
  const camGeo = new SphereGeometry(0.26, 20, 14)
  const lensGeo = new TorusGeometry(0.13, 0.03, 8, 24)
  const lensCore = new SphereGeometry(0.07, 10, 8)
  const armGeo = new CylinderGeometry(0.05, 0.07, 0.5, 8)
  const cams: CameraView[] = videoCameras(s).map((c) => {
    const g = new Group()
    g.position.set(c.pos.x, c.pos.y, c.pos.z)
    const arm = new Mesh(armGeo, mats.glossBlack)
    arm.rotation.x = Math.PI / 2
    arm.rotation.y = 0
    const armHolder = new Group()
    armHolder.rotation.y = c.baseYaw
    arm.position.z = -0.2
    armHolder.add(arm)
    g.add(armHolder)
    const pivot = new Group()
    pivot.rotation.order = 'YXZ'
    const body = new Mesh(camGeo, mats.glossBlack)
    body.scale.set(1, 0.8, 1.3)
    const lens = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false })
    const ring = new Mesh(lensGeo, lens)
    ring.position.z = 0.3
    const core = new Mesh(lensCore, lens)
    core.position.z = 0.3
    const band = new Mesh(new TorusGeometry(0.27, 0.015, 6, 32), lens)
    band.rotation.x = Math.PI / 2
    pivot.add(body, ring, core, band)
    const cone = createCone(VC.range, VC.halfAngleDeg * DEG, sight.texture)
    cone.mesh.position.z = 0.32
    pivot.add(cone.mesh)
    g.add(pivot)
    root.add(g)
    return { pivot, cone, lens, root: g }
  })

  // ---- sound cameras: a dome with concentric amber rings and a hearing ring on the floor
  const sounds: SoundView[] = soundCameras(s).map((c) => {
    const g = new Group()
    g.position.set(c.pos.x, c.pos.y, c.pos.z)
    const face = new Group()
    face.rotation.y = c.yaw
    const dome = new Mesh(new SphereGeometry(0.34, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.glossBlack)
    dome.rotation.x = Math.PI / 2
    dome.position.z = -0.2
    const ringMat = new MeshBasicMaterial({ color: palette.sound.clone(), toneMapped: false })
    const rings: Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const r = new Mesh(new TorusGeometry(0.08 + i * 0.09, 0.015, 6, 28), ringMat)
      r.position.z = 0.15 - i * 0.04
      rings.push(r)
      face.add(r)
    }
    face.add(dome)
    g.add(face)
    root.add(g)
    const floorY = c.pos.y - SC.mountHeight + 0.03
    const floorMat = new MeshBasicMaterial({ color: palette.sound.clone(), toneMapped: false, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const floorRing = new Mesh(new RingGeometry(SC.radius - 0.06, SC.radius, 96), floorMat)
    floorRing.rotation.x = -Math.PI / 2
    floorRing.position.set(c.pos.x, floorY, c.pos.z)
    root.add(noReflect(floorRing))
    const pulseMat = floorMat.clone()
    const pulse = new Mesh(new RingGeometry(0.92, 1, 64), pulseMat)
    pulse.rotation.x = -Math.PI / 2
    pulse.position.set(c.pos.x, floorY + 0.01, c.pos.z)
    root.add(noReflect(pulse))
    return { root: g, rings, ringMat, floorRing, floorMat, pulse, pulseMat }
  })

  // ---- motion sensors: a dark puck; in network vision a blinking light and its radius
  const sensors: SensorView[] = motionSensors(s).map((m) => {
    const g = new Group()
    g.position.set(m.pos.x, m.pos.y, m.pos.z)
    const puck = new Mesh(new CylinderGeometry(0.16, 0.2, 0.06, 16), mats.matteBlack)
    puck.position.y = 0.03
    const lightMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false })
    const light = new Mesh(new SphereGeometry(0.06, 10, 8), lightMat)
    light.position.y = 0.09
    const ringMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const ring = new Mesh(new RingGeometry(MS.radius - 0.05, MS.radius, 64), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.04
    g.add(puck, light, noReflect(ring))
    root.add(g)
    return { root: g, light, lightMat, ring, ringMat }
  })

  // ---- laser grids: two posts with emitters and crossing red beams (NN1b)
  const laserViews: LaserView[] = lasers(s).map((l) => {
    const g = new Group()
    const H = LZ.height
    const ends = [l.min + 0.18, l.max - 0.18]
    const at = (along: number, y: number): Vector3 => (l.alongX ? new Vector3(l.coord, l.floor + y, along) : new Vector3(along, l.floor + y, l.coord))
    const posts: Mesh[] = []
    const dots = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false })
    const postGeo = new RoundedBoxGeometry(0.22, H + 0.3, 0.22, 2, 0.08)
    const dotGeo = new SphereGeometry(0.05, 8, 6)
    const N = 6
    for (const e of ends) {
      const p = new Mesh(postGeo, mats.glossBlack)
      p.position.copy(at(e, (H + 0.3) / 2))
      posts.push(p)
      g.add(p)
      for (let i = 0; i < N; i++) {
        const d = new Mesh(dotGeo, dots)
        d.position.copy(at(e + (e < (l.min + l.max) / 2 ? 0.12 : -0.12), 0.25 + (i * (H - 0.4)) / (N - 1)))
        g.add(d)
      }
    }
    // beams: horizontals and an X lattice, as thin quads facing both ways
    const pos: number[] = []
    const beam = (a: Vector3, b: Vector3, w: number): void => {
      const up = new Vector3(0, 1, 0)
      const dir = b.clone().sub(a).normalize()
      const side = new Vector3().crossVectors(dir, up)
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
      side.normalize()
      const n = new Vector3().crossVectors(side, dir).normalize().multiplyScalar(w)
      const p0 = a.clone().add(n)
      const p1 = a.clone().sub(n)
      const p2 = b.clone().add(n)
      const p3 = b.clone().sub(n)
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p2.x, p2.y, p2.z, p1.x, p1.y, p1.z, p3.x, p3.y, p3.z)
      // and a second quad turned 90 degrees so the beam has volume from any side
      const m = side.clone().multiplyScalar(w)
      const q0 = a.clone().add(m)
      const q1 = a.clone().sub(m)
      const q2 = b.clone().add(m)
      const q3 = b.clone().sub(m)
      pos.push(q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, q2.x, q2.y, q2.z, q2.x, q2.y, q2.z, q1.x, q1.y, q1.z, q3.x, q3.y, q3.z)
    }
    const e0 = (ends[0] as number) + 0.12
    const e1 = (ends[1] as number) - 0.12
    for (let i = 0; i < N; i++) {
      const y = 0.25 + (i * (H - 0.4)) / (N - 1)
      beam(at(e0, y), at(e1, y), 0.018)
      if (i < N - 1) {
        const y2 = 0.25 + ((i + 1) * (H - 0.4)) / (N - 1)
        beam(at(e0, y), at(e1, y2), 0.014)
        beam(at(e0, y2), at(e1, y), 0.014)
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    const beamMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const beams = new Mesh(geo, beamMat)
    g.add(beams)
    root.add(g)
    return { root: g, beams, beamMat, posts, dots }
  })

  // ---- red walls: an energy membrane across the corridor
  const wallViews: WallView[] = redWalls(s).map((w) => {
    const g = new Group()
    const width = w.max - w.min
    const height = ceiling - w.floor
    const mat = new ShaderMaterial({
      uniforms: { uColor: { value: palette.security.clone() }, uTime: { value: 0 }, uOpen: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: WALL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    const plane = new Mesh(new PlaneGeometry(width, height), mat)
    const mid = (w.min + w.max) / 2
    if (w.alongX) {
      plane.rotation.y = Math.PI / 2
      plane.position.set(w.coord, w.floor + height / 2, mid)
    } else {
      plane.position.set(mid, w.floor + height / 2, w.coord)
    }
    g.add(plane)
    root.add(g)
    return { root: g, mat, open: 0 }
  })

  // ---- terminals: a console in the wall with a glowing screen
  const terminalViews: TerminalView[] = terminals(s).map((t, i) => {
    const g = new Group()
    g.position.set(t.pos.x, t.pos.y, t.pos.z)
    g.rotation.y = t.yaw
    const body = new Mesh(new RoundedBoxGeometry(1.0, 1.5, 0.3, 3, 0.1), mats.glossBlack)
    body.position.set(0, 1.05, -0.05)
    const screenMat = new MeshBasicMaterial({ map: screenTexture(12, 7 + i * 13, '#4ff0ff'), color: palette.terminal.clone(), toneMapped: false })
    const screen = new Mesh(new PlaneGeometry(0.72, 0.9), screenMat)
    screen.position.set(0, 1.2, 0.11)
    const ledge = new Mesh(new RoundedBoxGeometry(0.9, 0.08, 0.4, 2, 0.03), mats.glossBlack)
    ledge.position.set(0, 0.62, 0.15)
    const halo = new MeshBasicMaterial({ color: palette.terminal.clone(), toneMapped: false })
    const frame = new Mesh(new TorusGeometry(0.62, 0.018, 6, 48), halo)
    frame.scale.set(0.85, 1.15, 1)
    frame.position.set(0, 1.1, 0.12)
    g.add(body, screen, ledge, frame)
    root.add(g)
    return { root: g, screenMat, halo }
  })

  // ---- checkpoints: a ring on the floor and a faint pillar
  const cpViews: CheckpointView[] = checkpoints(s).map((c) => {
    const g = new Group()
    g.position.set(c.pos.x, c.pos.y, c.pos.z)
    const ringMat = new MeshBasicMaterial({ color: palette.checkpoint.clone(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const ring = new Mesh(new RingGeometry(1.45, 1.6, 64), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    const inner = new Mesh(new RingGeometry(1.1, 1.14, 64), ringMat)
    inner.rotation.x = -Math.PI / 2
    inner.position.y = 0.03
    const pillarMat = columnMaterial(palette.checkpoint.clone().multiplyScalar(0.2))
    const pillar = new Mesh(new CylinderGeometry(1.5, 1.5, 2.2, 40, 1, true), pillarMat)
    pillar.position.y = 1.1
    g.add(noReflect(ring), noReflect(inner), pillar)
    root.add(g)
    return { root: g, ringMat, pillarMat, flash: 0 }
  })

  // ---- the artifact: a glowing file in two orbiting rings and a beam of light
  const art = artifactPos(sim)
  const artifact = new Group()
  artifact.position.set(art.x, art.y, art.z)
  const fileMat = new MeshBasicMaterial({ map: screenTexture(11, 99, '#fff2c8'), color: palette.artifact.clone(), toneMapped: false, side: DoubleSide })
  const file = new Mesh(new PlaneGeometry(0.55, 0.72), fileMat)
  file.position.y = 1.45
  const artRingMat = new MeshBasicMaterial({ color: palette.artifact.clone(), toneMapped: false })
  const r1 = new Mesh(new TorusGeometry(0.62, 0.02, 6, 48), artRingMat)
  const r2 = new Mesh(new TorusGeometry(0.78, 0.015, 6, 48), artRingMat)
  r1.position.y = 1.45
  r2.position.y = 1.45
  const beamMat = columnMaterial(palette.artifact.clone().multiplyScalar(0.25))
  const beamCol = new Mesh(new CylinderGeometry(0.5, 0.9, ceiling - art.y, 24, 1, true), beamMat)
  beamCol.position.y = (ceiling - art.y) / 2
  const pedestal = new Mesh(new RoundedBoxGeometry(1.0, 0.5, 1.0, 2, 0.12), mats.glossBlack)
  pedestal.position.y = 0.25
  artifact.add(file, r1, r2, beamCol, pedestal)
  root.add(artifact)

  // ---- network-vision links: terminal -> what it controls
  const MAX_LINKS = 16
  const linkPos = new Float32Array(MAX_LINKS * 6)
  const linkGeo = new BufferGeometry()
  linkGeo.setAttribute('position', new BufferAttribute(linkPos, 3))
  const linkMat = new LineBasicMaterial({ color: palette.terminal.clone(), toneMapped: false, transparent: true, opacity: 0.9 })
  const links = new LineSegments(linkGeo, linkMat)
  links.frustumCulled = false
  links.visible = false
  root.add(links)

  function setLink(k: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    const o = k * 6
    linkPos[o] = ax
    linkPos[o + 1] = ay
    linkPos[o + 2] = az
    linkPos[o + 3] = bx
    linkPos[o + 4] = by
    linkPos[o + 5] = bz
  }

  function update(st: GameState, sm: Sim, dt: number): void {
    const time = gameTime(st)
    const scanning = scanActive(st)
    // cameras
    const cs = videoCameras(st)
    for (let i = 0; i < cams.length; i++) {
      const v = cams[i] as CameraView
      const c = cs[i]
      if (!c) continue
      v.root.visible = c.alive
      if (!c.alive) continue
      v.pivot.rotation.y = c.yaw
      v.pivot.rotation.x = VC.pitchDeg * DEG
      const fan = sight.fan(i, c.pos.x, c.pos.z, c.yaw, CAM_SPREAD, VC.range)
      if (c.pausedTime > 0) {
        tmpColor.copy(palette.paused)
        v.cone.set(tmpColor, 0.25, time, fan)
      } else {
        tmpColor.copy(palette.security).lerp(palette.suspicious, Math.min(1, c.suspicion * 1.5) * (c.suspicion < 1 ? 1 : 0))
        if (c.suspicion >= 1) tmpColor.copy(palette.security)
        const flash = c.sees && c.suspicion >= 1 ? 0.5 + 0.5 * Math.sin(time * 30) : 0
        v.cone.set(tmpColor, 0.8 + c.suspicion * 1.4 + flash, time, fan)
      }
      v.lens.color.copy(c.pausedTime > 0 ? palette.paused : palette.security)
    }
    // sound cameras
    const ss = soundCameras(st)
    for (let i = 0; i < sounds.length; i++) {
      const v = sounds[i] as SoundView
      const c = ss[i]
      if (!c) continue
      v.root.visible = c.alive
      v.floorRing.visible = c.alive
      v.pulse.visible = c.alive
      if (!c.alive) continue
      const paused = c.pausedTime > 0
      const heard = Math.max(0, 1 - c.heardAgo * 2)
      v.ringMat.color.copy(paused ? palette.paused : palette.sound).multiplyScalar(1 + heard * 1.5)
      v.floorMat.opacity = (scanning ? 0.6 : 0.22) + heard * 0.5 + c.suspicion * 0.3
      v.floorMat.color.copy(c.suspicion > 0.6 ? palette.security : palette.sound)
      const t = (time / SC.pingSec) % 1
      const r = 0.3 + t * SC.radius
      v.pulse.scale.setScalar(r)
      v.pulseMat.opacity = (1 - t) * 0.35
      for (let k = 0; k < v.rings.length; k++) (v.rings[k] as Mesh).scale.setScalar(1 + 0.15 * Math.sin(time * 4 - k))
    }
    // motion sensors: hard to see unless scanning
    const ms = motionSensors(st)
    for (let i = 0; i < sensors.length; i++) {
      const v = sensors[i] as SensorView
      const m = ms[i]
      if (!m) continue
      const blink = Math.sin(time * 9 + i) > 0.2 ? 1 : 0.15
      const tripped = m.rearm > 0
      v.light.visible = scanning || tripped
      v.ring.visible = scanning
      v.lightMat.color.copy(palette.security).multiplyScalar(tripped ? 2 : blink * 1.5)
      v.ringMat.opacity = 0.25 + 0.15 * blink
    }
    // lasers
    const ls = lasers(st)
    for (let i = 0; i < laserViews.length; i++) {
      const v = laserViews[i] as LaserView
      const l = ls[i]
      if (!l) continue
      const on = isLaserOn(st, i)
      // paused: off with the odd flicker so it reads as "held down", not gone
      const flicker = !on && l.alive && l.pausedTime > 0 && Math.sin(time * 37) > 0.97
      v.beams.visible = on || flicker
      v.beamMat.opacity = on ? 0.85 + 0.15 * Math.sin(time * 25 + i) : 0.3
      v.dots.color.copy(l.alive ? (on ? palette.security : palette.paused) : palette.securityDim)
      for (const p of v.posts) p.visible = true
    }
    // red walls
    const ws = redWalls(st)
    for (let i = 0; i < wallViews.length; i++) {
      const v = wallViews[i] as WallView
      const w = ws[i]
      if (!w) continue
      if (w.open) v.open = Math.min(1, v.open + dt * 0.9)
      else v.open = 0
      v.root.visible = v.open < 1
      const u = v.mat.uniforms as Record<string, { value: number }>
      ;(u['uTime'] as { value: number }).value = time
      ;(u['uOpen'] as { value: number }).value = v.open
    }
    // terminals
    const ts = terminals(st)
    const hacking = hackTerminal(st)
    for (let i = 0; i < terminalViews.length; i++) {
      const v = terminalViews[i] as TerminalView
      const t = ts[i]
      if (!t) continue
      const base = t.done ? palette.terminalDone : t.cooldown > 0 ? palette.paused : palette.terminal
      const pulse = hacking === i ? 1 + 0.6 * Math.sin(time * 14) : 1 + 0.15 * Math.sin(time * 2 + i)
      v.screenMat.color.copy(base).multiplyScalar(0.55 * pulse)
      v.halo.color.copy(base).multiplyScalar(pulse * (scanning ? 1.5 : 1))
    }
    // checkpoints
    const cps = checkpoints(st)
    for (let i = 0; i < cpViews.length; i++) {
      const v = cpViews[i] as CheckpointView
      const c = cps[i]
      if (!c) continue
      v.flash = Math.max(0, v.flash - dt * 1.5)
      const k = c.passed ? 0.35 : 0.8 + 0.2 * Math.sin(time * 3 + i)
      v.ringMat.color.copy(c.passed ? palette.terminalDone : palette.checkpoint).multiplyScalar(k + v.flash * 2)
      ;(v.pillarMat.uniforms['uColor']?.value as Color).copy(palette.checkpoint).multiplyScalar((c.passed ? 0.04 : 0.14) + v.flash * 0.8)
      v.root.scale.setScalar(1 + v.flash * 0.15)
    }
    // the artifact
    artifact.visible = !artifactTaken(st)
    file.rotation.y = time * 0.8
    file.position.y = 1.45 + Math.sin(time * 1.6) * 0.08
    r1.rotation.set(time * 0.7, time * 0.5, 0)
    r2.rotation.set(-time * 0.4, 0, time * 0.6)
    // links
    links.visible = scanning
    if (scanning) {
      let k = 0
      const ds = drones(st)
      for (let i = 0; i < ts.length && k < MAX_LINKS; i++) {
        const t = ts[i]
        const lk = terminalLinks(sm, i)
        if (!t || !lk) continue
        const ax = t.pos.x
        const ay = t.pos.y + 1.2
        const az = t.pos.z
        for (const w of lk.walls) {
          const wall = ws[w]
          if (!wall || k >= MAX_LINKS) continue
          const mid = (wall.min + wall.max) / 2
          setLink(k++, ax, ay, az, wall.alongX ? wall.coord : mid, wall.floor + 2, wall.alongX ? mid : wall.coord)
        }
        for (const l of lk.lasers) {
          const las = ls[l]
          if (!las || k >= MAX_LINKS) continue
          const mid = (las.min + las.max) / 2
          setLink(k++, ax, ay, az, las.alongX ? las.coord : mid, las.floor + 1.2, las.alongX ? mid : las.coord)
        }
        for (const d of lk.drones) {
          const dr = ds[d]
          if (!dr || !dr.active || !dr.alive || k >= MAX_LINKS) continue
          setLink(k++, ax, ay, az, dr.pos.x, dr.pos.y, dr.pos.z)
        }
      }
      linkGeo.setDrawRange(0, k * 2)
      ;(linkGeo.getAttribute('position') as BufferAttribute).needsUpdate = true
      linkMat.opacity = 0.6 + 0.4 * Math.sin(time * 8)
    }
  }

  return {
    root,
    update,
    flashCheckpoint(i: number): void {
      const v = cpViews[i]
      if (v) v.flash = 1
    },
    reset(st: GameState): void {
      for (let i = 0; i < wallViews.length; i++) {
        const v = wallViews[i] as WallView
        v.open = redWalls(st)[i]?.open ? 1 : 0
      }
    },
  }
}
