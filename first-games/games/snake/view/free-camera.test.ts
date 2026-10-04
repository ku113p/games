import { describe, expect, test } from 'bun:test'
import configJson from '../config.json'
import { FREE_KEYS } from './free-camera'
import { readFileSync } from 'node:fs'
import {
  cameraPosition,
  createFreePose,
  dollyBy,
  flyBy,
  focusOn,
  isFreeCameraRequested,
  orbitBy,
  resetPose,
  viewDirection,
  type FreeCameraConfig,
  type Vec3,
} from './free-camera-math'

const cfg = (configJson.camera as unknown as { free: FreeCameraConfig }).free
const v = (): Vec3 => ({ x: 0, y: 0, z: 0 })
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

function fresh(size = 20) {
  const p = createFreePose()
  resetPose(p, size, cfg)
  return p
}

describe('the URL switch', () => {
  test('only ?camera=free turns it on', () => {
    expect(isFreeCameraRequested('?camera=free')).toBe(true)
    expect(isFreeCameraRequested('?perf=bench&camera=free')).toBe(true)
    for (const q of ['', '?camera', '?camera=', '?camera=off', '?camera=Free', '?perf', '?cam=free']) expect(isFreeCameraRequested(q)).toBe(false)
  })
})

describe('start pose', () => {
  test('targets the cube center and sits at size * factor, looking at it', () => {
    const p = fresh(20)
    expect([p.tx, p.ty, p.tz]).toEqual([9.5, 9.5, 9.5])
    const pos = v()
    cameraPosition(p, pos)
    expect(dist(pos, { x: p.tx, y: p.ty, z: p.tz })).toBeCloseTo(20 * cfg.startDistanceFactor, 9)
    expect(pos.y).toBeGreaterThan(p.ty) // above, with a positive start pitch
  })

  test('the view direction points from the camera to the target', () => {
    const p = fresh(20)
    p.yaw = 1.1
    p.pitch = -0.4
    const pos = v()
    const d = v()
    cameraPosition(p, pos)
    viewDirection(p, d)
    expect(pos.x + d.x * p.dist).toBeCloseTo(p.tx, 9)
    expect(pos.y + d.y * p.dist).toBeCloseTo(p.ty, 9)
    expect(pos.z + d.z * p.dist).toBeCloseTo(p.tz, 9)
  })
})

describe('orbit', () => {
  test('keeps the distance to the target and the target itself', () => {
    const p = fresh()
    const before = p.dist
    orbitBy(p, 137, -52, cfg)
    const pos = v()
    cameraPosition(p, pos)
    expect(dist(pos, { x: p.tx, y: p.ty, z: p.tz })).toBeCloseTo(before, 9)
    expect(p.tx).toBe(9.5)
  })

  test('a drag of dx pixels turns yaw by dx * orbitRadPerPx, in the direction opposite the hand', () => {
    const p = fresh()
    const y0 = p.yaw
    orbitBy(p, 100, 0, cfg)
    expect(p.yaw).toBeCloseTo(y0 - 100 * cfg.orbitRadPerPx, 12)
  })

  test('pitch is clamped short of the poles, both ways', () => {
    const p = fresh()
    orbitBy(p, 0, 1e6, cfg)
    expect(p.pitch).toBeCloseTo((cfg.pitchLimitDeg * Math.PI) / 180, 12)
    orbitBy(p, 0, -1e7, cfg)
    expect(p.pitch).toBeCloseTo((-cfg.pitchLimitDeg * Math.PI) / 180, 12)
  })
})

describe('dolly', () => {
  test('a notch up brings the camera closer, a notch down takes it farther, and they cancel', () => {
    const p = fresh()
    const d0 = p.dist
    dollyBy(p, -100, cfg)
    expect(p.dist).toBeCloseTo(d0 / (1 + cfg.wheelStep), 9)
    dollyBy(p, 100, cfg)
    expect(p.dist).toBeCloseTo(d0, 9)
  })

  test('stays within the distance limits', () => {
    const p = fresh()
    dollyBy(p, -1e9, cfg)
    expect(p.dist).toBe(cfg.minDistance)
    dollyBy(p, 1e9, cfg)
    expect(p.dist).toBe(cfg.maxDistance)
  })
})

