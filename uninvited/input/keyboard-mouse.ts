// Keyboard + mouse (pointer lock) -> the player's intent and one-shot actions (DESIGN 11).
//   WASD / arrows move, mouse looks, Shift (hold) sprint, Space jump,
//   LMB the sword (always), RMB (hold) aim - and then LMB shoots; there is no weapon switching,
//   R reload, Q the circular sword strike, E interact (hold for the crank).
//   Ctrl must not reach the browser while playing: its shortcuts (Ctrl+S, Ctrl+D, Ctrl+wheel zoom...) are blocked;
//   Ctrl+W cannot be, so a "leave the page?" guard is up while the pointer is locked.
// main.ts reads `held`, `look` and the pressed counters every frame and calls consumePressed() after.
import cfgAll from '../config.json'

/** Mouse look spike filter (see onMouseMove). */
const MAX_MOVE_PX = cfgAll.input.maxMovePx
const LOCK_SETTLE_MS = cfgAll.input.lockSettleMs

export interface Held {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  run: boolean
  attack: boolean
  /** RMB held: aim. */
  aim: boolean
  /** E held: interact (the crank). */
  interact: boolean
}

/** Presses since the last consumePressed(). */
export interface Pressed {
  jump: number
  attack: number
  /** R: reload. */
  reload: number
  /** Q: the circular strike. */
  strike: number
  /** Fresh presses of E (not auto-repeat). */
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
  /** Ignore everything (menus, cards): clears held keys. */
  setEnabled(on: boolean): void
  consumePressed(): void
  /** Called when pointer lock is lost (Esc): the game pauses. */
  onUnlock(fn: () => void): void
  dispose(): void
}

export function bindGameInput(canvas: HTMLCanvasElement): GameInput {
  const held: Held = { forward: false, back: false, left: false, right: false, run: false, attack: false, aim: false, interact: false }
  const pressed: Pressed = { jump: 0, attack: 0, reload: 0, strike: 0, interact: 0 }
  const look = { dx: 0, dy: 0 }
  let enabled = true
  let unlockFn: (() => void) | null = null

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
        held.run = down
        return true
      case 'Space':
        if (down && !repeat) pressed.jump++
        return true
      case 'KeyR':
        if (down && !repeat) pressed.reload++
        return true
      case 'KeyQ':
        if (down && !repeat) pressed.strike++
        return true
      case 'KeyE':
        if (down && !repeat) pressed.interact++
        held.interact = down
        return true
    }
    return false
  }

  function clearHeld(): void {
    held.forward = held.back = held.left = held.right = held.run = held.attack = held.aim = held.interact = false
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!enabled) return
    // while playing, Ctrl + anything is ours (crouch-walking must not save, bookmark or select the page)
    if (setKey(e.code, true, e.repeat) || (e.ctrlKey && isLocked())) e.preventDefault()
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
    if (e.button === 2) held.aim = true
  }
  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) held.attack = false
    if (e.button === 2) held.aim = false
  }
  // Chrome (Windows above all) now and then reports a bogus huge movementX/Y under pointer lock, most often right after the
  // lock is taken - one such event flips the camera by 180 deg. Drop the events just after a lock change and any single
  // event far larger than a real mouse report.
  let lockAt = 0
  const onMouseMove = (e: MouseEvent): void => {
    if (!enabled || !isLocked()) return
    if (e.timeStamp - lockAt < LOCK_SETTLE_MS) return
    if (Math.abs(e.movementX) > MAX_MOVE_PX || Math.abs(e.movementY) > MAX_MOVE_PX) return
    look.dx += e.movementX
    look.dy += e.movementY
  }
  // the wheel no longer switches weapons; Ctrl + wheel would zoom the page
  const onWheel = (e: WheelEvent): void => {
    if (enabled && isLocked() && e.ctrlKey) e.preventDefault()
  }
  const onLockChange = (): void => {
    lockAt = performance.now()
    if (!isLocked()) {
      clearHeld()
      unlockFn?.()
    }
  }
  const onBlur = (): void => clearHeld()
  // Ctrl+W closes the tab and no page can block it: while playing, ask first
  const onBeforeUnload = (e: BeforeUnloadEvent): void => {
    if (!enabled || !isLocked()) return
    e.preventDefault()
    e.returnValue = ''
  }
  const onContext = (e: Event): void => e.preventDefault()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('blur', onBlur)
  window.addEventListener('beforeunload', onBeforeUnload)
  canvas.addEventListener('contextmenu', onContext)
  document.addEventListener('pointerlockchange', onLockChange)

  return {
    held,
    pressed,
    look,
    locked: isLocked,
    requestLock(): void {
      try {
        // raw input where supported (no OS acceleration, fewer spikes); fall back to the plain lock if it is refused
        const raw = (canvas.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => unknown).call(canvas, { unadjustedMovement: true })
        if (raw instanceof Promise) raw.catch(() => {
          const r = canvas.requestPointerLock() as unknown
          if (r instanceof Promise) r.catch(() => undefined)
        })
      } catch {
        // some browsers refuse without a fresh gesture; the pause screen asks for a click
      }
    },
    setEnabled(on: boolean): void {
      enabled = on
      if (!on) clearHeld()
    },
    consumePressed(): void {
      pressed.jump = pressed.attack = pressed.reload = pressed.strike = pressed.interact = 0
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
      window.removeEventListener('beforeunload', onBeforeUnload)
      canvas.removeEventListener('contextmenu', onContext)
      document.removeEventListener('pointerlockchange', onLockChange)
    },
  }
}
