// Engine test: the real-world room in first person, as juicy as a 2.5D plate can get.
//   - living head: depth-based parallax that follows the mouse + slow breathing
//   - rack focus: depth of field driven by the depth map, focus eases to the hovered prop
//   - click a prop: push-in, cut to its close-up (Ken Burns drift), action sound; click / Esc / right-click goes back
//   - hover: glow + rim from the SAM prop masks; hit-testing uses the same masks
//   - living plate: rain on the window glass (mask only), flickering neon, alive screens, dust in the lamp light, lamp flicker
//   - look out of the window: push-in to the street close-up, the rain gets louder
//   - jack in: VR headset close-up -> confirm -> push into the centre screen, glitch, white flash -> the network
// Throwaway test code, not the game architecture. Every tuning number lives in config.json.
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  type Texture,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { art } from './art'
import { Sound } from './audio'
import cfg from './config.json'
import { DUST_FRAG, DUST_VERT, POST_FRAG, QUAD_VERT, STEAM_FRAG, STEAM_VERT, WORLD_FRAG } from './shaders'

const v2 = (a: number[]): Vector2 => new Vector2(a[0]!, a[1]!)
const v4 = (a: number[]): Vector4 => new Vector4(a[0]!, a[1]!, a[2]!, a[3]!)

// ------------------------------------------------------------------------------------------------ DOM
const canvas = document.getElementById('c') as HTMLCanvasElement
const statsEl = document.getElementById('stats')!
const labelEl = document.getElementById('label')!
const startEl = document.getElementById('start')!
const newsEl = document.getElementById('news')!
const confirmEl = document.getElementById('confirm')!
const yesBtn = document.getElementById('yes') as HTMLButtonElement
const noBtn = document.getElementById('no') as HTMLButtonElement
const jackOutBtn = document.getElementById('jackout') as HTMLButtonElement
const hintEl = document.getElementById('hint')!
;(document.getElementById('news-img') as HTMLImageElement).src = art(cfg.assets.newsPhoto)

// ------------------------------------------------------------------------------------------------ renderer
const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
renderer.info.autoReset = false
const sceneRT = new WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter })
const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
const quadGeo = new PlaneGeometry(2, 2)
const loader = new TextureLoader()

// Every picture is used as-is (display-space values, no colour-space conversion): textures stay NoColorSpace
// and the shaders write their values straight out.
function tex(url: string, mips = true, onLoad?: (t: Texture) => void): Texture {
  const t = loader.load(url, onLoad)
  t.generateMipmaps = mips
  if (!mips) t.minFilter = LinearFilter
  return t
}

// ------------------------------------------------------------------------------------------------ world pass
const plateTex = tex(art(cfg.assets.plate), true, (t) => {
  const img = t.image as HTMLImageElement
  plateAspect = img.width / img.height
  ;(worldU['uTexel']!.value as Vector2).set(1 / img.width, 1 / img.height)
  fitCover()
})
// depth + masks are also read once on the CPU (prop depth, centroid, hit-test mask) when all three have loaded
let cpuPending = 3
const cpuDone = (): void => {
  if (--cpuPending === 0) measureProps()
}
const depthTex = tex(art(cfg.assets.depth), false, cpuDone)
const maskATex = tex(art(cfg.assets.masksA), true, cpuDone) // mipmaps: the window mask is feathered by sampling a coarser level
const maskBTex = tex(art(cfg.assets.masksB), true, cpuDone)
const netTex = tex(art(cfg.assets.net), true)
const aspectOf = (t: Texture, fallback: number): number => {
  const img = t.image as HTMLImageElement | null
  return img && img.width > 0 ? img.width / img.height : fallback
}

const plateFit = new Vector2(1, 1)
const imageFit = new Vector2(1, 1)
let plateAspect = 1376 / 768
let imageAspect = 1376 / 768
/** Cover-fit: how much of the image (0..1) one screen spans, per axis. */
function coverFit(out: Vector2, imgAspect: number): void {
  const a = innerWidth / innerHeight
  if (a > imgAspect) out.set(1, imgAspect / a)
  else out.set(a / imgAspect, 1)
}
function fitCover(): void {
  coverFit(plateFit, plateAspect)
  coverFit(imageFit, imageAspect)
}

const plateView = new Vector3(0.5, 0.5, cfg.head.baseZoom)
const imageView = new Vector3(0.5, 0.5, 1)
const look = new Vector2()
const lampUniform = new Vector3(cfg.regions.lamp[0]!, cfg.regions.lamp[1]!, cfg.lamp.falloff)
const hoverRect = new Vector4(0, 0, 1, 1)
const time = { value: 0 }
const lampLevel = { value: 1 }
const focus = { value: cfg.dof.idleFocus }
const aperture = { value: cfg.dof.idleAperture }

