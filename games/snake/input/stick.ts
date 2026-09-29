// Маленький самовозвращающийся стик поворота камеры (телефон, обе схемы). DOM-элемент-сосед холста:
// касание, начатое на нём, до обработчиков холста (touch.ts) не доходит, поэтому со свайпами, тапами
// и наклоном двумя пальцами не путается. Стик задаёт СКОРОСТЬ поворота, а не позицию: держишь вбок —
// камера едет, отпустил — ручка вернулась в центр, камера осталась где была (сброс — только явный).
// Наружу отдаёт отклонение в осях -1..1 (после мёртвой зоны и кривой) — main опрашивает его каждый кадр.
// Быстрый тап по стику (короткое касание, палец не выходил за мёртвую зону) — сброс камеры: см. isStickTap.

export interface StickTuning {
  /** Мёртвая зона: доля радиуса, внутри которой отклонения нет (дрожание пальца камеру не двигает). */
  deadZone: number
  /** Степень кривой отклика: 1 — линейно, > 1 — у центра тоньше, у края быстрее. */
  curve: number
  /** Тап: касание не дольше этого (мс) и без выхода за мёртвую зону — это сброс камеры, а не поворот. */
  tapMaxMs: number
}

/** Отклонение стика по оси: x — вправо, y — вниз (как на экране), каждое в -1..1. Мутируется на месте. */
export interface StickState {
  x: number
  y: number
}

/**
 * Отклонение по вектору смещения ручки (px) от центра, без аллокаций: результат пишется в out.
 * Длина вектора зажимается радиусом, до мёртвой зоны — ноль, дальше 0..1 растёт по кривой.
 */
export function stickDeflection(
  dx: number,
  dy: number,
  radius: number,
  t: StickTuning,
  out: StickState,
): void {
  const len = Math.hypot(dx, dy)
  if (radius <= 0 || len === 0) {
    out.x = 0
    out.y = 0
    return
  }
  const raw = Math.min(len / radius, 1)
  if (raw <= t.deadZone) {
    out.x = 0
    out.y = 0
    return
  }
  const mag = Math.pow((raw - t.deadZone) / (1 - t.deadZone), t.curve)
  out.x = (dx / len) * mag
  out.y = (dy / len) * mag
}

/**
 * Было ли касание тапом (→ сброс камеры). Тап — И короткое, И без единого отклонения:
 * если стик хоть раз вышел за мёртвую зону (`maxTravel` — доля радиуса, максимум за касание), то это поворот,
 * даже если палец вернулся в центр до отпускания. Так попытка чуть подвернуть камеру не сбросит её случайно.
 */
export function isStickTap(durationMs: number, maxTravel: number, t: StickTuning): boolean {
  return durationMs >= 0 && durationMs <= t.tapMaxMs && maxTravel <= t.deadZone
}

/** Поворот за кадр (рад): отклонение × максимальная скорость × dt. Знак — как у перетаскивания (вправо/вниз — плюс). */
export function stickStep(deflection: number, maxRadPerSec: number, dtMs: number): number {
  return (deflection * maxRadPerSec * dtMs) / 1000
}

export interface Stick {
  /** Текущее отклонение (живой объект, читать в кадре без копий). */
  readonly state: StickState
  /** Принудительно отпустить (пауза, смерть, конец партии, сброс камеры не нужен: стик позиции не хранит). */
  release(): void
  detach(): void
}

export function attachStick(base: HTMLElement, knob: HTMLElement, t: StickTuning, onTap: () => void): Stick {
  const state: StickState = { x: 0, y: 0 }
  let pointerId: number | null = null
  let cx = 0
  let cy = 0
  let radius = 1
  // Для распознавания тапа: когда началось касание и как далеко от центра ушёл палец (доля радиуса, до зажима).
  let downAt = 0
  let maxTravel = 0

  function moveKnob(dx: number, dy: number): void {
    knob.style.transform = `translate(${dx}px, ${dy}px)`
  }

  function update(e: PointerEvent): void {
    // Ручка ходит по кругу радиуса radius; вектор зажимаем той же длиной, что и отклонение.
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const len = Math.hypot(dx, dy)
    if (len > radius) {
      dx = (dx / len) * radius
      dy = (dy / len) * radius
    }
    const travel = radius > 0 ? len / radius : 0
    if (travel > maxTravel) maxTravel = travel
    stickDeflection(dx, dy, radius, t, state)
    moveKnob(dx, dy)
  }

  function release(): void {
    if (pointerId !== null && base.hasPointerCapture(pointerId)) {
      try {
        base.releasePointerCapture(pointerId)
      } catch {
        // Указатель уже исчез.
      }
    }
    pointerId = null
    state.x = 0
    state.y = 0
    moveKnob(0, 0)
    base.classList.remove('active')
  }

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault() // без фокуса, выделения и синтетического click
    if (pointerId !== null) return // один палец на стик
    const r = base.getBoundingClientRect()
    cx = r.left + r.width / 2
    cy = r.top + r.height / 2
    radius = (r.width - knob.offsetWidth) / 2 // ручка не выходит за край основания
    if (radius < 1) radius = r.width / 2
    pointerId = e.pointerId
    downAt = e.timeStamp
    maxTravel = 0
    try {
      base.setPointerCapture(e.pointerId)
    } catch {
      // Указатель уже исчез — pointerup/lostpointercapture всё сбросят.
    }
    base.classList.add('active')
    update(e)
  }

  function onMove(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return
    update(e)
  }

  function onEnd(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return
    // Тапом считается только настоящее отпускание: cancel, потеря захвата, blur и пауза — не сброс.
    const tap = e.type === 'pointerup' && isStickTap(e.timeStamp - downAt, maxTravel, t)
    release()
    if (tap) {
      flash()
      onTap()
    }
  }

  // Короткая вспышка стика: сброс сработал (кнопка-прицел может уже стоять «тусклой», если камера и так в исходном виде).
  function flash(): void {
    base.classList.remove('flash')
    void base.offsetWidth // перезапуск анимации при повторном тапе
    base.classList.add('flash')
  }

  function onFlashEnd(): void {
    base.classList.remove('flash')
  }

  function onContextMenu(e: Event): void {
    e.preventDefault()
  }

  function onTouchStart(e: Event): void {
    e.preventDefault() // нет long-press жеста, меню и лупы
  }

  function onBlur(): void {
    release()
  }

  function onVisibility(): void {
    if (document.hidden) release()
  }

  base.addEventListener('animationend', onFlashEnd)
  base.addEventListener('pointerdown', onDown)
  base.addEventListener('pointermove', onMove)
  base.addEventListener('pointerup', onEnd)
  base.addEventListener('pointercancel', onEnd)
  base.addEventListener('lostpointercapture', onEnd)
  base.addEventListener('contextmenu', onContextMenu)
  base.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    state,
    release,
    detach(): void {
      base.removeEventListener('animationend', onFlashEnd)
      base.removeEventListener('pointerdown', onDown)
      base.removeEventListener('pointermove', onMove)
      base.removeEventListener('pointerup', onEnd)
      base.removeEventListener('pointercancel', onEnd)
      base.removeEventListener('lostpointercapture', onEnd)
      base.removeEventListener('contextmenu', onContextMenu)
      base.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    },
  }
}
