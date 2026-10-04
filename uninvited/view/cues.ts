// Gameplay audio cues, synthesized live with Web Audio (no files): a continuous suspicion tone (pitch and gain follow
// the strongest suspicion source), a "spotted" sting and an "all clear" sting, the low-HP heartbeat (the master lowpass
// is closed by the Sound mixer), the wave-incoming riser a couple of seconds before a wave spawns and the wave-cleared
// sting. The game view feeds it the state once a frame (update) and the wave-cleared event; it holds a few nodes only.
import cfgAll from '../config.json'
import type { Sound } from './audio'

const C = cfgAll.audio.cues
const L = cfgAll.audio.mixer.lowHp

export interface CueState {
  /** The game is being played (not paused, not in a menu, not over). */
  playing: boolean
  /** 0..1 the strongest suspicion among all watchers. */
  suspicion: number
  /** A watcher has spotted the player right now. */
  spotted: boolean
  /** Alarm stage 0..3. */
  alarm: number
  /** 0..1 */
  hp: number
  /** Seconds until the next wave spawns, or -1 (no wave coming). */
  waveIn: number
}

export class Cues {
  private tone: OscillatorNode | null = null
  private toneGain: GainNode | null = null
  private noise: AudioBuffer | null = null
  private nextBeat = 0
  private lastSpotted = false
  private lastAlarm = 0
  private lastSting = -10
  private riserFired = false
  private muffle = 0

  constructor(private readonly snd: Sound) {}

  private out(): { ctx: AudioContext; dest: AudioNode; t: number } | null {
    const ctx = this.snd.ctx
    const dest = this.snd.busNode('ui')
    if (!ctx || !dest) return null
    return { ctx, dest, t: ctx.currentTime }
  }

  private ensureTone(ctx: AudioContext, dest: AudioNode): void {
    if (this.tone) return
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = C.suspicion.hzMin
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    const g = ctx.createGain()
    g.gain.value = 0
    o.connect(lp).connect(g).connect(dest)
    o.start()
    this.tone = o
    this.toneGain = g
  }

  private noiseBuf(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise
    const len = ctx.sampleRate
    const b = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noise = b
    return b
  }

  private blip(type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, attack = 0.005): void {
    const o = this.out()
    if (!o) return
    const osc = o.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const e = o.ctx.createGain()
    e.gain.setValueAtTime(0.0001, t)
    e.gain.exponentialRampToValueAtTime(peak, t + attack)
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(e).connect(o.dest)
    osc.start(t)
    osc.stop(t + dur + 0.03)
  }

  /** "You were seen": a short harsh two-tone stab. */
  spotted(): void {
    const o = this.out()
    if (!o) return
    const t = o.t
    const v = C.spottedGain
    this.blip('sawtooth', 932, 880, t, 0.1, v * 0.5)
    this.blip('sawtooth', 698, 660, t + 0.1, 0.22, v * 0.5)
    this.blip('square', 233, 220, t, 0.32, v * 0.35)
  }

  /** "All clear": a soft falling three-note release. */
  allClear(): void {
    const o = this.out()
    if (!o) return
    const v = C.clearGain
    this.blip('sine', 587, 587, o.t, 0.5, v * 0.6, 0.02)
    this.blip('sine', 440, 440, o.t + 0.16, 0.6, v * 0.6, 0.02)
    this.blip('sine', 294, 294, o.t + 0.34, 1.1, v * 0.7, 0.03)
  }

  /** "Wave cleared": a rising four-note chime. */
  waveCleared(): void {
    const o = this.out()
    if (!o) return
    const v = C.waveClearedGain
    const notes = [294, 349, 440, 587]
    for (let i = 0; i < notes.length; i++) {
      const f = notes[i] as number
      this.blip('triangle', f, f, o.t + i * 0.09, 0.5 + i * 0.1, v * 0.6, 0.01)
      this.blip('sine', f * 2, f * 2, o.t + i * 0.09, 0.4, v * 0.2, 0.01)
    }
  }

