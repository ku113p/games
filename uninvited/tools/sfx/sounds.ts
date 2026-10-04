// One definition per sound. Every number that shapes a sound sits in its `p` block; `render`
// only wires recipes and synth blocks together. Layers from recipes are normalized to peak 1,
// so the gains in a mix are relative peak levels. The final level is the `level` field (dBFS).

import * as S from "./synth.ts";
import * as R from "./recipes.ts";
import type { Buf, Layer, Rng } from "./synth.ts";

export type Category =
  | "Movement"
  | "Combat"
  | "Security"
  | "Hacking"
  | "Abilities"
  | "Interface"
  | "Voices"
  | "Real world";

export interface Sound {
  name: string;
  category: Category;
  desc: string;
  /** Files are name_v1..name_vN when greater than 1. */
  variants: number;
  /** Seamless loop: render returns the finished loop body. */
  loop: boolean;
  /** Peak level after normalization, dBFS. */
  level: number;
  /** Optional loudness match: loudest 50 ms RMS in dBFS (variants then sound equally loud). */
  loudness?: number;
  make: (v: number, rng: Rng) => Buf;
}

interface Def<P> {
  name: string;
  category: Category;
  desc: string;
  variants?: number;
  loop?: boolean;
  level?: number;
  loudness?: number;
  p: P;
  render: (p: P, v: number, rng: Rng) => Buf;
}

const sounds: Sound[] = [];
function def<P>(d: Def<P>): void {
  sounds.push({
    name: d.name,
    category: d.category,
    desc: d.desc,
    variants: d.variants ?? 1,
    loop: d.loop ?? false,
    level: d.level ?? -1,
    ...(d.loudness === undefined ? {} : { loudness: d.loudness }),
    make: (v, rng) => d.render(d.p, v, rng),
  });
}

/** A mix layer at an offset (seconds) and gain. */
const L = (b: Buf, offset = 0, gain = 1): Layer => [b, offset, gain];
/** Per-variant value. */
const V = <T>(xs: readonly T[], v: number): T => xs[v % xs.length]!;

// ================================================================ Movement

def({
  name: "footstep_run",
  category: "Movement",
  desc: "Soft digital thud on a glossy floor.",
  variants: 4,
  level: -5,
  loudness: -20,
  p: {
    pitch: [1, 0.92, 1.08, 0.96],
    thud: { f0: 200, f1: 80, sweep: 0.035, decay: 0.09 },
    gloss: { hz: [4200, 5200, 3700, 4700], q: 1.3, decay: 0.016, gain: 0.65 },
    digi: { hz: 1900, attack: 0.0005, decay: 0.022, bits: 5, hold: 3, gain: 0.16 },
    room: { size: 0.3, damp: 0.6, mix: 0.08, tail: 0.12 },
  },
  render: (p, v, rng) => {
    const k = V(p.pitch, v);
    const thud = R.kick(p.thud.f0 * k, p.thud.f1 * k, p.thud.sweep, p.thud.decay);
    const gloss = R.tick(rng, V(p.gloss.hz, v), p.gloss.q, p.gloss.decay);
    const digi = S.crush(R.blip("square", p.digi.hz * k, p.digi.attack, p.digi.decay), p.digi.bits, p.digi.hold);
    return S.reverb(S.mix(thud, L(gloss, 0, p.gloss.gain), L(digi, 0, p.digi.gain)), p.room);
  },
});

def({
  name: "footstep_sneak",
  category: "Movement",
  desc: "Quiet, muffled step for crouch-walking.",
  variants: 3,
  level: -7,
  loudness: -22,
  p: {
    pitch: [1, 0.93, 1.06],
    thud: { f0: 140, f1: 60, sweep: 0.03, decay: 0.07 },
    gloss: { hz: [2600, 3000, 2300], q: 1, decay: 0.012, gain: 0.9 },
    lpHz: 4000,
  },
  render: (p, v, rng) => {
    const k = V(p.pitch, v);
    const thud = R.kick(p.thud.f0 * k, p.thud.f1 * k, p.thud.sweep, p.thud.decay);
    const gloss = R.tick(rng, V(p.gloss.hz, v), p.gloss.q, p.gloss.decay);
    return S.filter(S.mix(thud, L(gloss, 0, p.gloss.gain)), "lp", p.lpHz);
  },
});

def({
  name: "jump",
  category: "Movement",
  desc: "Push-off thud with a rising chirp and a puff of air.",
  level: -4,
  p: {
    push: { f0: 170, f1: 70, sweep: 0.03, decay: 0.07, gain: 0.6 },
    chirp: { f0: 220, f1: 680, sweep: 0.14, attack: 0.005, decay: 0.2, gain: 0.45 },
    air: { sec: 0.22, f0: 700, f1: 3600, q: 1.5, rise: 0.06, fall: 0.15, gain: 0.45 },
    sparkle: { f0: 1320, f1: 1760, sweep: 0.1, attack: 0.004, decay: 0.12, gain: 0.12, at: 0.03 },
  },
  render: (p, _v, rng) => {
    const push = R.kick(p.push.f0, p.push.f1, p.push.sweep, p.push.decay);
    const chirp = R.blip("tri", S.expc(p.chirp.f0, p.chirp.f1, p.chirp.sweep), p.chirp.attack, p.chirp.decay);
    const a = p.air;
    const air = R.whoosh(rng, a.sec, S.expc(a.f0, a.f1, a.sec), a.q, S.swell(a.rise, a.fall));
    const sp = p.sparkle;
    const sparkle = R.blip("sine", S.expc(sp.f0, sp.f1, sp.sweep), sp.attack, sp.decay);
    return S.mix(L(push, 0, p.push.gain), L(chirp, 0, p.chirp.gain), L(air, 0, a.gain), L(sparkle, sp.at, sp.gain));
  },
});

def({
  name: "land",
  category: "Movement",
  desc: "Heavier landing thud with a glossy slap and a little digital crunch.",
  level: -3,
  p: {
    thud: { f0: 140, f1: 38, sweep: 0.07, decay: 0.2 },
    slap: { hz: 1800, q: 0.8, decay: 0.04, gain: 0.55 },
    gloss: { hz: 5000, q: 1.5, decay: 0.016, gain: 0.3 },
    crunch: { sec: 0.05, bits: 4, hold: 6, lpHz: 3000, gain: 0.18 },
    room: { size: 0.35, damp: 0.6, mix: 0.1, tail: 0.15 },
  },
  render: (p, _v, rng) => {
    const thud = R.kick(p.thud.f0, p.thud.f1, p.thud.sweep, p.thud.decay);
    const slap = R.tick(rng, p.slap.hz, p.slap.q, p.slap.decay);
    const gloss = R.tick(rng, p.gloss.hz, p.gloss.q, p.gloss.decay);
    const c = p.crunch;
    const crunch = S.filter(S.crush(S.amp(S.noise(c.sec, rng), S.ad(0.001, c.sec)), c.bits, c.hold), "lp", c.lpHz);
    return S.reverb(S.mix(thud, L(slap, 0, p.slap.gain), L(gloss, 0, p.gloss.gain), L(S.norm(crunch), 0, c.gain)), p.room);
  },
});

def({
  name: "dash",
  category: "Movement",
  desc: "Fast whoosh with an electric zip.",
  level: -2,
  p: {
    whoosh: { sec: 0.42, path: [[0, 500], [0.12, 4500], [0.42, 1200]] as const, q: 2.5, rise: 0.08, fall: 0.32, gain: 0.8 },
    zip: { f0: 300, f1: 2400, sweep: 0.1, ratio: 0.5, index: 2.5, drive: 3, hpHz: 400, decay: 0.16, ringHz: 90, gain: 0.5 },
    echo: { time: 0.06, feedback: 0.3, mix: 0.25, tail: 0.2 },
  },
  render: (p, _v, rng) => {
    const w = p.whoosh;
    const whoosh = R.whoosh(rng, w.sec, S.path(w.path, "exp"), w.q, S.swell(w.rise, w.fall, 1.5));
    const z = p.zip;
    let zip = S.fm(z.decay, S.expc(z.f0, z.f1, z.sweep), z.ratio, z.index);
    zip = S.filter(S.drive(zip, z.drive), "hp", z.hpHz);
    zip = S.norm(S.amp(S.ring(zip, z.ringHz, 0.5), S.ad(0.002, z.decay)));
    const e = p.echo;
    return S.echo(S.mix(L(whoosh, 0, w.gain), L(zip, 0, z.gain)), e.time, e.feedback, e.mix, e.tail);
  },
});

def({
  name: "crouch_toggle",
  category: "Movement",
  desc: "Small two-blip click when crouching or standing up.",
  level: -8,
  p: {
    notes: [760, 520],
    step: 0.045,
    /** Each later blip is this much quieter. */
    fall: 0.3,
    attack: 0.002,
    decay: 0.05,
    cloth: { hz: 1100, q: 0.8, sec: 0.09, gain: 0.35 },
  },
  render: (p, _v, rng) => {
    const blips = p.notes.map((f, k) => L(R.blip("tri", f, p.attack, p.decay), k * p.step, 1 - k * p.fall));
    const cloth = R.whoosh(rng, p.cloth.sec, p.cloth.hz, p.cloth.q, S.hann(p.cloth.sec), "pink");
    return S.mix(...blips, L(cloth, 0, p.cloth.gain));
  },
});

// ================================================================ Combat

def({
  name: "sword_swing",
  category: "Combat",
  desc: "Light-blade swoosh: resonant hum with doppler plus air.",
  variants: 3,
  level: -3,
  p: {
    sec: 0.38,
    peakAt: [0.09, 0.11, 0.08],
    air: { sweep: [[1200, 5200, 1800], [900, 4200, 1500], [1500, 6000, 2200]], q: 3.5, gain: 0.8 },
    hum: { f: [110, 98, 123], doppler: [1.25, 1.3, 1.2], end: 0.85, detune: 2.01, lp: [400, 3500, 500], q: 4, drive: 2, gain: 0.7 },
  },
  render: (p, v, rng) => {
    const pk = V(p.peakAt, v);
    const sw = V(p.air.sweep, v);
    const env = S.swell(pk, p.sec - pk, 1.5);
    const air = R.whoosh(rng, p.sec, S.path([[0, sw[0]!], [pk, sw[1]!], [p.sec, sw[2]!]], "exp"), p.air.q, env);
    const h = p.hum;
    const f = V(h.f, v);
    const pitch = S.path([[0, f * 0.95], [pk, f * V(h.doppler, v)], [p.sec, f * h.end]], "exp");
    let hum = S.mix(S.osc(p.sec, "saw", pitch), S.osc(p.sec, "saw", (t) => pitch(t) * h.detune));
    hum = S.filter(hum, "lp", S.path([[0, h.lp[0]!], [pk, h.lp[1]!], [p.sec, h.lp[2]!]], "exp"), h.q);
    hum = S.norm(S.amp(S.drive(S.norm(hum), h.drive), env));
    return S.mix(L(air, 0, p.air.gain), L(hum, 0, h.gain));
  },
});

def({
  name: "sword_hit",
  category: "Combat",
  desc: "Blade biting into a drone: crack, metallic ring, crunchy sizzle.",
  variants: 3,
  level: -1,
  p: {
    crack: { hz: [3500, 3000, 4200], q: 0.7, decay: 0.03, gain: 0.9 },
    ring: { f: [620, 700, 540], ratio: 1.414, index: 5, decay: 0.3, gain: 0.45 },
    thud: { f0: 150, f1: 50, sweep: 0.04, decay: 0.13, gain: 0.8 },
    crunch: { sec: 0.08, bits: 4, hold: 5, lpHz: 5000, gain: 0.45 },
    sizzle: { sec: 0.25, density: [[0, 3000], [0.2, 200]] as const, hz: 6000, q: 0.9, gain: 0.35 },
    drive: 2.5,
    room: { size: 0.4, damp: 0.5, mix: 0.1, tail: 0.2 },
  },
  render: (p, v, rng) => {
    const crack = R.tick(rng, V(p.crack.hz, v), p.crack.q, p.crack.decay);
    const ring = R.bell(V(p.ring.f, v), p.ring.ratio, p.ring.index, p.ring.decay);
    const thud = R.kick(p.thud.f0, p.thud.f1, p.thud.sweep, p.thud.decay);
    const c = p.crunch;
    const crunch = S.norm(S.filter(S.crush(S.amp(S.noise(c.sec, rng), S.ad(0.001, c.sec)), c.bits, c.hold), "lp", c.lpHz));
    const z = p.sizzle;
    const sizzle = R.sizzle(rng, z.sec, S.path(z.density), z.hz, z.q, S.ad(0.001, z.sec));
    const hit = S.mix(L(crack, 0, p.crack.gain), L(ring, 0, p.ring.gain), L(thud, 0, p.thud.gain), L(crunch, 0, c.gain), L(sizzle, 0, z.gain));
    return S.reverb(S.drive(S.norm(hit), p.drive), p.room);
  },
});

