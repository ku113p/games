// Wires everything: Rapier world (adapter) -> core state + sim -> view; input -> commands; saves at checkpoints.
// The frame loop: input -> commands -> tick -> events -> view. No allocations or awaits inside it.
import { createRapierWorld, initPhysics } from './adapters/physics-rapier'
import { createLocalStore } from './adapters/storage'
import cfgJson from './config.json'
import { attack, beginFrame, buyUpgrade, cancelHack, createIntent, hackPick, interact, jump, moveTap, setAim, switchMode, tick, toggleCrouch, useAbility, TAP_BACK, TAP_FORWARD, TAP_LEFT, TAP_RIGHT } from './core/commands'
import type { GameConfig } from './core/config'
import { buildGrid } from './core/grid'
import { solveHack, type HackSession } from './core/hack/index'
import { alarmStage, anyAffordable, hackSession, phase, runStats } from './core/queries'
import { isLevelScene, isSceneId, nextScene, parseFlow, serializeFlow, type AnyScene, type SceneId } from './core/flow'
import { applyLoadedState, parseSave, patchSaveMay, serializeState } from './core/save'
import { createSim, createState, type GameState } from './core/state'
import { bindHackInput } from './input/hack'
import { bindGameInput } from './input/keyboard-mouse'
import { levelById } from './levels/index'
import { createGameView } from './view/game-view'
import { createHackView, type HackView } from './view/hack/index'
import { createSettings } from './view/settings'
import { hackOutcome } from './view/hack/outcome'
import { createTips } from './view/tips'
import { perfProbe } from './view/perf'
import { createCamLog } from './view/camlog'
import type { Bench, BenchCtx } from './view/bench'
import { raiseAlarm } from './core/rules/alarm'
import { cardSpec, t, type CardSpec } from './view/hud'
import { createStory } from './view/story'
import { STORY } from './view/story-data'
import { createTitle } from './view/title'
import { createUpgradeScreen } from './view/upgrades'
import texts from './texts/en.json'

const cfg: GameConfig = cfgJson
const params = new URLSearchParams(location.search)
const level = levelById(params.get('level'))
const SAVE_SLOT = `save.${level.id}`

await initPhysics()
const grid = buildGrid(level, cfg.world)
const physics = createRapierWorld(grid, { radius: cfg.player.radius, ...cfgJson.physics })
const sim = createSim(level, cfg, physics, grid)
const seed = 20261012
let state: GameState = createState(sim, seed)
const levelStart = serializeState(state)
const store = createLocalStore()

const canvas = document.getElementById('game') as HTMLCanvasElement
const ui = document.getElementById('ui') as HTMLElement
document.getElementById('loading')?.remove()
const settings = createSettings(store)
const tips = createTips(store, () => settings.values.tipsOn)
const view = createGameView(canvas, ui, state, sim, (ox, oy, oz, dx, dy, dz, max) => physics.raycast(ox, oy, oz, dx, dy, dz, max), settings, tips, store)
const input = bindGameInput(canvas)
const intent = createIntent()
const aim = { yaw: 0, pitch: 0 }
/** May's upgrade screen (view/upgrades.ts): it opens at a checkpoint once the alarm is quiet, and later from the room (`openUpgrades(onClose)`). It runs in the 'card' mode (the game stands still). */
const upgrades = createUpgradeScreen(ui, {
  state: () => state,
  sim,
  buy: (id) => {
    buyUpgrade(state, sim, id)
    view.handle(sim.events, state, sim)
    beginFrame(sim)
  },
  sfx: (k) => view.sound.play(k === 'buy' ? 'ui_confirm' : k === 'deny' || k === 'close' ? 'ui_back' : 'ui_hover', 0.6),
})
let upgradePending = false
function openUpgrades(onClose: () => void): void {
  mode = 'card'
  input.setEnabled(false)
  if (document.pointerLockElement) document.exitPointerLock()
  view.hud.hideScreens()
  upgrades.open(() => {
    store.write(SAVE_SLOT, patchSaveMay(store.read(SAVE_SLOT), state.may) ?? serializeState(state)) // spent points stay spent after a death
    onClose()
  })
}

