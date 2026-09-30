import { describe, expect, test } from 'bun:test'
import { Mesh, Scene, ShaderMaterial } from 'three'
import config from '../config.json'
import { createGame, type Config } from '../core/rules'
import type { GameState } from '../core/state'
import { ObstaclesView } from './obstacles-view'

// The ordering rule these tests pin: "a thing in front hides a thing behind it". The obstacle shell writes depth (opaque
// faces AND opaque edges); only the pieces of cubes that are fading out (uGhostPass = 1) are transparent. The stars of the lattice and
// the near-cell arrows are transparent and write no depth, so they can only be hidden by, and hide, what is in the depth buffer:
// edges that were transparent (drawn after everything, unaware of them) painted far edges over stars and arrows.

function build(first: boolean): { scene: Scene; meshes: Mesh[]; state: GameState } {
  const state = createGame(config as unknown as Config, 20, 20240607, first)
  const scene = new Scene()
  const view = new ObstaclesView(scene)
  view.rebuild(state)
  const meshes = scene.children.filter((c): c is Mesh => c instanceof Mesh)
  return { scene, meshes, state }
}

const pass = (m: Mesh): number => (m.material as ShaderMaterial).uniforms['uGhostPass']!.value as number

describe('obstacle draw order', () => {
  const { meshes } = build(false)

  test('there are obstacles to check', () => {
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.length % 4).toBe(0) // per chunk: opaque edges, transparent edges, opaque faces, transparent faces
  })

  test('every solid piece (edges and faces) is opaque and writes depth', () => {
    const solid = meshes.filter((m) => pass(m) === 0)
    expect(solid.length).toBe(meshes.length / 2)
    for (const m of solid) {
      const mat = m.material as ShaderMaterial
      expect(mat.transparent).toBe(false)
      expect(mat.depthWrite).toBe(true)
      expect(mat.depthTest).toBe(true)
    }
  })

  test('only the pieces of fading cubes are transparent, and they write no depth', () => {
    const ghost = meshes.filter((m) => pass(m) === 1)
    expect(ghost.length).toBe(meshes.length / 2)
    for (const m of ghost) {
      const mat = m.material as ShaderMaterial
      expect(mat.transparent).toBe(true)
      expect(mat.depthWrite).toBe(false)
      expect(mat.depthTest).toBe(true)
    }
  })

  test('the edges of solid cubes are never in the transparent list', () => {
    // An edge material that is transparent while solid is exactly the old bug.
    const edgeMats = new Set(meshes.filter((m) => (m.material as ShaderMaterial).uniforms['uEdgeGhostAlpha'] !== undefined).map((m) => m.material as ShaderMaterial))
    expect(edgeMats.size).toBe(2)
    for (const mat of edgeMats) expect(mat.transparent).toBe(mat.uniforms['uGhostPass']!.value === 1)
  })
})

describe('obstacle draw order in the flat opening', () => {
  test('the layer shell (faces and edges) is opaque and writes depth', () => {
    const { meshes, state } = build(true)
    expect(state.mode).toBe('plane')
    const flat = meshes.filter((m) => pass(m) === 0)
    expect(flat.length).toBeGreaterThan(0)
    for (const m of flat) {
      const mat = m.material as ShaderMaterial
      expect(mat.transparent).toBe(false)
      expect(mat.depthWrite).toBe(true)
    }
  })
})
