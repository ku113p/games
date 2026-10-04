// Library-based sound effects: layered from the Kenney CC0 packs (Impact Sounds, Sci-Fi Sounds, Interface Sounds,
// Digital Audio) and processed with ffmpeg + a little DSP here (trim, EQ, pitch, layering, fades, loudness match).
// These files are NOT made by tools/sfx/build.ts: their recipes were removed from sounds.ts, build.ts only lists and
// keeps them (via library-manifest.json). Rebuild them with:
//
//   bun tools/sfx/library.ts            # everything
//   bun tools/sfx/library.ts footstep   # only sounds whose name contains a word
//
// Sources: unzip the four packs (https://kenney.nl/assets/impact-sounds, sci-fi-sounds, interface-sounds,
// digital-audio) into tools/sfx/kenney/<pack>/Audio/ (gitignored), or point KENNEY_DIR at a folder with them.
// Pack folders: impact-sounds, sci-fi-sounds, interface-sounds, digital-audio. Needs ffmpeg with libmp3lame.
//
// Source references in the recipes: "imp:" impact-sounds, "sci:" sci-fi-sounds, "ui:" interface-sounds, "dig:" digital-audio.
// Every layer is peak-normalized to 1 first, so `db` is the layer's level relative to the others.
// A layer can also be synthesized (`gen`, a buffer from tools/sfx/synth.ts) instead of read from a Kenney file; it goes
// through the same fades, `dec` envelope, level and mixing. Sound-design rules for the library (checked by audit.ts):
// hits start sharp (< 5 ms: a transient layer), every layer ends in an exponential decay or a fade (never a hard cut),
// and a body layer follows the transient.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as S from "./synth.ts";

const HERE = import.meta.dir;
const ROOT = join(HERE, "..", "..");
const KENNEY = process.env["KENNEY_DIR"] ?? join(HERE, "kenney");
const OUT_DIR = join(ROOT, "audio", "sfx");
const MANIFEST = join(HERE, "library-manifest.json");
const SR = 44100;
/** Loudness ceiling for one-shots: the loudest 50 ms window may not exceed this RMS (dBFS), same as build.ts. */
const MAX_SHORT_RMS_DB = -9;
const PACKS: Record<string, string> = { imp: "impact-sounds", sci: "sci-fi-sounds", ui: "interface-sounds", dig: "digital-audio" };

interface Layer {
  /** "pack:file" without extension (ignored when `gen` is set). */
  src: string;
  /** A synthesized layer instead of a Kenney file (its length is `t`). */
  gen?: Float32Array;
  /** Exponential decay envelope: time to -60 dB, s. */
  dec?: number;
  /** Start inside the source, s. */
  ss?: number;
  /** Length taken from the source, s. */
  t: number;
  /** Where the layer starts in the mix, s. */
  at?: number;
  /** Level relative to the other layers, dB. */
  db?: number;
  hp?: number;
  lp?: number;
  /** Resample ratio: pitch (and speed) multiplier. */
  rate?: number;
  /** Fade in / out, s. */
  fi?: number;
  fo?: number;
}

interface Recipe {
  name: string;
  category: string;
  desc: string;
  /** Variants: files name_v1..vN when more than 1. */
  n: number;
  /** Peak level, dBFS. */
  level: number;
  /** Variants are matched to the quietest one by their loudest 50 ms RMS (quick successions: footsteps). */
  match?: boolean;
  /** Soft saturation applied to the mix before normalizing (1 = none). */
  drive?: number;
  /** Where trim() cuts the tail, dB below the peak (default -48); a long decaying tail wants -60. */
  tailDb?: number;
  /** Seamless loop of this length, s: layers are mixed around the circle. */
  loop?: number;
  /** Layers of variant i (0-based). */
  layers: (i: number) => Layer[];
}

const pick = <T>(xs: readonly T[], i: number): T => xs[i % xs.length] as T;
const imp = (kind: string, i: number, n = 5): string => `imp:${kind}_${String(i % n).padStart(3, "0")}`;
const sci = (kind: string, i: number, n = 5): string => `sci:${kind}_${String(i % n).padStart(3, "0")}`;
const ui = (kind: string, ids: readonly number[], i: number): string => `ui:${kind}_${String(pick(ids, i)).padStart(3, "0")}`;

