// Wires everything: Rapier world (adapter) -> core state + sim -> view; input -> commands; stage snapshots and restarts.
// The frame loop: input -> commands -> tick -> events -> view. No allocations or awaits inside it.
// WP0 skeleton (owner afterwards: WP1 Spine): the boot, the loop, the pointer lock, the pause, hit-stop, `?bench`, a plain
// restart of the level on death. WP1 adds the stages, the letter card, level transitions and the ending.
import { createRapierWorld, initPhysics } from './adapters/physics-rapier'
import { createLocalStore } from './adapters/storage'
import cfgJson from './config.json'
import { attack, beginFrame, circularStrike, createIntent, interact, jump, reload, setAim, tick } from './core/commands'
import type { GameConfig } from './core/config'
import { buildGrid } from './core/grid'
import { phase, runStats } from './core/queries'
import { applyLoadedState, parseSave, serializeState } from './core/save'
import { createSim, createState, type GameState } from './core/state'
import { bindGameInput } from './input/keyboard-mouse'
import { levelById } from './levels/index'
import { createGameView } from './view/game-view'
import { createSettings } from './view/settings'
import { createTips } from './view/tips'
import { perfProbe } from './view/perf'
import { createCamLog } from './view/camlog'
import type { Bench, BenchCtx } from './view/bench'
import { t } from './view/hud'
import { createTitle } from './view/title'
import texts from './texts/en.json'

const cfg = cfgJson as unknown as GameConfig
const params = new URLSearchParams(location.search)
const level = levelById(params.get('level'))

await initPhysics()
const grid = buildGrid(level, cfg.world)
const physics = createRapierWorld(grid, { radius: cfg.player.radius, ...cfgJson.physics })
const sim = createSim(level, cfg, physics, grid)
const seed = 20261012
let state: GameState = createState(sim, seed)
/** The snapshot a death restarts from (WP1: taken when a stage starts, not only at the level start). */
let restartPoint = serializeState(state)
const store = createLocalStore()

const canvas = document.getElementById('game') as HTMLCanvasElement
const ui = document.getElementById('ui') as HTMLElement
document.getElementById('loading')?.remove()
const settings = createSettings(store)
const tips = createTips(store, () => settings.values.tipsOn)
const view = createGameView(canvas, ui, state, sim, (ox, oy, oz, dx, dy, dz, max) => physics.raycast(ox, oy, oz, dx, dy, dz, max), settings, tips)
const input = bindGameInput(canvas)
const intent = createIntent()
const aim = { yaw: 0, pitch: 0 }

/**
 * title: the title screen (the sim stands still); start: the start screen of a `?level=` / `?bench=` jump; playing; paused
 * (the pointer lock is gone); resume: back from a pause that lost the lock; card: a tutorial card is open (the game is paused
 * like on the pause screen); dead: the death cam before the restart; won: the level is done.
 */
type Mode = 'title' | 'start' | 'playing' | 'paused' | 'resume' | 'card' | 'dead' | 'won'
const direct = params.has('level') || params.get('bench') !== null
let mode: Mode = direct ? 'start' : 'title'
/** The level title banner waits for the first frame of play. */
let bannerPending = false
let lockGrace = 0
let endTimer = 0
/** Headless screenshots cannot lock the pointer: ?nolock plays without it. */
const benchName = params.get('bench')
const noLock = params.has('nolock') || benchName !== null
/** Dev: `?camlog` records the camera and the hero every frame and reports any turn over 60 deg (see view/camlog.ts, README). */
const camLog = params.has('camlog') ? createCamLog(view.rig, view.renderer.camera) : null
if (camLog) (window as unknown as Record<string, unknown>)['__camlog'] = camLog
const title = createTitle(ui, settings)

function lock(): void {
  lockGrace = 0.6
  if (!noLock) input.requestLock()
}

function play(): void {
  view.hud.hideScreens()
  if (bannerPending) {
    bannerPending = false
    const dict = texts as unknown as Record<string, string>
    view.hud.banner(dict[level.nameKey] ?? '', dict[`goal.${level.id}`] ?? '', cfgJson.view.hud.bannerSec)
  }
  mode = 'playing'
  input.setEnabled(true)
  lock()
}

