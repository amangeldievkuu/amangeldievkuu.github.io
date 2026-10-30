import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { site } from '../src/content/site.ts'
import { loadPhotos, loadProfile, photoCache } from './photos.ts'
import { loadPosts } from './posts.ts'
import { ogMeta, renderHome, renderPhotos, renderPost, VIEWER } from './render.ts'

// Renders the home page, one page per markdown post and the photos page at build time.
// Those pages are virtual HTML entries: /writing/<slug>/index.html and /photos/index.html never
// exist on disk.

export default function oneLine(): Plugin {
  let root = process.cwd()
  const postsDir = () => path.join(root, 'content/posts')
  const photosDir = () => path.join(root, 'content/photos')
  const photos = () => loadPhotos(photosDir(), root)
  const profile = () => loadProfile(path.join(root, 'content'), root)
  const photosEntry = () => path.join(root, 'photos', 'index.html')
  const template = () => fs.readFileSync(path.join(root, 'templates/post.html'), 'utf8')
  const postEntry = (slug: string) => path.join(root, 'writing', slug, 'index.html')
  const slugOf = (id: string) => /[\\/]writing[\\/]([\w-]+)[\\/]index\.html$/.exec(id)?.[1]

  const postPage = async (slug: string) => {
    const post = loadPosts(postsDir()).find((p) => p.slug === slug)
    return post && renderPost(template(), site, post, await profile())
  }
  const photosPage = async () =>
    renderPhotos(fs.readFileSync(path.join(root, 'templates/photos.html'), 'utf8'), site, await photos(), await profile())

  return {
    name: 'one-line-site',
    enforce: 'pre',

    config(config, { command }) {
      root = path.resolve(config.root ?? process.cwd())
      if (command !== 'build') return
      const input: Record<string, string> = { main: path.join(root, 'index.html'), photos: photosEntry() }
      for (const p of loadPosts(postsDir())) input[`writing/${p.slug}`] = postEntry(p.slug)
      return { build: { rollupOptions: { input } } }
    },

    resolveId(id) {
      if ((slugOf(id) || id === photosEntry()) && path.isAbsolute(id) && id.startsWith(root)) return id
    },

    load(id) {
      if (id === photosEntry()) return photosPage()
      const slug = slugOf(id)
      if (slug && id.startsWith(root)) return postPage(slug)
    },

    async generateBundle() {
      const me = await profile()
      const names = [...(await photos()).flatMap((p) => p.files.map((f) => f.name)), ...(me ? [...me.files.map((f) => f.name), me.og] : [])]
      for (const name of names)
        this.emitFile({ type: 'asset', fileName: `photos/img/${name}`, source: fs.readFileSync(path.join(photoCache(root), name)) })
    },

    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        if (!html.includes('<!--site:main-->')) return html
        const me = await profile()
        return html
          .replace('<!--site:main-->', renderHome(site, loadPosts(postsDir()), await photos(), me))
          .replace('<!--site:viewer-->', VIEWER)
          .replace('<!--site:og-->', ogMeta(site, me))
          .replaceAll('%SITE_NAME%', site.name)
          .replaceAll('%SITE_TAGLINE%', site.tagline)
          .replaceAll('%SITE_DESCRIPTION%', site.description)
      },
    },

    configureServer(server: ViteDevServer) {
      const watched = [path.join(root, 'content'), path.join(root, 'templates')]
      server.watcher.add(watched)
      const reload = (file: string) => {
        if (watched.some((dir) => file.startsWith(dir))) server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', reload).on('add', reload).on('unlink', reload)

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').replace(/[?#].*$/, '')
        const img = /^\/photos\/img\/([\w-]+\.(webp|jpg))$/.exec(url)
        if (img) {
          const file = path.join(photoCache(root), img[1])
          if (!fs.existsSync(file)) return next()
          res.setHeader('Content-Type', img[2] === 'jpg' ? 'image/jpeg' : 'image/webp')
          return res.end(fs.readFileSync(file))
        }
        if (/^\/photos\/?(?:index\.html)?$/.test(url)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          return res.end(await server.transformIndexHtml(req.url!, await photosPage()))
        }
        const slug = /^\/writing\/([\w-]+)\/?(?:index\.html)?(?:[?#].*)?$/.exec(req.url ?? '')?.[1]
        const html = slug && (await postPage(slug))
        if (!html) return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(await server.transformIndexHtml(req.url!, html))
      })
    },
  }
}
