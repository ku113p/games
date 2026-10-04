// Hack terminals and the artifact (E to interact). A terminal starts the hacking mini-game (core/hack); solving it
// opens its red walls for good and pauses its lasers and drones for a while. Running out of time raises the alarm
// one stage and closes the session - the terminal can be hacked again.
import { hackPick as pickInSession, hackTick, startHack, type HackEvent } from '../hack/index'
import type { GameState, Sim } from '../state'
import { dist2, emit } from '../util'
import { raiseAlarm } from './alarm'
import { setNavWallOpen } from './nav'

export type Interactable = 'none' | 'terminal' | 'artifact'

/** What E would do right now; the index of the terminal goes to `out.index`. */
export function nearestInteractable(s: GameState, sim: Sim, out: { index: number }): Interactable {
  out.index = -1
  if (s.phase !== 'playing' || s.hack !== null) return 'none'
  const p = s.player.pos
  const r = sim.cfg.terminal.interactRadius
  let best = r * r
  let kind: Interactable = 'none'
  for (let i = 0; i < s.terminals.length; i++) {
    const t = s.terminals[i]
    if (!t || t.done || t.cooldown > 0 || Math.abs(t.pos.y - p.y) > 2) continue
    const d = dist2(p.x, p.z, t.pos.x, t.pos.z)
    if (d <= best) {
      best = d
      kind = 'terminal'
      out.index = i
    }
  }
  const a = sim.artifact
  const ar = sim.cfg.artifact.radius
  if (!s.artifactTaken && Math.abs(a.y - p.y) < 2 && dist2(p.x, p.z, a.x, a.z) <= ar * ar) {
    kind = 'artifact'
    out.index = -1
  }
  return kind
}

const found = { index: -1 }

export function interact(s: GameState, sim: Sim): void {
  const what = nearestInteractable(s, sim, found)
  if (what === 'terminal') beginHack(s, sim, found.index)
  else if (what === 'artifact') {
    s.artifactTaken = true
    s.phase = 'won'
    s.scan.active = false
    emit(sim, { type: 'artifactTaken' })
  }
}

function beginHack(s: GameState, sim: Sim, terminal: number): void {
  const links = sim.terminalLinks[terminal]
  if (!links) return
  s.hack = { terminal, session: startHack(s.rng, links.difficulty, sim.cfg.terminal.timeBonusSec, sim.cfg.hack) }
  s.scan.active = false
  // hacking keeps the stance: a Ctrl crouch becomes a plain crouch, so letting go of Ctrl during the hack (the hack
  // screen takes the keyboard) does not stand you up from behind cover when it ends - C or a jump does
  s.player.crouchByHold = false
  emit(sim, { type: 'hackStarted', terminal })
}

function handleHackEvents(s: GameState, sim: Sim, events: readonly HackEvent[]): void {
  for (const e of events) {
    const run = s.hack
    if (!run) return
    emit(sim, { type: 'hack', event: e })
    if (e.type === 'hackSolved') {
      s.hack = null
      emit(sim, { type: 'hackSolved', terminal: run.terminal })
      unlockTerminal(s, sim, run.terminal)
    } else if (e.type === 'hackTimedOut') {
      s.hack = null
      emit(sim, { type: 'hackTimedOut', terminal: run.terminal })
      const t = s.terminals[run.terminal]
      raiseAlarm(s, sim, 'hack', t?.pos.x ?? s.player.pos.x, t?.pos.y ?? s.player.pos.y, t?.pos.z ?? s.player.pos.z)
    }
  }
}

/** A pick in the open hacking session (from the hack UI). */
export function hackPick(s: GameState, sim: Sim, row: number, col: number): void {
  if (!s.hack || s.phase !== 'playing') return
  handleHackEvents(s, sim, pickInSession(s.hack.session, row, col))
}

/** Esc / right click in the hack UI: walk away. The terminal can be hacked again later. */
export function cancelHack(s: GameState, sim: Sim): void {
  if (!s.hack) return
  const terminal = s.hack.terminal
  s.hack = null
  emit(sim, { type: 'hackCancelled', terminal })
}

export function updateHack(s: GameState, sim: Sim, dt: number): void {
  for (const t of s.terminals) if (t.cooldown > 0) t.cooldown -= dt
  if (!s.hack) return
  handleHackEvents(s, sim, hackTick(s.hack.session, dt))
}

export function openWall(s: GameState, sim: Sim, i: number): void {
  const w = s.walls[i]
  if (!w || w.open) return
  w.open = true
  sim.world.setBlocker(i, false)
  setNavWallOpen(sim.nav, i, true)
  emit(sim, { type: 'wallOpened', index: i })
}

/** The hack worked: open the terminal's walls, pause its lasers, drones and wardens. */
export function unlockTerminal(s: GameState, sim: Sim, terminal: number): void {
  const links = sim.terminalLinks[terminal]
  const t = s.terminals[terminal]
  if (!links || !t) return
  const sec = sim.cfg.terminal.pauseSec
  if (links.meetsMay && !s.mayMet) {
    s.mayMet = true
    emit(sim, { type: 'mayMet' })
  }
  for (const w of links.walls) openWall(s, sim, w)
  for (const l of links.lasers) {
    const laser = s.lasers[l]
    if (!laser || !laser.alive) continue
    laser.pausedTime = sec
    emit(sim, { type: 'devicePaused', target: 'laser', index: l, sec })
  }
  for (const d of links.drones) {
    const drone = s.drones[d]
    if (!drone || !drone.alive || !drone.active) continue
    drone.pausedTime = sec
    drone.sees = false
    emit(sim, { type: 'devicePaused', target: 'drone', index: d, sec })
  }
  for (const k of links.wardens) {
    const w = s.wardens[k]
    if (!w || !w.alive) continue
    w.pausedTime = sec
    w.sees = false
    emit(sim, { type: 'devicePaused', target: 'warden', index: k, sec })
  }
  for (const k of links.cameras) {
    const c = s.cameras[k]
    if (!c || !c.alive) continue
    c.pausedTime = sec
    c.sees = false
    emit(sim, { type: 'devicePaused', target: 'camera', index: k, sec })
  }
  for (const k of links.soundCameras) {
    const c = s.soundCameras[k]
    if (!c || !c.alive) continue
    c.pausedTime = sec
    emit(sim, { type: 'devicePaused', target: 'camera', index: s.cameras.length + k, sec })
  }
  if (links.walls.length > 0) t.done = true
  else t.cooldown = sec
}

/** After loading a save: make the world and the navigation match the state. */
export function syncWorld(s: GameState, sim: Sim): void {
  for (let i = 0; i < s.walls.length; i++) {
    const open = s.walls[i]?.open === true
    sim.world.setBlocker(i, !open)
    setNavWallOpen(sim.nav, i, open)
  }
}
