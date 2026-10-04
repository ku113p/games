// view/audio.ts - sound facade: owns the AudioContext, the music and SFX buses, and the toggles.
// The core knows nothing about sound: main.ts calls this module from event handlers and buttons (not from the frame).

import { createMusic, type Music, type MusicConfig } from './music'
import { createSfx, type BlipConfig, type ComboConfig, type Sfx, type SfxName } from './sfx'

export interface SoundConfig {
  music: MusicConfig
  sfx: { volume: number }
  blips: Record<SfxName, BlipConfig>
  combo: ComboConfig
  /** Default toggle values until the player chooses something. */
  defaults: { musicOn: boolean; sfxOn: boolean }
}

export interface Audio {
  /** Create the context (idempotent), wake it up and start the music. Call from a player gesture. */
  unlock(): void
  /** Return the context to running (iOS suspends it on minimize and after a call). */
  resume(): void
  /** Mute the context (tab hidden). */
  suspend(): void
  play(name: SfxName, stepMs?: number): void
  /** New game: the apple combo restarts from the base note. */
  newRound(): void
  setMusicOn(on: boolean): void
  setSfxOn(on: boolean): void
  readonly musicOn: boolean
  readonly sfxOn: boolean
}

export function createAudio(cfg: SoundConfig | undefined, musicUrl: string, initial: { musicOn: boolean; sfxOn: boolean }): Audio {
  let ctx: AudioContext | null = null
  let sfx: Sfx | null = null
  let music: Music | null = null
  let musicOn = initial.musicOn
  let sfxOn = initial.sfxOn

  function unlock(): void {
    if (cfg === undefined) return
    if (ctx === null) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctor === undefined) return
      ctx = new Ctor()
      const sfxBus = ctx.createGain()
      sfxBus.gain.value = cfg.sfx.volume
      sfxBus.connect(ctx.destination)
      sfx = createSfx(ctx, sfxBus, cfg.blips, cfg.combo)
      music = createMusic(ctx, ctx.destination, musicUrl, cfg.music, musicOn)
    }
    resume()
    // iOS safeguard: a single resume() is sometimes not enough, a really running source is needed.
    const silent = ctx.createBufferSource()
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silent.connect(ctx.destination)
    silent.start(0)
    music?.start()
  }

  function resume(): void {
    // 'interrupted' exists only in Safari and is missing from the DOM types.
    if (ctx !== null && (ctx.state as string) !== 'running') void ctx.resume().catch(() => {})
  }

  return {
    unlock,
    resume,
    suspend() {
      if (ctx !== null && ctx.state === 'running') void ctx.suspend().catch(() => {})
    },
    play(name, stepMs) {
      if (sfxOn) sfx?.play(name, stepMs)
    },
    newRound() {
      sfx?.resetCombo()
    },
    setMusicOn(on) {
      musicOn = on
      music?.setOn(on)
    },
    setSfxOn(on) {
      sfxOn = on
    },
    get musicOn() {
      return musicOn
    },
    get sfxOn() {
      return sfxOn
    },
  }
}
