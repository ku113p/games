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
  /** Опционально: накопленный наклон камеры в радианах (оба в ±1); (0, 0) — жест закончен, вид возвращает сам. */
  /** Опционально: true — ускорение зажато, false — отпущено (всегда приходит парой; сбрасывается при blur/detach). */
  onBoost?(on: boolean): void
  onCameraTilt?(yaw: number, pitch: number): void
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
