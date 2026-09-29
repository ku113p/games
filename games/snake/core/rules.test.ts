import { describe, expect, test } from 'bun:test'
import { cellKey, type Vec3 } from './state'
import {
  arenaHasObstacles,
  createGame,
  fillDeadZones,
  generateObstacles,
  isInWallMargin,
  rotateFrame,
  spawnApple,
  speedAfterApples,
} from './rules'
import { config, makeRng, makeState, reachability, v } from './test-helpers'

function adjacentPairs(size: number, obstacles: Set<number>): number {
  let pairs = 0
  for (const k of obstacles) {
    const x = k % size
    const y = Math.floor(k / size) % size
    const z = Math.floor(k / (size * size))
    if (x + 1 < size && obstacles.has(cellKey(x + 1, y, z, size))) pairs++
    if (y + 1 < size && obstacles.has(cellKey(x, y + 1, z, size))) pairs++
    if (z + 1 < size && obstacles.has(cellKey(x, y, z + 1, size))) pairs++
  }
  return pairs
}

function centerClear(size: number, radius: number): Set<number> {
  const mid = Math.floor(size / 2)
  const clear = new Set<number>()
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dz = -radius; dz <= radius; dz++) clear.add(cellKey(mid + dx, mid + dy, mid + dz, size))
  return clear
}

