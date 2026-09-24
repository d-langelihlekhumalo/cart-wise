# Grocery Tracker & Recommender — Plan

Product plan. Engineering decisions, schema and per-milestone tasks live in [`IMPLEMENTATION.md`](./IMPLEMENTATION.md).

## 1. Product overview

The core loop: **prices come in → user's list is matched → app recommends where to buy → user shops with an offline checklist → data flows back.**

### Target market: South Africa

**Store tiers**

- **Major chains:** Checkers, Shoprite, Pick n Pay, Woolworths, Spar, Boxer, Usave, OK Foods, Food Lover's Market, Makro. Regular pamphlets; main extraction source.
- **Mid-size/regional:** Cambridge Food, Choppies, Save Hyper, independents, wholesalers. Pamphlets often shared as WhatsApp/Facebook images.
- **Small/informal:** spaza shops, butchers, fruit & veg stalls. No pamphlets; rely on manual, community-entered prices.

**SA quirks to model**

- Loyalty-card member prices (Xtra Savings, Smart Shopper, WRewards, Spar Rewards). Users set which cards they hold.
- Regional pamphlets (Western Cape vs. Gauteng vs. KZN, etc.); Spar prices vary per franchise store.
- Store brands (Ritebrand, No Name, Housebrand, Woolworths) vs. name brands (Clover, Albany, Sasko, Tastic, Iwisa…).
- Bulk staples (maize meal, rice, sugar, oil, flour in 5/10/12.5 kg) — unit price matters most here.
- Multipacks (6 × 1 L) and per-kg items (mince, loose produce).
- Promos cluster around month-end and SASSA payout dates.
- Delivery-app prices (Sixty60, asap!) can differ — out of scope for MVP.

**Pamphlets only cover specials.** Most items on a typical list aren't on promotion in a given week, so recommendations also need **regular shelf prices**. MVP sources: seeded data for one metro, fast manual entry, and carrying forward the last known price (for up to 60 days). Receipt scanning (Phase 2) is the long-term source.

**Design implications**

- Lightweight app; compress uploads; aggressive caching; offline shopping mode.
- Budget framing: "cheapest way to fit this list under R800."
- Users choose the stores they actually shop at; recommendations stay within those.
- English first; design for Afrikaans/isiZulu/isiXhosa later.
- POPIA compliance: privacy policy, minimal data, account deletion, uploaded images kept private.
- Copyright: publish extracted prices only, never redistribute pamphlet images.
- Seed data manually for one metro first (Gauteng); avoid automated scraping (ToS risk).

## 2. Features

### MVP

- Accounts, region, loyalty cards held, "my stores", budget, split-trip savings threshold
- Lists with vague ("bread") or specific ("Albany Superior White 700g") items, with quantities
- Pamphlet upload (photo/PDF/WhatsApp image) → AI extraction → uploader review → publish (admin approval for new uploaders)
- Prices scoped by chain + region (+ store), with member vs. normal price and structured promos
- Manual price entry for any store, including informal ones
- Recommendation: cheapest single store vs. cheapest two-store split, respecting loyalty cards and budget
- Offline shopping checklist grouped by store then category

### Phase 2

- Shared household lists with live sync
- Price history per product ("is this deal actually good?")
- Receipt scanning for real paid prices

### Phase 3

- Deal alerts on frequently bought items
- Stock-up suggestions at historical lows / payday cycles
- Store-brand substitution suggestions
- Uploader trust scores, flag/confirm prices
- Distance/fuel-aware recommendations

## 3. Architecture

| Concern     | Choice                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| Frontend    | React + TS + Vite, TanStack Query, React Router, Tailwind                    |
| PWA/offline | vite-plugin-pwa, Dexie (IndexedDB), outbox-based sync                        |
| Hosting     | Cloudflare Worker + static assets (`@cloudflare/vite-plugin`)                |
| API         | Hono + Zod                                                                   |
| DB          | D1 + Drizzle (FTS5 for product search)                                       |
| Files       | R2, uploaded through the Worker                                              |
| Jobs        | Queues (extraction, one message per page), Cron Triggers (expiry, cleanup)   |
| AI          | Vision LLM via AI Gateway (benchmark models on 10–20 real SA pamphlet pages) |
| Matching    | FTS5 + brand/size scoring (M4) → Vectorize embeddings (M6), same interface   |
| Realtime    | Durable Object per shared list, WebSockets                                   |
| Auth        | Better Auth on D1 (Clerk as fallback)                                        |