/** A short digital tick on top of a physical step: very quiet, a different pitch each time. */
const tick = (i: number, db: number, at = 0.004): Layer => ({
  src: ui("tick", [1, 2, 4], i),
  t: 0.05,
  at,
  db,
  hp: 1800,
  rate: pick([1.15, 1.3, 1.0, 1.45, 1.2, 1.35], i),
  fo: 0.02,
});

/** A synthesized layer (see `gen` on Layer). */
const gen = (b: Float32Array, o: Partial<Layer> = {}): Layer => ({ src: "synth", gen: b, t: b.length / SR, ...o });
const rngFor = (name: string, i: number): S.Rng => new S.Rng(S.hashSeed(`${name}#${i}`));

/**
 * A sharp transient: a very short noise burst (attack ~0.2 ms) in a band, optionally bit-crushed. Gives hits and
 * impacts the "tick" that a soft Kenney body lacks, so the sound reaches its peak within a few milliseconds.
 */
function click(rng: S.Rng, lo: number, hi: number, decay = 0.012, crush = 0): Float32Array {
  let b = S.band(S.noise(decay * 1.4 + 0.004, rng), lo, hi);
  if (crush > 0) b = S.crush(b, crush, 2);
  return S.norm(S.amp(b, S.ad(0.0002, decay)));
}

/** A struck tone: a sine with a quiet octave, instant attack, exponential decay. */
function note(freq: number, decay: number, bright = 0.3): Float32Array {
  const e = S.ad(0.0008, decay);
  const sec = decay * 0.95 + 0.004;
  const a = S.osc(sec, "sine", freq);
  const h = S.osc(sec, "sine", freq * 2);
  const b = S.mix(a, [h, 0, bright]);
  return S.norm(S.amp(b, e));
}

