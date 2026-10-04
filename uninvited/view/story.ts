// The story card / still-montage player (DESIGN 5): a full-screen still with a slow pan and zoom (Ken Burns), 0-4 lines of text held long
// enough to read (about 170 words a minute), Enter / Space / a click for the next shot, Esc to skip the whole montage. The last shot of a
// scene may wait for a button ("Jack in"). One player runs every real-world scene: the prologue, the room, Jim's notes, the ending.
// It owns no game state: main.ts starts a scene and gets `onDone` back.
import cfgAll from '../config.json'
import texts from '../texts/en.json'
import { renderKeys } from './hud'
import { holdSec } from './may-queue'
import { STORY_ART } from './story-art'
import type { Move, StorySpec, StoryShot } from './story-data'

const C = cfgAll.story

export const STORY_CSS = `
.story { position: fixed; inset: 0; z-index: 200; background: #000; pointer-events: auto; cursor: pointer; overflow: hidden; opacity: 0; transition: opacity ${C.fadeInSec}s; }
.story.on { opacity: 1; }
.story-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity ${C.crossfadeSec}s; will-change: transform; }
.story-img.on { opacity: 1; }
.story-shade { position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(0deg, rgba(0, 4, 8, 0.88) 0%, rgba(0, 4, 8, 0.55) 22%, rgba(0, 4, 8, 0) 46%), radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.55)); }
.story-text { position: absolute; left: 50%; bottom: 11vh; transform: translateX(-50%); width: min(78vw, 1100px); text-align: center; pointer-events: none;
  font-size: clamp(20px, 3vh, 40px); line-height: 1.4; transition: opacity 0.3s; }
.story-text.off { opacity: 0; }
.story-text p { margin: 0.25em 0; text-shadow: 0 2px 10px #000, 0 0 3px #000; }
.story-text p.narr { font-style: italic; color: #cfeaf0; }
.story-text.doc { bottom: 50%; transform: translate(-50%, 50%); text-align: left; padding: 1.2em 1.6em; background: rgba(0, 10, 16, 0.9); border: 1px solid var(--cyan);
  border-top: 0.25em solid var(--amber); box-shadow: 0 0 40px rgba(111, 244, 255, 0.25); width: min(60vw, 820px); }
.story-text.doc p:first-child { letter-spacing: 0.3em; color: var(--amber); font-weight: 700; }
.story-hint { position: absolute; right: 2.2vw; bottom: 2.4vh; font-size: clamp(12px, 1.6vh, 18px); color: rgba(220, 245, 255, 0.7); pointer-events: none; }
.story-hint kbd { font-size: 0.95em; }
.story-ticks { position: absolute; left: 2.2vw; right: 2.2vw; top: 2vh; display: flex; gap: 6px; pointer-events: none; }
.story-ticks i { flex: 1; height: 3px; background: rgba(255, 255, 255, 0.18); }
.story-ticks i.done { background: rgba(111, 244, 255, 0.8); }
.story-btn { position: absolute; left: 50%; bottom: 3.5vh; transform: translateX(-50%); font-size: clamp(16px, 2.4vh, 30px); padding: 0.45em 1.6em; margin: 0; opacity: 0; pointer-events: none; transition: opacity 0.4s; }
.story-btn.on { opacity: 1; pointer-events: auto; }
`

export interface Story {
  /** Runs a scene; onDone(skipped) once it ends (the last button, the end of the montage, or Esc). */
  play(spec: StorySpec, onDone: (skipped: boolean) => void): void
  /** Real seconds, every frame while a scene plays. */
  update(dt: number): void
  readonly active: boolean
  /** Stops at once, without calling onDone. */
  hide(): void
}

function textOf(key: string): string {
  return (texts as Record<string, unknown>)[key] as string
}

/** How long a shot stays: the reading time of its lines (170 words a minute), at least its own minimum. */
export function shotSec(shot: StoryShot): number {
  const words = shot.lines.map(textOf).join(' ')
  const read = shot.lines.length > 0 ? holdSec(words, C.perWordSec, C.baseSec) : 0
  return Math.max(shot.minSec ?? C.minShotSec, read)
}

/** The transform at the start and the end of a shot's move. */
export function moveTransforms(move: Move, zoom: number): [string, string] {
  const z = 1 + zoom
  switch (move) {
    case 'in':
      return ['scale(1)', `scale(${z})`]
    case 'out':
      return [`scale(${z})`, 'scale(1)']
    case 'left':
      return [`scale(${z}) translateX(${zoom * 30}%)`, `scale(${z}) translateX(${-zoom * 30}%)`]
    case 'right':
      return [`scale(${z}) translateX(${-zoom * 30}%)`, `scale(${z}) translateX(${zoom * 30}%)`]
    case 'down':
      return [`scale(${z}) translateY(${zoom * 30}%)`, `scale(${z}) translateY(${-zoom * 30}%)`]
    default:
      return ['scale(1)', 'scale(1)']
  }
}

