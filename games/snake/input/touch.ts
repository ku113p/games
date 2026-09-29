// Тач-ввод: Pointer Events (без hover), геометрия элемента читается заново
// на каждом жесте — переживает смену ориентации без переподписки.
//
// Схема 'taps': холст отдаёт только наклон камеры (два пальца / правая кнопка), всё остальное — пульт
// в углу (input/pad.ts, отдельные DOM-кнопки: касание, начатое на них, сюда не попадает вовсе).
//
// Указатель захватывается (setPointerCapture): если мышь ушла за пределы окна и
// кнопку отпустили там, pointerup всё равно придёт на элемент; на всякий случай
// состояние сбрасывается и по lostpointercapture / pointercancel.
import type { Config } from '../core/rules'
import {
  accumulateTilt,
  isDoubleTap,
  pointerRole,
  swipeDirection,
  TILT_LIMIT_RAD,
  tiltPointersNeeded,
} from './gestures'
import type { InputHandlers, InputScheme } from './index'

export function attachTouch(
  el: HTMLElement,
  scheme: InputScheme,
  config: Config,
  h: InputHandlers,
): () => void {
  let activePointerId: number | null = null

  // Наклон камеры: ПК — тянуть мышью с правой кнопкой (левая остаётся за свайпами/тапами),
  // телефон — тянуть двумя пальцами. Позиции всех прижатых указателей нужны для центроида.
  const down = new Map<number, { x: number; y: number }>()
  let tilting = false
  let tiltIsMouse = false
  let tiltYaw = 0
  let tiltPitch = 0
  let prevCx = 0
  let prevCy = 0
  const tiltRadPerPx = config.input.tiltRadPerPx

  function centroid(): void {
    let sx = 0
    let sy = 0
    for (const p of down.values()) {
      sx += p.x
      sy += p.y
    }
    const n = down.size || 1
    prevCx = sx / n
    prevCy = sy / n
  }

  function startTilt(isMouse: boolean): void {
    // Начатый одним пальцем жест отменяется целиком: ни поворота сейчас, ни свайпа/тапа при отпускании.
    resetGesture()
    clearPendingTap()
    tilting = true
    tiltIsMouse = isMouse
    tiltYaw = 0
    tiltPitch = 0
    centroid()
  }

  function endTilt(): void {
    if (!tilting) return
    tilting = false
    tiltYaw = 0
    tiltPitch = 0
    h.onCameraTilt?.(0, 0) // вид сам плавно вернёт камеру
  }

  function forgetPointer(id: number): void {
    if (!down.delete(id)) return
    if (tilting && down.size < tiltPointersNeeded(tiltIsMouse)) endTilt()
  }
  let startX = 0
  let startY = 0
  // Свайп уже отправлен в текущем жесте — на pointerup это не тап.
  let swiped = false

  // Таймер одиночного/двойного тапа по центру (into/out).
  let pendingTapAt: number | null = null
  let pendingTapTimer: ReturnType<typeof setTimeout> | null = null

  function clearPendingTap(): void {
    if (pendingTapTimer !== null) {
      clearTimeout(pendingTapTimer)
      pendingTapTimer = null
    }
    pendingTapAt = null
  }

  // Тап без направления (любое место в 'swipes'):
  // одиночный — into, но если второй тап приходит в пределах doubleTapMs — out.
  function handleAxisTap(now: number): void {
    // Фаза 'free': третьей оси нет — тап ничего не делает, таймеры не заводим.
    if (h.axisEnabled?.() === false) {
      clearPendingTap()
      return
    }
    if (isDoubleTap(pendingTapAt, now, config.input.doubleTapMs)) {
      clearPendingTap()
      h.onAxis('out')
      return
    }
    clearPendingTap()
    pendingTapAt = now
    pendingTapTimer = setTimeout(() => {
      pendingTapAt = null
      pendingTapTimer = null
      if (h.axisEnabled?.() === false) return // фаза сменилась, пока ждали второй тап
      h.onAxis('into')
    }, config.input.doubleTapMs)
  }

  function resetGesture(): void {
    activePointerId = null
    swiped = false
  }

  function onPointerDown(e: PointerEvent): void {
    const role = pointerRole(e.pointerType, e.button, down.size)
    if (role === 'ignore') return
    down.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (role === 'tilt') {
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // Указатель уже исчез — pointerup/lostpointercapture всё сбросят.
      }
      if (tilting) centroid() // третий палец: без скачка
      else startTilt(e.pointerType === 'mouse')
      return
    }
    activePointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    swiped = false
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Указатель уже исчез — pointerup/lostpointercapture всё сбросят.
    }
  }

  // Поворот отправляется в момент пересечения порога, а не на pointerup —
  // иначе на скорости заметная задержка. После срабатывания точка отсчёта
  // переносится сюда же, так что цепочка свайпов в одном касании тоже работает.
  function onPointerMove(e: PointerEvent): void {
    const p = down.get(e.pointerId)
    if (p !== undefined) {
      p.x = e.clientX
      p.y = e.clientY
    }
    if (tilting) {
      if (p === undefined) return
      const px = prevCx
      const py = prevCy
      centroid()
      tiltYaw = accumulateTilt(tiltYaw, prevCx - px, tiltRadPerPx, TILT_LIMIT_RAD)
      tiltPitch = accumulateTilt(tiltPitch, prevCy - py, tiltRadPerPx, TILT_LIMIT_RAD)
      h.onCameraTilt?.(tiltYaw, tiltPitch)
      return
    }
    if (e.pointerId !== activePointerId) return
    // В 'taps' холст свайпов и тапов не читает: повороты и ось — на пульте (input/pad.ts).
    if (scheme === 'taps') return
    const dir = swipeDirection(e.clientX - startX, e.clientY - startY, config.input.swipeMinPx)
    if (dir === null) return
    swiped = true
    startX = e.clientX
    startY = e.clientY
    clearPendingTap()
    h.onTurn(dir)
  }

  function onPointerUp(e: PointerEvent): void {
    forgetPointer(e.pointerId)
    if (e.pointerId !== activePointerId) return
    const wasSwipe = swiped
    resetGesture()
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)

    if (wasSwipe) return
    const now = e.timeStamp

    // Порог не пройден (иначе сработал бы onPointerMove) — это тап в любом месте.
    // В 'taps' тапы по холсту ничего не значат.
    if (scheme === 'swipes') handleAxisTap(now)
  }

  function onPointerCancel(e: PointerEvent): void {
    forgetPointer(e.pointerId)
    if (e.pointerId === activePointerId) resetGesture()
  }

  function onLostCapture(e: PointerEvent): void {
    forgetPointer(e.pointerId)
    if (e.pointerId === activePointerId) resetGesture()
  }

  // Длинное нажатие / правая кнопка не должны открывать системное меню поверх игры.
  function onContextMenu(e: Event): void {
    e.preventDefault()
  }

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerCancel)
  el.addEventListener('lostpointercapture', onLostCapture)
  el.addEventListener('contextmenu', onContextMenu)

  return () => {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
    el.removeEventListener('lostpointercapture', onLostCapture)
    el.removeEventListener('contextmenu', onContextMenu)
    clearPendingTap()
    resetGesture()
    down.clear()
    endTilt()
  }
}
