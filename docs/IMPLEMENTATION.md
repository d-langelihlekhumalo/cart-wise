# Implementation Plan

Companion to `docs/PLAN.md` (product plan). This file is the engineering breakdown: decisions, schema, API, tasks, and acceptance criteria per milestone. Work top to bottom; deploy at the end of every milestone.

---

## 0. Decisions (resolve review gaps before writing code)

| #   | Topic       | Decision                                                                                                                                                                                                                          | Why                                                                           |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| D1  | IDs         | ULID text primary keys everywhere. Lists and list items get IDs generated on the client.                                                                                                                                          | Offline creation, sortable, no collisions on sync.                            |
| D2  | Money       | Integer cents. One formatter `formatZAR(cents)` in `packages/shared` → `R12.99` (retailer style, not `Intl` `en-ZA` which gives `R 12,99`).                                                                                       | One display format, matches pamphlets.                                        |
| D3  | Time        | Timestamps: integer epoch ms (UTC). Validity windows: `YYYY-MM-DD` text, meaning the whole day in `Africa/Johannesburg`.                                                                                                          | Pamphlet dates are SA calendar dates; avoids end-of-day UTC bugs.             |
| D4  | Prices      | Single **append-only `prices` table** with `is_promo`. Replaces `deals` + `price_observations`: history is simply the older rows. Current price = latest valid row for the most specific scope (store > region > national).       | Covers regular shelf prices as well as specials; history comes for free.      |
| D5  | Staleness   | Regular prices count as current for 60 days after `observed_at`; older ones show as "last seen R X on date" and don't feed the recommendation. Promos are valid only within `valid_from..valid_to`.                               | Pamphlets only cover specials; stale prices must not look current.            |
| D6  | Promos      | `promo_type`: `none` \| `multibuy` (`promo_qty` for `promo_price_cents` bundle, e.g. 3 for R50) \| `buy_x_get_y` (`promo_qty`, `promo_free_qty`). `promo_member_only` flag. Percent-off is stored as the resulting `price_cents`. | Promos stay structured, so the maths is exact.                                |
| D7  | Sizes       | `size_value` + `size_unit` (`g` \| `ml` \| `each`) + `pack_count` (default 1) + `sold_by_weight` (price is per kg). kg/L converted to g/ml on input.                                                                              | Handles multipacks and loose produce.                                         |
| D8  | Uploads     | Upload **through the Worker** to the R2 binding (`PUT /api/pamphlets/:id/pages/:n`), max 8 MB per page, no presigned URLs.                                                                                                        | Presigning needs S3 API keys; compressed images are small.                    |
| D9  | PDFs        | Rendered to JPEG pages **client-side** with pdf.js, lazy-loaded only on the upload route. One `pamphlet_pages` row and one queue message per page.                                                                                | Workers can't rasterize; keeps the model choice open.                         |
| D10 | Matching    | M4: normalized-name FTS5 + brand/size scoring in D1. M6: swap in Vectorize behind the same `matchProduct()` interface.                                                                                                            | Removes the M4/M6 contradiction.                                              |
| D11 | Sync        | Dexie outbox of ops → `POST /api/sync/push`; `GET /api/sync/pull?cursor=`. Last-write-wins per field using `updated_at` from the client; tombstones via `deleted_at`. Server cursor = monotonic `server_seq`.                     | Offline-first for all lists; the M6 Durable Object reuses the same op format. |
| D12 | Moderation  | `users.trust`: `new` \| `trusted` \| `admin`. Pamphlets from `new` users go to `pending_approval` after review; admin approves. Promotion to `trusted` is manual (for now).                                                       | Stops bad prices reaching everyone before Phase 3 trust scores.               |
| D13 | Store scope | Users pick "my stores" (defaults to all stores in their region). Recommendations only consider those.                                                                                                                             | Stand-in for distance until Phase 3.                                          |
| D14 | Vague items | Two-level taxonomy `categories` → `product_types` (e.g. Bakery → White bread loaf). Vague list items map to a `product_type`; specific items map to a `product`.                                                                  | "bread" must not resolve to rolls.                                            |
| D15 | Auth        | Better Auth (email + password, Google optional) with the Drizzle adapter on D1. `nodejs_compat` flag on.                                                                                                                          | As planned; keeps auth data in D1.                                            |
| D16 | Testing     | Vitest everywhere; `@cloudflare/vitest-pool-workers` for API/D1; Playwright for a small e2e smoke suite (incl. offline).                                                                                                          | Real D1 in tests; offline behaviour actually verified.                        |
| D17 | Envs        | `staging` and `production` Wrangler environments, each with its own D1/R2/Queue. CI deploys `main` → staging automatically; production via manual workflow.                                                                       | Safe migrations.                                                              |
| D18 | Privacy     | Strip EXIF client-side (re-encoding via canvas does this). Pamphlet images visible only to the uploader and admins. R2 originals deleted 90 days after `valid_to`.                                                                | POPIA and copyright.                                                          |

