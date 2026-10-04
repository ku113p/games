// Renders every sound in sounds.ts to a 44.1 kHz mono 16-bit WAV master (tools/sfx/out-wav/, gitignored),
// encodes the game files to audio/sfx/<name>.mp3 with ffmpeg, and regenerates the sound board
// (audio/sfx/index.html) and audio/sfx/README.md.
//
//   bun tools/sfx/build.ts            # everything
//   bun tools/sfx/build.ts drone alarm # only sounds whose name contains one of the words (board/README still list all)

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as S from "./synth.ts";
import { SOUNDS, type Sound } from "./sounds.ts";

const HERE = import.meta.dir;
const ROOT = join(HERE, "..", "..");
const WAV_DIR = join(HERE, "out-wav");
const OUT_DIR = join(ROOT, "audio", "sfx");
const MANIFEST = join(HERE, "out-wav", "manifest.json");

/** ffmpeg encoder settings for the game files. VBR quality 4 is ~100-130 kbit/s for mono effects. */
const ENCODER = { ext: "mp3", codec: "libmp3lame", args: ["-q:a", "4"] };
const PARALLEL = 8;
/** Sanity limits for the checks after rendering. */
const LIMITS = { minSec: 0.02, maxOneShotSec: 6, maxLoopSec: 16, maxDc: 0.002 };
/** Loudness ceiling for one-shots: the loudest 50 ms window may not exceed this RMS (dBFS). */
const MAX_SHORT_RMS_DB = -9;

export interface Entry {
  file: string;
  group: string;
  category: string;
  desc: string;
  variant: number;
  variants: number;
  loop: boolean;
  samples: number;
  seconds: number;
  peakDb: number;
  rmsDb: number;
}

const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -120);
const fileName = (s: Sound, v: number): string => (s.variants > 1 ? `${s.name}_v${v + 1}` : s.name);

function render(s: Sound, v: number): { b: S.Buf; seam: number; maxStep: number } {
  const name = fileName(s, v);
  const rng = new S.Rng(S.hashSeed(name));
  const raw = s.make(v, rng);
  const b = s.loop ? S.finishLoop(raw, s.level) : S.finishOneShot(raw, s.level, MAX_SHORT_RMS_DB, s.loudness);
  for (let i = 0; i < b.length; i++) if (!Number.isFinite(b[i]!)) throw new Error(`${name}: non-finite sample at ${i}`);
  const sec = S.seconds(b);
  const maxSec = s.loop ? LIMITS.maxLoopSec : LIMITS.maxOneShotSec;
  if (sec < LIMITS.minSec || sec > maxSec) throw new Error(`${name}: duration ${sec.toFixed(3)} s out of range`);
  if (s.loop && b[0] === 0) throw new Error(`${name}: loop starts with an exact zero (offset bug?)`);
  const dc = Math.abs(S.mean(b));
  if (dc > LIMITS.maxDc) throw new Error(`${name}: DC offset ${dc.toFixed(4)}`);
  // Typical large step inside the sound (99th percentile), to judge the loop seam against.
  const steps = new Float32Array(b.length - 1);
  for (let i = 1; i < b.length; i++) steps[i - 1] = Math.abs(b[i]! - b[i - 1]!);
  steps.sort();
  const maxStep = steps[Math.floor(steps.length * 0.99)] ?? 0;
  const seam = s.loop ? Math.abs(b[0]! - b[b.length - 1]!) : Math.max(Math.abs(b[0]!), Math.abs(b[b.length - 1]!));
  return { b, seam, maxStep };
}

