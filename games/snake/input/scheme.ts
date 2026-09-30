// Which control scheme a player gets: pure, no DOM. A stored choice wins; a player who has never chosen gets the configured default.
import type { InputScheme } from './index'

export function isInputScheme(raw: unknown): raw is InputScheme {
  return raw === 'taps' || raw === 'swipes'
}

/** The stored preference if it is a valid scheme, otherwise `fallback` (config.input.defaultScheme). An unknown fallback resolves to 'taps'. */
export function resolveScheme(stored: string | null | undefined, fallback: unknown): InputScheme {
  if (isInputScheme(stored)) return stored
  return isInputScheme(fallback) ? fallback : 'taps'
}
