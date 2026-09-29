// view/sfx.ts — процедурные звуки на WebAudio (осциллятор + огибающая), файлов нет.
// Вызывается ТОЛЬКО из обработки событий игры и нажатий кнопок, не из кадра:
// OscillatorNode одноразовый, на каждый звук создаётся новая нода (события редкие).
//
// Как добавить звук: 1) имя в SfxName, 2) запись в config.json → sound.blips, 3) вызов sfx.play('имя').
// Больше ничего. Смерть и старт партии намеренно НЕ заведены: их дизайнер не заказывал.

export type SfxName = 'eat' | 'click'

export interface BlipConfig {
  wave: OscillatorType
  freqFrom: number
  freqTo: number
  sweepMs: number
  attackMs: number
  decayMs: number
  gain: number
  /** Сдвигать тон по комбо (следующее яблоко выше предыдущего). */
  combo: boolean
}

export interface ComboConfig {
  /** На сколько полутонов выше каждое следующее яблоко; 0 — комбо выключено. */
  semitonesPerApple: number
  /** Потолок сдвига в полутонах, чтобы не уползало в писк. */
  maxSemitones: number
}

export interface Sfx {
  play(name: SfxName): void
  /** Новая партия: комбо возвращается к базовой ноте. */
  resetCombo(): void
}

/** Сдвиг тона в полутонах для яблока номер `index` (0 — первое). Чистая функция. */
export function comboSemitones(index: number, combo: ComboConfig): number {
  if (combo.semitonesPerApple <= 0 || index <= 0) return 0
  return Math.min(index * combo.semitonesPerApple, combo.maxSemitones)
}

/** Множитель частоты для сдвига в полутонах (равномерно темперированный строй). */
export function semitoneRatio(semitones: number): number {
  return Math.pow(2, semitones / 12)
}

// Нижняя граница экспоненциальной огибающей (exponentialRamp не умеет в 0). Техническая константа WebAudio.
const SILENCE = 0.0001
const MS = 0.001

export function createSfx(
  ctx: AudioContext,
  destination: AudioNode,
  blips: Readonly<Record<SfxName, BlipConfig>>,
  combo: ComboConfig,
): Sfx {
  let comboIndex = 0

  function play(name: SfxName): void {
    const b = blips[name]
    const ratio = b.combo ? semitoneRatio(comboSemitones(comboIndex, combo)) : 1
    if (b.combo) comboIndex++

    const t0 = ctx.currentTime
    const attackEnd = t0 + b.attackMs * MS
    const end = attackEnd + b.decayMs * MS

    const osc = ctx.createOscillator()
    osc.type = b.wave
    osc.frequency.setValueAtTime(b.freqFrom * ratio, t0)
    osc.frequency.exponentialRampToValueAtTime(b.freqTo * ratio, t0 + b.sweepMs * MS)

    const env = ctx.createGain()
    env.gain.setValueAtTime(SILENCE, t0)
    env.gain.linearRampToValueAtTime(b.gain, attackEnd)
    env.gain.exponentialRampToValueAtTime(SILENCE, end)

    osc.connect(env)
    env.connect(destination)
    osc.onended = () => {
      osc.disconnect()
      env.disconnect()
    }
    osc.start(t0)
    osc.stop(end + 0.02)
  }

  return {
    play,
    resetCombo() {
      comboIndex = 0
    },
  }
}
