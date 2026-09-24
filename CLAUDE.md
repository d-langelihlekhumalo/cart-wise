# CLAUDE.md

Project context for Claude Code. Product plan: `docs/PLAN.md`. Engineering plan (decisions D1–D18, schema, per-milestone tasks): `docs/IMPLEMENTATION.md` — read the relevant milestone before starting work on it.

## What we're building

A South African grocery tracker/recommender PWA. Users upload store pamphlets (photos, PDFs, WhatsApp images), build shopping lists, get told where their list is cheapest (single store vs. two-store split), and check items off offline while shopping. Hosted on Cloudflare. Also a portfolio project, so code quality, tests, and a clean README matter.

## Commands

Package manager is pnpm (version pinned in `package.json`; use `corepack`).

```sh
pnpm install          # install all workspaces
pnpm check            # lint + format check + typecheck + tests (run before every commit)
pnpm lint             # ESLint (strict type-checked), zero warnings allowed
pnpm format           # Prettier write
pnpm typecheck        # tsc in every workspace
pnpm test             # Vitest in every workspace
pnpm --filter @cart-wise/shared test   # one workspace
pnpm size             # build first; fails if initial JS > 150 KB gzip
pnpm test:e2e         # Playwright vs the production build (build + db:migrate:local first)

pnpm dev              # app + API on http://localhost:5180 (port must match BETTER_AUTH_URL)
pnpm db:generate      # generate a migration from packages/db/src/schema changes
pnpm db:migrate:local # apply migrations to the local D1 used by `pnpm dev`
pnpm db:seed:generate # regenerate the catalogue seed migration from packages/db/seed/catalogue.ts
pnpm --filter @cart-wise/api types   # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

First run: copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), then `pnpm db:migrate:local`.

Deploy commands arrive when the Cloudflare account is set up.

## How the pieces fit

- `apps/api/wrangler.jsonc` defines the single Worker. `apps/web/vite.config.ts` runs it via `@cloudflare/vite-plugin` (`configPath`), so `pnpm dev` / `vite build` produce the Worker plus the SPA as its static assets.
- API tests run inside workerd via `@cloudflare/vitest-pool-workers`, with migrations applied to a fresh D1 (`apps/api/test/apply-migrations.ts`). Use `test/helpers.ts` (`api`, `signUp`, `authed`).
- Web unit tests use `apps/web/vitest.config.ts` (not `vite.config.ts` — the Cloudflare plugin can't run under Vitest).
- Local D1 state for dev lives in `/.wrangler/state`, shared by `pnpm dev` and `pnpm db:migrate:local`.
- Lists are offline-first: UI reads/writes Dexie (`apps/web/src/features/lists`), `SyncEngine` pushes/pulls `/api/sync`. The merge rules exist twice, in `packages/shared/src/sync/merge.ts` (client) and SQL in `apps/api/src/routes/sync.ts` (server); change both together.
- Product search is SQLite FTS5 (`products_fts`, custom SQL migrations; triggers keep it in sync). Drizzle doesn't model it — change it with a new custom migration.
- Routers mounted at the API root must attach `requireUser` per route, not with `.use()`, or they'd also guard `/api/health` and `/api/auth`.
- Pricing maths (`unitPrice`, `lineCost`, `resolveStorePrice`) lives in `packages/shared/src/pricing`; M5's recommendation engine builds on it.
- Anything that needs Dexie stays in lazily loaded modules (route `lazy` or dynamic `import()`); the main bundle only has `lib/sync-status.ts`.
- Service worker only exists in builds; test offline behaviour with `pnpm build` + `vite preview` or `pnpm test:e2e`.
- The API compatibility date is capped by the workerd bundled in `@cloudflare/vitest-pool-workers`; tests fail to start if it's newer.

## Repo layout

```
apps/web          React PWA (Vite, React Router, TanStack Query, Tailwind)
apps/api          Hono Worker: API (+ queue consumer + cron later); owns wrangler.jsonc
packages/shared   Zod schemas, types, money/unit-price/promo maths, recommendation engine (pure)
packages/db       Drizzle schema + migrations (applied by Wrangler)
docs/             PLAN.md, IMPLEMENTATION.md, adr/
```

## Conventions (important)

- **Money is always integer cents.** Never floats. Format only via `formatZAR` / parse via `parseRandsToCents` in `packages/shared` (`R12.99`, VAT-inclusive).
- **IDs** are ULID text. Lists and list items get IDs generated on the client (offline creation).
- **Time:** timestamps are epoch ms (UTC). Validity dates are `YYYY-MM-DD` meaning the whole day in `Africa/Johannesburg`.
- **Prices** live in one append-only `prices` table (`is_promo` for specials). Never update a price row; insert a new one. Regular prices older than 60 days don't count as current.
- **Member vs. normal price** are separate fields (`price_cents`, `member_price_cents`); apply member prices only for loyalty cards the user holds.
- **Promos are structural** (`promo_type`: `none` | `multibuy` | `buy_x_get_y`, with `promo_qty` / `promo_price_cents` / `promo_free_qty`). Never flatten into a fake per-unit price.
- **Sizes normalized** to `size_value` + `size_unit` (`g` | `ml` | `each`) + `pack_count`; `sold_by_weight` for per-kg items. Compare by unit price.
- **Prices are scoped** by chain + region (+ optional store). Most specific scope wins. Spar varies per store.
- Shared Zod schemas in `packages/shared` are the source of truth for API types on both ends. They use `zod/mini` (ADR 0002); API errors are always `{ error: { code, message, issues? } }`.
- Business logic that must work offline (merge, pricing, recommendation) is pure functions in `packages/shared`, heavily unit-tested.
- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`; if unavoidable, disable the lint rule on that line with a comment explaining why.
- Keep the web bundle light (initial JS ≤ 150 KB gzip) — SA mobile data is expensive. Lazy-load heavy routes (pdf.js, review screen). Compress images client-side before upload.
- Shopping mode must work fully offline.
- POPIA: collect minimal personal data; account deletion must remove everything; pamphlet images are private to uploader + admins.
- Tests live next to code as `*.test.ts`.

## Toolchain notes

- TypeScript is pinned to 6.0.x because typescript-eslint doesn't support 7 yet.
- Vitest is pinned to 4.x because `@cloudflare/vitest-pool-workers` requires it.

## Build order

M0 bootstrap → M1 foundation → M2 lists + offline → M3 prices → M4 pamphlets → M5 recommendations → M6 polish. Details and "done when" criteria in `docs/IMPLEMENTATION.md`.

Work one milestone at a time. Deploy after each. Tick the milestone in `docs/PLAN.md` and the tasks in `docs/IMPLEMENTATION.md` as they complete.
