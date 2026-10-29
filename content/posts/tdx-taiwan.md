---
title: A typed SDK for Taiwan's transport data
date: 2026-10-29
description: Notes from wrapping TDX, the API behind Taiwan's YouBike, bus, metro, rail and ferry data, in a small TypeScript library.
---

Taiwan publishes an impressive amount of live transport data through one API, [TDX](https://tdx.transportdata.tw): YouBike availability, bus arrival estimates, metro boards, high speed rail seats, Taiwan Railway train positions, parking, EV chargers, flights, road traffic and ferries.

Using it directly takes some ceremony. You exchange a client ID and secret for an OAuth token, refresh it before it expires, write OData query strings by hand, and back off when you hit the rate limit. So I wrapped it in [tdx-taiwan](https://github.com/amangeldievkuu/tdx-taiwan), a TypeScript SDK on npm:

```ts
const tdx = new TdxClient({ clientId, clientSecret })

const eta = await tdx.bus.eta('Taipei', '307')
const bikes = await tdx.bike.availability('Taipei')
```

## The boring parts, done once

Most of the value of an SDK is the parts nobody wants to write twice.

- **Tokens.** The client fetches a token on the first request, caches it, and refreshes it a minute before it expires. Concurrent requests share one token request instead of each starting their own.
- **Retries.** A `429`, a `5xx` or a network error is retried with exponential backoff and jitter. A client-side rate limiter keeps you from causing the `429`s in the first place.
- **No dependencies.** It uses native `fetch` and ships ESM and CommonJS for Node.js 20 and up.

## Types from the spec

The response types are transcribed from TDX's official OpenAPI specs, and the field names stay exactly as TDX spells them: `StationUID`, `AvailableRentBikes`, `EstimateTime`. Renaming them to camelCase would look nicer and make every example in the TDX documentation harder to use.

The OData query builder is type-checked against those types, so a typo in a field name is a compile error instead of an empty result:

```ts
const top = await tdx.bike.availability(
  'Taipei',
  query<BikeAvailability>()
    .filter('AvailableRentBikes gt 0')
    .orderBy('AvailableRentBikes', 'desc')
    .top(10),
)
```

String literals go through `odata.str()`, which quotes them safely, so a stop name with an apostrophe can't break the query.

## Where the data departs from the spec

Live data and its spec don't always agree, and some values are simply absent: a bus arrival estimate is `null` when there's nothing to estimate. The docs for each resource list the places where live data departs from the spec, so you know what actually comes back.

## Next: letting assistants ask

The SDK is also the base for [tdx-taiwan-mcp](https://github.com/amangeldievkuu/tdx-taiwan-mcp), an MCP server that lets Claude and other assistants answer questions like "when does the 307 reach Ximen?" or "which high speed trains to Zuoying still have seats tonight?" Most of that work is writing tools shaped like the questions people ask, not like the endpoints the API happens to have.
