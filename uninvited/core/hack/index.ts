// The hacking mini-game (DESIGN.md section 11) - the public surface for the game.
//   startHack(rng, difficulty 0..1, timeBonusSec, cfg.hack) -> session; hackPick / hackTick -> events.
//   The view reads the session only through ./queries.
export type { HackAction, HackConfig, HackEvent, HackRange, HackSession, HackStatus } from './types'
export { hackPick, hackTick, startHack } from './commands'
export { clampDifficulty, hackParams, type HackParams } from './generate'
export * from './queries'
export { planHack, solveHack } from './solver'
