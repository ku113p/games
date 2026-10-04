// Three candidate art directions for the network ("inside the system") screen.
// Switch in the spike with keys 1/2/3 or ?look=grid|neon|dark. Colors above 1.0 feed the bloom.

export interface Look {
  id: string
  name: string
  background: number
  fog: number
  fogDensity: number
  grid: number
  gridMinor: number
  gridGlow: number
  wallBody: number
  wallEdge: number
  wallEdgeAlt: number
  edgeGlow: number
  hero: number
  heroBody: number
  heroGlow: number
  enemy: number
  enemyGlow: number
  accent: number
  firewall: number
  firewallGlow: number
  skyline: number
  skylineAlt: number
  tower: number
  hemiSky: number
  hemiGround: number
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  vignette: number
  scanlines: number
  aberration: number
}

export const LOOKS: Look[] = [
  {
    id: 'grid',
    name: 'A - Grid (clean Tron)',
    background: 0x02050c,
    fog: 0x03101e,
    fogDensity: 0.018,
    grid: 0x1ad8ff,
    gridMinor: 0x0b3b55,
    gridGlow: 1.6,
    wallBody: 0x050c16,
    wallEdge: 0x2fe6ff,
    wallEdgeAlt: 0x2fe6ff,
    edgeGlow: 2.2,
    hero: 0x7ff3ff,
    heroBody: 0x061018,
    heroGlow: 3.0,
    enemy: 0xff2a3a,
    enemyGlow: 3.0,
    accent: 0xffa21a,
    firewall: 0xff3344,
    firewallGlow: 1.8,
    skyline: 0x1a6fa0,
    skylineAlt: 0x1a6fa0,
    tower: 0x39d8ff,
    hemiSky: 0x2a5d80,
    hemiGround: 0x020408,
    bloomStrength: 0.9,
    bloomRadius: 0.55,
    bloomThreshold: 0.55,
    vignette: 0.35,
    scanlines: 0.0,
    aberration: 0.0,
  },
  {
    id: 'neon',
    name: 'B - Neon city (cyberpunk)',
    background: 0x07020f,
    fog: 0x1a0630,
    fogDensity: 0.022,
    grid: 0xff2bd6,
    gridMinor: 0x3a0c4a,
    gridGlow: 1.4,
    wallBody: 0x0c0418,
    wallEdge: 0x22e8ff,
    wallEdgeAlt: 0xff3bd0,
    edgeGlow: 2.0,
    hero: 0x5ff6ff,
    heroBody: 0x0a0616,
    heroGlow: 3.0,
    enemy: 0xff5a14,
    enemyGlow: 3.2,
    accent: 0xffe02a,
    firewall: 0xff2a6a,
    firewallGlow: 1.6,
    skyline: 0xff3bd0,
    skylineAlt: 0x22e8ff,
    tower: 0xb04bff,
    hemiSky: 0x5a2a80,
    hemiGround: 0x06020c,
    bloomStrength: 1.05,
    bloomRadius: 0.7,
    bloomThreshold: 0.5,
    vignette: 0.45,
    scanlines: 0.06,
    aberration: 0.0015,
  },
  {
    id: 'dark',
    name: 'C - Darksynth (hot red on black)',
    background: 0x000000,
    fog: 0x0c0204,
    fogDensity: 0.03,
    grid: 0xff2414,
    gridMinor: 0x2a0606,
    gridGlow: 1.2,
    wallBody: 0x060303,
    wallEdge: 0xffe6dc,
    wallEdgeAlt: 0xff2414,
    edgeGlow: 1.5,
    hero: 0x9ff8ff,
    heroBody: 0x040606,
    heroGlow: 3.4,
    enemy: 0xff1a0a,
    enemyGlow: 3.6,
    accent: 0xffb21a,
    firewall: 0xff1a0a,
    firewallGlow: 0.9,
    skyline: 0x801008,
    skylineAlt: 0xff6a3a,
    tower: 0xff2414,
    hemiSky: 0x401010,
    hemiGround: 0x000000,
    bloomStrength: 1.15,
    bloomRadius: 0.45,
    bloomThreshold: 0.45,
    vignette: 0.6,
    scanlines: 0.1,
    aberration: 0.0025,
  },
]

export function findLook(id: string | null): Look {
  return LOOKS.find((l) => l.id === id) ?? LOOKS[0]!
}
