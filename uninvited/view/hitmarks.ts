// The shooting confirmation on the crosshair (DESIGN 9 and 12, "as built"): a short white tick-cross on a hit, a bigger red X with a
// ring on a kill, steel-blue brackets when the heavy's shield stops a bolt, and the crosshair's bloom after each shot (the crosshair
// elements swell and settle). Nothing here allocates per frame; the HUD only mounts it (view/hud.ts) and the game view feeds it.
import cfgAll from '../config.json'

const B = cfgAll.view.juice.bloom

export interface HitMarks {
  /** A rifle or blade hit that did not kill. */
  hit(): void
  /** A kill: one distinct marker for every enemy. */
  kill(): void
  /** A bolt stopped by a heavy warden's shield. */
  block(): void
  /** A shot was fired: the crosshair blooms. */
  shot(): void
  /** Settings "reduce shake/flash": no pop and no bloom, the markers just show and fade. */
  setReduced(on: boolean): void
  update(dt: number): void
}

const CSS = `
.hm { position: absolute; left: 50%; top: 50%; width: 80px; height: 80px; margin: -40px 0 0 -40px; pointer-events: none; opacity: 0; }
.hm svg { width: 100%; height: 100%; overflow: visible; }
.hm line, .hm circle, .hm path { fill: none; stroke-linecap: square; }
.hm.hit line { stroke: #f4fcff; stroke-width: 2.2; filter: drop-shadow(0 0 4px #6ff4ff); }
.hm.kill line { stroke: #ff4656; stroke-width: 3.2; filter: drop-shadow(0 0 6px #ff1d2e); }
.hm.kill circle { stroke: #ff7a86; stroke-width: 1.5; filter: drop-shadow(0 0 5px #ff1d2e); }
.hm.block path { stroke: #8cc4ff; stroke-width: 3; filter: drop-shadow(0 0 6px #4a9cff); }
`

const SVG = 'http://www.w3.org/2000/svg'

function svgNode(tag: string, attrs: Record<string, string>, parent: Element): SVGElement {
  const e = document.createElementNS(SVG, tag) as SVGElement
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  parent.appendChild(e)
  return e
}

/** Four diagonal ticks around the centre, from radius r0 to r1. */
function ticks(svg: Element, r0: number, r1: number): void {
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const k = Math.SQRT1_2
    svgNode('line', { x1: String(sx * r0 * k), y1: String(sy * r0 * k), x2: String(sx * r1 * k), y2: String(sy * r1 * k) }, svg)
  }
}

export function createHitMarks(hud: HTMLElement, bloomTargets: readonly HTMLElement[]): HitMarks {
  const css = document.createElement('style')
  css.textContent = CSS
  document.head.appendChild(css)
  const make = (cls: string, draw: (svg: Element) => void): HTMLElement => {
    const d = document.createElement('div')
    d.className = `hm ${cls}`
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('viewBox', '-40 -40 80 80')
    d.appendChild(svg)
    draw(svg)
    hud.appendChild(d)
    return d
  }
  const hitEl = make('hit', (s) => ticks(s, 8, 15))
  const killEl = make('kill', (s) => {
    ticks(s, 10, 26)
    svgNode('circle', { cx: '0', cy: '0', r: '16' }, s)
  })
  const blockEl = make('block', (s) => {
    svgNode('path', { d: 'M -10 -15 L -17 -15 L -17 15 L -10 15' }, s)
    svgNode('path', { d: 'M 10 -15 L 17 -15 L 17 15 L 10 15' }, s)
  })
  const HIT_SEC = 0.14
  const KILL_SEC = 0.34
  const BLOCK_SEC = 0.24
  let hitT = 0
  let killT = 0
  let blockT = 0
  let bloom = 0
  let reduced = false
  let lastBloom = -1

  return {
    hit(): void {
      hitT = HIT_SEC
    },
    kill(): void {
      killT = KILL_SEC
      hitT = 0
    },
    block(): void {
      blockT = BLOCK_SEC
    },
    shot(): void {
      if (!reduced) bloom = Math.min(B.max, bloom + B.perShot)
    },
    setReduced(on: boolean): void {
      reduced = on
      if (on) bloom = 0
    },
    update(dt: number): void {
      hitT = Math.max(0, hitT - dt)
      killT = Math.max(0, killT - dt)
      blockT = Math.max(0, blockT - dt)
      const pop = (t: number, sec: number, from: number): number => (reduced ? 1 : 1 + (from - 1) * Math.min(1, t / sec) ** 2)
      hitEl.style.opacity = hitT > 0 ? String(Math.min(1, (hitT / HIT_SEC) * 1.6)) : '0'
      if (hitT > 0) hitEl.style.transform = `scale(${pop(hitT, HIT_SEC, 1.35)})`
      killEl.style.opacity = killT > 0 ? String(Math.min(1, (killT / KILL_SEC) * 1.8)) : '0'
      if (killT > 0) killEl.style.transform = `scale(${pop(killT, KILL_SEC, 1.6)})`
      blockEl.style.opacity = blockT > 0 ? String(Math.min(1, (blockT / BLOCK_SEC) * 1.8)) : '0'
      if (blockT > 0) blockEl.style.transform = `scale(${pop(blockT, BLOCK_SEC, 1.3)})`
      bloom *= Math.exp(-dt * B.decayRate)
      if (bloom < 0.01) bloom = 0
      if (bloom !== lastBloom) {
        lastBloom = bloom
        const tf = bloom > 0 ? `scale(${(1 + bloom * B.scale).toFixed(3)})` : ''
        for (const el of bloomTargets) el.style.transform = tf
      }
    },
  }
}