const worldMat = new ShaderMaterial({
  vertexShader: QUAD_VERT,
  fragmentShader: WORLD_FRAG,
  depthTest: false,
  depthWrite: false,
  uniforms: {
    tPlate: { value: plateTex },
    tDepth: { value: depthTex },
    tImage: { value: netTex },
    tMaskA: { value: maskATex },
    tMaskB: { value: maskBTex },
    uSelA: { value: new Vector3() },
    uSelB: { value: new Vector3() },
    uHoverGain: { value: 1 },
    uEdge: { value: new Vector4(cfg.head.nearCap, cfg.head.edgeFade, cfg.head.edgeStrength, 0) },
    uRainMask: { value: new Vector3(cfg.rain.maskFeatherLod, cfg.rain.maskRange[0]!, cfg.rain.maskRange[1]!) },
    uDropAmount: { value: cfg.rain.dropAmount },
    uPlateFit: { value: plateFit },
    uPlateView: { value: plateView },
    uImageFit: { value: imageFit },
    uImageView: { value: imageView },
    uImageMix: { value: 0 },
    uLook: { value: look },
    uPivot: { value: cfg.head.parallaxPivot },
    uDepthClamp: { value: cfg.head.depthClamp },
    uFocus: focus,
    uAperture: aperture,
    uBlurGain: { value: cfg.dof.blurGain },
    uDeadZone: { value: cfg.dof.deadZone },
    uMaxLod: { value: cfg.dof.maxLod },
    uTexel: { value: new Vector2(1 / 1376, 1 / 768) },
    uTime: time,
    uWindow: { value: v4(cfg.regions.window) },
    uScreens: { value: cfg.regions.screens.map(v4) },
    uLamp: { value: lampUniform },
    uLampLevel: lampLevel,
    uRain: { value: new Vector4(cfg.rain.scale, cfg.rain.speed, cfg.rain.refraction, cfg.rain.fogLod) },
    uNeon: { value: cfg.rain.neonFlicker },
    uScreenFx: { value: new Vector4(cfg.screensFx.scanline, cfg.screensFx.band, cfg.screensFx.flicker, cfg.screensFx.bandSpeed) },
    uHoverRect: { value: hoverRect },
    uHover: { value: 0 },
    uHoverColor: { value: new Vector3(cfg.hover.color[0]!, cfg.hover.color[1]!, cfg.hover.color[2]!) },
    uRimPx: { value: cfg.hover.rimPx },
    uHoverFx: { value: new Vector3(cfg.hover.lift, cfg.hover.rim, cfg.hover.dim) },
  },
})
const worldU = worldMat.uniforms
const worldScene = new Scene()
const worldQuad = new Mesh(quadGeo, worldMat)
worldQuad.frustumCulled = false
worldScene.add(worldQuad)

// ------------------------------------------------------------------------------------------------ particles
const pxScale = { value: 1 }
function seeds(count: number, fill: (a: Float32Array, i: number) => void): BufferGeometry {
  const a = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) fill(a, i * 4)
  const g = new BufferGeometry()
  g.setAttribute('aSeed', new Float32BufferAttribute(a, 4))
  // positions are computed in the vertex shader; three only needs a position attribute for the draw count
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3))
  return g
}

const dustMat = new ShaderMaterial({
  vertexShader: DUST_VERT,
  fragmentShader: DUST_FRAG,
  transparent: true,
  blending: AdditiveBlending,
  depthTest: false,
  depthWrite: false,
  uniforms: {
    uPlateFit: { value: plateFit },
    uPlateView: { value: plateView },
    uLook: { value: look },
    uPivot: { value: cfg.head.parallaxPivot },
    uTime: time,
    uArea: { value: v4(cfg.dust.area) },
    uSize: { value: v2(cfg.dust.size) },
    uSpeed: { value: cfg.dust.speed },
    uFocus: focus,
    uAperture: aperture,
    uBlurGain: { value: cfg.dof.blurGain },
    uLamp: { value: lampUniform },
    uLampLevel: lampLevel,
    uPxScale: pxScale,
    uDepthClamp: { value: cfg.head.depthClamp },
    uColor: { value: new Vector3(cfg.dust.color[0]!, cfg.dust.color[1]!, cfg.dust.color[2]!) },
    uBrightness: { value: cfg.dust.brightness },
  },
})
const dust = new Points(
  seeds(cfg.dust.count, (a, i) => {
    a[i] = Math.random()
    a[i + 1] = Math.random()
    a[i + 2] = Math.random()
    a[i + 3] = Math.random()
  }),
  dustMat,
)
dust.frustumCulled = false
worldScene.add(dust)

