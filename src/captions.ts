// One quiet caption per stage. It floats above whatever you hover or focus (CSS anchor
// positioning where supported), and otherwise rests at the top of the stage.

export function initCaptions() {
  document.querySelectorAll<HTMLElement>('[data-stage]').forEach((stage, i) => {
    const caption = stage.querySelector<HTMLElement>('.caption')
    if (!caption) return
    const anchor = `--caption-${i}`
    caption.style.setProperty('position-anchor', anchor)
    let current: HTMLElement | null = null

    const show = (el: HTMLElement | null) => {
      if (el === current) return
      current?.style.removeProperty('anchor-name')
      current = el
      el?.style.setProperty('anchor-name', anchor)
      caption.textContent = el?.dataset.caption ?? stage.dataset.captionDefault ?? ''
      caption.classList.toggle('is-anchored', !!el)
      caption.classList.toggle('is-empty', !caption.textContent)
    }
    const from = (e: Event) => (e.target as Element).closest<HTMLElement>('[data-caption]')

    stage.addEventListener('pointerover', (e) => from(e) && show(from(e)))
    stage.addEventListener('pointerleave', () => show(null))
    stage.addEventListener('focusin', (e) => show(from(e)))
    stage.addEventListener('focusout', () => show(null))
    show(null)
    caption.classList.toggle('is-empty', !caption.textContent)
  })
}
