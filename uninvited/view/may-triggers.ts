// What makes May speak: game events -> her lines (the logic only, so it is testable). The lines come from texts/en.json
// (may.<level>.*). Priorities: the story beats first, then the danger, then the small comments.
import texts from '../texts/en.json'
import type { GameEvent } from '../core/events'
import { deathLineDue, type MayLine } from './may-queue'

export type MayKey = 'meet1' | 'meet2' | 'meet3' | 'welcome' | 'camera' | 'netvision' | 'warden' | 'alarm1' | 'alarm3' | 'firewall' | 'cpCalm' | 'cpRed' | 'death' | 'notes' | 'end'

/** The text of one of her lines. */
export function mayText(key: MayKey): string {
  return texts[`may.l1.${key}` as keyof typeof texts] as string
}

export const MEETING_PREFIX = 'meet'

/** The three lines of the meeting at T0, played by the meeting beat (main.ts), not by a trigger. */
export function meetingLines(holdSec: (text: string) => number, gapSec: number): MayLine[] {
  return (['meet1', 'meet2', 'meet3'] as const).map((key, i): MayLine => {
    const text = mayText(key)
    return { id: `${MEETING_PREFIX}${i + 1}`, text, priority: 100, once: 'always', holdSec: holdSec(text), gapSec }
  })
}

const L = (key: MayKey, priority: number, once: MayLine['once'], end = false): MayLine => ({ id: key, text: mayText(key), priority, once, ...(end ? { end: true } : {}) })

export interface MayTriggers {
  /** The events of one frame (the lines go to `say`). Call only while May is present. */
  events(list: readonly GameEvent[]): void
  /** The first camera, warden... came into view (the view decides when). */
  seen(what: 'camera' | 'warden'): void
  /** A new run of the level: the death count starts over. */
  reset(): void
  readonly deaths: number
}

export function createMayTriggers(say: (line: MayLine) => void, deathEvery?: number): MayTriggers {
  let deaths = 0
  return {
    get deaths(): number {
      return deaths
    },
    reset(): void {
      deaths = 0
    },
    seen(what): void {
      say(what === 'camera' ? L('camera', 40, 'save') : L('warden', 45, 'save'))
    },
    events(list): void {
      let solved = false
      let wall = false
      for (const e of list) {
        switch (e.type) {
          case 'hackSolved':
            solved = true
            break
          case 'wallOpened':
            wall = true
            break
          case 'scanOn':
            say(L('netvision', 35, 'save'))
            break
          case 'alarmRaised':
            if (e.stage === 1) say(L('alarm1', 50, 'level'))
            else if (e.stage >= 3) say(L('alarm3', 70, 'level'))
            break
          case 'firewallDropped':
            say(L('firewall', 70, 'level'))
            break
          case 'checkpointReached':
            say(e.underAlarm ? L('cpRed', 40, 'level') : L('cpCalm', 40, 'level'))
            break
          case 'playerDied':
            deaths++
            if (deathLineDue(deaths, deathEvery)) say(L('death', 60, 'always'))
            break
          case 'artifactTaken':
            say(L('notes', 80, 'level'))
            say(L('end', 70, 'level', true))
            break
        }
      }
      // a red wall that a hack opened (not the firewall: that one has its own line)
      if (solved && wall) say(L('welcome', 90, 'level'))
    },
  }
}
