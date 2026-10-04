// view/sfx.ts - procedural WebAudio sounds (oscillator + envelope), no files.
// Called ONLY from game-event handling and button presses, not from the frame:
// an OscillatorNode is single-use, a new node is created for each sound (events are rare).
//
// How to add a sound: 1) a name in SfxName, 2) an entry in config.json -> sound.blips, 3) a sfx.play('name') call.
// Nothing else. Game start is deliberately NOT wired: the designer did not ask for it.
// Death ('death') takes the same path; it needs two optional blip layers: `layer` (a second tone) and `noise` (a noise burst).

export type SfxName = 'eat' | 'click' | 'death' | 'tick'

/** A second oscillator on the same envelope: main tone x ratio (0.5 - an octave lower, for weight). */
export interface LayerConfig {
  wave: OscillatorType
  ratio: number
  gain: number
}

/** A white-noise burst through a low-pass filter, cutoff falling freqFrom -> freqTo over decayMs: a "hit" at the start of the sound. */
export interface NoiseConfig {
  gain: number
  decayMs: number
  filterFrom: number
  filterTo: number
}

/**
 * How the step sound depends on pace (only for 'tick'). stepMs - the actual step duration including boost.
 * The shorter the step, the quieter the tick: when speeding up with boost it fades into the background instead of chattering.
 */
export interface SpeedConfig {
  /** Step duration at which the tick plays at full volume (and longer). */
  slowStepMs: number
  /** Step duration at which the volume drops to fastGain (and shorter). */
  fastStepMs: number
  /** Volume multiplier at fastStepMs, 0..1. Linear in step duration between slow and fast. */
  fastGain: number
  /** Steps shorter than this are not all voiced, only every skipEvery-th; 0 - voice all. */
  skipBelowStepMs: number
  /** Which step to voice at fast pace (2 - every other one). */
  skipEvery: number
  /** Pitch spread from step to step, +/- cents (100 - a semitone); 0 - a single note. */
  jitterCents: number
  /** No more often than once per this many ms (a guard in case several steps happen in one frame). */
  minGapMs: number
}

export interface BlipConfig {
  wave: OscillatorType
  freqFrom: number
  freqTo: number
  sweepMs: number
  attackMs: number
  decayMs: number
  gain: number
  /** Shift pitch by combo (each next apple higher than the previous). */
  combo: boolean
  layer?: LayerConfig
  noise?: NoiseConfig
  speed?: SpeedConfig
}

export interface ComboConfig {
  /** How many semitones higher each next apple is; 0 - combo disabled. */
  semitonesPerApple: number
  /** Cap on the shift in semitones, so it does not creep into a squeal. */
  maxSemitones: number
}

export interface Sfx {
  /** stepMs is needed only by 'tick' (step pace for volume and skipping); not needed by the others. */
  play(name: SfxName, stepMs?: number): void
  /** New game: the combo returns to the base note. */
  resetCombo(): void
}

/** Pitch shift in semitones for apple number `index` (0 - the first). Pure function. */
export function comboSemitones(index: number, combo: ComboConfig): number {
  if (combo.semitonesPerApple <= 0 || index <= 0) return 0
  return Math.min(index * combo.semitonesPerApple, combo.maxSemitones)
}

/** Frequency multiplier for a shift in semitones (equal temperament). */
export function semitoneRatio(semitones: number): number {
  return Math.pow(2, semitones / 12)
}

/** Tick volume from step duration: 1 at slow pace, fastGain at fast, linear in between. Pure function. */
export function tickGainFactor(stepMs: number, speed: SpeedConfig): number {
  const span = speed.slowStepMs - speed.fastStepMs
  if (!(span > 0) || !(stepMs === stepMs)) return 1
  const t = Math.min(1, Math.max(0, (speed.slowStepMs - stepMs) / span))
  return 1 + (speed.fastGain - 1) * t
}

/** Whether to voice step number `index` at the given step duration (at fast pace - every skipEvery-th). Pure function. */
export function tickAudible(stepMs: number, index: number, speed: SpeedConfig): boolean {
  if (speed.skipBelowStepMs <= 0 || speed.skipEvery <= 1) return true
  if (stepMs >= speed.skipBelowStepMs) return true
  return index % speed.skipEvery === 0
}

