import { decode, grow, headPath, heartColor, isoDate, nameOf, type Flower } from './flower.ts'
import type { Pen } from './line/pen.ts'

// The pot in the corner is the visitor's own plant. The stem follows the pen from one section to
// the next, every section reached puts out a leaf, and when the line is finished it blooms with a
// flower of its own (see flower.ts). Tap the bloom to pick it; hold the pot to water it.
//
// It remembers: a bloom stays for the rest of the visit, a picked flower grows back next visit,
// and every return visit adds a sprout at the soil. It knows the season, closes up at night when
// the lamp goes on, and leans when the page scrolls past fast.
//
// Open the site with ?flower=… and the pot holds that flower instead: a gift from someone.

interface Memory {
  seed: number
  visits: number
  /** When this visit began, and when the visitor was last seen. */
  began: number
  seen: number
  /** The visit the plant last bloomed in, and the visit its flower was last picked in. */
  bloomed: number
  picked: number
}

export interface Seat {
  x: number
  y: number
  says: string
}

export interface Picked {
  flower: Flower
  /** Where on screen it was picked from. */
  from: DOMRect
  /** Which visit grew it; null for a gift. */
  visit: number | null
}

const KEY = 'pot'
// Away this long, and coming back counts as a new visit.
const VISIT_GAP = 30 * 60 * 1000
const HOLD_MS = 450
const SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

function remember(): Memory {
  let saved: Partial<Memory> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
  } catch {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const now = Date.now()
  const fresh = now - num(saved.seen) > VISIT_GAP
  return {
    seed: num(saved.seed) || Math.floor(Math.random() * 2 ** 31) + 1,
    visits: num(saved.visits) + (fresh ? 1 : 0),
    began: fresh ? now : num(saved.began) || now,
    seen: now,
    bloomed: num(saved.bloomed),
    picked: num(saved.picked),
  }
}

