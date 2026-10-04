// Automatic audit of the sound library: measures every file in audio/sfx/ (or the folder given as the first
// argument) and flags shapes that read badly in the game: soft or missing attacks on hits, abrupt endings, "static"
// motion sounds (a swing whose spectrum does not move), sustained low-frequency hum, wrong duration for the category.
//
//   bun tools/sfx/audit.ts                 # audio/sfx/
//   bun tools/sfx/audit.ts <dir> [word]    # another folder, only names containing a word
//
// Needs ffmpeg (decodes the MP3s). Exit code is always 0: this is a report, not a gate.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SR = 44100;
const HERE = import.meta.dir;
const dir = process.argv[2] ?? join(HERE, "..", "..", "audio", "sfx");
const words = process.argv.slice(3);

const db = (x: number): number => (x > 1e-9 ? 20 * Math.log10(x) : -180);

async function decode(path: string): Promise<Float32Array> {
  const p = Bun.spawn(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { stdout: "pipe", stderr: "pipe" });
  const buf = new Uint8Array(await new Response(p.stdout).arrayBuffer());
  await p.exited;
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

/** Magnitude spectrum (first N/2 bins) of a Hann-windowed frame, radix-2 FFT. */
function spectrum(frame: Float32Array): Float64Array {
  const n = frame.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = frame[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr; im[b] = im[a]! - ti;
        re[a] = re[a]! + tr; im[a] = im[a]! + ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  const out = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i]!, im[i]!);
  return out;
}

interface Norm { cat: string; min: number; max: number }
/** Duration norms by name (seconds); first match wins. */
const NORMS: [RegExp, Norm][] = [
  [/^warden_step/, { cat: "heavy step", min: 0.1, max: 0.3 }],
  [/^footstep_|^land/, { cat: "footstep", min: 0.06, max: 0.25 }],
  [/^sword_swing/, { cat: "swing", min: 0.15, max: 0.35 }],
  [/^(sword_hit|player_hit|drone_hit|worm_hit|bullet_impact|shield_hit)/, { cat: "hit", min: 0.08, max: 0.25 }],
  [/_kill$|^worm_death/, { cat: "kill", min: 0.4, max: 1.2 }],
  [/pickup|^ammo_drop/, { cat: "pickup", min: 0.1, max: 0.4 }],
];
/** Sounds that must start with a sharp transient. */
const SHARP = /^(footstep_|warden_step|sword_hit|player_hit|drone_hit|worm_hit|bullet_impact|shield_hit|rifle_shot|drone_shot|turret_shot|drone_kill|worm_death|land|ui_click|ammo_drop|hack_select)/;
/** Sounds where a sustained low-frequency hum is a defect (everything short and percussive or a pickup). */
const HUM_CHECK = /^(footstep_|warden_step|sword_|player_hit|player_hurt|drone_hit|drone_kill|drone_shot|worm_|bullet_impact|shield_hit|rifle_|land|ammo_drop|artifact_pickup)/;
/** Allowed attack time (ms) from the -30 dB onset to the peak; 5 ms is the design rule, the extra margin covers MP3 smearing and the onset threshold. */
const MAX_ATTACK_MS = 8;
/** Motion sounds: the spectral centroid must move. */
const MOTION = /^(sword_swing|dash|jump|whoosh|tablet_swipe)/;

interface Row {
  file: string; dur: number; attackMs: number; crest: number; tailDb: number; centroidMove: number; humMs: number;
  loop: boolean; flags: string[];
}

/** Names of the library-based files (Kenney layers and/or library synth layers), from library-manifest.json. */
function libraryFiles(): Set<string> {
  try {
    const m = JSON.parse(readFileSync(join(HERE, "library-manifest.json"), "utf8")) as { file: string }[];
    return new Set(m.map((e) => e.file.replace(/\.mp3$/, "")));
  } catch {
    return new Set();
  }
}

