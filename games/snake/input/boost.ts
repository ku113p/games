// Кнопка ускорения: DOM-кнопка-сосед холста (касание, начатое на ней, до touch.ts не доходит:
// не мешает свайпам, тапам по третьей оси и наклону двумя пальцами). Работает в обеих схемах.
// Пока палец зажат — ускорение включено. Отпускание срабатывает всегда: pointerup, pointercancel,
// lostpointercapture, contextmenu (долгое нажатие), blur окна, скрытая вкладка, detach.
import { createBoostHold } from './gestures'
import type { InputHandlers } from './index'

export interface BoostButton {
  /** Подсветка «ускорение включено» (по факту итогового состояния, в т.ч. от клавиатуры). */
  setActive(on: boolean): void
  /** Принудительно отпустить (пауза, смерть, конец партии). */
  release(): void
  detach(): void
}

export function attachBoostButton(btn: HTMLElement, h: InputHandlers): BoostButton {
  const hold = createBoostHold((on) => {
    btn.classList.toggle('pressed', on)
    h.onBoost?.(on)
  })
  const src = (id: number): string => `ptr:${id}`

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault() // без фокуса и синтетического click
    try {
      btn.setPointerCapture(e.pointerId)
    } catch {
      // Указатель уже исчез — pointerup/lostpointercapture всё сбросят.
    }
    hold.press(src(e.pointerId))
  }
  function onEnd(e: PointerEvent): void {
    hold.release(src(e.pointerId))
  }
  function onContextMenu(e: Event): void {
    e.preventDefault()
    hold.releaseAll()
  }
  function onBlur(): void {
    hold.releaseAll()
  }
  function onVisibility(): void {
    if (document.hidden) hold.releaseAll()
  }

  btn.addEventListener('pointerdown', onDown)
  btn.addEventListener('pointerup', onEnd)
  btn.addEventListener('pointercancel', onEnd)
  btn.addEventListener('lostpointercapture', onEnd)
  btn.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    setActive(on) {
      btn.classList.toggle('boosting', on)
    },
    release: () => hold.releaseAll(),
    detach() {
      btn.removeEventListener('pointerdown', onDown)
      btn.removeEventListener('pointerup', onEnd)
      btn.removeEventListener('pointercancel', onEnd)
      btn.removeEventListener('lostpointercapture', onEnd)
      btn.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      hold.releaseAll()
      btn.classList.remove('pressed', 'boosting')
    },
  }
}
