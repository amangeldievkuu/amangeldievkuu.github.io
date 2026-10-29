import type { Site } from '../src/content/site.ts'
import type { Post } from './posts.ts'

// Build-time renderers. The page ships as static HTML; the browser only draws the line over it.

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const fmtDate = (iso: string, month: 'short' | 'long' = 'short') =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month, day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Small deterministic variety so neighbouring shapes never look stamped out.
const pick = <T,>(list: T[], i: number) => list[i % list.length]

export const bookName = (slug: string) => `book-${slug}`

function hero(site: Site) {
  return `
  <section class="stop stop--hero" id="top" data-says="hi.">
    <h1 class="hero-name">${esc(site.name)}<span class="hero-dot">.</span></h1>
    <p class="hero-tag">${esc(site.tagline)}</p>
    <p class="hero-sub">${esc(site.subline)}</p>
    <div class="stage stage--hero" data-stage>
      <span class="glyph flourish" data-glyph="flourish"></span>
    </div>
    <div class="hero-foot">
      <span class="hint">the little one likes to be tapped</span>
      <button class="redraw" type="button" data-redraw><span aria-hidden="true">↻</span> draw it again</button>
    </div>
  </section>`
}

function about(site: Site) {
  return `
  <section class="stop stop--about" id="about" data-says="this desk is mine.">
    <div class="stop-head">
      <h2 class="label">about</h2>
      <p class="lede">${esc(site.bio[0])}</p>
      ${site.bio.slice(1).map((p) => `<p>${esc(p)}</p>`).join('')}
      <ul class="now" aria-label="Now">${site.now.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </div>
    <div class="stage stage--desk" data-stage>
      <div class="glyph desk" data-glyph="desk">
        <span class="desk-light" aria-hidden="true"></span>
        <button class="lamp" type="button" data-lamp aria-pressed="false" aria-label="Lamp: switch between light and dark"></button>
        <span class="desk-screen" aria-hidden="true">&gt;<i>_</i></span>
        <svg class="desk-steam" viewBox="0 0 20 24" aria-hidden="true"><path d="M6 22c-3-4 3-6 0-10s3-6 0-10M14 22c-3-4 3-6 0-10s3-6 0-10"/></svg>
      </div>
    </div>
  </section>`
}

function writing(posts: Post[]) {
  const books = posts
    .map((p) => {
      const h = Math.min(200, 136 + p.minutes * 10)
      const w = Math.round(34 + Math.min(p.title.length, 40) * 0.25)
      const meta = `${fmtDate(p.date)} · ${p.minutes} min`
      return `<a class="glyph book" data-glyph="book" href="/writing/${p.slug}/"
        style="--w:${w}px;--h:${h}px;view-transition-name:${bookName(p.slug)}"
        data-caption="${esc(p.title)} — ${meta}"
        aria-label="${esc(p.title)}, ${meta} read"><span class="book-title">${esc(p.title)}</span></a>`
    })
    .join('')
  const latest = posts[0]
  return `
  <section class="stop stop--writing" id="writing" data-says="shh. reading.">
    <div class="stop-head">
      <h2 class="label">writing</h2>
      <p class="lede">Notes, essays and half-finished thoughts. Pull a book off the shelf.</p>
    </div>
    <div class="stage stage--shelf" data-stage data-caption-default="${latest ? `latest — ${esc(latest.title)}` : 'nothing here yet'}">
      ${books}
      <span class="glyph plant is-seed shelf-sprout" data-glyph="plant" aria-hidden="true"></span>
      <p class="caption" aria-hidden="true"></p>
    </div>
  </section>`
}

function projects(site: Site) {
  const houses = site.projects
    .map(
      (p, i) => `<a class="glyph house" data-glyph="house" href="${esc(p.href)}"
        style="--w:${pick([116, 132, 104, 124], i)}px;--h:${pick([118, 138, 106, 128], i)}px"
        data-caption="${esc(p.blurb)}" aria-label="${esc(p.name)}: ${esc(p.blurb)}">
        <span class="house-window" aria-hidden="true"></span><span class="house-name">${esc(p.name)}</span></a>`,
    )
    .join('')
  return `
  <section class="stop stop--projects" id="projects" data-says="nice neighbourhood.">
    <div class="stop-head">
      <h2 class="label">projects</h2>
      <p class="lede">A small town of things I've built. Knock on any door.</p>
    </div>
    <div class="stage stage--town" data-stage data-caption-default="">
      ${houses}
      <p class="caption" aria-hidden="true"></p>
    </div>
  </section>`
}

