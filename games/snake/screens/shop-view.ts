// screens/shop-view.ts — витрина магазина: DOM поверх предметной части (shop-stub.ts, позже shop/).
// Холодный путь: перерисовывается целиком при открытии, покупке, надевании и смене языка. Никакой игровой логики:
// что можно купить или надеть, решает предметная часть, а поток (main.ts) получает только «купи» и «надень».

import { t } from '../i18n/runtime'
import { ru, type TextKey } from '../i18n/dictionaries'
import { equippedItem, gamesLeft, scoreMultiplier, type Item, type ShopRoot, type ShopState, type Slot } from '../shop'
import { SECTION_SLOT, SHOP_SECTIONS, itemStatus, itemsOfSection, type ItemStatus, type ShopSection } from './shop-flow'

export interface ShopViewDeps {
  readonly config: ShopRoot
  /** Все предметы витрины в порядке каталога. */
  readonly items: () => readonly Item[]
  readonly state: () => ShopState
  readonly onBuy: (item: Item) => void
  readonly onEquip: (item: Item) => void
}

export interface ShopView {
  /** Перерисовать витрину и баланс (кроме позиции прокрутки и фокуса — они сохраняются). */
  render(): void
  /** Открытие магазина: раскрывается первый раздел, где есть на что хватает денег (иначе первый), прокрутка — в начало. */
  reset(): void
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100) // 1.5 -> «1.5», 2 -> «2»

function hasKey(key: string): key is TextKey {
  return key in ru
}