export function createPot(root: HTMLElement, hooks: { pick: (p: Picked) => void; watered: () => void }) {
  const button = root.querySelector<HTMLButtonElement>('.pot-button')!
  const art = root.querySelector<SVGSVGElement>('.pot-art')!
  const plant = root.querySelector<SVGGElement>('.pot-plant')!
  const sway = root.querySelector<SVGGElement>('.pot-sway')!
  const bloomEl = root.querySelector<SVGGElement>('.pot-bloom')!
  const leaves = [...root.querySelectorAll<SVGElement>('.pot-leaf')]
  const sprouts = [...root.querySelectorAll<SVGElement>('.pot-sprout')]
  const count = root.querySelector<HTMLElement>('.pot-count > span')!

  const mem = remember()
  const fresh = mem.began === mem.seen
  const save = () => {
    mem.seen = Date.now()
    try {
      localStorage.setItem(KEY, JSON.stringify(mem))
    } catch {}
  }
  save()
  addEventListener('pagehide', save)
  document.addEventListener('visibilitychange', () => document.hidden && save())

  const params = new URLSearchParams(location.search)
  const gift = decode(params.get('flower'))
  const began = new Date(mem.began)
  const flower = gift ?? grow(mem.seed ^ Math.imul(mem.visits, 0x9e3779b1), began.getHours(), isoDate(began))
  const name = nameOf(flower)
  const asked = params.get('season') ?? ''
  root.dataset.season = SEASONS.includes(asked) ? asked : SEASONS[new Date().getMonth()]
  root.style.setProperty('--heart', heartColor(flower))
  root.classList.toggle('is-tulip', flower.tulip)
  root.querySelector('.pot-petals')!.setAttribute('d', flower.tulip ? headPath(flower, 24, 9, 4.6) : headPath(flower, 24, 7, 5.5))

  let line: Pen['line'] | null = null
  // Where each section's stretch of the line begins.
  let starts: number[] = []
  let reached = -1
  let grown = ''
  // Fully grown: in bloom (or picked) this visit, or holding a gift. Nothing folds away after that.
  let full = false
  let met = false
  let note = ''
  let noteTimer = 0
  const pickedNow = () => !gift && mem.picked === mem.visits

  function caption() {
    count.textContent =
      note ||
      (gift ? 'for you' : full ? (pickedNow() ? 'grows back' : name.name) : `${reached + 1} of ${starts.length}`)
    button.setAttribute(
      'aria-label',
      gift
        ? `A gift: a ${name.name}. Press to open it.`
        : full
          ? pickedNow()
            ? `Your plant. You picked its ${name.name}; another grows next visit. Hold to water.`
            : `Your plant is in bloom: a ${name.name}. Press to pick it, hold to water.`
          : `Your plant, ${reached + 1} of ${starts.length} sections grown. Hold to water.`,
    )
  }

  function flash(text: string, ms = 2400) {
    note = text
    caption()
    clearTimeout(noteTimer)
    noteTimer = window.setTimeout(() => {
      note = ''
      caption()
    }, ms)
  }

  function show(on: boolean) {
    root.classList.toggle('is-shown', on)
    root.inert = !on
    if (!on || met) return
    met = true
    if (root.dataset.season === 'autumn') setTimeout(() => root.classList.add('is-falling'), 4000)
    // A sprout for every return visit; on a visit's first page, the newest comes up as the pot appears.
    const n = Math.min(sprouts.length, mem.visits - 1)
    sprouts.forEach((s, i) => s.classList.toggle('is-out', i < n - (fresh ? 1 : 0)))
    if (!fresh) return
    setTimeout(() => sprouts[n - 1]?.classList.add('is-out'), 700)
    if (n > 0 && !gift) flash('welcome back', 2800)
  }

  function fill() {
    full = true
    root.style.setProperty('--grow', '1')
    leaves.forEach((l) => l.classList.add('is-out'))
    root.classList.toggle('is-bloom', !pickedNow())
    root.classList.toggle('is-picked', pickedNow())
    show(true)
    caption()
  }

  if (gift || mem.bloomed === mem.visits) fill()

  function update(p: Pen) {
    if (full) return
    if (p.line !== line) {
      line = p.line
      const seen = new Set<HTMLElement>()
      starts = []
      for (const lane of line.lanes)
        if (lane.stop && !seen.has(lane.stop)) {
          seen.add(lane.stop)
          starts.push(lane.start)
        }
      reached = -1
    }
    const n = starts.length
    if (!n) return

    const tip = p.tip
    let k = 0
    while (k + 1 < n && starts[k + 1] <= tip + 1) k++
    const next = k + 1 < n ? starts[k + 1] : line.total
    const frac = next > starts[k] ? Math.min(1, Math.max(0, (tip - starts[k]) / (next - starts[k]))) : 1

    const g = ((k + frac) / n).toFixed(4)
    if (g !== grown) root.style.setProperty('--grow', (grown = g))

    if (k !== reached) {
      reached = k
      leaves.forEach((l, i) => l.classList.toggle('is-out', i < k))
      show(k > 0)
      caption()
    }

    if (tip >= line.total - 1) {
      mem.bloomed = mem.visits
      save()
      fill()
      flash('pick me', 4000)
    }
  }

  // ---------- tap to pick, hold to water ----------

  let hold = 0
  let held = false
  let watering = false

  const press = () => {
    held = false
    clearTimeout(hold)
    hold = window.setTimeout(() => {
      held = watering = true
      root.classList.add('is-watering')
      note = 'watering…'
      caption()
    }, HOLD_MS)
  }
  const release = () => {
    clearTimeout(hold)
    if (!watering) return
    watering = false
    root.classList.remove('is-watering')
    note = ''
    caption()
    hooks.watered()
  }

  button.addEventListener('pointerdown', (e) => e.button === 0 && press())
  button.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && root.classList.contains('is-bloom') && !gift && flash('pick me', 1800))
  button.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !e.repeat) press()
    else if (e.key === 'Enter') held = false
  })
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, release)
  button.addEventListener('keyup', (e) => e.key === ' ' && release())
  // A long press on touch would otherwise open the context menu.
  button.addEventListener('contextmenu', (e) => e.preventDefault())

  button.addEventListener('click', () => {
    if (held) return void (held = false)
    if (gift) return hooks.pick({ flower, from: bloomEl.getBoundingClientRect(), visit: null })
    if (root.classList.contains('is-bloom')) {
      mem.picked = mem.visits
      save()
      hooks.pick({ flower, from: bloomEl.getBoundingClientRect(), visit: mem.visits })
      root.classList.replace('is-bloom', 'is-picked')
      caption()
      return
    }
    sway.classList.remove('is-rustling')
    sway.getBoundingClientRect()
    sway.classList.add('is-rustling')
    flash('hold to water')
  })
  sway.addEventListener('animationend', () => sway.classList.remove('is-rustling'))

  // ---------- wind ----------

  // Scrolling past fast is a gust: the plant leans into it, then sways back on a soft spring.
  let bend = 0
  let speed = 0
  let push = 0
  let lastY = scrollY
  let lastT = performance.now()
  let prev = 0
  let gust = 0

  const blow = (now: number) => {
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    push *= Math.exp(-dt * 6)
    speed += (60 * (push - bend) - 7 * speed) * dt
    bend += speed * dt
    const still = Math.abs(bend) < 0.05 && Math.abs(speed) < 0.05 && Math.abs(push) < 0.05
    plant.style.transform = still ? '' : `skewX(${bend.toFixed(2)}deg)`
    gust = still ? 0 : requestAnimationFrame(blow)
  }

  addEventListener(
    'scroll',
    () => {
      const now = performance.now()
      const dy = scrollY - lastY
      const dt = Math.max(16, now - lastT)
      lastY = scrollY
      lastT = now
      if (reduced.matches || !root.classList.contains('is-shown')) return
      push = Math.max(-9, Math.min(9, (-dy / dt) * 4))
      if (!gust) {
        prev = now
        gust = requestAnimationFrame(blow)
      }
    },
    { passive: true },
  )

  /** Where the walker can sit beside the pot, in viewport coordinates, and what it says there. */
  function seat(): Seat | null {
    if (!root.classList.contains('is-shown')) return null
    // On the floor beside the label, low enough to stay clear of the footer, and far enough
    // left to leave the label room.
    const label = count.getBoundingClientRect()
    const a = art.getBoundingClientRect()
    const says = gift
      ? 'for you!'
      : pickedNow()
        ? "it'll grow back."
        : flower.tulip
          ? 'a tulip!'
          : flower.petals === 5
            ? 'mmm. plum.'
            : 'mmm.'
    return { x: Math.min(a.left, label.left) - 30, y: label.bottom, says }
  }

  return { update, seat }
}
