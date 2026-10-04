// Stages, restart, medkits, onboarding, cranks and the hold-out (owner: WP1 Spine, stages and flow).
// DESIGN 4: medkits lie along the retreat path; death restarts the current stage. DESIGN 7: the first 30 seconds teach.
import type { BarrierShape, Vec3 } from './common'

export type OnboardingStep = 'mannequins' | 'chandelier' | 'letter' | 'midnight' | 'done'

export interface OnboardingState {
  step: OnboardingStep
  /** Sword kills of mannequins in step 1, and whether the circular strike was used in it. */
  kills: number
  strikeUsed: boolean
  /** A step's timer (letter delay, the clock striking), s. */
  timer: number
}

export interface MedkitState {
  pos: Vec3
  taken: boolean
}

export type StageTargetKind = 'mannequin' | 'chandelier'

/** A mannequin (sword training) or the chandelier (gun training). They are hit through the shared target list. */
export interface TargetState {
  kind: StageTargetKind
  pos: Vec3
  /** Hit-sphere centre height above `pos`, and its radius. */
  height: number
  radius: number
  hp: number
  alive: boolean
  /** > 0 while waiting to respawn (mannequins) or to land (the fallen chandelier), s. */
  timer: number
}

export interface CrankState {
  pos: Vec3
  /** 0..1; a ratchet - it never drops. */
  progress: number
  /** Index of the portcullis it opens (into GameState.portcullis). */
  opens: number
  done: boolean
}

/** A portcullis / breakable wall: a barrier plane closed until a crank or a script opens it. */
export interface PortcullisState extends BarrierShape {
  open: boolean
}

export interface StageState {
  /** The active stage index in level.stages, -1 before the first one starts. */
  index: number
  /** Game time the stage started. */
  startedAt: number
  /** The stage's objective is done (the crank turned, the tank dead, the hold-out finished...). */
  cleared: boolean
  /** Roof hold-out: elapsed fraction 0..1, hidden from the HUD except as the percentage on the death screen. */
  holdOut: number
  /** Stage indices whose ambush already fired. */
  ambushed: number[]
}

export interface RunState {
  kills: number
  deaths: number
  /** Stage restarts so far. */
  restarts: number
  timeSec: number
}

export interface StageConfig {
  /** From death to the restart, s (the death cam). */
  restartDelaySec: number
  deathCamSec: number
  /** Widens a stage's trigger rectangle by this much, m. */
  triggerPad: number
  /** `main.ts` snapshots the state when a stage starts. */
  snapshotOnStart: boolean
}

export interface OnboardingConfig {
  mannequins: number
  mannequinHp: number
  mannequinRespawnSec: number
  /** Sword kills that end step 1 (plus one circular strike). */
  killsNeeded: number
  strikePromptAfterKills: number
  chandelierHp: number
  chandelierHeight: number
  chandelierLandSec: number
  chandelierRadius: number
  chandelierDamage: number
  letterDelaySec: number
  letterRange: number
  midnightSec: number
}

export interface MedkitConfig {
  heal: number
  pickupDist: number
  /** A medkit must lie within this of the route (the level test checks it), m. */
  routeMaxM: number
}

export interface CrankConfig {
  /** Seconds of holding E to finish. */
  sec: number
  range: number
  /** The director gets a `relax` for this long after a portcullis opens, s. */
  relaxAfterSec: number
}

export type StageEvent =
  | { type: 'stageStarted'; index: number }
  | { type: 'stageCleared'; index: number }
  | { type: 'stageRestarted' }
  | { type: 'medkitTaken'; index: number; hp: number }
  | { type: 'medkitFull'; index: number }
  | { type: 'crankStarted'; index: number }
  | { type: 'crankProgress'; index: number; progress: number }
  | { type: 'portcullisOpened'; index: number }
  | { type: 'mannequinRespawned'; index: number }
  | { type: 'chandelierFell' }
  | { type: 'chandelierLanded'; x: number; y: number; z: number }
  | { type: 'letterSlid' }
  | { type: 'letterRead' }
  | { type: 'midnight' }
  | { type: 'onboardingStep'; step: OnboardingStep }
  | { type: 'levelDone' }
  /** The roof's hold-out finished: the helicopter takes the hero. */
  | { type: 'rescued' }