def({
  name: "derez",
  category: "Combat",
  desc: "An enemy shatters into light fragments: punch, glass-like shards, a dissolving digital sweep.",
  level: -1,
  p: {
    impact: { f0: 180, f1: 40, sweep: 0.1, decay: 0.28, gain: 1 },
    crack: { hz: 3000, q: 0.5, decay: 0.05, gain: 0.7 },
    shards: { sec: 1.1, count: 75, fLo: 1800, fHi: 9000, decayLo: 0.02, decayHi: 0.13, front: 2.2, ratioLo: 1.2, ratioHi: 3.7, fmIndex: 1.2, gain: 0.55 },
    dissolve: { sec: 0.85, f0: 1400, f1: 70, bits: [8, 3], hold: [1, 24], lpHz: 6000, gain: 0.3 },
    sub: { f0: 90, f1: 28, sweep: 0.5, decay: 0.7, gain: 0.6 },
    sparkle: { sec: 0.75, density: [[0, 4000], [0.6, 300]] as const, hz: 7000, q: 0.7, gain: 0.25 },
    drive: 1.5,
    room: { size: 0.8, damp: 0.4, mix: 0.3, tail: 1 },
  },
  render: (p, _v, rng) => {
    const impact = R.kick(p.impact.f0, p.impact.f1, p.impact.sweep, p.impact.decay);
    const crack = R.tick(rng, p.crack.hz, p.crack.q, p.crack.decay);
    const shards = R.shards(rng, p.shards);
    const d = p.dissolve;
    let dis = S.osc(d.sec, "square", S.expc(d.f0, d.f1, d.sec));
    dis = S.crush(dis, S.lin(d.bits[0]!, d.bits[1]!, d.sec), S.lin(d.hold[0]!, d.hold[1]!, d.sec));
    dis = S.norm(S.amp(S.filter(dis, "lp", d.lpHz), S.ad(0.002, d.sec)));
    const sub = R.kick(p.sub.f0, p.sub.f1, p.sub.sweep, p.sub.decay);
    const z = p.sparkle;
    const sparkle = R.sizzle(rng, z.sec, S.path(z.density), z.hz, z.q, S.ad(0.001, z.sec));
    const all = S.mix(
      L(impact, 0, p.impact.gain), L(crack, 0, p.crack.gain), L(shards, 0, p.shards.gain),
      L(dis, 0, d.gain), L(sub, 0, p.sub.gain), L(sparkle, 0, z.gain),
    );
    return S.reverb(S.drive(S.norm(all), p.drive), p.room);
  },
});

def({
  name: "rifle_shot",
  category: "Combat",
  desc: "Punchy energy rifle: crack, FM zap, sub punch, short slap.",
  variants: 3,
  level: -1,
  p: {
    zap: { f0: [1600, 1300, 1900], f1: [160, 140, 190], sweep: 0.09, decay: 0.18, ratio: 0.5, index: 3, gain: 0.7 },
    crack: { hz: 2500, q: 0.6, decay: 0.015, gain: 0.8 },
    body: { f0: 160, f1: 50, sweep: 0.05, decay: 0.13, gain: 0.9 },
    drive: 2.5,
    echo: { time: 0.07, feedback: 0.25, mix: 0.2, tail: 0.25 },
    room: { size: 0.5, damp: 0.5, mix: 0.12, tail: 0.3 },
  },
  render: (p, v, rng) => {
    const z = p.zap;
    const f = S.expc(V(z.f0, v), V(z.f1, v), z.sweep);
    const zap = S.norm(S.amp(S.mix(S.fm(z.decay, f, z.ratio, z.index), L(S.osc(z.decay, "saw", f), 0, 0.5)), S.ad(0.001, z.decay)));
    const crack = R.tick(rng, p.crack.hz, p.crack.q, p.crack.decay);
    const body = R.kick(p.body.f0, p.body.f1, p.body.sweep, p.body.decay);
    const shot = S.drive(S.norm(S.mix(L(zap, 0, z.gain), L(crack, 0, p.crack.gain), L(body, 0, p.body.gain))), p.drive);
    const e = p.echo;
    return S.reverb(S.echo(shot, e.time, e.feedback, e.mix, e.tail), p.room);
  },
});

def({
  name: "rifle_empty",
  category: "Combat",
  desc: "Dry double click with a tiny power-down blip.",
  level: -5,
  p: {
    clicks: [{ at: 0, hz: 3200, q: 2, decay: 0.006, gain: 1 }, { at: 0.045, hz: 2600, q: 2, decay: 0.008, gain: 0.8 }],
    down: { at: 0.01, f0: 420, f1: 180, sweep: 0.08, decay: 0.09, lpHz: 2000, gain: 0.25 },
  },
  render: (p, _v, rng) => {
    const clicks = p.clicks.map((c) => L(R.tick(rng, c.hz, c.q, c.decay), c.at, c.gain));
    const d = p.down;
    const down = R.blip("tri", S.expc(d.f0, d.f1, d.sweep), 0.002, d.decay, d.lpHz);
    return S.mix(...clicks, L(down, d.at, d.gain));
  },
});

def({
  name: "bullet_impact",
  category: "Combat",
  desc: "Energy bolt hitting a surface: crack, tap, sparks.",
  variants: 3,
  level: -4,
  p: {
    crack: { hz: [2400, 3000, 2000], q: 0.8, decay: 0.03, gain: 1 },
    tap: { f0: [240, 200, 280], f1: 80, sweep: 0.03, decay: 0.06, gain: 0.6 },
    sizzle: { sec: 0.16, density: [[0, 2500], [0.15, 100]] as const, hz: 5500, q: 1, gain: 0.4 },
    spark: { f: [3100, 3700, 2700], ratio: 2.7, index: 2, decay: 0.08, gain: 0.25 },
    bits: 7,
    hold: 2,
  },
  render: (p, v, rng) => {
    const crack = R.tick(rng, V(p.crack.hz, v), p.crack.q, p.crack.decay);
    const tap = R.kick(V(p.tap.f0, v), p.tap.f1, p.tap.sweep, p.tap.decay);
    const z = p.sizzle;
    const sizzle = R.sizzle(rng, z.sec, S.path(z.density), z.hz, z.q, S.ad(0.001, z.sec));
    const spark = R.bell(V(p.spark.f, v), p.spark.ratio, p.spark.index, p.spark.decay);
    const all = S.mix(L(crack, 0, p.crack.gain), L(tap, 0, p.tap.gain), L(sizzle, 0, z.gain), L(spark, 0, p.spark.gain));
    return S.crush(all, p.bits, p.hold);
  },
});

def({
  name: "player_hurt",
  category: "Combat",
  desc: "Hit on the player: thud plus a distorted, stuttering buzz.",
  variants: 2,
  level: -2,
  p: {
    thud: { f0: 110, f1: 45, sweep: 0.06, decay: 0.18, gain: 1 },
    buzz: { sec: 0.26, f0: [190, 150], f1: [90, 70], pw: 0.3, drive: 3, bits: 5, hold: 3, gateHz: [28, 22], lpHz: 3500, gain: 0.55 },
    burst: { hz: 1500, q: 0.5, decay: 0.05, gain: 0.6 },
  },
  render: (p, v, rng) => {
    const thud = R.kick(p.thud.f0, p.thud.f1, p.thud.sweep, p.thud.decay);
    const b = p.buzz;
    let buzz = S.osc(b.sec, "square", S.expc(V(b.f0, v), V(b.f1, v), b.sec), { pw: b.pw });
    buzz = S.crush(S.drive(buzz, b.drive), b.bits, b.hold);
    buzz = S.gate(S.filter(buzz, "lp", b.lpHz), V(b.gateHz, v), 0.6);
    buzz = S.norm(S.amp(buzz, S.ad(0.002, b.sec)));
    const burst = R.tick(rng, p.burst.hz, p.burst.q, p.burst.decay);
    return S.mix(L(thud, 0, p.thud.gain), L(buzz, 0, b.gain), L(burst, 0, p.burst.gain));
  },
});

def({
  name: "player_death",
  category: "Combat",
  desc: "Heavy impact, glitch burst and a long crushed power-down.",
  level: -1,
  p: {
    impact: { f0: 120, f1: 35, sweep: 0.1, decay: 0.45, gain: 1 },
    crack: { hz: 2000, q: 0.5, decay: 0.06, gain: 0.6 },
    down: { sec: 2, f0: 320, f1: 28, sweep: 1.6, detune: 1.012, lp: [5000, 150], q: 3, bits: [10, 3], hold: [1, 30], gain: 0.7 },
    glitch: { sec: 0.35, rate: 60, fLo: 200, fHi: 3000, note: 0.012, bits: 5, gain: 0.35 },
    room: { size: 0.85, damp: 0.5, mix: 0.25, tail: 1.2 },
  },
  render: (p, _v, rng) => {
    const impact = R.kick(p.impact.f0, p.impact.f1, p.impact.sweep, p.impact.decay);
    const crack = R.tick(rng, p.crack.hz, p.crack.q, p.crack.decay);
    const d = p.down;
    const f = S.expc(d.f0, d.f1, d.sweep);
    let down = S.mix(S.osc(d.sec, "saw", f), S.osc(d.sec, "saw", (t) => f(t) * d.detune));
    down = S.filter(down, "lp", S.expc(d.lp[0]!, d.lp[1]!, d.sweep), d.q);
    down = S.crush(S.norm(down), S.lin(d.bits[0]!, d.bits[1]!, d.sec), S.lin(d.hold[0]!, d.hold[1]!, d.sec));
    down = S.norm(S.amp(down, S.adsr(0.01, 0.3, 0.7, 1, 0.6)));
    const g = p.glitch;
    const glitch = S.norm(S.amp(S.crush(R.chatter(rng, g.sec, g.rate, g.fLo, g.fHi, g.note), g.bits), S.ad(0.001, g.sec)));
    const all = S.mix(L(impact, 0, p.impact.gain), L(crack, 0, p.crack.gain), L(down, 0, d.gain), L(glitch, 0, g.gain));
    return S.reverb(all, p.room);
  },
});

def({
  name: "shield_up",
  category: "Combat",
  desc: "Shield powering up: opening saw chord, rising sine, a soft lock ping.",
  level: -3,
  p: {
    sec: 0.9,
    pad: { freqs: [220, 330, 440], detune: 12, lp: [300, 6000, 0.35], rise: 0.3, fall: 0.55, gain: 0.55 },
    riser: { f0: 440, f1: 1760, sweep: 0.3, rise: 0.3, fall: 0.25, gain: 0.3 },
    shimmer: { f: 1760, ratio: 3.01, index: 1.5, gateHz: 24, floor: 0.4, rise: 0.3, fall: 0.4, gain: 0.18 },
    lock: { at: 0.3, f: 1760, ratio: 2, index: 1.5, decay: 0.45, gain: 0.5 },
    room: { size: 0.5, damp: 0.5, mix: 0.2, tail: 0.4 },
  },
  render: (p, _v, _rng) => {
    const a = p.pad;
    const pad = R.chord(a.freqs, "saw", p.sec, a.detune, S.expc(a.lp[0]!, a.lp[1]!, a.lp[2]!), S.swell(a.rise, a.fall, 1.5));
    const r = p.riser;
    const riser = S.norm(S.amp(S.osc(p.sec, "sine", S.expc(r.f0, r.f1, r.sweep)), S.swell(r.rise, r.fall)));
    const s = p.shimmer;
    const shimmer = S.norm(S.amp(S.gate(S.fm(p.sec, s.f, s.ratio, s.index), s.gateHz, 0.5, 0.004, s.floor), S.swell(s.rise, s.fall)));
    const k = p.lock;
    const lock = R.bell(k.f, k.ratio, k.index, k.decay);
    return S.reverb(S.mix(L(pad, 0, a.gain), L(riser, 0, r.gain), L(shimmer, 0, s.gain), L(lock, k.at, k.gain)), p.room);
  },
});

def({
  name: "shield_hit",
  category: "Combat",
  desc: "Energy deflection: metallic ping, wobbling buzz, ring-modulated crackle.",
  level: -2,
  p: {
    ping: { f: 1250, ratio: 2.76, index: 4, decay: 0.25, gain: 0.7 },
    buzz: { f: 85, gateHz: 25, lpHz: 1200, decay: 0.18, gain: 0.5 },
    crackle: { hz: 2500, q: 1, ringHz: 900, decay: 0.05, gain: 0.35 },
    thud: { f0: 200, f1: 80, sweep: 0.03, decay: 0.08, gain: 0.5 },
    drive: 1.5,
    lpHz: 9000,
  },
  render: (p, _v, rng) => {
    const ping = R.bell(p.ping.f, p.ping.ratio, p.ping.index, p.ping.decay);
    const b = p.buzz;
    const buzz = S.norm(S.amp(S.filter(S.gate(S.osc(b.decay, "saw", b.f), b.gateHz, 0.5), "lp", b.lpHz), S.ad(0.001, b.decay)));
    const c = p.crackle;
    const crackle = S.norm(S.ring(R.tick(rng, c.hz, c.q, c.decay), c.ringHz));
    const thud = R.kick(p.thud.f0, p.thud.f1, p.thud.sweep, p.thud.decay);
    const all = S.mix(L(ping, 0, p.ping.gain), L(buzz, 0, b.gain), L(crackle, 0, c.gain), L(thud, 0, p.thud.gain));
    return S.filter(S.drive(S.norm(all), p.drive), "lp", p.lpHz);
  },
});

