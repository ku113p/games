// The stages' questions (owner: WP1).
import type { CrankState, MedkitState, OnboardingState, PortcullisState, TargetState } from '../model/stage'
import type { GameState } from '../state'

export function medkits(s: GameState): readonly Readonly<MedkitState>[] {
  return s.medkits
}

export function stageTargets(s: GameState): readonly Readonly<TargetState>[] {
  return s.targets
}

export function cranks(s: GameState): readonly Readonly<CrankState>[] {
  return s.cranks
}

export function portcullises(s: GameState): readonly Readonly<PortcullisState>[] {
  return s.portcullis
}

export function onboarding(s: GameState): Readonly<OnboardingState> {
  return s.onboarding
}

export function stageIndex(s: GameState): number {
  return s.stage.index
}

export function runStats(s: GameState): Readonly<GameState['run']> {
  return s.run
}

export function gameTime(s: GameState): number {
  return s.time
}
