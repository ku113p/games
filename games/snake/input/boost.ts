// Кнопка ускорения: DOM-кнопка-сосед холста (касание, начатое на ней, до touch.ts не доходит:
// не мешает свайпам, тапам по третьей оси и наклону двумя пальцами). Работает в обеих схемах.
// Пока палец зажат — ускорение включено. Отпускание срабатывает всегда: pointerup, pointercancel,
// lostpointercapture (на кнопке И на document: если захват не удался, а палец ушёл за кнопку, событие
// придёт уже не ей), blur окна, скрытая вкладка, detach.
//
// Долгое нажатие (баг «×2 держится пару секунд»): на телефоне через ~0.5 с браузер шлёт contextmenu
// (Android) или включает выделение/callout (iOS). Раньше contextmenu ещё и ОТПУСКАЛ ускорение, так что
// держать кнопку дольше долгого нажатия было нельзя. Теперь долгое нажатие гасится в корне
// (touchstart preventDefault: нет long-press жеста, меню, лупы) и сам contextmenu только подавляется —
// отпускает палец, а не событие меню. Если система всё же перехватила касание, придёт pointercancel.
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
  // Только подавляем меню. НЕ отпускаем: contextmenu приходит посреди удержания, палец ещё на кнопке.
  function onContextMenu(e: Event): void {
    e.preventDefault()
  }
  // Не пассивный: preventDefault на touchstart убивает long-press жест (меню, выделение, лупа iOS),
  // pointer-события при этом не отменяются.
  function onTouchStart(e: TouchEvent): void {
    e.preventDefault()
  }
  // Страховка на случай, если setPointerCapture не удался: тогда pointerup/cancel придут не на кнопку.
  // Реагируем только на указатели, которыми кнопка реально держится (hold игнорирует чужие).
  function onDocEnd(e: PointerEvent): void {
    hold.release(src(e.pointerId))
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
  btn.addEventListener('touchstart', onTouchStart, { passive: false })
  document.addEventListener('pointerup', onDocEnd)
  document.addEventListener('pointercancel', onDocEnd)
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
      btn.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('pointerup', onDocEnd)
      document.removeEventListener('pointercancel', onDocEnd)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      hold.releaseAll()
      btn.classList.remove('pressed', 'boosting')
    },
  }
}
