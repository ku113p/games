// The hero's domain (owner: WP2 Gunblade and hero): the body, the gunblade (sword + gun), the circular strike.
// DESIGN 3: LMB is always the sword; holding RMB aims and LMB shoots; no weapon switching. The gun is charged only by
// sword kills; reload exists; one skill - the wide circular strike on a long cooldown.
import type { Vec3 } from './common'
import type { MonsterKind } from './monsters'

/** free: walks; grabbed: held in the tank's hand; thrown: flying after a throw; down: on the floor after it; crank: turning a winch. */
export type PlayerControl = 'free' | 'grabbed' | 'thrown' | 'down' | 'crank'

export interface PlayerState {
  /** Feet position. */
  pos: Vec3
  vel: Vec3
  /** Where the body faces (yaw: 0 = +z, PI/2 = +x). */
  facing: number
  grounded: boolean
  /** Horizontal speed after the last move, m/s. */
  speed: number
  running: boolean
  coyote: number
  jumpBuffer: number
  hp: number
  invuln: number
  attackCooldown: number
  slashTime: number
  /** How long the current swing plays, s (the finisher is longer). */
  slashLen: number
  shootTime: number
  hitTime: number
  /** An attack pressed while it was not allowed yet: fires as soon as it is, while this is > 0 (s). */
  attackBuffer: number
  /** Where the buffered attack aims. */
  bufYaw: number
  bufPitch: number
  /** The sword combo: the step of the last swing (0, 1, 2 = finisher) and the time since it started, s. */
  combo: number
  comboTime: number
  /** Downward speed while airborne (for landing). */
  fallSpeed: number
  /** In the air after a jump. */
  jumping: boolean
  /** RMB held: aiming (walk speed, facing the aim, the gun drawn and steadier). */
  aiming: boolean
  /** Seconds left of the draw (aim pressed) or the holster (aim released): no attack meanwhile. */
  drawTime: number
  control: PlayerControl
  /** Seconds left of `down` / the get-up (thrown: unused). */
  controlTime: number
}

/** The gun's cylinder and reserve (DESIGN 3: empty at the start; a sword kill charges it). */
export interface GunState {
  /** Rounds in the cylinder, and in reserve. */
  loaded: number
  reserve: number
  /** > 0 while reloading: seconds left. */
  reloadTime: number
  /** The first charge ever happened (the one-time hint "the gun drinks their blood"). */
  everCharged: boolean
}

/** The circular strike (the "get out of the crowd" tool; there is no dodge). */
export interface StrikeState {
  /** Seconds until it is ready again. */
  cooldown: number
  /** > 0 while the animation plays. */
  animTime: number
  /** > 0 while hit-immune. */
  immune: number
}

export interface PlayerConfig {
  walkSpeed: number
  runSpeed: number
  /** m/s^2 towards the wished speed on the ground (inertia: lower = heavier). */
  groundAccel: number
  /** m/s^2 when there is no input on the ground. */
  groundDecel: number
  airAccel: number
  /** How fast the body turns towards where it moves, 1/s. */
  turnRate: number
  jumpSpeed: number
  gravity: number
  maxFall: number
  coyoteSec: number
  jumpBufferSec: number
  /** A jump or attack pressed up to this long before it is allowed (cooldown, hit-stop) still happens, s. */
  inputBufferSec: number
  maxHp: number
  hurtInvulnSec: number
  eyeHeight: number
  chestHeight: number
  /** Body radius for projectiles and the crowd. */
  radius: number
  /** Landing faster than this (m/s down) emits a `landed` event. */
  landNoiseSpeed: number
  /** Shown as "hit" in the animation state for this long. */
  hitAnimSec: number
  /** Hitting a wall faster than this after a throw hurts, m/s, for this much. */
  wallSlamSpeed: number
  wallSlamDamage: number
  /** On the floor after a throw, then the get-up, s. */
  downSec: number
  getUpSec: number
}

export interface SwordConfig {
  damage: number
  range: number
  arcDeg: number
  /** The wait after swing 1 and 2 of the combo, s. */
  cooldownSec: number
  reachUp: number
  reachDown: number
  /** How long swings 1 and 2 play, s. */
  animSec: number
  /** A swing started within this long after the last one continues the combo (1 -> 2 -> 3 finisher), s. */
  comboWindowSec: number
  /** The third swing: a wider, longer sweep with the same damage. */
  finisher: { cooldownSec: number; animSec: number; arcDeg: number; range: number }
}

export interface GunConfig {
  damage: number
  intervalSec: number
  spreadDeg: number
  /** The spread while aiming (RMB): tighter. */
  aimSpreadDeg: number
  range: number
  aimAssistDeg: number
  muzzleHeight: number
  animSec: number
  /** Aiming draws the gun this fast, s (a swing cannot start before it). */
  aimDrawSec: number
  /** The cylinder size and the reserve cap. */
  magSize: number
  reserveMax: number
  startLoaded: number
  startReserve: number
  reloadSec: number
  /** Reserve added by a sword or strike kill, per kind of the killed ('mannequin' too). Gun kills give nothing. */
  chargePerKill: Partial<Record<MonsterKind | 'mannequin', number>>
}

export interface StrikeConfig {
  radius: number
  damage: number
  knockback: number
  cooldownSec: number
  animSec: number
  immuneSec: number
  reachUp: number
  reachDown: number
}

export type TargetKind = 'monster' | 'tank' | 'target'

export type PlayerEvent =
  | { type: 'jumped' }
  | { type: 'landed'; speed: number }
  | { type: 'swordSwing'; yaw: number; /** 0, 1 = the first two swings, 2 = the wide finisher. */ combo: number }
  | { type: 'gunShot'; fromX: number; fromY: number; fromZ: number; toX: number; toY: number; toZ: number; hit: boolean }
  /** The trigger on an empty cylinder: the click. */
  | { type: 'gunEmpty' }
  /** A sword or strike kill charged the gun by `amount` (the view flies a blood wisp from (x, y, z) into the gun). */
  | { type: 'gunCharged'; amount: number; x: number; y: number; z: number; first: boolean }
  | { type: 'reloadStarted' }
  | { type: 'reloadDone'; loaded: number }
  | { type: 'reloadCancelled' }
  | { type: 'strikeUsed' }
  | { type: 'strikeReady' }
  /** `index` is the pool index for a monster, the zone for the tank, the target slot for a mannequin / chandelier. */
  | { type: 'targetHit'; target: TargetKind; index: number; x: number; y: number; z: number; killed: boolean; byGun: boolean }
  /** A gun bolt stopped on a shield (a skeleton's, from the front). */
  | { type: 'shieldBlocked'; index: number; x: number; y: number; z: number }
  /** (fromX, fromZ): where the hurt came from (the player's own position when it has no direction). */
  | { type: 'playerHurt'; amount: number; hp: number; fromX: number; fromZ: number }
  | { type: 'playerDied' }
  | { type: 'playerGrabbed' }
  | { type: 'playerThrown' }
  | { type: 'playerGotUp' }
  | { type: 'playerHealed'; amount: number; hp: number }
