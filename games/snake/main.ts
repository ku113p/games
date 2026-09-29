// main.ts — точка сборки игры: связывает core/ (правила), view/ (three.js) и input/
// (тач + клавиатура). Держит requestAnimationFrame-цикл. Никаких аллокаций и await в кадре.

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
import { SHOP_STORAGE_KEY, catalog, gameSetup, parse, serialize, type Item, type ShopRoot, type ShopState } from './shop'
import { createWallet, grandfatherArena, hasAffordableNew, isShopUnlocked } from './screens/shop-flow'
import { createShopView } from './screens/shop-view'
import musicUrl from './assets/music/cyber-runner.mp3'
import configJson from './config.json'
import analyticsCfg from './analytics/config.json'
import { analyticsEnabled, createTracker } from './analytics/events'
import { loadCounter, sendEvent } from './analytics/goatcounter'

const config = configJson as Config

const HIGH_SCORE_KEY = 'snake:highScore' // старый одиночный рекорд: читается только для переноса в таблицу
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
const SHOP_KEY = SHOP_STORAGE_KEY // кошелёк, купленное и надетое (shop/serialize)
const SHOP_UNLOCKED_KEY = 'snake:shopUnlocked' // была ли закончена хоть одна партия: до неё вход в магазин спрятан

// --- DOM ---------------------------------------------------------------

function required<T extends Element>(id: string): T {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`main.ts: элемент #${id} не найден в index.html`)
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

// --- localStorage: рекорд и флаг «первая игра вообще» ------------------

// localStorage может бросать (приватный режим, заблокированные данные) — игра должна жить и без него.
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
    /* не сохранилось — не страшно */
  }
}

// --- язык: сохранённый выбор, иначе язык браузера, иначе английский (i18n/, все тексты — там) ---

const storage = { get: storageGet, set: storageSet }

// Аналитика (analytics/): пять событий-счётчиков, см. analytics/events.ts. Выключена на локальных адресах и при любом ?perf:
// тогда скрипт счётчика не подключается совсем (не считается даже посещение), а хранилище не трогается.
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

// --- таблица лучших (топ-N): чистая логика в scores/leaderboard.ts, здесь только хранение и показ ---

const lbCfg = configJson.leaderboard as LeaderboardConfig

function saveTable(t: readonly ScoreEntry[]): void {
  storageSet(LEADERBOARD_KEY, JSON.stringify(t))
}

// Запись сохраняется сразу при смерти, а вращение барабана только помечает её «грязной»: на каждое
// нажатие (и на автоповтор удержания) писать в localStorage синхронно незачем. Сброс на диск: по таймеру
// после последнего изменения, при «Готово», уходе со страницы и скрытии вкладки, так что перезагрузка
// посреди ввода результат (и выбранные буквы) не теряет. 0 — писать сразу, как раньше.
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

// Первый запуск новой версии: таблицы ещё нет, а старый одиночный рекорд есть — он становится одной записью.
function loadTable(): ScoreEntry[] {
  const parsed = parseTable(storageGet(LEADERBOARD_KEY), lbCfg)
  if (parsed !== null) return parsed
  const migrated = migrateLegacy(storageGet(HIGH_SCORE_KEY), lbCfg)
  if (migrated.length > 0) saveTable(migrated)
  return migrated
}

let table: ScoreEntry[] = loadTable()
// Последние выбранные символы подставляются в барабан по умолчанию.
let initials = sanitizeName(storageGet(INITIALS_KEY), lbCfg)

// Главный экран показывает только рекорд №1 (вход в таблицу); полная таблица — на экране рекордов.
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
// Индекс записи текущей партии, пока барабан открыт; иначе -1.
let pendingIndex = -1

/** Партия закончилась: если счёт попал в таблицу, запись ставится сразу с запомненными символами. Индекс или -1. */
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

// Читает флаг «это вообще первая партия игрока», НЕ гася его.
// Гасится он только когда переезд камеры реально случился (см. consumeFirstGameEver):
// иначе смерть на первых ходах сожгла бы знакомство с твистом, и игрок не увидел бы его никогда.
function readIsFirstGameEver(): boolean {
  return storageGet(HAS_PLAYED_BEFORE_KEY) === null
}

