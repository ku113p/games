// Small plain-data types shared by every domain model.

export interface Vec3 {
  x: number
  y: number
  z: number
}

export function vec(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z }
}

/** A barrier plane: a portcullis or a breakable wall - a vertical plane across the corridor through the middle of its cells. */
export interface BarrierShape {
  /** true: the plane is x = coord (the corridor runs along x); false: z = coord. */
  alongX: boolean
  coord: number
  min: number
  max: number
  floor: number
}

/** The result of a hit that may have killed something (filled by the damage functions, read by the gun's ammo credit). */
export interface KillInfo {
  killed: boolean
  /** A MonsterKind, 'mannequin', 'chandelier' or 'tank'. */
  kind: string
  x: number
  y: number
  z: number
}

export function createKillInfo(): KillInfo {
  return { killed: false, kind: '', x: 0, y: 0, z: 0 }
}

/** A sphere a ray or a swing can hit: the one shape every target (monster, tank zone, mannequin, chandelier) exposes. */
export interface TargetSphere {
  x: number
  y: number
  z: number
  r: number
}

export function createTargetSphere(): TargetSphere {
  return { x: 0, y: 0, z: 0, r: 0 }
}
