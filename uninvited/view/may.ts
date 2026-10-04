// May, the AI assistant (DESIGN 10, 13): her subtitles, her beep voice, her glyph over the hero's wrist display, and the meeting at T0.
//  - The lines come from view/may-triggers.ts (events) and the in-view watch below (the first camera and warden in sight), go through the
//    queue in view/may-queue.ts (one at a time, priorities, once per level / save) and show in a subtitle box of their own (so a tutorial
//    prompt and a May line can be on screen together: she speaks first, the prompt is the practical "how").
//  - While a line shows, a beep per syllable plays (sound `voice_may`, pitch jittered), the music ducks (music flags.dialogue) and a small
//    glitchy face / waveform sprite flickers over the wrist display. Before the meeting she is absent: no label, no glyph, no lines.
//  - The meeting beat: main.ts freezes the sim, calls beginMeeting(), a glitch runs over the screen and the wrist, her three lines play,
//    then meetingActive() turns false and the game goes on. Enter or a click skips it once the first line has been read.
// Nothing here can block the core: it only reads the state and the events.
import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial, Vector3, type Scene } from 'three'
import type { GameEvent } from '../core/events'
import { mayMet, videoCameras, wardens } from '../core/queries'
import type { GameState } from '../core/state'
import type { SettingsHandle } from './settings'
import { createMayQueue, holdSec, MAY_CFG, voiceBeeps, type Beep, type MayLine, type MayQueue, type QueueMode, type QueueStore } from './may-queue'
import { createMayTriggers, meetingLines, MEETING_PREFIX, type MayTriggers } from './may-triggers'
import type { HeroView } from './hero'
import type { Sound } from './audio'
import { renderKeys, t } from './hud'

const C = MAY_CFG

export interface MayView {
  /** Events of one frame. */
  handle(events: readonly GameEvent[], s: GameState): void
  /** Every frame, real seconds (also while the sim is frozen); `yaw` is the camera's. */
  update(rawDt: number, s: GameState, yaw: number): void
  /** What the queue may do now: main.ts sets it every frame ('blocked' in a hack, a menu, a card; 'end' on the end screens). */
  mode: QueueMode
  /** A line is on screen: the music ducks. */
  speaking(): boolean
  /** The T0 hack just made her appear and the meeting has not been played yet; reading it clears it. */
  takeMeeting(): boolean
  /** Starts the meeting beat (the caller keeps the sim frozen until meetingActive() is false). */
  beginMeeting(): void
  meetingActive(): boolean
  /** Enter / a click: ends the meeting early (only after its first line has been read). True when it did. */
  skipMeeting(): boolean
  /** A watcher passed close by and did not notice the player (the first time she says so). */
  unseen(): void
  /** The level end is waiting for the "Jim's notes" line to finish. */
  holdingEnd(): boolean
  /** After a load: the old moment is gone (queued lines drop, the death line stays). */
  reset(): void
  /** The level starts over (restart, play again): the once-per-level and once-per-save lines and the death count start over. */
  restart(): void
  /** Adds a line (tests and debugging). */
  say(line: MayLine): void
  /** The queue (debugging, tests). */
  readonly queue: MayQueue
  setScale(pct: number): void
  setReduced(on: boolean): void
}

