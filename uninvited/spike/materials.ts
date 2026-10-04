// Shared materials, recolored in place when the look changes (no rebuild of the scene).
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshLambertMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { Look } from './looks'

function glow(target: Color, hex: number, k: number): void {
  target.setHex(hex).multiplyScalar(k)
}

const GRID_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

// Anti-aliased neon grid: major lines every 4 units, minor every unit, faded with distance from the player.
const GRID_FRAG = /* glsl */ `
uniform vec3 uMajor;
uniform vec3 uMinor;
uniform vec3 uBase;
uniform vec3 uFocus;
uniform float uTime;
varying vec3 vWorld;
float line(vec2 p, float scale, float width) {
  vec2 g = abs(fract(p / scale - 0.5) - 0.5) / fwidth(p / scale);
  return 1.0 - min(min(g.x, g.y) / width, 1.0);
}
void main() {
  vec2 p = vWorld.xz;
  float major = line(p, 4.0, 1.2);
  float minor = line(p, 1.0, 0.8);
  float d = length(p - uFocus.xz);
  float near = exp(-d * 0.045);
  float pulse = 0.5 + 0.5 * sin(d * 0.6 - uTime * 2.2);
  vec3 c = uBase + uMinor * minor * 0.6 + uMajor * major * (0.35 + 0.65 * near) * (0.8 + 0.2 * pulse);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`

const WALLFX_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
void main() {
  float scan = 0.5 + 0.5 * sin(vUv.y * 90.0 - uTime * 8.0);
  float bars = step(0.92, fract(vUv.x * 30.0 + uTime * 0.4));
  float edge = smoothstep(0.0, 0.04, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
  float a = (0.12 + 0.25 * scan + 0.5 * bars) * edge * (1.0 - uOpen);
  gl_FragColor = vec4(uColor * (1.0 + 2.0 * bars), a);
}`

const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

export class Materials {
  readonly wallBody = new MeshLambertMaterial({ color: 0x000000 })
  readonly edge = new LineBasicMaterial({ toneMapped: false })
  readonly edgeAlt = new LineBasicMaterial({ toneMapped: false })
  readonly edgeDim = new LineBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.55 })
  readonly heroBody = new MeshLambertMaterial({ color: 0x000000 })
  readonly heroLine = new LineBasicMaterial({ toneMapped: false })
  readonly heroGlow = new MeshBasicMaterial({ toneMapped: false })
  readonly heroGhost = new MeshBasicMaterial({ toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
  readonly enemyGlow = new MeshBasicMaterial({ toneMapped: false })
  readonly enemyBody = new MeshLambertMaterial({ color: 0x000000 })
  readonly cone = new MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  readonly bolt = new MeshBasicMaterial({ toneMapped: false })
  readonly accent = new MeshBasicMaterial({ toneMapped: false })
  readonly accentLine = new LineBasicMaterial({ toneMapped: false })
  readonly accentSoft = new MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  readonly skyline = new LineBasicMaterial({ toneMapped: false, fog: true })
  readonly skylineAlt = new LineBasicMaterial({ toneMapped: false, fog: true })
  readonly tower = new MeshBasicMaterial({ toneMapped: false, fog: false })
  readonly towerLine = new LineBasicMaterial({ toneMapped: false, fog: false })
  readonly spark = new MeshBasicMaterial({ toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
  readonly slash = new MeshBasicMaterial({ toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  readonly decoy = new MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false })

  readonly grid = new ShaderMaterial({
    uniforms: {
      uMajor: { value: new Color() },
      uMinor: { value: new Color() },
      uBase: { value: new Color() },
      uFocus: { value: new Vector3() },
      uTime: { value: 0 },
      fogColor: { value: new Color() },
      fogDensity: { value: 0 },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
    },
    vertexShader: GRID_VERT.replace('void main() {', '#include <fog_pars_vertex>\nvoid main() {').replace(
      'gl_Position = projectionMatrix * viewMatrix * w;',
      'vec4 mvPosition = viewMatrix * w;\n  gl_Position = projectionMatrix * mvPosition;\n  #include <fog_vertex>',
    ),
    fragmentShader: '#include <fog_pars_fragment>\n' + GRID_FRAG,
    fog: true,
  })

  readonly firewall = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: UV_VERT,
    fragmentShader: WALLFX_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  })

  apply(look: Look): void {
    this.wallBody.color.setHex(look.wallBody)
    glow(this.edge.color, look.wallEdge, look.edgeGlow)
    glow(this.edgeAlt.color, look.wallEdgeAlt, look.edgeGlow)
    glow(this.edgeDim.color, look.wallEdge, look.edgeGlow * 0.5)
    this.heroBody.color.setHex(look.heroBody)
    glow(this.heroLine.color, look.hero, look.heroGlow)
    glow(this.heroGlow.color, look.hero, look.heroGlow)
    glow(this.heroGhost.color, look.hero, 0.7)
    glow(this.enemyGlow.color, look.enemy, look.enemyGlow)
    this.enemyBody.color.setHex(look.wallBody)
    glow(this.bolt.color, look.enemy, look.enemyGlow * 1.3)
    glow(this.accent.color, look.accent, 2.6)
    glow(this.accentLine.color, look.accent, 2.6)
    glow(this.accentSoft.color, look.accent, 1.2)
    glow(this.skyline.color, look.skyline, 1.1)
    glow(this.skylineAlt.color, look.skylineAlt, 1.1)
    glow(this.tower.color, look.tower, 2.2)
    glow(this.towerLine.color, look.tower, 1.6)
    glow(this.slash.color, look.hero, 3.2)
    glow(this.decoy.color, look.hero, 2.0)
    const u = this.grid.uniforms
    glow(u['uMajor']!.value as Color, look.grid, look.gridGlow)
    ;(u['uMinor']!.value as Color).setHex(look.gridMinor)
    ;(u['uBase']!.value as Color).setHex(look.background).multiplyScalar(0.8)
    glow(this.firewall.uniforms['uColor']!.value as Color, look.firewall, look.firewallGlow)
  }
}
