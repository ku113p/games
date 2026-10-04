// The network look (DESIGN 14, NN1b/KA3): glossy black, continuous cyan light seams, red security, bloom.
// Colors come from config.json "view.colors" (values above 1 feed the bloom).
import { Color, DoubleSide, AdditiveBlending, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import cfgAll from '../config.json'

const C = cfgAll.view.colors

export function hdr(rgb: readonly number[]): Color {
  return new Color(rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0)
}

export const palette = {
  seam: hdr(C.seam),
  seamDim: hdr(C.seamDim),
  security: hdr(C.security),
  securityDim: hdr(C.securityDim),
  suspicious: hdr(C.suspicious),
  sound: hdr(C.sound),
  terminal: hdr(C.terminal),
  terminalDone: hdr(C.terminalDone),
  paused: hdr(C.paused),
  heroWhite: hdr(C.heroWhite),
  heroRed: hdr(C.heroRed),
  heroBlue: hdr(C.heroBlue),
  checkpoint: hdr(C.checkpoint),
  artifact: hdr(C.artifact),
  wall: new Color(C.wall),
  floor: new Color(C.floor),
  fog: new Color(cfgAll.view.fog.color),
}

/** Shared materials (one instance each, recolored in place when needed). The corridor lines have their own shader
 * materials in view/corridors.ts (the alarm waves run along them). */
export function createMaterials(): Materials {
  return {
    glossBlack: new MeshStandardMaterial({ color: 0x05070a, metalness: 0.85, roughness: 0.22, envMapIntensity: 1.2 }),
    matteBlack: new MeshStandardMaterial({ color: 0x07090d, metalness: 0.4, roughness: 0.55 }),
    security: new MeshBasicMaterial({ color: palette.security, toneMapped: false }),
    securityAdd: new MeshBasicMaterial({ color: palette.security, toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    sound: new MeshBasicMaterial({ color: palette.sound, toneMapped: false }),
    terminal: new MeshBasicMaterial({ color: palette.terminal, toneMapped: false }),
  }
}

export interface Materials {
  glossBlack: MeshStandardMaterial
  matteBlack: MeshStandardMaterial
  security: MeshBasicMaterial
  securityAdd: MeshBasicMaterial
  sound: MeshBasicMaterial
  terminal: MeshBasicMaterial
}
