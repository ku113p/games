// Drone meshes (concept-art/enemy-1): a glossy black body inside a disc ring with a red light band and a single red
// eye, a short look beam out of the eye, the view cone (network vision only) and a suspicion arc above it. Before every shot a drone holds still and aims (the telegraph):
// a thin red beam reaches from its eye to the hero, narrowing and brightening as the aim completes, and the eye ring
// charges (tightens and flares). One mesh set per state slot (pooled, no allocations per frame).
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  DoubleSide,
  Vector3,
  type Camera,
} from 'three'
import cfgAll from '../config.json'
import type { GameState, Sim } from '../core/state'
import { droneAim, drones, gameTime, playerPos } from '../core/queries'
import { createCone, type ViewCone } from './cone'
import { palette, type Materials } from './look'
import { DRONE_KEY, fanSpread, NO_FAN, type Sight } from './sight'

const D = cfgAll.drone
const LOOK = cfgAll.view.cones.lookBeam
const DEG = Math.PI / 180
const SPREAD = fanSpread(D.halfAngleDeg * DEG, D.pitchDeg * DEG)

interface DroneView {
  root: Group
  body: Group
  ring: Mesh
  eyeRing: Mesh
  beam: Mesh
  beamMat: ShaderMaterial
  eyeMat: MeshBasicMaterial
  bandMat: MeshBasicMaterial
  cone: ViewCone
  /** The short look beam out of the eye: always on (the cone shows only in network vision). */
  look: ViewCone
  sus: Mesh
  susMat: MeshBasicMaterial
  bob: number
  lastSusSeg: number
}

