// Grows the GitHub garden from live data: one plant per public repo.
// Stem height follows stars; recently pushed repos are in bloom. Results are cached for an hour,
// and a stale cache is better than an empty garden when the API says no.

interface Repo {
  name: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  pushed_at: string
  fork: boolean
  archived: boolean
}

const TTL = 60 * 60 * 1000
const MAX_PLANTS = 10
const BLOOM_DAYS = 60

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function readCache(key: string): { at: number; repos: Repo[] } | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

async function fetchRepos(user: string): Promise<Repo[]> {
  const key = `garden:${user}`
  const cached = readCache(key)
  if (cached && Date.now() - cached.at < TTL) return cached.repos
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=pushed&per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    const repos = ((await res.json()) as Repo[]).filter((r) => !r.fork && !r.archived)
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), repos }))
    } catch {}
    return repos
  } catch (err) {
    if (cached) return cached.repos
    throw err
  }
}

const ago = (iso: string) => {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month')
  return rtf.format(Math.round(days / 365), 'year')
}

function plant(r: Repo) {
  const h = Math.round(Math.min(176, Math.max(58, 58 + 30 * Math.log10(r.stargazers_count + 1))))
  const bloom = Date.now() - Date.parse(r.pushed_at) < BLOOM_DAYS * 86_400_000
  const facts = [`★ ${r.stargazers_count}`, r.language].filter(Boolean).join(' · ')
  const label = [r.name, r.description, facts].filter(Boolean).join('. ')
  return `<a class="glyph plant" data-glyph="plant" ${bloom ? 'data-bloom' : ''} href="${esc(r.html_url)}"
    style="--h:${h}px" data-caption="${esc(`${r.name} — ${facts}`)}" aria-label="${esc(label)}">
    <span class="plant-name">${esc(r.name)}</span></a>`
}

export async function plantGarden() {
  const stage = document.querySelector<HTMLElement>('[data-garden]')
  const status = document.querySelector<HTMLElement>('[data-garden-status]')
  if (!stage) return
  const user = stage.dataset.garden!
  const chosen = new Set(stage.dataset.gardenRepos?.split(',').filter(Boolean))
  try {
    const repos = (await fetchRepos(user))
      .filter((r) => !chosen.size || chosen.has(r.name))
      .sort((a, b) => b.stargazers_count - a.stargazers_count || b.pushed_at.localeCompare(a.pushed_at))
      .slice(0, MAX_PLANTS)
    stage.querySelectorAll('.is-seed').forEach((s) => s.remove())
    stage.querySelector('.sign')!.insertAdjacentHTML('beforebegin', repos.map(plant).join(''))
    const freshest = repos.reduce<string>((m, r) => (r.pushed_at > m ? r.pushed_at : m), '')
    if (status)
      status.textContent = repos.length
        ? `live from github.com/${user} · ${repos.length} plants · last watered ${ago(freshest)}`
        : 'nothing planted yet.'
  } catch {
    stage.querySelectorAll('.is-seed').forEach((s) => s.remove())
    if (status) status.textContent = 'the garden is resting right now — the sign still points the way.'
  }
}