describe('createGame', () => {
  test('builds a ready game with the configured snake, speed and initial counters', () => {
    const s = createGame(config, 20, 1, false)
    expect(s.phase).toBe('ready')
    expect(s.snake.length).toBe(config.snake.startLength)
    expect(s.stepMs).toBe(config.speed.startStepMs)
    expect(s.snakeCells.size).toBe(config.snake.startLength)
    expect(s.heading).toEqual(v(1, 0, 0))
    expect(s.snake[0]).toEqual(v(10, 10, 10))
    expect(s.snake[2]).toEqual(v(8, 10, 10))
    expect(s.stepCount).toBe(0)
    expect(s.rolledSinceStep).toBe(false)
    expect(s.pendingTurn).toBeNull()
  })

  test('first game ever: starts in plane with the demo pending and the default frame', () => {
    const s = createGame(config, 20, 1, true)
    expect(s.mode).toBe('plane')
    expect(s.demoTurnPending).toBe(true)
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) })
  })

  test('not the first game: starts straight in free, demo switched off', () => {
    const s = createGame(config, 20, 1, false)
    expect(s.mode).toBe('free')
    expect(s.demoTurnPending).toBe(false)
    expect(s.phase).toBe('ready')
  })

  test('free start basis: heading +x, right +z, up +y, depth -x (depth = -heading, right x up = depth)', () => {
    const s = createGame(config, 20, 1, false)
    expect(s.heading).toEqual(v(1, 0, 0))
    expect(s.frame.right).toEqual(v(0, 0, 1))
    expect(s.frame.up).toEqual(v(0, 1, 0))
    expect(s.frame.depth).toEqual(v(-1, 0, 0))
  })

  test('free start basis has no negative zeros anywhere (toEqual would not catch -0)', () => {
    for (const size of [20, 50, 100]) {
      const s = createGame(config, size, 3, false)
      for (const vec of [s.heading, s.frame.right, s.frame.up, s.frame.depth]) {
        expect(Object.is(vec.x, -0)).toBe(false)
        expect(Object.is(vec.y, -0)).toBe(false)
        expect(Object.is(vec.z, -0)).toBe(false)
      }
    }
  })

  test('free start basis is a right-handed orthonormal triple with depth = -heading, for every size', () => {
    for (const size of [20, 50, 100]) {
      const { frame: f, heading: h } = createGame(config, size, 9, false)
      expect(f.depth).toEqual(v(-h.x + 0, -h.y + 0, -h.z + 0))
      const cross = v(
        f.right.y * f.up.z - f.right.z * f.up.y,
        f.right.z * f.up.x - f.right.x * f.up.z,
        f.right.x * f.up.y - f.right.y * f.up.x,
      )
      expect(cross).toEqual(f.depth)
      const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
      expect(dot(f.right, f.up)).toBe(0)
      expect(dot(f.right, h)).toBe(0)
      expect(dot(f.up, h)).toBe(0)
      expect(dot(f.right, f.right)).toBe(1)
      expect(dot(f.up, f.up)).toBe(1)
    }
  })

  test('the frame objects are not shared between games (free start mutates only its own state)', () => {
    const a = createGame(config, 20, 1, false)
    const b = createGame(config, 20, 1, false)
    a.frame.right.x = 99
    expect(b.frame.right).toEqual(v(0, 0, 1))
    expect(createGame(config, 20, 1, true).frame.right).toEqual(v(1, 0, 0))
  })

  test('the snake, obstacles and apple do not depend on isFirstGameEver (same seed)', () => {
    const a = createGame(config, 20, 21, true)
    const b = createGame(config, 20, 21, false)
    expect(b.snake).toEqual(a.snake)
    expect([...b.obstacles]).toEqual([...a.obstacles])
    expect(b.apple).toEqual(a.apple)
  })

  test('free start: the snake does not face a wall or obstacle (cells ahead free), clearRadius still holds', () => {
    for (const first of [true, false]) {
      // Generation with a fill on 100³ is a million cells per run, so
      // a full seed sweep only on the small cube, two seeds on the large ones. The property is the same.
      for (const [size, seeds] of [[20, 8], [50, 2], [100, 2]] as const) {
        for (let seed = 1; seed <= seeds; seed++) {
          const cfg = { ...config, obstacles: { ...config.obstacles, density: 0.3 } }
          const s = createGame(cfg, size, seed, first)
          const hd = s.snake[0]!
          for (let k = 1; k <= cfg.obstacles.clearRadius; k++) {
            const x = hd.x + s.heading.x * k
            const y = hd.y + s.heading.y * k
            const z = hd.z + s.heading.z * k
            expect(x >= 0 && y >= 0 && z >= 0 && x < size && y < size && z < size).toBe(true)
            expect(s.obstacles.has(cellKey(x, y, z, size))).toBe(false)
          }
          // The obstacle walk accumulates the minimum distance and checks it once:
          // an expect per cell meant millions of calls and the test hit the timeout.
          const r = cfg.obstacles.clearRadius
          let nearest = Infinity
          for (const key of s.obstacles) {
            const x = key % size
            const y = Math.floor(key / size) % size
            const z = Math.floor(key / (size * size))
            const d = Math.max(Math.abs(x - hd.x), Math.abs(y - hd.y), Math.abs(z - hd.z))
            if (d < nearest) nearest = d
          }
          expect(nearest).toBeGreaterThan(r)
        }
      }
    }
  })

  test('apple never spawns on the snake or an obstacle', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = createGame({ ...config, obstacles: { ...config.obstacles, density: 0.2 } }, 20, seed, false)
      const appleKey = cellKey(s.apple.x, s.apple.y, s.apple.z, s.size)
      expect(s.snakeCells.has(appleKey)).toBe(false)
      expect(s.obstacles.has(appleKey)).toBe(false)
    }
  })

  test('clearRadius around the head stays obstacle-free, even at high density', () => {
    const cfg = { ...config, obstacles: { density: 0.3, stickiness: 0.9, clearRadius: 4, wallMargin: 1 } }
    const s = createGame(cfg, 20, 3, false)
    const head = s.snake[0]!
    for (let dx = -4; dx <= 4; dx++)
      for (let dy = -4; dy <= 4; dy++)
        for (let dz = -4; dz <= 4; dz++)
          expect(s.obstacles.has(cellKey(head.x + dx, head.y + dy, head.z + dz, 20))).toBe(false)
    expect(s.obstacles.size).toBeGreaterThan(0)
  })

  test('dense game: every free cell (and the apple) is reachable from the snake head', () => {
    const cfg = { ...config, obstacles: { density: 0.3, stickiness: 0.9, clearRadius: 4, wallMargin: 1 } }
    for (const seed of [1, 2, 3]) {
      const s = createGame(cfg, 20, seed, false)
      const r = reachability(20, s.snakeCells, s.obstacles)
      expect(r.reachable).toBe(r.free)
    }
  })

  test('obstacle layout is deterministic per seed and differs between seeds', () => {
    const a = createGame(config, 20, 11, false)
    const b = createGame(config, 20, 11, false)
    const c = createGame(config, 20, 12, false)
    expect([...a.obstacles].sort()).toEqual([...b.obstacles].sort())
    expect([...a.obstacles].sort()).not.toEqual([...c.obstacles].sort())
  })
})