const steamMat = new ShaderMaterial({
  vertexShader: STEAM_VERT,
  fragmentShader: STEAM_FRAG,
  transparent: true,
  blending: NormalBlending,
  depthTest: false,
  depthWrite: false,
  uniforms: {
    uImageFit: { value: imageFit },
    uImageView: { value: imageView },
    uTime: time,
    uOrigin: { value: v2(cfg.steam.origin) },
    uSpread: { value: cfg.steam.spread },
    uRise: { value: cfg.steam.rise },
    uLife: { value: cfg.steam.life },
    uSize: { value: v2(cfg.steam.size) },
    uPxScale: pxScale,
    uOpacity: { value: cfg.steam.opacity },
  },
})
const steam = new Points(
  seeds(cfg.steam.count, (a, i) => {
    a[i] = i / cfg.steam.count + Math.random() * 0.02 // spread evenly over the life cycle
    a[i + 1] = Math.random()
    a[i + 2] = Math.random()
    a[i + 3] = Math.random()
  }),
  steamMat,
)
steam.frustumCulled = false
steam.visible = false
worldScene.add(steam)

// ------------------------------------------------------------------------------------------------ post pass
const postMat = new ShaderMaterial({
  vertexShader: QUAD_VERT,
  fragmentShader: POST_FRAG,
  depthTest: false,
  depthWrite: false,
  uniforms: {
    tScene: { value: sceneRT.texture },
    uRes: { value: new Vector2(1, 1) },
    uTime: time,
    uGlitch: { value: 0 },
    uFlash: { value: 0 },
    uFade: { value: 0 },
    uZoomBlur: { value: 0 },
    uZoomCenter: { value: new Vector2(0.5, 0.5) },
    uAberration: { value: cfg.post.aberration },
    uVignette: { value: cfg.post.vignette },
    uGrain: { value: cfg.post.grain },
  },
})
const postU = postMat.uniforms
const postScene = new Scene()
const postQuad = new Mesh(quadGeo, postMat)
postQuad.frustumCulled = false
postScene.add(postQuad)

// ------------------------------------------------------------------------------------------------ hotspots
interface Hotspot {
  name: string
  label: string
  rect: Vector4 // bounding box for a quick reject; the mask decides
  bit: number // this prop's bit in maskBits
  selA: Vector3 // one-hot mask channel for the shader
  selB: Vector3
  cx: number // push-in target: the mask's centroid (rect centre until the masks are read)
  cy: number
  depth: number // raw depth-map value (0..1, bright = near), measured at load
  depthN: number // the same, normalized for parallax
  glow: number
  tex: Texture
  sound: string
  volume: number
  pushZoom: number
  pan: Vector2
  duck: number
  rain: number
}
const CHANNELS = ['r', 'g', 'b']
const hotspots: Hotspot[] = cfg.hotspots.map((h, i) => {
  const [sheet, ch] = h.mask.split('.') as [string, string]
  const sel = new Vector3()
  sel.setComponent(CHANNELS.indexOf(ch), 1)
  return {
    name: h.name,
    label: h.label,
    rect: v4(h.rect),
    bit: 1 << i,
    selA: sheet === 'a' ? sel : new Vector3(),
    selB: sheet === 'b' ? sel : new Vector3(),
    cx: (h.rect[0]! + h.rect[2]!) / 2,
    cy: (h.rect[1]! + h.rect[3]!) / 2,
    depth: cfg.dof.idleFocus,
    depthN: 0.3,
    glow: h.glow,
    tex: tex(art(h.closeup)),
    sound: h.sound,
    volume: h.volume,
    pushZoom: h.pushZoom,
    pan: v2(h.pan),
    duck: h.duck,
    rain: h.rain,
  }
})
const byName = (n: string): Hotspot | null => hotspots.find((h) => h.name === n) ?? null

// Hit-test mask: one byte per plate pixel, one bit per hotspot. Filled once at load (cold path).
let maskBits = new Uint8Array(0)
let maskW = 1
let maskH = 1

function pixels(t: Texture): { data: Uint8ClampedArray; w: number; h: number } {
  const img = t.image as HTMLImageElement
  const cv = document.createElement('canvas')
  cv.width = img.width
  cv.height = img.height
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0)
  return { data: g.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}