def({
  name: "heal_tick",
  category: "Combat",
  desc: "Gentle bright blip, one per heal tick.",
  level: -10,
  p: {
    notes: [{ f: 1320, gain: 0.7 }, { f: 1980, gain: 0.4 }],
    glide: 1.06,
    sweep: 0.1,
    attack: 0.004,
    decay: 0.16,
    echo: { time: 0.05, feedback: 0.2, mix: 0.25, tail: 0.12 },
  },
  render: (p, _v, _rng) => {
    const notes = p.notes.map((n) => L(R.blip("sine", S.expc(n.f, n.f * p.glide, p.sweep), p.attack, p.decay), 0, n.gain));
    const e = p.echo;
    return S.echo(S.mix(...notes), e.time, e.feedback, e.mix, e.tail);
  },
});

// ================================================================ Security

def({
  name: "drone_hum_loop",
  category: "Security",
  desc: "Hovering security drone: low rotor hum with a thin whine.",
  loop: true,
  level: -12,
  p: {
    // All frequencies are whole cycles per loop (multiples of 1 / loop seconds).
    loop: 2,
    xfade: 0.25,
    base: { f: 80, lpHz: 500, q: 1.5, gain: 0.5 },
    octave: { f: 160, gain: 0.4 },
    beat: { f: 80.5, lpHz: 400, gain: 0.35 },
    rotor: { hz: 24, depth: 0.3 },
    whine: { f: 1240, vibHz: 3, vibDepth: 6, gain: 0.08 },
    air: { hz: 900, q: 2, gain: 0.25 },
  },
  render: (p, _v, rng) => {
    const sec = p.loop + p.xfade;
    const base = S.norm(S.filter(S.osc(sec, "saw", p.base.f), "lp", p.base.lpHz, p.base.q));
    const oct = S.osc(sec, "sine", p.octave.f);
    const beat = S.norm(S.filter(S.osc(sec, "saw", p.beat.f, { phase: 0.3 }), "lp", p.beat.lpHz));
    const whine = S.osc(sec, "sine", S.lfo(p.whine.f, p.whine.vibDepth, p.whine.vibHz));
    const air = S.norm(S.filter(S.noise(sec, rng), "bp", p.air.hz, p.air.q));
    const all = S.mix(L(base, 0, p.base.gain), L(oct, 0, p.octave.gain), L(beat, 0, p.beat.gain), L(whine, 0, p.whine.gain), L(air, 0, p.air.gain));
    S.amp(all, S.lfo(1 - p.rotor.depth, p.rotor.depth, p.rotor.hz));
    return S.loopXfade(all, p.loop, p.xfade, "lin");
  },
});

def({
  name: "drone_alert",
  category: "Security",
  desc: "A drone spots you: rising two-note crushed stinger.",
  level: -2,
  p: {
    note1: { f: 784, sec: 0.08, pw: 0.35 },
    note2: { at: 0.09, f0: 1175, f1: 1568, glide: 0.04, sec: 0.22, pw: 0.35 },
    lpHz: 5000,
    bits: 6,
    hold: 2,
    ringHz: 55,
    ringMix: 0.3,
    riser: { sec: 0.14, f0: 1000, f1: 5000, q: 2, rise: 0.08, fall: 0.06, gain: 0.3 },
    drive: 2,
    echo: { time: 0.09, feedback: 0.3, mix: 0.25, tail: 0.25 },
  },
  render: (p, _v, rng) => {
    const n1 = S.amp(S.osc(p.note1.sec, "square", p.note1.f, { pw: p.note1.pw }), S.adsr(0.002, 0.02, 0.8, p.note1.sec - 0.03, 0.008));
    const n = p.note2;
    const n2 = S.amp(S.osc(n.sec, "square", S.expc(n.f0, n.f1, n.glide), { pw: n.pw }), S.ad(0.002, n.sec));
    let tone = S.mix(n1, L(n2, n.at));
    tone = S.ring(S.crush(S.filter(tone, "lp", p.lpHz), p.bits, p.hold), p.ringHz, p.ringMix);
    const r = p.riser;
    const riser = R.whoosh(rng, r.sec, S.expc(r.f0, r.f1, r.sec), r.q, S.swell(r.rise, r.fall));
    const e = p.echo;
    return S.echo(S.drive(S.norm(S.mix(S.norm(tone), L(riser, 0, r.gain))), p.drive), e.time, e.feedback, e.mix, e.tail);
  },
});

def({
  name: "drone_shot",
  category: "Security",
  desc: "Drone laser: thin falling 'pew' with a click.",
  level: -3,
  p: {
    f0: 2600,
    f1: 380,
    sweep: 0.12,
    decay: 0.16,
    ratio: 1,
    index: 2,
    drive: 2,
    click: { hz: 4000, q: 0.8, decay: 0.01, gain: 0.5 },
    echo: { time: 0.06, feedback: 0.2, mix: 0.2, tail: 0.15 },
  },
  render: (p, _v, rng) => {
    const f = S.expc(p.f0, p.f1, p.sweep);
    const pew = S.norm(S.amp(S.mix(S.osc(p.decay, "saw", f), S.fm(p.decay, f, p.ratio, p.index)), S.ad(0.001, p.decay)));
    const click = R.tick(rng, p.click.hz, p.click.q, p.click.decay);
    const e = p.echo;
    return S.echo(S.drive(S.mix(pew, L(click, 0, p.click.gain)), p.drive), e.time, e.feedback, e.mix, e.tail);
  },
});

def({
  name: "camera_servo_loop",
  category: "Security",
  desc: "Security camera sweeping: servo whine rising and falling, gear chatter, motor hum.",
  loop: true,
  level: -16,
  p: {
    loop: 4,
    xfade: 0.3,
    // One sweep cycle per 2 s, chatter and hum at whole cycles per loop.
    whine: { f: 420, depth: 40, sweepHz: 0.5, octaveGain: 0.3, gain: 0.5 },
    chatter: { hz: 2600, q: 3, teethHz: 60, duty: 0.3, floor: 0.2, gain: 0.3 },
    hum: { f: 100, gain: 0.25, f2: 200, gain2: 0.1 },
    motion: { depth: 0.35 },
  },
  render: (p, _v, rng) => {
    const sec = p.loop + p.xfade;
    const w = p.whine;
    const wf = S.fitCycles(S.lfo(w.f, w.depth, w.sweepHz), p.loop);
    const whine = S.mix(S.osc(sec, "tri", wf), L(S.osc(sec, "sine", (t) => wf(t) * 2), 0, w.octaveGain));
    const c = p.chatter;
    const chatter = S.norm(S.gate(S.filter(S.noise(sec, rng), "bp", c.hz, c.q), c.teethHz, c.duty, 0.001, c.floor));
    const hum = S.mix(L(S.osc(sec, "sine", p.hum.f), 0, p.hum.gain), L(S.osc(sec, "sine", p.hum.f2), 0, p.hum.gain2));
    const moving = S.mix(L(S.norm(whine), 0, w.gain), L(chatter, 0, c.gain));
    // louder while the sweep is fast (middle of each pass)
    S.amp(moving, (t) => 1 - p.motion.depth + p.motion.depth * Math.abs(Math.cos(2 * Math.PI * w.sweepHz * t)));
    return S.loopXfade(S.mix(moving, hum), p.loop, p.xfade, "lin");
  },
});

def({
  name: "camera_spotted",
  category: "Security",
  desc: "Sharp detection sting: dissonant bright stab over a sub hit.",
  level: -1,
  p: {
    stab: { freqs: [1046.5, 1108.7, 1568], sec: 0.5, detune: 8, lp: [8000, 1500, 0.4], decay: 0.45, gain: 0.7 },
    crack: { hz: 5000, q: 0.5, decay: 0.02, gain: 0.6 },
    sub: { f0: 130, f1: 45, sweep: 0.08, decay: 0.35, gain: 0.8 },
    drive: 1.8,
    echo: { time: 0.12, feedback: 0.3, mix: 0.3, tail: 0.4 },
  },
  render: (p, _v, rng) => {
    const s = p.stab;
    const stab = R.chord(s.freqs, "saw", s.sec, s.detune, S.expc(s.lp[0]!, s.lp[1]!, s.lp[2]!), S.ad(0.002, s.decay));
    const crack = R.tick(rng, p.crack.hz, p.crack.q, p.crack.decay);
    const sub = R.kick(p.sub.f0, p.sub.f1, p.sub.sweep, p.sub.decay);
    const e = p.echo;
    const hit = S.drive(S.norm(S.mix(L(stab, 0, s.gain), L(crack, 0, p.crack.gain), L(sub, 0, p.sub.gain))), p.drive);
    return S.echo(hit, e.time, e.feedback, e.mix, e.tail);
  },
});

def({
  name: "sound_camera_ping",
  category: "Security",
  desc: "Sound camera listening pulse: sonar ping with echoes.",
  level: -5,
  p: {
    ping: { f0: 1500, f1: 1380, sweep: 0.4, decay: 0.5, gain: 1 },
    overtone: { f: 3000, decay: 0.15, gain: 0.2 },
    shimmer: { f: 1500, ratio: 1.5, index: 0.8, decay: 0.3, gain: 0.3 },
    echo: { time: 0.17, feedback: 0.45, mix: 0.5, tail: 0.9, damp: 3000 },
    room: { size: 0.7, damp: 0.5, mix: 0.15, tail: 0.6 },
  },
  render: (p, _v, _rng) => {
    const ping = R.blip("sine", S.expc(p.ping.f0, p.ping.f1, p.ping.sweep), 0.002, p.ping.decay);
    const over = R.blip("sine", p.overtone.f, 0.002, p.overtone.decay);
    const sh = R.bell(p.shimmer.f, p.shimmer.ratio, p.shimmer.index, p.shimmer.decay);
    const e = p.echo;
    const dry = S.mix(L(ping, 0, p.ping.gain), L(over, 0, p.overtone.gain), L(sh, 0, p.shimmer.gain));
    return S.reverb(S.echo(dry, e.time, e.feedback, e.mix, e.tail, e.damp), p.room);
  },
});

def({
  name: "motion_sensor_trip",
  category: "Security",
  desc: "Motion sensor tripped: relay click, electric snap, three fast beeps.",
  level: -3,
  p: {
    beeps: { f: 2093, count: 3, len: 0.028, step: 0.045, start: 0.03, lpHz: 5000, gain: 0.6 },
    relay: { hz: 1800, q: 1.5, decay: 0.01, gain: 0.7 },
    snap: { f: 220, ratio: 7.1, index: 4, decay: 0.12, gain: 0.35 },
  },
  render: (p, _v, rng) => {
    const b = p.beeps;
    const beep = S.amp(S.osc(b.len, "square", b.f), S.adsr(0.001, 0.004, 0.8, b.len - 0.009, 0.004));
    const beeps = Array.from({ length: b.count }, (_, k) => L(beep, b.start + k * b.step, b.gain));
    const relay = R.tick(rng, p.relay.hz, p.relay.q, p.relay.decay);
    const snap = S.norm(S.amp(S.fm(p.snap.decay, p.snap.f, p.snap.ratio, p.snap.index), S.ad(0.001, p.snap.decay)));
    return S.filter(S.mix(...beeps, L(relay, 0, p.relay.gain), L(snap, 0, p.snap.gain)), "lp", b.lpHz);
  },
});

def({
  name: "turret_shot",
  category: "Security",
  desc: "Heavy turret blast: crack, distorted body, sub, mechanical clack.",
  level: -1,
  p: {
    crack: { hz: 1800, q: 0.5, decay: 0.03, gain: 0.8 },
    body: { f0: 700, f1: 90, sweep: 0.12, decay: 0.22, pw: 0.3, drive: 3, lpHz: 4000, gain: 0.7 },
    sub: { f0: 110, f1: 35, sweep: 0.08, decay: 0.3, gain: 1 },
    clack: { at: 0.08, hz: 2200, q: 4, decay: 0.02, gain: 0.3 },
    room: { size: 0.5, damp: 0.5, mix: 0.12, tail: 0.4 },
  },
  render: (p, _v, rng) => {
    const crack = R.tick(rng, p.crack.hz, p.crack.q, p.crack.decay);
    const b = p.body;
    const f = S.expc(b.f0, b.f1, b.sweep);
    let body = S.mix(S.osc(b.decay, "saw", f), S.osc(b.decay, "square", f, { pw: b.pw }));
    body = S.norm(S.amp(S.filter(S.drive(body, b.drive), "lp", b.lpHz), S.ad(0.001, b.decay)));
    const sub = R.kick(p.sub.f0, p.sub.f1, p.sub.sweep, p.sub.decay);
    const clack = R.tick(rng, p.clack.hz, p.clack.q, p.clack.decay);
    return S.reverb(S.mix(L(crack, 0, p.crack.gain), L(body, 0, b.gain), L(sub, 0, p.sub.gain), L(clack, p.clack.at, p.clack.gain)), p.room);
  },
});