const RECIPES: Recipe[] = [
  // ------------------------------------------------------------ footsteps: matte data slabs, grounded + a digital tick
  {
    name: "footstep_walk", category: "Movement", n: 6, level: -5, match: true,
    desc: "Walking step: soft concrete step + muffled thud + a very quiet digital tick (Kenney Impact + Interface)",
    layers: (i) => [
      { src: imp("footstep_concrete", i), t: 0.11, hp: 140, lp: 2600, rate: pick([0.92, 0.97, 0.95, 1.0, 0.9, 0.99], i), fo: 0.03 },
      { src: imp("impactSoft_medium", i), t: 0.1, lp: 900, db: -6, rate: pick([1, 0.94, 1.05], i), fo: 0.04 },
      tick(i, -28),
    ],
  },
  {
    name: "footstep_sprint", category: "Movement", n: 6, level: -2, match: true,
    desc: "Sprint step: heavier slab hit, thud and a faint plate ring + a digital tick (Kenney Impact + Interface)",
    layers: (i) => [
      { src: imp("footstep_concrete", i + 2), t: 0.11, hp: 120, lp: 3200, rate: pick([0.82, 0.88, 0.85, 0.9, 0.8, 0.86], i), fo: 0.03 },
      { src: imp("impactSoft_heavy", i), t: 0.14, lp: 800, db: -2, rate: pick([0.95, 1, 1.05], i), fo: 0.05 },
      { src: imp("impactPlate_light", i, 5), t: 0.16, hp: 250, lp: 3000, db: -11, rate: 1.1, fo: 0.1 },
      tick(i, -22),
    ],
  },
  {
    name: "footstep_sneak", category: "Movement", n: 5, level: -9, match: true,
    desc: "Crouch step: soft carpet-like pad, almost no tick (Kenney Impact + Interface)",
    layers: (i) => [
      { src: imp("footstep_carpet", i), t: 0.1, hp: 220, lp: 1700, rate: pick([1.0, 1.1, 1.05, 0.95, 1.15], i), fo: 0.04 },
      tick(i, -34, 0.006),
    ],
  },
  {
    name: "land", category: "Movement", n: 5, level: -3, match: true,
    desc: "Landing: soft heavy thud, plate body, concrete scuff and a digital sparkle (Kenney Impact + Interface)",
    layers: (i) => [
      { src: imp("impactSoft_heavy", i), t: 0.2, lp: 1300, rate: pick([0.9, 1, 0.95, 1.05, 0.85], i), fo: 0.08 },
      { src: imp("impactPlate_medium", i), t: 0.3, hp: 200, lp: 3500, db: -9, rate: 0.9, fo: 0.2 },
      { src: imp("footstep_concrete", i), t: 0.11, hp: 120, lp: 2800, db: -3, rate: 0.75, fo: 0.03 },
      tick(i, -20, 0.006),
      tick(i + 3, -26, 0.03),
    ],
  },
  {
    name: "warden_step", category: "Security", n: 5, level: -3, match: true,
    desc: "Warden step: heavy armored boot, metal clank and a low thud (Kenney Impact)",
    layers: (i) => [
      { src: imp("impactSoft_heavy", i), t: 0.16, lp: 700, rate: pick([0.7, 0.75, 0.72, 0.8, 0.68], i), fo: 0.06 },
      { src: imp("impactMetal_medium", i), t: 0.25, hp: 150, lp: 3500, db: -6, rate: pick([0.8, 0.9, 0.85, 0.95, 0.75], i), fo: 0.15 },
      { src: imp("footstep_concrete", i + 1), t: 0.11, hp: 100, lp: 2200, db: -4, rate: 0.65, fo: 0.03 },
      gen(click(rngFor("warden_step", i), 600, 3500, 0.01), { db: 4 }),
    ],
  },
  {
    name: "worm_skitter_loop", category: "Security", n: 1, level: -14, loop: 1.6,
    desc: "Worm skitter loop: dozens of tiny glassy taps scattered around the circle, seamless (Kenney Impact + Interface)",
    layers: (i) => {
      const out: Layer[] = [];
      for (let k = 0; k < 18; k++) {
        const at = ((k * 0.0888 + ((k * 7) % 5) * 0.011 + i) % 1.6);
        out.push({
          src: k % 3 === 0 ? ui("tick", [1, 2, 4], k) : imp("impactGlass_light", k),
          t: k % 3 === 0 ? 0.04 : 0.06,
          at,
          db: -3 - (k % 4) * 3,
          hp: 2200,
          lp: 7000,
          rate: 1.3 + (k % 5) * 0.12,
          fo: 0.03,
        });
      }
      return out;
    },
  },

  // ------------------------------------------------------------ player combat
  {
    name: "sword_swing", category: "Combat", n: 3, level: -3, tailDb: -58,
    desc: "Sword swing: band-passed air noise with a fast filter sweep and pitch-bend (a swish), plus a faint energy hum (synth)",
    layers: (i) => {
      const rng = rngFor("sword_swing", i);
      const d = pick([0.3, 0.34, 0.27], i);
      // v1 a rising swish, v2 a falling backswing, v3 a short fast rising cut; monotonic while audible so the spectrum clearly moves
      const sweep = [
        S.path([[0, 500], [d * 0.75, 4300], [d, 3600]], "exp"),
        S.path([[0, 4600], [d * 0.8, 650], [d, 500]], "exp"),
        S.path([[0, 800], [d * 0.7, 4000], [d, 3500]], "exp"),
      ][i % 3]!;
      const env = S.swell(d * 0.32, d * 0.75, 1.6);
      const air = S.amp(S.filter(S.filter(S.noise(d, rng), "bp", sweep, 3.2), "lp", 7500), env);
      const hiss = S.amp(S.filter(S.noise(d, rng), "hp", S.path([[0, 2500], [d * 0.4, 6000], [d, 3500]], "exp")), S.swell(d * 0.3, d * 0.3, 1.4));
      // the faint blade hum bends with the swing and follows the same envelope
      const bend = S.path([[0, 190 * pick([1, 1.2, 0.9], i)], [d * 0.4, 360], [d, 230]], "exp");
      const hum = S.amp(S.mix(S.osc(d, "tri", bend), [S.osc(d, "sine", (t) => S.at(bend, t) * 2.01), 0, 0.4]), env);
      return [
        gen(air, { fo: 0.03 }),
        gen(hiss, { db: -22, fo: 0.03 }),
        gen(hum, { db: -17, fo: 0.03 }),
      ];
    },
  },
  {
    name: "sword_hit", category: "Combat", n: 3, level: -1, match: true,
    desc: "Sword hit on a robot or worm: metal impact, soft body and an energy crackle (Kenney Impact + Digital)",
    layers: (i) => [
      { src: imp("impactMetal_light", i), t: 0.2, hp: 200, rate: pick([1, 1.1, 0.92], i), dec: 0.14, fo: 0.08 },
      { src: imp("impactSoft_heavy", i), t: 0.12, lp: 1200, db: -3, rate: 1, fo: 0.05 },
      { src: `dig:${pick(["zap1", "zap2", "zapTwoTone"], i)}`, t: 0.2, at: 0.005, hp: 1800, db: -9, rate: pick([1.2, 1.0, 1.35], i), dec: 0.14, fo: 0.1 },
    ],
  },
  {
    name: "rifle_shot", category: "Combat", n: 3, level: -1, drive: 1.6, match: true,
    desc: "Rifle shot: sci-fi laser with a low punch (Kenney Sci-Fi + Digital)",
    layers: (i) => [
      { src: sci("laserSmall", i), t: 0.24, hp: 250, rate: pick([0.95, 1.0, 1.08], i), fo: 0.1 },
      { src: `dig:laser${pick([3, 5, 8], i)}`, t: 0.3, hp: 800, db: -8, rate: 1.1, fo: 0.2 },
      { src: "sci:lowFrequency_explosion_000", t: 0.12, lp: 320, db: -6, rate: pick([1.2, 1.3, 1.1], i), fo: 0.07 },
      gen(click(rngFor("rifle_shot", i), 900, 6000, 0.008), { db: 2 }),
    ],
  },
  {
    name: "bullet_impact", category: "Combat", n: 3, level: -3, match: true,
    desc: "Rifle hit: metal tick, a sharp spark and a short plate ring (Kenney Impact + Digital)",
    layers: (i) => [
      { src: imp("impactMetal_light", i + 2), t: 0.18, hp: 400, rate: pick([1.2, 1.3, 1.1], i), dec: 0.06, fo: 0.1 },
      { src: imp("impactPlate_light", i), t: 0.22, hp: 500, lp: 5000, db: -9, rate: 1.4, dec: 0.06, fo: 0.15 },
      { src: `dig:${pick(["zapTwoTone2", "zap1", "zap2"], i)}`, t: 0.16, hp: 2000, db: -12, rate: 1.4, dec: 0.05, fo: 0.1 },
    ],
  },
  {
    name: "player_hit", category: "Combat", n: 3, level: -3, match: true, tailDb: -58,
    desc: "You are hit: a sharp crunchy transient (1-3 kHz, bit-crushed) over a short low thump, with a falling digital zip (synth)",
    layers: (i) => {
      const rng = rngFor("player_hit", i);
      const lo = pick([1000, 1300, 900], i);
      const hi = pick([3200, 3800, 3000], i);
      const crunch = S.norm(S.amp(S.drive(S.crush(S.band(S.noise(0.14, rng), lo, hi), 5, 2), 2.5), S.ad(0.0004, 0.16)));
      const thump = S.norm(S.amp(S.osc(0.2, "sine", S.expc(pick([165, 150, 180], i), 52, 0.12)), S.ad(0.0015, 0.24)));
      const zip = S.norm(S.amp(S.osc(0.08, "square", S.expc(2600, 700, 0.07)), S.ad(0.0005, 0.06)));
      return [
        gen(click(rng, 1500, 6000, 0.006), { db: 0 }),
        gen(crunch, { db: -3, fo: 0.02 }),
        gen(thump, { db: -3, fo: 0.03 }),
        gen(zip, { db: -14, at: 0.004, fo: 0.02 }),
      ];
    },
  },
  {
    name: "player_hurt", category: "Combat", n: 2, level: -2,
    desc: "You are hurt: a short falling digital stab over a glitch (Kenney Digital + Interface)",
    layers: (i) => [
      { src: i === 0 ? "dig:zapThreeToneDown" : "dig:lowDown", t: 0.28, hp: 450, lp: 5500, rate: pick([1, 0.9], i), dec: 0.2, fo: 0.18 },
      { src: ui("glitch", [1, 2, 3, 4], i), t: 0.2, hp: 300, db: -6, fo: 0.12 },
    ],
  },

  // ------------------------------------------------------------ enemies
  {
    name: "drone_hit", category: "Combat", n: 3, level: -2, match: true,
    desc: "Drone hit: metal body clang with a small electric spark (Kenney Impact + Sci-Fi + Digital)",
    layers: (i) => [
      { src: imp("impactMetal_medium", i), t: 0.28, hp: 200, rate: pick([1.0, 1.1, 0.92], i), fo: 0.18 },
      { src: sci("impactMetal", i), t: 0.25, hp: 400, db: -7, rate: 1.1, fo: 0.15 },
      { src: `dig:${pick(["zap1", "zapTwoTone", "zap2"], i)}`, t: 0.2, hp: 1800, db: -12, rate: 1.3, fo: 0.12 },
    ],
  },
  {
    name: "drone_kill", category: "Combat", n: 1, level: -1, tailDb: -62,
    desc: "Drone destroyed: a sharp crack, a low boom, a glitchy electrical burst and a decaying debris and fizz tail (synth + Kenney Sci-Fi)",
    layers: () => {
      const rng = rngFor("drone_kill", 0);
      const crack = S.norm(S.drive(S.amp(S.band(S.noise(0.06, rng), 1800, 9000), S.ad(0.0002, 0.04)), 2));
      const boom = S.norm(S.amp(S.osc(0.6, "sine", S.expc(120, 36, 0.4)), S.ad(0.002, 0.5)));
      // electrical burst: chopped, crushed noise plus a falling FM zap
      const burst = S.norm(S.amp(S.crush(S.gate(S.band(S.noise(0.45, rng), 1500, 6500), S.expc(34, 14, 0.4), 0.45, 0.001), 5, 3), S.ad(0.001, 0.42)));
      const zap = S.norm(S.amp(S.fm(0.4, S.expc(2600, 260, 0.35), 1.5, S.expc(6, 1, 0.35)), S.ad(0.001, 0.32)));
      // debris and fizz: sparse crackle thinning out, over a darkening noise wash
      const fizz = S.norm(S.amp(S.filter(S.dust(1.2, rng, S.expc(1100, 30, 1.1), 0.25), "hp", 2200), S.ad(0, 1.2)));
      const wash = S.norm(S.amp(S.filter(S.noise(1.1, rng), "lp", S.expc(5200, 450, 1.0), 0.9), S.ad(0.008, 1.05)));
      return [
        gen(crack),
        gen(boom, { db: -3, fo: 0.05 }),
        { src: "sci:explosionCrunch_001", ss: 0.02, t: 0.7, hp: 150, lp: 6500, db: -5, dec: 0.45, rate: 1.05, fo: 0.1 },
        gen(burst, { db: -6, at: 0.01, fo: 0.05 }),
        gen(zap, { db: -10, at: 0.02, fo: 0.05 }),
        gen(wash, { db: -12, at: 0.05, fo: 0.15 }),
        gen(fizz, { db: -9, at: 0.08, fo: 0.2 }),
      ];
    },
  },
  {
    name: "worm_hit", category: "Combat", n: 3, level: -3,
    desc: "Worm hit: a squelchy hit with a soft thump and a spark (Kenney Sci-Fi + Impact + Digital)",
    layers: (i) => [
      { src: sci("slime", i, 2), t: 0.22, hp: 150, rate: pick([1.0, 1.15, 1.3], i), dec: 0.13, db: -4, fo: 0.1 },
      { src: imp("impactSoft_medium", i), t: 0.12, lp: 1500, db: -3, fo: 0.06 },
      { src: `dig:${pick(["zap2", "zap1", "zapTwoTone2"], i)}`, t: 0.15, hp: 2200, db: -15, rate: 1.4, fo: 0.1 },
      gen(click(rngFor("worm_hit", i), 1200, 5000, 0.008, 6), { db: -1 }),
    ],
  },
  {
    name: "worm_death", category: "Combat", n: 3, level: -2, tailDb: -66,
    desc: "Worm dies: slime burst, glassy shatter and a falling phaser (Kenney Sci-Fi + Impact + Digital)",
    layers: (i) => [
      { src: sci("slime", i + 1, 2), t: 0.5, hp: 120, rate: pick([0.9, 1.0, 1.1], i), dec: 0.5, db: -3, fo: 0.25 },
      { src: imp("impactGlass_light", i), t: 0.4, hp: 800, db: -5, rate: 1.1, fo: 0.3 },
      { src: `dig:phaserDown${pick([1, 2, 3], i)}`, t: 0.6, at: 0.02, hp: 500, db: -9, dec: 0.55, fo: 0.3 },
      gen(click(rngFor("worm_death", i), 1200, 5000, 0.01, 6), { db: 0 }),
    ],
  },
  {
    name: "drone_shot", category: "Combat", n: 1, level: -2,
    desc: "Drone shot: a thinner, retro laser (Kenney Sci-Fi)",
    layers: () => [
      { src: sci("laserRetro", 2), t: 0.24, hp: 400, rate: 0.9, fo: 0.12 },
      { src: sci("laserSmall", 4), t: 0.2, hp: 700, db: -8, rate: 0.8, fo: 0.1 },
      gen(click(rngFor("drone_shot", 0), 2000, 8000, 0.006), { db: 4 }),
    ],
  },

  // ------------------------------------------------------------ pickups, shields, world
  {
    name: "shield_up", category: "Abilities", n: 1, level: -3,
    desc: "Shield up: a rising force field hum and a bright power-up (Kenney Sci-Fi + Digital)",
    layers: () => [
      { src: sci("forceField", 0), t: 1.0, hp: 120, fi: 0.05, fo: 0.4 },
      { src: "dig:powerUp5", t: 0.6, at: 0.05, hp: 500, db: -8, fo: 0.3 },
    ],
  },
  {
    name: "shield_hit", category: "Abilities", n: 1, level: -2,
    desc: "Shield hit / laser tripwire: a force field slap with a metal ping (Kenney Sci-Fi + Impact)",
    layers: () => [
      { src: sci("forceField", 2), t: 0.22, hp: 500, rate: 1.1, dec: 0.12, db: -4, fo: 0.1 },
      { src: imp("impactMetal_light", 3), t: 0.22, hp: 800, db: -3, rate: 1.3, dec: 0.12, fo: 0.1 },
      gen(click(rngFor("shield_hit", 0), 2500, 9000, 0.006), { db: 0 }),
    ],
  },
  {
    name: "artifact_pickup", category: "Abilities", n: 1, level: -3, tailDb: -60,
    desc: "Pickup: a glassy shard tick and a bright rising four-note chime (FM bells, synth + Kenney Impact)",
    layers: () => {
      const bellAt = (hz: number, decay: number): Float32Array => {
        const e = S.ad(0.001, decay);
        return S.norm(S.amp(S.fm(decay + 0.001, hz, 3.5, (t) => 2.2 * e(t)), e));
      };
      return [
        { src: imp("impactGlass_light", 0), t: 0.12, hp: 2500, rate: 1.3, dec: 0.07, db: -2, fo: 0.03 },
        gen(bellAt(1568, 0.16), { at: 0 }),
        gen(bellAt(2093, 0.16), { at: 0.065, db: -1 }),
        gen(bellAt(2637, 0.16), { at: 0.13, db: -2 }),
        gen(bellAt(3136, 0.2), { at: 0.2, db: -3, fo: 0.06 }),
      ];
    },
  },
  {
    name: "ammo_drop", category: "Abilities", n: 1, level: -3, tailDb: -60,
    desc: "Ammo / small pickup: three bright rising blips, each with a click on the front, no hum (synth)",
    layers: () => {
      const rng = rngFor("ammo_drop", 0);
      return [1568, 2093, 2637].flatMap((hz, k): Layer[] => [
        gen(note(hz, 0.075 + k * 0.012), { at: k * 0.05, db: -k * 2, fo: 0.02 }),
        gen(click(rng, 3500, 9000, 0.004), { at: k * 0.05, db: -9 - k * 2 }),
      ]);
    },
  },
  {
    name: "gate_open", category: "Security", n: 1, level: -3,
    desc: "Spawn gate opens: a sci-fi door slide, a force field swell and a low pulse (Kenney Sci-Fi + Digital)",
    layers: () => [
      { src: sci("doorOpen", 1, 3), t: 0.7, hp: 100, rate: 0.9, fo: 0.3 },
      { src: sci("forceField", 3), t: 0.8, at: 0.1, hp: 200, db: -5, rate: 0.9, fi: 0.15, fo: 0.4 },
      { src: "dig:phaseJump3", t: 0.5, at: 0.05, hp: 500, db: -10, fo: 0.3 },
      { src: "sci:lowFrequency_explosion_000", t: 0.3, lp: 300, db: -9, fo: 0.2 },
    ],
  },
  {
    name: "alarm_1", category: "Security", n: 1, level: -3,
    desc: "Alarm stage 1: two clean falling-rising digital tones, twice (Kenney Digital)",
    layers: () => [0, 0.9].map((at): Layer => ({ src: "dig:twoTone2", t: 0.7, at, lp: 6000, fo: 0.22 })),
  },
  {
    name: "alarm_2", category: "Security", n: 1, level: -3,
    desc: "Alarm stage 2: a faster, higher three-tone alarm, three times (Kenney Digital)",
    layers: () => [0, 0.5, 1.0].map((at): Layer => ({ src: "dig:threeTone2", t: 0.55, at, lp: 6500, rate: 1.12, fo: 0.08 })),
  },
];

