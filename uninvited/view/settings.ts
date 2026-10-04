// Player settings: volumes, mouse sensitivity, invert Y, reduced shake/flash, HUD size. They live in localStorage
// (through the store main.ts passes in, which already survives a refusing browser: without storage the game just uses
// the defaults and forgets changes). The game view subscribes with onChange and applies them; the menus edit them.
import cfgAll from '../config.json'

const D = cfgAll.audio.settings

export interface Settings {
  /** 0..1 each */
  master: number
  music: number
  sfx: number
  /** Multiplier of the mouse look, sensMin..sensMax. */
  sensitivity: number
  invertY: boolean
  /** No hit-stop shake, camera kick or screen flashes. */
  reduceFx: boolean
  /** HUD size in percent: one of hudScales. */
  hudScale: number
  /** Tutorial cards and on-screen prompts. */
  tipsOn: boolean
}

export interface SettingsStore {
  read(slot: string): string | null
  write(slot: string, data: string): boolean
}

export interface SettingsHandle {
  readonly values: Readonly<Settings>
  set<K extends keyof Settings>(key: K, value: Settings[K]): void
  /** Called now and after every change. */
  onChange(fn: (s: Readonly<Settings>) => void): void
}

export const SENS_MIN = D.sensMin
export const SENS_MAX = D.sensMax
export const HUD_SCALES: readonly number[] = D.hudScales

const SLOT = 'settings'
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

export function defaultSettings(): Settings {
  return { master: D.master, music: D.music, sfx: D.sfx, sensitivity: D.sensitivity, invertY: D.invertY, reduceFx: D.reduceFx, hudScale: D.hudScale, tipsOn: D.tipsOn }
}

/** Reads what a saved string holds, keeping every value inside its range (a hand-edited or old save cannot break the game). */
export function parseSettings(raw: string | null): Settings {
  const s = defaultSettings()
  if (!raw) return s
  let o: Record<string, unknown>
  try {
    const j = JSON.parse(raw) as unknown
    if (typeof j !== 'object' || j === null) return s
    o = j as Record<string, unknown>
  } catch {
    return s
  }
  const num = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d)
  s.master = num(o['master'], 0, 1, s.master)
  s.music = num(o['music'], 0, 1, s.music)
  s.sfx = num(o['sfx'], 0, 1, s.sfx)
  s.sensitivity = num(o['sensitivity'], SENS_MIN, SENS_MAX, s.sensitivity)
  if (typeof o['invertY'] === 'boolean') s.invertY = o['invertY']
  if (typeof o['reduceFx'] === 'boolean') s.reduceFx = o['reduceFx']
  if (typeof o['tipsOn'] === 'boolean') s.tipsOn = o['tipsOn']
  if (typeof o['hudScale'] === 'number' && HUD_SCALES.includes(o['hudScale'])) s.hudScale = o['hudScale']
  return s
}

export function createSettings(store: SettingsStore): SettingsHandle {
  const values = parseSettings(store.read(SLOT))
  const subs: Array<(s: Readonly<Settings>) => void> = []
  return {
    values,
    set(key, value): void {
      values[key] = value
      store.write(SLOT, JSON.stringify(values))
      for (const fn of subs) fn(values)
    },
    onChange(fn): void {
      subs.push(fn)
      fn(values)
    },
  }
}
