// Procedural sound synthesizer: small DSP building blocks on mono Float32 buffers at 44.1 kHz.
// Everything is deterministic: randomness comes from a seeded Rng passed in by the caller.
// Shape-giving numbers belong to the sound definitions in sounds.ts; the constants here are
// structural (filter math, reverb tunings, safety limits), not sound design choices.

export const SR = 44100;
const TAU = Math.PI * 2;
/** Decay times in this file mean "time to fall by 60 dB". */
const LN1000 = Math.log(1000);

export type Buf = Float32Array;
export type Fn = (t: number) => number;
/** A value that is either constant or a function of time in seconds. */
export type Curve = number | Fn;

export const at = (c: Curve, t: number): number => (typeof c === "number" ? c : c(t));
/** Buffer length in samples (at least 1). */
export const len = (sec: number): number => Math.max(1, Math.round(sec * SR));
/** Time offset in samples (0 stays 0). */
export const ofs = (sec: number): number => Math.round(sec * SR);
export const buf = (sec: number): Buf => new Float32Array(len(sec));
export const seconds = (b: Buf): number => b.length / SR;
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const c01 = (x: number): number => clamp(x, 0, 1);
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
/** Frequency ratio of a number of semitones. */
export const semi = (s: number): number => Math.pow(2, s / 12);
/** Frequency of a MIDI note number (69 = A4 = 440 Hz). */
export const midi = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- random

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  /** mulberry32, uniform in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  bi(): number {
    return this.next() * 2 - 1;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)]!;
  }
}

/** FNV-1a hash of a string, used to derive one seed per rendered file. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------- curves (functions of time)

export const lin = (a: number, b: number, d: number): Fn => (t) => a + (b - a) * c01(t / d);
export const expc = (a: number, b: number, d: number): Fn => (t) => a * Math.pow(b / a, c01(t / d));
/** Sine LFO around a center value. */
export const lfo = (center: number, depth: number, rate: number, phase = 0): Fn => (t) =>
  center + depth * Math.sin(TAU * rate * t + phase);
/** Piecewise curve through [time, value] points; "exp" segments need positive values. */
export function path(points: readonly (readonly [number, number])[], shape: "lin" | "exp" = "lin"): Fn {
  return (t) => {
    const first = points[0]!;
    if (t <= first[0]) return first[1];
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i]!;
      if (t <= p1[0]) {
        const p0 = points[i - 1]!;
        const u = (t - p0[0]) / Math.max(1e-9, p1[0] - p0[0]);
        return shape === "exp" ? p0[1] * Math.pow(p1[1] / p0[1], u) : p0[1] + (p1[1] - p0[1]) * u;
      }
    }
    return points[points.length - 1]![1];
  };
}
export const mulc = (...cs: Curve[]): Fn => (t) => cs.reduce<number>((acc, c) => acc * at(c, t), 1);
export const shift = (c: Curve, dt: number): Fn => (t) => at(c, t - dt);

// ---------------------------------------------------------------- envelopes (0..1)

/** Linear attack, exponential decay (decay = time to -60 dB). */
export const ad = (attack: number, decay: number): Fn => (t) =>
  t < 0 ? 0 : t < attack ? t / attack : Math.exp((-LN1000 * (t - attack)) / decay);
/** Classic ADSR with a fixed sustain hold time; returns 0 after the release. */
export const adsr = (a: number, d: number, s: number, hold: number, r: number): Fn => (t) => {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - ((1 - s) * (t - a)) / d;
  if (t < a + d + hold) return s;
  const u = (t - a - d - hold) / r;
  return u < 1 ? s * (1 - u) * (1 - u) : 0;
};
/** Power-curve rise to 1 at `rise`, then exponential fall (to -60 dB after `fall`). */
export const swell = (rise: number, fall: number, power = 2): Fn => (t) =>
  t < 0 ? 0 : t < rise ? Math.pow(t / rise, power) : Math.exp((-LN1000 * (t - rise)) / fall);
