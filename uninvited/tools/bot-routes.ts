// The bot's routes per level (tools/slice-bot.ts): waypoints in plan cells (fractions allowed). The loud bot sprints
// along them and fights what it notices; the quiet bot walks them crouched or standing, waits whenever the next steps would
// be seen, and hacks at the 'hack' steps.
/** quietWait: wait here until the way ahead is clear; wardenGap: only wait for the warden to walk away (then follow it). */
export type Step = { at: [number, number]; act?: 'firewall' | 'hack' | 'take' | 'crouch' | 'stand'; quietWait?: boolean; warden?: boolean | 'stand'; dash?: boolean; wardenGap?: boolean }

const SLICE_LOUD: Step[] = [
  { at: [3, 30] },
  { at: [3, 22] },
  { at: [3, 19] },
  { at: [3, 16] },
  { at: [9, 15] },
  { at: [12, 15] },
  { at: [16, 15] },
  { at: [19, 15] },
  { at: [23, 14] },
  { at: [23, 11] },
  { at: [27, 11] },
  { at: [27, 5] },
  { at: [25, 4] },
  { at: [24, 2], act: 'firewall' },
  { at: [18, 1] },
  { at: [10, 1] },
  { at: [6, 1] },
  { at: [4, 2], act: 'take' },
]

// the Hacker's route: the same corridors, crouched, through both terminals
const SLICE_QUIET: Step[] = [
  { at: [3, 31], act: 'crouch' },
  { at: [3, 22] },
  { at: [3, 19] },
  { at: [3, 16], act: 'stand' }, // walk the sensor corridor (crouching is too slow there; walking is silent)
  { at: [9, 15] },
  { at: [11, 15], act: 'crouch' },
  { at: [11.5, 13.8] },
  { at: [13, 13.8], act: 'hack' }, // T2: pauses the lasers and drone 1
  { at: [11.5, 13.8] },
  { at: [11, 15], act: 'stand' },
  { at: [19, 15] },
  { at: [23, 14] },
  { at: [23, 12], act: 'crouch' },
  { at: [23, 11] },
  { at: [26, 11] },
  { at: [27, 9] },
  { at: [27, 6] },
  { at: [24, 6] },
  { at: [18, 6] },
  { at: [17.6, 4.8] },
  { at: [19, 4.8], act: 'hack' }, // T1: opens the red wall
  { at: [17.6, 4.8], quietWait: true }, // wait in the shelter until the way out is clear
  { at: [18, 6] },
  { at: [24, 6] },
  { at: [25, 4] },
  { at: [25, 2] },
  { at: [18.45, 2], quietWait: true, wardenGap: true, act: 'stand' }, // behind the rack east of the checkpoint: wait until the warden walks away, then walk (silent) behind it
  { at: [13, 1] },
  { at: [9.5, 1] }, // past its back while it checks the rack
  { at: [6, 1] },
  { at: [4, 2], act: 'take' },
]

// Level 1: the loud way - hack T0 (the first red wall), run across the plaza, the passage, the river (the low bridge
// burns), the core's terrace and round the south ring to the vault door; the firewall opens it after three waves.
const L1_LOUD: Step[] = [
  { at: [27, 62] },
  { at: [33, 62], act: 'hack' }, // T0
  { at: [27, 60] },
  { at: [27, 55] },
  { at: [27.5, 50] },
  { at: [24, 49] },
  { at: [18.5, 47.5] },
  { at: [13, 47] },
  { at: [11, 45] },
  { at: [11, 33] },
  { at: [11, 29] },
  { at: [16, 28.5] },
  { at: [21, 26] },
  { at: [21, 19] },
  { at: [26, 15.5] },
  { at: [36, 15] },
  { at: [38.5, 20.5] },
  { at: [40, 22] },
  { at: [48, 18] },
  { at: [48.3, 12] },
  { at: [46, 10.6], act: 'firewall' },
  { at: [45.5, 7] },
  { at: [45, 6], act: 'take' },
]

// Level 1: the quiet way - T0, round the plaza behind its slabs, the passage (walk), T1 on the balcony, the low bridge
// while the laser and the drone are paused, the sound camera's passage (walk), T2 (pauses the tower cameras and drone),
// T3 behind warden 3, then the vault door.
const L1_QUIET: Step[] = [
  { at: [27, 62] },
  { at: [33, 62], act: 'hack' }, // T0
  { at: [27, 60] },
  { at: [27, 54], quietWait: true },
  { at: [27, 50], act: 'crouch', dash: true },
  { at: [32, 53], quietWait: true },
  { at: [35, 54], quietWait: true },
  { at: [39, 51], quietWait: true },
  { at: [38, 41] },
  { at: [36, 39] },
  { at: [28, 39], act: 'stand' },
  { at: [22, 39], quietWait: true },
  { at: [14, 40], act: 'stand' }, // the second way out of the plaza, away from warden 1's street
  { at: [11, 38] },
  { at: [11, 33] },
  { at: [11, 30] },
  { at: [14, 28] },
  { at: [19, 28], act: 'crouch' },
  { at: [18, 27] },
  { at: [17, 26], act: 'hack' }, // T1: the laser on the low bridge and the river drone
  { at: [19, 27], act: 'stand', dash: true },
  { at: [21, 25], dash: true },
  { at: [21, 19], dash: true },
  { at: [26, 15], act: 'stand', dash: true },
  { at: [31, 15] },
  { at: [36, 15] },
  { at: [38, 11], act: 'crouch' },
  { at: [38, 8], quietWait: true },
  { at: [42, 3], quietWait: true },
  { at: [46, 2], quietWait: true },
  { at: [52, 3], quietWait: true },
  { at: [56, 7], dash: true },
  { at: [57, 12], act: 'hack', dash: true }, // T3 (opens the vault door), behind warden 3
  { at: [56, 7], dash: true },
  { at: [52, 3], quietWait: true },
  { at: [46, 2], quietWait: true },
  { at: [42, 3], quietWait: true },
  { at: [37, 6] },
  { at: [36, 5], act: 'hack' }, // T2: pauses the tower cameras and the drone - the dash to the vault
  { at: [38, 8], dash: true },
  { at: [42, 10], dash: true },
  { at: [46, 10], act: 'stand', dash: true },
  { at: [45, 7], dash: true },
  { at: [45, 6], act: 'take' },
]

export const ROUTES: Record<string, { loud: Step[]; quiet: Step[] }> = {
  slice: { loud: SLICE_LOUD, quiet: SLICE_QUIET },
  l1: { loud: L1_LOUD, quiet: L1_QUIET },
}
