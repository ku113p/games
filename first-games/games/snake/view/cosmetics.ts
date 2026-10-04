// Cosmetics equipped in the shop: which color set and which skins for the snake, apple and compass arrow.
// view/ knows nothing about the shop or money: it only receives strings from the items' payload
// (config.shop.items[].payload.palette / .skin); main.ts pulls them from shop/ (equippedItem) and passes them to createView.
// An unknown or empty value means the default skin: a corrupted save must not break a game.

export const SNAKE_SKINS = ['classic', 'tailGuides'] as const
export const APPLE_SKINS = ['diamond', 'orb', 'star'] as const
export const COMPASS_SKINS = ['default', 'chevron', 'ring'] as const

export type SnakeSkin = (typeof SNAKE_SKINS)[number]
export type AppleSkin = (typeof APPLE_SKINS)[number]
export type CompassSkin = (typeof COMPASS_SKINS)[number]

/** What came from outside (the items' payload). Everything is optional. */
export interface CosmeticsInput {
  palette?: string | undefined
  snakeSkin?: string | undefined
  appleSkin?: string | undefined
  compassSkin?: string | undefined
}

/** The validated choice for a game. Here palette is the set id; whether it exists in config.palettes is checked by applyPaletteById. */
export interface Cosmetics {
  palette: string
  snakeSkin: SnakeSkin
  appleSkin: AppleSkin
  compassSkin: CompassSkin
}

export const DEFAULT_COSMETICS: Readonly<Cosmetics> = {
  palette: 'neon',
  snakeSkin: 'classic',
  appleSkin: 'diamond',
  compassSkin: 'default',
}

function pick<T extends string>(list: readonly T[], value: string | undefined, fallback: T): T {
  return value !== undefined && (list as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Cold path: validate the choice and fill in defaults. */
export function resolveCosmetics(input?: CosmeticsInput): Cosmetics {
  return {
    palette: input?.palette ?? DEFAULT_COSMETICS.palette,
    snakeSkin: pick(SNAKE_SKINS, input?.snakeSkin, DEFAULT_COSMETICS.snakeSkin),
    appleSkin: pick(APPLE_SKINS, input?.appleSkin, DEFAULT_COSMETICS.appleSkin),
    compassSkin: pick(COMPASS_SKINS, input?.compassSkin, DEFAULT_COSMETICS.compassSkin),
  }
}
