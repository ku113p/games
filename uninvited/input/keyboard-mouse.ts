// Keyboard + mouse (pointer lock) -> the player's intent and one-shot actions (DESIGN 12).
//   WASD / arrows move, mouse looks, Space jump, Shift dash (hold to keep running), C crouch toggle,
//   LMB attack (hold to repeat), Q / wheel switch sword <-> rifle, E interact / hack, Tab network vision (hold).
//   1-4 are reserved for May's abilities (not in the slice).
// main.ts reads `held`, `look` and the pressed counters every frame and calls consumePressed() after.

export interface Held {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  run: boolean
  attack: boolean
  scan: boolean
}

/** Presses since the last consumePressed(). */
export interface Pressed {
  jump: number
  dash: number
  crouch: number
  attack: number
  switchMode: number
  interact: number
}

export interface GameInput {
  readonly held: Held
  readonly pressed: Pressed
  /** Mouse movement since the last consumePressed(), in pixels. */
  readonly look: { dx: number; dy: number }
  /** Pointer lock is on (the game is being played, not paused). */
  locked(): boolean
  requestLock(): void
  /** Ignore everything (menus, the hack overlay): clears held keys. */
  setEnabled(on: boolean): void
  consumePressed(): void
  /** Called when pointer lock is lost (Esc): the game pauses. */
  onUnlock(fn: () => void): void
  dispose(): void
}

export function bindGameInput(canvas: HTMLCanvasElement): GameInput {
  const held: Held = { forward: false, back: false, left: false, right: false, run: false, attack: false, scan: false }
  const pressed: Pressed = { jump: 0, dash: 0, crouch: 0, attack: 0, switchMode: 0, interact: 0 }
  const look = { dx: 0, dy: 0 }
  let enabled = true
  let unlockFn: (() => void) | null = null
  let wheelBlock = 0

  const isLocked = (): boolean => document.pointerLockElement === canvas

  function setKey(code: string, down: boolean, repeat: boolean): boolean {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        held.forward = down
        return true
      case 'KeyS':
      case 'ArrowDown':
        held.back = down
        return true
      case 'KeyA':
      case 'ArrowLeft':
        held.left = down
        return true
      case 'KeyD':
      case 'ArrowRight':
        held.right = down
        return true
      case 'ShiftLeft':
      case 'ShiftRight':
        if (down && !repeat) pressed.dash++
        held.run = down
        return true
      case 'Space':
        if (down && !repeat) pressed.jump++
        return true
      case 'KeyC':
        if (down && !repeat) pressed.crouch++
        return true
      case 'KeyQ':
        if (down && !repeat) pressed.switchMode++
        return true
      case 'KeyE':
        if (down && !repeat) pressed.interact++
        return true
      case 'Tab':
        held.scan = down
        return true
    }
    return false
  }

  function clearHeld(): void {
    held.forward = held.back = held.left = held.right = held.run = held.attack = held.scan = false
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!enabled) return
    if (setKey(e.code, true, e.repeat)) e.preventDefault()
  }
  const onKeyUp = (e: KeyboardEvent): void => {
    if (setKey(e.code, false, false)) e.preventDefault()
  }
  const onMouseDown = (e: MouseEvent): void => {
    if (!enabled || !isLocked()) return
    if (e.button === 0) {
      held.attack = true
      pressed.attack++
    }
  }
  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) held.attack = false
  }
  const onMouseMove = (e: MouseEvent): void => {
    if (!enabled || !isLocked()) return
    look.dx += e.movementX
    look.dy += e.movementY
  }
  const onWheel = (e: WheelEvent): void => {
    if (!enabled || !isLocked()) return
    // one switch per wheel gesture: trackpads send many small events
    const now = e.timeStamp
    if (now < wheelBlock || Math.abs(e.deltaY) < 1) return
    wheelBlock = now + 180
    pressed.switchMode++
  }
  const onLockChange = (): void => {
    if (!isLocked()) {
      clearHeld()
      unlockFn?.()
    }
  }
  const onBlur = (): void => clearHeld()
  const onContext = (e: Event): void => e.preventDefault()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('wheel', onWheel, { passive: true })
  window.addEventListener('blur', onBlur)
  canvas.addEventListener('contextmenu', onContext)
  document.addEventListener('pointerlockchange', onLockChange)

  return {
    held,
    pressed,
    look,
    locked: isLocked,
    requestLock(): void {
      try {
        const r = canvas.requestPointerLock() as unknown
        if (r instanceof Promise) r.catch(() => undefined)
      } catch {
        // some browsers refuse without a fresh gesture; the pause screen asks for a click
      }
    },
    setEnabled(on: boolean): void {
      enabled = on
      if (!on) clearHeld()
    },
    consumePressed(): void {
      pressed.jump = pressed.dash = pressed.crouch = pressed.attack = pressed.switchMode = pressed.interact = 0
      look.dx = 0
      look.dy = 0
    },
    onUnlock(fn: () => void): void {
      unlockFn = fn
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('contextmenu', onContext)
      document.removeEventListener('pointerlockchange', onLockChange)
    },
  }
}
