// view/sfx.ts — процедурные звуки на WebAudio (осциллятор + огибающая), файлов нет.
// Вызывается ТОЛЬКО из обработки событий игры и нажатий кнопок, не из кадра:
// OscillatorNode одноразовый, на каждый звук создаётся новая нода (события редкие).
//
// Как добавить звук: 1) имя в SfxName, 2) запись в config.json → sound.blips, 3) вызов sfx.play('имя').
// Больше ничего. Старт партии намеренно НЕ заведён: его дизайнер не заказывал.
// Смерть ('death') — тот же путь; ей нужны два необязательных слоя блипа: `layer` (второй тон) и `noise` (шумовой всплеск).

export type SfxName = 'eat' | 'click' | 'death' | 'tick'

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

/**
 * Зависимость звука шага от темпа (только у 'tick'). stepMs — действующая длительность шага с учётом ускорения.
 * Чем короче шаг, тем тише тик: на разгоне с ускорением он уходит в фон, а не стрекочет.
 */
export interface SpeedConfig {
  /** Длительность шага, при которой тик звучит на полную громкость (и дольше). */
  slowStepMs: number
  /** Длительность шага, при которой громкость падает до fastGain (и короче). */
  fastStepMs: number
  /** Множитель громкости на fastStepMs, 0..1. Между slow и fast — линейно по длительности шага. */
  fastGain: number
  /** Шаги короче этого озвучиваются не все, а каждый skipEvery-й; 0 — озвучивать все. */
  skipBelowStepMs: number
  /** Каждый какой шаг озвучивать на быстром ходу (2 — через один). */
  skipEvery: number
  /** Разброс высоты тона от шага к шагу, ±центов (100 — полутон); 0 — одна нота. */
  jitterCents: number
  /** Не чаще, чем раз в столько мс (защита, если за кадр случилось несколько шагов). */
  minGapMs: number
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
  speed?: SpeedConfig
}

export interface ComboConfig {
  /** На сколько полутонов выше каждое следующее яблоко; 0 — комбо выключено. */
  semitonesPerApple: number
  /** Потолок сдвига в полутонах, чтобы не уползало в писк. */
  maxSemitones: number
}

export interface Sfx {
  /** stepMs нужен только 'tick' (темп шага для громкости и пропусков); остальным не нужен. */
  play(name: SfxName, stepMs?: number): void
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

/** Громкость тика от длительности шага: 1 на медленном ходу, fastGain на быстром, между — линейно. Чистая функция. */
export function tickGainFactor(stepMs: number, speed: SpeedConfig): number {
  const span = speed.slowStepMs - speed.fastStepMs
  if (!(span > 0) || !(stepMs === stepMs)) return 1
  const t = Math.min(1, Math.max(0, (speed.slowStepMs - stepMs) / span))
  return 1 + (speed.fastGain - 1) * t
}

/** Озвучивать ли шаг номер `index` при данной длительности шага (на быстром ходу — каждый skipEvery-й). Чистая функция. */
export function tickAudible(stepMs: number, index: number, speed: SpeedConfig): boolean {
  if (speed.skipBelowStepMs <= 0 || speed.skipEvery <= 1) return true
  if (stepMs >= speed.skipBelowStepMs) return true
  return index % speed.skipEvery === 0
}

/** Детерминированный множитель частоты тика номер `index`: псевдослучайный сдвиг в ±jitterCents. Чистая функция. */
export function tickPitchRatio(index: number, jitterCents: number): number {
  if (jitterCents <= 0) return 1
  let h = Math.imul(index + 1, 0x9e3779b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  const unit = ((h >>> 0) / 4294967296) * 2 - 1 // [-1, 1)
  return Math.pow(2, (unit * jitterCents) / 1200)
}

/**
 * Огибающая блипа в момент tMs от старта: линейная атака от SILENCE до peak за attackMs, затем экспонента peak → SILENCE за decayMs.
 * Ровно то, что строит play() через setValueAtTime/linearRamp/exponentialRamp. Чистая функция; нужна тестам громкости.
 * Важно: decayMs — время спада на все 60 дБ (peak/SILENCE), слышимая часть (до −30 дБ) ≈ половина decayMs,
 * поэтому «тук» длиной 40 мс требует decayMs около 100, а не 40.
 */
export function blipEnvelope(tMs: number, attackMs: number, decayMs: number, peak: number): number {
  if (tMs <= 0) return SILENCE
  if (tMs < attackMs) return SILENCE + ((peak - SILENCE) * tMs) / attackMs
  if (tMs >= attackMs + decayMs) return SILENCE
  return peak * Math.pow(SILENCE / peak, (tMs - attackMs) / decayMs)
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
  let tickIndex = 0
  let lastTickAt = -Infinity
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

  function play(name: SfxName, stepMs?: number): void {
    const b = blips[name]
    let ratio = b.combo ? semitoneRatio(comboSemitones(comboIndex, combo)) : 1
    if (b.combo) comboIndex++
    let peak = b.gain

    const t0 = ctx.currentTime
    const sp = b.speed
    if (sp !== undefined && stepMs !== undefined) {
      const idx = tickIndex++
      if (!tickAudible(stepMs, idx, sp)) return
      if ((t0 - lastTickAt) * 1000 < sp.minGapMs) return
      peak = b.gain * tickGainFactor(stepMs, sp)
      if (!(peak > SILENCE)) return // gain: 0 в конфиге — тик выключен, нода не создаётся
      lastTickAt = t0
      ratio *= tickPitchRatio(idx, sp.jitterCents)
    }
    const attackEnd = t0 + b.attackMs * MS
    const end = attackEnd + b.decayMs * MS

    const osc = ctx.createOscillator()
    osc.type = b.wave
    osc.frequency.setValueAtTime(b.freqFrom * ratio, t0)
    osc.frequency.exponentialRampToValueAtTime(b.freqTo * ratio, t0 + b.sweepMs * MS)

    const env = ctx.createGain()
    env.gain.setValueAtTime(SILENCE, t0)
    env.gain.linearRampToValueAtTime(peak, attackEnd)
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
      tickIndex = 0
    },
  }
}
