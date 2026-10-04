// Renderer, scene, post-processing: bloom, and a final
// pass for exposure and the grade (per-channel highlight roll-off keeps neon saturated, a black point keeps the
// darkness deep), vignette, the alarm's red edge pulse, hurt flash, network-vision tint and the glitch.
// Plus a small baked environment so glossy black reflects neon.
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
  Vector3,
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
const P = V.post

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime, uHurt, uGlitch, uScan, uAlarm, uFade;
uniform float uExposure, uBlack, uShoulder, uSat, uVignette, uAlarmEdge, uAlarmHz, uChroma, uScanLift, uScanLines;
uniform vec3 uScanTint, uRed;
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
  float ab = uChroma + uHurt * 0.006 + uGlitch * 0.012;
  vec3 c = vec3(texture2D(tDiffuse, uv + d * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ab).b);
  // grade: exposure, black point, per-channel shoulder (neon stays saturated instead of clipping to white), saturation
  c = max(c * uExposure - uBlack, 0.0);
  vec3 over = max(c - uShoulder, 0.0);
  c = min(c, vec3(uShoulder)) + (1.0 - uShoulder) * (1.0 - exp(-over / (1.0 - uShoulder)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  // network vision: a cold tint and scanlines; the lines stay readable
  c = mix(c, c * uScanTint + vec3(0.0, uScanLift * 0.5, uScanLift), uScan);
  c *= 1.0 - uScan * uScanLines * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.6));
  // vignette; at alarm 3 the edges pulse red (a beat, not a fog), red at the edges when hurt
  float v = smoothstep(0.3, 0.9, length(d * vec2(1.15, 1.0)));
  c *= 1.0 - uVignette * v;
  float beat = pow(0.5 + 0.5 * sin(uTime * uAlarmHz * 6.2831853), 4.0);
  c += uRed * v * v * uAlarm * uAlarmEdge * beat;
  c = mix(c, uRed, v * uHurt * 0.55);
  // falling into the void: the picture goes dark
  c *= 1.0 - uFade;
  gl_FragColor = vec4(c, 1.0);
}`

export interface Renderer {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  /** 0..1 effect strengths, set by the game view each frame; reflectY = the mirror plane height; fade = black. */
  fx: { hurt: number; glitch: number; scan: number; alarm: number; reflectY: number; fade: number }
  render(time: number): void
  resize(): void
}

function buildEnvironment(): Scene {
  // A dark box with cyan light strips: what glossy black surfaces reflect.
  const env = new Scene()
  env.background = new Color(0x000000)
  const room = new Mesh(new BoxGeometry(20, 10, 20), new MeshBasicMaterial({ color: 0x010203, side: BackSide }))
  env.add(room)
  const strip = (color: Color, x: number, y: number, z: number, w: number, h: number, d: number): void => {
    const m = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial({ color }))
    m.position.set(x, y, z)
    env.add(m)
  }
  const cyan = palette.seam.clone().multiplyScalar(V.light.envStrips)
  for (const s of [-1, 1]) {
    strip(cyan, s * 9.5, -4.5, 0, 0.12, 0.12, 20)
    strip(cyan, s * 9.5, 4.5, 0, 0.12, 0.12, 20)
    strip(cyan, 0, 4.5, s * 9.5, 20, 0.12, 0.12)
  }
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
  scene.add(new HemisphereLight(0x5a8cb4, 0x050608, V.light.hemi))
  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(buildEnvironment(), 0.02).texture
  pmrem.dispose()

  const camera = new PerspectiveCamera(V.fov, innerWidth / innerHeight, 0.05, V.far)
  const target = new WebGLRenderTarget(innerWidth, innerHeight, { type: HalfFloatType })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  // the pass halves the resolution for its first mip itself; the tight mip weights keep the halo close to the lines
  const bloom = new UnrealBloomPass(new Vector2(innerWidth * V.bloom.scale, innerHeight * V.bloom.scale), V.bloom.strength, V.bloom.radius, V.bloom.threshold)
  ;(bloom.compositeMaterial.uniforms['bloomFactors'] as { value: number[] }).value = V.bloom.factors.slice()
  composer.addPass(bloom)
  const final = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uHurt: { value: 0 },
      uGlitch: { value: 0 },
      uScan: { value: 0 },
      uAlarm: { value: 0 },
      uFade: { value: 0 },
      uExposure: { value: P.exposure },
      uBlack: { value: P.blackPoint },
      uShoulder: { value: P.shoulder },
      uSat: { value: P.saturation },
      uVignette: { value: P.vignette },
      uAlarmEdge: { value: P.alarmEdge },
      uAlarmHz: { value: P.alarmHz },
      uChroma: { value: P.chroma },
      uScanLift: { value: P.scanLift },
      uScanLines: { value: P.scanLines },
      uScanTint: { value: new Vector3(P.scanTint[0], P.scanTint[1], P.scanTint[2]) },
      uRed: { value: new Vector3(P.edgeRed[0], P.edgeRed[1], P.edgeRed[2]) },
      uRes: { value: new Vector2(innerWidth, innerHeight) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: FINAL_FRAG,
  })
  composer.addPass(final)
  composer.addPass(new OutputPass())
  const u = final.uniforms as Record<string, { value: unknown }>
  const fx = { hurt: 0, glitch: 0, scan: 0, alarm: 0, reflectY: 0, fade: 0 }

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
      ;(u['uFade'] as { value: number }).value = fx.fade
      composer.render()
    },
    resize(): void {
      renderer.setSize(innerWidth, innerHeight)
      composer.setSize(innerWidth, innerHeight)
      bloom.resolution.set(innerWidth * V.bloom.scale, innerHeight * V.bloom.scale)
      ;(u['uRes'] as { value: Vector2 }).value.set(innerWidth, innerHeight)
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
    },
  }
}
