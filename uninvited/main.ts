// Wires everything: Rapier world (adapter) -> core state + sim -> view; input -> commands; saves at checkpoints.
// The frame loop: input -> commands -> tick -> events -> view. No allocations or awaits inside it.
import { createRapierWorld, initPhysics } from './adapters/physics-rapier'
import { createLocalStore } from './adapters/storage'
import cfgJson from './config.json'
import { attack, beginFrame, cancelHack, createIntent, dash, hackPick, interact, jump, switchMode, tick, toggleCrouch } from './core/commands'
import type { GameConfig } from './core/config'
import { buildGrid } from './core/grid'
import { endingCounter, hackSession, phase, runStats } from './core/queries'
import { applyLoadedState, parseSave, serializeState } from './core/save'
import { createSim, createState, type GameState } from './core/state'
import { bindHackInput } from './input/hack'
import { bindGameInput } from './input/keyboard-mouse'
import { slice } from './levels/slice'
import { createGameView } from './view/game-view'
import { createHackView, type HackView } from './view/hack/index'
import { t } from './view/hud'

const cfg: GameConfig = cfgJson
const level = slice
const SAVE_SLOT = `save.${level.id}`

await initPhysics()
const grid = buildGrid(level)
const physics = createRapierWorld(grid, { radius: cfg.player.radius, ...cfgJson.physics })
const sim = createSim(level, cfg, physics, grid)
const seed = 20261012
let state: GameState = createState(sim, seed)
const levelStart = serializeState(state)
const store = createLocalStore()

const canvas = document.getElementById('game') as HTMLCanvasElement
const ui = document.getElementById('ui') as HTMLElement
document.getElementById('loading')?.remove()
const view = createGameView(canvas, ui, state, sim, (ox, oy, oz, dx, dy, dz, max) => physics.raycast(ox, oy, oz, dx, dy, dz, max))
const input = bindGameInput(canvas)
const intent = createIntent()
const aim = { yaw: 0, pitch: 0 }

type Mode = 'start' | 'playing' | 'paused' | 'hack' | 'resume' | 'dead' | 'won'
let mode: Mode = 'start'
let lockGrace = 0
let endTimer = 0
let hackView: HackView | null = null
let unbindHack: (() => void) | null = null
/** Headless screenshots cannot lock the pointer: ?nolock plays without it. */
const noLock = new URLSearchParams(location.search).has('nolock')

function lock(): void {
  lockGrace = 0.6
  if (!noLock) input.requestLock()
}

function play(): void {
  view.hud.hideScreens()
  mode = 'playing'
  input.setEnabled(true)
  lock()
}

function flushEvents(): void {
  view.handle(sim.events, state, sim)
  for (const e of sim.events) if (e.type === 'checkpointReached') store.write(SAVE_SLOT, serializeState(state))
  beginFrame(sim)
}

function closeHackUi(): void {
  hackView?.hide()
  unbindHack?.()
  unbindHack = null
  view.hud.hackRoot.classList.remove('on')
  input.setEnabled(true)
}

function openHackUi(): void {
  if (!hackView) hackView = createHackView(view.hud.hackRoot, view.sound.ctx && view.sound.bus ? { audio: { ctx: view.sound.ctx, destination: view.sound.bus } } : {})
  const session = hackSession(state)
  if (!session) return
  mode = 'hack'
  input.setEnabled(false)
  view.hud.hackRoot.classList.add('on')
  hackView.show(session)
  if (document.pointerLockElement) document.exitPointerLock()
  unbindHack = bindHackInput(
    view.hud.hackRoot,
    (row, col) => {
      hackPick(state, sim, row, col)
      flushEvents()
      if (!hackSession(state)) {
        closeHackUi()
        play() // inside the click / key press, so the pointer lock is allowed
      }
    },
    () => {
      cancelHack(state, sim)
      flushEvents()
      closeHackUi()
      play()
    },
  )
}

function loadState(next: GameState): void {
  state = next
  applyLoadedState(state, sim)
  view.reset(state, sim)
  endTimer = 0
  play()
}

