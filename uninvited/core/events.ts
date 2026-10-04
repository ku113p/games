// What happened during a command - the view reacts to these (animation, sound, shake, particles, HUD).
// Events are created only when something happens (not every frame), into one reused array per Sim.
// The union is composed from the per-domain unions (core/model/*); each domain owner adds its own events there.
import type { DirectorEvent } from './model/director'
import type { HordeEvent } from './model/monsters'
import type { PlayerEvent } from './model/player'
import type { StageEvent } from './model/stage'

export type { TargetKind } from './model/player'

export type GameEvent = PlayerEvent | HordeEvent | DirectorEvent | StageEvent
