import { arc, cumulative, prng, subdivide, toPath, wobble, type Box, type Pt } from './geom.ts'
import { glyphs } from './glyphs.ts'

// Measures the page and walks one continuous path through it.
//
// Every [data-stage] contributes one "lane" per row of [data-glyph] items: a ground line from
// rail to rail that detours through each item's glyph. Lanes alternate direction and are joined
// down the page margins, so the whole site reads as one stroke, snaking like a hand writing.

export interface Lane {
  y: number
  start: number
  end: number
  stop: HTMLElement | null
}

export interface Mark {
  el: HTMLElement
  at: number
  drawn: boolean
}

export interface Line {
  d: string
  pts: Pt[]
  len: Float64Array
  total: number
  lanes: Lane[]
  marks: Mark[]
}

const CORNER = 26
const CURL = 9
const STEP = 5
const SEED = 1987

interface RawLane {
  y: number
  items: { el: HTMLElement; b: Box }[]
  stop: HTMLElement | null
}

function measure(): { lanes: RawLane[]; left: number; right: number; gap: number } {
  const origin = document.body.getBoundingClientRect()
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect()
    return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height, g: r.bottom - origin.top }
  }

  const ref = box(document.querySelector('.stop')!)
  const width = document.documentElement.clientWidth
  const gap = Math.max(8, Math.min(36, ref.x - 8))
  const left = Math.max(8, ref.x - gap)
  const right = Math.min(width - 8, ref.x + ref.w + gap)

  const lanes: RawLane[] = []
  for (const stage of document.querySelectorAll<HTMLElement>('[data-stage]')) {
    const stop = stage.closest<HTMLElement>('.stop')
    const items = [...stage.querySelectorAll<HTMLElement>('[data-glyph]')]
      .map((el) => ({ el, b: box(el) }))
      .filter(({ b }) => b.w > 0)
      .sort((a, b) => a.b.g - b.b.g)
    if (!items.length) {
      lanes.push({ y: box(stage).g, items: [], stop })
      continue
    }
    // Wrapped flex rows become separate lanes.
    for (const item of items) {
      const row = lanes.at(-1)
      if (row && row.stop === stop && Math.abs(row.y - item.b.g) < 6) row.items.push(item)
      else lanes.push({ y: item.b.g, items: [item], stop })
    }
  }
  for (const lane of lanes) lane.items.sort((a, b) => a.b.x - b.b.x)
  return { lanes, left, right, gap }
}

export function buildLine(): Line {
  const { lanes: raw, left, right, gap } = measure()
  const rand = prng(SEED)
  const pts: Pt[] = []
  const laneIdx: [number, number][] = []
  const markIdx: { el: HTMLElement; i: number }[] = []

  raw.forEach((lane, li) => {
    const s = li % 2 === 0 ? 1 : -1
    const startX = s > 0 ? left : right
    const endX = s > 0 ? right : left

    if (li === 0) {
      pts.push([startX, lane.y])
    } else {
      // Turn down the margin, maybe doodle a curl on the way, and turn into the next lane.
      const prevY = raw[li - 1].y
      const ps = -s
      pts.push(...arc(startX - ps * CORNER, prevY + CORNER, CORNER, -Math.PI / 2, -Math.PI / 2 + (ps * Math.PI) / 2))
      const top = prevY + CORNER
      const bottom = lane.y - CORNER
      if (bottom - top > 320 && gap > CURL * 2 + 10) {
        const my = top + (bottom - top) * (0.35 + rand() * 0.3)
        const a0 = ps > 0 ? 0 : Math.PI
        pts.push([startX, my], ...arc(startX - ps * CURL, my, CURL, a0, a0 + ps * Math.PI * 2))
      }
      pts.push(...arc(startX + s * CORNER, lane.y - CORNER, CORNER, s > 0 ? Math.PI : 0, Math.PI / 2))
    }

    const start = pts.length - 1
    const items = s > 0 ? lane.items : lane.items.slice().reverse()
    for (const { el, b } of items) {
      const glyph = glyphs[el.dataset.glyph ?? '']
      if (!glyph) continue
      const shape = glyph(b, el, rand)
      markIdx.push({ el, i: pts.length })
      pts.push(...(s > 0 ? shape : shape.reverse()))
    }

    const last = li === raw.length - 1
    if (last) {
      // The pen lifts a little past the last thing it drew.
      const tail = items.length ? pts.at(-1)![0] + s * 90 : (left + right) / 2
      pts.push([tail, lane.y])
    } else {
      pts.push([endX - s * CORNER, lane.y])
    }
    laneIdx.push([start, pts.length - 1])
  })

  const { pts: dense, map } = subdivide(pts, STEP)
  const drawn = wobble(dense, SEED)
  const len = cumulative(drawn)
  const at = (i: number) => len[map[i]]

  return {
    d: toPath(drawn),
    pts: drawn,
    len,
    total: len[len.length - 1] ?? 0,
    lanes: raw.map((l, i) => ({ y: l.y, start: at(laneIdx[i][0]), end: at(laneIdx[i][1]), stop: l.stop })),
    marks: markIdx.map(({ el, i }) => ({ el, at: at(i), drawn: false })),
  }
}
