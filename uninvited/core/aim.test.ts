// What you aim at is what counts: the camera sits behind and beside the hero, the muzzle does not, and a flyer in front
// of a far wall must still be hit when the crosshair is on it (the aim point is the bat, not the wall behind it).
import { describe, expect, test } from 'bun:test'
import { attack, setAim } from './commands'
import { pickTarget } from './queries'
import { placeMonster, placePlayer, run, setup, testConfig, type Fixture } from './testing'

const ROW = '#' + 'S' + '.'.repeat(59) + '#'
const HALL = ['#'.repeat(62), ROW, ...Array.from({ length: 4 }, () => '#' + '.'.repeat(60) + '#'), '#'.repeat(62)]
const SHOULDER = 0.8 // the camera is this far to the hero's right
const BEHIND = 3.2
const UP = 0.5

/** What the view does: the camera ray through the crosshair, the aim point, then the muzzle's yaw and pitch toward it. */
function aimLikeView(f: Fixture, camDirX: number, camDirY: number, camDirZ: number, toWall: number): { yaw: number; pitch: number } {
  const p = f.s.player.pos
  const my = p.y + f.sim.cfg.gun.muzzleHeight
  // the hero looks along +x here; the camera is behind (-x) and to the right (+z)
  const cx = p.x - BEHIND
  const cy = my + UP
  const cz = p.z + SHOULDER
  const t = pickTarget(f.s, f.sim, cx, cy, cz, camDirX, camDirY, camDirZ, toWall)
  const d = t >= 0 ? t : toWall
  const dx = cx + camDirX * d - p.x
  const dy = cy + camDirY * d - my
  const dz = cz + camDirZ * d - p.z
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }
}

function shootDrone(dist: number, usePick: boolean, dz = 0, dy = 0): boolean {
  const cfg = testConfig()
  cfg.gun.aimAssistDeg = 0 // the assist would hide the parallax
  cfg.gun.aimSpreadDeg = 0
  const f = setup(HALL, [], cfg)
  placePlayer(f, 2, 3)
  setAim(f.s, f.sim, true)
  run(f, 0.3)
  f.s.gun.loaded = 12
  const p = f.s.player.pos
  const d = placeMonster(f, 'bat', p.x + dist, p.z + dz, 3.5 + dy)
  // the crosshair on the bat's centre
  const cx = p.x - BEHIND
  const cy = p.y + cfg.gun.muzzleHeight + UP
  const cz = p.z + SHOULDER
  let ux = d.pos.x - cx
  let uy = (d.pos.y + f.sim.cfg.horde.kinds.bat.height) - cy
  let uz = d.pos.z - cz
  const l = Math.hypot(ux, uy, uz)
  ux /= l
  uy /= l
  uz /= l
  const toWall = (f.sim.grid.cols * f.sim.grid.cell - cx) / ux // the far wall behind the bat
  const a = usePick ? aimLikeView(f, ux, uy, uz, toWall) : aimLikeView({ ...f, s: { ...f.s, monsters: [] } } as Fixture, ux, uy, uz, toWall)
  attack(f.s, f.sim, a.yaw, a.pitch)
  return f.sim.events.some((e) => e.type === 'targetHit' && e.target === 'monster')
}

describe('the crosshair on a flyer hits it', () => {
  test('from 5 to 38 m, with the aim point on the bat', () => {
    for (const dist of [5, 10, 15, 20, 28, 38]) expect(shootDrone(dist, true)).toBe(true)
  })

  test('the old way (aim at the wall behind it) misses at range: the cause of "the shot flies past"', () => {
    const misses = [10, 20, 28, 38].filter((dist) => !shootDrone(dist, false)).length
    expect(misses).toBeGreaterThan(0)
  })

  test('a flyer off to the side, or bobbing high and low, is hit where it is drawn', () => {
    for (const dist of [8, 18, 30]) {
      expect(shootDrone(dist, true, 2.5, 0.07)).toBe(true)
      expect(shootDrone(dist, true, -2.5, -0.07)).toBe(true)
    }
  })
})
