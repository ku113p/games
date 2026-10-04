// Renderer, scene, post-processing: bloom for the neon, a final pass for vignette, hurt flash, network-vision tint
// and the glitch that sells "something broke". Plus a small baked environment so glossy black reflects neon.
import {
  BoxGeometry,
  Color,
  FogExp2,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  BackSide,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import cfgAll from '../config.json'
import { palette } from './look'

const V = cfgAll.view

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime, uHurt, uGlitch, uScan, uAlarm;
uniform vec2 uRes;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  // glitch: horizontal slices jump sideways for a moment
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 24.0 + floor(uTime * 30.0) * 7.0);
    float on = step(1.0 - uGlitch * 0.45, hash(band));
    uv.x += (hash(band + 3.0) - 0.5) * 0.08 * uGlitch * on;
  }
  vec2 d = uv - 0.5;
  float ab = 0.0015 + uHurt * 0.006 + uGlitch * 0.012;
  vec3 c = vec3(texture2D(tDiffuse, uv + d * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ab).b);
  // network vision: cold tint + scanlines
  c = mix(c, c * vec3(0.55, 1.05, 1.25) + vec3(0.0, 0.015, 0.03), uScan);
  c *= 1.0 - uScan * 0.12 * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.6));
  // vignette, red at the edges when hurt or at alarm 3
  float v = smoothstep(0.3, 0.9, length(d * vec2(1.15, 1.0)));
  c *= 1.0 - 0.45 * v;
  c = mix(c, vec3(0.9, 0.03, 0.06), v * (uHurt * 0.55 + uAlarm * 0.12 * (0.6 + 0.4 * sin(uTime * 6.0))));
  gl_FragColor = vec4(c, 1.0);
}`

export interface Renderer {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  /** 0..1 effect strengths, set by the game view each frame. */
  fx: { hurt: number; glitch: number; scan: number; alarm: number }
  render(time: number): void
  resize(): void
}

function buildEnvironment(renderer: WebGLRenderer): Scene {
  // A dark box with cyan and red light strips: what glossy black surfaces reflect.
  const env = new Scene()
  env.background = new Color(0x010204)
  const room = new Mesh(new BoxGeometry(20, 10, 20), new MeshBasicMaterial({ color: 0x020408, side: BackSide }))
  env.add(room)
  const strip = (color: Color, x: number, y: number, z: number, w: number, h: number, d: number): void => {
    const m = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial({ color }))
    m.position.set(x, y, z)
    env.add(m)
  }
  const cyan = palette.seam.clone().multiplyScalar(0.8)
  for (const s of [-1, 1]) {
    strip(cyan, s * 9.5, -4.5, 0, 0.3, 0.3, 20)
    strip(cyan, s * 9.5, 4.5, 0, 0.3, 0.3, 20)
    strip(cyan, 0, 4.5, s * 9.5, 20, 0.3, 0.3)
  }
  strip(new Color(0.6, 0.7, 0.8), 0, 4.9, 0, 4, 0.1, 4)
  void renderer
  return env
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, V.pixelRatioMax))
  renderer.setSize(innerWidth, innerHeight)
  renderer.toneMapping = NoToneMapping
  const scene = new Scene()
  scene.background = palette.fog.clone()
  scene.fog = new FogExp2(palette.fog.getHex(), V.fog.density)
  scene.add(new HemisphereLight(0x5a8cb4, 0x050608, 0.9))
  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(buildEnvironment(renderer), 0.02).texture
  pmrem.dispose()

  const camera = new PerspectiveCamera(V.fov, innerWidth / innerHeight, 0.05, 400)
  const target = new WebGLRenderTarget(innerWidth, innerHeight, { type: HalfFloatType })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new Vector2(innerWidth / 2, innerHeight / 2), V.bloom.strength, V.bloom.radius, V.bloom.threshold)
  composer.addPass(bloom)
  const final = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uHurt: { value: 0 },
      uGlitch: { value: 0 },
      uScan: { value: 0 },
      uAlarm: { value: 0 },
      uRes: { value: new Vector2(innerWidth, innerHeight) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: FINAL_FRAG,
  })
  composer.addPass(final)
  composer.addPass(new OutputPass())
  const u = final.uniforms as Record<string, { value: unknown }>
  const fx = { hurt: 0, glitch: 0, scan: 0, alarm: 0 }

  return {
    renderer,
    scene,
    camera,
    fx,
    render(time: number): void {
      ;(u['uTime'] as { value: number }).value = time
      ;(u['uHurt'] as { value: number }).value = fx.hurt
      ;(u['uGlitch'] as { value: number }).value = fx.glitch
      ;(u['uScan'] as { value: number }).value = fx.scan
      ;(u['uAlarm'] as { value: number }).value = fx.alarm
      composer.render()
    },
    resize(): void {
      renderer.setSize(innerWidth, innerHeight)
      composer.setSize(innerWidth, innerHeight)
      bloom.resolution.set(innerWidth / 2, innerHeight / 2)
      ;(u['uRes'] as { value: Vector2 }).value.set(innerWidth, innerHeight)
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
    },
  }
}
