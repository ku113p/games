import { describe, expect, test } from 'bun:test'
import { buyUpgrade, interact, useAbility } from './commands'
import type { EntityDef } from './level'
import { abilitySlot, hackTimeRange, mayPoints, type AbilitySlot } from './queries'
import { hurtPlayer } from './rules/combat'
import { maxCharges, pauseLengthSec, shieldWaitSec, UPGRADE_IDS } from './rules/may'
import { unlockTerminal } from './rules/terminals'
import { applyLoadedState, parseSave, serializeState } from './save'
import { createSim, createState, type GameState } from './state'
import { FakeWorld } from './fake-world'
import { angleDiff } from './util'
import { placePlayer, run, setup, testConfig, testLevel, type Fixture } from './testing'

const HALL = [
  '##############', //
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#.S......C.A.#',
  '##############',
]
const CPS = [
  '##############', //
  '#.S.C.C.C...A#',
  '##############',
]

function give(f: Fixture, points: number): void {
  f.s.may.points = points
}

function buy(f: Fixture, id: string): boolean {
  const before = f.s.may.ranks[id] ?? 0
  buyUpgrade(f.s, f.sim, id)
  return (f.s.may.ranks[id] ?? 0) > before
}

/** The yaw and pitch that point the rifle's muzzle at a world point. */
function aimAt(f: Fixture, x: number, y: number, z: number): { yaw: number; pitch: number } {
  const p = f.s.player.pos
  const yaw0 = Math.atan2(x - p.x, z - p.z)
  const ox = p.x + Math.sin(yaw0) * 0.4
  const oz = p.z + Math.cos(yaw0) * 0.4
  const oy = p.y + f.sim.cfg.combat.rifle.muzzleHeight
  return { yaw: Math.atan2(x - ox, z - oz), pitch: Math.atan2(y - oy, Math.hypot(x - ox, z - oz)) }
}

describe('May points', () => {
  test('every checkpoint passed pays the configured points, once', () => {
    const f = setup(CPS)
    expect(mayPoints(f.s)).toBe(0)
    for (const col of [4, 6, 8]) {
      placePlayer(f, col, 1)
      run(f, 0.1)
    }
    expect(f.s.run.checkpointsPassed).toBe(3)
    expect(mayPoints(f.s)).toBe(3 * f.sim.cfg.progression.pointsPerCheckpoint)
    placePlayer(f, 4, 1)
    run(f, 0.1)
    expect(mayPoints(f.s)).toBe(3) // passed already
  })

  test('the tree costs more than a full run pays (3 levels x 3 checkpoints): about 60-70% of it', () => {
    const f = setup(HALL)
    let total = 0
    for (const id of UPGRADE_IDS) for (const c of f.sim.cfg.progression.items[id]?.costs ?? []) total += c
    const earned = 9 * f.sim.cfg.progression.pointsPerCheckpoint
    expect(earned / total).toBeGreaterThan(0.55)
    expect(earned / total).toBeLessThan(0.75)
  })
})

