// Drone meshes (concept-art/enemy-1): a glossy black body inside a disc ring with a red light band and a single red
// eye, plus a view cone and a suspicion arc above it. One mesh set per state slot (pooled, no allocations per frame).
import { Color, ConeGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, TorusGeometry, DoubleSide, type Camera } from 'three'
import cfgAll from '../config.json'
import type { GameState } from '../core/state'
import { drones, gameTime } from '../core/queries'
import { createCone, type ViewCone } from './cone'
import { palette, type Materials } from './look'

const D = cfgAll.drone
const DEG = Math.PI / 180

interface DroneView {
  root: Group
  body: Group
  ring: Mesh
  eyeMat: MeshBasicMaterial
  bandMat: MeshBasicMaterial
  cone: ViewCone
  sus: Mesh
  susMat: MeshBasicMaterial
  bob: number
  lastSusSeg: number
}

const SUS_SEGMENTS = 24
const tmp = new Color()

export interface DroneViews {
  root: Group
  update(s: GameState, dt: number, camera: Camera): void
}

export function buildDrones(s: GameState, mats: Materials): DroneViews {
  const root = new Group()
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
    const cone = createCone(D.range, D.halfAngleDeg * DEG)
    cone.mesh.rotation.x = D.pitchDeg * DEG
    cone.mesh.position.z = 0.42
    body.add(cone.mesh)
    const susMat = new MeshBasicMaterial({ color: palette.suspicious.clone(), toneMapped: false, transparent: true, depthTest: false, side: DoubleSide })
    const sus = new Mesh(arcs[0], susMat)
    sus.position.y = 1.0
    sus.renderOrder = 20
    g.add(body, sus)
    g.visible = false
    root.add(g)
    return { root: g, body, ring: band, eyeMat, bandMat, cone, sus, susMat, bob: i * 1.7, lastSusSeg: 0 }
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
        const aiming = alert && d.sees && d.fireCooldown < 0.3
        if (paused) tmp.copy(palette.paused)
        else if (alert) tmp.copy(palette.security)
        else tmp.copy(palette.security).lerp(palette.suspicious, Math.min(1, d.suspicion * 1.6))
        v.eyeMat.color.copy(tmp).multiplyScalar(aiming ? 1.6 + Math.sin(time * 40) * 0.6 : 1)
        v.bandMat.color.copy(paused ? palette.paused : palette.security).multiplyScalar(alert ? 0.9 + 0.5 * Math.sin(time * 12) : 0.7)
        v.ring.rotation.z += dt * (alert ? 8 : 1.5)
        v.cone.mesh.visible = !paused && !spawning
        v.cone.set(tmp, alert ? 1.6 : 0.7 + d.suspicion * 1.2, time)
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
