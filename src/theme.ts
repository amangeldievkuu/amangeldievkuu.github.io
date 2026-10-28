// The desk lamp is the theme switch: lamp on means night mode.
// The new theme spreads out from the lamp as a circle, using a same-document View Transition.

const root = document.documentElement
const system = matchMedia('(prefers-color-scheme: dark)')

const isDark = () => (root.dataset.theme ?? (system.matches ? 'dark' : 'light')) === 'dark'

export function initTheme() {
  const lamps = [...document.querySelectorAll<HTMLButtonElement>('[data-lamp]')]
  const sync = () => lamps.forEach((l) => l.setAttribute('aria-pressed', String(isDark())))

  const apply = () => {
    const next = isDark() ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {}
    sync()
  }

  for (const lamp of lamps) {
    lamp.addEventListener('click', () => {
      const r = lamp.getBoundingClientRect()
      root.style.setProperty('--vt-x', `${r.left + r.width / 2}px`)
      root.style.setProperty('--vt-y', `${r.top + r.height / 2}px`)
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()
      root.classList.add('is-switching')
      document.startViewTransition(apply).finished.finally(() => root.classList.remove('is-switching'))
    })
  }
  system.addEventListener('change', sync)
  sync()
}
