// Halloween-mansion sound set ("hw_" files): the gunblade, the hero, the monsters and the house.
// Same craft as the old combat set (layered transient + body + sub + room, Kenney CC0 impacts under synthesized
// layers), written as new recipes so the old files stay untouched.
//
//   bun tools/sfx/hw.ts            # render everything to audio/sfx/hw_*.mp3 (+ tools/sfx/hw-manifest.json)
//   bun tools/sfx/hw.ts revolver   # only sounds whose name contains a word
//
// Every layer is peak-normalized to 1 and mixed with a dB gain, so numbers read as relative levels.
// Kenney sources ("imp:" = impact-sounds, "ui:" = interface-sounds, "dig:" = digital-audio, "sci:" = sci-fi-sounds)
// are read from tools/sfx/kenney/<pack>/Audio/ (gitignored) or KENNEY_DIR.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as S from "./synth.ts";
import * as R from "./recipes.ts";
import type { Buf, Rng } from "./synth.ts";

const HERE = import.meta.dir;
const OUT_DIR = join(HERE, "..", "..", "audio", "sfx");
const WAV_DIR = join(HERE, "out-wav");
const KENNEY = process.env["KENNEY_DIR"] ?? join(HERE, "kenney");
const PACKS: Record<string, string> = { imp: "impact-sounds", sci: "sci-fi-sounds", ui: "interface-sounds", dig: "digital-audio" };
const MAX_SHORT_RMS_DB = -9;

type Group = "Оружие" | "Герой" | "Монстры" | "Мир";
interface HwSound {
  name: string;
  group: Group;
  label: string;
  desc: string;
  variants: number;
  loop: boolean;
  level: number;
  /** Long files (clock, helicopter) skip the one-shot length limit and the short-RMS cap. */
  long?: boolean;
  /** mp3 VBR quality (4 default; long ambience files use 6). */
  q?: number;
  make: (v: number, rng: Rng) => Buf;
}
const SOUNDS: HwSound[] = [];
function def(s: Omit<HwSound, "variants" | "loop" | "level"> & { variants?: number; loop?: boolean; level?: number }): void {
  SOUNDS.push({ variants: 1, loop: false, level: -1, ...s });
}

// ---------------------------------------------------------------- helpers