/** Once, at load: mask bits, each prop's centroid and depth (75th percentile of the depth map inside its mask). */
function measureProps(): void {
  const a = pixels(maskATex)
  const b = pixels(maskBTex)
  const d = pixels(depthTex)
  maskW = a.w
  maskH = a.h
  maskBits = new Uint8Array(maskW * maskH)
  hotspots.forEach((h, i) => {
    const src = cfg.hotspots[i]!.mask.startsWith('a') ? a : b
    const ch = CHANNELS.indexOf(cfg.hotspots[i]!.mask.slice(2))
    const depths: number[] = []
    let sx = 0
    let sy = 0
    for (let y = 0; y < maskH; y++) {
      for (let x = 0; x < maskW; x++) {
        const k = y * maskW + x
        if (src.data[k * 4 + ch]! < 128) continue
        maskBits[k]! |= h.bit
        sx += x
        sy += y
        const dx = Math.min(d.w - 1, Math.floor((x * d.w) / maskW))
        const dy = Math.min(d.h - 1, Math.floor((y * d.h) / maskH))
        depths.push(d.data[(dy * d.w + dx) * 4]!)
      }
    }
    if (depths.length === 0) return
    h.cx = sx / depths.length / maskW
    h.cy = sy / depths.length / maskH
    depths.sort((p, q) => p - q)
    h.depth = depths[Math.floor(depths.length * 0.75)]! / 255
    h.depthN = Math.min(Math.min(h.depth, cfg.head.depthClamp) / cfg.head.depthClamp, cfg.head.nearCap)
  })
}

// ------------------------------------------------------------------------------------------------ audio
const sound = new Sound(cfg.audio)

// ------------------------------------------------------------------------------------------------ easing
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const easeInCubic = (x: number): number => x * x * x
const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3
const easeInOutSine = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * x)
const easeInExpo = (x: number): number => (x <= 0 ? 0 : 2 ** (10 * x - 10))
const EASES = [easeInCubic, easeOutCubic, easeInExpo] as const
const EASE_IN = 0
const EASE_OUT = 1
const EASE_EXPO = 2
/** Exponential smoothing factor for a half-life (frame-rate independent). */
const follow = (dt: number, halfLife: number): number => 1 - 2 ** (-dt / Math.max(halfLife, 1e-4))

// The room camera ("eyes"): a base view tweened between poses, plus breathing and head look on top.
const cam = { x: 0.5, y: 0.5, z: cfg.head.baseZoom }
const tw = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, t: 1, dur: 1, ease: EASE_OUT }
function tweenCam(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, dur: number, ease: number): void {
  tw.fx = fx
  tw.fy = fy
  tw.fz = fz
  tw.tx = tx
  tw.ty = ty
  tw.tz = tz
  tw.t = 0
  tw.dur = dur
  tw.ease = ease
  cam.x = fx
  cam.y = fy
  cam.z = fz
}
function stepTween(dt: number): number {
  tw.t = Math.min(tw.t + dt, tw.dur)
  const p = clamp01(tw.t / tw.dur)
  const e = EASES[tw.ease]!(p)
  cam.x = tw.fx + (tw.tx - tw.fx) * e
  cam.y = tw.fy + (tw.ty - tw.fy) * e
  // zoom interpolates in log space so a push feels even
  cam.z = tw.fz * (tw.tz / tw.fz) ** e
  return p
}

// ------------------------------------------------------------------------------------------------ state
type State = 'intro' | 'room' | 'push' | 'closeup' | 'pull' | 'jackPush' | 'net' | 'jackOut'
let state: State = 'intro'
let stateT = 0
let active: Hotspot | null = null
let hovered: Hotspot | null = null
let shownHover: Hotspot | null = null
let newsShown = false
let confirmShown = false
let jackOutShown = false
let outCut = false

// post-effect drivers
let flash = 0
let fade = 0
let glitchBase = 0
let glitchKick = 0
let zoomBlur = 0
let flashHold = false

// head look: critically damped spring toward the mouse
const mouse = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2 }
const head = { x: 0, y: 0, vx: 0, vy: 0 }
let hoverAmt = 0

// lamp flicker
const lamp = { next: 3, left: 0 }

function setState(s: State): void {
  state = s
  stateT = 0
  hintEl.textContent =
    s === 'room' ? 'click a prop · move the mouse to look' : s === 'closeup' ? 'click · Esc · right-click to go back' : ''
}

const randIn = (a: number[]): number => a[0]! + Math.random() * (a[1]! - a[0]!)

// ------------------------------------------------------------------------------------------------ actions
function begin(): void {
  if (state !== 'intro') return
  startEl.classList.add('gone')
  setState('room')
  sound.unlock().catch((e: unknown) => console.warn('audio unavailable', e))
}

function setHover(h: Hotspot | null): void {
  if (h === hovered) return
  hovered = h
  if (h) {
    shownHover = h
    hoverRect.copy(h.rect)
    ;(worldU['uSelA']!.value as Vector3).copy(h.selA)
    ;(worldU['uSelB']!.value as Vector3).copy(h.selB)
    worldU['uHoverGain']!.value = h.glow
    labelEl.textContent = h.label
    labelW = labelEl.offsetWidth
    sound.play('ui_hover', cfg.audio.hover)
  }
  labelEl.classList.toggle('on', h !== null)
  canvas.classList.toggle('pointer', h !== null)
}

