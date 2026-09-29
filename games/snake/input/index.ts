// Точка входа слоя ввода: тач (touch.ts) + клавиатура (keyboard.ts).
// Ровно сигнатура из контракта — не менять.
import type { AxisDir, ScreenDir } from '../core/state'
import type { Config } from '../core/rules'
import { attachKeyboard } from './keyboard'
import { attachTouch } from './touch'

export type InputScheme = 'swipes' | 'taps'

export interface InputHandlers {
  onTurn(dir: ScreenDir): void
  onAxis(dir: AxisDir): void
  /** Опционально: false — третья ось сейчас недоступна (фаза 'free'), тапы и Q/E игнорируются. Нет — всегда true. */
  axisEnabled?(): boolean
  /** Опционально: true — ускорение зажато, false — отпущено (всегда приходит парой; сбрасывается при blur/detach). */
  onBoost?(on: boolean): void
  /**
   * Опционально: приращение наклона камеры в радианах (мышь с правой кнопкой / два пальца вместе).
   * Приращение, а не абсолют: накопленное значение и его пределы держит вызывающий, наклон остаётся
   * после жеста и уходит только по onCameraReset.
   */
  onCameraTiltBy?(dYaw: number, dPitch: number): void
  /**
   * Опционально: множитель дистанции камеры (колесо мыши, щипок двумя пальцами). > 1 — дальше, < 1 — ближе.
   * Тоже приращение: пределы и текущий зум держит вызывающий.
   */
  onCameraZoomBy?(factor: number): void
  /** Опционально: сброс наклона и зума камеры (клавиша R; кнопку на экране main вешает сам). */
  onCameraReset?(): void
  /** Escape на ПК: пауза или выход в меню. */
  onPause?(): void
}

export function attachInput(
  el: HTMLElement,
  scheme: InputScheme,
  config: Config,
  h: InputHandlers,
): () => void {
  const detachTouch = attachTouch(el, scheme, config, h)
  const detachKeyboard = attachKeyboard(h)

  return () => {
    detachTouch()
    detachKeyboard()
  }
}
