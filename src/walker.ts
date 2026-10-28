import type { Pen } from './line/pen.ts'

// A small ink creature that lives on the pen tip. It walks wherever the line goes — up book
// spines, over roofs, down the margins — faces the way it's moving, and sits down to say
// something when you stop scrolling.

const SIT_AFTER = 1400
const TAPS = ['hey!', 'hehe.', 'boing.', 'again!', ':)']

export function createWalker(root: HTMLElement) {
  const body = root.querySelector<HTMLElement>('.walker-body')!
  const says = root.querySelector<HTMLElement>('.walker-says')!
  let facingLeft = false
  let angle = 0
  let lastTip = -1
  let dir = 1
  let sitTimer = 0
  let taps = 0
  let pen: Pen | null = null

  const say = (text: string | undefined) => {
    says.textContent = text ?? ''
    root.classList.toggle('is-talking', !!text)
  }

  const sit = () => {
    root.classList.remove('is-walking')
    root.classList.add('is-sitting')
    if (pen) say(pen.laneAt(pen.tip).stop?.dataset.says)
  }

  body.addEventListener('click', () => {
    body.classList.remove('is-hopping')
    void body.offsetWidth
    body.classList.add('is-hopping')
    say(TAPS[taps++ % TAPS.length])
  })
  body.addEventListener('animationend', () => body.classList.remove('is-hopping'))

  function update(p: Pen) {
    pen = p
    const tip = p.tip
    const moved = lastTip < 0 ? 0 : tip - lastTip
    lastTip = tip

    if (Math.abs(moved) > 0.05) {
      dir = moved > 0 ? 1 : -1
      root.classList.add('is-walking')
      root.classList.remove('is-sitting')
      say(undefined)
      clearTimeout(sitTimer)
      sitTimer = window.setTimeout(sit, SIT_AFTER)
    } else if (!sitTimer) {
      sitTimer = window.setTimeout(sit, SIT_AFTER)
    }

    const [x, y] = p.pointAt(tip)
    const [ax, ay] = p.pointAt(tip - 9)
    const [bx, by] = p.pointAt(tip + 9)
    let heading = Math.atan2(by - ay, bx - ax) + (dir < 0 ? Math.PI : 0)
    if (Math.abs(Math.cos(heading)) > 0.6) facingLeft = Math.cos(heading) < 0
    heading -= facingLeft ? Math.PI : 0
    // Unwrap so CSS never spins the long way round.
    while (heading - angle > Math.PI) heading -= Math.PI * 2
    while (heading - angle < -Math.PI) heading += Math.PI * 2
    angle = heading

    root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    root.classList.toggle('is-flipped', x > document.documentElement.clientWidth - 170)
    body.style.rotate = `${angle.toFixed(3)}rad`
    body.style.scale = facingLeft ? '-1 1' : '1 1'
  }

  return { update }
}
