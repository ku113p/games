import { describe, expect, test } from 'bun:test'
import { attack, tick } from './commands'
import type { GameEvent } from './events'
import type { EntityDef } from './level'
import { raiseAlarm } from './rules/alarm'
import { damageTarget } from './rules/combat'
import { biteTokens, meleeTokens, rangedTokens } from './rules/tokens'
import type { DroneState, WardenState, WormState } from './state'
import { placePlayer, run, setup, testConfig, type Fixture } from './testing'

const BIG = [
  '########################',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#.S..................A.#',
  '########################',
]
const GATES: EntityDef[] = [
  { kind: 'spawn', at: [21, 1], wall: 'n' },
  { kind: 'spawn', at: [1, 1], wall: 'w' },
  { kind: 'spawn', at: [21, 10], wall: 's' },
  { kind: 'spawn', at: [11, 10], wall: 's' },
]

function wormAt(f: Fixture, i: number, x: number, z: number): WormState {
  const w = f.s.worms[i] as WormState
  w.active = true
  w.alive = true
  w.role = 'wave'
  w.mode = 'hunt'
  w.hp = f.sim.cfg.worm.hp
  w.pos.x = x
  w.pos.y = 0
  w.pos.z = z
  w.spawnTime = 0
  w.timer = 0
  w.pace = 1
  return w
}

/** Ticks for `seconds`, calling `after` once per tick with that tick's events. */
function watch(f: Fixture, seconds: number, after: (events: readonly GameEvent[]) => void): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    f.sim.events.length = 0
    tick(f.s, f.sim, 1 / 60, f.intent)
    after(f.sim.events)
  }
}

function centre(f: Fixture): { x: number; z: number } {
  return { x: f.s.player.pos.x, z: f.s.player.pos.z }
}

