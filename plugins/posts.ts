import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'

export interface Post {
  slug: string
  title: string
  date: string
  description: string
  minutes: number
  html: string
}

const WORDS_PER_MINUTE = 220

function parseFrontMatter(src: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src)
  if (!match) return { meta: {}, body: src }
  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return { meta, body: src.slice(match[0].length) }
}

export function loadPosts(dir: string): Post[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(dir, file), 'utf8'))
      const slug = file.replace(/\.md$/, '')
      const words = body.split(/\s+/).filter(Boolean).length
      return {
        slug,
        title: meta.title ?? slug,
        date: meta.date ?? '1970-01-01',
        description: meta.description ?? '',
        minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
        html: marked.parse(body, { async: false }),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}
