import { card, encode, head, headPath, heartColor, longDate, nameOf, type Card, type Flower } from './flower.ts'
import type { Picked } from './pot.ts'

// Picking the flower: it leaves the pot and lands on a small card, drawn in one line like the rest
// of the site. Keep it (a PNG to save), or give it away: a link that puts the same flower in the
// pot of whoever opens it.

const SVG = 'http://www.w3.org/2000/svg'
const DRAW_DELAY = 250
const DRAW_MS = 1800
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const coarse = matchMedia('(pointer: coarse)')

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0
const move = ([x, y]: [number, number]) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`

export function createKeepsake(dialog: HTMLDialogElement) {
  const art = dialog.querySelector<SVGSVGElement>('.keepsake-art')!
  const stroke = dialog.querySelector<SVGPathElement>('.keepsake-line')!
  const cup = dialog.querySelector<SVGPathElement>('.keepsake-cup')!
  const heart = dialog.querySelector<SVGCircleElement>('.keepsake-heart')!
  const nameEl = dialog.querySelector<HTMLElement>('.keepsake-name')!
  const about = dialog.querySelector<HTMLElement>('.keepsake-about')!
  const meta = dialog.querySelector<HTMLElement>('.keepsake-meta')!
  const giveBtn = dialog.querySelector<HTMLButtonElement>('[data-give]')!
  const note = dialog.querySelector<HTMLElement>('.keepsake-note')!
  const site = dialog.dataset.site ?? ''

  let shown: { flower: Flower; drawing: Card; lines: [string, string, string] } | null = null

  // A click on the dialog itself, outside the card, is a click on the backdrop.
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close())
  dialog.addEventListener('close', () => dialog.querySelectorAll('.keepsake-flight').forEach((f) => f.remove()))
  dialog.querySelector('[data-keep]')!.addEventListener('click', () => void keep())
  giveBtn.addEventListener('click', () => void give())

  function open({ flower, from, visit }: Picked) {
    const drawing = card(flower, hash(encode(flower)))
    const n = nameOf(flower)
    const when = longDate(flower.date)
    shown = {
      flower,
      drawing,
      lines: [n.name, n.more, visit ? `grown on ${site}'s site · ${when} · visit ${visit}` : `a gift · grown on ${site}'s site · ${when}`],
    }

    stroke.setAttribute('d', drawing.d)
    cup.setAttribute('d', drawing.cup ?? '')
    heart.setAttribute('cx', String(drawing.heart?.x ?? 0))
    heart.setAttribute('cy', String(drawing.heart?.y ?? 0))
    heart.setAttribute('r', String(drawing.heart?.r ?? 0))
    dialog.style.setProperty('--heart', heartColor(flower))
    dialog.style.setProperty('--heart-at', `${Math.round(DRAW_DELAY + DRAW_MS * drawing.at[1])}ms`)
    nameEl.textContent = shown.lines[0]
    about.textContent = shown.lines[1]
    meta.textContent = shown.lines[2]
    giveBtn.textContent = visit ? 'give it to someone' : 'pass it on'
    note.textContent = ''

    dialog.showModal()
    // Start the drawing over: measure it undrawn, then let it draw.
    dialog.classList.remove('is-drawing')
    void dialog.offsetWidth
    dialog.classList.add('is-drawing')
    if (!reduced.matches && from.width) fly(flower, from, drawing)
  }

  /** The flower leaves the pot and lands on the card, just where the line will draw its head. */
  function fly(flower: Flower, from: DOMRect, drawing: Card) {
    const ctm = art.getScreenCTM()
    if (!ctm) return
    const R = 10
    const pts = head(flower, 0, 0, R)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }

    const clone = document.createElementNS(SVG, 'svg')
    clone.classList.add('keepsake-flight')
    clone.classList.toggle('is-tulip', flower.tulip)
    clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`)
    const petals = document.createElementNS(SVG, 'path')
    petals.setAttribute('d', headPath(flower, 0, 0, R))
    clone.append(petals)
    if (!flower.tulip) {
      const dot = document.createElementNS(SVG, 'circle')
      dot.setAttribute('r', String((1.7 / 5.5) * R))
      clone.append(dot)
    }

    // Where it lands, in screen pixels.
    const b = drawing.box
    const c = new DOMPoint(b.x + b.w / 2, b.y + b.h / 2).matrixTransform(ctm)
    const w = b.w * Math.hypot(ctm.a, ctm.b)
    const h = (w * box.h) / box.w
    Object.assign(clone.style, { left: `${c.x - w / 2}px`, top: `${c.y - h / 2}px`, width: `${w}px`, height: `${h}px` })
    dialog.append(clone)

    const s = from.width / w
    const start: [number, number] = [from.left + from.width / 2 - c.x, from.top + from.height / 2 - c.y]
    const peak: [number, number] = [start[0] * 0.45, Math.min(start[1], 0) * 0.45 - 60]
    clone.animate(
      [
        { transform: `${move(start)} scale(${s})`, easing: 'ease-out' },
        { transform: `${move(peak)} scale(${(s + 1) / 2}) rotate(-25deg)`, easing: 'ease-in' },
        { transform: 'none' },
      ],
      { duration: 800 },
    )
    // Once the pen has drawn over it, the real flower can go.
    const fade = clone.animate([{ opacity: 1 }, { opacity: 0 }], { delay: DRAW_DELAY + DRAW_MS * drawing.at[1], duration: 500, fill: 'forwards' })
    fade.onfinish = () => clone.remove()
  }

  const say = (text: string) => (note.textContent = text)

  async function keep() {
    if (!shown) return
    const blob = await png(shown)
    if (!blob) return say("couldn't press it this time.")
    const file = new File([blob], `flower-${shown.flower.date}.png`, { type: 'image/png' })
    if (coarse.matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return say('kept.')
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    say('pressed and saved.')
  }

  async function give() {
    if (!shown) return
    const url = `${location.origin}/?flower=${encode(shown.flower)}`
    if (coarse.matches && navigator.share) {
      try {
        await navigator.share({ title: 'a flower for you', text: `I grew this ${nameOf(shown.flower).name} on ${site}'s site. It's yours.`, url })
        return say('sent.')
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      say('link copied. whoever opens it gets this flower.')
    } catch {
      say(url)
    }
  }

  /** The card as a picture, in the colours of the current theme. */
  async function png({ drawing, lines }: NonNullable<typeof shown>): Promise<Blob | null> {
    const probe = dialog.appendChild(document.createElement('span'))
    const color = (v: string) => {
      probe.style.color = v
      return getComputedStyle(probe).color
    }
    const [paper, ink, ink2, ink3, tint] = ['var(--paper)', 'var(--ink)', 'var(--ink-2)', 'var(--ink-3)', 'var(--heart)'].map(color)
    probe.remove()
    const font = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v)
    await Promise.all([document.fonts.load(`italic 300 112px ${font('--serif')}`), document.fonts.load(`400 34px ${font('--sans')}`)])

    const W = 1080
    const H = 1350
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = ink3
    ctx.lineWidth = 2
    ctx.strokeRect(54, 54, W - 108, H - 108)

    ctx.save()
    ctx.translate((W - 240 * 3.6) / 2, 110)
    ctx.scale(3.6, 3.6)
    ctx.fillStyle = tint
    if (drawing.cup) {
      ctx.globalAlpha = 0.45
      ctx.fill(new Path2D(drawing.cup))
      ctx.globalAlpha = 1
    }
    if (drawing.heart) {
      ctx.beginPath()
      ctx.arc(drawing.heart.x, drawing.heart.y, drawing.heart.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = ink
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(new Path2D(drawing.d))
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.fillStyle = ink
    ctx.font = `italic 300 112px ${font('--serif')}`
    ctx.fillText(lines[0], W / 2, 1035)
    ctx.fillStyle = ink2
    ctx.font = `400 34px ${font('--sans')}`
    ctx.fillText(lines[1], W / 2, 1105)
    ctx.fillStyle = ink3
    ctx.font = `400 26px ${font('--mono')}`
    ctx.fillText(lines[2], W / 2, 1165)
    ctx.fillText(location.host, W / 2, 1245)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }

  return { open }
}
