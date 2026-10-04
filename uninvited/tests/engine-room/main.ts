// Engine test for the real-world room: how close can the browser get to the generated look, and at what cost?
//   1 plate  - the generated image as the background, live effects on top (rain, screens, lamp, parallax), clickable props,
//              a 3D character composited over it.
//   2 full   - the same room built in 3D: PBR materials, shadows, AO, bloom, film grain.
//   3 pixel  - mode 2 rendered at a quarter of the resolution and scaled up with hard pixels.
// Throwaway test code, not the game architecture.
import {
  ACESFilmicToneMapping,
  AnimationMixer,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Clock,
  Color,
  CylinderGeometry,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  type Object3D,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SpotLight,
  SRGBColorSpace,
  TextureLoader,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import plateUrl from '../../art/generated/A2-room-plate.jpg'
import xbotUrl from './models/Xbot.glb'

type Mode = 'plate' | 'full' | 'pixel'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight, false)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap
const clock = new Clock()
const statsEl = document.getElementById('stats')!
const hintEl = document.getElementById('hint')!
const toastEl = document.getElementById('toast')!
const charBox = document.getElementById('char') as HTMLInputElement
const aoBox = document.getElementById('ao') as HTMLInputElement

// ---------------------------------------------------------------- 1. plate
// Regions of the generated image, measured on A2 (x, y from the top-left, 0..1).
const WINDOW = [0.06, 0.05, 0.32, 0.66]
const SCREENS = [0.44, 0.43, 0.82, 0.62]
const LAMP = [0.865, 0.52]
interface Hotspot { rect: number[]; label: string; action: string }
const HOTSPOTS: Hotspot[] = [
  { rect: [0.885, 0.6, 0.935, 0.77], label: 'Drink water', action: 'He drinks. The water tastes of plastic.' },
  { rect: [0.5, 0.16, 0.62, 0.34], label: 'Eat', action: 'Instant noodles again. Third day in a row.' },
  { rect: [0.72, 0.71, 0.86, 0.81], label: 'Read the news', action: 'SHUSEKI ANNOUNCES ANOTHER WAVE OF RESTRUCTURING' },
  { rect: [0.84, 0.22, 0.935, 0.43], label: 'Jack in', action: 'Connect to the network? (confirm)' },
]

