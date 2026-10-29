import { bisect, type Pt } from './geom.ts'
import { buildLine, type Line } from './build.ts'

// The pen turns scroll position into "how much of the line is drawn".
//
// Each lane is drawn while its ground travels from the bottom of the viewport to 45% of the way
// down; the margins between lanes are drawn in the scroll in between. A smooth curve runs through those points,
// so the pen speeds up and slows down between them instead of lurching, and the drawn length
// follows it on a critically damped spring: the stroke (and whoever walks on it) moves like a
// hand, not a scrollbar.

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
// How far behind the scroll the pen trails, in seconds.
const FOLLOW = 0.18

/**
 * Slopes for a monotone cubic through the points (Fritsch–Carlson, as in PCHIP): smooth through
 * every point, and never running backwards where the points don't.
 */
function slopes(s: Float64Array, l: Float64Array) {
  const n = s.length
  const m = new Float64Array(n)
  // Secant of each segment; a segment with no width is a step, and gets none.
  const d = Array.from({ length: Math.max(0, n - 1) }, (_, k) => (s[k + 1] - s[k] > 1e-6 ? (l[k + 1] - l[k]) / (s[k + 1] - s[k]) : Number.NaN))
  for (let k = 0; k < n; k++) {
    const a = d[k - 1]
    const b = d[k]
    if (a === undefined || Number.isNaN(a)) m[k] = Number.isNaN(b ?? Number.NaN) ? 0 : b
    else if (b === undefined || Number.isNaN(b)) m[k] = a
    else if (a <= 0 || b <= 0) m[k] = 0
    else {
      const h0 = s[k] - s[k - 1]
      const h1 = s[k + 1] - s[k]
      m[k] = (3 * (h0 + h1)) / ((2 * h1 + h0) / a + (h1 + 2 * h0) / b)
    }
  }
  return m
}

export class Pen {
  line!: Line
  /** Drawn length of the line, in px. */
  shown = 0
  onFrame: (pen: Pen) => void = () => {}

  private scrolls = new Float64Array(0)
  private lengths = new Float64Array(0)
  /** The curve's slope (length per scroll) at each point. */
  private slopes = new Float64Array(0)
  private velocity = 0
  private intro = true
  private raf = 0
  private last = 0
  private path: SVGPathElement
  private dot: SVGCircleElement

  constructor(path: SVGPathElement, dot: SVGCircleElement) {
    this.path = path
    this.dot = dot
  }

  get reduced() {
    return reduced.matches
  }

  /** Where the walker should stand: the pen tip, or straight from scroll when motion is reduced. */
  get tip() {
    return this.reduced ? this.fromScroll() : this.shown
  }

  rebuild() {
    this.line = buildLine()
    const { d, total } = this.line
    this.path.setAttribute('d', d)
    this.path.style.strokeDasharray = `${total} ${total + 10}`
    const end = this.pointAt(total)
    this.dot.setAttribute('cx', String(end[0]))
    this.dot.setAttribute('cy', String(end[1]))
    this.timeline()
    if (!this.intro) this.shown = this.target()
    this.velocity = 0
    this.render()
    this.kick()
  }

  redraw() {
    this.shown = 0
    this.velocity = 0
    this.intro = true
    for (const m of this.line.marks) {
      m.drawn = false
      m.el.classList.remove('is-drawn')
    }
    this.kick()
  }

