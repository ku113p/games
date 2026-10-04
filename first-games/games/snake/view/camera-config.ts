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
  /** The flat opening: cells across the screen, margin around them, vertical field of view, share of the flight over which the other layers are revealed. */
  planeVisibleCells: number
  planeMarginCells: number
  planeFovDeg: number
  planeRaise: number
  planeRevealShare: number
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
    planeVisibleCells: c.plane.visibleCells,
    planeMarginCells: c.plane.marginCells,
    planeFovDeg: c.plane.fovDeg,
    planeRaise: c.plane.raise,
    planeRevealShare: c.plane.revealShare,
  }
}

/**
 * Distance from the cube center to the camera in the plane view (the flat opening). The head's layer (perpendicular to depth, at
 * floor(size / 2), half a cell off the center plane of an even cube) has to fill the screen across its short side, portrait or landscape (min(aspect, 1)):
 * min(size, planeVisibleCells) + planeMarginCells cells. The narrow field of view puts the camera far away, which is what makes the layer read as flat.
 * Pure (no three.js), so the framing can be tested.
 */
export function planeCameraDistance(size: number, aspect: number, settings: CameraSettings): number {
  const cells = Math.min(size, settings.planeVisibleCells) + settings.planeMarginCells
  const halfTan = Math.tan((settings.planeFovDeg * Math.PI) / 360) * Math.min(aspect, 1)
  const layerShift = Math.floor(size / 2) - (size - 1) / 2
  return cells / 2 / halfTan + layerShift
}