describe('fillDeadZones: an enclosed pocket gets filled', () => {
  test('a cell sealed in a hand-built shell is filled, the open space is untouched', () => {
    const size = 9
    const obstacles = new Set<number>()
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue
          obstacles.add(cellKey(4 + dx, 4 + dy, 4 + dz, size))
        }
    const shellSize = obstacles.size // 26
    const pocket = cellKey(4, 4, 4, size)
    fillDeadZones(size, obstacles, new Set([cellKey(0, 0, 0, size)]))
    expect(obstacles.has(pocket)).toBe(true)
    expect(obstacles.size).toBe(shellSize + 1)
  })

  test('a pocket of several cells is filled entirely', () => {
    const size = 9
    const obstacles = new Set<number>()
    // The wall plane x=4 splits the cube into two halves entirely; the start is on the left.
    for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) obstacles.add(cellKey(4, y, z, size))
    const wall = obstacles.size
    fillDeadZones(size, obstacles, new Set([cellKey(0, 0, 0, size)]))
    // the right half (x=5..8) is unreachable and filled in
    expect(obstacles.size).toBe(wall + 4 * size * size)
    expect(obstacles.has(cellKey(8, 8, 8, size))).toBe(true)
    expect(obstacles.has(cellKey(3, 3, 3, size))).toBe(false)
  })
})

describe('generateObstacles: no dead zones (real clearCells, dense input)', () => {
  const cases: Array<{ size: number; density: number; stickiness: number; seeds: number[] }> = [
    { size: 20, density: 0.3, stickiness: 0.9, seeds: [1, 2, 3, 42, 1000] },
    { size: 20, density: 0.08, stickiness: 0.6, seeds: [1, 2, 3] },
    { size: 50, density: 0.3, stickiness: 0.9, seeds: [1, 2] },
    { size: 100, density: 0.3, stickiness: 0.9, seeds: [7] },
  ]
  for (const c of cases) {
    for (const seed of c.seeds) {
      test(`size ${c.size} density ${c.density} stick ${c.stickiness} seed ${seed}`, () => {
        const clear = centerClear(c.size, config.obstacles.clearRadius)
        const obstacles = generateObstacles(c.size, c.density, c.stickiness, clear, makeRng(seed))
        const r = reachability(c.size, clear, obstacles)
        expect(r.reachable).toBe(r.free)
        for (const k of clear) expect(obstacles.has(k)).toBe(false)
        expect(obstacles.size).toBeGreaterThanOrEqual(Math.floor(c.size ** 3 * c.density * 0.9))
      })
    }
  }

  test('density 0 produces no obstacles', () => {
    const obstacles = generateObstacles(10, 0, 0.9, centerClear(10, 1), makeRng(1))
    expect(obstacles.size).toBe(0)
  })

  test('stickiness makes cubes cling into constellations', () => {
    const size = 30
    const clear = centerClear(size, 2)
    const loose = generateObstacles(size, 0.03, 0, clear, makeRng(5))
    const sticky = generateObstacles(size, 0.03, 1, clear, makeRng(5))
    // The same amount of obstacles, but sticky ones form far more adjacent pairs.
    expect(Math.abs(loose.size - sticky.size)).toBeLessThan(size * size)
    expect(adjacentPairs(size, sticky)).toBeGreaterThan(adjacentPairs(size, loose) * 3)
  })
})