// Знакомство состоялось — больше плоской фазы не будет.
function consumeFirstGameEver(): void {
  storageSet(HAS_PLAYED_BEFORE_KEY, '1')
}

// --- звук: разблокируется только по первому касанию (AGENTS.md, раздел 5) ---

// Секции sound в config.json может ещё не быть — тогда звук молча выключен (см. view/audio.ts).
const soundConfig = (configJson as unknown as { sound?: SoundConfig }).sound

function readFlag(key: string, fallback: boolean): boolean {
  const raw = storageGet(key)
  return raw === null ? fallback : raw === '1'
}

const audio = createAudio(soundConfig, musicUrl, {
  musicOn: readFlag(MUSIC_ON_KEY, soundConfig?.defaults.musicOn ?? true),
  sfxOn: readFlag(SFX_ON_KEY, soundConfig?.defaults.sfxOn ?? true),
})

// Туман по дальности (palette.ts: createFog; плотность — config.fog.density): один тумблер на всё.
let fogOn = readFlag(FOG_ON_KEY, configJson.fog.defaultOn)

// Идемпотентно: зовётся из «Tap to play» и из любой кнопки меню (они нажимаются ДО этого экрана).
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

// Один делегат на все кнопки экранов (меню, пауза, конец игры, объяснение): разблокировка + щелчок.
// Кнопки игровых органов (пульт, ускорение, пауза) сюда не входят — это не меню.
// Срабатывает после обработчика самой кнопки, поэтому выключение звуков не щёлкает напоследок.
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

// Качество графики (меню и пауза): связка потолка МПикс, сглаживания и свечения из config.json (quality.levels).
// Пока игрок не выбирал, ступень берётся по размеру буфера окна (не по типу устройства): телефон и 1080p остаются
// на «высоком» (картинка как всегда), большой монитор и ретина получают ступень ниже. Выбор запоминается.
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

// Применяется сразу, без перезапуска партии: композер и буферы перенастраиваются (View.applyPerf).
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

// --- меню: схема управления и сторона пульта ------------------------
// (Размер арены больше не здесь: он товар магазина, см. блок «магазин» ниже.)

// Схема лежит на экране настроек, а не на виду: выбор запоминается между запусками.
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

// Сторона пульта (для левшей): запоминается между запусками, применяется на старте партии.
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

// Переключатель языка (две буквы) — на главном экране и на обоих юридических: см. view/lang-switch.ts.
for (const id of ['menu-lang', 'warning-lang', 'terms-lang']) mountLangSwitch(required<HTMLElement>(id), storage)

// Динамические строки (не размеченные data-i18n) перерисовываются на смену языка.
onLanguageChange(() => {
  syncSoundToggles()
  syncFogToggles()
  drum.relabel()
  renderTopRecord()
})

// --- магазин: предметная часть (shop/) + витрина (screens/shop-view.ts); здесь только хранение и поток ---
// Монеты идут в кошелёк по итогам партии (очки в таблице рекордов остаются честными яблоками); покупка и надевание
// происходят на витрине ДО партии, а выбранное применяется на старте (startSession).

const shopRoot = configJson as unknown as ShopRoot
const shopItems = catalog(shopRoot)
// Кошелёк держит порядок «начало партии -> конец партии»: начислить можно только за открытую партию (screens/shop-flow.ts).
const wallet = createWallet(migrateShop(), shopRoot)

/**
 * Загрузка кошелька. Размер арены раньше выбирался в настройках (`snake:size`) и был бесплатным: у того, у кого магазина
 * ещё нет (ключа `snake:shop` нет), сохранённый размер остаётся его выбором, даже если в магазине он стоит денег.
 */
function migrateShop(): ShopState {
  const raw = storageGet(SHOP_KEY)
  const state = parse(raw, shopRoot)
  if (raw !== null) return state
  const oldSize = Number.parseInt(storageGet(SIZE_KEY) ?? '', 10)
  return Number.isFinite(oldSize) ? grandfatherArena(state, oldSize, shopRoot) : state
}

/** Размер арены следующей партии: то, что надето в магазине. */
function currentArena(): number {
  return gameSetup(wallet.state, shopRoot).size
}
let shopUnlocked = isShopUnlocked({ finishedGame: storageGet(SHOP_UNLOCKED_KEY) === '1', hasRecords: table.length > 0 })

