// Reusable sound layers built from synth.ts blocks. Every number that shapes the result is an
// argument, supplied by the sound definitions in sounds.ts. Each recipe returns a layer
// normalized to peak 1, so the gains in a mix read as relative peak levels.

import * as S from "./synth.ts";
import type { Buf, Curve, Rng, Wave } from "./synth.ts";

/** Pitch-dropping sine: kicks, thuds, sub booms. */
export function kick(f0: number, f1: number, sweep: number, decay: number, attack = 0.001): Buf {
  const b = S.osc(attack + decay, "sine", S.expc(f0, f1, sweep));
  return S.norm(S.amp(b, S.ad(attack, decay)));
}

/** Filtered noise transient: clicks, ticks, cracks. */
export function tick(rng: Rng, hz: number, q: number, decay: number, color: S.Color = "white"): Buf {
  const b = S.filter(S.noise(decay, rng, color), "bp", hz, q);
  return S.norm(S.amp(b, S.ad(0.0003, decay)));
}

/** Simple enveloped oscillator note. */
export function blip(wave: Wave, freq: Curve, attack: number, decay: number, lpHz = 0): Buf {
  let b = S.osc(attack + decay, wave, freq);
  if (lpHz > 0) b = S.filter(b, "lp", lpHz);
  return S.norm(S.amp(b, S.ad(attack, decay)));
}

/** Noise through a swept resonant bandpass, shaped by an envelope: whooshes, swishes, risers. */
export function whoosh(rng: Rng, sec: number, freq: Curve, q: Curve, env: Curve, color: S.Color = "white"): Buf {
  const b = S.filter(S.noise(sec, rng, color), "bp", freq, q);
  return S.norm(S.amp(b, env));
}

/** FM bell / metallic ping; the modulation index decays with the amplitude for a natural strike. */
export function bell(freq: Curve, ratio: number, index: number, decay: number, attack = 0.002): Buf {
  const e = S.ad(attack, decay);
  const b = S.fm(attack + decay, freq, ratio, (t) => index * e(t));
  return S.norm(S.amp(b, e));
}

/** Detuned stack of oscillators per note, through a lowpass, shaped by an envelope. */
export function chord(
  freqs: readonly number[],
  wave: Wave,
  sec: number,
  detuneCents: number,
  lpHz: Curve,
  env: Curve,
): Buf {
  const out = S.buf(sec);
  freqs.forEach((f, k) => {
    for (const d of [-detuneCents, detuneCents]) {
      const v = S.osc(sec, wave, f * Math.pow(2, d / 1200), { phase: (k * 0.37 + (d > 0 ? 0.5 : 0)) % 1 });
      S.addInto(out, v, 0, 1);
    }
  });
  S.filter(out, "lp", lpHz);
  return S.norm(S.amp(out, env));
}

export interface ShardsP {
  sec: number;
  count: number;
  /** Frequency range of the pings, Hz. */
  fLo: number;
  fHi: number;
  /** Decay range of each ping, seconds. */
  decayLo: number;
  decayHi: number;
  /** Bigger = events crowd towards the start. */
  front: number;
  /** FM modulator ratio range and index: metallic glints rather than pure sines. */
  ratioLo: number;
  ratioHi: number;
  fmIndex: number;
}

/** Many tiny high pings scattered in time: shattering light, sparks, glass. Later pings are quieter. */
export function shards(rng: Rng, p: ShardsP): Buf {
  const out = S.buf(p.sec);
  for (let k = 0; k < p.count; k++) {
    const when = p.sec * Math.pow(rng.next(), p.front) * (1 - p.decayHi / p.sec);
    const f = p.fLo * Math.pow(p.fHi / p.fLo, rng.next());
    const d = rng.range(p.decayLo, p.decayHi);
    const ping = S.amp(S.fm(d, f, rng.range(p.ratioLo, p.ratioHi), p.fmIndex), S.ad(0.0005, d));
    S.addInto(out, ping, S.ofs(when), rng.range(0.3, 1) * (1 - when / p.sec));
  }
  return S.norm(out);
}

