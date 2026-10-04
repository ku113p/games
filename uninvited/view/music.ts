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
import { equalPowerCurve, loadGroups, versionGains } from './music-pick'

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
  /** The stem number (0-3) or the version (0 calm, 1 tension, 2 combat) this layer plays. */
  slot: number
  buf: AudioBuffer
  gain: GainNode
  src: AudioBufferSourceNode | null
}

interface TrackSet {
  key: string
  layers: Layer[]
  /** The level track: 'stems' or the three 'versions' (layers are added as their files decode); '' for a single loop. */
  mode: 'stems' | 'versions' | ''
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
    // the files are fetched right now (level tracks, then hack, then the rest), in parallel with the SFX; they are
    // decoded as soon as the context exists, and the player picks them up whenever they land
    const bytes = new Map<string, Promise<ArrayBuffer | null>>()
    const groups = loadGroups(Object.keys(MUSIC_FILES))
    void (async () => {
      for (const g of groups) {
        for (const name of g) {
          bytes.set(
            name,
            fetch(MUSIC_FILES[name] as string)
              .then((r) => (r.ok ? r.arrayBuffer() : null))
              .catch(() => null),
          )
        }
        await Promise.all(g.map((n) => bytes.get(n)))
      }
    })()
    this.bytes = bytes
    snd.onContext(() => this.init())
  }

  private readonly bytes: Map<string, Promise<ArrayBuffer | null>>

  private init(): void {
    const ctx = this.snd.ctx
    const bus = this.snd.busNode('music')
    if (!ctx || !bus) return
    this.ctx = ctx
    this.duck = ctx.createGain()
    this.duck.connect(bus)
    this.epoch = ctx.currentTime
    // a missing or broken file stays out; every file that decodes marks the player dirty so it re-reads the set
    const names = loadGroups(Object.keys(MUSIC_FILES)).flat()
    for (const name of names) {
      // the fetches of later groups only start after the earlier ones, so wait for the entry to exist
      const take = async (): Promise<ArrayBuffer | null> => {
        for (let i = 0; i < 6000 && !this.bytes.has(name); i++) await new Promise((r) => setTimeout(r, 10))
        return (await this.bytes.get(name)) ?? null
      }
      take()
        .then((data) => (data ? ctx.decodeAudioData(data) : Promise.reject(new Error('missing'))))
        .then((b) => {
          this.buffers.set(name, b)
          this.dirty = true
        })
        .catch(() => undefined)
    }
  }

  /** The layers the set can have right now: the files that decoded, by slot. */
  private wanted(set: TrackSet): Array<{ slot: number; buf: AudioBuffer }> {
    const out: Array<{ slot: number; buf: AudioBuffer }> = []
    if (set.key !== 'net') {
      const b = this.buffers.get(set.key)
      if (b) out.push({ slot: 0, buf: b })
    } else if (set.mode === 'stems') {
      for (let i = 0; i < 4; i++) {
        const b = this.buffers.get(`net_a.stem${i + 1}`)
        if (b) out.push({ slot: i, buf: b })
      }
    } else {
      LEVELS.forEach((l, i) => {
        const b = this.buffers.get(`net_${l}`)
        if (b) out.push({ slot: i, buf: b })
      })
    }
    return out
  }

  /** Adds the layers whose files decoded after the set was built; a playing set starts them on the grid at time t. */
  private sync(set: TrackSet, t: number): void {
    const ctx = this.ctx
    if (!ctx) return
    for (const w of this.wanted(set)) {
      if (set.layers.some((l) => l.slot === w.slot)) continue
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(set.out)
      const layer: Layer = { slot: w.slot, buf: w.buf, gain: g, src: null }
      set.layers.push(layer)
      if (set.playing) this.startLayer(set, layer, t)
    }
  }

  private startLayer(set: TrackSet, l: Layer, t: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const src = ctx.createBufferSource()
    src.buffer = l.buf
    src.loop = true
    src.connect(l.gain)
    const off = set.phased ? (((t - this.epoch) % l.buf.duration) + l.buf.duration) % l.buf.duration : 0
    src.start(t, off)
    l.src = src
  }

  /** The gain of each layer of a set at an intensity (an absent version falls back, see pickVersion). */
  private gainsFor(set: TrackSet, level: Intensity): number[] {
    if (set.mode === 'stems') return set.layers.map((l) => K.stemGain[LEVELS[level] as (typeof LEVELS)[number]][l.slot] ?? 0)
    if (set.mode === 'versions') {
      const have = LEVELS.map((_, i) => set.layers.some((l) => l.slot === i))
      const g = versionGains(have, level)
      return set.layers.map((l) => g[l.slot] ?? 0)
    }
    return set.layers.map(() => 1)
  }

  /** Builds the set of this key (null when none of its files has decoded yet). */
  private build(key: string): TrackSet | null {
    const ctx = this.ctx
    const out = this.duck
    if (!ctx || !out) return null
    let mode: TrackSet['mode'] = ''
    if (key === 'net') {
      if ([1, 2, 3, 4].some((i) => this.buffers.has(`net_a.stem${i}`))) mode = 'stems'
      else if (LEVELS.some((l) => this.buffers.has(`net_${l}`))) mode = 'versions'
      else return null
    } else if (!this.buffers.has(key)) return null
    const set: TrackSet = { key, layers: [], mode, phased: key === 'net', out: ctx.createGain(), stopAt: 0, playing: false }
    set.out.gain.value = 0
    set.out.connect(out)
    this.sync(set, 0)
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
    const from = g.value
    g.cancelScheduledValues(now)
    g.setValueAtTime(from, now)
    // equal power (sin in, cos out), not linear: two linear halves dip 3 dB in the middle
    if (from === to) return
    g.setValueCurveAtTime(equalPowerCurve(from, to), t, K.xfadeSec)
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
      for (const l of set.layers) this.startLayer(set, l, t)
    }
    this.sync(set, t) // files that decoded since the last look join on this bar line
    set.stopAt = 0
    this.xfade(set.out.gain, 1, t)
    const gains = this.gainsFor(set, want.level)
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