// ---------------------------------------------------------------- DSP

function srcPath(ref: string): string {
  const [pack, file] = ref.split(":") as [string, string];
  const dir = PACKS[pack];
  if (!dir) throw new Error(`unknown pack in ${ref}`);
  const p = join(KENNEY, dir, "Audio", `${file}.ogg`);
  if (!existsSync(p)) throw new Error(`missing source ${p} (unzip the Kenney packs into tools/sfx/kenney/, see the header)`);
  return p;
}

/** Decodes a layer to mono float samples at 44.1 kHz: trim, pitch and EQ by ffmpeg, then fades and the decay envelope. */
async function decode(l: Layer): Promise<Float32Array> {
  let a: Float32Array;
  if (l.gen) {
    a = l.gen.slice();
  } else {
    const rate = l.rate ?? 1;
    const f: string[] = ["aresample=44100"];
    if (rate !== 1) f.push(`asetrate=${Math.round(SR * rate)}`, "aresample=44100");
    if (l.hp) f.push(`highpass=f=${l.hp}`);
    if (l.lp) f.push(`lowpass=f=${l.lp}`);
    f.push(`atrim=0:${l.t / rate}`);
    const args = ["-v", "error", "-ss", String(l.ss ?? 0), "-t", String(l.t + 0.05), "-i", srcPath(l.src), "-af", f.join(","), "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"];
    const proc = Bun.spawn(["ffmpeg", ...args], { stdout: "pipe", stderr: "pipe" });
    const buf = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
    if ((await proc.exited) !== 0) throw new Error(`ffmpeg failed for ${l.src}: ${await new Response(proc.stderr).text()}`);
    a = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)).slice();
  }
  // fades are applied to the real end of the data: a source shorter than `t` must not end in a hard cut
  const fi = Math.min(Math.round((l.fi ?? 0.002) * SR), a.length);
  const fo = Math.min(Math.round((l.fo ?? 0.01) * SR), a.length);
  for (let i = 0; i < fi; i++) a[i] = a[i]! * (i / fi);
  for (let i = 0; i < fo; i++) a[a.length - 1 - i] = a[a.length - 1 - i]! * (i / fo) ** 2; // quadratic: a linear ramp still sounds like a cut
  if (l.dec) for (let i = 0; i < a.length; i++) a[i] = a[i]! * Math.exp((-6.9078 * i) / SR / l.dec);
  let pk = 0;
  for (const x of a) pk = Math.max(pk, Math.abs(x));
  const k = pk > 1e-6 ? 1 / pk : 0;
  for (let i = 0; i < a.length; i++) a[i] = a[i]! * k;
  return a;
}

