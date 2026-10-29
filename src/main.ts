import './styles/tokens.css'
import './styles/base.css'
import './styles/sections.css'
import './styles/line.css'
import './styles/pot.css'
import './styles/keepsake.css'
import { initCaptions } from './captions.ts'
import { plantGarden } from './garden.ts'
import { initGlide } from './glide.ts'
import { createKeepsake } from './keepsake.ts'
import { Pen } from './line/pen.ts'
import { createPot } from './pot.ts'
import { initSmoothScroll } from './smooth.ts'
import { initTheme } from './theme.ts'
import { createWalker } from './walker.ts'

const pen = new Pen(document.querySelector('.ink-line')!, document.querySelector('.ink-end')!)
const keepsake = createKeepsake(document.querySelector('[data-keepsake]')!)
const pot = createPot(document.querySelector('.pot')!, {
  pick: (picked) => keepsake.open(picked),
  watered: () => walker.chirp('thanks.'),
})
const walker = createWalker(document.querySelector('.walker')!, () => pot.seat())
pen.onFrame = (p) => {
  walker.update(p)
  pot.update(p)
}

let pending = 0
const rebuild = () => {
  cancelAnimationFrame(pending)
  pending = requestAnimationFrame(() => pen.rebuild())
}

initTheme()
initCaptions()
initGlide()
initSmoothScroll()
new ResizeObserver(rebuild).observe(document.body)
document.fonts.ready.then(rebuild)
addEventListener('scroll', () => pen.kick(), { passive: true })
document.querySelector('[data-redraw]')?.addEventListener('click', () => pen.redraw())
plantGarden().then(rebuild)
