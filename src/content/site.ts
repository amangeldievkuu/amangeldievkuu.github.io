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
  now: ['Building something small (placeholder)', 'Reading something long (placeholder)', 'Based somewhere sunny (placeholder)'],

  // TODO: replace with your own. `octocat` is GitHub's demo account, so the garden has something to grow.
  githubUser: 'octocat',
  email: 'hello@example.com',

  projects: [
    { name: 'Project One', blurb: 'A short line about what it does and why it exists.', href: 'https://github.com/' },
    { name: 'Project Two', blurb: 'A tool that makes one boring thing slightly less boring.', href: 'https://github.com/' },
    { name: 'Project Three', blurb: 'An experiment that turned into something people use.', href: 'https://github.com/' },
    { name: 'Project Four', blurb: 'Weekend hack, kept alive out of affection.', href: 'https://github.com/' },
  ] satisfies Project[],

  links: [
    { label: 'github', handle: '@octocat', href: 'https://github.com/octocat' },
    { label: 'x', handle: '@placeholder', href: 'https://x.com/' },
    { label: 'linkedin', handle: 'in/placeholder', href: 'https://www.linkedin.com/' },
    { label: 'telegram', handle: '@placeholder', href: 'https://t.me/' },
  ] satisfies Link[],
}

export type Site = typeof site
