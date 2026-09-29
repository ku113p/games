// view/music.ts — фоновая музыка: декодированный буфер + AudioBufferSourceNode с loop.
// Не HTMLAudioElement: у него петля щёлкает на стыке (Safari, Chrome).
// loopStart/loopEnd — на музыкальные такты ВНУТРИ буфера: mp3-паддинг по краям файла
// (Safari его не всегда срезает) в петлю не попадает. Загрузка — холодный путь, async тут допустим.

export interface MusicConfig {
  volume: number
  /** Начало петли, сек от начала буфера (граница такта). До него играет вступление один раз. */
  loopStartSec: number
  /** Конец петли, сек от начала буфера (граница такта). */
  loopEndSec: number
  /** Частота, в которой держим декодированный буфер (совпадает с файлом): RAM = сек × Гц × 4 байта. */
  bufferSampleRate: number
  /** Плавность включения/выключения, мс. */
  fadeMs: number
}

export interface Music {
  /** Загрузить, декодировать и запустить петлю (один раз; повторные вызовы игнорируются). */
  start(): void
  /** Включить/выключить (плавно, через gain; поток продолжает идти, чтобы не терять такт). */
  setOn(on: boolean): void
}

export function createMusic(ctx: AudioContext, destination: AudioNode, url: string, cfg: MusicConfig, initialOn: boolean): Music {
  const gain = ctx.createGain()
  gain.gain.value = initialOn ? cfg.volume : 0
  gain.connect(destination)
  let on = initialOn
  let started = false

  function fade(): void {
    // setTargetAtTime: постоянная времени = fadeMs/3, к концу fadeMs достигает ~95%.
    gain.gain.setTargetAtTime(on ? cfg.volume : 0, ctx.currentTime, cfg.fadeMs / 3000)
  }

  async function load(): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`music: ${url} → HTTP ${res.status}`)
    // Декодируем в отдельном офлайн-контексте на частоте файла: decodeAudioData пересэмплирует в частоту
    // ЕГО контекста, а основной работает на 44.1/48 кГц — буфер был бы вдвое больше по RAM.
    // Воспроизведение через основной контекст пересэмплирует на лету.
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
        console.error('music: не загрузилась', err)
      })
    },
    setOn(v: boolean) {
      on = v
      fade()
    },
  }
}