const plateTex = new TextureLoader().load(plateUrl, (t) => {
  plateMat.uniforms['uImgAspect']!.value = t.image.width / t.image.height
})
plateTex.colorSpace = SRGBColorSpace
const plateMat = new ShaderMaterial({
  uniforms: {
    tPlate: { value: plateTex },
    uImgAspect: { value: 16 / 9 },
    uScreenAspect: { value: innerWidth / innerHeight },
    uTime: { value: 0 },
    uMouse: { value: new Vector2() },
    uHover: { value: [0, 0, 0, 0] },
    uHoverOn: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tPlate; uniform float uImgAspect, uScreenAspect, uTime, uHoverOn; uniform vec2 uMouse; uniform vec4 uHover;
    varying vec2 vUv;
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    bool inRect(vec2 p, vec4 r){ return p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w; }
    // screen uv -> image uv (top-left origin), cover-fit plus a slight zoom so the parallax never shows the edge
    vec2 toImage(vec2 s){
      vec2 p = s - 0.5;
      if (uScreenAspect > uImgAspect) p.y *= uImgAspect / uScreenAspect; else p.x *= uScreenAspect / uImgAspect;
      p *= 0.96; p += uMouse * vec2(0.012, 0.008);
      p += 0.5; p.y = 1.0 - p.y; return p;
    }
    void main(){
      vec2 ip = toImage(vUv);
      vec4 win = vec4(${WINDOW.join(', ')});
      vec2 sp = ip;
      float rain = 0.0;
      if (inRect(ip, win)) {
        // rain streaks running down the glass + a tiny refraction wobble
        float col = floor(ip.x * 140.0);
        float h = hash(col);
        float y = fract(ip.y * (1.5 + h) - uTime * (0.25 + h * 0.6) + h * 7.0);
        float streak = smoothstep(0.0, 0.015, y) * smoothstep(0.12, 0.0, y) * step(0.62, h);
        float drops = step(0.985, hash2(floor(ip * vec2(220.0, 140.0)))) * 0.6;
        rain = streak + drops;
        sp += vec2(sin(ip.y * 90.0 + uTime * 3.0) * 0.0012, 0.0) * (0.4 + rain);
      }
      vec3 c = texture2D(tPlate, vec2(sp.x, 1.0 - sp.y)).rgb;
      if (inRect(ip, win)) {
        float neon = 0.85 + 0.15 * sin(uTime * 2.3 + sin(uTime * 7.1) * 0.6);
        c *= mix(1.0, neon, smoothstep(0.1, 0.4, c.r - c.g));
        c += rain * vec3(0.18, 0.2, 0.25);
      }
      vec4 scr = vec4(${SCREENS.join(', ')});
      if (inRect(ip, scr)) {
        float lum = dot(c, vec3(0.3, 0.5, 0.2));
        float m = smoothstep(0.25, 0.5, lum);
        c += c * m * (0.08 * sin(ip.y * 900.0 - uTime * 12.0) + 0.06 * sin(uTime * 13.0 + ip.x * 40.0));
      }
      vec2 lamp = vec2(${LAMP.join(', ')});
      float flick = 0.92 + 0.08 * sin(uTime * 23.0) * sin(uTime * 3.7);
      c *= mix(1.0, flick, exp(-length((ip - lamp) * vec2(uImgAspect, 1.0)) * 4.0));
      if (uHoverOn > 0.5 && inRect(ip, uHover)) {
        vec2 q = (ip - uHover.xy) / (uHover.zw - uHover.xy);
        float edge = 1.0 - smoothstep(0.0, 0.06, min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)));
        c = c * 1.25 + edge * vec3(1.0, 0.75, 0.35) * 0.35;
      }
      vec2 d = vUv - 0.5;
      c *= 1.0 - 0.45 * smoothstep(0.35, 0.85, length(d * vec2(1.3, 1.0)));
      c += (hash2(vUv * 913.0 + uTime) - 0.5) * 0.035;
      gl_FragColor = vec4(c, 1.0);
    }`,
  depthWrite: false,
  depthTest: false,
})
const plateScene = new Scene()
const plateQuad = new Mesh(new PlaneGeometry(2, 2), plateMat)
plateQuad.frustumCulled = false
plateScene.add(plateQuad)
const orthoCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

// The character over the plate: lit to match it (warm lamp on the right, cyan screens in front, pink window on the left).
const charScene = new Scene()
const charCam = new PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 50)
charCam.position.set(0, 1.25, 0)
charCam.lookAt(0, 1.0, -3)
charScene.add(new HemisphereLight(0x6a7c9a, 0x0a0806, 0.6))
const charLamp = new PointLight(0xffb066, 6, 6, 1.5)
charLamp.position.set(1.4, 1.6, -2.4)
const charScreens = new PointLight(0x55d8ff, 4, 5, 1.5)
charScreens.position.set(0.2, 1.3, -3.6)
const charWindow = new PointLight(0xff4fb0, 3, 6, 1.5)
charWindow.position.set(-2.2, 1.6, -3)
charScene.add(charLamp, charScreens, charWindow)

// ---------------------------------------------------------------- 2. full 3D room
const room = new Scene()
room.background = new Color(0x050608)
room.fog = new FogExp2(0x07080b, 0.06)
const cam3d = new PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 60)
cam3d.position.set(1.15, 1.62, 1.45)
cam3d.lookAt(-0.55, 1.1, -1.4)

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1): CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  draw(cv.getContext('2d')!)
  const t = new CanvasTexture(cv)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}
function noise(g: CanvasRenderingContext2D, w: number, h: number, a: number): void {
  const d = g.getImageData(0, 0, w, h)
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * a
    d.data[i] = d.data[i]! + n
    d.data[i + 1] = d.data[i + 1]! + n
    d.data[i + 2] = d.data[i + 2]! + n
  }
  g.putImageData(d, 0, 0)
}
// Corrugated metal: colour with rust and stains, plus a normal map of vertical waves.
const metalMap = canvasTex(512, 512, (g) => {
  g.fillStyle = '#4a4f52'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 60},${50 + Math.random() * 30},20,${Math.random() * 0.25})`
    g.beginPath()
    g.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 60, 20 + Math.random() * 120, 0, 0, Math.PI * 2)
    g.fill()
  }
  noise(g, 512, 512, 30)
})
const metalNormal = canvasTex(256, 16, (g) => {
  for (let x = 0; x < 256; x++) {
    const s = Math.cos((x / 256) * Math.PI * 2 * 8)
    const r = Math.round(128 + s * 90)
    g.fillStyle = `rgb(${r},128,255)`
    g.fillRect(x, 0, 1, 16)
  }
})
metalNormal.colorSpace = ''
const wallMat = new MeshStandardMaterial({ map: metalMap, normalMap: metalNormal, metalness: 0.55, roughness: 0.62 })
metalMap.repeat.set(2, 1)
metalNormal.repeat.set(3, 1)
const plasticMap = canvasTex(256, 256, (g) => {
  g.fillStyle = '#8b8f86'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = 'rgba(40,40,40,0.5)'
  g.lineWidth = 3
  for (let i = 0; i < 6; i++) g.strokeRect(Math.random() * 200, Math.random() * 200, 40 + Math.random() * 80, 30 + Math.random() * 60)
  noise(g, 256, 256, 24)
})
const plasticMat = new MeshStandardMaterial({ map: plasticMap, roughness: 0.85, transparent: true, opacity: 0.9 })
const floorMat = new MeshStandardMaterial({
  map: canvasTex(512, 512, (g) => {
    g.fillStyle = '#2b2a28'
    g.fillRect(0, 0, 512, 512)
    noise(g, 512, 512, 40)
  }, 3),
  roughness: 0.9,
})
const woodMat = new MeshStandardMaterial({
  map: canvasTex(256, 256, (g) => {
    g.fillStyle = '#3b2a1e'
    g.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 256; y += 3) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`
      g.fillRect(0, y, 256, 1)
    }
    noise(g, 256, 256, 20)
  }),
  roughness: 0.7,
})
const darkMetal = new MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.7, roughness: 0.45 })
function screenTex(hue: string): CanvasTexture {
  return canvasTex(256, 160, (g) => {
    g.fillStyle = '#02080c'
    g.fillRect(0, 0, 256, 160)
    g.strokeStyle = hue
    g.lineWidth = 1.5
    for (let i = 0; i < 9; i++) {
      g.beginPath()
      g.moveTo(10, 15 + i * 15)
      g.lineTo(30 + Math.random() * 200, 15 + i * 15)
      g.stroke()
    }
    g.beginPath()
    for (let x = 0; x < 256; x += 4) g.lineTo(x, 120 + Math.sin(x * 0.12) * 18 * Math.random())
    g.stroke()
  })
}

function box(w: number, h: number, d: number, mat: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number, parent: Object3D = room): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}
// Room 3.4 x 2.5 x 3.2, camera in the front-right corner looking at the back-left.
const W = 3.4
const H = 2.5
const D = 3.2
const floor = new Mesh(new PlaneGeometry(W, D), floorMat)
floor.rotation.x = -Math.PI / 2
floor.position.set(0, 0, -D / 2 + 0.6)
floor.receiveShadow = true
room.add(floor)
const ceil = new Mesh(new PlaneGeometry(W, D), darkMetal)
ceil.rotation.x = Math.PI / 2
ceil.position.set(0, H, -D / 2 + 0.6)
room.add(ceil)
const back = new Mesh(new PlaneGeometry(W, H), wallMat)
back.position.set(0, H / 2, -D + 0.6)
back.receiveShadow = true
room.add(back)
// Left wall with a window hole: three pieces around it.
const leftX = -W / 2
function wallPiece(z0: number, z1: number, y0: number, y1: number): void {
  const m = new Mesh(new PlaneGeometry(z1 - z0, y1 - y0), wallMat)
  m.rotation.y = Math.PI / 2
  m.position.set(leftX, (y0 + y1) / 2, -(z0 + z1) / 2 + 0.6)
  m.receiveShadow = true
  room.add(m)
}
wallPiece(0, 1.0, 0, H)
wallPiece(2.2, D, 0, H)
wallPiece(1.0, 2.2, 0, 0.95)
wallPiece(1.0, 2.2, 2.05, H)
// The city outside: the plate's own window as a far backdrop (blurred by distance and fog-free).
const cityTex = plateTex.clone()
cityTex.repeat.set(WINDOW[2]! - WINDOW[0]!, WINDOW[3]! - WINDOW[1]!)
cityTex.offset.set(WINDOW[0]!, 1 - WINDOW[3]!)
const city = new Mesh(new PlaneGeometry(3.2, 3.2), new MeshBasicMaterial({ map: cityTex, fog: false }))
city.rotation.y = Math.PI / 2
city.position.set(leftX - 2.5, 1.5, -1.6 + 0.6)
room.add(city)
const rainMat = new ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  transparent: true,
  depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    void main(){ float col = floor(vUv.x * 90.0); float h = hash(col);
      float y = fract(vUv.y * (1.2 + h) + uTime * (0.3 + h * 0.6) + h * 9.0);
      float s = smoothstep(0.0, 0.02, y) * smoothstep(0.15, 0.0, y) * step(0.6, h);
      gl_FragColor = vec4(vec3(0.75, 0.85, 1.0), 0.06 + s * 0.35); }`,
})
const glass = new Mesh(new PlaneGeometry(1.2, 1.1), rainMat)
glass.rotation.y = Math.PI / 2
glass.position.set(leftX + 0.01, 1.5, -1.6 + 0.6)
room.add(glass)
box(0.06, 1.2, 0.06, darkMetal, leftX + 0.03, 1.5, -1.0 + 0.6)
box(0.06, 1.2, 0.06, darkMetal, leftX + 0.03, 1.5, -2.2 + 0.6)
box(0.08, 0.06, 1.3, darkMetal, leftX + 0.04, 0.95, -1.6 + 0.6)
box(0.08, 0.06, 1.3, darkMetal, leftX + 0.04, 2.05, -1.6 + 0.6)
// Patched plastic panels on the back wall.
for (const [x, y, w, h] of [[0.3, 1.7, 0.9, 0.7], [-0.6, 0.6, 0.7, 0.5], [1.1, 1.2, 0.5, 0.9]] as const) {
  const p = new Mesh(new PlaneGeometry(w, h), plasticMat)
  p.position.set(x, y, -D + 0.62)
  p.rotation.z = (Math.random() - 0.5) * 0.06
  room.add(p)
}
// Desk along the back wall with screens, keyboard, lamp, tablet, bottle.
const desk = new Group()
room.add(desk)
box(2.0, 0.05, 0.7, woodMat, 0.2, 0.76, -D + 0.98, desk)
box(0.05, 0.76, 0.6, darkMetal, -0.75, 0.38, -D + 0.98, desk)
box(0.05, 0.76, 0.6, darkMetal, 1.15, 0.38, -D + 0.98, desk)
const screenMats: MeshBasicMaterial[] = []
for (const [x, w, h, rot, hue] of [[-0.45, 0.42, 0.28, 0.25, '#45d8ff'], [0.0, 0.5, 0.32, 0.05, '#7affd9'], [0.5, 0.46, 0.3, -0.1, '#45d8ff'], [0.95, 0.34, 0.24, -0.35, '#ff7ad9']] as const) {
  const g = new Group()
  g.position.set(x, 1.05, -D + 0.85)
  g.rotation.y = rot
  desk.add(g)
  box(w + 0.03, h + 0.03, 0.04, darkMetal, 0, 0, -0.01, g)
  const sm = new MeshBasicMaterial({ map: screenTex(hue), toneMapped: false })
  sm.color.setScalar(1.6)
  screenMats.push(sm)
  const s = new Mesh(new PlaneGeometry(w, h), sm)
  s.position.z = 0.012
  g.add(s)
  box(0.04, 0.2, 0.04, darkMetal, 0, -h / 2 - 0.1, -0.02, g)
}
box(0.55, 0.025, 0.18, darkMetal, 0.1, 0.795, -D + 1.2, desk)
const tablet = new Mesh(new BoxGeometry(0.3, 0.01, 0.2), new MeshStandardMaterial({ color: 0x60e0ff, emissive: 0x2aa8d8, emissiveIntensity: 1.2, transparent: true, opacity: 0.55 }))
tablet.position.set(0.85, 0.79, -D + 1.15)
desk.add(tablet)
const bottle = new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(0.035, 0), new Vector2(0.036, 0.18), new Vector2(0.018, 0.22), new Vector2(0.015, 0.25)], 16), new MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.45 }))
bottle.position.set(1.05, 0.785, -D + 1.1)
desk.add(bottle)
// Desk lamp with a warm, shadow-casting spot.
const lampHead = new Mesh(new CylinderGeometry(0.03, 0.09, 0.12, 16, 1, true), new MeshStandardMaterial({ color: 0x8a8f94, metalness: 0.8, roughness: 0.3, side: DoubleSide }))
lampHead.position.set(1.0, 1.25, -D + 1.0)
lampHead.rotation.z = 0.5
room.add(lampHead)
const bulb = new Mesh(new CylinderGeometry(0.03, 0.03, 0.02, 12), new MeshBasicMaterial({ color: new Color(4, 2.6, 1.4), toneMapped: false }))
bulb.position.set(1.02, 1.2, -D + 1.0)
room.add(bulb)
const lamp = new SpotLight(0xffb066, 9, 6, 0.9, 0.6, 1.5)
lamp.position.copy(bulb.position)
lamp.target.position.set(0.6, 0.6, -D + 1.1)
lamp.castShadow = true
lamp.shadow.mapSize.set(1024, 1024)
lamp.shadow.bias = -0.0005
room.add(lamp, lamp.target)
const screenGlow = new PointLight(0x55d8ff, 2.2, 3.5, 1.6)
screenGlow.position.set(0.2, 1.1, -D + 1.3)
room.add(screenGlow)
const windowGlow = new PointLight(0xff4fb0, 2.5, 4.5, 1.4)
windowGlow.position.set(leftX + 0.3, 1.6, -1.6 + 0.6)
room.add(windowGlow)
room.add(new HemisphereLight(0x3a4a66, 0x0a0806, 0.25))
// Shelf with noodle cups.
box(0.7, 0.03, 0.22, woodMat, 0.35, 1.75, -D + 0.72)
for (let i = 0; i < 6; i++) {
  const cup = new Mesh(new CylinderGeometry(0.045, 0.035, 0.11, 16), new MeshStandardMaterial({
    map: canvasTex(64, 32, (g) => {
      g.fillStyle = ['#e9e1c9', '#d84a3a', '#f0c040'][i % 3]!
      g.fillRect(0, 0, 64, 32)
      g.fillStyle = '#c0392b'
      g.fillRect(0, 10, 64, 8)
    }),
    roughness: 0.6,
  }))
  cup.position.set(0.08 + i * 0.1, 1.82, -D + 0.72)
  cup.castShadow = true
  room.add(cup)
}
// Cables along the walls.
const cableMat = new MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.5 })
for (let i = 0; i < 9; i++) {
  const pts: Vector3[] = []
  const y0 = 0.4 + Math.random() * 1.8
  for (let k = 0; k < 6; k++) pts.push(new Vector3(-1.5 + k * 0.6 + Math.random() * 0.1, y0 + Math.sin(k + i) * 0.25 - k * 0.05, -D + 0.63 + Math.random() * 0.03))
  room.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 40, 0.008 + Math.random() * 0.01, 6), cableMat))
}
// Office chair in front of the desk.
const chair = new Group()
chair.position.set(0.15, 0, -D + 1.75)
room.add(chair)
const chairMat = new MeshStandardMaterial({ color: 0x2a2826, roughness: 0.8 })
box(0.5, 0.08, 0.5, chairMat, 0, 0.48, 0, chair)
box(0.48, 0.6, 0.07, chairMat, 0, 0.85, 0.24, chair)
box(0.05, 0.42, 0.05, darkMetal, 0, 0.24, 0, chair)
box(0.55, 0.03, 0.08, darkMetal, 0, 0.03, 0, chair)
box(0.08, 0.03, 0.55, darkMetal, 0, 0.03, 0, chair)
// Cot along the right wall.
box(0.8, 0.35, 1.8, new MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.95 }), 1.25, 0.18, -D + 2.1)

