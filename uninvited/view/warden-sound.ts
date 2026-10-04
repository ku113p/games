// The warden's sounds. The footstep is a Kenney-based sample (audio/sfx/warden_step_v*.mp3, played through the mixer
// with its enemy bus and panning); the rest is synthesized live with Web Audio (no files): a servo whine when it
// turns its head or body, a rising chirp when it notices something (the "?"), a harsh two-tone bark when it spots you,
// a charging whine before a strike and the whoosh of the blow. The live sounds go to the mixer's enemy bus (so the
// master / SFX volume, the hack duck and the limiter apply) and, with a world position (x, z), are panned like playAt. A few nodes per sound (cold enough: a handful per second at most).
import type { Sound } from './audio'

let noise: AudioBuffer | null = null

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise
  const len = Math.floor(ctx.sampleRate * 0.5)
  const b = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = b.getChannelData(0)
  let x = 12345
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff // a fixed pattern: the same every run
    d[i] = (x / 0x7fffffff) * 2 - 1
  }
  noise = b
  return b
}

/** The sound's entry: a gain on the enemy bus, panned when the source position is known (x, z). */
function out(snd: Sound, vol: number, x?: number, z?: number): { ctx: AudioContext; g: GainNode; t: number } | null {
  const ctx = snd.ctx
  const bus = snd.enemyBus
  if (!ctx || !bus || vol <= 0.002) return null
  const g = ctx.createGain()
  g.gain.value = vol
  if (x !== undefined && z !== undefined && typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner()
    pan.pan.value = snd.panOf(x, z)
    g.connect(pan).connect(bus)
  } else g.connect(bus)
  return { ctx, g, t: ctx.currentTime }
}

function tone(ctx: AudioContext, dest: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, attack = 0.005): void {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  const e = ctx.createGain()
  e.gain.setValueAtTime(0.0001, t)
  e.gain.exponentialRampToValueAtTime(peak, t + attack)
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(e).connect(dest)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function hiss(ctx: AudioContext, dest: AudioNode, type: BiquadFilterType, f0: number, f1: number, q: number, t: number, dur: number, peak: number, attack = 0.004): void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const e = ctx.createGain()
  e.gain.setValueAtTime(0.0001, t)
  e.gain.exponentialRampToValueAtTime(peak, t + attack)
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(e).connect(dest)
  src.start(t, Math.random() * 0.3)
  src.stop(t + dur + 0.02)
}

/** One armored footstep (a sample: boot thud + metal clank). `heavy` for running. */
export function wardenStep(snd: Sound, vol: number, heavy: boolean, x?: number, z?: number): void {
  const rate = heavy ? 1 : 0.88
  if (x !== undefined && z !== undefined) snd.playAt('warden_step', x, z, vol, rate)
  else snd.play('warden_step', vol, rate)
}

/** A servo turning (head or body). */
export function wardenServo(snd: Sound, vol: number, dur: number, x?: number, z?: number): void {
  const o = out(snd, vol, x, z)
  if (!o) return
  const f = o.ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 900
  f.Q.value = 3
  f.connect(o.g)
  tone(o.ctx, f, 'sawtooth', 150, 210, o.t, dur, 0.35, 0.05)
  tone(o.ctx, f, 'square', 300, 420, o.t, dur * 0.9, 0.08, 0.05)
}

/** It noticed something: a rising questioning chirp. */
export function wardenQuery(snd: Sound, vol: number, x?: number, z?: number): void {
  const o = out(snd, vol, x, z)
  if (!o) return
  tone(o.ctx, o.g, 'triangle', 420, 520, o.t, 0.12, 0.5)
  tone(o.ctx, o.g, 'triangle', 560, 900, o.t + 0.13, 0.2, 0.5)
}

/** It spotted you: a harsh descending two-tone bark with a distorted edge. */
export function wardenBark(snd: Sound, vol: number, x?: number, z?: number): void {
  const o = out(snd, vol, x, z)
  if (!o) return
  const shaper = o.ctx.createWaveShaper()
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1
    curve[i] = Math.tanh(x * 4)
  }
  shaper.curve = curve
  shaper.connect(o.g)
  tone(o.ctx, shaper, 'square', 330, 300, o.t, 0.16, 0.35)
  tone(o.ctx, shaper, 'sawtooth', 220, 150, o.t + 0.15, 0.3, 0.4)
  hiss(o.ctx, o.g, 'bandpass', 1800, 700, 2, o.t, 0.4, 0.25)
}

/** The strike's telegraph: a charging whine over `dur` seconds. */
export function wardenCharge(snd: Sound, vol: number, dur: number, x?: number, z?: number): void {
  const o = out(snd, vol, x, z)
  if (!o) return
  tone(o.ctx, o.g, 'sawtooth', 120, 520, o.t, dur, 0.18, dur * 0.7)
  tone(o.ctx, o.g, 'sine', 240, 1040, o.t, dur, 0.2, dur * 0.7)
}

/** The blow: a heavy whoosh. */
export function wardenSwing(snd: Sound, vol: number, x?: number, z?: number): void {
  const o = out(snd, vol, x, z)
  if (!o) return
  hiss(o.ctx, o.g, 'bandpass', 600, 2400, 1.2, o.t, 0.22, 0.8, 0.03)
  tone(o.ctx, o.g, 'sine', 140, 60, o.t, 0.2, 0.4)
}