export function createStory(parent: HTMLElement): Story {
  const css = document.createElement('style')
  css.textContent = STORY_CSS
  document.head.appendChild(css)
  const root = document.createElement('div')
  root.className = 'story'
  root.style.display = 'none'
  const imgs = [document.createElement('img'), document.createElement('img')] as const
  for (const i of imgs) {
    i.className = 'story-img'
    i.alt = ''
    i.draggable = false
    root.appendChild(i)
  }
  const shade = Object.assign(document.createElement('div'), { className: 'story-shade' })
  const ticks = Object.assign(document.createElement('div'), { className: 'story-ticks' })
  const text = Object.assign(document.createElement('div'), { className: 'story-text' })
  const hint = Object.assign(document.createElement('div'), { className: 'story-hint' })
  const btn = Object.assign(document.createElement('button'), { className: 'btn story-btn' })
  root.append(shade, ticks, text, hint, btn)
  parent.appendChild(root)

  let spec: StorySpec | null = null
  let done: ((skipped: boolean) => void) | null = null
  let idx = 0
  let t = 0
  let hold = 0
  let front = 0
  let anim: Animation | null = null
  let ended = false

  const preload = (name: string | undefined): void => {
    const url = name ? STORY_ART[name] : undefined
    if (url) new Image().src = url
  }

  function lastShot(): boolean {
    return spec !== null && idx >= spec.shots.length - 1
  }

  function showShot(): void {
    if (!spec) return
    const shot = spec.shots[idx] as StoryShot
    const url = STORY_ART[shot.art]
    const prev = imgs[front] as HTMLImageElement
    front = 1 - front
    const img = imgs[front] as HTMLImageElement
    if (url && img.src !== url) img.src = url
    anim?.cancel()
    const [from, to] = moveTransforms(shot.move ?? 'still', shot.zoom ?? C.panZoom)
    hold = shotSec(shot)
    img.style.transformOrigin = shot.origin ?? '50% 50%'
    anim = img.animate([{ transform: from }, { transform: to }], { duration: (hold + C.crossfadeSec) * 1000, fill: 'forwards', easing: 'linear' })
    img.classList.add('on')
    prev.classList.remove('on')
    // the text: fades out, swaps, fades in
    text.classList.add('off')
    window.setTimeout(() => {
      if (!spec || ended) return
      text.replaceChildren()
      text.classList.toggle('doc', shot.doc === true)
      for (const key of shot.lines) {
        const p = document.createElement('p')
        let s = textOf(key)
        if (/^\*.*\*$/.test(s)) {
          s = s.slice(1, -1)
          p.className = 'narr'
        }
        p.textContent = s
        text.appendChild(p)
      }
      text.classList.toggle('off', shot.lines.length === 0)
    }, 300)
    // the ticks and the controls
    ticks.replaceChildren()
    for (let i = 0; i < spec.shots.length; i++) ticks.appendChild(Object.assign(document.createElement('i'), { className: i <= idx ? 'done' : '' }))
    const waits = lastShot() && spec.button !== undefined
    btn.classList.toggle('on', waits)
    if (waits && spec.button) btn.textContent = textOf(spec.button)
    renderKeys(hint, textOf(waits ? 'story.hintLast' : 'story.hint'))
    preload(spec.shots[idx + 1]?.art)
    t = 0
  }

  function finish(skipped: boolean): void {
    if (ended) return
    ended = true
    document.removeEventListener('keydown', onKey, true)
    const cb = done
    done = null
    spec = null
    // fade to black, then gone; the next scene starts under the fade
    root.classList.remove('on')
    window.setTimeout(() => {
      if (!spec) root.style.display = 'none'
    }, C.fadeInSec * 1000)
    cb?.(skipped)
  }

  function next(): void {
    if (!spec || ended || t < C.clickGuardSec) return
    if (lastShot()) {
      finish(false)
      return
    }
    idx++
    showShot()
  }

  function skip(): void {
    if (!spec || ended) return
    // a scene that waits for its button jumps to the last shot; a plain montage ends
    if (spec.button !== undefined && !lastShot()) {
      idx = spec.shots.length - 1
      showShot()
    } else finish(true)
  }

  function onKey(e: KeyboardEvent): void {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      if (!e.repeat) next()
    } else if (e.code === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      skip()
    }
  }

  root.addEventListener('click', (e) => {
    e.stopPropagation()
    if (e.target === btn) {
      if (lastShot()) finish(false)
      return
    }
    next()
  })

  return {
    get active(): boolean {
      return spec !== null
    },
    play(s, onDone): void {
      spec = s
      done = onDone
      ended = false
      idx = 0
      root.style.display = 'block'
      void root.offsetWidth
      root.classList.add('on')
      document.addEventListener('keydown', onKey, true)
      showShot()
    },
    update(dt): void {
      if (!spec || ended) return
      t += dt
      // a scene with a button waits on its last shot; the others move on by themselves
      if (t >= hold && !(lastShot() && spec.button !== undefined)) {
        if (lastShot()) finish(false)
        else {
          idx++
          showShot()
        }
      }
    },
    hide(): void {
      spec = null
      done = null
      ended = true
      anim?.cancel()
      document.removeEventListener('keydown', onKey, true)
      root.classList.remove('on')
      root.style.display = 'none'
    },
  }
}
