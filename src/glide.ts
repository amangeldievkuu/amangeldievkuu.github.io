// In-page links glide instead of jump: an ease-in-out scroll whose duration grows with the
// distance, so a long trip down the page still reads as one calm motion. Wheel, touch or keys
// take control back at once. Reduced motion keeps the browser's instant jump.

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

let stop = () => {}

function glideTo(el: HTMLElement) {
  stop()
  // Same offset as `scroll-padding-top: 12vh`, measured every frame in case the page shifts.
  const dest = () => {
    const max = document.documentElement.scrollHeight - innerHeight
    return Math.max(0, Math.min(max, el.getBoundingClientRect().top + scrollY - innerHeight * 0.12))
  }
  const from = scrollY
  const duration = Math.max(500, Math.min(1400, 350 + Math.abs(dest() - from) * 0.35))
  const start = performance.now()
  const off = new AbortController()
  let raf = 0

  stop = () => {
    cancelAnimationFrame(raf)
    off.abort()
  }
  for (const type of ['wheel', 'touchstart', 'keydown'])
    addEventListener(type, () => stop(), { passive: true, once: true, signal: off.signal })

  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    scrollTo({ top: from + (dest() - from) * ease(t), behavior: 'instant' })
    if (t < 1) {
      raf = requestAnimationFrame(frame)
      return
    }
    off.abort()
    if (!el.matches('a, button, input, select, textarea, [tabindex]')) el.tabIndex = -1
    el.focus({ preventScroll: true })
  }
  raf = requestAnimationFrame(frame)
}

export function initGlide() {
  document.addEventListener('click', (e) => {
    if (reduced.matches || e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]')
    const id = link && decodeURIComponent(link.hash.slice(1))
    const el = id && document.getElementById(id)
    if (!el) return
    e.preventDefault()
    if (location.hash !== link.hash) history.pushState(null, '', link.hash)
    glideTo(el)
  })
}