describe('spawnApple', () => {
  test('lands on the only free cell — never on snake or obstacles', () => {
    const size = 4
    const target = cellKey(2, 1, 3, size)
    const snakeCell = cellKey(0, 0, 0, size)
    for (let seed = 0; seed < 40; seed++) {
      const obstacles = new Set<number>()
      for (let k = 0; k < size ** 3; k++) if (k !== target && k !== snakeCell) obstacles.add(k)
      const s = makeState({
        size,
        snake: [v(0, 0, 0)],
        obstacles,
        apple: v(0, 0, 0),
        rngState: seed * 7919,
      })
      const pos = spawnApple(s)
      expect(pos).toEqual(v(2, 1, 3))
      expect(s.apple).toEqual(v(2, 1, 3))
    }
  })

  test('skips snake cells even when there are no obstacles', () => {
    const size = 3
    const snake: Vec3[] = []
    for (let k = 0; k < size ** 3 - 1; k++) snake.push(v(k % size, Math.floor(k / size) % size, Math.floor(k / 9)))
    // only the last cell (2,2,2) is free
    for (let seed = 0; seed < 30; seed++) {
      const s = makeState({ size, snake, apple: v(0, 0, 0), rngState: seed * 104729 })
      spawnApple(s)
      expect(s.apple).toEqual(v(2, 2, 2))
    }
  })

  test('is deterministic for the same rngState and reaches varied cells', () => {
    const a = makeState({ rngState: 5 })
    const b = makeState({ rngState: 5 })
    spawnApple(a)
    spawnApple(b)
    expect(a.apple).toEqual(b.apple)
    const seen = new Set<number>()
    for (let seed = 0; seed < 20; seed++) {
      const s = makeState({ rngState: seed })
      spawnApple(s)
      seen.add(cellKey(s.apple.x, s.apple.y, s.apple.z, s.size))
    }
    expect(seen.size).toBeGreaterThan(10)
  })

  test('mutates s.apple in place (no new object) and returns it', () => {
    const s = makeState()
    const ref = s.apple
    expect(spawnApple(s)).toBe(ref)
    expect(s.apple).toBe(ref)
  })

  test('full cube: apple stays where it was', () => {
    const size = 2
    const snake: Vec3[] = []
    for (let k = 0; k < 8; k++) snake.push(v(k % 2, Math.floor(k / 2) % 2, Math.floor(k / 4)))
    const s = makeState({ size, snake, apple: v(1, 1, 1) })
    spawnApple(s)
    expect(s.apple).toEqual(v(1, 1, 1))
  })
})

describe('speedAfterApples', () => {
  test('decreases stepMs by stepMsPerApple per apple', () => {
    expect(speedAfterApples(config, 0)).toBe(180)
    expect(speedAfterApples(config, 1)).toBe(176)
    expect(speedAfterApples(config, 5)).toBe(160)
  })

  test('clamps to minStepMs', () => {
    expect(speedAfterApples(config, 1000)).toBe(config.speed.minStepMs)
    expect(speedAfterApples(config, 30)).toBe(60) // exactly on the boundary
  })
})

describe('rotateFrame: roll by +90° around a signed vector', () => {
  const cases: Array<{ name: string; axis: Vec3; right: Vec3; up: Vec3; depth: Vec3 }> = [
    { name: '+right', axis: v(1, 0, 0), right: v(1, 0, 0), up: v(0, 0, 1), depth: v(0, -1, 0) },
    { name: '-right', axis: v(-1, 0, 0), right: v(1, 0, 0), up: v(0, 0, -1), depth: v(0, 1, 0) },
    { name: '+up', axis: v(0, 1, 0), right: v(0, 0, -1), up: v(0, 1, 0), depth: v(1, 0, 0) },
    { name: '-up', axis: v(0, -1, 0), right: v(0, 0, 1), up: v(0, 1, 0), depth: v(-1, 0, 0) },
  ]
  for (const c of cases) {
    test(`axis ${c.name} from base frame`, () => {
      const s = makeState()
      rotateFrame(s, c.axis)
      expect(s.frame.right).toEqual(c.right)
      expect(s.frame.up).toEqual(c.up)
      expect(s.frame.depth).toEqual(c.depth)
    })
  }

  test('four rotations return to the original frame; frame stays right-handed', () => {
    const s = makeState()
    for (let i = 0; i < 4; i++) rotateFrame(s, v(1, 0, 0))
    expect(s.frame).toEqual({ right: v(1, 0, 0), up: v(0, 1, 0), depth: v(0, 0, 1) })
    rotateFrame(s, v(0, 1, 0))
    const { right: r, up: u, depth: d } = s.frame
    expect(v(r.y * u.z - r.z * u.y + 0, r.z * u.x - r.x * u.z + 0, r.x * u.y - r.y * u.x + 0)).toEqual(d)
  })
})