describe('buying upgrades', () => {
  test('costs points, one rank at a time, and stops at the top', () => {
    const f = setup(HALL)
    give(f, 10)
    expect(buy(f, 'hackTime')).toBe(true)
    expect(f.s.may.points).toBe(9)
    expect(buy(f, 'hackTime')).toBe(true)
    expect(buy(f, 'hackTime')).toBe(true)
    expect(buy(f, 'hackTime')).toBe(false) // max rank
    expect(f.s.may.ranks['hackTime']).toBe(3)
    expect(f.s.may.points).toBe(7)
  })

  test('too few points buys nothing', () => {
    const f = setup(HALL)
    give(f, 1)
    expect(buy(f, 'pause')).toBe(false) // costs 2
    expect(f.s.may.points).toBe(1)
    expect(f.s.may.ranks['pause']).toBeUndefined()
  })

  test('an upgrade that needs another one is locked until it is owned', () => {
    const f = setup(HALL)
    give(f, 10)
    expect(buy(f, 'pauseTime')).toBe(false)
    expect(buy(f, 'pause')).toBe(true)
    expect(buy(f, 'pauseTime')).toBe(true)
  })

  test('an unknown id buys nothing', () => {
    const f = setup(HALL)
    give(f, 10)
    expect(buy(f, 'nonsense')).toBe(false)
    expect(f.s.may.points).toBe(10)
  })

  test('the first active (the distraction signal) is free at the T0 meeting', () => {
    const f = setup(['##########', '#T.S.....#', '#.......A#', '##########'], [{ kind: 'terminal', id: 't', at: [1, 1], targets: [], difficulty: 0, meetsMay: true }])
    expect(f.s.may.ranks['distract']).toBeUndefined()
    unlockTerminal(f.s, f.sim, 0)
    expect(f.s.mayMet).toBe(true)
    expect(f.s.may.ranks['distract']).toBe(1)
    expect(f.s.may.points).toBe(0)
  })

  test('a level that starts with May has the distraction signal from the start', () => {
    const level = { ...testLevel(HALL), mayFromStart: true }
    const sim = createSim(level, testConfig(), new FakeWorld())
    expect(createState(sim, 1).may.ranks['distract']).toBe(1)
  })
})

describe('passives', () => {
  test('rifle charges: the maximum and the charges themselves go up', () => {
    const f = setup(HALL)
    const base = f.sim.cfg.combat.rifle.charges
    expect(maxCharges(f.s, f.sim)).toBe(base)
    give(f, 5)
    f.s.player.charges = 0
    buy(f, 'charges')
    const per = f.sim.cfg.progression.chargesPerRank
    expect(maxCharges(f.s, f.sim)).toBe(base + per)
    expect(f.s.player.charges).toBe(per)
  })

  test('hack time: every rank adds seconds to the hack, and the HUD range says so', () => {
    const f = setup(['##########', '#T.S....A#', '##########'], [{ kind: 'terminal', id: 't', at: [1, 1], targets: [], difficulty: 0 }])
    const range = { min: 0, max: 0 }
    hackTimeRange(f.s, f.sim, range)
    const baseMin = range.min
    placePlayer(f, 1, 1)
    interact(f.s, f.sim)
    expect(f.s.hack?.session.timeTotal).toBeCloseTo(baseMin, 5)
    const g = setup(['##########', '#T.S....A#', '##########'], [{ kind: 'terminal', id: 't', at: [1, 1], targets: [], difficulty: 0 }])
    give(g, 5)
    buy(g, 'hackTime')
    buy(g, 'hackTime')
    hackTimeRange(g.s, g.sim, range)
    expect(range.min).toBeCloseTo(baseMin + 2 * g.sim.cfg.progression.hackTimeSec, 5)
    placePlayer(g, 1, 1)
    interact(g.s, g.sim)
    expect(g.s.hack?.session.timeTotal).toBeCloseTo(baseMin + 8, 5)
  })

  test('the shield takes one hit whole, then comes back after its recharge time; a checkpoint puts it back at once', () => {
    const f = setup(HALL)
    give(f, 5)
    buy(f, 'shield')
    expect(shieldWaitSec(f.s)).toBe(0)
    const hp = f.s.player.hp
    expect(hurtPlayer(f.s, f.sim, 30)).toBe(true)
    expect(f.s.player.hp).toBe(hp)
    expect(f.sim.events.map((e) => e.type)).toContain('shieldAbsorbed')
    expect(shieldWaitSec(f.s)).toBe(30)
    run(f, 1)
    hurtPlayer(f.s, f.sim, 30)
    expect(f.s.player.hp).toBe(hp - 30) // the shield is down
    run(f, 30)
    expect(shieldWaitSec(f.s)).toBe(0)
    f.s.player.invuln = 0
    hurtPlayer(f.s, f.sim, 30)
    expect(f.s.player.hp).toBe(hp - 30) // absorbed again
    expect(shieldWaitSec(f.s)).toBeGreaterThan(0)
    placePlayer(f, 9, 6)
    run(f, 0.1) // the checkpoint
    expect(shieldWaitSec(f.s)).toBe(0)
  })

  test('without the shield a hit hurts', () => {
    const f = setup(HALL)
    const hp = f.s.player.hp
    hurtPlayer(f.s, f.sim, 30)
    expect(f.s.player.hp).toBe(hp - 30)
    expect(shieldWaitSec(f.s)).toBe(-1)
  })
})