/** Hann bump over [0, d]. */
export const hann = (d: number): Fn => (t) => (t <= 0 || t >= d ? 0 : Math.pow(Math.sin((Math.PI * t) / d), 2));

// ---------------------------------------------------------------- generators

export type Wave = "sine" | "tri" | "saw" | "square";

function polyblep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export interface OscOpts {
  phase?: number;
  /** Pulse width for "square", 0..1. */
  pw?: Curve;
}

/** Band-limited (polyBLEP) oscillator with a time-varying frequency. */
export function osc(sec: number, wave: Wave, freq: Curve, o: OscOpts = {}): Buf {
  const b = buf(sec);
  let ph = o.phase ?? 0;
  const pwc = o.pw ?? 0.5;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const dt = clamp(at(freq, t) / SR, 0, 0.49);
    let v: number;
    switch (wave) {
      case "sine":
        v = Math.sin(TAU * ph);
        break;
      case "tri":
        v = 1 - 4 * Math.abs(ph - 0.5);
        break;
      case "saw":
        v = 2 * ph - 1 - polyblep(ph, dt);
        break;
      case "square": {
        const pw = clamp(at(pwc, t), 0.02, 0.98);
        v = (ph < pw ? 1 : -1) + polyblep(ph, dt) - polyblep((ph - pw + 1) % 1, dt);
        break;
      }
    }
    b[i] = v;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return b;
}

/** Two-operator FM (phase modulation): sine carrier, sine modulator at carrier * ratio (or modFreq). */
export function fm(sec: number, carrier: Curve, ratio: Curve, index: Curve, modFreq?: Curve): Buf {
  const b = buf(sec);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const fc = at(carrier, t);
    const fmod = modFreq === undefined ? fc * at(ratio, t) : at(modFreq, t);
    b[i] = Math.sin(TAU * pc + at(index, t) * Math.sin(TAU * pm));
    pc = (pc + fc / SR) % 1;
    pm = (pm + fmod / SR) % 1;
  }
  return b;
}

export type Color = "white" | "pink" | "brown";

export function noise(sec: number, rng: Rng, color: Color = "white"): Buf {
  const b = buf(sec);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let br = 0;
  for (let i = 0; i < b.length; i++) {
    const w = rng.bi();
    if (color === "white") b[i] = w;
    else if (color === "pink") {
      // Paul Kellet's economy pink filter.
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      b[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    } else {
      br = (br + 0.02 * w) / 1.02;
      b[i] = br * 3.5;
    }
  }
  return b;
}

/** Sparse random impulses (crackle, droplets, paper), `density` per second, random sign and size. */
export function dust(sec: number, rng: Rng, density: Curve, minAmp = 0.2): Buf {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) {
    if (rng.next() < at(density, i / SR) / SR) b[i] = (rng.next() < 0.5 ? -1 : 1) * rng.range(minAmp, 1);
  }
  return b;
}

// ---------------------------------------------------------------- filters

export type FilterType = "lp" | "hp" | "bp" | "notch" | "peak" | "lowshelf" | "highshelf";

