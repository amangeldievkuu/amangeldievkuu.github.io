import { arc, cumulative, leaf, prng, subdivide, toPath, wobble, type Pt } from './line/geom.ts'

// A flower is a handful of genes: small enough to travel in a link, so a flower grown here can be
// given to someone else and bloom the same for them. Most are plum blossoms; some are wildflowers
// with four, six or seven petals; one in twenty is a tulip.

export interface Flower {
  tulip: boolean
  /** 4–7; five makes a plum blossom. */
  petals: number
  /** 0 slim, 1 classic, 2 full. */
  shape: number
  /** A second, smaller ring of petals inside the first. */
  double: boolean
  /** 2–5, on the keepsake card's stem. */
  leaves: number
  /** −2…2, which way the card's stem leans. */
  lean: number
  /** The time of day it opened: 0 dawn, 1 day, 2 dusk, 3 night. */
  heart: number
  /** YYYY-MM-DD */
  date: string
}

const TAU = Math.PI * 2
const HEARTS = ['dawn', 'day', 'dusk', 'night']
// How fat the petals are: the rose curve raised to this power.
const FULLNESS = [1.6, 1, 0.6]

export const heartAt = (hour: number) => (hour >= 5 && hour < 10 ? 0 : hour >= 10 && hour < 16 ? 1 : hour >= 16 && hour < 20 ? 2 : 3)
export const heartColor = (f: Flower) => `var(--heart-${HEARTS[f.heart]})`

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function grow(seed: number, hour: number, date: string): Flower {
  const r = prng(seed)
  const pick = (n: number) => Math.floor(r() * n)
  return {
    tulip: r() < 0.05,
    petals: r() < 0.6 ? 5 : [4, 6, 7][pick(3)],
    shape: pick(3),
    double: r() < 0.18,
    leaves: 2 + pick(4),
    lean: pick(5) - 2,
    heart: heartAt(hour),
    date,
  }
}

export const encode = (f: Flower) =>
  `${+f.tulip}${f.petals}${f.shape}${+f.double}${f.leaves}${f.lean + 2}${f.heart}-${f.date.replaceAll('-', '')}`

export function decode(code: string | null): Flower | null {
  const m = /^([01])([4-7])([0-2])([01])([2-5])([0-4])([0-3])-(\d{4})(\d{2})(\d{2})$/.exec(code ?? '')
  if (!m) return null
  const [y, mo, d] = [+m[8], +m[9], +m[10]]
  const day = new Date(Date.UTC(y, mo - 1, d))
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return null
  return {
    tulip: m[1] === '1',
    petals: +m[2],
    shape: +m[3],
    double: m[4] === '1',
    leaves: +m[5],
    lean: +m[6] - 2,
    heart: +m[7],
    date: `${m[8]}-${m[9]}-${m[10]}`,
  }
}

/** What it's called, and a little more about it for the card. */
export function nameOf(f: Flower) {
  if (f.tulip) return { name: 'tulip', more: 'from the Tian Shan' }
  return { name: f.petals !== 5 ? 'wildflower' : f.double ? 'double plum blossom' : 'plum blossom', more: `${f.petals} petals` }
}

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const d = t * t * t
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
  })
}

/**
 * The head as one closed loop that starts and ends where the stem meets it, (cx, cy). Petals are
 * a rose curve centred there; a tulip is a cup standing on it, R wide and 1.7R tall.
 */
export function head(f: Flower, cx: number, cy: number, R: number): Pt[] {
  if (f.tulip) {
    const P = (x: number, y: number): Pt => [cx + x * R, cy + y * R]
    return [
      ...bezier(P(0, 0), P(-0.75, 0), P(-1, -0.9), P(-0.8, -1.55), 16),
      P(-0.38, -1.08),
      P(0, -1.72),
      P(0.38, -1.08),
      ...bezier(P(0.8, -1.55), P(1, -0.9), P(0.75, 0), P(0, 0), 16),
    ]
  }
  const ring = (r: number, turn: number) =>
    Array.from({ length: 161 }, (_, i): Pt => {
      const t = (i / 160) * TAU
      const rr = r * Math.abs(Math.sin((f.petals * t) / 2)) ** FULLNESS[f.shape]
      // Turned so a petal points straight up, or with an even count, so none points down the stem.
      const phi = t - Math.PI / 2 - Math.PI / f.petals + turn + (f.petals % 2 ? 0 : Math.PI / f.petals)
      return [cx + rr * Math.cos(phi), cy + rr * Math.sin(phi)]
    })
  return f.double ? [...ring(R, 0), ...ring(R * 0.55, Math.PI / f.petals)] : ring(R, 0)
}

export const headPath = (f: Flower, cx: number, cy: number, R: number) => `${toPath(head(f, cx, cy, R))}Z`

export interface Card {
  /** The whole drawing, one stroke. */
  d: string
  /** A tulip's cup, to fill with colour behind the stroke. */
  cup: string | null
  /** Centre and radius of a plum or wildflower's heart. */
  heart: { x: number; y: number; r: number } | null
  /** The head's bounding box, so the picked flower can land exactly on it. */
  box: { x: number; y: number; w: number; h: number }
  /** Where along the stroke (0–1) the head is drawn. */
  at: [number, number]
}

/** The keepsake drawing, on a 240 × 220 card: ground, stem, leaves, head and heart, and back down. */
export function card(f: Flower, seed: number): Card {
  const W = 240
  const G = 198
  const R = f.tulip ? 24 : 34
  const top = f.tulip ? 92 : 76
  const n = 48
  const stem: Pt[] = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [W / 2 + f.lean * 7 * Math.sin(t * Math.PI * 0.85), G - t * (G - top)]
  })

  const leaves = new Map<number, Pt[]>()
  for (let i = 0; i < f.leaves; i++) {
    const at = Math.round(n * (0.14 + (0.48 * i) / Math.max(1, f.leaves - 1)))
    const len = 30 - i * 3.5
    leaves.set(at, leaf(stem[at], i % 2 ? -2.5 : -0.64, len, len * 0.5))
  }
  const up: Pt[] = [[14, G]]
  stem.forEach((p, i) => {
    up.push(p)
    const l = leaves.get(i)
    if (l) up.push(...l, p)
  })

  const [sx, sy] = stem[n]
  const flower = head(f, sx, sy, R)
  const hr = 6
  const loop = f.tulip ? [] : arc(sx, sy - hr, hr, Math.PI / 2, Math.PI / 2 + TAU)
  const pts = [...up, ...flower, ...loop, ...stem.slice().reverse(), [W - 14, G] as Pt]

  const { pts: dense, map } = subdivide(pts, 3)
  const drawn = wobble(dense, seed, 0.9)
  const len = cumulative(drawn)
  const total = len[len.length - 1]

  const xs = flower.map((p) => p[0])
  const ys = flower.map((p) => p[1])
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  return {
    d: toPath(drawn),
    cup: f.tulip ? `${toPath(flower)}Z` : null,
    heart: f.tulip ? null : { x: sx, y: sy - hr, r: hr - 0.6 },
    box,
    at: [len[map[up.length]] / total, len[map[up.length + flower.length + loop.length - 1]] / total],
  }
}