  kick() {
    if (this.raf || !this.line) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  pointAt(length: number): Pt {
    const { pts, len } = this.line
    const i = bisect(len, Math.max(0, Math.min(length, this.line.total)))
    const j = Math.min(i + 1, pts.length - 1)
    const t = len[j] > len[i] ? (length - len[i]) / (len[j] - len[i]) : 0
    return [pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t]
  }

  /** The lane (and so the section) the given length belongs to; between lanes, the one just left. */
  laneAt(length: number) {
    const { lanes } = this.line
    let found = lanes[0]
    for (const lane of lanes) if (lane.start <= length + 1) found = lane
    return found
  }

  private timeline() {
    const vh = innerHeight
    const max = Math.max(0, document.documentElement.scrollHeight - vh)
    const pairs: [number, number][] = [[0, this.line.lanes[0]?.end ?? 0]]
    for (const lane of this.line.lanes.slice(1)) pairs.push([lane.y - vh, lane.start], [lane.y - vh * 0.45, lane.end])

    // Some scroll for every stretch of line: at most ~8px of line per px of scroll.
    const room = (k: number) => (pairs[k][1] - pairs[k - 1][1]) * 0.12
    // Lanes close together would otherwise share their scroll and draw in a jump: space them out…
    for (let k = 1; k < pairs.length; k++) pairs[k][0] = Math.max(pairs[k][0], pairs[k - 1][0] + room(k))
    // …but everything must be drawable before the page runs out: squeeze the tail into reach…
    let limit = max
    for (let k = pairs.length - 1; k > 0; k--) {
      pairs[k][0] = Math.min(pairs[k][0], limit)
      limit = pairs[k][0] - room(k)
    }
    // …and keep it monotonic.
    for (let k = 1; k < pairs.length; k++) pairs[k][0] = Math.max(pairs[k][0], pairs[k - 1][0])

    this.scrolls = Float64Array.from(pairs, (p) => p[0])
    this.lengths = Float64Array.from(pairs, (p) => p[1])
    this.slopes = slopes(this.scrolls, this.lengths)
  }

  private fromScroll() {
    const { scrolls: s, lengths: l } = this
    if (!s.length) return 0
    const y = scrollY
    if (y <= s[0]) return l[0]
    const k = bisect(s, y)
    if (k >= s.length - 1) return l[l.length - 1]
    const h = s[k + 1] - s[k]
    if (h <= 0) return l[k + 1]
    // Cubic Hermite between the two points.
    const t = (y - s[k]) / h
    const t2 = t * t
    const t3 = t2 * t
    const m = this.slopes
    return (2 * t3 - 3 * t2 + 1) * l[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * l[k + 1] + (t3 - t2) * h * m[k + 1]
  }

  private target() {
    return this.reduced ? this.line.total : this.fromScroll()
  }

  private tick = (now: number) => {
    this.raf = 0
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const target = this.target()
    const diff = target - this.shown

    if (this.reduced) {
      this.intro = false
      this.shown = target
    } else if (this.intro) {
      // First stroke: a steady hand, never slower than ~2 seconds end to end.
      this.shown += Math.sign(diff) * Math.min(Math.abs(diff), Math.max(700, target / 2) * dt)
      if (diff <= 0.5) this.intro = false
    } else {
      // A critically damped spring (smooth damping): no jolt when the scroll starts or stops.
      const omega = 2 / FOLLOW
      const x = omega * dt
      const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
      const change = this.shown - target
      const pull = (this.velocity + omega * change) * dt
      this.velocity = (this.velocity - omega * pull) * decay
      const next = target + (change + pull) * decay
      // Never overshoot: a line can't be undrawn past where the scroll has got to.
      if (target - this.shown > 0 === next > target) {
        this.shown = target
        this.velocity = 0
      } else this.shown = next
    }
    if (Math.abs(target - this.shown) < 0.5 && Math.abs(this.velocity) < 30) {
      this.shown = target
      this.velocity = 0
    }

    this.render()
    if (this.shown !== target || this.intro) this.raf = requestAnimationFrame(this.tick)
  }

  private render() {
    const { total, marks } = this.line
    this.path.style.strokeDashoffset = String(total - this.shown)
    this.dot.classList.toggle('is-down', this.shown >= total - 1)
    for (const m of marks) {
      const drawn = this.shown >= m.at
      if (drawn !== m.drawn) {
        m.drawn = drawn
        m.el.classList.toggle('is-drawn', drawn)
      }
    }
    this.onFrame(this)
  }
}