const cache = new Map<string, Buf>();
/** A Kenney sample: decoded mono, sliced, resampled, filtered, peak 1. */
function K(src: string, o: { ss?: number; t?: number; rate?: number; hp?: number; lp?: number; dec?: number } = {}): Buf {
  const [pk, file] = src.split(":") as [string, string];
  let raw = cache.get(src);
  if (!raw) {
    const path = join(KENNEY, PACKS[pk]!, "Audio", `${file}.ogg`);
    if (!existsSync(path)) throw new Error(`missing Kenney file ${path}`);
    const p = Bun.spawnSync(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", String(S.SR), "-"]);
    if (p.exitCode !== 0) throw new Error(`ffmpeg failed for ${path}`);
    const u8 = p.stdout;
    raw = new Float32Array(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    cache.set(src, raw);
  }
  let b = S.slice(raw, o.ss ?? 0, (o.ss ?? 0) + (o.t ?? 1.5));
  if (o.rate && o.rate !== 1) b = R.resample(b, o.rate);
  if (o.hp) S.filter(b, "hp", o.hp);
  if (o.lp) S.filter(b, "lp", o.lp);
  S.norm(b);
  if (o.dec) R.expDecay(b, o.dec);
  S.fadeOut(b, Math.min(0.05, S.seconds(b) * 0.3));
  return b;
}
const imp = (kind: string, i: number, n = 5): string => `imp:${kind}_${String(i % n).padStart(3, "0")}`;

type L = readonly [Buf, number?, number?];
/** Mix layers given as [buffer, start seconds, gain dB]; each buffer is normalized first. */
function M(...layers: L[]): Buf {
  return S.mix(...layers.map((l): S.Layer => [S.norm(l[0].slice()), l[1] ?? 0, S.dbToGain(l[2] ?? 0)]));
}
const pick = <T>(xs: readonly T[], i: number): T => xs[i % xs.length] as T;

/** Sharp noise burst in a band: crack, click, tick. */
function click(rng: Rng, lo: number, hi: number, decay = 0.01): Buf {
  return S.norm(S.amp(S.band(S.noise(decay * 1.5 + 0.004, rng), lo, hi), S.ad(0.0002, decay)));
}
/** Pitch-dropping sine with saturated harmonics so it carries on small speakers. */
function thump(f0: number, f1: number, sweep: number, decay: number, harm = 0): Buf {
  const k = R.kick(f0, f1, sweep, decay, 0.0012);
  if (harm <= 0) return k;
  const h = S.norm(S.band(S.drive(k.slice(), 4), f1 * 1.8, f0 * 2.2));
  return S.norm(S.mix([k, 0, 1], [h, 0, harm]));
}
/** Metallic tick: two resonant noise bands, like a pawl or a hammer on steel. */
function metalTick(rng: Rng, f: number, decay = 0.02): Buf {
  const n = S.noise(decay * 2, rng);
  const a = S.norm(S.filter(n.slice(), "bp", f, 14));
  const b = S.norm(S.filter(n.slice(), "bp", f * 1.62, 10));
  return S.norm(S.amp(S.mix(a, [b, 0, 0.6]), S.ad(0.0002, decay)));
}
/** Wooden knock: noise through body modes, pitched by `f`. */
function woodTick(rng: Rng, f: number, decay = 0.05): Buf {
  return R.knock(rng, [f, f * 1.9, f * 3.1], 9, decay, f * 0.45);
}
/** Whoosh: noise through a swept bandpass with a swelling envelope. */
function whoosh(rng: Rng, sec: number, f0: number, f1: number, q: number, peakAt = 0.4, color: S.Color = "white"): Buf {
  const fc = S.path([[0, f0], [sec * peakAt, (f0 + f1) / 2 > f0 ? Math.sqrt(f0 * f1) : Math.sqrt(f0 * f1)], [sec, f1]], "exp");
  return R.whoosh(rng, sec, fc, q, S.swell(sec * peakAt, sec * (1 - peakAt), 1.8), color);
}
/** Sound-hole: small room added to a transient sound. */
const room = (b: Buf, mix = 0.35, tail = 0.5): Buf => R.room(b, mix, tail);
/** Scatter `count` copies of a generator over `sec` seconds. */
function scatter(sec: number, count: number, rng: Rng, mk: (i: number) => Buf, db = [-12, 0] as [number, number], front = 1): Buf {
  const out = S.buf(sec);
  for (let k = 0; k < count; k++) {
    const t = sec * Math.pow(rng.next(), front);
    const b = mk(k);
    S.addInto(out, b, S.ofs(Math.min(t, sec - 0.05)), S.dbToGain(rng.range(db[0], db[1])));
  }
  return out;
}

// ================================================================ WEAPON

def({
  name: "hw_revolver_shot", group: "Оружие", variants: 3, level: -1,
  label: "Выстрел револьвера",
  desc: "Revolver shot: bright crack, 400-2500 Hz bang, 110->42 Hz sub thump with saturated harmonics, metal chamber ring, short indoor slap and a small room tail (synth + Kenney)",
  make: (v, rng) => {
    const sub0 = pick([112, 100, 126], v);
    const crack = click(rng, 1000, 9000, pick([0.009, 0.011, 0.007], v));
    const bang = S.norm(S.drive(S.amp(S.band(S.noise(0.12, rng), 250, pick([2200, 1700, 2800], v)), S.ad(0.0004, 0.05)), 3));
    const sub = thump(sub0, 42, 0.12, pick([0.2, 0.26, 0.17], v), 0.55);
    const mid = thump(260, 85, 0.05, 0.09, 0);
    const ring = S.norm(S.amp(S.osc(0.2, "sine", pick([2300, 2050, 2600], v)), S.ad(0.0005, 0.07)));
    const slap = click(rng, 700, 3000, 0.02);
    const cyl = metalTick(rng, 2600, 0.012);
    let dry = M(
      [crack, 0, 3],
      [bang, 0, -2],
      [sub, 0, -2],
      [mid, 0, -6],
      [K(imp("impactMetal_heavy", v), { t: 0.25, hp: 400, lp: 3500, rate: 1.1, dec: 0.1 }), 0, -12],
      [ring, 0.001, -17],
      [slap, 0.034, -14],
      [slap, 0.071, -19],
      [cyl, 0.17 + v * 0.02, -26],
    );
    S.drive(dry, 1.5);
    const wet = M([crack, 0, 0], [bang, 0, -3], [sub, 0, -9]);
    const tail = room(S.filter(wet, "lp", 3500), pick([0.7, 0.9, 0.6], v), pick([0.45, 0.65, 0.4], v));
    S.fadeOut(tail, 0.3);
    return S.mix([dry, 0, 1], [tail, 0.012, 0.5]);
  },
});

def({
  name: "hw_revolver_dry", group: "Оружие", variants: 2, level: -5,
  label: "Осечка (пустой)",
  desc: "Dry fire: hammer fall click on steel, tiny cylinder tick, no powder",
  make: (v, rng) =>
    M(
      [metalTick(rng, pick([2400, 2000], v), 0.014), 0, 0],
      [woodTick(rng, 260, 0.04), 0, -6],
      [metalTick(rng, 3300, 0.008), 0.035 + v * 0.01, -9],
      [thump(120, 70, 0.03, 0.05), 0, -9],
    ),
});

def({
  name: "hw_revolver_reload", group: "Оружие", variants: 2, level: -3,
  label: "Перезарядка",
  desc: "Reload: cylinder swings open, spent brass falls and jingles, six rounds drop in, cylinder spin, snap shut",
  make: (v, rng) => {
    const out: L[] = [];
    // open: latch click + hinge clack
    out.push([metalTick(rng, 1700, 0.02), 0, 0], [thump(180, 90, 0.04, 0.06), 0.005, -6], [metalTick(rng, 2900, 0.03), 0.09, -4]);
    // brass falling
    for (let k = 0; k < 6; k++) {
      out.push([S.amp(S.osc(0.15, "sine", rng.range(3200, 5200)), S.ad(0.0004, 0.07)), 0.3 + k * 0.045 + rng.range(0, 0.02), -14 - k]);
    }
    out.push([woodTick(rng, 500, 0.05), 0.32, -10]);
    // rounds in, one by one
    for (let k = 0; k < 6; k++) {
      const t = 0.75 + k * (0.15 + v * 0.01) + rng.range(-0.012, 0.012);
      out.push([metalTick(rng, rng.range(1500, 2300), 0.014), t, -5], [thump(300, 180, 0.02, 0.025), t, -12]);
    }
    // spin: ratchet ticks decelerating
    let t = 1.85;
    let gap = 0.018;
    while (t < 2.5) {
      out.push([metalTick(rng, 3000, 0.006), t, -9 - (t - 1.85) * 6]);
      t += gap;
      gap *= 1.11;
    }
    // snap shut
    out.push([metalTick(rng, 1500, 0.03), 2.62, 1], [thump(160, 60, 0.05, 0.1, 0.4), 2.62, -4], [K(imp("impactMetal_medium", v), { t: 0.2, hp: 300, lp: 4000, dec: 0.1 }), 2.62, -9]);
    return room(M(...out), 0.18, 0.35);
  },
});

def({
  name: "hw_rune_charge", group: "Оружие", variants: 2, level: -3,
  label: "Руна заряжает ствол",
  desc: "Rune charge: a bright silver FM ting (2-3 notes), airy shimmer and a warm rune hum that swells and fades",
  make: (v, rng) => {
    const notes = v === 0 ? [[1568, 0]] : [[1319, 0], [1760, 0.07], [2349, 0.14]];
    const out: L[] = notes.map(([f, t], k) => [R.bell(f!, 3.5, 3, 0.9 - k * 0.1), t!, -k * 2] as L);
    out.push([R.shards(rng, { sec: 0.6, count: 16, fLo: 4000, fHi: 11000, decayLo: 0.02, decayHi: 0.07, front: 2, ratioLo: 1.4, ratioHi: 2.6, fmIndex: 1.5 }), 0, -12]);
    const hum = S.amp(S.mix(S.osc(1.2, "sine", 196), [S.osc(1.2, "tri", 294.3), 0, 0.5], [S.osc(1.2, "sine", 392.6), 0, 0.3]), (t) => S.swell(0.12, 1.0, 1.4)(t) * (1 + 0.15 * Math.sin(2 * Math.PI * 7 * t)));
    out.push([hum, 0.01, -10]);
    out.push([whoosh(rng, 0.35, 1200, 7000, 2.5, 0.6), 0, -16]);
    return room(M(...out), 0.2, 0.5);
  },
});

def({
  name: "hw_sword_swing_light", group: "Оружие", variants: 2, level: -3,
  label: "Взмах меча (лёгкий)",
  desc: "Light swing: quick air swish, a swept 700->5000 Hz band and a thin blade hiss",
  make: (v, rng) => {
    const d = pick([0.22, 0.25], v);
    const air = whoosh(rng, d, v === 0 ? 700 : 4500, v === 0 ? 5000 : 800, 3, 0.45);
    const hiss = S.amp(S.filter(S.noise(d, rng), "hp", 4500), S.swell(d * 0.4, d * 0.5, 1.4));
    const body = S.amp(S.osc(d, "sine", S.expc(160, 260, d)), S.swell(d * 0.4, d * 0.5, 1.5));
    return M([air, 0, 0], [hiss, 0, -14], [body, 0, -12]);
  },
});

def({
  name: "hw_sword_swing_heavy", group: "Оружие", variants: 2, level: -2,
  label: "Взмах меча (тяжёлый)",
  desc: "Heavy swing: a long low whoomp of air, a dark 300->2500 Hz sweep and a 70 Hz body push",
  make: (v, rng) => {
    const d = pick([0.42, 0.48], v);
    const air = whoosh(rng, d, 300, 2800, 2.2, 0.5, "pink");
    const hi = S.amp(S.filter(S.noise(d, rng), "bp", S.expc(1500, 4200, d), 2), S.swell(d * 0.5, d * 0.4, 1.8));
    const body = S.amp(S.osc(d, "sine", S.path([[0, 60], [d * 0.55, 95], [d, 55]], "exp")), S.swell(d * 0.45, d * 0.5, 1.6));
    return M([air, 0, 0], [hi, 0, -9], [body, 0, -4]);
  },
});

def({
  name: "hw_sword_chop_flesh", group: "Оружие", variants: 3, level: -1,
  label: "Удар: плоть",
  desc: "Chop on flesh: a sharp blade edge, a wet low-mid squelch, a 140->55 Hz meaty thump and soft heavy impact (Kenney Impact + synth)",
  make: (v, rng) => {
    const squelch = S.amp(S.filter(S.noise(0.16, rng, "pink"), "bp", S.expc(1100, 350, 0.14), 1.6), S.ad(0.001, 0.09));
    return S.drive(
      M(
        [click(rng, 2200, 8000, 0.007), 0, 1],
        [thump(pick([150, 135, 165], v), 55, 0.09, 0.15, 0.4), 0, -2],
        [K(imp("impactSoft_heavy", v), { t: 0.2, lp: 2200, rate: pick([0.85, 0.75, 0.95], v), dec: 0.12 }), 0, -2],
        [K(imp("impactPunch_heavy", v), { t: 0.2, hp: 100, lp: 3000, rate: pick([0.9, 1, 0.85], v), dec: 0.1 }), 0, -5],
        [squelch, 0.004, -7],
        [S.amp(S.band(S.noise(0.07, rng), 500, 1500), S.ad(0.0005, 0.03)), 0.04, -14],
      ),
      1.6,
    );
  },
});

def({
  name: "hw_sword_chop_bone", group: "Оружие", variants: 3, level: -1,
  label: "Удар: кость",
  desc: "Chop on a skeleton: a dry wooden crack, hollow bone knock modes, a splintering snap and a few loose bone ticks (Kenney Impact + synth)",
  make: (v, rng) => {
    const f = pick([420, 520, 360], v);
    const out: L[] = [
      [click(rng, 2500, 9000, 0.006), 0, 1],
      [woodTick(rng, f, 0.09), 0, -2],
      [K(imp("impactWood_heavy", v), { t: 0.22, hp: 150, lp: 5500, rate: pick([1.05, 1.2, 0.95], v), dec: 0.1 }), 0, -4],
      [K(imp("impactPlank_medium", v), { t: 0.2, hp: 400, lp: 6000, rate: 1.3, dec: 0.08 }), 0.003, -8],
      [thump(120, 60, 0.05, 0.08), 0, -8],
    ];
    for (let k = 0; k < 3 + (v % 2); k++) out.push([woodTick(rng, rng.range(700, 1500), 0.03), 0.07 + k * 0.045 + rng.range(0, 0.02), -14 - k * 3]);
    return room(S.drive(M(...out), 1.4), 0.15, 0.25);
  },
});

def({
  name: "hw_sword_chop_ghost", group: "Оружие", variants: 2, level: -3,
  label: "Удар: призрак",
  desc: "Blade through a ghost: a cold silver shing, a falling glassy wail, breathy air and a long ghostly room (synth)",
  make: (v, rng) => {
    const wail = R.vocal(rng, {
      sec: 0.7, f0: S.path([[0, 700], [0.3, 520], [0.7, 280]], "exp"), formants: [S.expc(500, 350, 0.7), S.expc(1400, 900, 0.7), 2800],
      formantQ: 5, vibHz: 6, vibDepth: 0.03, jitter: 0.02, breath: 0.5, wave: "tri",
    });
    const shing = R.bell(pick([2700, 3200], v), 2.76, 2.5, 0.35);
    const air = whoosh(rng, 0.45, 5000, 1200, 2.5, 0.25);
    const dry = M([shing, 0, -4], [S.amp(wail, S.swell(0.08, 0.5, 1.5)), 0.01, -6], [air, 0, -3], [click(rng, 3000, 9000, 0.004), 0, -8]);
    return room(dry, 1.2, 1.1);
  },
});

def({
  name: "hw_sword_whirl", group: "Оружие", variants: 2, level: -1,
  label: "Круговой удар",
  desc: "Circular strike: a rising orbiting whirl (pulsing air at 4-7 turns/s), a low whoomp that swells, then a steel ring and floor thump at the end",
  make: (v, rng) => {
    const d = 0.95;
    const turn = S.path([[0, 3.2], [d * 0.6, 7.5], [d, 4]], "lin");
    let ph = 0;
    const cyc = new Float32Array(S.len(d));
    for (let i = 0; i < cyc.length; i++) {
      ph += S.at(turn, i / S.SR) / S.SR;
      cyc[i] = 0.55 + 0.45 * Math.cos(2 * Math.PI * ph);
    }
    const air = whoosh(rng, d, 350, 4200, 2, 0.6);
    for (let i = 0; i < air.length; i++) air[i] = air[i]! * (cyc[i] ?? 1);
    const hi = S.amp(S.filter(S.noise(d, rng), "hp", 3500), S.swell(d * 0.5, d * 0.4, 1.6));
    const body = S.amp(S.osc(d, "sine", S.path([[0, 55], [d * 0.7, 120], [d, 70]], "exp")), S.swell(d * 0.55, d * 0.4, 1.5));
    const t0 = d * 0.9;
    return room(
      M([air, 0, 0], [hi, 0, -12], [body, 0, -3],
        [R.bell(pick([1900, 2200], v), 2.4, 2, 0.4), t0, -9],
        [thump(110, 50, 0.07, 0.2, 0.5), t0, -3],
        [click(rng, 2000, 8000, 0.01), t0, -6]),
      0.2, 0.5,
    );
  },
});

def({
  name: "hw_sword_jump_slash", group: "Оружие", variants: 2, level: -2,
  label: "Удар в прыжке",
  desc: "Jump slash: an upward hiss that tips into a hard diagonal downward cut with a body whoomp",
  make: (v, rng) => {
    const up = whoosh(rng, 0.2, 600, 3500, 3, 0.7);
    const down = whoosh(rng, 0.3, 4800, 500, 2.6, 0.3);
    const body = S.amp(S.osc(0.3, "sine", S.expc(180, 70, 0.3)), S.swell(0.07, 0.22, 1.4));
    return M([up, 0, -5], [down, 0.17, 0], [body, 0.17, -5], [click(rng, 2500, 8000, 0.006), 0.17, -14 - v]);
  },
});

// ================================================================ HERO

def({
  name: "hw_hero_hurt", group: "Герой", variants: 3, level: -2,
  label: "Герой ранен",
  desc: "Hurt: a short male grunt/gasp through /a/-/o/ formants with breath and a dull body thump",
  make: (v, rng) => {
    const d = pick([0.26, 0.32, 0.22], v);
    const g = R.vocal(rng, {
      sec: d, f0: S.path([[0, pick([150, 135, 165], v)], [d, pick([95, 90, 105], v)]], "exp"),
      formants: [S.expc(pick([700, 600, 800], v), 480, d), S.expc(1150, 900, d), 2500], formantQ: 6, jitter: 0.03,
      breath: 0.35, roughDepth: 0.3, roughHz: 70, lpHz: 4500, drive: 1.5,
    });
    const g2 = S.amp(g, S.adsr(0.012, 0.05, 0.6, d - 0.1, 0.07));
    return M([g2, 0, 0], [thump(120, 60, 0.05, 0.12), 0, -6], [K(imp("impactSoft_heavy", v), { t: 0.15, lp: 1500, rate: 0.9, dec: 0.08 }), 0, -8]);
  },
});

def({
  name: "hw_hero_grabbed", group: "Герой", level: -2,
  label: "Героя схватил танк",
  desc: "Grabbed by the tank: a choked gasp-squeak, ribs and leather creaking under pressure, a heavy grip thud",
  make: (_v, rng) => {
    const g = R.vocal(rng, {
      sec: 0.6, f0: S.path([[0, 160], [0.2, 230], [0.6, 190]], "exp"), formants: [650, 1300, 2500], formantQ: 7,
      jitter: 0.05, breath: 0.5, roughDepth: 0.5, roughHz: 33, lpHz: 4500, drive: 2,
    });
    const creak = S.amp(S.filter(S.noise(0.5, rng), "bp", S.path([[0, 700], [0.25, 1700], [0.5, 900]], "exp"), 9), S.swell(0.1, 0.35, 1.2));
    const g2 = S.amp(g, S.adsr(0.02, 0.06, 0.8, 0.35, 0.15));
    return M([K(imp("impactSoft_heavy", 1), { t: 0.2, lp: 1200, rate: 0.75, dec: 0.1 }), 0, 0], [thump(100, 45, 0.08, 0.2, 0.4), 0, -3], [g2, 0.03, -2], [creak, 0.05, -9],
      [woodTick(rng, 300, 0.05), 0.35, -14]);
  },
});

def({
  name: "hw_hero_thrown", group: "Герой", level: -2,
  label: "Героя бросили",
  desc: "Thrown: a shout cut into a rushing airy whoosh with a clothing flutter, then it ends where the landing sound begins",
  make: (_v, rng) => {
    const g = R.vocal(rng, {
      sec: 0.5, f0: S.path([[0, 190], [0.2, 260], [0.5, 170]], "exp"), formants: [S.expc(750, 520, 0.5), 1250, 2600], formantQ: 6,
      jitter: 0.04, breath: 0.4, roughDepth: 0.25, roughHz: 55, lpHz: 4500, drive: 1.5,
    });
    const g2 = S.amp(g, S.adsr(0.015, 0.06, 0.7, 0.3, 0.12));
    const wind = whoosh(rng, 0.6, 500, 3000, 1.6, 0.35);
    const flutter = S.amp(S.filter(S.noise(0.5, rng), "bp", 1200, 1.5), (t) => (0.5 + 0.5 * Math.sin(2 * Math.PI * 24 * t)) * S.swell(0.1, 0.35, 1.2)(t));
    return M([g2, 0, -1], [wind, 0, -3], [flutter, 0.05, -12], [thump(110, 50, 0.05, 0.1), 0, -8]);
  },
});

def({
  name: "hw_hero_land", group: "Герой", variants: 2, level: -1,
  label: "Падение на пол",
  desc: "Hard landing on the wooden floor: a boom, plank slap, a scrape and a breathless grunt (Kenney Impact + synth)",
  make: (v, rng) => {
    const g = S.amp(R.vocal(rng, { sec: 0.25, f0: S.expc(130, 85, 0.25), formants: [600, 1000, 2300], formantQ: 6, breath: 0.6, roughDepth: 0.3, roughHz: 60, jitter: 0.03 }), S.adsr(0.01, 0.04, 0.5, 0.1, 0.1));
    return room(S.drive(M(
      [K(imp("impactWood_heavy", v), { t: 0.3, hp: 70, lp: 4000, rate: 0.8, dec: 0.2 }), 0, 0],
      [thump(90, 38, 0.1, 0.3, 0.5), 0, -1],
      [K(imp("impactSoft_heavy", v + 1), { t: 0.2, lp: 1800, rate: 0.8, dec: 0.12 }), 0, -4],
      [S.amp(S.filter(S.noise(0.3, rng), "bp", 1800, 1), S.ad(0.03, 0.2)), 0.06, -16],
      [g, 0.08, -9]), 1.4), 0.2, 0.4);
  },
});

def({
  name: "hw_medkit", group: "Герой", variants: 2, level: -3,
  label: "Аптечка",
  desc: "Medkit pickup: a case latch click, a cloth rustle, a warm rising two-note chime with a soft glow (synth)",
  make: (v, rng) => {
    const f = pick([660, 740], v);
    const warm = S.amp(S.mix(S.osc(0.8, "sine", f * 0.5), [S.osc(0.8, "tri", f * 0.75), 0, 0.4]), S.swell(0.1, 0.7, 1.4));
    return room(M(
      [metalTick(rng, 2200, 0.015), 0, -2],
      [thump(220, 110, 0.03, 0.05), 0, -8],
      [S.amp(S.filter(S.noise(0.15, rng), "bp", 3500, 0.8), S.swell(0.05, 0.1, 1.2)), 0.02, -14],
      [R.bell(f, 2, 1.2, 0.5), 0.1, -3],
      [R.bell(f * 1.5, 2, 1.2, 0.7), 0.2, -4],
      [warm, 0.1, -12]), 0.2, 0.4);
  },
});

for (const [kind, kenney, lo, hi, rates] of [
  ["wood", "footstep_wood", 100, 4000, [0.9, 1, 0.85, 0.95]],
  ["stone", "footstep_concrete", 90, 5000, [0.8, 0.9, 0.85, 0.95]],
] as const) {
  def({
    name: `hw_step_${kind}`, group: "Герой", variants: 4, level: -5,
    label: kind === "wood" ? "Шаг: дерево" : "Шаг: камень",
    desc: kind === "wood" ? "Footstep on wooden floorboards: boot, board thud and a faint creak (Kenney Impact + synth)" : "Footstep on stone flags: hard boot heel, dull thud and a tiny echo (Kenney Impact + synth)",
    make: (v, rng) => {
      const layers: L[] = [
        [K(imp(kenney, v), { t: 0.14, hp: lo, lp: hi, rate: pick(rates, v) }), 0, 0],
        [K(imp("impactSoft_medium", v), { t: 0.12, lp: 900, rate: 0.9, dec: 0.07 }), 0, -5],
      ];
      if (kind === "wood" && v % 2 === 0) layers.push([S.amp(S.filter(S.noise(0.2, rng), "bp", rng.range(500, 900), 12), S.swell(0.05, 0.12, 1)), 0.03, -15]);
      if (kind === "stone") layers.push([click(rng, 2500, 7000, 0.005), 0, -9]);
      return room(M(...layers), kind === "stone" ? 0.35 : 0.2, kind === "stone" ? 0.4 : 0.25);
    },
  });
}

// ================================================================ MONSTERS

def({
  name: "hw_rat_squeak", group: "Монстры", variants: 3, level: -4,
  label: "Крыса пищит",
  desc: "Rat squeak: one or two very short high chirps with a rising-falling glide and a little rasp",
  make: (v, rng) => {
    const n = v === 1 ? 2 : 1;
    const out: L[] = [];
    for (let k = 0; k < n; k++) {
      const d = rng.range(0.07, 0.13);
      const f = rng.range(3000, 3800);
      const s = R.vocal(rng, {
        sec: d, f0: S.path([[0, f], [d * 0.3, f * 1.35], [d, f * 0.85]], "exp"), formants: [3800, 5200, 7000], formantQ: 6, wave: "square", pw: 0.25,
        jitter: 0.04, vibHz: 55, vibDepth: 0.03, breath: 0.1,
      });
      out.push([S.amp(s, S.hann(d)), k * 0.14, -k * 3]);
    }
    return M(...out);
  },
});

def({
  name: "hw_rat_swarm_loop", group: "Монстры", loop: true, level: -9,
  label: "Стая крыс: беготня (луп)",
  desc: "Rat swarm loop: dense scurrying paws and claws on boards with scattered squeaks, seamless 3 s",
  make: (_v, rng) => {
    const L_ = 3;
    const pat = S.amp(S.filter(S.dust(L_ + 0.3, rng, S.lfo(260, 150, 1.3), 0.15), "bp", 2800, 0.9), 1);
    const pats = M([pat, 0, 0], [S.amp(S.filter(S.dust(L_ + 0.3, rng, 180, 0.2), "bp", 1100, 1.2), 1), 0, -5], [S.amp(S.filter(S.noise(L_ + 0.3, rng, "pink"), "bp", 1800, 0.7), (t) => 0.1 + 0.08 * Math.sin(t * 9)), 0, -3]);
    const sq = scatter(L_ + 0.3, 10, rng, () => {
      const d = rng.range(0.05, 0.1);
      const f = rng.range(3200, 4600);
      return S.amp(R.vocal(rng, { sec: d, f0: S.path([[0, f], [d * 0.4, f * 1.3], [d, f]], "exp"), formants: [3800, 5200, 7000], formantQ: 6, wave: "square", pw: 0.25 }), S.hann(d));
    }, [-18, -8]);
    return S.loopWrap(S.mix([pats, 0, 1], [sq, 0, 0.7]), L_);
  },
});

def({
  name: "hw_spider_skitter_loop", group: "Монстры", loop: true, level: -11,
  label: "Пауки: стрёкот (луп)",
  desc: "Spider skitter loop: bursts of fast tiny leg ticks, light and dry, seamless 2 s",
  make: (_v, rng) => {
    const L_ = 2;
    const out = S.buf(L_ + 0.3);
    for (let b = 0; b < 9; b++) {
      const t0 = rng.range(0, L_);
      const n = rng.int(6, 14);
      for (let k = 0; k < n; k++) S.addInto(out, click(rng, rng.range(3500, 6500), 11000, 0.003), S.ofs(t0 + k * rng.range(0.011, 0.02)), rng.range(0.3, 1) * rng.range(0.5, 1));
    }
    return S.loopWrap(M([out, 0, 0], [S.amp(S.filter(S.noise(L_ + 0.3, rng), "hp", 6000), 0.03), 0, -22]), L_);
  },
});

def({
  name: "hw_beetle_buzz_loop", group: "Монстры", loop: true, level: -10,
  label: "Жук: жужжание (луп)",
  desc: "Beetle buzz loop: a hard-edged 90 Hz amplitude-modulated saw buzz with a chitin rattle, seamless 1 s",
  make: () => {
    const L_ = 1;
    const f = S.fitCycles(S.lfo(190, 12, 2), L_);
    const saw = S.osc(L_, "saw", f);
    S.filter(saw, "bp", 1400, 0.9);
    S.amp(saw, (t) => 0.55 + 0.45 * Math.sin(2 * Math.PI * 90 * t));
    const sub = S.osc(L_, "sine", S.fitCycles(S.lfo(95, 6, 2), L_));
    return S.mix([S.norm(saw), 0, 1], [S.norm(sub), 0, 0.35]);
  },
});

def({
  name: "hw_beetle_click", group: "Монстры", variants: 2, level: -6,
  label: "Жук: щелчок",
  desc: "Beetle click: a hard chitin snap with a hollow tick, like a shell clacking open",
  make: (v, rng) => M([click(rng, 2500, 8000, 0.006), 0, 0], [woodTick(rng, pick([900, 1200], v), 0.03), 0, -3], [metalTick(rng, 3800, 0.008), 0.035, -8]),
});

for (let i = 0; i < 1; i++) {
  def({
    name: "hw_zombie_groan", group: "Монстры", variants: 3, level: -3,
    label: "Зомби стонет",
    desc: "Zombie groan: a slow low rasp, vowel gliding /a/ to /o/, irregular wobble, breath and a gravelly growl (synth)",
    make: (v, rng) => {
      const d = pick([1.3, 1.0, 1.6], v);
      const f = pick([88, 105, 76], v);
      const g = R.vocal(rng, {
        sec: d, f0: S.path([[0, f * 1.1], [d * 0.35, f * 1.3], [d, f * 0.7]], "exp"),
        formants: [S.path([[0, 600], [d * 0.5, 800], [d, 450]], "exp"), S.path([[0, 1000], [d * 0.5, 1150], [d, 800]], "exp"), 2400],
        formantQ: 5, jitter: 0.06, vibHz: 3.5, vibDepth: 0.04, roughDepth: 0.5, roughHz: pick([34, 41, 28], v), breath: 0.35, lpHz: 2200, drive: 2,
      });
      return room(S.amp(g, S.swell(d * 0.25, d * 0.6, 1.2)), 0.12, 0.3);
    },
  });
}

def({
  name: "hw_zombie_death", group: "Монстры", variants: 2, level: -2,
  label: "Зомби умирает",
  desc: "Zombie death: a last falling groan with a gurgle, then the body drops: wet thud and a floorboard knock",
  make: (v, rng) => {
    const d = 1.1;
    const g = R.vocal(rng, {
      sec: d, f0: S.path([[0, 130], [0.3, 120], [d, 45]], "exp"), formants: [S.expc(750, 400, d), S.expc(1100, 700, d), 2300], formantQ: 5,
      jitter: 0.08, roughDepth: 0.65, roughHz: 30, breath: 0.4, lpHz: 2200, drive: 2,
    });
    const gurgle = S.amp(S.filter(S.noise(0.6, rng), "bp", S.lfo(500, 250, 11), 3), S.swell(0.1, 0.4, 1.2));
    return room(M(
      [S.amp(g, S.swell(0.05, 0.9, 1.3)), 0, -2],
      [gurgle, 0.2, -12],
      [K(imp("impactSoft_heavy", v), { t: 0.25, lp: 1300, rate: 0.7, dec: 0.15 }), 0.62, 0],
      [thump(80, 36, 0.1, 0.3, 0.5), 0.62, -2],
      [woodTick(rng, 280, 0.08), 0.64, -8]), 0.2, 0.4);
  },
});

def({
  name: "hw_skeleton_rattle", group: "Монстры", variants: 2, level: -6,
  label: "Скелет гремит",
  desc: "Skeleton rattle: dozens of light bone ticks and small hollow knocks, dense then loose",
  make: (v, rng) => {
    const d = pick([0.7, 0.55], v);
    const out: L[] = [];
    for (let k = 0; k < 26; k++) {
      const t = d * Math.pow(rng.next(), 1.3);
      out.push([woodTick(rng, rng.range(700, 2200), 0.02 + rng.next() * 0.02), t, -rng.range(0, 14)]);
    }
    return room(M(...out), 0.1, 0.2);
  },
});

def({
  name: "hw_skeleton_break", group: "Монстры", variants: 2, level: -2,
  label: "Скелет рассыпается",
  desc: "Skeleton breaks apart: a dry snap, then a clattering fall of bones on wood over a second (Kenney Impact + synth)",
  make: (v, rng) => {
    const out: L[] = [
      [click(rng, 2000, 9000, 0.008), 0, 1],
      [K(imp("impactWood_heavy", v), { t: 0.3, hp: 120, lp: 5000, dec: 0.15 }), 0, -2],
      [thump(110, 50, 0.06, 0.14, 0.3), 0, -4],
    ];
    for (let k = 0; k < 22; k++) {
      const t = 0.04 + 0.9 * Math.pow(rng.next(), 1.5);
      out.push([k % 3 === 0 ? K(imp("impactWood_light", k), { t: 0.12, hp: 300, rate: rng.range(1, 1.6), dec: 0.06 }) : woodTick(rng, rng.range(500, 1800), 0.035), t, -6 - 8 * t - rng.range(0, 6)]);
    }
    return room(M(...out), 0.2, 0.4);
  },
});

def({
  name: "hw_bat_screech", group: "Монстры", variants: 2, level: -4,
  label: "Летучая мышь визжит",
  desc: "Bat screech: a piercing 4-7 kHz glide with an FM-rough edge, two quick chirps",
  make: (v) => {
    const out: L[] = [];
    for (let k = 0; k < 2; k++) {
      const d = k === 0 ? 0.28 : 0.16;
      const f = pick([4200, 3700], v) * (1 + k * 0.1);
      const b = S.fm(d, S.path([[0, f], [d * 0.6, f * 1.6], [d, f * 1.2]], "exp"), 0.5, S.lin(2, 5, d));
      S.filter(b, "hp", 2500);
      out.push([S.amp(b, S.hann(d)), k * 0.3, -k * 2]);
    }
    return room(M(...out), 0.1, 0.25);
  },
});

def({
  name: "hw_bat_wings", group: "Монстры", variants: 2, level: -7,
  label: "Крылья летучей мыши",
  desc: "Bat wing flaps: five leathery thwaps, muffled cloth-like bursts of air at a steady beat",
  make: (v, rng) => {
    const out: L[] = [];
    const gap = pick([0.09, 0.075], v);
    for (let k = 0; k < 5; k++) {
      const b = S.amp(S.filter(S.noise(0.1, rng, "pink"), "bp", S.expc(500, 1500, 0.1), 1.1), S.ad(0.012, 0.06));
      out.push([b, k * gap + rng.range(-0.005, 0.005), -k * 1.5]);
    }
    return M(...out);
  },
});

def({
  name: "hw_ghost_wail", group: "Монстры", variants: 2, level: -4,
  label: "Призрак стонет",
  desc: "Ghost wail: a breathy rising-falling 'ooooh' with wide vibrato, a hollow glassy overtone and a large cold room",
  make: (v, rng) => {
    const d = pick([2.0, 2.4], v);
    const base = pick([360, 430], v);
    const g = R.vocal(rng, {
      sec: d, f0: S.path([[0, base * 0.9], [d * 0.35, base * 1.5], [d * 0.7, base * 1.2], [d, base * 0.6]], "exp"),
      formants: [S.path([[0, 350], [d * 0.4, 500], [d, 320]], "exp"), S.path([[0, 800], [d * 0.4, 1200], [d, 700]], "exp"), 2700],
      formantQ: 6, wave: "tri", vibHz: 5.5, vibDepth: 0.035, jitter: 0.02, breath: 0.55,
    });
    const halo = S.amp(S.fm(d, S.path([[0, base * 3], [d * 0.4, base * 4.5], [d, base * 2]], "exp"), 1.5, 1.5), S.swell(d * 0.4, d * 0.55, 1.5));
    return room(S.mix([S.amp(g, S.swell(d * 0.4, d * 0.5, 1.4)), 0, 1], [halo, 0, 0.12]), 1.3, 1.6);
  },
});

def({
  name: "hw_ghost_pass", group: "Монстры", level: -5,
  label: "Призрак сквозь стену",
  desc: "Ghost passing through a wall: a cold airy rush, a muffled stone 'thum' as it crosses, a shimmer that blooms on the far side",
  make: (_v, rng) => {
    const d = 1.8;
    const rush = whoosh(rng, d, 400, 3500, 1.8, 0.45);
    const wall = S.filter(M([thump(80, 45, 0.15, 0.4), 0, 0], [K(imp("impactSoft_heavy", 2), { t: 0.3, lp: 400, rate: 0.6, dec: 0.2 }), 0, -3]), "lp", 250);
    const shimmer = R.shards(rng, { sec: 1.0, count: 22, fLo: 2500, fHi: 8500, decayLo: 0.06, decayHi: 0.25, front: 1, ratioLo: 1.3, ratioHi: 2.2, fmIndex: 1.2 });
    const moan = S.amp(R.vocal(rng, { sec: 1.2, f0: S.expc(320, 520, 1.2), formants: [380, 900, 2600], formantQ: 6, wave: "tri", vibHz: 5, vibDepth: 0.03, breath: 0.6 }), S.swell(0.5, 0.7, 1.4));
    return room(M([rush, 0, 0], [wall, 0.7, -5], [shimmer, 0.85, -14], [moan, 0.6, -8]), 0.9, 1.2);
  },
});

def({
  name: "hw_witch_cackle", group: "Монстры", variants: 2, level: -3,
  label: "Ведьма хохочет",
  desc: "Witch cackle: a run of 6-8 breathy, rasping 'hee' pulses on a high bouncing pitch, a wicked rising-falling curve",
  make: (v, rng) => {
    const n = pick([7, 6], v);
    const out: L[] = [];
    let t = 0;
    for (let k = 0; k < n; k++) {
      const d = 0.13 + (k === n - 1 ? 0.15 : 0);
      const f = pick([430, 380], v) * (1 + 0.5 * Math.sin((k / n) * Math.PI)) * (1 + rng.bi() * 0.04);
      const s = R.vocal(rng, {
        sec: d, f0: S.path([[0, f * 0.95], [d * 0.4, f * 1.25], [d, f * 0.9]], "exp"), formants: [S.expc(330, 500, d), S.expc(2200, 1900, d), 3100],
        formantQ: 5, gains: [0.7, 1, 0.5], jitter: 0.04, roughDepth: 0.4, roughHz: 85, breath: 0.4, lpHz: 5000, drive: 1.5,
      });
      out.push([S.amp(s, S.adsr(0.008, 0.02, 0.8, d - 0.05, 0.03)), t, -k * 0.4]);
      t += d + 0.03;
    }
    return room(M(...out), 0.15, 0.3);
  },
});

def({
  name: "hw_witch_throw", group: "Монстры", level: -4,
  label: "Ведьма бросает зелье",
  desc: "Potion throw: an effort 'hah', an arm whip, a flask swishing through the air with a liquid slosh and glassy clink",
  make: (_v, rng) => {
    const g = S.amp(R.vocal(rng, { sec: 0.22, f0: S.expc(380, 520, 0.22), formants: [800, 1300, 2800], formantQ: 5, breath: 0.6, roughDepth: 0.3, roughHz: 60 }), S.adsr(0.01, 0.03, 0.6, 0.1, 0.07));
    const swish = whoosh(rng, 0.4, 700, 4200, 2.5, 0.5);
    const slosh = S.amp(S.filter(S.noise(0.3, rng), "bp", S.lfo(700, 400, 9), 2.5), S.swell(0.1, 0.2, 1.2));
    return M([g, 0, -3], [swish, 0.1, 0], [slosh, 0.12, -14], [R.bell(3200, 2.2, 1, 0.1), 0.12, -18]);
  },
});

def({
  name: "hw_glass_shatter", group: "Монстры", variants: 2, level: -2,
  label: "Склянка разбивается",
  desc: "Flask shattering on the floor: a bright glass burst, tinkling shards, a wet splash (Kenney Impact + synth)",
  make: (v, rng) => {
    const splash = S.amp(S.filter(S.noise(0.4, rng), "bp", S.expc(2500, 700, 0.3), 1.2), S.ad(0.005, 0.2));
    return room(M(
      [K(imp("impactGlass_heavy", v), { t: 0.5, hp: 400, dec: 0.3 }), 0, 0],
      [click(rng, 3000, 10000, 0.008), 0, 0],
      [R.shards(rng, { sec: 0.8, count: 28, fLo: 2500, fHi: 9000, decayLo: 0.02, decayHi: 0.1, front: 2, ratioLo: 1.4, ratioHi: 2.8, fmIndex: 1.6 }), 0.01, -6],
      [splash, 0.01, -7],
      [thump(120, 60, 0.04, 0.08), 0, -10]), 0.25, 0.5);
  },
});

def({
  name: "hw_puddle_bubble_loop", group: "Монстры", loop: true, level: -9,
  label: "Лужа зелья булькает (луп)",
  desc: "Potion puddle loop: slow viscous bubbles popping at random pitches over a low fizz, seamless 3 s",
  make: (_v, rng) => {
    const L_ = 3;
    const out = S.buf(L_ + 0.5);
    for (let k = 0; k < 22; k++) S.addInto(out, R.bubble(rng.range(180, 700), rng.range(1, 2.5), rng.range(0.04, 0.12)), S.ofs(rng.range(0, L_)), rng.range(0.3, 1));
    const fizz = S.amp(S.filter(S.dust(L_ + 0.5, rng, 400, 0.2), "bp", 5000, 1), 0.2);
    return S.loopWrap(S.mix([S.norm(out), 0, 1], [S.norm(fizz), 0, 0.2]), L_);
  },
});

def({
  name: "hw_gremlin_giggle", group: "Монстры", variants: 2, level: -4,
  label: "Гремлин хихикает",
  desc: "Gremlin giggle: fast nasal staccato 'ki-ki-ki' chirps on a high wobbling pitch, sillier and thinner than the witch",
  make: (v, rng) => {
    const n = pick([8, 6], v);
    const out: L[] = [];
    let t = 0;
    for (let k = 0; k < n; k++) {
      const d = 0.075;
      const f = pick([640, 780], v) * (1 + 0.25 * (k % 2)) * (1 + rng.bi() * 0.05);
      const s = R.vocal(rng, { sec: d, f0: S.path([[0, f], [d, f * 1.2]], "exp"), formants: [420, 2400, 3300], formantQ: 6, wave: "square", pw: 0.3, jitter: 0.04, breath: 0.2 });
      out.push([S.amp(s, S.hann(d)), t, -k * 0.5]);
      t += d + 0.045;
    }
    return room(M(...out), 0.1, 0.2);
  },
});

def({
  name: "hw_gremlin_throw", group: "Монстры", level: -5,
  label: "Гремлин бросает",
  desc: "Gremlin throw: a small 'hyup' grunt and a quick fluttering whip of an object flying",
  make: (_v, rng) => {
    const g = S.amp(R.vocal(rng, { sec: 0.14, f0: S.expc(620, 900, 0.14), formants: [500, 2200, 3200], formantQ: 6, wave: "square", pw: 0.3, breath: 0.3 }), S.hann(0.14));
    return M([g, 0, -2], [whoosh(rng, 0.25, 1000, 5000, 3, 0.4), 0.06, 0], [click(rng, 3000, 8000, 0.006), 0.07, -10]);
  },
});

def({
  name: "hw_tank_roar", group: "Монстры", variants: 2, level: -1,
  label: "Танк ревёт",
  desc: "Tank roar: a huge growl at 50-60 Hz with a heavy amplitude rumble, wide open /a/ formants, saturation and a sub body that shakes the floor",
  make: (v, rng) => {
    const d = pick([1.9, 2.3], v);
    const f = pick([62, 54], v);
    const g = R.vocal(rng, {
      sec: d, f0: S.path([[0, f * 0.8], [d * 0.2, f * 1.3], [d * 0.6, f * 1.1], [d, f * 0.6]], "exp"),
      formants: [S.path([[0, 500], [d * 0.3, 850], [d, 450]], "exp"), S.path([[0, 900], [d * 0.3, 1300], [d, 800]], "exp"), 2300],
      formantQ: 3.5, jitter: 0.05, roughDepth: 0.7, roughHz: pick([26, 31], v), breath: 0.3, lpHz: 1800, drive: 3,
    });
    const sub = S.amp(S.osc(d, "sine", S.path([[0, f], [d * 0.3, f * 1.4], [d, f * 0.7]], "exp")), S.swell(0.2, d - 0.2, 1.3));
    return room(S.drive(M([S.amp(g, S.swell(0.12, d * 0.8, 1.15)), 0, 0], [sub, 0, -5]), 1.4), 0.25, 0.6);
  },
});

def({
  name: "hw_tank_punch", group: "Монстры", variants: 2, level: -1,
  label: "Танк бьёт",
  desc: "Tank punch: a whooshing fist, then a huge dull body hit, a sub boom and splintering crack (Kenney Impact + synth)",
  make: (v, rng) => {
    const w = whoosh(rng, 0.25, 250, 1800, 1.5, 0.8, "pink");
    return room(S.drive(M(
      [w, 0, -8],
      [K(imp("impactPunch_heavy", v + 2), { t: 0.3, hp: 70, lp: 3500, rate: 0.7, dec: 0.2 }), 0.2, 0],
      [thump(75, 32, 0.12, 0.35, 0.5), 0.2, -1],
      [K(imp("impactWood_heavy", v), { t: 0.25, hp: 100, lp: 3000, rate: 0.7, dec: 0.14 }), 0.2, -6],
      [click(rng, 1500, 7000, 0.008), 0.2, -3]), 1.5), 0.2, 0.5);
  },
});

def({
  name: "hw_tank_grab", group: "Монстры", level: -2,
  label: "Танк хватает",
  desc: "Tank grab: a short guttural bark, a lunge whoosh, and a heavy clamp with creaking leather and a bone crunch",
  make: (_v, rng) => {
    const bark = S.amp(R.vocal(rng, { sec: 0.35, f0: S.expc(95, 60, 0.35), formants: [750, 1100, 2300], formantQ: 4, roughDepth: 0.6, roughHz: 30, breath: 0.3, lpHz: 2200, drive: 2.5 }), S.adsr(0.01, 0.04, 0.7, 0.2, 0.1));
    return room(M([bark, 0, -2], [whoosh(rng, 0.25, 300, 2000, 1.6, 0.8, "pink"), 0.05, -9],
      [K(imp("impactSoft_heavy", 0), { t: 0.2, lp: 1500, rate: 0.7, dec: 0.12 }), 0.3, 0], [thump(90, 40, 0.08, 0.2, 0.4), 0.3, -2],
      [S.amp(S.filter(S.noise(0.4, rng), "bp", S.path([[0, 600], [0.2, 1500], [0.4, 800]], "exp"), 10), S.swell(0.1, 0.3, 1)), 0.32, -10],
      [woodTick(rng, 700, 0.03), 0.4, -9]), 0.2, 0.4);
  },
});

def({
  name: "hw_tank_step", group: "Монстры", variants: 2, level: -2,
  label: "Шаг танка",
  desc: "Tank footstep: a heavy sub thud that shakes the floor, board slam and a rattle of the house (Kenney Impact + synth)",
  make: (v, rng) =>
    room(S.drive(M(
      [thump(pick([70, 60], v), 28, 0.15, 0.4, 0.5), 0, 0],
      [K(imp("impactWood_heavy", v + 1), { t: 0.3, hp: 60, lp: 2500, rate: 0.6, dec: 0.2 }), 0, -3],
      [K(imp("impactSoft_heavy", v), { t: 0.25, lp: 900, rate: 0.55, dec: 0.15 }), 0, -3],
      [S.filter(S.dust(0.4, rng, 120, 0.2), "bp", 2200, 1), 0.04, -17]), 1.4), 0.2, 0.5),
});

// ================================================================ WORLD

def({
  name: "hw_clock_strike", group: "Мир", level: -3, long: true, q: 5,
  label: "Часы: один удар",
  desc: "Grandfather clock, one strike: a bronze bell with inharmonic partials, a mallet clank and a long wooden-hall ring",
  make: (_v, rng) => clockStrike(rng, 1, 0),
});

def({
  name: "hw_clock_midnight", group: "Мир", level: -3, long: true, q: 6,
  label: "Часы: полночь (12 ударов)",
  desc: "Grandfather clock striking midnight: twelve strikes about two seconds apart, each ringing into the next, with a faint mechanism whirr before the first",
  make: (_v, rng) => {
    const gap = 2.15;
    const out = S.buf(0.8 + gap * 11 + 5);
    const whirr = S.amp(S.filter(S.noise(0.7, rng), "bp", 2200, 8), S.swell(0.5, 0.2, 1.5));
    S.addInto(out, S.norm(whirr), 0, 0.05);
    S.addInto(out, S.norm(S.amp(S.filter(S.noise(0.1, rng), "bp", 1400, 10), S.ad(0.001, 0.03))), S.ofs(0.7), 0.1);
    for (let k = 0; k < 12; k++) S.addInto(out, clockStrike(rng, 1, k), S.ofs(0.85 + k * gap), 0.9 + 0.1 * Math.sin(k));
    return out;
  },
});

/** One bell strike with its own detune/variation index. */
function clockStrike(rng: Rng, _unused: number, k: number): Buf {
  const f = 207 * (1 + 0.003 * Math.sin(k * 2.1));
  const bell = R.metalPartials(f, [0.5, 1, 1.19, 1.5, 2, 2.51, 3.01, 4.07, 5.43], [3.2, 2.8, 2.2, 1.9, 1.5, 1.1, 0.8, 0.5, 0.35], 5);
  const clank = M([metalTick(rng, 1800, 0.03), 0, 0], [click(rng, 900, 6000, 0.012), 0, -4], [thump(150, 90, 0.05, 0.1), 0, -8]);
  const w = S.mix([bell, 0, 1], [clank, 0, 0.6]);
  return room(w, 0.25, 1.2);
}

def({
  name: "hw_door_scratch", group: "Мир", variants: 2, level: -4,
  label: "Царапанье в дверь",
  desc: "Scratching at the door: claws dragged down old wood in slow raking strokes, with low taps of weight",
  make: (v, rng) => {
    const out: L[] = [];
    const n = pick([5, 4], v);
    let t = 0;
    for (let k = 0; k < n; k++) {
      const d = rng.range(0.3, 0.55);
      const rake = S.filter(S.noise(d, rng), "bp", S.path([[0, rng.range(1500, 2400)], [d, rng.range(900, 1600)]], "exp"), 2.2);
      const am = rng.range(45, 75);
      S.amp(rake, (tt) => (0.35 + 0.65 * Math.abs(Math.sin(Math.PI * am * tt))) * S.swell(d * 0.25, d * 0.7, 1.2)(tt));
      out.push([rake, t, -k * 0.5], [woodTick(rng, 140, 0.06), t + 0.02, -14]);
      t += d + rng.range(0.1, 0.35);
    }
    return room(M(...out), 0.15, 0.4);
  },
});

def({
  name: "hw_window_break", group: "Мир", variants: 2, level: -1,
  label: "Окно разбито",
  desc: "Window glass breaking inwards: a hard bang on the pane, heavy glass crash, a long cascade of shards and a wooden frame crack (Kenney Impact + synth)",
  make: (v, rng) => {
    const out: L[] = [
      [click(rng, 2000, 11000, 0.01), 0, 2],
      [K(imp("impactGlass_heavy", v), { t: 0.6, hp: 300, dec: 0.4 }), 0, 0],
      [K(imp("impactGlass_medium", v + 2), { t: 0.5, hp: 500, rate: 1.1, dec: 0.3 }), 0.03, -4],
      [thump(130, 60, 0.04, 0.1), 0, -7],
      [R.shards(rng, { sec: 1.6, count: 70, fLo: 2000, fHi: 10000, decayLo: 0.02, decayHi: 0.14, front: 1.8, ratioLo: 1.4, ratioHi: 3, fmIndex: 1.8 }), 0.02, -5],
      [K(imp("impactWood_heavy", v), { t: 0.2, hp: 200, lp: 4000, dec: 0.1 }), 0.05, -9],
    ];
    return room(M(...out), 0.3, 0.7);
  },
});

def({
  name: "hw_fireplace_burst", group: "Мир", variants: 2, level: -2,
  label: "Камин: вспышка (спавн)",
  desc: "Fireplace spawn: a gas whump, a roaring rising fire whoosh, scattering embers and crackle, a rumble in the chimney",
  make: (v, rng) => {
    const d = pick([1.3, 1.0], v);
    const roar = R.whoosh(rng, d, S.path([[0, 250], [0.25, 1800], [d, 600]], "exp"), 0.9, S.swell(0.12, d - 0.12, 1.3), "pink");
    const crackle = S.filter(S.dust(d + 0.3, rng, S.path([[0, 400], [0.3, 900], [d, 120]], "lin"), 0.2), "bp", 3500, 0.7);
    return room(S.drive(M(
      [thump(70, 35, 0.12, 0.35, 0.4), 0, -1],
      [roar, 0, 0],
      [crackle, 0, -4],
      [K(imp("impactSoft_heavy", v), { t: 0.2, lp: 700, rate: 0.7, dec: 0.12 }), 0, -6],
      [S.amp(S.filter(S.noise(d, rng, "brown"), "lp", 220), S.swell(0.1, d - 0.1, 1.2)), 0, -5]), 1.3), 0.2, 0.5);
  },
});

def({
  name: "hw_floor_crack", group: "Мир", variants: 2, level: -1,
  label: "Пол трескается (спавн)",
  desc: "Floor crack: planks splitting with a tearing crack, a heavy boom from below, falling dust and splinters (Kenney Impact + synth)",
  make: (v, rng) => {
    const tear = S.filter(S.dust(0.5, rng, S.path([[0, 700], [0.25, 300], [0.5, 40]], "lin"), 0.4), "bp", 2000, 0.9);
    return room(S.drive(M(
      [click(rng, 1500, 8000, 0.012), 0, 1],
      [K(imp("impactWood_heavy", v), { t: 0.3, hp: 90, lp: 5000, rate: 0.75, dec: 0.2 }), 0, -1],
      [K(imp("impactPlank_medium", v + 1), { t: 0.25, hp: 200, rate: 0.9, dec: 0.15 }), 0.05, -5],
      [thump(80, 32, 0.15, 0.5, 0.4), 0.02, -1],
      [tear, 0, -3],
      [S.amp(S.filter(S.noise(0.9, rng, "pink"), "bp", 1200, 0.6), S.ad(0.05, 0.5)), 0.1, -14]), 1.4), 0.25, 0.5);
  },
});

def({
  name: "hw_portcullis_crank_loop", group: "Мир", loop: true, level: -7,
  label: "Решётка: трещотка (луп)",
  desc: "Portcullis crank loop: a steady ratchet of heavy pawl clicks (8 per second) with a rattling chain and a low iron groan, seamless 1 s",
  make: (_v, rng) => {
    const L_ = 1;
    const out: L[] = [];
    for (let k = 0; k < 8; k++) {
      const t = k * 0.125;
      out.push([metalTick(rng, 1500 + (k % 2) * 250, 0.03), t, -(k % 2) * 2], [thump(190, 100, 0.03, 0.05), t, -8], [woodTick(rng, 260, 0.03), t + 0.012, -12]);
      out.push([S.amp(S.filter(S.dust(0.1, rng, 600, 0.3), "bp", 3500, 1), 1), t + 0.03, -16]);
    }
    const groan = S.amp(S.osc(L_ + 0.3, "saw", S.fitCycles(S.lfo(70, 6, 2), L_)), 1);
    S.filter(groan, "lp", 400);
    const clicks = M(...out);
    return S.loopWrap(S.mix([S.pad(clicks, 0.3), 0, 1], [S.norm(groan), 0, 0.12]), L_);
  },
});

def({
  name: "hw_gate_slide", group: "Мир", level: -3, long: true,
  label: "Решётка скользит",
  desc: "Gate sliding up: grinding iron in its guides, a squealing metal sweep, chain links shaking, the weight easing to a stop",
  make: (_v, rng) => {
    const d = 2.2;
    const grind = S.amp(S.filter(S.noise(d, rng), "bp", S.path([[0, 500], [d * 0.5, 900], [d, 600]], "exp"), 3), S.swell(0.2, d - 0.2, 1.1));
    const squeal = S.amp(S.fm(d, S.path([[0, 1400], [d * 0.5, 2100], [d, 1500]], "exp"), 1.5, 2), (t) => 0.4 * S.swell(0.3, d - 0.3, 1.3)(t) * (0.6 + 0.4 * Math.sin(t * 17)));
    const chain = S.filter(S.dust(d, rng, 90, 0.2), "bp", 3200, 3);
    return room(M([grind, 0, 0], [squeal, 0, -17], [chain, 0, -3], [S.amp(S.filter(S.noise(d, rng, "brown"), "lp", 180), S.swell(0.3, d - 0.3, 1.2)), 0, -5]), 0.25, 0.6);
  },
});

def({
  name: "hw_gate_slam", group: "Мир", level: -1,
  label: "Решётка падает",
  desc: "Gate slam: an iron portcullis crashing down onto stone, a huge boom with a ringing bar clang, bits of rattling chain and a hall echo (Kenney Impact + synth)",
  make: (_v, rng) => {
    const ring = R.metalPartials(310, [1, 1.7, 2.3, 3.4, 4.9], [1.4, 1.0, 0.7, 0.4, 0.3], 2);
    return room(S.drive(M(
      [click(rng, 1000, 8000, 0.012), 0, 1],
      [K(imp("impactMetal_heavy", 0), { t: 0.5, hp: 100, rate: 0.8, dec: 0.35 }), 0, 0],
      [K(imp("impactPlate_heavy", 1), { t: 0.5, hp: 150, rate: 0.7, dec: 0.4 }), 0.02, -3],
      [thump(75, 30, 0.14, 0.45, 0.6), 0, 0],
      [ring, 0.01, -7],
      [S.filter(S.dust(0.7, rng, S.path([[0, 400], [0.7, 20]], "lin"), 0.2), "bp", 3000, 2), 0.1, -9]), 1.3), 0.35, 1.0);
  },
});

def({
  name: "hw_letter_slip", group: "Мир", level: -5,
  label: "Письмо под дверь",
  desc: "A letter slipped under the door: paper hissing over wood, a slight scrape, then a soft final slap on the floor",
  make: (_v, rng) => {
    const slide = S.amp(S.filter(S.noise(0.7, rng, "pink"), "bp", S.path([[0, 3200], [0.4, 5000], [0.7, 2800]], "exp"), 0.8), (t) => S.swell(0.2, 0.45, 1.2)(t) * (0.7 + 0.3 * Math.sin(t * 40)));
    const lip = S.filter(S.dust(0.3, rng, 300, 0.3), "bp", 2200, 1.5);
    return room(M([slide, 0, 0], [lip, 0.05, -12], [K(imp("impactSoft_medium", 3), { t: 0.12, hp: 600, lp: 4500, rate: 1.5, dec: 0.05 }), 0.73, -7], [S.amp(S.filter(S.noise(0.08, rng), "bp", 4000, 1), S.ad(0.005, 0.04)), 0.72, -9]), 0.2, 0.4);
  },
});

def({
  name: "hw_chandelier_crash", group: "Мир", level: -1, long: true,
  label: "Люстра падает",
  desc: "Falling chandelier: a chain snap and creak, a plunging rush, then a colossal crash of iron and crystal with a storm of falling pieces and a long ring",
  make: (_v, rng) => {
    const t0 = 0.9;
    const pre = M([metalTick(rng, 2400, 0.03), 0, 0], [S.amp(S.filter(S.noise(0.6, rng), "bp", S.expc(500, 1200, 0.6), 8), S.swell(0.1, 0.4, 1)), 0.03, -9],
      [whoosh(rng, 0.45, 300, 2500, 1.5, 0.9, "pink"), 0.45, -4]);
    const crash = S.drive(M(
      [click(rng, 1000, 9000, 0.015), 0, 1],
      [K(imp("impactGlass_heavy", 0), { t: 0.7, hp: 300, dec: 0.5 }), 0, 0],
      [K(imp("impactGlass_heavy", 2), { t: 0.7, hp: 300, rate: 0.85, dec: 0.5 }), 0.04, -2],
      [K(imp("impactMetal_heavy", 1), { t: 0.6, hp: 120, rate: 0.8, dec: 0.4 }), 0, -1],
      [K(imp("impactWood_heavy", 3), { t: 0.4, hp: 100, rate: 0.7, dec: 0.2 }), 0.03, -5],
      [thump(75, 30, 0.14, 0.5, 0.6), 0, 0],
      [R.shards(rng, { sec: 2.2, count: 110, fLo: 1800, fHi: 10000, decayLo: 0.03, decayHi: 0.2, front: 1.7, ratioLo: 1.4, ratioHi: 3, fmIndex: 1.8 }), 0.02, -4],
      [R.metalPartials(520, [1, 1.58, 2.7, 3.9, 5.2], [1.6, 1.2, 0.9, 0.6, 0.4], 3), 0.02, -8]), 1.4);
    return room(S.mix([pre, 0, 1], [crash, t0, 1]), 0.35, 1.5);
  },
});

def({
  name: "hw_helicopter_approach", group: "Мир", level: -4, long: true, q: 5,
  label: "Вертолёт: приближение",
  desc: "Helicopter approach for the finale: from a far-off flutter to a thundering rotor chop and a turbine whine right overhead, 9 s",
  make: (_v, rng) => {
    const d = 9;
    const n = S.len(d);
    const out = new Float32Array(n);
    const noise = S.noise(d, rng, "pink");
    S.filter(noise, "lp", S.path([[0, 350], [d * 0.7, 1800], [d, 2600]], "exp"));
    const whine = S.osc(d, "saw", S.path([[0, 700], [d, 1000]], "lin"));
    S.filter(whine, "bp", S.path([[0, 800], [d, 1500]], "lin"), 4);
    const sub = S.osc(d, "sine", S.path([[0, 38], [d, 52]], "lin"));
    const body = S.filter(S.noise(d, rng, "brown"), "lp", 200);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / S.SR;
      ph += (12 + 8 * Math.min(1, t / d)) / S.SR;
      const pulse = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 3.5);
      const near = Math.pow(t / d, 1.9);
      const g = 0.04 + near;
      out[i] = (noise[i]! * (0.25 + 0.75 * pulse) * 1.2 + sub[i]! * pulse * 0.6 + body[i]! * 0.5 * near + whine[i]! * 0.06 * near * near) * g;
    }
    return room(out, 0.15, 0.8);
  },
});

