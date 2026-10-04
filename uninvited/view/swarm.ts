// The warden's digital body (DESIGN 8, EW3g): a skinned humanoid drawn as a swarm of glowing dots, plus the loose
// particles it sheds. Two pieces, both cheap:
//   * createSwarmMaterial: one ShaderMaterial for the skinned body (three's skinning chunks). The dots are an object-space
//     (bind pose) hashed 3D grid, so they stay on the body as it animates; the fragments between the dots are discarded.
//     The dots flicker and drift, coverage and dot size grow with the view distance until the body is a solid glow (the
//     figure still reads at 40 m). Uniforms drive the states: hit scatter, dissolve / assemble, takedown pour, the
//     alert's faster flicker. `holo` mode (view.wardenLook) is the fallback look of the same shader: no discard, scanlines
//     and glitch slices on a translucent body.
//   * createParticles: ONE Points draw for all wardens: a pooled Float32Array per particle (no allocations in update).
//     Particles are emitted from bone positions, trail off when the warden moves, burst on a hit or a death, swirl on
//     alert, stream into the body on spawn and reboot, and pour into a low heap when the warden is taken down.
import { AdditiveBlending, NormalBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Object3D, Points, ShaderMaterial, Vector3 } from 'three'
import cfgAll from '../config.json'

const SW = cfgAll.view.swarm
export const HOLO = cfgAll.view.wardenLook === 'holo'

const BODY_VERT = /* glsl */ `
uniform float uTime;
uniform float uScatter;
uniform float uInflate;
uniform float uPour;
uniform float uHolo;
varying vec3 vObj;
varying float vDist;
varying float vY;
#include <common>
#include <skinning_pars_vertex>
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec3 h33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  vObj = position;
  #include <skinning_vertex>
  vec3 n = normalize(objectNormal);
  transformed += n * uInflate;
  if (uScatter > 0.001) {
    vec3 r = h33(floor(position * 9.0)) - 0.5;
    transformed += normalize(n + r * 1.6) * uScatter * (0.15 + 0.5 * h11(dot(r, vec3(7.0, 3.0, 5.0))));
  }
  if (uPour > 0.001) {
    // the body loses cohesion and pours down: the top goes first, everything spreads and settles into a low mound
    float k = smoothstep(0.0, 1.0, uPour * 1.35 - clamp(position.y / 1.9, 0.0, 1.0) * 0.35);
    transformed.xz *= 1.0 + 0.9 * k;
    transformed.y = transformed.y * (1.0 - 0.92 * k) + 0.13 * k * exp(-dot(transformed.xz, transformed.xz) * 1.4);
  }
  if (uHolo > 0.5) {
    // glitch slices: horizontal bands of the projection jump sideways now and then
    float band = floor(transformed.y * 14.0) + floor(uTime * 7.0) * 17.0;
    float g = h11(band);
    transformed.x += step(0.93, g) * (g - 0.96) * 6.0;
  }
  vY = transformed.y;
  #include <project_vertex>
  vDist = -mvPosition.z;
}`