describe('distraction signal (key 1)', () => {
  const WARDEN: EntityDef[] = [{ kind: 'warden', id: 'w', at: [12, 3], post: 's' }]

  test('locked until it is owned: nothing happens', () => {
    const f = setup(HALL, WARDEN)
    placePlayer(f, 3, 5)
    useAbility(f.s, f.sim, 0, Math.PI / 2, 0)
    expect(f.sim.events.length).toBe(0)
    expect(f.s.may.cd[0]).toBe(0)
  })

  test('a ward within hearing range of the ping turns to it and goes to check it', () => {
    const f = setup(HALL, WARDEN)
    f.s.may.ranks['distract'] = 1
    placePlayer(f, 5, 5)
    f.s.player.crouched = true
    const w = f.s.wardens[0]
    if (!w) throw new Error('no warden')
    const a = aimAt(f, 22, 1.35, 10)
    useAbility(f.s, f.sim, 0, a.yaw, a.pitch)
    const used = f.sim.events.find((e) => e.type === 'abilityUsed')
    if (!used || used.type !== 'abilityUsed') throw new Error('no ping')
    expect(f.sim.events.map((e) => e.type)).toContain('noise')
    const seen = run(f, 1.2)
    expect(seen).toContain('wardenSuspicious')
    expect(w.mode).toBe('suspicious')
    // it stopped and turned to face the ping, then walks over to check it
    const toPing = Math.atan2(used.x - w.pos.x, used.z - w.pos.z)
    expect(Math.abs(angleDiff(w.yaw, toPing))).toBeLessThan(0.15)
    run(f, 2)
    expect(w.mode).toBe('investigate')
    expect(w.pos.z).toBeGreaterThan(7.3)
    expect(f.s.alarm.stage).toBe(0)
  })

  test('a ward out of earshot of the ping does not move', () => {
    const f = setup(HALL, [{ kind: 'warden', id: 'w', at: [12, 1], post: 's' }])
    f.s.may.ranks['distract'] = 1
    placePlayer(f, 3, 5)
    f.s.player.crouched = true
    const a = aimAt(f, 6, 1.35, 11) // 20 m from the warden
    useAbility(f.s, f.sim, 0, a.yaw, a.pitch)
    expect(run(f, 3)).not.toContain('wardenSuspicious')
    expect(f.s.wardens[0]?.mode).toBe('patrol')
  })

  test('a patrol drone in earshot investigates the ping', () => {
    const f = setup(HALL, [{ kind: 'drone', id: 'd', patrol: [[11, 1], [11, 1]] }])
    f.s.may.ranks['distract'] = 1
    placePlayer(f, 3, 5)
    f.s.player.crouched = true
    const a = aimAt(f, 16, 1.35, 8)
    useAbility(f.s, f.sim, 0, a.yaw, a.pitch)
    run(f, 0.2)
    const d = f.s.drones[0]
    expect(d?.mode).toBe('investigate')
  })

  test('a sound camera does not take the ping for the player', () => {
    const f = setup(HALL, [{ kind: 'soundCamera', id: 'm', at: [10, 1], wall: 'n' }])
    f.s.may.ranks['distract'] = 1
    placePlayer(f, 3, 5)
    f.s.player.crouched = true
    const a = aimAt(f, 21, 1.35, 6)
    useAbility(f.s, f.sim, 0, a.yaw, a.pitch)
    run(f, 1)
    expect(f.s.soundCameras[0]?.suspicion).toBe(0)
    expect(f.s.alarm.stage).toBe(0)
  })

  test('the ping lands on the first wall within range, and the range is 15 m', () => {
    const f = setup(HALL)
    f.s.may.ranks['distract'] = 1
    placePlayer(f, 1, 3)
    f.s.player.crouched = true
    useAbility(f.s, f.sim, 0, Math.PI / 2, 0)
    const e = f.sim.events.find((x) => x.type === 'abilityUsed')
    if (!e || e.type !== 'abilityUsed') throw new Error('no ping')
    const px = f.s.player.pos.x
    expect(e.x - px).toBeCloseTo(f.sim.cfg.progression.distract.range + 0.4, 0) // open floor: the full range from the muzzle
    f.s.may.cd[0] = 0
    f.sim.events.length = 0
    placePlayer(f, 11, 3)
    useAbility(f.s, f.sim, 0, Math.PI / 2, 0)
    const e2 = f.sim.events.find((x) => x.type === 'abilityUsed')
    if (!e2 || e2.type !== 'abilityUsed') throw new Error('no ping')
    expect(e2.x).toBeLessThan(26) // the east wall stops it
    expect(e2.x).toBeGreaterThan(24)
  })

  test('cooldown: a second press fails until it has run down; the cooldown rank shortens it', () => {
    const f = setup(HALL)
    f.s.may.ranks['distract'] = 1
    placePlayer(f, 3, 5)
    useAbility(f.s, f.sim, 0, 1, 0)
    const full = f.sim.cfg.progression.distract.cooldownSec
    expect(f.s.may.cd[0]).toBe(full)
    f.sim.events.length = 0
    useAbility(f.s, f.sim, 0, 1, 0)
    const fail = f.sim.events.find((e) => e.type === 'abilityFailed')
    expect(fail).toMatchObject({ reason: 'cooldown', slot: 0 })
    run(f, full + 0.1)
    expect(f.s.may.cd[0]).toBe(0)
    f.sim.events.length = 0
    useAbility(f.s, f.sim, 0, 1, 0)
    expect(f.sim.events.map((e) => e.type)).toContain('abilityUsed')

    const g = setup(HALL)
    g.s.may.ranks['distract'] = 1
    give(g, 10)
    buy(g, 'cooldown')
    buy(g, 'cooldown')
    useAbility(g.s, g.sim, 0, 1, 0)
    expect(g.s.may.cd[0]).toBeCloseTo(full * g.sim.cfg.progression.cooldownFactor[2]!, 5)
    const slot: AbilitySlot = { unlocked: false, cooldown: 0, cooldownLength: 0 }
    abilitySlot(g.s, g.sim, 0, slot)
    expect(slot.unlocked).toBe(true)
    expect(slot.cooldownLength).toBeCloseTo(full * 0.55, 5)
  })
})