/** Название предмета: множители считаются из числа, остальные берутся из словаря (нет записи — виден сам id). */
export function itemName(item: Item): string {
  switch (item.kind) {
    case 'boost':
      return `×${fmt(item.payload.factor ?? 1)}`
    case 'scoreMultTemporary':
      return t('shop.mult.temp', { n: fmt(item.payload.mult ?? 1), games: item.games ?? 1 })
    case 'scoreMultPermanent':
      return t('shop.mult.perm', { n: fmt(item.payload.mult ?? 1) })
    case 'arenaSize': {
      const key = `shop.item.${item.id}`
      return hasKey(key) ? t(key) : `${item.payload.size ?? '?'}³`
    }
    case 'obstacleDensity': {
      const d = item.payload.density ?? 1
      return d === 0 ? t('shop.item.density-0') : `×${d === 0.25 ? '¼' : d === 0.5 ? '½' : fmt(d)}`
    }
    case 'comingSoon':
      return '???'
    default: {
      const key = `shop.item.${item.id}`
      return hasKey(key) ? t(key) : item.id
    }
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls !== undefined) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function coin(): HTMLElement {
  const c = el('span', 'coin')
  c.setAttribute('aria-hidden', 'true')
  return c
}

const ACTION_LABEL: Record<Exclude<ItemStatus, 'soon'>, TextKey> = {
  buyable: 'shop.buy',
  owned: 'shop.equip',
  equipped: 'shop.equipped',
  active: 'shop.active',
  short: 'shop.short',
  maxed: 'shop.max',
}

function buildRow(item: Item, state: ShopState, config: ShopRoot): HTMLElement {
  const status = itemStatus(state, item, config)
  const row = el('div', `shop-item ${status}`)
  row.dataset['id'] = item.id
  row.appendChild(el('div', 'name', itemName(item)))

  const meta = el('div', 'meta')
  if (status === 'soon') {
    meta.textContent = t('shop.soon')
  } else if (status === 'buyable' || status === 'short') {
    meta.append(coin(), el('span', undefined, String(item.price)))
    const left = gamesLeft(state, item)
    if (left > 0) meta.append(el('span', undefined, `· ${t('shop.gamesLeft', { n: left })}`))
  } else {
    meta.textContent = t('shop.owned')
  }
  row.appendChild(meta)

  if (status !== 'soon') {
    const btn = el('button', `act ${status === 'buyable' ? 'buy' : ''}`, t(ACTION_LABEL[status]))
    btn.type = 'button'
    btn.dataset['id'] = item.id
    if (status === 'buyable') btn.dataset['act'] = 'buy'
    else if (status === 'owned') btn.dataset['act'] = 'equip'
    else btn.disabled = true
    row.appendChild(btn)
  } else {
    row.setAttribute('aria-label', t('aria.shopLocked'))
  }
  return row
}

/** Краткое «что сейчас выбрано» для шапки свёрнутого раздела. */
function sectionSummary(section: ShopSection, state: ShopState, config: ShopRoot): string {
  if (section.id === 'mult') {
    const m = scoreMultiplier(state, config)
    return m > 1 ? `×${fmt(m)}` : '—'
  }
  const slot = SECTION_SLOT[section.id]
  const it = slot === null ? undefined : equippedItem(state, config, slot as Slot)
  return it === undefined ? '' : itemName(it)
}

export function createShopView(
  body: HTMLElement,
  balanceEl: HTMLElement,
  menuBalanceEl: HTMLElement,
  deps: ShopViewDeps,
): ShopView {
  // Раздел, раскрытый сейчас (по одному: аккордеон, чтобы девять разделов не превращались в простыню). null — все свёрнуты.
  let openId: ShopSection['id'] | null = null

  function firstAffordable(): ShopSection['id'] {
    const state = deps.state()
    for (const section of SHOP_SECTIONS) {
      const list = itemsOfSection(deps.items(), section)
      if (list.some((it) => it.kind !== 'scoreMultTemporary' && itemStatus(state, it, deps.config) === 'buyable')) return section.id
    }
    return SHOP_SECTIONS[0]?.id ?? 'boost'
  }

  function render(): void {
    const state = deps.state()
    const items = deps.items()
    const scroll = body.scrollTop
    const focusedId = document.activeElement instanceof HTMLElement && body.contains(document.activeElement) ? document.activeElement.dataset['id'] : undefined

    const nodes: HTMLElement[] = []
    for (const section of SHOP_SECTIONS) {
      const list = itemsOfSection(items, section)
      if (list.length === 0) continue
      const open = openId === section.id
      const group = el('section', `shop-group${open ? ' open' : ''}`)
      const head = el('button', 'shop-group-head')
      head.type = 'button'
      head.dataset['group'] = section.id
      head.setAttribute('aria-expanded', String(open))
      head.append(el('span', 'g-title', t(`shop.section.${section.id}` as TextKey)))
      // Точка на шапке: в разделе есть что купить прямо сейчас (не расходник) — видно и в свёрнутом виде.
      if (list.some((it) => it.kind !== 'scoreMultTemporary' && itemStatus(state, it, deps.config) === 'buyable')) head.append(el('span', 'g-dot'))
      head.append(el('span', 'g-now', sectionSummary(section, state, deps.config)), el('span', 'g-chev'))
      group.appendChild(head)
      if (open) {
        const panel = el('div', 'shop-group-items')
        for (const it of list) panel.appendChild(buildRow(it, state, deps.config))
        group.appendChild(panel)
      }
      nodes.push(group)
    }
    body.replaceChildren(...nodes)
    body.scrollTop = scroll

    balanceEl.textContent = String(state.balance)
    balanceEl.parentElement?.setAttribute('aria-label', t('aria.shopBalance', { n: state.balance }))
    menuBalanceEl.textContent = String(state.balance)

    if (focusedId !== undefined) {
      const again = body.querySelector<HTMLButtonElement>(`button[data-id="${CSS.escape(focusedId)}"]:not(:disabled)`)
      again?.focus({ preventScroll: true })
    }
  }

  body.addEventListener('click', (e) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const headBtn = target.closest<HTMLButtonElement>('button[data-group]')
    if (headBtn !== null) {
      const id = headBtn.dataset['group'] as ShopSection['id']
      openId = openId === id ? null : id
      render()
      body.querySelector<HTMLElement>(`button[data-group="${id}"]`)?.scrollIntoView({ block: 'nearest' })
      return
    }
    const btn = target.closest<HTMLButtonElement>('button[data-act]')
    if (btn === null) return
    const item = deps.items().find((i) => i.id === btn.dataset['id'])
    if (item === undefined) return
    if (btn.dataset['act'] === 'buy') deps.onBuy(item)
    else if (btn.dataset['act'] === 'equip') deps.onEquip(item)
    const row = body.querySelector<HTMLElement>(`.shop-item[data-id="${CSS.escape(item.id)}"]`)
    row?.classList.add('flash')
  })

  return {
    render,
    reset() {
      openId = firstAffordable()
      render()
      body.scrollTop = 0
    },
  }
}