  /** The riser before a wave: a rising saw and a noise sweep for `dur` seconds, ending in a short hit. */
  private riser(dur: number): void {
    const o = this.out()
    if (!o) return
    const { ctx, dest, t } = o
    const v = C.waveRiserGain
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(70, t)
    osc.frequency.exponentialRampToValueAtTime(330, t + dur)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(200, t)
    lp.frequency.exponentialRampToValueAtTime(2600, t + dur)
    const e = ctx.createGain()
    e.gain.setValueAtTime(0.0001, t)
    e.gain.exponentialRampToValueAtTime(v * 0.55, t + dur * 0.92)
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08)
    osc.connect(lp).connect(e).connect(dest)
    osc.start(t)
    osc.stop(t + dur + 0.1)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf(ctx)
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 2
    bp.frequency.setValueAtTime(300, t)
    bp.frequency.exponentialRampToValueAtTime(4200, t + dur)
    const ne = ctx.createGain()
    ne.gain.setValueAtTime(0.0001, t)
    ne.gain.exponentialRampToValueAtTime(v * 0.5, t + dur * 0.95)
    ne.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1)
    src.connect(bp).connect(ne).connect(dest)
    src.start(t)
    src.stop(t + dur + 0.12)
  }

  private thump(t: number, peak: number): void {
    this.blip('sine', L.beatHz * 1.5, L.beatHz * 0.7, t, 0.16, peak, 0.008)
  }

  /** Once a frame. */
  update(s: CueState): void {
    const o = this.out()
    if (!o) return
    const { ctx, dest, t } = o
    this.ensureTone(ctx, dest)

    // the suspicion tone
    const sus = s.playing && !s.spotted ? s.suspicion : 0
    const level = sus > C.suspicion.above ? Math.min(1, sus) : 0
    if (this.tone && this.toneGain) {
      this.toneGain.gain.setTargetAtTime(C.suspicion.gain * level * level, t, C.suspicion.smoothSec)
      this.tone.frequency.setTargetAtTime(C.suspicion.hzMin + (C.suspicion.hzMax - C.suspicion.hzMin) * level, t, C.suspicion.smoothSec)
    }

    // the stings
    if (s.playing) {
      if (s.spotted && !this.lastSpotted && t - this.lastSting > C.stingGapSec) {
        this.spotted()
        this.lastSting = t
      } else if (this.lastAlarm > 0 && s.alarm === 0 && t - this.lastSting > C.stingGapSec) {
        this.allClear()
        this.lastSting = t
      } else if (this.lastSpotted && !s.spotted && s.alarm === 0 && t - this.lastSting > C.stingGapSec) {
        this.allClear()
        this.lastSting = t
      }
    }
    this.lastSpotted = s.spotted
    this.lastAlarm = s.alarm

    // low HP: the heartbeat and the muffled master
    const low = s.playing && s.hp > 0 && s.hp < L.below ? 1 - s.hp / L.below : 0
    this.muffle += (low - this.muffle) * 0.1
    this.snd.setMuffle(this.muffle < 0.01 ? 0 : this.muffle)
    if (low > 0) {
      if (this.nextBeat < t - 1) this.nextBeat = t
      if (t >= this.nextBeat) {
        const bpm = L.beatBpmMax + (L.beatBpmMin - L.beatBpmMax) * (1 - low) // the lower the HP, the faster
        const peak = L.beatGain * (0.6 + 0.4 * low)
        this.thump(t, peak)
        this.thump(t + 0.17, peak * 0.7)
        this.nextBeat = t + 60 / bpm
      }
    }

    // the wave riser: once, when the countdown gets under its length
    if (s.playing && s.waveIn > 0 && s.waveIn <= C.waveRiserSec) {
      if (!this.riserFired) {
        this.riserFired = true
        this.riser(Math.max(0.5, s.waveIn))
      }
    } else if (s.waveIn < 0 || s.waveIn > C.waveRiserSec + 0.25) this.riserFired = false
  }
}
