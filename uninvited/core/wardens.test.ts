import { describe, expect, test } from 'bun:test'
import { attack, toggleCrouch } from './commands'
import { buildGrid } from './grid'
import type { EntityDef } from './level'
import { raiseAlarm } from './rules/alarm'
import { damageTarget } from './rules/combat'
import { makeNoise } from './rules/detection'
import { unlockTerminal } from './rules/terminals'
import { findPath } from './rules/walk'
import { wardenLook } from './rules/wardens'
import { securityStatus, suspicionSources, wardenAnim, type SuspicionSource } from './queries'
import { placePlayer, run, setup, testLevel, type Fixture } from './testing'

const HALL = [
  '##############', //
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#.S........A.#',
  '##############',
]

/** Puts the player far away in a corner, out of sight and earshot. */
function park(f: Fixture): void {
  placePlayer(f, 12, 6)
  toggleCrouch(f.s, f.sim)
}

describe('wardens on their round', () => {
  test('walk the route, stand at a stop for about its waitSec, and keep going round', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [2, 1], route: [{ at: [2, 1] }, { at: [10, 1], waitSec: 3, look: 'n' }] }])
    park(f)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    let reached = -1
    let leftAt = -1
    let maxX = 0
    run(f, 40, 1 / 60, () => {
      maxX = Math.max(maxX, w.pos.x)
      if (reached < 0 && w.pos.x > 20.5 && w.act !== 'walk') reached = f.s.time
      if (reached >= 0 && leftAt < 0 && w.act === 'walk') leftAt = f.s.time
    })
    expect(maxX).toBeGreaterThan(20.5)
    expect(reached).toBeGreaterThan(0)
    // it stood a while (waitSec 3 +- 30 %), turned to look north, then walked on
    expect(leftAt - reached).toBeGreaterThan(1.9)
    expect(leftAt - reached).toBeLessThan(4.1)
    expect(w.mode).toBe('patrol')
    expect(f.s.alarm.stage).toBe(0)
  })

  test('walks around a wall to its next stop', () => {
    const plan = [
      '############', //
      '#S.......#.#', // the player waits walled off in the pocket on the right
      '######...###',
      '#A.......####',
      '############',
    ].map((r) => r.slice(0, 12))
    const f = setup(plan, [{ kind: 'warden', id: 'w', at: [1, 1], route: [{ at: [1, 1] }, { at: [1, 3], waitSec: 2 }] }])
    placePlayer(f, 10, 1)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    let deepest = 0
    run(f, 20, 1 / 60, () => {
      deepest = Math.max(deepest, w.pos.z)
    })
    expect(w.mode).toBe('patrol')
    expect(deepest).toBeGreaterThan(6.5) // reached row 3
    // never inside the wall row
    const pts = new Float32Array(32)
    const n = findPath(f.sim.walk, 3, 3, 3, 7, pts)
    expect(n).toBeGreaterThan(1)
  })

  test('a post: it stands, looks around now and then, never wanders off', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 2], post: 's' }])
    park(f)
    f.s.player.pos.x = 3
    f.s.player.pos.z = 1 // behind it
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    const acts = new Set<string>()
    let maxHead = 0
    run(f, 40, 1 / 60, () => {
      acts.add(w.act)
      maxHead = Math.max(maxHead, Math.abs(w.head))
    })
    expect(Math.hypot(w.pos.x - 13, w.pos.z - 5)).toBeLessThan(0.3)
    expect(acts.has('scan')).toBe(true)
    expect(maxHead).toBeGreaterThan(0.5)
  })
})