/** Two-tone alarm pattern shared by alarm_1 and alarm_2 (numbers come from each definition). */
interface AlarmP {
  tones: readonly number[];
  count: number;
  tone: number;
  gap: number;
  detune: number;
  lpHz: number;
  q: number;
  subGain: number;
  pw: number;
  drive: number;
  room: S.ReverbOpts;
}
function alarm(p: AlarmP): Buf {
  const step = p.tone + p.gap;
  const notes: Layer[] = [];
  for (let k = 0; k < p.count; k++) {
    const f = p.tones[k % p.tones.length]!;
    const saw = S.mix(S.osc(p.tone, "saw", f * S.semi(-p.detune / 100)), S.osc(p.tone, "saw", f * S.semi(p.detune / 100)));
    const sub = S.osc(p.tone, "square", f / 2, { pw: p.pw });
    const note = S.amp(S.mix(S.norm(saw), L(sub, 0, p.subGain)), S.adsr(0.008, 0.04, 0.85, p.tone - 0.08, 0.03));
    notes.push(L(note, k * step));
  }
  const all = S.filter(S.mix(...notes), "lp", p.lpHz, p.q);
  return S.reverb(S.drive(S.norm(all), p.drive), p.room);
}

def({
  name: "alarm_1",
  category: "Security",
  desc: "Alarm level 1: slow, low two-tone warning.",
  level: -3,
  p: { tones: [220, 156], count: 4, tone: 0.32, gap: 0.02, detune: 6, lpHz: 1400, q: 2, subGain: 0.4, pw: 0.5, drive: 1.5, room: { size: 0.4, damp: 0.5, mix: 0.12, tail: 0.4 } },
  render: (p) => alarm(p),
});

def({
  name: "alarm_2",
  category: "Security",
  desc: "Alarm level 2: faster, higher, more urgent two-tone.",
  level: -3,
  p: { tones: [330, 233], count: 8, tone: 0.12, gap: 0.015, detune: 8, lpHz: 2500, q: 2.5, subGain: 0.5, pw: 0.4, drive: 2.5, room: { size: 0.4, damp: 0.5, mix: 0.12, tail: 0.35 } },
  render: (p) => alarm(p),
});

def({
  name: "alarm_3_loop",
  category: "Security",
  desc: "Alarm level 3: aggressive rising siren over a pulsing low saw.",
  loop: true,
  level: -6,
  p: {
    loop: 1,
    xfade: 0.03,
    siren: { period: 0.5, f0: 520, f1: 1100, subGain: 0.4, lpHz: 4000, drive: 2.5, gain: 0.8 },
    pulse: { f: 110, rateHz: 8, duty: 0.5, lpHz: 600, gain: 0.45 },
  },
  render: (p, _v, _rng) => {
    const sec = p.loop + p.xfade;
    const s = p.siren;
    const sf = S.fitCycles((t) => s.f0 * Math.pow(s.f1 / s.f0, (t / s.period) % 1), p.loop);
    let siren = S.mix(S.osc(sec, "saw", sf), L(S.osc(sec, "square", (t) => sf(t) / 2), 0, s.subGain));
    siren = S.norm(S.drive(S.filter(S.norm(siren), "lp", s.lpHz), s.drive));
    const u = p.pulse;
    const pulse = S.norm(S.filter(S.gate(S.osc(sec, "saw", u.f), u.rateHz, u.duty, 0.004), "lp", u.lpHz));
    return S.loopXfade(S.mix(L(siren, 0, s.gain), L(pulse, 0, u.gain)), p.loop, p.xfade, "lin");
  },
});

def({
  name: "wave_spawn",
  category: "Security",
  desc: "Enemy wave materializes: rising noise and FM swell into a crushed minor stab.",
  level: -1,
  p: {
    hitAt: 0.6,
    riser: { f0: 300, f1: 7000, q: 3, power: 3, gain: 0.7 },
    tone: { f0: 110, f1: 880, ratio: 2, index: 3, lpHz: 3000, gain: 0.4 },
    stab: { freqs: [523.25, 622.25, 784], sec: 0.5, pw: 0.5, bits: 5, hold: 3, decay: 0.4, gain: 0.6 },
    shards: { sec: 0.6, count: 30, fLo: 2500, fHi: 8000, decayLo: 0.02, decayHi: 0.1, front: 1.6, ratioLo: 1.3, ratioHi: 3.3, fmIndex: 1, gain: 0.35 },
    sub: { f0: 100, f1: 35, sweep: 0.1, decay: 0.5, gain: 0.8 },
    room: { size: 0.7, damp: 0.5, mix: 0.2, tail: 0.6 },
  },
  render: (p, _v, rng) => {
    const h = p.hitAt;
    const r = p.riser;
    const riser = R.whoosh(rng, h + 0.1, S.expc(r.f0, r.f1, h), r.q, S.swell(h, 0.1, r.power));
    const t = p.tone;
    const tone = S.norm(S.amp(S.filter(S.fm(h + 0.1, S.expc(t.f0, t.f1, h), t.ratio, t.index), "lp", t.lpHz), S.swell(h, 0.1, 2)));
    const s = p.stab;
    const stab = S.mix(...s.freqs.map((f) => S.osc(s.sec, "square", f, { pw: s.pw })));
    const stabB = S.norm(S.amp(S.crush(S.norm(stab), s.bits, s.hold), S.ad(0.002, s.decay)));
    const shards = R.shards(rng, p.shards);
    const sub = R.kick(p.sub.f0, p.sub.f1, p.sub.sweep, p.sub.decay);
    const all = S.mix(L(riser, 0, r.gain), L(tone, 0, t.gain), L(stabB, h, s.gain), L(shards, h, p.shards.gain), L(sub, h, p.sub.gain));
    return S.reverb(all, p.room);
  },
});

def({
  name: "suspicion_rise",
  category: "Security",
  desc: "Short rising tone with a quickening tremolo: someone is getting suspicious.",
  level: -9,
  p: {
    sec: 0.55,
    f0: 380,
    f1: 950,
    triGain: 0.5,
    tremolo: { f0: 6, f1: 18, floor: 0.35 },
    lpHz: 3000,
  },
  render: (p, _v, _rng) => {
    const f = S.expc(p.f0, p.f1, p.sec);
    let b = S.mix(S.osc(p.sec, "sine", f), L(S.osc(p.sec, "tri", f), 0, p.triGain));
    b = S.gate(b, S.expc(p.tremolo.f0, p.tremolo.f1, p.sec), 0.5, 0.01, p.tremolo.floor);
    return S.amp(S.filter(b, "lp", p.lpHz), S.adsr(0.02, 0.05, 0.9, p.sec - 0.12, 0.05));
  },
});

// ================================================================ Hacking (the player's tools)

def({
  name: "scan_on",
  category: "Hacking",
  desc: "Scan mode on: rising sweep, shimmer, a confirming ping.",
  level: -4,
  p: {
    sweep: { f0: 300, f1: 1300, time: 0.18, decay: 0.25, octaveGain: 0.4, gain: 0.6 },
    shimmer: { sec: 0.32, f0: 1500, f1: 7000, q: 2, rise: 0.12, fall: 0.2, gain: 0.35 },
    ping: { at: 0.16, f: 2637, ratio: 2, index: 1, decay: 0.35, gain: 0.45 },
    echo: { time: 0.08, feedback: 0.25, mix: 0.25, tail: 0.25 },
  },
  render: (p, _v, rng) => {
    const s = p.sweep;
    const f = S.expc(s.f0, s.f1, s.time);
    const sweep = S.norm(S.amp(S.mix(S.osc(s.decay, "tri", f), L(S.osc(s.decay, "sine", (t) => f(t) * 2), 0, s.octaveGain)), S.ad(0.005, s.decay)));
    const h = p.shimmer;
    const shimmer = R.whoosh(rng, h.sec, S.expc(h.f0, h.f1, h.sec), h.q, S.swell(h.rise, h.fall));
    const g = p.ping;
    const ping = R.bell(g.f, g.ratio, g.index, g.decay);
    const e = p.echo;
    return S.echo(S.mix(L(sweep, 0, s.gain), L(shimmer, 0, h.gain), L(ping, g.at, g.gain)), e.time, e.feedback, e.mix, e.tail);
  },
});

def({
  name: "scan_off",
  category: "Hacking",
  desc: "Scan mode off: quick falling sweep.",
  level: -7,
  p: {
    sweep: { f0: 1300, f1: 280, time: 0.16, decay: 0.2, gain: 0.7 },
    air: { sec: 0.2, f0: 6000, f1: 1200, q: 2, rise: 0.03, fall: 0.17, gain: 0.3 },
    lpHz: 5000,
  },
  render: (p, _v, rng) => {
    const s = p.sweep;
    const sweep = R.blip("tri", S.expc(s.f0, s.f1, s.time), 0.003, s.decay);
    const a = p.air;
    const air = R.whoosh(rng, a.sec, S.expc(a.f0, a.f1, a.sec), a.q, S.swell(a.rise, a.fall));
    return S.filter(S.mix(L(sweep, 0, s.gain), L(air, 0, a.gain)), "lp", p.lpHz);
  },
});

def({
  name: "scan_overheat",
  category: "Hacking",
  desc: "Holding the scan too long: rising, increasingly distorted beeps and a hiss of heat.",
  level: -2,
  p: {
    beeps: { freqs: [1200, 1290, 1380, 1480, 1580], step: 0.1, len: 0.06, pw: 0.4, drive0: 1, driveStep: 1.2, lpHz: 4500, gain: 0.7 },
    steam: { sec: 0.65, hpHz: 3000, rise: 0.4, fall: 0.25, gain: 0.35 },
    grind: { sec: 0.65, f0: 80, f1: 120, bits: 4, hold: 4, lpHz: 2000, rise: 0.45, fall: 0.2, gain: 0.3 },
  },
  render: (p, _v, rng) => {
    const b = p.beeps;
    const beeps = b.freqs.map((f, k) => {
      const beep = S.amp(S.osc(b.len, "square", f, { pw: b.pw }), S.adsr(0.001, 0.01, 0.8, b.len - 0.016, 0.005));
      return L(S.norm(S.filter(S.drive(beep, b.drive0 + k * b.driveStep), "lp", b.lpHz)), k * b.step, b.gain);
    });
    const s = p.steam;
    const steam = S.norm(S.amp(S.filter(S.noise(s.sec, rng), "hp", s.hpHz), S.swell(s.rise, s.fall)));
    const g = p.grind;
    let grind = S.crush(S.osc(g.sec, "saw", S.expc(g.f0, g.f1, g.sec)), g.bits, g.hold);
    grind = S.norm(S.amp(S.filter(grind, "lp", g.lpHz), S.swell(g.rise, g.fall)));
    return S.mix(...beeps, L(steam, 0, s.gain), L(grind, 0, g.gain));
  },
});

def({
  name: "hack_start",
  category: "Hacking",
  desc: "Breaking in: data chatter and a rising sweep that locks on.",
  level: -3,
  p: {
    connect: 0.45,
    chatter: { rate: 45, fLo: 400, fHi: 3200, note: 0.016, bits: 6, gain: 0.45 },
    sweep: { f0: 200, f1: 1600, lp: [600, 6000], gain: 0.4 },
    lock: { f: 1760, decay: 0.12, gain: 0.5 },
    bell: { f: 3520, ratio: 2, index: 1, decay: 0.3, gain: 0.3 },
  },
  render: (p, _v, rng) => {
    const c = p.chatter;
    const sec = p.connect;
    const chatter = S.norm(S.amp(S.crush(R.chatter(rng, sec, c.rate, c.fLo, c.fHi, c.note), c.bits), S.lin(0.4, 1, sec)));
    const s = p.sweep;
    let sweep = S.filter(S.osc(sec + 0.1, "saw", S.expc(s.f0, s.f1, sec)), "lp", S.expc(s.lp[0]!, s.lp[1]!, sec));
    sweep = S.norm(S.amp(sweep, S.swell(sec, 0.1, 1)));
    const lock = R.blip("square", p.lock.f, 0.001, p.lock.decay);
    const bell = R.bell(p.bell.f, p.bell.ratio, p.bell.index, p.bell.decay);
    return S.mix(L(chatter, 0, c.gain), L(sweep, 0, s.gain), L(lock, sec, p.lock.gain), L(bell, sec, p.bell.gain));
  },
});

def({
  name: "hack_select",
  category: "Hacking",
  desc: "Picking a cell in the code grid: snappy key-press blip.",
  variants: 4,
  level: -6,
  loudness: -21,
  p: {
    click: { hz: 6000, q: 0.7, decay: 0.004, gain: 0.6 },
    blip: { f: [1175, 1319, 1480, 1568], drop: 0.94, time: 0.05, pw: 0.3, attack: 0.0008, decay: 0.07, lpHz: 6000, gain: 0.7 },
    thock: { decay: 0.04, gain: 0.4 },
  },
  render: (p, v, rng) => {
    const click = R.tick(rng, p.click.hz, p.click.q, p.click.decay);
    const b = p.blip;
    const f = V(b.f, v);
    const blip = S.norm(S.amp(S.filter(S.osc(b.decay, "square", S.expc(f, f * b.drop, b.time), { pw: b.pw }), "lp", b.lpHz), S.ad(b.attack, b.decay)));
    const thock = R.blip("sine", f / 2, 0.001, p.thock.decay);
    return S.mix(L(click, 0, p.click.gain), L(blip, 0, b.gain), L(thock, 0, p.thock.gain));
  },
});

