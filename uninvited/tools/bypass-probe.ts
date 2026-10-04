// Tries to get past every closed red wall in the real physics: from every surface the player can stand on within a few
// cells of the wall (core/reach.ts, only this wall closed) it runs at the wall, jumps and dashes at several angles, and reports
// every attempt that ends on the far side of the wall plane.
//   bun tools/bypass-probe.ts [slice|l1]
import { createRapierWorld, initPhysics } from '../adapters/physics-rapier'
import cfgJson from '../config.json'
import { beginFrame, createIntent, dash, jump, tick } from '../core/commands'
import type { GameConfig } from '../core/config'
import { buildGrid, colOf, rowOf } from '../core/grid'
import { reachable, reachLimits } from '../core/reach'
import { createSim, createState } from '../core/state'
import { levelById } from '../levels/index'

const cfg: GameConfig = cfgJson
const level = levelById(process.argv[2] ?? 'l1')
await initPhysics()
const grid = buildGrid(level, cfg.world)
const physics = createRapierWorld(grid, { radius: cfg.player.radius, ...cfgJson.physics })
const sim = createSim(level, cfg, physics, grid)
const lim = reachLimits(cfg.player, cfgJson.physics.autostep, grid.cell)
const DT = 1 / 60
let bad = 0
let tried = 0
for (let w = 0; w < sim.grid.wallGroups.length; w++) {
  const wall = createState(sim, 1).walls[w]
  if (!wall) continue
  const side = (x: number, z: number): number => (wall.alongX ? x : z) - wall.coord
  const lineOf = (x: number, z: number): number => (wall.alongX ? z : x)
  const closed = reachable(grid, lim, grid.wallGroups.map((_, k) => k !== w))
  const spots = closed.surfaces.filter((s) => {
    const x = (colOf(grid, s.cell) + 0.5) * grid.cell
    const z = (rowOf(grid, s.cell) + 0.5) * grid.cell
    return Math.abs(side(x, z)) < 7 && lineOf(x, z) > wall.min - 7 && lineOf(x, z) < wall.max + 7
  })
  let found = 0
  for (const sp of spots) {
    const cx = (colOf(grid, sp.cell) + 0.5) * grid.cell
    const cz = (rowOf(grid, sp.cell) + 0.5) * grid.cell
    for (const [ox, oz] of [[0, 0], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]] as const) {
      const sx = cx + ox
      const sz = cz + oz
      if (Math.abs(side(sx, sz)) < 0.5) continue
      for (let a = 0; a < 8; a++) {
        for (const mode of [0, 1, 2]) {
          const s = createState(sim, 1)
          s.player.pos.x = sx
          s.player.pos.y = sp.h + 0.05
          s.player.pos.z = sz
          const sign = Math.sign(side(sx, sz))
          // aim at the wall's line point, with a spread of angles
          const nx = wall.alongX ? -sign : 0
          const nz = wall.alongX ? 0 : -sign
          const ang = ((a - 3.5) * Math.PI) / 6
          const yaw = Math.atan2(nx * Math.cos(ang) - nz * Math.sin(ang), nz * Math.cos(ang) + nx * Math.sin(ang))
          const it = createIntent()
          it.lookYaw = yaw
          it.moveForward = 1
          it.run = true
          let crossed = false
          for (let f = 0; f < 150; f++) {
            beginFrame(sim)
            const px = s.player.pos.x
            const pz = s.player.pos.z
            if (mode >= 1 && f % 20 === 5) jump(s, sim)
            if (mode === 2 && f % 20 === 12) dash(s, sim, Math.sin(yaw), Math.cos(yaw))
            tick(s, sim, DT, it)
            const l = lineOf(s.player.pos.x, s.player.pos.z)
            if (Math.sign(side(px, pz)) === sign && Math.sign(side(s.player.pos.x, s.player.pos.z)) !== sign && Math.hypot(s.player.pos.x - px, s.player.pos.z - pz) < 1 && s.player.pos.y > -2 && l > wall.min - 1 && l < wall.max + 1) crossed = true
          }
          tried++
          if (crossed) {
            found++
            bad++
            if (found <= 5) console.log(`wall ${w}: crossed from cell [${colOf(grid, sp.cell)}, ${rowOf(grid, sp.cell)}] h=${sp.h.toFixed(2)} off ${ox},${oz} angle ${a} mode ${mode} -> ${s.player.pos.x.toFixed(1)}, ${s.player.pos.y.toFixed(1)}, ${s.player.pos.z.toFixed(1)}`)
          }
        }
      }
    }
  }
  console.log(`wall ${w}: ${spots.length} standing cells, ${found} crossings`)
}
console.log(`${level.id}: ${tried} attempts, ${bad} got through`)
physics.dispose()
process.exit(bad > 0 ? 1 : 0)