describe('pause a camera (key 2)', () => {
  const CAM: EntityDef[] = [{ kind: 'videoCamera', id: 'c', at: [5, 1], wall: 'n', sweep: [0, 0] }]

  function setupCam(): Fixture {
    const f = setup(HALL, CAM)
    f.s.may.ranks['pause'] = 1
    placePlayer(f, 1, 1)
    f.s.player.crouched = true
    return f
  }

  function aimCam(f: Fixture): { yaw: number; pitch: number } {
    const c = f.s.cameras[0]
    if (!c) throw new Error('no camera')
    return aimAt(f, c.pos.x, c.pos.y, c.pos.z)
  }

  test('aimed at a camera in range: paused for the base seconds, with the shared pause rule and an event', () => {
    const f = setupCam()
    const a = aimCam(f)
    useAbility(f.s, f.sim, 1, a.yaw, a.pitch)
    expect(f.s.cameras[0]?.pausedTime).toBe(f.sim.cfg.progression.pause.baseSec)
    expect(f.sim.events.find((e) => e.type === 'devicePaused')).toMatchObject({ target: 'camera', index: 0, sec: 8 })
    expect(f.s.may.cd[1]).toBe(f.sim.cfg.progression.pause.cooldownSec)
    // it stays blind for its whole pause, then wakes
    f.s.player.crouched = false
    placePlayer(f, 5, 5)
    run(f, 7)
    expect(f.s.cameras[0]?.sees).toBe(false)
    expect(f.s.alarm.stage).toBe(0)
    run(f, 2)
    expect(f.s.cameras[0]?.pausedTime).toBeLessThanOrEqual(0)
  })

  test('the pause-time ranks make it longer; the shown length follows', () => {
    const f = setupCam()
    give(f, 5)
    buy(f, 'pauseTime')
    buy(f, 'pauseTime')
    expect(pauseLengthSec(f.s, f.sim)).toBe(16)
    const a = aimCam(f)
    useAbility(f.s, f.sim, 1, a.yaw, a.pitch)
    expect(f.s.cameras[0]?.pausedTime).toBe(16)
  })

  test('aimed at nothing: it fails and the cooldown is not spent', () => {
    const f = setupCam()
    useAbility(f.s, f.sim, 1, Math.PI, 0)
    expect(f.sim.events.find((e) => e.type === 'abilityFailed')).toMatchObject({ reason: 'noTarget', slot: 1 })
    expect(f.s.may.cd[1]).toBe(0)
  })

  test('out of range or behind a wall: no target', () => {
    const f = setup(HALL, [{ kind: 'videoCamera', id: 'c', at: [12, 1], wall: 'n', sweep: [0, 0] }])
    f.s.may.ranks['pause'] = 1
    placePlayer(f, 1, 5) // 23 m away
    const c = f.s.cameras[0]
    if (!c) throw new Error('no camera')
    const a = aimAt(f, c.pos.x, c.pos.y, c.pos.z)
    useAbility(f.s, f.sim, 1, a.yaw, a.pitch)
    expect(f.s.cameras[0]?.pausedTime).toBe(0)
  })

  test('a patrol drone can be paused too', () => {
    const f = setup(HALL, [{ kind: 'drone', id: 'd', patrol: [[6, 2], [6, 2]] }])
    f.s.may.ranks['pause'] = 1
    placePlayer(f, 1, 2)
    const d = f.s.drones[0]
    if (!d) throw new Error('no drone')
    const a = aimAt(f, d.pos.x, d.pos.y, d.pos.z)
    useAbility(f.s, f.sim, 1, a.yaw, a.pitch)
    expect(d.pausedTime).toBe(8)
  })

  test('locked: key 2 does nothing', () => {
    const f = setupCam()
    f.s.may.ranks['pause'] = 0
    const a = aimCam(f)
    useAbility(f.s, f.sim, 1, a.yaw, a.pitch)
    expect(f.s.cameras[0]?.pausedTime).toBe(0)
  })
})

