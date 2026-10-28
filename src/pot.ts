import type { Pen } from './line/pen.ts'

// The pot in the corner grows with the line. The stem follows the pen from one section to the
// next, every section reached puts out a leaf, and when the line is finished the plant
// blooms. Scroll back up and it all folds away again.

// The same five-petal rose the garden blooms with.
function petals(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 101 }, (_, i) => {
    const t = (i / 100) * Math.PI
    const phi = t - Math.PI / 2 - Math.PI / 10
    const rr = r * Math.sin(5 * t)
    return `${(cx + rr * Math.cos(phi)).toFixed(2)} ${(cy + rr * Math.sin(phi)).toFixed(2)}`
  })
  return `M${pts.join(' ')}Z`
}

export function createPot(root: HTMLElement) {
  const leaves = [...root.querySelectorAll<SVGElement>('.pot-leaf')]
  const count = root.querySelector<HTMLElement>('.pot-count')!
  root.querySelector('.pot-petals')!.setAttribute('d', petals(24, 7, 5.5))

  let line: Pen['line'] | null = null
  // Where each section's stretch of the line begins.
  let starts: number[] = []
  let reached = -1
  let grow = ''
  let bloom = false

  function update(p: Pen) {
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
    if (g !== grow) root.style.setProperty('--grow', (grow = g))

    if (k !== reached) {
      reached = k
      leaves.forEach((l, i) => l.classList.toggle('is-out', i < k))
      root.classList.toggle('is-shown', k > 0)
      count.textContent = `${k + 1} of ${n}`
    }

    const done = tip >= line.total - 1
    if (done !== bloom) root.classList.toggle('is-bloom', (bloom = done))
  }

  return { update }
}
