// view/music.ts - background music: a decoded buffer + AudioBufferSourceNode with loop.
// Not HTMLAudioElement: its loop clicks at the seam (Safari, Chrome).
// loopStart/loopEnd sit on musical bars INSIDE the buffer: the mp3 padding at the file edges
// (Safari does not always trim it) stays out of the loop. Loading is a cold path, so async is fine here.

export interface MusicConfig {
  volume: number
  /** Loop start, seconds from the buffer start (a bar boundary). The intro plays once before it. */
  loopStartSec: number
  /** Loop end, seconds from the buffer start (a bar boundary). */
  loopEndSec: number
  /** Sample rate the decoded buffer is kept at (matches the file): RAM = seconds x Hz x 4 bytes. */
  bufferSampleRate: number
  /** Fade in/out smoothness, ms. */
  fadeMs: number
}

export interface Music {
  /** Load, decode and start the loop (once; repeated calls are ignored). */
  start(): void
  /** Turn on/off (smoothly, via gain; the stream keeps running so the bar position is not lost). */
  setOn(on: boolean): void
}

export function createMusic(ctx: AudioContext, destination: AudioNode, url: string, cfg: MusicConfig, initialOn: boolean): Music {
  const gain = ctx.createGain()
  gain.gain.value = initialOn ? cfg.volume : 0
  gain.connect(destination)
  let on = initialOn
  let started = false

  function fade(): void {
    // setTargetAtTime: time constant = fadeMs/3, reaches ~95% by the end of fadeMs.
    gain.gain.setTargetAtTime(on ? cfg.volume : 0, ctx.currentTime, cfg.fadeMs / 3000)
  }

  async function load(): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`music: ${url} → HTTP ${res.status}`)
    // Decode in a separate offline context at the file's sample rate: decodeAudioData resamples to the rate of
    // ITS context, and the main one runs at 44.1/48 kHz - the buffer would be twice as large in RAM.
    // Playback through the main context resamples on the fly.
    const decoder = new OfflineAudioContext(1, 1, cfg.bufferSampleRate)
    const buffer = await decoder.decodeAudioData(await res.arrayBuffer())
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.loopStart = cfg.loopStartSec
    src.loopEnd = Math.min(cfg.loopEndSec, buffer.duration)
    src.connect(gain)
    src.start(0)
  }

  return {
    start() {
      if (started) return
      started = true
      load().catch((err: unknown) => {
        console.error('music: failed to load', err)
      })
    },
    setOn(v: boolean) {
      on = v
      fade()
    },
  }
}
