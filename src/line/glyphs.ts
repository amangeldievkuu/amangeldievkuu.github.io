import { arc, leaf, type Box, type Pt } from './geom.ts'

// Each glyph is a detour of the one line: it starts on the ground at the left of its box,
// draws its shape, and comes back down to the ground on the right. Lanes drawn right-to-left
// simply reverse these points.
//
// Some glyphs also publish positions (as CSS custom properties on their element) so HTML
// overlays — a lit window, the lamp button, the light cone — line up with the drawing.

export type Glyph = (b: Box, el: HTMLElement, rand: () => number) => Pt[]

const TAU = Math.PI * 2

function vars(el: HTMLElement, entries: Record<string, number | string>) {
  for (const [k, v] of Object.entries(entries)) el.style.setProperty(`--${k}`, typeof v === 'number' ? `${v.toFixed(1)}px` : v)
}

/** Cursive loops, the way a pen warms up before writing. */
const flourish: Glyph = (b) => {
  const loops = 3
  const end = loops * TAU
  const a = b.w / end
  const pts: Pt[] = []
  for (let t = 0; t < end; t += 0.07) {
    const r = 13 * (1 - 0.2 * Math.floor(t / TAU))
    pts.push([b.x + a * t + r * Math.sin(t), b.g - r * (1 - Math.cos(t))])
  }
  pts.push([b.x + b.w, b.g])
  return pts
}

const book: Glyph = ({ x, g, w, h }) => [
  [x + 1, g],
  [x + 1, g - h],
  [x + w - 1, g - h],
  [x + w - 1, g],
]

/** A picture on the ledge, hung from a nail by a wire. */
const frame: Glyph = ({ x, g, w, h }, _el, rand) => {
  const top = g - h
  const cx = x + w / 2 + (rand() - 0.5) * w * 0.1
  const nail = top - 14 - rand() * 6
  return [
    [x + 1, g],
    [x + 1, top],
    [x + w * 0.24, top],
    [cx, nail],
    ...arc(cx, nail - 2.2, 2.2, Math.PI / 2, Math.PI / 2 + TAU),
    [x + w * 0.76, top],
    [x + w - 1, top],
    [x + w - 1, g],
  ]
}

const house: Glyph = (b, el, rand) => {
  const { x, g, w, h } = b
  const top = g - Math.round(h * 0.6)
  const peak = g - h
  const half = w / 2
  const roofY = (X: number) => peak + (Math.abs(X - (x + half)) * (top - peak)) / half
  const eave = 8
  const dw = 20
  const dh = Math.min(36, g - top - 22)
  const dx = x + w * 0.62 - dw / 2
  const ws = 16
  const wx = x + 14
  const wyTop = top + 14

  const pts: Pt[] = [
    [x, g],
    [dx, g],
    [dx, g - dh + dw / 2],
    ...arc(dx + dw / 2, g - dh + dw / 2, dw / 2, Math.PI, TAU),
    [dx + dw, g],
    [x + w, g],
    [x + w, top],
    [x + w + eave, roofY(x + w + eave)],
  ]
  if (rand() > 0.4) {
    const c1 = x + w * 0.8
    const c2 = x + w * 0.68
    const cTop = roofY(c2) - 13
    pts.push([c1, roofY(c1)], [c1, cTop], [c2, cTop], [c2, roofY(c2)])
  }
  pts.push(
    [x + half, peak],
    [x - eave, roofY(x - eave)],
    [x, top],
    [x, wyTop + ws],
    [wx, wyTop + ws],
    [wx, wyTop],
    [wx + ws, wyTop],
    [wx + ws, wyTop + ws],
    [wx, wyTop + ws],
    [x, wyTop + ws],
    [x, g],
    [x + w, g],
  )
  vars(el, { wx: wx - x + 2.5, wy: wyTop - b.y + 2.5, ws: ws - 5 })
  return pts
}

const plant: Glyph = (b, el, rand) => {
  const cx = b.x + b.w / 2
  const g = b.g

  if (el.classList.contains('is-seed')) {
    const top: Pt = [cx, g - 18]
    return [[cx, g], top, ...leaf(top, -2.3, 10, 6), ...leaf(top, -0.85, 10, 6), top, [cx, g]]
  }

  const bloom = el.hasAttribute('data-bloom')
  const R = 11
  const stemTop = g - b.h + (bloom ? R : 15)
  const sway = rand() < 0.5 ? -1 : 1
  const n = 24
  const stem: Pt[] = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [cx + 3 * sway * Math.sin(t * Math.PI * 1.3), g - t * (g - stemTop)]
  })
  const up: Pt[] = []
  stem.forEach((p, i) => {
    up.push(p)
    if (i === Math.round(n * 0.36)) up.push(...leaf(p, -0.7, 15, 8), p)
    if (i === Math.round(n * 0.6)) up.push(...leaf(p, -2.45, 13, 7), p)
  })
  const [sx, sy] = stem[n]
  const head: Pt[] = bloom
    ? [
        ...Array.from({ length: 121 }, (_, i): Pt => {
          const t = (i / 120) * Math.PI
          const r = R * Math.sin(5 * t)
          const phi = t - Math.PI / 2 - Math.PI / 10
          return [sx + r * Math.cos(phi), sy + r * Math.sin(phi)]
        }),
        ...arc(sx, sy - 2.4, 2.4, Math.PI / 2, Math.PI / 2 + TAU),
      ]
    : arc(sx, sy - 7, 7, Math.PI / 2, Math.PI / 2 + TAU, 4.5)
  return [...up, ...head, ...stem.slice().reverse()]
}

