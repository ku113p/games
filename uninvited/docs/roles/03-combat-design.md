# Combat designer guide - Uninvited

The combat designer owns how fighting feels and how fair it is: the gunblade (sword combo and rifle), enemy combat roles (drones, wardens, the heavy warden, worms, the ET1 turret), alarm-3 waves, attack tokens, damage and time-to-kill (TTK), healing from kills, telegraphs, and the responsiveness/juice numbers. Files: `config.json` (`combat`, `player`, `drone`, `warden`, `worm`, `alarm.waves`, `tokens`, `shards`, `view.juice`, `audio.hits`), `core/rules/combat.ts`, `movement.ts`, `tokens.ts`, `shards.ts`, `worms.ts`, `wardens.ts`, `drones.ts`, `alarm.ts`, `progress.ts` (checkpoint heal), tests in `core/feel.test.ts` and `core/*.test.ts`, and on the view side `view/hero.ts` (clip timing), `view/game-view.ts` (hit-stop, kick, shake), `view/worms.ts`, `view/fx.ts`. Every number lives in `config.json`; DESIGN.md says the agent picks small numbers during the build and shows them to the designer.

## Principles

- **Attack tokens.** Each attack kind has a few tokens; an enemy asks for one before attacking and gives it back after recovery. It budgets the player's attention; it does not set difficulty. The player can follow about one melee attack and a couple of shots at a time, so a crowd should be a show, not a wall of damage. DOOM (2016) AI, GDC; write-up: [Attack token system: group combat that feels fair](https://www.strayspark.studio/blog/attack-token-system-ue5-group-combat-that-feels-fair).
- **A resource loop.** Kills give back what you need to survive. Weak enemies hand out resources, big ones push you around. Fighting means moving all the time and choosing targets. [The Aggressive Resource Management of Doom Eternal](https://gamedeveloper.com/design/the-aggressive-resource-management-of-i-doom-eternal-i-).
- **Peaks and valleys (L4D AI Director).** Contrast between quiet and frantic matters more than constant density. [Shacknews: Left 4 Dead at GDC](https://www.shacknews.com/article/57892/left-4-dead-at-gdc), [How Evolve assures action peaks and valleys](https://shacknews.com/article/82787/how-evolve-assures-action-peaks-and-valleys).
- **Animation cancels and input buffering** (DMC, God of War, Bayonetta). A clip plays in full when there is no input, but movement or a dodge cuts its recovery. A buffer holds a press until the cancel window opens. Rough swing timing: ~6-7 frames of wind-up, ~5 active, the rest recovery. [Combat Canceled: God of War & Action Game Design](https://www.gamedeveloper.com/game-platforms/combat-canceled-i-god-of-war-i-action-game-design), [The Amalur Problem (Aztez)](https://aztez.com/blog/2012/05/24/the-amalur-problem/).
- **Juice: camera kick, fast-decaying shake, hit-stop** (Vlambeer, "The Art of Screenshake", J. W. Nijman). Feel comes first. [Making Game "Feel"](https://infovore.org/?p=5275), [Notes on Luftrausers](https://unwinnable.com/2014/06/16/notes-on-luftrausers/).
- **General knowledge** (the reviewer did not search for a source): Swink's *Game Feel* says response must come within 100 ms and hits must feel heavy. Vampire Survivors raises pressure through numbers of enemies, not their HP. Weak enemies should do almost no damage, and the player gets a way to cut through a crowd.

## Decisions for Uninvited

- **Two paths** (DESIGN section 7). The Breaker path is "much harder": the alarm climbs, waves wear the player down, and the firewall drops only at the end. The Hacker path is punished hard for any violation. Combat is the price of failing at stealth. It is never the default answer.
- **Enemy roles** (DESIGN section 8, designer 2026-10-04):
  - **Drones watch.** They spot the player and call the others. Their shots are very weak, and they die from 1-2 rifle shots. They hover above sword reach (`drone.hover` 3.5 m against `sword.reachUp` 2.2 m), so they are the rifle's job.
  - **Wardens watch and attack.** They are the main guards and fighters. They shoot from range and switch to melee up close. The sword kills one in 3 hits, the rifle in 8 (DESIGN section 8 "as built").
  - **Worms crush by mass.** They are faster than a sprint, and one sword swing kills every worm in the arc (DESIGN section 9).
  - **Turrets** are one type, ET1, used sparingly: the L1 core arena and the L3 finale (DESIGN section 8).
  - **Heavy warden EW2** appears in waves only. It carries a hex shield (DESIGN section 8 looks).
- **Waves** are big and zombie-like, with at least 4-15 enemies (DESIGN section 8). They come from several sides with a 6 s breather between them (DESIGN section 9). Built in `config.json` as `alarm.waves`:

| Wave | Worm packs | Drones | Wardens | Heavy | Total |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 + 3 | 1 | 0 | 0 | 9 |
| 2 | 4 + 4 + 3 | 2 | 2 | 0 | 15 |
| 3 (and repeats) | 5 + 5 + 4 | 1 | 2 | 1 | 18 |

  The first wave comes 5 s after alarm 3 (`waveFirstDelaySec`), and there is a 6 s gap between waves (`waveGapSec`). Spawn gates closer than 12 m to the player are not used (`minSpawnDist`). Worm packs come from other gates than the drones, and wardens from yet other sides (`alarm.ts`). The firewall drops after 3 cleared waves (`firewallAfterWaves`).
- **Attack tokens** (built in `core/rules/tokens.ts`, `config.json` `tokens`):
  - At most 3 worms bite at once (`bite` 3), 1 warden strikes in melee (`melee` 1), and 2 ranged shots run at once across wardens and drones (`ranged` 2).
  - Enemies without a token wait on a ring 2.5-4.5 m from the player (`ringMin`/`ringMax`) and regroup every 0.8 s (`regroupSec`).
  - A worm waits up to 2.5 s for a bite token (`biteWaitSec`). A ranged token is held 0.6 s after the shot (`rangedHoldSec`). A token returns after the attack's recovery, and a dead enemy frees its token by itself.
- **Healing loop** (built: `core/rules/shards.ts`, `progress.ts`):
  - Kills drop signal shards: worm 1, drone 2, warden 4, heavy 8. Each shard heals 3 HP.
  - A finisher that kills 2 or more drops a big shard worth 15 HP.
  - Shards live 6 s, are pulled in within 1.5 m (magnet speed 9) and are picked up at 0.5 m. At most 48 exist at once.
  - Checkpoints heal fully.
  - **This replaces DESIGN section 9 "as built" item 8 ("No healing").** DESIGN.md has not caught up: that line, and section 10 "shield/regeneration from May", need to be brought in line. May's shield/regen passive stays as an upgrade on top.
- **Non-lethal takedown** (DESIGN section 8). The player sneaks up behind a warden and presses E. An override powers the warden down for a while with no noise and no kill. It reboots later, or wakes at an alarm. **Built (2026-10-05)**: `core/rules/wardens.ts` (`warden.takedown`: 1.6 m, 110 deg rear arc, 0.6 s, down 45 s, alarm 2+ wakes it, a heavy cannot be taken down); see DESIGN section 8.
- **Endings.** A checkpoint counts red only if an alarm-3 wave fight happened since the previous checkpoint (DESIGN section 4, no cascade). For combat this means one fight costs at most one red checkpoint.

**Responsiveness numbers now in `config.json`:**

| Area | Numbers |
| --- | --- |
| `player` | run 6.4, walk 2.6, crouch 1.5 m/s; ground accel 64, decel 80; turnRate 30; dash 11 m/s for 0.2 s, cooldown 0.8 s, double-tap window 0.25 s, dash invulnerable; maxHp 150; hurtInvulnSec 0.35; hitAnimSec 0.2; coyote 0.1 s; jump and attack buffer 0.12 s |
| `combat.sword` | damage 80, range 2.6 m, arc 180 deg, cooldown 0.32 s, anim 0.28 s, reach up 2.2 m / down 1.0 m, combo window 0.7 s; finisher (3rd swing): cooldown 0.5 s, anim 0.38 s, arc 270 deg, range 3.2 m |
| `combat.rifle` | damage 20, interval 0.16 s, spread 2.5 deg (aimed 0.8), range 40 m, 60 charges, aim assist 5 deg; switch 0.14 s, aim draw 0.08 s |
| `view.juice` | hit-stop: hit 0.04 s, kill 0.055 s (+0.005 per extra kill), cap 0.07 s, rifle kill 0.03 s, hurt 0.04 s. Camera kick: rate 16; push/pitch for a hit 0.1/0.012, a kill 0.18/0.02, a hurt 0.2/0.03, a shot 0.05/0.014. Shake (decay 7): hit 0.22, kill 0.5, hurt 0.45, land 0.18, dash 0.08, shot 0.04. Glitch: kill 0.7, alarm 0.55, hurt 0.35. Blade trail 0.2 s; kill flash 0.14 s |

Hit-stop is skipped while crouched and with "reduce effects" on (`view/game-view.ts`).

## Rules of thumb and metrics

**TTK targets (current numbers):**

| Target | HP | Sword | Rifle | Notes |
| --- | --- | --- | --- | --- |
| Worm | 45 | 1 hit (0 s) | 3 shots (0.32 s) | one swing clears the whole arc |
| Drone | 40 | out of reach (hovers 3.5 m) | 2 shots (0.16 s) | DESIGN: 1-2 shots |
| Warden | 200 | 3 hits (third lands at 0.64 s) | 8 shots (x1.25 armor, 1.12 s) | DESIGN: 3 / 8 |
| Heavy EW2 | 300 | 4 hits (~1.14 s) | 12 shots from the side or back only | the shield blocks rifle shots within +-65 deg of its front |
| Camera | 40 | 1 | 2 | breaking one calls a check |

**Damage to the player (150 HP):**

| Source | Damage per hit | Hits to kill |
| --- | --- | --- |
| Worm bite | 10 | 15 |
| Warden strike | 30 | 5 |
| Heavy strike | 39 | 4 |
| Warden bolt | 14 | 11 |
| Drone bolt | 5 | 30 |
| Laser, fall | 20 | 8 |

Target: death after 3-4 real mistakes, not a thousand cuts.

**Rough heal per cleared wave** (not counting finishers): wave 1 about 30 HP, wave 2 about 69, wave 3 about 96.

- **Telegraphs.** Every attack gets a readable wind-up of at least 0.4 s: worm 0.42 s, warden strike 0.7 s, warden aimed shot 1.1 s, drone aim 0.9 s after a 1.0 s fire wind-up. Losing line of sight cancels a ranged aim.
- **Tokens.** Every new attacker (turret ET1 included) takes a token. Only environment damage (lasers, falls) skips tokens.
- **Difficulty.** Raise pressure with enemy count, mix and directions, never with HP. Keep any single hit at or below ~26% of max HP (the heavy strike's 39 is the ceiling).
- **Weapon roles.** Every wave has at least one sword target (worms close) and one rifle target (a drone above reach, or a turret).
- **Hit-stop** never goes above 0.07 s; in a crowd a longer one turns into a slideshow. Shake decays fast (7/s).
- **Input.** A press acts in the same tick (`feel.test.ts`). The attack buffer is 0.12 s. A dash cancels swing recovery. Taking a hit never takes control away: `playerFrozen` is only for death and hacking, and the hit clip is visual only.
- **Healing.** It comes only from fighting (shards) and checkpoints. No passive regeneration unless it comes from May's shield/regen upgrade.
- **Changing a number.** Change it in `config.json`, then run `bun test` and the bot route (`tools/slice-bot.ts`, `tools/bot-routes.ts`) so the violent route stays passable on a careful first try (DESIGN section 9, item 15).

## Review 2026-10-04

**Strengths.**
- The toolkit was already rich:
  - a 0.12 s attack buffer, with the attack firing on the press frame;
  - a dash that cancels swing recovery and gives i-frames;
  - hit-stop with a cap, shake, camera kick, a blade trail and a glitch screen.
- Enemy roles were clearly split by weapon: worms for the sword arc, high drones for the rifle, and wardens with a 0.7 s telegraph you can dash out of.
- Telegraphs were honest, and there was a hit-direction indicator.
- The sword (noise 6) and the rifle (noise 16) are loud, so fighting really differs from stealth.

**Problems, by impact.**

1. **Swing responsiveness (high). In progress.**
   - Done: hurt invulnerability 0.5 -> 0.35 s, hit clip 0.3 -> 0.2 s, sword cooldown 0.42 -> 0.32 s, combo with a finisher, dash cancel. Taking a hit does not freeze control in `core/`.
   - Open:
     - The facing still locks while `slashTime` runs (`movement.ts`), and sprint or jump do not cancel recovery.
     - Logic damage lands on the press while the clip shows contact ~0.1 s later, so an enemy can vanish before the blade reaches it. Check this in play.
     - Cooldowns 0.32 / 0.5 s are above the proposed 0.26 / 0.4 s.
2. **No attack budget for the crowd (high). Done:** tokens bite 3 / melee 1 / ranged 2, a 2.5-4.5 m ring and a 0.8 s regroup.
3. **Waves weaker than asked (high). In progress.**
   - Done: waves of 9 / 15 / 18 with wardens and the heavy EW2, from several sides.
   - Open: the ET1 turret is not in the code yet.
   - Healing: done with shards instead of a healing pickup.
4. **The sword always beats the rifle (medium). In progress.**
   - Done: drones now hover out of sword reach and die in 2 shots. The heavy's shield blocks frontal rifle fire and the sword cuts through it. The reviewer had proposed "the shield breaks only after 2 sword hits"; the built version reaches the same goal, so this part is **decided otherwise**.
   - Open: a rifle-only target, the turret.
5. **Damage numbers (medium). Done:** warden strike 22 -> 30, bite 12 -> 10, drone HP 80 -> 40.
   - The drone bolt went 8 -> 5, not to the proposed 10: **decided otherwise**. DESIGN.md wins here, because drones "shoot only very weakly".
6. **Kill feedback (medium). In progress.** Worms dissolve over 0.5 s with a voice-limited derez sound. A visible scatter when "cutting down five at once" still needs a check in play.

**The reviewer's top 5, updated.**

| # | Recommendation | Effort | Status |
| --- | --- | --- | --- |
| 1 | Attack tokens: 3 bites / 1 melee / 2 ranged, a ring, regroup | M | Done |
| 2 | Sword responsiveness. Let the mouse turn the hero during swing recovery. Let sprint and jump cancel recovery after ~0.18 s. Try cooldowns 0.26 / 0.4 s. Sync contact: keep core damage instant (the tests rely on it) and delay the kill VFX/derez ~0.06 s in the view, or start the clip at its contact frame. | M | Open, highest left |
| 3 | Wave composition with a heavy and the ET1 turret at key points | M | Waves done; ET1 open (S-M: reuse the drone's aim, bolt and ranged token, static) |
| 4 | Balance: drone 40 HP, warden 30, bite 10, hurt invulnerability 0.35 | S | Done (drone bolt 5 by the designer's rule) |
| 5 | Healing from kills plus a big shard for a multi-kill finisher | M | Done (3 HP per shard, big 15, full heal at checkpoints) |

The reviewer flagged two points as checked from code only: the hit/clip desync and the hit clip taking control. The second turned out to be view-only. The first still needs to be watched in play.

## Release checklist

1. **Waves.** A full alarm-3 run on L1: three waves clear, the firewall drops, and FPS holds with 18 enemies plus shards on screen (F3 overlay).
2. **Tokens.** No more than 3 worms are mid-bite at once, and only 1 warden is mid-strike. Count them in a wave-3 fight.
3. **Telegraphs.** Every enemy attack can be dodged by a dash after you see the telegraph, including the heavy strike.
4. **Shards.** They drop, magnet in and heal. The big shard appears on a 2+ kill finisher. A checkpoint heals to 150.
5. **Ranged targets.** Drones cannot be hit by the sword from the ground. The rifle kills them in 2 shots.
6. **Heavy warden.** Its shield blocks frontal rifle shots, with a visible block effect. The sword and shots from the side get through.
7. **Hits.** Taking a hit never locks movement, and the hit-direction arc points at the source.
8. **Hit-stop.** It stays at or under 0.07 s, and "reduce effects" turns off kick and hit-stop.
9. **Bot route.** The violent L1 route is passable by the bot and by a careful first-time player.
10. **ET1 turret** (if shipped). It sits only in the L1 core arena and the L3 finale, telegraphs before firing and uses a ranged token.
11. **DESIGN.md drift fixed.** Section 9 item 8 "No healing", section 9 item 3 "waves keep coming after the firewall" (the code stops waves once the firewall is down), section 9 item 13 "drone holds still 0.7 s" (config: aim 0.9 s), and section 9 "waves mix drones and worm packs" (now also wardens and the heavy).

## Don'ts

- Do not raise enemy HP for difficulty: that makes sponges, not zombie pressure. Add count, mix and directions instead.
- Do not add enemy types beyond ET1 and EW2: there is no time for their animations.
- Do not add parallel auto-targeting to the sword: it does not feel like your hand.
- Do not raise hit-stop above 0.07 s.
- Do not build a complex AI director: timers, the wave table and tokens are enough.
- Do not add passive regeneration outside May's upgrade: it kills the pressure and the reason to fight.
- Do not let any attack bypass tokens, and do not use invulnerability as the crowd limiter. Keep `hurtInvulnSec` short; tokens do that job.
- Do not move damage timing in `core/` without updating `core/feel.test.ts`. The "acts on the press" contract is tested.
- Do not put balance numbers in code. Everything goes in `config.json`.
- Do not make combat the easy path: Breaker must stay "much harder" than Hacker (DESIGN section 7).
- Do not add Halloween dressing to enemies or effects (DESIGN section 14).

## Review 2026-10-05

The full review is in the session's `scratchpad/reviews2/03-combat-design.md`. The designer said the shooting and the hits feel "artificial" and the fights "monotonous"; the reference is modern Doom (2016 / Eternal).

**Status of the earlier items.**
- Tokens and waves (9 / 16 / 19): done. The loud L1 bot wins 8/8 normal and 4/6 sloppy.
- Shards and the checkpoint heal: done.
- Swing responsiveness: partly done.
  - Open: the facing lock during recovery; no sprint or jump cancel; cooldowns still 0.32 / 0.5 s.
  - The damage/contact desync is confirmed in play: damage lands about 0.1 s before the blade reaches the target.
- ET1: not built. **Recommend cutting it** (the producer's cut order).
- **The numbers in this guide are stale.** Config: bite 14, warden strike 35, warden bolt 18, shard heal 2 HP. The heavy strike is 45.5 = 30 % of max HP, above the 26 % ceiling. DESIGN 9 says the worm windup is 0.42 s, config has 0.36.

**Why it feels artificial.**
- The shot is a static 0.05 m line shown for 0.08 s.
- Kick is 0.8 deg, and the shot sound is a thin laser.
- No hit or kill marker at the crosshair.
- Every rifle bolt makes a warden play the same full flinch and knockback, and hits never interrupt an attack.
- Every kill gets the same burst and a full-screen glitch.
- Worms die before biting (1-3 bites per run).
- Aiming forces walk speed.

**Top 5.**

| # | Item | Effort |
| --- | --- | --- |
| 1 | Shot + confirmation pack. A travelling bolt tracer (keep hitscan damage). Muzzle flash 0.35 / light 10. Kick 0.03 / push 0.08, a spine recoil impulse, crosshair bloom. A layered `rifle_shot` at 0.8. Crosshair hit and kill markers with confirm sounds. Impacts in the enemy's colour and a body flash. `glitchKill` 0.25 for small kills. | S-M |
| 2 | Hit reactions with a stagger state. Rifle hits = a twitch, sword hits = knockback. 60 damage within 1 s = a 0.8 s stagger that cancels aim or strike, with a white visor flicker. Plates shed below 50 % HP. | S-M |
| 3 | Sword contact sync and recovery. Delay the sword hit presentation 0.06 s in the view. Mouse turn during recovery. Sprint/jump cancel after 0.18 s. Cooldowns 0.28 / 0.45 s. | S |
| 4 | Push-forward loop and the worm threat. Shard heal 4, magnet 4 m. Aimed move 4.0 m/s, hip spread 1.5 deg. Release packs 2-3 s apart; bite tokens 4; windup 0.42; heavy factor 1.1. Re-run the loud bot (normal ≥ 7/8, sloppy 3-5/6). | S |
| 5 | Optional "glory kill lite": sword on a staggered warden = an instant kill with a dash-lunge, `slash_c`, i-frames and 3 big shards. Cut it first if time runs short. | M |

**Status 2026-10-05:** Top 1 (shot + confirmation pack) is **done** (pack 1): travelling bolt, muzzle flash 0.35 / light 10 always on, push 0.12, spine recoil, crosshair bloom, hit / kill / block markers with `hit_tick` and `kill_pop`, impacts in the enemy colour, `glitchKillSmall` 0.25 (wardens keep 0.7), rebuilt `rifle_shot` at 1.0. Items 2-5 (stagger, sword timing) are pack 2, open. See DESIGN 12 "The shot and its confirmation - as built".

**Status 2026-10-05 (round 2, fight start and spread):** wardens now run to a known position at alarm 2+ (30 m, 4 m/s, shared alarm knowledge, one warden steps in for the melee after its first shot) and fighting drones keep a 7-12 m ring at 3.5-5 m up, never within 4 m above you, spread around it (`drone.standoff`, `warden.pursuit`, `core/pursuit.test.ts`). Bots (8 seeds, normal): slice loud 7/8, slice quiet 8/8, l1 loud 6/8. See DESIGN 8-9 "as built".