// ================================================================ build

const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -120);
const fileName = (s: HwSound, v: number): string => (s.variants > 1 ? `${s.name}_v${v + 1}` : s.name);

function master(s: HwSound, raw: Buf): Buf {
  if (s.loop) return S.finishLoop(raw, s.level);
  if (s.long) {
    let x = S.trim(S.dcBlock(raw), -60, -66, 0.0005, 0.05);
    S.fadeIn(x, 0.002);
    S.fadeOut(x, 0.4);
    x = S.norm(x, S.dbToGain(s.level));
    return x;
  }
  return S.finishOneShot(raw, s.level, MAX_SHORT_RMS_DB);
}

async function main(): Promise<void> {
  const filters = process.argv.slice(2);
  mkdirSync(WAV_DIR, { recursive: true });
  const manifest: unknown[] = [];
  const jobs: { wav: string; out: string; q: number }[] = [];
  for (const s of SOUNDS) {
    for (let v = 0; v < s.variants; v++) {
      const name = fileName(s, v);
      const rng = new S.Rng(S.hashSeed(name));
      let b: Buf;
      const include = filters.length === 0 || filters.some((f) => s.name.includes(f));
      if (!include) continue;
      b = master(s, s.make(v, rng));
      for (let i = 0; i < b.length; i++) if (!Number.isFinite(b[i]!)) throw new Error(`${name}: non-finite sample`);
      const wav = join(WAV_DIR, `${name}.wav`);
      writeFileSync(wav, S.wav(b, new S.Rng(S.hashSeed(`${name}:dither`))));
      jobs.push({ wav, out: join(OUT_DIR, `${name}.mp3`), q: s.q ?? 4 });
      manifest.push({ file: `${name}.mp3`, group: s.group, name: s.name, label: s.label, desc: s.desc, variant: v + 1, variants: s.variants, loop: s.loop, seconds: S.seconds(b), peakDb: db(S.peak(b)), rmsDb: db(S.rms(b)), shortRmsDb: db(S.maxShortRms(b)) });
    }
  }
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(jobs.slice(i, i + 8).map(async (j) => {
      const p = Bun.spawn(["ffmpeg", "-y", "-loglevel", "error", "-i", j.wav, "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-q:a", String(j.q), j.out], { stderr: "pipe" });
      if ((await p.exited) !== 0) throw new Error(`ffmpeg failed for ${j.wav}: ${await new Response(p.stderr).text()}`);
    }));
  }
  // merge with the previous manifest so a filtered build keeps the other entries
  const mpath = join(HERE, "hw-manifest.json");
  let all = manifest as { file: string }[];
  if (filters.length > 0 && existsSync(mpath)) {
    const prev = JSON.parse(readFileSync(mpath, "utf8")) as { file: string }[];
    const keep = new Map(prev.map((e) => [e.file, e]));
    for (const e of all) keep.set(e.file, e);
    all = [...keep.values()];
  }
  writeFileSync(mpath, JSON.stringify(all, null, 1));
  for (const e of manifest as { file: string; seconds: number; peakDb: number; rmsDb: number; shortRmsDb: number }[])
    console.log(`${e.file.padEnd(34)} ${e.seconds.toFixed(2).padStart(6)} s  peak ${e.peakDb.toFixed(1).padStart(6)}  short-rms ${e.shortRmsDb.toFixed(1).padStart(6)}`);
  console.log(`${jobs.length} files`);
}

await main();
