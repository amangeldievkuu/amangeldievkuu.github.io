// A photo, as big as the screen allows. It opens from any [data-photo] link on the page, steps
// through them with the arrow keys or a swipe, and on the photos page keeps the address in step
// so a single photo can be linked to.

const SWIPE = 48

export function initViewer() {
  const found = document.querySelector<HTMLDialogElement>('[data-viewer]')
  if (!found) return
  const dialog = found
  const img = dialog.querySelector<HTMLImageElement>('.viewer-img')!
  const caption = dialog.querySelector<HTMLElement>('.viewer-caption')!
  const count = dialog.querySelector<HTMLElement>('.viewer-count')!

  const items = () => [...document.querySelectorAll<HTMLAnchorElement>('main a[data-photo]')]
  let list: HTMLAnchorElement[] = []
  let at = 0

  function show(i: number) {
    if (!list.length) return
    at = (i + list.length) % list.length
    const el = list[at]
    const thumb = el.querySelector('img')!
    // The thumbnail is already loaded: show it underneath while the large one arrives.
    img.style.backgroundImage = `url("${thumb.currentSrc || thumb.src}")`
    img.width = Number(el.dataset.w)
    img.height = Number(el.dataset.h)
    img.srcset = thumb.srcset
    img.src = thumb.src
    img.alt = el.getAttribute('aria-label') ?? ''
    caption.textContent = el.dataset.caption ?? ''
    count.textContent = list.length > 1 ? `${at + 1} / ${list.length}` : ''
    dialog.classList.toggle('is-single', list.length < 2)
    const id = el.dataset.photo!
    if (document.getElementById(id)) history.replaceState(null, '', `#${id}`)
  }

  function open(el: HTMLAnchorElement) {
    list = items()
    show(list.indexOf(el))
    if (!dialog.open) dialog.showModal()
  }

  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLAnchorElement>('a[data-photo]')
    if (!el || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    open(el)
  })

  dialog.querySelector('[data-prev]')!.addEventListener('click', () => show(at - 1))
  dialog.querySelector('[data-next]')!.addEventListener('click', () => show(at + 1))
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(at - 1)
    else if (e.key === 'ArrowRight') show(at + 1)
  })
  dialog.addEventListener('click', (e) => {
    if (swiped) return void (swiped = false)
    if (e.target === dialog || (e.target as Element).classList.contains('viewer-shot')) dialog.close()
  })
  dialog.addEventListener('close', () => {
    const el = list[at]
    if (el && document.getElementById(el.dataset.photo!)) {
      history.replaceState(null, '', location.pathname + location.search)
      el.scrollIntoView({ block: 'nearest' })
      el.focus({ preventScroll: true })
    }
  })

  let x0: number | null = null
  let swiped = false
  dialog.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') x0 = e.clientX
  })
  dialog.addEventListener('pointerup', (e) => {
    if (x0 === null) return
    const dx = e.clientX - x0
    x0 = null
    swiped = Math.abs(dx) > SWIPE
    if (swiped) show(dx < 0 ? at + 1 : at - 1)
  })

  const follow = () => {
    const linked = location.hash && items().find((el) => `#${el.dataset.photo}` === location.hash)
    if (linked) open(linked)
  }
  addEventListener('hashchange', follow)
  follow()
}