describe('fly', () => {
  test('no keys - no movement', () => {
    const p = fresh()
    flyBy(p, 0, 0, 0, 1000, cfg)
    expect([p.tx, p.ty, p.tz]).toEqual([9.5, 9.5, 9.5])
  })

  test('forward for one second moves flySpeed cells along the view direction, camera and target together', () => {
    const p = fresh()
    const pos0 = v()
    const pos1 = v()
    const d = v()
    cameraPosition(p, pos0)
    viewDirection(p, d)
    flyBy(p, 1, 0, 0, 1000, cfg)
    cameraPosition(p, pos1)
    expect(pos1.x - pos0.x).toBeCloseTo(d.x * cfg.flySpeed, 9)
    expect(pos1.y - pos0.y).toBeCloseTo(d.y * cfg.flySpeed, 9)
    expect(pos1.z - pos0.z).toBeCloseTo(d.z * cfg.flySpeed, 9)
    expect(p.dist).toBe(fresh().dist)
  })

  test('right is horizontal and perpendicular to the view direction; up is world up', () => {
    const p = fresh()
    p.yaw = 0.7
    p.pitch = 0.5
    const d = v()
    viewDirection(p, d)
    const [x, y, z] = [p.tx, p.ty, p.tz]
    flyBy(p, 0, 1, 0, 1000, cfg)
    const mx = p.tx - x
    const my = p.ty - y
    const mz = p.tz - z
    expect(my).toBeCloseTo(0, 12)
    expect(mx * d.x + my * d.y + mz * d.z).toBeCloseTo(0, 9)
    expect(Math.hypot(mx, mz)).toBeCloseTo(cfg.flySpeed, 9)
    // for yaw 0 the camera looks along -z, and its right is +x
    const q = fresh()
    q.yaw = 0
    const x0 = q.tx
    flyBy(q, 0, 1, 0, 1000, cfg)
    expect(q.tx - x0).toBeCloseTo(cfg.flySpeed, 9)
    const y0 = q.ty
    flyBy(q, 0, 0, 1, 1000, cfg)
    expect(q.ty - y0).toBeCloseTo(cfg.flySpeed, 9)
  })

  test('a diagonal is no faster than a straight line, and the step scales with dt', () => {
    const p = fresh()
    const [x, y, z] = [p.tx, p.ty, p.tz]
    flyBy(p, 0, 1, 1, 500, cfg) // right and up are perpendicular
    expect(Math.hypot(p.tx - x, p.ty - y, p.tz - z)).toBeCloseTo(cfg.flySpeed * 0.5, 9)
  })
})

describe('focus', () => {
  test('moves the target, keeps the direction and the distance', () => {
    const p = fresh()
    const [yaw, pitch, d] = [p.yaw, p.pitch, p.dist]
    focusOn(p, 3, 4, 5)
    expect([p.tx, p.ty, p.tz, p.yaw, p.pitch, p.dist]).toEqual([3, 4, 5, yaw, pitch, d])
  })
})

describe('keys stay clear of the gameplay keys', () => {
  // view/ may not import input/ (layer linter), so the gameplay keys are listed here AND checked against the input sources as text:
  // if someone binds a new key there that clashes, the second test names it.
  const gameplay = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'KeyR', 'Backquote']
  const mine = Object.values(FREE_KEYS)

  test('the free-camera keys are unique and not in the gameplay list', () => {
    expect(new Set(mine).size).toBe(mine.length)
    for (const k of mine) expect(gameplay).not.toContain(k)
  })

  test('none of them appears as a key code in the input layer or in main.ts', () => {
    const src = ['../input/keyboard.ts', '../input/gestures.ts', '../input/index.ts', '../main.ts', './perf-panel.ts']
      .map((f) => readFileSync(`${import.meta.dir}/${f}`, 'utf8'))
      .join('\n')
    for (const k of mine) expect(src.includes(`'${k}'`) || src.includes(`${k}:`)).toBe(false)
  })
})
