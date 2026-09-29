// screens/screens.ts — «какой экран сейчас показан». Без DOM: показ и хранилище передаются снаружи (образец — legal/flow.ts).
// Один источник правды вместо россыпи classList.add/remove в main.ts.
//
// Модель: юридический экран (лежит поверх всего) -> основной экран (меню, настройки, рекорды, игра, проигрыш)
// -> в игре ещё две независимые причины стоять: пауза и объяснение демо-поворота. Объяснение важнее паузы:
// пока оно открыто, экран паузы не показывается, а после его закрытия пауза (если была) проявляется сама.

import { createLegalFlow, type LegalStep, type LegalStorage } from '../legal/flow'

export type BaseScreen = 'menu' | 'settings' | 'records' | 'shop' | 'game' | 'over'

/** Всё, что может быть видно на экране. `hud` — счёт и органы управления партии. */
export type ScreenId = 'warning' | 'terms' | 'menu' | 'settings' | 'records' | 'shop' | 'hud' | 'over' | 'pause' | 'demo'

export const ALL_SCREENS: readonly ScreenId[] = ['warning', 'terms', 'menu', 'settings', 'records', 'shop', 'hud', 'over', 'pause', 'demo']

export interface ScreenState {
  /** Юридический экран поверх всего; null — пройдены (или пропущены). */
  readonly legal: LegalStep | null
  readonly base: BaseScreen
  /** Игра на паузе (вкладка скрыта или кнопка). Имеет смысл только при base === 'game'. */
  readonly paused: boolean
  /** Открыто объяснение демо-поворота. Имеет смысл только при base === 'game'. */
  readonly demo: boolean
}

/** Какие экраны видны при таком состоянии. Под юридическим экраном основной остаётся (он непрозрачный и его закрывает). */
export function visibleScreens(s: ScreenState): ReadonlySet<ScreenId> {
  const out = new Set<ScreenId>()
  if (s.base === 'game') {
    out.add('hud')
    if (s.demo) out.add('demo')
    else if (s.paused) out.add('pause')
  } else if (s.base === 'over') {
    out.add('over')
  } else {
    out.add(s.base)
  }
  if (s.legal !== null) out.add(s.legal)
  return out
}

/** Экран, который сейчас ловит ввод: юридический, иначе оверлей, иначе основной. */
export function topScreen(s: ScreenState): ScreenId {
  if (s.legal !== null) return s.legal
  if (s.base === 'game') return s.demo ? 'demo' : s.paused ? 'pause' : 'hud'
  return s.base === 'over' ? 'over' : s.base
}

/** Игровая логика стоит: пауза или объяснение. (Бенчмарк морозит логику отдельно, в main.ts.) */
export function isHeld(s: ScreenState): boolean {
  return s.paused || s.demo
}

export interface Screens {
  readonly state: ScreenState
  /** Показать юридические экраны, затем меню. */
  start(): void
  /** Отладка (?perf=bench, ?perf=freeze): юридические экраны не показываются. */
  skipLegal(): void
  /** Кнопка юридического экрана: принять/понятно и дальше. */
  confirmLegal(): void
  openSettings(): void
  openRecords(): void
  /** Магазин: из меню или с экрана проигрыша («В магазин»). Под юридическим экраном, в игре и на паузе — нет. */
  openShop(): void
  /** Из настроек, рекордов или магазина — в меню. */
  back(): void
  /** Партия началась (из меню, «Ещё раз», бенчмарка): сбрасывает паузу и объяснение. */
  startGame(): void
  /** Змейка погибла: экран проигрыша. Вне игры ничего не делает. */
  died(): void
  /** В меню откуда угодно (с паузы, с проигрыша, из бенчмарка). */
  toMenu(): void
  /** true, если пауза действительно включилась (не в игре или уже на паузе — false). */
  pause(): boolean
  resume(): void
  openDemo(): void
  closeDemo(): void
}

/** onChange зовётся при каждом изменении состояния (не зовётся, если ничего не изменилось). */
export function createScreens(storage: LegalStorage, onChange: (s: ScreenState) => void): Screens {
  let st: ScreenState = { legal: null, base: 'menu', paused: false, demo: false }

  const set = (patch: Partial<{ -readonly [K in keyof ScreenState]: ScreenState[K] }>): void => {
    const next = { ...st, ...patch }
    if (next.legal === st.legal && next.base === st.base && next.paused === st.paused && next.demo === st.demo) return
    st = next
    onChange(st)
  }

  const legal = createLegalFlow(storage, (step) => set({ legal: step }))

  return {
    get state() {
      return st
    },
    start() {
      // Из меню, даже если кто-то уже успел его сменить: юридические экраны открывают меню.
      legal.start()
    },
    skipLegal() {
      legal.skipAll()
    },
    confirmLegal() {
      legal.confirm()
    },
    openSettings() {
      if (st.legal === null && st.base === 'menu') set({ base: 'settings' })
    },
    openRecords() {
      if (st.legal === null && st.base === 'menu') set({ base: 'records' })
    },
    openShop() {
      if (st.legal === null && (st.base === 'menu' || st.base === 'over')) set({ base: 'shop' })
    },
    back() {
      if (st.legal === null && (st.base === 'settings' || st.base === 'records' || st.base === 'shop')) set({ base: 'menu' })
    },
    startGame() {
      set({ base: 'game', paused: false, demo: false })
    },
    died() {
      if (st.base === 'game') set({ base: 'over', paused: false, demo: false })
    },
    toMenu() {
      set({ base: 'menu', paused: false, demo: false })
    },
    pause() {
      if (st.base !== 'game' || st.paused) return false
      set({ paused: true })
      return true
    },
    resume() {
      if (st.paused) set({ paused: false })
    },
    openDemo() {
      if (st.base === 'game') set({ demo: true })
    },
    closeDemo() {
      if (st.demo) set({ demo: false })
    },
  }
}
