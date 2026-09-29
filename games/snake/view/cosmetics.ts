// Косметика, надетая в магазине: какой набор цветов и какие виды змейки, яблока, стрелки-компаса.
// view/ ничего не знает о магазине и деньгах: сюда приходят только строки из payload предметов
// (config.shop.items[].payload.palette / .skin), а main.ts достаёт их из shop/ (equippedItem) и передаёт в createView.
// Неизвестное или пустое значение — вид по умолчанию: битое сохранение не должно ломать партию.

export const SNAKE_SKINS = ['classic', 'tailGuides'] as const
export const APPLE_SKINS = ['diamond', 'orb', 'star'] as const
export const COMPASS_SKINS = ['default', 'chevron', 'ring'] as const

export type SnakeSkin = (typeof SNAKE_SKINS)[number]
export type AppleSkin = (typeof APPLE_SKINS)[number]
export type CompassSkin = (typeof COMPASS_SKINS)[number]

/** Что пришло снаружи (payload предметов). Всё необязательно. */
export interface CosmeticsInput {
  palette?: string | undefined
  snakeSkin?: string | undefined
  appleSkin?: string | undefined
  compassSkin?: string | undefined
}

/** Проверенный выбор партии. palette здесь id набора, существует ли он в config.palettes, проверяет applyPaletteById. */
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

/** Холодный путь: проверить выбор и подставить умолчания. */
export function resolveCosmetics(input?: CosmeticsInput): Cosmetics {
  return {
    palette: input?.palette ?? DEFAULT_COSMETICS.palette,
    snakeSkin: pick(SNAKE_SKINS, input?.snakeSkin, DEFAULT_COSMETICS.snakeSkin),
    appleSkin: pick(APPLE_SKINS, input?.appleSkin, DEFAULT_COSMETICS.appleSkin),
    compassSkin: pick(COMPASS_SKINS, input?.compassSkin, DEFAULT_COSMETICS.compassSkin),
  }
}