function minWallDistance(size: number, key: number): number {
  const x = key % size
  const y = Math.floor(key / size) % size
  const z = Math.floor(key / (size * size))
  return Math.min(x, y, z, size - 1 - x, size - 1 - y, size - 1 - z)
}

describe('isInWallMargin', () => {
  test('margin 1 marks exactly the outer layer', () => {
    const size = 6
    let count = 0
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++)
        for (let z = 0; z < size; z++) if (isInWallMargin(x, y, z, size, 1)) count++
    expect(count).toBe(size ** 3 - (size - 2) ** 3)
    expect(isInWallMargin(0, 3, 3, size, 1)).toBe(true)
    expect(isInWallMargin(5, 3, 3, size, 1)).toBe(true)
    expect(isInWallMargin(3, 0, 3, size, 1)).toBe(true)
    expect(isInWallMargin(3, 5, 3, size, 1)).toBe(true)
    expect(isInWallMargin(3, 3, 0, size, 1)).toBe(true)
    expect(isInWallMargin(3, 3, 5, size, 1)).toBe(true)
    expect(isInWallMargin(1, 1, 1, size, 1)).toBe(false)
    expect(isInWallMargin(4, 4, 4, size, 1)).toBe(false)
  })
  test('margin 0 marks nothing; margin 2 marks two layers', () => {
    expect(isInWallMargin(0, 0, 0, 6, 0)).toBe(false)
    expect(isInWallMargin(5, 5, 5, 6, 0)).toBe(false)
    expect(isInWallMargin(1, 3, 3, 8, 2)).toBe(true)
    expect(isInWallMargin(6, 3, 3, 8, 2)).toBe(true)
    expect(isInWallMargin(2, 3, 3, 8, 2)).toBe(false)
    expect(isInWallMargin(5, 3, 3, 8, 2)).toBe(false)
  })
})

describe('generateObstacles: wallMargin: no obstacles by the walls', () => {
  const cases: Array<{ size: number; density: number; stickiness: number; margin: number; seeds: number[] }> = [
    { size: 20, density: 0.03, stickiness: 0.6, margin: 1, seeds: [1, 2, 3, 4] },
    { size: 50, density: 0.03, stickiness: 0.6, margin: 1, seeds: [1, 2] },
    { size: 100, density: 0.03, stickiness: 0.6, margin: 1, seeds: [7] },
    { size: 20, density: 0.3, stickiness: 0.9, margin: 1, seeds: [1, 2, 3, 42] },
    { size: 50, density: 0.3, stickiness: 0.9, margin: 1, seeds: [1] },
    { size: 20, density: 0.3, stickiness: 0.9, margin: 2, seeds: [1, 2] },
    { size: 20, density: 0.1, stickiness: 0.6, margin: 3, seeds: [5] },
  ]
  for (const c of cases) {
    for (const seed of c.seeds) {
      test(`size ${c.size} density ${c.density} margin ${c.margin} seed ${seed}`, () => {
        const clear = centerClear(c.size, config.obstacles.clearRadius)
        const obstacles = generateObstacles(c.size, c.density, c.stickiness, clear, makeRng(seed), c.margin)
        expect(obstacles.size).toBeGreaterThan(0)
        for (const k of obstacles) expect(minWallDistance(c.size, k)).toBeGreaterThanOrEqual(c.margin)
        // The free corridor along the walls is intact, still no dead zones.
        const r = reachability(c.size, clear, obstacles)
        expect(r.reachable).toBe(r.free)
        // Density did not drop: obstacles are packed into the remaining core of the cube.
        expect(obstacles.size).toBeGreaterThanOrEqual(Math.floor(c.size ** 3 * c.density * 0.9))
      })
    }
  }

  test('without margin obstacles do reach the walls (the margin is what keeps them away)', () => {
    const size = 20
    const clear = centerClear(size, 4)
    const obstacles = generateObstacles(size, 0.3, 0.9, clear, makeRng(1), 0)
    let touching = 0
    for (const k of obstacles) if (minWallDistance(size, k) === 0) touching++
    expect(touching).toBeGreaterThan(0)
    const omitted = generateObstacles(size, 0.3, 0.9, clear, makeRng(1))
    expect(omitted).toEqual(obstacles) // default margin = 0
  })

  test('fill of a sealed pocket still works with margin (sealed core is filled, wall layer stays free)', () => {
    const size = 12
    // The shell is at distance 3 from the walls, a pocket inside; the start is outside the shell.
    const obstacles = new Set<number>()
    for (let x = 3; x <= 8; x++)
      for (let y = 3; y <= 8; y++)
        for (let z = 3; z <= 8; z++) {
          const edge = x === 3 || x === 8 || y === 3 || y === 8 || z === 3 || z === 8
          if (edge) obstacles.add(cellKey(x, y, z, size))
        }
    const pocket = cellKey(5, 5, 5, size)
    fillDeadZones(size, obstacles, new Set([cellKey(1, 1, 1, size)]))
    expect(obstacles.has(pocket)).toBe(true)
    for (const k of obstacles) expect(minWallDistance(size, k)).toBeGreaterThanOrEqual(3)
  })
})

