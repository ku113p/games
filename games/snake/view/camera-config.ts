// Настройки камеры для вида: числа приходят из config.camera (их добавляет
// агент ядра). Запасные значения нужны, пока поля не появились в Config;
// после появления config.json их не используют.

import type { Config } from '../core/rules'

type CameraConfigExt = Config['camera'] & {
  followDistance?: number
  followHeight?: number
  lateralOffset?: number
  lookAheadDistance?: number
  lookDownOffset?: number
  modeSwitchMs?: number
}

// Запасные значения, а не числа баланса: см. комментарий выше.
const FALLBACK_FOLLOW_DISTANCE = 2
const FALLBACK_FOLLOW_HEIGHT = 1
const FALLBACK_LATERAL_OFFSET = 0.7
const FALLBACK_LOOK_AHEAD = 10
const FALLBACK_LOOK_DOWN = 1.5
const FALLBACK_MODE_SWITCH_MS = 1400

export interface CameraSettings {
  followDistance: number
  followHeight: number
  lateralOffset: number
  lookAheadDistance: number
  lookDownOffset: number
  modeSwitchMs: number
}

export function cameraSettings(config: Config): CameraSettings {
  const c = config.camera as CameraConfigExt
  return {
    followDistance: c.followDistance ?? FALLBACK_FOLLOW_DISTANCE,
    followHeight: c.followHeight ?? FALLBACK_FOLLOW_HEIGHT,
    lateralOffset: c.lateralOffset ?? FALLBACK_LATERAL_OFFSET,
    lookAheadDistance: c.lookAheadDistance ?? FALLBACK_LOOK_AHEAD,
    lookDownOffset: c.lookDownOffset ?? FALLBACK_LOOK_DOWN,
    modeSwitchMs: c.modeSwitchMs ?? FALLBACK_MODE_SWITCH_MS,
  }
}