/**
 * The scene flow (core/flow.ts): title -> prologue -> room -> level 1 -> Jim's notes -> room -> level 2 / 3 (soon) -> ending.
 * title / story: a scene without the game running (the sim stands still and nothing is drawn). `?level=<id>` and `?bench=` skip the
 * flow and play that level with the old start screen.
 * card: a tutorial card is open - the game is paused like on the pause screen (no sim, no input), the pointer is released. */
/** meeting: May's entrance after the T0 hack (view/may.ts): the sim stands still and the input is locked until her three lines are done (Enter or a click skips). */
type Mode = 'title' | 'story' | 'start' | 'playing' | 'paused' | 'hack' | 'resume' | 'card' | 'meeting' | 'dead' | 'won'
const direct = params.has('level') || params.get('bench') !== null
let mode: Mode = direct ? 'start' : 'title'
const FLOW_SLOT = 'flow'
/** The player came in through the flow (not a ?level jump): the end of the level goes on to Jim's notes. */
let flowOn = false
let sceneMusic: 'office' | 'room' | 'menu' | 'none' = 'none'
/** The level title banner waits for the first frame of play. */
let bannerPending = false
/** A red wall was opened by a hack (D1 at T0): the Move quietly card is due once the meeting is over. */
let quietDue = false
let lockGrace = 0
let endTimer = 0
let hackView: HackView | null = null
let unbindHack: (() => void) | null = null
/** The session on the overlay; kept after the core drops it, so its result can stay on screen. */
let hackShown: HackSession | null = null
/** > 0 while a finished hack's result holds on screen (DESIGN 11: how it ended must be unmistakable). */
let hackOutro = 0
let hackOutroSolved = false
let hackToast = ''
/** The time of the first Esc in a hack: a second one within hackEscSec aborts, so a player who only wants the mouse back does not lose it. */
let hackEscAt = -10
const HACK_ESC_SEC = 2
/** Headless screenshots cannot lock the pointer: ?nolock plays without it. */
const benchName = params.get('bench')
const noLock = params.has('nolock') || benchName !== null
/** Dev: `?camlog` records the camera and the hero every frame and reports any turn over 60 deg (see view/camlog.ts, README). */
const camLog = params.has('camlog') ? createCamLog(view.rig, view.renderer.camera) : null
if (camLog) (window as unknown as Record<string, unknown>)['__camlog'] = camLog
const story = createStory(ui)
const title = createTitle(ui, settings)

function lock(): void {
  lockGrace = 0.6
  if (!noLock) input.requestLock()
}

function play(): void {
  view.hud.hideScreens()
  if (bannerPending) {
    bannerPending = false
    const goal = (texts as unknown as Record<string, string>)[`goal.${level.id}`] ?? ''
    view.hud.banner((texts as unknown as Record<string, string>)[level.nameKey] ?? '', goal, cfgJson.view.hud.bannerSec)
  }
  mode = 'playing'
  input.setEnabled(true)
  lock()
}

/** A tutorial card: the sim stands still, the pointer is released; Enter or a click runs `then` (back to play, or on to the hack overlay). */
function openCard(spec: CardSpec, then: () => void): void {
  mode = 'card'
  input.setEnabled(false)
  if (document.pointerLockElement) document.exitPointerLock()
  view.hud.showCard(spec, false, then)
}

/** May's entrance: the sim stands still, the input is locked, the pointer stays captured; her lines run on real time. */
function startMeeting(): void {
  view.hud.hideScreens()
  mode = 'meeting'
  input.setEnabled(false)
  lock()
  view.may.beginMeeting()
}

