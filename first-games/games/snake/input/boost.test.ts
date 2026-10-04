import { describe, expect, test } from 'bun:test'
import { attachBoostButton } from './boost'

// The "×2" button on a fake DOM: check that a hold is not cut off mid-press (the "×2 stays on for a couple of seconds" bug)
// and that release always fires.
type L = (e: unknown) => void

function setup() {
  const btn = new Map<string, L>()
  const win = new Map<string, L>()
  const doc = new Map<string, L>()
  const g = globalThis as unknown as Record<string, unknown>
  const prevW = g['window']
  const prevD = g['document']
  const docObj = {
    hidden: false,
    addEventListener: (t: string, f: L) => void doc.set(t, f),
    removeEventListener: (t: string) => void doc.delete(t),
  }
  g['window'] = { addEventListener: (t: string, f: L) => void win.set(t, f), removeEventListener: (t: string) => void win.delete(t) }
  g['document'] = docObj
  const el = {
    classList: { toggle() {}, remove() {}, add() {} },
    addEventListener: (t: string, f: L) => void btn.set(t, f),
    removeEventListener: (t: string) => void btn.delete(t),
    setPointerCapture() {},
  } as unknown as HTMLElement
  const log: boolean[] = []
  const b = attachBoostButton(el, { onTurn() {}, onBoost: (on) => log.push(on) })
  const down = (id = 1) => btn.get('pointerdown')?.({ pointerId: id, pointerType: 'touch', button: 0, preventDefault() {} })
  return {
    btn, win, doc, docObj, log, b, down,
    restore() {
      g['window'] = prevW
      g['document'] = prevD
    },
  }
}

describe('attachBoostButton: hold', () => {
  test('long press: contextmenu is suppressed but boost is NOT released', () => {
    const t = setup()
    t.down()
    let prevented = false
    t.btn.get('contextmenu')?.({ preventDefault: () => (prevented = true) })
    expect(prevented).toBe(true)
    expect(t.log).toEqual([true]) // still holding
    t.btn.get('pointerup')?.({ pointerId: 1 })
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('touchstart on the button is cancelled (no long-press gesture: menu, selection, magnifier)', () => {
    const t = setup()
    let prevented = false
    t.btn.get('touchstart')?.({ preventDefault: () => (prevented = true) })
    expect(prevented).toBe(true)
    t.restore()
  })

  test('release always fires: pointerup, pointercancel, lostpointercapture, document level, blur, hidden tab, detach', () => {
    const cases: { name: string; run: (t: ReturnType<typeof setup>) => void }[] = [
      { name: 'pointerup', run: (t) => t.btn.get('pointerup')?.({ pointerId: 1 }) },
      { name: 'pointercancel', run: (t) => t.btn.get('pointercancel')?.({ pointerId: 1 }) },
      { name: 'lostpointercapture', run: (t) => t.btn.get('lostpointercapture')?.({ pointerId: 1 }) },
      { name: 'pointerup on document (finger left the button without capture)', run: (t) => t.doc.get('pointerup')?.({ pointerId: 1 }) },
      { name: 'pointercancel on document', run: (t) => t.doc.get('pointercancel')?.({ pointerId: 1 }) },
      { name: 'window blur', run: (t) => t.win.get('blur')?.({}) },
      {
        name: 'hidden tab',
        run: (t) => {
          t.docObj.hidden = true
          t.doc.get('visibilitychange')?.({})
        },
      },
      { name: 'detach', run: (t) => t.b.detach() },
    ]
    for (const c of cases) {
      const t = setup()
      t.down()
      expect(t.log).toEqual([true])
      c.run(t)
      expect(t.log, c.name).toEqual([true, false])
      t.restore()
    }
  })

  test('a foreign pointer does not release the hold', () => {
    const t = setup()
    t.down(1)
    t.doc.get('pointerup')?.({ pointerId: 2 })
    t.btn.get('pointercancel')?.({ pointerId: 2 })
    expect(t.log).toEqual([true])
    t.restore()
  })
})
