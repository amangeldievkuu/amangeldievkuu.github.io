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

## How it fits together

- `plugins/` renders the page and every post to static HTML at build time.
- `src/line/` measures the page and builds one path through every `[data-glyph]` element; `pen.ts` maps scroll to drawn length.
- `src/walker.ts` is the little one on the pen tip; `src/pot.ts` is the plant in the corner that grows with the line, a leaf per section, and blooms at the end.
- `src/garden.ts` grows plants from the GitHub API (cached for an hour).
- The desk lamp switches the theme.