function endMeeting(): void {
  play() // the Enter / click that skipped it (or the lock kept through the beat) allows the pointer lock
}

function scanEvents(): void {
  for (const e of sim.events) if (e.type === 'wallOpened') quietDue = true
}

function flushEvents(): void {
  scanEvents()
  view.handle(sim.events, state, sim)
  for (const e of sim.events) if (e.type === 'checkpointReached') {
      store.write(SAVE_SLOT, serializeState(state))
      upgradePending = true
    }
  beginFrame(sim)
}

function closeHackUi(): void {
  view.hud.hackEsc(false)
  hackEscAt = -10
  hackView?.hide()
  unbindHack?.()
  unbindHack = null
  view.hud.hackRoot.classList.remove('on')
  input.setEnabled(true)
}

/** The session just ended (solved / timed out): show the result and hold it. Reads this frame's events - call it before they are flushed. */
function beginHackOutro(): void {
  const o = hackOutcome(sim.events, alarmStage(state))
  unbindHack?.()
  unbindHack = null
  if (hackShown) hackView?.update(hackShown)
  if (o.kind !== 'none') hackView?.outcome(o.title, o.detail)
  hackOutroSolved = o.kind === 'solved'
  hackToast = o.toast
  hackOutro = cfgJson.hack.view.outroSec
}

/** The result has been seen: the overlay closes with a glitch and the game says what happened. */
function endHackOutro(): void {
  hackOutro = 0
  closeHackUi()
  hackShown = null
  if (hackToast) view.hud.toast(hackToast, hackOutroSolved ? 'good' : 'alarm')
  hackToast = ''
  if (phase(state) !== 'playing') return
  if (hackOutroSolved && view.may.takeMeeting()) startMeeting()
  else if (hackOutroSolved) play() // the last pick's user activation usually still allows the lock; if not, the pause screen asks for a click
  else {
    mode = 'resume'
    view.hud.showResume(true)
  }
}

function openHackUi(): void {
  if (!hackView) hackView = createHackView(view.hud.hackRoot, view.sound.ctx && view.sound.bus ? { audio: { ctx: view.sound.ctx, destination: view.sound.bus } } : {})
  const session = hackSession(state)
  if (!session) return
  hackShown = session
  mode = 'hack'
  input.setEnabled(false)
  view.hud.hackRoot.classList.add('on')
  hackView.show(session)
  if (document.pointerLockElement) document.exitPointerLock()
  unbindHack = bindHackInput(
    view.hud.hackRoot,
    (row, col) => {
      hackPick(state, sim, row, col)
      if (!hackSession(state)) beginHackOutro()
      flushEvents()
    },
    () => {
      const now = performance.now() / 1000
      if (now - hackEscAt > HACK_ESC_SEC) {
        hackEscAt = now
        view.hud.hackEsc(true)
        return
      }
      cancelHack(state, sim)
      flushEvents()
      closeHackUi()
      hackShown = null
      view.hud.toast(t('hack.aborted'))
      play() // inside the key press, so the pointer lock is allowed
    },
  )
}

function loadState(next: GameState): void {
  state = next
  upgradePending = false
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
    view.music.sting('death')
    const save = store.read(SAVE_SLOT)
    view.hud.showDead(
      save !== null,
      () => loadState(parseSave(store.read(SAVE_SLOT), level.id) ?? (parseSave(levelStart, level.id) as GameState)),
      () => {
        store.clear(SAVE_SLOT)
        view.may.restart()
        loadState(parseSave(levelStart, level.id) as GameState)
      },
    )
  } else {
    mode = 'won'
    view.music.sting('win')
    const r = runStats(state)
    const m = Math.floor(r.timeSec / 60)
    const sec = Math.floor(r.timeSec % 60)
    const stats = t('won.stats', { time: `${m}:${sec < 10 ? '0' : ''}${sec}`, alarms: r.alarmsRaised, kills: r.kills, broken: r.devicesBroken, deaths: r.deaths })
    // DESIGN 4: the counter is pressure, not a verdict - the end screen does not print it
    const ending = r.alarmsRaised === 0 ? t('won.quiet') : ''
    store.clear(SAVE_SLOT)
    if (flowOn) writeFlow('notes')
    view.hud.showWon(
      stats,
      ending,
      flowOn
        ? () => enterScene('notes')
        : () => {
            view.may.restart()
            loadState(parseSave(levelStart, level.id) as GameState)
          },
      flowOn ? 'won.continue' : 'won.again',
    )
  }
}

