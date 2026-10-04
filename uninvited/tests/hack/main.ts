// Standalone bench for the hacking mini-game: core + view + input wired the way the game will wire them.
// URL parameters (for screenshots and bug reports): ?d=0.3&bonus=0&seed=123&freeze=1&full=1&hold=1
// As in the game, a finished hack holds its result for hack.view.outroSec and then closes with a glitch;
// hold=1 keeps the result on screen (screenshots).
import corridor from '../../art/generated/NN1b-net-corridor.jpg'
import cfgAll from '../../config.json'
import { hackParams, hackPick, hackTick, solveHack, startHack, type HackEvent, type HackSession } from '../../core/hack/index'
import { createRng } from '../../core/random'
import { bindHackInput } from '../../input/hack'
import { createHackView } from '../../view/hack/index'

const cfg = cfgAll.hack
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const stage = $('stage')
const difficulty = $<HTMLInputElement>('difficulty')
const dval = $('dval')
const params = $('params')
const bonus = $<HTMLInputElement>('bonus')
const seedInput = $<HTMLInputElement>('seed')
const freeze = $<HTMLInputElement>('freeze')
const resultEl = $('result')
stage.style.backgroundImage = `url(${corridor})`

const q = new URLSearchParams(location.search)
if (q.has('d')) difficulty.value = q.get('d') as string
if (q.has('bonus')) bonus.value = q.get('bonus') as string
if (q.has('seed')) seedInput.value = q.get('seed') as string
if (q.get('freeze') === '1') freeze.checked = true

const view = createHackView(stage)
let session: HackSession | null = null
let unbind: (() => void) | null = null
let seedUsed = 0
let outroTimer = 0
const hold = q.get('hold') === '1'

function showParams(): void {
  const d = Number(difficulty.value)
  const p = hackParams(d, cfg)
  dval.textContent = d.toFixed(2)
  params.textContent = `${p.size}x${p.size} ${p.codeCount} codes, length ${p.length}, ${p.hidden} hidden, ${p.timeSec.toFixed(0)} s, miss -${p.penaltySec.toFixed(1)}`
}

function setResult(text: string, cls = ''): void {
  resultEl.textContent = text
  resultEl.className = cls
}

function report(events: readonly HackEvent[]): void {
  const s = session
  if (!s) return
  for (const e of events) {
    if (e.type === 'hackSolved') {
      setResult(`ACCESS GRANTED - ${(s.timeTotal - s.timeLeft).toFixed(1)} s used, ${s.mistakes} misses (seed ${seedUsed})`, 'win')
      endWith('access granted', 'red wall open (bench)')
    }
    if (e.type === 'hackTimedOut') {
      setResult(`HACK FAILED - alarm up (seed ${seedUsed})`, 'fail')
      endWith('hack failed', 'alarm up to 1 (bench)')
    }
  }
}

/** What the game does when a session ends: its own words on the result, hold, then close with a glitch. */
function endWith(title: string, detail: string): void {
  const s = session
  if (!s) return
  view.update(s) // the result appears now, then the game's words replace its detail line
  view.outcome(title, detail)
  window.clearTimeout(outroTimer)
  if (hold) return
  outroTimer = window.setTimeout(() => {
    if (session !== s) return
    session = null
    view.hide()
    unbind?.()
    unbind = null
  }, cfg.view.outroSec * 1000)
}

function newPuzzle(): void {
  window.clearTimeout(outroTimer)
  seedUsed = seedInput.value === '' ? Math.floor(Math.random() * 1e9) : Number(seedInput.value)
  session = startHack(createRng(seedUsed), Number(difficulty.value), Number(bonus.value) || 0, cfg)
  view.show(session)
  unbind?.()
  unbind = bindHackInput(stage, pick, cancel)
  setResult(`running (seed ${seedUsed})`)
  difficulty.blur()
}

function pick(row: number, col: number): void {
  if (session) report(hackPick(session, row, col))
}

function cancel(): void {
  if (session?.status === 'running') setResult(`HACK ABORTED (seed ${seedUsed})`)
  session = null
  view.hide()
  unbind?.()
  unbind = null
}

difficulty.addEventListener('input', showParams)
$('new').addEventListener('click', newPuzzle)
$('toggle').addEventListener('click', () => document.body.classList.toggle('full'))
if (q.get('full') === '1') document.body.classList.add('full')
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyN' && !(e.target instanceof HTMLInputElement)) newPuzzle()
})

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (session) {
    if (!freeze.checked) report(hackTick(session, dt))
    view.update(session)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

showParams()
newPuzzle()

// handles for the Playwright screenshots
;(window as unknown as Record<string, unknown>)['__hack'] = {
  get session() {
    return session
  },
  pick,
  solution: () => (session ? solveHack(session) : null),
  tick: (sec: number) => session && report(hackTick(session, sec)),
}