let labelW = 0
function placeLabel(x: number, y: number): void {
  // keep it on screen: flip to the left of the cursor near the right edge
  let lx = x + cfg.hover.labelOffset[0]!
  if (lx + labelW > innerWidth - 8) lx = x - cfg.hover.labelOffset[0]! - labelW
  labelEl.style.transform = `translate(${lx}px, ${Math.max(8, y + cfg.hover.labelOffset[1]!)}px)`
}

function act(h: Hotspot): void {
  if (state !== 'room') return
  active = h
  setHover(null)
  sound.play('ui_click', cfg.audio.ui)
  tweenCam(cam.x, cam.y, cam.z, h.cx, h.cy, h.pushZoom, cfg.push.duration, EASE_IN)
  setState('push')
}

function enterCloseup(h: Hotspot): void {
  setState('closeup')
  worldU['tImage']!.value = h.tex
  worldU['uImageMix']!.value = 1
  imageAspect = aspectOf(h.tex, 1365 / 768)
  fitCover()
  flash = cfg.push.flash
  zoomBlur = 0
  sound.play(h.sound, h.volume)
  sound.duck(h.duck)
  sound.rain(h.rain)
  newsShown = false
  confirmShown = false
}

function hideOverlays(): void {
  newsEl.classList.remove('on')
  newsEl.style.display = 'none'
  confirmEl.classList.remove('on')
  confirmEl.style.display = 'none'
}

function back(): void {
  if (state === 'net') {
    jackOut()
    return
  }
  if (state !== 'closeup' || !active) return
  hideOverlays()
  sound.play('ui_back', cfg.audio.ui)
  sound.duck(1)
  sound.rain(1)
  worldU['uImageMix']!.value = 0
  const z = active.pushZoom * cfg.push.pullFrom
  tweenCam(active.cx, active.cy, z, 0.5, 0.5, cfg.head.baseZoom, cfg.push.pullDuration, EASE_OUT)
  flash = cfg.push.backFlash
  setState('pull')
}

function confirmJack(): void {
  if (state !== 'closeup' && state !== 'room') return
  hideOverlays()
  active = byName(cfg.jackConfirm.hotspot)
  sound.play('ui_confirm', cfg.audio.ui)
  sound.play('jack_in', cfg.audio.jack)
  sound.rain(1)
  worldU['uImageMix']!.value = 0
  const [x, y] = cfg.jack.target as [number, number]
  tweenCam(x, y, cfg.jack.startZoom, x, y, cfg.jack.endZoom, cfg.jack.slamAt, EASE_EXPO)
  flash = 0.25
  setState('jackPush')
}

function enterNet(): void {
  setState('net')
  worldU['tImage']!.value = netTex
  worldU['uImageMix']!.value = 1
  imageAspect = aspectOf(netTex, 1376 / 768)
  fitCover()
  flashHold = true
  flash = 1
  glitchKick = 0
  jackOutShown = false
  sound.duck(cfg.audio.duckNet, cfg.audio.netLowpass)
}

function jackOut(): void {
  if (state !== 'net') return
  jackOutBtn.classList.remove('on')
  jackOutBtn.style.display = 'none'
  sound.play('jack_out', cfg.audio.jack)
  outCut = false
  setState('jackOut')
}

// ------------------------------------------------------------------------------------------------ input
function pick(sx: number, sy: number): Hotspot | null {
  const px = plateView.x + (sx / innerWidth - 0.5) * (plateFit.x / plateView.z)
  const py = plateView.y + (sy / innerHeight - 0.5) * (plateFit.y / plateView.z)
  for (const h of hotspots) {
    // a prop is drawn shifted by the parallax of its own depth
    const qx = px - look.x * (h.depthN - cfg.head.parallaxPivot)
    const qy = py - look.y * (h.depthN - cfg.head.parallaxPivot)
    if (qx <= h.rect.x || qx >= h.rect.z || qy <= h.rect.y || qy >= h.rect.w) continue
    if (maskBits.length === 0) return h // masks not read yet: the rect will do
    const mx = Math.min(maskW - 1, Math.max(0, Math.floor(qx * maskW)))
    const my = Math.min(maskH - 1, Math.max(0, Math.floor(qy * maskH)))
    if (maskBits[my * maskW + mx]! & h.bit) return h
  }
  return null
}

window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = (e.clientY / innerHeight) * 2 - 1
  mouse.px = e.clientX
  mouse.py = e.clientY
  if (state === 'room') setHover(pick(e.clientX, e.clientY))
  if (hovered) placeLabel(e.clientX, e.clientY)
})
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  if (state === 'room' && hovered) act(hovered)
  else if (state === 'closeup') back()
})
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  if (state === 'closeup') back()
})
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') back()
  if (e.key === 'h' || e.key === 'H') statsEl.classList.toggle('hidden')
  if (e.key === 'Enter' && confirmShown && state === 'closeup') confirmJack()
})
startEl.addEventListener('click', begin)
yesBtn.addEventListener('click', confirmJack)
noBtn.addEventListener('click', back)
jackOutBtn.addEventListener('click', jackOut)
for (const b of [yesBtn, noBtn, jackOutBtn]) b.addEventListener('pointerenter', () => sound.play('ui_hover', cfg.audio.hover))

