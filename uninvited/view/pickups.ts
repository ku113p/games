// Signal shards (DESIGN 9): the small glowing pickups killed enemies drop. One instanced mesh, built once; updating
// never allocates. They spin and bob, and blink for the last second and a half of their life.
import { Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, OctahedronGeometry, type Scene } from 'three'
import { gameTime, shards } from '../core/queries'
import type { GameState } from '../core/state'
import { palette } from './look'

const BLINK_SEC = 1.5
const SMALL = 0.13
const BIG = 0.24

export interface Pickups {
  update(s: GameState): void
}

export function createPickups(scene: Scene, s: GameState): Pickups {
  const n = s.shards.length
  const mesh = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n)
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.userData['noReflect'] = true
  scene.add(mesh)
  const dummy = new Object3D()
  const small = palette.checkpoint.clone().multiplyScalar(1.2)
  const big = palette.artifact.clone().multiplyScalar(1.4)
  const color = new Color()
  // the instance colors need their buffer created once, before the first frame
  for (let i = 0; i < n; i++) mesh.setColorAt(i, color.setRGB(0, 0, 0))
  return {
    update(st): void {
      const t = gameTime(st)
      const list = shards(st)
      for (let i = 0; i < n; i++) {
        const sh = list[i]
        if (!sh || !sh.active) {
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
          continue
        }
        const blink = sh.life < BLINK_SEC ? 0.35 + 0.65 * Math.abs(Math.sin(t * 18)) : 1
        const size = (sh.big ? BIG : SMALL) * (0.85 + 0.15 * Math.sin(t * 5 + i))
        dummy.position.set(sh.pos.x, sh.pos.y + Math.sin(t * 3 + i * 1.7) * 0.06, sh.pos.z)
        dummy.rotation.set(0.4, t * 2.4 + i, 0)
        dummy.scale.set(size, size * 1.5, size)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, color.copy(sh.big ? big : small).multiplyScalar(blink))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
  }
}
