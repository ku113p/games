// Placeholder music: three short loops (net_calm, net_tension, net_combat) with the SAME tempo, key and length, so the
// music player (view/music.ts) can crossfade between them on a bar line. They exist so the adaptive system is audible and
// testable until the real tracks arrive; replace them by dropping files with the same names into audio/music/.
//   bun tools/music/build.ts      (needs ffmpeg; then run `bun run music:manifest`)
// Everything is deterministic (seeded noise). 120 BPM, D minor, 8 bars = 16 s, mono, folded so the loop seam is clean.
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SR = 44100
const BPM = 120
const BEAT = 60 / BPM
const BAR = BEAT * 4
const BARS = 8
const LEN = Math.round(BAR * BARS * SR)
const TAIL = Math.round(2 * SR)
const TAU = Math.PI * 2
const OUT = join(import.meta.dir, '..', '..', 'audio', 'music')
const TMP = join(import.meta.dir, 'out-wav')

// one chord per bar: D minor, B-flat, F, C, D minor, B-flat, G minor, A (MIDI notes of the voicing, root first)
const CHORDS: number[][] = [
  [38, 53, 57, 62],
  [34, 50, 53, 58],
  [41, 53, 57, 60],
  [36, 52, 55, 60],
  [38, 53, 57, 62],
  [34, 50, 53, 58],
  [43, 55, 58, 62],
  [45, 52, 55, 61],
]
const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

class Rng {
  s = 0x1234567
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0
    return this.s / 4294967296
  }
}

function buf(): Float32Array {
  return new Float32Array(LEN + TAIL)
}

/** Adds `f(t)` (t in s since the start) from `start` for `dur` seconds. */
function add(b: Float32Array, start: number, dur: number, f: (t: number) => number): void {
  const i0 = Math.round(start * SR)
  const n = Math.round(dur * SR)
  for (let i = 0; i < n && i0 + i < b.length; i++) b[i0 + i] = (b[i0 + i] ?? 0) + f(i / SR)
}

const saw = (ph: number): number => 2 * (ph - Math.floor(ph + 0.5))

function lowpass(b: Float32Array, cutoff: number): void {
  const a = 1 - Math.exp((-TAU * cutoff) / SR)
  let y = 0
  for (let i = 0; i < b.length; i++) {
    y += a * ((b[i] as number) - y)
    b[i] = y
  }
}

function pad(level: number): Float32Array {
  const b = buf()
  for (let bar = 0; bar < BARS; bar++) {
    const ch = CHORDS[bar] as number[]
    for (const m of ch.slice(1)) {
      for (const det of [-0.004, 0, 0.004]) {
        const f = hz(m) * (1 + det)
        add(b, bar * BAR, BAR + 0.6, (t) => {
          const e = Math.min(1, t / 0.5) * Math.min(1, (BAR + 0.6 - t) / 0.6)
          return saw(f * t) * e * level
        })
      }
    }
  }
  lowpass(b, 700)
  return b
}

function sub(b: Float32Array, perBar: number, level: number): void {
  for (let bar = 0; bar < BARS; bar++) {
    const root = hz((CHORDS[bar] as number[])[0] as number)
    for (let k = 0; k < perBar; k++) {
      const start = bar * BAR + (k * BAR) / perBar
      add(b, start, BAR / perBar, (t) => Math.sin(TAU * root * t) * Math.exp(-t * (perBar > 4 ? 7 : 3.2)) * level)
    }
  }
}

function hats(b: Float32Array, rng: Rng, level: number, sixteenths: boolean): void {
  const step = sixteenths ? BEAT / 4 : BEAT / 2
  const n = Math.round((BAR * BARS) / step)
  for (let k = 0; k < n; k++) {
    if (!sixteenths && k % 2 === 0) continue
    let prev = 0
    add(b, k * step, 0.06, (t) => {
      const x = rng.next() * 2 - 1
      const hp = x - prev // crude highpass
      prev = x
      return hp * Math.exp(-t * 70) * level
    })
  }
}

function arp(b: Float32Array, level: number, per: number): void {
  const step = BEAT / per
  const n = Math.round((BAR * BARS) / step)
  const tmp = buf()
  for (let k = 0; k < n; k++) {
    const bar = Math.floor((k * step) / BAR)
    const ch = CHORDS[bar] as number[]
    const pattern = [1, 2, 3, 2, 3, 2, 1, 3]
    const m = (ch[pattern[k % pattern.length] as number] as number) + 24
    const f = hz(m)
    add(tmp, k * step, step * 1.6, (t) => (Math.sign(Math.sin(TAU * f * t)) * 0.6 + saw(f * t) * 0.4) * Math.exp(-t * (per > 2 ? 14 : 8)) * level)
  }
  lowpass(tmp, 2400)
  for (let i = 0; i < tmp.length; i++) b[i] = (b[i] as number) + (tmp[i] as number)
}