async function encode(wav: string, out: string): Promise<void> {
  const proc = Bun.spawn(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-ar", String(S.SR), "-c:a", ENCODER.codec, ...ENCODER.args, out],
    { stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) throw new Error(`ffmpeg failed for ${wav}: ${await new Response(proc.stderr).text()}`);
}

async function main(): Promise<void> {
  const filters = process.argv.slice(2);
  mkdirSync(WAV_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const previous: Entry[] = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Entry[]) : [];
  const byFile = new Map(previous.map((e) => [e.file, e]));
  const jobs: { wav: string; out: string }[] = [];
  const warnings: string[] = [];

  for (const s of SOUNDS) {
    if (filters.length > 0 && !filters.some((f) => s.name.includes(f))) continue;
    for (let v = 0; v < s.variants; v++) {
      const name = fileName(s, v);
      const { b, seam, maxStep } = render(s, v);
      if (s.loop && seam > maxStep) warnings.push(`${name}: loop seam step ${seam.toFixed(4)} > 99th percentile in-loop step ${maxStep.toFixed(4)}`);
      if (!s.loop && seam > 1e-3) warnings.push(`${name}: edge sample ${seam.toFixed(4)} (click risk)`);
      const wav = join(WAV_DIR, `${name}.wav`);
      writeFileSync(wav, S.wav(b, new S.Rng(S.hashSeed(`${name}:dither`))));
      jobs.push({ wav, out: join(OUT_DIR, `${name}.${ENCODER.ext}`) });
      byFile.set(`${name}.${ENCODER.ext}`, {
        file: `${name}.${ENCODER.ext}`,
        group: s.name,
        category: s.category,
        desc: s.desc,
        variant: v + 1,
        variants: s.variants,
        loop: s.loop,
        samples: b.length,
        seconds: S.seconds(b),
        peakDb: db(S.peak(b)),
        rmsDb: db(S.rms(b)),
      });
    }
  }

  for (let i = 0; i < jobs.length; i += PARALLEL) {
    await Promise.all(jobs.slice(i, i + PARALLEL).map((j) => encode(j.wav, j.out)));
  }

  // Keep only files that still have a definition; drop stale outputs.
  const wanted = new Set(SOUNDS.flatMap((s) => Array.from({ length: s.variants }, (_, v) => `${fileName(s, v)}.${ENCODER.ext}`)));
  const entries = SOUNDS.flatMap((s) =>
    Array.from({ length: s.variants }, (_, v) => byFile.get(`${fileName(s, v)}.${ENCODER.ext}`)).filter((e): e is Entry => e !== undefined),
  );
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith(`.${ENCODER.ext}`) && !wanted.has(f)) rmSync(join(OUT_DIR, f));
  }
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 1));

  const board = readFileSync(join(HERE, "board.html"), "utf8").replace("/*MANIFEST*/[]", JSON.stringify(entries));
  writeFileSync(join(OUT_DIR, "index.html"), board);
  writeFileSync(join(OUT_DIR, "README.md"), readme(entries));

  for (const e of entries) {
    if (filters.length > 0 && !filters.some((f) => e.group.includes(f))) continue;
    console.log(`${e.file.padEnd(28)} ${e.seconds.toFixed(3).padStart(6)} s  peak ${e.peakDb.toFixed(1).padStart(5)} dB  rms ${e.rmsDb.toFixed(1).padStart(6)} dB${e.loop ? "  loop" : ""}`);
  }
  for (const w of warnings) console.warn(`WARN ${w}`);
  console.log(`${jobs.length} files rendered, ${entries.length} in the board.`);
}