/** Replaces the state (a restart or a load) and resumes play. */
function loadState(next: GameState): void {
  state = next
  applyLoadedState(state, sim)
  view.reset(state, sim)
  endTimer = 0
  play()
}

/** Death: the stage starts over from its snapshot (WP1 snapshots every stage; for now the level start). */
function restartStage(): void {
  const next = parseSave(restartPoint, level.id) as GameState
  next.run.deaths = state.run.deaths
  next.run.restarts = state.run.restarts + 1
  loadState(next)
  view.hud.toast(t('dead.again'))
}

function showWon(): void {
  if (document.pointerLockElement) document.exitPointerLock()
  input.setEnabled(false)
  mode = 'won'
  view.music.sting('win')
  const r = runStats(state)
  const m = Math.floor(r.timeSec / 60)
  const sec = Math.floor(r.timeSec % 60)
  view.hud.showWon(t('won.stats', { time: `${m}:${sec < 10 ? '0' : ''}${sec}`, kills: r.kills, deaths: r.deaths }), '', () => loadState(parseSave(restartPoint, level.id) as GameState), 'won.again')
}

/** The title screen: Start begins the game. */
function enterTitle(): void {
  mode = 'title'
  if (document.pointerLockElement) document.exitPointerLock()
  input.setEnabled(false)
  view.hud.hideScreens()
  view.hud.setVisible(false)
  const unlock = (): void => {
    void view.sound.unlock().then(() => title.setSoundOn(view.sound.ctx !== null))
  }
  title.show({
    hasContinue: false,
    onAnyClick: unlock,
    onStart: () => {
      unlock()
      title.hide()
      view.hud.setVisible(true)
      bannerPending = true
      loadState(parseSave(restartPoint, level.id) as GameState)
    },
    onContinue: () => undefined,
  })
}

input.onUnlock(() => {
  if (mode === 'playing' && lockGrace <= 0) {
    mode = 'paused'
    view.hud.showPause(true)
  }
})
ui.addEventListener('click', (e) => {
  // the settings panel and its buttons are not "click to resume"
  if (e.target instanceof Element && e.target.closest('.settings, .btn')) return
  if (mode === 'paused' || mode === 'resume') {
    e.stopPropagation()
    play()
  }
})

if (direct) {
  view.hud.showStart(() => {
    void view.sound.unlock()
    bannerPending = true
    play()
  })
} else {
  view.hud.hideScreens()
  enterTitle()
}

let last = performance.now()
let fps = 60

/** `?bench=<scenario>`: the deterministic benchmark (view/bench.ts); loaded only then. */
const bench: Bench | null =
  benchName === null
    ? null
    : (await import('./view/bench')).createBench(
        {
          state: () => state,
          sim,
          view,
          input: input as unknown as BenchCtx['input'],
          level: level.id,
          start: () => {
            void view.sound.unlock()
            play()
          },
        },
        benchName,
      )
if (bench) settings.set('tipsOn', false)