describe('saving the progression', () => {
  test('points, ranks and cooldowns survive a save and a load', () => {
    const f = setup(HALL)
    give(f, 7)
    buy(f, 'pause')
    buy(f, 'shield')
    f.s.may.ranks['distract'] = 1
    f.s.may.cd[0] = 5
    const loaded = parseSave(serializeState(f.s), f.s.levelId) as GameState
    expect(loaded.may).toEqual(f.s.may)
    applyLoadedState(loaded, f.sim)
    expect(loaded.may.points).toBe(3)
  })

  test('a save from before May has an empty progression', () => {
    const f = setup(HALL)
    const raw = JSON.parse(serializeState(f.s)) as { state: Partial<GameState> }
    delete raw.state.may
    const loaded = parseSave(JSON.stringify(raw), f.s.levelId) as GameState
    expect(loaded.may).toEqual({ points: 0, ranks: {}, cd: [0, 0], shieldWait: 0 })
  })

  test('the next level starts with the carried points and upgrades, and full charges', () => {
    const f = setup(HALL)
    give(f, 6)
    buy(f, 'charges')
    f.s.may.ranks['distract'] = 1
    f.s.may.cd[0] = 9
    const g = createState(f.sim, 2, f.s.may)
    expect(g.may.points).toBe(5)
    expect(g.may.ranks['charges']).toBe(1)
    expect(g.may.cd).toEqual([0, 0])
    expect(g.player.charges).toBe(maxCharges(g, f.sim))
    g.may.points = 0
    expect(f.s.may.points).toBe(5) // a copy
  })
})
