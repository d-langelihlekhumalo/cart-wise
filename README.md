# Cart Wise

A grocery price tracker and shopping-list recommender for South Africa. Upload store pamphlets, build a list, and find out where it's cheapest (one store, or a two-store split), taking loyalty-card prices and your budget into account. Shopping mode works fully offline.

> **Status:** early development. Accounts, settings, and offline-first shopping lists that sync across devices work locally (M1–M2); stores and prices are next. See [the plan](docs/PLAN.md).

## Stack

React + TypeScript PWA on a single Cloudflare Worker (Hono API, D1 + Drizzle, R2, Queues, Durable Objects), with a vision LLM for pamphlet extraction.

## Getting started

Requires Node 24 and pnpm (via corepack).

```sh
corepack enable pnpm
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then set BETTER_AUTH_SECRET
pnpm db:migrate:local
pnpm dev                                          # http://localhost:5180
```

`pnpm check` runs lint, formatting, type checks and all tests.

## Docs

- [Product plan](docs/PLAN.md)
- [Implementation plan](docs/IMPLEMENTATION.md)
- [Architecture decision records](docs/adr/)