describe('createGame: wallMargin from config', () => {
  test.each([20, 50, 100])('size %i: no obstacles within margin, on a dense config too', (size) => {
    const dense = { ...config, obstacles: { ...config.obstacles, density: 0.2, wallMargin: 1 } }
    const s = createGame(dense, size, 11, false)
    expect(s.obstacles.size).toBeGreaterThan(0)
    for (const k of s.obstacles) expect(minWallDistance(size, k)).toBeGreaterThanOrEqual(1)
    const starts = new Set<number>(s.snakeCells)
    const r = reachability(size, starts, s.obstacles)
    expect(r.reachable).toBe(r.free)
  })
  test('wallMargin 2 in config is honoured', () => {
    const cfg = { ...config, obstacles: { ...config.obstacles, density: 0.1, wallMargin: 2 } }
    const s = createGame(cfg, 20, 3, false)
    for (const k of s.obstacles) expect(minWallDistance(20, k)).toBeGreaterThanOrEqual(2)
  })
})

describe('createGame — boost', () => {
  test('a new game starts with boost off and copies boostFactor', () => {
    const s = createGame({ ...config, speed: { ...config.speed, boostFactor: 3 } }, 20, 1, false)
    expect(s.boosting).toBe(false)
    expect(s.boostFactor).toBe(3)
  })
})

describe('arenaHasObstacles: whether a cube has obstacles', () => {
  test('matches real generation at density ×30 for cubes 3..14 with clear radius 4 and wall 1', () => {
    const cfg = { ...config, obstacles: { ...config.obstacles, clearRadius: 4, wallMargin: 1 } }
    for (let size = 3; size <= 14; size++) {
      let any = false
      for (let seed = 1; seed <= 5; seed++) if (createGame(cfg, size, seed, false, 2, { obstacleMult: 30 }).obstacles.size > 0) any = true
      expect(any).toBe(arenaHasObstacles(size, 4, 1))
    }
  })
  test('5³: no; 12³ and 20³: yes; without a clear zone obstacles exist everywhere there is an interior', () => {
    expect(arenaHasObstacles(5, 4, 1)).toBe(false)
    expect(arenaHasObstacles(11, 4, 1)).toBe(false)
    expect(arenaHasObstacles(12, 4, 1)).toBe(true)
    expect(arenaHasObstacles(20, 4, 1)).toBe(true)
    expect(arenaHasObstacles(5, 0, 1)).toBe(true)
  })
})