### Repo structure

```
apps/web        React PWA
apps/api        Hono Worker (API + queue consumer + cron)
packages/shared Zod schemas, types, money/unit-price/promo maths, recommendation engine
packages/db     Drizzle schema + migrations + seed
```

## 4. Data model (summary)

Full column-level schema: [`IMPLEMENTATION.md` §2](./IMPLEMENTATION.md#2-full-schema-built-up-across-milestones).

| Table                                             | Purpose                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `regions`                                         | Fixed list of regions shared by stores, prices and user prefs             |
| `chains`, `stores`                                | Retailers and locations (users can add informal stores)                   |
| `categories`, `product_types`, `products`         | Taxonomy for vague items → normalized catalogue for specific items        |
| `prices`                                          | Append-only: regular and promo prices, scoped chain/region/store; history |
| `pamphlets`, `pamphlet_pages`                     | Uploads (deduplicated by hash), one row per page                          |
| `extracted_items`                                 | AI output awaiting review                                                 |
| `lists`, `list_items`                             | Shopping lists; client IDs, per-field timestamps, tombstones for sync     |
| `households`, `household_members`                 | Sharing (M6)                                                              |
| `user_prefs`, `user_loyalty_cards`, `user_stores` | Personalization                                                           |

Rules: money in integer cents; member price separate; promos structural; sizes normalized (+ pack count, sold-by-weight).

## 5. Pamphlet pipeline

1. **Upload:** client renders PDFs to pages, compresses images (strips EXIF), hashes → creates `pamphlets` row (duplicate hash → link to the existing pamphlet) → uploads each page through the Worker to R2.
2. **Queue:** one message per page; consumer calls the vision model with a strict prompt + JSON schema (name, brand, size, pack count, price, member price, promo details).
3. **Validate:** Zod-parse output; normalize to cents and base units; flag implausible prices.
4. **Match:** `matchProduct()` → auto-link above threshold; otherwise flag for review / create pending product.
5. **Review:** uploader sees extracted rows beside the page image, corrects, publishes → `live` (or `pending_approval` for new uploaders).
6. **Expire:** daily cron marks expired pamphlets and deletes R2 images 90 days after expiry. Prices are filtered by validity at query time.

## 6. Recommendation engine

1. Gather current prices for the user's stores; apply member prices only for held cards.
2. Vague items → cheapest suitable product of the same product type; specific items → exact product only.
3. Compare by unit price while meeting the requested quantity; apply multi-buy promos only when quantity qualifies.
4. Compute the cheapest single store (ranked by coverage, then total) and the cheapest two-store split (brute force over store pairs).
5. Show split only if savings ≥ user threshold. Budget mode flags overage and suggests cheaper swaps.
6. Items with no data show "no recent price" — never silently dropped.

## 7. Offline shopping mode

- All list data lives in IndexedDB first; changes go to an outbox and sync when online (last-write-wins per field, tombstones for deletes).
- Starting a trip snapshots list + recommendation + prices into IndexedDB.
- Shared lists: Durable Object relays the same sync operations live.
- Service worker caches the app shell.

## 8. Milestones

Deploys are deferred until the Cloudflare account is set up; M1–M3 are verified locally and in CI.

- [x] **M0 Bootstrap:** git, pnpm workspace, TS/ESLint/Prettier/Vitest, CI
- [x] **M1 Foundation:** Worker serves React, D1 + Drizzle, auth, prefs, account deletion, privacy page, deploy pipeline
- [x] **M2 Lists:** list CRUD, offline sync, offline checklist, PWA shell
- [x] **M3 Prices:** chains, stores, taxonomy, products, manual price entry, loyalty cards, my stores
- [ ] **M4 Pamphlets:** upload, queue, extraction, review screen, approval, expiry cron
- [ ] **M5 Recommendations:** unit prices, loyalty cards, split trips, budget mode, trip snapshot
- [ ] **M6 Polish:** shared households, price history, Vectorize matching

## 9. Costs

Hobby scale fits Cloudflare free / $5 paid tier. AI extraction is the main variable cost — use AI Gateway caching, dedupe pamphlets by hash, and never reprocess reviewed pamphlets.
