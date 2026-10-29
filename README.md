# One Line

A personal site drawn with a single continuous line. TypeScript, HTML and CSS — no UI framework, zero runtime dependencies.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Make it yours

- **`src/content/site.ts`** — name, bio, email, GitHub username, projects (houses) and links (kites).
- **`content/posts/*.md`** — one file per post (books). Front matter: `title`, `date` (YYYY-MM-DD), `description`.

## Deploy

Live at **https://amangeldievkuu.github.io/**.

Every push to `main` runs `.github/workflows/deploy.yml`, which builds `dist/` and publishes it to GitHub Pages (Settings → Pages → Source: GitHub Actions). Re-run it by hand with `gh workflow run deploy.yml`.

Links and assets are root-absolute (`/writing/…`, `/assets/…`), so the site must be served from a domain root — a `<user>.github.io` repo or a custom domain (`public/CNAME`), not a `/repo-name/` subpath.

## How it fits together

- `plugins/` renders the page and every post to static HTML at build time.
- `src/line/` measures the page and builds one path through every `[data-glyph]` element; `pen.ts` maps scroll to drawn length.
- `src/walker.ts` is the little one on the pen tip. At the end of the line it hops over to the pot.
- `src/pot.ts` is the visitor's own plant in the corner: a leaf per section, a bloom at the end, a sprout for every return visit, and the season and time of day on it. Tap the bloom to pick it; hold the pot to water it.
- `src/flower.ts` grows each visitor's flower from a seed kept in their browser; `src/keepsake.ts` is the card a picked flower lands on, to save as a PNG or give away as a `/?flower=…` link.
  Preview any season with `?season=spring|summer|autumn|winter`.
- `src/garden.ts` grows plants from the GitHub API (cached for an hour).
- The desk lamp switches the theme.
