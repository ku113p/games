// The music player: looping tracks from audio/music/*.mp3 (listed by scripts/music-manifest.ts into music-files.ts;
// an empty folder or a file that fails to decode just means silence). State driven, and every change happens on a bar
// line of one shared clock (config audio.music.bpm), as a crossfade.
//
// File names (README.md has the same list):
//   net_a.stem1.mp3 .. net_a.stem4.mp3   vertical stems of the level track (same length and tempo): stem 1 always, the
//                                        rest come in with the tension and combat levels (audio.music.stemGain)
//   net_calm / net_tension / net_combat  or three horizontal versions of it (same tempo and bar count), crossfaded
//   hack, room, office, menu             one loop each (a missing hack plays the level track at tension; a missing menu
//                                        plays its calm version; a missing room or office plays nothing)
//   sting_win, sting_death, sting_end    one-shot stingers (a short synthesized stand-in plays when a file is missing)
// All the loops of the level track start on the shared bar grid at the offset of that grid, so any two of them (and
// every stem) stay in step however often the state flips. Ducking: -6 dB under a hack, a May line and the pause menu.
import cfgAll from '../config.json'
import type { Sound } from './audio'
import { MUSIC_FILES } from './music-files'

const K = cfgAll.audio.music
const LOWHP_DUCK = cfgAll.audio.mixer.lowHp.musicDuckDb
const BAR_SEC = (60 / K.bpm) * K.beatsPerBar

export type MusicContext = 'net' | 'room' | 'office'
export type StingName = 'win' | 'death' | 'end'
/** 0 stealth (calm), 1 tension (suspicion or alarm 1-2), 2 combat (alarm 3, waves). */
export type Intensity = 0 | 1 | 2

export interface MusicFlags {
  menu: boolean
  paused: boolean
  hack: boolean
  /** May is talking. */
  dialogue: boolean
  lowHp: boolean
}

interface Layer {
  buf: AudioBuffer
  gain: GainNode
  src: AudioBufferSourceNode | null
}

interface TrackSet {
  key: string
  layers: Layer[]
  /** Per intensity, the gain of each layer. */
  gains: number[][]
  /** Started on the shared grid (the level track) instead of from its beginning. */
  phased: boolean
  out: GainNode
  /** The audio time after which a faded-out set may be stopped (0 = not leaving). */
  stopAt: number
  playing: boolean
}

const LEVELS = ['calm', 'tension', 'combat'] as const
const dbGain = (db: number): number => Math.pow(10, db / 20)

export class Music {
  readonly flags: MusicFlags = { menu: false, paused: false, hack: false, dialogue: false, lowHp: false }
  context: MusicContext = 'net'
  /** The wanted intensity this frame (the player holds it for audio.music.holdSec before stepping down). */
  want: Intensity = 0

  private ctx: AudioContext | null = null
  private duck: GainNode | null = null
  private epoch = 0
  private readonly buffers = new Map<string, AudioBuffer>()
  private sets = new Map<string, TrackSet>()
  private level: Intensity = 0
  private holdLeft = 0
  private cur = ''
  private curLevel: Intensity = 0
  private dirty = true
  private stingUntil = 0
  private lastDuck = -1

  constructor(private readonly snd: Sound) {
    snd.onReady(() => this.init())
  }

  private init(): void {
    const ctx = this.snd.ctx
    const bus = this.snd.busNode('music')
    if (!ctx || !bus) return
    this.ctx = ctx
    this.duck = ctx.createGain()
    this.duck.connect(bus)
    this.epoch = ctx.currentTime
    // fetch + decode in the background; a missing or broken file stays out
    for (const [name, url] of Object.entries(MUSIC_FILES)) {
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
        .then((data) => ctx.decodeAudioData(data))
        .then((b) => {
          this.buffers.set(name, b)
          const net = this.sets.get('net')
          if (net && !net.playing) this.sets.delete('net') // rebuilt with the new file
          this.dirty = true
        })
        .catch(() => undefined)
    }
  }