const BODY_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uCell;
uniform float uCover;
uniform float uDens;
uniform float uDissolve;
uniform float uFlash;
uniform float uAlert;
uniform float uPour;
uniform float uHolo;
uniform float uLimb;
uniform vec4 uFar;
varying vec3 vObj;
varying float vDist;
varying float vY;
float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 h33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
void main() {
  float far = smoothstep(uFar.x, uFar.y, vDist);
  vec3 col = uColor * (1.0 + uFlash * 2.5);
  float alpha = 1.0;
  if (uHolo > 0.5) {
    float line = step(0.45, fract(vY * 42.0 - uTime * 0.6));
    float hot = step(0.985, h31(vec3(floor(vY * 42.0), floor(uTime * 9.0), 3.0)));
    alpha = (0.2 + 0.55 * line + hot * 0.6) * (1.0 - uDissolve);
    alpha = mix(alpha, 0.85, far);
    if (alpha < 0.03) discard;
    gl_FragColor = vec4(col * (0.7 + 0.6 * line), alpha);
  } else {
    vec3 g = vObj / uCell;
    vec3 id = floor(g);
    vec3 f = fract(g);
    float h = h31(id);
    float h2 = h31(id + 11.7);
    // regions: head and torso dense, limbs sparse (bind pose: arms are off the body axis, legs are below the waist)
    float limb = (vObj.y < 0.95 || abs(vObj.x) > 0.24) && vObj.y < 1.55 ? 1.0 : 0.0;
    float dens = mix(uDens, uLimb, limb);
    if (vObj.y > 1.5) dens = 1.0;
    dens = mix(dens, 1.0, far);
    if (h2 > dens) discard;
    float rate = uAlert > 0.5 ? 1.8 : 1.0;
    float tf = floor(uTime * ${SW.flickerHz.toFixed(1)} * rate + h * 9.0);
    if (h31(id + tf) < ${SW.flickerOff.toFixed(2)} * (1.0 - far)) discard;
    vec3 jit = (h33(id) - 0.5) * 0.3;
    float amp = 0.1 + 0.08 * uAlert;
    vec3 c = 0.5 + jit + amp * sin(uTime * (1.4 + h * 2.2) * rate + h * 40.0 + vec3(0.0, 2.1, 4.2));
    float d = length(f - c);
    float born = clamp(1.0 - (uDissolve * 1.6 - h31(id + 5.3) * 0.6), 0.0, 1.0);
    float r = mix(uCover, 1.1, far) * born;
    if (uPour > 0.0) r *= 1.0 - 0.45 * uPour;
    if (d > r) discard;
    float shimmer = 0.8 + 0.4 * h + 0.25 * sin(vObj.y * 9.0 - uTime * 3.0);
    gl_FragColor = vec4(col * shimmer, 1.0);
  }
  #include <colorspace_fragment>
}`

export interface SwarmUniforms {
  uColor: { value: Color }
  uTime: { value: number }
  uCell: { value: number }
  uCover: { value: number }
  uDens: { value: number }
  uLimb: { value: number }
  uDissolve: { value: number }
  uFlash: { value: number }
  uAlert: { value: number }
  uPour: { value: number }
  uScatter: { value: number }
  uInflate: { value: number }
  uHolo: { value: number }
  uFar: { value: { x: number; y: number; z: number; w: number } }
}

/** One skinned-body material. Every instance shares the one program; the uniforms differ per warden and per part. */
export function createSwarmMaterial(opts: { cell: number; cover: number; dens: number; limb: number; inflate?: number }): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color() },
      uTime: { value: 0 },
      uCell: { value: opts.cell },
      uCover: { value: opts.cover },
      uDens: { value: opts.dens },
      uLimb: { value: opts.limb },
      uDissolve: { value: 0 },
      uFlash: { value: 0 },
      uAlert: { value: 0 },
      uPour: { value: 0 },
      uScatter: { value: 0 },
      uInflate: { value: opts.inflate ?? 0 },
      uHolo: { value: HOLO ? 1 : 0 },
      uFar: { value: { x: SW.farFrom, y: SW.farTo, z: 0, w: 0 } },
    },
    vertexShader: BODY_VERT,
    fragmentShader: BODY_FRAG,
    side: DoubleSide,
    toneMapped: false,
    fog: false,
    transparent: HOLO,
    depthWrite: !HOLO,
    blending: HOLO ? AdditiveBlending : NormalBlending,
  })
  m.forceSinglePass = true
  return m
}

export function swarmUniforms(m: ShaderMaterial): SwarmUniforms {
  return m.uniforms as unknown as SwarmUniforms
}

// ---------------------------------------------------------------------------------------------------------------------
// particles

const POINT_VERT = /* glsl */ `
attribute vec4 aColor;
uniform float uViewH;
varying vec3 vCol;
void main() {
  vCol = aColor.rgb;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  if (aColor.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  } else {
    gl_PointSize = clamp(aColor.w * projectionMatrix[1][1] * uViewH * 0.5 / max(gl_Position.w, 0.1), 1.5, 22.0);
  }
}`

const POINT_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d);
  if (a < 0.02) discard;
  gl_FragColor = vec4(vCol * a, 1.0);
  #include <colorspace_fragment>
}`

/** What the view tells the particle system about one warden each frame. */
export interface ParticleState {
  /** Alive and near enough to bother (false: its particles are left to expire, none are emitted). */
  active: boolean
  x: number
  y: number
  z: number
  /** The warden's speed, m/s. */
  speed: number
  /** 0..1: how hard the swarm swirls (alert). */
  alert: number
  /** 0..1: how far it has poured down into its heap (takedown). */
  pour: number
  /** 0..1: how strongly the particles stream into the body (spawn assemble, reboot). */
  gather: number
  /** The particle color (HDR), already scaled by the state's brightness. */
  r: number
  g: number
  b: number
  bones: Object3D[]
}

export interface Particles {
  points: Points
  /** Per-warden state, written by the caller each frame before `step`. */
  state: ParticleState[]
  /** Advances one warden's particles; true while any of them is alive. */
  step(i: number, dt: number, time: number): boolean
  /** Uploads the buffers and shows the draw only while any particle is alive. */
  commit(any: boolean): void
  burst(i: number, count: number, x: number, y: number, z: number, speed: number, life: number): void
  /** Throws every particle of the warden into a cloud around it (they stream into the body while `gather` is up). */
  scatterAround(i: number, x: number, y: number, z: number, radius: number): void
  setViewHeight(px: number): void
}

