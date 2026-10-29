// Wheel scrolling glides instead of stepping. Each notch or swipe moves a target, and the page
// eases toward it every frame, so a flick of the wheel reads as one calm motion and the line,
// the walker and the pot all move with it. Touch, keys, the scrollbar and find-in-page keep the
// browser's own scrolling; the glide just picks up from wherever they leave the page.
// Reduced motion turns it off.

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
// How quickly the page catches up with the wheel: higher is snappier.
const EASE = 6
const LINE = 16

/** Whether something between the pointer and the page can scroll that way itself. */
function inner(target: EventTarget | null, dy: number) {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1 || !/auto|scroll|overlay/.test(getComputedStyle(el).overflowY)) continue
    if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
  }
  return false
}

export function initSmoothScroll() {
  let target = scrollY
  let current = scrollY
  // Where the glide last put the page, to tell its own scrolling from anyone else's.
  let placed = Number.NaN
  let raf = 0
  let last = 0

  const frame = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    current += (target - current) * (1 - Math.exp(-EASE * dt))
    if (Math.abs(target - current) < 0.5) current = target
    placed = current
    scrollTo({ top: current, behavior: 'instant' })
    raf = current === target ? 0 : requestAnimationFrame(frame)
  }

  addEventListener(
    'wheel',
    (e) => {
      if (reduced.matches || e.ctrlKey || e.defaultPrevented) return
      const dy = e.deltaY * (e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? innerHeight : 1)
      if (!dy || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      if (document.querySelector('dialog:modal') || inner(e.target, dy)) return
      if (!raf) target = current = scrollY
      const max = document.documentElement.scrollHeight - innerHeight
      const next = Math.max(0, Math.min(max, target + dy))
      // Already resting at the top or bottom: let the browser do its bounce.
      if (next === target && !raf) return
      e.preventDefault()
      target = next
      if (raf) return
      last = 0
      raf = requestAnimationFrame(frame)
    },
    { passive: false },
  )

  addEventListener(
    'scroll',
    () => {
      if (Math.abs(scrollY - placed) < 1.5) return
      // Someone else moved the page: keys, the scrollbar, a nav link's glide. Follow it.
      cancelAnimationFrame(raf)
      raf = 0
      target = current = scrollY
    },
    { passive: true },
  )
}