const peakOf = (b: Float32Array): number => b.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const dbOf = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -120);

/** The loudest 50 ms window RMS (dBFS). */
function loud50(b: Float32Array): number {
  const w = Math.round(SR * 0.05);
  let sum = 0;
  let best = 0;
  for (let i = 0; i < b.length; i++) {
    sum += b[i]! * b[i]!;
    if (i >= w) sum -= b[i - w]! * b[i - w]!;
    if (i >= w - 1 || i === b.length - 1) best = Math.max(best, sum / Math.min(w, i + 1));
  }
  return dbOf(Math.sqrt(best));
}

async function mix(r: Recipe, i: number): Promise<Float32Array> {
  const layers = r.layers(i);
  const decoded = await Promise.all(layers.map(decode));
  const total = r.loop ? Math.round(r.loop * SR) : Math.max(...layers.map((l, k) => Math.round((l.at ?? 0) * SR) + decoded[k]!.length));
  const out = new Float32Array(total);
  layers.forEach((l, k) => {
    const g = Math.pow(10, (l.db ?? 0) / 20);
    const d = decoded[k]!;
    const at = Math.round((l.at ?? 0) * SR);
    for (let j = 0; j < d.length; j++) {
      const idx = at + j;
      if (r.loop) out[idx % total]! += d[j]! * g;
      else if (idx < total) out[idx]! += d[j]! * g;
    }
  });
  if (r.drive && r.drive > 1) {
    const pk = peakOf(out) || 1;
    for (let j = 0; j < out.length; j++) out[j] = Math.tanh((out[j]! / pk) * r.drive) / Math.tanh(r.drive);
  }
  return trim(out, !r.loop, r.tailDb ?? -60);
}

