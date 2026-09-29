// main.ts - the game assembly point: wires core/ (rules), view/ (three.js) and input/
// (touch + keyboard). Holds the requestAnimationFrame loop. No allocations or await in the frame.

import { createGame, type Config } from './core/rules'
import { setBoost, startGame, tick, turnAxis, turnInPlane, type GameEvent } from './core/commands'
import { effectiveStepMs, type AxisDir, type GameState, type ScreenDir } from './core/state'
import { cubeSize, effectiveBoostFactor, elapsedMs, gameMode, isAlive, score, snakeLength } from './core/queries'
import { createView, type View } from './view/index'
import { resetUserCamera, userCamera } from './view/camera-rig'
import { createPerfPanel, type PerfPanel } from './view/perf-panel'
import { BENCH_ARENA, BENCH_SEED, BenchRun, applyBenchStage, formatBenchLog, type StageResult } from './view/perf-bench'
import { collectBenchEnv } from './view/perf-env'
import { applyQualityLevel, autoQuality, bufferMegapixels, createPerfSnapshot, isQualityId, perf, type QualityConfig, type QualityId } from './view/perf-settings'
import { attachPad, type Pad } from './input/pad'
import { attachStick, stickStep, type Stick } from './input/stick'
import { attachBoostButton, type BoostButton } from './input/boost'
import {
  accumulateTilt,
  clampZoom,
  createBoostHold,
  parsePadSide,
  TILT_LIMIT_RAD,
  type BoostHold,
  type PadSide,
} from './input/gestures'
import { attachInput, type InputHandlers, type InputScheme } from './input/index'
import { createAudio, type SoundConfig } from './view/audio'
import { createDrum, renderBoard, renderTopLine } from './view/leaderboard-view'
import { mountLangSwitch } from './view/lang-switch'
import {
  insertEntry,
  migrateLegacy,
  parseTable,
  formatDuration,
  renameEntry,
  sanitizeName,
  type LeaderboardConfig,
  type ScoreEntry,
} from './scores/leaderboard'
import { isPerfDebugRequested, isSelfStartingPerfMode } from './legal/flow'
import { ALL_SCREENS, createScreens, isHeld, visibleScreens, type ScreenId, type ScreenState } from './screens/screens'
import { currentLanguage, initLanguage, onLanguageChange, t } from './i18n/runtime'
import { SHOP_STORAGE_KEY, catalog, equippedItem, gameSetup, parse, serialize, type Item, type ShopRoot, type ShopState, type Slot } from './shop'
import { createWallet, grandfatherArena, hasAffordableNew, isShopUnlocked } from './screens/shop-flow'
import { createShopView } from './screens/shop-view'
import musicUrl from './assets/music/cyber-runner.mp3'
import configJson from './config.json'
import analyticsCfg from './analytics/config.json'
import { analyticsEnabled, createTracker } from './analytics/events'
import { loadCounter, sendEvent } from './analytics/goatcounter'

const config = configJson as Config

const HIGH_SCORE_KEY = 'snake:highScore' // the old single high score: read only to migrate it into the leaderboard
const LEADERBOARD_KEY = 'snake:leaderboard'
const INITIALS_KEY = 'snake:initials'
const HAS_PLAYED_BEFORE_KEY = 'snake:hasPlayedBefore'
const PAD_SIDE_KEY = 'snake:padSide'
const MUSIC_ON_KEY = 'snake:musicOn'
const SFX_ON_KEY = 'snake:sfxOn'
const FOG_ON_KEY = 'snake:fogOn'
const QUALITY_KEY = 'snake:quality'
const SIZE_KEY = 'snake:size'
const SCHEME_KEY = 'snake:scheme'
const SHOP_KEY = SHOP_STORAGE_KEY // wallet, owned and equipped items (shop/serialize)
const SHOP_UNLOCKED_KEY = 'snake:shopUnlocked' // whether at least one game has been finished: until then the shop entry is hidden

// --- DOM ---------------------------------------------------------------

function required<T extends Element>(id: string): T {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`main.ts: element #${id} not found in index.html`)
  return el as unknown as T
}

const canvas = required<HTMLCanvasElement>('game-canvas')
const menuScreen = required<HTMLElement>('menu')
const hud = required<HTMLElement>('hud')
const hudScore = required<HTMLElement>('score')
const gameOverScreen = required<HTMLElement>('game-over')
const finalScoreEl = required<HTMLElement>('final-score')
const finalTimeEl = required<HTMLElement>('final-time')
const gameOverBoardEl = required<HTMLElement>('game-over-board')
const settingsScreen = required<HTMLElement>('settings')
const recordsScreen = required<HTMLElement>('records')
const recordsBoardEl = required<HTMLElement>('records-board')
const recordLineBtn = required<HTMLButtonElement>('record-line')
const openSettingsBtn = required<HTMLButtonElement>('open-settings')
const backButtons = ['settings-back', 'settings-done', 'records-back', 'records-done'].map((id) => required<HTMLButtonElement>(id))
const drumBlockEl = required<HTMLElement>('drum-block')
const drumEl = required<HTMLElement>('drum')
const drumOkBtn = required<HTMLButtonElement>('drum-ok')
const gameOverActionsEl = required<HTMLElement>('game-over-actions')
const tapToPlayBtn = required<HTMLButtonElement>('tap-to-play')
const playAgainBtn = required<HTMLButtonElement>('play-again')
const pauseScreen = required<HTMLElement>('pause')
const resumeBtn = required<HTMLButtonElement>('resume')
const demoScreen = required<HTMLElement>('demo-explainer')
const demoContinueBtn = required<HTMLButtonElement>('demo-continue')
const toMenuBtn = required<HTMLButtonElement>('to-menu')
const padEl = required<HTMLElement>('pad')
const boostEl = required<HTMLElement>('boost')
const pauseBtn = required<HTMLButtonElement>('pause-btn')
const camResetBtn = required<HTMLButtonElement>('cam-reset')
const stickEl = required<HTMLElement>('stick')
const stickKnobEl = required<HTMLElement>('stick-knob')
const pauseToMenuBtn = required<HTMLButtonElement>('pause-to-menu')
const padSideOptions = required<HTMLElement>('pad-side-options')
const schemeOptions = required<HTMLElement>('scheme-options')
const legalWarningScreen = required<HTMLElement>('legal-warning')
const legalWarningOkBtn = required<HTMLButtonElement>('legal-warning-ok')
const legalTermsScreen = required<HTMLElement>('legal-terms')
const legalTermsOkBtn = required<HTMLButtonElement>('legal-terms-ok')
const shopScreen = required<HTMLElement>('shop')
const openShopBtn = required<HTMLButtonElement>('open-shop')
const shopBackBtn = required<HTMLButtonElement>('shop-back')
const shopPlayBtn = required<HTMLButtonElement>('shop-play')
const shopBodyEl = required<HTMLElement>('shop-body')
const shopBalanceEl = required<HTMLElement>('shop-balance-n')
const menuBalanceEl = required<HTMLElement>('menu-balance')
const coinsLineEl = required<HTMLElement>('coins-line')
const coinsEarnedEl = required<HTMLElement>('coins-earned')
const toShopBtn = required<HTMLButtonElement>('to-shop')

