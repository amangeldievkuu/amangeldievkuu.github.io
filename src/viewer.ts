// A photo, as big as the screen allows. It opens from any [data-photo] link on the page, steps
// through them with the arrow keys or a swipe, and on the photos page keeps the address in step
// so a single photo can be linked to. Pinch, double-tap or the wheel zoom in; drag to look around.

const SWIPE = 48
const MAX = 4
const DOUBLE = 2.5
const TAP_MS = 300
const TAP_PX = 24

type Point = { x: number; y: number }

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

  // Zoom: the photo is scaled from its top-left corner, then moved by (tx, ty).
  let scale = 1
  let tx = 0
  let ty = 0

  function paint() {
    img.style.transform = scale === 1 ? '' : `translate(${tx}px, ${ty}px) scale(${scale})`
    dialog.classList.toggle('is-zoomed', scale > 1)
  }

  // Where the photo sits unzoomed, worked back from where it sits now.
  function base() {
    const r = img.getBoundingClientRect()
    return { left: r.left - tx, top: r.top - ty, w: r.width / scale, h: r.height / scale }
  }

  // Keep the photo covering the screen once it's bigger than it; smaller, keep it where it was.
  function clamp(b = base()) {
    const fit = (t: number, start: number, size: number, screen: number) =>
      size * scale <= screen
        ? -(scale - 1) * (size / 2)
        : Math.min(-start, Math.max(screen - start - size * scale, t))
    tx = fit(tx, b.left, b.w, innerWidth)
    ty = fit(ty, b.top, b.h, innerHeight)
  }

  // Swap in the largest file the first time the photo is blown up.
  function sharpen() {
    const full = list[at]?.dataset.full
    if (!full || img.getAttribute('src') === full) return
    img.style.backgroundImage = `url("${img.currentSrc || img.src}")`
    img.removeAttribute('srcset')
    img.src = full
  }

  // Zoom to `to`, keeping the spot under (px, py) where it is.
  function zoomAt(px: number, py: number, to: number, glide = false) {
    const b = base()
    const u = (px - b.left - tx) / scale
    const v = (py - b.top - ty) / scale
    scale = Math.min(MAX, Math.max(1, to))
    tx = px - b.left - u * scale
    ty = py - b.top - v * scale
    clamp(b)
    if (scale > 1) sharpen()
    dialog.classList.toggle('is-gliding', glide)
    paint()
  }

  function unzoom() {
    scale = 1
    tx = ty = 0
    dialog.classList.remove('is-gliding', 'is-dragging')
    paint()
  }

  function show(i: number) {
    if (!list.length) return
    unzoom()
    at = (i + list.length) % list.length
    const el = list[at]
    const thumb = el.querySelector('img')!
    // The thumbnail is already loaded: show it underneath while the large one arrives.
    img.style.backgroundImage = `url("${thumb.currentSrc || thumb.src}")`
    img.style.setProperty('--ar', `${Number(el.dataset.w) / Number(el.dataset.h)}`)
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
    if (handled) return void (handled = false)
    if (scale > 1) return
    if (e.target === dialog || (e.target as Element).classList.contains('viewer-shot')) dialog.close()
  })
  dialog.addEventListener('close', () => {
    unzoom()
    const el = list[at]
    if (el && document.getElementById(el.dataset.photo!)) {
      history.replaceState(null, '', location.pathname + location.search)
      el.scrollIntoView({ block: 'nearest' })
      el.focus({ preventScroll: true })
    }
  })

  // One set of pointer handlers for swiping, panning, pinching and double-tapping, so they
  // don't fight. `handled` swallows the click that follows any of them.
  const pointers = new Map<number, Point>()
  let start = { x: 0, y: 0, tx: 0, ty: 0, moved: false }
  let pinch: { dist: number; scale: number; u: number; v: number } | null = null
  let lastTap = { t: 0, x: 0, y: 0 }
  let handled = false

  const mid = () => {
    const [a, b] = [...pointers.values()]
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 }
  }

  function beginPinch() {
    const m = mid()
    const b = base()
    pinch = { dist: m.dist, scale, u: (m.x - b.left - tx) / scale, v: (m.y - b.top - ty) / scale }
  }

  function beginDrag(p: Point) {
    start = { x: p.x, y: p.y, tx, ty, moved: false }
  }

  dialog.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return
    handled = false
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dialog.classList.remove('is-gliding')
    if (pointers.size === 1) beginDrag({ x: e.clientX, y: e.clientY })
    else if (pointers.size === 2) beginPinch()
  })

  dialog.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch && pointers.size === 2) {
      const m = mid()
      const b = base()
      scale = Math.min(MAX, Math.max(1, (pinch.scale * m.dist) / pinch.dist))
      tx = m.x - b.left - pinch.u * scale
      ty = m.y - b.top - pinch.v * scale
      clamp(b)
      if (scale > 1) sharpen()
      start.moved = true
      paint()
      return
    }
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) > 6) start.moved = true
    if (scale > 1 && start.moved) {
      tx = start.tx + dx
      ty = start.ty + dy
      clamp()
      dialog.classList.add('is-dragging')
      paint()
    }
  })

  function end(e: PointerEvent) {
    const p = pointers.get(e.pointerId)
    if (!p) return
    pointers.delete(e.pointerId)
    dialog.classList.remove('is-dragging')

    if (pinch) {
      // Lift one finger mid-pinch and the other carries on panning from where it is.
      if (pointers.size === 1) {
        pinch = null
        beginDrag([...pointers.values()][0])
        start.moved = true
        start.tx = tx
        start.ty = ty
      }
      if (scale < 1.05) unzoom()
      handled = true
      return
    }
    if (pointers.size) return

    if (start.moved) {
      handled = true
      const dx = p.x - start.x
      if (scale === 1 && e.pointerType !== 'mouse' && Math.abs(dx) > SWIPE) show(dx < 0 ? at + 1 : at - 1)
      return
    }

    // A tap. Two in a row on the photo zoom in, or back out.
    const now = e.timeStamp
    const again = now - lastTap.t < TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < TAP_PX
    lastTap = again ? { t: 0, x: 0, y: 0 } : { t: now, x: p.x, y: p.y }
    if (again && (scale > 1 || e.target === img)) {
      handled = true
      if (scale > 1) {
        dialog.classList.add('is-gliding')
        scale = 1
        tx = ty = 0
        paint()
      } else zoomAt(p.x, p.y, DOUBLE, true)
    }
  }
  dialog.addEventListener('pointerup', end)
  dialog.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && end(e))
  dialog.addEventListener('pointercancel', (e) => {
    end(e)
    handled = false
  })

  // The wheel zooms at the cursor; a trackpad pinch arrives as a wheel with ctrlKey held.
  dialog.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      zoomAt(e.clientX, e.clientY, scale * Math.exp(-step * (e.ctrlKey ? 0.01 : 0.002)))
    },
    { passive: false },
  )

  addEventListener('resize', () => dialog.open && unzoom())

  const follow = () => {
    const linked = location.hash && items().find((el) => `#${el.dataset.photo}` === location.hash)
    if (linked) open(linked)
  }
  addEventListener('hashchange', follow)
  follow()
}
