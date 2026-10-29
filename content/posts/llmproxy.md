---
title: Knowing what an LLM call costs
date: 2026-10-29
description: Why I wrote llmproxy, a small Go proxy that records the tokens, cost and latency of every request.
---

Every app I build lately talks to a language model somewhere. Each call costs a fraction of a cent, which is exactly the problem: the costs are too small to notice one at a time and too many to add up in your head. The provider's dashboard tells you the total, a day later, for the whole account. It doesn't tell you which feature spent it.

So I wrote [llmproxy](https://github.com/amangeldievkuu/llmproxy-go). It's a reverse proxy that sits between your app and the OpenAI or Anthropic API and writes one row per request into a local SQLite file: model, input and output tokens, cost, latency.

```
your app  ──►  llmproxy (localhost:8000)  ──►  api.openai.com
                  │
                  └─ model, tokens, cost, latency → llmproxy.db
```

## Changing one line

The rule I set myself was that using it should only change the base URL. No SDK wrapper, no decorator, no new dependency in the app:

```python
client = OpenAI(base_url="http://localhost:8000/v1")
```

API keys pass straight through and are never stored. If you want to know which part of the app is expensive, add an `X-Llmproxy-Tag` header and `llmproxy stats` splits the spend by tag. The proxy strips the header before forwarding.

## The hard part was streaming

A plain JSON response has a `usage` field, so recording it is easy. Streams are where it gets interesting. Server-sent events have to be forwarded as they arrive, or the app stops feeling fast, and the usage only shows up at the end, if at all.

OpenAI's Chat Completions API only reports usage in a stream when the request sets `stream_options.include_usage`. Most apps don't. So when a streamed request leaves it out, the proxy adds it, reads the usage from the extra final chunk OpenAI sends back, and removes that chunk again. The app gets exactly the stream it asked for, and the proxy still gets its numbers. If the app sets the option itself, the request is left alone.

## A budget that counts what's still running

The other feature I wanted was a daily budget: past a dollar limit, requests get a `429`. The naive version checks the recorded spend before each request. That breaks the moment you send twenty requests in parallel, because none of them is recorded yet, so all twenty get through.

The proxy counts requests that are still in flight. Each one holds back the average cost of its model's recent requests until its real cost is known. It's still an estimate, and near the limit it can refuse a request that would have fit, but a burst can't run past the budget anymore.

## Small on purpose

It's one static Go binary: pure Go, no cgo, no Docker, no external database. The data is plain SQLite, so when the built-in report isn't enough you can just ask it:

```sh
sqlite3 llmproxy.db "SELECT model, SUM(cost_usd) FROM requests GROUP BY model"
```

It also prices prompt-cache reads and writes at their own rates, can answer identical requests from memory during development, and prunes old records if you ask it to. But the point is still the first table it prints: what you spent, and on what.
