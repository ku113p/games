// How a hack in the game ended, in words (DESIGN.md section 11: "after a hack it is clear how it ended").
// Built from the game events of the frame the session closed in: hackSolved is followed by the wallOpened /
// devicePaused events of that terminal, hackTimedOut by alarmRaised (unless the alarm could not go higher).
// The overlay shows `title` + `detail` while it holds; the game toasts `toast` once the overlay is gone.
import type { GameEvent } from '../../core/events'
import { t } from '../hud'

export interface HackOutcome {
  kind: 'solved' | 'timedOut' | 'none'
  title: string
  detail: string
  toast: string
}

/** alarmStage: the alarm stage after the frame (for a timeout when the alarm was already as high as it goes). */
export function hackOutcome(events: readonly GameEvent[], alarmStage: number): HackOutcome {
  let solved = false
  let timedOut = false
  let walls = 0
  let lasers = 0
  let drones = 0
  let cameras = 0
  let sec = 0
  let raisedTo = -1
  for (const e of events) {
    if (e.type === 'hackSolved') solved = true
    else if (e.type === 'hackTimedOut') timedOut = true
    else if (solved && e.type === 'wallOpened') walls++
    else if (solved && e.type === 'devicePaused') {
      if (e.target === 'laser') lasers++
      else if (e.target === 'camera') cameras++
      else drones++
      sec = Math.max(sec, Math.round(e.sec))
    } else if (timedOut && e.type === 'alarmRaised') raisedTo = e.stage
  }

  if (solved) {
    const parts: string[] = []
    if (walls > 0) parts.push(walls === 1 ? t('hack.wallOpen') : t('hack.wallsOpen', { n: walls }))
    const paused: string[] = []
    if (lasers > 0) paused.push(lasers === 1 ? t('hack.laser') : t('hack.lasers', { n: lasers }))
    if (cameras > 0) paused.push(cameras === 1 ? t('hack.camera') : t('hack.cameras', { n: cameras }))
    if (drones > 0) paused.push(drones === 1 ? t('hack.drone') : t('hack.drones', { n: drones }))
    if (paused.length > 0) parts.push(t('hack.paused', { what: paused.join(' + '), sec }))
    const detail = parts.length > 0 ? parts.join(', ') : t('hack.nothing')
    const title = t('hack.granted')
    return { kind: 'solved', title, detail, toast: `${title} - ${detail}` }
  }
  if (timedOut) {
    const detail = raisedTo >= 0 ? t('hack.alarmUp', { stage: raisedTo }) : t('hack.alarmHeld', { stage: alarmStage })
    const title = t('hack.failed')
    return { kind: 'timedOut', title, detail, toast: `${title} - ${detail}` }
  }
  return { kind: 'none', title: '', detail: '', toast: '' }
}