/** Electric crackle: dust through a highpass/bandpass, density following a curve. */
export function sizzle(rng: Rng, sec: number, density: Curve, hz: number, q: number, env: Curve): Buf {
  const b = S.filter(S.dust(sec, rng, density), "bp", hz, q);
  return S.norm(S.amp(b, env));
}

/** Data chatter: a run of very short random-pitched square blips. */
export function chatter(rng: Rng, sec: number, rate: number, fLo: number, fHi: number, noteSec: number): Buf {
  const out = S.buf(sec);
  const step = 1 / rate;
  for (let t = 0; t < sec - noteSec; t += step) {
    const f = fLo * Math.pow(fHi / fLo, rng.next());
    const n = S.amp(S.osc(noteSec, "square", f), S.adsr(0.001, 0.002, 0.8, noteSec - 0.006, 0.003));
    S.addInto(out, n, S.ofs(t), rng.range(0.5, 1));
  }
  return S.norm(out);
}

export interface SyllableP {
  /** Base pitch, Hz. */
  pitch: number;
  /** Pitch change over the syllable, as a ratio (1 = flat). */
  glide: number;
  wave: Wave;
  /** Pulse width when wave is "square". */
  pw: number;
  /** Formant pair [F1, F2] in Hz. */
  formants: readonly [number, number];
  formantQ: number;
  sec: number;
  vibratoHz: number;
  vibratoDepth: number;
  lpHz: number;
  attack: number;
  release: number;
  /** Level of the raw source under the two formants (F1 is 1). */
  dry: number;
  /** Level of F2 relative to F1. */
  f2Gain: number;
}

/** One text-blip syllable: a buzzy source through two vowel formants. */
export function syllable(p: SyllableP): Buf {
  const f = (t: number): number =>
    p.pitch * Math.pow(p.glide, t / p.sec) * (1 + p.vibratoDepth * Math.sin(2 * Math.PI * p.vibratoHz * t));
  const src = S.osc(p.sec, p.wave, f, { pw: p.pw });
  const f1 = S.norm(S.filter(src.slice(), "bp", p.formants[0], p.formantQ));
  const f2 = S.norm(S.filter(src.slice(), "bp", p.formants[1], p.formantQ));
  const b = S.mix([S.norm(src), 0, p.dry], [f1, 0, 1], [f2, 0, p.f2Gain]);
  S.filter(b, "lp", p.lpHz);
  return S.norm(S.amp(b, S.adsr(p.attack, 0.02, 0.75, p.sec - p.attack - p.release - 0.02, p.release)));
}

/** A hollow knock: noise burst through resonant body modes plus a low thump. */
export function knock(rng: Rng, modes: readonly number[], q: number, decay: number, thumpHz: number): Buf {
  const exc = S.amp(S.noise(decay, rng, "pink"), S.ad(0.0005, decay * 0.15));
  const out = S.buf(decay);
  for (const m of modes) S.addInto(out, S.norm(S.filter(exc.slice(), "bp", m, q)), 0, 1);
  S.addInto(out, kick(thumpHz * 1.4, thumpHz, decay * 0.3, decay * 0.6), 0, 0.8);
  return S.norm(out);
}

/** Water bubble: a sine whose pitch rises quickly while it decays (Minnaert-style blip). */
export function bubble(f0: number, rise: number, decay: number): Buf {
  const b = S.osc(decay, "sine", (t) => f0 * (1 + rise * (t / decay)));
  return S.norm(S.amp(b, S.ad(0.002, decay)));
}

// ---------------------------------------------------------------- Halloween build (hw.ts)