// ------------------------------------------------------------------------------------------------ tablet overlay
// Maps the news element (W x H css px) onto the 4 screen corners of the tablet in the close-up with a projective
// matrix3d. Called every frame only while the tablet close-up is open (it builds one style string per frame).
const NEWS_W = 640
const NEWS_H = 416
const quad = new Float64Array(8)
function updateNews(): void {
  const corners = cfg.tablet.screen
  for (let i = 0; i < 4; i++) {
    const c = corners[i]!
    quad[i * 2] = ((c[0]! - imageView.x) * imageView.z / imageFit.x + 0.5) * innerWidth
    quad[i * 2 + 1] = ((c[1]! - imageView.y) * imageView.z / imageFit.y + 0.5) * innerHeight
  }
  const x0 = quad[0]!, y0 = quad[1]!, x1 = quad[2]!, y1 = quad[3]!, x2 = quad[4]!, y2 = quad[5]!, x3 = quad[6]!, y3 = quad[7]!
  // unit square -> quad (Heckbert), then scale the unit square to the element size
  const sx = x0 - x1 + x2 - x3
  const sy = y0 - y1 + y2 - y3
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const den = dx1 * dy2 - dx2 * dy1
  const g = (sx * dy2 - dx2 * sy) / den
  const h = (dx1 * sy - sx * dy1) / den
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + h * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + h * y3
  newsEl.style.transform =
    `matrix3d(${a / NEWS_W},${d / NEWS_W},0,${g / NEWS_W},${b / NEWS_H},${e / NEWS_H},0,${h / NEWS_H},0,0,1,0,${x0},${y0},0,1)`
}

// ------------------------------------------------------------------------------------------------ resize
const drawSize = new Vector2()
function resize(): void {
  renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.render.maxPixelRatio))
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.getDrawingBufferSize(drawSize)
  sceneRT.setSize(drawSize.x, drawSize.y)
  ;(postU['uRes']!.value as Vector2).copy(drawSize)
  pxScale.value = drawSize.y / 720
  fitCover()
}
window.addEventListener('resize', resize)

// ------------------------------------------------------------------------------------------------ frame
let lastNow = performance.now()
let frames = 0
let fpsAcc = 0
let fps = 0
let statsT = 0
let timeScale = 1 // test hook: slow motion / freeze for screenshots
const breathW = (2 * Math.PI) / cfg.head.breathPeriod

function updateHead(dt: number): void {
  const w = cfg.head.lookOmega
  head.vx += (w * w * (mouse.x - head.x) - 2 * w * head.vx) * dt
  head.vy += (w * w * (mouse.y - head.y) - 2 * w * head.vy) * dt
  head.x += head.vx * dt
  head.y += head.vy * dt
}

function updateLamp(dt: number): void {
  if (lamp.left > 0) {
    lamp.left -= dt
    // a failing contact: random dips, frame to frame
    lampLevel.value = Math.random() < 0.5 ? 1 - cfg.lamp.flickerDepth * (0.4 + Math.random() * 0.6) : 1
    if (lamp.left <= 0) lamp.next = randIn(cfg.lamp.flickerEvery)
  } else {
    lampLevel.value = 0.985 + 0.015 * Math.sin(time.value * 23)
    lamp.next -= dt
    if (lamp.next <= 0) lamp.left = randIn(cfg.lamp.flickerLength)
  }
}

