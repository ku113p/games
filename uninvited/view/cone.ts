// A visible view cone (cameras and drones, DESIGN 8 "each has a view cone"): an additive volume that fades with
// distance, opening along +z from its apex at the origin. Clipped by the device's sight fan (view/sight.ts), so it
// never shows through a wall into the next corridor. Color, strength and the fan are set every frame.
import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Mesh, ShaderMaterial, Vector2, Vector4, type Texture } from 'three'
import cfgAll from '../config.json'
import { SIGHT_GLSL, type Fan } from './sight'

const K = cfgAll.view.cones

const VERT = /* glsl */ `
uniform float uRange;
varying float vT;
varying vec3 vN;
varying vec3 vView;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vT = length(position) / uRange;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDepth = -mv.z;
  vView = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
uniform float uRange;
uniform float uFill;
uniform float uEdge;
uniform sampler2D uFans;
uniform vec4 uFan;
uniform float uFanV;
uniform vec2 uNearFade;
varying float vDepth;
varying float vT;
varying vec3 vN;
varying vec3 vView;
varying vec3 vWorld;
${SIGHT_GLSL}
void main() {
  float vis = 1.0;
  if (uFanV >= 0.0) {
    vec2 d = vWorld.xz - uFan.xy;
    float seen = sightAt(uFans, uFan, uFanV, d);
    vis = 1.0 - smoothstep(seen - 0.015, seen + 0.005, length(d) / uRange);
  }
  if (vis <= 0.0) discard;
  float edge = 1.0 - abs(dot(normalize(vN), vView));
  float body = pow(max(1.0 - vT, 0.0), 1.6);
  float scan = 0.85 + 0.15 * sin(vT * 40.0 - uTime * 6.0);
  // fades out right in front of the eye, so standing inside a cone does not fill the screen
  float nearFade = smoothstep(uNearFade.x, uNearFade.y, vDepth);
  float a = body * (uFill + uEdge * pow(edge, 4.0)) * scan * uStrength * vis * nearFade;
  gl_FragColor = vec4(uColor * a, 1.0);
}`

const all: ShaderMaterial[] = []
let xray = false

/** Network vision: every view cone shows through walls (still cut where its device cannot see). */
export function setConesXray(on: boolean): void {
  if (on === xray) return
  xray = on
  for (const m of all) m.depthTest = !on
}

export interface ViewCone {
  mesh: Mesh
  material: ShaderMaterial
  set(color: Color, strength: number, time: number, fan: Fan): void
}

export function createCone(range: number, halfAngleRad: number, fans: Texture): ViewCone {
  const geo = new ConeGeometry(range * Math.tan(halfAngleRad), range, 28, 8, true)
  geo.translate(0, -range / 2, 0)
  geo.rotateX(-Math.PI / 2)
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color() },
      uStrength: { value: 1 },
      uTime: { value: 0 },
      uRange: { value: range },
      uFill: { value: K.volumeFill },
      uEdge: { value: K.volumeEdge },
      uFans: { value: fans },
      uFan: { value: new Vector4() },
      uFanV: { value: -1 },
      uNearFade: { value: new Vector2(K.volumeNear[0], K.volumeNear[1]) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  all.push(material)
  material.depthTest = !xray
  const mesh = new Mesh(geo, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  const u = material.uniforms as Record<string, { value: unknown }>
  return {
    mesh,
    material,
    set(color: Color, strength: number, time: number, fan: Fan): void {
      ;(u['uColor']?.value as Color).copy(color)
      ;(u['uStrength'] as { value: number }).value = strength
      ;(u['uTime'] as { value: number }).value = time
      ;(u['uFan']?.value as Vector4).set(fan.ox, fan.oz, fan.yaw, fan.spread)
      ;(u['uFanV'] as { value: number }).value = fan.v
    },
  }
}