/** RBJ biquad, in place. Coefficients are refreshed every 16 samples when any parameter is a function. */
export function filter(b: Buf, type: FilterType, freq: Curve, q: Curve = Math.SQRT1_2, gainDb: Curve = 0): Buf {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let z1 = 0, z2 = 0;
  const dynamic = typeof freq !== "number" || typeof q !== "number" || typeof gainDb !== "number";
  const update = (t: number): void => {
    const f = clamp(at(freq, t), 10, SR * 0.45);
    const Q = Math.max(0.05, at(q, t));
    const A = Math.pow(10, at(gainDb, t) / 40);
    const w0 = (TAU * f) / SR;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const al = sw / (2 * Q);
    let a0 = 1 + al;
    switch (type) {
      case "lp":
        b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a1 = -2 * cw; a2 = 1 - al;
        break;
      case "hp":
        b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a1 = -2 * cw; a2 = 1 - al;
        break;
      case "bp":
        b0 = al; b1 = 0; b2 = -al; a1 = -2 * cw; a2 = 1 - al;
        break;
      case "notch":
        b0 = 1; b1 = -2 * cw; b2 = 1; a1 = -2 * cw; a2 = 1 - al;
        break;
      case "peak":
        b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
        break;
      case "lowshelf": {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 - (A - 1) * cw + s); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s;
        break;
      }
      case "highshelf": {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s;
        break;
      }
    }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  update(0);
  for (let i = 0; i < b.length; i++) {
    if (dynamic && (i & 15) === 0) update(i / SR);
    const x = b[i]!;
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    b[i] = y;
  }
  return b;
}

/** Bandpass between two corner frequencies (a highpass and a lowpass). */
export const band = (b: Buf, lo: Curve, hi: Curve): Buf => filter(filter(b, "hp", lo), "lp", hi);

// ---------------------------------------------------------------- shaping and modulation

/** Multiply by a constant or a curve (envelope, tremolo...). */
export function amp(b: Buf, c: Curve): Buf {
  if (typeof c === "number") for (let i = 0; i < b.length; i++) b[i] = b[i]! * c;
  else for (let i = 0; i < b.length; i++) b[i] = b[i]! * c(i / SR);
  return b;
}

/** tanh saturation; `amount` 1 = gentle, 5+ = hard. Output peak stays near the input peak. */
export function drive(b: Buf, amount: number): Buf {
  const k = Math.tanh(amount);
  for (let i = 0; i < b.length; i++) b[i] = Math.tanh(amount * b[i]!) / k;
  return b;
}

/** Sine wavefolder: bright, buzzy harmonics. */
export function fold(b: Buf, amount: number): Buf {
  for (let i = 0; i < b.length; i++) b[i] = Math.sin(amount * b[i]! * Math.PI * 0.5);
  return b;
}

/** Bitcrusher: quantize to `bits` and hold each value for `hold` samples (sample-rate reduction). */
export function crush(b: Buf, bits: Curve, hold: Curve = 1): Buf {
  let held = 0;
  let count = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    if (count <= 0) {
      held = b[i]!;
      count = Math.max(1, Math.round(at(hold, t)));
    }
    count--;
    const steps = Math.pow(2, Math.max(1, at(bits, t)) - 1);
    b[i] = Math.round(held * steps) / steps;
  }
  return b;
}

/** Ring modulation with a sine; mix 1 = fully ring-modulated. */
export function ring(b: Buf, freq: Curve, mix = 1): Buf {
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const m = Math.sin(TAU * ph);
    b[i] = b[i]! * (1 - mix + mix * m);
    ph = (ph + at(freq, i / SR) / SR) % 1;
  }
  return b;
}

/** Rhythmic on/off chopper with smoothed edges (stutters, tremolo gates). */
export function gate(b: Buf, rate: Curve, duty = 0.5, smooth = 0.002, floor = 0): Buf {
  let ph = 0;
  let g = 1;
  const k = 1 - Math.exp(-1 / (smooth * SR));
  for (let i = 0; i < b.length; i++) {
    const target = ph < duty ? 1 : floor;
    g += (target - g) * k;
    b[i] = b[i]! * g;
    ph = (ph + at(rate, i / SR) / SR) % 1;
  }
  return b;
}

/** Variable-speed playback (tape stop, speed-ups). Stops when the read head leaves the source. */
export function warp(b: Buf, rate: Curve, maxSec = 10): Buf {
  const out = buf(maxSec);
  let pos = 0;
  let i = 0;
  for (; i < out.length; i++) {
    const p0 = Math.floor(pos);
    if (p0 + 1 >= b.length) break;
    const f = pos - p0;
    out[i] = b[p0]! * (1 - f) + b[p0 + 1]! * f;
    pos += Math.max(0, at(rate, i / SR));
    if (at(rate, i / SR) <= 0.001 && i > 0) break;
  }
  return out.slice(0, Math.max(1, i));
}

