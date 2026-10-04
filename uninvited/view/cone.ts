// A visible view cone (cameras and drones, DESIGN 8 "each has a view cone"): an additive volume that fades with
// distance, opening along +z from its apex at the origin. Color and strength are set every frame.
import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Mesh, ShaderMaterial } from 'three'

const VERT = /* glsl */ `
uniform float uRange;
varying float vT;
varying vec3 vN;
varying vec3 vView;
void main() {
  vT = length(position) / uRange;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
varying float vT;
varying vec3 vN;
varying vec3 vView;
void main() {
  float edge = 1.0 - abs(dot(normalize(vN), vView));
  float body = pow(max(1.0 - vT, 0.0), 1.4);
  float scan = 0.85 + 0.15 * sin(vT * 40.0 - uTime * 6.0);
  float a = body * (0.025 + 0.07 * pow(edge, 3.0)) * scan * uStrength;
  gl_FragColor = vec4(uColor * a, 1.0);
}`

export interface ViewCone {
  mesh: Mesh
  material: ShaderMaterial
  set(color: Color, strength: number, time: number): void
}

export function createCone(range: number, halfAngleRad: number): ViewCone {
  const geo = new ConeGeometry(range * Math.tan(halfAngleRad), range, 28, 8, true)
  geo.translate(0, -range / 2, 0)
  geo.rotateX(-Math.PI / 2)
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uStrength: { value: 1 }, uTime: { value: 0 }, uRange: { value: range } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  const mesh = new Mesh(geo, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  const u = material.uniforms as Record<string, { value: unknown }>
  return {
    mesh,
    material,
    set(color: Color, strength: number, time: number): void {
      ;(u['uColor']?.value as Color).copy(color)
      ;(u['uStrength'] as { value: number }).value = strength
      ;(u['uTime'] as { value: number }).value = time
    },
  }
}
