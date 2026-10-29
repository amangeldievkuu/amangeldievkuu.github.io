// Every lamp ([data-lamp]) is a theme switch: the desk lamp at home, the reading lamp on posts.
// Lamp on means night mode. The new theme spreads out from the lamp as a circle, using a
// same-document View Transition. Holding a lamp down forgets the choice and follows the system again.

const root = document.documentElement
const system = matchMedia('(prefers-color-scheme: dark)')
const HOLD_MS = 700

const isDark = () => (root.dataset.theme ?? (system.matches ? 'dark' : 'light')) === 'dark'

export function initTheme() {
  const lamps = [...document.querySelectorAll<HTMLButtonElement>('[data-lamp]')]
  const sync = () => lamps.forEach((l) => l.setAttribute('aria-pressed', String(isDark())))

  const toggle = () => {
    const next = isDark() ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {}
    sync()
  }

  const reset = () => {
    delete root.dataset.theme
    try {
      localStorage.removeItem('theme')
    } catch {}
    sync()
  }

  const switchFrom = (lamp: HTMLButtonElement, apply: () => void) => {
    const r = (lamp.querySelector('[data-lamp-origin]') ?? lamp).getBoundingClientRect()
    root.style.setProperty('--vt-x', `${r.left + r.width / 2}px`)
    root.style.setProperty('--vt-y', `${r.top + r.height / 2}px`)
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()
    root.classList.add('is-switching')
    document.startViewTransition(apply).finished.finally(() => root.classList.remove('is-switching'))
  }

  for (const lamp of lamps) {
    let hold: number | undefined
    let held = false
    const cancel = () => clearTimeout(hold)

    lamp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      held = false
      hold = window.setTimeout(() => {
        held = true
        if (!('theme' in root.dataset)) return
        // Only animate when following the system actually changes what's on screen.
        system.matches !== isDark() ? switchFrom(lamp, reset) : reset()
      }, HOLD_MS)
    })
    lamp.addEventListener('pointerup', cancel)
    lamp.addEventListener('pointerleave', cancel)
    lamp.addEventListener('pointercancel', cancel)
    // A long press on touch would otherwise open the context menu.
    lamp.addEventListener('contextmenu', (e) => e.preventDefault())

    lamp.addEventListener('click', () => {
      if (held) return void (held = false)
      switchFrom(lamp, toggle)
    })
  }
  system.addEventListener('change', sync)
  sync()
}