function updateState(dt: number): void {
  stateT += dt
  glitchBase = 0
  zoomBlur = 0
  switch (state) {
    case 'intro':
    case 'room': {
      cam.x += (0.5 - cam.x) * follow(dt, 0.2)
      cam.y += (0.5 - cam.y) * follow(dt, 0.2)
      cam.z += (cfg.head.baseZoom - cam.z) * follow(dt, 0.2)
      break
    }
    case 'push': {
      const p = stepTween(dt)
      zoomBlur = cfg.push.zoomBlur * p * p
      if (p >= 1 && active) enterCloseup(active)
      break
    }
    case 'pull': {
      const p = stepTween(dt)
      zoomBlur = cfg.push.zoomBlur * 0.6 * (1 - p) ** 2
      if (p >= 1) {
        active = null
        setState('room')
        setHover(pick(mouse.px, mouse.py))
        if (hovered) placeLabel(mouse.px, mouse.py)
      }
      break
    }
    case 'closeup': {
      if (!active) break
      const c = cfg.closeups
      const settle = easeOutCubic(clamp01(stateT / c.settle))
      const drift = easeInOutSine(clamp01((stateT - c.settle) / c.driftTime))
      const dz = active.name === cfg.tablet.hotspot ? cfg.tablet.driftZoom : c.driftZoom
      imageView.z = c.startZoom + (c.zoom - c.startZoom) * settle + dz * drift
      imageView.x = 0.5 + active.pan.x * drift + head.x * cfg.head.closeupLookPan[0]! / imageView.z
      imageView.y = 0.5 + active.pan.y * drift + head.y * cfg.head.closeupLookPan[1]! / imageView.z
      if (active.name === cfg.tablet.hotspot) {
        if (!newsShown && stateT >= cfg.tablet.delay) {
          newsShown = true
          newsEl.style.display = 'block'
          void newsEl.offsetWidth // restart the CSS transition
          newsEl.classList.add('on')
          sound.play('tablet_swipe', cfg.audio.swipe)
        }
        if (newsShown) updateNews()
      }
      if (active.name === cfg.jackConfirm.hotspot && !confirmShown && stateT >= cfg.jackConfirm.delay) {
        confirmShown = true
        confirmEl.style.display = 'block'
        void confirmEl.offsetWidth
        confirmEl.classList.add('on')
      }
      break
    }
    case 'jackPush': {
      const p = stepTween(dt)
      glitchBase = Math.max(0, (p - 0.35) / 0.65) ** 2 * 0.9
      zoomBlur = 0.3 * p * p * p
      if (stateT > cfg.jack.slamAt - 0.25 && stateT - dt <= cfg.jack.slamAt - 0.25) sound.play('glitch', cfg.audio.glitch)
      if (p >= 1) enterNet()
      break
    }
    case 'net': {
      const j = cfg.jack
      if (flashHold && stateT >= j.whiteHold) flashHold = false
      if (!flashHold) flash = 1 - easeOutCubic(clamp01((stateT - j.whiteHold) / j.whiteFade))
      const settle = clamp01(stateT / j.glitchSettle)
      glitchBase = 0.85 * (1 - settle) ** 2
      // a few hard spikes while the signal settles
      if (settle < 1 && Math.random() < dt * 5) {
        glitchKick = 0.5 + Math.random() * 0.4
        if (Math.random() < 0.35) sound.play('glitch', cfg.audio.glitch * 0.6)
      }
      const z = easeOutCubic(clamp01(stateT / j.netSettle))
      const drift = Math.sin((stateT / j.netDriftTime) * 2 * Math.PI)
      imageView.z = j.netStartZoom + (j.netZoom - j.netStartZoom) * z
      imageView.x = 0.5 + j.netDriftPan[0]! * drift + head.x * cfg.head.closeupLookPan[0]! / imageView.z
      imageView.y = 0.5 + j.netDriftPan[1]! * drift + head.y * cfg.head.closeupLookPan[1]! / imageView.z
      if (!jackOutShown && stateT >= j.whiteHold + j.whiteFade * 0.7) {
        jackOutShown = true
        jackOutBtn.style.display = 'block'
        void jackOutBtn.offsetWidth
        jackOutBtn.classList.add('on')
      }
      break
    }
    case 'jackOut': {
      const j = cfg.jack
      if (stateT < j.outThumpAt) {
        // the network falls and crushes away
        const p = clamp01(stateT / j.outBlackAt)
        glitchBase = stateT < j.outGlitchUntil ? 0.45 + 0.55 * easeInCubic(clamp01(stateT / j.outGlitchUntil)) : 0
        imageView.z = j.netZoom * (1 + 0.6 * easeInCubic(p))
        imageView.y = 0.5 - 0.18 * easeInCubic(p)
        fade = easeInCubic(clamp01((stateT - j.outBlackAt * 0.5) / (j.outBlackAt * 0.5)))
      } else if (!outCut) {
        // the thump: back in the room, eyes still on the screen, then the head settles back
        outCut = true
        worldU['uImageMix']!.value = 0
        const [x, y] = j.target as [number, number]
        tweenCam(x, y, j.outFromZoom, 0.5, 0.5, cfg.head.baseZoom, j.outEase, EASE_OUT)
        flash = 0.3
        glitchKick = 0.6
        sound.duck(1)
        active = null
        setState('pull')
      }
      break
    }
  }
}

