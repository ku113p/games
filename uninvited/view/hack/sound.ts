// The hack overlay's sounds (audio/sfx, see its README). Files are fetched and decoded up front; decoding works on a
// suspended AudioContext, and the context is resumed when the overlay opens (the page has had a user gesture by then).
// Names ending in _vN form a group and play as a random variant.
import glitch1 from '../../audio/sfx/glitch_v1.mp3'
import glitch2 from '../../audio/sfx/glitch_v2.mp3'
import glitch3 from '../../audio/sfx/glitch_v3.mp3'
import glitch4 from '../../audio/sfx/glitch_v4.mp3'
import glitch5 from '../../audio/sfx/glitch_v5.mp3'
import hackCorrect from '../../audio/sfx/hack_correct.mp3'
import hackFail from '../../audio/sfx/hack_fail.mp3'
import hackSelect1 from '../../audio/sfx/hack_select_v1.mp3'
import hackSelect2 from '../../audio/sfx/hack_select_v2.mp3'
import hackSelect3 from '../../audio/sfx/hack_select_v3.mp3'
import hackSelect4 from '../../audio/sfx/hack_select_v4.mp3'
import hackStart from '../../audio/sfx/hack_start.mp3'
import hackSuccess from '../../audio/sfx/hack_success.mp3'
import hackTickLoop from '../../audio/sfx/hack_tick_loop.mp3'
import hackWrong from '../../audio/sfx/hack_wrong.mp3'
import uiHover from '../../audio/sfx/ui_hover.mp3'

const FILES: Record<string, string> = {
  glitch_v1: glitch1,
  glitch_v2: glitch2,
  glitch_v3: glitch3,
  glitch_v4: glitch4,
  glitch_v5: glitch5,
  hack_correct: hackCorrect,
  hack_fail: hackFail,
  hack_select_v1: hackSelect1,
  hack_select_v2: hackSelect2,
  hack_select_v3: hackSelect3,
  hack_select_v4: hackSelect4,
  hack_start: hackStart,
  hack_success: hackSuccess,
  hack_tick_loop: hackTickLoop,
  hack_wrong: hackWrong,
  ui_hover: uiHover,
}

export type HackSoundName =
  | 'glitch'
  | 'hack_correct'
  | 'hack_fail'
  | 'hack_select'
  | 'hack_start'
  | 'hack_success'
  | 'hack_wrong'
  | 'ui_hover'

/** Where the overlay's sound goes: the game's own context and mixer bus, or a private one when omitted. */
export interface HackAudioOut {
  ctx: AudioContext
  destination: AudioNode
}

export class HackSound {
  private readonly ctx: AudioContext | null
  private readonly out: GainNode | null
  private readonly groups = new Map<string, AudioBuffer[]>()
  private loopSrc: AudioBufferSourceNode | null = null
  private loopGain: GainNode | null = null

  constructor(volume: number, audio?: HackAudioOut) {
    let ctx: AudioContext | null = null
    try {
      ctx = audio?.ctx ?? new AudioContext()
    } catch {
      ctx = null // no Web Audio: the overlay stays silent
    }
    this.ctx = ctx
    if (!ctx) {
      this.out = null
      return
    }
    this.out = ctx.createGain()
    this.out.gain.value = volume
    this.out.connect(audio?.destination ?? ctx.destination)
    for (const [name, url] of Object.entries(FILES)) {
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((buf) => {
          const group = name.replace(/_v\d+$/, '')
          const list = this.groups.get(group) ?? []
          list.push(buf)
          this.groups.set(group, list)
        })
        .catch(() => {}) // a missing sound must never break the hack
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  play(name: HackSoundName, vol = 1, rate = 1): void {
    const ctx = this.ctx
    const list = this.groups.get(name)
    if (!ctx || !this.out || !list || list.length === 0) return
    const buf = list[Math.floor(Math.random() * list.length)] as AudioBuffer
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(g).connect(this.out)
    src.start()
  }

  /** The ticking clock while the hack runs. Starts once the file is decoded (retried by calling again). */
  startTick(vol: number): void {
    const ctx = this.ctx
    const buf = this.groups.get('hack_tick_loop')?.[0]
    if (!ctx || !this.out || !buf || this.loopSrc) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.3)
    src.connect(g).connect(this.out)
    src.start()
    this.loopSrc = src
    this.loopGain = g
  }

  get ticking(): boolean {
    return this.loopSrc !== null
  }

  setTickRate(rate: number): void {
    if (this.loopSrc && this.ctx) this.loopSrc.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.05)
  }

  stopTick(): void {
    const ctx = this.ctx
    const src = this.loopSrc
    const g = this.loopGain
    this.loopSrc = null
    this.loopGain = null
    if (!ctx || !src || !g) return
    g.gain.cancelScheduledValues(ctx.currentTime)
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.04)
    src.stop(ctx.currentTime + 0.25)
  }
}