const CSS = `
.may-sub { position: static; order: 1; display: none; box-sizing: border-box; width: max-content; max-width: min(calc(44vw / var(--zoom, 1)), 26em);
  text-align: center; font-size: clamp(20px, 2.8vh, 36px); line-height: 1.35; padding: 0.35em 0.9em; color: var(--white); letter-spacing: 0.02em;
  background: rgba(0, 8, 14, 0.9); border: 1px solid rgba(111, 244, 255, 0.55); border-left: 0.2em solid var(--cyan); box-shadow: 0 0 22px rgba(0, 0, 0, 0.7), 0 0 16px rgba(111, 244, 255, 0.18);
  pointer-events: none; }
.may-sub.on { display: block; animation: may-in 0.18s ease-out 1; }
@keyframes may-in { from { opacity: 0; } to { opacity: 1; } }
.may-skip { order: 2; display: none; font-size: clamp(14px, 2vh, 26px); color: rgba(220, 245, 255, 0.85); text-shadow: 0 1px 6px #000; }
.may-skip.on { display: block; }
.may-sub .who { display: inline-block; margin-right: 0.8em; padding: 0 0.5em; font-size: 0.7em; font-weight: 700; letter-spacing: 0.2em; color: #04141a; background: var(--cyan); vertical-align: 0.1em; }
.may-glitch { position: absolute; inset: 0; z-index: 45; pointer-events: none; opacity: 0; overflow: hidden; mix-blend-mode: screen;
  background: repeating-linear-gradient(0deg, rgba(111, 244, 255, 0) 0 3px, rgba(111, 244, 255, 0.2) 3px 4px), linear-gradient(90deg, rgba(255, 40, 120, 0.14), rgba(40, 255, 240, 0.14)); }
.may-glitch.on { animation: may-glitch var(--may-glitch-sec, 0.7s) steps(3, end) 1; }
.may-glitch.on.soft { animation: may-glitch-soft var(--may-glitch-sec, 0.7s) linear 1; }
.may-glitch i { position: absolute; left: 0; right: 0; height: 7%; background: rgba(160, 255, 255, 0.5); animation: may-bar 0.22s steps(2, end) infinite; }
.may-glitch.soft i { display: none; }
@keyframes may-glitch { 0% { opacity: 0; transform: translateX(0); } 10% { opacity: 0.9; transform: translateX(-2%) skewX(3deg); } 25% { opacity: 0.4; transform: translateX(3%); }
  40% { opacity: 1; transform: translateX(-1%) scaleY(1.02); } 60% { opacity: 0.5; transform: translateX(2%) skewX(-4deg); } 80% { opacity: 0.8; transform: none; } 100% { opacity: 0; } }
@keyframes may-glitch-soft { 0% { opacity: 0; } 30% { opacity: 0.35; } 100% { opacity: 0; } }
@keyframes may-bar { 0% { transform: translateX(-6%); } 50% { transform: translateX(8%) scaleY(0.5); } 100% { transform: translateX(-3%); } }
`

