// Отладочная панель производительности. По умолчанию выключена и не создаётся вообще
// (ни DOM, ни слушателей, ни счёта в кадре): main.ts держит null, пока её не включили.
// Включение: клавиша ` (Backquote) на ПК или параметр адреса ?perf на телефоне.
//
// Показывает: FPS (сглаженный и худший за 1-2 с), время кадра, JS-время кадра, вызовы отрисовки/треугольники,
// размер буфера (пиксели и МПикс), devicePixelRatio и применённый множитель, размер арены, длину змейки,
// состояние тяжёлых эффектов. Переключатели: сглаживание 4/2/0, bloom, потолок МПикс, туман, мини-карта.
//
// Сама панель не должна искажать измерение: в кадре только арифметика над заранее выделенными
// числами (beginFrame/endFrame), текст пишется ~4 раза в секунду одной записью textContent,
// подписи кнопок — только при смене значения.

import type { BenchRun } from './perf-bench'
import { AA_PRESETS, MEGAPIXEL_STEPS, createPerfSnapshot, currentAaPreset, perf, setAaPreset, type PerfSnapshot } from './perf-settings'

/** Период обновления текста, мс (4-5 раз в секунду). */
const REFRESH_MS = 220
/** Окно «худшего кадра»: макс за текущее окно и прошлое окно = последние 1-2 с. */
const WORST_WINDOW_MS = 1000
/** Вес нового значения в сглаженном FPS. */
const FPS_SMOOTHING = 0.4
/** Кадры длиннее этого считаем подвисанием и подсвечиваем худший FPS. */
const HITCH_MS = 33.4

export interface PerfPanel {
  /** Начало rAF-кадра. now — метка requestAnimationFrame. */
  beginFrame(now: number): void
  /** Конец работы кадра (после tick+render); jsMs — длительность этой работы. Сэмплирует раз в REFRESH_MS. */
  endFrame(jsMs: number): void
  toggle(): void
  /** Панель видна только в живой партии (на меню/экране смерти она перекрыла бы кнопки): main сообщает, идёт ли партия. */
  setShown(inGame: boolean): void
  /** Открыть панель (если закрыта). */
  open(): void
  isOpen(): boolean
  /** Прогон бенчмарка идёт (run != null) или закончился (null): блокирует переключатели, показывает прогресс. */
  setBench(run: BenchRun | null): void
  /** Настройки perf поменялись снаружи (ступень качества из меню): перерисовать подписи кнопок. */
  refresh(): void
  /** Показать готовый лог с кнопками «Скопировать»/«Скачать». */
  showResult(text: string): void
}

export interface PerfPanelHooks {
  /** Заполнить снимок (рендер-инфо, арена, длина). Вызывается ~4 раза в секунду. */
  sample(out: PerfSnapshot): void
  /** Настройки (perf) изменились: применить сразу (пересоздать композер/буферы). */
  apply(): void
  /** Запустить бенчмарк (кнопка «Bench», клавиша 6). */
  startBench(): void
  /** Закрыть окно с логом. */
  resultClosed(): void
}

const CSS = `
#perf-panel{position:fixed;left:max(6px,env(safe-area-inset-left));top:60px;z-index:20;width:214px;box-sizing:border-box;
padding:5px 6px;background:rgba(5,6,10,.72);border:1px solid rgba(57,255,224,.45);border-radius:6px;color:#9ff;
font:10.5px/1.3 ui-monospace,"SF Mono",Menlo,Consolas,monospace;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:manipulation}
#perf-panel.hidden{display:none}
#perf-panel pre{margin:0;font:inherit;white-space:pre;color:inherit}
#perf-panel .row{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}
#perf-panel button{font:inherit;color:#9ff;background:rgba(57,255,224,.10);border:1px solid rgba(57,255,224,.5);border-radius:4px;
padding:3px 5px;min-height:24px;cursor:pointer;touch-action:manipulation}
#perf-panel button.off{color:#f88;border-color:rgba(255,120,120,.6);background:rgba(255,80,80,.10)}
#perf-panel button:active{background:rgba(57,255,224,.35)}
#perf-bench{position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:21;padding:8px 12px;max-width:92vw;text-align:center;
background:rgba(5,6,10,.85);border:1px solid #ff0;border-radius:8px;color:#ff0;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;pointer-events:none}
#perf-bench.hidden{display:none}
#perf-result{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;background:rgba(5,6,10,.96);color:#9ff;font:13px ui-monospace,Menlo,Consolas,monospace}
#perf-result.hidden{display:none}
#perf-result textarea{flex:1;min-height:0;width:100%;box-sizing:border-box;background:#000;color:#9ff;border:1px solid rgba(57,255,224,.5);font:11px/1.3 ui-monospace,Menlo,Consolas,monospace;white-space:pre;overflow:auto;resize:none}
#perf-result .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#perf-result button{font:inherit;color:#9ff;background:rgba(57,255,224,.12);border:1px solid rgba(57,255,224,.6);border-radius:6px;padding:10px 16px;min-height:44px}
#perf-panel .hint{opacity:.55;margin-top:3px}
`