const sign: Glyph = ({ x, g, w }) => {
  const cx = x + 30
  return [
    [cx - 2, g],
    [cx - 2, g - 48],
    [x + 4, g - 48],
    [x + 4, g - 74],
    [x + w - 16, g - 74],
    [x + w - 4, g - 61],
    [x + w - 16, g - 48],
    [cx + 2, g - 48],
    [cx + 2, g],
  ]
}

/** Kites fly on their own strings; the line only ties a small knot where each one is anchored. */
const kite: Glyph = ({ x, g, w }) => arc(x + w / 2, g - 4.5, 4.5, Math.PI / 2, Math.PI / 2 + TAU)

const desk: Glyph = (b, el) => {
  const { x, g, w } = b
  const T = g - 76
  const Lx = x + 54
  const Mx = x + 152
  const Gx = x + 222

  // Anglepoise lamp: an elbowed arm and a dome shade pointing down-right at the desk.
  const E: Pt = [Lx - 20, T - 48]
  const C: Pt = [Lx + 22, T - 78]
  const R = 14
  const aim = 1.05
  const on = (a: number): Pt => [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]
  const P = on(aim + Math.PI)
  const A = on(aim + Math.PI / 2)
  const B = on(aim - Math.PI / 2)
  const toTable = ([qx, qy]: Pt, a: number): Pt => [qx + ((T - qy) / Math.sin(a)) * Math.cos(a), T]

  const rel = (p: Pt) => `${(p[0] - x).toFixed(1)}px ${(p[1] - b.y).toFixed(1)}px`
  vars(el, {
    'lamp-x': Lx - 28 - x,
    'lamp-y': C[1] - R - 8 - b.y,
    // The shade's rim is a diameter, so the bulb sits at its centre.
    'bulb-x': C[0] - x,
    'bulb-y': C[1] - b.y,
    'screen-x': Mx - 34 - x,
    'screen-y': T - 56 - b.y,
    'mug-x': Gx - x,
    'mug-y': T - 20 - b.y,
    light: `polygon(${rel(A)}, ${rel(B)}, ${rel(toTable(B, aim - 0.35))}, ${rel(toTable(A, aim + 0.35))})`,
  })

  return [
    [x + 16, g],
    [x + 16, T],
    [x, T],
    // lamp: base, arm, dome shade, and back down the arm
    [Lx - 14, T],
    [Lx - 10, T - 5],
    [Lx, T - 5],
    E,
    P,
    ...arc(C[0], C[1], R, aim + Math.PI, aim + Math.PI / 2),
    B,
    ...arc(C[0], C[1], R, aim - Math.PI / 2, aim - Math.PI),
    E,
    [Lx, T - 5],
    [Lx + 10, T - 5],
    [Lx + 14, T],
    // monitor on a stand
    [Mx - 3, T],
    [Mx - 3, T - 12],
    [Mx - 34, T - 12],
    [Mx - 34, T - 56],
    [Mx + 34, T - 56],
    [Mx + 34, T - 12],
    [Mx + 3, T - 12],
    [Mx + 3, T],
    // mug with a handle
    [Gx, T],
    [Gx, T - 20],
    [Gx + 16, T - 20],
    [Gx + 16, T - 16],
    ...arc(Gx + 16, T - 10.5, 5.5, -Math.PI / 2, Math.PI / 2),
    [Gx + 16, T],
    [x + w, T],
    [x + w - 16, T],
    [x + w - 16, g],
  ]
}

/** A country mailbox, side on: a rounded box on a post, with a door seam at the front. */
const mailbox: Glyph = (b, el) => {
  const { x, g } = b
  const cx = x + 34
  const bx = x + 4
  const rx = x + 64
  const bot = g - 58
  const top = g - 86
  const r = 13
  vars(el, { 'flag-x': rx - 16 - x - 2, 'flag-y': g - 66 - b.y - 28 })
  return [
    [cx - 3, g],
    [cx - 3, bot],
    [bx + 9, bot],
    [bx + 9, top + 7],
    [bx + 9, bot],
    [bx, bot],
    [bx, top + r],
    ...arc(bx + r, top + r, r, Math.PI, Math.PI * 1.5),
    ...arc(rx - r, top + r, r, -Math.PI / 2, 0),
    [rx, bot],
    [cx + 3, bot],
    [cx + 3, g],
  ]
}

export const glyphs: Record<string, Glyph> = { flourish, book, frame, house, plant, sign, kite, desk, mailbox }
