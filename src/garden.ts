// Grows the GitHub garden from live data: one plant per public repo.
// Stem height follows commits; recently pushed repos are in bloom. Results are cached for an hour,
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
  commits?: number
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

// One request per repo: with per_page=1 the "last" page number in the Link header is the commit
// count. Counts are kept until the repo is pushed again.
async function countCommits(user: string, repos: Repo[]): Promise<Repo[]> {
  const key = `garden:${user}:commits`
  let cache: Record<string, { pushed: string; count: number }> = {}
  try {
    cache = JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {}
  const counted = await Promise.all(
    repos.map(async (r) => {
      const hit = cache[r.name]
      if (hit?.pushed === r.pushed_at) return { ...r, commits: hit.count }
      try {
        const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(r.name)}/commits?per_page=1`, {
          headers: { Accept: 'application/vnd.github+json' },
        })
        if (!res.ok) return r
        const last = /[?&]page=(\d+)>; rel="last"/.exec(res.headers.get('Link') ?? '')
        const count = last ? Number(last[1]) : ((await res.json()) as unknown[]).length
        cache[r.name] = { pushed: r.pushed_at, count }
        return { ...r, commits: count }
      } catch {
        return hit ? { ...r, commits: hit.count } : r
      }
    }),
  )
  try {
    localStorage.setItem(key, JSON.stringify(cache))
  } catch {}
  return counted
}

const ago = (iso: string) => {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month')
  return rtf.format(Math.round(days / 365), 'year')
}

function plant(r: Repo) {
  const h = Math.round(Math.min(176, Math.max(58, 58 + 60 * Math.log10(r.commits ?? 1))))
  const bloom = Date.now() - Date.parse(r.pushed_at) < BLOOM_DAYS * 86_400_000
  const facts = [
    r.commits && `${r.commits} commit${r.commits === 1 ? '' : 's'}`,
    r.stargazers_count > 0 && `★ ${r.stargazers_count}`,
    r.language,
  ]
    .filter(Boolean)
    .join(' · ')
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
    const picked = (await fetchRepos(user))
      .filter((r) => !chosen.size || chosen.has(r.name))
      .sort((a, b) => b.stargazers_count - a.stargazers_count || b.pushed_at.localeCompare(a.pushed_at))
      .slice(0, MAX_PLANTS)
    const repos = await countCommits(user, picked)
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
