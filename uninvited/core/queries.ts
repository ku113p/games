// Read-only questions for the view and the HUD (rule 2: the view reads the state only through these).
// This is a barrel: each domain owns its own file in core/queries/ (player WP2, horde WP3, director WP4, stage WP1,
// level WP5). Hot path: no allocations - results are numbers, strings, or written into caller-owned objects.
export * from './queries/player'
export * from './queries/horde'
export * from './queries/director'
export * from './queries/stage'
export * from './queries/level'
