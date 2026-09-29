import { describe, expect, test } from 'bun:test'
import { attachKeyboard, keyAction } from './keyboard'

describe('keyAction (by e.code, layout-independent)', () => {
  test('WASD by physical codes', () => {
    expect(keyAction('KeyW')).toEqual({ plane: 'up', axis: null })
    expect(keyAction('KeyA')).toEqual({ plane: 'left', axis: null })
    expect(keyAction('KeyS')).toEqual({ plane: 'down', axis: null })
    expect(keyAction('KeyD')).toEqual({ plane: 'right', axis: null })
  })

  test('arrows', () => {
    expect(keyAction('ArrowUp')?.plane).toBe('up')
    expect(keyAction('ArrowLeft')?.plane).toBe('left')
  })

  test('Q/E: third axis', () => {
    expect(keyAction('KeyQ')).toEqual({ plane: null, axis: 'into' })
    expect(keyAction('KeyE')).toEqual({ plane: null, axis: 'out' })
  })

  test('Russian-layout characters are not codes, ignored', () => {
    expect(keyAction('ц')).toBeNull()
    expect(keyAction('Space')).toBeNull()
  })
})

describe('attachKeyboard: boost Shift/Space', () => {
  type L = (e: unknown) => void
  function setup(extra: object = {}) {
    const win = new Map<string, L>()
    const doc = new Map<string, L>()
    const g = globalThis as unknown as Record<string, unknown>
    const prevW = g['window']
    const prevD = g['document']
    const doc_ = {
      hidden: false,
      addEventListener: (t: string, f: L) => void doc.set(t, f),
      removeEventListener: (t: string) => void doc.delete(t),
    }
    g['window'] = {
      addEventListener: (t: string, f: L) => void win.set(t, f),
      removeEventListener: (t: string) => void win.delete(t),
    }
    g['document'] = doc_
    const log: boolean[] = []
    const detach = attachKeyboard({ onTurn() {}, onAxis() {}, onBoost: (on) => log.push(on), ...extra })
    const key = (code: string, extra: object = {}) => ({ code, preventDefault() {}, repeat: false, ...extra })
    return {
      log, win, doc, doc_, detach, key,
      restore() {
        g['window'] = prevW
        g['document'] = prevD
      },
    }
  }

  test('hold Shift: on, auto-repeat does not duplicate, release: off', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftLeft'))
    t.win.get('keydown')?.(t.key('ShiftLeft', { repeat: true }))
    t.win.get('keyup')?.(t.key('ShiftLeft'))
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('window blur turns boost off', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('Space'))
    t.win.get('blur')?.({})
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('hidden tab turns boost off, a visible one does not', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftRight'))
    t.doc.get('visibilitychange')?.({})
    expect(t.log).toEqual([true])
    t.doc_.hidden = true
    t.doc.get('visibilitychange')?.({})
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('detach turns boost off and removes listeners', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftLeft'))
    t.detach()
    expect(t.log).toEqual([true, false])
    expect(t.win.size).toBe(0)
    t.restore()
  })

  test('Ctrl+Shift does not turn boost on (browser shortcut)', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftLeft', { ctrlKey: true }))
    expect(t.log).toEqual([])
    t.restore()
  })
})

describe('attachKeyboard: R - camera reset', () => {
  test('R calls onCameraReset once, auto-repeat and modifiers do not count', () => {
    let resets = 0
    let prevented = 0
    type L = (e: unknown) => void
    const win = new Map<string, L>()
    const g = globalThis as unknown as Record<string, unknown>
    const prevW = g['window']
    const prevD = g['document']
    g['window'] = { addEventListener: (t: string, f: L) => void win.set(t, f), removeEventListener() {} }
    g['document'] = { hidden: false, addEventListener() {}, removeEventListener() {} }
    const detach = attachKeyboard({ onTurn() {}, onAxis() {}, onCameraReset: () => resets++ })
    const key = (extra: object = {}) => ({ code: 'KeyR', repeat: false, preventDefault: () => prevented++, ...extra })
    win.get('keydown')?.(key())
    win.get('keydown')?.(key({ repeat: true }))
    win.get('keydown')?.(key({ ctrlKey: true })) // Ctrl+R reloads the page, not ours
    expect(resets).toBe(1)
    expect(prevented).toBe(2) // we swallow R (and its repeat), leave Ctrl+R alone
    detach()
    g['window'] = prevW
    g['document'] = prevD
  })

  test('without an onCameraReset handler R breaks nothing', () => {
    type L = (e: unknown) => void
    const win = new Map<string, L>()
    const g = globalThis as unknown as Record<string, unknown>
    const prevW = g['window']
    const prevD = g['document']
    g['window'] = { addEventListener: (t: string, f: L) => void win.set(t, f), removeEventListener() {} }
    g['document'] = { hidden: false, addEventListener() {}, removeEventListener() {} }
    const detach = attachKeyboard({ onTurn() {}, onAxis() {} })
    expect(() => win.get('keydown')?.({ code: 'KeyR', repeat: false, preventDefault() {} })).not.toThrow()
    detach()
    g['window'] = prevW
    g['document'] = prevD
  })
})
