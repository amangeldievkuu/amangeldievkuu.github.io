// Everything personal lives here. Edit this file; the rest of the site follows.

export interface Project {
  name: string
  blurb: string
  href: string
}

export interface Link {
  label: string
  handle: string
  href: string
}

export const site = {
  name: 'Kutman',
  tagline: 'builds quiet software.',
  subline: 'Engineer, occasional writer, collector of small useful ideas.',
  description: 'Personal site of Kutman: writing, projects and a small garden of code.',

  bio: [
    'I like software that disappears into the work — fast, calm, and a little bit kind.',
    'Most days I build things for the web. Some nights I write about what I learned building them.',
  ],
  now: [
    'Building 臺灣華語, a Taiwan Mandarin study app, plus an LLM cost proxy in Go and an SDK for Taiwan transit data',
    'Turning tdx-taiwan into an MCP server, so AI assistants can tell you when the 307 bus reaches Ximen',
    'Learning Mandarin',
  ],

  githubUser: 'amangeldievkuu',
  // Repos the garden grows. Leave empty to plant every public repo.
  garden: ['taiwan-mandarin', 'llmproxy-go', 'tdx-taiwan', 'lean-context', 'suluu', 'jailoo'],
  email: 'kutman.amangeldi@gmail.com',

  projects: [
    {
      name: 'taiwan-mandarin',
      blurb: 'Learn Taiwan Mandarin from TOCFL Novice 1 to Level 6: spaced repetition, Zhuyin, graded reading. Works offline.',
      href: 'https://github.com/amangeldievkuu/taiwan-mandarin',
    },
    {
      name: 'llmproxy-go',
      blurb: 'One Go binary between your app and OpenAI or Anthropic that records the tokens, cost and latency of every call.',
      href: 'https://github.com/amangeldievkuu/llmproxy-go',
    },
    {
      name: 'tdx-taiwan',
      blurb: "A typed TypeScript SDK for Taiwan's TDX transport API: YouBike, bus arrivals, metro, high speed rail and more.",
      href: 'https://github.com/amangeldievkuu/tdx-taiwan',
    },
  ] satisfies Project[],

  links: [
    { label: 'github', handle: '@amangeldievkuu', href: 'https://github.com/amangeldievkuu' },
    { label: 'x', handle: '@kutmanaisha', href: 'https://x.com/kutmanaisha' },
  ] satisfies Link[],
}

export type Site = typeof site