export const reverse = (b: Buf): Buf => b.slice().reverse();
export const slice = (b: Buf, from: number, to: number): Buf =>
  b.slice(clamp(ofs(from), 0, b.length), clamp(ofs(to), 0, b.length));
export const pad = (b: Buf, tail: number): Buf => {
  const out = new Float32Array(b.length + len(tail));
  out.set(b);
  return out;
};

/** Glitch: random slices of the buffer get repeated (buffer-repeat stutter). */
export function stutter(b: Buf, rng: Rng, sliceSec: number, prob: number, maxRepeats: number): Buf {
  const out: number[] = [];
  const n = len(sliceSec);
  for (let s = 0; s < b.length; s += n) {
    const chunk = b.subarray(s, Math.min(b.length, s + n));
    const reps = rng.next() < prob ? rng.int(2, maxRepeats) : 1;
    for (let r = 0; r < reps; r++) for (let i = 0; i < chunk.length; i++) {
      // short ramps at the chunk edges keep the repeats click-free
      const e = Math.min(1, i / 32, (chunk.length - 1 - i) / 32);
      out.push(chunk[i]! * (reps > 1 ? e : 1));
    }
  }
  return Float32Array.from(out);
}

// ---------------------------------------------------------------- time effects (return a longer buffer)

/** Feedback delay with a lowpass in the loop. */
export function echo(b: Buf, time: number, feedback: number, mix: number, tail: number, damp = 5000): Buf {
  const out = pad(b, tail);
  const d = len(time);
  const line = new Float32Array(d);
  let w = 0;
  let lp = 0;
  const k = 1 - Math.exp((-TAU * damp) / SR);
  for (let i = 0; i < out.length; i++) {
    const x = out[i]!;
    const y = line[w]!;
    lp += (y - lp) * k;
    line[w] = x + lp * feedback;
    out[i] = x + y * mix;
    w = (w + 1) % d;
  }
  return out;
}

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];

export interface ReverbOpts {
  /** 0..1, room size (comb feedback). */
  size: number;
  /** 0..1, high-frequency damping. */
  damp: number;
  /** Wet level added to the dry signal. */
  mix: number;
  /** Extra seconds appended for the tail. */
  tail: number;
  /** Scales the delay lengths (bigger = sparser, larger-sounding space). */
  spread?: number;
}

/** Mono Freeverb (8 lowpass-feedback combs into 4 allpasses). */
export function reverb(b: Buf, o: ReverbOpts): Buf {
  const out = pad(b, o.tail);
  const sc = o.spread ?? 1;
  const fb = 0.7 + 0.28 * o.size;
  const combs = COMBS.map((n) => ({ line: new Float32Array(Math.round(n * sc)), i: 0, store: 0 }));
  const aps = ALLPASSES.map((n) => ({ line: new Float32Array(Math.round(n * sc)), i: 0 }));
  for (let s = 0; s < out.length; s++) {
    const x = out[s]! * 0.015;
    let acc = 0;
    for (const c of combs) {
      const y = c.line[c.i]!;
      c.store = y * (1 - o.damp) + c.store * o.damp;
      c.line[c.i] = x + c.store * fb;
      c.i = (c.i + 1) % c.line.length;
      acc += y;
    }
    for (const a of aps) {
      const y = a.line[a.i]!;
      a.line[a.i] = acc + y * 0.5;
      acc = y - acc;
      a.i = (a.i + 1) % a.line.length;
    }
    out[s] = out[s]! + acc * 3 * o.mix;
  }
  return out;
}

// ---------------------------------------------------------------- mixing

/** A mix layer: a buffer, or [buffer, offset seconds, gain]. */
export type Layer = Buf | readonly [Buf, number?, number?];