// --- localStorage: high score and the "very first game" flag ------------------

// localStorage may throw (private mode, blocked data) - the game must work without it.
function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* not saved - no big deal */
  }
}

// --- language: saved choice, else browser language, else English (i18n/, all texts live there) ---

const storage = { get: storageGet, set: storageSet }

// Analytics (analytics/): five counter events, see analytics/events.ts. Off on local addresses and with any ?perf:
// then the counter script is not loaded at all (not even the visit is counted), and storage is not touched.
const analyticsOn = analyticsEnabled(location.hostname, isPerfDebugRequested(location.search))
const tracker = createTracker({
  enabled: analyticsOn,
  now: Date.now,
  storage,
  send: sendEvent,
  returnMinGapHours: analyticsCfg.returnMinGapHours,
})
if (analyticsOn) loadCounter()
initLanguage(storage, navigator)

// --- leaderboard (top N): pure logic in scores/leaderboard.ts, here only storage and display ---

const lbCfg = configJson.leaderboard as LeaderboardConfig

function saveTable(t: readonly ScoreEntry[]): void {
  storageSet(LEADERBOARD_KEY, JSON.stringify(t))
}

// The entry is saved immediately on death, and spinning the drum only marks it "dirty": writing to localStorage
// synchronously on every press (and on hold auto-repeat) is pointless. Flush to disk: on a timer
// after the last change, on "Done", on leaving the page and on hiding the tab, so a reload
// in the middle of entry does not lose the result (or the chosen symbols). 0 - write immediately, as before.
const SAVE_DEBOUNCE_MS = 400
let saveTimer = 0
let saveDirty = false

function flushSave(): void {
  window.clearTimeout(saveTimer)
  if (!saveDirty) return
  saveDirty = false
  saveTable(table)
  storageSet(INITIALS_KEY, initials)
}

function scheduleSave(): void {
  saveDirty = true
  window.clearTimeout(saveTimer)
  if (SAVE_DEBOUNCE_MS <= 0) flushSave()
  else saveTimer = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS)
}

window.addEventListener('pagehide', flushSave)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushSave()
})

// First launch of a new version: there is no table yet but there is an old single high score - it becomes one entry.
function loadTable(): ScoreEntry[] {
  const parsed = parseTable(storageGet(LEADERBOARD_KEY), lbCfg)
  if (parsed !== null) return parsed
  const migrated = migrateLegacy(storageGet(HIGH_SCORE_KEY), lbCfg)
  if (migrated.length > 0) saveTable(migrated)
  return migrated
}

let table: ScoreEntry[] = loadTable()
// The last chosen symbols are pre-filled in the drum by default.
let initials = sanitizeName(storageGet(INITIALS_KEY), lbCfg)

// The menu screen shows only the #1 high score (entry to the table); the full table is on the records screen.
function renderTopRecord(): void {
  recordLineBtn.disabled = !renderTopLine(recordLineBtn, table)
}

function renderBoards(highlight: number): void {
  renderTopRecord()
  renderBoard(recordsBoardEl, table, lbCfg.size, -1)
  renderBoard(gameOverBoardEl, table, lbCfg.size, highlight)
}

renderBoards(-1)

const drum = createDrum(drumEl, lbCfg)
// Index of the current game's entry while the drum is open; otherwise -1.
let pendingIndex = -1

/** The game ended: if the score made the table, the entry is set immediately with the remembered symbols. Index or -1. */
function commitRun(finalScore: number, durationMs: number): number {
  const entry: ScoreEntry = { score: finalScore, name: initials, durationMs, date: Date.now() }
  const r = insertEntry(table, entry, lbCfg)
  if (r.index >= 0) {
    table = r.table
    saveTable(table)
  }
  return r.index
}

function closeDrum(): void {
  flushSave()
  pendingIndex = -1
  drum.hide()
  drumBlockEl.classList.add('hidden')
  gameOverActionsEl.classList.remove('hidden')
  renderBoards(-1)
}

drumOkBtn.addEventListener('click', closeDrum)

// Reads the "this is the player's very first game" flag WITHOUT clearing it.
// It is cleared only when the camera transition actually happened (see consumeFirstGameEver):
// otherwise dying in the first steps would burn the twist intro, and the player would never see it.
function readIsFirstGameEver(): boolean {
  return storageGet(HAS_PLAYED_BEFORE_KEY) === null
}

// The intro happened - no more plane mode.
function consumeFirstGameEver(): void {
  storageSet(HAS_PLAYED_BEFORE_KEY, '1')
}

// --- sound: unlocks only on the first touch (AGENTS.md, section 5) ---

// The sound section may not exist in config.json yet - then sound is silently off (see view/audio.ts).
const soundConfig = (configJson as unknown as { sound?: SoundConfig }).sound