function saveShop(): void {
  storageSet(SHOP_KEY, serialize(wallet.state))
}

/** Иконка магазина на главном экране: спрятана до первой законченной партии. */
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

/** Число для подписи кнопки ускорения: 1.5 -> «×1.5», 4.000001 -> «×4». Берётся действующий множитель, а не купленный (пол на шаг). */
function boostLabel(factor: number): string {
  return `×${Math.round(factor * 10) / 10}`
}

let shownBoostLabel = ''
/** Подпись кнопки ускорения: действующий множитель (с учётом пола на шаг), обновляется на каждом яблоке — шаг меняется только тогда. */
function setBoostLabel(state: GameState): void {
  const label = boostLabel(effectiveBoostFactor(state))
  if (label === shownBoostLabel) return
  shownBoostLabel = label
  boostEl.textContent = label
}

/** Партия кончилась (смертью или выходом): яблоки -> монеты. Нет открытой партии — ничего не начисляется. */
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
  if (fromOver) endSession() // мёртвая сессия больше не нужна: дальше только новая партия или меню
  shopView.reset()
}

// --- экраны: что показано сейчас, решает screens/screens.ts (чистая логика с тестами), здесь только показ ---
// Юридические экраны: предупреждение о мигающих огнях — при каждом открытии, условия — пока не сохранено согласие
// (legal/flow.ts, внутри screens). Язык к этому моменту уже выбран (initLanguage выше) и меняется на самих экранах.
// Кнопки лежат внутри .screen, поэтому общий делегат выше разблокирует звук на этом же касании: оно не «съедено».
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

// Подсказка «текст продолжается»: класс more, пока под видимой частью осталось непрочитанное (стили — в index.html).
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
  // Клавиатура и скринридер не должны уходить в экран под юридическим.
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
renderScreens(screens.state) // разметка стартует с видимым предупреждением: приводим её к состоянию до первого показа

legalWarningOkBtn.addEventListener('click', () => screens.confirmLegal())
legalTermsOkBtn.addEventListener('click', () => screens.confirmLegal())
recordLineBtn.addEventListener('click', () => screens.openRecords())
openSettingsBtn.addEventListener('click', () => screens.openSettings())
openShopBtn.addEventListener('click', openShop)
toShopBtn.addEventListener('click', openShop)
shopBackBtn.addEventListener('click', () => screens.back())
for (const btn of backButtons) btn.addEventListener('click', () => screens.back())
// Escape на настройках и рекордах — назад (в игре его читает ввод партии, там back ничего не делает).
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') screens.back()
})
// Самозапускающийся замер (?perf=bench, ?perf=freeze) стартует сам через полсекунды: непрозрачный экран поверх
// канваса испортил бы числа, поэтому экраны пропускаются (согласие не пишется). Простой ?perf экраны не трогает.
if (isSelfStartingPerfMode(location.search)) screens.skipLegal()
else screens.start()

// --- игровая сессия ------------------------------------------------------

interface Session {
  state: GameState
  view: View
  detachInput: () => void
  /** Пульт схемы 'taps'; null в 'swipes'. */
  pad: Pad | null
  /** Кнопка ускорения (обе схемы). */
  boostBtn: BoostButton
  /** Стик поворота камеры (обе схемы). */
  stick: Stick
  /** Источники ускорения (палец на кнопке, Shift/Space): включено, пока держит хотя бы один. */
  boost: BoostHold
  /** Текущая фаза камеры; зеркалит GameState.mode по событию modeChanged. */
  mode: 'plane' | 'free'
  /** Показать экран-объяснение на переходе (только самая первая игра игрока). */
  explainTransition: boolean
  /** Настоящая партия (не замер ?perf): только такие идут в аналитику. */
  counted: boolean
}

let session: Session | null = null

// --- отладка производительности (view/perf-panel.ts, view/perf-bench.ts) ---------------------------
// Выключена по умолчанию: panel и bench остаются null, ничего не создаётся и не считается.
let perfPanel: PerfPanel | null = null
let bench: BenchRun | null = null
/** Идёт бенчмарк: логика игры заморожена, ввод игнорируется, партия не может умереть. */
let benchActive = false