describe('attack tokens', () => {
  test('at most 3 worm bites at once; the others wait on the ring (2.5-4.5 m) and take over when a token comes back', () => {
    const f = setup(BIG)
    placePlayer(f, 11, 5)
    f.s.player.hp = 100000
    const c = centre(f)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      wormAt(f, i, c.x + Math.sin(a) * 6.5, c.z + Math.cos(a) * 6.5)
    }
    let most = 0
    let held = 0
    const bitten = new Set<number>()
    const ringDists: number[] = []
    watch(f, 6, (events) => {
      const biting = f.s.worms.filter((w) => w.active && w.alive && (w.mode === 'windup' || w.mode === 'recover')).length
      most = Math.max(most, biting)
      held = Math.max(held, biteTokens(f.s))
      for (const e of events) if (e.type === 'wormBite') bitten.add(e.index)
      if (f.s.time > 1.5 && f.s.time < 1.55) {
        for (const w of f.s.worms) if (w.active && w.alive && !w.token && w.mode === 'hunt') ringDists.push(Math.hypot(w.pos.x - c.x, w.pos.z - c.z))
      }
    })
    expect(most).toBeLessThanOrEqual(f.sim.cfg.tokens.bite)
    expect(most).toBeGreaterThanOrEqual(2)
    expect(held).toBeLessThanOrEqual(f.sim.cfg.tokens.bite)
    expect(ringDists.length).toBeGreaterThan(0)
    for (const d of ringDists) {
      expect(d).toBeGreaterThan(1.9)
      expect(d).toBeLessThan(5.5)
    }
    // the tokens went round: more than 3 different worms got to bite
    expect(bitten.size).toBeGreaterThan(3)
  })

  test('deterministic: the same start gives the same bites', () => {
    const trace = (): string => {
      const f = setup(BIG, [], testConfig(), 5)
      placePlayer(f, 11, 5)
      f.s.player.hp = 100000
      const c = centre(f)
      for (let i = 0; i < 8; i++) wormAt(f, i, c.x + Math.sin(i) * 5, c.z + Math.cos(i) * 5)
      const out: string[] = []
      watch(f, 4, (events) => {
        for (const e of events) if (e.type === 'wormBite') out.push(`${f.s.time.toFixed(2)}:${e.index}`)
      })
      return out.join(',')
    }
    expect(trace()).toBe(trace())
  })

  test('one warden melee strike at a time, and at most 2 ranged shots (wardens and drones together)', () => {
    const cfg = testConfig()
    cfg.warden.shotFirstSec = 0.1
    cfg.warden.shotIntervalSec = 0.5
    cfg.drone.fireWindupSec = 0.1
    cfg.drone.fireIntervalSec = 0.5
    const ents: EntityDef[] = [
      { kind: 'warden', id: 'w1', at: [10, 4] },
      { kind: 'warden', id: 'w2', at: [12, 4] },
      { kind: 'warden', id: 'w3', at: [14, 2] },
      { kind: 'warden', id: 'w4', at: [8, 2] },
      { kind: 'drone', id: 'd1', patrol: [[9, 6], [9, 6]] },
      { kind: 'drone', id: 'd2', patrol: [[13, 6], [13, 6]] },
    ]
    const f = setup(BIG, ents, cfg)
    placePlayer(f, 11, 5)
    f.s.player.hp = 100000
    for (const w of f.s.wardens) w.mode = 'patrol'
    for (const d of f.s.drones) d.yaw = 0
    // everybody spots the player
    for (let i = 0; i < f.s.wardens.length; i++) {
      const w = f.s.wardens[i] as WardenState
      w.mode = 'alert'
      w.suspicion = 1
      w.fireCooldown = 0.1
    }
    for (const d of f.s.drones) {
      d.mode = 'alert'
      d.suspicion = 1
    }
    let melee = 0
    let ranged = 0
    let shots = 0
    let strikes = 0
    watch(f, 8, (events) => {
      melee = Math.max(melee, f.s.wardens.filter((w) => w.alive && w.strike > 0).length)
      ranged = Math.max(ranged, f.s.wardens.filter((w) => w.alive && w.aim > 0).length + f.s.drones.filter((d) => d.active && d.alive && d.aim > 0).length)
      expect(meleeTokens(f.s)).toBeLessThanOrEqual(1)
      expect(rangedTokens(f.s)).toBeLessThanOrEqual(2)
      for (const e of events) {
        if (e.type === 'wardenFired' || e.type === 'droneFired') shots++
        if (e.type === 'wardenStrike') strikes++
      }
    })
    expect(melee).toBeLessThanOrEqual(1)
    expect(ranged).toBeLessThanOrEqual(2)
    expect(ranged).toBeGreaterThanOrEqual(1)
    expect(shots).toBeGreaterThan(2)
    expect(strikes).toBeGreaterThanOrEqual(0)
  })

  test('a warden at about 3 m switches to melee; further out it shoots', () => {
    const f = setup(BIG, [{ kind: 'warden', id: 'w', at: [11, 2] }])
    placePlayer(f, 11, 5)
    f.s.player.hp = 100000
    const w = f.s.wardens[0] as WardenState
    w.mode = 'alert'
    w.suspicion = 1
    const first: string[] = run(f, 4)
    expect(first).toContain('wardenFired')
    if (first.includes('wardenStrike')) expect(first.indexOf('wardenFired')).toBeLessThan(first.indexOf('wardenStrike')) // it shoots first, then steps in
    w.pos.x = f.s.player.pos.x
    w.pos.z = f.s.player.pos.z - 2.6
    w.yaw = 0
    expect(run(f, 3)).toContain('wardenStrike')
  })
})

