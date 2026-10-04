// The bot's routes per level (tools/slice-bot.ts): waypoints in plan cells (fractions allowed). The loud bot sprints
// along them and fights what it notices; the quiet bot walks them crouched or standing, waits whenever the next steps would
// be seen, and hacks at the 'hack' steps.
/** quietWait: wait here until the way ahead is clear; wardenGap: only wait for the warden to walk away (then follow it); exact: wait until the next two legs, walked crouched, meet no cone at the moment the bot gets there (cameras read exactly); wardenAt: wait until a warden stands at (within 2.5 cells of) this cell - then the way is clear (the primer: go while it faces the far end); takedown (quiet bot): from here, follow the nearest warden on its round and take it down from behind (E), then go on. */
export type Step = { at: [number, number]; act?: 'firewall' | 'hack' | 'take' | 'crouch' | 'stand'; quietWait?: boolean; warden?: boolean | 'stand'; dash?: boolean; wardenGap?: boolean; takedown?: boolean; wardenAt?: [number, number]; exact?: boolean }

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
  { at: [18.45, 2], quietWait: true, wardenGap: true, takedown: true, act: 'stand' }, // behind the rack east of the checkpoint: wait until the warden walks away, then follow it and take it down from behind
  { at: [13, 1] },
  { at: [9.5, 1] }, // past its back while it checks the rack
  { at: [6, 1] },
  { at: [4, 2], act: 'take' },
]

// Level 1: the loud way - hack T0 (the first red wall), run through the primer yard, the plaza, P1, across the river by the
// low bridge (the laser burns and trips the alarm), then fight the lockdown at wall D3 (two waves, that arena's firewall),
// and again at the vault door D2 in the core.
const L1_LOUD: Step[] = [
  { at: [26, 55] },
  { at: [30, 54], act: 'hack' }, // T0
  { at: [26, 52] },
  { at: [26, 47] },
  { at: [26.5, 41] },
  { at: [26.5, 36] },
  { at: [26.5, 29] },
  { at: [26.5, 25] },
  { at: [26.5, 21] },
  { at: [26.5, 17] },
  { at: [30, 15] },
  { at: [30, 8] },
  { at: [30, 5], act: 'firewall' }, // D3 opens after A2's lockdown
  { at: [34, 5] },
  { at: [38, 5] },
  { at: [41, 5] },
  { at: [46, 6] },
  { at: [47.5, 8.5], act: 'firewall' }, // D2 opens after A3's lockdown (the court's open middle is where this fight goes)
  { at: [49, 6.6] },
  { at: [49, 5] },
  { at: [49, 3], act: 'take' },
]

// Level 1: the quiet way - T0; the primer (wait behind the block for the warden's back); the plaza's lane of server blocks
// (wait for cam1's far end); the passage (walk); the high bridge; T1 on the north bank (it opens D3 and pauses the drone
// and warden 2); the light bridge; the core: the lane along the court to T3 behind warden 3 (it opens the vault door D2
// and pauses cam2 and the warden), then the dash into the vault.
const L1_QUIET: Step[] = [
  { at: [26, 55] },
  { at: [30, 54], act: 'hack' }, // T0
  { at: [26, 52] },
  { at: [26, 47], act: 'crouch' },
  { at: [26, 45.5], quietWait: true, wardenAt: [27, 42] }, // the primer: go while warden 1 stands at the east end looking away // the primer: behind the server block, wait for the warden's back
  { at: [26.5, 41] },
  { at: [26.5, 38], quietWait: true, exact: true }, // the lane: go when cam1's sweep leaves it
  { at: [26.5, 34], dash: true },
  { at: [26.5, 29], dash: true },
  { at: [26.5, 27], act: 'stand' },
  { at: [27, 24] }, // C1 (walk through the sensor's zone)
  { at: [27, 21] },
  { at: [26.5, 18], act: 'crouch' },
  { at: [26.5, 16.5] },
  { at: [21, 16], quietWait: true },
  { at: [21, 12] },
  { at: [21, 9] },
  { at: [21, 8.2], quietWait: true, wardenAt: [27, 4] }, // wait inside the chute, go while warden 2 stands at its east end
  { at: [21, 6] },
  { at: [24, 7] },
  { at: [30, 6] },
  { at: [31, 3.1], act: 'hack' }, // T1: D3, drone 1 and warden 2
  { at: [32, 5] },
  { at: [34, 5], act: 'stand' },
  { at: [38, 5] },
  { at: [41, 5], act: 'crouch' }, // C3
  { at: [45, 6], quietWait: true, exact: true }, // the lane along the court: go when cam2 and warden 3 look elsewhere
  { at: [46, 10], dash: true },
  { at: [53, 10], dash: true },
  { at: [54, 7.1], act: 'hack', dash: true }, // T3: D2, cam2 and warden 3
  { at: [53, 10.4], dash: true },
  { at: [49, 10.4], dash: true },
  { at: [49, 8.5], dash: true }, // the gap between the two blocks
  { at: [49, 6.6], dash: true },
  { at: [49, 4], dash: true },
  { at: [49, 3], act: 'take' },
]

export const ROUTES: Record<string, { loud: Step[]; quiet: Step[] }> = {
  slice: { loud: SLICE_LOUD, quiet: SLICE_QUIET },
  l1: { loud: L1_LOUD, quiet: L1_QUIET },
}