export function createPerfPanel(hooks: PerfPanelHooks): PerfPanel {
  // --- DOM (холодный путь, один раз) ---
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  const root = document.createElement('div')
  root.id = 'perf-panel'
  root.className = 'hidden'
  const text = document.createElement('pre')
  text.textContent = '...'
  const row = document.createElement('div')
  row.className = 'row'
  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.textContent = '` hide  1-5 toggles  6 bench'
  const btnMsaa = makeButton('AA')
  const btnBloom = makeButton('Bloom')
  const btnCap = makeButton('Cap')
  const btnFog = makeButton('Fog')
  const btnMap = makeButton('Map')
  const btnBench = makeButton('Run bench (6)')
  row.append(btnMsaa, btnBloom, btnCap, btnFog, btnMap, btnBench)
  root.append(text, row, hint)
  document.body.appendChild(root)

  // Баннер прогресса бенчмарка (по центру сверху) и окно с готовым логом.
  const banner = document.createElement('div')
  banner.id = 'perf-bench'
  banner.className = 'hidden'
  document.body.appendChild(banner)
  const result = document.createElement('div')
  result.id = 'perf-result'
  result.className = 'hidden'
  const resultTitle = document.createElement('div')
  resultTitle.textContent = 'Benchmark finished. Press Copy and send the text (or Save file).'
  const area = document.createElement('textarea')
  area.readOnly = true
  area.spellcheck = false
  const bar = document.createElement('div')
  bar.className = 'bar'
  const btnCopy = makeButton('Copy')
  const btnSave = makeButton('Save file')
  const btnClose = makeButton('Close')
  const copyState = document.createElement('span')
  bar.append(btnCopy, btnSave, btnClose, copyState)
  result.append(resultTitle, area, bar)
  document.body.appendChild(result)
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) {
    result.addEventListener(type, (e) => e.stopPropagation())
  }
  // Касания панели не должны доходить до игры (тапы по холсту = команды).
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'contextmenu']) {
    root.addEventListener(type, (e) => e.stopPropagation())
  }

  function makeButton(label: string): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.tabIndex = -1
    b.textContent = label
    return b
  }

  // --- переключатели ---
  function stepAfter(steps: readonly number[], v: number): number {
    const i = steps.indexOf(v)
    return steps[(i + 1) % steps.length]!
  }
  function capLabel(mp: number): string {
    return mp > 0 ? String(mp) : 'none'
  }
  function aaName(): string {
    return currentAaPreset()?.label ?? `custom(${perf.msaa}${perf.aaByte ? ' 8bit' : ''}${perf.smaa ? ' smaa' : ''})`
  }
  function bloomLabel(): string {
    return perf.bloom ? (perf.bloomScale < 1 ? 'half' : 'on') : 'off'
  }
  function refreshButtons(): void {
    btnMsaa.textContent = `AA ${aaName()}`
    btnMsaa.classList.toggle('off', perf.msaa === 0 && !perf.smaa)
    btnBloom.textContent = `Bloom ${bloomLabel()}`
    btnBloom.classList.toggle('off', !perf.bloom)
    btnCap.textContent = `Cap ${capLabel(perf.megapixelCap)}`
    btnCap.classList.toggle('off', perf.megapixelCap > 0)
    btnFog.textContent = `Fog ${perf.fog ? 'on' : 'off'}`
    btnFog.classList.toggle('off', !perf.fog)
    btnMap.textContent = `Map ${perf.miniMap ? 'on' : 'off'}`
    btnMap.classList.toggle('off', !perf.miniMap)
  }
  function changed(): void {
    if (benchRun !== null && benchRun.running) return
    refreshButtons()
    hooks.apply()
    // Показатели после смены: пусть худший кадр не тащит старую картину.
    resetStats()
    nextRefresh = 0
  }
  function toggleMsaa(): void {
    const i = AA_PRESETS.indexOf(currentAaPreset() ?? AA_PRESETS[AA_PRESETS.length - 1]!)
    setAaPreset(AA_PRESETS[(i + 1) % AA_PRESETS.length]!)
    changed()
  }
  function toggleBloom(): void {
    perf.bloom = !perf.bloom
    changed()
  }
  function toggleCap(): void {
    perf.megapixelCap = stepAfter(MEGAPIXEL_STEPS, perf.megapixelCap)
    changed()
  }
  function toggleFog(): void {
    perf.fog = !perf.fog
    changed()
  }
  function toggleMap(): void {
    perf.miniMap = !perf.miniMap
    changed()
  }
  const actions: Record<string, () => void> = { Digit1: toggleMsaa, Digit2: toggleBloom, Digit3: toggleCap, Digit4: toggleFog, Digit5: toggleMap }
  function startBench(): void {
    if (benchRun !== null && benchRun.running) return
    hooks.startBench()
  }
  actions['Digit6'] = startBench
  const wire: [HTMLButtonElement, () => void][] = [
    [btnBench, startBench],
    [btnMsaa, toggleMsaa],
    [btnBloom, toggleBloom],
    [btnCap, toggleCap],
    [btnFog, toggleFog],
    [btnMap, toggleMap],
  ]
  for (const [b, fn] of wire) {
    b.addEventListener('click', () => {
      fn()
      b.blur() // иначе Space (ускорение) нажимал бы сфокусированную кнопку
    })
  }
  function copyText(text: string): boolean {
    // Асинхронный API — только в безопасном контексте; запасной путь — выделение и execCommand.
    if (navigator.clipboard !== undefined && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => (copyState.textContent = 'copied'),
        () => (copyState.textContent = legacyCopy() ? 'copied' : 'copy failed: select the text and copy by hand'),
      )
      return true
    }
    const ok = legacyCopy()
    copyState.textContent = ok ? 'copied' : 'copy failed: select the text and copy by hand'
    return ok
  }
  function legacyCopy(): boolean {
    area.focus()
    area.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    }
  }
  btnCopy.addEventListener('click', () => copyText(area.value))
  btnSave.addEventListener('click', () => {
    const blob = new Blob([area.value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snake-bench-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    copyState.textContent = 'saved'
  })
  btnClose.addEventListener('click', () => {
    result.classList.add('hidden')
    hooks.resultClosed()
  })

  window.addEventListener('keydown', (e) => {
    if (!open || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    const fn = actions[e.code]
    if (fn === undefined) return
    const tg = e.target as HTMLElement | null
    if (tg !== null && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return
    fn()
  })

  // --- счётчики (всё в замыкании, заранее выделено) ---
  const snap = createPerfSnapshot()
  let open = false
  let benchRun: BenchRun | null = null
  let lastNow = 0
  // Интервал обновления
  let nextRefresh = 0
  let accFrames = 0
  let accMs = 0
  let accJsMs = 0
  let accMaxMs = 0
  let smoothFps = 0
  // Худший кадр: макс за текущее и прошлое окно.
  let winStart = 0
  let winMax = 0
  let prevWinMax = 0
  let lastTop = -1

  function resetStats(): void {
    accFrames = 0
    accMs = 0
    accJsMs = 0
    accMaxMs = 0
    smoothFps = 0
    winMax = 0
    prevWinMax = 0
    lastNow = 0
  }

  function pad(n: number, width: number, digits: number): string {
    return n.toFixed(digits).padStart(width, ' ')
  }

  function writeText(worstMs: number, avgMs: number, jsMs: number): void {
    const bw = snap.bufferW
    const bh = snap.bufferH
    const mp = (bw * bh) / 1e6
    const worstFps = worstMs > 0 ? 1000 / worstMs : 0
    text.textContent =
      `FPS ${pad(smoothFps, 5, 1)}  worst ${pad(worstFps, 5, 1)}${worstMs > HITCH_MS ? '!' : ' '}\n` +
      `frame ${pad(avgMs, 5, 1)} ms  max ${pad(worstMs, 5, 1)}\n` +
      `js    ${pad(jsMs, 5, 1)} ms (cpu)\n` +
      `draws ${snap.drawCalls}  tris ${snap.triangles}\n` +
      `buf ${bw}x${bh}  ${mp.toFixed(2)} MP\n` +
      `pixel ratio ${snap.pixelRatio.toFixed(2)} (device ${snap.devicePixelRatio.toFixed(2)})\n` +
      `arena ${snap.arena}^3  snake ${snap.snakeLength}\n` +
      `AA ${aaName()} bloom ${bloomLabel()} cap ${capLabel(perf.megapixelCap)}\n` +
      `fog ${perf.fog ? 'on' : 'off'} map ${perf.miniMap ? 'on' : 'off'}`
  }

  let inGame = false
  function updateVisibility(): void {
    root.classList.toggle('hidden', !(open && inGame))
  }

  function setOpen(on: boolean): void {
    if (on === open) return
    open = on
    perf.statsOn = on
    updateVisibility()
    if (on) {
      refreshButtons()
      resetStats()
      nextRefresh = 0
    }
    hooks.apply() // включает/выключает ручной сброс renderer.info
  }

  return {
    beginFrame(now: number): void {
      if (!open) return
      if (lastNow === 0) {
        lastNow = now
        return
      }
      const dt = now - lastNow
      lastNow = now
      accFrames++
      accMs += dt
      if (dt > accMaxMs) accMaxMs = dt
      if (now - winStart >= WORST_WINDOW_MS) {
        winStart = now
        prevWinMax = winMax
        winMax = 0
      }
      if (dt > winMax) winMax = dt
    },
    endFrame(jsMs: number): void {
      if (!open) return
      accJsMs += jsMs
      const t = lastNow
      if (t < nextRefresh || accFrames === 0) return
      nextRefresh = t + REFRESH_MS
      const avgMs = accMs / accFrames
      const inst = 1000 / avgMs
      smoothFps = smoothFps === 0 ? inst : smoothFps + (inst - smoothFps) * FPS_SMOOTHING
      if (benchRun !== null && benchRun.running) {
        const left = Math.ceil(benchRun.remainingMs(lastNow) / 1000)
        banner.textContent = `BENCHMARK ${benchRun.stageNumber}/${benchRun.stageCount}: ${benchRun.stageLabel}${benchRun.measuring ? '' : ' (warming up)'}\n~${left} s left. Do not touch anything, the game is frozen on purpose.`
        banner.style.whiteSpace = 'pre-line'
      }
      hooks.sample(snap)
      const worst = winMax > prevWinMax ? winMax : prevWinMax
      writeText(worst, avgMs, accJsMs / accFrames)
      const top = Math.round(snap.miniMapBottomPx + 6)
      if (top !== lastTop && top > 0) {
        lastTop = top
        root.style.top = `${top}px`
      }
      accFrames = 0
      accMs = 0
      accJsMs = 0
      accMaxMs = 0
    },
    toggle(): void {
      setOpen(!open)
    },
    refresh(): void {
      refreshButtons()
    },
    setShown(v: boolean): void {
      if (v === inGame) return
      inGame = v
      updateVisibility()
    },
    open(): void {
      setOpen(true)
    },
    setBench(run: BenchRun | null): void {
      benchRun = run
      const on = run !== null && run.running
      banner.classList.toggle('hidden', !on)
      if (on) banner.textContent = 'BENCHMARK starting...'
      btnBench.disabled = on
      for (const b of [btnMsaa, btnBloom, btnCap, btnFog, btnMap]) b.disabled = on
      refreshButtons()
    },
    showResult(textToShow: string): void {
      area.value = textToShow
      copyState.textContent = ''
      result.classList.remove('hidden')
      area.scrollTop = 0
    },
    isOpen(): boolean {
      return open
    },
  }
}
