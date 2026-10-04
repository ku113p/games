// One AudioContext, created on the first click (the "Click to start" overlay). Files are fetched at load,
// decoded once when the context exists. Names ending in _vN are grouped and played as random variants.
import glitch1 from '../../audio/sfx/glitch_v1.mp3'
import glitch2 from '../../audio/sfx/glitch_v2.mp3'
import glitch3 from '../../audio/sfx/glitch_v3.mp3'
import glitch4 from '../../audio/sfx/glitch_v4.mp3'
import glitch5 from '../../audio/sfx/glitch_v5.mp3'
import eat from '../../audio/sfx/eat.mp3'
import jackIn from '../../audio/sfx/jack_in.mp3'
import jackOut from '../../audio/sfx/jack_out.mp3'
import rain from '../../audio/sfx/rain_window_loop.mp3'
import hum from '../../audio/sfx/room_hum_loop.mp3'
import tabletOn from '../../audio/sfx/tablet_on.mp3'
import tabletSwipe from '../../audio/sfx/tablet_swipe.mp3'
import uiBack from '../../audio/sfx/ui_back.mp3'
import uiClick from '../../audio/sfx/ui_click.mp3'
import uiConfirm from '../../audio/sfx/ui_confirm.mp3'
import uiHover from '../../audio/sfx/ui_hover.mp3'
import waterDrink from '../../audio/sfx/water_drink.mp3'

const FILES: Record<string, string> = {
  glitch_v1: glitch1,
  glitch_v2: glitch2,
  glitch_v3: glitch3,
  glitch_v4: glitch4,
  glitch_v5: glitch5,
  eat,
  jack_in: jackIn,
  jack_out: jackOut,
  rain_window_loop: rain,
  room_hum_loop: hum,
  tablet_on: tabletOn,
  tablet_swipe: tabletSwipe,
  ui_back: uiBack,
  ui_click: uiClick,
  ui_confirm: uiConfirm,
  ui_hover: uiHover,
  water_drink: waterDrink,
}

export interface AudioConfig {
  master: number
  rain: number
  hum: number
  duckTime: number
}

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: GainNode | null = null
  private ambientFilter: BiquadFilterNode | null = null
  private readonly raw = new Map<string, Promise<ArrayBuffer>>()
  private readonly groups = new Map<string, AudioBuffer[]>()
  ready = false

  constructor(private readonly cfg: AudioConfig) {
    // fetch the bytes right away; decoding needs the context, which needs a user gesture
    for (const [name, url] of Object.entries(FILES)) this.raw.set(name, fetch(url).then((r) => r.arrayBuffer()))
  }

  /** Call from a click handler. Creates the context, decodes every file once, starts the ambient loops. */
  async unlock(): Promise<void> {
    if (this.ctx) return
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.cfg.master
    this.master.connect(ctx.destination)
    this.ambientFilter = ctx.createBiquadFilter()
    this.ambientFilter.type = 'lowpass'
    this.ambientFilter.frequency.value = 20000
    this.ambient = ctx.createGain()
    this.ambient.connect(this.ambientFilter).connect(this.master)
    await ctx.resume()
    await Promise.all(
      [...this.raw].map(async ([name, bytes]) => {
        const buf = await ctx.decodeAudioData(await bytes)
        const group = name.replace(/_v\d+$/, '')
        const list = this.groups.get(group) ?? []
        list.push(buf)
        this.groups.set(group, list)
      }),
    )
    this.ready = true
    this.loop('rain_window_loop', this.cfg.rain)
    this.loop('room_hum_loop', this.cfg.hum)
  }

  private loop(name: string, vol: number): void {
    const ctx = this.ctx
    const buf = this.groups.get(name)?.[0]
    if (!ctx || !buf || !this.ambient) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2) // fade the room in
    src.connect(g).connect(this.ambient)
    src.start()
  }

  /** Play a one-shot; a group name (e.g. "glitch") picks a random variant. */
  play(name: string, vol = 1, delay = 0): void {
    const ctx = this.ctx
    const list = this.groups.get(name)
    if (!ctx || !list || !this.master || list.length === 0) return
    const buf = list[Math.floor(Math.random() * list.length)]!
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(g).connect(this.master)
    src.start(ctx.currentTime + delay)
  }

  /** Duck the ambient bed (gain multiplier) and optionally muffle it (low-pass, Hz). */
  duck(level: number, lowpassHz = 20000): void {
    const ctx = this.ctx
    if (!ctx || !this.ambient || !this.ambientFilter) return
    this.ambient.gain.setTargetAtTime(level, ctx.currentTime, this.cfg.duckTime)
    this.ambientFilter.frequency.setTargetAtTime(lowpassHz, ctx.currentTime, this.cfg.duckTime)
  }
}