function readFlag(key: string, fallback: boolean): boolean {
  const raw = storageGet(key)
  return raw === null ? fallback : raw === '1'
}

const audio = createAudio(soundConfig, musicUrl, {
  musicOn: readFlag(MUSIC_ON_KEY, soundConfig?.defaults.musicOn ?? true),
  sfxOn: readFlag(SFX_ON_KEY, soundConfig?.defaults.sfxOn ?? true),
})

// Distance fog (palette.ts: createFog; density - config.fog.density): one toggle for everything.
let fogOn = readFlag(FOG_ON_KEY, configJson.fog.defaultOn)

// Idempotent: called from "Tap to play" and from any menu button (they are pressed BEFORE this screen).
function unlockAudio(): void {
  audio.unlock()
}

const soundToggleButtons = document.querySelectorAll<HTMLButtonElement>('button[data-snd]')

function syncSoundToggles(): void {
  for (const btn of soundToggleButtons) {
    const isMusic = btn.dataset['snd'] === 'music'
    const on = isMusic ? audio.musicOn : audio.sfxOn
    btn.textContent = t(`toggle.${isMusic ? 'music' : 'sfx'}.${on ? 'on' : 'off'}`)
    btn.classList.toggle('selected', on)
    btn.setAttribute('aria-pressed', String(on))
  }
}

// One delegate for all screen buttons (menu, pause, game over, explainer): unlock + click.
// In-game controls (pad, boost, pause) are not included - they are not the menu.
// Fires after the button's own handler, so turning sounds off does not click at the end.
document.addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof Element)) return
  const btn = target.closest('.screen button')
  if (btn === null) return
  unlockAudio()
  const snd = (btn as HTMLElement).dataset['snd']
  if (snd === 'music') {
    audio.setMusicOn(!audio.musicOn)
    storageSet(MUSIC_ON_KEY, audio.musicOn ? '1' : '0')
    syncSoundToggles()
  } else if (snd === 'sfx') {
    audio.setSfxOn(!audio.sfxOn)
    storageSet(SFX_ON_KEY, audio.sfxOn ? '1' : '0')
    syncSoundToggles()
  } else if ((btn as HTMLElement).dataset['fog'] !== undefined) {
    fogOn = !fogOn
    storageSet(FOG_ON_KEY, fogOn ? '1' : '0')
    syncFogToggles()
    session?.view.setFogOn(fogOn)
  } else {
    const q = (btn as HTMLElement).dataset['quality']
    if (isQualityId(q)) setQuality(q)
  }
  audio.play('click')
})

syncSoundToggles()

const fogToggleButtons = document.querySelectorAll<HTMLButtonElement>('button[data-fog]')

function syncFogToggles(): void {
  for (const btn of fogToggleButtons) {
    btn.textContent = t(fogOn ? 'toggle.fog.on' : 'toggle.fog.off')
    btn.classList.toggle('selected', fogOn)
    btn.setAttribute('aria-pressed', String(fogOn))
  }
}

syncFogToggles()

// Graphics quality (menu and pause): binds the MPix cap, antialiasing and bloom from config.json (quality.levels).
// Until the player has chosen, the tier is picked by window buffer size (not device type): phones and 1080p stay
// on "high" (the picture as always), a big monitor and retina get a tier lower. The choice is remembered.
const qualityCfg = configJson.quality as QualityConfig
const storedQuality = storageGet(QUALITY_KEY)
let qualityChosen = isQualityId(storedQuality)
let quality: QualityId = isQualityId(storedQuality)
  ? storedQuality
  : autoQuality(bufferMegapixels(window.innerWidth, window.innerHeight, window.devicePixelRatio), qualityCfg)
applyQualityLevel(qualityCfg.levels[quality])

const qualityButtons = document.querySelectorAll<HTMLButtonElement>('button[data-quality]')

function syncQualityButtons(): void {
  for (const btn of qualityButtons) {
    const on = btn.dataset['quality'] === quality
    btn.classList.toggle('selected', on)
    btn.setAttribute('aria-pressed', String(on))
  }
}

// Applied immediately, without restarting the game: the composer and buffers are reconfigured (View.applyPerf).
function setQuality(id: QualityId): void {
  quality = id
  qualityChosen = true
  storageSet(QUALITY_KEY, id)
  applyQualityLevel(qualityCfg.levels[id])
  syncQualityButtons()
  applyPerfNow()
  perfPanel?.refresh()
}

syncQualityButtons()

// --- menu: control scheme and pad side ------------------------
// (Arena size is no longer here: it is a shop item, see the "shop" block below.)

// The scheme lives on the settings screen, not in plain view: the choice is remembered between launches.
const storedScheme = storageGet(SCHEME_KEY)
let selectedScheme: InputScheme = storedScheme === 'taps' || storedScheme === 'swipes' ? storedScheme : 'swipes'

function markSelected(container: HTMLElement, datasetKey: 'scheme' | 'side', value: string): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>('button')
  for (const btn of buttons) {
    const isSelected = btn.dataset[datasetKey] === value
    btn.classList.toggle('selected', isSelected)
    btn.setAttribute('aria-pressed', String(isSelected))
  }
}

schemeOptions.addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof HTMLButtonElement)) return
  const raw = target.dataset['scheme']
  if (raw !== 'swipes' && raw !== 'taps') return
  selectedScheme = raw
  storageSet(SCHEME_KEY, raw)
  markSelected(schemeOptions, 'scheme', raw)
})

// Pad side (for left-handed players): remembered between launches, applied at game start.
let padSide: PadSide = parsePadSide(storageGet(PAD_SIDE_KEY))

padSideOptions.addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof HTMLButtonElement)) return
  padSide = parsePadSide(target.dataset['side'] ?? null)
  storageSet(PAD_SIDE_KEY, padSide)
  markSelected(padSideOptions, 'side', padSide)
})

markSelected(schemeOptions, 'scheme', selectedScheme)
markSelected(padSideOptions, 'side', padSide)