export function createMay(
  uiRoot: HTMLElement,
  scene: Scene,
  hero: HeroView,
  sound: Sound,
  store: QueueStore | null,
  settings: SettingsHandle | undefined,
  rand: () => number = Math.random,
  stack: HTMLElement = uiRoot,
): MayView {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const box = document.createElement('div')
  box.className = 'may-sub'
  const who = document.createElement('span')
  who.className = 'who'
  who.textContent = 'MAY'
  const body = document.createElement('span')
  box.append(who, body)
  const glitchEl = document.createElement('div')
  glitchEl.className = 'may-glitch'
  glitchEl.style.setProperty('--may-glitch-sec', `${C.screenGlitchSec}s`)
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement('i')
    bar.style.top = `${Math.round(rand() * 92)}%`
    bar.style.animationDelay = `${(rand() * 0.2).toFixed(2)}s`
    glitchEl.appendChild(bar)
  }
  const skipEl = document.createElement('div')
  skipEl.className = 'may-skip'
  renderKeys(skipEl, t('meeting.skip'))
  stack.append(box, skipEl)
  uiRoot.append(glitchEl)

  // the glyph over the wrist display: a canvas drawn a few times a second while she speaks
  const px = C.glyph.px
  const cv = document.createElement('canvas')
  cv.width = cv.height = px
  const g2 = cv.getContext('2d')
  const tex = new CanvasTexture(cv)
  const mat = new SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: AdditiveBlending, toneMapped: false })
  const glyph = new Sprite(mat)
  glyph.scale.set(C.glyph.size, C.glyph.size, 1)
  glyph.renderOrder = 20
  glyph.visible = false
  scene.add(glyph)
  const wristAt = new Vector3()

  const queue = createMayQueue(store)
  let present = false
  let pendingMeeting = false
  let meeting = false
  let introT = 0
  let screenGlitch = 0
  let shownId = ''
  let beeps: Beep[] = []
  let voiceT = 0
  let nextBeep = 0
  let energy = 0
  let flicker = 0
  let glyphAlpha = 0
  let watchT = 0
  let reduced = false

  const say = (line: MayLine): void => {
    if (present) queue.say(line)
  }
  const triggers: MayTriggers = createMayTriggers(say, C.deathEvery)

  function drawGlyph(t: number): void {
    if (!g2) return
    g2.clearRect(0, 0, px, px)
    const e = Math.min(1, 0.2 + energy)
    g2.strokeStyle = 'rgb(111,244,255)'
    g2.fillStyle = 'rgb(111,244,255)'
    g2.fillStyle = 'rgba(111,244,255,0.14)'
    g2.fillRect(px * 0.1, px * 0.1, px * 0.8, px * 0.8)
    g2.fillStyle = 'rgb(111,244,255)'
    g2.lineWidth = 6
    // a frame with a missing corner, a face (two eyes and a mouth that is a waveform)
    g2.beginPath()
    g2.moveTo(px * 0.1, px * 0.3)
    g2.lineTo(px * 0.1, px * 0.1)
    g2.lineTo(px * 0.9, px * 0.1)
    g2.lineTo(px * 0.9, px * 0.6)
    g2.stroke()
    g2.fillRect(px * 0.28, px * 0.26, px * 0.14, px * 0.05 + px * 0.06 * rand())
    g2.fillRect(px * 0.58, px * 0.26, px * 0.14, px * 0.05 + px * 0.06 * rand())
    g2.beginPath()
    const mid = px * 0.62
    for (let x = 0; x <= px * 0.8; x += 4) {
      const a = Math.sin(x * 0.35 + t * 40) * px * 0.17 * e * (0.4 + rand())
      if (x === 0) g2.moveTo(px * 0.1, mid + a)
      else g2.lineTo(px * 0.1 + x, mid + a)
    }
    g2.stroke()
    // glitch: a couple of horizontal slices shifted sideways, and scanlines
    if (rand() < 0.5 + 0.4 * energy) {
      const y = Math.floor(rand() * px * 0.8)
      const h = 4 + Math.floor(rand() * 14)
      const dx = Math.floor((rand() - 0.5) * 26)
      g2.drawImage(cv, 0, y, px, h, dx, y, px, h)
    }
    g2.globalCompositeOperation = 'destination-out'
    g2.fillStyle = 'rgba(0,0,0,0.35)'
    for (let y = 0; y < px; y += 4) g2.fillRect(0, y, px, 1)
    g2.globalCompositeOperation = 'source-over'
    tex.needsUpdate = true
  }

  function showLine(id: string, text: string): void {
    body.textContent = text
    shownId = id
    const v = voiceBeeps(text, C.voice, rand)
    beeps = v.beeps
    voiceT = 0
    nextBeep = 0
  }

  function inView(x: number, z: number, px0: number, pz0: number, yaw: number, dist: number): boolean {
    const dx = x - px0
    const dz = z - pz0
    const d = Math.hypot(dx, dz)
    if (d > dist || d < 0.01) return d <= 0.01
    const cos = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d
    return cos >= Math.cos((C.watch.coneDeg * Math.PI) / 180)
  }

  function watch(s: GameState, yaw: number): void {
    const p = s.player.pos
    for (const c of videoCameras(s)) if (c.alive && inView(c.pos.x, c.pos.z, p.x, p.z, yaw, C.watch.cameraDist)) triggers.seen('camera')
    for (const w of wardens(s)) if (w.alive && inView(w.pos.x, w.pos.z, p.x, p.z, yaw, C.watch.wardenDist)) triggers.seen('warden')
  }

  const view: MayView = {
    mode: 'blocked',
    queue,
    handle(events, s): void {
      for (const e of events) if (e.type === 'mayMet') pendingMeeting = true
      present = mayMet(s)
      if (present) triggers.events(events)
    },
    update(rawDt, s, yaw): void {
      present = mayMet(s)
      let mode: QueueMode = present || meeting ? this.mode : 'blocked'
      // the meeting's intro: a glitch before her first line
      if (meeting && introT > 0) {
        introT -= rawDt
        mode = 'blocked'
        if (introT <= 0) for (const l of meetingLines((text) => holdSec(text, C.meeting.perWordSec, C.meeting.baseSec), C.meeting.outroSec)) queue.say(l)
      }
      if (meeting && introT <= 0 && !queue.has(MEETING_PREFIX)) meeting = false
      skipEl.classList.toggle('on', meeting && introT <= 0)
      if (screenGlitch > 0) screenGlitch -= rawDt
      if (present && !meeting && mode === 'play') {
        watchT -= rawDt
        if (watchT <= 0) {
          watchT = C.watch.tickSec
          watch(s, yaw)
        }
      }
      queue.step(rawDt, mode)

      // the subtitle
      const cur = queue.current
      if (queue.visible && cur) {
        if (shownId !== cur.line.id) showLine(cur.line.id, cur.line.text)
        box.classList.add('on')
        // the voice
        voiceT += rawDt
        while (nextBeep < beeps.length && (beeps[nextBeep] as Beep).at <= voiceT) {
          sound.play('voice_may', C.voice.volume, (beeps[nextBeep] as Beep).rate)
          nextBeep++
          energy = 1
        }
      } else {
        box.classList.remove('on')
        if (!cur) shownId = ''
      }
      energy = Math.max(0, energy - rawDt * 5)

      // the glyph over the wrist display
      const on = (queue.visible && present) || screenGlitch > 0 || (meeting && introT > 0)
      glyphAlpha += ((on ? 1 : 0) - glyphAlpha) * Math.min(1, rawDt * 14)
      if (glyphAlpha > 0.02 && hero.wrist(wristAt)) {
        glyph.visible = true
        glyph.position.set(wristAt.x, wristAt.y + C.glyph.lift, wristAt.z)
        flicker -= rawDt
        if (flicker <= 0) {
          flicker = C.glyph.flickerSec
          drawGlyph(performance.now() / 1000)
        }
        if (screenGlitch > 0 || introT > 0) energy = Math.max(energy, 0.8)
        mat.opacity = glyphAlpha * (rand() < 0.12 ? 0.35 : 0.9 + 0.1 * rand())
      } else glyph.visible = false
    },
    speaking: () => queue.visible,
    takeMeeting(): boolean {
      const p = pendingMeeting
      pendingMeeting = false
      return p
    },
    beginMeeting(): void {
      meeting = true
      introT = C.meeting.introSec
      screenGlitch = C.screenGlitchSec
      glitchEl.classList.remove('on')
      void glitchEl.offsetWidth
      glitchEl.classList.add('on')
      sound.play('glitch', 0.8)
    },
    meetingActive: () => meeting,
    skipMeeting(): boolean {
      if (!meeting) return false
      const cur = queue.current
      const read = introT <= 0 && (cur === null || cur.line.id !== `${MEETING_PREFIX}1` || cur.elapsed >= C.meeting.skipAfterSec)
      if (!read) return false
      queue.cancel(MEETING_PREFIX)
      meeting = false
      return true
    },
    unseen(): void {
      triggers.seen('unseen')
    },
    holdingEnd: () => queue.has('notes'),
    reset(): void {
      queue.clearWaiting('death')
      pendingMeeting = false
      meeting = false
      introT = 0
      screenGlitch = 0
      shownId = ''
      box.classList.remove('on')
      skipEl.classList.remove('on')
    },
    restart(): void {
      this.reset()
      queue.resetLevel()
      queue.clearSaved()
      triggers.reset()
    },
    say,
    setScale(pct: number): void {
      box.style.setProperty('zoom', String(pct / 100))
    },
    setReduced(on: boolean): void {
      reduced = on
      glitchEl.classList.toggle('soft', reduced)
    },
  }
  view.setScale(settings?.values.hudScale ?? 100)
  view.setReduced(settings?.values.reduceFx ?? false)
  return view
}