export interface VocalP {
  sec: number;
  /** Fundamental, Hz (curve over time). */
  f0: Curve;
  /** Three formant centres, Hz (curves: vowels can glide). */
  formants: readonly [Curve, Curve, Curve];
  formantQ: number;
  /** Gains of the three formants (F1 is the reference). */
  gains?: readonly [number, number, number];
  wave?: Wave;
  pw?: number;
  /** Slow random pitch wander, fraction of f0 (0.02 = 2 %). */
  jitter?: number;
  vibHz?: number;
  vibDepth?: number;
  /** Amplitude roughness (growl): depth 0..1 at rate Hz. */
  roughDepth?: number;
  roughHz?: number;
  /** Level of airy breath noise relative to the voiced part. */
  breath?: number;
  /** Extra saturation, 0 = none. */
  drive?: number;
  /** Lowpass on the finished voice, Hz (default 6500): keeps saturated growls from turning into white hiss. */
  lpHz?: number;
}

/** A synthetic voice: a buzzy source through three gliding formant bandpasses plus breath. Creatures, grunts, wails. */
export function vocal(rng: Rng, p: VocalP): Buf {
  const n = Math.ceil(p.sec * 90) + 3;
  const walk = Array.from({ length: n }, () => rng.bi());
  const jit = (t: number): number => {
    const x = Math.min(n - 2, t * 90);
    const i = Math.floor(x);
    return (walk[i]! * (1 - (x - i)) + walk[i + 1]! * (x - i)) * (p.jitter ?? 0);
  };
  const f = (t: number): number =>
    S.at(p.f0, t) * (1 + (p.vibDepth ?? 0) * Math.sin(2 * Math.PI * (p.vibHz ?? 5) * t)) * (1 + jit(t));
  let src = S.osc(p.sec, p.wave ?? "saw", f, { pw: p.pw ?? 0.3 });
  if ((p.roughDepth ?? 0) > 0) {
    const d = p.roughDepth!;
    const hz = p.roughHz ?? 40;
    src = S.amp(src, (t) => 1 - d + d * (0.5 + 0.5 * Math.sin(2 * Math.PI * hz * t)));
  }
  const g = p.gains ?? [1, 0.6, 0.3];
  const parts = p.formants.map((fc, i) => S.amp(S.norm(S.filter(src.slice(), "bp", fc, p.formantQ)), g[i]!));
  let out = S.mix(...parts);
  if ((p.breath ?? 0) > 0) {
    const air = S.filter(S.noise(p.sec, rng), "bp", S.at(p.formants[1], 0), 1.2);
    out = S.mix([out, 0, 1], [S.norm(air), 0, p.breath!]);
  }
  S.filter(out, "lp", p.lpHz ?? 6500);
  if ((p.drive ?? 0) > 0) {
    S.drive(out, p.drive!);
    S.filter(out, "lp", p.lpHz ?? 6500);
  }
  return S.norm(out);
}

/** Exponential decay envelope applied to a buffer; `dec` = time to -60 dB. */
export function expDecay(b: Buf, dec: number, attack = 0.0005): Buf {
  return S.amp(b, (t) => Math.min(1, t / attack) * Math.pow(0.001, t / dec));
}

/** Short room: a few dark early reflections plus a small reverb. Indoors, the house is wooden and stony. */
export function room(b: Buf, mix: number, tail: number, size = 0.35, damp = 0.55): Buf {
  const out = S.reverb(b, { size, damp, mix, tail, spread: 0.7 });
  return out;
}

/** Linear-interpolation resample: rate > 1 = higher and shorter. */
export function resample(b: Buf, rate: number): Buf {
  const n = Math.max(1, Math.floor((b.length - 1) / rate));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * rate;
    const k = Math.floor(x);
    out[i] = b[k]! * (1 - (x - k)) + (b[k + 1] ?? 0) * (x - k);
  }
  return out;
}

/** Inharmonic struck metal: bell / clock / chain partials, each with its own decay. */
export function metalPartials(f0: number, ratios: readonly number[], decays: readonly number[], sec: number): Buf {
  const out = S.buf(sec);
  ratios.forEach((r, k) => {
    const d = decays[k % decays.length]!;
    const p = S.amp(S.osc(sec, "sine", f0 * r, { phase: (k * 0.31) % 1 }), (t) => Math.pow(0.001, t / d) * Math.min(1, t / 0.0008));
    S.addInto(out, p, 0, 1 / (1 + k * 0.35));
  });
  return S.norm(out);
}
