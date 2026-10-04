import { describe, expect, test } from 'bun:test'
import { createUnseen } from '../view/unseen'

const cfg = { dist: 4, coneDeg: 55, holdSec: 0.4, cooldownSec: 10 }

describe('unseen', () => {
  test('fires when a watcher looks toward a hidden player from close by, once per cooldown', () => {
    const u = createUnseen(cfg)
    const w = [{ x: 0, z: 0, yaw: 0 }] // looks along +z
    let fired = 0
    for (let i = 0; i < 20; i++) if (u.step(0.1, true, 0, 3, w)) fired++
    expect(fired).toBe(1)
  })
  test('not when far, not when looking away, not when seen', () => {
    const u = createUnseen(cfg)
    for (let i = 0; i < 20; i++) {
      expect(u.step(0.1, true, 0, 9, [{ x: 0, z: 0, yaw: 0 }])).toBe(false)
      expect(u.step(0.1, true, 0, 3, [{ x: 0, z: 0, yaw: Math.PI }])).toBe(false)
      expect(u.step(0.1, false, 0, 3, [{ x: 0, z: 0, yaw: 0 }])).toBe(false)
    }
  })
})
