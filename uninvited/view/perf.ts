// The F3 frame-rate overlay (off by default): frames per second, the average and the worst frame time of the last
// second, and how much of it the game's own JavaScript took (the rest is the GPU and the browser). For telling us
// what a player's machine really does.

export interface PerfOverlay {
  /** Call once per rendered frame with the JavaScript time of that frame, ms. */
  frame(cpuMs: number): void
}

const WINDOW_SEC = 1

export function createPerfOverlay(root: HTMLElement): PerfOverlay {
  const box = document.createElement('div')
  box.style.cssText =
    'position:absolute;left:8px;top:8px;padding:4px 8px;font:12px/1.4 monospace;color:#9fefff;background:rgba(0,8,12,0.7);' +
    'border:1px solid rgba(120,220,255,0.3);pointer-events:none;white-space:pre;display:none;z-index:50'
  root.appendChild(box)
  let on = false
  let last = performance.now()
  let acc = 0
  let frames = 0
  let worst = 0
  let cpu = 0
  addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code !== 'F3' || e.repeat) return
    e.preventDefault() // F3 is the browser's find
    on = !on
    box.style.display = on ? 'block' : 'none'
  })
  return {
    frame(cpuMs: number): void {
      const now = performance.now()
      const ms = now - last
      last = now
      if (!on) return
      acc += ms
      frames++
      cpu += cpuMs
      if (ms > worst) worst = ms
      if (acc < WINDOW_SEC * 1000) return
      const avg = acc / frames
      box.textContent = `${(1000 / avg).toFixed(0)} fps   ${avg.toFixed(1)} ms avg   ${worst.toFixed(1)} ms worst\njs ${(cpu / frames).toFixed(1)} ms   (F3 hides)`
      acc = 0
      frames = 0
      worst = 0
      cpu = 0
    },
  }
}