// Language switcher (two letters) - on the main screen and on both legal ones: see view/lang-switch.ts.
for (const id of ['menu-lang', 'warning-lang', 'terms-lang']) mountLangSwitch(required<HTMLElement>(id), storage)

// Dynamic strings (not marked data-i18n) are redrawn on language change.
onLanguageChange(() => {
  syncSoundToggles()
  syncFogToggles()
  drum.relabel()
  renderTopRecord()
})

// --- shop: item logic (shop/) + shop view (screens/shop-view.ts); here only storage and flow ---
// Coins go into the wallet at the end of a game (points in the leaderboard stay honest apples); buying and equipping
// happen in the shop view BEFORE a game, and what is chosen is applied at the start (startSession).

const shopRoot = configJson as unknown as ShopRoot
const shopItems = catalog(shopRoot)
// The wallet keeps the order "game start -> game end": you can earn only for an open game (screens/shop-flow.ts).
const wallet = createWallet(migrateShop(), shopRoot)

/**
 * Wallet loading. Arena size used to be chosen in settings (`snake:size`) and was free: for someone who has no
 * shop yet (no `snake:shop` key), the saved size remains their choice, even if in the shop it costs money.
 */
function migrateShop(): ShopState {
  const raw = storageGet(SHOP_KEY)
  const state = parse(raw, shopRoot)
  if (raw !== null) return state
  const oldSize = Number.parseInt(storageGet(SIZE_KEY) ?? '', 10)
  return Number.isFinite(oldSize) ? grandfatherArena(state, oldSize, shopRoot) : state
}

/** Arena size of the next game: what is equipped in the shop. */
function currentArena(): number {
  return gameSetup(wallet.state, shopRoot).size
}
let shopUnlocked = isShopUnlocked({ finishedGame: storageGet(SHOP_UNLOCKED_KEY) === '1', hasRecords: table.length > 0 })

function saveShop(): void {
  storageSet(SHOP_KEY, serialize(wallet.state))
}

/** Shop icon on the main screen: hidden until the first finished game. */
function syncShopEntry(): void {
  openShopBtn.classList.toggle('hidden', !shopUnlocked)
}

function unlockShop(): void {
  if (shopUnlocked) return
  shopUnlocked = true
  storageSet(SHOP_UNLOCKED_KEY, '1')
  syncShopEntry()
}

const shopView = createShopView(shopBodyEl, shopBalanceEl, menuBalanceEl, {
  config: shopRoot,
  items: () => shopItems,
  state: () => wallet.state,
  obstacleGeometry: configJson.obstacles,
  onBuy(item: Item) {
    if (wallet.buy(item)) saveShop()
    shopView.render()
  },
  onEquip(item: Item) {
    if (wallet.equip(item)) saveShop()
    shopView.render()
  },
})
shopView.render()
syncShopEntry()
onLanguageChange(() => shopView.render())

/** Number for the boost button label: 1.5 -> "×1.5", 4.000001 -> "×4". The active factor is used, not the purchased one (boosted-step floor). */
function boostLabel(factor: number): string {
  return `×${Math.round(factor * 10) / 10}`
}

let shownBoostLabel = ''
/** Boost button label: the active factor (with the boosted-step floor applied), updated on every apple - the step changes only then. */
function setBoostLabel(state: GameState): void {
  const label = boostLabel(effectiveBoostFactor(state))
  if (label === shownBoostLabel) return
  shownBoostLabel = label
  boostEl.textContent = label
}

/** The game ended (by death or by exit): apples -> coins. No open game - nothing is credited. */
function settleRun(apples: number): { gained: number; mult: number } {
  const r = wallet.settle(apples)
  saveShop()
  shopView.render()
  return r ?? { gained: 0, mult: 1 }
}

function openShop(): void {
  const fromOver = screens.state.base === 'over'
  screens.openShop()
  if (screens.state.base !== 'shop') return
  if (fromOver) endSession() // a dead session is no longer needed: from here only a new game or the menu
  shopView.reset()
}

// --- screens: what is shown now is decided by screens/screens.ts (pure logic with tests), here only display ---
// Legal screens: the flashing-lights warning - on every open, the terms - until consent is saved
// (legal/flow.ts, inside screens). The language is already chosen by now (initLanguage above) and changes on the screens themselves.
// The buttons are inside .screen, so the common delegate above unlocks sound on this same touch: it is not "swallowed".
const screenEls: Record<ScreenId, HTMLElement> = {
  warning: legalWarningScreen,
  terms: legalTermsScreen,
  menu: menuScreen,
  settings: settingsScreen,
  records: recordsScreen,
  shop: shopScreen,
  hud,
  over: gameOverScreen,
  pause: pauseScreen,
  demo: demoScreen,
}

// The "text continues" hint: class more while unread content remains below the visible part (styles are in index.html).
const legalBodies = [legalWarningScreen, legalTermsScreen].map((s) => s.querySelector<HTMLElement>('.legal-body')!)
function updateLegalMore(): void {
  for (const b of legalBodies) b.classList.toggle('more', b.scrollHeight - b.scrollTop - b.clientHeight > 4)
}
for (const b of legalBodies) b.addEventListener('scroll', updateLegalMore, { passive: true })
window.addEventListener('resize', updateLegalMore)
onLanguageChange(updateLegalMore)

let shownLegal: ScreenState['legal'] = null
function renderScreens(s: ScreenState): void {
  const visible = visibleScreens(s)
  for (const id of ALL_SCREENS) screenEls[id].classList.toggle('hidden', !visible.has(id))
  // Keyboard and screen reader must not go to the screen underneath the legal one.
  const covered = s.legal !== null
  menuScreen.inert = covered
  settingsScreen.inert = covered
  recordsScreen.inert = covered
  shopScreen.inert = covered
  updateLegalMore()
  if (s.legal !== shownLegal) {
    shownLegal = s.legal
    if (s.legal === 'warning') legalWarningOkBtn.focus({ preventScroll: true })
    else if (s.legal === 'terms') legalTermsOkBtn.focus({ preventScroll: true })
  }
}