const SUS_SEGMENTS = 24
const tmp = new Color()
const AIM = cfgAll.view.droneAim
const UP = new Vector3(0, 1, 0)
const eyeW = new Vector3()
const toHero = new Vector3()
const invQ = new Quaternion()

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAim;
uniform float uTime;
uniform float uLen;
varying vec2 vUv;
void main() {
  // a thin line that fills in from the eye, a bright pulse racing down it near the end of the aim
  float s = vUv.y * uLen;
  float reach = smoothstep(0.0, 0.25, uAim);
  float pulse = smoothstep(0.85, 1.0, fract(s / 3.0 - uTime * 3.0)) * uAim;
  float a = reach * (0.25 + 0.75 * uAim * uAim + pulse) * (1.0 - 0.5 * vUv.y);
  gl_FragColor = vec4(uColor * a, 1.0);
}`

export interface DroneViews {
  root: Group
  update(s: GameState, dt: number, camera: Camera): void
}

export function buildDrones(s: GameState, mats: Materials, sight: Sight, sim: Sim): DroneViews {
  const root = new Group()
  const beamGeo = new CylinderGeometry(1, 1, 1, 6, 1, true)
  beamGeo.translate(0, 0.5, 0)
  const bodyGeo = new SphereGeometry(0.42, 24, 18)
  const discGeo = new TorusGeometry(0.66, 0.08, 10, 40)
  const bandGeo = new TorusGeometry(0.66, 0.025, 6, 48)
  const eyeRingGeo = new TorusGeometry(0.16, 0.035, 8, 28)
  const eyeGeo = new SphereGeometry(0.085, 12, 10)
  const tipGeo = new ConeGeometry(0.07, 0.28, 10)
  const dotGeo = new SphereGeometry(0.04, 8, 6)
  // suspicion arcs: one geometry per filled fraction, so changing it never allocates
  const arcs: RingGeometry[] = []
  for (let i = 0; i <= SUS_SEGMENTS; i++) arcs.push(new RingGeometry(0.2, 0.27, 24, 1, Math.PI / 2, Math.max(0.0001, (i / SUS_SEGMENTS) * Math.PI * 2)))

  const views: DroneView[] = drones(s).map((_, i) => {
    const g = new Group()
    const body = new Group()
    const shell = new Mesh(bodyGeo, mats.glossBlack)
    shell.scale.set(1, 0.92, 1)
    const ring = new Mesh(discGeo, mats.glossBlack)
    ring.rotation.x = Math.PI / 2
    ring.scale.set(1, 1, 0.5)
    const bandMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false })
    const band = new Mesh(bandGeo, bandMat)
    band.rotation.x = Math.PI / 2
    band.position.y = -0.02
    const eyeMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false })
    const eyeRing = new Mesh(eyeRingGeo, eyeMat)
    eyeRing.position.z = 0.4
    const eye = new Mesh(eyeGeo, eyeMat)
    eye.position.z = 0.4
    const tip = new Mesh(tipGeo, mats.glossBlack)
    tip.rotation.x = Math.PI
    tip.position.y = -0.48
    const dot = new Mesh(dotGeo, eyeMat)
    dot.position.y = -0.64
    body.add(shell, ring, band, eyeRing, eye, tip, dot)
    const cone = createCone(D.range, D.halfAngleDeg * DEG, sight.texture)
    cone.mesh.rotation.x = D.pitchDeg * DEG
    cone.mesh.position.z = 0.42
    body.add(cone.mesh)
    const look = createCone(LOOK.length, LOOK.halfAngleDeg * DEG, sight.texture, { scanOnly: false, nearFade: LOOK.nearFade })
    look.mesh.rotation.x = D.pitchDeg * DEG
    look.mesh.position.z = 0.42
    body.add(look.mesh)
    const susMat = new MeshBasicMaterial({ color: palette.suspicious.clone(), toneMapped: false, transparent: true, depthTest: false, side: DoubleSide })
    const beamMat = new ShaderMaterial({
      uniforms: { uColor: { value: palette.security.clone() }, uAim: { value: 0 }, uTime: { value: 0 }, uLen: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const beam = new Mesh(beamGeo, beamMat)
    beam.visible = false
    beam.frustumCulled = false
    beam.userData['noReflect'] = true
    beam.renderOrder = 8
    const sus = new Mesh(arcs[0], susMat)
    sus.position.y = 1.0
    sus.renderOrder = 20
    sus.userData['noReflect'] = true
    g.add(body, sus, beam)
    g.visible = false
    root.add(g)
    return { root: g, body, ring: band, eyeRing, beam, beamMat, eyeMat, bandMat, cone, look, sus, susMat, bob: i * 1.7, lastSusSeg: 0 }
  })

  return {
    root,
    update(st: GameState, dt: number, camera: Camera): void {
      const time = gameTime(st)
      const ds = drones(st)
      for (let i = 0; i < views.length; i++) {
        const v = views[i] as DroneView
        const d = ds[i]
        if (!d || !d.active || !d.alive) {
          v.root.visible = false
          continue
        }
        v.root.visible = true
        v.bob += dt
        v.root.position.set(d.pos.x, d.pos.y + Math.sin(v.bob * 2.1) * 0.1, d.pos.z)
        v.body.rotation.y = d.yaw
        v.body.rotation.z = Math.sin(v.bob * 1.3) * 0.05
        const spawning = d.spawnTime > 0
        // materializing: flicker in
        v.body.visible = !spawning || Math.sin(time * 60) > (d.spawnTime / D.spawnSec) * 1.6 - 0.8
        v.body.scale.setScalar(spawning ? 1 + d.spawnTime * 0.6 : 1)
        const paused = d.pausedTime > 0
        const alert = d.mode === 'alert'
        const aim = droneAim(st, sim, i)
        const aiming = aim > 0
        if (paused) tmp.copy(palette.paused)
        else if (alert) tmp.copy(palette.security)
        else tmp.copy(palette.security).lerp(palette.suspicious, Math.min(1, d.suspicion * 1.6))
        // the eye ring charges: it tightens and flares as the aim completes
        v.eyeMat.color.copy(tmp).multiplyScalar(aiming ? 1 + aim * 1.4 + (aim > 0.8 ? Math.sin(time * 50) * 0.5 : 0) : 1)
        v.eyeRing.scale.setScalar(aiming ? 1.7 - 0.7 * aim : 1)
        // the aim beam: from the eye to the hero's chest, narrowing and brightening with the aim
        v.beam.visible = aiming && !paused
        if (v.beam.visible) {
          v.root.updateMatrixWorld()
          v.eyeRing.getWorldPosition(eyeW)
          const p = playerPos(st)
          toHero.set(p.x - eyeW.x, p.y + AIM.chest - eyeW.y, p.z - eyeW.z)
          const len = toHero.length()
          if (len > 0.1) {
            // the beam lives in the drone group: place it in that group's space
            v.root.getWorldQuaternion(invQ).invert()
            v.beam.position.copy(eyeW)
            v.root.worldToLocal(v.beam.position)
            toHero.multiplyScalar(1 / len)
            v.beam.quaternion.setFromUnitVectors(UP, toHero).premultiply(invQ)
            const r = AIM.wide + (AIM.thin - AIM.wide) * aim
            v.beam.scale.set(r, len, r)
            const bu = v.beamMat.uniforms as Record<string, { value: number }>
            ;(bu['uAim'] as { value: number }).value = aim
            ;(bu['uTime'] as { value: number }).value = time
            ;(bu['uLen'] as { value: number }).value = len
          } else v.beam.visible = false
        }
        v.bandMat.color.copy(paused ? palette.paused : palette.security).multiplyScalar(alert ? 0.9 + 0.5 * Math.sin(time * 12) : 0.7)
        v.ring.rotation.z += dt * (alert ? 8 : 1.5)
        v.cone.mesh.visible = !paused && !spawning
        v.look.mesh.visible = !spawning
        v.look.set(tmp, (paused ? LOOK.pausedStrength : LOOK.strength) * (alert ? 1.6 : 1 + d.suspicion), time, NO_FAN)
        if (!aiming) v.eyeMat.color.multiplyScalar(LOOK.lensGlow)
        v.cone.set(tmp, alert ? 1.6 : 0.7 + d.suspicion * 1.2, time, sight.fan(DRONE_KEY + i, d.pos.x, d.pos.y, d.pos.z, d.yaw, SPREAD, D.range))
        // suspicion arc above it, facing the camera
        const showSus = !alert && !paused && d.suspicion > 0.02
        v.sus.visible = showSus
        if (showSus) {
          const seg = Math.min(SUS_SEGMENTS, Math.ceil(d.suspicion * SUS_SEGMENTS))
          if (seg !== v.lastSusSeg) {
            v.sus.geometry = arcs[seg] as RingGeometry
            v.lastSusSeg = seg
          }
          v.susMat.color.copy(palette.suspicious).lerp(palette.security, d.suspicion)
          v.sus.quaternion.copy(camera.quaternion)
        }
      }
    },
  }
}
