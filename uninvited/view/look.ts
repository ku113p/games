// The network look (DESIGN 14, NN1b/KA3): glossy black, continuous cyan light seams, red security, bloom.
// Colors come from config.json "view.colors" (values above 1 feed the bloom).
import { Color, DoubleSide, AdditiveBlending, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three'
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

const RIM = cfgAll.view.light.rim

/** A cold fresnel rim on a lit material, so dark bodies keep their silhouette against the dark (second look pass). */
export function addRim(m: Material, strength = 1, tint?: readonly number[], power = 3): void {
  const base = tint ?? RIM
  const color = new Color(base[0] ?? 0, base[1] ?? 0, base[2] ?? 0).multiplyScalar(strength)
  m.onBeforeCompile = (sh): void => {
    sh.uniforms['uRim'] = { value: color }
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `outgoingLight += uRim * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), ${power.toFixed(2)});\n#include <opaque_fragment>`,
    )
  }
  m.customProgramCacheKey = (): string => `rim${power}`
}

/** Shared materials (one instance each, recolored in place when needed). The corridor lines have their own shader
 * materials in view/city.ts (the alarm waves run along them). */
export function createMaterials(): Materials {
  const glossBlack = new MeshStandardMaterial({ color: 0x080b10, metalness: 0.85, roughness: 0.26, envMapIntensity: 1.2 })
  const matteBlack = new MeshStandardMaterial({ color: 0x0a0d12, metalness: 0.4, roughness: 0.55 })
  addRim(glossBlack)
  addRim(matteBlack, 0.7)
  return {
    glossBlack,
    matteBlack,
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