describe('signal shards', () => {
  test('a killed worm drops a shard; walking close pulls it in and heals; far away it fades', () => {
    const f = setup(BIG)
    placePlayer(f, 11, 5)
    f.s.player.hp = 50
    f.s.player.mode = 'sword'
    const w = wormAt(f, 0, f.s.player.pos.x, f.s.player.pos.z + 1.2)
    w.hp = 1
    damageTarget(f.s, f.sim, 'worm', 0, 100, false)
    const shard = f.s.shards.find((s) => s.active)
    expect(shard).toBeDefined()
    expect(f.sim.events.some((e) => e.type === 'shardDropped')).toBe(true)
    const seen = run(f, 1)
    expect(seen).toContain('shardTaken')
    expect(f.s.player.hp).toBe(50 + f.sim.cfg.shards.heal)
    expect(f.s.shards.some((s) => s.active)).toBe(false)
    // out of reach: gone after its life
    wormAt(f, 1, f.s.player.pos.x + 6, f.s.player.pos.z)
    damageTarget(f.s, f.sim, 'worm', 1, 100, false)
    expect(f.s.shards.some((s) => s.active)).toBe(true)
    run(f, f.sim.cfg.shards.lifeSec + 0.5)
    expect(f.s.shards.some((s) => s.active)).toBe(false)
    expect(f.s.player.hp).toBe(50 + f.sim.cfg.shards.heal)
  })

  test('a sword finisher that kills two or more drops a big shard', () => {
    const f = setup(BIG)
    placePlayer(f, 11, 5)
    f.s.player.hp = 20
    const p = f.s.player
    wormAt(f, 0, p.pos.x, p.pos.z + 1.5)
    wormAt(f, 1, p.pos.x + 1, p.pos.z + 1)
    p.combo = 1
    p.comboTime = 0
    attack(f.s, f.sim, 0, 0)
    expect(p.combo).toBe(2)
    expect(f.s.run.kills).toBe(2)
    expect(f.s.shards.some((s) => s.active && s.big)).toBe(true)
    run(f, 1.5)
    expect(p.hp).toBeGreaterThanOrEqual(20 + f.sim.cfg.shards.bigHeal)
  })

  test('healing never goes over the maximum', () => {
    const f = setup(BIG)
    placePlayer(f, 11, 5)
    f.s.player.hp = f.sim.cfg.player.maxHp - 1
    wormAt(f, 0, f.s.player.pos.x, f.s.player.pos.z + 1)
    damageTarget(f.s, f.sim, 'worm', 0, 100, false)
    run(f, 1)
    expect(f.s.player.hp).toBe(f.sim.cfg.player.maxHp)
  })
})

describe('the heavy warden', () => {
  function heavyFixture(): { f: Fixture; w: WardenState } {
    const f = setup(BIG, [{ kind: 'warden', id: 'h', at: [11, 2], heavy: true }])
    placePlayer(f, 11, 6)
    const w = f.s.wardens[0] as WardenState
    w.yaw = 0 // facing the player (+z)
    return { f, w }
  }

  test('it has more hit points and is slower', () => {
    const { f, w } = heavyFixture()
    expect(w.heavy).toBe(true)
    expect(w.hp).toBe(f.sim.cfg.warden.heavy.hp)
    expect(f.sim.cfg.warden.heavy.speedFactor).toBeLessThan(1)
  })

  test('its shield stops rifle bolts from the front; the sword and shots from behind get through', () => {
    const { f, w } = heavyFixture()
    const hp = w.hp
    damageTarget(f.s, f.sim, 'warden', 0, 20, true)
    expect(w.hp).toBe(hp)
    expect(f.sim.events.some((e) => e.type === 'shieldBlocked')).toBe(true)
    damageTarget(f.s, f.sim, 'warden', 0, 80, false) // the sword
    expect(w.hp).toBe(hp - 80)
    w.yaw = Math.PI // turned away: the player is behind it
    const before = w.hp
    damageTarget(f.s, f.sim, 'warden', 0, 20, true)
    expect(w.hp).toBeLessThan(before)
  })

  test('an ordinary warden has no shield', () => {
    const f = setup(BIG, [{ kind: 'warden', id: 'w', at: [11, 2] }])
    placePlayer(f, 11, 6)
    const w = f.s.wardens[0] as WardenState
    const hp = w.hp
    damageTarget(f.s, f.sim, 'warden', 0, 20, true)
    expect(w.hp).toBeLessThan(hp)
  })
})