const screens = createScreens(storage, renderScreens)
renderScreens(screens.state) // the markup starts with the warning visible: bring it to the pre-first-show state

legalWarningOkBtn.addEventListener('click', () => screens.confirmLegal())
legalTermsOkBtn.addEventListener('click', () => screens.confirmLegal())
recordLineBtn.addEventListener('click', () => screens.openRecords())
openSettingsBtn.addEventListener('click', () => screens.openSettings())
openShopBtn.addEventListener('click', openShop)
toShopBtn.addEventListener('click', openShop)
shopBackBtn.addEventListener('click', () => screens.back())
for (const btn of backButtons) btn.addEventListener('click', () => screens.back())
// Escape on settings and records - back (in game it is read by the game's input, where back does nothing).
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') screens.back()
})
// A self-starting measurement (?perf=bench, ?perf=freeze) starts on its own after half a second: an opaque screen over
// the canvas would spoil the numbers, so screens are skipped (consent is not written). A plain ?perf does not touch screens.
if (isSelfStartingPerfMode(location.search)) screens.skipLegal()
else screens.start()

// --- game session ------------------------------------------------------

interface Session {
  state: GameState
  view: View
  detachInput: () => void
  /** Pad of the 'taps' scheme; null in 'swipes'. */
  pad: Pad | null
  /** Boost button (both schemes). */
  boostBtn: BoostButton
  /** Camera turn stick (both schemes). */
  stick: Stick
  /** Boost sources (finger on the button, Shift/Space): on while at least one holds. */
  boost: BoostHold
  /** Current camera mode; mirrors GameState.mode via the modeChanged event. */
  mode: 'plane' | 'free'
  /** Show the explainer screen at the transition (only the player's very first game). */
  explainTransition: boolean
  /** A real game (not a ?perf measurement): only these go to analytics. */
  counted: boolean
}

let session: Session | null = null

// --- performance debugging (view/perf-panel.ts, view/perf-bench.ts) ---------------------------
// Off by default: panel and bench stay null, nothing is created or counted.
let perfPanel: PerfPanel | null = null
let bench: BenchRun | null = null
/** A benchmark is running: game logic frozen, input ignored, the game cannot die. */
let benchActive = false

// Pause lives in screens (the core does not know about it): while paused, tick() is simply not called.
// Two independent causes: the tab is hidden / the button (needs a "Resume" tap) and the demo-turn screen.
function isPaused(): boolean {
  return isHeld(screens.state) || benchActive
}

// Parameters of the last game - "Again" restarts with them.
let lastScheme: InputScheme = 'swipes'

function syncViewSize(view: View): void {
  view.resize(canvas.clientWidth, canvas.clientHeight)
}

function handleGameEvent(ev: GameEvent, next: GameEvent | undefined, s: Session): void {
  switch (ev.type) {
    case 'started':
      audio.newRound()
      break
    case 'ate':
      audio.play('eat')
      hudScore.textContent = String(ev.score)
      setBoostLabel(s.state)
      break
    case 'moved':
      // Step tick: quieter and less frequent as pace grows (see blips.tick). Apple and death in this same step
      // bring their own sound (events follow moved), the tick under them is not needed.
      if (next === undefined || (next.type !== 'ate' && next.type !== 'died')) audio.play('tick', effectiveStepMs(s.state))
      s.pad?.clearQueued()
      break
    case 'turnedInPlace':
      // The snake executed the command - clear the "accepted, waiting for a step" highlight on the pad.
      s.pad?.clearQueued()
      break
    case 'modeChanged':
      // The flat snake became volumetric: no third axis any more, hide its pad buttons.
      s.mode = ev.mode
      showPad(lastScheme, s.mode)
      // Clear the flag only here: the twist intro actually happened.
      if (ev.mode === 'free') consumeFirstGameEver()
      if (ev.mode === 'free' && s.explainTransition && s.counted) tracker.twistSeen()
      // The pause screen - only in the player's very first game; later the transition is silent.
      // The camera finishes its flight meanwhile (render keeps running).
      if (s.explainTransition && ev.mode === 'free') {
        screens.openDemo()
        s.stick.release()
        s.boost.releaseAll() // the explainer screen covers the buttons: do not leave boost stuck
      }
      break
    case 'died': {
      queueMicrotask(syncPerfVisibility) // session.state is already dead, but check after handling the event
      s.boost.releaseAll()
      s.stick.release()
      s.pad?.clearQueued()
      padEl.classList.add('hidden')
      hideBoostAndPause()
      const finalScore = score(s.state)
      const durationMs = elapsedMs(s.state)
      finalScoreEl.textContent = String(finalScore)
      finalTimeEl.textContent = formatDuration(durationMs)
      const { gained, mult } = settleRun(finalScore)
      unlockShop()
      coinsLineEl.classList.toggle('hidden', gained <= 0)
      coinsEarnedEl.textContent = t('over.coins', { n: gained }) + (mult > 1 ? ` ×${Math.round(mult * 100) / 100}` : '')
      toShopBtn.classList.toggle('hidden', !hasAffordableNew(wallet.state, shopRoot, configJson.obstacles))
      // The game-over screen and the death sound start in one handler: the caption animation and the sound hit start together.
      pendingIndex = commitRun(finalScore, durationMs)
      renderBoards(pendingIndex)
      if (pendingIndex >= 0) {
        // Made it into the table: the drum instead of buttons until the player presses "Done". The entry is already saved; drum turns are flushed to disk lazily (scheduleSave).
        gameOverActionsEl.classList.add('hidden')
        drumBlockEl.classList.remove('hidden')
        drum.show(
          initials,
          (name) => {
            if (pendingIndex < 0) return
            initials = name
            table = renameEntry(table, pendingIndex, name)
            scheduleSave()
            // The menu under the game-over screen is hidden: redraw only the visible table (the menu is updated by closeDrum).
            renderBoard(gameOverBoardEl, table, lbCfg.size, pendingIndex)
          },
          closeDrum,
        )
      } else {
        closeDrum()
      }
      audio.play('death')
      screens.died()
      if (s.counted) tracker.gameFinished()
      break
    }
    default:
      break
  }
}