export function addInto(dst: Buf, src: Buf, offset: number, g = 1, wrap = false): void {
  for (let i = 0; i < src.length; i++) {
    let j = offset + i;
    if (wrap) j %= dst.length;
    else if (j >= dst.length) break;
    if (j >= 0) dst[j] = dst[j]! + src[i]! * g;
  }
}

export function mix(...layers: Layer[]): Buf {
  const norm = layers.map((l): [Buf, number, number] =>
    l instanceof Float32Array ? [l, 0, 1] : [l[0], l[1] ?? 0, l[2] ?? 1],
  );
  const total = Math.max(...norm.map(([b, off]) => ofs(off) + b.length));
  const out = new Float32Array(total);
  for (const [b, off, g] of norm) addInto(out, b, ofs(off), g);
  return out;
}

export const concat = (...bs: Buf[]): Buf => {
  const out = new Float32Array(bs.reduce((s, b) => s + b.length, 0));
  let o = 0;
  for (const b of bs) {
    out.set(b, o);
    o += b.length;
  }
  return out;
};

export function peak(b: Buf): number {
  let p = 0;
  for (let i = 0; i < b.length; i++) p = Math.max(p, Math.abs(b[i]!));
  return p;
}

/** Scale so the absolute peak equals `target` (linear). Layers are normalized to 1 before mixing. */
export function norm(b: Buf, target = 1): Buf {
  const p = peak(b);
  return p > 0 ? amp(b, target / p) : b;
}

// ---------------------------------------------------------------- mastering

/** One-pole DC blocker (highpass around a few Hz). */
export function dcBlock(b: Buf, hz = 15): Buf {
  const r = Math.exp((-TAU * hz) / SR);
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < b.length; i++) {
    const x = b[i]!;
    const y = x - x1 + r * y1;
    x1 = x;
    y1 = y;
    b[i] = y;
  }
  return b;
}

export function mean(b: Buf): number {
  let s = 0;
  for (let i = 0; i < b.length; i++) s += b[i]!;
  return s / b.length;
}

export function rms(b: Buf): number {
  let s = 0;
  for (let i = 0; i < b.length; i++) s += b[i]! * b[i]!;
  return Math.sqrt(s / b.length);
}

/** Raised-cosine fades. */
export function fadeIn(b: Buf, sec: number): Buf {
  const n = Math.min(b.length, len(sec));
  for (let i = 0; i < n; i++) b[i] = b[i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / n));
  return b;
}
export function fadeOut(b: Buf, sec: number): Buf {
  const n = Math.min(b.length, len(sec));
  for (let i = 0; i < n; i++) b[b.length - 1 - i] = b[b.length - 1 - i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / n));
  return b;
}

/** Cut leading and trailing silence, measured relative to the peak. */
export function trim(b: Buf, headDb = -50, tailDb = -64, keepHead = 0.0005, keepTail = 0.02): Buf {
  const p = peak(b);
  if (p === 0) return b;
  const h = p * dbToGain(headDb);
  const tl = p * dbToGain(tailDb);
  let s = 0;
  while (s < b.length && Math.abs(b[s]!) < h) s++;
  let e = b.length - 1;
  while (e > s && Math.abs(b[e]!) < tl) e--;
  return b.slice(Math.max(0, s - len(keepHead)), Math.min(b.length, e + len(keepTail)));
}

/** Loudest short-term RMS (50 ms windows) - a rough loudness measure. */
export function maxShortRms(b: Buf, win = 0.05): number {
  const n = len(win);
  let best = 0;
  for (let s = 0; s < b.length; s += n >> 1) {
    const e = Math.min(b.length, s + n);
    let a = 0;
    for (let i = s; i < e; i++) a += b[i]! * b[i]!;
    best = Math.max(best, Math.sqrt(a / Math.max(1, e - s)));
  }
  return best;
}

