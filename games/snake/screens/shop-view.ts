// screens/shop-view.ts — the shop storefront: DOM on top of the item part (shop/).
// Cold path: redrawn in full on open, purchase, equip and language change. No game logic:
// what can be bought or equipped is decided by the item part, and the flow (main.ts) only gets "buy" and "equip".

import { t } from '../i18n/runtime'
import { en, type TextKey } from '../i18n/dictionaries'
import { equippedItem, gamesLeft, scoreMultiplier, type Item, type ShopRoot, type ShopState, type Slot } from '../shop'
import { SECTION_SLOT, SHOP_SECTIONS, isItemLocked, itemStatus, itemsOfSection, obstaclesLocked, type ItemStatus, type ObstacleGeometry, type ShopSection } from './shop-flow'

export interface ShopViewDeps {
  readonly config: ShopRoot
  /** All storefront items in catalog order. */
  readonly items: () => readonly Item[]
  readonly state: () => ShopState
  /** Clear zone and walls: from them the storefront learns that the equipped arena (5³) has no obstacles. */
  readonly obstacleGeometry: ObstacleGeometry
  readonly onBuy: (item: Item) => void
  readonly onEquip: (item: Item) => void
}

export interface ShopView {
  /** Redraw the storefront and the balance (except scroll position and focus, which are preserved). */
  render(): void
  /** On opening the shop: the first section with something affordable expands (otherwise the first), scroll goes to the top. */
  reset(): void
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100) // 1.5 -> «1.5», 2 -> «2»

function hasKey(key: string): key is TextKey {
  return key in en
}

/** Item name: multipliers are computed from the number, the rest come from the dictionary (no entry: the id itself shows). */
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

function buildRow(item: Item, state: ShopState, config: ShopRoot, locked: boolean): HTMLElement {
  const status = itemStatus(state, item, config)
  const row = el('div', `shop-item ${status}${locked ? ' locked' : ''}`)
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
    if (locked) btn.disabled = true
    else if (status === 'buyable') btn.dataset['act'] = 'buy'
    else if (status === 'owned') btn.dataset['act'] = 'equip'
    else btn.disabled = true
    row.appendChild(btn)
  } else {
    row.setAttribute('aria-label', t('aria.shopLocked'))
  }
  return row
}

/** A short "what is selected now" for the header of a collapsed section. */
function sectionSummary(section: ShopSection, state: ShopState, config: ShopRoot, geometry: ObstacleGeometry): string {
  // There are no obstacles in this arena whatever is equipped: the header tells the truth about the game, not about a remembered choice.
  if (section.id === 'obstacles' && obstaclesLocked(state, config, geometry)) return t('shop.item.density-0')
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
  // The section expanded right now (one at a time: an accordion, so nine sections do not turn into a wall of text). null means all collapsed.
  let openId: ShopSection['id'] | null = null

  function firstAffordable(): ShopSection['id'] {
    const state = deps.state()
    for (const section of SHOP_SECTIONS) {
      const list = itemsOfSection(deps.items(), section)
      if (list.some((it) => it.kind !== 'scoreMultTemporary' && itemStatus(state, it, deps.config) === 'buyable' && !isItemLocked(state, it, deps.config, deps.obstacleGeometry))) return section.id
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
      // A dot on the header: the section has something to buy right now (not a temporary item), visible even when collapsed.
      if (list.some((it) => it.kind !== 'scoreMultTemporary' && itemStatus(state, it, deps.config) === 'buyable' && !isItemLocked(state, it, deps.config, deps.obstacleGeometry))) head.append(el('span', 'g-dot'))
      head.append(el('span', 'g-now', sectionSummary(section, state, deps.config, deps.obstacleGeometry)), el('span', 'g-chev'))
      group.appendChild(head)
      if (open) {
        const panel = el('div', 'shop-group-items')
        // An arena without obstacles (5³): instead of silently inactive buttons, the reason. The density choice is preserved.
        const noObstacles = section.id === 'obstacles' && obstaclesLocked(state, deps.config, deps.obstacleGeometry)
        if (noObstacles) {
          const note = el('p', 'shop-note', t('shop.obstacles.tiny'))
          note.setAttribute('role', 'note')
          panel.appendChild(note)
        }
        for (const it of list) panel.appendChild(buildRow(it, state, deps.config, isItemLocked(state, it, deps.config, deps.obstacleGeometry)))
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

