export type Pt = [x: number, y: number]

/** Item box in page coordinates; `g` is the ground (bottom edge) the glyph stands on. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
  g: number
}

/** Sampled elliptical arc. Angles are in screen space: 0 → right, π/2 → down, −π/2 → up. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, rx = r): Pt[] {
  const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * Math.max(r, rx)) / 4))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [cx + rx * Math.cos(a), cy + r * Math.sin(a)]
  })
}

/** An almond-shaped loop leaving point p in direction `angle`. */
export function leaf([px, py]: Pt, angle: number, len: number, width: number): Pt[] {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  return Array.from({ length: 25 }, (_, i) => {
    const s = (i / 24) * Math.PI * 2
    const u = (len * (1 - Math.cos(s))) / 2
    const v = (width / 2) * Math.sin(s)
    return [px + u * dx - v * dy, py + u * dy + v * dx]
  })
}

/** Mulberry32: a tiny seeded PRNG, so the hand-drawn wobble is identical on every visit. */
export function prng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Splits long segments so the wobble has points to bend. Returns new points and old→new index map. */
export function subdivide(pts: Pt[], step: number): { pts: Pt[]; map: number[] } {
  const out: Pt[] = []
  const map: number[] = []
  pts.forEach((p, i) => {
    if (i > 0) {
      const [px, py] = pts[i - 1]
      const n = Math.floor(Math.hypot(p[0] - px, p[1] - py) / step)
      for (let k = 1; k < n; k++) out.push([px + ((p[0] - px) * k) / n, py + ((p[1] - py) * k) / n])
    }
    map.push(out.length)
    out.push(p)
  })
  return { pts: out, map }
}

/** Low-frequency 2D wobble along arc length: a pen hand, not random jitter. */
export function wobble(pts: Pt[], seed: number, amp = 1.3): Pt[] {
  const r = prng(seed)
  const waves = (n: number) => Array.from({ length: n }, (_, i) => ({ f: 1 / [83, 37, 19][i], a: [0.6, 0.3, 0.15][i], p: r() * 6.28 }))
  const wx = waves(3)
  const wy = waves(3)
  const at = (w: typeof wx, s: number) => w.reduce((sum, { f, a, p }) => sum + a * Math.sin(s * f + p), 0)
  let s = 0
  return pts.map((p, i) => {
    if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])
    return [p[0] + amp * at(wx, s), p[1] + amp * at(wy, s)]
  })
}

export function cumulative(pts: Pt[]): Float64Array {
  const len = new Float64Array(pts.length)
  for (let i = 1; i < pts.length; i++) len[i] = len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return len
}

/** Index of the last element ≤ value in a sorted array. */
export function bisect(arr: ArrayLike<number>, value: number): number {
  let lo = 0
  let hi = arr.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (arr[mid] <= value) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function toPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
}
