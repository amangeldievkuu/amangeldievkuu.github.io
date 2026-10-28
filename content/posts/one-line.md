---
title: Drawing a website with one line
date: 2026-10-22
description: Why this site is a single continuous stroke, and what that constraint taught me.
---

Most personal sites are a stack of boxes. This one is a line.

Every section you scrolled past is just the same stroke taking a small detour: it climbs a desk leg, runs along a shelf of books, outlines a few houses and grows a garden before it reaches the mailbox and the pen lifts.

## Constraints are a gift

A single line can't jump. It has to *go somewhere* to get anywhere, so the layout needs a path, and the path tells a story. That one rule made a lot of decisions for me:

- Sections need a floor, so everything stands on the ground.
- Things you can click are things the line can draw around.
- Nothing is decoration unless the line passes through it.

> Simplicity is not the absence of clutter. It is the result of having one idea and following it all the way.

## How it works

The line isn't a static drawing. On every resize the page measures where the books, houses and plants are, then walks a path through them and adds a little hand-drawn wobble from a seeded noise function:

```ts
const wobble = (s: number) =>
  0.9 * Math.sin(s / 90 + a) + 0.45 * Math.sin(s / 37 + b)
```

Scrolling moves the pen. The little creature is just following it.