  /** Which file names make the set of this key (null when none of its files exist). */
  private build(key: string): TrackSet | null {
    const ctx = this.ctx
    const out = this.duck
    if (!ctx || !out) return null
    let bufs: AudioBuffer[] = []
    let gains: number[][] = []
    if (key === 'net') {
      const stems = [1, 2, 3, 4].map((i) => this.buffers.get(`net_a.stem${i}`)).filter((b): b is AudioBuffer => !!b)
      if (stems.length > 0) {
        bufs = stems
        gains = LEVELS.map((l) => K.stemGain[l].slice(0, stems.length))
      } else {
        const vers = LEVELS.map((l) => this.buffers.get(`net_${l}`))
        const have = vers.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
        if (have.length === 0) return null
        bufs = have.map((i) => vers[i] as AudioBuffer)
        // each level plays the highest version at or under it (or the lowest one when it has none under it)
        gains = [0, 1, 2].map((lv) => {
          let pick = 0
          for (let j = 0; j < have.length; j++) if ((have[j] as number) <= lv) pick = j
          return bufs.map((_, j) => (j === pick ? 1 : 0))
        })
      }
    } else {
      const b = this.buffers.get(key)
      if (!b) return null
      bufs = [b]
      gains = [[1], [1], [1]]
    }
    const set: TrackSet = { key, layers: [], gains, phased: key === 'net', out: ctx.createGain(), stopAt: 0, playing: false }
    set.out.gain.value = 0
    set.out.connect(out)
    for (const b of bufs) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(set.out)
      set.layers.push({ buf: b, gain: g, src: null })
    }
    return set
  }

  private nextBar(now: number): number {
    const bars = Math.ceil((now - this.epoch) / BAR_SEC - 1e-6)
    let t = this.epoch + bars * BAR_SEC
    if (t - now < 0.12) t += BAR_SEC // too close to schedule cleanly
    return t
  }

  private xfade(g: AudioParam, to: number, t: number): void {
    const now = this.ctx?.currentTime ?? 0
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(to, t + K.xfadeSec)
  }

  /** Which set and intensity the state asks for right now. */
  private desired(): { key: string; level: Intensity } {
    if (this.flags.hack) return this.buffers.has('hack') ? { key: 'hack', level: 1 } : { key: 'net', level: 1 }
    if (this.flags.menu) return this.buffers.has('menu') ? { key: 'menu', level: 0 } : { key: 'net', level: 0 }
    if (this.context === 'room') return { key: 'room', level: 0 }
    if (this.context === 'office') return { key: 'office', level: 0 }
    return { key: 'net', level: this.level }
  }

  private apply(): void {
    const ctx = this.ctx
    if (!ctx) return
    const want = this.desired()
    this.cur = want.key
    this.curLevel = want.level
    this.dirty = false
    let set = this.sets.get(want.key)
    if (!set) {
      const made = this.build(want.key)
      if (made) {
        this.sets.set(want.key, made)
        set = made
      }
    }
    if (!set) return // nothing to play (yet)
    const now = ctx.currentTime
    const t = this.nextBar(now)
    // leave the other sets
    for (const o of this.sets.values()) {
      if (o === set || !o.playing || o.stopAt > 0) continue
      this.xfade(o.out.gain, 0, t)
      o.stopAt = t + K.xfadeSec + 0.1
    }
    if (!set.playing) {
      set.playing = true
      for (const l of set.layers) {
        const src = ctx.createBufferSource()
        src.buffer = l.buf
        src.loop = true
        src.connect(l.gain)
        const off = set.phased ? (((t - this.epoch) % l.buf.duration) + l.buf.duration) % l.buf.duration : 0
        src.start(t, off)
        l.src = src
      }
    }
    set.stopAt = 0
    this.xfade(set.out.gain, 1, t)
    const gains = set.gains[want.level] as number[]
    for (let i = 0; i < set.layers.length; i++) this.xfade((set.layers[i] as Layer).gain.gain, gains[i] ?? 0, t)
  }

  /** Once a frame (dt in real seconds, also while paused). */
  update(dt: number): void {
    const ctx = this.ctx
    if (!ctx || !this.duck) return
    // the intensity: up at once, down after a hold
    if (this.want > this.level) {
      this.level = this.want
      this.holdLeft = K.holdSec
    } else if (this.want < this.level) {
      this.holdLeft -= dt
      if (this.holdLeft <= 0) this.level = (this.level - 1) as Intensity
    } else this.holdLeft = K.holdSec
    const d = this.desired()
    if (this.dirty || d.key !== this.cur || d.level !== this.curLevel) this.apply()
    // stop what has faded out
    const now = ctx.currentTime
    for (const o of this.sets.values()) {
      if (o.stopAt > 0 && now >= o.stopAt) {
        for (const l of o.layers) {
          try {
            l.src?.stop()
          } catch {
            // already stopped
          }
          l.src = null
        }
        o.playing = false
        o.stopAt = 0
      }
    }
    // the duck: under a hack, May, the pause menu, a stinger, low HP
    let k = 1
    if (this.flags.hack || this.flags.dialogue || this.flags.paused) k *= dbGain(K.duckDb)
    if (this.flags.lowHp) k *= dbGain(LOWHP_DUCK)
    if (now < this.stingUntil) k *= 0.35
    if (k !== this.lastDuck) {
      this.duck.gain.setTargetAtTime(k, now, K.duckSec / 3)
      this.lastDuck = k
    }
  }

  /** A one-shot for an ending or the end of a level: the file sting_<name> when there is one, a synthesized stand-in if not. */
  sting(name: StingName): void {
    const ctx = this.ctx
    const dest = this.snd.busNode('ui')
    if (!ctx || !dest) return
    const t = ctx.currentTime + 0.02
    const file = this.buffers.get(`sting_${name}`)
    if (file) {
      const src = ctx.createBufferSource()
      src.buffer = file
      const g = ctx.createGain()
      g.gain.value = K.stingGain
      src.connect(g).connect(dest)
      src.start(t)
      this.stingUntil = t + Math.min(file.duration, K.stingDuckSec)
      return
    }
    // stand-ins: a chord that opens (win), sinks (death) or just hangs (end)
    const chord = name === 'win' ? [293.7, 440, 587.3, 740] : name === 'death' ? [220, 261.6, 329.6] : [293.7, 349.2, 440]
    const dur = K.stingDuckSec
    chord.forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = name === 'death' ? 'sawtooth' : 'triangle'
      o.frequency.setValueAtTime(f, t + i * 0.08)
      if (name === 'death') o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = name === 'death' ? 900 : 2200
      const e = ctx.createGain()
      e.gain.setValueAtTime(0.0001, t + i * 0.08)
      e.gain.exponentialRampToValueAtTime(0.16 * K.stingGain, t + i * 0.08 + 0.05)
      e.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(lp).connect(e).connect(dest)
      o.start(t + i * 0.08)
      o.stop(t + dur + 0.05)
    })
    this.stingUntil = t + dur
  }
}