function measure(file: string, x: Float32Array): Row {
  if (x.length < 100) return { file, dur: 0, attackMs: 0, crest: 0, tailDb: 0, centroidMove: 0, humMs: 0, loop: false, flags: ["undecodable"] };
  const loop = file.includes("_loop") || file.includes("ambience");
  const flags: string[] = [];
  const dur = x.length / SR;
  let pk = 0;
  let pkAt = 0;
  let sq = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]!);
    if (a > pk) { pk = a; pkAt = i; }
    sq += x[i]! * x[i]!;
  }
  const rms = Math.sqrt(sq / x.length);
  const crest = db(pk) - db(rms);
  // attack: from the first sample above -30 dB of the peak to the peak (1 ms smoothed envelope would hide 1 ms attacks, so raw samples)
  const thr = pk * Math.pow(10, -30 / 20);
  let on = 0;
  while (on < x.length && Math.abs(x[on]!) < thr) on++;
  // peak within the first 150 ms or the global peak, whichever comes first, as the "to peak" target
  const attackMs = (Math.max(0, pkAt - on) / SR) * 1000;
  // tail: RMS of the last 30 ms vs peak
  const tl = Math.min(x.length, Math.round(0.03 * SR));
  let ts = 0;
  for (let i = x.length - tl; i < x.length; i++) ts += x[i]! * x[i]!;
  const tailDb = db(Math.sqrt(ts / tl)) - db(pk);
  // spectral frames
  const N = 1024;
  const hop = 512;
  const cents: number[] = [];
  const lowFrac: number[] = [];
  const domLow: boolean[] = [];
  const frameDb: number[] = [];
  const times: number[] = [];
  for (let s = 0; s + N <= x.length; s += hop) {
    const fr = x.subarray(s, s + N);
    let e = 0;
    for (const v of fr) e += v * v;
    const spec = spectrum(fr);
    let tot = 0;
    let wsum = 0;
    let low = 0;
    let best = 0;
    let bestK = 0;
    for (let k = 1; k < spec.length; k++) {
      const p = spec[k]! * spec[k]!;
      tot += p;
      wsum += p * k;
      if (k * SR / N < 400) low += p;
      if (p > best) { best = p; bestK = k; }
    }
    cents.push(tot > 0 ? (wsum / tot) * SR / N : 0);
    lowFrac.push(tot > 0 ? low / tot : 0);
    domLow.push((bestK * SR) / N < 400);
    frameDb.push(db(Math.sqrt(e / N)) - db(pk));
    times.push(s / SR);
  }
  // centroid movement over the audible frames (above -25 dB of peak), 3-frame median smoothed
  const idx = frameDb.map((d, i) => (d > -25 ? i : -1)).filter((i) => i >= 0);
  let centroidMove = 0;
  if (idx.length >= 3) {
    const c = idx.map((i) => cents[i]!);
    const sm = c.map((_, i) => [c[Math.max(0, i - 1)]!, c[i]!, c[Math.min(c.length - 1, i + 1)]!].sort((a, b) => a - b)[1]!);
    const mean = sm.reduce((a, b) => a + b, 0) / sm.length;
    centroidMove = (Math.max(...sm) - Math.min(...sm)) / Math.max(1, mean);
  }
  // sustained hum: audible frames (above -35 dB) dominated by a < 400 Hz peak and mostly low-band energy, in the last 60% of the sound
  let humFrames = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i]! > dur * 0.4 && frameDb[i]! > -35 && domLow[i] && lowFrac[i]! > 0.6) humFrames++;
  }
  const humMs = (humFrames * hop * 1000) / SR;

  const norm = NORMS.find(([re]) => re.test(file))?.[1];
  if (norm && !loop) {
    if (dur < norm.min - 0.005) flags.push(`short(${norm.cat} ${norm.min}-${norm.max}s)`);
    if (dur > norm.max) flags.push(`long(${norm.cat} ${norm.min}-${norm.max}s)`);
  }
  if (SHARP.test(file) && attackMs > MAX_ATTACK_MS) flags.push("soft-attack");
  if (!loop && tailDb > -30 && dur > 0.1) flags.push("abrupt-end");
  if (MOTION.test(file) && centroidMove < 0.5) flags.push("static");
  if (!loop && humMs > 120 && HUM_CHECK.test(file)) flags.push("hum");
  if (!loop && dur > 0.3 && crest < 6 && SHARP.test(file)) flags.push("flat(crest)");
  return { file, dur, attackMs, crest, tailDb, centroidMove, humMs, loop, flags };
}

async function main(): Promise<void> {
  const files = readdirSync(dir).filter((f) => f.endsWith(".mp3") && (words.length === 0 || words.some((w) => f.includes(w)))).sort();
  const lib = libraryFiles();
  const rows: Row[] = [];
  for (const f of files) rows.push(measure(f.replace(/\.mp3$/, ""), await decode(join(dir, f))));
  console.log(`${"file".padEnd(24)} ${"dur s".padStart(6)} ${"atk ms".padStart(7)} ${"crest dB".padStart(8)} ${"tail dB".padStart(8)} ${"c.move".padStart(7)} ${"hum ms".padStart(7)}  lib flags`);
  for (const r of rows) {
    console.log(
      `${r.file.padEnd(24)} ${r.dur.toFixed(2).padStart(6)} ${r.attackMs.toFixed(1).padStart(7)} ${r.crest.toFixed(1).padStart(8)} ${r.loop ? "loop".padStart(8) : r.tailDb.toFixed(0).padStart(8)} ${r.centroidMove.toFixed(2).padStart(7)} ${r.humMs.toFixed(0).padStart(7)}  ${lib.has(r.file) ? "L" : " "} ${r.flags.length ? "<< " + r.flags.join(" ") : ""}`,
    );
  }
  const bad = rows.filter((r) => r.flags.length > 0);
  console.log(`\n${rows.length} files, ${bad.length} flagged:`);
  for (const r of bad) console.log(`  ${lib.has(r.file) ? "[library]" : "[synth]  "} ${r.file}: ${r.flags.join(", ")}`);
  const libBad = bad.filter((r) => lib.has(r.file)).length;
  console.log(`${libBad} of the flagged files are library-based (fixable in library.ts), ${bad.length - libBad} are synthesized (sounds.ts).`);
  console.log("\natk = time from -30 dB onset to the peak; tail = RMS of the last 30 ms vs peak (flag above -30 dB); c.move = (max-min)/mean of the spectral centroid over the audible frames (swings need >= 0.5); hum = ms of low-band-dominated frames in the last 60% (flag above 120 ms on percussive sounds); L = library-based file.");
}

await main();
