// The hack overlay's look: black glass, thin cyan light lines, red for security and errors, matte and saturated
// (art/generated/NN1b-net-corridor.jpg), monospace. Injected once per document.
const CSS = `
.hk {
  --glass: #02070a; --glass-hi: #071820; --line: #5ef2ff; --line-soft: rgba(94, 242, 255, 0.34);
  --line-faint: rgba(94, 242, 255, 0.12); --ice: #e2fdff; --muted: #6d97a3; --red: #ff2d4b;
  --red-soft: rgba(255, 45, 75, 0.38); --red-faint: rgba(255, 45, 75, 0.12);
  --mono: "JetBrains Mono", "Cascadia Mono", "SF Mono", Menlo, Consolas, ui-monospace, monospace;
  --gap: 6px;
  --cell: clamp(40px, calc((100cqh - 214px) / var(--n, 6) - var(--gap)), 72px);
  container-type: size; position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); color: var(--ice); user-select: none; -webkit-user-select: none;
  background:
    repeating-linear-gradient(0deg, rgba(94, 242, 255, 0.025) 0 1px, transparent 1px 3px),
    radial-gradient(ellipse at 50% 45%, rgba(2, 14, 20, 0.86), rgba(0, 2, 4, 0.96));
  opacity: 0; transition: opacity 0.18s ease-out;
}
.hk.on { opacity: 1; }
.hk[hidden] { display: none; }

.hk-panel {
  position: relative; display: flex; flex-direction: column; gap: 16px;
  padding: 26px 34px 18px; border-radius: 26px;
  background: linear-gradient(180deg, var(--glass-hi), var(--glass) 38%);
  border: 1.5px solid var(--line-soft);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.9), 0 0 24px rgba(94, 242, 255, 0.16), inset 0 0 40px rgba(94, 242, 255, 0.05);
}
.hk.on .hk-panel { animation: hk-boot 0.42s cubic-bezier(0.2, 0.9, 0.2, 1) both; }
@keyframes hk-boot {
  0% { transform: scale(0.96); clip-path: inset(49% 0 49% 0 round 26px); filter: brightness(2.2); }
  55% { clip-path: inset(0 0 0 0 round 26px); }
  100% { transform: none; clip-path: inset(0 0 0 0 round 26px); filter: none; }
}

/* the clock is the top edge of the panel: a light line that drains to the left */
.hk-clock { position: absolute; left: 26px; right: 26px; top: -1px; height: 3px; pointer-events: none; }
.hk-clock-fill { position: absolute; inset: 0; transform-origin: 0 50%; border-radius: 2px;
  background: var(--line); box-shadow: 0 0 10px var(--line), 0 0 22px rgba(94, 242, 255, 0.5); }
.hk.low .hk-clock-fill { background: var(--red); box-shadow: 0 0 10px var(--red), 0 0 22px var(--red-soft);
  animation: hk-throb 0.5s ease-in-out infinite alternate; }
@keyframes hk-throb { to { opacity: 0.45; } }
.hk-clock-loss { position: absolute; top: 0; height: 3px; opacity: 0; border-radius: 2px; background: var(--red);
  box-shadow: 0 0 12px var(--red); }
.hk-clock-loss.go { animation: hk-loss 0.9s cubic-bezier(0.3, 0.6, 0.4, 1) both; }
@keyframes hk-loss {
  0% { opacity: 1; transform: none; filter: brightness(2); }
  25% { opacity: 1; transform: translateY(0) scaleY(2.2); }
  100% { opacity: 0; transform: translateY(26px) scaleY(1) skewX(-30deg); }
}

.hk-head { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
.hk-title { font-size: 13px; letter-spacing: 0.14em; color: var(--muted); }
.hk-title b { color: var(--line); font-weight: 600; }
.hk-time { font-size: 30px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--line);
  text-shadow: 0 0 14px rgba(94, 242, 255, 0.55); min-width: 4.5ch; text-align: right; }
.hk-time small { font-size: 14px; color: var(--muted); margin-left: 3px; text-shadow: none; }
.hk.low .hk-time { color: var(--red); text-shadow: 0 0 14px var(--red-soft); }
.hk-time.hurt { animation: hk-hurt 0.5s ease-out; }
@keyframes hk-hurt { 0% { color: #fff; transform: scale(1.25) translateX(-4px); text-shadow: 0 0 20px var(--red); }
  100% { transform: none; } }

.hk-body { display: flex; gap: 40px; align-items: stretch; }

/* the code matrix */
.hk-grid { position: relative; display: grid; gap: var(--gap);
  grid-template-columns: repeat(var(--n), var(--cell)); grid-auto-rows: var(--cell); padding: 10px;
  border-radius: 18px; border: 1px solid var(--line-faint); background: rgba(0, 0, 0, 0.35); }
.hk-band, .hk-preview { position: absolute; pointer-events: none; border-radius: 12px; z-index: 0;
  transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.22s, height 0.22s, opacity 0.15s; }
.hk-band { border: 1.5px solid var(--line); background: rgba(94, 242, 255, 0.09);
  box-shadow: 0 0 16px rgba(94, 242, 255, 0.35), inset 0 0 18px rgba(94, 242, 255, 0.12); }
.hk-preview { border: 1px dashed var(--line-soft); opacity: 0; }
.hk-preview.on { opacity: 1; }
.hk-band.row, .hk-preview.row { left: 4px; right: 4px; width: auto; height: calc(var(--cell) + 12px);
  top: 4px; transform: translateY(calc(var(--i) * (var(--cell) + var(--gap)))); }
.hk-band.col, .hk-preview.col { top: 4px; bottom: 4px; height: auto; width: calc(var(--cell) + 12px);
  left: 4px; transform: translateX(calc(var(--i) * (var(--cell) + var(--gap)))); }
.hk.over .hk-band { opacity: 0.25; }

.hk-cell { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; font-size: calc(var(--cell) * 0.36); font-weight: 600; letter-spacing: 0.04em;
  color: rgba(226, 253, 255, 0.34); outline: none; cursor: default;
  transition: color 0.12s, background-color 0.12s, box-shadow 0.12s, transform 0.12s; }
.hk.on .hk-cell { animation: hk-cell-in 0.36s ease-out both; animation-delay: var(--d, 0ms); }
@keyframes hk-cell-in { 0% { opacity: 0; transform: translateY(-6px); color: var(--line); } 100% { opacity: 1; } }
.hk-cell.line { color: var(--ice); }
.hk-cell.pick { cursor: pointer; }
.hk-cell.pick:hover, .hk-cell.pick:focus-visible {
  color: #001014; background: var(--line); transform: scale(1.07);
  box-shadow: 0 0 18px rgba(94, 242, 255, 0.75), 0 0 2px #fff inset; }
.hk-cell.used { color: transparent; }
.hk-cell.used::before { content: ""; position: absolute; inset: 22%; border-radius: 8px;
  border: 1.5px solid var(--line-soft); }
.hk-cell.used::after { content: attr(data-n); position: absolute; font-size: calc(var(--cell) * 0.24);
  color: var(--line); opacity: 0.8; }
.hk-cell.ruled { color: rgba(255, 45, 75, 0.7); text-decoration: line-through 2px var(--red); }
.hk-cell.ruled.pick:hover, .hk-cell.ruled.pick:focus-visible {
  background: var(--red); color: #14000a; box-shadow: 0 0 18px var(--red-soft); }
.hk-cell.pop { animation: hk-pop 0.42s ease-out !important; }
@keyframes hk-pop { 0% { background: #fff; color: #001014; transform: scale(1.22); box-shadow: 0 0 34px var(--line); }
  100% { background: transparent; transform: none; } }
.hk-cell.bad { animation: hk-bad 0.6s steps(2, jump-none) !important; }
@keyframes hk-bad { 0%, 40% { background: var(--red); color: #14000a; box-shadow: 0 0 28px var(--red); }
  20%, 60% { background: transparent; color: var(--red); } 100% { background: transparent; } }

/* the right side: the target, what is entered, the marks */
.hk-side { display: flex; flex-direction: column; gap: 14px; width: 432px; padding-top: 4px; }
.hk-cap { font-size: 12px; letter-spacing: 0.12em; color: var(--muted); }
.hk-seq { display: flex; gap: 10px; }
.hk-slot { position: relative; width: 62px; display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
.hk-want, .hk-got { height: 50px; display: flex; align-items: center; justify-content: center; border-radius: 10px;
  font-size: 22px; font-weight: 600; letter-spacing: 0.04em; }
.hk-want { border: 1.5px solid var(--line-soft); color: var(--ice); background: rgba(94, 242, 255, 0.04); }
.hk-slot.qq .hk-want { border-style: dashed; border-color: var(--red-soft); color: var(--red);
  background: var(--red-faint); text-shadow: 0 0 10px var(--red-soft); }
.hk-slot.was-qq:not(.qq) .hk-want { border-color: var(--line); box-shadow: 0 0 12px rgba(94, 242, 255, 0.3); }
.hk-slot.now .hk-want { border-color: var(--line); box-shadow: 0 0 16px rgba(94, 242, 255, 0.45); }
.hk-slot.now.qq .hk-want { border-color: var(--red); box-shadow: 0 0 16px var(--red-soft);
  animation: hk-throb 0.7s ease-in-out infinite alternate; }
.hk-slot.now::after { content: ""; position: absolute; left: 50%; top: -12px; margin-left: -5px;
  border: 5px solid transparent; border-top-color: var(--line); }
.hk-got { border: 1px solid var(--line-faint); color: var(--line); background: rgba(0, 0, 0, 0.3); }
.hk-got.in { background: rgba(94, 242, 255, 0.14); border-color: var(--line-soft); text-shadow: 0 0 10px var(--line); }
.hk-got.pop { animation: hk-pop 0.42s ease-out; }
.hk-want.reveal { animation: hk-reveal 0.7s steps(7, jump-end); }
@keyframes hk-reveal { 0% { color: var(--red); transform: skewX(-20deg); filter: blur(1px); }
  30% { color: #fff; transform: skewX(14deg) translateX(3px); } 60% { transform: skewX(-6deg); }
  100% { transform: none; } }
.hk-marks { display: flex; flex-direction: column; align-items: center; gap: 3px; min-height: 20px; }
.hk-marks span { font-size: 15px; font-weight: 600; color: var(--red); opacity: 0.85;
  text-decoration: line-through 2px; }
.hk-marks span.new { animation: hk-mark 0.5s ease-out; }
@keyframes hk-mark { 0% { transform: scale(1.8); opacity: 0; color: #fff; } 40% { opacity: 1; } 100% { transform: none; } }
.hk-seq.wipe .hk-got { animation: hk-wipe 0.45s steps(3, jump-none); }
@keyframes hk-wipe { 0% { background: var(--red-soft); border-color: var(--red); } 100% { background: transparent; } }

.hk-hint { min-height: 44px; font-size: 14px; line-height: 1.5; color: var(--muted); max-width: 440px; }
.hk-hint b { color: var(--ice); font-weight: 600; }
.hk-hint .warn { color: var(--red); }
.hk-tally { font-size: 13px; color: var(--muted); }
.hk-tally b { color: var(--red); font-weight: 600; }

.hk-keys { margin-top: auto; display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 12px; color: var(--muted);
  border-top: 1px solid var(--line-faint); padding-top: 12px; }
.hk-keys kbd { font-family: inherit; color: var(--line); border: 1px solid var(--line-soft); border-radius: 5px;
  padding: 1px 6px; margin-right: 6px; }

/* feedback */
.hk-panel.shake { animation: hk-shake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
@keyframes hk-shake {
  10%, 90% { transform: translate(-2px, 1px); } 20%, 80% { transform: translate(5px, -2px); }
  30%, 50%, 70% { transform: translate(-9px, 2px); filter: hue-rotate(150deg) saturate(2); }
  40%, 60% { transform: translate(9px, -1px); filter: none; } }
.hk-flash { position: absolute; inset: 0; border-radius: 26px; pointer-events: none; opacity: 0; }
.hk-flash.win { animation: hk-flash-win 1s ease-out; }
.hk-flash.fail { animation: hk-flash-fail 1.1s ease-out; }
.hk-flash.hit { animation: hk-flash-hit 0.35s ease-out; }
@keyframes hk-flash-win { 0% { opacity: 1; background: rgba(220, 255, 255, 0.85); } 100% { opacity: 0; background: rgba(94, 242, 255, 0); } }
@keyframes hk-flash-fail { 0%, 20%, 40% { opacity: 1; background: rgba(255, 45, 75, 0.45); }
  10%, 30% { opacity: 0.2; } 100% { opacity: 0; } }
@keyframes hk-flash-hit { 0% { opacity: 1; background: rgba(255, 45, 75, 0.22); } 100% { opacity: 0; } }

.hk-result { position: absolute; inset: 0; border-radius: 26px; display: none; flex-direction: column; overflow: hidden;
  align-items: center; justify-content: center; gap: 10px; pointer-events: none;
  background: radial-gradient(ellipse 62% 34% at 50% 50%, rgba(0, 0, 0, 0.92) 45%, rgba(0, 0, 0, 0.5)); }
.hk-result.on { display: flex; animation: hk-result-in 0.5s cubic-bezier(0.2, 0.9, 0.2, 1) both; }
.hk-result h2 { margin: 0; font-size: 44px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
.hk-result p { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: 0.12em; color: var(--ice);
  text-transform: uppercase; }
.hk-result p.in { animation: hk-result-in 0.4s cubic-bezier(0.2, 0.9, 0.2, 1) both; }
.hk-result.fail p { color: #ffb3bf; }
.hk-result.win h2 { color: var(--line); text-shadow: 0 0 24px var(--line); }
.hk-result.fail h2 { color: var(--red); text-shadow: 0 0 24px var(--red); }
@keyframes hk-result-in { 0% { opacity: 0; transform: scale(1.3); letter-spacing: 0.6em; } 100% { opacity: 1; } }
.hk.done .hk-cell, .hk.done .hk-band { opacity: 0.35; }

/* the end: the panel takes the result's colour while the result holds */
.hk.win .hk-panel { border-color: var(--line); transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.9), 0 0 46px rgba(94, 242, 255, 0.5), inset 0 0 60px rgba(94, 242, 255, 0.14); }
.hk.fail .hk-panel { border-color: var(--red); transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.9), 0 0 46px var(--red-soft), inset 0 0 60px var(--red-faint); }
.hk.win .hk-result::before, .hk.fail .hk-result::before { content: ""; position: absolute; left: 0; right: 0; height: 2px;
  top: 0; background: var(--line); box-shadow: 0 0 18px var(--line); animation: hk-sweep 0.9s ease-in-out both; }
.hk.fail .hk-result::before { background: var(--red); box-shadow: 0 0 18px var(--red); }
@keyframes hk-sweep { 0% { top: 0; opacity: 1; } 100% { top: 100%; opacity: 0; } }

/* closing after a finished hack: the panel tears into slices, collapses to a line and goes out */
.hk.on.out { opacity: 0; transition: opacity 0.2s ease-in 0.2s; }
.hk.out .hk-panel { animation: hk-glitch-out 0.42s steps(10, jump-end) both; }
@keyframes hk-glitch-out {
  0% { transform: none; clip-path: inset(0 0 0 0 round 26px); filter: none; }
  12% { transform: translateX(-16px) skewX(14deg); clip-path: inset(8% 0 58% 0); filter: hue-rotate(110deg) brightness(1.8); }
  24% { transform: translateX(20px); clip-path: inset(46% 0 18% 0); filter: none; }
  36% { transform: translateX(-8px) skewX(-22deg); clip-path: inset(22% 0 40% 0); filter: brightness(2.4) saturate(2); }
  48% { transform: translateX(10px); clip-path: inset(62% 0 6% 0); }
  60% { transform: scaleY(0.05); clip-path: inset(0 0 0 0); filter: brightness(3); }
  80% { transform: scale(1.05, 0.01); filter: brightness(4); }
  100% { transform: scale(0, 0.005); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hk *, .hk { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`

let injected = false

export function injectHackStyle(doc: Document): void {
  if (injected) return
  injected = true
  const el = doc.createElement('style')
  el.dataset['hack'] = ''
  el.textContent = CSS
  doc.head.appendChild(el)
}