function garden(site: Site) {
  const seeds = Array.from({ length: 7 }, () => `<span class="glyph plant is-seed" data-glyph="plant"></span>`).join('')
  const profile = `https://github.com/${encodeURIComponent(site.githubUser)}`
  return `
  <section class="stop stop--garden" id="github" data-says="water the plants?">
    <div class="stop-head">
      <h2 class="label">github</h2>
      <p class="lede">A garden of public code. Taller plants have more commits; the ones in bloom were tended recently.</p>
      <p class="status" data-garden-status>planting seeds…</p>
    </div>
    <div class="stage stage--garden" data-stage data-garden="${esc(site.githubUser)}"
      data-garden-repos="${esc(site.garden.join(','))}" data-caption-default="">
      ${seeds}
      <a class="glyph sign" data-glyph="sign" href="${profile}" aria-label="All repositories on GitHub"><span>github →</span></a>
      <p class="caption" aria-hidden="true"></p>
    </div>
  </section>`
}

function elsewhere(site: Site) {
  const kites = site.links
    .map(
      (l, i) => `<a class="glyph kite" data-glyph="kite" href="${esc(l.href)}" rel="me noopener"
        style="--h:${pick([196, 156, 216, 172], i)}px;--sway:${pick([3.1, 3.7, 2.8, 3.4], i)}s"
        aria-label="${esc(l.label)}: ${esc(l.handle)}">
        <span class="kite-fly" aria-hidden="true">
          <svg class="kite-string" viewBox="0 0 40 100" preserveAspectRatio="none"><path pathLength="1" d="M20 100C4 76 34 52 16 26 12 18 18 8 20 0"/></svg>
          <svg class="kite-body" viewBox="0 0 44 58"><path pathLength="1" d="M22 2 42 22 22 56 2 22Z M22 2V56 M2 22H42"/></svg>
        </span>
        <span class="kite-label">${esc(l.label)}<small>${esc(l.handle)}</small></span></a>`,
    )
    .join('')
  return `
  <section class="stop stop--elsewhere" id="elsewhere" data-says="wheee.">
    <div class="stop-head">
      <h2 class="label">elsewhere</h2>
      <p class="lede">Kites on strings, tied to the same line. Follow one.</p>
    </div>
    <div class="stage stage--kites" data-stage>${kites}</div>
  </section>`
}

function end(site: Site) {
  const mail = `mailto:${esc(site.email)}`
  return `
  <section class="stop stop--end" id="hello" data-says="write me?">
    <div class="stop-head">
      <h2 class="label">hello</h2>
      <p class="lede">An idea, a question, or a kind word — the mailbox is always open.</p>
      <a class="email" href="${mail}">${esc(site.email)}</a>
    </div>
    <div class="stage stage--end" data-stage>
      <a class="glyph mailbox" data-glyph="mailbox" href="${mail}" aria-label="Send an email">
        <svg class="mailbox-flag" viewBox="0 0 24 30" aria-hidden="true"><path d="M2 28V2h18v10H2"/></svg>
      </a>
    </div>
    <footer class="foot">
      <span>© ${new Date().getFullYear()} ${esc(site.name)}</span>
      <span>drawn with a single line.</span>
    </footer>
  </section>`
}

export function renderHome(site: Site, posts: Post[]) {
  return [hero(site), about(site), writing(posts), projects(site), garden(site), elsewhere(site), end(site)].join('\n')
}

export function renderPost(template: string, site: Site, post: Post) {
  const vars: Record<string, string> = {
    '%SITE_NAME%': esc(site.name),
    '%TITLE%': esc(post.title),
    '%DESCRIPTION%': esc(post.description),
    '%DATE_ISO%': post.date,
    '%DATE%': fmtDate(post.date, 'long'),
    '%MINUTES%': String(post.minutes),
    '%VT_NAME%': bookName(post.slug),
    '%CONTENT%': post.html,
  }
  return template.replace(/%[A-Z_]+%/g, (k) => vars[k] ?? k)
}