function showEnd(): void {
  if (document.pointerLockElement) document.exitPointerLock()
  input.setEnabled(false)
  if (phase(state) === 'dead') {
    mode = 'dead'
    const save = store.read(SAVE_SLOT)
    view.hud.showDead(
      save !== null,
      () => loadState(parseSave(store.read(SAVE_SLOT), level.id) ?? (parseSave(levelStart, level.id) as GameState)),
      () => {
        store.clear(SAVE_SLOT)
        loadState(parseSave(levelStart, level.id) as GameState)
      },
    )
  } else {
    mode = 'won'
    const r = runStats(state)
    const m = Math.floor(r.timeSec / 60)
    const sec = Math.floor(r.timeSec % 60)
    const stats = t('won.stats', { time: `${m}:${sec < 10 ? '0' : ''}${sec}`, alarms: r.alarmsRaised, kills: r.kills, broken: r.devicesBroken, deaths: r.deaths })
    const red = endingCounter(state)
    const ending = `${t('won.ending', { red, total: state.checkpoints.length })} ${r.alarmsRaised === 0 ? t('won.quiet') : red > 0 ? t('won.loud') : ''}`
    store.clear(SAVE_SLOT)
    view.hud.showWon(stats, ending, () => loadState(parseSave(levelStart, level.id) as GameState))
  }
}

input.onUnlock(() => {
  if (mode === 'playing' && lockGrace <= 0) {
    mode = 'paused'
    view.hud.showPause(true)
  }
})
ui.addEventListener('click', (e) => {
  if (mode === 'paused' || mode === 'resume') {
    e.stopPropagation()
    play()
  }
})

view.hud.showStart(() => {
  void view.sound.unlock()
  view.sound.play('jack_in', 0.7)
  play()
})

let last = performance.now()
let fps = 60

function frame(now: number): void {
  requestAnimationFrame(frame)
  const raw = Math.min(0.1, (now - last) / 1000)
  last = now
  fps += (1 / Math.max(raw, 1e-3) - fps) * 0.05
  lockGrace -= raw

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
  if (mode === 'paused' || mode === 'resume' || mode === 'start') dt = 0

  beginFrame(sim)
  const held = input.held
  const pressed = input.pressed
  if (mode === 'playing') {
    view.rig.look(input.look.dx, input.look.dy)
    view.aim(state, aim)
    if (pressed.jump > 0) jump(state, sim)
    if (pressed.dash > 0) dash(state, sim)
    if (pressed.crouch % 2 === 1) toggleCrouch(state, sim)
    for (let i = 0; i < pressed.switchMode; i++) switchMode(state, sim)
    if (pressed.interact > 0) interact(state, sim)
    if (pressed.attack > 0 || held.attack) attack(state, sim, aim.yaw, aim.pitch)
  }
  const active = mode === 'playing' || mode === 'hack' || mode === 'resume'
  intent.moveForward = active && mode === 'playing' ? (held.forward ? 1 : 0) - (held.back ? 1 : 0) : 0
  intent.moveRight = active && mode === 'playing' ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : 0
  intent.run = held.run
  intent.scan = mode === 'playing' && held.scan
  intent.lookYaw = view.rig.yaw
  intent.aimPitch = aim.pitch
  if (active || mode === 'dead' || mode === 'won') tick(state, sim, dt, intent)
  input.consumePressed()

  // the hacking overlay follows the state
  const session = hackSession(state)
  if (session && mode !== 'hack') openHackUi()
  else if (session && hackView) hackView.update(session)
  else if (!session && mode === 'hack') {
    // timed out (or died) while the overlay was open
    closeHackUi()
    if (phase(state) === 'playing') {
      mode = 'resume'
      view.hud.showResume(true)
    }
  }

  view.handle(sim.events, state, sim)
  for (const e of sim.events) if (e.type === 'checkpointReached') store.write(SAVE_SLOT, serializeState(state))

  if (phase(state) !== 'playing' && (mode === 'playing' || mode === 'hack' || mode === 'resume')) {
    endTimer += raw
    if (endTimer > (phase(state) === 'dead' ? 1.6 : 2.2)) {
      if (mode === 'hack') closeHackUi()
      showEnd()
    }
  }

  view.update(mode === 'paused' || mode === 'start' ? 0 : raw, state, sim)
}

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
  get fps() {
    return fps
  },
  start(): void {
    void view.sound.unlock()
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
  hold(key: 'forward' | 'back' | 'left' | 'right' | 'run' | 'attack' | 'scan', on: boolean): void {
    input.held[key] = on
  },
  press(key: 'jump' | 'dash' | 'crouch' | 'attack' | 'switchMode' | 'interact'): void {
    input.pressed[key]++
  },
}