const pmrem = new PMREMGenerator(renderer)
room.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
room.environmentIntensity = 0.12

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(room, cam3d))
const gtao = new GTAOPass(room, cam3d, innerWidth, innerHeight)
composer.addPass(gtao)
const bloom = new UnrealBloomPass(new Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.5, 0.82)
composer.addPass(bloom)
composer.addPass(new OutputPass())
composer.addPass(new FilmPass(0.25, false))

// ---------------------------------------------------------------- character (placeholder: three.js Xbot)
interface Rig { root: Object3D; mixer: AnimationMixer; bones: Map<string, Object3D> }
const rigs: Rig[] = []
new GLTFLoader().load(xbotUrl, (gltf) => {
  const idle = gltf.animations.find((a) => a.name === 'idle') ?? gltf.animations[0]!
  for (const [scene, pos, scale] of [[charScene, new Vector3(0.05, 0.0, -2.05), 1.0], [room, new Vector3(0.15, 0.02, -D + 1.62), 1.0]] as const) {
    const root = cloneSkinned(gltf.scene)
    root.position.copy(pos)
    root.scale.setScalar(scale)
    root.rotation.y = Math.PI // back to the camera
    root.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.material = new MeshStandardMaterial({ color: 0x1d2024, roughness: 0.85, metalness: 0.05 })
      }
    })
    scene.add(root)
    const mixer = new AnimationMixer(root)
    mixer.clipAction(idle).play()
    const bones = new Map<string, Object3D>()
    root.traverse((o) => {
      if ((o as unknown as { isBone?: boolean }).isBone) bones.set(o.name.replace('mixamorig', ''), o)
    })
    rigs.push({ root, mixer, bones })
  }
})
// Seated, typing pose layered over the idle breathing.
function sit(r: Rig): void {
  const b = (n: string) => r.bones.get(n)
  const hips = b('Hips')
  if (hips) hips.position.y -= 38
  for (const side of ['Left', 'Right']) {
    const up = b(`${side}UpLeg`)
    const leg = b(`${side}Leg`)
    if (up) up.rotation.x -= 1.45
    if (leg) leg.rotation.x += 1.5
    const arm = b(`${side}Arm`)
    const fore = b(`${side}ForeArm`)
    if (arm) arm.rotation.x -= 0.5
    if (fore) fore.rotation.x -= 0.6
  }
  const spine = b('Spine1')
  if (spine) spine.rotation.x += 0.18
}

