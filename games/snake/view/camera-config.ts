// Camera settings for the view: the numbers come from config.camera (added by
// the core agent). The fallback values are needed until the fields appear in Config;
// once they are in config.json, the fallbacks are not used.

import type { Config } from '../core/rules'

type CameraConfigExt = Config['camera'] & {
  followDistance?: number
  followHeight?: number
  lateralOffset?: number
  lookAheadDistance?: number
  lookDownOffset?: number
  modeSwitchMs?: number
}

// Fallback values, not balance numbers: see the comment above.
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
