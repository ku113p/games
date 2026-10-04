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