def({
  name: "hack_correct",
  category: "Hacking",
  desc: "Right cell: bright two-note up-chirp.",
  level: -4,
  p: {
    notes: [{ f: 1047, at: 0 }, { f: 1568, at: 0.07 }],
    decay: 0.18,
    triGain: 0.5,
    sparkle: { at: 0.07, f: 3136, ratio: 2, index: 1, decay: 0.25, gain: 0.25 },
    echo: { time: 0.08, feedback: 0.2, mix: 0.2, tail: 0.2 },
  },
  render: (p, _v, _rng) => {
    const notes = p.notes.map((n) => L(S.norm(S.mix(R.blip("sine", n.f, 0.002, p.decay), L(R.blip("tri", n.f, 0.002, p.decay), 0, p.triGain))), n.at));
    const s = p.sparkle;
    const e = p.echo;
    return S.echo(S.mix(...notes, L(R.bell(s.f, s.ratio, s.index, s.decay), s.at, s.gain)), e.time, e.feedback, e.mix, e.tail);
  },
});

def({
  name: "hack_wrong",
  category: "Hacking",
  desc: "Wrong cell, time penalty: harsh crushed, stuttering buzz.",
  level: -2,
  p: {
    buzz: { sec: 0.3, f1: 110, f2: 116.5, bits: 4, hold: 6, drive: 3, lpHz: 2500, gain: 0.8 },
    stutter: { slice: 0.025, prob: 0.5, repeats: 3 },
    burst: { hz: 1200, q: 0.4, decay: 0.05, gain: 0.5 },
    zap: { f0: 800, f1: 120, sweep: 0.15, decay: 0.15, gain: 0.35 },
  },
  render: (p, _v, rng) => {
    const b = p.buzz;
    let buzz = S.mix(S.osc(b.sec, "square", b.f1), S.osc(b.sec, "square", b.f2));
    buzz = S.filter(S.drive(S.crush(S.norm(buzz), b.bits, b.hold), b.drive), "lp", b.lpHz);
    buzz = S.amp(buzz, S.adsr(0.002, 0.05, 0.8, b.sec - 0.1, 0.05));
    const st = p.stutter;
    buzz = S.norm(S.stutter(buzz, rng, st.slice, st.prob, st.repeats));
    const burst = R.tick(rng, p.burst.hz, p.burst.q, p.burst.decay);
    const z = p.zap;
    const zap = R.blip("saw", S.expc(z.f0, z.f1, z.sweep), 0.001, z.decay);
    return S.mix(L(buzz, 0, b.gain), L(burst, 0, p.burst.gain), L(zap, 0, z.gain));
  },
});

def({
  name: "hack_success",
  category: "Hacking",
  desc: "Hack done: glitch burst, fast major arpeggio, a wide bright chord.",
  level: -1,
  p: {
    glitch: { sec: 0.12, rate: 120, fLo: 300, fHi: 5000, note: 0.006, bits: 5, noiseBits: 3, noiseHold: 8, gain: 0.5, noiseGain: 0.35 },
    arp: { notes: [523.25, 659.25, 783.99, 1046.5], start: 0.1, step: 0.055, pw: 0.25, lpHz: 4000, decay: 0.25, gain: 0.5 },
    pad: { at: 0.3, freqs: [523.25, 659.25, 783.99, 1174.66], sec: 1.6, detune: 9, lp: [[0, 800], [0.15, 5000], [1.6, 1500]] as const, gain: 0.65 },
    bell: { at: 0.3, f: 2093, ratio: 2, index: 1.2, decay: 0.9, gain: 0.3 },
    sub: { at: 0.3, f0: 130, f1: 60, sweep: 0.05, decay: 0.25, gain: 0.5 },
    room: { size: 0.7, damp: 0.4, mix: 0.25, tail: 1 },
  },
  render: (p, _v, rng) => {
    const g = p.glitch;
    const chat = S.crush(R.chatter(rng, g.sec, g.rate, g.fLo, g.fHi, g.note), g.bits);
    const nz = S.norm(S.amp(S.crush(S.noise(g.sec, rng), g.noiseBits, g.noiseHold), S.ad(0.001, g.sec)));
    const a = p.arp;
    const arp = a.notes.map((f, k) => {
      const n = S.amp(S.filter(S.osc(a.decay, "square", f, { pw: a.pw }), "lp", a.lpHz), S.ad(0.002, a.decay));
      return L(S.norm(n), a.start + k * a.step, a.gain);
    });
    const d = p.pad;
    const pad = R.chord(d.freqs, "saw", d.sec, d.detune, S.path(d.lp, "exp"), S.adsr(0.02, 0.3, 0.6, 0.5, 0.6));
    const b = p.bell;
    const bell = R.bell(b.f, b.ratio, b.index, b.decay);
    const u = p.sub;
    const sub = R.kick(u.f0, u.f1, u.sweep, u.decay);
    const all = S.mix(L(S.norm(chat), 0, g.gain), L(nz, 0, g.noiseGain), ...arp, L(pad, d.at, d.gain), L(bell, b.at, b.gain), L(sub, u.at, u.gain));
    return S.reverb(all, p.room);
  },
});

def({
  name: "hack_fail",
  category: "Hacking",
  desc: "Hack failed: falling crushed notes over a power-down.",
  level: -2,
  p: {
    notes: { freqs: [659.25, 523.25, 415.3, 329.63], step: 0.1, pw: 0.4, lpHz: 2500, decay: 0.25, bits: 6, gain: 0.55 },
    down: { sec: 1, f0: 500, f1: 50, lp: [3000, 200], bits: [8, 3], gain: 0.5 },
    burst: { sec: 0.08, bits: 3, hold: 8, gain: 0.3 },
    room: { size: 0.5, damp: 0.5, mix: 0.15, tail: 0.6 },
  },
  render: (p, _v, rng) => {
    const n = p.notes;
    const notes = n.freqs.map((f, k) => {
      const b = S.crush(S.filter(S.osc(n.decay, "square", f, { pw: n.pw }), "lp", n.lpHz), n.bits);
      return L(S.norm(S.amp(b, S.ad(0.002, n.decay))), k * n.step, n.gain);
    });
    const d = p.down;
    let down = S.filter(S.osc(d.sec, "saw", S.expc(d.f0, d.f1, d.sec)), "lp", S.expc(d.lp[0]!, d.lp[1]!, d.sec));
    down = S.norm(S.amp(S.crush(S.norm(down), S.lin(d.bits[0]!, d.bits[1]!, d.sec)), S.adsr(0.005, 0.1, 0.8, d.sec - 0.4, 0.3)));
    const u = p.burst;
    const burst = S.norm(S.amp(S.crush(S.noise(u.sec, rng), u.bits, u.hold), S.ad(0.001, u.sec)));
    return S.reverb(S.mix(...notes, L(down, 0, d.gain), L(burst, 0, u.gain)), p.room);
  },
});

def({
  name: "hack_tick_loop",
  category: "Hacking",
  desc: "Tense hack timer: tick-tock with a low pulse, loops every second.",
  loop: true,
  level: -3,
  p: {
    loop: 1,
    tick: { at: 0, hz: 3200, q: 6, decay: 0.025, tone: 1600, toneDecay: 0.03, toneGain: 0.5, gain: 0.9 },
    tock: { at: 0.5, hz: 2400, q: 6, decay: 0.025, tone: 1200, toneDecay: 0.03, toneGain: 0.5, gain: 0.7 },
    pulse: { at: 0, f0: 70, f1: 50, sweep: 0.05, decay: 0.15, gain: 0.35 },
  },
  render: (p, _v, rng) => {
    const one = (c: typeof p.tick): Buf => S.norm(S.mix(R.tick(rng, c.hz, c.q, c.decay), L(R.blip("sine", c.tone, 0.0005, c.toneDecay), 0, c.toneGain)));
    const u = p.pulse;
    const all = S.mix(L(S.buf(p.loop)), L(one(p.tick), p.tick.at, p.tick.gain), L(one(p.tock), p.tock.at, p.tock.gain), L(R.kick(u.f0, u.f1, u.sweep, u.decay), u.at, u.gain));
    return S.loopWrap(all, p.loop);
  },
});

// ================================================================ Abilities (the AI's powers)

def({
  name: "camera_pause",
  category: "Abilities",
  desc: "Freeze a camera: falling filtered chord and crystalline pings.",
  level: -4,
  p: {
    freeze: { sec: 0.4, f0: 900, f1: 220, lp: [5000, 600], detune: 1.01, gain: 0.55 },
    pings: [{ at: 0, f: 2093, ratio: 1.5, index: 1, decay: 0.5, gain: 0.5 }, { at: 0.02, f: 3136, ratio: 2, index: 1, decay: 0.35, gain: 0.3 }],
    shards: { sec: 0.3, count: 12, fLo: 3000, fHi: 7000, decayLo: 0.02, decayHi: 0.06, front: 1.5, ratioLo: 1.5, ratioHi: 2.5, fmIndex: 0.8, gain: 0.2 },
    room: { size: 0.5, damp: 0.5, mix: 0.2, tail: 0.4 },
  },
  render: (p, _v, rng) => {
    const z = p.freeze;
    const f = S.expc(z.f0, z.f1, z.sec);
    let freeze = S.mix(S.osc(z.sec, "saw", f), S.osc(z.sec, "saw", (t) => f(t) * z.detune));
    freeze = S.norm(S.amp(S.filter(freeze, "lp", S.expc(z.lp[0]!, z.lp[1]!, z.sec)), S.ad(0.002, z.sec)));
    const pings = p.pings.map((g) => L(R.bell(g.f, g.ratio, g.index, g.decay), g.at, g.gain));
    return S.reverb(S.mix(L(freeze, 0, z.gain), ...pings, L(R.shards(rng, p.shards), 0, p.shards.gain)), p.room);
  },
});

def({
  name: "sensors_disable",
  category: "Abilities",
  desc: "Sensors shut down: three falling blips, an electric fizz-out, a thump.",
  level: -3,
  p: {
    blips: { freqs: [1568, 1175, 784], step: 0.08, pw: 0.3, decay: 0.07, lpHz: 5000, gain: 0.6 },
    fizz: { at: 0.2, sec: 0.8, density: [[0, 3000], [0.8, 0]] as const, hz: 4500, q: 0.8, gain: 0.4 },
    thump: { at: 0.24, f0: 120, f1: 45, sweep: 0.08, decay: 0.25, gain: 0.7 },
    down: { at: 0.24, f0: 400, f1: 60, sec: 0.5, gain: 0.35 },
  },
  render: (p, _v, rng) => {
    const b = p.blips;
    const blips = b.freqs.map((f, k) => L(S.norm(S.amp(S.filter(S.osc(b.decay, "square", f, { pw: b.pw }), "lp", b.lpHz), S.ad(0.001, b.decay))), k * b.step, b.gain));
    const z = p.fizz;
    const fizz = R.sizzle(rng, z.sec, S.path(z.density), z.hz, z.q, S.ad(0.002, z.sec));
    const t = p.thump;
    const d = p.down;
    const down = R.blip("sine", S.expc(d.f0, d.f1, d.sec), 0.002, d.sec);
    return S.mix(...blips, L(fizz, z.at, z.gain), L(R.kick(t.f0, t.f1, t.sweep, t.decay), t.at, t.gain), L(down, d.at, d.gain));
  },
});

def({
  name: "decoy_spawn",
  category: "Abilities",
  desc: "A hologram decoy flickers into being: shimmering FM rise and sparkles.",
  level: -4,
  p: {
    sec: 0.85,
    tone: { f0: 440, f1: 880, sweep: 0.5, ratio: 2.005, index: [2, 1.5, 7] as const, gateHz: 18, floor: 0.5, rise: 0.25, fall: 0.6, gain: 0.5 },
    sparkle: { sec: 0.7, count: 25, fLo: 2000, fHi: 8000, decayLo: 0.03, decayHi: 0.1, front: 1.2, ratioLo: 1.5, ratioHi: 3, fmIndex: 0.8, gain: 0.3 },
    air: { sec: 0.5, f0: 800, f1: 5000, q: 2, rise: 0.25, fall: 0.3, gain: 0.3 },
    echo: { time: 0.11, feedback: 0.3, mix: 0.25, tail: 0.4 },
  },
  render: (p, _v, rng) => {
    const t = p.tone;
    let tone = S.fm(p.sec, S.expc(t.f0, t.f1, t.sweep), t.ratio, S.lfo(t.index[0], t.index[1], t.index[2]));
    tone = S.norm(S.amp(S.gate(tone, t.gateHz, 0.5, 0.004, t.floor), S.swell(t.rise, t.fall, 1.5)));
    const a = p.air;
    const air = R.whoosh(rng, a.sec, S.expc(a.f0, a.f1, a.sec), a.q, S.swell(a.rise, a.fall));
    const e = p.echo;
    return S.echo(S.mix(L(tone, 0, t.gain), L(R.shards(rng, p.sparkle), 0, p.sparkle.gain), L(air, 0, a.gain)), e.time, e.feedback, e.mix, e.tail);
  },
});