---

## 1. Repo layout & tooling

```
apps/
  web/            React PWA (Vite, Router, TanStack Query, Tailwind, Dexie, vite-plugin-pwa)
  api/            Hono Worker: fetch (API), queue (extraction), scheduled (cron)
packages/
  shared/         Zod schemas, API types, money/unit-price/promo maths, recommendation engine (pure)
  db/             Drizzle schema, migrations, seed scripts
docs/             PLAN.md, IMPLEMENTATION.md, adr/
.github/workflows ci.yml, deploy.yml
```

- One Worker: `@cloudflare/vite-plugin` builds `apps/web` as static assets and `apps/api` as the Worker entry; `/api/*` → Hono, everything else → SPA fallback.
- The recommendation engine lives in `packages/shared` as pure functions, so it runs on the server **and** offline on the client (a snapshot of the trip).
- Root scripts: `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `db:generate`, `db:migrate:local`, `db:migrate:staging`, `db:migrate:prod`, `db:seed:local`, `deploy:staging`, `deploy:prod`.
- Lint/format: ESLint (typescript-eslint strict) + Prettier. `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`.
- Bundle budget: initial JS ≤ 150 KB gzip, enforced in CI (`size-limit`).

---

## 2. Full schema (built up across milestones)

Only the milestone that introduces a table creates it. `created_at`/`updated_at` (epoch ms) on every table unless noted.

**Auth (M1)**: Better Auth tables (`user`, `session`, `account`, `verification`) + `user.trust`.

**`regions`** (M1, seeded): `id`, `name` (Gauteng, Western Cape, KZN, …).

**`user_prefs`** (M1): `user_id` PK, `region_id`, `budget_cents?`, `split_threshold_cents` (default 5000).
**`user_loyalty_cards`** (M3): `user_id`, `program` (`xtra_savings` \| `smart_shopper` \| `wrewards` \| `spar_rewards`) — PK both.
**`user_stores`** (M3): `user_id`, `store_id` — PK both.

**`lists`** (M2): `id`, `owner_id`, `household_id?`, `name`, `updated_at`, `deleted_at?`, `server_seq`.
**`list_items`** (M2): `id`, `list_id`, `text`, `quantity` (int, default 1), `category_id?`, `product_type_id?` (M3), `product_id?` (M3), `checked`, `checked_updated_at`, `text_updated_at`, `position`, `updated_at`, `deleted_at?`, `server_seq`.

- Updated timestamps per field make last-write-wins work per field (checking an item doesn't clobber a rename).

**`chains`** (M3): `id`, `name`, `tier` (`major`\|`regional`\|`informal`), `loyalty_program?`.
**`stores`** (M3): `id`, `chain_id`, `name`, `region_id`, `suburb?`, `lat?`, `lng?`, `created_by?`.
**`categories`** (M3): `id`, `name`, `sort` (also used for checklist aisle grouping).
**`product_types`** (M3): `id`, `category_id`, `name`, `default_size_unit`.
**`products`** (M3): `id`, `product_type_id`, `name`, `brand?`, `size_value`, `size_unit`, `pack_count`, `sold_by_weight`, `is_store_brand`, `normalized_name` (+ FTS5 virtual table `products_fts`).

**`prices`** (M3, append-only): `id`, `product_id`, `chain_id`, `region_id?`, `store_id?`, `price_cents`, `member_price_cents?`, `is_promo`, `promo_type`, `promo_qty?`, `promo_price_cents?`, `promo_free_qty?`, `promo_member_only`, `valid_from?`, `valid_to?`, `observed_at`, `source` (`manual`\|`pamphlet`\|`receipt`), `pamphlet_id?`, `created_by`, `status` (`live`\|`hidden`).

- Indexes: `(product_id, chain_id, region_id, store_id, observed_at DESC)`, `(valid_to)`.

**`pamphlets`** (M4): `id`, `chain_id`, `region_id?`, `store_id?`, `valid_from`, `valid_to`, `status` (`uploading`\|`processing`\|`review`\|`pending_approval`\|`live`\|`failed`\|`rejected`), `uploaded_by`, `content_hash` (unique per chain+region+validity → dedupe), `page_count`.
**`pamphlet_pages`** (M4): `id`, `pamphlet_id`, `page_no`, `r2_key`, `status`, `error?`, `model?`, `extracted_at?`.
**`extracted_items`** (M4): `id`, `page_id`, `raw_json`, `name`, `brand?`, `size_value?`, `size_unit?`, `pack_count`, `price_cents?`, `member_price_cents?`, promo fields, `matched_product_id?`, `match_score?`, `flags` (JSON: `implausible_price`, `no_match`, …), `review_state` (`pending`\|`accepted`\|`edited`\|`rejected`).

**`households`**, **`household_members`** (`household_id`, `user_id`, `role`), **`household_invites`** (M6).

---

## 3. Milestones

Each milestone ends with: tests green, `docs/PLAN.md` checkbox ticked, deployed to staging then production, and a short "what's new" entry in the README changelog.

### M0 — Repo bootstrap (½ day)

- [x] `git init`, `.gitignore`, `.editorconfig`, `.nvmrc` (Node 24), `packageManager` pinned in `package.json`.
- [x] pnpm workspace, `tsconfig.base.json`, ESLint + Prettier, Vitest (per-workspace `test` scripts). `packages/shared` starts with the money helpers; `apps/web`, `apps/api`, `packages/db` are generated in M1 with their real tooling.
- [x] Put `CLAUDE.md`, `docs/PLAN.md`, this file in the repo; update CLAUDE.md with the commands + conventions from §0/§1.
- [x] `ci.yml` written.
- [ ] GitHub repo created and pushed; CI green on GitHub.

**Done when:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes locally and in CI on an empty skeleton.

### M1 — Foundation

**API/infra**

- [ ] `wrangler.jsonc` with `staging`/`production` envs, D1 binding, `nodejs_compat`, assets config with SPA fallback.
- [ ] Hono app: `/api/health`, error handler (Zod errors → 400 with issues), request logging, `requireUser` middleware.
- [ ] Drizzle schema: auth tables, `regions`, `user_prefs`. First migration + seed regions.
- [ ] Better Auth mounted at `/api/auth/*`; session cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- [ ] `GET/PUT /api/me/prefs`, `DELETE /api/me` (POPIA: cascades all user data; R2 objects queued for deletion in M4).

**Web**

- [ ] Vite + React + Router + TanStack Query + Tailwind shell; routes: `/`, `/login`, `/signup`, `/settings`, `/privacy`.
- [ ] Typed API client (`hc` from Hono or a thin fetch wrapper using shared Zod schemas).
- [ ] Onboarding: choose region after signup.
- [ ] Privacy policy page (what is collected, why, retention, deletion).

**Deploy**

- [ ] `deploy.yml`: on `main` → apply D1 migrations to staging → `wrangler deploy --env staging`. Manual dispatch → production.

**Tests:** auth sign-up/sign-in flow on the Workers pool; prefs validation; account deletion removes rows.
**Done when:** a user can sign up on the production URL, set a region, and delete their account.

### M2 — Lists + offline checklist

**Shared**

- [ ] Zod schemas: `List`, `ListItem`, `SyncOp` (`upsert_list`, `delete_list`, `upsert_item` with per-field timestamps, `delete_item`), `PushRequest/Response`, `PullResponse`.
- [ ] `mergeItem(local, remote)` last-write-wins per field — pure and unit-tested (clock skew, concurrent check/uncheck, delete-vs-edit: delete wins).

**API**

- [ ] `POST /api/sync/push` (batch ≤ 200 ops, idempotent by op id), `GET /api/sync/pull?cursor=` (returns rows with `server_seq > cursor`, including tombstones).
- [ ] Authorization: every op checks list ownership.

**Web**

- [ ] Dexie DB: `lists`, `items`, `outbox`, `meta(cursor)`. UI reads **only** from Dexie (`useLiveQuery`); TanStack Query is not used for list data.
- [ ] Sync engine: flushes outbox when back online, on app focus, and every 30 s while visible; exponential backoff; pull after push.
- [ ] List pages: list index, list detail (add / edit / reorder / delete items, quantity), checklist mode (big tap targets, checked items sink, grouped by category once M3 exists).
- [ ] vite-plugin-pwa: app shell precache, `navigateFallback`, update prompt, manifest + icons. Offline indicator in header.

**Tests:** merge unit tests; sync route tests; Playwright: create list → go offline → check items → reload → still checked → go online → server has state.
**Done when:** a list created on phone A appears on phone B (same account), and a full trip works in airplane mode.

### M3 — Chains, stores, products, manual prices

**Data**

- [ ] Seed script (`packages/db/seed`): major chains + loyalty programs, ~20 categories, ~150 product types, ~300 common products for one metro (Gauteng first), a handful of stores.
- [ ] `prices`, taxonomy, `products_fts`, `user_loyalty_cards`, `user_stores` migrations.

**Shared**

- [ ] `unitPrice(product, priceCents)` → cents per 100 g / 100 ml / each (accounting for `pack_count`, `sold_by_weight`).
- [ ] `lineCost(price, qty, heldCards)` — applies member price only if the card is held, multibuy/BOGOF only when `qty` qualifies; exhaustively unit-tested.
- [ ] `resolveCurrentPrice(rows, store, today)` — scope specificity + staleness rules (D4/D5).

**API**

- [ ] `GET /api/chains`, `GET /api/stores?region=`, `POST /api/stores` (users can add informal stores: spaza, butcher).
- [ ] `GET /api/products/search?q=` (FTS5), `POST /api/products` (user-created, flagged for admin tidy-up).
- [ ] `POST /api/prices` (manual entry), `GET /api/products/:id/prices?region=`.
- [ ] `PUT /api/me/loyalty-cards`, `PUT /api/me/stores`.

**Web**

- [ ] Settings: loyalty cards, my stores.
- [ ] List item editor: type freely; autocomplete suggests product types (vague) and products (specific).
- [ ] Price entry form: store → product search/create → price, member price, promo → submit. Built for one-handed in-store use.
- [ ] Product page: current price per store + unit price.
- [ ] Checklist grouped by category order.

**Tests:** unit price/promo/resolution maths; price scope resolution against D1.
**Done when:** a user can log prices at three stores and see per-store prices and unit prices on a product page.

### M4 — Pamphlet pipeline

**Upload (web)**

- [ ] Upload route (lazy chunk): pick images/PDF → pdf.js renders pages → canvas resize to max 1600 px long edge, JPEG q≈0.75 (strips EXIF) → hash → `POST /api/pamphlets` (chain, region/store, validity dates, hash, page count) → `PUT` each page → `POST /api/pamphlets/:id/submit`.
- [ ] Duplicate hit on create → "This pamphlet is already in — view it".

**Pipeline (api)**

- [ ] Submit enqueues one message per page `{pamphletId, pageId}`; queue `max_retries: 3` + dead-letter queue.
- [ ] Consumer: read R2 → vision model via AI Gateway (caching on) with a strict JSON-schema prompt → Zod-parse → normalize sizes/prices to cents → plausibility flags (price outside 0.2×–5× the product-type median, missing size) → `matchProduct()` (D10) → write `extracted_items` → when all pages done, set status `review`.
- [ ] `extraction/` module has the model call behind an interface, so benchmarking models is a config change.
- [ ] Benchmark script: 10–20 real SA pamphlet pages with hand-labelled JSON → precision/recall of name/price/size per model; results go in `docs/adr/`.

**Review (web)**

- [ ] Review screen: page image beside the extracted rows; edit fields, re-match product, accept/reject, bulk-accept high-confidence rows.
- [ ] Publish → accepted rows become `prices` (`source=pamphlet`, `is_promo=true`); pamphlet → `live`, or `pending_approval` for `new` users (D12).
- [ ] Admin queue: approve/reject pending pamphlets.

**Cron (daily 00:05 SAST = 22:05 UTC)**

- [ ] Mark pamphlets with `valid_to < today` as `expired`; delete R2 pages 90 days after expiry (D18). Price validity is filtered at query time, not by cron.

**Tests:** consumer with a stubbed model (fixture JSON → expected rows); Zod rejects malformed output; plausibility flags; publish permissions.
**Done when:** uploading a real Checkers pamphlet gives reviewable deals within ~2 minutes, and publishing makes them visible on product pages.

### M5 — Recommendation engine

**Shared (pure, in `packages/shared/recommend`)**

- [ ] Input: list items (resolved to product or product type + quantity), candidate stores, current prices, held cards, budget, split threshold.
- [ ] Per item per store: specific → that product only; vague → cheapest `lineCost` across products of that type that meet the requested quantity/size. Record `missing` if nothing.
- [ ] Single-store plans: total per store, ranked by **coverage first, then total**.
- [ ] Two-store split: brute force over store pairs; each item goes to the cheaper store of the pair; show only if savings ≥ threshold versus the best single store with equal-or-better coverage.
- [ ] Budget mode: if over budget, suggest swaps (store brand / cheaper product of the same type) sorted by saving until under budget.
- [ ] Output lists items with no price as "no recent price", never dropped.
- [ ] Property-based tests (fast-check): split total ≤ best single-store total; never uses member prices for cards not held; coverage never silently decreases.

**API / Web**

- [ ] `GET /api/lists/:id/recommendation` (server computes from D1 data).
- [ ] Recommendation screen: best single store vs. split, per-item breakdown, savings, budget bar.
- [ ] "Start trip" snapshots recommendation + prices into Dexie; checklist groups by store → category; works fully offline.

**Done when:** for a 20-item list across 3+ stores, the app shows the cheapest single store and a split (when it's worth it), and the trip checklist works offline.

### M6 — Polish

- [ ] **Households:** tables + invite links; a `ListRoom` Durable Object per shared list relays the same `SyncOp`s over WebSockets (hibernation API), persists through the existing sync routes, and uses the same `mergeItem`.
- [ ] **Price history:** chart on the product page from `prices` rows; "is this deal good?" badge = promo price vs. the 90-day min/median.
- [ ] **Vectorize matching:** embed product names (Workers AI embedding model), backfill script, `matchProduct()` switches implementation; compare match accuracy with the FTS baseline on the benchmark set.

---

## 4. Cross-cutting

- **Observability:** Workers Logs on; structured `console.log({event, ...})` for queue jobs; AI Gateway dashboard for model cost/latency.
- **Security:** Zod on every input; ownership checks in one `assertCanAccessList` helper; rate limits (Workers rate-limiting binding) on auth, uploads, price submission.
- **Accessibility/perf:** Lighthouse CI on PWA + a11y in `ci.yml`; tap targets ≥ 44 px; works at 360 px width.
- **Portfolio:** README with architecture diagram, screenshots/GIF, "decisions" linking `docs/adr/`, and how to run locally in three commands.

## 5. Risks to watch

| Risk                                          | Mitigation                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Too few regular prices → weak recommendations | Seed one metro well; make manual entry very fast; receipts in Phase 2.  |
| Extraction accuracy on dense SA pamphlets     | Benchmark first (M4); tile large pages; the review screen is mandatory. |
| Bad/abusive uploads                           | D12 approval for new users; `prices.status=hidden` for takedowns.       |
| Sync bugs                                     | Pure merge function with heavy tests; e2e offline test in CI.           |
| Bundle creep                                  | `size-limit` in CI; pdf.js and review screen lazy-loaded.               |