// Пауза живёт в screens (ядро о ней не знает): пока пауза, tick() просто не вызывается.
// Две независимые причины: вкладка скрыта / кнопка (нужен тап «Продолжить») и экран демо-поворота.
function isPaused(): boolean {
  return isHeld(screens.state) || benchActive
}

// Параметры последней партии — «Ещё раз» перезапускает с ними.
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
      // Тик шага: тише и реже с ростом темпа (см. blips.tick). Яблоко и смерть в этом же такте свой звук
      // приносят сами (события идут следом за moved), тик под ними не нужен.
      if (next === undefined || (next.type !== 'ate' && next.type !== 'died')) audio.play('tick', effectiveStepMs(s.state))
      s.pad?.clearQueued()
      break
    case 'turnedInPlace':
      // Змейка выполнила команду — подсветку «принято, ждёт шага» на пульте гасим.
      s.pad?.clearQueued()
      break
    case 'modeChanged':
      // Плоская змейка стала объёмной: третьей оси больше нет, её кнопки на пульте прячем.
      s.mode = ev.mode
      showPad(lastScheme, s.mode)
      // Гасим флаг только здесь: знакомство с твистом реально состоялось.
      if (ev.mode === 'free') consumeFirstGameEver()
      if (ev.mode === 'free' && s.explainTransition && s.counted) tracker.twistSeen()
      // Экран с паузой — только в самой первой игре игрока; дальше переход бесшумный.
      // Камера при этом доигрывает полёт (render продолжает идти).
      if (s.explainTransition && ev.mode === 'free') {
        screens.openDemo()
        s.stick.release()
        s.boost.releaseAll() // экран объяснения закрывает кнопки: не оставляем ускорение залипшим
      }
      break
    case 'died': {
      queueMicrotask(syncPerfVisibility) // session.state уже мёртв, но проверяем после обработки события
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
      toShopBtn.classList.toggle('hidden', !hasAffordableNew(wallet.state, shopRoot))
      // Экран проигрыша и звук смерти запускаются в одном обработчике: анимация надписи и удар звука стартуют вместе.
      pendingIndex = commitRun(finalScore, durationMs)
      renderBoards(pendingIndex)
      if (pendingIndex >= 0) {
        // Попал в таблицу: барабан вместо кнопок, пока игрок не нажмёт «Готово». Запись уже сохранена; повороты барабана сбрасываются на диск отложенно (scheduleSave).
        gameOverActionsEl.classList.add('hidden')
        drumBlockEl.classList.remove('hidden')
        drum.show(
          initials,
          (name) => {
            if (pendingIndex < 0) return
            initials = name
            table = renameEntry(table, pendingIndex, name)
            scheduleSave()
            // Меню под экраном проигрыша скрыто: перерисовываем только видимую таблицу (меню обновит closeDrum).
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
  // Ускорение и сброс камеры — на стороне пульта (по умолчанию справа). В 'taps' «×2» лежит в центре
  // крестовины, сброс над пультом; в 'swipes' пульта нет, «×2» стоит в углу этой стороны, сброс над ней.
  const right = padSide === 'right'
  boostEl.classList.toggle('side-right', right)
  camResetBtn.classList.toggle('right', right)
  boostEl.classList.remove('hidden')
  pauseBtn.classList.remove('hidden')
  camResetBtn.classList.remove('hidden')
  // Стик — на стороне, противоположной пульту/«×2», чтобы не делить угол с ними.
  stickEl.classList.toggle('side-right', !right)
  stickEl.classList.remove('hidden')
}

// --- камера игрока: наклон и зум держатся до явного сброса ---------------

const ZOOM_MIN = configJson.camera.zoomMin
const ZOOM_MAX = configJson.camera.zoomMax

// Кнопка сброса тускнеет, пока камера в исходном виде: видно, что жать нечего.
function syncCamResetButton(): void {
  const idle = userCamera.yaw === 0 && userCamera.pitch === 0 && userCamera.zoom === 1
  camResetBtn.classList.toggle('idle', idle)
}

// Единая точка сброса наклона и зума: кнопка на экране, клавиша R и старт партии. Работает и на паузе:
// цель обнуляется сразу (кнопка стоит выше оверлея паузы), картинка догонит её после «Продолжить»
// (на ручной паузе кадры не рисуются, на экране демо-поворота — рисуются).
function resetCamera(): void {
  resetUserCamera()
  syncCamResetButton()
}

camResetBtn.addEventListener('click', resetCamera)

// Стик поворота камеры: отклонение задаёт скорость. Числа — в config.json (input.stick); размер уходит в CSS.
const stickCfg = configJson.input.stick
const stickTuning = { deadZone: stickCfg.deadZone, curve: stickCfg.curve, tapMaxMs: stickCfg.tapMaxMs }
stickEl.style.setProperty(
  '--stick',
  `clamp(${stickCfg.sizeMinPx}px, ${stickCfg.sizeVmin}vmin, ${stickCfg.sizeMaxPx}px)`,
)

// Горячий путь (каждый кадр): только арифметика на месте, без объектов. Пределы те же, что у наклона двумя пальцами.
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

// «×2» переезжает в центр крестовины (taps) или обратно в угол (swipes). Переносим только при смене места:
// повторная вставка на том же месте сорвала бы удерживаемое касание.
function dockBoost(inCross: boolean): void {
  const target = inCross ? padCrossEl : boostHomeEl
  if (boostEl.parentElement !== target) target.appendChild(boostEl)
  boostEl.classList.toggle('in-cross', inCross)
  camResetBtn.classList.toggle('above-pad', inCross)
  stickEl.classList.toggle('beside-pad', inCross) // стик встаёт на одну горизонталь с крестовиной
}

function showPad(scheme: InputScheme, mode: 'plane' | 'free'): void {
  dockBoost(scheme === 'taps')
  if (scheme !== 'taps') {
    padEl.classList.add('hidden')
    return
  }
  // В 'free' кнопки третьей оси не показываются, четыре стрелки остаются.
  padEl.classList.toggle('no-axis', mode === 'free')
  padEl.classList.toggle('left', padSide === 'left')
  padEl.classList.remove('hidden')
}

function startSession(size: number, scheme: InputScheme, forBench = false): void {
  endSession()
  if (!forBench) lastScheme = scheme

  // Наклон и зум прошлой партии не переезжают в новую: иначе можно начать игру в неиграбельном ракурсе
  // и не понять почему. Сбрасываем на старте (а не по выходу) — так кнопка «Ещё раз» тоже чистая.
  resetCamera()

  const isFirstGameEver = forBench ? false : readIsFirstGameEver()
  // В первой игре ядро стартует в 'plane' и переезжает на demo.afterSteps ходу,
  // во всех следующих — сразу в 'free'. s.mode ниже зеркалит это и обновляется по modeChanged.
  const seed = forBench ? BENCH_SEED : Math.floor(Math.random() * 0x7fffffff)
  // Замер и заморозка идут с ускорением из конфига и не трогают кошелёк; обычная партия: списывает партию у временных
  // предметов и берёт надетое ускорение.
  if (!forBench) {
    wallet.begin()
    saveShop()
  }
  // Надетое в магазине применяется здесь: ускорение, препятствия, темп (размер арены пришёл параметром size).
  const setup = forBench ? null : gameSetup(wallet.state, shopRoot)
  const boostFactor = setup === null ? config.speed.boostFactor : setup.boostFactor
  const state = createGame(config, size, seed, isFirstGameEver, boostFactor, setup === null ? {} : { obstacleMult: setup.obstacleMult, paceScale: setup.paceScale })
  setBoostLabel(state)
  const view = createView(canvas, config, state)
  view.setFogOn(fogOn)

  // Ускорение включено, пока держит хоть один источник: палец на кнопке или Shift/Space.
  // Любое отпускание (палец ушёл, cancel, blur, пауза, смерть, detach) приходит сюда же как on=false.
  const boost: BoostHold = createBoostHold((on) => {
    if (benchActive) return // замер: логика заморожена, ускорение не нужно
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
      /* переопределяется ниже — attachInput нужен уже собранный `s` для замыканий */
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
      // Escape: из игры — на паузу, с паузы — обратно в игру.
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
  // Выход с паузы посреди партии: набранный счёт идёт в таблицу с запомненными символами, как при смерти (без барабана).
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

// «Играть» в магазине: партия с текущими настройками и надетым (кнопка внутри .screen: звук разблокируется общим делегатом).
shopPlayBtn.addEventListener('click', () => startSession(currentArena(), selectedScheme))

// «Ещё раз» — новая партия с теми же размером и схемой, без возврата в меню.
playAgainBtn.addEventListener('click', () => startSession(currentArena(), lastScheme))
toMenuBtn.addEventListener('click', returnToMenu)
pauseToMenuBtn.addEventListener('click', returnToMenu)

// --- пауза: сворачивание вкладки и экран демо-поворота -------------------

function resumeFromPause(): void {
  screens.resume()
  lastFrameTime = null // пропущенное время не проживаем
}

// Единственная точка входа в паузу: и сворачивание вкладки, и кнопка «пауза» идут сюда.
function pauseNow(): void {
  const s = session
  if (benchActive) return
  if (s === null || !isAlive(s.state) || !screens.pause()) return
  // Ускорение на паузе выключается всегда: после «Продолжить» игрок сам зажмёт заново.
  s.boost.releaseAll()
  s.stick.release()
  // Поверх экрана демо экран паузы не показывается (screens): после закрытия демо он проявится сам.
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastFrameTime = null
    // iOS усыпляет контекст при сворачивании и после звонка; игра при этом стоит на паузе до «Продолжить».
    audio.resume()
    return
  }
  audio.suspend() // фоновая вкладка не должна играть музыку
  if (benchActive) bench?.abort('tab was hidden during the run')
  pauseNow()
})

pauseBtn.addEventListener('click', pauseNow)

resumeBtn.addEventListener('click', resumeFromPause)

demoContinueBtn.addEventListener('click', () => {
  screens.closeDemo() // если вкладку сворачивали, пока висел экран демо, экран паузы проявится сам
  lastFrameTime = null
})

// --- отладочная панель и бенчмарк ----------------------------------------
// Включение: клавиша ` (Backquote) или параметр адреса ?perf (?perf=bench — ещё и сразу запустить замер).

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
  // Сцена одна на все этапы: арена 100, фиксированный seed, свободная фаза, логика заморожена (benchActive).
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
        returnToMenu() // benchActive ещё true: счёт пустой партии в таблицу не попадает
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
  panel.setBench(run) // после start: баннер показывается только пока прогон идёт
}

// ?perf=freeze: та же замороженная сцена, что у бенчмарка, но без прогона этапов: можно спокойно листать переключатели
// панели и сравнивать кадры (скриншоты ступеней качества). Escape — выход в меню.
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

// --- ресайз/поворот экрана: UI и канвас должны это пережить -------------

function onWindowResize(): void {
  if (session !== null) syncViewSize(session.view)
}

window.addEventListener('resize', onWindowResize)
window.addEventListener('orientationchange', onWindowResize)

// --- игровой цикл: requestAnimationFrame, dt наружу, без аллокаций/await ---

// Рисовать ли сцену под экраном проигрыша (он непрозрачный, так что зря). true — прежнее поведение.
const RENDER_WHEN_DEAD = false

let lastFrameTime: number | null = null

function frame(now: number): void {
  requestAnimationFrame(frame)
  // Отладка выключена (по умолчанию) — обе переменные null, в кадре стоит одна проверка.
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

  // Потолок dt: даже без паузы (лаг, отладчик) ядро не делает пачку шагов и смерть за один кадр.
  const rawDt = lastFrameTime === null ? 0 : now - lastFrameTime
  const dtMs = rawDt > config.loop.maxFrameMs ? config.loop.maxFrameMs : rawDt
  lastFrameTime = now

  if (screens.state.paused) return
  if (!screens.state.demo && !benchActive) {
    dispatchEvents(s, tick(s.state, config, dtMs))
    const st = s.stick.state
    if (st.x !== 0 || st.y !== 0) applyStick(st.x, st.y, dtMs)
  }
  // Экран проигрыша непрозрачный и целиком закрывает холст: рисовать за ним сцену с постобработкой
  // незачем (полный кадр GPU конкурирует с нажатиями барабана). RENDER_WHEN_DEAD = true возвращает как было.
  if (!RENDER_WHEN_DEAD && !isAlive(s.state)) return
  // На паузе демо render идёт дальше: камера доигрывает доворот за экраном объяснения.
  s.view.render(s.state, dtMs)
}

requestAnimationFrame(frame)