def({
  name: "ammo_drop",
  category: "Abilities",
  desc: "Ammo appears: metallic chunk and two bright blips.",
  level: -3,
  p: {
    chunk: { f0: 300, f1: 120, sweep: 0.02, decay: 0.07, gain: 0.6 },
    metal: { hz: 2000, q: 3, decay: 0.05, gain: 0.5 },
    ring: { f: 1400, ratio: 1.41, index: 3, decay: 0.15, gain: 0.35 },
    blips: [{ at: 0.05, f: 1319, decay: 0.06 }, { at: 0.11, f: 1760, decay: 0.12 }],
    blipPw: 0.3,
    blipLp: 5000,
    blipGain: 0.5,
  },
  render: (p, _v, rng) => {
    const blips = p.blips.map((b) => L(S.norm(S.amp(S.filter(S.osc(b.decay, "square", b.f, { pw: p.blipPw }), "lp", p.blipLp), S.ad(0.001, b.decay))), b.at, p.blipGain));
    return S.mix(
      L(R.kick(p.chunk.f0, p.chunk.f1, p.chunk.sweep, p.chunk.decay), 0, p.chunk.gain),
      L(R.tick(rng, p.metal.hz, p.metal.q, p.metal.decay), 0, p.metal.gain),
      L(R.bell(p.ring.f, p.ring.ratio, p.ring.index, p.ring.decay), 0, p.ring.gain),
      ...blips,
    );
  },
});

def({
  name: "turret_deploy",
  category: "Abilities",
  desc: "Friendly turret unfolds: servo whir, clacks, power-on hum, ready beeps.",
  level: -2,
  p: {
    servo: { sec: 0.5, f0: 180, f1: 620, lpHz: 2500, gain: 0.45 },
    gears: { hz: 2200, q: 3, teethHz: 70, duty: 0.3, floor: 0.1, gain: 0.25 },
    clacks: { times: [0, 0.22, 0.48], hz: 2600, q: 5, decay: 0.03, gain: 0.5, knock: { f0: 400, f1: 200, sweep: 0.01, decay: 0.04, gain: 0.3 } },
    hum: { at: 0.5, sec: 0.6, f: 110, lp: [200, 2000], rise: 0.3, fall: 0.3, gain: 0.35 },
    beeps: [{ at: 0.75, f: 1568, decay: 0.06 }, { at: 0.83, f: 2093, decay: 0.12 }],
    beepGain: 0.4,
    room: { size: 0.4, damp: 0.5, mix: 0.1, tail: 0.3 },
  },
  render: (p, _v, rng) => {
    const s = p.servo;
    const env = S.adsr(0.02, 0.05, 0.8, s.sec - 0.15, 0.08);
    const servo = S.norm(S.amp(S.filter(S.osc(s.sec, "saw", S.expc(s.f0, s.f1, s.sec)), "lp", s.lpHz), env));
    const g = p.gears;
    const gears = S.norm(S.amp(S.gate(S.filter(S.noise(s.sec, rng), "bp", g.hz, g.q), g.teethHz, g.duty, 0.001, g.floor), env));
    const c = p.clacks;
    const clacks = c.times.flatMap((t) => [L(R.tick(rng, c.hz, c.q, c.decay), t, c.gain), L(R.kick(c.knock.f0, c.knock.f1, c.knock.sweep, c.knock.decay), t, c.knock.gain)]);
    const h = p.hum;
    const hum = S.norm(S.amp(S.filter(S.osc(h.sec, "saw", h.f), "lp", S.lin(h.lp[0]!, h.lp[1]!, h.rise)), S.swell(h.rise, h.fall)));
    const beeps = p.beeps.map((b) => L(R.blip("square", b.f, 0.001, b.decay), b.at, p.beepGain));
    return S.reverb(S.mix(L(servo, 0, s.gain), L(gears, 0, g.gain), ...clacks, L(hum, h.at, h.gain), ...beeps), p.room);
  },
});

def({
  name: "firewall_drop",
  category: "Abilities",
  desc: "A red firewall collapses: sub drop, crushed rumble, falling dissonant cluster, shards.",
  level: -1,
  p: {
    sub: { f0: 70, f1: 24, sweep: 0.8, decay: 1.6, gain: 1 },
    crack: { hz: 1500, q: 0.4, decay: 0.08, gain: 0.8 },
    rumble: { sec: 2.2, lp: [3000, 150, 1.8], drive: 3, gain: 0.6 },
    crunch: { sec: 1.2, bits: [5, 2], hold: [4, 40], lpHz: 6000, gain: 0.35 },
    cluster: { sec: 1.8, freqs: [392, 415.3, 466.16], drop: 0.15, lp: [5000, 300], bits: 6, slice: 0.03, prob: 0.25, gain: 0.45 },
    shards: { sec: 1.5, count: 45, fLo: 1200, fHi: 6000, decayLo: 0.03, decayHi: 0.15, front: 1.8, ratioLo: 1.2, ratioHi: 3.5, fmIndex: 1.4, gain: 0.35 },
    drive: 1.4,
    room: { size: 0.9, damp: 0.5, mix: 0.3, tail: 1.5, spread: 1.3 },
  },
  render: (p, _v, rng) => {
    const sub = R.kick(p.sub.f0, p.sub.f1, p.sub.sweep, p.sub.decay);
    const crack = R.tick(rng, p.crack.hz, p.crack.q, p.crack.decay);
    const r = p.rumble;
    const rumble = S.norm(S.amp(S.drive(S.norm(S.filter(S.noise(r.sec, rng, "brown"), "lp", S.expc(r.lp[0]!, r.lp[1]!, r.lp[2]!))), r.drive), S.ad(0.005, r.sec)));
    const c = p.crunch;
    let crunch = S.crush(S.noise(c.sec, rng), S.lin(c.bits[0]!, c.bits[1]!, c.sec), S.lin(c.hold[0]!, c.hold[1]!, c.sec));
    crunch = S.norm(S.amp(S.filter(crunch, "lp", c.lpHz), S.ad(0.003, c.sec)));
    const k = p.cluster;
    let cl = S.mix(...k.freqs.map((f) => S.osc(k.sec, "saw", S.expc(f, f * k.drop, k.sec))));
    cl = S.crush(S.norm(S.filter(cl, "lp", S.expc(k.lp[0]!, k.lp[1]!, k.sec))), k.bits);
    cl = S.norm(S.amp(S.stutter(cl, rng, k.slice, k.prob, 3), S.ad(0.01, k.sec)));
    const all = S.mix(L(sub, 0, p.sub.gain), L(crack, 0, p.crack.gain), L(rumble, 0, r.gain), L(crunch, 0, c.gain), L(cl, 0, k.gain), L(R.shards(rng, p.shards), 0, p.shards.gain));
    return S.reverb(S.drive(S.norm(all), p.drive), p.room);
  },
});

def({
  name: "checkpoint",
  category: "Abilities",
  desc: "Progress saved: warm two-note chime over a soft pad.",
  level: -3,
  p: {
    bells: [{ at: 0, f: 784 }, { at: 0.1, f: 1175 }],
    ratio: 2,
    index: 1.5,
    decay: 1,
    bellGain: 0.6,
    pad: { freqs: [392, 587.33], sec: 1, rise: 0.15, fall: 0.9, gain: 0.3 },
    room: { size: 0.7, damp: 0.5, mix: 0.25, tail: 0.9 },
  },
  render: (p, _v, _rng) => {
    const bells = p.bells.map((b) => L(R.bell(b.f, p.ratio, p.index, p.decay), b.at, p.bellGain));
    const a = p.pad;
    const pad = R.chord(a.freqs, "tri", a.sec, 0, 4000, S.swell(a.rise, a.fall));
    return S.reverb(S.mix(...bells, L(pad, 0, a.gain)), p.room);
  },
});

def({
  name: "artifact_pickup",
  category: "Abilities",
  desc: "Finding the letter or file: slow minor music-box arpeggio over a pad, long echoes. Meaningful, a little sad.",
  level: -3,
  p: {
    bells: { freqs: [440, 523.25, 659.25, 987.77], step: 0.14, ratio: 4, index: 1.2, decay: 1.6, gain: 0.6 },
    pad: { freqs: [220, 261.63, 329.63], sec: 2.4, detune: 7, lpHz: 1200, gain: 0.35 },
    air: { f: 1975.5, sec: 2, rise: 0.6, fall: 1.4, gain: 0.08 },
    echo: { time: 0.28, feedback: 0.35, mix: 0.25, tail: 0.8, damp: 3500 },
    room: { size: 0.85, damp: 0.5, mix: 0.3, tail: 1.5 },
  },
  render: (p, _v, _rng) => {
    const b = p.bells;
    const bells = b.freqs.map((f, k) => L(R.bell(f, b.ratio, b.index, b.decay), k * b.step, b.gain));
    const a = p.pad;
    const pad = R.chord(a.freqs, "saw", a.sec, a.detune, a.lpHz, S.adsr(0.4, 0.4, 0.7, a.sec - 1.6, 0.8));
    const r = p.air;
    const air = S.amp(S.osc(r.sec, "sine", r.f), S.swell(r.rise, r.fall, 1.5));
    const e = p.echo;
    return S.reverb(S.echo(S.mix(...bells, L(pad, 0, a.gain), L(air, 0, r.gain)), e.time, e.feedback, e.mix, e.tail, e.damp), p.room);
  },
});

def({
  name: "glitch",
  category: "Abilities",
  desc: "Short digital glitches for things breaking: v1 stutter, v2 bleep spray, v3 repeated sweep, v4 folded FM, v5 tape stop.",
  variants: 5,
  level: -3,
  p: {
    stutter: { sec: 0.14, hz: 2000, q: 0.7, bits: 3, hold: 10, slice: 0.02, prob: 0.7, repeats: 4 },
    spray: { sec: 0.15, rate: 90, fLo: 300, fHi: 6000, note: 0.008, bits: 5 },
    sweep: { sec: 0.06, f0: 2000, f1: 200, slice: 0.015, prob: 0.8, repeats: 3, gateHz: 40 },
    folded: { sec: 0.15, f: 180, ratio: 7.3, index: 6, fold: 2.5, bits: 6, hold: 3, gateHz: 25 },
    tape: { sec: 0.3, freqs: [440, 466.16], stop: 0.22, bits: 6, hpHz: 180, lpHz: 4000 },
  },
  render: (p, v, rng) => {
    switch (v) {
      case 0: {
        const s = p.stutter;
        const b = S.crush(S.norm(S.filter(S.noise(s.sec, rng), "bp", s.hz, s.q)), s.bits, s.hold);
        return S.stutter(S.amp(b, S.adsr(0.001, 0.02, 0.8, s.sec - 0.05, 0.02)), rng, s.slice, s.prob, s.repeats);
      }
      case 1: {
        const s = p.spray;
        return S.amp(S.crush(R.chatter(rng, s.sec, s.rate, s.fLo, s.fHi, s.note), s.bits), S.ad(0.001, s.sec));
      }
      case 2: {
        const s = p.sweep;
        const b = S.amp(S.osc(s.sec, "saw", S.expc(s.f0, s.f1, s.sec)), S.adsr(0.001, 0.005, 0.9, s.sec - 0.01, 0.004));
        return S.gate(S.stutter(b, rng, s.slice, s.prob, s.repeats), s.gateHz, 0.7);
      }
      case 3: {
        const s = p.folded;
        const b = S.crush(S.fold(S.fm(s.sec, s.f, s.ratio, s.index), s.fold), s.bits, s.hold);
        return S.amp(S.gate(b, s.gateHz, 0.6), S.ad(0.001, s.sec));
      }
      default: {
        const s = p.tape;
        const src = S.crush(S.norm(S.mix(...s.freqs.map((f) => S.osc(s.sec, "square", f)))), s.bits);
        const stopped = S.warp(src, S.lin(1, 0, s.stop));
        // fade with the speed, and keep the slowed-down steps from turning into low thumps
        return S.filter(S.filter(S.amp(stopped, S.lin(1, 0, s.stop)), "hp", s.hpHz), "lp", s.lpHz);
      }
    }
  },
});

// ================================================================ Interface

def({
  name: "ui_hover",
  category: "Interface",
  desc: "Tiny soft tick on hover/focus.",
  level: -13,
  p: { f: 2637, decay: 0.025, tick: { hz: 6000, q: 1, decay: 0.003, gain: 0.3 } },
  render: (p, _v, rng) => S.mix(R.blip("sine", p.f, 0.001, p.decay), L(R.tick(rng, p.tick.hz, p.tick.q, p.tick.decay), 0, p.tick.gain)),
});

def({
  name: "ui_click",
  category: "Interface",
  desc: "Button click.",
  level: -7,
  p: {
    tick: { hz: 4500, q: 0.8, decay: 0.004, gain: 0.7 },
    blip: { f: 1319, pw: 0.3, decay: 0.035, lpHz: 5000, gain: 0.6 },
    body: { f: 660, decay: 0.02, gain: 0.4 },
  },
  render: (p, _v, rng) => {
    const b = p.blip;
    const blip = S.norm(S.amp(S.filter(S.osc(b.decay, "square", b.f, { pw: b.pw }), "lp", b.lpHz), S.ad(0.0008, b.decay)));
    return S.mix(L(R.tick(rng, p.tick.hz, p.tick.q, p.tick.decay), 0, p.tick.gain), L(blip, 0, b.gain), L(R.blip("sine", p.body.f, 0.001, p.body.decay), 0, p.body.gain));
  },
});