// ---------------------------------------------------------------- mode, input, loop
let mode: Mode = 'plate'
const buttons = [...document.querySelectorAll<HTMLButtonElement>('#ui button')]
function setMode(m: Mode): void {
  mode = m
  buttons.forEach((b) => b.classList.toggle('on', b.dataset['mode'] === m))
  canvas.classList.toggle('pixel', m === 'pixel')
  resize()
}
buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset['mode'] as Mode)))
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setMode('plate')
  if (e.key === '2') setMode('full')
  if (e.key === '3') setMode('pixel')
})
const mouse = new Vector2()
let hovered: Hotspot | null = null
function imagePoint(sx: number, sy: number): Vector2 {
  const imgA = plateMat.uniforms['uImgAspect']!.value as number
  const scrA = innerWidth / innerHeight
  const p = new Vector2(sx / innerWidth - 0.5, 1 - sy / innerHeight - 0.5)
  if (scrA > imgA) p.y *= imgA / scrA
  else p.x *= scrA / imgA
  p.multiplyScalar(0.96).add(new Vector2(mouse.x * 0.012, mouse.y * 0.008)).addScalar(0.5)
  p.y = 1 - p.y
  return p
}
window.addEventListener('mousemove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1))
  if (mode !== 'plate') return
  const p = imagePoint(e.clientX, e.clientY)
  hovered = HOTSPOTS.find((h) => p.x > h.rect[0]! && p.x < h.rect[2]! && p.y > h.rect[1]! && p.y < h.rect[3]!) ?? null
  hintEl.textContent = hovered ? hovered.label : ''
  hintEl.style.left = e.clientX + 'px'
  hintEl.style.top = e.clientY + 'px'
  canvas.style.cursor = hovered ? 'pointer' : 'default'
})
let toastT = 0
canvas.addEventListener('click', () => {
  if (!hovered) return
  toastEl.textContent = hovered.action
  toastEl.classList.add('on')
  toastT = 2.5
})

