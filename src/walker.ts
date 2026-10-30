import type { Pen } from './line/pen.ts'
import type { Seat } from './pot.ts'

// A small ink creature that lives on the pen tip. It walks wherever the line goes — up book
// spines, over roofs, down the margins — faces the way it's moving, and sits down to say
// something when you stop scrolling. Left alone a while, it opens a little laptop and gets some
// coding done; left alone longer, it shuts the lid and dozes off. At the end of the
// line there's nowhere left to walk, so it hops over to the corner pot to smell the flower.

const SIT_AFTER = 1400
const CODE_AFTER = 6000
const SLEEP_AFTER = 15000
const VISIT_AFTER = 2600
// How far the walker's head reaches from its feet (see .walker-body).
const HEIGHT = 32
// How far along the line, each way, it looks to see which way is up: wide enough to ride over
// the pen's wobble and round corners instead of twitching at them.
const LOOK = 16
// How quickly it turns to face a new heading: higher is snappier.
const TURN = 14
const TAPS = ['hey!', 'hehe.', 'boing.', 'again!', ':)']
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

const at = ([x, y]: [number, number]) => `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
/** A hop from a to b, as keyframes: up and over, then down. */
const arcing = (a: [number, number], b: [number, number]): Keyframe[] => [
  { transform: at(a), easing: 'ease-out' },
  { transform: at([(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 60]), easing: 'ease-in' },
  { transform: at(b) },
]

export function createWalker(root: HTMLElement, home: () => Seat | null = () => null) {
  const body = root.querySelector<HTMLElement>('.walker-body')!
  const says = root.querySelector<HTMLElement>('.walker-says')!
  let facingLeft = false
  // The way it should face, and the way it faces right now, easing toward it.
  let angle = 0
  let facing = 0
  let turning = 0
  let lastTurn = 0
  let lastTip = -1
  let dir = 1
  let sitTimer = 0
  let codeTimer = 0
  let sleepTimer = 0
  let visitTimer = 0
  let taps = 0
  let pen: Pen | null = null
  // Where it sits by the pot, in viewport coordinates, while it's there.
  let potted: Seat | null = null
  // Measured on resize, not every frame: reading it after a write would force a layout.
  let width = document.documentElement.clientWidth

  const say = (text: string | undefined) => {
    if (says.textContent === (text ?? '') && root.classList.contains('is-talking') === !!text) return
    says.textContent = text ?? ''
    root.classList.toggle('is-talking', !!text)
  }

  const sit = () => {
    root.classList.remove('is-walking')
    root.classList.add('is-sitting')
    if (pen) say(pen.laneAt(pen.tip).stop?.dataset.says)
    doze()
    clearTimeout(visitTimer)
    if (pen && pen.tip >= pen.line.total - 1) visitTimer = window.setTimeout(visit, VISIT_AFTER)
  }

  // Out comes the laptop (see .walker-laptop); it types away until it's time to sleep.
  const code = () => {
    say(undefined)
    root.classList.add('is-coding')
  }

  const sleep = () => {
    // The laptop stays out, lid shut.
    root.classList.remove('is-coding')
    root.classList.add('is-sleeping')
    // Three z's, each drifting up and away in turn (see .walker-z).
    says.replaceChildren(
      ...[0, 1, 2].map(() => Object.assign(document.createElement('span'), { className: 'walker-z', textContent: 'z' })),
    )
    root.classList.add('is-talking')
  }

  const wake = () => {
    clearTimeout(codeTimer)
    clearTimeout(sleepTimer)
    root.classList.remove('is-coding', 'is-sleeping')
  }

  const doze = () => {
    wake()
    codeTimer = window.setTimeout(code, CODE_AFTER)
    sleepTimer = window.setTimeout(sleep, SLEEP_AFTER)
  }

  const steer = (now: number) => {
    const dt = lastTurn ? Math.min(0.05, (now - lastTurn) / 1000) : 1 / 60
    lastTurn = now
    facing += (angle - facing) * (1 - Math.exp(-TURN * dt))
    if (Math.abs(angle - facing) < 0.002) facing = angle
    body.style.rotate = `${facing.toFixed(3)}rad`
    turning = facing === angle ? 0 : requestAnimationFrame(steer)
  }

  const face = () => {
    if (reduced.matches) {
      facing = angle
      body.style.rotate = `${facing.toFixed(3)}rad`
    } else if (!turning) {
      lastTurn = 0
      turning = requestAnimationFrame(steer)
    }
  }

  const hop = () => {
    body.classList.remove('is-hopping')
    void body.offsetWidth
    body.classList.add('is-hopping')
  }

  body.addEventListener('click', () => {
    hop()
    say(TAPS[taps++ % TAPS.length])
    if (root.classList.contains('is-sitting')) doze()
  })
  body.addEventListener('animationend', () => body.classList.remove('is-hopping'))

  // The pot is fixed to the corner of the screen, so by the pot the walker is too.
  const visit = () => {
    const seat = home()
    if (!seat || !pen) return
    const [x, y] = pen.pointAt(pen.tip)
    potted = seat
    // Upright, by the shortest way round.
    angle = Math.round(facing / (Math.PI * 2)) * Math.PI * 2
    face()
    root.classList.add('is-potted', 'is-flipped')
    root.classList.remove('is-sniffing')
    body.style.scale = '1 1'
    say(undefined)
    root.style.transform = at([seat.x, seat.y])
    const arrive = () => {
      if (potted !== seat) return
      root.classList.add('is-sniffing')
      say(seat.says)
      doze()
    }
    if (reduced.matches) return arrive()
    hop()
    root.animate(arcing([x - scrollX, y - scrollY], [seat.x, seat.y]), { duration: 700 }).onfinish = arrive
  }

  /** Back to the line; returns where it was sitting, in page coordinates. */
  const leave = (): [number, number] => {
    const seat = potted!
    potted = null
    root.getAnimations().forEach((a) => a.cancel())
    root.classList.remove('is-potted', 'is-sniffing')
    return [seat.x + scrollX, seat.y + scrollY]
  }

  addEventListener('resize', () => {
    width = document.documentElement.clientWidth
    const seat = potted && home()
    if (!seat) return
    potted = seat
    root.style.transform = at([seat.x, seat.y])
  })

  /** Pipe up from wherever it is, unless it's busy walking. */
  function chirp(text: string) {
    if (root.classList.contains('is-walking')) return
    wake()
    hop()
    say(text)
    if (root.classList.contains('is-sitting')) doze()
  }

  function update(p: Pen) {
    pen = p
    const tip = p.tip
    const moved = lastTip < 0 ? 0 : tip - lastTip
    lastTip = tip
    let back: [number, number] | null = null

    if (Math.abs(moved) > 0.05) {
      dir = moved > 0 ? 1 : -1
      root.classList.add('is-walking')
      root.classList.remove('is-sitting')
      wake()
      say(undefined)
      clearTimeout(sitTimer)
      clearTimeout(visitTimer)
      sitTimer = window.setTimeout(sit, SIT_AFTER)
      if (potted) back = leave()
    } else if (!sitTimer) {
      sitTimer = window.setTimeout(sit, SIT_AFTER)
    }
    if (potted) return

    const [x, y] = p.pointAt(tip)
    const [ax, ay] = p.pointAt(tip - LOOK)
    const [bx, by] = p.pointAt(tip + LOOK)
    let heading = Math.atan2(by - ay, bx - ax) + (dir < 0 ? Math.PI : 0)
    if (Math.abs(Math.cos(heading)) > 0.6) facingLeft = Math.cos(heading) < 0
    heading -= facingLeft ? Math.PI : 0
    // On narrow screens the margins are too thin to stand on the outside of the line, so
    // hang on the inside instead: turned half round and mirrored, it still faces its way.
    let mirrored = facingLeft
    const headX = x + Math.sin(heading) * HEIGHT
    if (headX < 0 || headX > width) {
      heading += Math.PI
      mirrored = !mirrored
    }
    // Unwrap so CSS never spins the long way round.
    while (heading - angle > Math.PI) heading -= Math.PI * 2
    while (heading - angle < -Math.PI) heading += Math.PI * 2
    // A big turn (like that half-turn flip) should swing through the page, not past its edge.
    const turn = heading - angle
    const midX = x + Math.sin(angle + turn / 2) * HEIGHT
    if (Math.abs(turn) > Math.PI / 2 && (midX < 0 || midX > width)) heading -= Math.sign(turn) * Math.PI * 2
    angle = heading

    root.style.transform = at([x, y])
    if (back && !reduced.matches) {
      hop()
      root.animate(arcing(back, [x, y]), { duration: 450 })
    }
    root.classList.toggle('is-flipped', x > width - 170)
    face()
    body.style.scale = mirrored ? '-1 1' : '1 1'
  }

  return { update, chirp }
}
