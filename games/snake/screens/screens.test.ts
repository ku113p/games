import { describe, expect, test } from 'bun:test'
import { TERMS_ACCEPTED_KEY, type LegalStorage } from '../legal/flow'
import { createScreens, isHeld, topScreen, visibleScreens, type ScreenId, type ScreenState } from './screens'

function memory(initial: Record<string, string> = {}): LegalStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) }
}

const accepted = { [TERMS_ACCEPTED_KEY]: '1' }

/** Экраны, видимые сейчас, отсортированными (порядок в Set не важен). */
function seen(s: ScreenState): ScreenId[] {
  return [...visibleScreens(s)].sort()
}

function fresh(initial: Record<string, string> = accepted) {
  const storage = memory(initial)
  const changes: ScreenState[] = []
  const screens = createScreens(storage, (s) => changes.push(s))
  return { storage, changes, screens }
}

describe('юридические экраны в общем потоке', () => {
  test('первый запуск: предупреждение поверх меню, потом условия, потом чистое меню', () => {
    const { screens, storage } = fresh({})
    screens.start()
    expect(seen(screens.state)).toEqual(['menu', 'warning'])
    expect(topScreen(screens.state)).toBe('warning')
    screens.confirmLegal()
    expect(seen(screens.state)).toEqual(['menu', 'terms'])
    expect(storage.data.get(TERMS_ACCEPTED_KEY)).toBeUndefined() // согласие пишется при нажатии, а не при показе
    screens.confirmLegal()
    expect(seen(screens.state)).toEqual(['menu'])
    expect(storage.data.get(TERMS_ACCEPTED_KEY)).toBe('1')
  })

  test('повторный запуск: только предупреждение', () => {
    const { screens } = fresh()
    screens.start()
    expect(seen(screens.state)).toEqual(['menu', 'warning'])
    screens.confirmLegal()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('перф-режимы: экраны пропущены, согласие не записано', () => {
    const { screens, storage } = fresh({})
    screens.skipLegal()
    expect(seen(screens.state)).toEqual(['menu'])
    expect(storage.data.size).toBe(0)
  })

  test('под юридическим экраном нельзя открыть настройки и рекорды', () => {
    const { screens } = fresh()
    screens.start()
    screens.openSettings()
    screens.openRecords()
    expect(screens.state.base).toBe('menu')
    screens.confirmLegal()
    screens.openSettings()
    expect(screens.state.base).toBe('settings')
  })

  test('confirm до start не падает и ничего не показывает', () => {
    const { screens } = fresh()
    screens.confirmLegal() // лишнее нажатие до start: без падения
    expect(screens.state.legal).toBeNull()
  })
})

describe('меню, настройки, рекорды', () => {
  test('меню -> настройки -> назад', () => {
    const { screens } = fresh()
    screens.openSettings()
    expect(seen(screens.state)).toEqual(['settings'])
    screens.back()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('меню -> рекорды -> назад', () => {
    const { screens } = fresh()
    screens.openRecords()
    expect(seen(screens.state)).toEqual(['records'])
    screens.back()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('из настроек в рекорды напрямую не попасть, из меню назад — никуда', () => {
    const { screens } = fresh()
    screens.openSettings()
    screens.openRecords()
    expect(screens.state.base).toBe('settings')
    screens.back()
    screens.back()
    expect(screens.state.base).toBe('menu')
  })

  test('повторное открытие не даёт лишних уведомлений', () => {
    const { screens, changes } = fresh()
    screens.openSettings()
    screens.openSettings()
    screens.back()
    screens.back()
    expect(changes.length).toBe(2)
  })
})

describe('магазин', () => {
  test('меню -> магазин -> назад', () => {
    const { screens } = fresh()
    screens.openShop()
    expect(seen(screens.state)).toEqual(['shop'])
    expect(topScreen(screens.state)).toBe('shop')
    screens.back()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('из магазина «играть» сразу начинает партию, назад из партии магазина нет', () => {
    const { screens } = fresh()
    screens.openShop()
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
    screens.back() // Escape в игре не должен вернуть магазин
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('с экрана проигрыша в магазин и оттуда в новую партию', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.died()
    screens.openShop()
    expect(seen(screens.state)).toEqual(['shop'])
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('из настроек и рекордов магазин напрямую не открывается', () => {
    const { screens } = fresh()
    screens.openSettings()
    screens.openShop()
    expect(screens.state.base).toBe('settings')
    screens.back()
    screens.openRecords()
    screens.openShop()
    expect(screens.state.base).toBe('records')
  })

  test('в партии, на паузе и на демо магазин недоступен', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.openShop()
    expect(screens.state.base).toBe('game')
    screens.pause()
    screens.openShop()
    expect(screens.state.base).toBe('game')
    screens.resume()
    screens.openDemo()
    screens.openShop()
    expect(screens.state.base).toBe('game')
  })

  test('под юридическим экраном магазин не открывается, после него — да', () => {
    const { screens } = fresh()
    screens.start()
    screens.openShop()
    expect(screens.state.base).toBe('menu')
    expect(seen(screens.state)).toEqual(['menu', 'warning'])
    screens.confirmLegal()
    screens.openShop()
    expect(seen(screens.state)).toEqual(['shop'])
  })

  test('выход в меню из любого места закрывает магазин; повторное открытие не шумит', () => {
    const { screens, changes } = fresh()
    screens.openShop()
    screens.openShop()
    expect(changes.length).toBe(1)
    screens.toMenu()
    expect(screens.state.base).toBe('menu')
  })
})

describe('партия', () => {
  test('старт: виден только hud; смерть: только экран проигрыша; в меню: меню', () => {
    const { screens } = fresh()
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
    screens.died()
    expect(seen(screens.state)).toEqual(['over'])
    screens.startGame() // «Ещё раз»
    expect(seen(screens.state)).toEqual(['hud'])
    screens.died()
    screens.toMenu()
    expect(seen(screens.state)).toEqual(['menu'])
  })

  test('пауза: hud остаётся, поверх экран паузы; продолжить — обратно', () => {
    const { screens } = fresh()
    screens.startGame()
    expect(screens.pause()).toBe(true)
    expect(seen(screens.state)).toEqual(['hud', 'pause'])
    expect(isHeld(screens.state)).toBe(true)
    expect(screens.pause()).toBe(false) // повторная пауза не считается
    screens.resume()
    expect(seen(screens.state)).toEqual(['hud'])
    expect(isHeld(screens.state)).toBe(false)
  })

  test('выход из паузы в меню сбрасывает паузу', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.pause()
    screens.toMenu()
    expect(screens.state).toEqual({ legal: null, base: 'menu', paused: false, demo: false })
  })

  test('пауза вне игры невозможна', () => {
    const { screens } = fresh()
    expect(screens.pause()).toBe(false)
    screens.openSettings()
    expect(screens.pause()).toBe(false)
    screens.back()
    screens.startGame()
    screens.died()
    expect(screens.pause()).toBe(false)
    expect(screens.state.paused).toBe(false)
  })

  test('демо важнее паузы: пауза под ним не видна и проявляется после закрытия', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.openDemo()
    expect(seen(screens.state)).toEqual(['demo', 'hud'])
    expect(screens.pause()).toBe(true)
    expect(seen(screens.state)).toEqual(['demo', 'hud'])
    expect(topScreen(screens.state)).toBe('demo')
    screens.closeDemo()
    expect(seen(screens.state)).toEqual(['hud', 'pause'])
    expect(isHeld(screens.state)).toBe(true)
  })

  test('демо без паузы: после закрытия игра идёт', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.openDemo()
    expect(isHeld(screens.state)).toBe(true)
    screens.closeDemo()
    expect(isHeld(screens.state)).toBe(false)
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('смерть гасит паузу и демо; демо вне игры не открывается', () => {
    const { screens } = fresh()
    screens.openDemo()
    expect(screens.state.demo).toBe(false)
    screens.startGame()
    screens.openDemo()
    screens.pause()
    screens.died()
    expect(screens.state).toEqual({ legal: null, base: 'over', paused: false, demo: false })
  })

  test('новая партия не наследует паузу', () => {
    const { screens } = fresh()
    screens.startGame()
    screens.pause()
    screens.startGame()
    expect(seen(screens.state)).toEqual(['hud'])
  })

  test('died вне игры игнорируется', () => {
    const { screens, changes } = fresh()
    screens.died()
    expect(changes.length).toBe(0)
    expect(screens.state.base).toBe('menu')
  })
})

describe('topScreen', () => {
  test('приоритет: юридический > демо > пауза > основной', () => {
    expect(topScreen({ legal: 'terms', base: 'menu', paused: false, demo: false })).toBe('terms')
    expect(topScreen({ legal: null, base: 'game', paused: true, demo: true })).toBe('demo')
    expect(topScreen({ legal: null, base: 'game', paused: true, demo: false })).toBe('pause')
    expect(topScreen({ legal: null, base: 'game', paused: false, demo: false })).toBe('hud')
    expect(topScreen({ legal: null, base: 'over', paused: false, demo: false })).toBe('over')
    expect(topScreen({ legal: null, base: 'records', paused: false, demo: false })).toBe('records')
    expect(topScreen({ legal: null, base: 'shop', paused: false, demo: false })).toBe('shop')
    expect(topScreen({ legal: 'warning', base: 'shop', paused: false, demo: false })).toBe('warning')
  })
})