function drums(b: Float32Array, rng: Rng, kick: number, snare: number): void {
  for (let k = 0; k < BARS * 4; k++) {
    add(b, k * BEAT, 0.3, (t) => Math.sin(TAU * (48 + 90 * Math.exp(-t * 35)) * t) * Math.exp(-t * 11) * kick)
    if (k % 2 === 1) {
      let prev = 0
      add(b, k * BEAT, 0.22, (t) => {
        const x = rng.next() * 2 - 1
        const bp = (x + prev) * 0.5
        prev = x
        return (bp * 0.7 + Math.sin(TAU * 190 * t) * 0.3) * Math.exp(-t * 18) * snare
      })
    }
  }
}

function bassline(b: Float32Array, level: number): void {
  const tmp = buf()
  for (let k = 0; k < BARS * 8; k++) {
    const bar = Math.floor(k / 8)
    const root = hz((CHORDS[bar] as number[])[0] as number)
    const oct = k % 4 === 3 ? 2 : 1
    const f = root * oct
    add(tmp, k * (BEAT / 2), BEAT / 2, (t) => saw(f * t) * Math.exp(-t * 6) * level)
  }
  lowpass(tmp, 380)
  for (let i = 0; i < tmp.length; i++) b[i] = (b[i] as number) + (tmp[i] as number)
}

/** Folds the tail onto the start (a seamless loop), trims to the loop length and normalizes to a peak. */
function finish(b: Float32Array, peak: number): Float32Array {
  const out = new Float32Array(LEN)
  for (let i = 0; i < LEN; i++) out[i] = (b[i] as number) + (i < TAIL ? (b[LEN + i] as number) : 0)
  let m = 0
  for (const v of out) m = Math.max(m, Math.abs(v))
  const g = peak / Math.max(m, 1e-6)
  for (let i = 0; i < LEN; i++) out[i] = (out[i] as number) * g
  return out
}

function mix(...parts: Float32Array[]): Float32Array {
  const b = buf()
  for (const p of parts) for (let i = 0; i < b.length; i++) b[i] = (b[i] as number) + (p[i] as number)
  return b
}

function wav(name: string, data: Float32Array): string {
  const pcm = Buffer.alloc(44 + data.length * 2)
  pcm.write('RIFF', 0)
  pcm.writeUInt32LE(36 + data.length * 2, 4)
  pcm.write('WAVEfmt ', 8)
  pcm.writeUInt32LE(16, 16)
  pcm.writeUInt16LE(1, 20)
  pcm.writeUInt16LE(1, 22)
  pcm.writeUInt32LE(SR, 24)
  pcm.writeUInt32LE(SR * 2, 28)
  pcm.writeUInt16LE(2, 32)
  pcm.writeUInt16LE(16, 34)
  pcm.write('data', 36)
  pcm.writeUInt32LE(data.length * 2, 40)
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] as number)) * 32767), 44 + i * 2)
  const path = join(TMP, `${name}.wav`)
  writeFileSync(path, pcm)
  return path
}

const tracks: Record<string, () => Float32Array> = {
  net_calm: () => {
    const r = new Rng()
    const b = pad(0.5)
    sub(b, 4, 0.22)
    void r
    return finish(b, 0.5)
  },
  net_tension: () => {
    const r = new Rng()
    const b = mix(pad(0.45))
    sub(b, 4, 0.24)
    hats(b, r, 0.07, false)
    arp(b, 0.16, 2)
    return finish(b, 0.5)
  },
  net_combat: () => {
    const r = new Rng()
    const b = mix(pad(0.38))
    drums(b, r, 0.55, 0.22)
    bassline(b, 0.4)
    hats(b, r, 0.08, true)
    arp(b, 0.2, 4)
    return finish(b, 0.5)
  },
}

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
mkdirSync(OUT, { recursive: true })
for (const [name, make] of Object.entries(tracks)) {
  const path = wav(name, make())
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path, '-c:a', 'libmp3lame', '-b:a', '112k', join(OUT, `${name}.mp3`)])
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}: ${r.stderr?.toString()}`)
  console.log(`audio/music/${name}.mp3`)
}
rmSync(TMP, { recursive: true, force: true })
