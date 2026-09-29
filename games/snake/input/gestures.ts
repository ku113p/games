// Чистая логика разбора жестов, без DOM — чтобы можно было протестировать
// отдельно от touch-обвязки (input/touch.ts).
import type { AxisDir, ScreenDir } from '../core/state'

/**
 * Направление свайпа по смещению (dx, dy) в CSS-пикселях.
 * dx/dy — это (конец - начало). Возвращает null, если смещение меньше порога
 * по обеим осям (жест ещё не считается свайпом).
 */
export function swipeDirection(dx: number, dy: number, minPx: number): ScreenDir | null {
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (adx < minPx && ady < minPx) return null
  if (adx > ady) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}


/**
 * true, если тап в момент `now` — второй тап двойного тапа относительно
 * предыдущего тапа в момент `lastTapAt` (мс, общая монотонная шкала).
 */
export function isDoubleTap(lastTapAt: number | null, now: number, doubleTapMs: number): boolean {
  if (lastTapAt === null) return false
  return now - lastTapAt <= doubleTapMs
}

/** Предел наклона камеры в радианах по каждой оси — договорённость с видом (setCameraTilt). */
export const TILT_LIMIT_RAD = 1

/** Запасная чувствительность наклона (рад на CSS-пиксель), если в config.input нет tiltRadPerPx. */
export const DEFAULT_TILT_RAD_PER_PX = 0.005

/**
 * Новое значение наклона после смещения на deltaPx пикселей, с зажимом в ±limit.
 */
export function accumulateTilt(current: number, deltaPx: number, radPerPx: number, limit: number): number {
  const next = current + deltaPx * radPerPx
  if (next > limit) return limit
  if (next < -limit) return -limit
  return next
}

/** Чем является новое касание. */
export type PointerRole = 'gesture' | 'tilt' | 'ignore'

/**
 * Роль нового указателя (pointerdown).
 * - мышь, не основная кнопка (правая/средняя) — наклон;
 * - любой указатель, если уже есть другой прижатый палец — наклон (два пальца);
 * - иначе — обычный жест (поворот/тап/свайп).
 * Основная кнопка мыши при другом прижатом указателе — тоже наклон-жест не стартует:
 * это 'ignore' (мышь не бывает вторым пальцем).
 */
export function pointerRole(pointerType: string, button: number, otherDownCount: number): PointerRole {
  if (pointerType === 'mouse') {
    if (button !== 0) return 'tilt'
    return otherDownCount > 0 ? 'ignore' : 'gesture'
  }
  return otherDownCount > 0 ? 'tilt' : 'gesture'
}

/** Сколько указателей нужно, чтобы наклон продолжался: мышь — 1, пальцы — 2. */
export function tiltPointersNeeded(isMouse: boolean): number {
  return isMouse ? 1 : 2
}

// --- Пульт в углу (схема 'taps') ------------------------------------------

export type PadButton = ScreenDir | AxisDir
export type PadCommand = { kind: 'turn'; dir: ScreenDir } | { kind: 'axis'; dir: AxisDir }
export type PadSide = 'right' | 'left'

const PAD_BUTTONS: readonly string[] = ['left', 'right', 'up', 'down', 'into', 'out']

/** Имя кнопки пульта (data-pad) → команда. null — неизвестная кнопка или третья ось сейчас выключена. */
export function padCommand(button: string | undefined, axisEnabled: boolean): PadCommand | null {
  if (button === undefined || !PAD_BUTTONS.includes(button)) return null
  if (button === 'into' || button === 'out') return axisEnabled ? { kind: 'axis', dir: button } : null
  return { kind: 'turn', dir: button as ScreenDir }
}

/** Сторона пульта из сохранённой строки; всё непонятное — правая (по умолчанию). */
export function parsePadSide(raw: string | null): PadSide {
  return raw === 'left' ? 'left' : 'right'
}

/**
 * Касание пульта срабатывает один раз — на pointerdown. Пока этот же указатель
 * не отпущен, повторно он команду не шлёт (нет автоповтора при удержании).
 */
export function shouldFirePad(activePointerIds: ReadonlySet<number>, pointerId: number): boolean {
  return !activePointerIds.has(pointerId)
}

// --- Ускорение (зажать — быстрее) -----------------------------------------

/** Кнопка ускорения: сторона экрана — напротив пульта, чтобы жать другим большим пальцем. */
export function boostSide(padSide: PadSide): PadSide {
  return padSide === 'left' ? 'right' : 'left'
}

const BOOST_CODES: readonly string[] = ['ShiftLeft', 'ShiftRight', 'Space']

/** Физическая клавиша ускорения (e.code, не зависит от раскладки). */
export function isBoostCode(code: string): boolean {
  return BOOST_CODES.includes(code)
}

export interface BoostHold {
  /** Источник (палец, клавиша) начал удерживать. Повтор того же источника ничего не меняет. */
  press(source: string): void
  /** Источник отпустил. Неизвестный источник игнорируется. */
  release(source: string): void
  /** Сбросить всё разом (blur, пауза, конец партии, detach). */
  releaseAll(): void
  isOn(): boolean
}

/**
 * Ускорение включено, пока удерживает хотя бы один источник (палец на кнопке, Shift).
 * onChange вызывается только на смене состояния, так что повторные release/releaseAll безопасны.
 */
export function createBoostHold(onChange: (on: boolean) => void): BoostHold {
  const held = new Set<string>()
  let on = false
  function sync(): void {
    const next = held.size > 0
    if (next === on) return
    on = next
    onChange(on)
  }
  return {
    press(source) {
      held.add(source)
      sync()
    },
    release(source) {
      held.delete(source)
      sync()
    },
    releaseAll() {
      held.clear()
      sync()
    },
    isOn: () => on,
  }
}
