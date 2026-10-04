// Placeholder synth SFX - just enough feedback to judge the feel. Real sounds come from the sound guide.
let ctx: AudioContext | null = null
let master: GainNode | null = null

export function unlockAudio(): void {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
  }
  void ctx.resume()
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
  if (!ctx || !master) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, vol: number, freq: number): void {
  if (!ctx || !master) return
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const s = ctx.createBufferSource()
  s.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  const g = ctx.createGain()
  g.gain.value = vol
  s.connect(f).connect(g).connect(master)
  s.start()
}

export const sfx = {
  strike: () => (noise(0.12, 0.5, 2400), tone('sawtooth', 900, 200, 0.1, 0.12)),
  hit: () => (tone('square', 220, 60, 0.16, 0.25), noise(0.1, 0.4, 900)),
  kill: () => (tone('sawtooth', 160, 30, 0.45, 0.3), noise(0.35, 0.5, 600), tone('sine', 1200, 300, 0.25, 0.15, 0.05)),
  takedown: () => (tone('sine', 1800, 400, 0.18, 0.2), tone('sawtooth', 120, 30, 0.5, 0.3, 0.04)),
  dash: () => (noise(0.18, 0.35, 3200), tone('sine', 300, 900, 0.12, 0.1)),
  jump: () => tone('sine', 260, 520, 0.12, 0.12),
  land: () => noise(0.06, 0.2, 400),
  hurt: () => (tone('square', 140, 70, 0.2, 0.25), noise(0.15, 0.35, 1400)),
  suspicious: () => tone('triangle', 660, 880, 0.18, 0.15),
  alert: () => (tone('square', 880, 880, 0.09, 0.18), tone('square', 1320, 1320, 0.12, 0.18, 0.1)),
  bolt: () => tone('sawtooth', 1400, 500, 0.08, 0.06),
  decoy: () => (tone('triangle', 400, 1600, 0.25, 0.15), tone('triangle', 600, 2400, 0.25, 0.1, 0.06)),
  refuse: () => (tone('square', 300, 300, 0.08, 0.15), tone('square', 200, 200, 0.14, 0.15, 0.1)),
  capture: () => [0, 0.08, 0.16, 0.24].forEach((d, i) => tone('triangle', 440 * (1 + i * 0.25), 440 * (1 + i * 0.25), 0.18, 0.15, d)),
  firewallDown: () => (tone('sawtooth', 600, 40, 1.0, 0.25), noise(0.8, 0.4, 300)),
  win: () => [0, 0.12, 0.24, 0.4].forEach((d, i) => tone('sine', 523 * (1 + i * 0.26), 523 * (1 + i * 0.26), 0.4, 0.15, d)),
  die: () => (tone('sawtooth', 400, 30, 0.9, 0.3), noise(0.6, 0.4, 500)),
}