function dispatchEvents(s: Session, events: GameEvent[]): void {
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    if (ev === undefined) continue
    s.view.handle(ev, s.state)
    handleGameEvent(ev, events[i + 1], s)
  }
}

function hideBoostAndPause(): void {
  boostEl.classList.add('hidden')
  pauseBtn.classList.add('hidden')
  camResetBtn.classList.add('hidden')
  stickEl.classList.add('hidden')
}

function showBoostAndPause(): void {
  // Boost and camera reset - on the pad side (right by default). In 'taps' "×2" sits in the center
  // of the cross, reset above the pad; in 'swipes' there is no pad, "×2" stands in the corner of this side, reset above it.
  const right = padSide === 'right'
  boostEl.classList.toggle('side-right', right)
  camResetBtn.classList.toggle('right', right)
  boostEl.classList.remove('hidden')
  pauseBtn.classList.remove('hidden')
  camResetBtn.classList.remove('hidden')
  // The stick - on the side opposite the pad/"×2", so as not to share a corner with them.
  stickEl.classList.toggle('side-right', !right)
  stickEl.classList.remove('hidden')
}

// --- player camera: tilt and zoom persist until an explicit reset ---------------

const ZOOM_MIN = configJson.camera.zoomMin
const ZOOM_MAX = configJson.camera.zoomMax

// The reset button dims while the camera is at its default view: it shows there is nothing to press.
function syncCamResetButton(): void {
  const idle = userCamera.yaw === 0 && userCamera.pitch === 0 && userCamera.zoom === 1
  camResetBtn.classList.toggle('idle', idle)
}

// A single reset point for tilt and zoom: the on-screen button, the R key and game start. Works during pause too:
// the target is zeroed immediately (the button sits above the pause overlay), the picture catches up after "Resume"
// (on manual pause frames are not drawn, on the demo-turn screen they are).
function resetCamera(): void {
  resetUserCamera()
  syncCamResetButton()
}

camResetBtn.addEventListener('click', resetCamera)

// Camera turn stick: deflection sets speed. The numbers are in config.json (input.stick); the size goes to CSS.
const stickCfg = configJson.input.stick
const stickTuning = { deadZone: stickCfg.deadZone, curve: stickCfg.curve, tapMaxMs: stickCfg.tapMaxMs }
stickEl.style.setProperty(
  '--stick',
  `clamp(${stickCfg.sizeMinPx}px, ${stickCfg.sizeVmin}vmin, ${stickCfg.sizeMaxPx}px)`,
)

// Hot path (every frame): in-place arithmetic only, no objects. The limits are the same as for the two-finger tilt.
function applyStick(x: number, y: number, dtMs: number): void {
  userCamera.yaw = accumulateTilt(userCamera.yaw, stickStep(x, stickCfg.maxRadPerSec, dtMs), 1, TILT_LIMIT_RAD)
  userCamera.pitch = accumulateTilt(userCamera.pitch, stickStep(y, stickCfg.maxRadPerSec, dtMs), 1, TILT_LIMIT_RAD)
  syncCamResetButton()
}

function syncPerfVisibility(): void {
  perfPanel?.setShown(session !== null && isAlive(session.state))
}

function endSession(): void {
  padEl.classList.add('hidden')
  hideBoostAndPause()
  if (session === null) return
  session.boost.releaseAll()
  session.detachInput()
  session.view.dispose()
  session = null
  syncPerfVisibility()
}

const padCrossEl = required<HTMLElement>('pad-cross')
const boostHomeEl = boostEl.parentElement ?? document.body

// "×2" moves to the center of the cross (taps) or back to the corner (swipes). Move only on a change of place:
// re-inserting in the same place would break a held touch.
function dockBoost(inCross: boolean): void {
  const target = inCross ? padCrossEl : boostHomeEl
  if (boostEl.parentElement !== target) target.appendChild(boostEl)
  boostEl.classList.toggle('in-cross', inCross)
  camResetBtn.classList.toggle('above-pad', inCross)
  stickEl.classList.toggle('beside-pad', inCross) // the stick lines up horizontally with the cross
}

function showPad(scheme: InputScheme, mode: 'plane' | 'free'): void {
  dockBoost(scheme === 'taps')
  if (scheme !== 'taps') {
    padEl.classList.add('hidden')
    return
  }
  // In 'free' mode the third-axis buttons are not shown, the four arrows remain.
  padEl.classList.toggle('no-axis', mode === 'free')
  padEl.classList.toggle('left', padSide === 'left')
  padEl.classList.remove('hidden')
}

