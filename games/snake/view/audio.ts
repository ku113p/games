// view/audio.ts — фасад звука: владеет AudioContext, шинами музыки и SFX, тумблерами.
// Ядро про звук не знает: main.ts зовёт этот модуль из обработчиков событий и кнопок (не из кадра).

import { createMusic, type Music, type MusicConfig } from './music'
import { createSfx, type BlipConfig, type ComboConfig, type Sfx, type SfxName } from './sfx'

export interface SoundConfig {
  music: MusicConfig
  sfx: { volume: number }
  blips: Record<SfxName, BlipConfig>
  combo: ComboConfig
  /** Значения тумблеров по умолчанию, пока игрок ничего не выбрал. */
  defaults: { musicOn: boolean; sfxOn: boolean }
}

export interface Audio {
  /** Создать контекст (идемпотентно), разбудить его и запустить музыку. Звать из жеста игрока. */
  unlock(): void
  /** Вернуть контекст в running (iOS усыпляет его при сворачивании и после звонка). */
  resume(): void
  /** Заглушить контекст (вкладка скрыта). */
  suspend(): void
  play(name: SfxName): void
  /** Новая партия: комбо яблок с базовой ноты. */
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
    // Страховка для iOS: одного resume() бывает мало, нужен реально запущенный source.
    const silent = ctx.createBufferSource()
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silent.connect(ctx.destination)
    silent.start(0)
    music?.start()
  }

  function resume(): void {
    // 'interrupted' есть только в Safari и в типах DOM его нет.
    if (ctx !== null && (ctx.state as string) !== 'running') void ctx.resume().catch(() => {})
  }

  return {
    unlock,
    resume,
    suspend() {
      if (ctx !== null && ctx.state === 'running') void ctx.suspend().catch(() => {})
    },
    play(name) {
      if (sfxOn) sfx?.play(name)
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