function resize(): void {
  const pr = mode === 'pixel' ? 0.25 : Math.min(devicePixelRatio, 2)
  renderer.setPixelRatio(pr)
  renderer.setSize(innerWidth, innerHeight, false)
  composer.setPixelRatio(pr)
  composer.setSize(innerWidth, innerHeight)
  gtao.setSize(innerWidth * pr, innerHeight * pr)
  plateMat.uniforms['uScreenAspect']!.value = innerWidth / innerHeight
  for (const c of [cam3d, charCam]) {
    c.aspect = innerWidth / innerHeight
    c.updateProjectionMatrix()
  }
}
window.addEventListener('resize', resize)

let frames = 0
let acc = 0
let fps = 0
function frame(): void {
  requestAnimationFrame(frame)
  const dt = Math.min(clock.getDelta(), 0.1)
  const t = clock.elapsedTime
  frames++
  acc += dt
  if (acc > 0.5) {
    fps = frames / acc
    frames = 0
    acc = 0
  }
  if (toastT > 0 && (toastT -= dt) <= 0) toastEl.classList.remove('on')
  for (const r of rigs) {
    r.mixer.update(dt)
    sit(r)
    r.root.visible = charBox.checked
  }
  if (mode === 'plate') {
    plateMat.uniforms['uTime']!.value = t
    ;(plateMat.uniforms['uMouse']!.value as Vector2).lerp(mouse, 0.05)
    plateMat.uniforms['uHoverOn']!.value = hovered ? 1 : 0
    if (hovered) plateMat.uniforms['uHover']!.value = hovered.rect
    renderer.toneMapping = NoToneMapping
    renderer.autoClear = true
    renderer.render(plateScene, orthoCam)
    renderer.autoClear = false
    renderer.clearDepth()
    renderer.render(charScene, charCam)
    renderer.autoClear = true
  } else {
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    rainMat.uniforms['uTime']!.value = t
    lamp.intensity = 9 * (0.94 + 0.06 * Math.sin(t * 23) * Math.sin(t * 3.7))
    screenMats.forEach((m, i) => m.color.setScalar(1.5 + 0.1 * Math.sin(t * 13 + i * 1.7)))
    cam3d.position.x = 1.15 + mouse.x * 0.05
    cam3d.position.y = 1.62 + mouse.y * 0.03
    cam3d.lookAt(-0.55, 1.1, -1.4)
    gtao.enabled = aoBox.checked
    composer.render()
  }
  const info = renderer.info.render
  statsEl.textContent = `${mode}  ${fps.toFixed(0)} fps\ndraw calls ${info.calls}  triangles ${info.triangles}\nresolution ${Math.round(innerWidth * renderer.getPixelRatio())}x${Math.round(innerHeight * renderer.getPixelRatio())}`
}
// Screenshot hooks
;(window as unknown as Record<string, unknown>)['__test'] = { setMode, hover: (i: number) => { hovered = HOTSPOTS[i] ?? null } }
setMode('plate')
frame()