function startSession(size: number, scheme: InputScheme, forBench = false): void {
  endSession()
  if (!forBench) lastScheme = scheme

  // Tilt and zoom from the previous game do not carry over to the new one: otherwise one could start a game at an unplayable angle
  // and not understand why. Reset at start (not on exit) - so the "Again" button is clean too.
  resetCamera()

  const isFirstGameEver = forBench ? false : readIsFirstGameEver()
  // In the first game the core starts in 'plane' and switches at step demo.afterSteps,
  // in all following ones - straight to 'free'. s.mode below mirrors this and is updated by modeChanged.
  const seed = forBench ? BENCH_SEED : Math.floor(Math.random() * 0x7fffffff)
  // Measurement and freeze run with the boost from the config and do not touch the wallet; a normal game spends a game on temporary
  // items and takes the equipped boost.
  if (!forBench) {
    wallet.begin()
    saveShop()
  }
  // What is equipped in the shop is applied here: boost, obstacles, pace (arena size came as the size parameter).
  const setup = forBench ? null : gameSetup(wallet.state, shopRoot)
  const boostFactor = setup === null ? config.speed.boostFactor : setup.boostFactor
  const state = createGame(config, size, seed, isFirstGameEver, boostFactor, setup === null ? {} : { obstacleMult: setup.obstacleMult, paceScale: setup.paceScale })
  setBoostLabel(state)
  // Shop cosmetics: the palette and skins arrive as strings from the payload, the view knows nothing about the shop.
  // In measurement the equipped items are not applied - otherwise the numbers would depend on what has been bought.
  const worn = (slot: Slot, key: 'palette' | 'skin'): string | undefined =>
    forBench
      ? undefined
      : (equippedItem(wallet.state, shopRoot, slot)?.payload as { palette?: string; skin?: string } | undefined)?.[key]
  const view = createView(canvas, config, state, {
    palette: worn('palette', 'palette'),
    snakeSkin: worn('snakeSkin', 'skin'),
    appleSkin: worn('appleSkin', 'skin'),
    compassSkin: worn('compassSkin', 'skin'),
  })
  view.setFogOn(fogOn)

  // Boost is on while at least one source holds: a finger on the button or Shift/Space.
  // Any release (finger left, cancel, blur, pause, death, detach) arrives here as on=false.
  const boost: BoostHold = createBoostHold((on) => {
    if (benchActive) return // measurement: logic is frozen, boost is not needed
    s.boostBtn.setActive(on)
    dispatchEvents(s, setBoost(s.state, on))
  })
  const boostBtn = attachBoostButton(boostEl, {
    onTurn: () => {},
    onAxis: () => {},
    onBoost: (on) => (on ? boost.press('btn') : boost.release('btn')),
  })

  const stick = attachStick(stickEl, stickKnobEl, stickTuning, resetCamera)
  const s: Session = {
    state,
    view,
    detachInput: () => {
      /* overridden below - attachInput needs an already assembled `s` for closures */
    },
    pad: null,
    boostBtn,
    stick,
    boost,
    mode: gameMode(state),
    explainTransition: isFirstGameEver,
    counted: !forBench,
  }

  const handlers: InputHandlers = {
    onTurn(dir: ScreenDir) {
      if (isPaused()) return
      dispatchEvents(s, turnInPlane(s.state, dir))
    },
    onAxis(dir: AxisDir) {
      if (isPaused() || s.mode === 'free') return
      dispatchEvents(s, turnAxis(s.state, dir))
    },
    axisEnabled: () => s.mode === 'plane',
    onBoost: (on) => (on ? boost.press('kbd') : boost.release('kbd')),
    onPause: () => {
      if (benchActive) {
        if (bench !== null) bench.abort('cancelled with Escape')
        else exitFreeze()
        return
      }
      // Escape: from the game - to pause, from pause - back to the game.
      if (isPaused()) resumeFromPause()
      else pauseNow()
    },
    onCameraTiltBy(dYaw: number, dPitch: number) {
      if (isPaused()) return
      userCamera.yaw = accumulateTilt(userCamera.yaw, dYaw, 1, TILT_LIMIT_RAD)
      userCamera.pitch = accumulateTilt(userCamera.pitch, dPitch, 1, TILT_LIMIT_RAD)
      syncCamResetButton()
    },
    onCameraZoomBy(factor: number) {
      if (isPaused()) return
      userCamera.zoom = clampZoom(userCamera.zoom * factor, ZOOM_MIN, ZOOM_MAX)
      syncCamResetButton()
    },
    onCameraReset: resetCamera,
  }

  const detachCanvasInput = attachInput(canvas, scheme, config, handlers)
  if (scheme === 'taps') {
    const pad = attachPad(padEl, handlers)
    s.pad = pad
    s.detachInput = () => {
      pad.detach()
      detachCanvasInput()
      boostBtn.detach()
      stick.detach()
    }
  } else {
    s.detachInput = () => {
      detachCanvasInput()
      boostBtn.detach()
      stick.detach()
    }
  }
  session = s

  screens.startGame()
  hudScore.textContent = '0'
  showPad(scheme, s.mode)
  showBoostAndPause()

  syncViewSize(view)
  dispatchEvents(s, startGame(s.state))
  if (s.counted) tracker.gameStarted()

  lastFrameTime = null
  syncPerfVisibility()
}

function returnToMenu(): void {
  // Exiting from pause mid-game: the accumulated score goes to the table with the remembered symbols, as on death (without the drum).
  if (session !== null && isAlive(session.state) && !benchActive) {
    commitRun(score(session.state), elapsedMs(session.state))
    if (settleRun(score(session.state)).gained > 0) unlockShop()
  }
  closeDrum()
  screens.toMenu()
  endSession()
}

tapToPlayBtn.addEventListener('click', () => {
  unlockAudio()
  startSession(currentArena(), selectedScheme)
})

// "Play" in the shop: a game with the current settings and what is equipped (the button is inside .screen: sound is unlocked by the common delegate).
shopPlayBtn.addEventListener('click', () => startSession(currentArena(), selectedScheme))

// "Again" - a new game with the same size and scheme, without returning to the menu.
playAgainBtn.addEventListener('click', () => startSession(currentArena(), lastScheme))
toMenuBtn.addEventListener('click', returnToMenu)
pauseToMenuBtn.addEventListener('click', returnToMenu)

// --- pause: tab hidden and the demo-turn screen -------------------

function resumeFromPause(): void {
  screens.resume()
  lastFrameTime = null // we do not live through the skipped time
}

// The single entry point to pause: both tab hiding and the "pause" button come here.
function pauseNow(): void {
  const s = session
  if (benchActive) return
  if (s === null || !isAlive(s.state) || !screens.pause()) return
  // Boost is always turned off on pause: after "Resume" the player holds it again themselves.
  s.boost.releaseAll()
  s.stick.release()
  // The pause screen is not shown over the demo screen (screens): after the demo closes it appears by itself.
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastFrameTime = null
    // iOS suspends the context on minimize and after a call; the game stands paused until "Resume" meanwhile.
    audio.resume()
    return
  }
  audio.suspend() // a background tab must not play music
  if (benchActive) bench?.abort('tab was hidden during the run')
  pauseNow()
})