function readme(entries: readonly Entry[]): string {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  const cats = new Map<string, string[]>();
  for (const [g, es] of groups) {
    const e = es[0]!;
    const files = es.length > 1 ? `\`${g}_v1..v${es.length}\`` : `\`${g}\``;
    const secs = es.map((x) => x.seconds);
    const lo = Math.min(...secs).toFixed(2);
    const hi = Math.max(...secs).toFixed(2);
    const dur = lo === hi ? `${lo} s` : `${lo}-${hi} s`;
    const row = `| ${files} | ${dur}${e.loop ? " (loop)" : ""} | ${e.desc} |`;
    cats.set(e.category, [...(cats.get(e.category) ?? []), row]);
  }
  const tables = [...cats].map(([c, rows]) => `### ${c}\n\n| File | Length | What it is |\n| --- | --- | --- |\n${rows.join("\n")}\n`).join("\n");
  const total = entries.reduce((s, e) => s + e.seconds, 0);
  return `# Uninvited - sound effects

Generated file - edit \`tools/sfx/\` and rebuild instead of editing this README by hand.

**All sound effects are procedurally synthesized by our own code** (\`tools/sfx/\`: oscillators, noise,
filters, FM, distortion, bitcrush, delay and reverb written from scratch in TypeScript).
No third-party samples, sample packs, sound libraries or AI audio generators are used. Credit line:
"sound effects: procedurally generated by our own synthesizer code" (the code was written with an AI coding
assistant, listed in \`CREDITS.md\`).

${entries.length} files, ${total.toFixed(1)} s of audio in total. Format: ${ENCODER.ext.toUpperCase()} (${ENCODER.codec}, VBR ${ENCODER.args.join(" ")}), 44.1 kHz mono.

## Rebuild

\`\`\`sh
cd uninvited
bun tools/sfx/build.ts              # render everything
bun tools/sfx/build.ts drone alarm  # only sounds whose name contains a word
\`\`\`

Needs \`ffmpeg\` with \`libmp3lame\` on the PATH. WAV masters (44.1 kHz, 16-bit, mono) go to
\`tools/sfx/out-wav/\` (gitignored). The build is deterministic: every file has its own seed derived from its name.

- \`tools/sfx/synth.ts\` - DSP building blocks (oscillators, noise, envelopes, biquad filters, FM, drive, fold, bitcrush, echo, reverb, loop tools, WAV writer).
- \`tools/sfx/recipes.ts\` - reusable layers (kick, tick, whoosh, bell, chord, shards, syllable...), all numbers passed in.
- \`tools/sfx/sounds.ts\` - one definition per sound; every number that shapes a sound is in its \`p\` block.
- \`tools/sfx/build.ts\` - renders, checks (NaN, DC, duration, clicks at the edges, loop seams), encodes, writes this README and the board.
- \`tools/sfx/board.html\` - the sound board template.

## Sound board

Serve the folder and open the board, for example:

\`\`\`sh
cd uninvited && python3 -m http.server -d audio/sfx 8000   # then open http://localhost:8000/
\`\`\`

Click a button to play, loops toggle on and off. "rnd" plays a random variant, like the game should.

## Levels

One-shots are peak-normalized to about -1 dBFS; quieter-by-nature sounds are mastered lower so a flat mix
already sounds about right (each sound's \`level\` in \`sounds.ts\`: e.g. sneaking steps, UI hover, heal ticks).
Dense sounds are additionally turned down so their loudest 50 ms stays under ${MAX_SHORT_RMS_DB} dBFS RMS, which
keeps alarms and buzzers from being much louder than punchy transients. Variant sets that play in quick succession
(footsteps, code-grid blips, voices) are loudness-matched instead of peak-matched. Loops sit at -3 to -16 dBFS peak.
Set the final balance in the game's mixer.

## Loops

Files ending in \`_loop\` loop seamlessly (tail crossfaded into the head, tonal parts tuned to whole cycles).
Play them with Web Audio (\`AudioBufferSourceNode.loop = true\`), not \`<audio loop>\`. MP3 adds encoder padding;
Chromium's \`decodeAudioData\` removes it using the LAME header (checked: decoded length equals the sample count
below). If some browser returns a longer buffer, set \`loopStart\`/\`loopEnd\` to skip the padding (the board shows how: \`loopRegion()\` in \`index.html\`).

| Loop | Samples at 44.1 kHz |
| --- | --- |
${entries.filter((e) => e.loop).map((e) => `| \`${e.file}\` | ${e.samples} |`).join("\n")}

## Sounds

Variants (\`_v1.._vN\`) are meant to be picked at random each time so repeats do not sound mechanical.
Voices: one syllable per typed character (or every second character), random variant each time.

${tables}`;
}

await main();
