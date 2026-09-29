// main.ts — точка сборки игры: связывает core/ (правила), view/ (three.js) и input/
// (тач + клавиатура). Держит requestAnimationFrame-цикл. Никаких аллокаций и await в кадре.

import { createGame, type Config } from './core/rules'
import { setBoost, startGame, tick, turnAxis, turnInPlane, type GameEvent } from './core/commands'
import type { AxisDir, GameState, ScreenDir } from './core/state'
import { elapsedMs, gameMode, isAlive, score } from './core/queries'
import { createView, type View } from './view/index'
import { resetUserCamera, userCamera } from './view/camera-rig'
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
import { createDrum, renderBoard } from './view/leaderboard-view'
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
import musicUrl from './assets/music/cyber-runner.mp3'
import configJson from './config.json'

const config = configJson as Config

const HIGH_SCORE_KEY = 'snake:highScore' // старый одиночный рекорд: читается только для переноса в таблицу
const LEADERBOARD_KEY = 'snake:leaderboard'
const INITIALS_KEY = 'snake:initials'
const HAS_PLAYED_BEFORE_KEY = 'snake:hasPlayedBefore'
const PAD_SIDE_KEY = 'snake:padSide'
const MUSIC_ON_KEY = 'snake:musicOn'
const SFX_ON_KEY = 'snake:sfxOn'
const FOG_ON_KEY = 'snake:fogOn'

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
const menuBoardEl = required<HTMLElement>('menu-board')
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
const sizeOptions = required<HTMLElement>('size-options')
const schemeOptions = required<HTMLElement>('scheme-options')

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

function renderBoards(highlight: number): void {
  renderBoard(menuBoardEl, table, lbCfg.size, -1)
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
    btn.textContent = `${isMusic ? 'Музыка' : 'Звуки'}: ${on ? 'вкл' : 'выкл'}`
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
  }
  audio.play('click')
})

syncSoundToggles()

const fogToggleButtons = document.querySelectorAll<HTMLButtonElement>('button[data-fog]')

function syncFogToggles(): void {
  for (const btn of fogToggleButtons) {
    btn.textContent = `Туман: ${fogOn ? 'вкл' : 'выкл'}`
    btn.classList.toggle('selected', fogOn)
    btn.setAttribute('aria-pressed', String(fogOn))
  }
}

syncFogToggles()

// --- меню: выбор размера куба и схемы управления ------------------------

let selectedSize = config.cube.default
let selectedScheme: InputScheme = 'swipes'

function markSelected(container: HTMLElement, datasetKey: 'size' | 'scheme' | 'side', value: string): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>('button')
  for (const btn of buttons) {
    const isSelected = btn.dataset[datasetKey] === value
    btn.classList.toggle('selected', isSelected)
    btn.setAttribute('aria-pressed', String(isSelected))
  }
}

sizeOptions.addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof HTMLButtonElement)) return
  const raw = target.dataset['size']
  if (raw === undefined) return
  const size = Number.parseInt(raw, 10)
  if (!config.cube.sizes.includes(size)) return
  selectedSize = size
  markSelected(sizeOptions, 'size', raw)
})

schemeOptions.addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof HTMLButtonElement)) return
  const raw = target.dataset['scheme']
  if (raw !== 'swipes' && raw !== 'taps') return
  selectedScheme = raw
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

markSelected(sizeOptions, 'size', String(selectedSize))
markSelected(schemeOptions, 'scheme', selectedScheme)
markSelected(padSideOptions, 'side', padSide)

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
}

let session: Session | null = null

// Пауза живёт здесь, ядро о ней не знает: пока пауза, tick() просто не вызывается.
// Две независимые причины: вкладка скрыта (нужен тап «Продолжить») и экран демо-поворота.
let pausedByVisibility = false
let demoExplainerOpen = false

function isPaused(): boolean {
  return pausedByVisibility || demoExplainerOpen
}

// Параметры последней партии — «Ещё раз» перезапускает с ними.
let lastSize = config.cube.default
let lastScheme: InputScheme = 'swipes'

function syncViewSize(view: View): void {
  view.resize(canvas.clientWidth, canvas.clientHeight)
}

function handleGameEvent(ev: GameEvent, s: Session): void {
  switch (ev.type) {
    case 'started':
      audio.newRound()
      break
    case 'ate':
      audio.play('eat')
      hudScore.textContent = String(ev.score)
      break
    case 'moved':
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
      // Экран с паузой — только в самой первой игре игрока; дальше переход бесшумный.
      // Камера при этом доигрывает полёт (render продолжает идти).
      if (s.explainTransition && ev.mode === 'free') {
        demoExplainerOpen = true
        demoScreen.classList.remove('hidden')
        s.stick.release()
        s.boost.releaseAll() // экран объяснения закрывает кнопки: не оставляем ускорение залипшим
      }
      break
    case 'died': {
      s.boost.releaseAll()
      s.stick.release()
      s.pad?.clearQueued()
      padEl.classList.add('hidden')
      hideBoostAndPause()
      hidePauseScreens()
      const finalScore = score(s.state)
      const durationMs = elapsedMs(s.state)
      finalScoreEl.textContent = String(finalScore)
      finalTimeEl.textContent = formatDuration(durationMs)
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
      hud.classList.add('hidden')
      gameOverScreen.classList.remove('hidden')
      break
    }
    default:
      break
  }
}

