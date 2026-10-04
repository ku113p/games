import { describe, expect, test } from 'bun:test'
import { raiseAlarm } from './rules/alarm'
import { heroColor, isSadEnding } from './rules/progress'
import { updateScan } from './rules/scan'
import { applyLoadedState, parseSave, serializeState } from './save'
import { endingCounter, heroAnim, heroLineColor, securityStatus } from './queries'
import { dash, jump, toggleCrouch } from './commands'
import type { EntityDef } from './level'
import { placePlayer, run, setup, testConfig } from './testing'

const PLAN = [
  '##############', //
  '#.....C...D..#',
  '#.S.......D.A#',
  '##############',
]
const ENTITIES: EntityDef[] = [{ kind: 'redWall', id: 'w', at: [10, 1] }]
const RED = { r: 1, g: 0, b: 0 }
const BLUE = { r: 0, g: 0, b: 1 }

describe('checkpoints and the ending counter', () => {
  test('a calm checkpoint is passed once and does not count towards the sad ending', () => {
    const f = setup(PLAN, ENTITIES)
    placePlayer(f, 6, 1)
    expect(run(f, 0.1)).toContain('checkpointReached')
    expect(run(f, 0.1)).not.toContain('checkpointReached')
    expect(f.s.run.checkpointsPassed).toBe(1)
    expect(endingCounter(f.s)).toBe(0)
    expect(f.s.lastCheckpoint).toBe(0)
  })

  function raiseToThree(f: ReturnType<typeof setup>): void {
    for (let i = 0; i < 3; i++) {
      f.s.alarm.cooldown = 0
      raiseAlarm(f.s, f.sim, 'camera', 0, 0, 0)
    }
  }

  test('alarm 3 alone does not make a checkpoint red: an alarm-3 wave fight must have happened in its segment', () => {
    const f = setup(PLAN, ENTITIES)
    raiseToThree(f)
    expect(f.s.alarm.stage).toBe(3)
    placePlayer(f, 6, 1)
    run(f, 0.1) // the first wave is still 5 s away
    expect(endingCounter(f.s)).toBe(0)
    expect(f.s.checkpoints[0]?.underAlarm).toBe(false)
  })

  test('a checkpoint passed after a wave fight is red - at most one red per segment, the next segment starts clean', () => {
    const f = setup(PLAN, ENTITIES)
    raiseToThree(f)
    f.s.alarm.waveTimer = 0
    run(f, 0.2) // the wave starts: the fight is on
    expect(f.s.alarm.segmentFight).toBe(true)
    placePlayer(f, 6, 1)
    run(f, 0.1)
    expect(endingCounter(f.s)).toBe(1)
    expect(f.s.checkpoints[0]?.underAlarm).toBe(true)
    expect(f.s.alarm.segmentFight).toBe(false)
  })

  test('after the firewall drops no more waves come: later checkpoints stay calm although the alarm stays at 3', () => {
    const f = setup(PLAN, ENTITIES)
    raiseToThree(f)
    f.s.alarm.firewallDown = true
    f.s.alarm.waveTimer = 0
    run(f, 1)
    expect(f.s.alarm.waveActive).toBe(false)
    expect(f.s.alarm.wave).toBe(0)
    placePlayer(f, 6, 1)
    run(f, 0.1)
    expect(endingCounter(f.s)).toBe(0)
    expect(f.s.run.calmCheckpoints).toBe(1)
  })

  test('every checkpoint heals fully', () => {
    const f = setup(PLAN, ENTITIES)
    f.s.player.hp = 10
    placePlayer(f, 6, 1)
    run(f, 0.1)
    expect(f.s.player.hp).toBe(f.sim.cfg.player.maxHp)
  })

  test('the sad ending comes at 4 alarm checkpoints of 9', () => {
    const cfg = testConfig().ending
    const runState = { checkpointsPassed: 0, alarmCheckpoints: 3, calmCheckpoints: 0, kills: 0, devicesBroken: 0, alarmsRaised: 0, deaths: 0, timeSec: 0 }
    expect(isSadEnding(runState, cfg)).toBe(false)
    runState.alarmCheckpoints = 4
    expect(isSadEnding(runState, cfg)).toBe(true)
  })

  test('the hero lines start white and shift to red or blue with the counter', () => {
    const f = setup(PLAN, ENTITIES)
    const out = { r: 0, g: 0, b: 0 }
    heroLineColor(f.s, f.sim, RED, BLUE, out)
    expect(out).toEqual({ r: 1, g: 1, b: 1 })
    const cfg = f.sim.cfg.ending
    const r = { ...f.s.run, alarmCheckpoints: 2 }
    heroColor(r, cfg, RED, BLUE, out)
    expect(out.r).toBe(1)
    expect(out.g).toBeCloseTo(0.5)
    r.alarmCheckpoints = cfg.sadAt
    heroColor(r, cfg, RED, BLUE, out)
    expect(out).toEqual(RED)
    const calm = { ...f.s.run, calmCheckpoints: 3 }
    heroColor(calm, cfg, RED, BLUE, out)
    expect(out.b).toBe(1)
    expect(out.r).toBeLessThan(1)
  })
})

