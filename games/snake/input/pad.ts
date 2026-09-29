// Пульт управления в углу (схема 'taps'): DOM-кнопки поверх холста, Pointer Events, без hover.
// Кнопки — соседи холста, а не потомки: касание, начатое на пульте, до обработчиков холста
// (touch.ts) не доходит, поэтому не участвует в наклоне камеры двумя пальцами, а палец на холсте
// не может нажать пульт. Команда шлётся один раз на pointerdown (задержки нет), удержание не повторяет.
import { padCommand, shouldFirePad } from './gestures'
import type { InputHandlers } from './index'

export interface Pad {
  /** Убрать подсветку «команда принята, ждёт шага» (вызывать, когда змейка сделала шаг/разворот). */
  clearQueued(): void
  detach(): void
}

export function attachPad(root: HTMLElement, h: InputHandlers): Pad {
  const active = new Map<number, HTMLElement>()
  const buttons = root.querySelectorAll<HTMLElement>('[data-pad]')

  function clearQueued(): void {
    for (const b of buttons) b.classList.remove('queued')
  }

  function release(id: number): void {
    const b = active.get(id)
    if (b === undefined) return
    b.classList.remove('pressed')
    active.delete(id)
  }

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-pad]')
    if (btn === null || btn === undefined || !root.contains(btn)) return
    e.preventDefault() // без фокуса и синтетического click
    if (!shouldFirePad(new Set(active.keys()), e.pointerId)) return
    try {
      btn.setPointerCapture(e.pointerId)
    } catch {
      // Указатель уже исчез — pointerup/lostpointercapture всё сбросят.
    }
    const cmd = padCommand(btn.dataset['pad'], h.axisEnabled?.() !== false)
    if (cmd === null) return
    active.set(e.pointerId, btn)
    btn.classList.add('pressed')
    clearQueued()
    btn.classList.add('queued')
    if (cmd.kind === 'turn') h.onTurn(cmd.dir)
    else h.onAxis(cmd.dir)
    // Тактильный отклик там, где он есть (Android); при шаге в секунду видно, что команда принята.
    if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
  }

  function onEnd(e: PointerEvent): void {
    release(e.pointerId)
  }

  function onContextMenu(e: Event): void {
    e.preventDefault()
  }

  root.addEventListener('pointerdown', onDown)
  root.addEventListener('pointerup', onEnd)
  root.addEventListener('pointercancel', onEnd)
  root.addEventListener('lostpointercapture', onEnd)
  root.addEventListener('contextmenu', onContextMenu)

  return {
    clearQueued,
    detach(): void {
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', onEnd)
      root.removeEventListener('pointercancel', onEnd)
      root.removeEventListener('lostpointercapture', onEnd)
      root.removeEventListener('contextmenu', onContextMenu)
      for (const b of buttons) b.classList.remove('pressed', 'queued')
      active.clear()
    },
  }
}