function writeFlow(id: SceneId): void {
  store.write(FLOW_SLOT, serializeFlow(id))
}

function leaveGame(): void {
  if (document.pointerLockElement) document.exitPointerLock()
  input.setEnabled(false)
  view.hud.hideScreens()
  view.hud.setVisible(false)
  view.hud.hint(null)
}

/** The title screen: Start begins a new run, Continue goes on from the saved scene. */
function enterTitle(): void {
  mode = 'title'
  flowOn = false
  sceneMusic = 'none'
  story.hide()
  leaveGame()
  const saved = parseFlow(store.read(FLOW_SLOT))
  const unlock = (): void => {
    void view.sound.unlock().then(() => title.setSoundOn(view.sound.ctx !== null))
  }
  title.show({
    hasContinue: saved !== null,
    onAnyClick: unlock,
    onStart: () => {
      unlock()
      store.clear(FLOW_SLOT)
      store.clear(SAVE_SLOT)
      enterScene('prologue')
    },
    onContinue: () => {
      unlock()
      enterScene(saved ?? 'prologue', true)
    },
  })
}

/** Runs a scene: a story card montage or the level. `resume`: take the level's checkpoint save when there is one. */
function enterScene(id: AnyScene, resume = false): void {
  if (id === 'title') {
    if (flowOn) store.clear(FLOW_SLOT)
    enterTitle()
    return
  }
  flowOn = true
  writeFlow(id)
  title.hide()
  if (isLevelScene(id)) {
    story.hide()
    view.hud.setVisible(true)
    sceneMusic = 'none'
    view.music.context = 'net'
    const save = resume ? parseSave(store.read(SAVE_SLOT), level.id) : null
    if (!save) {
      store.clear(SAVE_SLOT)
      view.may.restart()
    }
    bannerPending = true
    loadState(save ?? (parseSave(levelStart, level.id) as GameState))
    return
  }
  const spec = STORY[id]
  if (!spec) {
    enterScene(nextScene(id))
    return
  }
  mode = 'story'
  leaveGame()
  sceneMusic = spec.music
  if (spec.sting) view.music.sting(spec.sting)
  story.play(spec, () => enterScene(nextScene(id)))
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

// the meeting is skipped with Enter or a click once its first line has been read
document.addEventListener(
  'keydown',
  (e) => {
    if (mode !== 'meeting' || (e.code !== 'Enter' && e.code !== 'NumpadEnter') || e.repeat) return
    if (view.may.skipMeeting()) {
      e.preventDefault()
      e.stopPropagation()
      endMeeting()
    }
  },
  true,
)
ui.addEventListener('click', () => {
  if (mode === 'meeting' && view.may.skipMeeting()) endMeeting()
})

if (direct) {
  view.hud.showStart(() => {
    void view.sound.unlock()
    view.sound.play('jack_in', 0.7)
    bannerPending = true
    play()
  })
} else {
  view.hud.hideScreens()
  enterTitle()
  const first = params.get('scene')
  if (first === 'title') enterTitle()
  else if (first !== null && isSceneId(first)) enterScene(first)
}

let last = performance.now()
let fps = 60

/** `?bench=<scenario>`: the deterministic benchmark (view/bench.ts); loaded only then. */
const bench: Bench | null =
  benchName === null
    ? null
    : (await import('./view/bench')).createBench(
        { state: () => state, sim, view, input: input as unknown as BenchCtx['input'], level: level.id, start: () => {
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

  // the scenes without the game: the story player and the music run, nothing else
  if (mode === 'title' || mode === 'story') {
    story.update(raw)
    const mf = view.music.flags
    mf.menu = mode === 'title' || sceneMusic === 'menu'
    mf.paused = false
    mf.hack = false
    view.music.context = sceneMusic === 'office' ? 'office' : sceneMusic === 'room' ? 'room' : 'net'
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
  if (mode === 'paused' || mode === 'resume' || mode === 'start' || mode === 'card' || mode === 'meeting') dt = 0
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
    for (let i = 0; i < pressed.tapForward; i++) moveTap(state, sim, TAP_FORWARD, view.rig.yaw)
    for (let i = 0; i < pressed.tapBack; i++) moveTap(state, sim, TAP_BACK, view.rig.yaw)
    for (let i = 0; i < pressed.tapLeft; i++) moveTap(state, sim, TAP_LEFT, view.rig.yaw)
    for (let i = 0; i < pressed.tapRight; i++) moveTap(state, sim, TAP_RIGHT, view.rig.yaw)
    if (pressed.crouch % 2 === 1) toggleCrouch(state, sim)
    for (let i = 0; i < pressed.switchMode; i++) switchMode(state, sim)
    if (pressed.interact > 0) interact(state, sim)
    if (pressed.ability1 > 0) useAbility(state, sim, 0, aim.yaw, aim.pitch)
    if (pressed.ability2 > 0) useAbility(state, sim, 1, aim.yaw, aim.pitch)
    setAim(state, sim, held.aim)
    if (pressed.attack > 0 || held.attack) attack(state, sim, aim.yaw, aim.pitch, pressed.attack > 0)
  } else setAim(state, sim, false)
  const active = mode === 'playing' || mode === 'hack' || mode === 'resume'
  intent.moveForward = active && mode === 'playing' ? (held.forward ? 1 : 0) - (held.back ? 1 : 0) : 0
  intent.moveRight = active && mode === 'playing' ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : 0
  intent.run = held.run
  intent.crouchHold = mode === 'playing' && held.crouch
  intent.scan = mode === 'playing' && held.scan
  intent.lookYaw = view.rig.yaw
  intent.aimPitch = aim.pitch
  if (active || mode === 'dead' || mode === 'won') tick(state, sim, dt, intent)
  input.consumePressed()

  // the hacking overlay follows the state
  const session = hackSession(state)
  if (hackOutro > 0) {
    hackOutro -= raw
    if (hackShown) hackView?.update(hackShown)
    if (hackOutro <= 0 || phase(state) !== 'playing') endHackOutro()
  } else if (session && mode !== 'hack' && mode !== 'card') {
    // the first hack of a save: the card comes before the overlay (the sim has not moved since the key press)
    if (tips.claim('hacking')) {
      openCard(cardSpec('hacking'), () => {
        view.hud.hideScreens()
        openHackUi()
      })
    } else openHackUi()
  }
  else if (session && hackView) hackView.update(session)
  else if (!session && mode === 'hack') {
    if (phase(state) === 'playing' && hackShown?.status === 'timedOut') beginHackOutro() // timed out: show it, then resume
    else {
      // died (or the state was replaced) while the overlay was open
      closeHackUi()
      hackShown = null
      if (phase(state) === 'playing') {
        mode = 'resume'
        view.hud.showResume(true)
      }
    }
  }

  scanEvents()
  view.handle(sim.events, state, sim)
  for (const e of sim.events) if (e.type === 'checkpointReached') {
      store.write(SAVE_SLOT, serializeState(state))
      upgradePending = true
    }

  if (phase(state) !== 'playing' && (mode === 'playing' || mode === 'hack' || mode === 'resume')) {
    endTimer += raw
    const endAfter = phase(state) === 'dead' ? 1.6 : 2.2
    // the file is taken: May's line about Jim's notes finishes before the end screen comes up
    const mayHolds = phase(state) === 'won' && view.may.holdingEnd() && endTimer < endAfter + cfgJson.may.endHoldMaxSec
    if (endTimer > endAfter && !mayHolds) {
      if (mode === 'hack') closeHackUi()
      showEnd()
    }
  }

  if (mode === 'meeting' && !view.may.meetingActive()) endMeeting()
  // May: lines wait while the game is not calm; the end screens show only the lines made for them
  view.may.mode = phase(state) === 'dead' ? 'blocked' : mode === 'playing' || mode === 'meeting' ? 'play' : mode === 'won' ? 'end' : 'blocked'
  const mf = view.music.flags
  mf.menu = mode === 'start' || mode === 'dead' || mode === 'won'
  mf.paused = mode === 'paused' || mode === 'resume' || mode === 'card'
  mf.hack = mode === 'hack'
  view.update(mode === 'paused' || mode === 'start' || mode === 'card' ? 0 : raw, state, sim, raw)
  // a card requested by what just happened (a first meeting): never in a hack, never at the end screens
  if (bench) bench.post()
  camLog?.frame(mode, state.player.facing, state.player.pos, sim.events)
  if (upgradePending && mode === 'playing' && phase(state) === 'playing' && !hackSession(state) && hackOutro <= 0 && alarmStage(state) === 0) {
    upgradePending = false
    if (anyAffordable(state, sim)) openUpgrades(play)
  }
  if (!bench && mode === 'playing' && phase(state) === 'playing' && !hackSession(state) && hackOutro <= 0) {
    // Move quietly: when the first red wall opens (D1), once the meeting is over
    const quiet = quietDue && tips.claim('quiet')
    quietDue = false
    const id = quiet ? 'quiet' : tips.take()
    if (id) openCard(cardSpec(id), play)
    else {
      const custom = view.guide.takeCard()
      if (custom) openCard(custom, play)
    }
  }
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
  /** Renderer and scene counters for the perf tools (see tools/perf-fight.ts). */
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
  /** Debug: raise the alarm to the given stage at the player's feet. */
  alarm(stage: number): void {
    for (let i = 0; i < 4 && state.alarm.stage < stage; i++) {
      state.alarm.cooldown = 0
      raiseAlarm(state, sim, 'camera', state.player.pos.x, state.player.pos.y, state.player.pos.z)
    }
  },
  /** Debug: solve the open hack the way the overlay's picks would (the screenshot scripts). */
  hackSolve(): void {
    const session = hackSession(state)
    if (!session) return
    for (const cell of solveHack(session) ?? []) hackPick(state, sim, Math.floor(cell / session.size), cell % session.size)
    if (!hackSession(state)) beginHackOutro()
    flushEvents()
  },
  /** Debug / the room: opens May's upgrade screen. */
  openUpgrades: () => openUpgrades(play),
  start(): void {
    void view.sound.unlock()
    if (mode === 'title' || mode === 'story') {
      story.hide()
      title.hide()
      view.hud.setVisible(true)
      view.music.context = 'net'
    }
    play()
  },
  /** Jumps to a scene (screenshots, `?scene=`). */
  scene(id: AnyScene): void {
    if (id === 'title') enterTitle()
    else enterScene(id)
  },
  story,
  /** Debug: May's meeting now (screenshots). */
  meeting(): void {
    state.mayMet = true
    startMeeting()
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
  hold(key: 'forward' | 'back' | 'left' | 'right' | 'run' | 'crouch' | 'attack' | 'aim' | 'scan', on: boolean): void {
    input.held[key] = on
  },
  press(key: 'jump' | 'tapForward' | 'tapBack' | 'tapLeft' | 'tapRight' | 'crouch' | 'attack' | 'switchMode' | 'interact'): void {
    input.pressed[key]++
  },
}
