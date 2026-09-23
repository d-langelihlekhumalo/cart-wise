# Cart Wise

A grocery price tracker and shopping-list recommender for South Africa. Upload store pamphlets, build a list, and find out where it's cheapest (one store, or a two-store split), taking loyalty-card prices and your budget into account. Shopping mode works fully offline.

> **Status:** early development — M0 (project bootstrap) complete. See [the plan](docs/PLAN.md).

## Stack

React + TypeScript PWA on a single Cloudflare Worker (Hono API, D1 + Drizzle, R2, Queues, Durable Objects), with a vision LLM for pamphlet extraction.

## Getting started

Requires Node 24 and pnpm (via corepack).

```sh
corepack enable pnpm
pnpm install
pnpm check
```

## Docs

- [Product plan](docs/PLAN.md)
- [Implementation plan](docs/IMPLEMENTATION.md)
- [Architecture decision records](docs/adr/)