describe('wardens notice, check and give up', () => {
  test('a noise: it stops and turns (suspicious), walks over, searches, then returns to its round', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [2, 1], post: 's' }])
    placePlayer(f, 10, 5)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    makeNoise(f.s, f.sim, 24) // e.g. a rifle shot far from it
    const seen = run(f, 0.1)
    expect(seen).toContain('wardenSuspicious')
    expect(w.mode).toBe('suspicious')
    expect(wardenAnim(f.s, 0)).toBe('suspicious')
    // hide the player right away (crouch in the far corner) so it only checks the place
    f.s.player.pos.x = 3
    f.s.player.pos.z = 13
    toggleCrouch(f.s, f.sim)
    run(f, 2)
    expect(w.mode).toBe('investigate')
    let closest = 99
    const later = run(f, 40, 1 / 60, () => {
      closest = Math.min(closest, Math.hypot(w.pos.x - 21, w.pos.z - 11))
    })
    expect(closest).toBeLessThan(1.5) // walked to where the noise was
    expect(later).toContain('wardenGaveUp')
    expect(w.mode).toBe('patrol') // back at its post
    expect(Math.hypot(w.pos.x - 5, w.pos.z - 3)).toBeLessThan(0.5)
    expect(f.s.alarm.stage).toBe(0)
  })

  test('seeing you standing in its cone: suspicious, then alert - it calls the alarm, shoots from range and strikes up close', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 1], post: 's' }])
    placePlayer(f, 6, 4)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    const seen = run(f, 3)
    expect(seen).toContain('wardenSuspicious')
    expect(seen).toContain('wardenAlerted')
    expect(f.s.alarm.stage).toBeGreaterThanOrEqual(1)
    expect(securityStatus(f.s)).toBe('detected')
    // from range it shoots (holds its distance); close up (about 3 m) it switches to melee
    const shots = run(f, 4)
    expect(shots).toContain('wardenAiming')
    expect(shots).toContain('wardenFired')
    expect(shots).not.toContain('wardenStrike')
    f.s.player.invuln = 0
    placePlayer(f, 6, 2)
    const fight = run(f, 6)
    expect(fight).toContain('wardenStrike')
    expect(fight).toContain('wardenStruck')
    expect(f.s.player.hp).toBeLessThan(f.sim.cfg.player.maxHp)
  })

  test('crouched behind a server block you are hidden; standing, your head shows over it', () => {
    const block: EntityDef = { kind: 'cover', at: [6, 4], size: [3, 0.6, 1.4], offset: [0, -0.6] }
    const f = setup(HALL, [block, { kind: 'warden', id: 'w', at: [6, 1], post: 's' }])
    placePlayer(f, 6, 4)
    f.s.player.pos.z += 0.3
    toggleCrouch(f.s, f.sim)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    run(f, 3, 1 / 60, () => {
      w.yaw = 0 // keep it looking straight at the block
      w.head = 0
    })
    expect(w.sees).toBe(false)
    expect(w.mode).toBe('patrol')
    toggleCrouch(f.s, f.sim)
    run(f, 1 / 60)
    expect(w.sees).toBe(true)
  })

  test('crouching right under its visor does not hide you', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 1], post: 's' }])
    placePlayer(f, 6, 1)
    f.s.player.pos.z += 1.1
    toggleCrouch(f.s, f.sim)
    run(f, 0.2)
    expect(f.s.wardens[0]?.sees).toBe(true)
  })

  test('out of its cone you can walk right up behind it; three sword hits take it down', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 4], post: 's' }])
    placePlayer(f, 6, 1)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    // walk up behind it (north of it, it faces south)
    f.intent.moveForward = 1
    f.intent.lookYaw = 0
    run(f, 1.6)
    f.intent.moveForward = 0
    expect(w.mode).toBe('patrol')
    expect(Math.hypot(f.s.player.pos.x - w.pos.x, f.s.player.pos.z - w.pos.z)).toBeLessThan(3)
    f.sim.cfg.combat.sword.damage = 80 // the game's sword
    let hits = 0
    for (let k = 0; k < 6 && w.alive; k++) {
      attack(f.s, f.sim, Math.atan2(w.pos.x - f.s.player.pos.x, w.pos.z - f.s.player.pos.z), 0)
      hits++
      run(f, 0.5)
    }
    expect(w.alive).toBe(false)
    expect(hits).toBe(3)
  })

  test('about eight rifle hits take it down', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 4], post: 's' }])
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    let shots = 0
    while (w.alive && shots < 20) {
      damageTarget(f.s, f.sim, 'warden', 0, 20, true)
      shots++
    }
    expect(shots).toBe(8)
  })

  test('a terminal pauses it: it sees nothing while paused', () => {
    const plan = HALL.map((r, i) => (i === 6 ? '#T.........A.#' : r)).map((r, i) => (i === 1 ? '#S...........#' : r))
    const f = setup(plan, [
      { kind: 'warden', id: 'w', at: [6, 1], post: 's' },
      { kind: 'terminal', id: 't', at: [1, 6], targets: ['w'], difficulty: 0 },
    ])
    expect(f.sim.terminalLinks[0]?.wardens).toEqual([0])
    expect(f.s.links.some((l) => l.kind === 'warden')).toBe(true)
    unlockTerminal(f.s, f.sim, 0)
    placePlayer(f, 6, 4)
    run(f, 3)
    expect(f.s.wardens[0]?.sees).toBe(false)
    expect(f.s.alarm.stage).toBe(0)
    expect(wardenAnim(f.s, 0)).toBe('paused')
  })

  test('alarm 1 sends it to search the alarm area; when the alarm is over it goes back', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [2, 1], post: 'e' }])
    park(f)
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    raiseAlarm(f.s, f.sim, 'camera', 12, 0, 5)
    run(f, 0.1)
    expect(w.mode).toBe('search')
    run(f, 25)
    expect(f.s.alarm.stage).toBe(0)
    run(f, 20)
    expect(w.mode).toBe('patrol')
  })

  test('the take-over hook: a controlled warden sees nothing', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 1], post: 's' }])
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    w.controlled = true
    placePlayer(f, 6, 3)
    run(f, 3)
    expect(w.sees).toBe(false)
    expect(f.s.alarm.stage).toBe(0)
    expect(w.id).toBe('w')
  })

  test('deterministic: the same seed walks the same round', () => {
    const route: EntityDef = { kind: 'warden', id: 'w', at: [2, 1], route: [{ at: [2, 1] }, { at: [10, 1] }, { at: [10, 4], waitSec: 2 }, { at: [3, 4] }] }
    const trace = (seed: number): string => {
      const f = setup(HALL, [route], undefined, seed)
      park(f)
      const out: string[] = []
      run(f, 30, 1 / 60, () => {
        const w = f.s.wardens[0]
        if (w && Math.round(f.s.time * 60) % 60 === 0) out.push(`${w.pos.x.toFixed(3)},${w.pos.z.toFixed(3)},${wardenLook(w).toFixed(3)}`)
      })
      return out.join(';')
    }
    expect(trace(5)).toBe(trace(5))
    expect(trace(5)).not.toBe(trace(6)) // the pauses vary with the seed
  })
})

