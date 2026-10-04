import { buildGrid } from '../../core/grid'
import { l1 } from '../../levels/l1'
import cfgJson from '../../config.json'
import { createSight } from '../../view/sight'
const g = buildGrid(l1, cfgJson.world)
const s = createSight(g)
const out = new Uint8Array(48 * 4)
for (const [name, range, spread] of [['camera', cfgJson.videoCamera.range, 0.7], ['drone', cfgJson.drone.range, 0.7], ['warden', cfgJson.warden.range, 0.7]] as const) {
  const N = 300
  for (let i = 0; i < 50; i++) s.probe(out, 20 + (i % 7), 2.5, 24 + (i % 5), i * 0.3, spread, range)
  const t = performance.now()
  for (let i = 0; i < N; i++) s.probe(out, 20 + (i % 7), 2.5, 24 + (i % 5), i * 0.3, spread, range)
  console.log(name, 'range', range, 'ms per fan', ((performance.now() - t) / N).toFixed(3))
}