def({
  name: "ui_back",
  category: "Interface",
  desc: "Back / cancel: two falling blips.",
  level: -7,
  p: { notes: [{ at: 0, f: 1047, gain: 1 }, { at: 0.045, f: 784, gain: 0.8 }], drop: 0.97, pw: 0.3, decay: 0.05, lpHz: 4000 },
  render: (p, _v, _rng) =>
    S.mix(...p.notes.map((n) => {
      const b = S.amp(S.filter(S.osc(p.decay, "square", S.expc(n.f, n.f * p.drop, p.decay), { pw: p.pw }), "lp", p.lpHz), S.ad(0.001, p.decay));
      return L(S.norm(b), n.at, n.gain);
    })),
});

def({
  name: "ui_confirm",
  category: "Interface",
  desc: "Confirm / accept: two rising blips with a sparkle.",
  level: -5,
  p: {
    notes: [{ at: 0, f: 1047, decay: 0.07 }, { at: 0.06, f: 1568, decay: 0.18 }],
    pw: 0.3,
    squareGain: 0.4,
    lpHz: 5000,
    sparkle: { at: 0.06, f: 3136, ratio: 2, index: 1, decay: 0.2, gain: 0.2 },
  },
  render: (p, _v, _rng) => {
    const notes = p.notes.map((n) => {
      const b = S.mix(S.osc(n.decay, "tri", n.f), L(S.osc(n.decay, "square", n.f, { pw: p.pw }), 0, p.squareGain));
      return L(S.norm(S.amp(S.filter(b, "lp", p.lpHz), S.ad(0.001, n.decay))), n.at);
    });
    const s = p.sparkle;
    return S.mix(...notes, L(R.bell(s.f, s.ratio, s.index, s.decay), s.at, s.gain));
  },
});

// ================================================================ Voices (text blips)

/** Vowel formant pairs [F1, F2] in Hz: a, e, i, o, u, eh. */
const VOWELS = [[800, 1200], [400, 2200], [300, 2700], [450, 800], [325, 700], [600, 1800]] as const;

interface VoiceP {
  /** Semitone offsets of the six syllables from the base pitch. */
  steps: readonly number[];
  /** Vowel index per syllable. */
  vowels: readonly number[];
  /** Multiplies the formant frequencies (brighter > 1). */
  formantScale: number;
  syl: Omit<R.SyllableP, "formants" | "pitch"> & { pitch: number };
  /** Optional digital grit: bitcrush and ring modulation. */
  crush?: { bits: number; hold: number };
  ringMod?: { hz: number; mix: number };
  /** Syllables (0-based) that get a tiny stutter. */
  stutterOn?: readonly number[];
  stutter?: { slice: number; prob: number };
}
function voice(p: VoiceP, v: number, rng: Rng): Buf {
  const vw = VOWELS[V(p.vowels, v)]!;
  let b = R.syllable({ ...p.syl, pitch: p.syl.pitch * S.semi(V(p.steps, v)), formants: [vw[0] * p.formantScale, vw[1] * p.formantScale] });
  if (p.crush) b = S.crush(b, p.crush.bits, p.crush.hold);
  if (p.ringMod) b = S.ring(b, p.ringMod.hz, p.ringMod.mix);
  if (p.stutter && p.stutterOn?.includes(v)) b = S.stutter(b, rng, p.stutter.slice, p.stutter.prob, 2);
  return b;
}

const syllableBase = { attack: 0.004, release: 0.016, dry: 0.25, f2Gain: 0.7, formantQ: 5 };

def({
  name: "voice_may",
  category: "Voices",
  desc: "May (the AI): bright, synthetic, slightly glitchy text blips.",
  variants: 6,
  level: -6,
  loudness: -17,
  p: {
    steps: [0, 3, -2, 5, 2, -4],
    vowels: [0, 1, 2, 5, 3, 1],
    formantScale: 1.15,
    syl: { ...syllableBase, pitch: 540, glide: 1.03, wave: "square", pw: 0.32, formantQ: 6, sec: 0.07, vibratoHz: 0, vibratoDepth: 0, lpHz: 7000 },
    crush: { bits: 7, hold: 2 },
    ringMod: { hz: 70, mix: 0.25 },
    stutterOn: [1, 4],
    stutter: { slice: 0.012, prob: 0.5 },
  } satisfies VoiceP,
  render: voice,
});

def({
  name: "voice_jim",
  category: "Voices",
  desc: "Jim: low, tired, falling text blips.",
  variants: 6,
  level: -6,
  loudness: -20.5,
  p: {
    steps: [0, -2, 1, -3, 2, -1],
    vowels: [0, 3, 5, 4, 1, 0],
    formantScale: 0.9,
    syl: { ...syllableBase, pitch: 135, glide: 0.93, wave: "saw", pw: 0.5, sec: 0.085, vibratoHz: 4, vibratoDepth: 0.01, lpHz: 3000, dry: 0.35 },
  } satisfies VoiceP,
  render: voice,
});

def({
  name: "voice_steve",
  category: "Voices",
  desc: "Steve: higher, nervous, jittery text blips.",
  variants: 6,
  level: -6,
  loudness: -17,
  p: {
    steps: [0, 2, 4, 1, 5, 3],
    vowels: [1, 2, 0, 5, 1, 3],
    formantScale: 1.1,
    syl: { ...syllableBase, pitch: 300, glide: 1.05, wave: "square", pw: 0.4, sec: 0.055, vibratoHz: 11, vibratoDepth: 0.025, lpHz: 5500 },
  } satisfies VoiceP,
  render: voice,
});

def({
  name: "voice_johnny",
  category: "Voices",
  desc: "Johnny: mid, flat, even text blips.",
  variants: 6,
  level: -6,
  loudness: -19.2,
  p: {
    steps: [0, 1, -1, 0, 1, -1],
    vowels: [0, 5, 3, 1, 0, 4],
    formantScale: 1,
    syl: { ...syllableBase, pitch: 200, glide: 1, wave: "saw", pw: 0.5, sec: 0.07, vibratoHz: 0, vibratoDepth: 0, lpHz: 3800 },
  } satisfies VoiceP,
  render: voice,
});

// ================================================================ Real world

def({
  name: "door_knock",
  category: "Real world",
  desc: "Three knocks on a thin wooden door.",
  level: -2,
  p: {
    times: [0, 0.19, 0.36],
    gains: [1, 0.85, 0.95],
    pitch: [1, 1.03, 0.98],
    modes: [180, 370, 640],
    q: 9,
    decay: 0.18,
    thumpHz: 95,
    lpHz: 3500,
    room: { size: 0.35, damp: 0.6, mix: 0.12, tail: 0.3 },
  },
  render: (p, _v, rng) => {
    const knocks = p.times.map((t, k) => L(R.knock(rng, p.modes.map((m) => m * p.pitch[k]!), p.q, p.decay, p.thumpHz), t, p.gains[k]));
    return S.reverb(S.filter(S.mix(...knocks), "lp", p.lpHz), p.room);
  },
});

def({
  name: "parcel_drop",
  category: "Real world",
  desc: "A cardboard parcel dropped on the floor, with a small bounce.",
  level: -2,
  p: {
    thud: { f0: 95, f1: 45, sweep: 0.05, decay: 0.2, gain: 1 },
    card: [{ hz: 700, q: 1.2, decay: 0.09, gain: 0.7 }, { hz: 1800, q: 2, decay: 0.05, gain: 0.3 }],
    bounce: { at: 0.11, f0: 110, f1: 60, sweep: 0.03, decay: 0.08, gain: 0.3, hz: 900, q: 1.2, noiseDecay: 0.04, noiseGain: 0.25 },
    room: { size: 0.3, damp: 0.6, mix: 0.1, tail: 0.25 },
  },
  render: (p, _v, rng) => {
    const card = p.card.map((c) => L(R.tick(rng, c.hz, c.q, c.decay, "pink"), 0, c.gain));
    const b = p.bounce;
    return S.reverb(S.mix(
      L(R.kick(p.thud.f0, p.thud.f1, p.thud.sweep, p.thud.decay), 0, p.thud.gain), ...card,
      L(R.kick(b.f0, b.f1, b.sweep, b.decay), b.at, b.gain), L(R.tick(rng, b.hz, b.q, b.noiseDecay, "pink"), b.at, b.noiseGain),
    ), p.room);
  },
});

def({
  name: "water_drink",
  category: "Real world",
  desc: "Three gulps of water.",
  level: -6,
  p: {
    gulps: [{ at: 0, f: 260 }, { at: 0.42, f: 240 }, { at: 0.85, f: 275 }],
    bubble: { rise: 1.6, decay: 0.07, gain: 0.8 },
    throat: { f0: 120, f1: 70, sweep: 0.03, decay: 0.1, gain: 0.6 },
    swish: { hz: 500, q: 0.8, sec: 0.12, gain: 0.25 },
    small: { count: 2, fLo: 600, fHi: 900, rise: 0.8, decay: 0.03, delayLo: 0.02, delayHi: 0.15, gain: 0.25 },
    lpHz: 4000,
  },
  render: (p, _v, rng) => {
    const layers: Layer[] = [];
    for (const g of p.gulps) {
      layers.push(L(R.bubble(g.f, p.bubble.rise, p.bubble.decay), g.at, p.bubble.gain));
      layers.push(L(R.kick(p.throat.f0, p.throat.f1, p.throat.sweep, p.throat.decay), g.at, p.throat.gain));
      layers.push(L(R.whoosh(rng, p.swish.sec, p.swish.hz, p.swish.q, S.hann(p.swish.sec), "pink"), g.at, p.swish.gain));
      for (let k = 0; k < p.small.count; k++) {
        const s = p.small;
        layers.push(L(R.bubble(rng.range(s.fLo, s.fHi), s.rise, s.decay), g.at + rng.range(s.delayLo, s.delayHi), s.gain));
      }
    }
    return S.filter(S.mix(...layers), "lp", p.lpHz);
  },
});

def({
  name: "eat",
  category: "Real world",
  desc: "Crunchy bites and chewing.",
  level: -5,
  p: {
    bites: [{ at: 0, gain: 1 }, { at: 0.24, gain: 0.6 }, { at: 0.5, gain: 0.55 }, { at: 0.78, gain: 0.5 }],
    crunch: { sec: 0.09, density: 1800, hz: 2800, q: 0.7 },
    mush: { hz: 1200, q: 1, sec: 0.07, gain: 0.4 },
    jaw: { f0: 140, f1: 90, sweep: 0.02, decay: 0.05, gain: 0.3 },
    lpHz: 6000,
  },
  render: (p, _v, rng) => {
    const layers = p.bites.flatMap((b) => {
      const c = p.crunch;
      const crunch = R.sizzle(rng, c.sec, c.density, c.hz, c.q, S.hann(c.sec));
      const mush = R.whoosh(rng, p.mush.sec, p.mush.hz, p.mush.q, S.hann(p.mush.sec));
      const j = p.jaw;
      return [L(crunch, b.at, b.gain), L(mush, b.at, b.gain * p.mush.gain), L(R.kick(j.f0, j.f1, j.sweep, j.decay), b.at, b.gain * j.gain)];
    });
    return S.filter(S.mix(...layers), "lp", p.lpHz);
  },
});

def({
  name: "tablet_on",
  category: "Real world",
  desc: "Tablet wakes up: soft click and a gentle two-note chime.",
  level: -7,
  p: {
    click: { hz: 3000, q: 1, decay: 0.005, gain: 0.4 },
    notes: [{ at: 0.02, f: 660 }, { at: 0.1, f: 990 }],
    attack: 0.01,
    decay: 0.35,
    noteGain: 0.6,
    pad: { freqs: [660, 990, 1320], sec: 0.5, attack: 0.05, hold: 0.15, release: 0.2, gain: 0.3 },
    room: { size: 0.3, damp: 0.6, mix: 0.1, tail: 0.25 },
  },
  render: (p, _v, rng) => {
    const notes = p.notes.map((n) => L(R.blip("sine", n.f, p.attack, p.decay), n.at, p.noteGain));
    const a = p.pad;
    const pad = R.chord(a.freqs, "sine", a.sec, 0, 6000, S.adsr(a.attack, 0.1, 0.6, a.hold, a.release));
    return S.reverb(S.mix(L(R.tick(rng, p.click.hz, p.click.q, p.click.decay), 0, p.click.gain), ...notes, L(pad, 0, a.gain)), p.room);
  },
});

def({
  name: "tablet_swipe",
  category: "Real world",
  desc: "Finger swipe on glass.",
  level: -12,
  p: { sec: 0.18, f0: 1200, f1: 4000, q: 0.9 },
  render: (p, _v, rng) => R.whoosh(rng, p.sec, S.expc(p.f0, p.f1, p.sec), p.q, S.hann(p.sec), "pink"),
});