describe('big waves', () => {
  function bigWave(): Fixture {
    const cfg = testConfig()
    cfg.alarm.waves = [{ packs: [4, 3], drones: 1, wardens: 1, heavy: 1 }]
    cfg.alarm.waveWardenSlots = 3
    cfg.alarm.minSpawnDist = 4
    cfg.alarm.searchers = [0, 0, 0, 0]
    cfg.worm.max = 24
    const f = setup(BIG, GATES, cfg)
    placePlayer(f, 11, 5)
    f.s.player.hp = 100000
    for (let i = 0; i < 3; i++) {
      f.s.alarm.cooldown = 0
      raiseAlarm(f.s, f.sim, 'camera', 0, 0, 0)
    }
    return f
  }

  test('a wave brings worm packs, a spotter drone, a warden and a heavy warden out of the gates', () => {
    const f = bigWave()
    const seen: GameEvent[] = []
    watch(f, 8, (events) => {
      seen.push(...events)
    })
    const started = seen.find((e) => e.type === 'waveStarted')
    expect(started).toBeDefined()
    if (started?.type === 'waveStarted') {
      expect(started.count).toBe(1)
      expect(started.worms).toBe(7)
      expect(started.wardens).toBe(2)
    }
    const out = seen.filter((e) => e.type === 'wardenSpawned')
    expect(out.length).toBe(2)
    expect(out.filter((e) => e.type === 'wardenSpawned' && e.heavy).length).toBe(1)
    const heavy = f.s.wardens.find((w) => w.wave && w.alive && w.heavy)
    expect(heavy?.hp).toBe(f.sim.cfg.warden.heavy.hp)
    expect(f.s.alarm.segmentFight).toBe(true)
  })

  test('the wave is over only when its wardens are dead too; then the breather and the next wave (the last one repeats)', () => {
    const f = bigWave()
    run(f, 8)
    expect(f.s.alarm.waveActive).toBe(true)
    for (let i = 0; i < f.s.worms.length; i++) damageTarget(f.s, f.sim, 'worm', i, 1000, false)
    for (let i = 0; i < f.s.drones.length; i++) if (f.s.drones[i]?.active) damageTarget(f.s, f.sim, 'drone', i, 1000, false)
    run(f, 0.2)
    expect(f.s.alarm.waveActive).toBe(true) // the wardens still fight
    for (let i = 0; i < f.s.wardens.length; i++) if (f.s.wardens[i]?.alive) damageTarget(f.s, f.sim, 'warden', i, 1000, false)
    const after = run(f, 0.2)
    expect(after).toContain('waveCleared')
    expect(f.s.alarm.waveActive).toBe(false)
    expect(run(f, f.sim.cfg.alarm.waveGapSec + 1)).toContain('waveStarted')
  })

  test('no wave starts once the firewall is down', () => {
    const f = bigWave()
    f.s.alarm.firewallDown = true
    expect(run(f, 12)).not.toContain('waveStarted')
  })
})

describe('drones are a rifle job', () => {
  test('a hovering drone is out of the standing sword swing, but not out of the rifle; a low drone can be cut', () => {
    const cfg = testConfig()
    cfg.drone.hover = 3.5
    cfg.drone.hp = 40
    cfg.combat.sword.reachUp = 2.2
    const f = setup(BIG, [{ kind: 'drone', id: 'd', patrol: [[11, 4], [11, 4]] }], cfg)
    placePlayer(f, 11, 5)
    const d = f.s.drones[0] as DroneState
    expect(d.pos.y).toBeCloseTo(3.5, 1)
    f.s.player.pos.y = 0
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(false)
    // even in a jump
    f.s.player.pos.y = 1.2
    f.s.player.attackCooldown = 0
    attack(f.s, f.sim, Math.PI, 0)
    expect(f.sim.events.some((e) => e.type === 'targetHit')).toBe(false)
    // the rifle: two shots kill it
    f.s.player.pos.y = 0
    f.s.player.attackCooldown = 0
    f.s.player.mode = 'rifle'
    d.pos.y = 3.5
    damageTarget(f.s, f.sim, 'drone', 0, cfg.combat.rifle.damage, true)
    expect(d.alive).toBe(true)
    damageTarget(f.s, f.sim, 'drone', 0, cfg.combat.rifle.damage, true)
    expect(d.alive).toBe(false)
    // a drone that has come low (a spawn exit, a stagger) is in reach of the sword
    const g = setup(BIG, [{ kind: 'drone', id: 'd', patrol: [[11, 4], [11, 4]] }], cfg)
    placePlayer(g, 11, 5)
    const low = g.s.drones[0] as DroneState
    low.pos.y = 1.5
    attack(g.s, g.sim, Math.PI, 0)
    expect(g.sim.events.some((e) => e.type === 'targetHit')).toBe(true)
    void tick
  })
})