function hidePauseScreens(): void {
  pausedByVisibility = false
  demoExplainerOpen = false
  pauseScreen.classList.add('hidden')
  demoScreen.classList.add('hidden')
}

function dispatchEvents(s: Session, events: GameEvent[]): void {
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    if (ev === undefined) continue
    s.view.handle(ev, s.state)
    handleGameEvent(ev, s)
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

function endSession(): void {
  hidePauseScreens()
  padEl.classList.add('hidden')
  hideBoostAndPause()
  if (session === null) return
  session.boost.releaseAll()
  session.detachInput()
  session.view.dispose()
  session = null
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

function startSession(size: number, scheme: InputScheme): void {
  endSession()
  lastSize = size
  lastScheme = scheme

  // Наклон и зум прошлой партии не переезжают в новую: иначе можно начать игру в неиграбельном ракурсе
  // и не понять почему. Сбрасываем на старте (а не по выходу) — так кнопка «Ещё раз» тоже чистая.
  resetCamera()

  const isFirstGameEver = readIsFirstGameEver()
  // В первой игре ядро стартует в 'plane' и переезжает на demo.afterSteps ходу,
  // во всех следующих — сразу в 'free'. s.mode ниже зеркалит это и обновляется по modeChanged.
  const seed = Math.floor(Math.random() * 0x7fffffff)
  const state = createGame(config, size, seed, isFirstGameEver)
  const view = createView(canvas, config, state)
  view.setFogOn(fogOn)

  // Ускорение включено, пока держит хоть один источник: палец на кнопке или Shift/Space.
  // Любое отпускание (палец ушёл, cancel, blur, пауза, смерть, detach) приходит сюда же как on=false.
  const boost: BoostHold = createBoostHold((on) => {
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

  menuScreen.classList.add('hidden')
  gameOverScreen.classList.add('hidden')
  hud.classList.remove('hidden')
  hudScore.textContent = '0'
  showPad(scheme, s.mode)
  showBoostAndPause()

  syncViewSize(view)
  dispatchEvents(s, startGame(s.state))

  lastFrameTime = null
}

function returnToMenu(): void {
  // Выход с паузы посреди партии: набранный счёт идёт в таблицу с запомненными символами, как при смерти (без барабана).
  if (session !== null && isAlive(session.state)) commitRun(score(session.state), elapsedMs(session.state))
  gameOverScreen.classList.add('hidden')
  hud.classList.add('hidden')
  closeDrum()
  menuScreen.classList.remove('hidden')
  endSession()
}

tapToPlayBtn.addEventListener('click', () => {
  unlockAudio()
  startSession(selectedSize, selectedScheme)
})

// «Ещё раз» — новая партия с теми же размером и схемой, без возврата в меню.
playAgainBtn.addEventListener('click', () => startSession(lastSize, lastScheme))
toMenuBtn.addEventListener('click', returnToMenu)
pauseToMenuBtn.addEventListener('click', returnToMenu)

// --- пауза: сворачивание вкладки и экран демо-поворота -------------------

function resumeFromPause(): void {
  pausedByVisibility = false
  pauseScreen.classList.add('hidden')
  lastFrameTime = null // пропущенное время не проживаем
}

// Единственная точка входа в паузу: и сворачивание вкладки, и кнопка «пауза» идут сюда.
function pauseNow(): void {
  const s = session
  if (s === null || !isAlive(s.state) || pausedByVisibility) return
  pausedByVisibility = true
  // Ускорение на паузе выключается всегда: после «Продолжить» игрок сам зажмёт заново.
  s.boost.releaseAll()
  s.stick.release()
  // Поверх экрана демо второй экран не нужен: после его закрытия игра продолжится сама.
  if (!demoExplainerOpen) pauseScreen.classList.remove('hidden')
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastFrameTime = null
    // iOS усыпляет контекст при сворачивании и после звонка; игра при этом стоит на паузе до «Продолжить».
    audio.resume()
    return
  }
  audio.suspend() // фоновая вкладка не должна играть музыку
  pauseNow()
})

pauseBtn.addEventListener('click', pauseNow)

resumeBtn.addEventListener('click', resumeFromPause)

demoContinueBtn.addEventListener('click', () => {
  demoExplainerOpen = false
  demoScreen.classList.add('hidden')
  lastFrameTime = null
  // Если вкладку сворачивали, пока висел экран демо, — теперь нужна обычная пауза.
  if (pausedByVisibility) pauseScreen.classList.remove('hidden')
})

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

  const s = session
  if (s === null) return

  // Потолок dt: даже без паузы (лаг, отладчик) ядро не делает пачку шагов и смерть за один кадр.
  const rawDt = lastFrameTime === null ? 0 : now - lastFrameTime
  const dtMs = rawDt > config.loop.maxFrameMs ? config.loop.maxFrameMs : rawDt
  lastFrameTime = now

  if (pausedByVisibility) return
  if (!demoExplainerOpen) {
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
