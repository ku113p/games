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
  isDoubleTap,
  pinchZoomFactor,
  pointerRole,
  swipeDirection,
  tiltPointersNeeded,
  twoFingerMode,
  wheelZoomFactor,
  zoomTuning,
  type TwoFingerMode,
} from './gestures'
import type { InputHandlers, InputScheme } from './index'

export function attachTouch(
  el: HTMLElement,
  scheme: InputScheme,
  config: Config,
  h: InputHandlers,
): () => void {
  let activePointerId: number | null = null

  // Камера от игрока. ПК: наклон — тянуть мышью с правой кнопкой (левая остаётся за свайпами/тапами),
  // зум — колесо. Телефон: два пальца, и они означают ЛИБО наклон (пальцы едут вместе), ЛИБО зум (щипок).
  // Что именно — решается один раз за жест по тому, что набежало первым (twoFingerMode), дальше не пересматривается.
  // Наружу уходят приращения (onCameraTiltBy / onCameraZoomBy): накопленное значение и его пределы держит main,
  // поэтому наклон и зум остаются на месте после жеста, а сбросить их может только явный сброс.
  const down = new Map<number, { x: number; y: number }>()
  let tilting = false
  let tiltIsMouse = false
  let fingerMode: TwoFingerMode = 'tilt'
  let baseCx = 0
  let baseCy = 0
  let baseSpread = 0
  let prevCx = 0
  let prevCy = 0
  let prevSpread = 0
  const tiltRadPerPx = config.input.tiltRadPerPx
  const tuning = zoomTuning(config)

  // Центр и раскрытие (средняя дистанция пальцев от центра) всех прижатых указателей.
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
    let sd = 0
    for (const p of down.values()) sd += Math.hypot(p.x - prevCx, p.y - prevCy)
    prevSpread = sd / n
  }

  function startTilt(isMouse: boolean): void {
    // Начатый одним пальцем жест отменяется целиком: ни поворота сейчас, ни свайпа/тапа при отпускании.
    resetGesture()
    flushPendingTap()
    tilting = true
    tiltIsMouse = isMouse
    fingerMode = isMouse ? 'tilt' : 'pending'
    centroid()
    rebase()
  }

  // Точка отсчёта жеста двух пальцев (для порога): сдвиг и раскрытие считаются от неё.
  function rebase(): void {
    baseCx = prevCx
    baseCy = prevCy
    baseSpread = prevSpread
  }

  // Жест закончился: НИЧЕГО не возвращаем, наклон и зум остаются как есть до явного сброса.
  function endTilt(): void {
    tilting = false
  }

  function forgetPointer(id: number): void {
    if (!down.delete(id)) return
    if (!tilting) return
    if (down.size < tiltPointersNeeded(tiltIsMouse)) endTilt()
    else {
      centroid() // ушёл один из трёх пальцев: без скачка
      rebase()
    }
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

  // Начался другой жест (свайп, два пальца), пока одиночный тап ещё ждал второго: это уже не двойной тап,
  // но и не отменённый — сдаём его «вглубь» сразу и в порядке ввода (тап был раньше свайпа), а не теряем.
  function flushPendingTap(): void {
    if (pendingTapTimer === null) return
    clearPendingTap()
    if (h.axisEnabled?.() === false) return
    h.onAxis('into')
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
      if (tilting) {
        // третий палец: без скачка
        centroid()
        rebase()
      }
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
      const ps = prevSpread
      centroid()
      const dx = prevCx - px
      const dy = prevCy - py
      if (fingerMode === 'pending') {
        fingerMode = twoFingerMode(
          Math.hypot(prevCx - baseCx, prevCy - baseCy),
          Math.abs(prevSpread - baseSpread),
          tuning.lockPx,
        )
        return // до решения ничего не шлём: набежавшие пиксели уходят в «мёртвую зону» жеста
      }
      if (fingerMode === 'tilt') h.onCameraTiltBy?.(dx * tiltRadPerPx, dy * tiltRadPerPx)
      else h.onCameraZoomBy?.(pinchZoomFactor(ps, prevSpread, tuning.pinchGain))
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
    flushPendingTap()
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

  // Колесо мыши — зум. Слушатель НЕ пассивный: иначе preventDefault не сработает и страница поедет.
  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    if (e.deltaY === 0) return
    h.onCameraZoomBy?.(wheelZoomFactor(e.deltaY, e.deltaMode, tuning.wheelPerPx))
  }

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerCancel)
  el.addEventListener('lostpointercapture', onLostCapture)
  el.addEventListener('contextmenu', onContextMenu)

  return () => {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('wheel', onWheel)
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