/** Deterministic frequency multiplier of tick number `index`: a pseudo-random shift within +/-jitterCents. Pure function. */
export function tickPitchRatio(index: number, jitterCents: number): number {
  if (jitterCents <= 0) return 1
  let h = Math.imul(index + 1, 0x9e3779b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  const unit = ((h >>> 0) / 4294967296) * 2 - 1 // [-1, 1)
  return Math.pow(2, (unit * jitterCents) / 1200)
}

/**
 * Blip envelope at time tMs from the start: linear attack from SILENCE to peak over attackMs, then exponential peak -> SILENCE over decayMs.
 * Exactly what play() builds via setValueAtTime/linearRamp/exponentialRamp. Pure function; needed by the volume tests.
 * Note: decayMs is the decay time over the full 60 dB (peak/SILENCE), the audible part (down to -30 dB) is about half of decayMs,
 * so a 40 ms "thock" needs decayMs of about 100, not 40.
 */
export function blipEnvelope(tMs: number, attackMs: number, decayMs: number, peak: number): number {
  if (tMs <= 0) return SILENCE
  if (tMs < attackMs) return SILENCE + ((peak - SILENCE) * tMs) / attackMs
  if (tMs >= attackMs + decayMs) return SILENCE
  return peak * Math.pow(SILENCE / peak, (tMs - attackMs) / decayMs)
}

// Lower bound of the exponential envelope (exponentialRamp cannot reach 0). A technical WebAudio constant.
const SILENCE = 0.0001
const MS = 0.001
// Noise buffer length; a burst cannot be longer (the noise decayMs in config is clamped by it).
const NOISE_BUFFER_SEC = 2

export function createSfx(
  ctx: AudioContext,
  destination: AudioNode,
  blips: Readonly<Record<SfxName, BlipConfig>>,
  combo: ComboConfig,
): Sfx {
  let comboIndex = 0
  let tickIndex = 0
  let lastTickAt = -Infinity
  // The white-noise buffer is needed only by death: created lazily once and reused.
  let noiseBuffer: AudioBuffer | null = null

  function getNoise(): AudioBuffer {
    if (noiseBuffer === null) {
      const len = Math.ceil(ctx.sampleRate * NOISE_BUFFER_SEC)
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    return noiseBuffer
  }

  function play(name: SfxName, stepMs?: number): void {
    const b = blips[name]
    let ratio = b.combo ? semitoneRatio(comboSemitones(comboIndex, combo)) : 1
    if (b.combo) comboIndex++
    let peak = b.gain

    const t0 = ctx.currentTime
    const sp = b.speed
    if (sp !== undefined && stepMs !== undefined) {
      const idx = tickIndex++
      if (!tickAudible(stepMs, idx, sp)) return
      if ((t0 - lastTickAt) * 1000 < sp.minGapMs) return
      peak = b.gain * tickGainFactor(stepMs, sp)
      if (!(peak > SILENCE)) return // gain: 0 in config - the tick is off, no node is created
      lastTickAt = t0
      ratio *= tickPitchRatio(idx, sp.jitterCents)
    }
    const attackEnd = t0 + b.attackMs * MS
    const end = attackEnd + b.decayMs * MS

    const osc = ctx.createOscillator()
    osc.type = b.wave
    osc.frequency.setValueAtTime(b.freqFrom * ratio, t0)
    osc.frequency.exponentialRampToValueAtTime(b.freqTo * ratio, t0 + b.sweepMs * MS)

    const env = ctx.createGain()
    env.gain.setValueAtTime(SILENCE, t0)
    env.gain.linearRampToValueAtTime(peak, attackEnd)
    env.gain.exponentialRampToValueAtTime(SILENCE, end)

    osc.connect(env)
    env.connect(destination)
    osc.onended = () => {
      osc.disconnect()
      env.disconnect()
    }
    osc.start(t0)
    osc.stop(end + 0.02)

    // Tone layer: the same envelope and the same sweep, frequencies scaled (ratio).
    const layer = b.layer
    if (layer !== undefined) {
      const lo = ctx.createOscillator()
      lo.type = layer.wave
      lo.frequency.setValueAtTime(b.freqFrom * ratio * layer.ratio, t0)
      lo.frequency.exponentialRampToValueAtTime(b.freqTo * ratio * layer.ratio, t0 + b.sweepMs * MS)
      const lg = ctx.createGain()
      lg.gain.value = layer.gain / b.gain // the env envelope already carries b.gain: the layer is given in absolute fractions
      lo.connect(lg)
      lg.connect(env)
      lo.onended = () => {
        lo.disconnect()
        lg.disconnect()
      }
      lo.start(t0)
      lo.stop(end + 0.02)
    }

    const n = b.noise
    if (n !== undefined) {
      const src = ctx.createBufferSource()
      src.buffer = getNoise()
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(n.filterFrom, t0)
      filter.frequency.exponentialRampToValueAtTime(n.filterTo, t0 + n.decayMs * MS)
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(n.gain, t0)
      ng.gain.exponentialRampToValueAtTime(SILENCE, t0 + n.decayMs * MS)
      src.connect(filter)
      filter.connect(ng)
      ng.connect(destination)
      src.onended = () => {
        src.disconnect()
        filter.disconnect()
        ng.disconnect()
      }
      src.start(t0)
      src.stop(t0 + n.decayMs * MS + 0.02)
    }
  }

  return {
    play,
    resetCombo() {
      comboIndex = 0
      tickIndex = 0
    },
  }
}
