// Saves in localStorage. The browser may refuse storage (private mode, blocked site data): every call survives that
// and the game simply runs without saves.

export interface SaveStore {
  read(slot: string): string | null
  write(slot: string, data: string): boolean
  clear(slot: string): void
}

const PREFIX = 'uninvited.'

export function createLocalStore(): SaveStore {
  return {
    read(slot) {
      try {
        return localStorage.getItem(PREFIX + slot)
      } catch {
        return null
      }
    },
    write(slot, data) {
      try {
        localStorage.setItem(PREFIX + slot, data)
        return true
      } catch {
        return false
      }
    },
    clear(slot) {
      try {
        localStorage.removeItem(PREFIX + slot)
      } catch {
        // nothing to clear
      }
    },
  }
}
