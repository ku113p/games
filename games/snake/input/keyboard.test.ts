import { describe, expect, test } from 'bun:test'
import { attachKeyboard, keyAction } from './keyboard'

describe('keyAction (по e.code, не зависит от раскладки)', () => {
  test('WASD по физическим кодам', () => {
    expect(keyAction('KeyW')).toEqual({ plane: 'up', axis: null })
    expect(keyAction('KeyA')).toEqual({ plane: 'left', axis: null })
    expect(keyAction('KeyS')).toEqual({ plane: 'down', axis: null })
    expect(keyAction('KeyD')).toEqual({ plane: 'right', axis: null })
  })

  test('стрелки', () => {
    expect(keyAction('ArrowUp')?.plane).toBe('up')
    expect(keyAction('ArrowLeft')?.plane).toBe('left')
  })

  test('Q/E — третья ось', () => {
    expect(keyAction('KeyQ')).toEqual({ plane: null, axis: 'into' })
    expect(keyAction('KeyE')).toEqual({ plane: null, axis: 'out' })
  })

  test('символы русской раскладки — не коды, игнорируются', () => {
    expect(keyAction('ц')).toBeNull()
    expect(keyAction('Space')).toBeNull()
  })
})

describe('attachKeyboard: ускорение Shift/Space', () => {
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

  test('зажал Shift — вкл, автоповтор не дублирует, отпустил — выкл', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftLeft'))
    t.win.get('keydown')?.(t.key('ShiftLeft', { repeat: true }))
    t.win.get('keyup')?.(t.key('ShiftLeft'))
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('потеря фокуса окна выключает ускорение', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('Space'))
    t.win.get('blur')?.({})
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('скрытая вкладка выключает ускорение, видимая — нет', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftRight'))
    t.doc.get('visibilitychange')?.({})
    expect(t.log).toEqual([true])
    t.doc_.hidden = true
    t.doc.get('visibilitychange')?.({})
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('detach выключает ускорение и снимает слушатели', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftLeft'))
    t.detach()
    expect(t.log).toEqual([true, false])
    expect(t.win.size).toBe(0)
    t.restore()
  })

  test('Ctrl+Shift не включает ускорение (шорткат браузера)', () => {
    const t = setup()
    t.win.get('keydown')?.(t.key('ShiftLeft', { ctrlKey: true }))
    expect(t.log).toEqual([])
    t.restore()
  })
})

describe('attachKeyboard: R — сброс камеры', () => {
  test('R вызывает onCameraReset один раз, автоповтор и модификаторы не считаются', () => {
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
    win.get('keydown')?.(key({ ctrlKey: true })) // Ctrl+R — перезагрузка страницы, не наше
    expect(resets).toBe(1)
    expect(prevented).toBe(2) // R (и повтор R) глушим, Ctrl+R не трогаем
    detach()
    g['window'] = prevW
    g['document'] = prevD
  })

  test('без обработчика onCameraReset R ничего не ломает', () => {
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
