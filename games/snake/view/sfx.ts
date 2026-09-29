// view/sfx.ts — процедурные звуки на WebAudio (осциллятор + огибающая), файлов нет.
// Вызывается ТОЛЬКО из обработки событий игры и нажатий кнопок, не из кадра:
// OscillatorNode одноразовый, на каждый звук создаётся новая нода (события редкие).
//
// Как добавить звук: 1) имя в SfxName, 2) запись в config.json → sound.blips, 3) вызов sfx.play('имя').
// Больше ничего. Старт партии намеренно НЕ заведён: его дизайнер не заказывал.
// Смерть ('death') — тот же путь; ей нужны два необязательных слоя блипа: `layer` (второй тон) и `noise` (шумовой всплеск).

export type SfxName = 'eat' | 'click' | 'death'

/** Второй осциллятор на ту же огибающую: тон основного × ratio (0.5 — октавой ниже, для веса). */
export interface LayerConfig {
  wave: OscillatorType
  ratio: number
  gain: number
}

/** Всплеск белого шума через ФНЧ, частота среза падает freqFrom → freqTo за decayMs: «удар» в начале звука. */
export interface NoiseConfig {
  gain: number
  decayMs: number
  filterFrom: number
  filterTo: number
}

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
  layer?: LayerConfig
  noise?: NoiseConfig
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
// Длина буфера шума; всплеск не может быть длиннее (decayMs шума в конфиге обрезается им).
const NOISE_BUFFER_SEC = 2

export function createSfx(
  ctx: AudioContext,
  destination: AudioNode,
  blips: Readonly<Record<SfxName, BlipConfig>>,
  combo: ComboConfig,
): Sfx {
  let comboIndex = 0
  // Буфер белого шума нужен только смерти: создаётся лениво один раз и переиспользуется.
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

    // Слой-тон: та же огибающая и тот же свип, частоты масштабированы (ratio).
    const layer = b.layer
    if (layer !== undefined) {
      const lo = ctx.createOscillator()
      lo.type = layer.wave
      lo.frequency.setValueAtTime(b.freqFrom * ratio * layer.ratio, t0)
      lo.frequency.exponentialRampToValueAtTime(b.freqTo * ratio * layer.ratio, t0 + b.sweepMs * MS)
      const lg = ctx.createGain()
      lg.gain.value = layer.gain / b.gain // огибающая env уже несёт b.gain: слой задаётся в абсолютных долях
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
    },
  }
}
