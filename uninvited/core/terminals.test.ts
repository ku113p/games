import { describe, expect, test } from 'bun:test'
import { cancelHack, hackPick, interact } from './commands'
import { solveHack } from './hack/index'
import type { EntityDef } from './level'
import { interactPrompt } from './queries'
import { placePlayer, run, setup, type Fixture } from './testing'

const PLAN = [
  '##############', //
  '#T...=.......#',
  '#....=...D...#',
  '#.S..=...D.A.#',
  '##############',
]
const ENTITIES: EntityDef[] = [
  { kind: 'laser', id: 'l', at: [5, 2] },
  { kind: 'redWall', id: 'w', at: [9, 2] },
  { kind: 'terminal', id: 't', at: [1, 1], targets: ['w', 'l'], difficulty: 0 },
]

function atTerminal(): Fixture {
  const f = setup(PLAN, ENTITIES)
  placePlayer(f, 1, 1)
  return f
}

function solve(f: Fixture): void {
  const session = f.s.hack?.session
  if (!session) throw new Error('no session')
  const cells = solveHack(session) ?? []
  for (const cell of cells) hackPick(f.s, f.sim, Math.floor(cell / session.size), cell % session.size)
}

describe('hack terminals', () => {
  test('E next to a terminal starts the hacking mini-game and the player stands still', () => {
    const f = atTerminal()
    expect(interactPrompt(f.s, f.sim)).toBe('terminal')
    interact(f.s, f.sim)
    expect(f.s.hack).not.toBeNull()
    expect(f.sim.events.map((e) => e.type)).toContain('hackStarted')
    const x = f.s.player.pos.x
    f.intent.moveForward = 1
    f.intent.lookYaw = Math.PI / 2
    run(f, 1)
    expect(f.s.player.pos.x).toBeCloseTo(x)
    expect(interactPrompt(f.s, f.sim)).toBe('none')
  })

  test('far from a terminal E does nothing', () => {
    const f = setup(PLAN, ENTITIES)
    placePlayer(f, 7, 3)
    interact(f.s, f.sim)
    expect(f.s.hack).toBeNull()
  })

  test('solving opens its red wall for good and pauses its laser', () => {
    const f = atTerminal()
    interact(f.s, f.sim)
    solve(f)
    const types = f.sim.events.map((e) => e.type)
    expect(types).toContain('hackSolved')
    expect(types).toContain('wallOpened')
    expect(f.s.hack).toBeNull()
    expect(f.s.walls[0]?.open).toBe(true)
    expect(f.world.boxes.some((b) => b.blocker === 0 && b.solid)).toBe(false)
    expect(f.s.lasers[0]?.pausedTime).toBe(f.sim.cfg.terminal.pauseSec)
    expect(f.s.terminals[0]?.done).toBe(true)
    expect(interactPrompt(f.s, f.sim)).toBe('none')
  })

  test('running out of time raises the alarm one stage and closes the session; it can be hacked again', () => {
    const f = atTerminal()
    interact(f.s, f.sim)
    let timedOut = false
    for (let t = 0; t < 300 && !timedOut; t += 1 / 20) timedOut = run(f, 1 / 20, 1 / 20).includes('hackTimedOut')
    expect(timedOut).toBe(true)
    expect(f.s.hack).toBeNull()
    expect(f.s.alarm.stage).toBeGreaterThanOrEqual(1)
    expect(f.s.walls[0]?.open).toBe(false)
    f.s.phase = 'playing'
    placePlayer(f, 1, 1)
    interact(f.s, f.sim)
    expect(f.s.hack).not.toBeNull()
  })

  test('cancelling walks away without consequences', () => {
    const f = atTerminal()
    interact(f.s, f.sim)
    cancelHack(f.s, f.sim)
    expect(f.s.hack).toBeNull()
    expect(f.s.alarm.stage).toBe(0)
    expect(f.sim.events.map((e) => e.type)).toContain('hackCancelled')
  })

  test('a terminal that only pauses things can be used again once the pause is over', () => {
    const f = setup(PLAN, [ENTITIES[0] as EntityDef, ENTITIES[1] as EntityDef, { kind: 'terminal', id: 't', at: [1, 1], targets: ['l'], difficulty: 0 }])
    placePlayer(f, 1, 1)
    interact(f.s, f.sim)
    solve(f)
    expect(f.s.terminals[0]?.done).toBe(false)
    expect(interactPrompt(f.s, f.sim)).toBe('none')
    run(f, f.sim.cfg.terminal.pauseSec + 0.5, 1 / 20)
    expect(interactPrompt(f.s, f.sim)).toBe('terminal')
  })

  test('E at the artifact takes it and wins the level', () => {
    const f = setup(PLAN, ENTITIES)
    placePlayer(f, 11, 3)
    expect(interactPrompt(f.s, f.sim)).toBe('artifact')
    interact(f.s, f.sim)
    expect(f.s.phase).toBe('won')
    expect(f.sim.events.map((e) => e.type)).toContain('artifactTaken')
  })
})