function frame(now: number): void {
  requestAnimationFrame(frame)
  let raw = Math.min(0.1, (now - last) / 1000)
  last = now
  fps += (1 / Math.max(raw, 1e-3) - fps) * 0.05
  lockGrace -= raw

  // the title: the music runs, nothing else
  if (mode === 'title') {
    const mf = view.music.flags
    mf.menu = true
    mf.paused = false
    view.music.update(raw)
    input.consumePressed()
    return
  }

  // lost the pointer lock without pressing Esc (alt-tab, a lock that never came): pause
  if (mode === 'playing' && !noLock && !input.locked() && lockGrace <= 0) {
    mode = 'paused'
    view.hud.showPause(true)
  }

  let dt = raw
  if (view.hitStop > 0) {
    view.hitStop -= raw
    dt = 0
  }
  if (mode === 'paused' || mode === 'resume' || mode === 'start' || mode === 'card') dt = 0
  if (mode === 'playing') tips.tick(raw)

  beginFrame(sim)
  if (bench) {
    raw = bench.pre(now)
    if (dt > 0 || raw === 0) dt = raw
  }
  const held = input.held
  const pressed = input.pressed
  if (mode === 'playing') {
    view.rig.look(input.look.dx, input.look.dy)
    view.aim(state, aim)
    if (pressed.jump > 0) jump(state, sim)
    if (pressed.reload > 0) reload(state, sim)
    if (pressed.strike > 0) circularStrike(state, sim)
    interact(state, sim, held.interact)
    setAim(state, sim, held.aim)
    if (pressed.attack > 0 || held.attack) attack(state, sim, aim.yaw, aim.pitch, pressed.attack > 0)
  } else setAim(state, sim, false)
  const active = mode === 'playing'
  intent.moveForward = active ? (held.forward ? 1 : 0) - (held.back ? 1 : 0) : 0
  intent.moveRight = active ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : 0
  intent.run = held.run
  intent.interact = held.interact
  intent.lookYaw = view.rig.yaw
  intent.aimPitch = aim.pitch
  if (active || mode === 'dead' || mode === 'won') tick(state, sim, dt, intent)
  input.consumePressed()

  view.handle(sim.events, state, sim)

  const ph = phase(state)
  if (mode === 'playing' && ph === 'dead') {
    mode = 'dead'
    endTimer = 0
  }
  if (mode === 'dead') {
    endTimer += raw
    if (endTimer > cfg.stage.restartDelaySec) restartStage()
  } else if (mode === 'playing' && (ph === 'levelDone' || ph === 'rescued')) {
    endTimer += raw
    if (endTimer > 2.2) showWon()
  }

  const mf = view.music.flags
  mf.menu = mode === 'start' || mode === 'won'
  mf.paused = mode === 'paused' || mode === 'resume' || mode === 'card'
  view.update(mode === 'paused' || mode === 'start' || mode === 'card' ? 0 : raw, state, sim, raw)
  if (bench) bench.post()
  camLog?.frame(mode, state.player.facing, state.player.pos, sim.events)
}

// a hidden tab: the lock is gone with it - pause at once (the pointerlockchange path does the same for Esc)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') {
    mode = 'paused'
    view.hud.showPause(true)
  }
})
addEventListener('resize', () => view.renderer.resize())
requestAnimationFrame(frame)

// Hooks for the Playwright screenshot script and debugging (not used by the game itself).
;(window as unknown as Record<string, unknown>)['__game'] = {
  get state() {
    return state
  },
  sim,
  get mode() {
    return mode
  },
  view,
  get fps() {
    return fps
  },
  perf: perfProbe,
  /** Renderer and scene counters for the perf tools. */
  perfInfo(): Record<string, number> {
    const r = view.renderer.renderer
    let objects = 0
    let visible = 0
    view.renderer.scene.traverse((o) => {
      objects++
      if (o.visible) visible++
    })
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return {
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
      programs: r.info.programs?.length ?? 0,
      calls: r.info.render.calls,
      triangles: r.info.render.triangles,
      objects,
      visible,
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : 0,
    }
  },
  start(): void {
    void view.sound.unlock()
    if (mode === 'title') {
      title.hide()
      view.hud.setVisible(true)
    }
    play()
  },
  /** Feet on a plan cell, looking along yaw (radians) with a camera pitch. */
  place(col: number, row: number, yaw: number, pitch = 0.22): void {
    const g = sim.grid
    state.player.pos.x = (col + 0.5) * g.cell
    state.player.pos.z = (row + 0.5) * g.cell
    state.player.pos.y = (g.h0[row * g.cols + col] as number) + 0.05
    state.player.vel.x = state.player.vel.y = state.player.vel.z = 0
    state.player.facing = yaw
    view.rig.yaw = yaw
    view.rig.pitch = pitch
    view.rig.snap()
  },
  hold(key: 'forward' | 'back' | 'left' | 'right' | 'run' | 'attack' | 'aim' | 'interact', on: boolean): void {
    input.held[key] = on
  },
  press(key: 'jump' | 'attack' | 'reload' | 'strike' | 'interact'): void {
    input.pressed[key]++
  },
}