/**
 * Master a one-shot: DC block, trim, click-free fades, peak normalize, then turn down if the loudest
 * 50 ms is above `maxShortDb` (dense square/noise sounds would otherwise be far louder than transients).
 * With `loudnessDb`, variants are matched by their loudest 50 ms instead of by peak.
 */
export function finishOneShot(b: Buf, peakDb: number, maxShortDb = 0, loudnessDb?: number): Buf {
  let x = trim(dcBlock(b));
  fadeIn(x, 0.0015);
  fadeOut(x, clamp(seconds(x) * 0.2, 0.005, 0.08));
  // Remove any residual DC with a smooth window-shaped correction (keeps the edges at zero).
  const m = mean(x);
  for (let i = 0; i < x.length; i++) x[i] = x[i]! - 2 * m * Math.pow(Math.sin((Math.PI * i) / x.length), 2);
  x = norm(x, dbToGain(peakDb));
  if (loudnessDb !== undefined) {
    // Loudness-matched: hit the target short-term RMS, but never exceed the peak level.
    const g = dbToGain(loudnessDb) / maxShortRms(x);
    if (g < 1) amp(x, g);
  }
  const st = maxShortRms(x);
  const cap = dbToGain(maxShortDb);
  if (st > cap) amp(x, cap / st);
  return x;
}

/**
 * Seamless loop by crossfade: `b` must hold at least loop + xfade seconds. The tail after the loop
 * point is faded over the head, so sample L-1 runs straight into sample L of the original render.
 * "lin" suits phase-aligned tonal material, "power" suits noise.
 */
export function loopXfade(b: Buf, loopSec: number, xfadeSec: number, mode: "lin" | "power" = "power"): Buf {
  const L = len(loopSec);
  const X = len(xfadeSec);
  if (b.length < L + X) throw new Error(`loopXfade: render is ${b.length} samples, needs ${L + X}`);
  dcBlock(b);
  const out = b.slice(0, L);
  for (let i = 0; i < X; i++) {
    const u = i / X;
    const gin = mode === "lin" ? u : Math.sin((u * Math.PI) / 2);
    const gout = mode === "lin" ? 1 - u : Math.cos((u * Math.PI) / 2);
    out[i] = b[i]! * gin + b[L + i]! * gout;
  }
  return out;
}

/** Seamless loop for event-based material: everything past the loop point is folded onto the head. */
export function loopWrap(b: Buf, loopSec: number): Buf {
  const L = len(loopSec);
  const out = new Float32Array(L);
  addInto(out, b, 0, 1, true);
  return dcBlock(out);
}

/**
 * Scale a frequency curve so an oscillator driven by it completes a whole number of cycles in
 * `loopSec` (the phase then lines up at the loop seam). The curve itself must repeat over the loop.
 */
export function fitCycles(freq: Curve, loopSec: number): Fn {
  const L = len(loopSec);
  let c = 0;
  for (let i = 0; i < L; i++) c += at(freq, i / SR) / SR;
  const k = Math.max(1, Math.round(c)) / c;
  return (t) => at(freq, t) * k;
}

/** Master a loop: remove the mean (keeps the seam intact) and peak normalize. No trims, no fades. */
export function finishLoop(b: Buf, peakDb: number): Buf {
  const m = mean(b);
  for (let i = 0; i < b.length; i++) b[i] = b[i]! - m;
  return norm(b, dbToGain(peakDb));
}

/** 16-bit PCM mono WAV with TPDF dither. */
export function wav(b: Buf, rng: Rng): Uint8Array {
  const data = b.length * 2;
  const out = new Uint8Array(44 + data);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + data, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, data, true);
  for (let i = 0; i < b.length; i++) {
    const d = (rng.next() - rng.next()) / 32768;
    const s = clamp(Math.round((b[i]! + d) * 32767), -32768, 32767);
    v.setInt16(44 + i * 2, s, true);
  }
  return out;
}
