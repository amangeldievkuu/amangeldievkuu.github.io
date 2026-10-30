import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import exif from 'exif-reader'
import sharp from 'sharp'

// Phone photos in content/photos/ become resized WebP files at build time. Output carries no
// metadata, so the GPS a phone writes into every picture never leaves the repo.

export interface Photo {
  id: string
  caption: string
  date: string
  w: number
  h: number
  files: { w: number; name: string }[]
}

const WIDTHS = [640, 1280, 2048, 3072]
const FORMATS = /\.(jpe?g|png|webp)$/i
const QUALITY = 80

export const photoCache = (root: string) => path.join(root, 'node_modules/.cache/one-line-photos')

// Decoded photos, keyed by file path, size and mtime, so dev reloads don't re-hash everything.
const seen = new Map<string, Omit<Photo, 'caption' | 'date'> & { taken: string }>()

const slug = (file: string) =>
  path
    .parse(file)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'photo'

const isoDay = (d: unknown) => (d instanceof Date && !isNaN(+d) ? d.toISOString().slice(0, 10) : '')

function readCaptions(dir: string): Record<string, { caption?: string; date?: string }> {
  const file = path.join(dir, 'photos.json')
  if (!fs.existsSync(file)) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.warn(`[photos] photos.json isn't valid JSON, ignoring it: ${(e as Error).message}`)
    return {}
  }
}

async function decode(file: string, out: string) {
  const stat = fs.statSync(file)
  const key = `${file}:${stat.size}:${stat.mtimeMs}`
  const hit = seen.get(key)
  if (hit) return hit

  const buf = fs.readFileSync(file)
  const id = `${slug(file)}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)}`
  const meta = await sharp(buf).metadata()
  let taken = ''
  try {
    if (meta.exif) taken = isoDay(exif(meta.exif).Photo?.DateTimeOriginal)
  } catch {}
  // EXIF orientation 5–8 means the phone held it sideways.
  const turned = (meta.orientation ?? 1) >= 5
  const w = (turned ? meta.height : meta.width) ?? 0
  const h = (turned ? meta.width : meta.height) ?? 0
  if (!w || !h) throw new Error('no dimensions')

  const widths = WIDTHS.filter((x) => x < w)
  if (widths.length < WIDTHS.length) widths.push(Math.min(w, WIDTHS.at(-1)!))
  const files = await Promise.all(
    widths.map(async (width) => {
      const name = `${id}-${width}.webp`
      const target = path.join(out, name)
      if (!fs.existsSync(target)) await sharp(buf).rotate().resize({ width }).webp({ quality: QUALITY }).toFile(target)
      return { w: width, name }
    }),
  )

  const photo = { id, w, h, files, taken }
  seen.set(key, photo)
  return photo
}

export async function loadPhotos(dir: string, root: string): Promise<Photo[]> {
  if (!fs.existsSync(dir)) return []
  const out = photoCache(root)
  fs.mkdirSync(out, { recursive: true })
  const captions = readCaptions(dir)

  const photos: (Photo | null)[] = await Promise.all(
    fs
      .readdirSync(dir)
      .filter((f) => !f.startsWith('.') && f !== 'photos.json')
      .sort()
      .map(async (file) => {
        if (!FORMATS.test(file)) {
          console.warn(`[photos] skipping ${file}: only JPEG, PNG and WebP are supported (export HEIC as JPEG)`)
          return null
        }
        try {
          const { taken, ...photo } = await decode(path.join(dir, file), out)
          const extra = captions[file] ?? {}
          return { ...photo, caption: extra.caption ?? '', date: extra.date ?? taken }
        } catch (e) {
          console.warn(`[photos] skipping ${file}: ${(e as Error).message}`)
          return null
        }
      }),
  )
  // Newest first; undated photos go last, in file order.
  return photos.filter((p) => p !== null).sort((a, b) => (b.date || '0').localeCompare(a.date || '0'))
}

export interface Profile {
  files: { w: number; name: string }[]
  og: string
}

const PROFILE_SIZES = [160, 320, 640]
const PROFILE_OG = 1200
const profiles = new Map<string, Profile>()

/** content/profile.jpg (or .png, .webp), cropped square around its subject. Null when there's none. */
export async function loadProfile(dir: string, root: string): Promise<Profile | null> {
  const file = fs.existsSync(dir) && fs.readdirSync(dir).sort().find((f) => /^profile\.(jpe?g|png|webp)$/i.test(f))
  if (!file) return null
  const src = path.join(dir, file)
  const stat = fs.statSync(src)
  const key = `${src}:${stat.size}:${stat.mtimeMs}`
  const hit = profiles.get(key)
  if (hit) return hit

  const out = photoCache(root)
  fs.mkdirSync(out, { recursive: true })
  try {
    const buf = fs.readFileSync(src)
    const id = `profile-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)}`
    const square = (s: number) => sharp(buf).rotate().resize(s, s, { fit: 'cover', position: 'attention' })
    const files = await Promise.all(
      PROFILE_SIZES.map(async (w) => {
        const name = `${id}-${w}.webp`
        const target = path.join(out, name)
        if (!fs.existsSync(target)) await square(w).webp({ quality: QUALITY }).toFile(target)
        return { w, name }
      }),
    )
    // Link previews get a JPEG; not every scraper reads WebP.
    const og = `${id}-og.jpg`
    if (!fs.existsSync(path.join(out, og))) await square(PROFILE_OG).jpeg({ quality: QUALITY, mozjpeg: true }).toFile(path.join(out, og))
    const profile = { files, og }
    profiles.set(key, profile)
    return profile
  } catch (e) {
    console.warn(`[photos] skipping ${file}: ${(e as Error).message}`)
    return null
  }
}