/** Cuts leading silence and trailing quiet, adds a short final fade (one-shots only). */
function trim(b: Float32Array, cut: boolean, tailDb: number): Float32Array {
  if (!cut) return b;
  const pk = peakOf(b);
  const lo = pk * Math.pow(10, -50 / 20);
  const hi = pk * Math.pow(10, tailDb / 20);
  let s = 0;
  while (s < b.length && Math.abs(b[s]!) < lo) s++;
  let e = b.length;
  while (e > s && Math.abs(b[e - 1]!) < hi) e--;
  const out = b.slice(Math.max(0, s - 20), e);
  const f = Math.min(out.length, Math.round(SR * 0.006));
  for (let j = 0; j < f; j++) out[out.length - 1 - j] = out[out.length - 1 - j]! * (j / f);
  return out;
}

function wav(b: Float32Array): Uint8Array {
  const out = new Uint8Array(44 + b.length * 2);
  const v = new DataView(out.buffer);
  const w = (o: number, s: string): void => [...s].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + b.length * 2, true); w(8, "WAVEfmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, b.length * 2, true);
  for (let j = 0; j < b.length; j++) v.setInt16(44 + j * 2, Math.round(Math.max(-1, Math.min(1, b[j]!)) * 32767), true);
  return out;
}

async function encode(b: Float32Array, out: string): Promise<void> {
  const tmp = out.replace(/\.mp3$/, ".tmp.wav");
  writeFileSync(tmp, wav(b));
  const p = Bun.spawn(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ac", "1", "-ar", String(SR), "-c:a", "libmp3lame", "-q:a", "4", out], { stderr: "pipe" });
  const code = await p.exited;
  await Bun.file(tmp).delete?.();
  if (code !== 0) throw new Error(`encode failed: ${await new Response(p.stderr).text()}`);
}

interface Entry {
  file: string; group: string; category: string; desc: string; variant: number; variants: number; loop: boolean;
  samples: number; seconds: number; peakDb: number; rmsDb: number; library: true;
}

async function main(): Promise<void> {
  const words = process.argv.slice(2);
  const prev: Entry[] = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Entry[]) : [];
  const done = new Map(prev.map((e) => [e.file, e]));
  mkdirSync(OUT_DIR, { recursive: true });
  for (const r of RECIPES) {
    if (words.length > 0 && !words.some((w) => r.name.includes(w))) continue;
    const bufs: Float32Array[] = [];
    for (let i = 0; i < r.n; i++) bufs.push(await mix(r, i));
    // peak to the recipe level, then (footstep sets) match the loudest 50 ms of every variant to the quietest
    const lvl = Math.pow(10, r.level / 20);
    const scaled = bufs.map((b) => b.map((x) => (x / (peakOf(b) || 1)) * lvl));
    if (r.match) {
      const target = Math.min(...scaled.map(loud50));
      scaled.forEach((b, i) => {
        const k = Math.pow(10, (target - loud50(b)) / 20);
        scaled[i] = b.map((x) => x * k);
      });
    }
    // like build.ts: dense sounds are turned down so their loudest 50 ms stays under the ceiling
    scaled.forEach((b, i) => {
      const over = loud50(b) - MAX_SHORT_RMS_DB;
      if (over > 0 && !r.loop) scaled[i] = b.map((x) => x * Math.pow(10, -over / 20));
    });
    for (let i = 0; i < r.n; i++) {
      const b = scaled[i]!;
      const file = `${r.n > 1 ? `${r.name}_v${i + 1}` : r.name}.mp3`;
      await encode(b, join(OUT_DIR, file));
      const rms = Math.sqrt(b.reduce((s, x) => s + x * x, 0) / b.length);
      done.set(file, {
        file, group: r.name, category: r.category, desc: r.desc, variant: i + 1, variants: r.n, loop: r.loop !== undefined,
        samples: b.length, seconds: b.length / SR, peakDb: dbOf(peakOf(b)), rmsDb: dbOf(rms), library: true,
      });
      console.log(`${file.padEnd(26)} ${(b.length / SR).toFixed(3).padStart(6)} s  peak ${dbOf(peakOf(b)).toFixed(1).padStart(5)}  loud50 ${loud50(b).toFixed(1).padStart(6)}`);
    }
  }
  const order = new Map(RECIPES.map((r, k) => [r.name, k]));
  const entries = [...done.values()].filter((e) => order.has(e.group)).sort((a, b) => order.get(a.group)! - order.get(b.group)! || a.variant - b.variant);
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 1));
  console.log(`${entries.length} library files in the manifest. Now run: bun tools/sfx/build.ts (refreshes the board and README, keeps these files).`);
}

await main();