describe('wardens on the HUD', () => {
  test('a warden noticing you is a suspicion source at its position, red once it fights; a calm one is not', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [6, 1], post: 's' }])
    const out: SuspicionSource[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, level: 0, spotted: false }))
    placePlayer(f, 1, 1) // beside it, out of its cone
    run(f, 0.5)
    expect(suspicionSources(f.s, out)).toBe(0)
    placePlayer(f, 6, 5)
    run(f, 0.3)
    expect(suspicionSources(f.s, out)).toBe(1)
    expect(out[0]?.x).toBeCloseTo(f.s.wardens[0]?.pos.x ?? -1)
    expect(out[0]?.spotted).toBe(false)
    run(f, 3)
    expect(f.s.wardens[0]?.mode).toBe('alert')
    expect(suspicionSources(f.s, out)).toBe(1)
    expect(out[0]?.level).toBe(1)
    expect(out[0]?.spotted).toBe(true)
  })
})

describe('the warden level format', () => {
  test('rejects a warden in a wall, and a stop it cannot walk to', () => {
    expect(() => buildGrid(testLevel(HALL, [{ kind: 'warden', id: 'w', at: [0, 0] }]))).toThrow(/warden w/)
    const cut = ['#######', '#S.#..#', '#..#.A#', '#######']
    expect(() => setup(cut, [{ kind: 'warden', id: 'w', at: [1, 1], route: [{ at: [1, 1] }, { at: [4, 1] }] }])).toThrow(/cannot walk/)
  })
})