const tV = new Vector3()

export function createParticles(maxWardens: number): Particles {
  const N = SW.particles
  const total = maxWardens * N
  const pos = new Float32Array(total * 3)
  const col = new Float32Array(total * 4)
  const vel = new Float32Array(total * 3)
  const age = new Float32Array(total).fill(99)
  const life = new Float32Array(total).fill(1)
  const seed = new Float32Array(total)
  for (let k = 0; k < total; k++) seed[k] = Math.random()
  const cursor = new Int32Array(maxWardens)
  const acc = new Float32Array(maxWardens)
  const state: ParticleState[] = []
  for (let i = 0; i < maxWardens; i++) state.push({ active: false, x: 0, y: -999, z: 0, speed: 0, alert: 0, pour: 0, gather: 0, r: 0, g: 0, b: 0, bones: [] })
  const geo = new BufferGeometry()
  const pAttr = new BufferAttribute(pos, 3).setUsage(35048)
  const cAttr = new BufferAttribute(col, 4).setUsage(35048)
  geo.setAttribute('position', pAttr)
  geo.setAttribute('aColor', cAttr)
  const mat = new ShaderMaterial({
    uniforms: { uViewH: { value: 540 } },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    fog: false,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  points.visible = false
  points.renderOrder = 9
  points.userData['noReflect'] = true

  function spawn(i: number, st: ParticleState, speed: number, life0: number, rise: number): void {
    const k = i * N + cursor[i]!
    cursor[i] = (cursor[i]! + 1) % N
    const bones = st.bones
    const b = bones.length > 0 ? bones[Math.floor(Math.random() * bones.length)] : undefined
    if (b) b.getWorldPosition(tV)
    else tV.set(st.x, st.y + 1, st.z)
    const o = k * 3
    pos[o] = tV.x + (Math.random() - 0.5) * 0.12
    pos[o + 1] = tV.y + (Math.random() - 0.5) * 0.12
    pos[o + 2] = tV.z + (Math.random() - 0.5) * 0.12
    const a = Math.random() * 6.2832
    const s = speed * (0.3 + Math.random())
    vel[o] = Math.cos(a) * s
    vel[o + 1] = rise * (0.3 + Math.random())
    vel[o + 2] = Math.sin(a) * s
    age[k] = 0
    life[k] = life0 * (0.6 + Math.random() * 0.8)
  }

  return {
    points,
    state,
    setViewHeight(px): void {
      ;(mat.uniforms['uViewH'] as { value: number }).value = px
    },
    burst(i, count, x, y, z, speed, life0): void {
      for (let n = 0; n < count; n++) {
        const k = i * N + cursor[i]!
        cursor[i] = (cursor[i]! + 1) % N
        const o = k * 3
        const a = Math.random() * 6.2832
        const e = Math.random() * 2 - 1
        const q = Math.sqrt(1 - e * e)
        const s = speed * (0.35 + Math.random())
        pos[o] = x + (Math.random() - 0.5) * 0.3
        pos[o + 1] = y + (Math.random() - 0.5) * 0.5
        pos[o + 2] = z + (Math.random() - 0.5) * 0.3
        vel[o] = Math.cos(a) * q * s
        vel[o + 1] = e * s * 0.7 + speed * 0.2
        vel[o + 2] = Math.sin(a) * q * s
        age[k] = 0
        life[k] = life0 * (0.6 + Math.random() * 0.8)
      }
    },
    scatterAround(i, x, y, z, radius): void {
      for (let n = 0; n < N; n++) {
        const k = i * N + n
        const o = k * 3
        const a = Math.random() * 6.2832
        const e = Math.random() * 2 - 1
        const q = Math.sqrt(1 - e * e)
        const rr = radius * (0.4 + Math.random() * 0.6)
        pos[o] = x + Math.cos(a) * q * rr
        pos[o + 1] = y + 1 + e * rr * 0.8
        pos[o + 2] = z + Math.sin(a) * q * rr
        vel[o] = vel[o + 1] = vel[o + 2] = 0
        age[k] = 0
        life[k] = SW.life * (1 + Math.random())
      }
    },
    step(i, dt, time): boolean {
      const st = state[i] as ParticleState
      const base = i * N
      if (st.active) {
        // emission: a thin drift when calm, more when it walks (the trail), a lot in a fight
        const rate = SW.emitCalm + st.speed * SW.emitMove + st.alert * SW.emitAlert
        if (st.pour < 0.6) acc[i] = acc[i]! + rate * dt
        else acc[i] = 0
        let guard = 8
        while (acc[i]! >= 1 && guard-- > 0) {
          acc[i] = acc[i]! - 1
          spawn(i, st, SW.jitter, SW.life, SW.rise)
        }
        if (guard <= 0) acc[i] = 0
      }
      const pour = st.pour
      const gather = st.gather
      const swirl = st.alert * SW.swirl
      let any = false
      for (let n = 0; n < N; n++) {
        const k = base + n
        const o = k * 3
        const c = k * 4
        // down: the particles do not age, they settle into the heap (expired ones join it); while they stream in they age slowly
        if (pour < 0.5) age[k] = age[k]! + dt * (gather > 0.01 ? 0.3 : 1)
        else if (age[k]! > life[k]! * 0.9) age[k] = life[k]! * 0.9
        if (pour > 0.2 && age[k]! >= life[k]!) {
          const o3 = k * 3
          pos[o3] = st.x + (Math.random() - 0.5) * 0.7
          pos[o3 + 1] = st.y + 0.4 + Math.random() * 1.2
          pos[o3 + 2] = st.z + (Math.random() - 0.5) * 0.7
          vel[o3] = vel[o3 + 1] = vel[o3 + 2] = 0
          age[k] = 0
          life[k] = SW.life * 2
        }
        const t = age[k]! / life[k]!
        if (t >= 1) {
          col[c + 3] = 0
          continue
        }
        any = true
        let vx = vel[o]!
        let vy = vel[o + 1]!
        let vz = vel[o + 2]!
        const px = pos[o]!
        const py = pos[o + 1]!
        const pz = pos[o + 2]!
        const sd = seed[k]!
        const dx = px - st.x
        const dz = pz - st.z
        if (swirl > 0) {
          const r2 = Math.max(0.09, dx * dx + dz * dz)
          const inv = 1 / Math.sqrt(r2)
          vx += -dz * inv * swirl * dt * 3 - dx * inv * dt * 0.6
          vz += dx * inv * swirl * dt * 3 - dz * inv * dt * 0.6
        }
        if (pour > 0.01) {
          // the heap: a mound of radius ~0.55 m around the feet, a fixed spot per particle
          const a = sd * 62.83
          const rad = 0.55 * Math.sqrt(((sd * 7.31) % 1))
          const hx = st.x + Math.cos(a) * rad
          const hz = st.z + Math.sin(a) * rad
          const hy = st.y + 0.03 + 0.17 * (1 - (rad / 0.55) * (rad / 0.55)) * (0.4 + 0.6 * ((sd * 3.7) % 1))
          const kk = Math.min(1, dt * (6 + 10 * pour)) * pour
          vx += (hx - px) * kk * 6
          vy += (hy - py) * kk * 6
          vz += (hz - pz) * kk * 6
          const damp = Math.max(0, 1 - dt * (4 + 6 * pour))
          vx *= damp
          vy *= damp
          vz *= damp
        } else if (gather > 0.01) {
          // streams into the body: toward a point on its axis (the top of the stream is the head)
          const hy = st.y + 0.2 + ((sd * 5.17) % 1) * 1.6
          const kk = Math.min(1, dt * 9) * gather
          vx += (st.x - px) * kk * 5
          vy += (hy - py) * kk * 5
          vz += (st.z - pz) * kk * 5
          const damp = Math.max(0, 1 - dt * 5 * gather)
          vx *= damp
          vy *= damp
          vz *= damp
        } else {
          const damp = Math.max(0, 1 - dt * SW.drag)
          vx *= damp
          vy *= damp
          vz *= damp
          vy += SW.rise * 0.3 * dt
        }
        vel[o] = vx
        vel[o + 1] = vy
        vel[o + 2] = vz
        pos[o] = px + vx * dt
        pos[o + 1] = py + vy * dt
        pos[o + 2] = pz + vz * dt
        const fade = (1 - t) * Math.min(1, t * 12 + 0.15)
        const spark = 0.65 + 0.35 * Math.sin(time * 18 + sd * 50)
        const f = fade * spark * SW.particleGain * (1 + pour * 1.6)
        col[c] = st.r * f
        col[c + 1] = st.g * f
        col[c + 2] = st.b * f
        col[c + 3] = SW.particleSize * (0.6 + 0.8 * ((sd * 13.7) % 1)) * (0.5 + 0.5 * fade) * (1 + pour * 1.8)
      }
      return any
    },
    commit(any): void {
      points.visible = any
      if (!any) return
      pAttr.needsUpdate = true
      cAttr.needsUpdate = true
    },
  }
}