describe('network vision', () => {
  test('hold to scan; release starts a short cooldown', () => {
    const f = setup(PLAN, ENTITIES)
    updateScan(f.s, f.sim, 0.1, true)
    expect(f.s.scan.active).toBe(true)
    updateScan(f.s, f.sim, 0.1, false)
    expect(f.s.scan.active).toBe(false)
    updateScan(f.s, f.sim, 0.1, true)
    expect(f.s.scan.active).toBe(false) // cooling down
    for (let t = 0; t < 2; t += 0.1) updateScan(f.s, f.sim, 0.1, false)
    updateScan(f.s, f.sim, 0.1, true)
    expect(f.s.scan.active).toBe(true)
  })

  test('held too long it calls the security', () => {
    const f = setup(PLAN, ENTITIES)
    for (let t = 0; t < 6; t += 0.1) updateScan(f.s, f.sim, 0.1, true)
    const types = f.sim.events.map((e) => e.type)
    expect(types).toContain('scanOverheating')
    expect(types).toContain('scanOverheated')
    expect(f.s.alarm.stage).toBe(1)
    expect(f.s.scan.active).toBe(false)
    updateScan(f.s, f.sim, 10, true) // still holding: must release first
    expect(f.s.scan.active).toBe(false)
  })
})

describe('saves', () => {
  test('a save restores the state and the world', () => {
    const f = setup(PLAN, ENTITIES)
    placePlayer(f, 6, 1)
    run(f, 0.1)
    f.s.walls[0] && (f.s.walls[0].open = true)
    const json = serializeState(f.s)
    const g = setup(PLAN, ENTITIES)
    const loaded = parseSave(json, g.s.levelId)
    expect(loaded).not.toBeNull()
    if (!loaded) return
    applyLoadedState(loaded, g.sim)
    expect(loaded.run.checkpointsPassed).toBe(1)
    expect(loaded.player.pos.x).toBeCloseTo(f.s.player.pos.x)
    expect(g.world.boxes.some((b) => b.blocker === 0 && b.solid)).toBe(false)
  })

  test('a broken or foreign save is ignored', () => {
    expect(parseSave('{nope', 'test')).toBeNull()
    expect(parseSave(null, 'test')).toBeNull()
    const f = setup(PLAN, ENTITIES)
    expect(parseSave(serializeState(f.s), 'another')).toBeNull()
  })
})

describe('queries', () => {
  test('the hero animation follows what the player does', () => {
    const f = setup(PLAN, ENTITIES)
    expect(heroAnim(f.s, f.sim)).toBe('idle')
    f.intent.moveForward = 1
    f.intent.lookYaw = Math.PI / 2
    run(f, 0.5)
    expect(heroAnim(f.s, f.sim)).toBe('walk')
    f.intent.run = true
    run(f, 0.5)
    expect(heroAnim(f.s, f.sim)).toBe('run')
    f.intent.run = false
    toggleCrouch(f.s, f.sim)
    run(f, 0.1)
    expect(heroAnim(f.s, f.sim)).toBe('crouch')
    toggleCrouch(f.s, f.sim)
    jump(f.s, f.sim)
    run(f, 0.1)
    expect(heroAnim(f.s, f.sim)).toBe('jump')
    run(f, 1)
    dash(f.s, f.sim, 1, 0)
    run(f, 0.05)
    expect(heroAnim(f.s, f.sim)).toBe('dash')
  })

  test('the security status reads hidden, suspected, detected', () => {
    const f = setup(PLAN, ENTITIES)
    expect(securityStatus(f.s)).toBe('hidden')
  })
})
