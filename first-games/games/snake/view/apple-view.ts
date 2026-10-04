// The apple is a single neon wireframe cube (edges only, hollow inside), pulsing in size and brightness (it does not rotate). Time comes from
// the deterministic elapsedMs(s) (the core is the source of truth for time), not
// from a separate counter inside the view.

import { MeshBasicMaterial, Mesh, MathUtils, type Scene } from 'three'
import type { GameState } from '../core/state'
import { applePos, elapsedMs } from '../core/queries'
import { beamGeometry, circleSegments, cornerOnZ, cubeEdgeSegments, stellaOctangulaSegments } from './outline'
import type { AppleSkin } from './cosmetics'
import { APPLE_COLOR, APPLE_GLOW_BOOST, APPLE_EMISSIVE_PULSE_MIN, APPLE_EMISSIVE_PULSE_MAX } from './palette'

const APPLE_SCALE = 0.72
const APPLE_BEAM = 0.11
const APPLE_SCALE_PULSE = 0.1
// Apple skins (shop). All have a footprint at least that of the diamond cube: the apple must read at any distance.
// Orb: three great circles, radius 15% larger than the cube half-size (diameter 0.83 cell, fits in a cell).
const ORB_RADIUS = (APPLE_SCALE / 2) * 1.15
const ORB_SEGMENTS = 20
// Star: two tetrahedra in the same cube (half-size APPLE_SCALE / 2), turned corner-first toward the camera: the circumscribed sphere is the same as the cube's.
// The pulse period is a styling constant (game feel), not a balance value.
const PULSE_PERIOD_MS = 700

/** Wireframe segments per apple skin (diamond is the earlier cube frame). */
export function appleSegments(skin: AppleSkin): number[] {
  switch (skin) {
    case 'orb':
      return [...circleSegments(ORB_RADIUS, ORB_SEGMENTS, 0), ...circleSegments(ORB_RADIUS, ORB_SEGMENTS, 1), ...circleSegments(ORB_RADIUS, ORB_SEGMENTS, 2)]
    case 'star':
      return cornerOnZ(stellaOctangulaSegments(APPLE_SCALE / 2))
    default:
      return cubeEdgeSegments(APPLE_SCALE / 2)
  }
}

export class AppleView {
  private scene: Scene
  private mesh: Mesh
  private material: MeshBasicMaterial

  constructor(scene: Scene, skin: AppleSkin = 'diamond') {
    this.scene = scene
    const geometry = beamGeometry(appleSegments(skin), APPLE_BEAM)
    this.material = new MeshBasicMaterial({ color: APPLE_COLOR.clone(), fog: false }) // outside fog: the apple is visible at any distance
    this.mesh = new Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  /** Frame: no new objects, mutates the position/scale/color of the existing mesh. */
  /** The apple color does not depend on aiming: the "apple on course" signal comes from the head (SnakeView). */
  update(s: GameState): void {
    const apple = applePos(s)
    this.mesh.position.set(apple.x, apple.y, apple.z)
    const phase = ((elapsedMs(s) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS) * Math.PI * 2
    const wave = 0.5 - 0.5 * Math.cos(phase)
    const intensity = MathUtils.lerp(APPLE_EMISSIVE_PULSE_MIN, APPLE_EMISSIVE_PULSE_MAX, wave)
    this.material.color.copy(APPLE_COLOR).multiplyScalar(intensity * APPLE_GLOW_BOOST)
    const scale = 1 + APPLE_SCALE_PULSE * wave
    this.mesh.scale.setScalar(scale)
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