def({
  name: "jack_in",
  category: "Real world",
  desc: "Jacking in: a strong rising whoosh and saw cluster that slams into the digital world.",
  level: -1,
  p: {
    hit: 1.8,
    noise: { f0: 150, f1: 9000, q: [1, 4], power: 1.8, gain: 0.7 },
    cluster: { freqs: [55, 82.5, 110.5], rise: 16, lp: [300, 8000], q: 3, trem: [4, 40], floor: 0.3, gain: 0.5 },
    slam: { f0: 160, f1: 40, sweep: 0.1, decay: 0.5, gain: 1 },
    burst: { sec: 0.2, bits: 4, hold: 6, gain: 0.5 },
    stab: { freqs: [440, 659.25, 880, 1318.5], sec: 0.9, detune: 10, lp: [9000, 1500, 0.6], decay: 0.9, gain: 0.55 },
    shards: { sec: 0.8, count: 40, fLo: 2000, fHi: 9000, decayLo: 0.03, decayHi: 0.12, front: 1.8, ratioLo: 1.3, ratioHi: 3.3, fmIndex: 1.2, gain: 0.35 },
    room: { size: 0.8, damp: 0.5, mix: 0.25, tail: 1 },
  },
  render: (p, _v, rng) => {
    const h = p.hit;
    const sec = h + 0.15;
    const n = p.noise;
    const noise = R.whoosh(rng, sec, S.expc(n.f0, n.f1, h), S.lin(n.q[0]!, n.q[1]!, h), S.swell(h, 0.15, n.power));
    const c = p.cluster;
    let cl = S.mix(...c.freqs.map((f) => S.osc(sec, "saw", S.expc(f, f * c.rise, h))));
    cl = S.filter(S.norm(cl), "lp", S.expc(c.lp[0]!, c.lp[1]!, h), c.q);
    cl = S.norm(S.amp(S.gate(cl, S.expc(c.trem[0]!, c.trem[1]!, h), 0.5, 0.003, c.floor), S.swell(h, 0.1, 2)));
    const b = p.burst;
    const burst = S.norm(S.amp(S.crush(S.noise(b.sec, rng), b.bits, b.hold), S.ad(0.001, b.sec)));
    const s = p.stab;
    const stab = R.chord(s.freqs, "saw", s.sec, s.detune, S.expc(s.lp[0]!, s.lp[1]!, s.lp[2]!), S.ad(0.003, s.decay));
    const sl = p.slam;
    const all = S.mix(
      L(noise, 0, n.gain), L(cl, 0, c.gain), L(R.kick(sl.f0, sl.f1, sl.sweep, sl.decay), h, sl.gain),
      L(burst, h, b.gain), L(stab, h, s.gain), L(R.shards(rng, p.shards), h, p.shards.gain),
    );
    return S.reverb(all, p.room);
  },
});

def({
  name: "jack_out",
  category: "Real world",
  desc: "Jacking out: a glitch burst, everything falls and crushes away, a soft thump back in the room.",
  level: -1,
  p: {
    fall: 1.4,
    glitch: { sec: 0.2, rate: 100, fLo: 500, fHi: 6000, note: 0.007, bits: 5, gain: 0.5 },
    cluster: { freqs: [880, 1318.5, 1760], drop: 1 / 16, lp: [8000, 200], bits: [9, 3], hold: [1, 12], gain: 0.55 },
    whoosh: { f0: 8000, f1: 150, q: 2, rise: 0.05, gain: 0.5 },
    thump: { f0: 90, f1: 40, sweep: 0.06, decay: 0.35, gain: 0.7 },
    room: { size: 0.4, damp: 0.6, mix: 0.15, tail: 0.6 },
  },
  render: (p, _v, rng) => {
    const fl = p.fall;
    const g = p.glitch;
    const glitch = S.norm(S.amp(S.crush(R.chatter(rng, g.sec, g.rate, g.fLo, g.fHi, g.note), g.bits), S.ad(0.001, g.sec)));
    const c = p.cluster;
    let cl = S.mix(...c.freqs.map((f) => S.osc(fl + 0.2, "saw", S.expc(f, f * c.drop, fl))));
    cl = S.filter(S.norm(cl), "lp", S.expc(c.lp[0]!, c.lp[1]!, fl));
    cl = S.crush(cl, S.lin(c.bits[0]!, c.bits[1]!, fl), S.lin(c.hold[0]!, c.hold[1]!, fl));
    cl = S.norm(S.amp(cl, S.adsr(0.005, 0.2, 0.7, fl - 0.6, 0.4)));
    const w = p.whoosh;
    const whoosh = R.whoosh(rng, fl, S.expc(w.f0, w.f1, fl), w.q, S.swell(w.rise, fl, 1));
    const t = p.thump;
    return S.reverb(S.mix(L(glitch, 0, g.gain), L(cl, 0, c.gain), L(whoosh, 0, w.gain), L(R.kick(t.f0, t.f1, t.sweep, t.decay), fl, t.gain)), p.room);
  },
});

def({
  name: "explosion",
  category: "Real world",
  desc: "The sad ending: a big blast, long rumble, falling debris, then a faint ringing in the ears.",
  level: -1,
  p: {
    crack: { hz: 1200, q: 0.3, decay: 0.08, gain: 0.9 },
    blast: { sec: 0.25, lpHz: 6000, gain: 0.7 },
    boom: { f0: 60, f1: 22, sweep: 0.6, decay: 2, gain: 1 },
    rumble: { sec: 3.2, lp: [1500, 120, 3], drive: 2, gain: 0.7 },
    debris: { sec: 3, density: [[0, 800], [1.5, 60], [3, 5]] as const, hz: 2500, q: 0.6, gain: 0.25 },
    ringing: { f: 3950, sec: 3.8, env: [[0, 0], [0.6, 0], [1.4, 1], [3.8, 0]] as const, gain: 0.035 },
    room: { size: 0.9, damp: 0.6, mix: 0.3, tail: 1.5, spread: 1.4 },
  },
  render: (p, _v, rng) => {
    const b = p.blast;
    const blast = S.norm(S.amp(S.filter(S.noise(b.sec, rng), "lp", b.lpHz), S.ad(0.001, b.sec)));
    const r = p.rumble;
    const rumble = S.norm(S.amp(S.drive(S.norm(S.filter(S.noise(r.sec, rng, "brown"), "lp", S.expc(r.lp[0]!, r.lp[1]!, r.lp[2]!))), r.drive), S.ad(0.01, r.sec)));
    const d = p.debris;
    const debris = R.sizzle(rng, d.sec, S.path(d.density), d.hz, d.q, S.ad(0.05, d.sec));
    const g = p.ringing;
    const ringing = S.amp(S.osc(g.sec, "sine", g.f), S.path(g.env));
    const all = S.mix(
      L(R.tick(rng, p.crack.hz, p.crack.q, p.crack.decay), 0, p.crack.gain), L(blast, 0, b.gain),
      L(R.kick(p.boom.f0, p.boom.f1, p.boom.sweep, p.boom.decay), 0, p.boom.gain), L(rumble, 0, r.gain), L(debris, 0, d.gain),
    );
    // the ringing stays dry so it reads as "inside your head"
    return S.mix(S.reverb(all, p.room), L(ringing, 0, g.gain));
  },
});

def({
  name: "cash_rustle",
  category: "Real world",
  desc: "Paper money being handled.",
  level: -6,
  p: {
    sec: 0.9,
    density: [[0, 0], [0.05, 2500], [0.3, 600], [0.45, 2200], [0.7, 400], [0.9, 0]] as const,
    crackle: { hz: 3200, q: 0.8, hpHz: 1500 },
    hiss: { hz: 4500, q: 1, env: [[0, 0], [0.06, 1], [0.3, 0.3], [0.45, 0.9], [0.9, 0]] as const, gain: 0.25 },
  },
  render: (p, _v, rng) => {
    const crackle = S.filter(R.sizzle(rng, p.sec, S.path(p.density), p.crackle.hz, p.crackle.q, 1), "hp", p.crackle.hpHz);
    const hiss = R.whoosh(rng, p.sec, p.hiss.hz, p.hiss.q, S.path(p.hiss.env));
    return S.mix(S.norm(crackle), L(hiss, 0, p.hiss.gain));
  },
});

def({
  name: "rain_window_loop",
  category: "Real world",
  desc: "Rain against the window: soft wash, droplet ticks on glass, occasional drips.",
  loop: true,
  level: -8,
  p: {
    loop: 8,
    bed: { xfade: 0.5, hpHz: 400, lpHz: 5000, gain: 0.35 },
    drops: { perSec: 35, hzLo: 2500, hzHi: 7000, qLo: 4, qHi: 10, decayLo: 0.01, decayHi: 0.03, ampLo: 0.2, gain: 0.8 },
    drips: { perSec: 1.5, fLo: 900, fHi: 1800, rise: 0.8, decay: 0.04, amp: 0.3 },
    // two slow gusts per loop
    gust: { depth: 0.2, hz: 0.25 },
  },
  render: (p, _v, rng) => {
    const bed = S.loopXfade(S.band(S.noise(p.loop + p.bed.xfade, rng, "pink"), p.bed.hpHz, p.bed.lpHz), p.loop, p.bed.xfade, "power");
    const d = p.drops;
    const drops = S.buf(p.loop + d.decayHi);
    for (let k = 0; k < d.perSec * p.loop; k++) {
      const drop = R.tick(rng, rng.range(d.hzLo, d.hzHi), rng.range(d.qLo, d.qHi), rng.range(d.decayLo, d.decayHi));
      S.addInto(drops, drop, S.ofs(rng.range(0, p.loop)), rng.range(d.ampLo, 1));
    }
    const r = p.drips;
    for (let k = 0; k < r.perSec * p.loop; k++) {
      S.addInto(drops, R.bubble(rng.range(r.fLo, r.fHi), r.rise, r.decay), S.ofs(rng.range(0, p.loop)), r.amp);
    }
    const all = S.mix(L(S.norm(bed), 0, p.bed.gain), L(S.norm(S.loopWrap(drops, p.loop)), 0, d.gain));
    return S.amp(all, S.lfo(1 - p.gust.depth, p.gust.depth, p.gust.hz));
  },
});

def({
  name: "room_hum_loop",
  category: "Real world",
  desc: "The tiny room: fridge compressor and mains hum.",
  loop: true,
  level: -16,
  p: {
    loop: 4,
    xfade: 0.3,
    // mains harmonics [Hz, gain]; 100.5 Hz beats slowly against 100 Hz (2 beats per loop)
    harmonics: [[50, 1], [100, 0.6], [150, 0.35], [200, 0.15], [250, 0.1], [100.5, 0.2]] as const,
    buzz: { f: 100, lpHz: 800, gain: 0.15 },
    rumble: { lpHz: 180, gain: 0.4 },
  },
  render: (p, _v, rng) => {
    const sec = p.loop + p.xfade;
    const hum = S.mix(...p.harmonics.map(([f, g]) => L(S.osc(sec, "sine", f), 0, g)));
    const buzz = S.norm(S.filter(S.osc(sec, "saw", p.buzz.f), "lp", p.buzz.lpHz));
    const rumble = S.norm(S.filter(S.noise(sec, rng, "brown"), "lp", p.rumble.lpHz));
    return S.loopXfade(S.mix(S.norm(hum), L(buzz, 0, p.buzz.gain), L(rumble, 0, p.rumble.gain)), p.loop, p.xfade, "lin");
  },
});

def({
  name: "office_ambience_loop",
  category: "Real world",
  desc: "Cold corporate office: quiet HVAC air and distant keyboard typing.",
  loop: true,
  level: -16,
  p: {
    loop: 12,
    hvac: { xfade: 0.6, lpHz: 900, hpHz: 60, gain: 0.6, airHz: 2500, airQ: 0.5, airGain: 0.08, fanHz: 118, fanGain: 0.05 },
    typing: {
      bursts: 4, startJitter: 0.5, lenLo: 1.5, lenHi: 3, rateLo: 7, rateHi: 11, gapLo: 0.4, gapHi: 1.6,
      hzLo: 2500, hzHi: 4500, q: 2, decay: 0.015, thockHz: 900, thockDecay: 0.02, thockGain: 0.4, ampLo: 0.3, lpHz: 3500, gain: 0.35,
    },
    room: { size: 0.4, damp: 0.6, mix: 0.3, tail: 0.3 },
  },
  render: (p, _v, rng) => {
    const h = p.hvac;
    const sec = p.loop + h.xfade;
    const air = S.mix(
      S.norm(S.band(S.noise(sec, rng, "pink"), h.hpHz, h.lpHz)),
      L(S.norm(S.filter(S.noise(sec, rng), "bp", h.airHz, h.airQ)), 0, h.airGain),
      L(S.osc(sec, "sine", h.fanHz), 0, h.fanGain),
    );
    const hvac = S.loopXfade(air, p.loop, h.xfade, "power");
    const y = p.typing;
    const keys = S.buf(p.loop + y.lenHi);
    for (let b = 0; b < y.bursts; b++) {
      const start = (b + rng.range(0, y.startJitter)) * (p.loop / y.bursts);
      const length = rng.range(y.lenLo, y.lenHi);
      const rate = rng.range(y.rateLo, y.rateHi);
      for (let t = start; t < start + length; t += rng.range(y.gapLo, y.gapHi) / rate) {
        const key = S.mix(R.tick(rng, rng.range(y.hzLo, y.hzHi), y.q, y.decay), L(R.tick(rng, y.thockHz, y.q, y.thockDecay), 0, y.thockGain));
        S.addInto(keys, key, S.ofs(t), rng.range(y.ampLo, 1));
      }
    }
    const typing = S.loopWrap(S.reverb(S.filter(keys, "lp", y.lpHz), p.room), p.loop);
    return S.mix(L(S.norm(hvac), 0, h.gain), L(S.norm(typing), 0, y.gain));
  },
});

export const SOUNDS: readonly Sound[] = sounds;