pauseBtn.addEventListener('click', pauseNow)

resumeBtn.addEventListener('click', resumeFromPause)

demoContinueBtn.addEventListener('click', () => {
  screens.closeDemo() // if the tab was minimized while the demo screen was up, the pause screen will appear by itself
  lastFrameTime = null
})

// --- debug panel and benchmark ----------------------------------------
// Enable: the ` (Backquote) key or the ?perf address parameter (?perf=bench - also starts the measurement immediately).

const perfSnap = createPerfSnapshot()

function applyPerfNow(): void {
  session?.view.applyPerf(canvas.clientWidth, canvas.clientHeight)
}

function ensurePerfPanel(): PerfPanel {
  if (perfPanel === null) {
    perfPanel = createPerfPanel({
      sample(out) {
        const sn = session
        if (sn === null) return
        sn.view.readPerf(out)
        out.arena = cubeSize(sn.state)
        out.snakeLength = snakeLength(sn.state)
      },
      apply: applyPerfNow,
      startBench,
      resultClosed() {},
    })
  }
  syncPerfVisibility()
  return perfPanel
}

function startBench(): void {
  if (bench !== null && bench.running) return
  const panel = ensurePerfPanel()
  panel.open()
  const saved = { ...perf }
  // One scene for all stages: arena 100, fixed seed, free mode, logic frozen (benchActive).
  benchActive = true
  startSession(BENCH_ARENA, 'swipes', true)
  perf.fog = true
  perf.miniMap = true
  const run = new BenchRun(
    {
      applyStage(stage) {
        applyBenchStage(stage)
        applyPerfNow()
      },
      sample(out) {
        const sn = session
        if (sn !== null) sn.view.readPerf(out)
      },
      finished(results: readonly StageResult[], aborted: string | null) {
        const sn = session
        let text: string
        if (sn === null) {
          text = `SNAKE BENCH v1 (INCOMPLETE: ${aborted ?? 'session lost'})`
        } else {
          const env = collectBenchEnv(sn.view.gpuInfo(), {
            arena: cubeSize(sn.state),
            snakeLength: snakeLength(sn.state),
            mode: `${gameMode(sn.state)}, fog menu toggle ${fogOn ? 'on' : 'off'}`,
            seed: BENCH_SEED,
            language: currentLanguage().code,
            quality: `${quality} (${qualityChosen ? 'chosen by player' : 'auto, by GPU class and buffer size'})`,
          })
          text = formatBenchLog(env, results, aborted)
        }
        Object.assign(perf, saved)
        applyPerfNow()
        returnToMenu() // benchActive is still true: the score of the empty game does not go into the table
        benchActive = false
        bench = null
        panel.setBench(null)
        panel.showResult(text)
      },
    },
    perfSnap,
  )
  bench = run
  run.start(performance.now())
  panel.setBench(run) // after start: the banner is shown only while the run is going
}

// ?perf=freeze: the same frozen scene as the benchmark, but without running the stages: you can calmly flip the
// panel toggles and compare frames (quality tier screenshots). Escape - exit to the menu.
function startFreeze(): void {
  if (benchActive) return
  ensurePerfPanel().open()
  benchActive = true
  startSession(BENCH_ARENA, 'swipes', true)
}

function exitFreeze(): void {
  returnToMenu()
  benchActive = false
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Backquote' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
  const tg = e.target as HTMLElement | null
  if (tg !== null && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return
  e.preventDefault()
  if (benchActive && bench !== null) return
  ensurePerfPanel().toggle()
})

{
  const p = new URLSearchParams(location.search).get('perf')
  if (isPerfDebugRequested(location.search)) {
    ensurePerfPanel().open()
    if (p === 'bench') setTimeout(startBench, 500)
    else if (p === 'freeze') setTimeout(startFreeze, 500)
  }
}

// --- resize/screen rotation: the UI and canvas must survive it -------------

function onWindowResize(): void {
  if (session !== null) syncViewSize(session.view)
}

window.addEventListener('resize', onWindowResize)
window.addEventListener('orientationchange', onWindowResize)

// --- game loop: requestAnimationFrame, dt passed to the core, no allocations/await ---

// Whether to draw the scene under the game-over screen (it is opaque, so it is wasted). true - the old behavior.
const RENDER_WHEN_DEAD = false

let lastFrameTime: number | null = null

function frame(now: number): void {
  requestAnimationFrame(frame)
  // Debugging off (default) - both variables are null, the frame has a single check.
  if (perfPanel === null) {
    step(now)
    return
  }
  perfPanel.beginFrame(now)
  const t0 = performance.now()
  step(now)
  const jsMs = performance.now() - t0
  if (bench !== null) bench.frame(now, jsMs)
  perfPanel.endFrame(jsMs)
}

function step(now: number): void {
  const s = session
  if (s === null) return

  // dt ceiling: even without pause (lag, debugger) the core does not do a batch of steps and a death in one frame.
  const rawDt = lastFrameTime === null ? 0 : now - lastFrameTime
  const dtMs = rawDt > config.loop.maxFrameMs ? config.loop.maxFrameMs : rawDt
  lastFrameTime = now

  if (screens.state.paused) return
  if (!screens.state.demo && !benchActive) {
    dispatchEvents(s, tick(s.state, config, dtMs))
    const st = s.stick.state
    if (st.x !== 0 || st.y !== 0) applyStick(st.x, st.y, dtMs)
  }
  // The game-over screen is opaque and fully covers the canvas: drawing the scene with postprocessing behind it
  // is pointless (a full GPU frame competes with drum presses). RENDER_WHEN_DEAD = true brings it back as it was.
  if (!RENDER_WHEN_DEAD && !isAlive(s.state)) return
  // On demo pause render keeps going: the camera finishes the roll behind the explainer screen.
  s.view.render(s.state, dtMs)
}

requestAnimationFrame(frame)
