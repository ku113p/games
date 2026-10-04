// Spawn gates (DESIGN 9: drones arrive visibly): round hatches cut into the walls and the ceiling, in the network
// look - a glossy black rim, a thin cyan light ring, two black shutter halves. When the core opens a gate (a drone
// is about to come through) the ring turns red and glitches, the shutters pull back into the rim and a red throat
// lights up behind them; a glitch and the drone alert sound play once. Everything is built once; updating never
// allocates.
import { CircleGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, TorusGeometry, Vector3, type Scene } from 'three'
import { gateStates, playerPos, spawnGates } from '../core/queries'
import type { GameState, Sim } from '../core/state'
import type { Sound } from './audio'
import { palette, type Materials } from './look'

const R = 0.86
const OPEN_RATE = 5
const CLOSE_RATE = 2.2
const HEAR = 22

interface GateView {
  root: Group
  ringMat: MeshBasicMaterial
  throatMat: MeshBasicMaterial
  top: Mesh
  bottom: Mesh
  open: number
  wasOpen: boolean
  seed: number
}

export interface SpawnGates {
  update(dt: number, s: GameState, sim: Sim): void
}

const tmp = new Color()
const fwd = new Vector3()

export function createSpawnGates(scene: Scene, _s: GameState, sim: Sim, mats: Materials, sound: Sound): SpawnGates {
  const root = new Group()
  scene.add(root)
  const rimGeo = new TorusGeometry(R + 0.07, 0.07, 10, 48)
  const ringGeo = new TorusGeometry(R, 0.014, 6, 64)
  const innerGeo = new RingGeometry(R * 0.55, R * 0.58, 48)
  const halfGeo = new CircleGeometry(R - 0.01, 32, 0, Math.PI)
  const voidGeo = new CircleGeometry(R - 0.005, 40)
  const voidMat = new MeshBasicMaterial({ color: 0x000000 })
  // a short tick of light at 12, 3, 6 and 9 o'clock on the rim, like the corridor ribs
  const tickGeo = new TorusGeometry(R + 0.07, 0.03, 4, 6, 0.18)

  const views: GateView[] = spawnGates(sim).map((g, i) => {
    const gr = new Group()
    gr.position.set(g.mouth.x + g.nx * 0.03, g.mouth.y + g.ny * 0.03, g.mouth.z + g.nz * 0.03)
    fwd.set(g.nx, g.ny, g.nz)
    gr.lookAt(gr.position.x + fwd.x, gr.position.y + fwd.y, gr.position.z + fwd.z)
    const rim = new Mesh(rimGeo, mats.glossBlack)
    rim.scale.z = 0.5
    const ringMat = new MeshBasicMaterial({ color: palette.seamDim.clone(), toneMapped: false })
    const ring = new Mesh(ringGeo, ringMat)
    ring.position.z = 0.05
    for (let t = 0; t < 4; t++) {
      const tick = new Mesh(tickGeo, ringMat)
      tick.rotation.z = (t * Math.PI) / 2 - 0.09
      tick.position.z = 0.04
      gr.add(tick)
    }
    const throatMat = new MeshBasicMaterial({ color: palette.security.clone(), toneMapped: false, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false })
    const throat = new Mesh(innerGeo, throatMat)
    throat.position.z = -0.02
    const hole = new Mesh(voidGeo, voidMat)
    hole.position.z = -0.03
    hole.userData['noReflect'] = true
    const top = new Mesh(halfGeo, mats.glossBlack)
    const bottom = new Mesh(halfGeo, mats.glossBlack)
    bottom.rotation.z = Math.PI
    top.position.z = bottom.position.z = 0.01
    gr.add(rim, ring, hole, throat, top, bottom)
    root.add(gr)
    return { root: gr, ringMat, throatMat, top, bottom, open: 0, wasOpen: false, seed: i * 7.31 }
  })

  let time = 0
  return {
    update(dt: number, st: GameState, sm: Sim): void {
      time += dt
      const states = gateStates(st)
      const p = playerPos(st)
      const shapes = spawnGates(sm)
      for (let i = 0; i < views.length; i++) {
        const v = views[i] as GateView
        const g = states[i]
        const shape = shapes[i]
        if (!g || !shape) continue
        const isOpen = g.open > 0
        if (isOpen && !v.wasOpen) {
          const d = Math.hypot(shape.mouth.x - p.x, shape.mouth.z - p.z)
          const near = Math.max(0.15, 1 - d / HEAR)
          sound.play('glitch', 0.55 * near)
          sound.play('drone_alert', 0.45 * near)
        }
        v.wasOpen = isOpen
        const target = isOpen ? 1 : 0
        v.open += (target - v.open) * Math.min(1, dt * (isOpen ? OPEN_RATE : CLOSE_RATE))
        if (v.open < 0.002) v.open = 0
        const o = v.open
        // the glitch: a stuttering flicker and a small jitter while it opens / is open
        const n = Math.sin(time * 53 + v.seed) * Math.sin(time * 31.7 + v.seed * 2.1)
        const flick = o > 0.02 ? (n > 0.55 ? 0.15 : 1) : 1
        tmp.copy(palette.seamDim).lerp(palette.security, Math.min(1, o * 1.6))
        v.ringMat.color.copy(tmp).multiplyScalar((0.8 + o * 0.9) * flick)
        v.throatMat.opacity = o * (0.55 + 0.35 * Math.sin(time * 9 + v.seed)) * flick
        const shut = Math.max(0, 1 - o * 1.15)
        v.top.scale.y = shut
        v.bottom.scale.y = shut
        v.top.position.y = (R - 0.01) * (1 - shut)
        v.bottom.position.y = -(R - 0.01) * (1 - shut)
        v.top.visible = v.bottom.visible = shut > 0.01
        const jitter = o > 0.02 && n > 0.7 ? 0.03 : 0
        v.root.position.set(shape.mouth.x + shape.nx * 0.03 + jitter, shape.mouth.y + shape.ny * 0.03, shape.mouth.z + shape.nz * 0.03 - jitter)
      }
    },
  }
}