function frame(): void {
  requestAnimationFrame(frame)
  const now = performance.now()
  const rawDt = (now - lastNow) / 1000
  lastNow = now
  const dt = Math.min(rawDt, 0.1) * timeScale
  time.value += dt
  frames++
  fpsAcc += rawDt
  if (fpsAcc >= 0.5) {
    fps = frames / fpsAcc
    frames = 0
    fpsAcc = 0
  }

  updateHead(dt)
  updateLamp(dt)
  updateState(dt)

  // decays
  if (!flashHold && state !== 'net') flash *= Math.exp(-dt * 7)
  glitchKick *= Math.exp(-dt * 9)
  if (state !== 'jackOut') fade += (0 - fade) * follow(dt, 0.08)

  // rack focus + hover glow
  const roomLive = state === 'room'
  const target = roomLive && hovered ? hovered : state === 'push' || state === 'pull' ? active : null
  const focusTarget = state === 'jackPush' ? cfg.dof.idleFocus : target ? target.depth : cfg.dof.idleFocus
  const apertureTarget = target ? cfg.dof.hoverAperture : cfg.dof.idleAperture
  const k = follow(dt, cfg.dof.focusHalfLife)
  focus.value += (focusTarget - focus.value) * k
  aperture.value += (apertureTarget - aperture.value) * k
  hoverAmt += ((roomLive && hovered ? 1 : 0) - hoverAmt) * follow(dt, cfg.hover.fadeHalfLife)
  worldU['uHover']!.value = shownHover ? hoverAmt : 0

  // eyes: base pose + breathing + head look (parallax + a small pan)
  const breath = Math.sin(time.value * breathW)
  const calm = state === 'room' || state === 'intro' || state === 'pull' ? 1 : 0.3
  plateView.z = cam.z * (1 + cfg.head.breathZoom * breath * calm)
  plateView.x = cam.x + (cfg.head.breathSway[0]! * Math.sin(time.value * breathW * 0.5 + 1.3) * calm + head.x * cfg.head.lookPan[0]!) / cam.z
  plateView.y = cam.y + (cfg.head.breathSway[1]! * breath * calm + head.y * cfg.head.lookPan[1]!) / cam.z
  // keep the view inside the picture (a push toward the window would otherwise run off its left edge)
  const hx = plateFit.x / plateView.z / 2
  const hy = plateFit.y / plateView.z / 2
  plateView.x = Math.min(Math.max(plateView.x, hx), 1 - hx)
  plateView.y = Math.min(Math.max(plateView.y, hy), 1 - hy)
  look.set(-head.x * cfg.head.parallax[0]! * calm, -head.y * cfg.head.parallax[1]! * calm)

  dust.visible = (worldU['uImageMix']!.value as number) < 1
  steam.visible = state === 'closeup' && active?.name === cfg.steam.hotspot

  postU['uGlitch']!.value = Math.min(1, glitchBase + glitchKick)
  postU['uFlash']!.value = flash
  postU['uFade']!.value = fade
  postU['uZoomBlur']!.value = zoomBlur
  // radial blur streams out of the prop we move toward (the view may be clamped at the picture's edge)
  const zc = postU['uZoomCenter']!.value as Vector2
  if (active && (state === 'push' || state === 'pull')) {
    zc.set((active.cx - plateView.x) * plateView.z / plateFit.x + 0.5, 0.5 - (active.cy - plateView.y) * plateView.z / plateFit.y)
  } else zc.set(0.5, 0.5)

  renderer.info.reset()
  renderer.setRenderTarget(sceneRT)
  renderer.render(worldScene, quadCam)
  renderer.setRenderTarget(null)
  renderer.render(postScene, quadCam)

  statsT -= rawDt
  if (statsT <= 0 && !statsEl.classList.contains('hidden')) {
    statsT = 0.5
    statsEl.textContent = `${fps.toFixed(0)} fps · ${state}\ndraw calls ${renderer.info.render.calls}\n${drawSize.x}x${drawSize.y} px\nH hides`
  }
}

// ------------------------------------------------------------------------------------------------ test hooks
function hoverByName(name: string | null): void {
  if (state !== 'room') return
  const h = name ? byName(name) : null
  setHover(h)
  if (h) {
    // put the "mouse" on the prop so the head looks there too, and the label sits next to it
    const sx = ((h.cx - plateView.x) * plateView.z / plateFit.x + 0.5) * innerWidth
    const sy = ((h.cy - plateView.y) * plateView.z / plateFit.y + 0.5) * innerHeight
    mouse.x = (sx / innerWidth) * 2 - 1
    mouse.y = (sy / innerHeight) * 2 - 1
    mouse.px = sx
    mouse.py = sy
    placeLabel(sx, sy)
  }
}
;(window as unknown as Record<string, unknown>)['__test'] = {
  start: begin,
  hover: hoverByName,
  click: (name: string) => {
    const h = byName(name)
    if (h && state === 'room') act(h)
  },
  confirm: confirmJack,
  jackIn: confirmJack,
  back,
  state: () => ({ state, t: stateT, audio: sound.ready, hotspots: hotspots.map((h) => ({ name: h.name, depth: h.depth })) }),
  timeScale: (k: number) => {
    timeScale = k
  },
  mouse: (x: number, y: number) => {
    mouse.x = x
    mouse.y = y
  },
}

resize()
frame()
