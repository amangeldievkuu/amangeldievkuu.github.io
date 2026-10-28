import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { site } from '../src/content/site.ts'
import { loadPosts } from './posts.ts'
import { renderHome, renderPost } from './render.ts'

// Renders the home page and one page per markdown post at build time.
// Post pages are virtual HTML entries: /writing/<slug>/index.html never exists on disk.

export default function oneLine(): Plugin {
  let root = process.cwd()
  const postsDir = () => path.join(root, 'content/posts')
  const template = () => fs.readFileSync(path.join(root, 'templates/post.html'), 'utf8')
  const postEntry = (slug: string) => path.join(root, 'writing', slug, 'index.html')
  const slugOf = (id: string) => /[\\/]writing[\\/]([\w-]+)[\\/]index\.html$/.exec(id)?.[1]

  const postPage = (slug: string) => {
    const post = loadPosts(postsDir()).find((p) => p.slug === slug)
    return post && renderPost(template(), site, post)
  }

  return {
    name: 'one-line-site',
    enforce: 'pre',

    config(config, { command }) {
      root = path.resolve(config.root ?? process.cwd())
      if (command !== 'build') return
      const input: Record<string, string> = { main: path.join(root, 'index.html') }
      for (const p of loadPosts(postsDir())) input[`writing/${p.slug}`] = postEntry(p.slug)
      return { build: { rollupOptions: { input } } }
    },

    resolveId(id) {
      if (slugOf(id) && path.isAbsolute(id) && id.startsWith(root)) return id
    },

    load(id) {
      const slug = slugOf(id)
      if (slug && id.startsWith(root)) return postPage(slug)
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes('<!--site:main-->')) return html
        return html
          .replace('<!--site:main-->', renderHome(site, loadPosts(postsDir())))
          .replaceAll('%SITE_NAME%', site.name)
          .replaceAll('%SITE_TAGLINE%', site.tagline)
          .replaceAll('%SITE_DESCRIPTION%', site.description)
      },
    },

    configureServer(server: ViteDevServer) {
      server.watcher.add([postsDir(), path.join(root, 'templates')])
      const reload = (file: string) => {
        if (file.startsWith(postsDir()) || file.startsWith(path.join(root, 'templates'))) server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', reload).on('add', reload).on('unlink', reload)

      server.middlewares.use(async (req, res, next) => {
        const slug = /^\/writing\/([\w-]+)\/?(?:index\.html)?(?:[?#].*)?$/.exec(req.url ?? '')?.[1]
        const html = slug && postPage(slug)
        if (!html) return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(await server.transformIndexHtml(req.url!, html))
      })
    },
  }
}
