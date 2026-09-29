// Клавиатура ПК: стрелки/WASD — поворот в плоскости, Q/E — третья ось, Shift/Space (зажать) — ускорение,
// R — сброс камеры (наклон и зум).
// Работает в обеих схемах управления (swipes и taps).
// Читаем e.code (физическая клавиша), а не e.key: в русской раскладке WASD
// приходит как ц/ф/ы/в, и e.key ломал бы управление.
import type { AxisDir, ScreenDir } from '../core/state'
import { createBoostHold, isBoostCode } from './gestures'
import type { InputHandlers } from './index'

const PLANE_CODES: Readonly<Record<string, ScreenDir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

const AXIS_CODES: Readonly<Record<string, AxisDir>> = {
  KeyQ: 'into',
  KeyE: 'out',
}

/** Чистая функция разбора: null — клавиша не наша. Отдельно, чтобы тестировать без DOM. */
export function keyAction(code: string): { plane: ScreenDir | null; axis: AxisDir | null } | null {
  const plane = PLANE_CODES[code] ?? null
  const axis = AXIS_CODES[code] ?? null
  if (plane === null && axis === null) return null
  return { plane, axis }
}

export function attachKeyboard(h: InputHandlers): () => void {
  // Shift/Space: пока зажата — ускорение. Отпускание обязано сработать всегда (blur, скрытая вкладка, detach).
  const boost = createBoostHold((on) => h.onBoost?.(on))

  function onKeyDown(e: KeyboardEvent): void {
    // Escape — пауза и выход в меню. Проверяется первым: работает и с модификаторами,
    // и при зажатом ускорении, потому что это аварийный выход из игры.
    if (e.code === 'Escape') {
      e.preventDefault()
      if (!e.repeat) h.onPause?.()
      return
    }
    // R (Reset) — сброс камеры. Без модификаторов: Ctrl+R — перезагрузка страницы, не наше.
    if (e.code === 'KeyR') {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      if (!e.repeat) h.onCameraReset?.()
      return
    }
    if (isBoostCode(e.code)) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault() // Space иначе жмёт сфокусированную кнопку и скроллит
      if (!e.repeat) boost.press(e.code)
      return
    }
    // Ctrl/Cmd/Alt+клавиша — это шорткат браузера (Ctrl+S, Ctrl+A, Cmd+D...), не игра.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const action = keyAction(e.code)
    if (action === null) return
    // Стрелки иначе скроллят страницу; для остальных наших клавиш тоже безвредно.
    e.preventDefault()
    // Автоповтор при удержании не должен спамить командами.
    if (e.repeat) return
    if (action.plane !== null) h.onTurn(action.plane)
    else if (action.axis !== null && h.axisEnabled?.() !== false) h.onAxis(action.axis)
  }

  // keyup без проверки модификаторов: отпустить можно всегда.
  function onKeyUp(e: KeyboardEvent): void {
    if (isBoostCode(e.code)) boost.release(e.code)
  }
  function onBlur(): void {
    boost.releaseAll()
  }
  function onVisibility(): void {
    if (document.hidden) boost.releaseAll()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
    boost.releaseAll()
  }
}
