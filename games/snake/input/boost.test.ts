import { describe, expect, test } from 'bun:test'
import { attachBoostButton } from './boost'

// Кнопка «×2» на подменённом DOM: проверяем, что удержание не рвётся посреди нажатия (баг «×2 держится пару секунд»)
// и что отпускание срабатывает всегда.
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
  const b = attachBoostButton(el, { onTurn() {}, onAxis() {}, onBoost: (on) => log.push(on) })
  const down = (id = 1) => btn.get('pointerdown')?.({ pointerId: id, pointerType: 'touch', button: 0, preventDefault() {} })
  return {
    btn, win, doc, docObj, log, b, down,
    restore() {
      g['window'] = prevW
      g['document'] = prevD
    },
  }
}

describe('attachBoostButton: удержание', () => {
  test('долгое нажатие: contextmenu подавляется, но ускорение НЕ отпускается', () => {
    const t = setup()
    t.down()
    let prevented = false
    t.btn.get('contextmenu')?.({ preventDefault: () => (prevented = true) })
    expect(prevented).toBe(true)
    expect(t.log).toEqual([true]) // всё ещё держим
    t.btn.get('pointerup')?.({ pointerId: 1 })
    expect(t.log).toEqual([true, false])
    t.restore()
  })

  test('touchstart на кнопке гасится (нет long-press жеста: меню, выделение, лупа)', () => {
    const t = setup()
    let prevented = false
    t.btn.get('touchstart')?.({ preventDefault: () => (prevented = true) })
    expect(prevented).toBe(true)
    t.restore()
  })

  test('отпускание срабатывает всегда: pointerup, pointercancel, lostpointercapture, document-уровень, blur, скрытая вкладка, detach', () => {
    const cases: { name: string; run: (t: ReturnType<typeof setup>) => void }[] = [
      { name: 'pointerup', run: (t) => t.btn.get('pointerup')?.({ pointerId: 1 }) },
      { name: 'pointercancel', run: (t) => t.btn.get('pointercancel')?.({ pointerId: 1 }) },
      { name: 'lostpointercapture', run: (t) => t.btn.get('lostpointercapture')?.({ pointerId: 1 }) },
      { name: 'pointerup на document (палец ушёл с кнопки без захвата)', run: (t) => t.doc.get('pointerup')?.({ pointerId: 1 }) },
      { name: 'pointercancel на document', run: (t) => t.doc.get('pointercancel')?.({ pointerId: 1 }) },
      { name: 'blur окна', run: (t) => t.win.get('blur')?.({}) },
      {
        name: 'скрытая вкладка',
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

  test('чужой указатель не отпускает удержание', () => {
    const t = setup()
    t.down(1)
    t.doc.get('pointerup')?.({ pointerId: 2 })
    t.btn.get('pointercancel')?.({ pointerId: 2 })
    expect(t.log).toEqual([true])
    t.restore()
  })
})
